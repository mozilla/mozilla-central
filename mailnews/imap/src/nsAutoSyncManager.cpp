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
 * The Initial Developer of the Original Code is Mozilla Messaging, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Emre Birol  <ebirol@gmail.com> (Original Author)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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
 
#include "nsAutoSyncManager.h"
#include "nsAutoSyncState.h"
#include "nsIIdleService.h"
#include "nsImapMailFolder.h"
#include "nsMsgImapCID.h"
#include "nsIMsgMailNewsUrl.h"
#include "nsIMsgAccountManager.h"
#include "nsIMsgIncomingServer.h"
#include "nsMsgFolderFlags.h"
#include "nsImapIncomingServer.h"
#include "nsMsgUtils.h"

NS_IMPL_ISUPPORTS1(nsDefaultAutoSyncMsgStrategy, nsIAutoSyncMsgStrategy)

nsDefaultAutoSyncMsgStrategy::nsDefaultAutoSyncMsgStrategy()
{
}

nsDefaultAutoSyncMsgStrategy::~nsDefaultAutoSyncMsgStrategy()
{
}

NS_IMETHODIMP nsDefaultAutoSyncMsgStrategy::Sort(nsIMsgFolder *aFolder, 
  nsIMsgDBHdr *aMsgHdr1, nsIMsgDBHdr *aMsgHdr2, nsAutoSyncStrategyDecisionType *aDecision)
{
  NS_ENSURE_ARG_POINTER(aDecision);

  PRUint32 msgSize1 = 0, msgSize2 = 0;
  PRTime msgDate1 = 0, msgDate2 = 0;
  
  if (!aMsgHdr1 || !aMsgHdr2)
  {
    *aDecision = nsAutoSyncStrategyDecisions::Same;
    return NS_OK;
  }
  
  aMsgHdr1->GetMessageSize(&msgSize1);
  aMsgHdr1->GetDate(&msgDate1);
  
  aMsgHdr2->GetMessageSize(&msgSize2);
  aMsgHdr2->GetDate(&msgDate2);
  
  //Special case: if message size is larger than a 
  // certain size, then place it to the bottom of the q
  if (msgSize2 > kFirstPassMessageSize && msgSize1 > kFirstPassMessageSize)
    *aDecision = msgSize2 > msgSize1 ? 
        nsAutoSyncStrategyDecisions::Lower : nsAutoSyncStrategyDecisions::Higher;
  else if (msgSize2 > kFirstPassMessageSize)
    *aDecision = nsAutoSyncStrategyDecisions::Lower;
  else if (msgSize1 > kFirstPassMessageSize)
    *aDecision = nsAutoSyncStrategyDecisions::Higher;
  else
  {
    // Most recent and smallest first
    if (msgDate1 < msgDate2)
      *aDecision = nsAutoSyncStrategyDecisions::Higher;
    else if (msgDate1 > msgDate2)
      *aDecision = nsAutoSyncStrategyDecisions::Lower;
    else 
    {
      if (msgSize1 > msgSize2)
        *aDecision = nsAutoSyncStrategyDecisions::Higher;
      else if (msgSize1 < msgSize2)
        *aDecision = nsAutoSyncStrategyDecisions::Lower;
      else
        *aDecision = nsAutoSyncStrategyDecisions::Same;
    }
  }
  return NS_OK;
}

NS_IMETHODIMP nsDefaultAutoSyncMsgStrategy::IsExcluded(nsIMsgFolder *aFolder, 
  nsIMsgDBHdr *aMsgHdr, PRBool *aDecision)
{
  NS_ENSURE_ARG_POINTER(aDecision);
  *aDecision = PR_FALSE;  
  return NS_OK;
}

NS_IMPL_ISUPPORTS1(nsDefaultAutoSyncFolderStrategy, nsIAutoSyncFolderStrategy)

nsDefaultAutoSyncFolderStrategy::nsDefaultAutoSyncFolderStrategy()
{
}

nsDefaultAutoSyncFolderStrategy::~nsDefaultAutoSyncFolderStrategy()
{
}

NS_IMETHODIMP nsDefaultAutoSyncFolderStrategy::Sort(nsIMsgFolder *aFolderA, 
  nsIMsgFolder *aFolderB, nsAutoSyncStrategyDecisionType *aDecision)
{
  NS_ENSURE_ARG_POINTER(aDecision);

  if (!aFolderA || !aFolderB)
  {
    *aDecision = nsAutoSyncStrategyDecisions::Same;
    return NS_OK;
  }
  
  PRBool isInbox1, isInbox2, isDrafts1, isDrafts2, isTrash1, isTrash2;
  aFolderA->GetFlag(nsMsgFolderFlags::Inbox, &isInbox1);
  aFolderB->GetFlag(nsMsgFolderFlags::Inbox, &isInbox2);
  //
  aFolderA->GetFlag(nsMsgFolderFlags::Drafts, &isDrafts1);
  aFolderB->GetFlag(nsMsgFolderFlags::Drafts, &isDrafts2);
  //
  aFolderA->GetFlag(nsMsgFolderFlags::Trash, &isTrash1);
  aFolderB->GetFlag(nsMsgFolderFlags::Trash, &isTrash2);
  
  //Follow this order;
  // INBOX > DRAFTS > SUBFOLDERS > TRASH
  
  if (isInbox2 || (isDrafts2 && !isInbox1) || isTrash1)
    *aDecision = nsAutoSyncStrategyDecisions::Higher;
  else if (isInbox1 || (isDrafts1 && !isDrafts2) || isTrash2)
    *aDecision = nsAutoSyncStrategyDecisions::Lower;
  else
    *aDecision = nsAutoSyncStrategyDecisions::Same;
    
  return NS_OK;
}

