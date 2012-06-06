/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsMailDatabase_H_
#define _nsMailDatabase_H_

#include "nsMsgDatabase.h"
#include "nsMsgMessageFlags.h"
#include "nsIFile.h"
#include "nsTArray.h"

// This is the subclass of nsMsgDatabase that handles local mail messages.
class nsIOFileStream;
class nsIFile;
class nsOfflineImapOperation;

class nsMailDatabase : public nsMsgDatabase
{
public:
  nsMailDatabase();
  virtual ~nsMailDatabase();
  NS_IMETHOD  ForceClosed();
  NS_IMETHOD DeleteMessages(PRUint32 aNumKeys, nsMsgKey* nsMsgKeys, nsIDBChangeListener *instigator);

  NS_IMETHOD StartBatch();
  NS_IMETHOD EndBatch();

  nsresult  Open(nsIFile *aSummaryFile, bool create, bool upgrading);
  virtual nsMailDatabase  *GetMailDB() {return this;}

  virtual PRUint32  GetCurVersion() {return kMsgDBVersion;}
  
  NS_IMETHOD  GetOfflineOpForKey(nsMsgKey opKey, bool create, nsIMsgOfflineImapOperation **op);
  NS_IMETHOD  RemoveOfflineOp(nsIMsgOfflineImapOperation *op);

  NS_IMETHOD  SetSummaryValid(bool valid);
  NS_IMETHOD  GetSummaryValid(bool *valid);
	
  NS_IMETHOD    EnumerateOfflineOps(nsISimpleEnumerator **enumerator);
  NS_IMETHOD    ListAllOfflineOpIds(nsTArray<nsMsgKey> *offlineOpIds);
  NS_IMETHOD    ListAllOfflineDeletes(nsTArray<nsMsgKey> *offlineDeletes);

  friend class nsMsgOfflineOpEnumerator;
protected:

  nsresult        GetAllOfflineOpsTable(); // get this on demand

  // get the time and date of the mailbox file
  void            GetMailboxModProperties(PRInt64 *aSize, PRUint32 *aDate); 

  nsCOMPtr <nsIMdbTable>  m_mdbAllOfflineOpsTable;
  mdb_token       m_offlineOpsRowScopeToken;
  mdb_token       m_offlineOpsTableKindToken;

  virtual void    SetReparse(bool reparse);
  
protected:
  
  bool            m_reparse;
};

#endif
