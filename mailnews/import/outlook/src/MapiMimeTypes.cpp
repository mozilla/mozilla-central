/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nscore.h"
#include "nsStringGlue.h"
#include "MapiMimeTypes.h"

uint8_t CMimeTypes::m_mimeBuffer[kMaxMimeTypeSize];


BOOL CMimeTypes::GetKey(HKEY root, LPCTSTR pName, PHKEY pKey)
{
  LONG result = RegOpenKeyEx(root, pName, 0, KEY_QUERY_VALUE | KEY_ENUMERATE_SUB_KEYS, pKey);
  return result == ERROR_SUCCESS;
}

BOOL CMimeTypes::GetValueBytes(HKEY rootKey, LPCTSTR pValName, LPBYTE *ppBytes)
{
  LONG  err;
  DWORD  bufSz;

  *ppBytes = NULL;
  // Get the installed directory
  err = RegQueryValueEx(rootKey, pValName, NULL, NULL, NULL, &bufSz);
  if (err == ERROR_SUCCESS) {
    *ppBytes = new BYTE[bufSz];
    err = RegQueryValueEx(rootKey, pValName, NULL, NULL, *ppBytes, &bufSz);
    if (err == ERROR_SUCCESS) {
      return TRUE;
    }
    delete *ppBytes;
    *ppBytes = NULL;
  }
  return FALSE;
}

void CMimeTypes::ReleaseValueBytes(LPBYTE pBytes)
{
  if (pBytes)
    delete pBytes;
}

BOOL CMimeTypes::GetMimeTypeFromReg(const nsCString& ext, LPBYTE *ppBytes)
{
  HKEY  extensionKey;
  BOOL  result = FALSE;
  *ppBytes = NULL;
  if (GetKey(HKEY_CLASSES_ROOT, ext.get(), &extensionKey)) {
    result = GetValueBytes(extensionKey, "Content Type", ppBytes);
    RegCloseKey(extensionKey);
  }

  return result;
}

uint8_t * CMimeTypes::GetMimeType(const nsString& theExt)
{
  nsCString ext;
  LossyCopyUTF16toASCII(theExt, ext);
  return GetMimeType(ext);
}

uint8_t * CMimeTypes::GetMimeType(const nsCString& theExt)
{
  nsCString  ext = theExt;
  if (ext.Length()) {
    if (ext.First() != '.') {
      ext = ".";
      ext += theExt;
    }
  }


  BOOL  result = FALSE;
  int    len;

  if (!ext.Length())
    return NULL;
  LPBYTE  pByte;
  if (GetMimeTypeFromReg(ext, &pByte)) {
    len = strlen((const char *) pByte);
    if (len && (len < kMaxMimeTypeSize)) {
      memcpy(m_mimeBuffer, pByte, len);
      m_mimeBuffer[len] = 0;
      result = TRUE;
    }
    ReleaseValueBytes(pByte);
  }

  if (result)
    return m_mimeBuffer;

  return NULL;
}
