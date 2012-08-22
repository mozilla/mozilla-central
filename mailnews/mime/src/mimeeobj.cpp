/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsCOMPtr.h"
#include "mimeeobj.h"
#include "prmem.h"
#include "plstr.h"
#include "prlog.h"
#include "nsMimeStringResources.h"
#include "mimemoz2.h"
#include "mimemapl.h"
#include "nsMimeTypes.h"


#define MIME_SUPERCLASS mimeLeafClass
MimeDefClass(MimeExternalObject, MimeExternalObjectClass,
       mimeExternalObjectClass, &MIME_SUPERCLASS);

static int MimeExternalObject_initialize (MimeObject *);
static void MimeExternalObject_finalize (MimeObject *);
static int MimeExternalObject_parse_begin (MimeObject *);
static int MimeExternalObject_parse_buffer (const char *, int32_t, MimeObject *);
static int MimeExternalObject_parse_line (const char *, int32_t, MimeObject *);
static int MimeExternalObject_parse_decoded_buffer (const char*, int32_t, MimeObject*);
static bool MimeExternalObject_displayable_inline_p (MimeObjectClass *clazz,
                            MimeHeaders *hdrs);

static int
MimeExternalObjectClassInitialize(MimeExternalObjectClass *clazz)
{
  MimeObjectClass *oclass = (MimeObjectClass *) clazz;
  MimeLeafClass   *lclass = (MimeLeafClass *) clazz;

  NS_ASSERTION(!oclass->class_initialized, "1.1 <rhp@netscape.com> 19 Mar 1999 12:00");
  oclass->initialize   = MimeExternalObject_initialize;
  oclass->finalize     = MimeExternalObject_finalize;
  oclass->parse_begin  = MimeExternalObject_parse_begin;
  oclass->parse_buffer = MimeExternalObject_parse_buffer;
  oclass->parse_line   = MimeExternalObject_parse_line;
  oclass->displayable_inline_p = MimeExternalObject_displayable_inline_p;
  lclass->parse_decoded_buffer = MimeExternalObject_parse_decoded_buffer;
  return 0;
}


static int
MimeExternalObject_initialize (MimeObject *object)
{
  return ((MimeObjectClass*)&MIME_SUPERCLASS)->initialize(object);
}

static void
MimeExternalObject_finalize (MimeObject *object)
{
  ((MimeObjectClass*)&MIME_SUPERCLASS)->finalize(object);
}


