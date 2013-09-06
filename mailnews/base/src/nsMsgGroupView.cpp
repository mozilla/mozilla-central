/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "msgCore.h"
#include "nsMsgUtils.h"
#include "nsMsgGroupView.h"
#include "nsIMsgHdr.h"
#include "nsIMsgThread.h"
#include "nsIDBFolderInfo.h"
#include "nsIMsgSearchSession.h"
#include "nsMsgGroupThread.h"
#include "nsITreeColumns.h"
#include "nsMsgMessageFlags.h"
#include <plhash.h>

#define MSGHDR_CACHE_LOOK_AHEAD_SIZE  25    // Allocate this more to avoid reallocation on new mail.
#define MSGHDR_CACHE_MAX_SIZE         8192  // Max msghdr cache entries.
#define MSGHDR_CACHE_DEFAULT_SIZE     100

nsMsgGroupView::nsMsgGroupView()
{
  m_dayChanged = false;
  m_lastCurExplodedTime.tm_mday = 0;
}

nsMsgGroupView::~nsMsgGroupView()
{
}

NS_IMETHODIMP nsMsgGroupView::Open(nsIMsgFolder *aFolder, nsMsgViewSortTypeValue aSortType, nsMsgViewSortOrderValue aSortOrder, nsMsgViewFlagsTypeValue aViewFlags, int32_t *aCount)
{
  nsresult rv = nsMsgDBView::Open(aFolder, aSortType, aSortOrder, aViewFlags, aCount);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr <nsIDBFolderInfo> dbFolderInfo;
  PersistFolderInfo(getter_AddRefs(dbFolderInfo));

  nsCOMPtr <nsISimpleEnumerator> headers;
  rv = m_db->EnumerateMessages(getter_AddRefs(headers));
  NS_ENSURE_SUCCESS(rv, rv);

  return OpenWithHdrs(headers, aSortType, aSortOrder, aViewFlags, aCount);
}

void nsMsgGroupView::InternalClose()
{
  m_groupsTable.Clear();
  // nothing to do if we're not grouped.
  if (!(m_viewFlags & nsMsgViewFlagsType::kGroupBySort))
    return;

  bool rcvDate = false;

  if (m_sortType == nsMsgViewSortType::byReceived)
    rcvDate = true;
  if (m_db &&
      ((m_sortType == nsMsgViewSortType::byDate) ||
       (m_sortType == nsMsgViewSortType::byReceived)))
  {
    nsCOMPtr <nsIDBFolderInfo> dbFolderInfo;
    m_db->GetDBFolderInfo(getter_AddRefs(dbFolderInfo));
    if (dbFolderInfo)
    {
      uint32_t expandFlags = 0;
      uint32_t num = GetSize();

      for (uint32_t i = 0; i < num; i++)
      {
        if (m_flags[i] & MSG_VIEW_FLAG_ISTHREAD && ! (m_flags[i] & nsMsgMessageFlags::Elided))
        {
          nsCOMPtr <nsIMsgDBHdr> msgHdr;
          GetMsgHdrForViewIndex(i, getter_AddRefs(msgHdr));
          if (msgHdr)
          {
            uint32_t ageBucket;
            nsresult rv = GetAgeBucketValue(msgHdr, &ageBucket, rcvDate);
            if (NS_SUCCEEDED(rv))
              expandFlags |=  1 << ageBucket;
          }
        }
      }
      dbFolderInfo->SetUint32Property("dateGroupFlags", expandFlags);
    }
  }
}

NS_IMETHODIMP nsMsgGroupView::Close()
{
  InternalClose();
  return nsMsgDBView::Close();
}

// Set rcvDate to true to get the Received: date instead of the Date: date.
nsresult nsMsgGroupView::GetAgeBucketValue(nsIMsgDBHdr *aMsgHdr, uint32_t * aAgeBucket, bool rcvDate)
{
  NS_ENSURE_ARG_POINTER(aMsgHdr);
  NS_ENSURE_ARG_POINTER(aAgeBucket);

  PRTime dateOfMsg;
  nsresult rv;
  if (!rcvDate)
    rv = aMsgHdr->GetDate(&dateOfMsg);
  else
  {
    uint32_t rcvDateSecs;
    rv = aMsgHdr->GetUint32Property("dateReceived", &rcvDateSecs);
    Seconds2PRTime(rcvDateSecs, &dateOfMsg);
  }
  NS_ENSURE_SUCCESS(rv, rv);

  PRTime currentTime = PR_Now();
  PRExplodedTime currentExplodedTime;
  PR_ExplodeTime(currentTime, PR_LocalTimeParameters, &currentExplodedTime);
  PRExplodedTime explodedMsgTime;
  PR_ExplodeTime(dateOfMsg, PR_LocalTimeParameters, &explodedMsgTime);

  if (m_lastCurExplodedTime.tm_mday &&
     m_lastCurExplodedTime.tm_mday != currentExplodedTime.tm_mday)
    m_dayChanged = true; // this will cause us to rebuild the view.

  m_lastCurExplodedTime = currentExplodedTime;
  if (currentExplodedTime.tm_year == explodedMsgTime.tm_year &&
      currentExplodedTime.tm_month == explodedMsgTime.tm_month &&
      currentExplodedTime.tm_mday == explodedMsgTime.tm_mday)
  {
    // same day...
    *aAgeBucket = 1;
  }
  // figure out how many days ago this msg arrived
  else if (currentTime > dateOfMsg)
  {
    // setting the time variables to local time
    int64_t GMTLocalTimeShift = currentExplodedTime.tm_params.tp_gmt_offset +
      currentExplodedTime.tm_params.tp_dst_offset;
    GMTLocalTimeShift *= PR_USEC_PER_SEC;
    currentTime += GMTLocalTimeShift;
    dateOfMsg += GMTLocalTimeShift;

    // the most recent midnight, counting from current time
    int64_t mostRecentMidnight = currentTime - currentTime % PR_USEC_PER_DAY;
    int64_t yesterday = mostRecentMidnight - PR_USEC_PER_DAY;
    // most recent midnight minus 6 days
    int64_t mostRecentWeek = mostRecentMidnight - (PR_USEC_PER_DAY * 6);

    // was the message sent yesterday?
    if (dateOfMsg >= yesterday) // yes ....
      *aAgeBucket = 2;
    else if (dateOfMsg >= mostRecentWeek)
      *aAgeBucket = 3;
    else
    {
      int64_t lastTwoWeeks = mostRecentMidnight - PR_USEC_PER_DAY * 13;
      *aAgeBucket = (dateOfMsg >= lastTwoWeeks) ? 4 : 5;
    }
  }
  return NS_OK;
}

