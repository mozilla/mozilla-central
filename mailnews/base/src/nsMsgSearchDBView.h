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
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2001
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

#ifndef _nsMsgSearchDBViewsH_
#define _nsMsgSearchDBView_H_

#include "nsMsgGroupView.h"
#include "nsIMsgCopyServiceListener.h"
#include "nsIMsgSearchNotify.h"
#include "nsMsgXFViewThread.h"
#include "nsCOMArray.h"

class nsMsgSearchDBView : public nsMsgGroupView, public nsIMsgCopyServiceListener, public nsIMsgSearchNotify
{
public:
  nsMsgSearchDBView();
  virtual ~nsMsgSearchDBView();

  // these are tied together pretty intimately
  friend class nsMsgXFViewThread;

  NS_DECL_ISUPPORTS_INHERITED
  NS_DECL_NSIMSGSEARCHNOTIFY
  NS_DECL_NSIMSGCOPYSERVICELISTENER

  virtual const char * GetViewName(void) {return "SearchView"; }
  NS_IMETHOD Open(nsIMsgFolder *folder, nsMsgViewSortTypeValue sortType, nsMsgViewSortOrderValue sortOrder, 
        nsMsgViewFlagsTypeValue viewFlags, PRInt32 *pCount);
  NS_IMETHOD CloneDBView(nsIMessenger *aMessengerInstance, nsIMsgWindow *aMsgWindow,
                         nsIMsgDBViewCommandUpdater *aCmdUpdater, nsIMsgDBView **_retval);
  NS_IMETHOD CopyDBView(nsMsgDBView *aNewMsgDBView, nsIMessenger *aMessengerInstance, 
                        nsIMsgWindow *aMsgWindow, nsIMsgDBViewCommandUpdater *aCmdUpdater);
  NS_IMETHOD Close();
  NS_IMETHOD GetViewType(nsMsgViewTypeValue *aViewType);
  NS_IMETHOD Sort(nsMsgViewSortTypeValue sortType, 
                  nsMsgViewSortOrderValue sortOrder);
  NS_IMETHOD GetCommandStatus(nsMsgViewCommandTypeValue command,
                              PRBool *selectable_p, 
                              nsMsgViewCommandCheckStateValue *selected_p);
  NS_IMETHOD DoCommand(nsMsgViewCommandTypeValue command);
  NS_IMETHOD DoCommandWithFolder(nsMsgViewCommandTypeValue command, nsIMsgFolder *destFolder);
  NS_IMETHOD GetHdrForFirstSelectedMessage(nsIMsgDBHdr **hdr);
  NS_IMETHOD OnHdrDeleted(nsIMsgDBHdr *aHdrDeleted, nsMsgKey aParentKey, 
                          PRInt32 aFlags, nsIDBChangeListener *aInstigator);
  NS_IMETHOD OnHdrFlagsChanged(nsIMsgDBHdr *aHdrChanged, PRUint32 aOldFlags,
                               PRUint32 aNewFlags, nsIDBChangeListener *aInstigator);
  // override to get location
  NS_IMETHOD GetCellText(PRInt32 aRow, nsITreeColumn* aCol, nsAString& aValue);
  virtual nsresult GetMsgHdrForViewIndex(nsMsgViewIndex index, nsIMsgDBHdr **msgHdr);
  virtual nsresult OnNewHeader(nsIMsgDBHdr *newHdr, nsMsgKey parentKey, PRBool ensureListed);
  NS_IMETHOD GetFolderForViewIndex(nsMsgViewIndex index, nsIMsgFolder **folder);

  NS_IMETHOD OnAnnouncerGoingAway(nsIDBChangeAnnouncer *instigator);

  virtual nsCOMArray<nsIMsgFolder>* GetFolders();
  virtual nsresult GetFolderFromMsgURI(const char *aMsgURI, nsIMsgFolder **aFolder);

