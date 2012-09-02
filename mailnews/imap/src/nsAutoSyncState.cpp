/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsAutoSyncState.h"
#include "nsImapMailFolder.h"
#include "nsMsgImapCID.h"
#include "nsIMsgMailNewsUrl.h"
#include "nsMsgKeyArray.h"
#include "nsIMsgWindow.h"
#include "nsIMsgMailSession.h"
#include "nsMsgFolderFlags.h"
#include "nsIAutoSyncManager.h"
#include "nsIAutoSyncMsgStrategy.h"
#include "nsServiceManagerUtils.h"
#include "nsComponentManagerUtils.h"

extern PRLogModuleInfo *gAutoSyncLog;

MsgStrategyComparatorAdaptor::MsgStrategyComparatorAdaptor(nsIAutoSyncMsgStrategy* aStrategy, 
  nsIMsgFolder *aFolder, nsIMsgDatabase *aDatabase) : mStrategy(aStrategy), mFolder(aFolder), 
    mDatabase(aDatabase)
{
}

/** @return True if the elements are equals; false otherwise. */
bool MsgStrategyComparatorAdaptor::Equals(const nsMsgKey& a, const nsMsgKey& b) const
{
  nsCOMPtr<nsIMsgDBHdr> hdrA;
  nsCOMPtr<nsIMsgDBHdr> hdrB;
  
  mDatabase->GetMsgHdrForKey(a, getter_AddRefs(hdrA));
  mDatabase->GetMsgHdrForKey(b, getter_AddRefs(hdrB));
  
  if (hdrA && hdrB)
  {
    nsresult rv;
    nsAutoSyncStrategyDecisionType decision = nsAutoSyncStrategyDecisions::Same;
    
    nsCOMPtr<nsIMsgFolder> folder = do_QueryInterface(mFolder);
    if (mStrategy)
      rv = mStrategy->Sort(folder, hdrA, hdrB, &decision);
    
    if (NS_SUCCEEDED(rv))
      return (decision == nsAutoSyncStrategyDecisions::Same);
  }
  
  return false;
}

/** @return True if (a < b); false otherwise. */
bool MsgStrategyComparatorAdaptor::LessThan(const nsMsgKey& a, const nsMsgKey& b) const
{
  nsCOMPtr<nsIMsgDBHdr> hdrA;
  nsCOMPtr<nsIMsgDBHdr> hdrB;
  
  mDatabase->GetMsgHdrForKey(a, getter_AddRefs(hdrA));
  mDatabase->GetMsgHdrForKey(b, getter_AddRefs(hdrB));

  if (hdrA && hdrB)
  {
    nsresult rv;
    nsAutoSyncStrategyDecisionType decision = nsAutoSyncStrategyDecisions::Same;

    nsCOMPtr<nsIMsgFolder> folder = do_QueryInterface(mFolder);
    if (mStrategy)
      rv = mStrategy->Sort(folder, hdrA, hdrB, &decision);

    if (NS_SUCCEEDED(rv))
      return (decision == nsAutoSyncStrategyDecisions::Lower);
  }
  
  return false;
}

nsAutoSyncState::nsAutoSyncState(nsImapMailFolder *aOwnerFolder, PRTime aLastSyncTime)
  : mSyncState(stCompletedIdle), mOffset(0U), mLastOffset(0U), mLastServerTotal(0),
    mLastServerRecent(0), mLastServerUnseen(0), mLastNextUID(0),
    mLastSyncTime(aLastSyncTime), mLastUpdateTime(0UL), mProcessPointer(0U),
    mIsDownloadQChanged(false), mRetryCounter(0U)
{
  mOwnerFolder = do_GetWeakReference(static_cast<nsIMsgImapMailFolder*>(aOwnerFolder));
}

nsAutoSyncState::~nsAutoSyncState()
{
}

// TODO:XXXemre should be implemented when we start
// doing space management
nsresult nsAutoSyncState::ManageStorageSpace()
{
  return NS_OK;
}

