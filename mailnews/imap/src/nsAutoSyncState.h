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
  void SetLastSyncTimeInSec(int32_t aLastSyncTime);

  /// Manages storage space for auto-sync operations 
  nsresult ManageStorageSpace();

  void SetServerCounts(int32_t total, int32_t recent, int32_t unseen,
                       int32_t nextUID);

 private:
  ~nsAutoSyncState();
  
  nsresult PlaceIntoDownloadQ(const nsTArray<nsMsgKey> &aMsgKeyList);
  nsresult SortQueueBasedOnStrategy(nsTArray<nsMsgKey> &aQueue);
  nsresult SortSubQueueBasedOnStrategy(nsTArray<nsMsgKey> &aQueue, 
                                    uint32_t aStartingOffset);

  void LogOwnerFolderName(const char *s);
  void LogQWithSize(nsTArray<nsMsgKey>& q, uint32_t toOffset = 0);
  void LogQWithSize(nsIMutableArray *q, uint32_t toOffset = 0);

 private:
  int32_t mSyncState;
  nsWeakPtr mOwnerFolder;
  uint32_t mOffset;
  uint32_t mLastOffset;

  // used to tell if the Server counts have changed.
  int32_t mLastServerTotal;
  int32_t mLastServerRecent;
  int32_t mLastServerUnseen;
  int32_t mLastNextUID;

  PRTime mLastSyncTime;
  PRTime mLastUpdateTime;
  uint32_t mProcessPointer;
  bool mIsDownloadQChanged;
  uint32_t mRetryCounter;
  nsTArray<nsMsgKey> mDownloadQ;
  nsTArray<nsMsgKey> mExistingHeadersQ;
};

#endif
