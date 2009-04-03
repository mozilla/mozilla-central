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
 *   Jeremy Morton (bugzilla@game-point.net)
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
  m_dayChanged = PR_FALSE;
  m_lastCurExplodedTime.tm_mday = 0;
  m_groupsTable.Init();
}

nsMsgGroupView::~nsMsgGroupView()
{
}

NS_IMETHODIMP nsMsgGroupView::Open(nsIMsgFolder *aFolder, nsMsgViewSortTypeValue aSortType, nsMsgViewSortOrderValue aSortOrder, nsMsgViewFlagsTypeValue aViewFlags, PRInt32 *aCount)
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

  PRBool rcvDate = PR_FALSE;

  if (m_sortType == nsMsgViewSortType::byReceived)
    rcvDate = PR_TRUE;
  if (m_db &&
      ((m_sortType == nsMsgViewSortType::byDate) ||
       (m_sortType == nsMsgViewSortType::byReceived)))
  {
    nsCOMPtr <nsIDBFolderInfo> dbFolderInfo;
    m_db->GetDBFolderInfo(getter_AddRefs(dbFolderInfo));
    if (dbFolderInfo)
    {
      PRUint32 expandFlags = 0;
      PRUint32 num = GetSize();

      for (PRUint32 i = 0; i < num; i++)
      {
        if (m_flags[i] & MSG_VIEW_FLAG_ISTHREAD && ! (m_flags[i] & nsMsgMessageFlags::Elided))
        {
          nsCOMPtr <nsIMsgDBHdr> msgHdr;
          GetMsgHdrForViewIndex(i, getter_AddRefs(msgHdr));
          if (msgHdr)
          {
            PRUint32 ageBucket;
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

// Set rcvDate to PR_TRUE to get the Received: date instead of the Date: date.
nsresult nsMsgGroupView::GetAgeBucketValue(nsIMsgDBHdr *aMsgHdr, PRUint32 * aAgeBucket, PRBool rcvDate)
{
  NS_ENSURE_ARG_POINTER(aMsgHdr);
  NS_ENSURE_ARG_POINTER(aAgeBucket);

  PRTime dateOfMsg;
  nsresult rv;
  if (!rcvDate)
    rv = aMsgHdr->GetDate(&dateOfMsg);
  else
  {
    PRUint32 rcvDateSecs;
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
    m_dayChanged = PR_TRUE; // this will cause us to rebuild the view.

  m_lastCurExplodedTime = currentExplodedTime;
  if (currentExplodedTime.tm_year == explodedMsgTime.tm_year &&
      currentExplodedTime.tm_month == explodedMsgTime.tm_month &&
      currentExplodedTime.tm_mday == explodedMsgTime.tm_mday)
  {
    // same day...
    *aAgeBucket = 1;
  }
  // figure out how many days ago this msg arrived
  else if (LL_CMP(currentTime, >, dateOfMsg))
  {
    // some constants for calculation
    static PRInt64 microSecondsPerSecond;
    static PRInt64 microSecondsPerDay;
    static PRInt64 secondsPerDay;
    static PRInt64 microSecondsPer6Days;
    static PRInt64 microSecondsPer13Days;

    static PRBool bGotConstants = PR_FALSE;
    if ( !bGotConstants )
    {
      // seeds
      LL_I2L  ( microSecondsPerSecond,  PR_USEC_PER_SEC );
      LL_UI2L ( secondsPerDay,          60 * 60 * 24 );

      // derivees
      LL_MUL( microSecondsPerDay,   secondsPerDay,      microSecondsPerSecond );
      LL_MUL( microSecondsPer6Days, microSecondsPerDay, 6 );
      LL_MUL( microSecondsPer13Days, microSecondsPerDay, 13 );
      bGotConstants = PR_TRUE;
    }

    // setting the time variables to local time
    PRInt64 GMTLocalTimeShift;
    LL_ADD( GMTLocalTimeShift, currentExplodedTime.tm_params.tp_gmt_offset, currentExplodedTime.tm_params.tp_dst_offset );
    LL_MUL( GMTLocalTimeShift, GMTLocalTimeShift, microSecondsPerSecond );
    LL_ADD( currentTime, currentTime, GMTLocalTimeShift );
    LL_ADD( dateOfMsg, dateOfMsg, GMTLocalTimeShift );

    // the most recent midnight, counting from current time
    PRInt64 todaysMicroSeconds, mostRecentMidnight;
    LL_MOD( todaysMicroSeconds, currentTime, microSecondsPerDay );
    LL_SUB( mostRecentMidnight, currentTime, todaysMicroSeconds );
    PRInt64 yesterday;
    LL_SUB( yesterday, mostRecentMidnight, microSecondsPerDay );
    // most recent midnight minus 6 days
    PRInt64 mostRecentWeek;
    LL_SUB( mostRecentWeek, mostRecentMidnight, microSecondsPer6Days );

    // was the message sent yesterday?
    if ( LL_CMP( dateOfMsg, >=, yesterday ) ) // yes ....
      *aAgeBucket = 2;
    else if ( LL_CMP(dateOfMsg, >=, mostRecentWeek) )
      *aAgeBucket = 3;
    else
    {
      PRInt64 lastTwoWeeks;
      LL_SUB( lastTwoWeeks, mostRecentMidnight, microSecondsPer13Days);
      *aAgeBucket = LL_CMP(dateOfMsg, >=, lastTwoWeeks) ? 4 : 5;
    }
  }
  return NS_OK;
}

nsresult nsMsgGroupView::HashHdr(nsIMsgDBHdr *msgHdr, nsString& aHashKey)
{
  nsCString cStringKey;
  aHashKey.Truncate();
  nsresult rv = NS_OK;
  PRBool rcvDate = PR_FALSE;

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
        PRUint32 flags;
        msgHdr->GetFlags(&flags);
        aHashKey.Assign(flags & nsMsgMessageFlags::Attachment ? '1' : '0');
        break;
      }
    case nsMsgViewSortType::byFlagged:
      {
        PRUint32 flags;
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
        PRUint32 status = 0;
        GetStatusSortValue(msgHdr, &status);
        aHashKey.AppendInt(status);
      }
      break;
    case nsMsgViewSortType::byReceived:
      rcvDate = PR_TRUE;
    case nsMsgViewSortType::byDate:
    {
      PRUint32 ageBucket;
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
      NS_ASSERTION(PR_FALSE, "no hash key for this type");
      rv = NS_ERROR_FAILURE;
  }
  return rv;
}

nsMsgGroupThread *nsMsgGroupView::CreateGroupThread(nsIMsgDatabase *db)
{
  return new nsMsgGroupThread(db);
}

nsMsgGroupThread *nsMsgGroupView::AddHdrToThread(nsIMsgDBHdr *msgHdr, PRBool *pNewThread)
{
  nsMsgKey msgKey;
  PRUint32 msgFlags;
  msgHdr->GetMessageKey(&msgKey);
  msgHdr->GetFlags(&msgFlags);
  nsString hashKey;
  nsresult rv = HashHdr(msgHdr, hashKey);
  if (NS_FAILED(rv))
    return nsnull;

//  if (m_sortType == nsMsgViewSortType::byDate)
//    msgKey = ((nsPRUint32Key *) hashKey)->GetValue();
  nsCOMPtr<nsIMsgThread> msgThread;
  m_groupsTable.Get(hashKey, getter_AddRefs(msgThread));
  PRBool newThread = !msgThread;
  *pNewThread = newThread;
  nsMsgViewIndex viewIndexOfThread; // index of first message in thread in view
  nsMsgViewIndex threadInsertIndex; // index of newly added header in thread

  nsMsgGroupThread *foundThread = static_cast<nsMsgGroupThread *>(msgThread.get());
  // If the thread does not already exist, create one
  if (!foundThread)
  {
    foundThread = CreateGroupThread(m_db);
    msgThread = do_QueryInterface(foundThread);
    m_groupsTable.Put(hashKey, msgThread);
    if (GroupViewUsesDummyRow())
    {
      foundThread->m_dummy = PR_TRUE;
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
  else // find the view index of the root node of the thread in the view
  {
    // (indicate that we do want/accept the dummy node)
    viewIndexOfThread = GetIndexOfFirstDisplayedKeyInThread(foundThread,
                                                            PR_TRUE);
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
                                        PRInt32 *aCount)
{
  nsresult rv = NS_OK;

  m_groupsTable.Clear();
  if (aSortType == nsMsgViewSortType::byThread || aSortType == nsMsgViewSortType::byId
    || aSortType == nsMsgViewSortType::byNone || aSortType == nsMsgViewSortType::bySize)
    return NS_ERROR_INVALID_ARG;

  m_sortType = aSortType;
  m_sortOrder = aSortOrder;
  m_viewFlags = aViewFlags | nsMsgViewFlagsType::kThreadedDisplay | nsMsgViewFlagsType::kGroupBySort;

  PRBool hasMore;
  nsCOMPtr <nsISupports> supports;
  nsCOMPtr <nsIMsgDBHdr> msgHdr;
  while (NS_SUCCEEDED(rv) && NS_SUCCEEDED(rv = aHeaders->HasMoreElements(&hasMore)) && hasMore)
  {
    rv = aHeaders->GetNext(getter_AddRefs(supports));
    if (NS_SUCCEEDED(rv) && supports)
    {
      PRBool notUsed;
      msgHdr = do_QueryInterface(supports);
      AddHdrToThread(msgHdr, &notUsed);
    }
  }
  PRUint32 expandFlags = 0;
  PRBool expandAll = m_viewFlags & nsMsgViewFlagsType::kExpandAll;
  PRUint32 viewFlag = (m_sortType == nsMsgViewSortType::byDate) ? MSG_VIEW_FLAG_DUMMY : 0;
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
  for (PRUint32 viewIndex = 0; viewIndex < m_keys.Length(); viewIndex++)
  {
    nsCOMPtr <nsIMsgThread> thread;
    GetThreadContainingIndex(viewIndex, getter_AddRefs(thread));
    if (thread)
    {
      PRUint32 numChildren;
      thread->GetNumChildren(&numChildren);
      if (numChildren > 1 || viewFlag)
        OrExtraFlag(viewIndex, viewFlag | MSG_VIEW_FLAG_HASCHILDREN);
      if (expandAll || expandFlags)
      {
        nsMsgGroupThread *groupThread = static_cast<nsMsgGroupThread *>((nsIMsgThread *) thread);
        if (expandAll || expandFlags & (1 << groupThread->m_threadKey))
        {
          PRUint32 numExpanded;
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
  nsresult rv = view->m_groupsTable.Put(aKey, aGroupThread);
  return NS_SUCCEEDED(rv) ? PL_DHASH_NEXT : PL_DHASH_STOP;
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
    PRInt32 count;
    m_dayChanged = PR_FALSE;
    nsAutoTArray<nsMsgKey, 1> preservedSelection;
    nsMsgKey curSelectedKey;
    SaveAndClearSelection(&curSelectedKey, preservedSelection);
    InternalClose();
    PRInt32 oldSize = GetSize();
    // this is important, because the tree will ask us for our
    // row count, which get determine from the number of keys.
    m_keys.Clear();
    // be consistent
    m_flags.Clear();
    m_levels.Clear();

    // this needs to happen after we remove all the keys, since RowCountChanged() will call our GetRowCount()
    if (mTree)
      mTree->RowCountChanged(0, -oldSize);
    DisableChangeUpdates();
    nsresult rv = OpenWithHdrs(headers, m_sortType, m_sortOrder, newFlags, &count);
    EnableChangeUpdates();
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

nsresult nsMsgGroupView::OnNewHeader(nsIMsgDBHdr *newHdr, nsMsgKey aParentKey, PRBool ensureListed)
{
  if (!(m_viewFlags & nsMsgViewFlagsType::kGroupBySort))
    return nsMsgDBView::OnNewHeader(newHdr, aParentKey, ensureListed);

  // check if we're adding a header, and the current day has changed. If it has, we're just going to
  // close and re-open the view so things will be correctly categorized.
  if (m_dayChanged)
    return RebuildView(m_viewFlags);

  PRBool newThread;
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

      PRInt32 numRowsToInvalidate = 1;
      // if the thread is expanded (not elided), we should add the header to
      //  the view.
      if (! (m_flags[threadIndex] & nsMsgMessageFlags::Elided))
      {
        PRUint32 msgIndexInThread = thread->FindMsgHdr(newHdr);
        PRBool insertedAtThreadRoot = !msgIndexInThread;
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
            thread->GetChildAt(msgIndexInThread, &newHdr);
          } // nothing to do for dummy case, we're already inserting 'B'.
          nsMsgKey msgKey;
          PRUint32 msgFlags;
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

NS_IMETHODIMP nsMsgGroupView::OnHdrFlagsChanged(nsIMsgDBHdr *aHdrChanged, PRUint32 aOldFlags,
                                      PRUint32 aNewFlags, nsIDBChangeListener *aInstigator)
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
  PRUint32 deltaFlags = (aOldFlags ^ aNewFlags);
  if (deltaFlags & nsMsgMessageFlags::Read)
    thread->MarkChildRead(aNewFlags & nsMsgMessageFlags::Read);

  return nsMsgDBView::OnHdrFlagsChanged(aHdrChanged, aOldFlags, aNewFlags, aInstigator);
}

NS_IMETHODIMP nsMsgGroupView::OnHdrDeleted(nsIMsgDBHdr *aHdrDeleted, nsMsgKey aParentKey, PRInt32 aFlags,
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
                                       thread, PR_TRUE); // yes to dummy node
  thread->RemoveChildHdr(aHdrDeleted, nsnull);

  nsMsgGroupThread *groupThread = static_cast<nsMsgGroupThread *>((nsIMsgThread *) thread);

  PRBool rootDeleted = viewIndexOfThread != nsMsgKey_None &&
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
      thread->GetChildAt(0, getter_AddRefs(hdr));
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

NS_IMETHODIMP nsMsgGroupView::GetRowProperties(PRInt32 aRow, nsISupportsArray *aProperties)
{
  if (!IsValidIndex(aRow))
    return NS_MSG_INVALID_DBVIEW_INDEX;

  if (m_flags[aRow] & MSG_VIEW_FLAG_DUMMY)
    return aProperties->AppendElement(kDummyMsgAtom);
  return nsMsgDBView::GetRowProperties(aRow, aProperties);
}

NS_IMETHODIMP nsMsgGroupView::GetCellProperties(PRInt32 aRow, nsITreeColumn *aCol, nsISupportsArray *aProperties)
{
  if (!IsValidIndex(aRow))
    return NS_MSG_INVALID_DBVIEW_INDEX;

  if (m_flags[aRow] & MSG_VIEW_FLAG_DUMMY)
    return aProperties->AppendElement(kDummyMsgAtom);
  return nsMsgDBView::GetCellProperties(aRow, aCol, aProperties);
}

NS_IMETHODIMP nsMsgGroupView::GetCellText(PRInt32 aRow, nsITreeColumn* aCol, nsAString& aValue)
{
  if (!IsValidIndex(aRow))
    return NS_MSG_INVALID_DBVIEW_INDEX;

  const PRUnichar* colID;
  aCol->GetIdConst(&colID);
  if (m_flags[aRow] & MSG_VIEW_FLAG_DUMMY && colID[0] != 'u')
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
    if (colID[0] == 's'  && colID[1] == 'u' )
    {
      PRUint32 flags;
      PRBool rcvDate = PR_FALSE;
      msgHdr->GetFlags(&flags);
      aValue.SetCapacity(0);
      switch (m_sortType)
      {
        case nsMsgViewSortType::byReceived:
          rcvDate = PR_TRUE;
        case nsMsgViewSortType::byDate:
        {
          PRUint32 ageBucket = 0;
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
            NS_ASSERTION(PR_FALSE, "bad age thread");
            break;
          }
          break;
        }
        case nsMsgViewSortType::byAuthor:
          FetchAuthor(msgHdr, aValue);
          break;
        case nsMsgViewSortType::byStatus:
          rv = FetchStatus(m_flags[aRow], aValue);
          if (aValue.IsEmpty())
            aValue.Adopt(GetString(NS_LITERAL_STRING("messagesWithNoStatus").get()));
          break;
        case nsMsgViewSortType::byTags:
          rv = FetchTags(msgHdr, aValue);
          if (aValue.IsEmpty())
            aValue.Adopt(GetString(NS_LITERAL_STRING("untaggedMessages").get()));
          break;
        case nsMsgViewSortType::byPriority:
          FetchPriority(msgHdr, aValue);
          if (aValue.IsEmpty())
            aValue.Adopt(GetString(NS_LITERAL_STRING("noPriority").get()));
          break;
        case nsMsgViewSortType::byAccount:
          FetchAccount(msgHdr, aValue);
          break;
        case nsMsgViewSortType::byRecipient:
          FetchRecipients(msgHdr, aValue);
          break;
        case nsMsgViewSortType::byAttachments:
          aValue.Adopt(GetString(flags & nsMsgMessageFlags::Attachment
            ? NS_LITERAL_STRING("attachments").get()
            : NS_LITERAL_STRING("noAttachments").get()));
          break;
        case nsMsgViewSortType::byFlagged:
          aValue.Adopt(GetString(flags & nsMsgMessageFlags::Marked 
            ? NS_LITERAL_STRING("groupFlagged").get()
            : NS_LITERAL_STRING("notFlagged").get()));
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
          NS_ASSERTION(PR_FALSE, "we don't sort by group for this type");
          break;
      }

      if (groupThread)
      {
        // Get number of messages in group
        nsAutoString formattedCountMsg;
        PRUint32 numMsg = groupThread->NumRealChildren();
        formattedCountMsg.AppendInt(numMsg);

        // Get number of unread messages
        nsAutoString formattedCountUnrMsg;
        PRUint32 numUnrMsg = 0;
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
    else if (colID[0] == 't')
    {
      nsAutoString formattedCountString;
      PRUint32 numChildren = (groupThread) ? groupThread->NumRealChildren() : 0;
      formattedCountString.AppendInt(numChildren);
      aValue.Assign(formattedCountString);
    }
    return NS_OK;
  }
  return nsMsgDBView::GetCellText(aRow, aCol, aValue);
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

nsresult nsMsgGroupView::GetThreadContainingMsgHdr(nsIMsgDBHdr *msgHdr, nsIMsgThread **pThread)
{
  if (!(m_viewFlags & nsMsgViewFlagsType::kGroupBySort))
    return nsMsgDBView::GetThreadContainingMsgHdr(msgHdr, pThread);

  nsString hashKey;
  nsresult rv = HashHdr(msgHdr, hashKey);
  *pThread = nsnull;
  if (NS_SUCCEEDED(rv))
  {
    nsCOMPtr<nsIMsgThread> thread;
    m_groupsTable.Get(hashKey, getter_AddRefs(thread));
    thread.swap(*pThread);
  }
  return (*pThread) ? NS_OK : NS_ERROR_FAILURE;
}

PRInt32 nsMsgGroupView::FindLevelInThread(nsIMsgDBHdr *msgHdr,
                                          nsMsgViewIndex startOfThread, nsMsgViewIndex viewIndex)
{
  return (startOfThread == viewIndex) ? 0 : 1;
}


nsMsgViewIndex nsMsgGroupView::ThreadIndexOfMsg(nsMsgKey msgKey,
                                            nsMsgViewIndex msgIndex /* = nsMsgViewIndex_None */,
                                            PRInt32 *pThreadCount /* = NULL */,
                                            PRUint32 *pFlags /* = NULL */)
{
  if (msgIndex != nsMsgViewIndex_None && GroupViewUsesDummyRow())
  {
    // this case is all we care about at this point.
    if (m_flags[msgIndex] & MSG_VIEW_FLAG_ISTHREAD)
      return msgIndex;
  }
  return nsMsgDBView::ThreadIndexOfMsg(msgKey, msgIndex, pThreadCount, pFlags);
}

PRBool nsMsgGroupView::GroupViewUsesDummyRow()
{
  return (m_sortType != nsMsgViewSortType::bySubject);
}
