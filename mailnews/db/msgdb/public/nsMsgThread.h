/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsMsgThread_H
#define _nsMsgThread_H

#include "nsIMsgThread.h"
#include "nsStringGlue.h"
#include "MailNewsTypes.h"
#include "mdb.h"

class nsIMdbTable;
class nsIMsgDBHdr;
class nsMsgDatabase;

class nsMsgThread : public nsIMsgThread {
public:
  nsMsgThread();
  nsMsgThread(nsMsgDatabase *db, nsIMdbTable *table);
  virtual ~nsMsgThread();

  friend class nsMsgThreadEnumerator;
  friend class nsMsgDatabase;

  NS_DECL_ISUPPORTS
  NS_DECL_NSIMSGTHREAD

  nsCOMPtr<nsMsgDatabase> m_mdbDB;

protected:

  void                  Init();
  void                  Clear();
  virtual nsresult      InitCachedValues();
  nsresult              ChangeChildCount(int32_t delta);
  nsresult              ChangeUnreadChildCount(int32_t delta);
  nsresult              RemoveChild(nsMsgKey msgKey);
  nsresult              SetThreadRootKey(nsMsgKey threadRootKey);
  nsresult              GetChildHdrForKey(nsMsgKey desiredKey, 
                                          nsIMsgDBHdr **result, int32_t *resultIndex); 
  nsresult              RerootThread(nsIMsgDBHdr *newParentOfOldRoot, nsIMsgDBHdr *oldRoot, nsIDBChangeAnnouncer *announcer);
  nsresult              ReparentChildrenOf(nsMsgKey oldParent, nsMsgKey newParent, nsIDBChangeAnnouncer *announcer);
  
  nsresult              ReparentNonReferenceChildrenOf(nsIMsgDBHdr *topLevelHdr, nsMsgKey newParentKey,
                                                       nsIDBChangeAnnouncer *announcer);
  nsresult              ReparentMsgsWithInvalidParent(uint32_t numChildren, nsMsgKey threadParentKey);

  nsMsgKey              m_threadKey; 
  uint32_t              m_numChildren;
  uint32_t              m_numUnreadChildren;
  uint32_t              m_flags;
  nsCOMPtr<nsIMdbTable> m_mdbTable;
  nsCOMPtr<nsIMdbRow>   m_metaRow;
  bool                  m_cachedValuesInitialized;
  nsMsgKey              m_threadRootKey;
  uint32_t              m_newestMsgDate;
};

#endif