nsresult nsMsgGroupView::HashHdr(nsIMsgDBHdr *msgHdr, nsString& aHashKey)
{
  nsCString cStringKey;
  aHashKey.Truncate();
  nsresult rv = NS_OK;
  bool rcvDate = false;

  switch (m_sortType)
  {
    case nsMsgViewSortType::bySubject:
      (void) msgHdr->GetSubject(getter_Copies(cStringKey));
      CopyASCIItoUTF16(cStringKey, aHashKey);
      break;
    case nsMsgViewSortType::byAuthor:
      rv = nsMsgDBView::FetchAuthor(msgHdr, aHashKey);
      break;
    case nsMsgViewSortType::byRecipient:
      (void) msgHdr->GetRecipients(getter_Copies(cStringKey));
      CopyASCIItoUTF16(cStringKey, aHashKey);
      break;
    case nsMsgViewSortType::byAccount:
    case nsMsgViewSortType::byTags:
      {
        nsCOMPtr <nsIMsgDatabase> dbToUse = m_db;

        if (!dbToUse) // probably search view
          GetDBForViewIndex(0, getter_AddRefs(dbToUse));

        rv = (m_sortType == nsMsgViewSortType::byAccount)
          ? FetchAccount(msgHdr, aHashKey)
          : FetchTags(msgHdr, aHashKey);
      }
      break;
    case nsMsgViewSortType::byAttachments:
      {
        uint32_t flags;
        msgHdr->GetFlags(&flags);
        aHashKey.Assign(flags & nsMsgMessageFlags::Attachment ? '1' : '0');
        break;
      }
    case nsMsgViewSortType::byFlagged:
      {
        uint32_t flags;
        msgHdr->GetFlags(&flags);
        aHashKey.Assign(flags & nsMsgMessageFlags::Marked ? '1' : '0');
        break;
      }
    case nsMsgViewSortType::byPriority:
      {
        nsMsgPriorityValue priority;
        msgHdr->GetPriority(&priority);
        aHashKey.AppendInt(priority);
      }
      break;
    case nsMsgViewSortType::byStatus:
      {
        uint32_t status = 0;
        GetStatusSortValue(msgHdr, &status);
        aHashKey.AppendInt(status);
      }
      break;
    case nsMsgViewSortType::byReceived:
      rcvDate = true;
    case nsMsgViewSortType::byDate:
    {
      uint32_t ageBucket;
      rv = GetAgeBucketValue(msgHdr, &ageBucket, rcvDate);
      if (NS_SUCCEEDED(rv))
        aHashKey.AppendInt(ageBucket);
      break;
    }
    case nsMsgViewSortType::byCustom:
    {
      nsIMsgCustomColumnHandler* colHandler = GetCurColumnHandlerFromDBInfo();
      if (colHandler)
      {
        rv = colHandler->GetSortStringForRow(msgHdr, aHashKey);
        break;
      }
    }
    default:
      NS_ASSERTION(false, "no hash key for this type");
      rv = NS_ERROR_FAILURE;
  }
  return rv;
}

nsMsgGroupThread *nsMsgGroupView::CreateGroupThread(nsIMsgDatabase *db)
{
  return new nsMsgGroupThread(db);
}