static int
MimeExternalObject_parse_begin (MimeObject *obj)
{
  int status;

  status = ((MimeObjectClass*)&MIME_SUPERCLASS)->parse_begin(obj);
  if (status < 0) return status;

  // If we're writing this object, and we're doing it in raw form, then
  // now is the time to inform the backend what the type of this data is.
  //
  if (obj->output_p &&
    obj->options &&
    !obj->options->write_html_p &&
    !obj->options->state->first_data_written_p)
  {
    status = MimeObject_output_init(obj, 0);
    if (status < 0) return status;
    NS_ASSERTION(obj->options->state->first_data_written_p, "1.1 <rhp@netscape.com> 19 Mar 1999 12:00");
  }

  //
  // If we're writing this object as HTML, do all the work now -- just write
  // out a table with a link in it.  (Later calls to the `parse_buffer' method
  // will simply discard the data of the object itself.)
  //
  if (obj->options &&
      obj->output_p &&
      obj->options->write_html_p &&
      obj->options->output_fn)
  {
    MimeDisplayOptions newopt = *obj->options;  // copy it
    char *id = 0;
    char *id_url = 0;
    char *id_name = 0;
    nsCString id_imap;
    bool all_headers_p = obj->options->headers == MimeHeadersAll;

    id = mime_part_address (obj);
    if (obj->options->missing_parts)
      id_imap.Adopt(mime_imap_part_address (obj));
    if (! id) return MIME_OUT_OF_MEMORY;

    if (obj->options && obj->options->url)
    {
      const char *url = obj->options->url;
      if (!id_imap.IsEmpty() && id)
      {
        // if this is an IMAP part.
        id_url = mime_set_url_imap_part(url, id_imap.get(), id);
      }
      else
      {
        // This is just a normal MIME part as usual.
        id_url = mime_set_url_part(url, id, true);
      }
      if (!id_url)
      {
        PR_Free(id);
        return MIME_OUT_OF_MEMORY;
      }
    }
    if (!strcmp (id, "0"))
    {
      PR_Free(id);
      id = MimeGetStringByID(MIME_MSG_ATTACHMENT);
    }
    else
    {
      const char *p = "Part ";
      uint32_t slen = strlen(p) + strlen(id) + 1;
      char *s = (char *)PR_MALLOC(slen);
      if (!s)
      {
        PR_Free(id);
        PR_Free(id_url);
        return MIME_OUT_OF_MEMORY;
      }
      // we have a valid id
      if (id)
        id_name = mime_find_suggested_name_of_part(id, obj);
      PL_strncpyz(s, p, slen);
      PL_strcatn(s, slen, id);
      PR_Free(id);
      id = s;
    }

    if (all_headers_p &&
    // Don't bother showing all headers on this part if it's the only
    // part in the message: in that case, we've already shown these
    // headers.
    obj->options->state &&
    obj->options->state->root == obj->parent)
    all_headers_p = false;

    newopt.fancy_headers_p = true;
    newopt.headers = (all_headers_p ? MimeHeadersAll : MimeHeadersSome);

/******
RICHIE SHERRY
GOTTA STILL DO THIS FOR QUOTING!
     status = MimeHeaders_write_attachment_box (obj->headers, &newopt,
                                                 obj->content_type,
                                                 obj->encoding,
                                                 id_name? id_name : id, id_url, 0)
*****/

    // obj->options really owns the storage for this.
    newopt.part_to_load = nullptr;
    newopt.default_charset = nullptr;
    PR_FREEIF(id);
    PR_FREEIF(id_url);
    PR_FREEIF(id_name);
    if (status < 0) return status;
  }

  return 0;
}

static int
MimeExternalObject_parse_buffer (const char *buffer, int32_t size, MimeObject *obj)
{
  NS_ASSERTION(!obj->closed_p, "1.1 <rhp@netscape.com> 19 Mar 1999 12:00");
  if (obj->closed_p) return -1;

  // Currently, we always want to stream, in order to determine the size of the
  // MIME object.

  /* The data will be base64-decoded and passed to
     MimeExternalObject_parse_decoded_buffer. */
  return ((MimeObjectClass*)&MIME_SUPERCLASS)->parse_buffer(buffer, size, obj);
}


static int
MimeExternalObject_parse_decoded_buffer (const char *buf, int32_t size,
                     MimeObject *obj)
{
  /* This is called (by MimeLeafClass->parse_buffer) with blocks of data
   that have already been base64-decoded.  This will only be called in
   the case where we're not emitting HTML, and want access to the raw
   data itself.

   We override the `parse_decoded_buffer' method provided by MimeLeaf
   because, unlike most children of MimeLeaf, we do not want to line-
   buffer the decoded data -- we want to simply pass it along to the
   backend, without going through our `parse_line' method.
   */

  /* Don't do a roundtrip through XPConnect when we're only interested in
   * metadata and size. This includes when we are writing HTML (otherwise, the
   * contents of binary attachments will just get dumped into messages when
   * reading them) and the JS emitter (which doesn't care about attachment data
   * at all). 0 means ok, the caller just checks for negative return value.
   */
  if (obj->options && (obj->options->metadata_only ||
                       obj->options->write_html_p))
    return 0;
  else
    return MimeObject_write(obj, buf, size, true);
}


static int
MimeExternalObject_parse_line (const char *line, int32_t length, MimeObject *obj)
{
  NS_ERROR("This method should never be called (externals do no line buffering).");
  return -1;
}

static bool
MimeExternalObject_displayable_inline_p (MimeObjectClass *clazz,
                     MimeHeaders *hdrs)
{
  return false;
}
