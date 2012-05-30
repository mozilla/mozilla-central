/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* The MimeInlineTextHTMLSanitized class cleans up HTML

   This class pushes the HTML that we get from the
   sender of the message through a sanitizer (nsTreeSanitizer),
   which lets only allowed tags through. With the appropriate configuration,
   this protects from most of the security and visual-formatting problems
   that otherwise usually come with HTML (and which partly gave HTML in email
   the bad reputation that it has).

   However, due to the parsing and serializing (and later parsing again)
   required, there is an inherent, significant performance hit, when doing the
   santinizing here at the MIME / HTML source level. But users of this class
   will most likely find it worth the cost.
 */

#ifndef _MIMETHSA_H_
#define _MIMETHSA_H_

#include "mimethtm.h"
#include "nsStringGlue.h"

typedef struct MimeInlineTextHTMLSanitizedClass MimeInlineTextHTMLSanitizedClass;
typedef struct MimeInlineTextHTMLSanitized      MimeInlineTextHTMLSanitized;

struct MimeInlineTextHTMLSanitizedClass {
  MimeInlineTextHTMLClass html;
};

extern MimeInlineTextHTMLSanitizedClass mimeInlineTextHTMLSanitizedClass;

struct MimeInlineTextHTMLSanitized {
  MimeInlineTextHTML    html;
  nsString             *complete_buffer;  // Gecko parser expects wide strings
};

#endif /* _MIMETHPL_H_ */
