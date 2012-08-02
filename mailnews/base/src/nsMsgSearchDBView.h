/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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

  NS_IMETHOD SetSearchSession(nsIMsgSearchSession *aSearchSession);

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
                              bool *selectable_p, 
                              nsMsgViewCommandCheckStateValue *selected_p);
  NS_IMETHOD DoCommand(nsMsgViewCommandTypeValue command);
  NS_IMETHOD DoCommandWithFolder(nsMsgViewCommandTypeValue command, nsIMsgFolder *destFolder);
  NS_IMETHOD GetHdrForFirstSelectedMessage(nsIMsgDBHdr **hdr);
  NS_IMETHOD OpenWithHdrs(nsISimpleEnumerator *aHeaders, 
                          nsMsgViewSortTypeValue aSortType,
                          nsMsgViewSortOrderValue aSortOrder, 
                          nsMsgViewFlagsTypeValue aViewFlags,
                          PRInt32 *aCount);
  NS_IMETHOD OnHdrDeleted(nsIMsgDBHdr *aHdrDeleted, nsMsgKey aParentKey, 
                          PRInt32 aFlags, nsIDBChangeListener *aInstigator);
  NS_IMETHOD OnHdrFlagsChanged(nsIMsgDBHdr *aHdrChanged, PRUint32 aOldFlags,
                               PRUint32 aNewFlags, nsIDBChangeListener *aInstigator);
  NS_IMETHOD GetNumMsgsInView(PRInt32 *aNumMsgs);
  // override to get location
  NS_IMETHOD GetCellText(PRInt32 aRow, nsITreeColumn* aCol, nsAString& aValue);
  virtual nsresult GetMsgHdrForViewIndex(nsMsgViewIndex index, nsIMsgDBHdr **msgHdr);
  virtual nsresult OnNewHeader(nsIMsgDBHdr *newHdr, nsMsgKey parentKey, bool ensureListed);
  NS_IMETHOD GetFolderForViewIndex(nsMsgViewIndex index, nsIMsgFolder **folder);

  NS_IMETHOD OnAnnouncerGoingAway(nsIDBChangeAnnouncer *instigator);

  virtual nsCOMArray<nsIMsgFolder>* GetFolders();
  virtual nsresult GetFolderFromMsgURI(const char *aMsgURI, nsIMsgFolder **aFolder);

  NS_IMETHOD SetCurCustomColumn(const nsAString& aColID);
  NS_IMETHOD GetCurCustomColumn(nsAString &result);
  NS_IMETHOD GetThreadContainingMsgHdr(nsIMsgDBHdr *msgHdr, nsIMsgThread **pThread);

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
  virtual nsresult CopyMessages(nsIMsgWindow *window, nsMsgViewIndex *indices, PRInt32 numIndices, bool isMove, nsIMsgFolder *destFolder);
  virtual nsresult DeleteMessages(nsIMsgWindow *window, nsMsgViewIndex *indices, PRInt32 numIndices, bool deleteStorage);
  virtual void InsertMsgHdrAt(nsMsgViewIndex index, nsIMsgDBHdr *hdr,
                              nsMsgKey msgKey, PRUint32 flags, PRUint32 level);
  virtual void SetMsgHdrAt(nsIMsgDBHdr *hdr, nsMsgViewIndex index,
                              nsMsgKey msgKey, PRUint32 flags, PRUint32 level);
  virtual bool InsertEmptyRows(nsMsgViewIndex viewIndex, PRInt32 numRows);
  virtual void RemoveRows(nsMsgViewIndex viewIndex, PRInt32 numRows);
  virtual nsMsgViewIndex FindHdr(nsIMsgDBHdr *msgHdr, nsMsgViewIndex startIndex = 0,
                                 bool allowDummy=false);
  nsresult GetFoldersAndHdrsForSelection(nsMsgViewIndex *indices, PRInt32 numIndices);
  nsresult GroupSearchResultsByFolder();
  nsresult PartitionSelectionByFolder(nsMsgViewIndex *indices, PRInt32 numIndices, nsTArray<PRUint32> **indexArrays, PRInt32 *numArrays);
  virtual nsresult ApplyCommandToIndicesWithFolder(nsMsgViewCommandTypeValue command, nsMsgViewIndex* indices,
                    PRInt32 numIndices, nsIMsgFolder *destFolder);
  void MoveThreadAt(nsMsgViewIndex threadIndex);
  
  virtual nsresult GetMessageEnumerator(nsISimpleEnumerator **enumerator);
  virtual nsresult InsertHdrFromFolder(nsIMsgDBHdr *msgHdr, nsIMsgFolder *folder);

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
  nsWeakPtr m_searchSession;

  nsresult ProcessRequestsInOneFolder(nsIMsgWindow *window);
  nsresult ProcessRequestsInAllFolders(nsIMsgWindow *window);
  // these are for doing threading of the search hits

  // used for assigning thread id's to xfview threads.
  nsMsgKey m_nextThreadId;
  // this maps message-ids and reference message ids to
  // the corresponding nsMsgXFViewThread object. If we're 
  // doing subject threading, we would throw subjects
  // into the same table.
  nsInterfaceHashtable <nsCStringHashKey, nsIMsgThread> m_threadsTable;

  // map message-ids to msg hdrs in the view, used for threading.
  nsInterfaceHashtable <nsCStringHashKey, nsIMsgDBHdr> m_hdrsTable;
  PRUint32 m_totalMessagesInView;

  PR_STATIC_CALLBACK(PLDHashOperator) ThreadTableCloner(const nsACString &aKey, 
                                                        nsIMsgThread* aThread, 
                                                        void* aArg);
  PR_STATIC_CALLBACK(PLDHashOperator) MsgHdrTableCloner(const nsACString &aKey, 
                                                        nsIMsgDBHdr* aMsgHdr, 
                                                        void* aArg);
  virtual nsMsgGroupThread *CreateGroupThread(nsIMsgDatabase *db);
  nsresult GetXFThreadFromMsgHdr(nsIMsgDBHdr *msgHdr, nsIMsgThread **pThread,
                                 bool *foundByMessageId = nullptr);
  nsresult GetThreadFromHash(nsCString &reference, nsIMsgThread **thread);
  nsresult GetMsgHdrFromHash(nsCString &reference, nsIMsgDBHdr **hdr);
  nsresult AddRefToHash(nsCString &reference, nsIMsgThread *thread);
  nsresult AddMsgToHashTables(nsIMsgDBHdr *msgHdr, nsIMsgThread *thread);
  nsresult RemoveRefFromHash(nsCString &reference);
  nsresult RemoveMsgFromHashTables(nsIMsgDBHdr *msgHdr);
  nsresult InitRefHash();
};

#endif
