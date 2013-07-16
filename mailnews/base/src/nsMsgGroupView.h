/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsMsgGroupView_H_
#define _nsMsgGroupView_H_

#include "mozilla/Attributes.h"
#include "nsMsgDBView.h"
#include "nsInterfaceHashtable.h"

class nsIMsgThread;
class nsMsgGroupThread;

// Please note that if you override a method of nsMsgDBView,
// you will most likely want to check the m_viewFlags to see if
// we're grouping, and if not, call the base class implementation.
class nsMsgGroupView : public nsMsgDBView
{
public:
  nsMsgGroupView();
  virtual ~nsMsgGroupView();

  NS_IMETHOD Open(nsIMsgFolder *folder, nsMsgViewSortTypeValue sortType, nsMsgViewSortOrderValue sortOrder, nsMsgViewFlagsTypeValue viewFlags, int32_t *pCount);
  NS_IMETHOD OpenWithHdrs(nsISimpleEnumerator *aHeaders, nsMsgViewSortTypeValue aSortType, 
                                        nsMsgViewSortOrderValue aSortOrder, nsMsgViewFlagsTypeValue aViewFlags, 
                                        int32_t *aCount);
  NS_IMETHOD GetViewType(nsMsgViewTypeValue *aViewType);
  NS_IMETHOD CopyDBView(nsMsgDBView *aNewMsgDBView, nsIMessenger *aMessengerInstance,
                        nsIMsgWindow *aMsgWindow, nsIMsgDBViewCommandUpdater *aCmdUpdater);
  NS_IMETHOD Close();
  NS_IMETHOD OnHdrDeleted(nsIMsgDBHdr *aHdrDeleted, nsMsgKey aParentKey, int32_t aFlags, 
                            nsIDBChangeListener *aInstigator) MOZ_OVERRIDE;
  NS_IMETHOD OnHdrFlagsChanged(nsIMsgDBHdr *aHdrChanged, uint32_t aOldFlags, 
                                      uint32_t aNewFlags, nsIDBChangeListener *aInstigator) MOZ_OVERRIDE;

  NS_IMETHOD LoadMessageByViewIndex(nsMsgViewIndex aViewIndex);
  NS_IMETHOD GetCellProperties(int32_t aRow, nsITreeColumn *aCol, nsAString& aProperties) MOZ_OVERRIDE;
  NS_IMETHOD GetRowProperties(int32_t aRow, nsAString& aProperties) MOZ_OVERRIDE;
  NS_IMETHOD CellTextForColumn(int32_t aRow, const PRUnichar *aColumnName,
                               nsAString &aValue);
  NS_IMETHOD GetThreadContainingMsgHdr(nsIMsgDBHdr *msgHdr, nsIMsgThread **pThread);

protected:
  virtual void InternalClose();
  nsMsgGroupThread *AddHdrToThread(nsIMsgDBHdr *msgHdr, bool *pNewThread);
  virtual nsresult HashHdr(nsIMsgDBHdr *msgHdr, nsString& aHashKey);
  nsresult GetAgeBucketValue(nsIMsgDBHdr *aMsgHdr, uint32_t * aAgeBucket, bool rcvDate = false); // helper function to get the age bucket for a hdr, useful when grouped by date
  nsresult OnNewHeader(nsIMsgDBHdr *newHdr, nsMsgKey aParentKey, bool /*ensureListed*/) MOZ_OVERRIDE;
  virtual int32_t FindLevelInThread(nsIMsgDBHdr *msgHdr, nsMsgViewIndex startOfThread, nsMsgViewIndex viewIndex) MOZ_OVERRIDE;
  nsMsgViewIndex ThreadIndexOfMsg(nsMsgKey msgKey, 
                                            nsMsgViewIndex msgIndex = nsMsgViewIndex_None,
                                            int32_t *pThreadCount = NULL,
                                            uint32_t *pFlags = NULL) MOZ_OVERRIDE;

  bool GroupViewUsesDummyRow(); // returns true if we are grouped by a sort attribute that uses a dummy row
  virtual nsresult RebuildView(nsMsgViewFlagsTypeValue newFlags);
  virtual nsMsgGroupThread *CreateGroupThread(nsIMsgDatabase *db);
  PR_STATIC_CALLBACK(PLDHashOperator) GroupTableCloner(const nsAString &aKey,
                                                       nsIMsgThread* aGroupThread,
                                                       void* aArg);

  nsInterfaceHashtable <nsStringHashKey, nsIMsgThread> m_groupsTable;
  PRExplodedTime m_lastCurExplodedTime;
  bool m_dayChanged;

private:
  nsString m_kTodayString;
  nsString m_kYesterdayString;
  nsString m_kLastWeekString;
  nsString m_kTwoWeeksAgoString;
  nsString m_kOldMailString;
};

#endif

