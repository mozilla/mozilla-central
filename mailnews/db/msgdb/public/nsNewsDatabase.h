/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#ifndef _nsNewsDatabase_H_
#define _nsNewsDatabase_H_

#include "nsMsgDatabase.h"
#include "nsINewsDatabase.h"
#include "nsTArray.h"

class nsIDBChangeListener;
class MSG_RetrieveArtInfo;
class MSG_PurgeInfo;
// news group database

class nsNewsDatabase : public nsMsgDatabase , public nsINewsDatabase
{
public:
  nsNewsDatabase();
  virtual ~nsNewsDatabase();

  NS_DECL_ISUPPORTS_INHERITED 
  NS_DECL_NSINEWSDATABASE

  NS_IMETHOD Close(bool forceCommit);
  NS_IMETHOD ForceClosed();
  NS_IMETHOD Commit(nsMsgDBCommit commitType);
  virtual uint32_t GetCurVersion();

  // methods to get and set docsets for ids.
  NS_IMETHOD  IsRead(nsMsgKey key, bool *pRead);
  virtual nsresult  IsHeaderRead(nsIMsgDBHdr *msgHdr, bool *pRead);

  NS_IMETHOD         GetHighWaterArticleNum(nsMsgKey *key);
  NS_IMETHOD         GetLowWaterArticleNum(nsMsgKey *key);
  NS_IMETHOD         MarkAllRead(uint32_t *aNumMarked, nsMsgKey **thoseMarked);

  virtual nsresult    ExpireUpTo(nsMsgKey expireKey);
  virtual nsresult    ExpireRange(nsMsgKey startRange, nsMsgKey endRange);
 
  virtual bool        SetHdrReadFlag(nsIMsgDBHdr *msgHdr, bool bRead);
 
  virtual nsresult  AdjustExpungedBytesOnDelete(nsIMsgDBHdr *msgHdr);
  nsresult          SyncWithReadSet();
  
  NS_IMETHOD GetDefaultViewFlags(nsMsgViewFlagsTypeValue *aDefaultViewFlags);
  NS_IMETHOD GetDefaultSortType(nsMsgViewSortTypeValue *aDefaultSortType);
  NS_IMETHOD GetDefaultSortOrder(nsMsgViewSortOrderValue *aDefaultSortOrder);

protected:
  // this is owned by the nsNewsFolder, which lives longer than the db.
  nsMsgKeySet           *m_readSet;
};

#endif
