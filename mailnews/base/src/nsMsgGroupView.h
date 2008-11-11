/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * David Bienvenu.
 * Portions created by the Initial Developer are Copyright (C) 2004
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   David Bienvenu <bienvenu@nventure.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

#ifndef _nsMsgGroupView_H_
#define _nsMsgGroupView_H_

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

  NS_IMETHOD Open(nsIMsgFolder *folder, nsMsgViewSortTypeValue sortType, nsMsgViewSortOrderValue sortOrder, nsMsgViewFlagsTypeValue viewFlags, PRInt32 *pCount);
  NS_IMETHOD OpenWithHdrs(nsISimpleEnumerator *aHeaders, nsMsgViewSortTypeValue aSortType, 
                                        nsMsgViewSortOrderValue aSortOrder, nsMsgViewFlagsTypeValue aViewFlags, 
                                        PRInt32 *aCount);
  NS_IMETHOD GetViewType(nsMsgViewTypeValue *aViewType);
  NS_IMETHOD CopyDBView(nsMsgDBView *aNewMsgDBView, nsIMessenger *aMessengerInstance,
                        nsIMsgWindow *aMsgWindow, nsIMsgDBViewCommandUpdater *aCmdUpdater);
  NS_IMETHOD Close();
  NS_IMETHOD OnHdrDeleted(nsIMsgDBHdr *aHdrDeleted, nsMsgKey aParentKey, PRInt32 aFlags, 
                            nsIDBChangeListener *aInstigator);
  NS_IMETHOD OnHdrFlagsChanged(nsIMsgDBHdr *aHdrChanged, PRUint32 aOldFlags, 
                                      PRUint32 aNewFlags, nsIDBChangeListener *aInstigator);

  NS_IMETHOD LoadMessageByViewIndex(nsMsgViewIndex aViewIndex);
  NS_IMETHOD GetCellProperties(PRInt32 aRow, nsITreeColumn *aCol, nsISupportsArray *aProperties);
  NS_IMETHOD GetRowProperties(PRInt32 aRow, nsISupportsArray *aProperties);
  NS_IMETHOD GetCellText(PRInt32 aRow, nsITreeColumn* aCol, nsAString& aValue);

protected:
  virtual void InternalClose();
  nsMsgGroupThread *AddHdrToThread(nsIMsgDBHdr *msgHdr, PRBool *pNewThread);
  nsresult HashHdr(nsIMsgDBHdr *msgHdr, nsString& aHashKey);
  nsresult GetAgeBucketValue(nsIMsgDBHdr *aMsgHdr, PRUint32 * aAgeBucket, PRBool rcvDate = PR_FALSE); // helper function to get the age bucket for a hdr, useful when grouped by date
  nsresult OnNewHeader(nsIMsgDBHdr *newHdr, nsMsgKey aParentKey, PRBool /*ensureListed*/);
  virtual nsresult GetThreadContainingMsgHdr(nsIMsgDBHdr *msgHdr, nsIMsgThread **pThread);
  virtual PRInt32 FindLevelInThread(nsIMsgDBHdr *msgHdr, nsMsgViewIndex startOfThread, nsMsgViewIndex viewIndex);
  nsMsgViewIndex ThreadIndexOfMsg(nsMsgKey msgKey, 
                                            nsMsgViewIndex msgIndex = nsMsgViewIndex_None,
                                            PRInt32 *pThreadCount = NULL,
                                            PRUint32 *pFlags = NULL);

  PRBool GroupViewUsesDummyRow(); // returns true if we are grouped by a sort attribute that uses a dummy row
  virtual nsresult RebuildView(nsMsgViewFlagsTypeValue newFlags);
  virtual nsMsgGroupThread *CreateGroupThread(nsIMsgDatabase *db);
  PR_STATIC_CALLBACK(PLDHashOperator) GroupTableCloner(const nsAString &aKey,
                                                       nsIMsgThread* aGroupThread,
                                                       void* aArg);

  nsInterfaceHashtable <nsStringHashKey, nsIMsgThread> m_groupsTable;
  PRExplodedTime m_lastCurExplodedTime;
  PRBool m_dayChanged;

private:
  nsString m_kTodayString;
  nsString m_kYesterdayString;
  nsString m_kLastWeekString;
  nsString m_kTwoWeeksAgoString;
  nsString m_kOldMailString;
};

#endif

