/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _MIMEEOBJ_H_
#define _MIMEEOBJ_H_

#include "mimeleaf.h"

/* The MimeExternalObject class represents MIME parts which contain data
   which cannot be displayed inline -- application/octet-stream and any
   other type that is not otherwise specially handled.  (This is not to
   be confused with MimeExternalBody, which is the handler for the 
   message/external-object MIME type only.)
 */

typedef struct MimeExternalObjectClass MimeExternalObjectClass;
typedef struct MimeExternalObject      MimeExternalObject;

struct MimeExternalObjectClass {
  MimeLeafClass leaf;
};

extern "C" MimeExternalObjectClass mimeExternalObjectClass;

struct MimeExternalObject {
  MimeLeaf leaf;
};

#endif /* _MIMEEOBJ_H_ */
