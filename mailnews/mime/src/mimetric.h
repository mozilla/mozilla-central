/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _MIMETRIC_H_
#define _MIMETRIC_H_

#include "mimetext.h"

/* The MimeInlineTextRichtext class implements the (obsolete and deprecated)
   text/richtext MIME content type, as defined in RFC 1341, and also the
   text/enriched MIME content type, as defined in RFC 1563.
 */

typedef struct MimeInlineTextRichtextClass MimeInlineTextRichtextClass;
typedef struct MimeInlineTextRichtext      MimeInlineTextRichtext;

struct MimeInlineTextRichtextClass {
  MimeInlineTextClass text;
  bool enriched_p;  /* Whether we should act like text/enriched instead. */
};

extern MimeInlineTextRichtextClass mimeInlineTextRichtextClass;

struct MimeInlineTextRichtext {
  MimeInlineText text;
};

#endif /* _MIMETRIC_H_ */
