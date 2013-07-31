/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* 
 * XP-COM Bridges for C function calls
 */
#ifndef _MIMECOM_H_
#define _MIMECOM_H_

#include <stdint.h>

/*
 * These functions are exposed by libmime to be used by content type
 * handler plugins for processing stream data. 
 */
/*
 * This is the write call for outputting processed stream data.
 */ 
extern "C" int  XPCOM_MimeObject_write(void *mimeObject, const char *data, 
                                  int32_t length, 
                                  bool user_visible_p);
/*
 * The following group of calls expose the pointers for the object
 * system within libmime. 
 */                                                        
extern "C" void *XPCOM_GetmimeInlineTextClass(void);
extern "C" void *XPCOM_GetmimeLeafClass(void);
extern "C" void *XPCOM_GetmimeObjectClass(void);
extern "C" void *XPCOM_GetmimeContainerClass(void);
extern "C" void *XPCOM_GetmimeMultipartClass(void);
extern "C" void *XPCOM_GetmimeMultipartSignedClass(void);
extern "C" void *XPCOM_GetmimeEncryptedClass(void);

extern "C" void *XPCOM_Mime_create(char *content_type, void* hdrs, void* opts);

#endif /* _MIMECOM_H_ */
