/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#include "nsOERegUtil.h"

#include "OEDebugLog.h"

BYTE * nsOERegUtil::GetValueBytes(HKEY hKey, const char *pValueName)
{
  LONG  err;
  DWORD  bufSz;
  LPBYTE  pBytes = NULL;
  DWORD  type = 0;

  err = ::RegQueryValueEx(hKey, pValueName, NULL, &type, NULL, &bufSz);
  if (err == ERROR_SUCCESS) {
    pBytes = new BYTE[bufSz];
    err = ::RegQueryValueEx(hKey, pValueName, NULL, NULL, pBytes, &bufSz);
    if (err != ERROR_SUCCESS) {
      delete [] pBytes;
      pBytes = NULL;
    }
    else {
      if (type == REG_EXPAND_SZ) {
        DWORD sz = bufSz;
        LPBYTE pExpand = NULL;
        DWORD  rSz;

        do {
          if (pExpand)
            delete [] pExpand;
          sz += 1024;
          pExpand = new BYTE[sz];
          rSz = ::ExpandEnvironmentStrings((LPCSTR) pBytes, (LPSTR) pExpand, sz);
        } while (rSz > sz);

        delete [] pBytes;

        return pExpand;
      }
    }
  }

  return pBytes;
}

void nsOERegUtil::FreeValueBytes(BYTE *pBytes)
{
  if (pBytes)
    delete [] pBytes;
}

