/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "msgCore.h"
#include "nsMsgSearchDBView.h"
#include "nsIMsgHdr.h"
#include "nsIMsgThread.h"
#include "nsQuickSort.h"
#include "nsIDBFolderInfo.h"
#include "nsMsgBaseCID.h"
#include "nsIMsgCopyService.h"
#include "nsICopyMsgStreamListener.h"
#include "nsMsgUtils.h"
#include "nsITreeColumns.h"
#include "nsIMsgMessageService.h"
#include "nsAutoPtr.h"
#include "nsArrayUtils.h"
#include "nsIMutableArray.h"
#include "nsMsgGroupThread.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "nsMsgMessageFlags.h"
#include "nsIMsgSearchSession.h"
#include "nsComponentManagerUtils.h"
#include "nsServiceManagerUtils.h"

static bool gReferenceOnlyThreading;

nsMsgSearchDBView::nsMsgSearchDBView()
{
  // don't try to display messages for the search pane.
  mSuppressMsgDisplay = true;
  m_totalMessagesInView = 0;
  m_nextThreadId = 1;
}

nsMsgSearchDBView::~nsMsgSearchDBView()
{	
}

NS_IMPL_ISUPPORTS_INHERITED3(nsMsgSearchDBView, nsMsgDBView, nsIMsgDBView, 
                             nsIMsgCopyServiceListener, nsIMsgSearchNotify)

NS_IMETHODIMP nsMsgSearchDBView::Open(nsIMsgFolder *folder, 
                                      nsMsgViewSortTypeValue sortType, 
                                      nsMsgViewSortOrderValue sortOrder, 
                                      nsMsgViewFlagsTypeValue viewFlags, 
                                      int32_t *pCount)
{
  // dbViewWrapper.js likes to create search views with a sort order
  // of byNone, in order to have the order be the order the search results
  // are returned. But this doesn't work with threaded view, so make the
  // sort order be byDate if we're threaded.

  if (viewFlags & nsMsgViewFlagsType::kThreadedDisplay &&
      sortType == nsMsgViewSortType::byNone)
    sortType = nsMsgViewSortType::byDate;

  nsresult rv = nsMsgDBView::Open(folder, sortType, sortOrder, 
                                    viewFlags, pCount);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIPrefBranch> prefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
    NS_ENSURE_SUCCESS(rv, rv);
  prefBranch->GetBoolPref("mail.strict_threading", &gReferenceOnlyThreading);

  // our sort is automatically valid because we have no contents at this point!
  m_sortValid = true;

    if (pCount)
      *pCount = 0;
    m_folder = nullptr;
    return rv;
}


PLDHashOperator
nsMsgSearchDBView::ThreadTableCloner(const nsACString &aKey, nsIMsgThread* aThread, void* aArg)
{
  nsMsgSearchDBView* view = static_cast<nsMsgSearchDBView*>(aArg);
  view->m_threadsTable.Put(aKey, aThread);
  return PL_DHASH_NEXT;
}

PLDHashOperator
nsMsgSearchDBView::MsgHdrTableCloner(const nsACString &aKey, nsIMsgDBHdr* aMsgHdr, void* aArg)
{
  nsMsgSearchDBView* view = static_cast<nsMsgSearchDBView*>(aArg);
  view->m_hdrsTable.Put(aKey, aMsgHdr);
  return PL_DHASH_NEXT;
}

NS_IMETHODIMP
nsMsgSearchDBView::CloneDBView(nsIMessenger *aMessengerInstance, nsIMsgWindow *aMsgWindow, nsIMsgDBViewCommandUpdater *aCmdUpdater, nsIMsgDBView **_retval)
{
  nsMsgSearchDBView* newMsgDBView = new nsMsgSearchDBView();

  if (!newMsgDBView)
    return NS_ERROR_OUT_OF_MEMORY;

  nsresult rv = CopyDBView(newMsgDBView, aMessengerInstance, aMsgWindow, aCmdUpdater);
  NS_ENSURE_SUCCESS(rv,rv);

  NS_IF_ADDREF(*_retval = newMsgDBView);
  return NS_OK;
}

