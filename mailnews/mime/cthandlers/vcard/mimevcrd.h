/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _MIMEVCRD_H_
#define _MIMEVCRD_H_

#include "mimetext.h"
#include "nsCOMPtr.h"

/* The MimeInlineTextHTML class implements the text/x-vcard and (maybe?
   someday?) the application/directory MIME content types.
 */

typedef struct MimeInlineTextVCardClass MimeInlineTextVCardClass;
typedef struct MimeInlineTextVCard      MimeInlineTextVCard;

struct MimeInlineTextVCardClass {
  MimeInlineTextClass         text;
  char                        *vCardString;
};

extern MimeInlineTextVCardClass mimeInlineTextVCardClass;

struct MimeInlineTextVCard {
  MimeInlineText text;
};

#endif /* _MIMEVCRD_H_ */
