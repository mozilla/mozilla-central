/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
  BACKGROUND
  ----------

  At the simplest level, multipart/alternative means "pick one of these and
  display it." However, it's actually a lot more complicated than that.

  The alternatives are in preference order, and counterintuitively, they go
  from *least* to *most* preferred rather than the reverse. Therefore, when
  we're parsing, we can't just take the first one we like and throw the rest
  away -- we have to parse through the whole thing, discarding the n'th part if
  we are capable of displaying the n+1'th.

  Adding a wrinkle to that is the fact that we give the user the option of
  demanding the plain-text alternative even though we are perfectly capable of
  displaying the HTML, and it is almost always the preferred format, i.e., it
  almost always comes after the plain-text alternative.

  Speaking of which, you can't assume that each of the alternatives is just a
  basic text/[whatever]. There may be, for example, a text/plain followed by a
  multipart/related which contains text/html and associated embedded
  images. Yikes!

  You also can't assume that there will be just two parts. There can be an
  arbitrary number, and the ones we are capable of displaying and the ones we
  aren't could be interspersed in any order by the producer of the MIME.

  We can't just throw away the parts we're not displaying when we're processing
  the MIME for display. If we were to do that, then the MIME parts that
  remained wouldn't get numbered properly, and that would mean, for example,
  that deleting attachments wouldn't work in some messages. Indeed, that very
  problem is what prompted a rewrite of this file into its current
  architecture.

  ARCHITECTURE
  ------------

  Parts are read and queued until we know whether we're going to display
  them. If the first pending part is one we don't know how to display, then we
  can add it to the MIME structure immediatelly, with output_p disabled. If the
  first pending part is one we know how to display, then we can't add it to the
  in-memory MIME structure until either (a) we encounter a later, more
  preferred part we know how to display, or (b) we reach the end of the
  parts. A display-capable part of the queue may be followed by one or more
  display-incapable parts. We can't add them to the in-memory structure until
  we figure out what to do with the first, display-capable pending part,
  because otherwise the order and numbering will be wrong. All of the logic in
  this paragraph is implemented in the flush_children function.

  The display_cached_part function is what actually adds a MIME part to the
  in-memory MIME structure. There is one complication there which forces us to
  violate abstrations... Even if we set output_p on a child before adding it to
  the parent, the parse_begin function resets it. The kluge I came up with to
  prevent that was to give the child a separate options object and set
  output_fn to nullptr in it, because that causes parse_begin to set output_p to
  false. This seemed like the least onerous way to accomplish this, although I
  can't say it's a solution I'm particularly fond of.

  Another complication in display_cached_part is that if we were just a normal
  multipart type, we could rely on MimeMultipart_parse_line to notify emitters
  about content types, character sets, part numbers, etc. as our new children
  get created. However, since we defer creation of some children, the
  notification doesn't happen there, so we have to handle it
  ourselves. Unfortunately, this requires a small abstraction violation in
  MimeMultipart_parse_line -- we have to check there if the entity is
  multipart/alternative and if so not notify emitters there because
  MimeMultipartAlternative_create_child handles it.

  - Jonathan Kamens, 2010-07-23
*/

#include "mimemalt.h"
#include "prmem.h"
#include "plstr.h"
#include "prlog.h"
#include "nsMimeTypes.h"
#include "nsMimeStringResources.h"
#include "nsIPrefBranch.h"
#include "mimemoz2.h" // for prefs

extern "C" MimeObjectClass mimeMultipartRelatedClass;

#define MIME_SUPERCLASS mimeMultipartClass
MimeDefClass(MimeMultipartAlternative, MimeMultipartAlternativeClass,
       mimeMultipartAlternativeClass, &MIME_SUPERCLASS);

static int MimeMultipartAlternative_initialize (MimeObject *);
static void MimeMultipartAlternative_finalize (MimeObject *);
static int MimeMultipartAlternative_parse_eof (MimeObject *, bool);
static int MimeMultipartAlternative_create_child(MimeObject *);
static int MimeMultipartAlternative_parse_child_line (MimeObject *, const char *,
                            int32_t, bool);
static int MimeMultipartAlternative_close_child(MimeObject *);

static int MimeMultipartAlternative_flush_children(MimeObject *, bool, bool);
static bool MimeMultipartAlternative_display_part_p(MimeObject *self,
                             MimeHeaders *sub_hdrs);
static int MimeMultipartAlternative_display_cached_part(MimeObject *,
                                                        MimeHeaders *,
                                                        MimePartBufferData *,
                                                        bool);