NS_IMETHODIMP 
nsDefaultAutoSyncFolderStrategy::IsExcluded(nsIMsgFolder *aFolder, PRBool *aDecision)
{
  NS_ENSURE_ARG_POINTER(aDecision);
  *aDecision = PR_FALSE;
  return NS_OK;
}

#define NOTIFY_LISTENERS_STATIC(obj_, propertyfunc_, params_) \
  PR_BEGIN_MACRO \
  nsTObserverArray<nsCOMPtr<nsIAutoSyncMgrListener> >::ForwardIterator iter(obj_->mListeners); \
  nsCOMPtr<nsIAutoSyncMgrListener> listener; \
  while (iter.HasMore()) { \
    listener = iter.GetNext(); \
    listener->propertyfunc_ params_; \
  } \
  PR_END_MACRO

#define NOTIFY_LISTENERS(propertyfunc_, params_) \
  NOTIFY_LISTENERS_STATIC(this, propertyfunc_, params_)

nsAutoSyncManager::nsAutoSyncManager()
{
  mGroupSize = kDefaultGroupSize;
  mIdleState = back;
  mStartupTime = PR_Now();
  mDownloadModel = dmChained;
  mUpdateState = completed;
  
  nsresult rv;    
  mIdleService = do_GetService("@mozilla.org/widget/idleservice;1", &rv);
  if (mIdleService)
    mIdleService->AddIdleObserver(this, kIdleTimeInSec);
 
  NS_ASSERTION(NS_SUCCEEDED(rv), "Failed to get subscribed to the idle service");
}

nsAutoSyncManager::~nsAutoSyncManager()
{
  if (mTimer)
    mTimer->Cancel();
  
  if (mIdleService)
    mIdleService->RemoveIdleObserver(this, kIdleTimeInSec);
}

void nsAutoSyncManager::InitTimer()
{
  if (!mTimer)
  {
    nsresult rv;
    mTimer = do_CreateInstance(NS_TIMER_CONTRACTID, &rv);
    NS_ASSERTION(NS_SUCCEEDED(rv), "failed to create timer in nsAutoSyncManager");
    
    mTimer->InitWithFuncCallback(TimerCallback, (void *) this, 
                                 kTimerIntervalInMs, nsITimer::TYPE_REPEATING_SLACK);
  }
}

void nsAutoSyncManager::StopTimer()
{
  if (mTimer)
  {
    mTimer->Cancel();
    mTimer = nsnull;
  }
}

void nsAutoSyncManager::StartTimerIfNeeded()
{
  if ((mUpdateQ.Count() > 0 || mDiscoveryQ.Count() > 0) && !mTimer)
    InitTimer();
}

void nsAutoSyncManager::TimerCallback(nsITimer *aTimer, void *aClosure)
{
  if (!aClosure)
    return;
  
  nsAutoSyncManager *autoSyncMgr = static_cast<nsAutoSyncManager*>(aClosure);
  if (autoSyncMgr->GetIdleState() == back ||
    (autoSyncMgr->mDiscoveryQ.Count() <= 0 && autoSyncMgr->mUpdateQ.Count() <= 0))
  {
    // Idle will create a new timer automatically if discovery Q or update Q is not empty
    autoSyncMgr->StopTimer();
  }

  // process folders within the discovery queue 
  if (autoSyncMgr->mDiscoveryQ.Count() > 0)
  {
    nsCOMPtr<nsIAutoSyncState> autoSyncStateObj(autoSyncMgr->mDiscoveryQ[0]);
    if (autoSyncStateObj)
    {
      PRUint32 leftToProcess;
      nsresult rv = autoSyncStateObj->ProcessExistingHeaders(kNumberOfHeadersToProcess, &leftToProcess);
      
      nsCOMPtr<nsIMsgFolder> folder;
      autoSyncStateObj->GetOwnerFolder(getter_AddRefs(folder));
      if (folder)
        NOTIFY_LISTENERS_STATIC(autoSyncMgr, OnDiscoveryQProcessed, (folder, kNumberOfHeadersToProcess, leftToProcess));
            
      if (NS_SUCCEEDED(rv) && 0 == leftToProcess)
      {
        autoSyncMgr->mDiscoveryQ.RemoveObjectAt(0);
        if (folder)
          NOTIFY_LISTENERS_STATIC(autoSyncMgr, OnFolderRemovedFromQ, (nsIAutoSyncMgrListener::DiscoveryQueue, folder));
      }
    }
  }
  
  if (autoSyncMgr->mUpdateQ.Count() > 0)
  {
    if (autoSyncMgr->mUpdateState == completed)
    {
      nsCOMPtr<nsIAutoSyncState> autoSyncStateObj(autoSyncMgr->mUpdateQ[0]);
      if (autoSyncStateObj)
      {
        PRInt32 state;
        nsresult rv = autoSyncStateObj->GetState(&state);
        if (NS_SUCCEEDED(rv) && nsAutoSyncState::stCompletedIdle == state)
        {
          nsCOMPtr<nsIMsgFolder> folder; 
          autoSyncStateObj->GetOwnerFolder(getter_AddRefs(folder));
          if (folder)
          {
            nsCOMPtr <nsIMsgImapMailFolder> imapFolder = do_QueryInterface(folder, &rv);
            NS_ENSURE_SUCCESS(rv,);
            rv = imapFolder->InitiateAutoSync(autoSyncMgr);
            if (NS_SUCCEEDED(rv))
            {
              autoSyncMgr->mUpdateState = initiated;
              NOTIFY_LISTENERS_STATIC(autoSyncMgr, OnAutoSyncInitiated, (folder));
            }
          }
        }
      } 
    }
    // if initiation is not successful for some reason, or 
    // if there is an on going download for this folder, 
    // remove it from q and continue with the next one  
    if (autoSyncMgr->mUpdateState != initiated)
    {
      nsCOMPtr<nsIMsgFolder> folder;
      autoSyncMgr->mUpdateQ[0]->GetOwnerFolder(getter_AddRefs(folder));
      
      autoSyncMgr->mUpdateQ.RemoveObjectAt(0);
      
      if (folder)
        NOTIFY_LISTENERS_STATIC(autoSyncMgr, OnFolderRemovedFromQ, (nsIAutoSyncMgrListener::UpdateQueue, folder));
    }
      
  }//endif

}

