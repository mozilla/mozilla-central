/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _MIMELEAF_H_
#define _MIMELEAF_H_

#include "mimeobj.h"
#include "modmimee.h"

/* MimeLeaf is the class for the objects representing all MIME types which
   are not containers for other MIME objects.  The implication of this is
   that they are MIME types which can have Content-Transfer-Encodings
   applied to their data.  This class provides that service in its
   parse_buffer() method:

     int (*parse_decoded_buffer) (const char *buf, int32_t size, MimeObject *obj)

   The `parse_buffer' method of MimeLeaf passes each block of data through
   the appropriate decoder (if any) and then calls `parse_decoded_buffer'
   on each block (not line) of output.

   The default `parse_decoded_buffer' method of MimeLeaf line-buffers the
   now-decoded data, handing each line to the `parse_line' method in turn.
   If different behavior is desired (for example, if a class wants access
   to the decoded data before it is line-buffered) the `parse_decoded_buffer'
   method should be overridden.  (MimeExternalObject does this.)
 */

typedef struct MimeLeafClass MimeLeafClass;
typedef struct MimeLeaf      MimeLeaf;

struct MimeLeafClass {
  MimeObjectClass object;
  /* This is the callback that is handed to the decoder. */
  int (*parse_decoded_buffer) (const char *buf, int32_t size, MimeObject *obj);
  int (*close_decoder) (MimeObject *obj);
};

extern MimeLeafClass mimeLeafClass;

struct MimeLeaf {
  MimeObject object;    /* superclass variables */

  /* If we're doing Base64, Quoted-Printable, or UU decoding, this is the
   state object for the decoder. */
  MimeDecoderData *decoder_data;

  /* We want to count the size of the MimeObject to offer consumers the
   * opportunity to display the sizes of attachments.
   */
  int sizeSoFar;
};

#endif /* _MIMELEAF_H_ */
