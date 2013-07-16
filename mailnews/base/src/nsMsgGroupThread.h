/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "mozilla/Attributes.h"
#include "msgCore.h"
#include "nsCOMArray.h"
#include "nsIMsgThread.h"
#include "MailNewsTypes.h"
#include "nsTArray.h"
#include "nsIMsgDatabase.h"
#include "nsIMsgHdr.h"
#include "nsMsgDBView.h"

class nsMsgGroupView;

class nsMsgGroupThread : public nsIMsgThread
{
public:
  friend class nsMsgGroupView;

  nsMsgGroupThread();
  nsMsgGroupThread(nsIMsgDatabase *db);
  virtual ~nsMsgGroupThread();

  NS_DECL_NSIMSGTHREAD
  NS_DECL_ISUPPORTS

protected:
  void      Init();
  nsMsgViewIndex AddChildFromGroupView(nsIMsgDBHdr *child, nsMsgDBView *view);
  nsresult  RemoveChild(nsMsgKey msgKey);
  nsresult  RerootThread(nsIMsgDBHdr *newParentOfOldRoot, nsIMsgDBHdr *oldRoot, nsIDBChangeAnnouncer *announcer);

  virtual nsMsgViewIndex AddMsgHdrInDateOrder(nsIMsgDBHdr *child, nsMsgDBView *view);
  virtual nsMsgViewIndex GetInsertIndexFromView(nsMsgDBView *view, 
                                          nsIMsgDBHdr *child, 
                                          nsMsgViewSortOrderValue threadSortOrder);
  nsresult ReparentNonReferenceChildrenOf(nsIMsgDBHdr *topLevelHdr, nsMsgKey newParentKey,
                                                            nsIDBChangeAnnouncer *announcer);

  nsresult ReparentChildrenOf(nsMsgKey oldParent, nsMsgKey newParent, nsIDBChangeAnnouncer *announcer);
  nsresult ChangeUnreadChildCount(int32_t delta);
  nsresult GetChildHdrForKey(nsMsgKey desiredKey, nsIMsgDBHdr **result, int32_t *resultIndex);
  uint32_t NumRealChildren();
  virtual void InsertMsgHdrAt(nsMsgViewIndex index, nsIMsgDBHdr *hdr);
  virtual void SetMsgHdrAt(nsMsgViewIndex index, nsIMsgDBHdr *hdr);
  virtual nsMsgViewIndex FindMsgHdr(nsIMsgDBHdr *hdr);

  nsMsgKey        m_threadKey; 
  uint32_t        m_numUnreadChildren;	
  uint32_t        m_flags;
  nsMsgKey        m_threadRootKey;
  uint32_t        m_newestMsgDate;
  nsTArray<nsMsgKey> m_keys;
  bool            m_dummy; // top level msg is a dummy, e.g., grouped by age.
  nsCOMPtr <nsIMsgDatabase> m_db; // should we make a weak ref or just a ptr?
};

class nsMsgXFGroupThread : public nsMsgGroupThread
{
public:
  nsMsgXFGroupThread();
  virtual ~nsMsgXFGroupThread();

  NS_IMETHOD GetNumChildren(uint32_t *aNumChildren) MOZ_OVERRIDE;
  NS_IMETHOD GetChildKeyAt(int32_t aIndex, nsMsgKey *aResult) MOZ_OVERRIDE;
  NS_IMETHOD GetChildHdrAt(int32_t aIndex, nsIMsgDBHdr **aResult) MOZ_OVERRIDE;
  NS_IMETHOD RemoveChildAt(int32_t aIndex) MOZ_OVERRIDE;
protected:
  virtual void InsertMsgHdrAt(nsMsgViewIndex index,
                              nsIMsgDBHdr *hdr) MOZ_OVERRIDE;
  virtual void SetMsgHdrAt(nsMsgViewIndex index, nsIMsgDBHdr *hdr) MOZ_OVERRIDE;
  virtual nsMsgViewIndex FindMsgHdr(nsIMsgDBHdr *hdr) MOZ_OVERRIDE;
  virtual nsMsgViewIndex AddMsgHdrInDateOrder(nsIMsgDBHdr *child, 
                                              nsMsgDBView *view) MOZ_OVERRIDE;
  virtual nsMsgViewIndex GetInsertIndexFromView(nsMsgDBView *view, 
                                          nsIMsgDBHdr *child, 
                                          nsMsgViewSortOrderValue threadSortOrder
                                                ) MOZ_OVERRIDE;

  nsCOMArray<nsIMsgFolder> m_folders;
};

