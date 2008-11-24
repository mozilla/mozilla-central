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
 * Portions created by the Initial Developer are Copyright (C) 1999
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

#ifndef nsMsgDBFolder_h__
#define nsMsgDBFolder_h__

#include "msgCore.h"
#include "nsIMsgFolder.h" 
#include "nsRDFResource.h"
#include "nsIDBFolderInfo.h"
#include "nsIMsgDatabase.h"
#include "nsIMsgIncomingServer.h"
#include "nsCOMPtr.h"
#include "nsStaticAtom.h"
#include "nsIDBChangeListener.h"
#include "nsIURL.h"
#include "nsILocalFile.h"
#include "nsWeakReference.h"
#include "nsIMsgFilterList.h"
#include "nsIUrlListener.h"
#include "nsIMsgHdr.h"
#include "nsIOutputStream.h"
#include "nsITransport.h"
#include "nsIStringBundle.h"
#include "nsTObserverArray.h"
#include "nsCOMArray.h"
#include "nsMsgKeySet.h"
#include "nsMsgMessageFlags.h"
class nsIMsgFolderCacheElement;
class nsIJunkMailPlugin;
class nsICollation;
class nsMsgKeySetU;

 /* 
  * nsMsgDBFolder
  * class derived from nsMsgFolder for those folders that use an nsIMsgDatabase
  */ 

#undef IMETHOD_VISIBILITY
#define IMETHOD_VISIBILITY NS_VISIBILITY_DEFAULT

