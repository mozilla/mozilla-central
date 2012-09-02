/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * This Original Code has been modified by IBM Corporation. Modifications made by IBM
 * described herein are Copyright (c) International Business Machines Corporation, 2000.
 * Modifications to Mozilla code or documentation identified per MPL Section 3.3
 *
 * Date             Modified by     Description of modification
 * 04/20/2000       IBM Corp.      OS/2 VisualAge build.
 */

#include "mimeobj.h"
#include "prmem.h"
#include "plstr.h"
#include "prio.h"
#include "mimebuf.h"
#include "prlog.h"
#include "nsMimeTypes.h"
#include "nsMimeStringResources.h"
#include "nsMsgUtils.h"
#include "mimemsg.h"
#include "mimemapl.h"

/* Way to destroy any notions of modularity or class hierarchy, Terry! */
# include "mimetpla.h"
# include "mimethtm.h"
# include "mimecont.h"

MimeDefClass (MimeObject, MimeObjectClass, mimeObjectClass, NULL);

static int MimeObject_initialize (MimeObject *);
static void MimeObject_finalize (MimeObject *);
static int MimeObject_parse_begin (MimeObject *);
static int MimeObject_parse_buffer (const char *, int32_t, MimeObject *);
static int MimeObject_parse_line (const char *, int32_t, MimeObject *);
static int MimeObject_parse_eof (MimeObject *, bool);
static int MimeObject_parse_end (MimeObject *, bool);
static bool MimeObject_displayable_inline_p (MimeObjectClass *clazz,
                        MimeHeaders *hdrs);

#if defined(DEBUG) && defined(XP_UNIX)
static int MimeObject_debug_print (MimeObject *, PRFileDesc *, int32_t depth);
#endif

static int
MimeObjectClassInitialize(MimeObjectClass *clazz)
{
  NS_ASSERTION(!clazz->class_initialized, "class shouldn't already be initialized");
  clazz->initialize   = MimeObject_initialize;
  clazz->finalize     = MimeObject_finalize;
  clazz->parse_begin  = MimeObject_parse_begin;
  clazz->parse_buffer = MimeObject_parse_buffer;
  clazz->parse_line   = MimeObject_parse_line;
  clazz->parse_eof    = MimeObject_parse_eof;
  clazz->parse_end    = MimeObject_parse_end;
  clazz->displayable_inline_p = MimeObject_displayable_inline_p;

#if defined(DEBUG) && defined(XP_UNIX)
  clazz->debug_print  = MimeObject_debug_print;
#endif
  return 0;
}

