/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "msgCore.h"
#include "mimemult.h"
#include "mimemoz2.h"
#include "mimeeobj.h"

#include "prlog.h"
#include "prmem.h"
#include "plstr.h"
#include "prio.h"
#include "nsMimeStringResources.h"
#include "nsMimeTypes.h"
#include <ctype.h>

#ifdef XP_MACOSX
  extern MimeObjectClass mimeMultipartAppleDoubleClass;
#endif

#define MIME_SUPERCLASS mimeContainerClass
MimeDefClass(MimeMultipart, MimeMultipartClass,
       mimeMultipartClass, &MIME_SUPERCLASS);

static int MimeMultipart_initialize (MimeObject *);
static void MimeMultipart_finalize (MimeObject *);
static int MimeMultipart_parse_line (const char *line, int32_t length, MimeObject *);
static int MimeMultipart_parse_eof (MimeObject *object, bool abort_p);

static MimeMultipartBoundaryType MimeMultipart_check_boundary(MimeObject *,
                                const char *,
                                int32_t);
static int MimeMultipart_create_child(MimeObject *);
static bool MimeMultipart_output_child_p(MimeObject *, MimeObject *);
static int MimeMultipart_parse_child_line (MimeObject *, const char *, int32_t,
                       bool);
static int MimeMultipart_close_child(MimeObject *);

extern "C" MimeObjectClass mimeMultipartAlternativeClass;
extern "C" MimeObjectClass mimeMultipartRelatedClass;
extern "C" MimeObjectClass mimeMultipartSignedClass;
extern "C" MimeObjectClass mimeInlineTextVCardClass;
extern "C" MimeExternalObjectClass mimeExternalObjectClass;

#if defined(DEBUG) && defined(XP_UNIX)
static int MimeMultipart_debug_print (MimeObject *, PRFileDesc *, int32_t);
#endif

static int
MimeMultipartClassInitialize(MimeMultipartClass *clazz)
{
  MimeObjectClass    *oclass = (MimeObjectClass *)    clazz;
  MimeMultipartClass *mclass = (MimeMultipartClass *) clazz;

  PR_ASSERT(!oclass->class_initialized);
  oclass->initialize  = MimeMultipart_initialize;
  oclass->finalize    = MimeMultipart_finalize;
  oclass->parse_line  = MimeMultipart_parse_line;
  oclass->parse_eof   = MimeMultipart_parse_eof;

  mclass->check_boundary   = MimeMultipart_check_boundary;
  mclass->create_child     = MimeMultipart_create_child;
  mclass->output_child_p   = MimeMultipart_output_child_p;
  mclass->parse_child_line = MimeMultipart_parse_child_line;
  mclass->close_child      = MimeMultipart_close_child;

#if defined(DEBUG) && defined(XP_UNIX)
  oclass->debug_print = MimeMultipart_debug_print;
#endif

  return 0;
}


static int
MimeMultipart_initialize (MimeObject *object)
{
  MimeMultipart *mult = (MimeMultipart *) object;
  char *ct;

  /* This is an abstract class; it shouldn't be directly instantiated. */
  PR_ASSERT(object->clazz != (MimeObjectClass *) &mimeMultipartClass);

  ct = MimeHeaders_get (object->headers, HEADER_CONTENT_TYPE, false, false);
  mult->boundary = (ct
          ? MimeHeaders_get_parameter (ct, HEADER_PARM_BOUNDARY, NULL, NULL)
          : 0);
  PR_FREEIF(ct);
  mult->state = MimeMultipartPreamble;
  return ((MimeObjectClass*)&MIME_SUPERCLASS)->initialize(object);
}


static void
MimeMultipart_finalize (MimeObject *object)
{
  MimeMultipart *mult = (MimeMultipart *) object;

  object->clazz->parse_eof(object, false);

  PR_FREEIF(mult->boundary);
  if (mult->hdrs)
  MimeHeaders_free(mult->hdrs);
  mult->hdrs = 0;
  ((MimeObjectClass*)&MIME_SUPERCLASS)->finalize(object);
}

