/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _MIMEMMIX_H_
#define _MIMEMMIX_H_

#include "mimemult.h"

/* The MimeMultipartMixed class implements the multipart/mixed MIME container,
   and is also used for any and all otherwise-unrecognised subparts of
   multipart/.
 */

typedef struct MimeMultipartMixedClass MimeMultipartMixedClass;
typedef struct MimeMultipartMixed      MimeMultipartMixed;

struct MimeMultipartMixedClass {
  MimeMultipartClass multipart;
};

extern MimeMultipartMixedClass mimeMultipartMixedClass;

struct MimeMultipartMixed {
  MimeMultipart multipart;
};

#endif /* _MIMEMMIX_H_ */
