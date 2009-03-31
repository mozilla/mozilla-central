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

#ifndef nsAutoSyncManager_h__
#define nsAutoSyncManager_h__

#include "nsAutoPtr.h"
#include "nsString.h"
#include "nsCOMArray.h"
#include "nsIObserver.h"
#include "nsIUrlListener.h"
#include "nsITimer.h"
#include "nsTObserverArray.h"
#include "nsIAutoSyncManager.h"
#include "nsIAutoSyncMsgStrategy.h"
#include "nsIAutoSyncFolderStrategy.h"

class nsImapMailFolder;
class nsIMsgDBHdr;
class nsIIdleService;
class nsIMsgFolder;

/* Auto-Sync
 *
 * Background:
 *  it works only with offline imap folders. "autosync_offline_stores" pref
 *  enables/disables auto-sync mechanism. Note that setting "autosync_offline_stores"
 *  to false, or setting folder to not-offline doesn't stop synchronization
 *  process for already queued folders.
 *
 * Auto-Sync policy:
 *  o It kicks in during system idle time, and tries to download as much messages
 *    as possible based on given folder and message prioritization strategies/rules.
 *    Default folder prioritization strategy dictates to sort the folders based on the
 *    following order:  INBOX > DRAFTS > SUBFOLDERS > TRASH.
 *    Similarly, default message prioritization strategy dictates to download the most
 *    recent and smallest message first. Also, by sorting the messages by size in the 
 *    queue, it tries to maximize the number of messages downloaded.
 *  o It downloads the messages in groups. Default groups size is defined by |kDefaultGroupSize|. 
 *  o It downloads the messages larger than the group size one-by-one.
 *  o If new messages arrive when not idle, it downloads the messages that do fit into
 *    |kFirstGroupSizeLimit| size limit immediately, without waiting for idle time, unless there is
 *    a sibling (a folder owned by the same imap server) in stDownloadInProgress state in the q
 *  o If new messages arrive when idle, it downloads all the messages without any restriction.
 *  o If new messages arrive into a folder while auto-sync is downloading other messages of the
 *    same folder, it simply puts the new messages into the folder's download queue, and
 *    re-prioritize the messages. That behavior makes sure that the high priority
 *    (defined by the message strategy) get downloaded first always.
 *  o If new messages arrive into a folder while auto-sync is downloading messages of a lower
 *    priority folder, auto-sync switches the folders in the queue and starts downloading the
 *    messages of the higher priority folder next time it downloads a message group.
 *  o Currently there is no way to stop/pause/cancel a message download. The smallest
 *    granularity is the message group size.
 *  o Auto-Sync manager periodically (kAutoSyncFreq) checks folder for existing messages
 *    w/o bodies. It persists the last time the folder is checked in the local database of the
 *    folder. We call this process 'Discovery'. This process is asynchronous and processes
 *    |kNumberOfHeadersToProcess| number of headers at each cycle. Since it works on local data,
 *    it doesn't consume lots of system resources, it does its job fast.
 *  o Discovery is necessary especially when the user makes a transition from not-offline 
 *    to offline mode.
 *  o Update frequency is defined by nsMsgIncomingServer::BiffMinutes.
 *
 * Error Handling:
 *  o if the user moves/deletes/filters all messages of a folder already queued, auto-sync
 *    deals with that situation by skipping the folder in question, and continuing with the
 *    next in chain.
 *  o If the message size is zero, auto-sync ignores the message.
 *  o If the download of the message group fails for some reason, auto-sync tries to
 *    download the same group |kGroupRetryCount| times. If it still fails, continues with the
 *    next group of messages.
 *
 * Download Model:
 *  Parallel model should be used with the imap servers that do not have any "max number of sessions
 *  per IP" limit, and when the bandwidth is significantly large.
 */
 
/**
 * Default strategy implementation to prioritize messages in the download queue.   
 */
