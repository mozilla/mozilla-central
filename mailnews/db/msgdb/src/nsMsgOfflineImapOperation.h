/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#ifndef _nsMsgOfflineImapOperation_H_

#include "nsIMsgOfflineImapOperation.h"
#include "mdb.h"
#include "nsMsgDatabase.h"
#include "prlog.h"

class nsMsgOfflineImapOperation : public nsIMsgOfflineImapOperation
{
public:
  /** Instance Methods **/
  nsMsgOfflineImapOperation(nsMsgDatabase *db, nsIMdbRow *row);
  virtual   ~nsMsgOfflineImapOperation();
  NS_DECL_ISUPPORTS
  NS_DECL_NSIMSGOFFLINEIMAPOPERATION


  nsIMdbRow   *GetMDBRow() {return m_mdbRow;}
  nsresult    GetCopiesFromDB();
  nsresult    SetCopiesToDB();
  void        Log(PRLogModuleInfo *logFile);
protected:
  nsresult AddKeyword(const char *aKeyword, nsCString &addList, const char *addProp,
                      nsCString &removeList, const char *removeProp);

  nsOfflineImapOperationType m_operation;
  nsMsgKey          m_messageKey;
  nsMsgKey          m_sourceMessageKey;
  uint32_t          m_operationFlags; // what to do on sync
  imapMessageFlagsType m_newFlags; // used for kFlagsChanged

  // these are URI's, and are escaped. Thus, we can use a delimter like ' '
  // because the real spaces should be escaped.
  nsCString  m_sourceFolder;
  nsCString  m_moveDestination;
  nsTArray<nsCString>  m_copyDestinations;

  nsCString      m_keywordsToAdd;
  nsCString      m_keywordsToRemove;

  // nsMsgOfflineImapOperation will have to know what db and row they belong to, since they are really
  // just a wrapper around the offline operation row in the mdb.
  // though I hope not.
  nsMsgDatabase    *m_mdb;
  nsCOMPtr <nsIMdbRow> m_mdbRow;
};



#endif /* _nsMsgOfflineImapOperation_H_ */