nsMsgGroupThread *nsMsgGroupView::AddHdrToThread(nsIMsgDBHdr *msgHdr, bool *pNewThread)
{
  nsMsgKey msgKey;
  uint32_t msgFlags;
  msgHdr->GetMessageKey(&msgKey);
  msgHdr->GetFlags(&msgFlags);
  nsString hashKey;
  nsresult rv = HashHdr(msgHdr, hashKey);
  if (NS_FAILED(rv))
    return nullptr;

//  if (m_sortType == nsMsgViewSortType::byDate)
//    msgKey = ((nsPRUint32Key *) hashKey)->GetValue();
  nsCOMPtr<nsIMsgThread> msgThread;
  m_groupsTable.Get(hashKey, getter_AddRefs(msgThread));
  bool newThread = !msgThread;
  *pNewThread = newThread;
  nsMsgViewIndex viewIndexOfThread; // index of first message in thread in view
  nsMsgViewIndex threadInsertIndex; // index of newly added header in thread

  nsMsgGroupThread *foundThread = static_cast<nsMsgGroupThread *>(msgThread.get());
  if (foundThread) 
  {
    // find the view index of the root node of the thread in the view
    viewIndexOfThread = GetIndexOfFirstDisplayedKeyInThread(foundThread,
                                                            true);
    if (viewIndexOfThread == nsMsgViewIndex_None)
    {
      // Something is wrong with the group table. Remove the old group and
      // insert a new one.
      m_groupsTable.Remove(hashKey);
      foundThread = nullptr;
      *pNewThread = newThread = true;
    }
  }
  // If the thread does not already exist, create one
  if (!foundThread)
  {
    foundThread = CreateGroupThread(m_db);
    msgThread = do_QueryInterface(foundThread);
    m_groupsTable.Put(hashKey, msgThread);
    if (GroupViewUsesDummyRow())
    {
      foundThread->m_dummy = true;
      msgFlags |=  MSG_VIEW_FLAG_DUMMY | MSG_VIEW_FLAG_HASCHILDREN;
    }

    viewIndexOfThread = GetInsertIndex(msgHdr);
    if (viewIndexOfThread == nsMsgViewIndex_None)
      viewIndexOfThread = m_keys.Length();

    // add the thread root node to the view
    InsertMsgHdrAt(viewIndexOfThread, msgHdr, msgKey,
                   msgFlags | MSG_VIEW_FLAG_ISTHREAD | nsMsgMessageFlags::Elided, 0);

    // For dummy rows, Have the header serve as the dummy node (it will be added
    //  again for its actual content later.)
    if (GroupViewUsesDummyRow())
      foundThread->InsertMsgHdrAt(0, msgHdr);

    // Calculate the (integer thread key); this really only needs to be done for
    //  the byDate case where the expanded state of the groups can be easily
    //  persisted and restored because of the bounded, consecutive value space
    //  occupied.  We calculate an integer value in all cases mainly because
    //  it's the sanest choice available...
    // (The thread key needs to be an integer, so parse hash keys that are
    //  stringified integers to real integers, and hash actual strings into
    //  integers.)
    if ((m_sortType == nsMsgViewSortType::byAttachments) ||
        (m_sortType == nsMsgViewSortType::byFlagged) ||
        (m_sortType == nsMsgViewSortType::byPriority) ||
        (m_sortType == nsMsgViewSortType::byStatus) ||
        (m_sortType == nsMsgViewSortType::byReceived) ||
        (m_sortType == nsMsgViewSortType::byDate))
      foundThread->m_threadKey =
        atoi(NS_LossyConvertUTF16toASCII(hashKey).get());
    else
      foundThread->m_threadKey = (nsMsgKey)
        PL_HashString(NS_LossyConvertUTF16toASCII(hashKey).get());
  }
  // Add the message to the thread as an actual content-bearing header.
  // (If we use dummy rows, it was already added to the thread during creation.)
  threadInsertIndex = foundThread->AddChildFromGroupView(msgHdr, this);
  // check if new hdr became thread root
  if (!newThread && threadInsertIndex == 0)
  {
    // update the root node's header (in the view) to be the same as the root
    //  node in the thread.
    SetMsgHdrAt(msgHdr, viewIndexOfThread, msgKey,
                (msgFlags & ~(nsMsgMessageFlags::Elided)) |
                  // maintain elided flag and dummy flag
                  (m_flags[viewIndexOfThread] & (nsMsgMessageFlags::Elided
                                                 | MSG_VIEW_FLAG_DUMMY))
                  // ensure thread and has-children flags are set
                  | MSG_VIEW_FLAG_ISTHREAD | MSG_VIEW_FLAG_HASCHILDREN, 0);
    // update the content-bearing copy in the thread to match.  (the root and
    //  first nodes in the thread should always be the same header.)
    // note: the guy who used to be the root will still exist.  If our list of
    //  nodes was [A A], a new node B is introduced which sorts to be the first
    //  node, giving us [B A A], our copy makes that [B B A], and things are
    //  right in the world (since we want the first two headers to be the same
    //  since one is our dummy and one is real.)
    if (GroupViewUsesDummyRow())
      foundThread->SetMsgHdrAt(1, msgHdr); // replace the old duplicate dummy header.
    // we do not update the content-bearing copy in the view to match; we leave
    //  that up to OnNewHeader, which is the piece of code who gets to care
    //  about whether the thread's children are shown or not (elided)
  }

  return foundThread;
}

