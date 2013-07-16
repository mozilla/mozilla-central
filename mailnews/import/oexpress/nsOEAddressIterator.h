/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsOEAddressIterator_h___
#define nsOEAddressIterator_h___

#include "mozilla/Attributes.h"
#include "WabObject.h"
#include "nsIAddrDatabase.h"
#include "mdb.h"
#include "nsStringGlue.h"
#include "nsInterfaceHashtable.h"

class nsOEAddressIterator : public CWabIterator {
public:
  nsOEAddressIterator(CWAB *pWab, nsIAddrDatabase *database);
  ~nsOEAddressIterator();
  
  virtual nsresult  EnumUser(const PRUnichar * pName, LPENTRYID pEid, ULONG cbEid) MOZ_OVERRIDE;
  virtual nsresult  EnumList(const PRUnichar * pName, LPENTRYID pEid, ULONG cbEid, LPMAPITABLE table) MOZ_OVERRIDE;
        void FindListRow(nsString &eMail, nsIMdbRow **cardRow);

private:
  bool      BuildCard(const PRUnichar * pName, nsIMdbRow *card, LPMAILUSER pUser);
  void    SanitizeValue(nsString& val);
  void    SplitString(nsString& val1, nsString& val2);
  void    SetBirthDay(nsIMdbRow *card, PRTime& birthDay);

  CWAB *                m_pWab;
  nsCOMPtr<nsIAddrDatabase>     m_database;
  nsInterfaceHashtable <nsStringHashKey, nsIMdbRow> m_listRows;
};

#endif 
