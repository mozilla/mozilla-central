/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsOutlookMail_h___
#define nsOutlookMail_h___

#include "nsISupportsArray.h"
#include "nsStringGlue.h"
#include "nsVoidArray.h"
#include "nsOutlookCompose.h"
#include "nsIFile.h"
#include "MapiApi.h"
#include "MapiMessage.h"
#include "nsIAddrDatabase.h"

class nsIAddrDatabase;
class nsIImportFieldMap;

class nsOutlookMail {
public:
  nsOutlookMail();
  ~nsOutlookMail();
  
  nsresult GetMailFolders(nsISupportsArray **pArray);
  nsresult GetAddressBooks(nsISupportsArray **pArray);
  nsresult ImportMailbox(uint32_t *pDoneSoFar, bool *pAbort, int32_t index,
                         const PRUnichar *pName, nsIMsgFolder *pDest,
                         int32_t *pMsgCount);
  static nsresult ImportMessage(LPMESSAGE lpMsg, nsIOutputStream *destOutputStream, nsMsgDeliverMode mode);
  nsresult ImportAddresses(uint32_t *pCount, uint32_t *pTotal, const PRUnichar *pName, uint32_t id, nsIAddrDatabase *pDb, nsString& errors);
private:
  void  OpenMessageStore(CMapiFolder *pNextFolder);
  static BOOL  WriteData(nsIOutputStream *pDest, const char *pData, int32_t len);
  
  bool      IsAddressBookNameUnique(nsString& name, nsString& list);
  void      MakeAddressBookNameUnique(nsString& name, nsString& list);
  void      SanitizeValue(nsString& val);
  void      SplitString(nsString& val1, nsString& val2);
  bool      BuildCard(const PRUnichar *pName, nsIAddrDatabase *pDb, nsIMdbRow *newRow, LPMAPIPROP pUser, nsIImportFieldMap *pFieldMap);
  nsresult  CreateList(const PRUnichar * pName, nsIAddrDatabase *pDb, LPMAPIPROP pUserList, nsIImportFieldMap *pFieldMap);
  
private:
  bool              m_gotFolders;
  bool              m_gotAddresses;
  bool              m_haveMapi;
  CMapiApi          m_mapi;
  CMapiFolderList   m_folderList;
  CMapiFolderList   m_addressList;
  CMapiFolderList   m_storeList;
  LPMDB             m_lpMdb;
};

#endif /* nsOutlookMail_h___ */