NS_IMETHODIMP nsMsgGroupView::OpenWithHdrs(nsISimpleEnumerator *aHeaders, nsMsgViewSortTypeValue aSortType,
                                        nsMsgViewSortOrderValue aSortOrder, nsMsgViewFlagsTypeValue aViewFlags,
                                        int32_t *aCount)
{
  nsresult rv = NS_OK;

  m_groupsTable.Clear();
  if (aSortType == nsMsgViewSortType::byThread || aSortType == nsMsgViewSortType::byId
    || aSortType == nsMsgViewSortType::byNone || aSortType == nsMsgViewSortType::bySize)
    return NS_ERROR_INVALID_ARG;

  m_sortType = aSortType;
  m_sortOrder = aSortOrder;
  m_viewFlags = aViewFlags | nsMsgViewFlagsType::kThreadedDisplay | nsMsgViewFlagsType::kGroupBySort;
  SaveSortInfo(m_sortType, m_sortOrder);

  bool hasMore;
  nsCOMPtr <nsISupports> supports;
  nsCOMPtr <nsIMsgDBHdr> msgHdr;
  while (NS_SUCCEEDED(rv) && NS_SUCCEEDED(rv = aHeaders->HasMoreElements(&hasMore)) && hasMore)
  {
    rv = aHeaders->GetNext(getter_AddRefs(supports));
    if (NS_SUCCEEDED(rv) && supports)
    {
      bool notUsed;
      msgHdr = do_QueryInterface(supports);
      AddHdrToThread(msgHdr, &notUsed);
    }
  }
  uint32_t expandFlags = 0;
  bool expandAll = m_viewFlags & nsMsgViewFlagsType::kExpandAll;
  uint32_t viewFlag = (m_sortType == nsMsgViewSortType::byDate) ? MSG_VIEW_FLAG_DUMMY : 0;
  if (viewFlag && m_db)
  {
    nsCOMPtr <nsIDBFolderInfo> dbFolderInfo;
    nsresult rv = m_db->GetDBFolderInfo(getter_AddRefs(dbFolderInfo));
    NS_ENSURE_SUCCESS(rv, rv);
    if (dbFolderInfo)
      dbFolderInfo->GetUint32Property("dateGroupFlags",  0, &expandFlags);
  }
  // go through the view updating the flags for threads with more than one message...
  // and if grouped by date, expanding threads that were expanded before.
  for (uint32_t viewIndex = 0; viewIndex < m_keys.Length(); viewIndex++)
  {
    nsCOMPtr <nsIMsgThread> thread;
    GetThreadContainingIndex(viewIndex, getter_AddRefs(thread));
    if (thread)
    {
      uint32_t numChildren;
      thread->GetNumChildren(&numChildren);
      if (numChildren > 1 || viewFlag)
        OrExtraFlag(viewIndex, viewFlag | MSG_VIEW_FLAG_HASCHILDREN);
      if (expandAll || expandFlags)
      {
        nsMsgGroupThread *groupThread = static_cast<nsMsgGroupThread *>((nsIMsgThread *) thread);
        if (expandAll || expandFlags & (1 << groupThread->m_threadKey))
        {
          uint32_t numExpanded;
          ExpandByIndex(viewIndex, &numExpanded);
          viewIndex += numExpanded;
        }
      }
    }
  }
  *aCount = m_keys.Length();
  return rv;
}

// we wouldn't need this if we never instantiated this directly,
// but instead used nsMsgThreadedDBView with the grouping flag set.
// Or, we could get rid of the nsMsgThreadedDBView impl of this method.
NS_IMETHODIMP nsMsgGroupView::GetViewType(nsMsgViewTypeValue *aViewType)
{
    NS_ENSURE_ARG_POINTER(aViewType);
    *aViewType = nsMsgViewType::eShowAllThreads; 
    return NS_OK;
}

PLDHashOperator
nsMsgGroupView::GroupTableCloner(const nsAString &aKey, nsIMsgThread* aGroupThread, void* aArg)
{
  nsMsgGroupView* view = static_cast<nsMsgGroupView*>(aArg);
  view->m_groupsTable.Put(aKey, aGroupThread);
  return PL_DHASH_NEXT;
}


NS_IMETHODIMP
nsMsgGroupView::CopyDBView(nsMsgDBView *aNewMsgDBView, nsIMessenger *aMessengerInstance, 
                                       nsIMsgWindow *aMsgWindow, nsIMsgDBViewCommandUpdater *aCmdUpdater)
{
  nsMsgDBView::CopyDBView(aNewMsgDBView, aMessengerInstance, aMsgWindow, aCmdUpdater);
  nsMsgGroupView* newMsgDBView = (nsMsgGroupView *) aNewMsgDBView;

  // If grouped, we need to clone the group thread hash table.
  if (m_viewFlags & nsMsgViewFlagsType::kGroupBySort)
    m_groupsTable.EnumerateRead(GroupTableCloner, newMsgDBView);
  return NS_OK;
}

