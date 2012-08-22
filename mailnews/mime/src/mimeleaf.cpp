/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "modmimee.h"
#include "mimeleaf.h"
#include "nsMimeTypes.h"
#include "prmem.h"
#include "plstr.h"
#include "prlog.h"
#include "nsMimeStringResources.h"

#define MIME_SUPERCLASS mimeObjectClass
MimeDefClass(MimeLeaf, MimeLeafClass, mimeLeafClass, &MIME_SUPERCLASS);

static int MimeLeaf_initialize (MimeObject *);
static void MimeLeaf_finalize (MimeObject *);
static int MimeLeaf_parse_begin (MimeObject *);
static int MimeLeaf_parse_buffer (const char *, int32_t, MimeObject *);
static int MimeLeaf_parse_line (const char *, int32_t, MimeObject *);
static int MimeLeaf_close_decoder (MimeObject *);
static int MimeLeaf_parse_eof (MimeObject *, bool);
static bool MimeLeaf_displayable_inline_p (MimeObjectClass *clazz,
                        MimeHeaders *hdrs);

static int
MimeLeafClassInitialize(MimeLeafClass *clazz)
{
  MimeObjectClass *oclass = (MimeObjectClass *) clazz;
  NS_ASSERTION(!oclass->class_initialized, "1.1 <rhp@netscape.com> 19 Mar 1999 12:00");
  oclass->initialize   = MimeLeaf_initialize;
  oclass->finalize     = MimeLeaf_finalize;
  oclass->parse_begin  = MimeLeaf_parse_begin;
  oclass->parse_buffer = MimeLeaf_parse_buffer;
  oclass->parse_line   = MimeLeaf_parse_line;
  oclass->parse_eof    = MimeLeaf_parse_eof;
  oclass->displayable_inline_p = MimeLeaf_displayable_inline_p;
  clazz->close_decoder = MimeLeaf_close_decoder;

  /* Default `parse_buffer' method is one which line-buffers the now-decoded
   data and passes it on to `parse_line'.  (We snarf the implementation of
   this method from our superclass's implementation of `parse_buffer', which
   inherited it from MimeObject.)
   */
  clazz->parse_decoded_buffer =
  ((MimeObjectClass*)&MIME_SUPERCLASS)->parse_buffer;

  return 0;
}


static int
MimeLeaf_initialize (MimeObject *obj)
{
  /* This is an abstract class; it shouldn't be directly instantiated. */
  NS_ASSERTION(obj->clazz != (MimeObjectClass *) &mimeLeafClass, "1.1 <rhp@netscape.com> 19 Mar 1999 12:00");

  // Initial size is -1 (meaning "unknown size") - we'll correct it in
  // parse_buffer.
  MimeLeaf *leaf = (MimeLeaf *) obj;
  leaf->sizeSoFar = -1;

  return ((MimeObjectClass*)&MIME_SUPERCLASS)->initialize(obj);
}


static void
MimeLeaf_finalize (MimeObject *object)
{
  MimeLeaf *leaf = (MimeLeaf *)object;
  object->clazz->parse_eof (object, false);

  /* Free the decoder data, if it's still around.  It was probably freed
   in MimeLeaf_parse_eof(), but just in case... */
  if (leaf->decoder_data)
  {
    MimeDecoderDestroy(leaf->decoder_data, true);
    leaf->decoder_data = 0;
  }

  ((MimeObjectClass*)&MIME_SUPERCLASS)->finalize (object);
}


