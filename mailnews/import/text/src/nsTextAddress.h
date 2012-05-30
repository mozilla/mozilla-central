/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsTextAddress_h__
#define nsTextAddress_h__

#include "nsCOMPtr.h"
#include "nsStringGlue.h"
#include "nsIImportFieldMap.h"
#include "nsIImportService.h"

class nsIAddrDatabase;
class nsIFile;
class nsIInputStream;
class nsILineInputStream;

/////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////

class nsTextAddress {
public:
  nsTextAddress();
  virtual ~nsTextAddress();

  nsresult ImportAddresses(bool *pAbort, const PRUnichar *pName, nsIFile *pSrc, nsIAddrDatabase *pDb, nsIImportFieldMap *fieldMap, nsString& errors, PRUint32 *pProgress);

  nsresult DetermineDelim(nsIFile *pSrc);
  char GetDelim(void) { return m_delim;}

  static nsresult ReadRecordNumber(nsIFile *pSrc, nsCString &aLine, PRInt32 rNum);
  static bool GetField(const char *pLine, PRInt32 maxLen, PRInt32 index, nsCString& field, char delim);

private:
  nsresult ProcessLine(const char *pLine, PRInt32 len, nsString& errors);

  static PRInt32 CountFields(const char *pLine, PRInt32 maxLen, char delim);
  static nsresult ReadRecord(nsILineInputStream *pSrc, nsCString &aLine, bool *aMore);

  char m_delim;
  PRInt32 m_LFCount;
  PRInt32 m_CRCount;
  nsIAddrDatabase *m_database;
  nsIImportFieldMap *m_fieldMap;
  nsCOMPtr<nsIImportService> m_pService;
};



#endif /* nsTextAddress_h__ */

