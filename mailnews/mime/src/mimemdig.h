/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _MIMEMDIG_H_
#define _MIMEMDIG_H_

#include "mimemult.h"

/* The MimeMultipartDigest class implements the multipart/digest MIME 
   container, which is just like multipart/mixed, except that the default
   type (for parts with no type explicitly specified) is message/rfc822
   instead of text/plain.
 */

typedef struct MimeMultipartDigestClass MimeMultipartDigestClass;
typedef struct MimeMultipartDigest      MimeMultipartDigest;

struct MimeMultipartDigestClass {
  MimeMultipartClass multipart;
};

extern MimeMultipartDigestClass mimeMultipartDigestClass;

struct MimeMultipartDigest {
  MimeMultipart multipart;
};

#endif /* _MIMEMDIG_H_ */
