/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _MIMETENR_H_
#define _MIMETENR_H_

#include "mimetric.h"

/* The MimeInlineTextEnriched class implements the text/enriched MIME content
   type, as defined in RFC 1563.  It does this largely by virtue of being a
   subclass of the MimeInlineTextRichtext class.
 */

typedef struct MimeInlineTextEnrichedClass MimeInlineTextEnrichedClass;
typedef struct MimeInlineTextEnriched      MimeInlineTextEnriched;

struct MimeInlineTextEnrichedClass {
  MimeInlineTextRichtextClass text;
};

extern MimeInlineTextEnrichedClass mimeInlineTextEnrichedClass;

struct MimeInlineTextEnriched {
  MimeInlineTextRichtext richtext;
};

#endif /* _MIMETENR_H_ */
