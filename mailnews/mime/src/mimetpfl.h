/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _MIMETPFL_H_
#define _MIMETPFL_H_

#include "mimetext.h"

/* The MimeInlineTextPlainFlowed class implements the
   text/plain MIME content type for the special case of a supplied
   format=flowed. See
   ftp://ftp.ietf.org/internet-drafts/draft-gellens-format-06.txt for
   more information. 
 */

typedef struct MimeInlineTextPlainFlowedClass MimeInlineTextPlainFlowedClass;
typedef struct MimeInlineTextPlainFlowed      MimeInlineTextPlainFlowed;

struct MimeInlineTextPlainFlowedClass {
  MimeInlineTextClass text;
};

extern MimeInlineTextPlainFlowedClass mimeInlineTextPlainFlowedClass;

struct MimeInlineTextPlainFlowed {
  MimeInlineText  text;
  bool            delSp;                // DelSp=yes (RFC 3676)
  int32_t         mQuotedSizeSetting;   // mail.quoted_size
  int32_t         mQuotedStyleSetting;  // mail.quoted_style
  char            *mCitationColor;      // mail.citation_color
};


/*
 * Made to contain information to be kept during the whole message parsing.
 */
struct MimeInlineTextPlainFlowedExData {
  struct MimeObject *ownerobj; /* The owner of this struct */
  bool inflow; /* If we currently are in flow */
  bool fixedwidthfont; /* If we output text for fixed width font */
  uint32_t quotelevel; /* How deep is your love, uhr, quotelevel I meen. */
  bool isSig;  // we're currently in a signature
  struct MimeInlineTextPlainFlowedExData *next;
};

#endif /* _MIMETPFL_H_ */
