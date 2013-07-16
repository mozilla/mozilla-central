/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsMsgSearchDBViewsH_
#define _nsMsgSearchDBView_H_

#include "mozilla/Attributes.h"
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
        nsMsgViewFlagsTypeValue viewFlags, int32_t *pCount) MOZ_OVERRIDE;
  NS_IMETHOD CloneDBView(nsIMessenger *aMessengerInstance, nsIMsgWindow *aMsgWindow,
                         nsIMsgDBViewCommandUpdater *aCmdUpdater, nsIMsgDBView **_retval);
  NS_IMETHOD CopyDBView(nsMsgDBView *aNewMsgDBView, nsIMessenger *aMessengerInstance, 
                        nsIMsgWindow *aMsgWindow, nsIMsgDBViewCommandUpdater *aCmdUpdater) MOZ_OVERRIDE;
  NS_IMETHOD Close() MOZ_OVERRIDE;
  NS_IMETHOD GetViewType(nsMsgViewTypeValue *aViewType) MOZ_OVERRIDE;
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
                          int32_t *aCount) MOZ_OVERRIDE;
  NS_IMETHOD OnHdrDeleted(nsIMsgDBHdr *aHdrDeleted, nsMsgKey aParentKey, 
                          int32_t aFlags, nsIDBChangeListener *aInstigator) MOZ_OVERRIDE;
  NS_IMETHOD OnHdrFlagsChanged(nsIMsgDBHdr *aHdrChanged, uint32_t aOldFlags,
                               uint32_t aNewFlags, nsIDBChangeListener *aInstigator) MOZ_OVERRIDE;
  NS_IMETHOD GetNumMsgsInView(int32_t *aNumMsgs);
  // override to get location
  NS_IMETHOD GetCellText(int32_t aRow, nsITreeColumn* aCol, nsAString& aValue) MOZ_OVERRIDE;
  virtual nsresult GetMsgHdrForViewIndex(nsMsgViewIndex index, nsIMsgDBHdr **msgHdr) MOZ_OVERRIDE;
  virtual nsresult OnNewHeader(nsIMsgDBHdr *newHdr, nsMsgKey parentKey, bool ensureListed) MOZ_OVERRIDE;
  NS_IMETHOD GetFolderForViewIndex(nsMsgViewIndex index, nsIMsgFolder **folder);

  NS_IMETHOD OnAnnouncerGoingAway(nsIDBChangeAnnouncer *instigator) MOZ_OVERRIDE;

  virtual nsCOMArray<nsIMsgFolder>* GetFolders() MOZ_OVERRIDE;
  virtual nsresult GetFolderFromMsgURI(const char *aMsgURI, nsIMsgFolder **aFolder) MOZ_OVERRIDE;

  NS_IMETHOD SetCurCustomColumn(const nsAString& aColID);
  NS_IMETHOD GetCurCustomColumn(nsAString &result);
  NS_IMETHOD GetThreadContainingMsgHdr(nsIMsgDBHdr *msgHdr, nsIMsgThread **pThread) MOZ_OVERRIDE;

