/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#include "nsCOMPtr.h"
#include "mimeiimg.h"
#include "mimemoz2.h"
#include "prmem.h"
#include "plstr.h"
#include "prlog.h"
#include "nsMimeTypes.h"
#include "nsMimeStringResources.h"
#include "nsINetUtil.h"
#include "nsMsgUtils.h"

#define MIME_SUPERCLASS mimeLeafClass
MimeDefClass(MimeInlineImage, MimeInlineImageClass,
       mimeInlineImageClass, &MIME_SUPERCLASS);

static int MimeInlineImage_initialize (MimeObject *);
static void MimeInlineImage_finalize (MimeObject *);
static int MimeInlineImage_parse_begin (MimeObject *);
static int MimeInlineImage_parse_line (const char *, int32_t, MimeObject *);
static int MimeInlineImage_parse_eof (MimeObject *, bool);
static int MimeInlineImage_parse_decoded_buffer (const char *, int32_t, MimeObject *);

static int
MimeInlineImageClassInitialize(MimeInlineImageClass *clazz)
{
  MimeObjectClass *oclass = (MimeObjectClass *) clazz;
  MimeLeafClass   *lclass = (MimeLeafClass *) clazz;

  NS_ASSERTION(!oclass->class_initialized, "1.1 <rhp@netscape.com> 19 Mar 1999 12:00");
  oclass->initialize   = MimeInlineImage_initialize;
  oclass->finalize     = MimeInlineImage_finalize;
  oclass->parse_begin  = MimeInlineImage_parse_begin;
  oclass->parse_line   = MimeInlineImage_parse_line;
  oclass->parse_eof    = MimeInlineImage_parse_eof;
  lclass->parse_decoded_buffer = MimeInlineImage_parse_decoded_buffer;

  return 0;
}


static int
MimeInlineImage_initialize (MimeObject *object)
{
  return ((MimeObjectClass*)&MIME_SUPERCLASS)->initialize(object);
}

static void
MimeInlineImage_finalize (MimeObject *object)
{
  ((MimeObjectClass*)&MIME_SUPERCLASS)->finalize(object);
}

static int
MimeInlineImage_parse_begin (MimeObject *obj)
{
  MimeInlineImage *img = (MimeInlineImage *) obj;
  MimeInlineImageClass *clazz;

  int status;

  status = ((MimeObjectClass*)&MIME_SUPERCLASS)->parse_begin(obj);
  if (status < 0) return status;

  if (!obj->output_p) return 0;

  if (!obj->options || !obj->options->output_fn ||
      // don't bother processing if the consumer doesn't want us
      //  gunking the body up.
      obj->options->write_pure_bodies)
    return 0;

  clazz = (MimeInlineImageClass *) obj->clazz;

  if (obj->options &&
    obj->options->image_begin &&
    obj->options->write_html_p &&
    obj->options->image_write_buffer)
  {
    char *html, *part, *image_url;
    const char *ct;

    part = mime_part_address(obj);
    if (!part) return MIME_OUT_OF_MEMORY;

      char *no_part_url = nullptr;
      if (obj->options->part_to_load && obj->options->format_out == nsMimeOutput::nsMimeMessageBodyDisplay)
        no_part_url = mime_get_base_url(obj->options->url);

        if (no_part_url)
        {
          image_url = mime_set_url_part(no_part_url, part, true);
          PR_Free(no_part_url);
        }
        else
          image_url = mime_set_url_part(obj->options->url, part, true);

    if (!image_url)
    {
      PR_Free(part);
      return MIME_OUT_OF_MEMORY;
    }
    PR_Free(part);

    ct = obj->content_type;
    if (!ct) ct = IMAGE_GIF;  /* Can't happen?  Close enough. */

    // Fill in content type and attachment name here.
    nsAutoCString url_with_filename(image_url);
    url_with_filename += "&type=";
    url_with_filename += ct;
    char * filename = MimeHeaders_get_name ( obj->headers, obj->options );
    if (filename)
    {
      nsCString escapedName;
      MsgEscapeString(nsDependentCString(filename), nsINetUtil::ESCAPE_URL_PATH,
                      escapedName);
      url_with_filename += "&filename=";
      url_with_filename += escapedName;
      PR_Free(filename);
    }

    // We need to separate images with HR's...
    MimeObject_write_separator(obj);

    img->image_data =
      obj->options->image_begin(url_with_filename.get(), ct, obj->options->stream_closure);
    PR_Free(image_url);

    if (!img->image_data) return MIME_OUT_OF_MEMORY;

    html = obj->options->make_image_html(img->image_data);
    if (!html) return MIME_OUT_OF_MEMORY;

    status = MimeObject_write(obj, html, strlen(html), true);
    PR_Free(html);
    if (status < 0) return status;
  }

  //
  // Now we are going to see if we should set the content type in the
  // URI for the url being run...
  //
  if (obj->options && obj->options->stream_closure && obj->content_type)
  {
    mime_stream_data  *msd = (mime_stream_data *) (obj->options->stream_closure);
    if ( (msd) && (msd->channel) )
    {
      msd->channel->SetContentType(nsDependentCString(obj->content_type));
    }
  }

  return 0;
}


