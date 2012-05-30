/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _MIMEEBOD_H_
#define _MIMEEBOD_H_

#include "mimeobj.h"

/* The MimeExternalBody class implements the message/external-body MIME type.
   (This is not to be confused with MimeExternalObject, which implements the
   handler for application/octet-stream and other types with no more specific
   handlers.)
 */

typedef struct MimeExternalBodyClass MimeExternalBodyClass;
typedef struct MimeExternalBody      MimeExternalBody;

struct MimeExternalBodyClass {
  MimeObjectClass object;
};

extern MimeExternalBodyClass mimeExternalBodyClass;

struct MimeExternalBody {
  MimeObject object;      /* superclass variables */
  MimeHeaders *hdrs;      /* headers within this external-body, which
                   describe the network data which this body
                   is a pointer to. */
  char *body;          /* The "phantom body" of this link. */
};

#endif /* _MIMEEBOD_H_ */
