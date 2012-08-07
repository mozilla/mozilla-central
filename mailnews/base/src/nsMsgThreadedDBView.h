/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsMsgThreadedDBView_H_
#define _nsMsgThreadedDBView_H_

#include "nsMsgGroupView.h"

class nsMsgThreadedDBView : public nsMsgGroupView
{
public:
  nsMsgThreadedDBView();
  virtual ~nsMsgThreadedDBView();

  NS_IMETHOD Open(nsIMsgFolder *folder, nsMsgViewSortTypeValue sortType, nsMsgViewSortOrderValue sortOrder, nsMsgViewFlagsTypeValue viewFlags, PRInt32 *pCount);
  NS_IMETHOD CloneDBView(nsIMessenger *aMessengerInstance, nsIMsgWindow *aMsgWindow, nsIMsgDBViewCommandUpdater *aCommandUpdater, nsIMsgDBView **_retval);
  NS_IMETHOD Close();
  PRInt32 AddKeys(nsMsgKey *pKeys, PRInt32 *pFlags, const char *pLevels, nsMsgViewSortTypeValue sortType, PRInt32 numKeysToAdd);
  NS_IMETHOD Sort(nsMsgViewSortTypeValue sortType, nsMsgViewSortOrderValue sortOrder);
  NS_IMETHOD GetViewType(nsMsgViewTypeValue *aViewType);
  NS_IMETHOD OnParentChanged (nsMsgKey aKeyChanged, nsMsgKey oldParent, nsMsgKey newParent, nsIDBChangeListener *aInstigator);

protected:
  virtual const char * GetViewName(void) {return "ThreadedDBView"; }
  nsresult InitThreadedView(PRInt32 *pCount);
  virtual nsresult OnNewHeader(nsIMsgDBHdr *newHdr, nsMsgKey aParentKey, bool ensureListed);
  virtual nsresult AddMsgToThreadNotInView(nsIMsgThread *threadHdr, nsIMsgDBHdr *msgHdr, bool ensureListed);
  nsresult ListThreadIds(nsMsgKey *startMsg, bool unreadOnly, nsMsgKey *pOutput, PRInt32 *pFlags, char *pLevels, 
                        PRInt32 numToList, PRInt32 *pNumListed, PRInt32 *pTotalHeaders);
  nsresult InitSort(nsMsgViewSortTypeValue sortType, nsMsgViewSortOrderValue sortOrder);
  virtual nsresult SortThreads(nsMsgViewSortTypeValue sortType, nsMsgViewSortOrderValue sortOrder);
  virtual void  OnExtraFlagChanged(nsMsgViewIndex index, PRUint32 extraFlag);
  virtual void OnHeaderAddedOrDeleted();
  void    ClearPrevIdArray();
  virtual nsresult RemoveByIndex(nsMsgViewIndex index);
  nsMsgViewIndex GetInsertInfoForNewHdr(nsIMsgDBHdr *newHdr, nsMsgViewIndex threadIndex, PRInt32 targetLevel);
  void MoveThreadAt(nsMsgViewIndex threadIndex);

  // these are used to save off the previous view so that bopping back and forth
  // between two views is quick (e.g., threaded and flat sorted by date).
  bool            m_havePrevView;
  nsTArray<nsMsgKey> m_prevKeys;   //this is used for caching non-threaded view.
  nsTArray<PRUint32> m_prevFlags;
  nsTArray<PRUint8>  m_prevLevels;
  nsCOMPtr <nsISimpleEnumerator> m_threadEnumerator;
};

#endif
