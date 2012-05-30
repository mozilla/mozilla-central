/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#include "nsOutlookRegUtil.h"

#include "OutlookDebugLog.h"

BYTE * nsOutlookRegUtil::GetValueBytes(HKEY hKey, const char *pValueName)
{
  LONG  err;
  DWORD  bufSz;
  LPBYTE  pBytes = NULL;

  err = ::RegQueryValueEx(hKey, pValueName, NULL, NULL, NULL, &bufSz); 
  if (err == ERROR_SUCCESS) {
    pBytes = new BYTE[bufSz];
    err = ::RegQueryValueEx(hKey, pValueName, NULL, NULL, pBytes, &bufSz);
    if (err != ERROR_SUCCESS) {
      delete [] pBytes;
      pBytes = NULL;
    }
  }

  return pBytes;
}

void nsOutlookRegUtil::FreeValueBytes(BYTE *pBytes)
{
  if (pBytes)
    delete [] pBytes;
}