int MimeWriteAString(MimeObject *obj, const nsACString &string)
{
  const nsCString &flatString = PromiseFlatCString(string);
  return MimeObject_write(obj, flatString.get(), flatString.Length(), true);
}

static int
MimeMultipart_parse_line (const char *line, int32_t length, MimeObject *obj)
{
  MimeMultipart *mult = (MimeMultipart *) obj;
  MimeContainer *container = (MimeContainer*) obj; 
  int status = 0;
  MimeMultipartBoundaryType boundary;

  NS_ASSERTION(line && *line, "empty line in multipart parse_line");
  if (!line || !*line) return -1;

  NS_ASSERTION(!obj->closed_p, "obj shouldn't already be closed");
  if (obj->closed_p) return -1;

  /* If we're supposed to write this object, but aren't supposed to convert
     it to HTML, simply pass it through unaltered. */
  if (obj->output_p &&
    obj->options &&
    !obj->options->write_html_p &&
    obj->options->output_fn
          && obj->options->format_out != nsMimeOutput::nsMimeMessageAttach)
  return MimeObject_write(obj, line, length, true);

  if (mult->state == MimeMultipartEpilogue)  /* already done */
    boundary = MimeMultipartBoundaryTypeNone;
  else
    boundary = ((MimeMultipartClass *)obj->clazz)->check_boundary(obj, line,
                                                                  length);

  if (boundary == MimeMultipartBoundaryTypeTerminator ||
    boundary == MimeMultipartBoundaryTypeSeparator)
  {
  /* Match!  Close the currently-open part, move on to the next
     state, and discard this line.
   */
    bool endOfPart = (mult->state != MimeMultipartPreamble);
    if (endOfPart)
      status = ((MimeMultipartClass *)obj->clazz)->close_child(obj);
    if (status < 0) return status;
    
    if (boundary == MimeMultipartBoundaryTypeTerminator)
      mult->state = MimeMultipartEpilogue;
    else
    {
      mult->state = MimeMultipartHeaders;
      
      /* Reset the header parser for this upcoming part. */
      NS_ASSERTION(!mult->hdrs, "mult->hdrs should be null here");
      if (mult->hdrs)
        MimeHeaders_free(mult->hdrs);
      mult->hdrs = MimeHeaders_new();
      if (!mult->hdrs)
        return MIME_OUT_OF_MEMORY;
      if (obj->options && obj->options->state &&
          obj->options->state->partsToStrip.Length() > 0)
      {
        nsAutoCString newPart(mime_part_address(obj));
        newPart.Append('.');
        newPart.AppendInt(container->nchildren + 1);
        obj->options->state->strippingPart = false;
        // check if this is a sub-part of a part we're stripping.
        for (uint32_t partIndex = 0; partIndex < obj->options->state->partsToStrip.Length(); partIndex++)
        {
          nsCString &curPartToStrip = obj->options->state->partsToStrip[partIndex];
          if (newPart.Find(curPartToStrip) == 0 && (newPart.Length() == curPartToStrip.Length() || newPart.CharAt(curPartToStrip.Length()) == '.'))
          {
            obj->options->state->strippingPart = true;
            if (partIndex < obj->options->state->detachToFiles.Length())
              obj->options->state->detachedFilePath = obj->options->state->detachToFiles[partIndex];
            break;
          }
        }
      }
    }
    
    // if stripping out attachments, write the boundary line. Otherwise, return
    // to ignore it.
    if (obj->options && obj->options->format_out == nsMimeOutput::nsMimeMessageAttach)
    {
      // Because MimeMultipart_parse_child_line strips out the 
      // the CRLF of the last line before the end of a part, we need to add that
      // back in here.
      if (endOfPart)
        MimeWriteAString(obj, NS_LITERAL_CSTRING(MSG_LINEBREAK));

      status = MimeObject_write(obj, line, length, true);
    }
    return 0;
  }

  /* Otherwise, this isn't a boundary string.  So do whatever it is we
   should do with this line (parse it as a header, feed it to the
   child part, ignore it, etc.) */

  switch (mult->state)
  {
    case MimeMultipartPreamble:
    case MimeMultipartEpilogue:
      /* Ignore this line. */
      break;

    case MimeMultipartHeaders:
    /* Parse this line as a header for the sub-part. */
    {
      status = MimeHeaders_parse_line(line, length, mult->hdrs);
      bool stripping = false;

      if (status < 0) return status;
      
      // If this line is blank, we're now done parsing headers, and should
      // now examine the content-type to create this "body" part.
      //
      if (*line == '\r' || *line == '\n')
      {
        if (obj->options && obj->options->state &&
            obj->options->state->strippingPart)
        {
          stripping = true;
          bool detachingPart = obj->options->state->detachedFilePath.Length() > 0;

          nsAutoCString fileName;
          fileName.Adopt(MimeHeaders_get_name(mult->hdrs, obj->options));
          if (detachingPart)
          {
            char *contentType = MimeHeaders_get(mult->hdrs, "Content-Type", false, false);
            if (contentType)
            {
              MimeWriteAString(obj, NS_LITERAL_CSTRING("Content-Type: "));
              MimeWriteAString(obj, nsDependentCString(contentType));
              PR_Free(contentType);
            }
            MimeWriteAString(obj, NS_LITERAL_CSTRING(MSG_LINEBREAK));
            MimeWriteAString(obj, NS_LITERAL_CSTRING("Content-Disposition: attachment; filename=\""));
            MimeWriteAString(obj, fileName);
            MimeWriteAString(obj, NS_LITERAL_CSTRING("\"" MSG_LINEBREAK));
            MimeWriteAString(obj, NS_LITERAL_CSTRING("X-Mozilla-External-Attachment-URL: "));
            MimeWriteAString(obj, obj->options->state->detachedFilePath);
            MimeWriteAString(obj, NS_LITERAL_CSTRING(MSG_LINEBREAK));
            MimeWriteAString(obj, NS_LITERAL_CSTRING("X-Mozilla-Altered: AttachmentDetached; date=\""));
          }
          else
          {
            nsAutoCString header("Content-Type: text/x-moz-deleted; name=\"Deleted: ");
            header.Append(fileName);
            status = MimeWriteAString(obj, header);
            if (status < 0) 
              return status;
            status = MimeWriteAString(obj, NS_LITERAL_CSTRING("\"" MSG_LINEBREAK "Content-Transfer-Encoding: 8bit" MSG_LINEBREAK));
            MimeWriteAString(obj, NS_LITERAL_CSTRING("Content-Disposition: inline; filename=\"Deleted: "));
            MimeWriteAString(obj, fileName);
            MimeWriteAString(obj, NS_LITERAL_CSTRING("\"" MSG_LINEBREAK "X-Mozilla-Altered: AttachmentDeleted; date=\""));
          }
          nsCString result;
          char timeBuffer[128];
          PRExplodedTime now;
          PR_ExplodeTime(PR_Now(), PR_LocalTimeParameters, &now);
          PR_FormatTimeUSEnglish(timeBuffer, sizeof(timeBuffer),
                                 "%a %b %d %H:%M:%S %Y",
                                 &now);
          MimeWriteAString(obj, nsDependentCString(timeBuffer));
          MimeWriteAString(obj, NS_LITERAL_CSTRING("\"" MSG_LINEBREAK));
          MimeWriteAString(obj, NS_LITERAL_CSTRING(MSG_LINEBREAK "You deleted an attachment from this message. The original MIME headers for the attachment were:" MSG_LINEBREAK));
          MimeHeaders_write_raw_headers(mult->hdrs, obj->options, false);
        }
        int32_t old_nchildren = container->nchildren;
        status = ((MimeMultipartClass *) obj->clazz)->create_child(obj);
        if (status < 0) return status;
        NS_ASSERTION(mult->state != MimeMultipartHeaders,
                     "mult->state shouldn't be MimeMultipartHeaders");

        if (!stripping && container->nchildren > old_nchildren && obj->options &&
            !mime_typep(obj, (MimeObjectClass*)&mimeMultipartAlternativeClass)) {
          // Notify emitter about content type and part path.
          MimeObject *kid = container->children[container->nchildren-1];
          MimeMultipart_notify_emitter(kid);
        }
      }
      break;
    }

    case MimeMultipartPartFirstLine:
      /* Hand this line off to the sub-part. */
      status = (((MimeMultipartClass *) obj->clazz)->parse_child_line(obj,
                                                  line, length, true));
      if (status < 0) return status;
      mult->state = MimeMultipartPartLine;
      break;

    case MimeMultipartPartLine:
      /* Hand this line off to the sub-part. */
      status = (((MimeMultipartClass *) obj->clazz)->parse_child_line(obj,
                  line, length, false));
      if (status < 0) return status;
      break;

    default:
      NS_ERROR("unexpected state in parse line");
      return -1;
  }

  if (obj->options &&
      obj->options->format_out == nsMimeOutput::nsMimeMessageAttach &&
      (!(obj->options->state && obj->options->state->strippingPart) &&
      mult->state != MimeMultipartPartLine))
      return MimeObject_write(obj, line, length, false);
  return 0;
}