// E.g., if the day has changed, we need to close and re-open the view.
// Or, if we're switching between grouping and threading in a cross-folder
// saved search. In that case, we needed to build an enumerator based on the
// old view type, and internally close the view based on its old type, but
// rebuild the new view based on the new view type. So we pass the new
// view flags to OpenWithHdrs.
nsresult nsMsgGroupView::RebuildView(nsMsgViewFlagsTypeValue newFlags)
{
  nsCOMPtr <nsISimpleEnumerator> headers;
  if (NS_SUCCEEDED(GetMessageEnumerator(getter_AddRefs(headers))))
  {
    int32_t count;
    m_dayChanged = false;
    nsAutoTArray<nsMsgKey, 1> preservedSelection;
    nsMsgKey curSelectedKey;
    SaveAndClearSelection(&curSelectedKey, preservedSelection);
    InternalClose();
    int32_t oldSize = GetSize();
    // this is important, because the tree will ask us for our
    // row count, which get determine from the number of keys.
    m_keys.Clear();
    // be consistent
    m_flags.Clear();
    m_levels.Clear();

    // this needs to happen after we remove all the keys, since RowCountChanged() will call our GetRowCount()
    if (mTree)
      mTree->RowCountChanged(0, -oldSize);
    SetSuppressChangeNotifications(true);
    nsresult rv = OpenWithHdrs(headers, m_sortType, m_sortOrder, newFlags, &count);
    SetSuppressChangeNotifications(false);
    if (mTree)
      mTree->RowCountChanged(0, GetSize());

    NS_ENSURE_SUCCESS(rv,rv);

    // now, restore our desired selection
    nsAutoTArray<nsMsgKey, 1> keyArray;
    keyArray.AppendElement(curSelectedKey);

    return RestoreSelection(curSelectedKey, keyArray);
  }
  return NS_OK;
}

nsresult nsMsgGroupView::OnNewHeader(nsIMsgDBHdr *newHdr, nsMsgKey aParentKey, bool ensureListed)
{
  if (!(m_viewFlags & nsMsgViewFlagsType::kGroupBySort))
    return nsMsgDBView::OnNewHeader(newHdr, aParentKey, ensureListed);

  // check if we're adding a header, and the current day has changed. If it has, we're just going to
  // close and re-open the view so things will be correctly categorized.
  if (m_dayChanged)
    return RebuildView(m_viewFlags);

  bool newThread;
  nsMsgGroupThread *thread = AddHdrToThread(newHdr, &newThread);
  if (thread)
  {
    // find the view index of (the root node of) the thread
    nsMsgViewIndex threadIndex = ThreadIndexOfMsgHdr(newHdr);
    // may need to fix thread counts
    if (threadIndex != nsMsgViewIndex_None)
    {
      if (newThread)
      {
        // AddHdrToThread creates the header elided, so we need to un-elide it
        //  if we want it expanded.
        if(m_viewFlags & nsMsgViewFlagsType::kExpandAll)
          m_flags[threadIndex] &= ~nsMsgMessageFlags::Elided;
      }
      else
      {
        m_flags[threadIndex] |= MSG_VIEW_FLAG_HASCHILDREN
                                | MSG_VIEW_FLAG_ISTHREAD;
      }

      int32_t numRowsToInvalidate = 1;
      // if the thread is expanded (not elided), we should add the header to
      //  the view.
      if (! (m_flags[threadIndex] & nsMsgMessageFlags::Elided))
      {
        uint32_t msgIndexInThread = thread->FindMsgHdr(newHdr);
        bool insertedAtThreadRoot = !msgIndexInThread;
        // Add any new display node and potentially fix-up changes in the root.
        // (If this is a new thread and we are not using a dummy row, the only
        //  node to display is the root node which has already been added by
        //  AddHdrToThread.  And since there is just the one, no change in root
        //  could have occurred, so we have nothing to do.)
        if (!newThread || GroupViewUsesDummyRow())
        {
          // we never want to insert/update the root node, because
          //  AddHdrToThread has already done that for us (in all cases).
          if (insertedAtThreadRoot)
            msgIndexInThread++;
          // If this header is the new parent of the thread... AND
          // If we are not using a dummy row, this means we need to append our
          //  old node as the first child of the new root.
          // (If we are using a dummy row, the old node's "content" node already
          //  exists (at position threadIndex + 1) and we need to insert the
          //  "content" copy of the new root node there, pushing our old
          //  "content" node down.)
          // Example mini-diagrams, wrapping the to-add thing with ()
          //  No dummy row; we had: [A], now we have [B], we want [B (A)].
          //  Dummy row; we had: [A A], now we have [B A], we want [B (B) A].
          //  (Coming into this we're adding 'B')
          if (!newThread && insertedAtThreadRoot && !GroupViewUsesDummyRow())
          {
            // grab a copy of the old root node ('A') from the thread so we can
            //  insert it. (offset msgIndexInThread=1 is the right thing; we are
            //  non-dummy.)
            thread->GetChildHdrAt(msgIndexInThread, &newHdr);
          } // nothing to do for dummy case, we're already inserting 'B'.
          nsMsgKey msgKey;
          uint32_t msgFlags;
          newHdr->GetMessageKey(&msgKey);
          newHdr->GetFlags(&msgFlags);
          InsertMsgHdrAt(threadIndex + msgIndexInThread, newHdr, msgKey,
                         msgFlags, 1);
        }
        // the call to NoteChange() has to happen after we add the key
        // as NoteChange() will call RowCountChanged() which will call our GetRowCount()
        // (msgIndexInThread states.  new thread: 0, old thread at root: 1)
        if (newThread && GroupViewUsesDummyRow())
          NoteChange(threadIndex, 2, nsMsgViewNotificationCode::insertOrDelete);
        else
          NoteChange(threadIndex + msgIndexInThread, 1,
                     nsMsgViewNotificationCode::insertOrDelete);
        numRowsToInvalidate = msgIndexInThread;
      }
      // we still need the addition notification for new threads when elided
      else if (newThread)
      {
        NoteChange(threadIndex, 1,
                   nsMsgViewNotificationCode::insertOrDelete);
      }
      NoteChange(threadIndex, numRowsToInvalidate, nsMsgViewNotificationCode::changed);
    }
  }
  // if thread is expanded, we need to add hdr to view...
  return NS_OK;
}

