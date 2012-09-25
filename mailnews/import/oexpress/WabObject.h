/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef WabObject_h___
#define WabObject_h___

#include "nscore.h"
#include "nsStringGlue.h"
#include "nsIFile.h"

#include <windows.h>
#include <wab.h>


class CWabIterator {
public:
  virtual nsresult  EnumUser(const PRUnichar *pName, LPENTRYID pEid, ULONG cbEid) = 0;
  virtual nsresult  EnumList(const PRUnichar *pName, LPENTRYID pEid, ULONG cbEid, LPMAPITABLE lpTable) = 0;
};


class CWAB
{
public:
    CWAB(nsIFile *fileName);
    ~CWAB();

  bool      Loaded(void) { return m_bInitialized;}

  HRESULT    IterateWABContents(CWabIterator *pIter, int *pDone);

  // Methods for User entries
  LPDISTLIST    GetDistList(ULONG cbEid, LPENTRYID pEid);
  void      ReleaseDistList(LPDISTLIST pList) { if (pList) pList->Release();}
  LPMAILUSER    GetUser(ULONG cbEid, LPENTRYID pEid);
  void      ReleaseUser(LPMAILUSER pUser) { if (pUser) pUser->Release();}
  LPSPropValue  GetUserProperty(LPMAILUSER pUser, ULONG tag);
  LPSPropValue  GetListProperty(LPDISTLIST pList, ULONG tag);
  void      FreeProperty(LPSPropValue pVal) { if (pVal) m_lpWABObject->FreeBuffer(pVal);}
  void      GetValueString(LPSPropValue pVal, nsString& val);
  void      GetValueTime(LPSPropValue pVal, PRTime& val);

  void      CStrToUnicode(const char *pStr, nsString& result);

  // Utility stuff used by iterate
  void      FreeProws(LPSRowSet prows);

  bool      IsAvailable();

private:
  PRUnichar *  m_pUniBuff;
  int      m_uniBuffLen;
  bool        m_bInitialized;
    HINSTANCE   m_hinstWAB;
    LPWABOPEN   m_lpfnWABOpen;
    LPADRBOOK   m_lpAdrBook;
    LPWABOBJECT m_lpWABObject;
};

#endif // WABOBJECT_INCLUDED