class NS_MSG_BASE nsMsgDBFolder: public nsRDFResource,
                                 public nsSupportsWeakReference,
                                 public nsIMsgFolder,
                                 public nsIDBChangeListener,
                                 public nsIUrlListener
{
public: 
  nsMsgDBFolder(void);
  virtual ~nsMsgDBFolder(void);
  NS_DECL_ISUPPORTS_INHERITED
  NS_DECL_NSIMSGFOLDER
  NS_DECL_NSIDBCHANGELISTENER
  NS_DECL_NSIURLLISTENER
  
  NS_IMETHOD WriteToFolderCacheElem(nsIMsgFolderCacheElement *element);
  NS_IMETHOD ReadFromFolderCacheElem(nsIMsgFolderCacheElement *element);

  // nsRDFResource overrides
  NS_IMETHOD Init(const char* aURI);

  // These functions are used for tricking the front end into thinking that we have more 
  // messages than are really in the DB.  This is usually after and IMAP message copy where
  // we don't want to do an expensive select until the user actually opens that folder
  // These functions are called when MSG_Master::GetFolderLineById is populating a MSG_FolderLine
  // struct used by the FE
  PRInt32 GetNumPendingUnread();
  PRInt32 GetNumPendingTotalMessages();

  void ChangeNumPendingUnread(PRInt32 delta);
  void ChangeNumPendingTotalMessages(PRInt32 delta);

  nsresult CreateDirectoryForFolder(nsILocalFile **result);
  nsresult CreateBackupDirectory(nsILocalFile **result);
  nsresult GetBackupSummaryFile(nsILocalFile **result, const nsACString& newName);
  nsresult GetMsgPreviewTextFromStream(nsIMsgDBHdr *msgHdr, nsIInputStream *stream);
protected:
  
  // this is a little helper function that is not part of the public interface. 
  // we use it to get the IID of the incoming server for the derived folder.
  // w/out a function like this we would have to implement GetServer in each
  // derived folder class.
  virtual void GetIncomingServerType(nsCString& serverType) = 0;

  virtual nsresult CreateBaseMessageURI(const nsACString& aURI);

  nsresult convertMsgSnippetToPlainText(nsAString& aMessageText);
  void compressQuotesInMsgSnippet(const nsString& aMessageText, nsAString& aCompressedQuotesStr);
  void decodeMsgSnippet(const nsACString& aEncodingType, PRBool aIsComplete, nsCString& aMsgSnippet);

  // helper routine to parse the URI and update member variables
  nsresult parseURI(PRBool needServer=PR_FALSE);
  nsresult GetBaseStringBundle(nsIStringBundle **aBundle);
  nsresult GetStringFromBundle(const char* msgName, nsString& aResult);
  nsresult ThrowConfirmationPrompt(nsIMsgWindow *msgWindow, const nsAString& confirmString, PRBool *confirmed);
  nsresult GetWarnFilterChanged(PRBool *aVal);
  nsresult SetWarnFilterChanged(PRBool aVal);
  nsresult CreateCollationKey(const nsString &aSource,  PRUint8 **aKey, PRUint32 *aLength);

protected:
  // all children will override this to create the right class of object.
  virtual nsresult CreateChildFromURI(const nsCString &uri, nsIMsgFolder **folder) = 0;
  virtual nsresult ReadDBFolderInfo(PRBool force);
  virtual nsresult FlushToFolderCache();
  virtual nsresult GetDatabase(nsIMsgWindow *aMsgWindow) = 0;
  virtual nsresult SendFlagNotifications(nsIMsgDBHdr *item, PRUint32 oldFlags, PRUint32 newFlags);
  nsresult CheckWithNewMessagesStatus(PRBool messageAdded);
  void     UpdateNewMessages();
  nsresult OnHdrAddedOrDeleted(nsIMsgDBHdr *hdrChanged, PRBool added);
  nsresult CreateFileForDB(const nsACString& userLeafName, nsILocalFile *baseDir, nsILocalFile **dbFile);

  nsresult GetFolderCacheKey(nsILocalFile **aFile, PRBool createDBIfMissing = PR_FALSE);
  nsresult GetFolderCacheElemFromFile(nsILocalFile *file, nsIMsgFolderCacheElement **cacheElement);
  nsresult AddDirectorySeparator(nsILocalFile *path);
  nsresult CheckIfFolderExists(const nsAString& newFolderName, nsIMsgFolder *parentFolder, nsIMsgWindow *msgWindow);

  nsresult PromptForCachePassword(nsIMsgIncomingServer *server, nsIMsgWindow *aWindow, PRBool &passwordCorrect);
  // offline support methods.
  nsresult StartNewOfflineMessage();
  nsresult WriteStartOfNewLocalMessage();
  nsresult EndNewOfflineMessage();
  nsresult CompactOfflineStore(nsIMsgWindow *inWindow);
  nsresult AutoCompact(nsIMsgWindow *aWindow);
  // this is a helper routine that ignores whether MSG_FLAG_OFFLINE is set for the folder
  nsresult MsgFitsDownloadCriteria(nsMsgKey msgKey, PRBool *result);
  nsresult GetPromptPurgeThreshold(PRBool *aPrompt);
  nsresult GetPurgeThreshold(PRInt32 *aThreshold);
  nsresult ApplyRetentionSettings(PRBool deleteViaFolder);

  nsresult PerformBiffNotifications(void); // if there are new, non spam messages, do biff
  nsresult CloseDBIfFolderNotOpen();

  virtual nsresult SpamFilterClassifyMessage(const char *aURI, nsIMsgWindow *aMsgWindow, nsIJunkMailPlugin *aJunkMailPlugin);
  virtual nsresult SpamFilterClassifyMessages(const char **aURIArray, PRUint32 aURICount, nsIMsgWindow *aMsgWindow, nsIJunkMailPlugin *aJunkMailPlugin);
  void    SetMRUTime();

protected:
  nsCOMPtr<nsIMsgDatabase> mDatabase;
  nsCOMPtr<nsIMsgDatabase> mBackupDatabase;
  nsCString mCharset;
  PRBool mCharsetOverride;
  PRBool mAddListener;
  PRBool mNewMessages;
  PRBool mGettingNewMessages;
  nsMsgKey mLastMessageLoaded;

  nsCOMPtr <nsIMsgDBHdr> m_offlineHeader;
  PRInt32 m_numOfflineMsgLines;
  // this is currently used when we do a save as of an imap or news message..
  nsCOMPtr<nsIOutputStream> m_tempMessageStream;

  nsCOMPtr <nsIMsgRetentionSettings> m_retentionSettings;
  nsCOMPtr <nsIMsgDownloadSettings> m_downloadSettings;
  static NS_MSG_BASE_STATIC_MEMBER_(nsIAtom*) mFolderLoadedAtom;
  static NS_MSG_BASE_STATIC_MEMBER_(nsIAtom*) mDeleteOrMoveMsgCompletedAtom;
  static NS_MSG_BASE_STATIC_MEMBER_(nsIAtom*) mDeleteOrMoveMsgFailedAtom;
  static NS_MSG_BASE_STATIC_MEMBER_(nsIAtom*) mJunkStatusChangedAtom;
  static NS_MSG_BASE_STATIC_MEMBER_(nsrefcnt) mInstanceCount;

protected:
  PRUint32 mFlags;
  nsWeakPtr mParent;     //This won't be refcounted for ownership reasons.
  PRInt32 mNumUnreadMessages;        /* count of unread messages (-1 means unknown; -2 means unknown but we already tried to find out.) */
  PRInt32 mNumTotalMessages;         /* count of existing messages. */
  PRBool mNotifyCountChanges;
  PRUint32 mExpungedBytes;
  nsCOMArray<nsIMsgFolder> mSubFolders;
  // This can't be refcounted due to ownsership issues
  nsTObserverArray<nsIFolderListener*> mListeners;

  PRBool mInitializedFromCache;
  nsISupports *mSemaphoreHolder; // set when the folder is being written to
                                 //Due to ownership issues, this won't be AddRef'd.

  nsWeakPtr mServer;

  // These values are used for tricking the front end into thinking that we have more 
  // messages than are really in the DB.  This is usually after and IMAP message copy where
  // we don't want to do an expensive select until the user actually opens that folder
  PRInt32 mNumPendingUnreadMessages;
  PRInt32 mNumPendingTotalMessages;
  PRUint32 mFolderSize;

  PRInt32 mNumNewBiffMessages;
  PRBool mIsCachable;

  // these are previous set of new msgs, which we might
  // want to run junk controls on. This is in addition to "new" hdrs
  // in the db, which might get cleared because the user clicked away
  // from the folder.
  nsTArray<nsMsgKey> m_saveNewMsgs;

  // These are the set of new messages for a folder who has had
  // its db closed, without the user reading the folder. This 
  // happens with pop3 mail filtered to a different local folder.
  nsTArray<nsMsgKey> m_newMsgs;

  //
  // stuff from the uri
  //
  PRBool mHaveParsedURI;        // is the URI completely parsed?
  PRBool mIsServerIsValid;
  PRBool mIsServer;
  nsString mName;
  nsCOMPtr<nsILocalFile> mPath;
  nsCString mBaseMessageURI; //The uri with the message scheme

  PRBool mInVFEditSearchScope ; // non persistant state used by the virtual folder UI

  // static stuff for cross-instance objects like atoms
  static NS_MSG_BASE_STATIC_MEMBER_(nsrefcnt) gInstanceCount;

  static nsresult initializeStrings();
  static nsresult createCollationKeyGenerator();

  static NS_MSG_BASE_STATIC_MEMBER_(PRUnichar*) kLocalizedInboxName;
  static NS_MSG_BASE_STATIC_MEMBER_(PRUnichar*) kLocalizedTrashName;
  static NS_MSG_BASE_STATIC_MEMBER_(PRUnichar*) kLocalizedSentName;
  static NS_MSG_BASE_STATIC_MEMBER_(PRUnichar*) kLocalizedDraftsName;
  static NS_MSG_BASE_STATIC_MEMBER_(PRUnichar*) kLocalizedTemplatesName;
  static NS_MSG_BASE_STATIC_MEMBER_(PRUnichar*) kLocalizedUnsentName;
  static NS_MSG_BASE_STATIC_MEMBER_(PRUnichar*) kLocalizedJunkName;
  static NS_MSG_BASE_STATIC_MEMBER_(PRUnichar*) kLocalizedBrandShortName;
  
  static NS_MSG_BASE_STATIC_MEMBER_(nsIAtom*) kTotalUnreadMessagesAtom;
  static NS_MSG_BASE_STATIC_MEMBER_(nsIAtom*) kBiffStateAtom;
  static NS_MSG_BASE_STATIC_MEMBER_(nsIAtom*) kNewMessagesAtom;
  static NS_MSG_BASE_STATIC_MEMBER_(nsIAtom*) kInVFEditSearchScopeAtom;
  static NS_MSG_BASE_STATIC_MEMBER_(nsIAtom*) kNumNewBiffMessagesAtom;
  static NS_MSG_BASE_STATIC_MEMBER_(nsIAtom*) kTotalMessagesAtom;
  static NS_MSG_BASE_STATIC_MEMBER_(nsIAtom*) kFolderSizeAtom;
  static NS_MSG_BASE_STATIC_MEMBER_(nsIAtom*) kStatusAtom;
  static NS_MSG_BASE_STATIC_MEMBER_(nsIAtom*) kFlaggedAtom;
  static NS_MSG_BASE_STATIC_MEMBER_(nsIAtom*) kNameAtom;
  static NS_MSG_BASE_STATIC_MEMBER_(nsIAtom*) kSynchronizeAtom;
  static NS_MSG_BASE_STATIC_MEMBER_(nsIAtom*) kOpenAtom;
  static NS_MSG_BASE_STATIC_MEMBER_(nsIAtom*) kIsDeferred;
  static NS_MSG_BASE_STATIC_MEMBER_(nsIAtom*) kKeywords;
  static NS_MSG_BASE_STATIC_MEMBER_(nsICollation*) gCollationKeyGenerator;

#ifdef MSG_FASTER_URI_PARSING
  // cached parsing URL object
  static NS_MSG_BASE_STATIC_MEMBER_(nsCOMPtr<nsIURL>) mParsingURL;
  static NS_MSG_BASE_STATIC_MEMBER_(PRBool) mParsingURLInUse;
#endif

  static const NS_MSG_BASE_STATIC_MEMBER_(nsStaticAtom) folder_atoms[];

  // store of keys that have a processing flag set
  struct
  {
    PRUint32 bit;
    nsMsgKeySetU* keys;
  } mProcessingFlag[MSG_NUMBER_OF_PROCESSING_FLAGS];
};

// This class is a kludge to allow nsMsgKeySet to be used with PRUint32 keys
class nsMsgKeySetU
{
public:
    // Creates an empty set.
  static nsMsgKeySetU* Create();
  ~nsMsgKeySetU();
  // IsMember() returns whether the given key is a member of this set.
  PRBool IsMember(PRUint32 key);
  // Add() adds the given key to the set.  (Returns 1 if a change was
  // made, 0 if it was already there, and negative on error.)
  int Add(PRUint32 key);
  // Remove() removes the given article from the set. 
  int Remove(PRUint32 key);

protected:
  nsMsgKeySetU();
  nsMsgKeySet* loKeySet;
  nsMsgKeySet* hiKeySet;
};

#undef  IMETHOD_VISIBILITY
#define IMETHOD_VISIBILITY NS_VISIBILITY_HIDDEN

#endif
