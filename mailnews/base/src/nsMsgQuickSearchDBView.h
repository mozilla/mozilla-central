/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsMsgQuickSearchDBView_H_
#define _nsMsgQuickSearchDBView_H_

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

  virtual const char * GetViewName(void) {return "QuickSearchView"; }
  NS_IMETHOD Open(nsIMsgFolder *folder, nsMsgViewSortTypeValue sortType, 
                  nsMsgViewSortOrderValue sortOrder, 
                  nsMsgViewFlagsTypeValue viewFlags, PRInt32 *pCount);
  NS_IMETHOD OpenWithHdrs(nsISimpleEnumerator *aHeaders, 
                          nsMsgViewSortTypeValue aSortType, 
                          nsMsgViewSortOrderValue aSortOrder, 
                          nsMsgViewFlagsTypeValue aViewFlags, 
                          PRInt32 *aCount);
  NS_IMETHOD CloneDBView(nsIMessenger *aMessengerInstance,
                         nsIMsgWindow *aMsgWindow,
                         nsIMsgDBViewCommandUpdater *aCommandUpdater,
                         nsIMsgDBView **_retval);
  NS_IMETHOD CopyDBView(nsMsgDBView *aNewMsgDBView,
                        nsIMessenger *aMessengerInstance,
                        nsIMsgWindow *aMsgWindow,
                        nsIMsgDBViewCommandUpdater *aCmdUpdater);
  NS_IMETHOD DoCommand(nsMsgViewCommandTypeValue aCommand);
  NS_IMETHOD GetViewType(nsMsgViewTypeValue *aViewType);
  NS_IMETHOD SetViewFlags(nsMsgViewFlagsTypeValue aViewFlags);
  NS_IMETHOD SetSearchSession(nsIMsgSearchSession *aSearchSession);
  NS_IMETHOD GetSearchSession(nsIMsgSearchSession* *aSearchSession);
  NS_IMETHOD OnHdrFlagsChanged(nsIMsgDBHdr *aHdrChanged, PRUint32 aOldFlags, 
                         PRUint32 aNewFlags, nsIDBChangeListener *aInstigator);
  NS_IMETHOD OnHdrPropertyChanged(nsIMsgDBHdr *aHdrToChange, bool aPreChange, PRUint32 *aStatus, 
                                 nsIDBChangeListener * aInstigator);
  NS_IMETHOD OnHdrDeleted(nsIMsgDBHdr *aHdrDeleted, nsMsgKey aParentKey,
                          PRInt32 aFlags, nsIDBChangeListener *aInstigator);
  NS_IMETHOD GetNumMsgsInView(PRInt32 *aNumMsgs);

protected:
  nsWeakPtr m_searchSession;
  nsTArray<nsMsgKey> m_origKeys;
  bool      m_usingCachedHits;
  bool      m_cacheEmpty;
  nsCOMArray <nsIMsgDBHdr> m_hdrHits;
  virtual nsresult AddHdr(nsIMsgDBHdr *msgHdr, nsMsgViewIndex *resultIndex = nullptr);
  virtual nsresult OnNewHeader(nsIMsgDBHdr *newHdr, nsMsgKey aParentKey, bool ensureListed);
  virtual nsresult DeleteMessages(nsIMsgWindow *window, nsMsgViewIndex *indices, PRInt32 numIndices, bool deleteStorage);
  virtual nsresult SortThreads(nsMsgViewSortTypeValue sortType, nsMsgViewSortOrderValue sortOrder);
  virtual nsresult GetFirstMessageHdrToDisplayInThread(nsIMsgThread *threadHdr, nsIMsgDBHdr **result);
  virtual nsresult ExpansionDelta(nsMsgViewIndex index, PRInt32 *expansionDelta);
  virtual nsresult ListCollapsedChildren(nsMsgViewIndex viewIndex,
                                         nsIMutableArray *messageArray);
  virtual nsresult ListIdsInThread(nsIMsgThread *threadHdr, nsMsgViewIndex startOfThreadViewIndex, PRUint32 *pNumListed);
  virtual nsresult ListIdsInThreadOrder(nsIMsgThread *threadHdr,
                                        nsMsgKey parentKey, PRUint32 level,
                                        nsMsgViewIndex *viewIndex,
                                        PRUint32 *pNumListed);
  virtual nsresult ListIdsInThreadOrder(nsIMsgThread *threadHdr,
                                        nsMsgKey parentKey, PRUint32 level,
                                        PRUint32 callLevel,
                                        nsMsgKey keyToSkip,
                                        nsMsgViewIndex *viewIndex,
                                        PRUint32 *pNumListed);
  virtual nsresult GetMessageEnumerator(nsISimpleEnumerator **enumerator);
  void      SavePreSearchInfo();
  void      ClearPreSearchInfo();

};

#endif