void MimeMultipart_notify_emitter(MimeObject *obj)
{
  char *ct = nullptr;

  NS_ASSERTION(obj->options, "MimeMultipart_notify_emitter called with null options");
  if (! obj->options)
    return;

  ct = MimeHeaders_get(obj->headers, HEADER_CONTENT_TYPE,
                       false, false);
  if (obj->options->notify_nested_bodies) {
    mimeEmitterAddHeaderField(obj->options, HEADER_CONTENT_TYPE,
                              ct ? ct : TEXT_PLAIN);
    char *part_path = mime_part_address(obj);
    if (part_path) {
      mimeEmitterAddHeaderField(obj->options, "x-jsemitter-part-path",
                                part_path);
      PR_Free(part_path);
    }
  }

  // Examine the headers and see if there is a special charset
  // (i.e. non US-ASCII) for this message. If so, we need to
  // tell the emitter that this is the case for use in any
  // possible reply or forward operation.
  if (ct && (obj->options->notify_nested_bodies ||
             MimeObjectIsMessageBody(obj))) {
    char *cset = MimeHeaders_get_parameter(ct, "charset", NULL, NULL);
    if (cset) {
      mimeEmitterUpdateCharacterSet(obj->options, cset);
      if (!obj->options->override_charset)
        // Also set this charset to msgWindow
        SetMailCharacterSetToMsgWindow(obj, cset);
      PR_Free(cset);
    }
  }

  PR_FREEIF(ct);
}

