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
 *   Seth Spitzer <sspitzer@netscape.com>
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
#include "nsIMutableArray.h"
#include "nsMsgGroupThread.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch.h"

static PRBool gReferenceOnlyThreading;

nsMsgSearchDBView::nsMsgSearchDBView()
{
  // don't try to display messages for the search pane.
  mSuppressMsgDisplay = PR_TRUE;
  m_threadsTable.Init();
  m_hdrsTable.Init();
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
                                      PRInt32 *pCount)
{
  nsresult rv = nsMsgDBView::Open(folder, sortType, sortOrder, 
                                    viewFlags, pCount);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIPrefBranch> prefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
    NS_ENSURE_SUCCESS(rv, rv);
  prefBranch->GetBoolPref("mail.strict_threading", &gReferenceOnlyThreading);

    if (pCount)
      *pCount = 0;
    m_folder = nsnull;
    return rv;
}


PLDHashOperator
nsMsgSearchDBView::ThreadTableCloner(const nsAString &aKey, nsIMsgThread* aThread, void* aArg)
{
  nsMsgSearchDBView* view = static_cast<nsMsgSearchDBView*>(aArg);
  nsresult rv = view->m_threadsTable.Put(aKey, aThread);
  return NS_SUCCEEDED(rv) ? PL_DHASH_NEXT : PL_DHASH_STOP;
}

PLDHashOperator
nsMsgSearchDBView::MsgHdrTableCloner(const nsAString &aKey, nsIMsgDBHdr* aMsgHdr, void* aArg)
{
  nsMsgSearchDBView* view = static_cast<nsMsgSearchDBView*>(aArg);
  nsresult rv = view->m_hdrsTable.Put(aKey, aMsgHdr);
  return NS_SUCCEEDED(rv) ? PL_DHASH_NEXT : PL_DHASH_STOP;
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

  if (m_hdrsForEachFolder)
    m_hdrsForEachFolder->Clone(getter_AddRefs(newMsgDBView->m_hdrsForEachFolder));

  if (m_copyListenerList)
    m_copyListenerList->Clone(getter_AddRefs(newMsgDBView->m_copyListenerList));

  newMsgDBView->m_uniqueFoldersSelected.InsertObjectsAt(m_uniqueFoldersSelected, 0);

  PRInt32 count = m_dbToUseList.Count(); 
  for(PRInt32 i = 0; i < count; i++)
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
  PRInt32 count = m_dbToUseList.Count();
  
  for(PRInt32 i = 0; i < count; i++)
    m_dbToUseList[i]->RemoveListener(this);

  m_dbToUseList.Clear();

  return nsMsgGroupView::Close();
}

void nsMsgSearchDBView::InternalClose()
{
  m_threadsTable.Clear();
  m_hdrsTable.Clear();
  return nsMsgGroupView::InternalClose();
}

NS_IMETHODIMP nsMsgSearchDBView::GetCellText(PRInt32 aRow, nsITreeColumn* aCol, nsAString& aValue)
{
  const PRUnichar* colID;
  aCol->GetIdConst(&colID);
  // location, need to check for "lo" not just "l" to avoid "label" column
  if (colID[0] == 'l' && colID[1] == 'o') 
    return FetchLocation(aRow, aValue);
  else
    return nsMsgGroupView::GetCellText(aRow, aCol, aValue);
}

nsresult nsMsgSearchDBView::FetchLocation(PRInt32 aRow, nsAString& aLocationString)
{
  nsCOMPtr <nsIMsgFolder> folder;
  nsresult rv = GetFolderForViewIndex(aRow, getter_AddRefs(folder));
  NS_ENSURE_SUCCESS(rv,rv);
  return folder->GetPrettiestName(aLocationString);
}

nsresult nsMsgSearchDBView::OnNewHeader(nsIMsgDBHdr *newHdr, nsMsgKey aParentKey,
                                        PRBool /*ensureListed*/)
{
   return NS_OK;
}

