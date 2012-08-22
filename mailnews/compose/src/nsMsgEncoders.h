/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsMsgEncoders_H_
#define _nsMsgEncoders_H_

extern "C" MimeEncoderData *
MIME_B64EncoderInit(nsresult (*output_fn) (const char *buf, int32_t size, void *closure), void *closure); 

extern "C" MimeEncoderData *	
MIME_QPEncoderInit(nsresult (*output_fn) (const char *buf, int32_t size, void *closure), void *closure);

extern "C" MimeEncoderData *	
MIME_UUEncoderInit(char *filename, nsresult (*output_fn) (const char *buf, int32_t size, void *closure), void *closure);

extern "C" nsresult
MIME_EncoderDestroy(MimeEncoderData *data, bool abort_p);

extern "C" nsresult
MIME_EncoderWrite(MimeEncoderData *data, const char *buffer, int32_t size);

#endif /* _nsMsgEncoders_H_ */