static MimeMultipartBoundaryType
MimeMultipart_check_boundary(MimeObject *obj, const char *line, int32_t length)
{
  MimeMultipart *mult = (MimeMultipart *) obj;
  int32_t blen;
  bool term_p;

  if (!mult->boundary ||
    line[0] != '-' ||
    line[1] != '-')
  return MimeMultipartBoundaryTypeNone;

  /* This is a candidate line to be a boundary.  Check it out... */
  blen = strlen(mult->boundary);
  term_p = false;

  /* strip trailing whitespace (including the newline.) */
  while(length > 2 && IS_SPACE(line[length-1]))
  length--;

  /* Could this be a terminating boundary? */
  if (length == blen + 4 &&
    line[length-1] == '-' &&
    line[length-2] == '-')
  {
    term_p = true;
  }

  //looks like we have a separator but first, we need to check it's not for one of the part's children.
  MimeContainer *cont = (MimeContainer *) obj;
  if (cont->nchildren > 0)
  {
    MimeObject *kid = cont->children[cont->nchildren-1];
    if (kid)
      if (mime_typep(kid, (MimeObjectClass*) &mimeMultipartClass))
      {
        //Don't ask the kid to check the boundary if it has already detected a Teminator
        MimeMultipart *mult = (MimeMultipart *) kid;
        if (mult->state != MimeMultipartEpilogue)
          if (MimeMultipart_check_boundary(kid, line, length) != MimeMultipartBoundaryTypeNone)
            return MimeMultipartBoundaryTypeNone;
      }
  }

  if (term_p)
    length -= 2;

  if (blen == length-2 && !strncmp(line+2, mult->boundary, length-2))
    return (term_p
      ? MimeMultipartBoundaryTypeTerminator
      : MimeMultipartBoundaryTypeSeparator);
  else
    return MimeMultipartBoundaryTypeNone;
}


