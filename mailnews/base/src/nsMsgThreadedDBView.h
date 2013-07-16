/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsMsgThreadedDBView_H_
#define _nsMsgThreadedDBView_H_

#include "mozilla/Attributes.h"
#include "nsMsgGroupView.h"

class nsMsgThreadedDBView : public nsMsgGroupView
{
public:
  nsMsgThreadedDBView();
  virtual ~nsMsgThreadedDBView();

  NS_IMETHOD Open(nsIMsgFolder *folder, nsMsgViewSortTypeValue sortType, nsMsgViewSortOrderValue sortOrder, nsMsgViewFlagsTypeValue viewFlags, int32_t *pCount) MOZ_OVERRIDE;
  NS_IMETHOD CloneDBView(nsIMessenger *aMessengerInstance, nsIMsgWindow *aMsgWindow, nsIMsgDBViewCommandUpdater *aCommandUpdater, nsIMsgDBView **_retval);
  NS_IMETHOD Close() MOZ_OVERRIDE;
  int32_t AddKeys(nsMsgKey *pKeys, int32_t *pFlags, const char *pLevels, nsMsgViewSortTypeValue sortType, int32_t numKeysToAdd);
  NS_IMETHOD Sort(nsMsgViewSortTypeValue sortType, nsMsgViewSortOrderValue sortOrder);
  NS_IMETHOD GetViewType(nsMsgViewTypeValue *aViewType) MOZ_OVERRIDE;
  NS_IMETHOD OnParentChanged (nsMsgKey aKeyChanged, nsMsgKey oldParent, nsMsgKey newParent, nsIDBChangeListener *aInstigator) MOZ_OVERRIDE;

protected:
  virtual const char * GetViewName(void) {return "ThreadedDBView"; }
  nsresult InitThreadedView(int32_t *pCount);
  virtual nsresult OnNewHeader(nsIMsgDBHdr *newHdr, nsMsgKey aParentKey, bool ensureListed) MOZ_OVERRIDE;
  virtual nsresult AddMsgToThreadNotInView(nsIMsgThread *threadHdr, nsIMsgDBHdr *msgHdr, bool ensureListed);
  nsresult ListThreadIds(nsMsgKey *startMsg, bool unreadOnly, nsMsgKey *pOutput, int32_t *pFlags, char *pLevels, 
                        int32_t numToList, int32_t *pNumListed, int32_t *pTotalHeaders);
  nsresult InitSort(nsMsgViewSortTypeValue sortType, nsMsgViewSortOrderValue sortOrder);
  virtual nsresult SortThreads(nsMsgViewSortTypeValue sortType, nsMsgViewSortOrderValue sortOrder);
  virtual void  OnExtraFlagChanged(nsMsgViewIndex index, uint32_t extraFlag) MOZ_OVERRIDE;
  virtual void OnHeaderAddedOrDeleted() MOZ_OVERRIDE;
  void    ClearPrevIdArray();
  virtual nsresult RemoveByIndex(nsMsgViewIndex index) MOZ_OVERRIDE;
  nsMsgViewIndex GetInsertInfoForNewHdr(nsIMsgDBHdr *newHdr, nsMsgViewIndex threadIndex, int32_t targetLevel);
  void MoveThreadAt(nsMsgViewIndex threadIndex);

  // these are used to save off the previous view so that bopping back and forth
  // between two views is quick (e.g., threaded and flat sorted by date).
  bool            m_havePrevView;
  nsTArray<nsMsgKey> m_prevKeys;   //this is used for caching non-threaded view.
  nsTArray<uint32_t> m_prevFlags;
  nsTArray<uint8_t>  m_prevLevels;
  nsCOMPtr <nsISimpleEnumerator> m_threadEnumerator;
};

#endif