NS_IMETHODIMP nsMsgGroupView::OnHdrFlagsChanged(nsIMsgDBHdr *aHdrChanged, uint32_t aOldFlags,
                                      uint32_t aNewFlags, nsIDBChangeListener *aInstigator)
{
  if (!(m_viewFlags & nsMsgViewFlagsType::kGroupBySort))
    return nsMsgDBView::OnHdrFlagsChanged(aHdrChanged, aOldFlags, aNewFlags,
                                          aInstigator);

  nsCOMPtr <nsIMsgThread> thread;

  // check if we're adding a header, and the current day has changed. If it has, we're just going to
  // close and re-open the view so things will be correctly categorized.
  if (m_dayChanged)
    return RebuildView(m_viewFlags);

  nsresult rv = GetThreadContainingMsgHdr(aHdrChanged, getter_AddRefs(thread));
  NS_ENSURE_SUCCESS(rv, rv);
  uint32_t deltaFlags = (aOldFlags ^ aNewFlags);
  if (deltaFlags & nsMsgMessageFlags::Read)
    thread->MarkChildRead(aNewFlags & nsMsgMessageFlags::Read);

  return nsMsgDBView::OnHdrFlagsChanged(aHdrChanged, aOldFlags, aNewFlags, aInstigator);
}

NS_IMETHODIMP nsMsgGroupView::OnHdrDeleted(nsIMsgDBHdr *aHdrDeleted, nsMsgKey aParentKey, int32_t aFlags,
                            nsIDBChangeListener *aInstigator)
{
  if (!(m_viewFlags & nsMsgViewFlagsType::kGroupBySort))
    return nsMsgDBView::OnHdrDeleted(aHdrDeleted, aParentKey, aFlags, aInstigator);

  // check if we're adding a header, and the current day has changed. If it has, we're just going to
  // close and re-open the view so things will be correctly categorized.
  if (m_dayChanged)
    return RebuildView(m_viewFlags);

  nsCOMPtr <nsIMsgThread> thread;
  nsMsgKey keyDeleted;
  aHdrDeleted->GetMessageKey(&keyDeleted);

  nsresult rv = GetThreadContainingMsgHdr(aHdrDeleted, getter_AddRefs(thread));
  NS_ENSURE_SUCCESS(rv, rv);
  nsMsgViewIndex viewIndexOfThread = GetIndexOfFirstDisplayedKeyInThread(
                                       thread, true); // yes to dummy node
  thread->RemoveChildHdr(aHdrDeleted, nullptr);

  nsMsgGroupThread *groupThread = static_cast<nsMsgGroupThread *>((nsIMsgThread *) thread);

  bool rootDeleted = viewIndexOfThread != nsMsgKey_None &&
    m_keys[viewIndexOfThread] == keyDeleted;
  rv = nsMsgDBView::OnHdrDeleted(aHdrDeleted, aParentKey, aFlags, aInstigator);
  if (groupThread->m_dummy)
  {
    if (!groupThread->NumRealChildren())
    {
      thread->RemoveChildAt(0); // get rid of dummy
      if (viewIndexOfThread != nsMsgKey_None)
      {
        RemoveByIndex(viewIndexOfThread);
        if (m_deletingRows)
          mIndicesToNoteChange.AppendElement(viewIndexOfThread);
      }
    }
    else if (rootDeleted)
    {
      // reflect new thread root into view.dummy row.
      nsCOMPtr<nsIMsgDBHdr> hdr;
      thread->GetChildHdrAt(0, getter_AddRefs(hdr));
      if (hdr)
      {
        nsMsgKey msgKey;
        hdr->GetMessageKey(&msgKey);
        SetMsgHdrAt(hdr, viewIndexOfThread, msgKey, m_flags[viewIndexOfThread], 0);
      }
    }
  }
  if (!groupThread->m_keys.Length())
  {
    nsString hashKey;
    rv = HashHdr(aHdrDeleted, hashKey);
    if (NS_SUCCEEDED(rv))
      m_groupsTable.Remove(hashKey);
  }
  return rv;
}

NS_IMETHODIMP nsMsgGroupView::GetRowProperties(int32_t aRow, nsAString& aProperties)
{
  if (!IsValidIndex(aRow))
    return NS_MSG_INVALID_DBVIEW_INDEX;

  if (m_flags[aRow] & MSG_VIEW_FLAG_DUMMY)
  {
    aProperties.AssignLiteral("dummy");
    return NS_OK;
  }

  return nsMsgDBView::GetRowProperties(aRow, aProperties);
}