static int
MimeMultipart_create_child(MimeObject *obj)
{
  MimeMultipart *mult = (MimeMultipart *) obj;
  int           status;
  char *ct = (mult->hdrs
        ? MimeHeaders_get (mult->hdrs, HEADER_CONTENT_TYPE,
                 true, false)
        : 0);
  const char *dct = (((MimeMultipartClass *) obj->clazz)->default_part_type);
  MimeObject *body = NULL;

  mult->state = MimeMultipartPartFirstLine;
  /* Don't pass in NULL as the content-type (this means that the
   auto-uudecode-hack won't ever be done for subparts of a
   multipart, but only for untyped children of message/rfc822.
   */
  body = mime_create(((ct && *ct) ? ct : (dct ? dct: TEXT_PLAIN)),
           mult->hdrs, obj->options);
  PR_FREEIF(ct);
  if (!body) return MIME_OUT_OF_MEMORY;
  status = ((MimeContainerClass *) obj->clazz)->add_child(obj, body);
  if (status < 0)
  {
    mime_free(body);
    return status;
  }

#ifdef MIME_DRAFTS
  if ( obj->options && 
     obj->options->decompose_file_p &&
     obj->options->is_multipart_msg &&
     obj->options->decompose_file_init_fn )
  {
    if ( !mime_typep(obj,(MimeObjectClass*)&mimeMultipartRelatedClass) &&
           !mime_typep(obj,(MimeObjectClass*)&mimeMultipartAlternativeClass) &&
       !mime_typep(obj,(MimeObjectClass*)&mimeMultipartSignedClass) &&
#ifdef MIME_DETAIL_CHECK
       !mime_typep(body, (MimeObjectClass*)&mimeMultipartRelatedClass) &&
       !mime_typep(body, (MimeObjectClass*)&mimeMultipartAlternativeClass) &&
       !mime_typep(body,(MimeObjectClass*)&mimeMultipartSignedClass) 
#else
           /* bug 21869 -- due to the fact that we are not generating the
              correct mime class object for content-typ multipart/signed part
              the above check failed. to solve the problem in general and not
              to cause early temination when parsing message for opening as
              draft we can simply make sure that the child is not a multipart
              mime object. this way we could have a proper decomposing message
              part functions set correctly */
           !mime_typep(body, (MimeObjectClass*) &mimeMultipartClass)
#endif
    &&        ! (mime_typep(body, (MimeObjectClass*)&mimeExternalObjectClass) && !strcmp(body->content_type, "text/x-vcard"))
       )
    {
    status = obj->options->decompose_file_init_fn ( obj->options->stream_closure, mult->hdrs );
    if (status < 0) return status;
    }
  }
#endif /* MIME_DRAFTS */


  /* Now that we've added this new object to our list of children,
   start its parser going (if we want to display it.)
   */
  body->output_p = (((MimeMultipartClass *) obj->clazz)->output_child_p(obj, body));
  if (body->output_p)
  {  
    status = body->clazz->parse_begin(body);

#ifdef XP_MACOSX
    /* if we are saving an apple double attachment, we need to set correctly the conten type of the channel */
    if (mime_typep(obj, (MimeObjectClass *) &mimeMultipartAppleDoubleClass))
    {
      mime_stream_data *msd = (mime_stream_data *)body->options->stream_closure;
      if (!body->options->write_html_p && body->content_type && !PL_strcasecmp(body->content_type, APPLICATION_APPLEFILE))
      {
        if (msd && msd->channel)
          msd->channel->SetContentType(NS_LITERAL_CSTRING(APPLICATION_APPLEFILE));
      }
    }
#endif

    if (status < 0) return status;
  }

  return 0;
}


static bool
MimeMultipart_output_child_p(MimeObject *obj, MimeObject *child)
{
  /* We don't output a child if we're stripping it. */
  if (obj->options && obj->options->state && obj->options->state->strippingPart)
    return false;
  /* if we are saving an apple double attachment, ignore the appledouble wrapper part */
  return (obj->options && obj->options->write_html_p) ||
          PL_strcasecmp(child->content_type, MULTIPART_APPLEDOUBLE);
}



