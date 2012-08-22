/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _MIMEMREL_H_
#define _MIMEMREL_H_

#include "mimemult.h"
#include "plhash.h"
#include "prio.h"
#include "nsNetUtil.h"
#include "nsIMimeConverter.h" // for MimeConverterOutputCallback

/* The MimeMultipartRelated class implements the multipart/related MIME
   container, which allows `sibling' sub-parts to refer to each other.
 */

typedef struct MimeMultipartRelatedClass MimeMultipartRelatedClass;
typedef struct MimeMultipartRelated      MimeMultipartRelated;

struct MimeMultipartRelatedClass {
  MimeMultipartClass multipart;
};

extern "C" MimeMultipartRelatedClass mimeMultipartRelatedClass;

struct MimeMultipartRelated {
  MimeMultipart multipart;  /* superclass variables */

  char* base_url;        /* Base URL (if any) for the whole
                   multipart/related. */

  char* head_buffer;      /* Buffer used to remember the text/html 'head'
                   part. */
  int32_t head_buffer_fp;    /* Active length. */
  int32_t head_buffer_size;    /* How big it is. */

  nsCOMPtr <nsIFile>          file_buffer;    /* The nsIFile of a temp file used when we
                                               run out of room in the head_buffer. */
  nsCOMPtr <nsIInputStream>   input_file_stream;    /* A stream to it. */
  nsCOMPtr <nsIOutputStream>  output_file_stream;  /* A stream to it. */

  MimeHeaders* buffered_hdrs;  /* The headers of the 'head' part. */

  bool head_loaded;    /* Whether we've already passed the 'head'
                   part. */
  MimeObject* headobj;    /* The actual text/html head object. */

  PLHashTable    *hash;

  MimeConverterOutputCallback real_output_fn;
  void* real_output_closure;

  char* curtag;
  int32_t curtag_max;
  int32_t curtag_length;



};

#endif /* _MIMEMREL_H_ */
