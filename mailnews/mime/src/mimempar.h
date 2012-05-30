/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _MIMEMPAR_H_
#define _MIMEMPAR_H_

#include "mimemult.h"

/* The MimeMultipartParallel class implements the multipart/parallel MIME 
   container, which is currently no different from multipart/mixed, since
   it's not clear that there's anything useful it could do differently.
 */

typedef struct MimeMultipartParallelClass MimeMultipartParallelClass;
typedef struct MimeMultipartParallel      MimeMultipartParallel;

struct MimeMultipartParallelClass {
  MimeMultipartClass multipart;
};

extern MimeMultipartParallelClass mimeMultipartParallelClass;

struct MimeMultipartParallel {
  MimeMultipart multipart;
};

#endif /* _MIMEMPAR_H_ */
