/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
 /* -*- Mode: C; tab-width: 4 -*-
   mimeenc.c --- MIME encoders and decoders, version 2 (see mimei.h)
   Copyright © 1996 Netscape Communications Corporation, all rights reserved.
   Created: Jamie Zawinski <jwz@netscape.com>, 15-May-96.
 */

#ifndef _MIMEENC_H_
#define _MIMEENC_H_

#include "prtypes.h"
#include "nsError.h"

/* This file defines interfaces to generic implementations of Base64,
   Quoted-Printable, and UU decoders; and of Base64 and Quoted-Printable
   encoders.
 */


/* Opaque objects used by the encoder/decoder to store state. */
typedef struct MimeDecoderData MimeDecoderData;
typedef struct MimeEncoderData MimeEncoderData;

struct MimeObject;


/* functions for creating that opaque data.
 */
MimeDecoderData *MimeB64DecoderInit(nsresult (*output_fn) (const char *buf,PRInt32 size, void *closure),
                  void *closure);

MimeDecoderData *MimeQPDecoderInit (nsresult (*output_fn) (const char *buf, PRInt32 size, void *closure),
                  void *closure, MimeObject *object = nullptr);

MimeDecoderData *MimeUUDecoderInit (nsresult (*output_fn) (const char *buf,
                            PRInt32 size,
                            void *closure),
                  void *closure);
MimeDecoderData *MimeYDecoderInit (nsresult (*output_fn) (const char *buf,
                            PRInt32 size,
                            void *closure),
                  void *closure);

MimeEncoderData *MimeB64EncoderInit(nsresult (*output_fn) (const char *buf,
                            PRInt32 size,
                            void *closure),
                  void *closure);
MimeEncoderData *MimeQPEncoderInit (nsresult (*output_fn) (const char *buf,
                            PRInt32 size,
                            void *closure),
                  void *closure);
MimeEncoderData *MimeUUEncoderInit (const char *filename,
                  nsresult (*output_fn) (const char *buf,
                            PRInt32 size,
                            void *closure),
                  void *closure);

/* Push data through the encoder/decoder, causing the above-provided write_fn
   to be called with encoded/decoded data. */
int MimeDecoderWrite (MimeDecoderData *data, const char *buffer, PRInt32 size,
                  PRInt32 *outSize);
int MimeEncoderWrite (MimeEncoderData *data, const char *buffer, PRInt32 size);

/* When you're done encoding/decoding, call this to free the data.  If
   abort_p is false, then calling this may cause the write_fn to be called
   one last time (as the last buffered data is flushed out.)
 */
int MimeDecoderDestroy(MimeDecoderData *data, bool abort_p);
int MimeEncoderDestroy(MimeEncoderData *data, bool abort_p);

#endif /* _MODMIMEE_H_ */