class nsDefaultAutoSyncMsgStrategy : public nsIAutoSyncMsgStrategy
{
  static const PRUint32 kFirstPassMessageSize = 60U*1024U; // 60K
  
  public:
    NS_DECL_ISUPPORTS
    NS_DECL_NSIAUTOSYNCMSGSTRATEGY

    nsDefaultAutoSyncMsgStrategy();

  private:
    ~nsDefaultAutoSyncMsgStrategy();
};

/**
 * Default strategy implementation to prioritize folders in the download queue.  
 */
class nsDefaultAutoSyncFolderStrategy : public nsIAutoSyncFolderStrategy
{
  public:
    NS_DECL_ISUPPORTS
    NS_DECL_NSIAUTOSYNCFOLDERSTRATEGY

    nsDefaultAutoSyncFolderStrategy();

  private:
    ~nsDefaultAutoSyncFolderStrategy();
};

// see the end of the page for auto-sync internals

/**
 * Manages background message download operations for offline imap folders. 
 */
class nsAutoSyncManager : public nsIObserver, 
                          public nsIUrlListener,
                          public nsIAutoSyncManager
{
  static const PRTime kAutoSyncFreq = 60UL * (PR_USEC_PER_SEC * 60UL);  // 1hr
  static const PRUint32 kDefaultUpdateInterval = 10UL;                  // 10min
  static const PRInt32 kTimerIntervalInMs = 400;
  static const PRUint32 kNumberOfHeadersToProcess = 250U;
  // recommended size of each group of messages per download
  static const PRUint32 kDefaultGroupSize = 50U*1024U /* 50K */;
  // enforced size of the first group that will be downloaded before idle time
  static const PRUint32 kFirstGroupSizeLimit = 60U*1024U /* 60K */; 
  static const PRInt32 kIdleTimeInSec = 10;
  static const PRUint32 kGroupRetryCount = 3;
  
  enum IdleState { systemIdle, appIdle, notIdle };
  enum UpdateState { initiated, completed };
      
  public:
    NS_DECL_ISUPPORTS
    NS_DECL_NSIOBSERVER
    NS_DECL_NSIURLLISTENER
    NS_DECL_NSIAUTOSYNCMANAGER

    nsAutoSyncManager();
    
  private:
    ~nsAutoSyncManager();

    void SetIdleState(IdleState st);    
    IdleState GetIdleState() const;
    nsresult StartIdleProcessing();
    nsresult AutoUpdateFolders(); 
    void ScheduleFolderForOfflineDownload(nsIAutoSyncState *aAutoSyncStateObj);
    nsresult DownloadMessagesForOffline(nsIAutoSyncState *aAutoSyncStateObj, PRUint32 aSizeLimit = 0);
    nsresult HandleDownloadErrorFor(nsIAutoSyncState *aAutoSyncStateObj, const nsresult error);
    
    // Helper methods for priority Q operations
    static
    void ChainFoldersInQ(const nsCOMArray<nsIAutoSyncState> &aQueue, 
                          nsCOMArray<nsIAutoSyncState> &aChainedQ);
    static
    nsIAutoSyncState* SearchQForSibling(const nsCOMArray<nsIAutoSyncState> &aQueue, 
                          nsIAutoSyncState *aAutoSyncStateObj, PRInt32 aStartIdx, PRInt32 *aIndex = nsnull);
    static
    PRBool DoesQContainAnySiblingOf(const nsCOMArray<nsIAutoSyncState> &aQueue, 
                          nsIAutoSyncState *aAutoSyncStateObj, const PRInt32 aState, 
                          PRInt32 *aIndex = nsnull);
    static 
    nsIAutoSyncState* GetNextSibling(const nsCOMArray<nsIAutoSyncState> &aQueue, 
                          nsIAutoSyncState *aAutoSyncStateObj, PRInt32 *aIndex = nsnull);
    static 
    nsIAutoSyncState* GetHighestPrioSibling(const nsCOMArray<nsIAutoSyncState> &aQueue, 
                          nsIAutoSyncState *aAutoSyncStateObj, PRInt32 *aIndex = nsnull);
    
    /// timer to process existing keys and updates
    void InitTimer();
    static void TimerCallback(nsITimer *aTimer, void *aClosure);
    void StopTimer();
    void StartTimerIfNeeded();
    
    /// pref helpers
    PRUint32 GetUpdateIntervalFor(nsIAutoSyncState *aAutoSyncStateObj);
    
  protected:
    nsCOMPtr<nsIAutoSyncMsgStrategy> mMsgStrategyImpl;
    nsCOMPtr<nsIAutoSyncFolderStrategy> mFolderStrategyImpl;
    // contains the folders that will be downloaded on background
    nsCOMArray<nsIAutoSyncState> mPriorityQ;
    // contains the folders that will be examined for existing headers
    nsCOMArray<nsIAutoSyncState> mDiscoveryQ;
    // contains the folders that will be updated in order
    // (see nsImapMailFolder::UpdateFolder for update operation)
    nsCOMArray<nsIAutoSyncState> mUpdateQ;
    UpdateState mUpdateState;
   
  private:
    PRUint32 mGroupSize;
    IdleState mIdleState;
    PRTime mStartupTime;
    PRInt32 mDownloadModel;
    nsCOMPtr<nsIIdleService> mIdleService;
    nsCOMPtr<nsITimer> mTimer;
    nsTObserverArray<nsCOMPtr<nsIAutoSyncMgrListener> > mListeners;
};