protected:
  virtual void InternalClose() MOZ_OVERRIDE;
  virtual nsresult HashHdr(nsIMsgDBHdr *msgHdr, nsString& aHashKey) MOZ_OVERRIDE;
  virtual nsresult ListIdsInThread(nsIMsgThread *threadHdr, 
                                   nsMsgViewIndex startOfThreadViewIndex, 
                                   uint32_t *pNumListed) MOZ_OVERRIDE;
  nsresult FetchLocation(int32_t aRow, nsAString& aLocationString);
  virtual nsresult AddHdrFromFolder(nsIMsgDBHdr *msgHdr, nsIMsgFolder *folder);
  virtual nsresult GetDBForViewIndex(nsMsgViewIndex index, nsIMsgDatabase **db) MOZ_OVERRIDE;
  virtual nsresult RemoveByIndex(nsMsgViewIndex index) MOZ_OVERRIDE;
  virtual nsresult CopyMessages(nsIMsgWindow *window, nsMsgViewIndex *indices, int32_t numIndices, bool isMove, nsIMsgFolder *destFolder) MOZ_OVERRIDE;
  virtual nsresult DeleteMessages(nsIMsgWindow *window, nsMsgViewIndex *indices, int32_t numIndices, bool deleteStorage) MOZ_OVERRIDE;
  virtual void InsertMsgHdrAt(nsMsgViewIndex index, nsIMsgDBHdr *hdr,
                              nsMsgKey msgKey, uint32_t flags, uint32_t level) MOZ_OVERRIDE;
  virtual void SetMsgHdrAt(nsIMsgDBHdr *hdr, nsMsgViewIndex index,
                              nsMsgKey msgKey, uint32_t flags, uint32_t level) MOZ_OVERRIDE;
  virtual bool InsertEmptyRows(nsMsgViewIndex viewIndex, int32_t numRows) MOZ_OVERRIDE;
  virtual void RemoveRows(nsMsgViewIndex viewIndex, int32_t numRows) MOZ_OVERRIDE;
  virtual nsMsgViewIndex FindHdr(nsIMsgDBHdr *msgHdr, nsMsgViewIndex startIndex = 0,
                                 bool allowDummy=false) MOZ_OVERRIDE;
  nsresult GetFoldersAndHdrsForSelection(nsMsgViewIndex *indices, int32_t numIndices);
  nsresult GroupSearchResultsByFolder();
  nsresult PartitionSelectionByFolder(nsMsgViewIndex *indices, int32_t numIndices, nsTArray<uint32_t> **indexArrays, int32_t *numArrays);
  virtual nsresult ApplyCommandToIndicesWithFolder(nsMsgViewCommandTypeValue command, nsMsgViewIndex* indices,
                    int32_t numIndices, nsIMsgFolder *destFolder) MOZ_OVERRIDE;
  void MoveThreadAt(nsMsgViewIndex threadIndex);
  
  virtual nsresult GetMessageEnumerator(nsISimpleEnumerator **enumerator) MOZ_OVERRIDE;
  virtual nsresult InsertHdrFromFolder(nsIMsgDBHdr *msgHdr, nsIMsgFolder *folder);

  nsCOMArray<nsIMsgFolder> m_folders;
  nsCOMArray<nsIMutableArray> m_hdrsForEachFolder;
  nsCOMArray<nsIMsgFolder> m_uniqueFoldersSelected;
  uint32_t mCurIndex;

  nsMsgViewIndex* mIndicesForChainedDeleteAndFile;
  int32_t mTotalIndices;
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
  uint32_t m_totalMessagesInView;

  PR_STATIC_CALLBACK(PLDHashOperator) ThreadTableCloner(const nsACString &aKey, 
                                                        nsIMsgThread* aThread, 
                                                        void* aArg);
  PR_STATIC_CALLBACK(PLDHashOperator) MsgHdrTableCloner(const nsACString &aKey, 
                                                        nsIMsgDBHdr* aMsgHdr, 
                                                        void* aArg);
  virtual nsMsgGroupThread *CreateGroupThread(nsIMsgDatabase *db) MOZ_OVERRIDE;
  nsresult GetXFThreadFromMsgHdr(nsIMsgDBHdr *msgHdr, nsIMsgThread **pThread,
                                 bool *foundByMessageId = nullptr);
  bool     GetThreadFromHash(nsCString &reference, nsIMsgThread **thread);
  bool     GetMsgHdrFromHash(nsCString &reference, nsIMsgDBHdr **hdr);
  nsresult AddRefToHash(nsCString &reference, nsIMsgThread *thread);
  nsresult AddMsgToHashTables(nsIMsgDBHdr *msgHdr, nsIMsgThread *thread);
  nsresult RemoveRefFromHash(nsCString &reference);
  nsresult RemoveMsgFromHashTables(nsIMsgDBHdr *msgHdr);
  nsresult InitRefHash();
};

#endif
