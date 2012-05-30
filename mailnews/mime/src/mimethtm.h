/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _MIMETHTM_H_
#define _MIMETHTM_H_

#include "mimetext.h"

/* The MimeInlineTextHTML class implements the text/html MIME content type.
 */

typedef struct MimeInlineTextHTMLClass MimeInlineTextHTMLClass;
typedef struct MimeInlineTextHTML      MimeInlineTextHTML;

struct MimeInlineTextHTMLClass {
  MimeInlineTextClass text;
};

extern MimeInlineTextHTMLClass mimeInlineTextHTMLClass;

struct MimeInlineTextHTML {
  MimeInlineText  text;
  char            *charset;  /* If we sniffed a charset, do some converting! */
};

#endif /* _MIMETHTM_H_ */