static int
MimeObject_initialize (MimeObject *obj)
{
  /* This is an abstract class; it shouldn't be directly instantiated. */
  NS_ASSERTION(obj->clazz != &mimeObjectClass, "should directly instantiate abstract class");

  /* Set up the content-type and encoding. */
  if (!obj->content_type && obj->headers)
  obj->content_type = MimeHeaders_get (obj->headers, HEADER_CONTENT_TYPE,
                     true, false);
  if (!obj->encoding && obj->headers)
  obj->encoding = MimeHeaders_get (obj->headers,
                   HEADER_CONTENT_TRANSFER_ENCODING,
                   true, false);

  /* Special case to normalize some types and encodings to a canonical form.
   (These are nonstandard types/encodings which have been seen to appear in
   multiple forms; we normalize them so that things like looking up icons
   and extensions has consistent behavior for the receiver, regardless of
   the "alias" type that the sender used.)
   */
  if (!obj->content_type || !*(obj->content_type))
  ;
  else if (!PL_strcasecmp(obj->content_type, APPLICATION_UUENCODE2) ||
       !PL_strcasecmp(obj->content_type, APPLICATION_UUENCODE3) ||
       !PL_strcasecmp(obj->content_type, APPLICATION_UUENCODE4))
  {
    PR_Free(obj->content_type);
    obj->content_type = strdup(APPLICATION_UUENCODE);
  }
  else if (!PL_strcasecmp(obj->content_type, IMAGE_XBM2) ||
       !PL_strcasecmp(obj->content_type, IMAGE_XBM3))
  {
    PR_Free(obj->content_type);
    obj->content_type = strdup(IMAGE_XBM);
  }
  else {
    // MIME-types are case-insenitive, but let's make it lower case internally
    // to avoid some hassle later down the road.
    nsAutoCString lowerCaseContentType;
    ToLowerCase(nsDependentCString(obj->content_type), lowerCaseContentType);
    PR_Free(obj->content_type);
    obj->content_type = ToNewCString(lowerCaseContentType);
  }

  if (!obj->encoding)
  ;
  else if (!PL_strcasecmp(obj->encoding, ENCODING_UUENCODE2) ||
       !PL_strcasecmp(obj->encoding, ENCODING_UUENCODE3) ||
       !PL_strcasecmp(obj->encoding, ENCODING_UUENCODE4))
  {
    PR_Free(obj->encoding);
    obj->encoding = strdup(ENCODING_UUENCODE);
  }
  else if (!PL_strcasecmp(obj->encoding, ENCODING_COMPRESS2))
  {
    PR_Free(obj->encoding);
    obj->encoding = strdup(ENCODING_COMPRESS);
  }
  else if (!PL_strcasecmp(obj->encoding, ENCODING_GZIP2))
  {
    PR_Free(obj->encoding);
    obj->encoding = strdup(ENCODING_GZIP);
  }

  return 0;
}

static void
MimeObject_finalize (MimeObject *obj)
{
  obj->clazz->parse_eof (obj, false);
  obj->clazz->parse_end (obj, false);

  if (obj->headers)
  {
    MimeHeaders_free(obj->headers);
    obj->headers = 0;
  }

  /* Should have been freed by parse_eof, but just in case... */
  NS_ASSERTION(!obj->ibuffer, "buffer not freed");
  NS_ASSERTION(!obj->obuffer, "buffer not freed");
  PR_FREEIF (obj->ibuffer);
  PR_FREEIF (obj->obuffer);

  PR_FREEIF(obj->content_type);
  PR_FREEIF(obj->encoding);

  if (obj->options && obj->options->state)
  {
    delete obj->options->state;
    obj->options->state = nullptr;
  }
}

static int
MimeObject_parse_begin (MimeObject *obj)
{
  NS_ASSERTION (!obj->closed_p, "object shouldn't be already closed");

  /* If we haven't set up the state object yet, then this should be
   the outermost object... */
  if (obj->options && !obj->options->state)
  {
    NS_ASSERTION(!obj->headers, "headers should be null");  /* should be the outermost object. */

    obj->options->state = new MimeParseStateObject;
    if (!obj->options->state) return MIME_OUT_OF_MEMORY;
    obj->options->state->root = obj;
    obj->options->state->separator_suppressed_p = true; /* no first sep */
    const char *delParts = PL_strcasestr(obj->options->url, "&del=");
    const char *detachLocations = PL_strcasestr(obj->options->url, "&detachTo=");
    if (delParts)
    {
      const char *delEnd = PL_strcasestr(delParts + 1, "&");
      if (!delEnd)
        delEnd = delParts + strlen(delParts);
      ParseString(Substring(delParts + 5, delEnd), ',', obj->options->state->partsToStrip);
    }
    if (detachLocations)
    {
      detachLocations += 10; // advance past "&detachTo="
      ParseString(nsDependentCString(detachLocations), ',', obj->options->state->detachToFiles);
    }
  }

  /* Decide whether this object should be output or not... */
  if (!obj->options || !obj->options->output_fn
    /* if we are decomposing the message in files and processing a multipart object,
       we must not output it without parsing it first */
     || (obj->options->decompose_file_p && obj->options->decompose_file_output_fn &&
      mime_typep(obj, (MimeObjectClass*) &mimeMultipartClass))
    )
    obj->output_p = false;
  else if (!obj->options->part_to_load)
    obj->output_p = true;
  else
  {
    char *id = mime_part_address(obj);
    if (!id) return MIME_OUT_OF_MEMORY;

    // We need to check if a part is the subpart of the part to load.
    // If so and this is a raw or body display output operation, then
    // we should mark the part for subsequent output.

    // First, check for an exact match
    obj->output_p = !strcmp(id, obj->options->part_to_load);
    if (!obj->output_p && (obj->options->format_out == nsMimeOutput::nsMimeMessageRaw ||
                           obj->options->format_out == nsMimeOutput::nsMimeMessageBodyDisplay ||
                           obj->options->format_out == nsMimeOutput::nsMimeMessageAttach))
    {
      // Then, check for subpart
      unsigned int partlen = strlen(obj->options->part_to_load);
      obj->output_p = (strlen(id) >= partlen + 2) && (id[partlen] == '.') &&
        !strncmp(id, obj->options->part_to_load, partlen);
    }

    PR_Free(id);
  }

  // If we've decided not to output this part, we also shouldn't be showing it
  // as an attachment.
  obj->dontShowAsAttachment = !obj->output_p;

  return 0;
}