#endif

/*
How queues inter-relate:

nsAutoSyncState has an internal priority queue to store messages waiting to be
downloaded. nsAutoSyncMsgStrategy object determines the order in this queue,
nsAutoSyncManager uses this queue to manage downloads. Two events cause a
change in this queue: 

1) nsImapMailFolder::HeaderFetchCompleted: is triggered when TB notices that
there are pending messages on the server -- via IDLE command from the server, 
via explicit select from the user, or via automatic Update during idle time. If 
it turns out that there are pending messages on the server, it adds them into 
nsAutoSyncState's download queue.

2) nsAutoSyncState::ProcessExistingHeaders: is triggered for every imap folder 
every hour or so (see kAutoSyncFreq). nsAutoSyncManager uses an internal queue called Discovery 
queue to keep track of this task. The purpose of ProcessExistingHeaders() 
method is to check existing headers of a given folder in batches and discover 
the messages without bodies, in asynchronous fashion. This process is 
sequential, one and only one folder at any given time, very similar to 
indexing. Again, if it turns out that the folder in hand has messages w/o 
bodies, ProcessExistingHeaders adds them into nsAutoSyncState's download queue.

Any change in nsAutoSyncState's download queue, notifies nsAutoSyncManager and 
nsAutoSyncManager puts the requesting  nsAutoSyncState into its internal 
priority queue (called mPriorityQ) -- if the folder is not already there. 
nsAutoSyncFolderStrategy object determines the order in this queue. This queue 
is processed in two modes: chained and parallel. 

i) Chained: One folder per imap server any given time. Folders owned by 
different imap servers are simultaneous.

ii) Parallel: All folders at the same time, using all cached-connections - 
a.k.a 'Folders gone wild' mode.

The order the folders are added into the mPriorityQ doesn't matter since every
time a batch completed for an imap server, nsAutoSyncManager adjusts the order.
So, lets say that updating a sub-folder starts downloading message immediately,
when an higher priority folder is added into the queue, nsAutoSyncManager
switches to this higher priority folder instead of processing the next group of
messages of the lower priority one. Setting group size too high might delay
this switch at worst. 

And finally, Update queue helps nsAutoSyncManager to keep track of folders 
waiting to be updated. With the latest change, we update one and only one
folder at any given time. Default frequency of updating is 10 min (kDefaultUpdateInterval). 
We add folders into the update queue during idle time, if they are not in mPriorityQ already.

*/