/**
 * Populates aChainedQ with the auto-sync state objects that are not owned by 
 * the same imap server. 
 * Assumes that aChainedQ initially empty.
 */
void nsAutoSyncManager::ChainFoldersInQ(const nsCOMArray<nsIAutoSyncState> &aQueue,
      nsCOMArray<nsIAutoSyncState> &aChainedQ)
{
  if (aQueue.Count() > 0)
    aChainedQ.AppendObject(aQueue[0]);
  
  PRInt32 pqElemCount = aQueue.Count();
  for (PRInt32 pqidx = 1; pqidx < pqElemCount; pqidx++)
  {
    PRBool chained = PR_FALSE;
    PRInt32 needToBeReplacedWith = -1;
    PRInt32 elemCount = aChainedQ.Count();
    for (PRInt32 idx = 0; idx < elemCount; idx++)
    {
      PRBool isSibling;
      nsresult rv = aChainedQ[idx]->IsSibling(aQueue[pqidx], &isSibling);
      
      if (NS_SUCCEEDED(rv) && isSibling)
      {
        // this prevent us to overwrite a lower priority sibling in
        // download-in-progress state with a higher priority one. 
        // we have to wait until its download is completed before 
        // switching to new one. 
        PRInt32 state;
        aQueue[pqidx]->GetState(&state);
        if (aQueue[pqidx] != aChainedQ[idx] && 
            state == nsAutoSyncState::stDownloadInProgress)
          needToBeReplacedWith = idx;
        else
          chained = PR_TRUE;
          
        break;
      }
    }//endfor
    
    if (needToBeReplacedWith > -1)
      aChainedQ.ReplaceObjectAt(aQueue[pqidx], needToBeReplacedWith);
    else if (!chained)
      aChainedQ.AppendObject(aQueue[pqidx]);
      
  }//endfor
}

/**
 * Searches the given queue for another folder owned by the same imap server.
 */
nsIAutoSyncState* 
nsAutoSyncManager::SearchQForSibling(const nsCOMArray<nsIAutoSyncState> &aQueue, 
                          nsIAutoSyncState *aAutoSyncStateObj, PRInt32 aStartIdx, PRInt32 *aIndex)
{
  if (aIndex)
    *aIndex = -1;
  
  if (aAutoSyncStateObj)
  {
    PRBool isSibling;
    PRInt32 elemCount = aQueue.Count();
    for (PRInt32 idx = aStartIdx; idx < elemCount; idx++)
    {
      nsresult rv = aAutoSyncStateObj->IsSibling(aQueue[idx], &isSibling);
      
      if (NS_SUCCEEDED(rv) && isSibling && aAutoSyncStateObj != aQueue[idx])
      {
        if (aIndex) 
          *aIndex = idx;
        
        return aQueue[idx];
      }
    }
  }
  return nsnull;  
}

/**
 * Searches for the next folder owned by the same imap server in the given queue,
 * starting from the index of the given folder.
 */
nsIAutoSyncState* 
nsAutoSyncManager::GetNextSibling(const nsCOMArray<nsIAutoSyncState> &aQueue, 
                                          nsIAutoSyncState *aAutoSyncStateObj, PRInt32 *aIndex)
{ 

  if (aIndex)
    *aIndex = -1;
  
  if (aAutoSyncStateObj)
  {
    PRBool located = PR_FALSE;
    PRBool isSibling;
    PRInt32 elemCount = aQueue.Count();
    for (PRInt32 idx = 0; idx < elemCount; idx++)
    {
      if (!located)
      {
        located = (aAutoSyncStateObj == aQueue[idx]);
        continue;
      }
      
      nsresult rv = aAutoSyncStateObj->IsSibling(aQueue[idx], &isSibling);
      if (NS_SUCCEEDED(rv) && isSibling)
      {
        if (aIndex) 
          *aIndex = idx;
        
        return aQueue[idx];
      }
    }
  }
  return nsnull;  
}

/** 
 * Checks whether there is another folder in the given q that is owned 
 * by the same imap server or not. 
 */
PRBool nsAutoSyncManager::DoesQContainAnySiblingOf(const nsCOMArray<nsIAutoSyncState> &aQueue, 
                                          nsIAutoSyncState *aAutoSyncStateObj, PRInt32 *aIndex)
{
  return (nsnull != SearchQForSibling(aQueue, aAutoSyncStateObj, 0, aIndex));
}

/**
 * Searches the given queue for the highest priority folder owned by the
 * same imap server.
 */
