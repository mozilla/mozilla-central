/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _MIMEMALT_H_
#define _MIMEMALT_H_

#include "mimemult.h"
#include "mimepbuf.h"

/* The MimeMultipartAlternative class implements the multipart/alternative
   MIME container, which displays only one (the `best') of a set of enclosed
   documents.
 */

typedef struct MimeMultipartAlternativeClass MimeMultipartAlternativeClass;
typedef struct MimeMultipartAlternative      MimeMultipartAlternative;

struct MimeMultipartAlternativeClass {
  MimeMultipartClass multipart;
};

extern "C" MimeMultipartAlternativeClass mimeMultipartAlternativeClass;

struct MimeMultipartAlternative {
  MimeMultipart multipart;      /* superclass variables */

  MimeHeaders **buffered_hdrs;    /* The headers of pending parts */
  MimePartBufferData **part_buffers;  /* The data of pending parts
                                         (see mimepbuf.h) */
  int32_t pending_parts;
  int32_t max_parts;
};

#endif /* _MIMEMALT_H_ */