NS_IMETHODIMP nsMsgGroupView::GetCellProperties(int32_t aRow, nsITreeColumn *aCol, nsAString& aProperties)
{
  if (!IsValidIndex(aRow))
    return NS_MSG_INVALID_DBVIEW_INDEX;

  if (m_flags[aRow] & MSG_VIEW_FLAG_DUMMY)
  {
    aProperties.AssignLiteral("dummy");
    return NS_OK;
  }

  return nsMsgDBView::GetCellProperties(aRow, aCol, aProperties);
}

NS_IMETHODIMP nsMsgGroupView::CellTextForColumn(int32_t aRow,
                                                const PRUnichar *aColumnName,
                                                nsAString &aValue) {
  if (!IsValidIndex(aRow))
    return NS_MSG_INVALID_DBVIEW_INDEX;

  if (m_flags[aRow] & MSG_VIEW_FLAG_DUMMY && aColumnName[0] != 'u')
  {
    nsCOMPtr <nsIMsgDBHdr> msgHdr;
    nsresult rv = GetMsgHdrForViewIndex(aRow, getter_AddRefs(msgHdr));
    NS_ENSURE_SUCCESS(rv, rv);
    nsString hashKey;
    rv = HashHdr(msgHdr, hashKey);
    if (NS_FAILED(rv))
      return NS_OK;
    nsCOMPtr<nsIMsgThread> msgThread;
    m_groupsTable.Get(hashKey, getter_AddRefs(msgThread));
    nsMsgGroupThread * groupThread = static_cast<nsMsgGroupThread *>(msgThread.get());
    if (aColumnName[0] == 's'  && aColumnName[1] == 'u' )
    {
      uint32_t flags;
      bool rcvDate = false;
      msgHdr->GetFlags(&flags);
      aValue.Truncate();
      nsString tmp_str;
      switch (m_sortType)
      {
        case nsMsgViewSortType::byReceived:
          rcvDate = true;
        case nsMsgViewSortType::byDate:
        {
          uint32_t ageBucket = 0;
          GetAgeBucketValue(msgHdr, &ageBucket, rcvDate);
          switch (ageBucket)
          {
          case 1:
            if (m_kTodayString.IsEmpty())
              m_kTodayString.Adopt(GetString(NS_LITERAL_STRING("today").get()));
            aValue.Assign(m_kTodayString);
            break;
          case 2:
            if (m_kYesterdayString.IsEmpty())
              m_kYesterdayString.Adopt(GetString(NS_LITERAL_STRING("yesterday").get()));
            aValue.Assign(m_kYesterdayString);
            break;
          case 3:
            if (m_kLastWeekString.IsEmpty())
              m_kLastWeekString.Adopt(GetString(NS_LITERAL_STRING("lastWeek").get()));
            aValue.Assign(m_kLastWeekString);
            break;
          case 4:
            if (m_kTwoWeeksAgoString.IsEmpty())
              m_kTwoWeeksAgoString.Adopt(GetString(NS_LITERAL_STRING("twoWeeksAgo").get()));
            aValue.Assign(m_kTwoWeeksAgoString);
            break;
          case 5:
            if (m_kOldMailString.IsEmpty())
              m_kOldMailString.Adopt(GetString(NS_LITERAL_STRING("older").get()));
            aValue.Assign(m_kOldMailString);
            break;
          default:
            NS_ASSERTION(false, "bad age thread");
            break;
          }
          break;
        }
        case nsMsgViewSortType::byAuthor:
          FetchAuthor(msgHdr, aValue);
          break;
        case nsMsgViewSortType::byStatus:
          rv = FetchStatus(m_flags[aRow], aValue);
          if (aValue.IsEmpty()) {
            tmp_str.Adopt(GetString(NS_LITERAL_STRING("messagesWithNoStatus").get()));
            aValue.Assign(tmp_str);
          }
          break;
        case nsMsgViewSortType::byTags:
          rv = FetchTags(msgHdr, aValue);
          if (aValue.IsEmpty()) {
            tmp_str.Adopt(GetString(NS_LITERAL_STRING("untaggedMessages").get()));
            aValue.Assign(tmp_str);
          }
          break;
        case nsMsgViewSortType::byPriority:
          FetchPriority(msgHdr, aValue);
          if (aValue.IsEmpty()) {
            tmp_str.Adopt(GetString(NS_LITERAL_STRING("noPriority").get()));
            aValue.Assign(tmp_str);
          }
          break;
        case nsMsgViewSortType::byAccount:
          FetchAccount(msgHdr, aValue);
          break;
        case nsMsgViewSortType::byRecipient:
          FetchRecipients(msgHdr, aValue);
          break;
        case nsMsgViewSortType::byAttachments:
          tmp_str.Adopt(GetString(flags & nsMsgMessageFlags::Attachment
            ? NS_LITERAL_STRING("attachments").get()
            : NS_LITERAL_STRING("noAttachments").get()));
          aValue.Assign(tmp_str);
          break;
        case nsMsgViewSortType::byFlagged:
          tmp_str.Adopt(GetString(flags & nsMsgMessageFlags::Marked
            ? NS_LITERAL_STRING("groupFlagged").get()
            : NS_LITERAL_STRING("notFlagged").get()));
          aValue.Assign(tmp_str);
          break;
        // byLocation is a special case; we don't want to have duplicate
        //  all this logic in nsMsgSearchDBView, and its hash key is what we
        //  want anyways, so just copy it across.
        case nsMsgViewSortType::byLocation:
          aValue = hashKey;
          break;
        case nsMsgViewSortType::byCustom:
        {
          nsIMsgCustomColumnHandler* colHandler =
            GetCurColumnHandlerFromDBInfo();
          if (colHandler)
          {
            rv = colHandler->GetSortStringForRow(msgHdr.get(), aValue);
            break;
          }
        }

        default:
          NS_ASSERTION(false, "we don't sort by group for this type");
          break;
      }

      if (groupThread)
      {
        // Get number of messages in group
        nsAutoString formattedCountMsg;
        uint32_t numMsg = groupThread->NumRealChildren();
        formattedCountMsg.AppendInt(numMsg);

        // Get number of unread messages
        nsAutoString formattedCountUnrMsg;
        uint32_t numUnrMsg = 0;
        groupThread->GetNumUnreadChildren(&numUnrMsg);
        formattedCountUnrMsg.AppendInt(numUnrMsg);

        // Add text to header
        aValue.Append(NS_LITERAL_STRING(" ("));
        if (numUnrMsg)
        {
          aValue.Append(formattedCountUnrMsg);
          aValue.Append(NS_LITERAL_STRING("/"));
        }

        aValue.Append(formattedCountMsg);
        aValue.Append(NS_LITERAL_STRING(")"));
      }
    }
    else if (aColumnName[0] == 't' && aColumnName[1] == 'o')
    {
      nsAutoString formattedCountString;
      uint32_t numChildren = (groupThread) ? groupThread->NumRealChildren() : 0;
      formattedCountString.AppendInt(numChildren);
      aValue.Assign(formattedCountString);
    }
    return NS_OK;
  }
  return nsMsgDBView::CellTextForColumn(aRow, aColumnName, aValue);
}

