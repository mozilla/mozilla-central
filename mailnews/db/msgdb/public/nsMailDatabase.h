/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsMailDatabase_H_
#define _nsMailDatabase_H_

#include "mozilla/Attributes.h"
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
  NS_IMETHOD  ForceClosed() MOZ_OVERRIDE;
  NS_IMETHOD DeleteMessages(uint32_t aNumKeys, nsMsgKey* nsMsgKeys,
                            nsIDBChangeListener *instigator) MOZ_OVERRIDE;

  NS_IMETHOD StartBatch() MOZ_OVERRIDE;
  NS_IMETHOD EndBatch() MOZ_OVERRIDE;

  nsresult  Open(nsIFile *aSummaryFile, bool create, bool upgrading) MOZ_OVERRIDE;
  virtual nsMailDatabase  *GetMailDB() {return this;}

  virtual uint32_t  GetCurVersion() MOZ_OVERRIDE {return kMsgDBVersion;}
  
  NS_IMETHOD  GetOfflineOpForKey(nsMsgKey opKey, bool create,
                                 nsIMsgOfflineImapOperation **op) MOZ_OVERRIDE;
  NS_IMETHOD  RemoveOfflineOp(nsIMsgOfflineImapOperation *op) MOZ_OVERRIDE;

  NS_IMETHOD  SetSummaryValid(bool valid) MOZ_OVERRIDE;
  NS_IMETHOD  GetSummaryValid(bool *valid) MOZ_OVERRIDE;
	
  NS_IMETHOD    EnumerateOfflineOps(nsISimpleEnumerator **enumerator) MOZ_OVERRIDE;
  NS_IMETHOD    ListAllOfflineOpIds(nsTArray<nsMsgKey> *offlineOpIds) MOZ_OVERRIDE;
  NS_IMETHOD    ListAllOfflineDeletes(nsTArray<nsMsgKey> *offlineDeletes) MOZ_OVERRIDE;

  friend class nsMsgOfflineOpEnumerator;
protected:

  nsresult        GetAllOfflineOpsTable(); // get this on demand

  // get the time and date of the mailbox file
  void            GetMailboxModProperties(int64_t *aSize, uint32_t *aDate); 

  nsCOMPtr <nsIMdbTable>  m_mdbAllOfflineOpsTable;
  mdb_token       m_offlineOpsRowScopeToken;
  mdb_token       m_offlineOpsTableKindToken;

  virtual void    SetReparse(bool reparse);
  
protected:
  
  bool            m_reparse;
};

#endif