static int
MimeMultipartAlternativeClassInitialize(MimeMultipartAlternativeClass *clazz)
{
  MimeObjectClass    *oclass = (MimeObjectClass *)    clazz;
  MimeMultipartClass *mclass = (MimeMultipartClass *) clazz;
  PR_ASSERT(!oclass->class_initialized);
  oclass->initialize       = MimeMultipartAlternative_initialize;
  oclass->finalize         = MimeMultipartAlternative_finalize;
  oclass->parse_eof        = MimeMultipartAlternative_parse_eof;
  mclass->create_child     = MimeMultipartAlternative_create_child;
  mclass->parse_child_line = MimeMultipartAlternative_parse_child_line;
  mclass->close_child      = MimeMultipartAlternative_close_child;
  return 0;
}


static int
MimeMultipartAlternative_initialize (MimeObject *obj)
{
  MimeMultipartAlternative *malt = (MimeMultipartAlternative *) obj;

  NS_ASSERTION(!malt->part_buffers, "object initialized multiple times");
  NS_ASSERTION(!malt->buffered_hdrs, "object initialized multiple times");
  malt->pending_parts = 0;
  malt->max_parts = 0;
  malt->buffered_hdrs = nullptr;
  malt->part_buffers = nullptr;
  
  return ((MimeObjectClass*)&MIME_SUPERCLASS)->initialize(obj);
}

static void
MimeMultipartAlternative_cleanup(MimeObject *obj)
{
  MimeMultipartAlternative *malt = (MimeMultipartAlternative *) obj;
  int32_t i;

  for (i = 0; i < malt->pending_parts; i++) {
    MimeHeaders_free(malt->buffered_hdrs[i]);
    MimePartBufferDestroy(malt->part_buffers[i]);
  }
  PR_FREEIF(malt->buffered_hdrs);
  PR_FREEIF(malt->part_buffers);
  malt->pending_parts = 0;
}


static void
MimeMultipartAlternative_finalize (MimeObject *obj)
{
  MimeMultipartAlternative_cleanup(obj);
  ((MimeObjectClass*)&MIME_SUPERCLASS)->finalize(obj);
}


static int
MimeMultipartAlternative_flush_children(MimeObject *obj,
                                        bool finished,
                                        bool next_is_displayable)
{
  /*
    Possible states:

    1. Cache contains nothing: do nothing.

    2. Finished, and the cache contains one displayable body followed
       by zero or more non-displayable bodies:

    3. Finished, and the cache contains one non-displayable body:
       create it with output off.

    4. Not finished, and the cache contains one displayable body
       followed by zero or more non-displayable bodies, and the new
       body we're about to create is displayable: create all cached
       bodies with output off.

    5. Not finished, and the cache contains one displayable body
       followed by zero or more non-displayable bodies, and the new
       body we're about to create is non-displayable: do nothing.

    6. Not finished, and the cache contains one non-displayable body:
       create it with output off.
  */
  MimeMultipartAlternative *malt = (MimeMultipartAlternative *) obj;
  bool have_displayable, do_flush, do_display;

  /* Case 1 */
  if (! malt->pending_parts)
    return 0;

  have_displayable =
    MimeMultipartAlternative_display_part_p(obj, malt->buffered_hdrs[0]);
  
  if (finished && have_displayable) {
    /* Case 2 */
    do_flush = true;
    do_display = true;
  }
  else if (finished && ! have_displayable) {
    /* Case 3 */
    do_flush = true;
    do_display = false;
  }
  else if (! finished && have_displayable && next_is_displayable) {
    /* Case 4 */
    do_flush = true;
    do_display = false;
  }
  else if (! finished && have_displayable && ! next_is_displayable) {
    /* Case 5 */
    do_flush = false;
    do_display = false;
  }
  else if (! finished && ! have_displayable) {
    /* Case 6 */
    do_flush = true;
    do_display = false;
  }
  else {
    NS_ERROR("mimemalt.cpp: logic error in flush_children");
    return -1;
  }
  
  if (do_flush) {
    int32_t i;
    for (i = 0; i < malt->pending_parts; i++) {
      MimeMultipartAlternative_display_cached_part(obj,
                                                   malt->buffered_hdrs[i],
                                                   malt->part_buffers[i],
                                                   do_display && (i == 0));
      MimeHeaders_free(malt->buffered_hdrs[i]);
      MimePartBufferDestroy(malt->part_buffers[i]);
    }
    malt->pending_parts = 0;
  }
  return 0;
}

