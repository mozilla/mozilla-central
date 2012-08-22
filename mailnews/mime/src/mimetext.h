/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _MIMETEXT_H_
#define _MIMETEXT_H_

#include "mimeleaf.h"

/* The MimeInlineText class is the superclass of all handlers for the
   MIME text/ content types (which convert various text formats to HTML,
   in one form or another.)

   It provides two services:

     =  if ROT13 decoding is desired, the text will be rotated before
      the `parse_line' method it called;

   =  text will be converted from the message's charset to the "target"
        charset before the `parse_line' method is called.

   The contract with charset-conversion is that the converted data will
   be such that one may interpret any octets (8-bit bytes) in the data
   which are in the range of the ASCII characters (0-127) as ASCII
   characters.  It is explicitly legal, for example, to scan through
   the string for "<" and replace it with "&lt;", and to search for things
   that look like URLs and to wrap them with interesting HTML tags.

   The charset to which we convert will probably be UTF-8 (an encoding of
   the Unicode character set, with the feature that all octets with the
   high bit off have the same interpretations as ASCII.)

   #### NOTE: if it turns out that we use JIS (ISO-2022-JP) as the target
        encoding, then this is not quite true; it is safe to search for the
    low ASCII values (under hex 0x40, octal 0100, which is '@') but it
    is NOT safe to search for values higher than that -- they may be
    being used as the subsequent bytes in a multi-byte escape sequence.
    It's a nice coincidence that HTML's critical characters ("<", ">",
    and "&") have values under 0x40...
 */

typedef struct MimeInlineTextClass MimeInlineTextClass;
typedef struct MimeInlineText      MimeInlineText;

struct MimeInlineTextClass {
  MimeLeafClass   leaf;
  int (*rot13_line) (MimeObject *obj, char *line, int32_t length);
  int (*convert_line_charset) (MimeObject *obj, char *line, int32_t length);
  int (*initialize_charset) (MimeObject *obj);
};

extern MimeInlineTextClass mimeInlineTextClass;

#define DAM_MAX_BUFFER_SIZE 8*1024
#define DAM_MAX_LINES  1024

struct MimeInlineText {
  MimeLeaf leaf;      /* superclass variables */
  char *charset;      /* The charset from the content-type of this
                         object, or the caller-specified overrides
                         or defaults. */
  bool charsetOverridable;
  bool needUpdateMsgWinCharset;
  char *cbuffer;      /* Buffer used for charset conversion. */
  int32_t cbuffer_size;

  nsCOMPtr<nsIUnicodeDecoder> inputDecoder;
  nsCOMPtr<nsIUnicodeEncoder> utf8Encoder;

  bool    inputAutodetect;
  bool    initializeCharset;
  int32_t lastLineInDam;
  int32_t curDamOffset;
  char *lineDamBuffer;
  char **lineDamPtrs;
};

#endif /* _MIMETEXT_H_ */