nsIAutoSyncState* 
nsAutoSyncManager::GetHighestPrioSibling(const nsCOMArray<nsIAutoSyncState> &aQueue, 
                                      nsIAutoSyncState *aAutoSyncStateObj, PRInt32 *aIndex)
{
  return SearchQForSibling(aQueue, aAutoSyncStateObj, 0, aIndex);
}

// to chain update folder actions
NS_IMETHODIMP nsAutoSyncManager::OnStartRunningUrl(nsIURI* aUrl)
{
  return NS_OK;
}


NS_IMETHODIMP nsAutoSyncManager::OnStopRunningUrl(nsIURI* aUrl, nsresult aExitCode)
{
  mUpdateState = completed;
  if (mUpdateQ.Count() > 0)
    mUpdateQ.RemoveObjectAt(0);

  return aExitCode;
}

NS_IMETHODIMP nsAutoSyncManager::Observe(nsISupports*, const char *aTopic, const PRUnichar *aSomeData)
{
  // Check topic here, idle or back
  if (PL_strcmp(aTopic, "idle") != 0)
  {
    SetIdleState(back);
    NOTIFY_LISTENERS(OnStateChanged, (PR_FALSE));
    return NS_OK;
  }
  else
  {
    // although we don't expect to get idle notification while we are already
    // idle, it is better to be defensive here to avoid platform specific idle
    // service issues, if any. 
    if (GetIdleState() == idle)
      return NS_OK;
    
    SetIdleState(idle);
    if (WeAreOffline())
      return NS_OK;
    StartTimerIfNeeded();
  }
  
  // TODO: Any better way to do it?  
  // to ignore idle events sent during the startup
  if ((mStartupTime + (10UL * PR_USEC_PER_SEC)) > PR_Now())
    return NS_OK;
    
  // notify listeners that auto-sync is running
  NOTIFY_LISTENERS(OnStateChanged, (PR_TRUE));
    
  nsCOMArray<nsIAutoSyncState> chainedQ;
  nsCOMArray<nsIAutoSyncState> *queue = &mPriorityQ;
  if (mDownloadModel == dmChained) 
  {
    ChainFoldersInQ(mPriorityQ, chainedQ);
    queue = &chainedQ;
  }
  
  // process folders in the priority queue 
  PRInt32 elemCount = queue->Count();
  for (PRInt32 idx = 0; idx < elemCount; idx++)
  {
    nsCOMPtr<nsIAutoSyncState> autoSyncStateObj((*queue)[idx]);
    if (!autoSyncStateObj)
      continue;
    
    PRInt32 state;
    autoSyncStateObj->GetState(&state);
    
    //TODO: Test cached-connection availability in parallel mode
    // and do not exceed (cached-connection count - 1)
    
    if (state != nsAutoSyncState::stReadyToDownload)
      continue;
    else
    {
      if (NS_FAILED(DownloadMessagesForOffline(autoSyncStateObj)))
        HandleDownloadErrorFor(autoSyncStateObj);
    }
  }//endfor
  
  return AutoUpdateFolders();
}

/**
 * Updates offline imap folders that are not synchronized recently.
 */
