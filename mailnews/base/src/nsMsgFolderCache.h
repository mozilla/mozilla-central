/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsMsgFolderCache_H
#define nsMsgFolderCache_H

#include "nsIMsgFolderCache.h"
#include "nsIMsgFolderCacheElement.h"
#include "nsInterfaceHashtable.h"
#include "nsCOMPtr.h"
#include "mdb.h"

class nsMsgFolderCache : public nsIMsgFolderCache
{

public:
  friend class nsMsgFolderCacheElement;

  nsMsgFolderCache();
  virtual ~nsMsgFolderCache();

  NS_DECL_ISUPPORTS
  NS_DECL_NSIMSGFOLDERCACHE

protected:
  void GetMDBFactory(nsIMdbFactory ** aMdbFactory);
  nsresult AddCacheElement(const nsACString& key, nsIMdbRow *row, nsIMsgFolderCacheElement **result);
  nsresult RowCellColumnToCharPtr(nsIMdbRow *hdrRow, mdb_token columnToken, nsACString& resultPtr);
  nsresult InitMDBInfo();
  nsresult InitNewDB();
  nsresult InitExistingDB();
  nsresult OpenMDB(const nsACString& dbName, bool create);
  nsIMdbEnv *GetEnv() {return m_mdbEnv;}
  nsIMdbStore *GetStore() {return m_mdbStore;}
  nsInterfaceHashtable<nsCStringHashKey, nsIMsgFolderCacheElement> m_cacheElements;
  // mdb stuff
  nsIMdbEnv           *m_mdbEnv; // to be used in all the db calls.
  nsIMdbStore         *m_mdbStore;
  nsIMdbTable         *m_mdbAllFoldersTable;
  mdb_token           m_folderRowScopeToken;
  mdb_token           m_folderTableKindToken;
  nsCOMPtr<nsIMdbFactory> mMdbFactory;

  struct mdbOid       m_allFoldersTableOID;
};

#endif