nsresult nsAutoSyncState::PlaceIntoDownloadQ(const nsTArray<nsMsgKey> &aMsgKeyList)
{
  nsresult rv;
  if (!aMsgKeyList.IsEmpty())
  {
    nsCOMPtr <nsIMsgFolder> folder = do_QueryReferent(mOwnerFolder, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
        
    nsCOMPtr<nsIMsgDatabase> database;
    rv = folder->GetMsgDatabase(getter_AddRefs(database));
    if (!database)
      return NS_ERROR_FAILURE;
    
    nsCOMPtr<nsIAutoSyncManager> autoSyncMgr = do_GetService(NS_AUTOSYNCMANAGER_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv,rv);
    
    nsCOMPtr<nsIAutoSyncMsgStrategy> msgStrategy;
    autoSyncMgr->GetMsgStrategy(getter_AddRefs(msgStrategy));
    
    // increase the array size
    mDownloadQ.SetCapacity(mDownloadQ.Length() + aMsgKeyList.Length());
    
    // remove excluded messages
    int32_t elemCount = aMsgKeyList.Length();
    for (int32_t idx = 0; idx < elemCount; idx++)
    {
      nsCOMPtr<nsIMsgDBHdr> hdr;
      bool containsKey;
      database->ContainsKey(aMsgKeyList[idx], &containsKey);
      if (!containsKey)
        continue;
      rv = database->GetMsgHdrForKey(aMsgKeyList[idx], getter_AddRefs(hdr));
      if(!hdr)
        continue; // can't get message header, continue with the next one
      
      bool doesFit = true;
      rv = autoSyncMgr->DoesMsgFitDownloadCriteria(hdr, &doesFit);
      if (NS_SUCCEEDED(rv) && !mDownloadQ.Contains(aMsgKeyList[idx]) && doesFit)
      {
        bool excluded = false;
        if (msgStrategy)
        {
          rv = msgStrategy->IsExcluded(folder, hdr, &excluded);
          
          if (NS_SUCCEEDED(rv) && !excluded)
          {
            mIsDownloadQChanged = true;
            mDownloadQ.AppendElement(aMsgKeyList[idx]);
          }
        }
      }
    }//endfor

    if (mIsDownloadQChanged)
    {
      LogOwnerFolderName("Download Q is created for ");
      LogQWithSize(mDownloadQ, 0);
      rv = autoSyncMgr->OnDownloadQChanged(this);
    }
    
  }
  return rv;
}

nsresult nsAutoSyncState::SortQueueBasedOnStrategy(nsTArray<nsMsgKey> &aQueue)
{
  nsresult rv;
  nsCOMPtr <nsIMsgFolder> folder = do_QueryReferent(mOwnerFolder, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIMsgDatabase> database;
  rv = folder->GetMsgDatabase(getter_AddRefs(database));
  if (!database)
    return NS_ERROR_FAILURE;

  nsCOMPtr<nsIAutoSyncManager> autoSyncMgr = do_GetService(NS_AUTOSYNCMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAutoSyncMsgStrategy> msgStrategy;
  rv = autoSyncMgr->GetMsgStrategy(getter_AddRefs(msgStrategy));
  NS_ENSURE_SUCCESS(rv, rv);

  MsgStrategyComparatorAdaptor strategyComp(msgStrategy, folder, database);
  aQueue.Sort(strategyComp);

  return rv;
}

// This method is a hack to prioritize newly inserted messages,
// without changing the size of the queue. It is required since 
// we cannot sort ranges in nsTArray.
nsresult nsAutoSyncState::SortSubQueueBasedOnStrategy(nsTArray<nsMsgKey> &aQueue,
                                                      uint32_t aStartingOffset)
{
  NS_ASSERTION(aStartingOffset < aQueue.Length(), "*** Starting offset is out of range");

  // Copy already downloaded messages into a temporary queue,
  // we want to exclude them from the sort.
  nsTArray<nsMsgKey> tmpQ;
  tmpQ.AppendElements(aQueue.Elements(), aStartingOffset);

  // Remove already downloaded messages and sort the resulting queue
  aQueue.RemoveElementsAt(0, aStartingOffset);

  nsresult rv = SortQueueBasedOnStrategy(aQueue);

  // copy excluded messages back
  aQueue.InsertElementsAt(0, tmpQ);

  return rv;
}

NS_IMETHODIMP nsAutoSyncState::GetNextGroupOfMessages(uint32_t aSuggestedGroupSizeLimit, 
                                                      uint32_t *aActualGroupSize, 
                                                      nsIMutableArray **aMessagesList)
{
  NS_ENSURE_ARG_POINTER(aMessagesList);
  NS_ENSURE_ARG_POINTER(aActualGroupSize);

  *aActualGroupSize = 0;

  nsresult rv;
  nsCOMPtr <nsIMsgFolder> folder = do_QueryReferent(mOwnerFolder, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIMsgDatabase> database;
  folder->GetMsgDatabase(getter_AddRefs(database));

  nsCOMPtr<nsIMutableArray> group = do_CreateInstance(NS_ARRAY_CONTRACTID);
  if (database)
  {
    if (!mDownloadQ.IsEmpty())
    {
      // sort the download queue if new items are added since the last time
      if (mIsDownloadQChanged)
      {
        // we want to sort only pending messages. mOffset is
        // the position of the first pending message in the download queue
        rv = (mOffset > 0)
          ? SortSubQueueBasedOnStrategy(mDownloadQ, mOffset)
          : SortQueueBasedOnStrategy(mDownloadQ);

        if (NS_SUCCEEDED(rv))
          mIsDownloadQChanged = false;
      }

      nsCOMPtr<nsIAutoSyncManager> autoSyncMgr = do_GetService(NS_AUTOSYNCMANAGER_CONTRACTID, &rv);
      NS_ENSURE_SUCCESS(rv, rv);

      uint32_t msgCount = mDownloadQ.Length();
      uint32_t idx = mOffset;

      nsCOMPtr<nsIAutoSyncMsgStrategy> msgStrategy;
      autoSyncMgr->GetMsgStrategy(getter_AddRefs(msgStrategy));

      for (; idx < msgCount; idx++)
      {
        bool containsKey = false;
        database->ContainsKey(mDownloadQ[idx], &containsKey);
        if (!containsKey)
        {
          mDownloadQ.RemoveElementAt(idx--);
          msgCount--;
          continue;
        }
        nsCOMPtr<nsIMsgDBHdr> qhdr;
        database->GetMsgHdrForKey(mDownloadQ[idx], getter_AddRefs(qhdr));
        if(!qhdr)
          continue; //maybe deleted, skip it!

        // ensure that we don't have this message body offline already,
        // possible if the user explicitly selects this message prior
        // to auto-sync kicks in
        uint32_t msgFlags = 0;
        qhdr->GetFlags(&msgFlags);
        if (msgFlags & nsMsgMessageFlags::Offline)
          continue;

        // this check point allows msg strategy function
        // to do last minute decisions based on the current
        // state of TB such as the size of the message store etc.
        if (msgStrategy)
        {
          bool excluded = false;
          if (NS_SUCCEEDED(msgStrategy->IsExcluded(folder, qhdr, &excluded)) && excluded)
            continue;
        }

        uint32_t msgSize;
        qhdr->GetMessageSize(&msgSize);
        // ignore 0 byte messages; the imap parser asserts when we try 
        // to download them, and there's no point anyway.
        if (!msgSize)
          continue;

        if (!*aActualGroupSize && msgSize >= aSuggestedGroupSizeLimit) 
        {
          *aActualGroupSize = msgSize;
          group->AppendElement(qhdr, false);
          idx++;
          break;
        }
        else if ((*aActualGroupSize) + msgSize > aSuggestedGroupSizeLimit)
          break;
        else
        {
          group->AppendElement(qhdr, false);
          *aActualGroupSize += msgSize;
        }
      }// endfor

      mLastOffset = mOffset;
      mOffset = idx;
    }

    LogOwnerFolderName("Next group of messages to be downloaded.");
    LogQWithSize(group.get(), 0);
  } //endif

   // return it to the caller
  NS_IF_ADDREF(*aMessagesList = group);

  return NS_OK;
}

/**
 * Usually called by nsAutoSyncManager when the last sync time is expired.
 */
NS_IMETHODIMP nsAutoSyncState::ProcessExistingHeaders(uint32_t aNumOfHdrsToProcess, uint32_t *aLeftToProcess)
{
  NS_ENSURE_ARG_POINTER(aLeftToProcess);

  nsresult rv;
  nsCOMPtr <nsIMsgFolder> folder = do_QueryReferent(mOwnerFolder, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIMsgDatabase> database;
  rv = folder->GetMsgDatabase(getter_AddRefs(database));
  if (!database)
    return NS_ERROR_FAILURE;

  // create a queue to process existing headers for the first time
  if (mExistingHeadersQ.IsEmpty())
  {
    nsRefPtr<nsMsgKeyArray> keys = new nsMsgKeyArray;
    rv = database->ListAllKeys(keys);
    NS_ENSURE_SUCCESS(rv, rv);
    mExistingHeadersQ.AppendElements(keys->m_keys);
    mProcessPointer = 0;
  }

  // process the existing headers and find the messages not downloaded yet
  uint32_t lastIdx = mProcessPointer;
  nsTArray<nsMsgKey> msgKeys;
  uint32_t keyCount = mExistingHeadersQ.Length();
  for (; mProcessPointer < (lastIdx + aNumOfHdrsToProcess) && mProcessPointer < keyCount; mProcessPointer++)
  {
    nsCOMPtr<nsIMsgDBHdr> hdr;
    rv = database->GetMsgHdrForKey(mExistingHeadersQ[mProcessPointer], getter_AddRefs(hdr));
    if (hdr)
    {
      uint32_t msgFlags = 0;
      hdr->GetFlags(&msgFlags);

      if (!(msgFlags & nsMsgMessageFlags::Offline))
        msgKeys.AppendElement(mExistingHeadersQ[mProcessPointer]);
    }
  }
  if (!msgKeys.IsEmpty())
  {
    nsCString folderName;
    folder->GetURI(folderName);
    PR_LOG(gAutoSyncLog, PR_LOG_DEBUG,
          ("%d messages will be added into the download q of folder %s\n",
            msgKeys.Length(), folderName.get()));

    rv = PlaceIntoDownloadQ(msgKeys);
    if (NS_FAILED(rv))
      mProcessPointer = lastIdx;
  }

  *aLeftToProcess = keyCount - mProcessPointer;

  // cleanup if we are done processing
  if (0 == *aLeftToProcess)
  {
    mLastSyncTime = PR_Now();
    mExistingHeadersQ.Clear();
    mProcessPointer = 0;
    folder->SetMsgDatabase(nullptr);
  }

  return rv;
}

void nsAutoSyncState::OnNewHeaderFetchCompleted(const nsTArray<nsMsgKey> &aMsgKeyList)
{
  SetLastUpdateTime(PR_Now());
  if (!aMsgKeyList.IsEmpty())
    PlaceIntoDownloadQ(aMsgKeyList);
}

NS_IMETHODIMP nsAutoSyncState::UpdateFolder()
{
  nsresult rv;
  nsCOMPtr<nsIAutoSyncManager> autoSyncMgr = do_GetService(NS_AUTOSYNCMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr<nsIUrlListener> autoSyncMgrListener = do_QueryInterface(autoSyncMgr, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr <nsIMsgImapMailFolder> imapFolder = do_QueryReferent(mOwnerFolder, &rv);
  SetState(nsAutoSyncState::stUpdateIssued);
  return imapFolder->UpdateFolderWithListener(nullptr, autoSyncMgrListener);
}

NS_IMETHODIMP nsAutoSyncState::OnStartRunningUrl(nsIURI* aUrl)
{
  nsresult rv = NS_OK;
    
  // if there is a problem to start the download, set rv with the
  // corresponding error code. In that case, AutoSyncManager is going to
  // set the autosync state to nsAutoSyncState::stReadyToDownload
  // to resume downloading another time
  
  // TODO: is there a way to make sure that download started without
  // problem through nsIURI interface?

  nsCOMPtr<nsIAutoSyncManager> autoSyncMgr = do_GetService(NS_AUTOSYNCMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  
  return autoSyncMgr->OnDownloadStarted(this, rv);
}

NS_IMETHODIMP nsAutoSyncState::OnStopRunningUrl(nsIURI* aUrl, nsresult aExitCode)
{
  nsresult rv;
  nsCOMPtr <nsIMsgFolder> ownerFolder = do_QueryReferent(mOwnerFolder, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr<nsIAutoSyncManager> autoSyncMgr = do_GetService(NS_AUTOSYNCMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr<nsIUrlListener> autoSyncMgrListener = do_QueryInterface(autoSyncMgr, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  if (mSyncState == stStatusIssued)
  {
    nsCOMPtr <nsIMsgImapMailFolder> imapFolder = do_QueryReferent(mOwnerFolder, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    int32_t serverTotal, serverUnseen, serverRecent, serverNextUID;
    imapFolder->GetServerTotal(&serverTotal);
    imapFolder->GetServerUnseen(&serverUnseen);
    imapFolder->GetServerRecent(&serverRecent);
    imapFolder->GetServerNextUID(&serverNextUID);
    if (serverNextUID != mLastNextUID || serverTotal != mLastServerTotal ||
        serverUnseen != mLastServerUnseen || serverRecent != mLastServerRecent)
    {
      nsCString folderName;
      ownerFolder->GetURI(folderName);
      PR_LOG(gAutoSyncLog, PR_LOG_DEBUG,
             ("folder %s status changed serverNextUID = %lx lastNextUID = %lx\n", folderName.get(),
              serverNextUID, mLastNextUID));
      PR_LOG(gAutoSyncLog, PR_LOG_DEBUG,
             ("serverTotal = %lx lastServerTotal = %lx serverRecent = %lx lastServerRecent = %lx\n",
              serverTotal, mLastServerTotal, serverRecent, mLastServerRecent));
      SetServerCounts(serverTotal, serverRecent, serverUnseen, serverNextUID);
      SetState(nsAutoSyncState::stUpdateIssued);
      return imapFolder->UpdateFolderWithListener(nullptr, autoSyncMgrListener);
    }
    else
    {
      ownerFolder->SetMsgDatabase(nullptr);
      // nothing more to do.
      SetState(nsAutoSyncState::stCompletedIdle);
      // autoSyncMgr needs this notification, so manufacture it.
      return autoSyncMgrListener->OnStopRunningUrl(nullptr, NS_OK);
    }
  }
  //XXXemre how we recover from this error?
  rv = ownerFolder->ReleaseSemaphore(ownerFolder);
  NS_ASSERTION(NS_SUCCEEDED(rv), "*** Cannot release folder semaphore");

  nsCOMPtr<nsIMsgMailNewsUrl> mailUrl = do_QueryInterface(aUrl);
  if (mailUrl)
    rv = mailUrl->UnRegisterListener(this);

  return autoSyncMgr->OnDownloadCompleted(this, aExitCode);
}

NS_IMETHODIMP nsAutoSyncState::GetState(int32_t *aState)
{
  NS_ENSURE_ARG_POINTER(aState);
  *aState = mSyncState;
  return NS_OK;
}

const char *stateStrings[] = {"idle", "status issued", "update needed",
                              "update issued", "downloading",
                              "ready to download"};

NS_IMETHODIMP nsAutoSyncState::SetState(int32_t aState)
{
  mSyncState = aState;
  if (aState == stCompletedIdle)
  {
    ResetDownloadQ();
    //tell folder to let go of its cached msg db pointer
    nsresult rv;
    nsCOMPtr<nsIMsgMailSession> session =
             do_GetService(NS_MSGMAILSESSION_CONTRACTID, &rv);
    if (NS_SUCCEEDED(rv) && session)
    {
      nsCOMPtr <nsIMsgFolder> ownerFolder = do_QueryReferent(mOwnerFolder, &rv);
      NS_ENSURE_SUCCESS(rv, rv);

      bool folderOpen;
      uint32_t folderFlags;
      ownerFolder->GetFlags(&folderFlags);
      session->IsFolderOpenInWindow(ownerFolder, &folderOpen);
      if (!folderOpen && ! (folderFlags & nsMsgFolderFlags::Inbox))
        ownerFolder->SetMsgDatabase(nullptr);
    }
  }
  nsCString logStr("Sync State set to ");
  logStr.Append(stateStrings[aState]);
  logStr.Append(" for ");
  LogOwnerFolderName(logStr.get());
  return NS_OK;
}

NS_IMETHODIMP nsAutoSyncState::TryCurrentGroupAgain(uint32_t aRetryCount)
{
  SetState(stReadyToDownload);

  nsresult rv;
  if (++mRetryCounter > aRetryCount)
  {
    ResetRetryCounter();
    rv = NS_ERROR_FAILURE;
  }
  else
    rv = Rollback();
    
  return rv;
}

NS_IMETHODIMP nsAutoSyncState::ResetRetryCounter()
{
  mRetryCounter = 0;
  return NS_OK;
}

NS_IMETHODIMP nsAutoSyncState::GetPendingMessageCount(int32_t *aMsgCount)
{
  NS_ENSURE_ARG_POINTER(aMsgCount);
  *aMsgCount = mDownloadQ.Length() - mOffset;
  return NS_OK;
}

NS_IMETHODIMP nsAutoSyncState::GetTotalMessageCount(int32_t *aMsgCount)
{
  NS_ENSURE_ARG_POINTER(aMsgCount);
  *aMsgCount = mDownloadQ.Length();
  return NS_OK;
}

NS_IMETHODIMP nsAutoSyncState::GetOwnerFolder(nsIMsgFolder **aFolder)
{
  NS_ENSURE_ARG_POINTER(aFolder);
  
  nsresult rv;
  nsCOMPtr <nsIMsgFolder> ownerFolder = do_QueryReferent(mOwnerFolder, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  
  NS_IF_ADDREF(*aFolder = ownerFolder);
  return NS_OK;
}

NS_IMETHODIMP nsAutoSyncState::Rollback()
{
  mOffset = mLastOffset;
  return NS_OK;
}

NS_IMETHODIMP nsAutoSyncState::ResetDownloadQ()
{
  mOffset = mLastOffset = 0;
  mDownloadQ.Clear();
  mDownloadQ.Compact();
  
  return NS_OK;
}

/**
 * Tests whether the given folder is owned by the same imap server
 * or not.
 */
NS_IMETHODIMP nsAutoSyncState::IsSibling(nsIAutoSyncState *aAnotherStateObj, bool *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  *aResult = false;

  nsresult rv;
  nsCOMPtr<nsIMsgFolder> folderA, folderB;
  
  rv = GetOwnerFolder(getter_AddRefs(folderA));
  NS_ENSURE_SUCCESS(rv,rv);
  
  rv = aAnotherStateObj->GetOwnerFolder(getter_AddRefs(folderB));
  NS_ENSURE_SUCCESS(rv,rv);
  
  nsCOMPtr <nsIMsgIncomingServer> serverA, serverB;
  rv = folderA->GetServer(getter_AddRefs(serverA));
  NS_ENSURE_SUCCESS(rv,rv);
  rv = folderB->GetServer(getter_AddRefs(serverB));
  NS_ENSURE_SUCCESS(rv,rv);
  
  bool isSibling;
  rv = serverA->Equals(serverB, &isSibling);
  
  if (NS_SUCCEEDED(rv))
    *aResult = isSibling;
  
  return rv;
}


NS_IMETHODIMP nsAutoSyncState::DownloadMessagesForOffline(nsIArray *aMessagesList)
{
  NS_ENSURE_ARG_POINTER(aMessagesList);
  
  uint32_t count;
  nsresult rv = aMessagesList->GetLength(&count);
  NS_ENSURE_SUCCESS(rv,rv);
  
  nsCOMPtr<nsIImapService> imapService = do_GetService(NS_IMAPSERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);
  
  nsAutoCString messageIds;
  nsTArray<nsMsgKey> msgKeys;
  
  rv = nsImapMailFolder::BuildIdsAndKeyArray(aMessagesList, messageIds, msgKeys);  
  if (NS_FAILED(rv) || messageIds.IsEmpty()) 
    return rv;

  // acquire semaphore for offline store. If it fails, we won't download
  nsCOMPtr <nsIMsgFolder> folder = do_QueryReferent(mOwnerFolder, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  
  rv = folder->AcquireSemaphore(folder);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCString folderName;
  folder->GetURI(folderName);
  PR_LOG(gAutoSyncLog, PR_LOG_DEBUG, ("downloading %s for %s", messageIds.get(),
           folderName.get()));
  // start downloading
  rv = imapService->DownloadMessagesForOffline(messageIds, 
                                               folder, 
                                               this, 
                                               nullptr);
  if (NS_SUCCEEDED(rv))
    SetState(stDownloadInProgress);                                              

  return rv;
}

NS_IMETHODIMP nsAutoSyncState::GetLastSyncTime(PRTime *aLastSyncTime)
{
  NS_ENSURE_ARG_POINTER(aLastSyncTime);
  *aLastSyncTime = mLastSyncTime;
  return NS_OK;
}

void nsAutoSyncState::SetLastSyncTimeInSec(int32_t aLastSyncTime)
{
  mLastSyncTime = ((PRTime)aLastSyncTime * PR_USEC_PER_SEC);
}


NS_IMETHODIMP nsAutoSyncState::GetLastUpdateTime(PRTime *aLastUpdateTime)
{
  NS_ENSURE_ARG_POINTER(aLastUpdateTime);
  *aLastUpdateTime = mLastUpdateTime;
  return NS_OK;
}

NS_IMETHODIMP nsAutoSyncState::SetLastUpdateTime(PRTime aLastUpdateTime)
{
  mLastUpdateTime = aLastUpdateTime;
  return NS_OK;
}

void nsAutoSyncState::SetServerCounts(int32_t total, int32_t recent,
                                      int32_t unseen, int32_t nextUID)
{
  mLastServerTotal = total;
  mLastServerRecent = recent;
  mLastServerUnseen = unseen;
  mLastNextUID = nextUID;
}

NS_IMPL_ISUPPORTS2(nsAutoSyncState, nsIAutoSyncState, nsIUrlListener)


void nsAutoSyncState::LogQWithSize(nsTArray<nsMsgKey>& q, uint32_t toOffset)
{
  nsCOMPtr <nsIMsgFolder> ownerFolder = do_QueryReferent(mOwnerFolder);
  if (ownerFolder)
  {
    nsCOMPtr<nsIMsgDatabase> database;
    ownerFolder->GetMsgDatabase(getter_AddRefs(database));
    
    uint32_t x = q.Length();
    while (x > toOffset && database) 
    {
      x--;
      nsCOMPtr<nsIMsgDBHdr> h;
      database->GetMsgHdrForKey(q[x], getter_AddRefs(h));
      uint32_t s;
      if (h)
      {
        h->GetMessageSize(&s);
        PR_LOG(gAutoSyncLog, PR_LOG_DEBUG,
              ("Elem #%d, size: %u bytes\n", x+1, s));
      }
      else
        PR_LOG(gAutoSyncLog, PR_LOG_DEBUG, ("unable to get header for key %ul", q[x]));
    }
  }
}

void nsAutoSyncState::LogQWithSize(nsIMutableArray *q, uint32_t toOffset)
{
  nsCOMPtr <nsIMsgFolder> ownerFolder = do_QueryReferent(mOwnerFolder);
  if (ownerFolder)
  {
    nsCOMPtr<nsIMsgDatabase> database;
    ownerFolder->GetMsgDatabase(getter_AddRefs(database));

    uint32_t x;
    q->GetLength(&x);
    while (x > toOffset && database) 
    {
      x--;
      nsCOMPtr<nsIMsgDBHdr> h;
      q->QueryElementAt(x, NS_GET_IID(nsIMsgDBHdr),
                        getter_AddRefs(h));
      uint32_t s;
      if (h)
      {
        h->GetMessageSize(&s);
        PR_LOG(gAutoSyncLog, PR_LOG_DEBUG,
              ("Elem #%d, size: %u bytes\n", x+1, s));
      }
      else
        PR_LOG(gAutoSyncLog, PR_LOG_DEBUG, ("null header in q at index %ul", x));
    }
  }
}

void nsAutoSyncState::LogOwnerFolderName(const char *s)
{
  nsCOMPtr <nsIMsgFolder> ownerFolder = do_QueryReferent(mOwnerFolder);
  if (ownerFolder)
  {
    nsCString folderName;
    ownerFolder->GetURI(folderName);
    PR_LOG(gAutoSyncLog, PR_LOG_DEBUG,
           ("*** %s Folder: %s ***\n", s, folderName.get()));
  }
}
