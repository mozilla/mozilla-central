/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* The MimeInlineTextPlain class implements the text/plain MIME content type,
   and is also used for all otherwise-unknown text/ subtypes.
 */

#ifndef _MIMETPLA_H_
#define _MIMETPLA_H_

#include "mimetext.h"

typedef struct MimeInlineTextPlainClass MimeInlineTextPlainClass;
typedef struct MimeInlineTextPlain      MimeInlineTextPlain;

struct MimeInlineTextPlainClass {
  MimeInlineTextClass text;
};

extern MimeInlineTextPlainClass mimeInlineTextPlainClass;

struct MimeInlineTextPlain {
  MimeInlineText text;
  uint32_t mCiteLevel;
  bool            mBlockquoting;
  //bool            mInsideQuote;
  int32_t         mQuotedSizeSetting;   // mail.quoted_size
  int32_t         mQuotedStyleSetting;  // mail.quoted_style
  char            *mCitationColor;      // mail.citation_color
  bool            mIsSig;
};

#endif /* _MIMETPLA_H_ */