nsresult nsAutoSyncManager::AutoUpdateFolders()
{
  nsresult rv;

  // iterate through each imap account and update offline folders automatically
  
  nsCOMPtr<nsIMsgAccountManager> accountManager = do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);
  
  nsCOMPtr<nsISupportsArray> accounts;
  rv = accountManager->GetAccounts(getter_AddRefs(accounts));
  NS_ENSURE_SUCCESS(rv,rv);
  
  PRUint32 accountCount;
  accounts->Count(&accountCount);
  
  for (PRUint32 i = 0; i < accountCount; ++i) 
  {
    nsCOMPtr<nsIMsgAccount> account(do_QueryElementAt(accounts, i, &rv));
    if (!account)
      continue;
    
    nsCOMPtr<nsIMsgIncomingServer> incomingServer;
    rv = account->GetIncomingServer(getter_AddRefs(incomingServer));
    if (!incomingServer)
      continue;
    
    nsCString type;
    rv = incomingServer->GetType(type);
    
    if (!type.EqualsLiteral("imap"))
      continue;
    
    nsCOMPtr<nsIMsgFolder> rootFolder;
    nsCOMPtr<nsISupportsArray> allDescendents;
    
    rv = incomingServer->GetRootFolder(getter_AddRefs(rootFolder));
    if (rootFolder)
    {
      allDescendents = do_CreateInstance(NS_SUPPORTSARRAY_CONTRACTID, &rv);
      if (NS_FAILED(rv))
        continue;
        
      rv = rootFolder->ListDescendents(allDescendents);
      if (!allDescendents)
        continue;
      
      PRUint32 cnt = 0;
      rv = allDescendents->Count(&cnt);
      if (NS_FAILED(rv))
        continue;
      
      for (PRUint32 i = 0; i < cnt; i++)
      {
        nsCOMPtr<nsIMsgFolder> folder(do_QueryElementAt(allDescendents, i, &rv));
        if (NS_FAILED(rv))
          continue;
        
        PRBool isFolderOffline = PR_FALSE;
        rv = folder->GetFlag(nsMsgFolderFlags::Offline, &isFolderOffline);
        // skip this folder if not offline
        if (NS_FAILED(rv) || !isFolderOffline)
          continue; 
        
        nsCOMPtr<nsIMsgImapMailFolder> imapFolder = do_QueryInterface(folder, &rv);
        if (NS_FAILED(rv))
          continue;
          
        nsCOMPtr<nsIImapIncomingServer> imapServer;
        rv = imapFolder->GetImapIncomingServer(getter_AddRefs(imapServer));
        if (imapServer)
        {
          PRBool autoSyncOfflineStores = PR_FALSE;
          rv = imapServer->GetAutoSyncOfflineStores(&autoSyncOfflineStores);
          
          // skip if AutoSyncOfflineStores pref is not set for this folder
          if (NS_FAILED(rv) || !autoSyncOfflineStores)
            continue;
        }
        
        nsCOMPtr<nsIAutoSyncState> autoSyncState;
        rv = imapFolder->GetAutoSyncStateObj(getter_AddRefs(autoSyncState));
        NS_ASSERTION(autoSyncState, "*** nsAutoSyncState shouldn't be NULL, check owner folder");
        
        // shouldn't happen but lets be defensive here
        if (!autoSyncState)
          continue;
        
        PRInt32 state;
        rv = autoSyncState->GetState(&state);
        
        if (NS_SUCCEEDED(rv) && nsAutoSyncState::stCompletedIdle == state)
        {
          // ensure that we wait for at least nsMsgIncomingServer::BiffMinutes between
          // each update of the same folder
          PRTime lastUpdateTime;
          rv = autoSyncState->GetLastUpdateTime(&lastUpdateTime);
          PRTime span = GetUpdateIntervalFor(autoSyncState) * (PR_USEC_PER_SEC * 60UL);
          if ( NS_SUCCEEDED(rv) && ((lastUpdateTime + span) < PR_Now()) )
          {          
            if (mUpdateQ.IndexOf(autoSyncState) == -1)
            {
              mUpdateQ.AppendObject(autoSyncState);
              if (folder)
                NOTIFY_LISTENERS(OnFolderAddedIntoQ, (nsIAutoSyncMgrListener::UpdateQueue, folder));
            }
          }
        }
  
        // check last sync time
        PRTime lastSyncTime;
        rv = autoSyncState->GetLastSyncTime(&lastSyncTime);
        if ( NS_SUCCEEDED(rv) && ((lastSyncTime + kAutoSyncFreq) < PR_Now()) )
        {
          // add this folder into discovery queue to process existing headers
          // and discover messages not downloaded yet
          if (mDiscoveryQ.IndexOf(autoSyncState) == -1)
          {
            mDiscoveryQ.AppendObject(autoSyncState);
            if (folder)
              NOTIFY_LISTENERS(OnFolderAddedIntoQ, (nsIAutoSyncMgrListener::DiscoveryQueue, folder));
          }
        }
      }//endfor
    }//endif
  }//endfor
  
  // lazily create the timer if there is something to process in the queue
  // when timer is done, it will self destruct
  StartTimerIfNeeded();
  
  return rv;
}

/**
 * Places the given folder into the priority queue based on active
 * strategy function.
 */
void nsAutoSyncManager::ScheduleFolderForOfflineDownload(nsIAutoSyncState *aAutoSyncStateObj)
{
  if (aAutoSyncStateObj &&  (mPriorityQ.IndexOf(aAutoSyncStateObj) == -1))
  {
    nsCOMPtr<nsIAutoSyncFolderStrategy> folStrategy;
    GetFolderStrategy(getter_AddRefs(folStrategy));
        
    if (mPriorityQ.Count() <= 0)
    {
      // make sure that we don't insert a folder excluded by the given strategy
      nsCOMPtr<nsIMsgFolder> folder;
      aAutoSyncStateObj->GetOwnerFolder(getter_AddRefs(folder));
      if (folder)
      {
        PRBool excluded = PR_FALSE;
        if (folStrategy)
          folStrategy->IsExcluded(folder, &excluded);
        
        if (!excluded)
        {
          mPriorityQ.AppendObject(aAutoSyncStateObj); // insert into the first spot
          NOTIFY_LISTENERS(OnFolderAddedIntoQ, (nsIAutoSyncMgrListener::PriorityQueue, folder));
        }
      }
    }
    else 
    {
      // find the right spot for the given folder      
      PRUint32 qidx = mPriorityQ.Count();
      while (qidx > 0) 
      {
        --qidx;
        
        nsCOMPtr<nsIMsgFolder> folderA, folderB;
        mPriorityQ[qidx]->GetOwnerFolder(getter_AddRefs(folderA));
        aAutoSyncStateObj->GetOwnerFolder(getter_AddRefs(folderB));
        
        PRBool excluded = PR_FALSE;
        if (folderB && folStrategy)
          folStrategy->IsExcluded(folderB, &excluded);
          
        if (excluded)
          break;
        
        nsAutoSyncStrategyDecisionType decision = nsAutoSyncStrategyDecisions::Same;
        if (folderA && folderB && folStrategy)
          folStrategy->Sort(folderA, folderB, &decision);
                  
        if (decision == nsAutoSyncStrategyDecisions::Higher && 0 == qidx)
          mPriorityQ.InsertObjectAt(aAutoSyncStateObj, 0);
        else if (decision == nsAutoSyncStrategyDecisions::Higher)
          continue;
        else if (decision == nsAutoSyncStrategyDecisions::Lower)
          mPriorityQ.InsertObjectAt(aAutoSyncStateObj, qidx+1);
        else //  decision == nsAutoSyncStrategyDecisions::Same
          mPriorityQ.InsertObjectAt(aAutoSyncStateObj, qidx);

        NOTIFY_LISTENERS(OnFolderAddedIntoQ, (nsIAutoSyncMgrListener::PriorityQueue, folderB));
        break;
      }//endwhile
    }
  }//endif
}

