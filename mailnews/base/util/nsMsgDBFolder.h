/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsMsgDBFolder_h__
#define nsMsgDBFolder_h__

#include "mozilla/Attributes.h"
#include "msgCore.h"
#include "nsIMsgFolder.h" 
#include "nsRDFResource.h"
#include "nsIDBFolderInfo.h"
#include "nsIMsgDatabase.h"
#include "nsIMsgIncomingServer.h"
#include "nsCOMPtr.h"
#include "nsStaticAtom.h"
#include "nsIDBChangeListener.h"
#include "nsIMsgPluggableStore.h"
#include "nsIURL.h"
#include "nsIFile.h"
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
#include "nsIMsgFilterPlugin.h"
class nsIMsgFolderCacheElement;
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
                                 public nsIUrlListener,
                                 public nsIJunkMailClassificationListener,
                                 public nsIMsgTraitClassificationListener
{
public: 
  nsMsgDBFolder(void);
  virtual ~nsMsgDBFolder(void);
  NS_DECL_ISUPPORTS_INHERITED
  NS_DECL_NSIMSGFOLDER
  NS_DECL_NSIDBCHANGELISTENER
  NS_DECL_NSIURLLISTENER
  NS_DECL_NSIJUNKMAILCLASSIFICATIONLISTENER
  NS_DECL_NSIMSGTRAITCLASSIFICATIONLISTENER
  
  NS_IMETHOD WriteToFolderCacheElem(nsIMsgFolderCacheElement *element);
  NS_IMETHOD ReadFromFolderCacheElem(nsIMsgFolderCacheElement *element);

  // nsRDFResource overrides
  NS_IMETHOD Init(const char* aURI) MOZ_OVERRIDE;

  // These functions are used for tricking the front end into thinking that we have more 
  // messages than are really in the DB.  This is usually after and IMAP message copy where
  // we don't want to do an expensive select until the user actually opens that folder
  // These functions are called when MSG_Master::GetFolderLineById is populating a MSG_FolderLine
  // struct used by the FE
  int32_t GetNumPendingUnread();
  int32_t GetNumPendingTotalMessages();

  void ChangeNumPendingUnread(int32_t delta);
  void ChangeNumPendingTotalMessages(int32_t delta);

  nsresult CreateDirectoryForFolder(nsIFile **result);
  nsresult CreateBackupDirectory(nsIFile **result);
  nsresult GetBackupSummaryFile(nsIFile **result, const nsACString& newName);
  nsresult GetMsgPreviewTextFromStream(nsIMsgDBHdr *msgHdr, nsIInputStream *stream);
  nsresult HandleAutoCompactEvent(nsIMsgWindow *aMsgWindow);
protected:
  
  // this is a little helper function that is not part of the public interface. 
  // we use it to get the IID of the incoming server for the derived folder.
  // w/out a function like this we would have to implement GetServer in each
  // derived folder class.
  virtual void GetIncomingServerType(nsCString& serverType) = 0;

  virtual nsresult CreateBaseMessageURI(const nsACString& aURI);

  void compressQuotesInMsgSnippet(const nsString& aMessageText, nsAString& aCompressedQuotesStr);
  void decodeMsgSnippet(const nsACString& aEncodingType, bool aIsComplete, nsCString& aMsgSnippet);

  // helper routine to parse the URI and update member variables
  nsresult parseURI(bool needServer=false);
  nsresult GetBaseStringBundle(nsIStringBundle **aBundle);
  nsresult GetStringFromBundle(const char* msgName, nsString& aResult);
  nsresult ThrowConfirmationPrompt(nsIMsgWindow *msgWindow, const nsAString& confirmString, bool *confirmed);
  nsresult GetWarnFilterChanged(bool *aVal);
  nsresult SetWarnFilterChanged(bool aVal);
  nsresult CreateCollationKey(const nsString &aSource,  uint8_t **aKey, uint32_t *aLength);

protected:
  // all children will override this to create the right class of object.
  virtual nsresult CreateChildFromURI(const nsCString &uri, nsIMsgFolder **folder) = 0;
  virtual nsresult ReadDBFolderInfo(bool force);
  virtual nsresult FlushToFolderCache();
  virtual nsresult GetDatabase() = 0;
  virtual nsresult SendFlagNotifications(nsIMsgDBHdr *item, uint32_t oldFlags, uint32_t newFlags);
  nsresult CheckWithNewMessagesStatus(bool messageAdded);
  void     UpdateNewMessages();
  nsresult OnHdrAddedOrDeleted(nsIMsgDBHdr *hdrChanged, bool added);
  nsresult CreateFileForDB(const nsAString& userLeafName, nsIFile *baseDir,
                           nsIFile **dbFile);

  nsresult GetFolderCacheKey(nsIFile **aFile, bool createDBIfMissing = false);
  nsresult GetFolderCacheElemFromFile(nsIFile *file, nsIMsgFolderCacheElement **cacheElement);
  nsresult AddDirectorySeparator(nsIFile *path);
  nsresult CheckIfFolderExists(const nsAString& newFolderName, nsIMsgFolder *parentFolder, nsIMsgWindow *msgWindow);

  nsresult GetSummaryFile(nsIFile** aSummaryFile);

  // Returns true if: a) there is no need to prompt or b) the user is already
  // logged in or c) the user logged in successfully.
  static bool PromptForMasterPasswordIfNecessary();

  // offline support methods.
  nsresult StartNewOfflineMessage();
  nsresult WriteStartOfNewLocalMessage();
  nsresult EndNewOfflineMessage();
  nsresult CompactOfflineStore(nsIMsgWindow *inWindow, nsIUrlListener *aUrlListener);
  nsresult AutoCompact(nsIMsgWindow *aWindow);
  // this is a helper routine that ignores whether nsMsgMessageFlags::Offline is set for the folder
  nsresult MsgFitsDownloadCriteria(nsMsgKey msgKey, bool *result);
  nsresult GetPromptPurgeThreshold(bool *aPrompt);
  nsresult GetPurgeThreshold(int32_t *aThreshold);
  nsresult ApplyRetentionSettings(bool deleteViaFolder);
  bool     VerifyOfflineMessage(nsIMsgDBHdr *msgHdr, nsIInputStream *fileStream);
  nsresult AddMarkAllReadUndoAction(nsIMsgWindow *msgWindow,
                                    nsMsgKey *thoseMarked, uint32_t numMarked);

  nsresult PerformBiffNotifications(void); // if there are new, non spam messages, do biff
  nsresult CloseDBIfFolderNotOpen();

  virtual nsresult SpamFilterClassifyMessage(const char *aURI, nsIMsgWindow *aMsgWindow, nsIJunkMailPlugin *aJunkMailPlugin);
  virtual nsresult SpamFilterClassifyMessages(const char **aURIArray, uint32_t aURICount, nsIMsgWindow *aMsgWindow, nsIJunkMailPlugin *aJunkMailPlugin);
  // Helper function for Move code to call to update the MRU and MRM time.
  void    UpdateTimestamps(bool allowUndo);
  void    SetMRUTime();
  void    SetMRMTime();
  /**
   * Clear all processing flags, presumably because message keys are no longer
   * valid.
   */
  void ClearProcessingFlags();

  nsresult NotifyHdrsNotBeingClassified();

protected:
  nsCOMPtr<nsIMsgDatabase> mDatabase;
  nsCOMPtr<nsIMsgDatabase> mBackupDatabase;
  nsCString mCharset;
  bool mCharsetOverride;
  bool mAddListener;
  bool mNewMessages;
  bool mGettingNewMessages;
  nsMsgKey mLastMessageLoaded;

  nsCOMPtr <nsIMsgDBHdr> m_offlineHeader;
  int32_t m_numOfflineMsgLines;
  int32_t m_bytesAddedToLocalMsg;
  // this is currently used when we do a save as of an imap or news message..
  nsCOMPtr<nsIOutputStream> m_tempMessageStream;

  nsCOMPtr <nsIMsgRetentionSettings> m_retentionSettings;
  nsCOMPtr <nsIMsgDownloadSettings> m_downloadSettings;
  static NS_MSG_BASE_STATIC_MEMBER_(nsrefcnt) mInstanceCount;

protected:
  uint32_t mFlags;
  nsWeakPtr mParent;     //This won't be refcounted for ownership reasons.
  int32_t mNumUnreadMessages;        /* count of unread messages (-1 means unknown; -2 means unknown but we already tried to find out.) */
  int32_t mNumTotalMessages;         /* count of existing messages. */
  bool mNotifyCountChanges;
  uint32_t mExpungedBytes;
  nsCOMArray<nsIMsgFolder> mSubFolders;
  // This can't be refcounted due to ownsership issues
  nsTObserverArray<nsIFolderListener*> mListeners;

  bool mInitializedFromCache;
  nsISupports *mSemaphoreHolder; // set when the folder is being written to
                                 //Due to ownership issues, this won't be AddRef'd.

  nsWeakPtr mServer;

  // These values are used for tricking the front end into thinking that we have more 
  // messages than are really in the DB.  This is usually after and IMAP message copy where
  // we don't want to do an expensive select until the user actually opens that folder
  int32_t mNumPendingUnreadMessages;
  int32_t mNumPendingTotalMessages;
  uint32_t mFolderSize;

  int32_t mNumNewBiffMessages;
  bool mIsCachable;

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
  bool mHaveParsedURI;        // is the URI completely parsed?
  bool mIsServerIsValid;
  bool mIsServer;
  nsString mName;
  nsCOMPtr<nsIFile> mPath;
  nsCString mBaseMessageURI; //The uri with the message scheme

  bool mInVFEditSearchScope ; // non persistant state used by the virtual folder UI

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
  static NS_MSG_BASE_STATIC_MEMBER_(PRUnichar*) kLocalizedArchivesName;

  static NS_MSG_BASE_STATIC_MEMBER_(PRUnichar*) kLocalizedBrandShortName;
  
#define MSGDBFOLDER_ATOM(name_, value) static NS_MSG_BASE_STATIC_MEMBER_(nsIAtom*) name_;
#include "nsMsgDBFolderAtomList.h"
#undef MSGDBFOLDER_ATOM

  static NS_MSG_BASE_STATIC_MEMBER_(nsICollation*) gCollationKeyGenerator;

  static const NS_MSG_BASE_STATIC_MEMBER_(nsStaticAtom) folder_atoms[];

  // store of keys that have a processing flag set
  struct
  {
    uint32_t bit;
    nsMsgKeySetU* keys;
  } mProcessingFlag[nsMsgProcessingFlags::NumberOfFlags];

  // list of nsIMsgDBHdrs for messages to process post-bayes
  nsCOMPtr<nsIMutableArray> mPostBayesMessagesToFilter;

  /**
   * The list of message keys that have been classified for msgsClassified
   * batch notification purposes.  We add to this list in OnMessageClassified
   * when we are told about a classified message (a URI is provided), and we
   * notify for the list and clear it when we are told all the messages in
   * the batch were classified (a URI is not provided).
   */
  nsTArray<nsMsgKey> mClassifiedMsgKeys;
  // Is the current bayes filtering doing junk classification?
  bool mBayesJunkClassifying;
  // Is the current bayes filtering doing trait classification?
  bool mBayesTraitClassifying;
};

// This class is a kludge to allow nsMsgKeySet to be used with uint32_t keys
class nsMsgKeySetU
{
public:
    // Creates an empty set.
  static nsMsgKeySetU* Create();
  ~nsMsgKeySetU();
  // IsMember() returns whether the given key is a member of this set.
  bool IsMember(uint32_t key);
  // Add() adds the given key to the set.  (Returns 1 if a change was
  // made, 0 if it was already there, and negative on error.)
  int Add(uint32_t key);
  // Remove() removes the given article from the set. 
  int Remove(uint32_t key);
  // Add the keys in the set to aArray.
  nsresult ToMsgKeyArray(nsTArray<nsMsgKey> &aArray);

protected:
  nsMsgKeySetU();
  nsMsgKeySet* loKeySet;
  nsMsgKeySet* hiKeySet;
};

#undef  IMETHOD_VISIBILITY
#define IMETHOD_VISIBILITY NS_VISIBILITY_HIDDEN

#endif