static int
MimeObject_parse_buffer (const char *buffer, int32_t size, MimeObject *obj)
{
  NS_ASSERTION(!obj->closed_p, "object shouldn't be closed");
  if (obj->closed_p) return -1;

  return mime_LineBuffer (buffer, size,
             &obj->ibuffer, &obj->ibuffer_size, &obj->ibuffer_fp,
             true,
             ((int (*) (char *, int32_t, void *))
              /* This cast is to turn void into MimeObject */
              obj->clazz->parse_line),
             obj);
}

static int
MimeObject_parse_line (const char *line, int32_t length, MimeObject *obj)
{
  NS_ERROR("shouldn't call this method");
  return -1;
}

static int
MimeObject_parse_eof (MimeObject *obj, bool abort_p)
{
  if (obj->closed_p) return 0;
  NS_ASSERTION(!obj->parsed_p, "obj already parsed");

  /* If there is still data in the ibuffer, that means that the last line of
   this part didn't end in a newline; so push it out anyway (this means that
   the parse_line method will be called with a string with no trailing
   newline, which isn't the usual case.)
   */
  if (!abort_p &&
    obj->ibuffer_fp > 0)
  {
    int status = obj->clazz->parse_line (obj->ibuffer, obj->ibuffer_fp, obj);
    obj->ibuffer_fp = 0;
    if (status < 0)
    {
      obj->closed_p = true;
      return status;
    }
  }

  obj->closed_p = true;
  return 0;
}

static int
MimeObject_parse_end (MimeObject *obj, bool abort_p)
{
  if (obj->parsed_p)
  {
    NS_ASSERTION(obj->closed_p, "object should be closed");
    return 0;
  }

  /* We won't be needing these buffers any more; nuke 'em. */
  PR_FREEIF(obj->ibuffer);
  obj->ibuffer_fp = 0;
  obj->ibuffer_size = 0;
  PR_FREEIF(obj->obuffer);
  obj->obuffer_fp = 0;
  obj->obuffer_size = 0;

  obj->parsed_p = true;
  return 0;
}

static bool
MimeObject_displayable_inline_p (MimeObjectClass *clazz, MimeHeaders *hdrs)
{
  NS_ERROR("shouldn't call this method");
  return false;
}

#if defined(DEBUG) && defined(XP_UNIX)
static int
MimeObject_debug_print (MimeObject *obj, PRFileDesc *stream, int32_t depth)
{
  int i;
  char *addr = mime_part_address(obj);
  for (i=0; i < depth; i++)
  PR_Write(stream, "  ", 2);
/*
  fprintf(stream, "<%s %s 0x%08X>\n", obj->clazz->class_name,
      addr ? addr : "???",
      (uint32_t) obj);
*/
  PR_FREEIF(addr);
  return 0;
}
#endif
