/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#ifndef _nsNewsDatabase_H_
#define _nsNewsDatabase_H_

#include "mozilla/Attributes.h"
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

  NS_IMETHOD Close(bool forceCommit) MOZ_OVERRIDE;
  NS_IMETHOD ForceClosed() MOZ_OVERRIDE;
  NS_IMETHOD Commit(nsMsgDBCommit commitType) MOZ_OVERRIDE;
  virtual uint32_t GetCurVersion() MOZ_OVERRIDE;

  // methods to get and set docsets for ids.
  NS_IMETHOD  IsRead(nsMsgKey key, bool *pRead) MOZ_OVERRIDE;
  virtual nsresult  IsHeaderRead(nsIMsgDBHdr *msgHdr, bool *pRead) MOZ_OVERRIDE;

  NS_IMETHOD         GetHighWaterArticleNum(nsMsgKey *key) MOZ_OVERRIDE;
  NS_IMETHOD         GetLowWaterArticleNum(nsMsgKey *key) MOZ_OVERRIDE;
  NS_IMETHOD         MarkAllRead(uint32_t *aNumMarked, nsMsgKey **thoseMarked) MOZ_OVERRIDE;

  virtual nsresult    ExpireUpTo(nsMsgKey expireKey);
  virtual nsresult    ExpireRange(nsMsgKey startRange, nsMsgKey endRange);
 
  virtual bool        SetHdrReadFlag(nsIMsgDBHdr *msgHdr, bool bRead) MOZ_OVERRIDE;
 
  virtual nsresult  AdjustExpungedBytesOnDelete(nsIMsgDBHdr *msgHdr) MOZ_OVERRIDE;
  nsresult          SyncWithReadSet();
  
  NS_IMETHOD GetDefaultViewFlags(nsMsgViewFlagsTypeValue *aDefaultViewFlags) MOZ_OVERRIDE;
  NS_IMETHOD GetDefaultSortType(nsMsgViewSortTypeValue *aDefaultSortType) MOZ_OVERRIDE;
  NS_IMETHOD GetDefaultSortOrder(nsMsgViewSortOrderValue *aDefaultSortOrder) MOZ_OVERRIDE;

protected:
  // this is owned by the nsNewsFolder, which lives longer than the db.
  nsMsgKeySet           *m_readSet;
};

#endif