NS_IMETHODIMP
nsMsgSearchDBView::CopyDBView(nsMsgDBView *aNewMsgDBView, nsIMessenger *aMessengerInstance, 
                                       nsIMsgWindow *aMsgWindow, nsIMsgDBViewCommandUpdater *aCmdUpdater)
{
  nsMsgGroupView::CopyDBView(aNewMsgDBView, aMessengerInstance, aMsgWindow, aCmdUpdater);
  nsMsgSearchDBView* newMsgDBView = (nsMsgSearchDBView *) aNewMsgDBView;

  // now copy all of our private member data
  newMsgDBView->mDestFolder = mDestFolder;
  newMsgDBView->mCommand = mCommand;
  newMsgDBView->mTotalIndices = mTotalIndices;
  newMsgDBView->mCurIndex = mCurIndex;
  newMsgDBView->m_folders.InsertObjectsAt(m_folders, 0);
  newMsgDBView->m_curCustomColumn = m_curCustomColumn;
  newMsgDBView->m_hdrsForEachFolder.InsertObjectsAt(m_hdrsForEachFolder, 0);
  newMsgDBView->m_uniqueFoldersSelected.InsertObjectsAt(m_uniqueFoldersSelected, 0);

  int32_t count = m_dbToUseList.Count();
  for(int32_t i = 0; i < count; i++)
  {
    newMsgDBView->m_dbToUseList.AppendObject(m_dbToUseList[i]);
    // register the new view with the database so it gets notifications
    m_dbToUseList[i]->AddListener(newMsgDBView);
  }
  if (m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay)
  {
    // We need to clone the thread and msg hdr hash tables.
    m_threadsTable.EnumerateRead(ThreadTableCloner, newMsgDBView);
    m_hdrsTable.EnumerateRead(MsgHdrTableCloner, newMsgDBView);
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgSearchDBView::Close()
{
  int32_t count = m_dbToUseList.Count();
  
  for(int32_t i = 0; i < count; i++)
    m_dbToUseList[i]->RemoveListener(this);

  m_dbToUseList.Clear();

  return nsMsgGroupView::Close();
}

void nsMsgSearchDBView::InternalClose()
{
  m_threadsTable.Clear();
  m_hdrsTable.Clear();
  nsMsgGroupView::InternalClose();
  m_folders.Clear();
}

NS_IMETHODIMP nsMsgSearchDBView::GetCellText(int32_t aRow, nsITreeColumn* aCol, nsAString& aValue)
{
  NS_ENSURE_TRUE(IsValidIndex(aRow), NS_MSG_INVALID_DBVIEW_INDEX);
  NS_ENSURE_ARG_POINTER(aCol);

  const PRUnichar* colID;
  aCol->GetIdConst(&colID);
  // the only thing we contribute is location; dummy rows have no location, so
  //  bail in that case.  otherwise, check if we are dealing with 'location'.
  // location, need to check for "lo" not just "l" to avoid "label" column
  if (!(m_flags[aRow] & MSG_VIEW_FLAG_DUMMY) &&
      colID[0] == 'l' && colID[1] == 'o')
    return FetchLocation(aRow, aValue);
  else
    return nsMsgGroupView::GetCellText(aRow, aCol, aValue);
}

nsresult nsMsgSearchDBView::HashHdr(nsIMsgDBHdr *msgHdr, nsString& aHashKey)
{
  if (m_sortType == nsMsgViewSortType::byLocation)
  {
    aHashKey.Truncate();
    nsCOMPtr<nsIMsgFolder> folder;
    msgHdr->GetFolder(getter_AddRefs(folder));
    return folder->GetPrettiestName(aHashKey);
  }
  return nsMsgGroupView::HashHdr(msgHdr, aHashKey);
}

nsresult nsMsgSearchDBView::FetchLocation(int32_t aRow, nsAString& aLocationString)
{
  nsCOMPtr <nsIMsgFolder> folder;
  nsresult rv = GetFolderForViewIndex(aRow, getter_AddRefs(folder));
  NS_ENSURE_SUCCESS(rv,rv);
  return folder->GetPrettiestName(aLocationString);
}

nsresult nsMsgSearchDBView::OnNewHeader(nsIMsgDBHdr *newHdr, nsMsgKey aParentKey,
                                        bool /*ensureListed*/)
{
   return NS_OK;
}

NS_IMETHODIMP 
nsMsgSearchDBView::OnHdrDeleted(nsIMsgDBHdr *aHdrDeleted, nsMsgKey aParentKey, 
                                int32_t aFlags, nsIDBChangeListener *aInstigator)
{
  if (m_viewFlags & nsMsgViewFlagsType::kGroupBySort)
    return nsMsgGroupView::OnHdrDeleted(aHdrDeleted, aParentKey, 
                                        aFlags, aInstigator);
  if (m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay)
  {
    nsMsgViewIndex deletedIndex = FindHdr(aHdrDeleted);
    uint32_t savedFlags = 0;
    if (deletedIndex != nsMsgViewIndex_None)
    {
      savedFlags = m_flags[deletedIndex];
      RemoveByIndex(deletedIndex);
    }

    nsCOMPtr<nsIMsgThread> thread;
    GetXFThreadFromMsgHdr(aHdrDeleted, getter_AddRefs(thread));
    if (thread)
    {
      nsMsgXFViewThread *viewThread = static_cast<nsMsgXFViewThread*>(thread.get());
      viewThread->RemoveChildHdr(aHdrDeleted, nullptr);
      if (deletedIndex == nsMsgViewIndex_None && viewThread->MsgCount() == 1)
      {
        // remove the last child of a collapsed thread. Need to find the root,
        // and remove the thread flags on it.
        nsCOMPtr<nsIMsgDBHdr> rootHdr;
        thread->GetRootHdr(nullptr, getter_AddRefs(rootHdr));
        if (rootHdr)
        {
          nsMsgViewIndex threadIndex = GetThreadRootIndex(rootHdr);
          if (threadIndex != nsMsgViewIndex_None)
            AndExtraFlag(threadIndex, ~(MSG_VIEW_FLAG_ISTHREAD | 
                                        nsMsgMessageFlags::Elided | 
                                        MSG_VIEW_FLAG_HASCHILDREN));
        }
      }
      else if (savedFlags & MSG_VIEW_FLAG_HASCHILDREN)
{
        if (savedFlags & nsMsgMessageFlags::Elided)
        {
          nsCOMPtr<nsIMsgDBHdr> rootHdr;
          nsresult rv = thread->GetRootHdr(nullptr, getter_AddRefs(rootHdr));
          NS_ENSURE_SUCCESS(rv, rv);
          nsMsgKey msgKey;
          uint32_t msgFlags;
          rootHdr->GetMessageKey(&msgKey);
          rootHdr->GetFlags(&msgFlags);
          // promote the new thread root
          if (viewThread->MsgCount() > 1)
            msgFlags |= MSG_VIEW_FLAG_ISTHREAD | nsMsgMessageFlags::Elided | 
                        MSG_VIEW_FLAG_HASCHILDREN;
          InsertMsgHdrAt(deletedIndex, rootHdr, msgKey, msgFlags, 0);
          if (!m_deletingRows)
            NoteChange(deletedIndex, 1, nsMsgViewNotificationCode::insertOrDelete);
        }
        else if (viewThread->MsgCount() > 1)
        {
          OrExtraFlag(deletedIndex, MSG_VIEW_FLAG_ISTHREAD |
                                    MSG_VIEW_FLAG_HASCHILDREN);
        }
      }
    }
  }
  else
  {
    return nsMsgDBView::OnHdrDeleted(aHdrDeleted, aParentKey, 
                                        aFlags, aInstigator);
  }
   return NS_OK;
}

NS_IMETHODIMP nsMsgSearchDBView::OnHdrFlagsChanged(nsIMsgDBHdr *aHdrChanged, uint32_t aOldFlags,
                                      uint32_t aNewFlags, nsIDBChangeListener *aInstigator)
{
  // defer to base class if we're grouped or not threaded at all
  if (m_viewFlags & nsMsgViewFlagsType::kGroupBySort ||
      !(m_viewFlags && nsMsgViewFlagsType::kThreadedDisplay))
    return nsMsgGroupView::OnHdrFlagsChanged(aHdrChanged, aOldFlags, 
                                             aNewFlags, aInstigator);

  nsCOMPtr <nsIMsgThread> thread;
  bool foundMessageId;
  // check if the hdr that changed is in a xf thread, and if the read flag
  // changed, update the thread unread count. GetXFThreadFromMsgHdr returns
  // the thread the header does or would belong to, so we need to also
  // check that the header is actually in the thread.
  GetXFThreadFromMsgHdr(aHdrChanged, getter_AddRefs(thread), &foundMessageId);
  if (foundMessageId)
  {
    nsMsgXFViewThread *viewThread = static_cast<nsMsgXFViewThread*>(thread.get());
    if (viewThread->HdrIndex(aHdrChanged) != -1)
    {
      uint32_t deltaFlags = (aOldFlags ^ aNewFlags);
      if (deltaFlags & nsMsgMessageFlags::Read)
        thread->MarkChildRead(aNewFlags & nsMsgMessageFlags::Read);
    }
  }
  return nsMsgDBView::OnHdrFlagsChanged(aHdrChanged, aOldFlags,
                                        aNewFlags, aInstigator);
}

void nsMsgSearchDBView::InsertMsgHdrAt(nsMsgViewIndex index, nsIMsgDBHdr *hdr,
                              nsMsgKey msgKey, uint32_t flags, uint32_t level)
{
  if ((int32_t) index < 0)
  {
    NS_ERROR("invalid insert index");
    index = 0;
    level = 0;
  }
  else if (index > m_keys.Length())
  {
    NS_ERROR("inserting past end of array");
    index = m_keys.Length();
  }
  m_keys.InsertElementAt(index, msgKey);
  m_flags.InsertElementAt(index, flags);
  m_levels.InsertElementAt(index, level);
  nsCOMPtr<nsIMsgFolder> folder;
  hdr->GetFolder(getter_AddRefs(folder));
  m_folders.InsertObjectAt(folder, index);
}

void nsMsgSearchDBView::SetMsgHdrAt(nsIMsgDBHdr *hdr, nsMsgViewIndex index, 
                              nsMsgKey msgKey, uint32_t flags, uint32_t level)
{
  m_keys[index] = msgKey;
  m_flags[index] = flags;
  m_levels[index] = level;
  nsCOMPtr<nsIMsgFolder> folder;
  hdr->GetFolder(getter_AddRefs(folder));
  m_folders.ReplaceObjectAt(folder, index);
}

bool nsMsgSearchDBView::InsertEmptyRows(nsMsgViewIndex viewIndex, int32_t numRows)
{
  for (int32_t i = 0; i < numRows; i++)
    if (!m_folders.InsertObjectAt(nullptr, viewIndex + i))
      return false;
  return nsMsgDBView::InsertEmptyRows(viewIndex, numRows);
}

void nsMsgSearchDBView::RemoveRows(nsMsgViewIndex viewIndex, int32_t numRows)
{
  nsMsgDBView::RemoveRows(viewIndex, numRows);
  for (int32_t i = 0; i < numRows; i++)
    m_folders.RemoveObjectAt(viewIndex);
}

nsresult nsMsgSearchDBView::GetMsgHdrForViewIndex(nsMsgViewIndex index, 
                                                  nsIMsgDBHdr **msgHdr)
{
  nsresult rv = NS_MSG_INVALID_DBVIEW_INDEX;
  if (index == nsMsgViewIndex_None || index >= (uint32_t) m_folders.Count())
    return rv;
  nsIMsgFolder *folder = m_folders[index];
  if (folder)
  {
    nsCOMPtr <nsIMsgDatabase> db;
    rv = folder->GetMsgDatabase(getter_AddRefs(db));
    NS_ENSURE_SUCCESS(rv, rv);
    if (db)
      rv = db->GetMsgHdrForKey(m_keys[index], msgHdr);
  }
  return rv;
}

NS_IMETHODIMP nsMsgSearchDBView::GetFolderForViewIndex(nsMsgViewIndex index, nsIMsgFolder **aFolder)
{
  NS_ENSURE_ARG_POINTER(aFolder);

  if (index == nsMsgViewIndex_None || index >= (uint32_t) m_folders.Count())
    return NS_MSG_INVALID_DBVIEW_INDEX;
  NS_IF_ADDREF(*aFolder = m_folders[index]);
  return *aFolder ? NS_OK : NS_ERROR_NULL_POINTER;
}

nsresult nsMsgSearchDBView::GetDBForViewIndex(nsMsgViewIndex index, nsIMsgDatabase **db)
{
  nsCOMPtr <nsIMsgFolder> aFolder;
  nsresult rv = GetFolderForViewIndex(index, getter_AddRefs(aFolder));
  NS_ENSURE_SUCCESS(rv, rv);
  return aFolder->GetMsgDatabase(db);
}

nsresult nsMsgSearchDBView::AddHdrFromFolder(nsIMsgDBHdr *msgHdr, nsIMsgFolder *folder)
{
  if (m_viewFlags & nsMsgViewFlagsType::kGroupBySort)
    return nsMsgGroupView::OnNewHeader(msgHdr, nsMsgKey_None, true);
  nsMsgKey msgKey;
  uint32_t msgFlags;
  msgHdr->GetMessageKey(&msgKey);
  msgHdr->GetFlags(&msgFlags);

  if (m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay)
  {
    nsCOMPtr<nsIMsgThread> thread;
    nsCOMPtr<nsIMsgDBHdr> threadRoot;
    // if we find an xf thread in the hash table corresponding to the new msg's
    // message id, a previous header must be a reference child of the new 
    // message, which means we need to reparent later.
    bool msgIsReferredTo;
    GetXFThreadFromMsgHdr(msgHdr, getter_AddRefs(thread), &msgIsReferredTo);
    bool newThread = !thread;
    nsMsgXFViewThread *viewThread;
    if (!thread)
    {
      viewThread = new nsMsgXFViewThread(this, m_nextThreadId++);
      if (!viewThread)
        return NS_ERROR_OUT_OF_MEMORY;
      thread = do_QueryInterface(viewThread);
    }
    else
    {
      viewThread = static_cast<nsMsgXFViewThread*>(thread.get());
      thread->GetChildHdrAt(0, getter_AddRefs(threadRoot));
    }

    AddMsgToHashTables(msgHdr, thread);
    nsCOMPtr<nsIMsgDBHdr> parent;
    uint32_t posInThread;
    // We need to move threads in order to keep ourselves sorted
    // correctly.  We want the index of the original thread...we can do this by
    // getting the root header before we add the new header, and finding that.
    if (newThread || !viewThread->MsgCount())
    {
      viewThread->AddHdr(msgHdr, false, posInThread,
                         getter_AddRefs(parent));
      nsMsgViewIndex insertIndex = GetIndexForThread(msgHdr);
      NS_ASSERTION(insertIndex == m_levels.Length() || !m_levels[insertIndex],
                    "inserting into middle of thread");
      if (insertIndex == nsMsgViewIndex_None)
        return NS_ERROR_FAILURE;
      if (!(m_viewFlags & nsMsgViewFlagsType::kExpandAll))
        msgFlags |= nsMsgMessageFlags::Elided;
      InsertMsgHdrAt(insertIndex, msgHdr, msgKey, msgFlags, 0);
      NoteChange(insertIndex, 1, nsMsgViewNotificationCode::insertOrDelete);
    }
    else
    {
      // get the thread root index before we add the header, because adding
      // the header can change the sort position.
      nsMsgViewIndex threadIndex = GetThreadRootIndex(threadRoot);
      viewThread->AddHdr(msgHdr, msgIsReferredTo, posInThread,
                         getter_AddRefs(parent));
      if (threadIndex == nsMsgViewIndex_None)
      {
        NS_ERROR("couldn't find thread index for newly inserted header");
        return NS_OK; // not really OK, but not failure exactly.
      }
      NS_ASSERTION(!m_levels[threadIndex], "threadRoot incorrect, or level incorrect");

      bool moveThread = false;
      if (m_sortType == nsMsgViewSortType::byDate)
      {
        uint32_t newestMsgInThread = 0, msgDate = 0;
        viewThread->GetNewestMsgDate(&newestMsgInThread);
        msgHdr->GetDateInSeconds(&msgDate);
        moveThread = (msgDate == newestMsgInThread);
      }
      OrExtraFlag(threadIndex, MSG_VIEW_FLAG_HASCHILDREN | MSG_VIEW_FLAG_ISTHREAD);
      if (!(m_flags[threadIndex] & nsMsgMessageFlags::Elided))
      {
        if (parent)
        {
          // since we know posInThread, we just want to insert the new hdr
          // at threadIndex + posInThread, and then rebuild the view until we
          // get to a sibling of the new hdr.
          uint8_t newMsgLevel = viewThread->ChildLevelAt(posInThread);
          InsertMsgHdrAt(threadIndex + posInThread, msgHdr, msgKey, msgFlags,
                         newMsgLevel);

          NoteChange(threadIndex + posInThread, 1, nsMsgViewNotificationCode::insertOrDelete);
          for (nsMsgViewIndex viewIndex = threadIndex + ++posInThread;
               posInThread < viewThread->MsgCount() && 
               viewThread->ChildLevelAt(posInThread) > newMsgLevel; viewIndex++)
          {
            m_levels[viewIndex] = viewThread->ChildLevelAt(posInThread++);
          }

        }
        else // The new header is the root, so we need to adjust 
             // all the children.
        {
          InsertMsgHdrAt(threadIndex, msgHdr, msgKey, msgFlags, 0);

          NoteChange(threadIndex, 1, nsMsgViewNotificationCode::insertOrDelete);
          nsMsgViewIndex i;
          for (i = threadIndex + 1; 
               i < m_keys.Length() && (i == threadIndex + 1 || m_levels[i]); i++)
            m_levels[i] = m_levels[i] + 1;
          // turn off thread flags on old root.
          AndExtraFlag(threadIndex + 1, ~(MSG_VIEW_FLAG_ISTHREAD | 
                                          nsMsgMessageFlags::Elided | 
                                          MSG_VIEW_FLAG_HASCHILDREN));

          NoteChange(threadIndex + 1, i - threadIndex + 1, 
                     nsMsgViewNotificationCode::changed);
        }
      }
      else if (!parent)
      {
        // new parent came into collapsed thread
        nsCOMPtr<nsIMsgFolder> msgFolder;
        msgHdr->GetFolder(getter_AddRefs(msgFolder));
        m_keys[threadIndex] = msgKey;
        m_folders.ReplaceObjectAt(msgFolder, threadIndex);
        m_flags[threadIndex] = msgFlags | MSG_VIEW_FLAG_ISTHREAD | 
                                          nsMsgMessageFlags::Elided | 
                                          MSG_VIEW_FLAG_HASCHILDREN;
        NoteChange(threadIndex, 1, nsMsgViewNotificationCode::changed);

      }
      if (moveThread)
        MoveThreadAt(threadIndex);
    }
  }
  else
  {
    m_folders.AppendObject(folder);
  // nsMsgKey_None means it's not a valid hdr.
  if (msgKey != nsMsgKey_None)
  {
    msgHdr->GetFlags(&msgFlags);
    m_keys.AppendElement(msgKey);
    m_levels.AppendElement(0);
    m_flags.AppendElement(msgFlags);
      NoteChange(GetSize() - 1, 1, nsMsgViewNotificationCode::insertOrDelete);
    }
  }
  return NS_OK;
  }

// This method removes the thread at threadIndex from the view 
// and puts it back in its new position, determined by the sort order.
// And, if the selection is affected, save and restore the selection.
void nsMsgSearchDBView::MoveThreadAt(nsMsgViewIndex threadIndex)
{
  bool updatesSuppressed = mSuppressChangeNotification;
  // Turn off tree notifications so that we don't reload the current message.
  if (!updatesSuppressed)
    SetSuppressChangeNotifications(true);

  nsCOMPtr<nsIMsgDBHdr> threadHdr;
  GetMsgHdrForViewIndex(threadIndex, getter_AddRefs(threadHdr));

  uint32_t saveFlags = m_flags[threadIndex];
  bool threadIsExpanded = !(saveFlags & nsMsgMessageFlags::Elided);
  int32_t childCount = 0;
  nsMsgKey preservedKey;
  nsAutoTArray<nsMsgKey, 1> preservedSelection;
  int32_t selectionCount;
  int32_t currentIndex;
  bool hasSelection = mTree && mTreeSelection &&
                        ((NS_SUCCEEDED(mTreeSelection->GetCurrentIndex(&currentIndex)) &&
                         currentIndex >= 0 && (uint32_t)currentIndex < GetSize()) ||
                         (NS_SUCCEEDED(mTreeSelection->GetRangeCount(&selectionCount)) &&
                          selectionCount > 0));


  if (hasSelection)
    SaveAndClearSelection(&preservedKey, preservedSelection);

  if (threadIsExpanded)
  {
    ExpansionDelta(threadIndex, &childCount);
    childCount = -childCount;
  }
  nsTArray<nsMsgKey> threadKeys;
  nsTArray<uint32_t> threadFlags;
  nsTArray<uint8_t> threadLevels;
  nsCOMArray<nsIMsgFolder> threadFolders;

  if (threadIsExpanded)
  {
    threadKeys.SetCapacity(childCount);
    threadFlags.SetCapacity(childCount);
    threadLevels.SetCapacity(childCount);
    threadFolders.SetCapacity(childCount);
    for (nsMsgViewIndex index = threadIndex + 1; 
        index < (nsMsgViewIndex) GetSize() && m_levels[index]; index++)
    {
      threadKeys.AppendElement(m_keys[index]);
      threadFlags.AppendElement(m_flags[index]);
      threadLevels.AppendElement(m_levels[index]);
      threadFolders.AppendObject(m_folders[index]);
    }
    uint32_t collapseCount;
    CollapseByIndex(threadIndex, &collapseCount);
  }
  nsMsgDBView::RemoveByIndex(threadIndex);
  m_folders.RemoveObjectAt(threadIndex);
  nsMsgViewIndex newIndex = GetIndexForThread(threadHdr);
  NS_ASSERTION(newIndex == m_levels.Length() || !m_levels[newIndex],
                "inserting into middle of thread");
  if (newIndex == nsMsgViewIndex_None)
    newIndex = 0;
  nsMsgKey msgKey;
  uint32_t msgFlags;
  threadHdr->GetMessageKey(&msgKey);
  threadHdr->GetFlags(&msgFlags);
  InsertMsgHdrAt(newIndex, threadHdr, msgKey, msgFlags, 0);

  if (threadIsExpanded)
  {
    m_keys.InsertElementsAt(newIndex + 1, threadKeys);
    m_flags.InsertElementsAt(newIndex + 1, threadFlags);
    m_levels.InsertElementsAt(newIndex + 1, threadLevels);
    m_folders.InsertObjectsAt(threadFolders, newIndex + 1);
  }
  m_flags[newIndex] = saveFlags;
  // unfreeze selection.
  if (hasSelection)
    RestoreSelection(preservedKey, preservedSelection);

  if (!updatesSuppressed)
    SetSuppressChangeNotifications(false);
  nsMsgViewIndex lowIndex = threadIndex < newIndex ? threadIndex : newIndex;
  nsMsgViewIndex highIndex = lowIndex == threadIndex ? newIndex : threadIndex;
  NoteChange(lowIndex, highIndex - lowIndex + childCount + 1,
             nsMsgViewNotificationCode::changed);
}

nsresult
nsMsgSearchDBView::GetMessageEnumerator(nsISimpleEnumerator **enumerator)
{
  // We do not have an m_db, so the default behavior (in nsMsgDBView) is not
  //  what we want (it will crash).  We just want someone to enumerate the
  //  headers that we already have.  Conveniently, nsMsgDBView already knows
  //  how to do this with its view enumerator, so we just use that.
  return nsMsgDBView::GetViewEnumerator(enumerator);
}

nsresult nsMsgSearchDBView::InsertHdrFromFolder(nsIMsgDBHdr *msgHdr, nsIMsgFolder *folder)
{
  nsMsgViewIndex insertIndex = nsMsgViewIndex_None;
  // Threaded view always needs to go through AddHdrFromFolder since
  // it handles the xf view thread object creation.
  if (! (m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay))
    insertIndex = GetInsertIndex(msgHdr);

  if (insertIndex == nsMsgViewIndex_None)
    return AddHdrFromFolder(msgHdr, folder);

  nsMsgKey msgKey;
  uint32_t msgFlags;
  msgHdr->GetMessageKey(&msgKey);
  msgHdr->GetFlags(&msgFlags);
  InsertMsgHdrAt(insertIndex, msgHdr, msgKey, msgFlags, 0);

  // the call to NoteChange() has to happen after we add the key
  // as NoteChange() will call RowCountChanged() which will call our GetRowCount()
  NoteChange(insertIndex, 1, nsMsgViewNotificationCode::insertOrDelete);
  return NS_OK;
}

NS_IMETHODIMP
nsMsgSearchDBView::OnSearchHit(nsIMsgDBHdr* aMsgHdr, nsIMsgFolder *folder)
{
  NS_ENSURE_ARG(aMsgHdr);
  NS_ENSURE_ARG(folder);

  if (m_folders.IndexOf(folder) < 0 ) //do this just for new folder
  {
    nsCOMPtr<nsIMsgDatabase> dbToUse;
    nsCOMPtr<nsIDBFolderInfo> folderInfo;
    folder->GetDBFolderInfoAndDB(getter_AddRefs(folderInfo), getter_AddRefs(dbToUse));
    if (dbToUse)
    {
      dbToUse->AddListener(this);
      m_dbToUseList.AppendObject(dbToUse);
    }
  }
  m_totalMessagesInView++;
  if (m_sortValid)
    return InsertHdrFromFolder(aMsgHdr, folder);
  else
    return AddHdrFromFolder(aMsgHdr, folder);
}

NS_IMETHODIMP
nsMsgSearchDBView::OnSearchDone(nsresult status)
{
  //we want to set imap delete model once the search is over because setting next
  //message after deletion will happen before deleting the message and search scope
  //can change with every search.
  mDeleteModel = nsMsgImapDeleteModels::MoveToTrash;  //set to default in case it is non-imap folder
  nsIMsgFolder *curFolder = m_folders.SafeObjectAt(0);
  if (curFolder)   
    GetImapDeleteModel(curFolder);
  return NS_OK;
}

// for now also acts as a way of resetting the search datasource
NS_IMETHODIMP
nsMsgSearchDBView::OnNewSearch()
{
  int32_t oldSize = GetSize();

  int32_t count = m_dbToUseList.Count();
  for(int32_t j = 0; j < count; j++) 
    m_dbToUseList[j]->RemoveListener(this);

  m_dbToUseList.Clear();
  m_folders.Clear();
  m_keys.Clear();
  m_levels.Clear();
  m_flags.Clear();
  m_totalMessagesInView = 0;

  // needs to happen after we remove the keys, since RowCountChanged() will call our GetRowCount()
  if (mTree) 
    mTree->RowCountChanged(0, -oldSize);

//    mSearchResults->Clear();
    return NS_OK;
}

NS_IMETHODIMP nsMsgSearchDBView::GetViewType(nsMsgViewTypeValue *aViewType)
{
    NS_ENSURE_ARG_POINTER(aViewType);
    *aViewType = nsMsgViewType::eShowSearch;
    return NS_OK;
}

NS_IMETHODIMP
nsMsgSearchDBView::SetSearchSession(nsIMsgSearchSession *aSession)
{
  m_searchSession = do_GetWeakReference(aSession);
  return NS_OK;
}

NS_IMETHODIMP nsMsgSearchDBView::OnAnnouncerGoingAway(nsIDBChangeAnnouncer *instigator)
{
  nsIMsgDatabase *db = static_cast<nsIMsgDatabase *>(instigator);
  if (db)
  {
    db->RemoveListener(this);
    m_dbToUseList.RemoveObject(db);
  }
  return NS_OK;
}

nsCOMArray<nsIMsgFolder>* nsMsgSearchDBView::GetFolders()
{
  return &m_folders;
}

NS_IMETHODIMP
nsMsgSearchDBView::GetCommandStatus(nsMsgViewCommandTypeValue command, bool *selectable_p, nsMsgViewCommandCheckStateValue *selected_p)
{
  if (command != nsMsgViewCommandType::runJunkControls)
    return nsMsgDBView::GetCommandStatus(command, selectable_p, selected_p);

  *selectable_p = false;
  return NS_OK;
}

NS_IMETHODIMP 
nsMsgSearchDBView::DoCommandWithFolder(nsMsgViewCommandTypeValue command, nsIMsgFolder *destFolder)
{
    mCommand = command;
    mDestFolder = destFolder;
    return nsMsgDBView::DoCommandWithFolder(command, destFolder);
}

NS_IMETHODIMP nsMsgSearchDBView::DoCommand(nsMsgViewCommandTypeValue command)
{
  mCommand = command;
  if (command == nsMsgViewCommandType::deleteMsg ||
      command == nsMsgViewCommandType::deleteNoTrash ||
      command == nsMsgViewCommandType::selectAll ||
      command == nsMsgViewCommandType::selectThread ||
      command == nsMsgViewCommandType::expandAll ||
      command == nsMsgViewCommandType::collapseAll)
    return nsMsgDBView::DoCommand(command);
  nsresult rv = NS_OK;
  nsMsgViewIndexArray selection;
  GetSelectedIndices(selection);

  nsMsgViewIndex *indices = selection.Elements();
  int32_t numIndices = selection.Length();

  // we need to break apart the selection by folders, and then call
  // ApplyCommandToIndices with the command and the indices in the
  // selection that are from that folder.

  nsAutoArrayPtr<nsTArray<uint32_t> > indexArrays;
  int32_t numArrays;
  rv = PartitionSelectionByFolder(indices, numIndices, getter_Transfers(indexArrays), &numArrays);
  NS_ENSURE_SUCCESS(rv, rv);
  for (int32_t folderIndex = 0; folderIndex < numArrays; folderIndex++)
  {
    rv = ApplyCommandToIndices(command, indexArrays[folderIndex].Elements(), indexArrays[folderIndex].Length());
    NS_ENSURE_SUCCESS(rv, rv);
  }

  return rv;
}

// This method removes the specified line from the view, and adjusts the
// various flags and levels of affected messages.
nsresult nsMsgSearchDBView::RemoveByIndex(nsMsgViewIndex index)
{
    if (!IsValidIndex(index))
        return NS_MSG_INVALID_DBVIEW_INDEX;

  if (m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay)
  {
    nsCOMPtr<nsIMsgDBHdr> msgHdr;
    nsCOMPtr<nsIMsgThread> thread;
    nsresult rv = GetMsgHdrForViewIndex(index, getter_AddRefs(msgHdr));
    NS_ENSURE_SUCCESS(rv, rv);
    
    GetXFThreadFromMsgHdr(msgHdr, getter_AddRefs(thread));
    if (thread)
    {
      nsMsgXFViewThread *viewThread = static_cast<nsMsgXFViewThread*>(thread.get());
      if (viewThread->MsgCount() == 2)
      {
        // if we removed the next to last message in the thread,
        // we need to adjust the flags on the first message in the thread.
        nsMsgViewIndex threadIndex = m_levels[index] ? index -1 : index;
        if (threadIndex != nsMsgViewIndex_None)
        {
          AndExtraFlag(threadIndex, ~(MSG_VIEW_FLAG_ISTHREAD | nsMsgMessageFlags::Elided |
                                      MSG_VIEW_FLAG_HASCHILDREN));
          m_levels[threadIndex] = 0;
          NoteChange(threadIndex, 1, nsMsgViewNotificationCode::changed);
        }
      }
      // Bump up the level of all the descendents of the message
      // that was removed, if the thread was expanded.
      uint8_t removedLevel = m_levels[index];
      nsMsgViewIndex i = index + 1;
      if (i < m_levels.Length() && m_levels[i] > removedLevel)
      {
        // promote the child of the removed message.
        uint8_t promotedLevel = m_levels[i];
        m_levels[i] = promotedLevel - 1;
        i++;
        // now promote all the children of the promoted message.
        for (; i < m_levels.Length() && 
              m_levels[i] > promotedLevel; i++)
          m_levels[i] = m_levels[i] - 1;
      }
    }
  }
  m_folders.RemoveObjectAt(index);
    return nsMsgDBView::RemoveByIndex(index);
}

nsresult nsMsgSearchDBView::DeleteMessages(nsIMsgWindow *window, nsMsgViewIndex *indices, int32_t numIndices, bool deleteStorage)
{
   nsresult rv = GetFoldersAndHdrsForSelection(indices, numIndices);
   NS_ENSURE_SUCCESS(rv, rv);
   if (mDeleteModel != nsMsgImapDeleteModels::MoveToTrash)
     deleteStorage = true;
  if (mDeleteModel != nsMsgImapDeleteModels::IMAPDelete)
    m_deletingRows = true;

  // remember the deleted messages in case the user undoes the delete,
  // and we want to restore the hdr to the view, even if it no
  // longer matches the search criteria.
  for (nsMsgViewIndex i = 0; i < (nsMsgViewIndex) numIndices; i++) 
  {
    nsCOMPtr<nsIMsgDBHdr> msgHdr; 
    (void) GetMsgHdrForViewIndex(indices[i], getter_AddRefs(msgHdr));
    if (msgHdr)
      RememberDeletedMsgHdr(msgHdr);
    // if we are deleting rows, save off the view indices
    if (m_deletingRows)
      mIndicesToNoteChange.AppendElement(indices[i]);

  }
  rv = deleteStorage ? ProcessRequestsInAllFolders(window)
                     : ProcessRequestsInOneFolder(window);
  if (NS_FAILED(rv))
    m_deletingRows = false;
  return rv;
}

nsresult 
nsMsgSearchDBView::CopyMessages(nsIMsgWindow *window, nsMsgViewIndex *indices, int32_t numIndices, bool isMove, nsIMsgFolder *destFolder)
{
    GetFoldersAndHdrsForSelection(indices, numIndices);
    return ProcessRequestsInOneFolder(window);
}

nsresult
nsMsgSearchDBView::PartitionSelectionByFolder(nsMsgViewIndex *indices, int32_t numIndices, nsTArray<uint32_t> **indexArrays, int32_t *numArrays)
{
  nsMsgViewIndex i;
  int32_t folderIndex;
  nsCOMArray<nsIMsgFolder> uniqueFoldersSelected;
  nsTArray<uint32_t> numIndicesSelected;
  mCurIndex = 0;

  //Build unique folder list based on headers selected by the user
  for (i = 0; i < (nsMsgViewIndex) numIndices; i++)
  {
    nsIMsgFolder *curFolder = m_folders[indices[i]];
    folderIndex = uniqueFoldersSelected.IndexOf(curFolder);
    if (folderIndex < 0)
    {
      uniqueFoldersSelected.AppendObject(curFolder);
      numIndicesSelected.AppendElement(1);
    }
    else
    {
      numIndicesSelected[folderIndex]++;
    }
  }

  int32_t numFolders = uniqueFoldersSelected.Count();
  *indexArrays = new nsTArray<uint32_t>[numFolders];
  *numArrays = numFolders;
  NS_ENSURE_TRUE(*indexArrays, NS_ERROR_OUT_OF_MEMORY);
  for (folderIndex = 0; folderIndex < numFolders; folderIndex++)
  {
    (*indexArrays)[folderIndex].SetCapacity(numIndicesSelected[folderIndex]);
  }
  for (i = 0; i < (nsMsgViewIndex) numIndices; i++) 
  {
    nsIMsgFolder *curFolder = m_folders[indices[i]];
    int32_t folderIndex = uniqueFoldersSelected.IndexOf(curFolder);
    (*indexArrays)[folderIndex].AppendElement(indices[i]);
  }
  return NS_OK;
}

nsresult
nsMsgSearchDBView::GetFoldersAndHdrsForSelection(nsMsgViewIndex *indices, int32_t numIndices)
{
  nsresult rv = NS_OK; 
  mCurIndex = 0;
  m_uniqueFoldersSelected.Clear();
  m_hdrsForEachFolder.Clear();

  nsCOMPtr<nsIMutableArray> messages(do_CreateInstance(NS_ARRAY_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  rv = GetHeadersFromSelection(indices, numIndices, messages);
  NS_ENSURE_SUCCESS(rv, rv);
  uint32_t numMsgs;
  messages->GetLength(&numMsgs);

  uint32_t i;
  // Build unique folder list based on headers selected by the user
  for (i = 0; i < numMsgs; i++)
  {
    nsCOMPtr<nsIMsgDBHdr> hdr = do_QueryElementAt(messages, i, &rv);
    if (hdr)
    {
      nsCOMPtr<nsIMsgFolder> curFolder;
      hdr->GetFolder(getter_AddRefs(curFolder));
      if (m_uniqueFoldersSelected.IndexOf(curFolder) < 0)
        m_uniqueFoldersSelected.AppendObject(curFolder);
    }
  }

  // Group the headers selected by each folder
  uint32_t numFolders = m_uniqueFoldersSelected.Count();
  for (uint32_t folderIndex = 0; folderIndex < numFolders; folderIndex++)
  {
    nsIMsgFolder *curFolder = m_uniqueFoldersSelected[folderIndex];
    nsCOMPtr<nsIMutableArray> msgHdrsForOneFolder(do_CreateInstance(NS_ARRAY_CONTRACTID, &rv));
    NS_ENSURE_SUCCESS(rv, rv);
    for (i = 0; i < numMsgs; i++) 
    {
      nsCOMPtr<nsIMsgDBHdr> hdr = do_QueryElementAt(messages, i, &rv);
      if (hdr)
      {
        nsCOMPtr<nsIMsgFolder> msgFolder;
        hdr->GetFolder(getter_AddRefs(msgFolder));
        if (NS_SUCCEEDED(rv) && msgFolder && msgFolder == curFolder) 
        {
          nsCOMPtr<nsISupports> hdrSupports = do_QueryInterface(hdr);
          msgHdrsForOneFolder->AppendElement(hdrSupports, false);
        }
      }
    }
    m_hdrsForEachFolder.AppendElement(msgHdrsForOneFolder);
  }
  return rv;
}

nsresult
nsMsgSearchDBView::ApplyCommandToIndicesWithFolder(nsMsgViewCommandTypeValue command, nsMsgViewIndex* indices,
                    int32_t numIndices, nsIMsgFolder *destFolder)
{
  mCommand = command;
  mDestFolder = destFolder;
  return nsMsgDBView::ApplyCommandToIndicesWithFolder(command, indices, numIndices, destFolder);
}

// nsIMsgCopyServiceListener methods

NS_IMETHODIMP
nsMsgSearchDBView::OnStartCopy()
{
  return NS_OK;
}

NS_IMETHODIMP
nsMsgSearchDBView::OnProgress(uint32_t aProgress, uint32_t aProgressMax)
{
  return NS_OK;
}

// believe it or not, these next two are msgcopyservice listener methods!
NS_IMETHODIMP
nsMsgSearchDBView::SetMessageKey(uint32_t aMessageKey)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMsgSearchDBView::GetMessageId(nsACString& messageId)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMsgSearchDBView::OnStopCopy(nsresult aStatus)
{
  if (NS_SUCCEEDED(aStatus))
  {
    mCurIndex++;
    if ((int32_t) mCurIndex < m_uniqueFoldersSelected.Count())
    {
      nsCOMPtr<nsIMsgWindow> msgWindow(do_QueryReferent(mMsgWindowWeak));
      ProcessRequestsInOneFolder(msgWindow);
    }
  }
  return NS_OK;
}

// end nsIMsgCopyServiceListener methods

nsresult nsMsgSearchDBView::ProcessRequestsInOneFolder(nsIMsgWindow *window)
{
    nsresult rv = NS_OK;

    // Folder operations like copy/move are not implemented for .eml files.
    if (m_uniqueFoldersSelected.Count() == 0)
      return NS_ERROR_NOT_IMPLEMENTED;

    nsIMsgFolder *curFolder = m_uniqueFoldersSelected[mCurIndex];
    NS_ASSERTION(curFolder, "curFolder is null");
    nsCOMPtr<nsIMutableArray> messageArray = m_hdrsForEachFolder[mCurIndex];
    NS_ASSERTION(messageArray, "messageArray is null");

    // called for delete with trash, copy and move
    if (mCommand == nsMsgViewCommandType::deleteMsg)
        curFolder->DeleteMessages(messageArray, window, false /* delete storage */, false /* is move*/, this, true /*allowUndo*/);
    else 
    {
      NS_ASSERTION(!(curFolder == mDestFolder), "The source folder and the destination folder are the same");
      if (NS_SUCCEEDED(rv) && curFolder != mDestFolder)
      {
         nsCOMPtr<nsIMsgCopyService> copyService = do_GetService(NS_MSGCOPYSERVICE_CONTRACTID, &rv);
         if (NS_SUCCEEDED(rv))
         {
           if (mCommand == nsMsgViewCommandType::moveMessages)
             copyService->CopyMessages(curFolder, messageArray, mDestFolder, true /* isMove */, this, window, true /*allowUndo*/);
           else if (mCommand == nsMsgViewCommandType::copyMessages)
             copyService->CopyMessages(curFolder, messageArray, mDestFolder, false /* isMove */, this, window, true /*allowUndo*/);
         }
      }
    }
    return rv;
}

nsresult nsMsgSearchDBView::ProcessRequestsInAllFolders(nsIMsgWindow *window)
{
  uint32_t numFolders = m_uniqueFoldersSelected.Count();
  for (uint32_t folderIndex = 0; folderIndex < numFolders; folderIndex++)
  {
    nsIMsgFolder *curFolder = m_uniqueFoldersSelected[folderIndex];
    NS_ASSERTION (curFolder, "curFolder is null");

    nsCOMPtr<nsIMutableArray> messageArray = m_hdrsForEachFolder[folderIndex];
    NS_ASSERTION(messageArray, "messageArray is null");

    curFolder->DeleteMessages(messageArray, window, true /* delete storage */, false /* is move*/, nullptr/*copyServListener*/, false /*allowUndo*/ );
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgSearchDBView::SetCurCustomColumn(const nsAString& aColID)
{
  m_curCustomColumn = aColID;
  return NS_OK;
}

NS_IMETHODIMP nsMsgSearchDBView::GetCurCustomColumn(nsAString &result)
{
  result = m_curCustomColumn;
  return NS_OK;
}

NS_IMETHODIMP nsMsgSearchDBView::Sort(nsMsgViewSortTypeValue sortType, nsMsgViewSortOrderValue sortOrder)
{
    int32_t rowCountBeforeSort = GetSize();

    if (!rowCountBeforeSort)
        return NS_OK;

    if (m_viewFlags & (nsMsgViewFlagsType::kThreadedDisplay |
                      nsMsgViewFlagsType::kGroupBySort))
    {
      // ### This forgets which threads were expanded, and is sub-optimal
      // since it rebuilds the thread objects.  
      m_sortType = sortType;
      m_sortOrder = sortOrder;
      return RebuildView(m_viewFlags);
    }

    nsMsgKey preservedKey;
    nsAutoTArray<nsMsgKey, 1> preservedSelection;
    SaveAndClearSelection(&preservedKey, preservedSelection);

    nsresult rv = nsMsgDBView::Sort(sortType,sortOrder);
    // the sort may have changed the number of rows
    // before we restore the selection, tell the tree
    // do this before we call restore selection
    // this is safe when there is no selection. 
    rv = AdjustRowCount(rowCountBeforeSort, GetSize());

    RestoreSelection(preservedKey, preservedSelection);
    if (mTree) mTree->Invalidate();

    NS_ENSURE_SUCCESS(rv,rv);
    return rv;
}

// if nothing selected, return an NS_ERROR
NS_IMETHODIMP
nsMsgSearchDBView::GetHdrForFirstSelectedMessage(nsIMsgDBHdr **hdr)
{
  NS_ENSURE_ARG_POINTER(hdr);
  int32_t index;

  if (!mTreeSelection)
  {
    // We're in standalone mode, so use the message view index to get the header
    // We can't use the key here because we don't have an m_db
    index = m_currentlyDisplayedViewIndex;
  }
  else
  {
    nsresult rv = mTreeSelection->GetCurrentIndex(&index);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  return GetMsgHdrForViewIndex(index, hdr);
}

NS_IMETHODIMP
nsMsgSearchDBView::OpenWithHdrs(nsISimpleEnumerator *aHeaders,
                                nsMsgViewSortTypeValue aSortType,
                                nsMsgViewSortOrderValue aSortOrder,
                                nsMsgViewFlagsTypeValue aViewFlags,
                                int32_t *aCount)
{
  if (aViewFlags & nsMsgViewFlagsType::kGroupBySort)
    return nsMsgGroupView::OpenWithHdrs(aHeaders, aSortType, aSortOrder, 
                                        aViewFlags, aCount);

  m_sortType = aSortType;
  m_sortOrder = aSortOrder;
  m_viewFlags = aViewFlags;
  SaveSortInfo(m_sortType, m_sortOrder);

  bool hasMore;
  nsCOMPtr<nsISupports> supports;
  nsCOMPtr<nsIMsgDBHdr> msgHdr;
  nsCOMPtr<nsIMsgFolder> folder;
  nsresult rv = NS_OK;
  while (NS_SUCCEEDED(rv) && NS_SUCCEEDED(rv = aHeaders->HasMoreElements(&hasMore)) && hasMore)
  {
    rv = aHeaders->GetNext(getter_AddRefs(supports));
    if (NS_SUCCEEDED(rv) && supports)
    {
      msgHdr = do_QueryInterface(supports);
      msgHdr->GetFolder(getter_AddRefs(folder));
      AddHdrFromFolder(msgHdr, folder); 
    }
  }
  *aCount = m_keys.Length();
  return rv;
}

nsresult
nsMsgSearchDBView::GetFolderFromMsgURI(const char *aMsgURI, nsIMsgFolder **aFolder)
{
  nsCOMPtr <nsIMsgMessageService> msgMessageService;
  nsresult rv = GetMessageServiceFromURI(nsDependentCString(aMsgURI), getter_AddRefs(msgMessageService));
  NS_ENSURE_SUCCESS(rv,rv);
  
  nsCOMPtr <nsIMsgDBHdr> msgHdr;
  rv = msgMessageService->MessageURIToMsgHdr(aMsgURI, getter_AddRefs(msgHdr));
  NS_ENSURE_SUCCESS(rv,rv);
  
  return msgHdr->GetFolder(aFolder);
}

nsMsgViewIndex nsMsgSearchDBView::FindHdr(nsIMsgDBHdr *msgHdr, nsMsgViewIndex startIndex,
                                          bool allowDummy)
{
  nsCOMPtr<nsIMsgDBHdr> curHdr;
  uint32_t index;
  // it would be nice to take advantage of sorted views when possible.
  for (index = startIndex; index < GetSize(); index++)
  {
    GetMsgHdrForViewIndex(index, getter_AddRefs(curHdr));
    if (curHdr == msgHdr &&
        (allowDummy ||
         !(m_flags[index] & MSG_VIEW_FLAG_DUMMY) ||
         (m_flags[index] & nsMsgMessageFlags::Elided)))
      break;
  }
  return index < GetSize() ? index : nsMsgViewIndex_None;
}

// This method looks for the XF thread that corresponds to this message hdr,
// first by looking up the message id, then references, and finally, if subject
// threading is turned on, the subject.
nsresult nsMsgSearchDBView::GetXFThreadFromMsgHdr(nsIMsgDBHdr *msgHdr, 
                                                  nsIMsgThread **pThread,
                                                  bool *foundByMessageId)
{
  NS_ENSURE_ARG_POINTER(pThread);

  nsAutoCString messageId;
  msgHdr->GetMessageId(getter_Copies(messageId));
  *pThread = nullptr;
  m_threadsTable.Get(messageId, pThread);
  // The caller may want to know if we found the thread by the msgHdr's
  // messageId
  if (foundByMessageId)
    *foundByMessageId = *pThread != nullptr;
  if (!*pThread)
  {
    uint16_t numReferences = 0;
    msgHdr->GetNumReferences(&numReferences);
    for (int32_t i = numReferences - 1; i >= 0  && !*pThread; i--)
    {
      nsAutoCString reference;
      
      msgHdr->GetStringReference(i, reference);
      if (reference.IsEmpty())
        break;

      m_threadsTable.Get(reference, pThread);
    }
  }
  // if we're threading by subject, and we couldn't find the thread by ref,
  // just treat subject as an other ref.
  if (!*pThread && !gReferenceOnlyThreading)
  {
    nsCString subject;
    msgHdr->GetSubject(getter_Copies(subject));
    // this is the raw rfc822 subject header, so this is OK
    m_threadsTable.Get(subject, pThread);
  }
  return (*pThread) ? NS_OK : NS_ERROR_FAILURE;
}

bool nsMsgSearchDBView::GetMsgHdrFromHash(nsCString &reference, nsIMsgDBHdr **hdr)
{
  return m_hdrsTable.Get(reference, hdr);
}

bool nsMsgSearchDBView::GetThreadFromHash(nsCString &reference,
                                              nsIMsgThread **thread)
{
  return m_threadsTable.Get(reference, thread);
}

nsresult nsMsgSearchDBView::AddRefToHash(nsCString &reference, 
                                         nsIMsgThread *thread)
{
  // Check if this reference is already is associated with a thread;
  // If so, don't overwrite that association.
  nsCOMPtr<nsIMsgThread> oldThread;
  m_threadsTable.Get(reference, getter_AddRefs(oldThread));
  if (oldThread)
    return NS_OK;

  m_threadsTable.Put(reference, thread);
  return NS_OK;
}

nsresult nsMsgSearchDBView::AddMsgToHashTables(nsIMsgDBHdr *msgHdr,
                                               nsIMsgThread *thread)
{
  NS_ENSURE_ARG_POINTER(msgHdr);

  uint16_t numReferences = 0;
  nsresult rv;

  msgHdr->GetNumReferences(&numReferences);
  for (int32_t i = 0; i < numReferences; i++)
  {
    nsAutoCString reference;

    msgHdr->GetStringReference(i, reference);
    if (reference.IsEmpty())
      break;

    rv = AddRefToHash(reference, thread);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  nsCString messageId;
  msgHdr->GetMessageId(getter_Copies(messageId));
  m_hdrsTable.Put(messageId, msgHdr);
  if (!gReferenceOnlyThreading)
  {
    nsCString subject;
    msgHdr->GetSubject(getter_Copies(subject));
    // if we're threading by subject, just treat subject as an other ref.
    AddRefToHash(subject, thread);
  }
  return AddRefToHash(messageId, thread);
}

nsresult nsMsgSearchDBView::RemoveRefFromHash(nsCString &reference)
{
  m_threadsTable.Remove(reference);
  return NS_OK;
}

nsresult nsMsgSearchDBView::RemoveMsgFromHashTables(nsIMsgDBHdr *msgHdr)
{
  NS_ENSURE_ARG_POINTER(msgHdr);

  uint16_t numReferences = 0;
  nsresult rv = NS_OK;

  msgHdr->GetNumReferences(&numReferences);

  for (int32_t i = 0; i < numReferences; i++)
  {
    nsAutoCString reference;
    msgHdr->GetStringReference(i, reference);
    if (reference.IsEmpty())
      break;

    rv = RemoveRefFromHash(reference);
    if (NS_FAILED(rv))
      break;
  }
  nsCString messageId;
  msgHdr->GetMessageId(getter_Copies(messageId));
  m_hdrsTable.Remove(messageId);
  RemoveRefFromHash(messageId);
  if (!gReferenceOnlyThreading)
  {
    nsCString subject;
    msgHdr->GetSubject(getter_Copies(subject));
    // if we're threading by subject, just treat subject as an other ref.
    RemoveRefFromHash(subject);
  }
  return rv;
}

nsMsgGroupThread *nsMsgSearchDBView::CreateGroupThread(nsIMsgDatabase * /* db */)
{
  return new nsMsgXFGroupThread();
}

NS_IMETHODIMP nsMsgSearchDBView::GetThreadContainingMsgHdr(nsIMsgDBHdr *msgHdr, 
                                                      nsIMsgThread **pThread)
{
  if (m_viewFlags & nsMsgViewFlagsType::kGroupBySort)
    return nsMsgGroupView::GetThreadContainingMsgHdr(msgHdr, pThread);
  else if (m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay)
    return GetXFThreadFromMsgHdr(msgHdr, pThread);

  // if not threaded, use the real thread. 
  nsCOMPtr<nsIMsgDatabase> msgDB;
  nsresult rv = GetDBForHeader(msgHdr, getter_AddRefs(msgDB));
  NS_ENSURE_SUCCESS(rv, rv);
  return msgDB->GetThreadContainingMsgHdr(msgHdr, pThread);
}

nsresult
nsMsgSearchDBView::ListIdsInThread(nsIMsgThread *threadHdr,
                                   nsMsgViewIndex startOfThreadViewIndex,
                                   uint32_t *pNumListed)
{
  NS_ENSURE_ARG_POINTER(threadHdr);
  NS_ENSURE_ARG_POINTER(pNumListed);

  // these children ids should be in thread order.
  uint32_t i;
  nsMsgViewIndex viewIndex = startOfThreadViewIndex + 1;
  *pNumListed = 0;

  uint32_t numChildren;
  threadHdr->GetNumChildren(&numChildren);
  NS_ASSERTION(numChildren, "Empty thread in view/db");
  if (!numChildren)
    return NS_OK;

  numChildren--; // account for the existing thread root
  if (!InsertEmptyRows(viewIndex, numChildren))
    return NS_ERROR_OUT_OF_MEMORY;

  bool threadedView = m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay &&
    !(m_viewFlags & nsMsgViewFlagsType::kGroupBySort);
  nsMsgXFViewThread *viewThread;
  if (threadedView)
    viewThread = static_cast<nsMsgXFViewThread*>(threadHdr);

  for (i = 1; i <= numChildren; i++)
  {
    nsCOMPtr<nsIMsgDBHdr> msgHdr;
    threadHdr->GetChildHdrAt(i, getter_AddRefs(msgHdr));

    if (msgHdr)
    {
      nsMsgKey msgKey;
      uint32_t msgFlags;
      msgHdr->GetMessageKey(&msgKey);
      msgHdr->GetFlags(&msgFlags);
      uint8_t level = (threadedView) ? viewThread->ChildLevelAt(i) : 1;
      SetMsgHdrAt(msgHdr, viewIndex, msgKey, msgFlags & ~MSG_VIEW_FLAGS, 
                  level);
      (*pNumListed)++;
      viewIndex++;
    }
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgSearchDBView::GetNumMsgsInView(int32_t *aNumMsgs)
{
  NS_ENSURE_ARG_POINTER(aNumMsgs);
  *aNumMsgs = m_totalMessagesInView;
  return NS_OK;
}

