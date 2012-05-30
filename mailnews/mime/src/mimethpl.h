/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* The MimeInlineTextHTMLAsPlaintext class converts HTML->TXT->HTML, i.e.
   HTML to Plaintext and the result to HTML again.
   This might sound crazy, maybe it is, but it is for the "View as Plaintext"
   option, if the sender didn't supply a plaintext alternative (bah!).
 */

#ifndef _MIMETHPL_H_
#define _MIMETHPL_H_

#include "mimetpla.h"
#include "nsStringGlue.h"

typedef struct MimeInlineTextHTMLAsPlaintextClass MimeInlineTextHTMLAsPlaintextClass;
typedef struct MimeInlineTextHTMLAsPlaintext      MimeInlineTextHTMLAsPlaintext;

struct MimeInlineTextHTMLAsPlaintextClass {
  MimeInlineTextPlainClass plaintext;
};

extern MimeInlineTextHTMLAsPlaintextClass mimeInlineTextHTMLAsPlaintextClass;

struct MimeInlineTextHTMLAsPlaintext {
  MimeInlineTextPlain  plaintext;
  nsString             *complete_buffer;  // Gecko parser expects wide strings
};

#endif /* _MIMETHPL_H_ */
