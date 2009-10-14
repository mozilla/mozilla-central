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

#ifndef nsAutoSyncState_h__
#define nsAutoSyncState_h__

#include "MailNewsTypes.h"
#include "nsIAutoSyncState.h"
#include "nsIAutoSyncManager.h" 
#include "nsIUrlListener.h"
#include "nsWeakPtr.h"
#include "nsTArray.h"
#include "prlog.h"

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
  PRBool Equals(const nsMsgKey& a, const nsMsgKey& b) const;
  
  /** @return True if (a < b); false otherwise. */
  PRBool LessThan(const nsMsgKey& a, const nsMsgKey& b) const;
  
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
  
  /// Called by owner folder when new headers are fetched form the server
  nsresult OnNewHeaderFetchCompleted(const nsTArray<nsMsgKey> &aMsgKeyList);

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
  PRBool mIsDownloadQChanged;
  PRUint32 mRetryCounter;
  nsTArray<nsMsgKey> mDownloadQ;
  nsTArray<nsMsgKey> mExistingHeadersQ;
};

#endif