static int
MimeLeaf_parse_begin (MimeObject *obj)
{
  MimeLeaf *leaf = (MimeLeaf *) obj;
  MimeDecoderData *(*fn) (MimeConverterOutputCallback, void*) = 0;

  /* Initialize a decoder if necessary.
   */
  if (!obj->encoding)
  ;
  else if (!PL_strcasecmp(obj->encoding, ENCODING_BASE64))
  fn = &MimeB64DecoderInit;
  else if (!PL_strcasecmp(obj->encoding, ENCODING_QUOTED_PRINTABLE))
  leaf->decoder_data = 
          MimeQPDecoderInit(((MimeConverterOutputCallback)
                        ((MimeLeafClass *)obj->clazz)->parse_decoded_buffer),
                        obj, obj);
  else if (!PL_strcasecmp(obj->encoding, ENCODING_UUENCODE) ||
       !PL_strcasecmp(obj->encoding, ENCODING_UUENCODE2) ||
       !PL_strcasecmp(obj->encoding, ENCODING_UUENCODE3) ||
       !PL_strcasecmp(obj->encoding, ENCODING_UUENCODE4))
  fn = &MimeUUDecoderInit;
  else if (!PL_strcasecmp(obj->encoding, ENCODING_YENCODE))
    fn = &MimeYDecoderInit;

  if (fn)
  {
    leaf->decoder_data =
    fn (/* The MimeConverterOutputCallback cast is to turn the `void' argument
           into `MimeObject'. */
      ((MimeConverterOutputCallback)
       ((MimeLeafClass *)obj->clazz)->parse_decoded_buffer),
      obj);

    if (!leaf->decoder_data)
    return MIME_OUT_OF_MEMORY;
  }

  return ((MimeObjectClass*)&MIME_SUPERCLASS)->parse_begin(obj);
}


static int
MimeLeaf_parse_buffer (const char *buffer, int32_t size, MimeObject *obj)
{
  MimeLeaf *leaf = (MimeLeaf *) obj;

  NS_ASSERTION(!obj->closed_p, "1.1 <rhp@netscape.com> 19 Mar 1999 12:00");
  if (obj->closed_p) return -1;

  /* If we're not supposed to write this object, bug out now.
   */
  if (!obj->output_p ||
    !obj->options ||
    !obj->options->output_fn)
  return 0;

  int rv;
  if (leaf->sizeSoFar == -1)
    leaf->sizeSoFar = 0;

  if (leaf->decoder_data &&
      obj->options && 
      obj->options->format_out != nsMimeOutput::nsMimeMessageDecrypt
      && obj->options->format_out != nsMimeOutput::nsMimeMessageAttach) {
    int outSize = 0;
    rv = MimeDecoderWrite (leaf->decoder_data, buffer, size, &outSize);
    leaf->sizeSoFar += outSize;
  }
  else {
    rv = ((MimeLeafClass *)obj->clazz)->parse_decoded_buffer (buffer, size,
                                obj);
    leaf->sizeSoFar += size;
  }
  return rv;
}

static int
MimeLeaf_parse_line (const char *line, int32_t length, MimeObject *obj)
{
  NS_ERROR("MimeLeaf_parse_line shouldn't ever be called.");
  return -1;
}


static int
MimeLeaf_close_decoder (MimeObject *obj)
{
  MimeLeaf *leaf = (MimeLeaf *) obj;

  if (leaf->decoder_data)
  {
      int status = MimeDecoderDestroy(leaf->decoder_data, false);
      leaf->decoder_data = 0;
      return status;
  }

  return 0;
}


static int
MimeLeaf_parse_eof (MimeObject *obj, bool abort_p)
{
  MimeLeaf *leaf = (MimeLeaf *) obj;
  if (obj->closed_p) return 0;

  /* Close off the decoder, to cause it to give up any buffered data that
   it is still holding.
   */
  if (leaf->decoder_data)
  {
      int status = MimeLeaf_close_decoder(obj);
      if (status < 0) return status;
  }

  /* Now run the superclass's parse_eof, which will force out the line
   buffer (which we may have just repopulated, above.)
   */
  return ((MimeObjectClass*)&MIME_SUPERCLASS)->parse_eof (obj, abort_p);
}


static bool
MimeLeaf_displayable_inline_p (MimeObjectClass *clazz, MimeHeaders *hdrs)
{
  return true;
}
