/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
   Interface for representing Local Mail folders.
*/

#ifndef nsMsgLocalMailFolder_h__
#define nsMsgLocalMailFolder_h__

#include "mozilla/Attributes.h"
#include "nsMsgDBFolder.h" /* include the interface we are going to support */
#include "nsAutoPtr.h"
#include "nsICopyMessageListener.h"
#include "nsIFileStreams.h"
#include "nsIPop3IncomingServer.h"  // need this for an interface ID
#include "nsMsgTxn.h"
#include "nsIMsgMessageService.h"
#include "nsIMsgParseMailMsgState.h"
#include "nsITransactionManager.h"
#include "nsIMsgLocalMailFolder.h"
#include "nsISeekableStream.h"
#include "nsIMutableArray.h"
#include "nsLocalUndoTxn.h"

#define COPY_BUFFER_SIZE 16384

class nsParseMailMessageState;

struct nsLocalMailCopyState
{
  nsLocalMailCopyState();
  virtual ~nsLocalMailCopyState();
  
  nsCOMPtr <nsIOutputStream> m_fileStream;
  nsCOMPtr<nsIMsgPluggableStore> m_msgStore;
  nsCOMPtr<nsISupports> m_srcSupport;
  /// Source nsIMsgDBHdr instances.
  nsCOMPtr<nsIArray> m_messages;
  /// Destination nsIMsgDBHdr instances.
  nsCOMPtr<nsIMutableArray> m_destMessages;
  nsRefPtr<nsLocalMoveCopyMsgTxn> m_undoMsgTxn;
  nsCOMPtr<nsIMsgDBHdr> m_message; // current copy message
  nsMsgMessageFlagType m_flags; // current copy message flags
  nsRefPtr<nsParseMailMessageState> m_parseMsgState;
  nsCOMPtr<nsIMsgCopyServiceListener> m_listener;
  nsCOMPtr<nsIMsgWindow> m_msgWindow;
  nsCOMPtr<nsIMsgDatabase> m_destDB;

  // for displaying status;
  nsCOMPtr <nsIMsgStatusFeedback> m_statusFeedback;
  nsCOMPtr <nsIStringBundle> m_stringBundle;
  int64_t m_lastProgressTime;

  nsMsgKey m_curDstKey;
  uint32_t m_curCopyIndex;
  nsCOMPtr <nsIMsgMessageService> m_messageService;
  /// The number of messages in m_messages.
  uint32_t m_totalMsgCount;
  char *m_dataBuffer;
  uint32_t m_dataBufferSize;
  uint32_t m_leftOver;
  bool m_isMove;
  bool m_isFolder;   // isFolder move/copy
  bool m_dummyEnvelopeNeeded;
  bool m_copyingMultipleMessages;
  bool m_fromLineSeen;
  bool m_allowUndo;
  bool m_writeFailed;
  bool m_notifyFolderLoaded;
  bool m_wholeMsgInStream;
  nsCString    m_newMsgKeywords;
  nsCOMPtr <nsIMsgDBHdr> m_newHdr;
};

struct nsLocalFolderScanState
{
  nsLocalFolderScanState();
  ~nsLocalFolderScanState();

  nsCOMPtr<nsIInputStream> m_inputStream;
  nsCOMPtr<nsISeekableStream> m_seekableStream;
  nsCOMPtr<nsIMsgPluggableStore> m_msgStore;
  nsCString m_header;
  nsCString m_accountKey;
  const char *m_uidl; // memory is owned by m_header
  // false if we need a new input stream for each message
  bool m_streamReusable;
};