NS_IMETHODIMP 
nsMsgSearchDBView::OnHdrDeleted(nsIMsgDBHdr *aHdrDeleted, nsMsgKey aParentKey, 
                                PRInt32 aFlags, nsIDBChangeListener *aInstigator)
{
  if (m_viewFlags & nsMsgViewFlagsType::kGroupBySort)
    return nsMsgGroupView::OnHdrDeleted(aHdrDeleted, aParentKey, 
                                        aFlags, aInstigator);
  if (m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay)
  {
    nsMsgViewIndex deletedIndex = FindHdr(aHdrDeleted);
    PRUint32 savedFlags = 0;
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
      viewThread->RemoveChildHdr(aHdrDeleted, nsnull);
      if (deletedIndex == nsMsgViewIndex_None && viewThread->MsgCount() == 1)
      {
        // remove the last child of a collapsed thread. Need to find the root,
        // and remove the thread flags on it.
        nsCOMPtr<nsIMsgDBHdr> rootHdr;
        thread->GetRootHdr(nsnull, getter_AddRefs(rootHdr));
        if (rootHdr)
        {
          nsMsgViewIndex threadIndex = GetThreadRootIndex(rootHdr);
          if (threadIndex != nsMsgViewIndex_None)
            AndExtraFlag(threadIndex, ~(MSG_VIEW_FLAG_ISTHREAD | 
                                        MSG_FLAG_ELIDED | 
                                        MSG_VIEW_FLAG_HASCHILDREN));
        }
      }
      else if (savedFlags & MSG_VIEW_FLAG_HASCHILDREN)
{
        if (savedFlags & MSG_FLAG_ELIDED)
        {
          nsCOMPtr<nsIMsgDBHdr> rootHdr;
          nsresult rv = thread->GetRootHdr(nsnull, getter_AddRefs(rootHdr));
          NS_ENSURE_SUCCESS(rv, rv);
          nsMsgKey msgKey;
          PRUint32 msgFlags;
          rootHdr->GetMessageKey(&msgKey);
          rootHdr->GetFlags(&msgFlags);
          // promote the new thread root
          if (viewThread->MsgCount() > 1)
            msgFlags |= MSG_VIEW_FLAG_ISTHREAD | MSG_FLAG_ELIDED | 
                        MSG_VIEW_FLAG_HASCHILDREN;
          InsertMsgHdrAt(deletedIndex, rootHdr, msgKey, msgFlags, 0);
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

void nsMsgSearchDBView::InsertMsgHdrAt(nsMsgViewIndex index, nsIMsgDBHdr *hdr,
                              nsMsgKey msgKey, PRUint32 flags, PRUint32 level)
{
  m_keys.InsertElementAt(index, msgKey);
  m_flags.InsertElementAt(index, flags);
  m_levels.InsertElementAt(index, level);
  nsCOMPtr<nsIMsgFolder> folder;
  hdr->GetFolder(getter_AddRefs(folder));
  m_folders.InsertObjectAt(folder, index);
}

void nsMsgSearchDBView::SetMsgHdrAt(nsIMsgDBHdr *hdr, nsMsgViewIndex index, 
                              nsMsgKey msgKey, PRUint32 flags, PRUint32 level)
{
  m_keys[index] = msgKey;
  m_flags[index] = flags;
  m_levels[index] = level;
  nsCOMPtr<nsIMsgFolder> folder;
  hdr->GetFolder(getter_AddRefs(folder));
  m_folders.ReplaceObjectAt(folder, index);
}

PRBool nsMsgSearchDBView::InsertEmptyRows(nsMsgViewIndex viewIndex, PRInt32 numRows)
{
  for (PRInt32 i = 0; i < numRows; i++)
    if (!m_folders.InsertObjectAt(nsnull, viewIndex + i))
      return PR_FALSE;
  return nsMsgDBView::InsertEmptyRows(viewIndex, numRows);
}

void nsMsgSearchDBView::RemoveRows(nsMsgViewIndex viewIndex, PRInt32 numRows)
{
  nsMsgDBView::RemoveRows(viewIndex, numRows);
  for (PRInt32 i = 0; i < numRows; i++)
    m_folders.RemoveObjectAt(viewIndex);
}

nsresult nsMsgSearchDBView::GetMsgHdrForViewIndex(nsMsgViewIndex index, 
                                                  nsIMsgDBHdr **msgHdr)
{
  nsresult rv = NS_MSG_INVALID_DBVIEW_INDEX;
  if (index == nsMsgViewIndex_None || index > (PRUint32) m_folders.Count())
    return rv;
  nsIMsgFolder *folder = m_folders[index];
  if (folder)
  {
    nsCOMPtr <nsIMsgDatabase> db;
    nsCOMPtr<nsIMsgWindow> msgWindow(do_QueryReferent(mMsgWindowWeak));
    rv = folder->GetMsgDatabase(msgWindow, getter_AddRefs(db));
    NS_ENSURE_SUCCESS(rv, rv);
    if (db)
      rv = db->GetMsgHdrForKey(m_keys[index], msgHdr);
  }
  return rv;
}

NS_IMETHODIMP nsMsgSearchDBView::GetFolderForViewIndex(nsMsgViewIndex index, nsIMsgFolder **aFolder)
{
  NS_ENSURE_ARG_POINTER(aFolder);
  if (index == nsMsgViewIndex_None || index > (PRUint32) m_folders.Count())
    return NS_MSG_INVALID_DBVIEW_INDEX;
  NS_IF_ADDREF(*aFolder = m_folders[index]);
  return NS_OK;
}

nsresult nsMsgSearchDBView::GetDBForViewIndex(nsMsgViewIndex index, nsIMsgDatabase **db)
{
  nsCOMPtr <nsIMsgFolder> aFolder;
  nsresult rv = GetFolderForViewIndex(index, getter_AddRefs(aFolder));
  NS_ENSURE_SUCCESS(rv, rv);
  return aFolder->GetMsgDatabase(nsnull, db);
}

nsresult nsMsgSearchDBView::AddHdrFromFolder(nsIMsgDBHdr *msgHdr, nsIMsgFolder *folder)
{
  if (m_viewFlags & nsMsgViewFlagsType::kGroupBySort)
    return nsMsgGroupView::OnNewHeader(msgHdr, nsMsgKey_None, PR_TRUE);
  nsMsgKey msgKey;
  PRUint32 msgFlags;
  msgHdr->GetMessageKey(&msgKey);
  msgHdr->GetFlags(&msgFlags);

  if (m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay)
  {
    nsCOMPtr<nsIMsgThread> thread;
    nsCOMPtr<nsIMsgDBHdr> threadRoot;
    // if we find an xf thread in the hash table corresponding to the new msg's
    // message id, a previous header must be a reference child of the new 
    // message, which means we need to reparent later.
    PRBool msgIsReferredTo;
    GetXFThreadFromMsgHdr(msgHdr, getter_AddRefs(thread), &msgIsReferredTo);
    PRBool newThread = !thread;
    nsMsgXFViewThread *viewThread;
    if (!thread)
    {
      viewThread = new nsMsgXFViewThread(this);
      if (!viewThread)
        return NS_ERROR_OUT_OF_MEMORY;
      thread = do_QueryInterface(viewThread);
    }
    else
    {
      viewThread = static_cast<nsMsgXFViewThread*>(thread.get());
      thread->GetChildAt(0, getter_AddRefs(threadRoot));
    }

    AddMsgToHashTables(msgHdr, thread);
    nsCOMPtr<nsIMsgDBHdr> parent;
    PRUint32 posInThread;
    // We need to move threads in order to keep ourselves sorted
    // correctly.  We want the index of the original thread...we can do this by
    // getting the root header before we add the new header, and finding that.
    if (newThread || !viewThread->MsgCount())
    {
      viewThread->AddHdr(msgHdr, PR_FALSE, posInThread,
                         getter_AddRefs(parent));
      nsMsgViewIndex insertIndex = GetIndexForThread(msgHdr);
      NS_ASSERTION(insertIndex == m_levels.Length() || !m_levels[insertIndex],
                    "inserting into middle of thread");
      if (insertIndex == nsMsgViewIndex_None)
        return NS_ERROR_FAILURE;
      if (!(m_viewFlags & nsMsgViewFlagsType::kExpandAll))
        msgFlags |= MSG_FLAG_ELIDED;
      InsertMsgHdrAt(insertIndex, msgHdr, msgKey, msgFlags, 0);
      NoteChange(insertIndex, 1, nsMsgViewNotificationCode::insertOrDelete);
    }
    else
    {
      // get the thread root index before we add the header, because adding
      // the header can change the sort position.
      nsMsgViewIndex threadIndex = GetThreadRootIndex(threadRoot);
      NS_ASSERTION(!m_levels[threadIndex], "threadRoot incorrect, or level incorrect");
      viewThread->AddHdr(msgHdr, msgIsReferredTo, posInThread,
                         getter_AddRefs(parent));

      PRBool moveThread = PR_FALSE;
      if (m_sortType == nsMsgViewSortType::byDate)
      {
        PRUint32 newestMsgInThread = 0, msgDate = 0;
        viewThread->GetNewestMsgDate(&newestMsgInThread);
        msgHdr->GetDateInSeconds(&msgDate);
        moveThread = (msgDate == newestMsgInThread);
      }
      OrExtraFlag(threadIndex, MSG_VIEW_FLAG_HASCHILDREN | MSG_VIEW_FLAG_ISTHREAD);
      if (!(m_flags[threadIndex] & MSG_FLAG_ELIDED))
      {
        if (parent)
        {
          // since we know posInThread, we just want to insert the new hdr
          // at threadIndex + posInThread, and then rebuild the view until we
          // get to a sibling of the new hdr.
          PRUint8 newMsgLevel = viewThread->ChildLevelAt(posInThread);
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
                                          MSG_FLAG_ELIDED | 
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
                                          MSG_FLAG_ELIDED | 
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
  PRBool updatesSuppressed = mSuppressChangeNotification;
  // Turn off tree notifications so that we don't reload the current message.
  if (!updatesSuppressed)
    DisableChangeUpdates();

  nsCOMPtr<nsIMsgDBHdr> threadHdr;
  GetMsgHdrForViewIndex(threadIndex, getter_AddRefs(threadHdr));

  PRUint32 saveFlags = m_flags[threadIndex];
  PRBool threadIsExpanded = !(saveFlags & MSG_FLAG_ELIDED);
  PRInt32 childCount = 0;
  nsMsgKey preservedKey;
  nsAutoTArray<nsMsgKey, 1> preservedSelection;
  PRInt32 selCount;

  SaveAndClearSelection(&preservedKey, preservedSelection);
  if (threadIsExpanded)
  {
    ExpansionDelta(threadIndex, &childCount);
    childCount = -childCount;
  }
  nsTArray<nsMsgKey> threadKeys;
  nsTArray<PRUint32> threadFlags;
  nsTArray<PRUint8> threadLevels;
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
    PRUint32 collapseCount;
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
  PRUint32 msgFlags;
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
  RestoreSelection(preservedKey, preservedSelection);

  if (!updatesSuppressed)
    EnableChangeUpdates();
  nsMsgViewIndex lowIndex = threadIndex < newIndex ? threadIndex : newIndex;
  nsMsgViewIndex highIndex = lowIndex == threadIndex ? newIndex : threadIndex;
  NoteChange(lowIndex, highIndex - lowIndex + childCount, 
              nsMsgViewNotificationCode::changed);
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
  PRInt32 oldSize = GetSize();

  PRInt32 count = m_dbToUseList.Count();
  for(PRInt32 j = 0; j < count; j++) 
    m_dbToUseList[j]->RemoveListener(this);

  m_dbToUseList.Clear();

  m_folders.Clear();
  m_keys.Clear();
  m_levels.Clear();
  m_flags.Clear();

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
nsMsgSearchDBView::GetCommandStatus(nsMsgViewCommandTypeValue command, PRBool *selectable_p, nsMsgViewCommandCheckStateValue *selected_p)
{
  if (command != nsMsgViewCommandType::runJunkControls)
    return nsMsgDBView::GetCommandStatus(command, selectable_p, selected_p);

  *selectable_p = PR_FALSE;
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
      command ==nsMsgViewCommandType::expandAll ||
      command == nsMsgViewCommandType::collapseAll)
    return nsMsgDBView::DoCommand(command);
  nsresult rv = NS_OK;
  nsMsgViewIndexArray selection;
  GetSelectedIndices(selection);

  nsMsgViewIndex *indices = selection.Elements();
  PRInt32 numIndices = selection.Length();

  // we need to break apart the selection by folders, and then call
  // ApplyCommandToIndices with the command and the indices in the
  // selection that are from that folder.

  nsAutoArrayPtr<nsTArray<PRUint32> > indexArrays;
  PRInt32 numArrays;
  rv = PartitionSelectionByFolder(indices, numIndices, getter_Transfers(indexArrays), &numArrays);
  NS_ENSURE_SUCCESS(rv, rv);
  for (PRInt32 folderIndex = 0; folderIndex < numArrays; folderIndex++)
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
          AndExtraFlag(threadIndex, ~(MSG_VIEW_FLAG_ISTHREAD | MSG_FLAG_ELIDED |
                                      MSG_VIEW_FLAG_HASCHILDREN));
          m_levels[threadIndex] = 0;
          NoteChange(threadIndex, 1, nsMsgViewNotificationCode::changed);
        }
      }
      // Bump up the level of all the descendents of the message
      // that was removed, if the thread was expanded.
      PRUint8 removedLevel = m_levels[index];
      nsMsgViewIndex i = index + 1;
      if (i < m_levels.Length() && m_levels[i] > removedLevel)
      {
        // promote the child of the removed message.
        PRUint8 promotedLevel = m_levels[i];
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

nsresult nsMsgSearchDBView::DeleteMessages(nsIMsgWindow *window, nsMsgViewIndex *indices, PRInt32 numIndices, PRBool deleteStorage)
{
   nsresult rv;
   GetFoldersAndHdrsForSelection(indices, numIndices);
   if (mDeleteModel != nsMsgImapDeleteModels::MoveToTrash)
     deleteStorage = PR_TRUE;

   // remember the deleted messages in case the user undoes the delete,
   // and we want to restore the hdr to the view, even if it no
   // longer matches the search criteria.
    for (nsMsgViewIndex i = 0; i < (nsMsgViewIndex) numIndices; i++) 
    {
      nsCOMPtr<nsIMsgDBHdr> msgHdr; 
      (void) GetMsgHdrForViewIndex(indices[i],getter_AddRefs(msgHdr));
      if (msgHdr)
        RememberDeletedMsgHdr(msgHdr);
    }
    if (!deleteStorage)
      rv = ProcessRequestsInOneFolder(window);
    else
      rv = ProcessRequestsInAllFolders(window);
    return rv;
}

nsresult 
nsMsgSearchDBView::CopyMessages(nsIMsgWindow *window, nsMsgViewIndex *indices, PRInt32 numIndices, PRBool isMove, nsIMsgFolder *destFolder)
{
    GetFoldersAndHdrsForSelection(indices, numIndices);
    return ProcessRequestsInOneFolder(window);
}

nsresult
nsMsgSearchDBView::PartitionSelectionByFolder(nsMsgViewIndex *indices, PRInt32 numIndices, nsTArray<PRUint32> **indexArrays, PRInt32 *numArrays)
{
  nsMsgViewIndex i;
  PRInt32 folderIndex;
  nsCOMArray<nsIMsgFolder> uniqueFoldersSelected;
  nsTArray<PRUint32> numIndicesSelected;
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

  PRInt32 numFolders = uniqueFoldersSelected.Count();
  *indexArrays = new nsTArray<PRUint32>[numFolders];
  *numArrays = numFolders;
  NS_ENSURE_TRUE(*indexArrays, NS_ERROR_OUT_OF_MEMORY);
  for (folderIndex = 0; folderIndex < numFolders; folderIndex++)
  {
    (*indexArrays)[folderIndex].SetCapacity(numIndicesSelected[folderIndex]);
  }
  for (i = 0; i < (nsMsgViewIndex) numIndices; i++) 
  {
    nsIMsgFolder *curFolder = m_folders[indices[i]];
    PRInt32 folderIndex = uniqueFoldersSelected.IndexOf(curFolder);
    (*indexArrays)[folderIndex].AppendElement(indices[i]);
  }
  return NS_OK;
}

nsresult
nsMsgSearchDBView::GetFoldersAndHdrsForSelection(nsMsgViewIndex *indices, PRInt32 numIndices)
{
  nsresult rv = NS_OK; 
  mCurIndex = 0;
  m_uniqueFoldersSelected.Clear();
  
  if (!m_hdrsForEachFolder)
  {
    m_hdrsForEachFolder = do_CreateInstance(NS_SUPPORTSARRAY_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv,rv);
  }
  else
    m_hdrsForEachFolder->Clear();

  // Build unique folder list based on headers selected by the user
  for (nsMsgViewIndex i = 0; i < (nsMsgViewIndex) numIndices; i++)
  {
     nsIMsgFolder *curFolder = m_folders[indices[i]];
     if (m_uniqueFoldersSelected.IndexOf(curFolder) < 0)
       m_uniqueFoldersSelected.AppendObject(curFolder);
  }

  // Group the headers selected by each folder
  PRUint32 numFolders = m_uniqueFoldersSelected.Count();
  for (PRUint32 folderIndex = 0; folderIndex < numFolders; folderIndex++)
  {
     nsIMsgFolder *curFolder = m_uniqueFoldersSelected[folderIndex];
     nsCOMPtr<nsIMutableArray> msgHdrsForOneFolder(do_CreateInstance(NS_ARRAY_CONTRACTID));
     for (nsMsgViewIndex i = 0; i < (nsMsgViewIndex) numIndices; i++) 
     {
       nsIMsgFolder *msgFolder = m_folders[indices[i]];
       if (NS_SUCCEEDED(rv) && msgFolder && msgFolder == curFolder) 
       {
          nsCOMPtr<nsIMsgDBHdr> msgHdr; 
          rv = GetMsgHdrForViewIndex(indices[i], getter_AddRefs(msgHdr));
          NS_ENSURE_SUCCESS(rv,rv);
          nsCOMPtr<nsISupports> hdrSupports = do_QueryInterface(msgHdr);
          msgHdrsForOneFolder->AppendElement(hdrSupports, PR_FALSE);
       }
     }
     nsCOMPtr<nsISupports> supports = do_QueryInterface(msgHdrsForOneFolder, &rv);
     if (NS_SUCCEEDED(rv) && supports)
       m_hdrsForEachFolder->AppendElement(supports);
  }
  return rv;
}

nsresult
nsMsgSearchDBView::ApplyCommandToIndicesWithFolder(nsMsgViewCommandTypeValue command, nsMsgViewIndex* indices,
                    PRInt32 numIndices, nsIMsgFolder *destFolder)
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
nsMsgSearchDBView::OnProgress(PRUint32 aProgress, PRUint32 aProgressMax)
{
  return NS_OK;
}

// believe it or not, these next two are msgcopyservice listener methods!
NS_IMETHODIMP
nsMsgSearchDBView::SetMessageKey(PRUint32 aMessageKey)
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
    PRUint32 numFolders = 0;
    if (mCurIndex < (PRUint32) m_uniqueFoldersSelected.Count())
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

    nsIMsgFolder *curFolder = m_uniqueFoldersSelected[mCurIndex];
    NS_ASSERTION(curFolder, "curFolder is null");
    nsCOMPtr<nsIMutableArray> messageArray =
        do_QueryElementAt(m_hdrsForEachFolder, mCurIndex);
    NS_ASSERTION(messageArray, "messageArray is null");

    // called for delete with trash, copy and move
    if (mCommand == nsMsgViewCommandType::deleteMsg)
        curFolder->DeleteMessages(messageArray, window, PR_FALSE /* delete storage */, PR_FALSE /* is move*/, this, PR_TRUE /*allowUndo*/);
    else 
    {
      NS_ASSERTION(!(curFolder == mDestFolder), "The source folder and the destination folder are the same");
      if (NS_SUCCEEDED(rv) && curFolder != mDestFolder)
      {
         nsCOMPtr<nsIMsgCopyService> copyService = do_GetService(NS_MSGCOPYSERVICE_CONTRACTID, &rv);
         if (NS_SUCCEEDED(rv))
         {
           if (mCommand == nsMsgViewCommandType::moveMessages)
             copyService->CopyMessages(curFolder, messageArray, mDestFolder, PR_TRUE /* isMove */, this, window, PR_TRUE /*allowUndo*/);
           else if (mCommand == nsMsgViewCommandType::copyMessages)
             copyService->CopyMessages(curFolder, messageArray, mDestFolder, PR_FALSE /* isMove */, this, window, PR_TRUE /*allowUndo*/);
         }
      }
    }
    return rv;
}

nsresult nsMsgSearchDBView::ProcessRequestsInAllFolders(nsIMsgWindow *window)
{
  PRUint32 numFolders = m_uniqueFoldersSelected.Count();
  for (PRUint32 folderIndex = 0; folderIndex < numFolders; folderIndex++)
  {
    nsIMsgFolder *curFolder = m_uniqueFoldersSelected[folderIndex];
    NS_ASSERTION (curFolder, "curFolder is null");

    nsCOMPtr<nsIMutableArray> messageArray =
           do_QueryElementAt(m_hdrsForEachFolder, folderIndex);
    NS_ASSERTION(messageArray, "messageArray is null");

    curFolder->DeleteMessages(messageArray, window, PR_TRUE /* delete storage */, PR_FALSE /* is move*/, nsnull/*copyServListener*/, PR_FALSE /*allowUndo*/ );
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgSearchDBView::Sort(nsMsgViewSortTypeValue sortType, nsMsgViewSortOrderValue sortOrder)
{
    PRInt32 rowCountBeforeSort = GetSize();

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
  PRInt32 index;
  if (!mTreeSelection)
    return NS_ERROR_NULL_POINTER;
  nsresult rv = mTreeSelection->GetCurrentIndex(&index);
  NS_ENSURE_SUCCESS(rv,rv);

  return GetMsgHdrForViewIndex(index, hdr);
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

nsMsgViewIndex nsMsgSearchDBView::FindHdr(nsIMsgDBHdr *msgHdr)
{
  nsCOMPtr<nsIMsgDBHdr> curHdr;
  PRInt32 index;
  // it would be nice to take advantage of sorted views when possible.
  for (index = 0; index < GetSize(); index++)
  {
    GetMsgHdrForViewIndex(index, getter_AddRefs(curHdr));
    if (curHdr == msgHdr && (!(m_flags[index] & MSG_VIEW_FLAG_DUMMY) ||
        (m_flags[index] & MSG_FLAG_ELIDED)))
      break;
  }
  return index < GetSize() ? index : nsMsgViewIndex_None;
}

// This method looks for the XF thread that corresponds to this message hdr,
// first by looking up the message id, then references, and finally, if subject
// threading is turned on, the subject.
nsresult nsMsgSearchDBView::GetXFThreadFromMsgHdr(nsIMsgDBHdr *msgHdr, 
                                                  nsIMsgThread **pThread,
                                                  PRBool *foundByMessageId)
{
  nsAutoString hashKey;
  nsCAutoString messageId;
  msgHdr->GetMessageId(getter_Copies(messageId));
  CopyASCIItoUTF16(messageId, hashKey);
  *pThread = nsnull;
  m_threadsTable.Get(hashKey, pThread);
  // The caller may want to know if we found the thread by the msgHdr's
  // messageId
  if (foundByMessageId)
    *foundByMessageId = *pThread != nsnull;
  if (!*pThread)
  {
    PRUint16 numReferences = 0;
    msgHdr->GetNumReferences(&numReferences);
    for (PRInt32 i = numReferences - 1; i >= 0  && !*pThread; i--)
    {
      nsCAutoString reference;
      
      msgHdr->GetStringReference(i, reference);
      if (reference.IsEmpty())
        break;

      CopyASCIItoUTF16(reference, hashKey);
      m_threadsTable.Get(hashKey, pThread);
    }
  }
  // if we're threading by subject, and we couldn't find the thread by ref,
  // just treat subject as an other ref.
  if (!*pThread && !gReferenceOnlyThreading)
  {
    nsCString subject;
    msgHdr->GetSubject(getter_Copies(subject));
    // this is the raw rfc822 subject header, so this is OK
    CopyASCIItoUTF16(subject, hashKey);
    m_threadsTable.Get(hashKey, pThread);
  }
  return (*pThread) ? NS_OK : NS_ERROR_FAILURE;
}

nsresult nsMsgSearchDBView::GetMsgHdrFromHash(nsCString &reference, nsIMsgDBHdr **hdr)
{
  nsString hashKey;
  CopyASCIItoUTF16(reference, hashKey);
  return m_hdrsTable.Get(hashKey, hdr);
}

nsresult nsMsgSearchDBView::GetThreadFromHash(nsCString &reference, 
                                              nsIMsgThread **thread)
{
  nsString hashKey;
  CopyASCIItoUTF16(reference, hashKey);
  return m_threadsTable.Get(hashKey, thread);
}

nsresult nsMsgSearchDBView::AddRefToHash(nsCString &reference, 
                                         nsIMsgThread *thread)
{
  nsString hashKey;
  CopyASCIItoUTF16(reference, hashKey);
  // Check if this reference is already is associated with a thread;
  // If so, don't overwrite that association.
  nsCOMPtr<nsIMsgThread> oldThread;
  m_threadsTable.Get(hashKey, getter_AddRefs(oldThread));
  if (oldThread)
    return NS_OK;

  return m_threadsTable.Put(hashKey, thread);
}

nsresult nsMsgSearchDBView::AddMsgToHashTables(nsIMsgDBHdr *msgHdr,
                                               nsIMsgThread *thread)
{
  PRUint16 numReferences = 0;
  nsresult rv;

  msgHdr->GetNumReferences(&numReferences);
  for (PRInt32 i = 0; i < numReferences; i++)
  {
    nsCAutoString reference;
    
    msgHdr->GetStringReference(i, reference);
    if (reference.IsEmpty())
      break;

    rv = AddRefToHash(reference, thread);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  nsCString messageId;
  msgHdr->GetMessageId(getter_Copies(messageId));
  nsString hashKey;
  CopyASCIItoUTF16(messageId, hashKey);
  m_hdrsTable.Put(hashKey, msgHdr);
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
  nsString hashKey;
  CopyASCIItoUTF16(reference, hashKey);
  m_threadsTable.Remove(hashKey);
  return NS_OK;
}

nsresult nsMsgSearchDBView::RemoveMsgFromHashTables(nsIMsgDBHdr *msgHdr)
{
  PRUint16 numReferences = 0;
  nsresult rv = NS_OK;

  msgHdr->GetNumReferences(&numReferences);

  for (PRInt32 i = 0; i < numReferences; i++)
  {
    nsCAutoString reference;
    msgHdr->GetStringReference(i, reference);
    if (reference.IsEmpty())
      break;

    rv = RemoveRefFromHash(reference);
    if (NS_FAILED(rv))
      break;
  }
  nsCString messageId;
  msgHdr->GetMessageId(getter_Copies(messageId));
  nsString hashKey;
  CopyASCIItoUTF16(messageId, hashKey);
  m_hdrsTable.Remove(hashKey);
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

nsresult nsMsgSearchDBView::GetThreadContainingMsgHdr(nsIMsgDBHdr *msgHdr, 
                                                      nsIMsgThread **pThread)
{
  if (m_viewFlags & nsMsgViewFlagsType::kGroupBySort)
    return nsMsgGroupView::GetThreadContainingMsgHdr(msgHdr, pThread);
  else if (m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay)
    return GetXFThreadFromMsgHdr(msgHdr, pThread);

  // if not threaded, use the real thread. 
  nsCOMPtr<nsIMsgFolder> folder;
  nsresult rv = msgHdr->GetFolder(getter_AddRefs(folder));
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr<nsIMsgDatabase> msgDB;
  rv = folder->GetMsgDatabase(nsnull, getter_AddRefs(msgDB));
  NS_ENSURE_SUCCESS(rv, rv);
  return msgDB->GetThreadContainingMsgHdr(msgHdr, pThread);
}

nsresult 
nsMsgSearchDBView::ListIdsInThread(nsIMsgThread *threadHdr, 
                                   nsMsgViewIndex startOfThreadViewIndex, 
                                   PRUint32 *pNumListed)
{
  NS_ENSURE_ARG(threadHdr);
  // these children ids should be in thread order.
  PRUint32 i;
  nsMsgViewIndex viewIndex = startOfThreadViewIndex + 1;
  *pNumListed = 0;

  PRUint32 numChildren;
  threadHdr->GetNumChildren(&numChildren);
  NS_ASSERTION(numChildren, "Empty thread in view/db");
  if (!numChildren)
    return NS_OK;

  numChildren--; // account for the existing thread root
  if (!InsertEmptyRows(viewIndex, numChildren))
    return NS_ERROR_OUT_OF_MEMORY;

  PRBool threadedView = m_viewFlags & nsMsgViewFlagsType::kThreadedDisplay &&
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
      PRUint32 msgFlags;
      msgHdr->GetMessageKey(&msgKey);
      msgHdr->GetFlags(&msgFlags);
      PRUint8 level = (threadedView) ? viewThread->ChildLevelAt(i) : 1;
      SetMsgHdrAt(msgHdr, viewIndex, msgKey, msgFlags & ~MSG_VIEW_FLAGS, 
                  level);
      (*pNumListed)++;
      viewIndex++;
    }
  }
  return NS_OK;
}

