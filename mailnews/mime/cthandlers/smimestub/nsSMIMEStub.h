/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _NSSMIMESTUB_H_
#define _NSSMIMESTUB_H_

#include "mimetext.h"

#define SMIME_CONTENT_TYPE "application/pkcs7-mime"

/*
 * These functions are the public interface for this content type
 * handler and will be called in by the mime component.
 */

/**
 * The MimeInlineTextSMIMEStub class implements the SMIME 2
 * MIME content types.
 */
typedef struct MimeInlineTextSMIMEStubClass MimeInlineTextSMIMEStubClass;
typedef struct MimeInlineTextSMIMEStub      MimeInlineTextSMIMEStub;

struct MimeInlineTextSMIMEStubClass {
    MimeInlineTextClass text;
    char* buffer;
    int32_t bufferlen;
    int32_t buffermax;
};

extern MimeInlineTextSMIMEStubClass mimeInlineTextSMIMEStubClass;

struct MimeInlineTextSMIMEStub {
  MimeInlineText text;
};

#endif /* _NSSMIMESTUB_H_ */
