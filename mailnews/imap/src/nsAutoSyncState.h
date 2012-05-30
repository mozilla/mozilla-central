/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsAutoSyncState_h__
#define nsAutoSyncState_h__

#include "MailNewsTypes.h"
#include "nsIAutoSyncState.h"
#include "nsIAutoSyncManager.h" 
#include "nsIUrlListener.h"
#include "nsWeakPtr.h"
#include "nsTArray.h"
#include "prlog.h"
#include "nsIWeakReferenceUtils.h"

class nsImapMailFolder;
class nsIAutoSyncMsgStrategy;
class nsIMsgDatabase;

/**
 * An adaptor class to make msg strategy nsTArray.Sort()
 * compatible.
 */
class MsgStrategyComparatorAdaptor 
{
 public:
  MsgStrategyComparatorAdaptor(nsIAutoSyncMsgStrategy* aStrategy, 
    nsIMsgFolder *aFolder, nsIMsgDatabase *aDatabase);

  /** @return True if the elements are equals; false otherwise. */
  bool Equals(const nsMsgKey& a, const nsMsgKey& b) const;
  
  /** @return True if (a < b); false otherwise. */
  bool LessThan(const nsMsgKey& a, const nsMsgKey& b) const;
  
 private:
  MsgStrategyComparatorAdaptor();
  
 private:
  nsIAutoSyncMsgStrategy *mStrategy;
  nsIMsgFolder *mFolder;
  nsIMsgDatabase *mDatabase;
};


/**
 * Facilitates auto-sync capabilities for imap folders.
 */
class nsAutoSyncState : public nsIAutoSyncState, public nsIUrlListener
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIAUTOSYNCSTATE
  NS_DECL_NSIURLLISTENER

  nsAutoSyncState(nsImapMailFolder *aOwnerFolder, PRTime aLastSyncTime = 0UL);

  /// Called by owner folder when new headers are fetched from the server
  void OnNewHeaderFetchCompleted(const nsTArray<nsMsgKey> &aMsgKeyList);

  /// Sets the last sync time in lower precision (seconds)
  void SetLastSyncTimeInSec(PRInt32 aLastSyncTime);

  /// Manages storage space for auto-sync operations 
  nsresult ManageStorageSpace();

  void SetServerCounts(PRInt32 total, PRInt32 recent, PRInt32 unseen,
                       PRInt32 nextUID);

 private:
  ~nsAutoSyncState();
  
  nsresult PlaceIntoDownloadQ(const nsTArray<nsMsgKey> &aMsgKeyList);
  nsresult SortQueueBasedOnStrategy(nsTArray<nsMsgKey> &aQueue);
  nsresult SortSubQueueBasedOnStrategy(nsTArray<nsMsgKey> &aQueue, 
                                    PRUint32 aStartingOffset);

  void LogOwnerFolderName(const char *s);
  void LogQWithSize(nsTArray<nsMsgKey>& q, PRUint32 toOffset = 0);
  void LogQWithSize(nsIMutableArray *q, PRUint32 toOffset = 0);

 private:
  PRInt32 mSyncState;
  nsWeakPtr mOwnerFolder;
  PRUint32 mOffset;
  PRUint32 mLastOffset;

  // used to tell if the Server counts have changed.
  PRInt32 mLastServerTotal;
  PRInt32 mLastServerRecent;
  PRInt32 mLastServerUnseen;
  PRInt32 mLastNextUID;

  PRTime mLastSyncTime;
  PRTime mLastUpdateTime;
  PRUint32 mProcessPointer;
  bool mIsDownloadQChanged;
  PRUint32 mRetryCounter;
  nsTArray<nsMsgKey> mDownloadQ;
  nsTArray<nsMsgKey> mExistingHeadersQ;
};

#endif