static int
MimeMultipart_close_child(MimeObject *object)
{
  MimeMultipart *mult = (MimeMultipart *) object;
  MimeContainer *cont = (MimeContainer *) object;

  if (!mult->hdrs)
  return 0;

  MimeHeaders_free(mult->hdrs);
  mult->hdrs = 0;

  NS_ASSERTION(cont->nchildren > 0, "badly formed mime message");
  if (cont->nchildren > 0)
  {
    MimeObject *kid = cont->children[cont->nchildren-1];
    // If we have a child and it has not already been closed, process it.
    // The kid would be already be closed if we encounter a multipart section
    // that did not have a fully delineated header block.  No header block means
    // no creation of a new child, but the termination case still happens and
    // we still end up here.  Obviously, we don't want to close the child a
    // second time and the best thing we can do is nothing.
    if (kid && !kid->closed_p)
    {
      int status;
      status = kid->clazz->parse_eof(kid, false);
      if (status < 0) return status;
      status = kid->clazz->parse_end(kid, false);
      if (status < 0) return status;

#ifdef MIME_DRAFTS
      if ( object->options &&
         object->options->decompose_file_p &&
         object->options->is_multipart_msg &&
         object->options->decompose_file_close_fn ) 
      {
        if ( !mime_typep(object,(MimeObjectClass*)&mimeMultipartRelatedClass) &&
           !mime_typep(object,(MimeObjectClass*)&mimeMultipartAlternativeClass) &&
           !mime_typep(object,(MimeObjectClass*)&mimeMultipartSignedClass) &&
#ifdef MIME_DETAIL_CHECK
           !mime_typep(kid,(MimeObjectClass*)&mimeMultipartRelatedClass) &&
           !mime_typep(kid,(MimeObjectClass*)&mimeMultipartAlternativeClass) &&
           !mime_typep(kid,(MimeObjectClass*)&mimeMultipartSignedClass) 
#else
                   /* bug 21869 -- due to the fact that we are not generating the
                      correct mime class object for content-typ multipart/signed part
                      the above check failed. to solve the problem in general and not
                      to cause early temination when parsing message for opening as
                      draft we can simply make sure that the child is not a multipart
                      mime object. this way we could have a proper decomposing message
                      part functions set correctly */
                   !mime_typep(kid,(MimeObjectClass*) &mimeMultipartClass)
#endif
                                  && !(mime_typep(kid, (MimeObjectClass*)&mimeExternalObjectClass) && !strcmp(kid->content_type, "text/x-vcard"))
           )
        {
          status = object->options->decompose_file_close_fn ( object->options->stream_closure );
          if (status < 0) return status;
        }
      }
#endif /* MIME_DRAFTS */

    }
  }
  return 0;
}