static int
MimeMultipartAlternative_parse_eof (MimeObject *obj, bool abort_p)
{
  int status = 0;

  if (obj->closed_p) return 0;

  status = ((MimeObjectClass*)&MIME_SUPERCLASS)->parse_eof(obj, abort_p);
  if (status < 0) return status;


  status = MimeMultipartAlternative_flush_children(obj, true, false);
  if (status < 0)
    return status;

  MimeMultipartAlternative_cleanup(obj);

  return status;
}


static int
MimeMultipartAlternative_create_child(MimeObject *obj)
{
  MimeMultipart *mult = (MimeMultipart *) obj;
  MimeMultipartAlternative *malt = (MimeMultipartAlternative *) obj;

  bool displayable =
    MimeMultipartAlternative_display_part_p (obj, mult->hdrs);

  MimeMultipartAlternative_flush_children(obj, false, displayable);

  mult->state = MimeMultipartPartFirstLine;
  int32_t i = malt->pending_parts++;
  if (malt->pending_parts > malt->max_parts) {
    malt->max_parts = malt->pending_parts;
    MimeHeaders **newBuf = (MimeHeaders **)
      PR_REALLOC(malt->buffered_hdrs,
                 malt->max_parts * sizeof(*malt->buffered_hdrs));
    NS_ENSURE_TRUE(newBuf, MIME_OUT_OF_MEMORY);
    malt->buffered_hdrs = newBuf;

    MimePartBufferData **newBuf2 = (MimePartBufferData **)
      PR_REALLOC(malt->part_buffers,
                 malt->max_parts * sizeof(*malt->part_buffers));
    NS_ENSURE_TRUE(newBuf2, MIME_OUT_OF_MEMORY);
    malt->part_buffers = newBuf2;
  }

  malt->buffered_hdrs[i] = MimeHeaders_copy(mult->hdrs);
  NS_ENSURE_TRUE(malt->buffered_hdrs[i], MIME_OUT_OF_MEMORY);

  malt->part_buffers[i] = MimePartBufferCreate();
  NS_ENSURE_TRUE(malt->part_buffers[i], MIME_OUT_OF_MEMORY);

  return 0;
}


static int
MimeMultipartAlternative_parse_child_line (MimeObject *obj,
                       const char *line, int32_t length,
                       bool first_line_p)
{
  MimeMultipartAlternative *malt = (MimeMultipartAlternative *) obj;

  NS_ASSERTION(malt->pending_parts, "should be pending parts, but there aren't");
  if (!malt->pending_parts)
    return -1;
  int32_t i = malt->pending_parts - 1;

  /* Push this line into the buffer for later retrieval. */
  return MimePartBufferWrite (malt->part_buffers[i], line, length);
}


static int
MimeMultipartAlternative_close_child(MimeObject *obj)
{
  MimeMultipartAlternative *malt = (MimeMultipartAlternative *) obj;
  MimeMultipart *mult = (MimeMultipart *) obj;

  /* PR_ASSERT(malt->part_buffer);      Some Mac brokenness trips this...
  if (!malt->part_buffer) return -1; */

  if (malt->pending_parts)
    MimePartBufferClose(malt->part_buffers[malt->pending_parts-1]);

  /* PR_ASSERT(mult->hdrs);         I expect the Mac trips this too */

  if (mult->hdrs) {
    MimeHeaders_free(mult->hdrs);
    mult->hdrs = 0;
  }

  return 0;
}


static bool
MimeMultipartAlternative_display_part_p(MimeObject *self,
                    MimeHeaders *sub_hdrs)
{
  char *ct = MimeHeaders_get (sub_hdrs, HEADER_CONTENT_TYPE, true, false);
  if (!ct)
    return false;

  /* RFC 1521 says:
     Receiving user agents should pick and display the last format
     they are capable of displaying.  In the case where one of the
     alternatives is itself of type "multipart" and contains unrecognized
     sub-parts, the user agent may choose either to show that alternative,
     an earlier alternative, or both.

   Ugh.  If there is a multipart subtype of alternative, we simply show
   that, without descending into it to determine if any of its sub-parts
   are themselves unknown.
   */

  // prefer_plaintext pref
  nsIPrefBranch *prefBranch = GetPrefBranch(self->options);
  bool prefer_plaintext = false;
  if (prefBranch)
    prefBranch->GetBoolPref("mailnews.display.prefer_plaintext",
                            &prefer_plaintext);
  if (prefer_plaintext
      && self->options->format_out != nsMimeOutput::nsMimeMessageSaveAs
      && (!PL_strncasecmp(ct, "text/html", 9) ||
          !PL_strncasecmp(ct, "text/enriched", 13) ||
          !PL_strncasecmp(ct, "text/richtext", 13))
     )
    // if the user prefers plaintext and this is the "rich" (e.g. HTML) part...
  {
    return false;
  }

  MimeObjectClass *clazz = mime_find_class (ct, sub_hdrs, self->options, true);
  bool result = (clazz
          ? clazz->displayable_inline_p(clazz, sub_hdrs)
          : false);
  PR_FREEIF(ct);
  return result;
}

