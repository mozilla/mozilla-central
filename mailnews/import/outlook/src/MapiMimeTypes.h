/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef MapiMimeTypes_h___
#define MapiMimeTypes_h___

#include <windows.h>

#define kMaxMimeTypeSize  256

class CMimeTypes {
public:

static uint8_t *  GetMimeType(const nsCString& theExt);
static uint8_t *  GetMimeType(const nsString& theExt);

protected:
  // Registry stuff
static BOOL  GetKey(HKEY root, LPCTSTR pName, PHKEY pKey);
static BOOL  GetValueBytes(HKEY rootKey, LPCTSTR pValName, LPBYTE *ppBytes);
static void  ReleaseValueBytes(LPBYTE pBytes);
static BOOL  GetMimeTypeFromReg(const nsCString& ext, LPBYTE *ppBytes);


static uint8_t          m_mimeBuffer[kMaxMimeTypeSize];
};

#endif /* MapiMimeTypes_h__ */