  NS_IMETHODIMP SetCurCustomColumn(const nsAString& aColID);
  NS_IMETHODIMP GetCurCustomColumn(nsAString &result);

protected:
  virtual void InternalClose();
  virtual nsresult HashHdr(nsIMsgDBHdr *msgHdr, nsString& aHashKey);
  virtual nsresult ListIdsInThread(nsIMsgThread *threadHdr, 
                                   nsMsgViewIndex startOfThreadViewIndex, 
                                   PRUint32 *pNumListed);
  nsresult FetchLocation(PRInt32 aRow, nsAString& aLocationString);
  virtual nsresult AddHdrFromFolder(nsIMsgDBHdr *msgHdr, nsIMsgFolder *folder);
  virtual nsresult GetDBForViewIndex(nsMsgViewIndex index, nsIMsgDatabase **db);
  virtual nsresult RemoveByIndex(nsMsgViewIndex index);
  virtual nsresult CopyMessages(nsIMsgWindow *window, nsMsgViewIndex *indices, PRInt32 numIndices, PRBool isMove, nsIMsgFolder *destFolder);
  virtual nsresult DeleteMessages(nsIMsgWindow *window, nsMsgViewIndex *indices, PRInt32 numIndices, PRBool deleteStorage);
  virtual void InsertMsgHdrAt(nsMsgViewIndex index, nsIMsgDBHdr *hdr,
                              nsMsgKey msgKey, PRUint32 flags, PRUint32 level);
  virtual void SetMsgHdrAt(nsIMsgDBHdr *hdr, nsMsgViewIndex index,
                              nsMsgKey msgKey, PRUint32 flags, PRUint32 level);
  virtual PRBool InsertEmptyRows(nsMsgViewIndex viewIndex, PRInt32 numRows);
  virtual void RemoveRows(nsMsgViewIndex viewIndex, PRInt32 numRows);
  virtual nsMsgViewIndex FindHdr(nsIMsgDBHdr *msgHdr, nsMsgViewIndex startIndex = 0,
                                 PRBool allowDummy=PR_FALSE);
  virtual nsresult GetThreadContainingMsgHdr(nsIMsgDBHdr *msgHdr, nsIMsgThread **pThread);
  nsresult GetFoldersAndHdrsForSelection(nsMsgViewIndex *indices, PRInt32 numIndices);
  nsresult GroupSearchResultsByFolder();
  nsresult PartitionSelectionByFolder(nsMsgViewIndex *indices, PRInt32 numIndices, nsTArray<PRUint32> **indexArrays, PRInt32 *numArrays);
  virtual nsresult ApplyCommandToIndicesWithFolder(nsMsgViewCommandTypeValue command, nsMsgViewIndex* indices,
                    PRInt32 numIndices, nsIMsgFolder *destFolder);
  void MoveThreadAt(nsMsgViewIndex threadIndex);
  
  virtual nsresult GetMessageEnumerator(nsISimpleEnumerator **enumerator);

  nsCOMArray<nsIMsgFolder> m_folders;
  nsCOMPtr <nsISupportsArray> m_hdrsForEachFolder;
  nsCOMPtr <nsISupportsArray> m_copyListenerList;
  nsCOMArray<nsIMsgFolder> m_uniqueFoldersSelected;
  PRUint32 mCurIndex;

  nsMsgViewIndex* mIndicesForChainedDeleteAndFile;
  PRInt32 mTotalIndices;
  nsCOMArray<nsIMsgDatabase> m_dbToUseList;
  nsMsgViewCommandTypeValue mCommand;
  nsCOMPtr <nsIMsgFolder> mDestFolder;
  nsString m_curCustomColumn;

  nsresult ProcessRequestsInOneFolder(nsIMsgWindow *window);
  nsresult ProcessRequestsInAllFolders(nsIMsgWindow *window);
  // these are for doing threading of the search hits


  // this maps message-ids and reference message ids to
  // the corresponding nsMsgXFViewThread object. If we're 
  // doing subject threading, we would throw subjects
  // into the same table.
  nsInterfaceHashtable <nsStringHashKey, nsIMsgThread> m_threadsTable;

  // map message-ids to msg hdrs in the view, used for threading.
  nsInterfaceHashtable <nsStringHashKey, nsIMsgDBHdr> m_hdrsTable;

  PR_STATIC_CALLBACK(PLDHashOperator) ThreadTableCloner(const nsAString &aKey, 
                                                        nsIMsgThread* aThread, 
                                                        void* aArg);
  PR_STATIC_CALLBACK(PLDHashOperator) MsgHdrTableCloner(const nsAString &aKey, 
                                                        nsIMsgDBHdr* aMsgHdr, 
                                                        void* aArg);
  virtual nsMsgGroupThread *CreateGroupThread(nsIMsgDatabase *db);
  nsresult GetXFThreadFromMsgHdr(nsIMsgDBHdr *msgHdr, nsIMsgThread **pThread,
                                 PRBool *foundByMessageId = nsnull);
  nsresult GetThreadFromHash(nsCString &reference, nsIMsgThread **thread);
  nsresult GetMsgHdrFromHash(nsCString &reference, nsIMsgDBHdr **hdr);
  nsresult AddRefToHash(nsCString &reference, nsIMsgThread *thread);
  nsresult AddMsgToHashTables(nsIMsgDBHdr *msgHdr, nsIMsgThread *thread);
  nsresult RemoveRefFromHash(nsCString &reference);
  nsresult RemoveMsgFromHashTables(nsIMsgDBHdr *msgHdr);
  nsresult InitRefHash();
};

#endif