static int
MimeMultipartAlternative_display_cached_part(MimeObject *obj,
                                             MimeHeaders *hdrs,
                                             MimePartBufferData *buffer,
                                             bool do_display)
{
  int status;

  char *ct = (hdrs
        ? MimeHeaders_get (hdrs, HEADER_CONTENT_TYPE, true, false)
        : 0);
  const char *dct = (((MimeMultipartClass *) obj->clazz)->default_part_type);
  MimeObject *body;
  /** Don't pass in NULL as the content-type (this means that the
   * auto-uudecode-hack won't ever be done for subparts of a
   * multipart, but only for untyped children of message/rfc822.
   */
  const char *uct = (ct && *ct) ? ct : (dct ? dct: TEXT_PLAIN);

  // We always want to display the cached part inline.
  body = mime_create(uct, hdrs, obj->options, true);
  PR_FREEIF(ct);
  if (!body) return MIME_OUT_OF_MEMORY;
  body->output_p = do_display;

  status = ((MimeContainerClass *) obj->clazz)->add_child(obj, body);
  if (status < 0)
  {
    mime_free(body);
    return status;
  }
  /* We need to muck around with the options to prevent output when
     do_display is false. More about this below. */
  /* add_child assigns body->options from obj->options, but that's
     just a pointer so if we muck with it in the child it'll modify
     the parent as well, which we definitely don't want. Therefore we
     need to make a copy. */
  body->options = new MimeDisplayOptions;
  *body->options = *obj->options;
  /* But we have to be careful about getting into a situation where
     memory could be double-freed. All of this is a gross abstraction
     violation which could be avoided if it were possible to tell
     parse_begin what output_p should be. */
  if (body->options->part_to_load)
    body->options->part_to_load = strdup(body->options->part_to_load);
  if (body->options->default_charset)
    body->options->default_charset = strdup(body->options->default_charset);
  
  /* parse_begin resets output_p. This is quite annoying. To convince
     it that we mean business, we set output_fn to null if we don't
     want output. */
  if (! do_display)
    body->options->output_fn = nullptr;

#ifdef MIME_DRAFTS
  /* if this object is a child of a multipart/related object, the parent is
     taking care of decomposing the whole part, don't need to do it at this level.
     However, we still have to call decompose_file_init_fn and decompose_file_close_fn
     in order to set the correct content-type. But don't call MimePartBufferRead
  */
  bool multipartRelatedChild = mime_typep(obj->parent,(MimeObjectClass*)&mimeMultipartRelatedClass);
  bool decomposeFile = do_display && obj->options &&
                  obj->options->decompose_file_p &&
                  obj->options->decompose_file_init_fn &&
                  !mime_typep(body, (MimeObjectClass *) &mimeMultipartClass);

  if (decomposeFile)
  {
    status = obj->options->decompose_file_init_fn (
                        obj->options->stream_closure, hdrs);
    if (status < 0) return status;
  }
#endif /* MIME_DRAFTS */

  /* Now that we've added this new object to our list of children,
   notify emitters and start its parser going. */
  MimeMultipart_notify_emitter(body);

  status = body->clazz->parse_begin(body);
  if (status < 0) return status;
  /* Now that parse_begin is done mucking with output_p, we can put
     body->options back to what it's supposed to be. Avoids a memory
     leak. */
  delete body->options;
  body->options = obj->options;

#ifdef MIME_DRAFTS
  if (decomposeFile && !multipartRelatedChild)
    status = MimePartBufferRead (buffer,
                  obj->options->decompose_file_output_fn,
                  obj->options->stream_closure);
  else
#endif /* MIME_DRAFTS */

  status = MimePartBufferRead (buffer,
                  /* The MimeConverterOutputCallback cast is to turn the
                   `void' argument into `MimeObject'. */
                  ((MimeConverterOutputCallback) body->clazz->parse_buffer),
                  body);

  if (status < 0) return status;

  /* Done parsing. */
  status = body->clazz->parse_eof(body, false);
  if (status < 0) return status;
  status = body->clazz->parse_end(body, false);
  if (status < 0) return status;

#ifdef MIME_DRAFTS
  if (decomposeFile)
  {
    status = obj->options->decompose_file_close_fn ( obj->options->stream_closure );
    if (status < 0) return status;
  }
#endif /* MIME_DRAFTS */

  return 0;
}