class nsMsgLocalMailFolder : public nsMsgDBFolder,
                             public nsIMsgLocalMailFolder,
                             public nsICopyMessageListener
{
public:
  nsMsgLocalMailFolder(void);
  virtual ~nsMsgLocalMailFolder(void);
  NS_DECL_NSICOPYMESSAGELISTENER
  NS_DECL_NSIMSGLOCALMAILFOLDER
  NS_DECL_NSIJUNKMAILCLASSIFICATIONLISTENER
  NS_DECL_ISUPPORTS_INHERITED
  // nsIRDFResource methods:
  NS_IMETHOD Init(const char *aURI) MOZ_OVERRIDE;

  // nsIUrlListener methods
  NS_IMETHOD OnStartRunningUrl(nsIURI * aUrl) MOZ_OVERRIDE;
  NS_IMETHOD OnStopRunningUrl(nsIURI * aUrl, nsresult aExitCode) MOZ_OVERRIDE;

  // nsIMsgFolder methods:
  NS_IMETHOD GetSubFolders(nsISimpleEnumerator* *aResult) MOZ_OVERRIDE;
  NS_IMETHOD GetMsgDatabase(nsIMsgDatabase **aMsgDatabase) MOZ_OVERRIDE;

  NS_IMETHOD OnAnnouncerGoingAway(nsIDBChangeAnnouncer *instigator) MOZ_OVERRIDE;
  NS_IMETHOD GetMessages(nsISimpleEnumerator **result) MOZ_OVERRIDE;
  NS_IMETHOD UpdateFolder(nsIMsgWindow *aWindow) MOZ_OVERRIDE;

  NS_IMETHOD CreateSubfolder(const nsAString& folderName ,nsIMsgWindow *msgWindow) MOZ_OVERRIDE;

  NS_IMETHOD Compact(nsIUrlListener *aListener, nsIMsgWindow *aMsgWindow) MOZ_OVERRIDE;
  NS_IMETHOD CompactAll(nsIUrlListener *aListener, nsIMsgWindow *aMsgWindow, bool aCompactOfflineAlso) MOZ_OVERRIDE;
  NS_IMETHOD EmptyTrash(nsIMsgWindow *msgWindow, nsIUrlListener *aListener) MOZ_OVERRIDE;
  NS_IMETHOD Delete () MOZ_OVERRIDE;
  NS_IMETHOD DeleteSubFolders(nsIArray *folders, nsIMsgWindow *msgWindow) MOZ_OVERRIDE;
  NS_IMETHOD CreateStorageIfMissing(nsIUrlListener* urlListener) MOZ_OVERRIDE;
  NS_IMETHOD Rename (const nsAString& aNewName, nsIMsgWindow *msgWindow) MOZ_OVERRIDE;
  NS_IMETHOD RenameSubFolders (nsIMsgWindow *msgWindow, nsIMsgFolder *oldFolder) MOZ_OVERRIDE;

  NS_IMETHOD GetPrettyName(nsAString& prettyName) MOZ_OVERRIDE; // Override of the base, for top-level mail folder
  NS_IMETHOD SetPrettyName(const nsAString& aName) MOZ_OVERRIDE;

  NS_IMETHOD GetFolderURL(nsACString& url) MOZ_OVERRIDE;

  NS_IMETHOD  GetManyHeadersToDownload(bool *retval) MOZ_OVERRIDE;

  NS_IMETHOD GetDeletable (bool *deletable) MOZ_OVERRIDE;
  NS_IMETHOD GetSizeOnDisk(uint32_t* size) MOZ_OVERRIDE;

  NS_IMETHOD  GetDBFolderInfoAndDB(nsIDBFolderInfo **folderInfo, nsIMsgDatabase **db) MOZ_OVERRIDE;

  NS_IMETHOD DeleteMessages(nsIArray *messages, 
                      nsIMsgWindow *msgWindow, bool
                      deleteStorage, bool isMove,
                      nsIMsgCopyServiceListener* listener, bool allowUndo) MOZ_OVERRIDE;
  NS_IMETHOD CopyMessages(nsIMsgFolder *srcFolder, nsIArray* messages,
                          bool isMove, nsIMsgWindow *msgWindow,
                          nsIMsgCopyServiceListener* listener, bool isFolder, bool allowUndo) MOZ_OVERRIDE;
  NS_IMETHOD CopyFolder(nsIMsgFolder *srcFolder, bool isMoveFolder, nsIMsgWindow *msgWindow,
                          nsIMsgCopyServiceListener* listener) MOZ_OVERRIDE;
  NS_IMETHOD CopyFileMessage(nsIFile* aFile, nsIMsgDBHdr* msgToReplace,
                             bool isDraftOrTemplate, 
                             uint32_t newMsgFlags,
                             const nsACString &aNewMsgKeywords,
                             nsIMsgWindow *msgWindow,
                             nsIMsgCopyServiceListener* listener) MOZ_OVERRIDE;
  NS_IMETHOD MarkMessagesRead(nsIArray *aMessages, bool aMarkRead) MOZ_OVERRIDE;
  NS_IMETHOD MarkMessagesFlagged(nsIArray *aMessages, bool aMarkFlagged) MOZ_OVERRIDE;
  NS_IMETHOD GetNewMessages(nsIMsgWindow *aWindow, nsIUrlListener *aListener) MOZ_OVERRIDE;
  NS_IMETHOD NotifyCompactCompleted() MOZ_OVERRIDE;
  NS_IMETHOD Shutdown(bool shutdownChildren) MOZ_OVERRIDE;

  NS_IMETHOD WriteToFolderCacheElem(nsIMsgFolderCacheElement *element) MOZ_OVERRIDE;
  NS_IMETHOD ReadFromFolderCacheElem(nsIMsgFolderCacheElement *element) MOZ_OVERRIDE;

  NS_IMETHOD GetName(nsAString& aName) MOZ_OVERRIDE;

  // Used when headers_only is TRUE
  NS_IMETHOD DownloadMessagesForOffline(nsIArray *aMessages, nsIMsgWindow *aWindow) MOZ_OVERRIDE;
  NS_IMETHOD FetchMsgPreviewText(nsMsgKey *aKeysToFetch, uint32_t aNumKeys,
                                                 bool aLocalOnly, nsIUrlListener *aUrlListener, 
                                                 bool *aAsyncResults) MOZ_OVERRIDE;
  NS_IMETHOD AddKeywordsToMessages(nsIArray *aMessages, const nsACString& aKeywords) MOZ_OVERRIDE;
  NS_IMETHOD RemoveKeywordsFromMessages(nsIArray *aMessages, const nsACString& aKeywords) MOZ_OVERRIDE;

protected:
  nsresult CreateChildFromURI(const nsCString &uri, nsIMsgFolder **folder) MOZ_OVERRIDE;
  nsresult CopyFolderAcrossServer(nsIMsgFolder *srcFolder, nsIMsgWindow *msgWindow,nsIMsgCopyServiceListener* listener);

  nsresult CreateSubFolders(nsIFile *path);
  nsresult GetTrashFolder(nsIMsgFolder** trashFolder);
  nsresult WriteStartOfNewMessage();

  // CreateSubfolder, but without the nsIMsgFolderListener notification
  nsresult CreateSubfolderInternal(const nsAString& folderName, nsIMsgWindow *msgWindow,
                                   nsIMsgFolder **aNewFolder);

  nsresult IsChildOfTrash(bool *result);
  nsresult RecursiveSetDeleteIsMoveTrash(bool bVal);
  nsresult ConfirmFolderDeletion(nsIMsgWindow *aMsgWindow, nsIMsgFolder *aFolder, bool *aResult);

  nsresult DeleteMessage(nsISupports *message, nsIMsgWindow *msgWindow,
                   bool deleteStorage, bool commit);
  nsresult GetDatabase() MOZ_OVERRIDE;
  // this will set mDatabase, if successful. It will also create a .msf file
  // for an empty local mail folder. It will leave invalid DBs in place, and
  // return an error.
  nsresult OpenDatabase();

  // copy message helper
  nsresult DisplayMoveCopyStatusMsg();
  nsresult SortMessagesBasedOnKey(nsTArray<nsMsgKey> &aKeyArray, nsIMsgFolder *srcFolder, nsIMutableArray* messages);

  nsresult CopyMessageTo(nsISupports *message, nsIMsgFolder *dstFolder,
                         nsIMsgWindow *msgWindow, bool isMove);

  /**
   * Checks if there's room in the target folder to copy message(s) into.
   * If not, handles alerting the user, and sending the copy notifications.
   */
  bool CheckIfSpaceForCopy(nsIMsgWindow *msgWindow,
                             nsIMsgFolder *srcFolder,
                             nsISupports *srcSupports,
                             bool isMove,
                             int64_t totalMsgSize);

  // copy multiple messages at a time from this folder
  nsresult CopyMessagesTo(nsIArray *messages, nsTArray<nsMsgKey> &keyArray,
                                       nsIMsgWindow *aMsgWindow,
                                       nsIMsgFolder *dstFolder,
                                       bool isMove);
  virtual void GetIncomingServerType(nsCString& serverType) MOZ_OVERRIDE;
  nsresult InitCopyState(nsISupports* aSupport, nsIArray* messages,
                         bool isMove, nsIMsgCopyServiceListener* listener, nsIMsgWindow *msgWindow, bool isMoveFolder, bool allowUndo);
  nsresult InitCopyMsgHdrAndFileStream();
  // preserve message metadata when moving or copying messages
  void CopyPropertiesToMsgHdr(nsIMsgDBHdr *destHdr, nsIMsgDBHdr *srcHdr, bool isMove);
  virtual nsresult CreateBaseMessageURI(const nsACString& aURI) MOZ_OVERRIDE;
  nsresult ChangeKeywordForMessages(nsIArray *aMessages, const nsACString& aKeyword, bool add);
  bool GetDeleteFromServerOnMove();
  void CopyHdrPropertiesWithSkipList(nsIMsgDBHdr *destHdr,
                                     nsIMsgDBHdr *srcHdr,
                                     const nsCString &skipList);

protected:
  nsLocalMailCopyState *mCopyState; //We only allow one of these at a time
  nsCString mType;
  bool mHaveReadNameFromDB;
  bool mInitialized;
  bool mCheckForNewMessagesAfterParsing;
  bool m_parsingFolder;
  nsCOMPtr<nsIUrlListener> mReparseListener;
  nsTArray<nsMsgKey> mSpamKeysToMove;
  nsresult setSubfolderFlag(const nsAString& aFolderName, uint32_t flags);

  // state variables for DownloadMessagesForOffline

  // Do we notify the owning window of Delete's before or after
  // Adding the new msg?
#define DOWNLOAD_NOTIFY_FIRST 1
#define DOWNLOAD_NOTIFY_LAST  2

#ifndef DOWNLOAD_NOTIFY_STYLE
#define DOWNLOAD_NOTIFY_STYLE DOWNLOAD_NOTIFY_FIRST
#endif

  nsCOMArray<nsIMsgDBHdr> mDownloadMessages;
  nsCOMPtr<nsIMsgWindow> mDownloadWindow;
  nsMsgKey mDownloadSelectKey;
  uint32_t mDownloadState;
#define DOWNLOAD_STATE_NONE 0
#define DOWNLOAD_STATE_INITED 1
#define DOWNLOAD_STATE_GOTMSG 2
#define DOWNLOAD_STATE_DIDSEL 3

#if DOWNLOAD_NOTIFY_STYLE == DOWNLOAD_NOTIFY_LAST
  nsMsgKey mDownloadOldKey;
  nsMsgKey mDownloadOldParent;
  uint32_t mDownloadOldFlags;
#endif
};

#endif // nsMsgLocalMailFolder_h__
