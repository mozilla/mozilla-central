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

/**
 * Default strategy implementation to prioritize messages in the download queue.   
 */
class nsDefaultAutoSyncMsgStrategy : public nsIAutoSyncMsgStrategy
{
  enum { kFirstPassMessageSize = 10U*1024U*1024U }; // 10MB
  
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
  static const PRUint32 kDefaultGroupSize = 50U*1024U /* 50K */;
  static const PRInt32 kIdleTimeInSec = 10;
  static const PRUint32 kGroupRetryCount = 3;
  
  enum IdleState { idle, back };
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
    nsresult AutoUpdateFolders(); 
    void ScheduleFolderForOfflineDownload(nsIAutoSyncState *aAutoSyncStateObj);
    nsresult DownloadMessagesForOffline(nsIAutoSyncState *aAutoSyncStateObj);
    nsresult HandleDownloadErrorFor(nsIAutoSyncState *aAutoSyncStateObj);
    
    // Helper methods for priority Q operations
    static
    void ChainFoldersInQ(const nsCOMArray<nsIAutoSyncState> &aQueue, 
                          nsCOMArray<nsIAutoSyncState> &aChainedQ);
    static
    nsIAutoSyncState* SearchQForSibling(const nsCOMArray<nsIAutoSyncState> &aQueue, 
                          nsIAutoSyncState *aAutoSyncStateObj, PRInt32 aStartIdx, PRInt32 *aIndex = nsnull);
    static
    PRBool DoesQContainAnySiblingOf(const nsCOMArray<nsIAutoSyncState> &aQueue, 
                          nsIAutoSyncState *aAutoSyncStateObj, PRInt32 *aIndex = nsnull);
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
every hour or so. nsAutoSyncManager uses an internal queue called Discovery 
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
folder at any given time. Frequency of updating is 5 min. We add folders into
the update queue during idle time, if they are not in mPriorityQ already.

*/