static int
MimeInlineImage_parse_eof (MimeObject *obj, bool abort_p)
{
  MimeInlineImage *img = (MimeInlineImage *) obj;
  int status;
  if (obj->closed_p) return 0;

  /* Force out any buffered data from the superclass (the base64 decoder.) */
  status = ((MimeObjectClass*)&MIME_SUPERCLASS)->parse_eof(obj, abort_p);
  if (status < 0) abort_p = true;

  if (img->image_data)
  {
    obj->options->image_end(img->image_data,
                (status < 0 ? status : (abort_p ? -1 : 0)));
    img->image_data = 0;
  }

  return status;
}


static int
MimeInlineImage_parse_decoded_buffer (const char *buf, int32_t size, MimeObject *obj)
{
  /* This is called (by MimeLeafClass->parse_buffer) with blocks of data
   that have already been base64-decoded.  Pass this raw image data
   along to the backend-specific image display code.
   */
  MimeInlineImage *img  = (MimeInlineImage *) obj;
  int status;

  /* Don't do a roundtrip through XPConnect when we're only interested in
   * metadata and size. 0 means ok, the caller just checks for negative return
   * value
   */
  if (obj->options && obj->options->metadata_only)
    return 0;

  if (obj->output_p &&
    obj->options &&
    !obj->options->write_html_p)
  {
    /* in this case, we just want the raw data...
     Make the stream, if it's not made, and dump the data out.
     */

    if (!obj->options->state->first_data_written_p)
    {
      status = MimeObject_output_init(obj, 0);
      if (status < 0) return status;
      NS_ASSERTION(obj->options->state->first_data_written_p, "1.1 <rhp@netscape.com> 19 Mar 1999 12:00");
    }

    return MimeObject_write(obj, buf, size, true);
  }


  if (!obj->options ||
    !obj->options->image_write_buffer)
  return 0;

  /* If we don't have any image data, the image_end method must have already
   been called, so don't call image_write_buffer again. */
  if (!img->image_data) return 0;

  /* Hand this data off to the backend-specific image display stream.
   */
  status = obj->options->image_write_buffer (buf, size, img->image_data);

  /* If the image display stream fails, then close the stream - but do not
   return the failure status, and do not give up on parsing this object.
   Just because the image data was corrupt doesn't mean we need to give up
   on the whole document; we can continue by just skipping over the rest of
   this part, and letting our parent continue.
   */
  if (status < 0)
  {
    obj->options->image_end (img->image_data, status);
    img->image_data = 0;
    status = 0;
  }

  return status;
}


static int
MimeInlineImage_parse_line (const char *line, int32_t length, MimeObject *obj)
{
  NS_ERROR("This method should never be called (inline images do no line buffering).");
  return -1;
}