/**
 * Zero aSizeLimit means no limit 
 */
nsresult nsAutoSyncManager::DownloadMessagesForOffline(nsIAutoSyncState *aAutoSyncStateObj, PRUint32 aSizeLimit)
{  
  if (!aAutoSyncStateObj)
    return NS_ERROR_INVALID_ARG;
  
  PRInt32 count;
  nsresult rv = aAutoSyncStateObj->GetPendingMessageCount(&count);
  // TODO: right thing to do here is to return an error to the caller saying that do not
  // try again. Not sure how to do it using nserror mechanism.
  // Note that we can't return success in case of 0 == count here since
  // we only remove the object from the queue in the OnDownloadCompleted method
  if (NS_FAILED(rv) || !count)
    return NS_ERROR_FAILURE; 
 
  nsCOMPtr<nsIMutableArray> messagesToDownload;
  PRUint32 totalSize = 0;
  rv = aAutoSyncStateObj->GetNextGroupOfMessages(mGroupSize, &totalSize, getter_AddRefs(messagesToDownload));
  NS_ENSURE_SUCCESS(rv,rv);
  
  // ensure that we don't exceed the given size limit for this particular group
  if (aSizeLimit && aSizeLimit < totalSize)
    return NS_ERROR_FAILURE;
  
  PRUint32 length;
  rv = messagesToDownload->GetLength(&length);
  if (NS_SUCCEEDED(rv) && length > 0)
  {
    rv = aAutoSyncStateObj->DownloadMessagesForOffline(messagesToDownload);
    
    nsCOMPtr<nsIMsgFolder> folder;
    aAutoSyncStateObj->GetOwnerFolder(getter_AddRefs(folder));
    if (NS_SUCCEEDED(rv) && folder)
      NOTIFY_LISTENERS(OnDownloadStarted, (folder, length, count));
  }
  
  return rv;
}

/**
 * Assuming that the download operation on the given folder has been failed at least once, 
 * execute these steps:
 *  - put the auto-sync state into ready-to-download mode
 *  - rollback the message offset so we can try the same group again (unless the retry
 *     count is reached to the given limit)
 *  - if parallel model is active, wait to be resumed by the next idle
 *  - if chained model is active, searche the priority queue to find a sibling to continue with.
 */
nsresult nsAutoSyncManager::HandleDownloadErrorFor(nsIAutoSyncState *aAutoSyncStateObj)
{
  if (!aAutoSyncStateObj)
    return NS_ERROR_INVALID_ARG;
  
  // force the auto-sync state to try downloading the same group at least
  // kGroupRetryCount times before it moves to the next one
  aAutoSyncStateObj->TryCurrentGroupAgain(kGroupRetryCount);
  
  nsCOMPtr<nsIMsgFolder> folder;
  aAutoSyncStateObj->GetOwnerFolder(getter_AddRefs(folder));
  if (folder)
    NOTIFY_LISTENERS(OnDownloadError, (folder));
  
  // if parallel model, don't do anything else
  
  if (mDownloadModel == dmChained)
  {
    // switch to the next folder in the chain and continue downloading
    nsIAutoSyncState *autoSyncStateObj = aAutoSyncStateObj;
    nsIAutoSyncState *nextAutoSyncStateObj = nsnull;
    while ( (nextAutoSyncStateObj = GetNextSibling(mPriorityQ, autoSyncStateObj)) )
    {
      autoSyncStateObj = nextAutoSyncStateObj;
      if (NS_SUCCEEDED(DownloadMessagesForOffline(autoSyncStateObj)))
        break;
      else
        autoSyncStateObj->TryCurrentGroupAgain(kGroupRetryCount);
    }
  }
  
  return NS_OK;
}

PRUint32 nsAutoSyncManager::GetUpdateIntervalFor(nsIAutoSyncState *aAutoSyncStateObj)
{
  nsCOMPtr<nsIMsgFolder> folder;
  nsresult rv = aAutoSyncStateObj->GetOwnerFolder(getter_AddRefs(folder));
  if (NS_FAILED(rv))
    return kDefaultUpdateInterval;
  
  nsCOMPtr<nsIMsgIncomingServer> server;
  rv = folder->GetServer(getter_AddRefs(server));
  if (NS_FAILED(rv))
    return kDefaultUpdateInterval;

  if (server)
  {
    PRInt32 interval;
    rv = server->GetBiffMinutes(&interval);
    
    if (NS_SUCCEEDED(rv))
      return (PRUint32)interval;
  }

  return kDefaultUpdateInterval;
}

NS_IMETHODIMP nsAutoSyncManager::GetGroupSize(PRUint32 *aGroupSize)
{
  NS_ENSURE_ARG_POINTER(aGroupSize);
  *aGroupSize = mGroupSize;
  return NS_OK;
}
NS_IMETHODIMP nsAutoSyncManager::SetGroupSize(PRUint32 aGroupSize)
{
  mGroupSize = aGroupSize ? aGroupSize : kDefaultGroupSize;
  return NS_OK;
}

