/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsMsgQuickSearchDBView_H_
#define _nsMsgQuickSearchDBView_H_

#include "mozilla/Attributes.h"
#include "nsMsgThreadedDBView.h"
#include "nsIMsgSearchNotify.h"
#include "nsIMsgSearchSession.h"
#include "nsCOMArray.h"
#include "nsIMsgHdr.h"


class nsMsgQuickSearchDBView : public nsMsgThreadedDBView, public nsIMsgSearchNotify
{
public:
  nsMsgQuickSearchDBView();
  virtual ~nsMsgQuickSearchDBView();

  NS_DECL_ISUPPORTS_INHERITED
  NS_DECL_NSIMSGSEARCHNOTIFY

  virtual const char * GetViewName(void) MOZ_OVERRIDE {return "QuickSearchView"; }
  NS_IMETHOD Open(nsIMsgFolder *folder, nsMsgViewSortTypeValue sortType, 
                  nsMsgViewSortOrderValue sortOrder, 
                  nsMsgViewFlagsTypeValue viewFlags, int32_t *pCount) MOZ_OVERRIDE;
  NS_IMETHOD OpenWithHdrs(nsISimpleEnumerator *aHeaders, 
                          nsMsgViewSortTypeValue aSortType, 
                          nsMsgViewSortOrderValue aSortOrder, 
                          nsMsgViewFlagsTypeValue aViewFlags, 
                          int32_t *aCount) MOZ_OVERRIDE;
  NS_IMETHOD CloneDBView(nsIMessenger *aMessengerInstance,
                         nsIMsgWindow *aMsgWindow,
                         nsIMsgDBViewCommandUpdater *aCommandUpdater,
                         nsIMsgDBView **_retval) MOZ_OVERRIDE;
  NS_IMETHOD CopyDBView(nsMsgDBView *aNewMsgDBView,
                        nsIMessenger *aMessengerInstance,
                        nsIMsgWindow *aMsgWindow,
                        nsIMsgDBViewCommandUpdater *aCmdUpdater) MOZ_OVERRIDE;
  NS_IMETHOD DoCommand(nsMsgViewCommandTypeValue aCommand);
  NS_IMETHOD GetViewType(nsMsgViewTypeValue *aViewType) MOZ_OVERRIDE;
  NS_IMETHOD SetViewFlags(nsMsgViewFlagsTypeValue aViewFlags);
  NS_IMETHOD SetSearchSession(nsIMsgSearchSession *aSearchSession);
  NS_IMETHOD GetSearchSession(nsIMsgSearchSession* *aSearchSession);
  NS_IMETHOD OnHdrFlagsChanged(nsIMsgDBHdr *aHdrChanged, uint32_t aOldFlags, 
                         uint32_t aNewFlags, nsIDBChangeListener *aInstigator) MOZ_OVERRIDE;
  NS_IMETHOD OnHdrPropertyChanged(nsIMsgDBHdr *aHdrToChange, bool aPreChange, uint32_t *aStatus, 
                                 nsIDBChangeListener * aInstigator) MOZ_OVERRIDE;
  NS_IMETHOD OnHdrDeleted(nsIMsgDBHdr *aHdrDeleted, nsMsgKey aParentKey,
                          int32_t aFlags, nsIDBChangeListener *aInstigator) MOZ_OVERRIDE;
  NS_IMETHOD GetNumMsgsInView(int32_t *aNumMsgs);

protected:
  nsWeakPtr m_searchSession;
  nsTArray<nsMsgKey> m_origKeys;
  bool      m_usingCachedHits;
  bool      m_cacheEmpty;
  nsCOMArray <nsIMsgDBHdr> m_hdrHits;
  virtual nsresult AddHdr(nsIMsgDBHdr *msgHdr, nsMsgViewIndex *resultIndex = nullptr) MOZ_OVERRIDE;
  virtual nsresult OnNewHeader(nsIMsgDBHdr *newHdr, nsMsgKey aParentKey, bool ensureListed) MOZ_OVERRIDE;
  virtual nsresult DeleteMessages(nsIMsgWindow *window, nsMsgViewIndex *indices, int32_t numIndices, bool deleteStorage) MOZ_OVERRIDE;
  virtual nsresult SortThreads(nsMsgViewSortTypeValue sortType, nsMsgViewSortOrderValue sortOrder) MOZ_OVERRIDE;
  virtual nsresult GetFirstMessageHdrToDisplayInThread(nsIMsgThread *threadHdr, nsIMsgDBHdr **result) MOZ_OVERRIDE;
  virtual nsresult ExpansionDelta(nsMsgViewIndex index, int32_t *expansionDelta) MOZ_OVERRIDE;
  virtual nsresult ListCollapsedChildren(nsMsgViewIndex viewIndex,
                                         nsIMutableArray *messageArray) MOZ_OVERRIDE;
  virtual nsresult ListIdsInThread(nsIMsgThread *threadHdr, nsMsgViewIndex startOfThreadViewIndex, uint32_t *pNumListed) MOZ_OVERRIDE;
  virtual nsresult ListIdsInThreadOrder(nsIMsgThread *threadHdr,
                                        nsMsgKey parentKey, uint32_t level,
                                        nsMsgViewIndex *viewIndex,
                                        uint32_t *pNumListed) MOZ_OVERRIDE;
  virtual nsresult ListIdsInThreadOrder(nsIMsgThread *threadHdr,
                                        nsMsgKey parentKey, uint32_t level,
                                        uint32_t callLevel,
                                        nsMsgKey keyToSkip,
                                        nsMsgViewIndex *viewIndex,
                                        uint32_t *pNumListed);
  virtual nsresult GetMessageEnumerator(nsISimpleEnumerator **enumerator) MOZ_OVERRIDE;
  void      SavePreSearchInfo();
  void      ClearPreSearchInfo();

};

#endif