NS_IMETHODIMP nsMsgGroupView::LoadMessageByViewIndex(nsMsgViewIndex aViewIndex)
{
  if (m_flags[aViewIndex] & MSG_VIEW_FLAG_DUMMY)
  {
    // if we used to have one item selected, and now we have more than one, we should clear the message pane.
    nsCOMPtr<nsIMsgWindow> msgWindow(do_QueryReferent(mMsgWindowWeak));
    nsCOMPtr <nsIMsgWindowCommands> windowCommands;
    if (msgWindow && NS_SUCCEEDED(msgWindow->GetWindowCommands(getter_AddRefs(windowCommands))) && windowCommands)
      windowCommands->ClearMsgPane();
    // since we are selecting a dummy row, we should also clear out m_currentlyDisplayedMsgUri
    m_currentlyDisplayedMsgUri.Truncate();
    return NS_OK;
  }
  else
    return nsMsgDBView::LoadMessageByViewIndex(aViewIndex);
}

NS_IMETHODIMP nsMsgGroupView::GetThreadContainingMsgHdr(nsIMsgDBHdr *msgHdr, nsIMsgThread **pThread)
{
  if (!(m_viewFlags & nsMsgViewFlagsType::kGroupBySort))
    return nsMsgDBView::GetThreadContainingMsgHdr(msgHdr, pThread);

  nsString hashKey;
  nsresult rv = HashHdr(msgHdr, hashKey);
  *pThread = nullptr;
  if (NS_SUCCEEDED(rv))
  {
    nsCOMPtr<nsIMsgThread> thread;
    m_groupsTable.Get(hashKey, getter_AddRefs(thread));
    thread.swap(*pThread);
  }
  return (*pThread) ? NS_OK : NS_ERROR_FAILURE;
}

int32_t nsMsgGroupView::FindLevelInThread(nsIMsgDBHdr *msgHdr,
                                          nsMsgViewIndex startOfThread, nsMsgViewIndex viewIndex)
{
  if (!(m_viewFlags & nsMsgViewFlagsType::kGroupBySort))
    return nsMsgDBView::FindLevelInThread(msgHdr, startOfThread, viewIndex);
  return (startOfThread == viewIndex) ? 0 : 1;
}


nsMsgViewIndex nsMsgGroupView::ThreadIndexOfMsg(nsMsgKey msgKey,
                                            nsMsgViewIndex msgIndex /* = nsMsgViewIndex_None */,
                                            int32_t *pThreadCount /* = NULL */,
                                            uint32_t *pFlags /* = NULL */)
{
  if (msgIndex != nsMsgViewIndex_None && GroupViewUsesDummyRow())
  {
    // this case is all we care about at this point.
    if (m_flags[msgIndex] & MSG_VIEW_FLAG_ISTHREAD)
      return msgIndex;
  }
  return nsMsgDBView::ThreadIndexOfMsg(msgKey, msgIndex, pThreadCount, pFlags);
}

bool nsMsgGroupView::GroupViewUsesDummyRow()
{
  return (m_sortType != nsMsgViewSortType::bySubject);
}