NS_IMETHODIMP nsAutoSyncManager::GetMsgStrategy(nsIAutoSyncMsgStrategy * *aMsgStrategy)
{
  NS_ENSURE_ARG_POINTER(aMsgStrategy);
  
  // lazily create if it is not done already
  if (!mMsgStrategyImpl)
  {
    mMsgStrategyImpl = new nsDefaultAutoSyncMsgStrategy;
    if (!mMsgStrategyImpl)
      return NS_ERROR_OUT_OF_MEMORY;
  }
  
  NS_IF_ADDREF(*aMsgStrategy = mMsgStrategyImpl);
  return NS_OK;
}
NS_IMETHODIMP nsAutoSyncManager::SetMsgStrategy(nsIAutoSyncMsgStrategy * aMsgStrategy)
{
  mMsgStrategyImpl = aMsgStrategy;
  return NS_OK;
}

NS_IMETHODIMP nsAutoSyncManager::GetFolderStrategy(nsIAutoSyncFolderStrategy * *aFolderStrategy)
{
  NS_ENSURE_ARG_POINTER(aFolderStrategy);
  
  // lazily create if it is not done already
  if (!mFolderStrategyImpl)
  {
    mFolderStrategyImpl = new nsDefaultAutoSyncFolderStrategy;
    if (!mFolderStrategyImpl)
      return NS_ERROR_OUT_OF_MEMORY;
  }
    
  NS_IF_ADDREF(*aFolderStrategy = mFolderStrategyImpl);
  return NS_OK;
}
NS_IMETHODIMP nsAutoSyncManager::SetFolderStrategy(nsIAutoSyncFolderStrategy * aFolderStrategy)
{
  mFolderStrategyImpl = aFolderStrategy;
  return NS_OK;
}

NS_IMETHODIMP 
nsAutoSyncManager::DoesMsgFitDownloadCriteria(nsIMsgDBHdr *aMsgHdr, PRBool *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  
  PRUint32 msgFlags = 0;
  aMsgHdr->GetFlags(&msgFlags);
  
  // check whether this message is marked imap deleted or not 
  *aResult = !(msgFlags & MSG_FLAG_IMAP_DELETED);
  if (!(*aResult))
    return NS_OK;
    
  PRBool shouldStoreMsgOffline = PR_TRUE;
  nsCOMPtr<nsIMsgFolder> folder;
  aMsgHdr->GetFolder(getter_AddRefs(folder));
  if (folder)
  {
    nsMsgKey msgKey;
    nsresult rv = aMsgHdr->GetMessageKey(&msgKey);
    // a cheap way to get the size limit for this folder and make
    // sure that we don't have this message offline already
    if (NS_SUCCEEDED(rv))
      folder->ShouldStoreMsgOffline(msgKey, &shouldStoreMsgOffline);
  }
        
  *aResult &= shouldStoreMsgOffline;
  
  return NS_OK;
}

NS_IMETHODIMP nsAutoSyncManager::OnDownloadQChanged(nsIAutoSyncState *aAutoSyncStateObj)
{  
  nsCOMPtr<nsIAutoSyncState> autoSyncStateObj(aAutoSyncStateObj);
  if (!autoSyncStateObj)
    return NS_ERROR_INVALID_ARG;
  
  // we want to start downloading immediately
  
  // unless the folder is excluded
  PRBool excluded = PR_FALSE;
  nsCOMPtr<nsIAutoSyncFolderStrategy> folStrategy;
  nsCOMPtr<nsIMsgFolder> folder;
  
  GetFolderStrategy(getter_AddRefs(folStrategy));
  autoSyncStateObj->GetOwnerFolder(getter_AddRefs(folder));
        
  if (folder && folStrategy)
    folStrategy->IsExcluded(folder, &excluded);
  
  // and if the folder is in completed state
  PRInt32 state;
  nsresult rv = autoSyncStateObj->GetState(&state);
  if (NS_SUCCEEDED(rv) && nsAutoSyncState::stCompletedIdle == state && !excluded)
  {
    // add this folder into the priority queue - if state == stCompletedIdle shouldn't be
    // in the priority queue
    autoSyncStateObj->SetState(nsAutoSyncState::stReadyToDownload);
    ScheduleFolderForOfflineDownload(autoSyncStateObj);
    
    if (mDownloadModel == dmParallel || !DoesQContainAnySiblingOf(mPriorityQ, autoSyncStateObj))
    {
      // this will download the first group of messages immediately;
      // to ensure that we don't end up downloading a large single message in not-idle time, 
      // we enforce a limit. If there is no message fits into this limit we postpone the 
      // download until the next idle.
      if (GetIdleState() != idle)
        rv =  DownloadMessagesForOffline(autoSyncStateObj, kFirstGroupSizeLimit);
      else
        rv = DownloadMessagesForOffline(autoSyncStateObj);
      
      if (NS_FAILED(rv))
        autoSyncStateObj->TryCurrentGroupAgain(kGroupRetryCount);
    }
  }
  return rv;
}

NS_IMETHODIMP 
nsAutoSyncManager::OnDownloadStarted(nsIAutoSyncState *aAutoSyncStateObj, nsresult aStartCode)
{
  nsCOMPtr<nsIAutoSyncState> autoSyncStateObj(aAutoSyncStateObj);
  if (!autoSyncStateObj)
    return NS_ERROR_INVALID_ARG;

  // resume downloads during next idle time
  if (NS_FAILED(aStartCode))
    autoSyncStateObj->SetState(nsAutoSyncState::stReadyToDownload);  
  
  return aStartCode;
}