static int
MimeMultipart_parse_child_line (MimeObject *obj, const char *line, int32_t length,
                bool first_line_p)
{
  MimeContainer *cont = (MimeContainer *) obj;
  int status;
  MimeObject *kid;

  PR_ASSERT(cont->nchildren > 0);
  if (cont->nchildren <= 0)
  return -1;

  kid = cont->children[cont->nchildren-1];
  PR_ASSERT(kid);
  if (!kid) return -1;

#ifdef MIME_DRAFTS
  if ( obj->options &&
     obj->options->decompose_file_p &&
     obj->options->is_multipart_msg && 
     obj->options->decompose_file_output_fn ) 
  {
  if (!mime_typep(obj,(MimeObjectClass*)&mimeMultipartAlternativeClass) &&
    !mime_typep(obj,(MimeObjectClass*)&mimeMultipartRelatedClass) &&
    !mime_typep(obj,(MimeObjectClass*)&mimeMultipartSignedClass) &&
#ifdef MIME_DETAIL_CHECK
    !mime_typep(kid,(MimeObjectClass*)&mimeMultipartAlternativeClass) &&
    !mime_typep(kid,(MimeObjectClass*)&mimeMultipartRelatedClass) &&
    !mime_typep(kid,(MimeObjectClass*)&mimeMultipartSignedClass)
#else
        /* bug 21869 -- due to the fact that we are not generating the
           correct mime class object for content-typ multipart/signed part
           the above check failed. to solve the problem in general and not
           to cause early temination when parsing message for opening as
           draft we can simply make sure that the child is not a multipart
           mime object. this way we could have a proper decomposing message
           part functions set correctly */
        !mime_typep(kid, (MimeObjectClass*) &mimeMultipartClass)
#endif
    && !(mime_typep(kid, (MimeObjectClass*)&mimeExternalObjectClass) && !strcmp(kid->content_type, "text/x-vcard"))
    )
    return obj->options->decompose_file_output_fn (line, length, obj->options->stream_closure);
  }
#endif /* MIME_DRAFTS */

  /* The newline issues here are tricky, since both the newlines before
   and after the boundary string are to be considered part of the
   boundary: this is so that a part can be specified such that it
   does not end in a trailing newline.

   To implement this, we send a newline *before* each line instead
   of after, except for the first line, which is not preceeded by a
   newline.
   */

  /* Remove the trailing newline... */
  if (length > 0 && line[length-1] == '\n') length--;
  if (length > 0 && line[length-1] == '\r') length--;

  if (!first_line_p)
  {
    /* Push out a preceeding newline... */
    char nl[] = MSG_LINEBREAK;
    status = kid->clazz->parse_buffer (nl, MSG_LINEBREAK_LEN, kid);
    if (status < 0) return status;
  }

  /* Now push out the line sans trailing newline. */
  return kid->clazz->parse_buffer (line, length, kid);
}


static int
MimeMultipart_parse_eof (MimeObject *obj, bool abort_p)
{
  MimeMultipart *mult = (MimeMultipart *) obj;
  MimeContainer *cont = (MimeContainer *) obj;

  if (obj->closed_p) return 0;

  /* Push out the last trailing line if there's one in the buffer.  If
   this happens, this object does not end in a trailing newline (and
   the parse_line method will be called with a string with no trailing
   newline, which isn't the usual case.)
   */
  if (!abort_p && obj->ibuffer_fp > 0)
  {
    /* There is leftover data without a terminating newline. */
    int status = obj->clazz->parse_line(obj->ibuffer, obj->ibuffer_fp,obj);
    obj->ibuffer_fp = 0;
    if (status < 0)
    {
      obj->closed_p = true;
      return status;
    }
  }

  /* Now call parse_eof for our active child, if there is one.
   */
  if (cont->nchildren > 0 &&
    (mult->state == MimeMultipartPartLine ||
     mult->state == MimeMultipartPartFirstLine))
  {
    MimeObject *kid = cont->children[cont->nchildren-1];
    NS_ASSERTION(kid, "not expecting null kid");
    if (kid)
    {
      int status = kid->clazz->parse_eof(kid, abort_p);
      if (status < 0) return status;
    }
  }

  return ((MimeObjectClass*)&MIME_SUPERCLASS)->parse_eof(obj, abort_p);
}


#if defined(DEBUG) && defined(XP_UNIX)
static int
MimeMultipart_debug_print (MimeObject *obj, PRFileDesc *stream, int32_t depth)
{
  /*  MimeMultipart *mult = (MimeMultipart *) obj; */
  MimeContainer *cont = (MimeContainer *) obj;
  char *addr = mime_part_address(obj);
  int i;
  for (i=0; i < depth; i++)
  PR_Write(stream, "  ", 2);
/**
  fprintf(stream, "<%s %s (%d kid%s) boundary=%s 0x%08X>\n",
      obj->clazz->class_name,
      addr ? addr : "???",
      cont->nchildren, (cont->nchildren == 1 ? "" : "s"),
      (mult->boundary ? mult->boundary : "(none)"),
      (uint32_t) mult);
**/
  PR_FREEIF(addr);

/*
  if (cont->nchildren > 0)
  fprintf(stream, "\n");
 */

  for (i = 0; i < cont->nchildren; i++)
  {
    MimeObject *kid = cont->children[i];
    int status = kid->clazz->debug_print (kid, stream, depth+1);
    if (status < 0) return status;
  }

/*
  if (cont->nchildren > 0)
  fprintf(stream, "\n");
 */

  return 0;
}
#endif