NS_IMETHODIMP 
nsAutoSyncManager::OnDownloadCompleted(nsIAutoSyncState *aAutoSyncStateObj, nsresult aExitCode)
{
  nsCOMPtr<nsIAutoSyncState> autoSyncStateObj(aAutoSyncStateObj);
  if (!autoSyncStateObj)
    return NS_ERROR_INVALID_ARG;    

  nsresult rv = aExitCode;

  if (NS_FAILED(aExitCode))
  {
    // retry the same group kGroupRetryCount times
    // try again if TB still idle, otherwise wait for the next idle time
    autoSyncStateObj->TryCurrentGroupAgain(kGroupRetryCount);
    if (GetIdleState() == idle)
    {
      rv = DownloadMessagesForOffline(autoSyncStateObj);
      if (NS_FAILED(rv))
        rv = HandleDownloadErrorFor(autoSyncStateObj);
    }
    return rv;
  }
      
  // download is successful, reset the retry counter of the folder
  autoSyncStateObj->ResetRetryCounter();
  
  nsCOMPtr<nsIMsgFolder> folder;
  aAutoSyncStateObj->GetOwnerFolder(getter_AddRefs(folder));
  if (folder)
    NOTIFY_LISTENERS(OnDownloadCompleted, (folder));
      
  PRInt32 count;
  rv = autoSyncStateObj->GetPendingMessageCount(&count);
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsIAutoSyncState *nextFolderToDownload = nsnull;
  if (count > 0)
  {
    autoSyncStateObj->SetState(nsAutoSyncState::stReadyToDownload);
    
    // in parallel model, we continue downloading the same folder as long as it has
    // more pending messages
    nextFolderToDownload = autoSyncStateObj;
    
    // in chained model, ensure that we are always downloading the highest priority 
    // folder first 
    if (mDownloadModel == dmChained)
    {
      // switch to higher priority folder and continue to download, 
      // if any added recently
      PRInt32 myIndex = mPriorityQ.IndexOf(autoSyncStateObj);
      
      PRInt32 siblingIndex;
      nsIAutoSyncState *sibling = GetHighestPrioSibling(mPriorityQ, autoSyncStateObj, &siblingIndex);
      
      // lesser index = higher priority
      if (sibling && myIndex > -1 && siblingIndex < myIndex) 
        nextFolderToDownload = sibling;
    }
  }
  else 
  {
    autoSyncStateObj->SetState(nsAutoSyncState::stCompletedIdle);
    
    nsCOMPtr<nsIMsgFolder> folder;
    nsresult rv = autoSyncStateObj->GetOwnerFolder(getter_AddRefs(folder));
    
    mPriorityQ.RemoveObject(autoSyncStateObj);
    if (NS_SUCCEEDED(rv))
      NOTIFY_LISTENERS(OnFolderRemovedFromQ, (nsIAutoSyncMgrListener::PriorityQueue, folder));

    //find the next folder owned by the same server in the queue and continue downloading
    if (mDownloadModel == dmChained)
      nextFolderToDownload = GetHighestPrioSibling(mPriorityQ, autoSyncStateObj);
      
  }//endif
  
  // continue downloading if TB is still in idle state
  if (nextFolderToDownload && GetIdleState() == idle)
  {
    rv = DownloadMessagesForOffline(nextFolderToDownload);
    if (NS_FAILED(rv))
      rv = HandleDownloadErrorFor(nextFolderToDownload);
  }

  return rv;
}

NS_IMETHODIMP nsAutoSyncManager::GetDownloadModel(PRInt32 *aDownloadModel)
{
  NS_ENSURE_ARG_POINTER(aDownloadModel);
  *aDownloadModel = mDownloadModel;
  return NS_OK;
}
NS_IMETHODIMP nsAutoSyncManager::SetDownloadModel(PRInt32 aDownloadModel)
{
  mDownloadModel = aDownloadModel;
  return NS_OK;
}

NS_IMETHODIMP nsAutoSyncManager::AddListener(nsIAutoSyncMgrListener *aListener)
{
  NS_ENSURE_ARG_POINTER(aListener);
  mListeners.AppendElementUnlessExists(aListener);
  return NS_OK;
}

NS_IMETHODIMP nsAutoSyncManager::RemoveListener(nsIAutoSyncMgrListener *aListener)
{
  NS_ENSURE_ARG_POINTER(aListener);
  mListeners.RemoveElement(aListener);
  return NS_OK;
}

/* readonly attribute unsigned long discoveryQLength; */
NS_IMETHODIMP nsAutoSyncManager::GetDiscoveryQLength(PRUint32 *aDiscoveryQLength)
{
  NS_ENSURE_ARG_POINTER(aDiscoveryQLength);
  *aDiscoveryQLength = mDiscoveryQ.Count();
  return NS_OK;
}

/* readonly attribute unsigned long uploadQLength; */
NS_IMETHODIMP nsAutoSyncManager::GetUpdateQLength(PRUint32 *aUpdateQLength)
{
  NS_ENSURE_ARG_POINTER(aUpdateQLength);
  *aUpdateQLength = mUpdateQ.Count();
  return NS_OK;
}

/* readonly attribute unsigned long downloadQLength; */
NS_IMETHODIMP nsAutoSyncManager::GetDownloadQLength(PRUint32 *aDownloadQLength)
{
  NS_ENSURE_ARG_POINTER(aDownloadQLength);
  *aDownloadQLength = mPriorityQ.Count();
  return NS_OK;
}

void nsAutoSyncManager::SetIdleState(IdleState st) 
{ 
  mIdleState = st;
}
    
nsAutoSyncManager::IdleState nsAutoSyncManager::GetIdleState() const 
{ 
  return mIdleState; 
}

NS_IMPL_ISUPPORTS3(nsAutoSyncManager, nsIObserver, nsIUrlListener, nsIAutoSyncManager)
