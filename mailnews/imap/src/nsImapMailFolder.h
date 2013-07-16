/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#ifndef nsImapMailFolder_h__
#define nsImapMailFolder_h__

#include "mozilla/Attributes.h"
#include "nsImapCore.h"
#include "nsMsgDBFolder.h"
#include "nsIImapMailFolderSink.h"
#include "nsIImapMessageSink.h"
#include "nsICopyMessageListener.h"
#include "nsIImapService.h"
#include "nsIUrlListener.h"
#include "nsAutoPtr.h"
#include "nsIImapIncomingServer.h" // we need this for its IID
#include "nsIMsgParseMailMsgState.h"
#include "nsITransactionManager.h"
#include "nsImapUndoTxn.h"
#include "nsIMsgMessageService.h"
#include "nsIMsgFilterHitNotify.h"
#include "nsIMsgFilterList.h"
#include "prmon.h"
#include "nsIMsgImapMailFolder.h"
#include "nsIMsgLocalMailFolder.h"
#include "nsIImapMailFolderSink.h"
#include "nsIImapServerSink.h"
#include "nsIMsgFilterPlugin.h"
#include "nsIThread.h"
#include "nsDataHashtable.h"
#include "nsIMutableArray.h"
#include "nsITimer.h"
#include "nsCOMArray.h"
#include "nsAutoSyncState.h"

class nsImapMoveCoalescer;
class nsIMsgIdentity;
class nsIMsgOfflineImapOperation;

#define COPY_BUFFER_SIZE 16384

#define NS_IMAPMAILCOPYSTATE_IID \
{ 0xb64534f0, 0x3d53, 0x11d3, \
    { 0xac, 0x2a, 0x00, 0x80, 0x5f, 0x8a, 0xc9, 0x68 } }

class nsImapMailCopyState: public nsISupports
{
public:
    NS_DECLARE_STATIC_IID_ACCESSOR(NS_IMAPMAILCOPYSTATE_IID)

    NS_DECL_ISUPPORTS

    nsImapMailCopyState();
    virtual ~nsImapMailCopyState();

    nsCOMPtr<nsISupports> m_srcSupport; // source file spec or folder
    nsCOMPtr<nsIArray> m_messages; // array of source messages
    nsRefPtr<nsImapMoveCopyMsgTxn> m_undoMsgTxn; // undo object with this copy operation
    nsCOMPtr<nsIMsgDBHdr> m_message; // current message to be copied
    nsCOMPtr<nsIMsgCopyServiceListener> m_listener; // listener of this copy
                                                    // operation
    nsCOMPtr<nsIFile> m_tmpFile; // temp file spec for copy operation
    nsCOMPtr<nsIMsgWindow> m_msgWindow; // msg window for copy operation

    nsCOMPtr<nsIMsgMessageService> m_msgService; // source folder message service; can
                                        // be Nntp, Mailbox, or Imap
    bool m_isMove;             // is a move
    bool m_selectedState;      // needs to be in selected state; append msg
    bool m_isCrossServerOp; // are we copying between imap servers?
    uint32_t m_curIndex; // message index to the message array which we are
                         // copying
    uint32_t m_totalCount;// total count of messages we have to do
    uint32_t m_unreadCount; // num unread messages we're moving
    bool m_streamCopy;
    char *m_dataBuffer; // temporary buffer for this copy operation
    nsCOMPtr<nsIOutputStream> m_msgFileStream;         // temporary file (processed mail)
    uint32_t m_dataBufferSize;
    uint32_t m_leftOver;
    bool m_allowUndo;
    bool m_eatLF;
    uint32_t m_newMsgFlags; // only used if there's no m_message
    nsCString m_newMsgKeywords; // ditto 
    // If the server supports UIDPLUS, this is the UID for the append,
    // if we're doing an append.
    nsMsgKey m_appendUID;
};

NS_DEFINE_STATIC_IID_ACCESSOR(nsImapMailCopyState, NS_IMAPMAILCOPYSTATE_IID)

// ACLs for this folder.
// Generally, we will try to always query this class when performing
// an operation on the folder.
// If the server doesn't support ACLs, none of this data will be filled in.
// Therefore, we can assume that if we look up ourselves and don't find
// any info (and also look up "anyone") then we have full rights, that is, ACLs don't exist.
class nsImapMailFolder;

#define IMAP_ACL_READ_FLAG 0x0000001 /* SELECT, CHECK, FETCH, PARTIAL, SEARCH, COPY from folder */
#define IMAP_ACL_STORE_SEEN_FLAG 0x0000002 /* STORE SEEN flag */
#define IMAP_ACL_WRITE_FLAG 0x0000004 /* STORE flags other than SEEN and DELETED */
#define IMAP_ACL_INSERT_FLAG 0x0000008 /* APPEND, COPY into folder */
#define IMAP_ACL_POST_FLAG 0x0000010 /* Can I send mail to the submission address for folder? */
#define IMAP_ACL_CREATE_SUBFOLDER_FLAG 0x0000020 /* Can I CREATE a subfolder of this folder? */
#define IMAP_ACL_DELETE_FLAG 0x0000040 /* STORE DELETED flag */
#define IMAP_ACL_ADMINISTER_FLAG 0x0000080 /* perform SETACL */
#define IMAP_ACL_RETRIEVED_FLAG 0x0000100 /* ACL info for this folder has been initialized */
#define IMAP_ACL_EXPUNGE_FLAG 0x0000200 // can EXPUNGE or do implicit EXPUNGE on CLOSE
#define IMAP_ACL_DELETE_FOLDER 0x0000400 // can DELETE/RENAME folder

class nsMsgIMAPFolderACL
{
public:
  nsMsgIMAPFolderACL(nsImapMailFolder *folder);
  ~nsMsgIMAPFolderACL();

  bool SetFolderRightsForUser(const nsACString& userName, const nsACString& rights);

public:

  // generic for any user, although we might not use them in
  // DO NOT use these for looking up information about the currently authenticated user.
  // (There are some different checks and defaults we do).
  // Instead, use the functions below, GetICan....()
  bool GetCanUserLookupFolder(const nsACString& userName);      // Is folder visible to LIST/LSUB?
  bool GetCanUserReadFolder(const nsACString& userName);        // SELECT, CHECK, FETCH, PARTIAL, SEARCH, COPY from folder?
  bool GetCanUserStoreSeenInFolder(const nsACString& userName); // STORE SEEN flag?
  bool GetCanUserWriteFolder(const nsACString& userName);       // STORE flags other than SEEN and DELETED?
  bool GetCanUserInsertInFolder(const nsACString& userName);    // APPEND, COPY into folder?
  bool GetCanUserPostToFolder(const nsACString& userName);      // Can I send mail to the submission address for folder?
  bool GetCanUserCreateSubfolder(const nsACString& userName);   // Can I CREATE a subfolder of this folder?
  bool GetCanUserDeleteInFolder(const nsACString& userName);    // STORE DELETED flag, perform EXPUNGE?
  bool GetCanUserAdministerFolder(const nsACString& userName);  // perform SETACL?

  // Functions to find out rights for the currently authenticated user.

  bool GetCanILookupFolder();      // Is folder visible to LIST/LSUB?
  bool GetCanIReadFolder();        // SELECT, CHECK, FETCH, PARTIAL, SEARCH, COPY from folder?
  bool GetCanIStoreSeenInFolder(); // STORE SEEN flag?
  bool GetCanIWriteFolder();       // STORE flags other than SEEN and DELETED?
  bool GetCanIInsertInFolder();    // APPEND, COPY into folder?
  bool GetCanIPostToFolder();      // Can I send mail to the submission address for folder?
  bool GetCanICreateSubfolder();   // Can I CREATE a subfolder of this folder?
  bool GetCanIDeleteInFolder();    // STORE DELETED flag?
  bool GetCanIAdministerFolder();  // perform SETACL?
  bool GetCanIExpungeFolder();     // perform EXPUNGE?

  bool GetDoIHaveFullRightsForFolder(); // Returns TRUE if I have full rights on this folder (all of the above return TRUE)

  bool GetIsFolderShared(); // We use this to see if the ACLs think a folder is shared or not.
  // We will define "Shared" in 5.0 to mean:
  // At least one user other than the currently authenticated user has at least one
  // explicitly-listed ACL right on that folder.

  // Returns a newly allocated string describing these rights
  nsresult CreateACLRightsString(nsAString& rightsString);

  nsresult GetRightsStringForUser(const nsACString& userName, nsCString &rights);

  nsresult GetOtherUsers(nsIUTF8StringEnumerator** aResult);

protected:
  bool GetFlagSetInRightsForUser(const nsACString& userName, char flag, bool defaultIfNotFound);
  void BuildInitialACLFromCache();
  void UpdateACLCache();

protected:
  nsDataHashtable <nsCStringHashKey, nsCString> m_rightsHash; // Hash table, mapping username strings to rights strings.
  nsImapMailFolder *m_folder;
  int32_t        m_aclCount;

};

/**
 * Encapsulates parameters required to playback offline ops
 * on given folder.
 */
struct nsPlaybackRequest
{
  explicit nsPlaybackRequest(nsImapMailFolder *srcFolder, nsIMsgWindow *msgWindow)
    : SrcFolder(srcFolder), MsgWindow(msgWindow)
  {
  }
  nsImapMailFolder *SrcFolder;
  nsCOMPtr<nsIMsgWindow> MsgWindow;
};

class nsImapMailFolder :  public nsMsgDBFolder,
                          public nsIMsgImapMailFolder,
                          public nsIImapMailFolderSink,
                          public nsIImapMessageSink,
                          public nsICopyMessageListener,
                          public nsIMsgFilterHitNotify
{
 static const uint32_t PLAYBACK_TIMER_INTERVAL_IN_MS = 500; 
public:
  nsImapMailFolder();
  virtual ~nsImapMailFolder();

  NS_DECL_ISUPPORTS_INHERITED

  // nsIMsgFolder methods:
  NS_IMETHOD GetSubFolders(nsISimpleEnumerator **aResult) MOZ_OVERRIDE;

  NS_IMETHOD GetMessages(nsISimpleEnumerator* *result) MOZ_OVERRIDE;
  NS_IMETHOD UpdateFolder(nsIMsgWindow *aWindow) MOZ_OVERRIDE;

  NS_IMETHOD CreateSubfolder(const nsAString& folderName,nsIMsgWindow *msgWindow ) MOZ_OVERRIDE;
  NS_IMETHOD AddSubfolder(const nsAString& aName, nsIMsgFolder** aChild) MOZ_OVERRIDE;
  NS_IMETHODIMP CreateStorageIfMissing(nsIUrlListener* urlListener);

  NS_IMETHOD Compact(nsIUrlListener *aListener, nsIMsgWindow *aMsgWindow) MOZ_OVERRIDE;
  NS_IMETHOD CompactAll(nsIUrlListener *aListener, nsIMsgWindow *aMsgWindow,
                        bool aCompactOfflineAlso) MOZ_OVERRIDE;
  NS_IMETHOD EmptyTrash(nsIMsgWindow *msgWindow, nsIUrlListener *aListener) MOZ_OVERRIDE;
  NS_IMETHOD CopyDataToOutputStreamForAppend(nsIInputStream *aIStream,
                     int32_t aLength, nsIOutputStream *outputStream) MOZ_OVERRIDE;
  NS_IMETHOD CopyDataDone() MOZ_OVERRIDE;
  NS_IMETHOD Delete () MOZ_OVERRIDE;
  NS_IMETHOD Rename (const nsAString& newName, nsIMsgWindow *msgWindow) MOZ_OVERRIDE;
  NS_IMETHOD RenameSubFolders(nsIMsgWindow *msgWindow, nsIMsgFolder *oldFolder) MOZ_OVERRIDE;
  NS_IMETHOD GetNoSelect(bool *aResult) MOZ_OVERRIDE;

  NS_IMETHOD GetPrettyName(nsAString& prettyName) MOZ_OVERRIDE; // Override of the base, for top-level mail folder

  NS_IMETHOD GetFolderURL(nsACString& url) MOZ_OVERRIDE;

  NS_IMETHOD UpdateSummaryTotals(bool force) MOZ_OVERRIDE;

  NS_IMETHOD GetDeletable (bool *deletable) MOZ_OVERRIDE;

  NS_IMETHOD GetSizeOnDisk(uint32_t * size) MOZ_OVERRIDE;

  NS_IMETHOD GetCanCreateSubfolders(bool *aResult) MOZ_OVERRIDE;
  NS_IMETHOD GetCanSubscribe(bool *aResult) MOZ_OVERRIDE;

  NS_IMETHOD ApplyRetentionSettings() MOZ_OVERRIDE;

  NS_IMETHOD AddMessageDispositionState(nsIMsgDBHdr *aMessage, nsMsgDispositionState aDispositionFlag) MOZ_OVERRIDE;
  NS_IMETHOD MarkMessagesRead(nsIArray *messages, bool markRead) MOZ_OVERRIDE;
  NS_IMETHOD MarkAllMessagesRead(nsIMsgWindow *aMsgWindow) MOZ_OVERRIDE;
  NS_IMETHOD MarkMessagesFlagged(nsIArray *messages, bool markFlagged) MOZ_OVERRIDE;
  NS_IMETHOD MarkThreadRead(nsIMsgThread *thread) MOZ_OVERRIDE;
  NS_IMETHOD SetLabelForMessages(nsIArray *aMessages, nsMsgLabelValue aLabel) MOZ_OVERRIDE;
  NS_IMETHOD SetJunkScoreForMessages(nsIArray *aMessages, const nsACString& aJunkScore) MOZ_OVERRIDE;
  NS_IMETHOD DeleteSubFolders(nsIArray *folders, nsIMsgWindow *msgWindow) MOZ_OVERRIDE;
  NS_IMETHOD ReadFromFolderCacheElem(nsIMsgFolderCacheElement *element) MOZ_OVERRIDE;
  NS_IMETHOD WriteToFolderCacheElem(nsIMsgFolderCacheElement *element) MOZ_OVERRIDE;

  NS_IMETHOD GetDBFolderInfoAndDB(nsIDBFolderInfo **folderInfo,
                                  nsIMsgDatabase **db) MOZ_OVERRIDE;
  NS_IMETHOD DeleteMessages(nsIArray *messages,
                            nsIMsgWindow *msgWindow, bool
                            deleteStorage, bool isMove,
                            nsIMsgCopyServiceListener* listener, bool allowUndo) MOZ_OVERRIDE;
  NS_IMETHOD CopyMessages(nsIMsgFolder *srcFolder,
                          nsIArray* messages,
                          bool isMove, nsIMsgWindow *msgWindow,
                          nsIMsgCopyServiceListener* listener, bool isFolder,
                          bool allowUndo) MOZ_OVERRIDE;
  NS_IMETHOD CopyFolder(nsIMsgFolder *srcFolder, bool isMove, nsIMsgWindow *msgWindow,
                        nsIMsgCopyServiceListener* listener) MOZ_OVERRIDE;
  NS_IMETHOD CopyFileMessage(nsIFile* file,
                              nsIMsgDBHdr* msgToReplace,
                              bool isDraftOrTemplate,
                              uint32_t aNewMsgFlags,
                              const nsACString &aNewMsgKeywords,
                              nsIMsgWindow *msgWindow,
                              nsIMsgCopyServiceListener* listener) MOZ_OVERRIDE;
  NS_IMETHOD GetNewMessages(nsIMsgWindow *aWindow, nsIUrlListener *aListener) MOZ_OVERRIDE;

  NS_IMETHOD GetFilePath(nsIFile** aPathName) MOZ_OVERRIDE;
  NS_IMETHOD SetFilePath(nsIFile * aPath) MOZ_OVERRIDE;

  NS_IMETHOD Shutdown(bool shutdownChildren) MOZ_OVERRIDE;

  NS_IMETHOD DownloadMessagesForOffline(nsIArray *messages, nsIMsgWindow *msgWindow) MOZ_OVERRIDE;

  NS_IMETHOD DownloadAllForOffline(nsIUrlListener *listener, nsIMsgWindow *msgWindow) MOZ_OVERRIDE;
  NS_IMETHOD GetCanFileMessages(bool *aCanFileMessages) MOZ_OVERRIDE;
  NS_IMETHOD GetCanDeleteMessages(bool *aCanDeleteMessages) MOZ_OVERRIDE;
  NS_IMETHOD FetchMsgPreviewText(nsMsgKey *aKeysToFetch, uint32_t aNumKeys,
                                                 bool aLocalOnly, nsIUrlListener *aUrlListener,
                                                 bool *aAsyncResults) MOZ_OVERRIDE;

  NS_IMETHOD AddKeywordsToMessages(nsIArray *aMessages, const nsACString& aKeywords) MOZ_OVERRIDE;
  NS_IMETHOD RemoveKeywordsFromMessages(nsIArray *aMessages, const nsACString& aKeywords) MOZ_OVERRIDE;

  NS_IMETHOD NotifyCompactCompleted() MOZ_OVERRIDE;

  // overrides nsMsgDBFolder::HasMsgOffline()
  NS_IMETHOD HasMsgOffline(nsMsgKey msgKey, bool *_retval) MOZ_OVERRIDE;
  // overrides nsMsgDBFolder::GetOfflineFileStream()
  NS_IMETHOD GetOfflineFileStream(nsMsgKey msgKey, int64_t *offset, uint32_t *size, nsIInputStream **aFileStream) MOZ_OVERRIDE;

  NS_DECL_NSIMSGIMAPMAILFOLDER
  NS_DECL_NSIIMAPMAILFOLDERSINK
  NS_DECL_NSIIMAPMESSAGESINK
  NS_DECL_NSICOPYMESSAGELISTENER
  NS_DECL_NSIREQUESTOBSERVER

  // nsIUrlListener methods
  NS_IMETHOD OnStartRunningUrl(nsIURI * aUrl) MOZ_OVERRIDE;
  NS_IMETHOD OnStopRunningUrl(nsIURI * aUrl, nsresult aExitCode) MOZ_OVERRIDE;

  NS_DECL_NSIMSGFILTERHITNOTIFY
  NS_DECL_NSIJUNKMAILCLASSIFICATIONLISTENER

  NS_IMETHOD IsCommandEnabled(const nsACString& command, bool *result) MOZ_OVERRIDE;
  NS_IMETHOD SetFilterList(nsIMsgFilterList *aMsgFilterList) MOZ_OVERRIDE;
  NS_IMETHOD GetCustomIdentity(nsIMsgIdentity **aIdentity) MOZ_OVERRIDE;

 /**
  * This method is used to locate a folder where a msg could be present, not just
  * the folder where the message first arrives, this method searches for the existence
  * of msg in all the folders/labels that we retrieve from X-GM-LABELS also.
  * overrides nsMsgDBFolder::GetOfflineMsgFolder()
  *  @param msgKey key  of the msg for which we are trying to get the folder;
  *  @param aMsgFolder  required folder;
  */
  NS_IMETHOD GetOfflineMsgFolder(nsMsgKey msgKey, nsIMsgFolder **aMsgFolder) MOZ_OVERRIDE;

  nsresult AddSubfolderWithPath(nsAString& name, nsIFile *dbPath, nsIMsgFolder **child, bool brandNew = false);
  nsresult MoveIncorporatedMessage(nsIMsgDBHdr *mailHdr,
                                  nsIMsgDatabase *sourceDB,
                                  const nsACString& destFolder,
                                  nsIMsgFilter *filter,
                                  nsIMsgWindow *msgWindow);

  // send notification to copy service listener.
  nsresult OnCopyCompleted(nsISupports *srcSupport, nsresult exitCode);

  static nsresult  AllocateUidStringFromKeys(nsMsgKey *keys, uint32_t numKeys, nsCString &msgIds);
  static nsresult  BuildIdsAndKeyArray(nsIArray* messages, nsCString& msgIds, nsTArray<nsMsgKey>& keyArray);

  // these might end up as an nsIImapMailFolder attribute.
  nsresult SetSupportedUserFlags(uint32_t userFlags);
  nsresult GetSupportedUserFlags(uint32_t *userFlags);

  // Find the start of a range of msgKeys that can hold srcCount headers.
  nsresult FindOpenRange(nsMsgKey &fakeBase, uint32_t srcCount);

protected:
  // Helper methods

  virtual nsresult CreateChildFromURI(const nsCString &uri, nsIMsgFolder **folder) MOZ_OVERRIDE;
  void FindKeysToAdd(const nsTArray<nsMsgKey> &existingKeys, nsTArray<nsMsgKey>
    &keysToFetch, uint32_t &numNewUnread, nsIImapFlagAndUidState *flagState);
  void FindKeysToDelete(const nsTArray<nsMsgKey> &existingKeys, nsTArray<nsMsgKey>
    &keysToFetch, nsIImapFlagAndUidState *flagState, uint32_t boxFlags);
  void PrepareToAddHeadersToMailDB(nsIImapProtocol* aProtocol);
  void TweakHeaderFlags(nsIImapProtocol* aProtocol, nsIMsgDBHdr *tweakMe);

  nsresult SyncFlags(nsIImapFlagAndUidState *flagState);
  nsresult HandleCustomFlags(nsMsgKey uidOfMessage, nsIMsgDBHdr *dbHdr,
                             uint16_t userFlags, nsCString& keywords);
  nsresult NotifyMessageFlagsFromHdr(nsIMsgDBHdr *dbHdr, nsMsgKey msgKey,
                                     uint32_t flags);

  nsresult SetupHeaderParseStream(uint32_t size, const nsACString& content_type, nsIMailboxSpec *boxSpec);
  nsresult  ParseAdoptedHeaderLine(const char *messageLine, uint32_t msgKey);
  nsresult  NormalEndHeaderParseStream(nsIImapProtocol *aProtocol, nsIImapUrl *imapUrl);

  void EndOfflineDownload();
  nsresult CopyFileToOfflineStore(nsIFile *srcFile, nsMsgKey msgKey);

  nsresult MarkMessagesImapDeleted(nsTArray<nsMsgKey> *keyArray, bool deleted, nsIMsgDatabase *db);

  // Notifies imap autosync that it should update this folder when it
  // gets a chance.
  void NotifyHasPendingMsgs();
  void UpdatePendingCounts();
  void SetIMAPDeletedFlag(nsIMsgDatabase *mailDB, const nsTArray<nsMsgKey> &msgids, bool markDeleted);
  virtual bool ShowDeletedMessages();
  virtual bool DeleteIsMoveToTrash();
  nsresult GetFolder(const nsACString& name, nsIMsgFolder **pFolder);
  nsresult GetTrashFolder(nsIMsgFolder **pTrashFolder);
  bool TrashOrDescendentOfTrash(nsIMsgFolder* folder);
  static bool ShouldCheckAllFolders(nsIImapIncomingServer *imapServer);
  nsresult GetServerKey(nsACString& serverKey);
  nsresult DisplayStatusMsg(nsIImapUrl *aImapUrl, const nsAString& msg);

  //nsresult RenameLocal(const char *newName);
  nsresult AddDirectorySeparator(nsIFile *path);
  nsresult CreateSubFolders(nsIFile *path);
  nsresult GetDatabase() MOZ_OVERRIDE;
  virtual void GetIncomingServerType(nsCString& serverType) MOZ_OVERRIDE { serverType.AssignLiteral("imap");}

  nsresult        GetFolderOwnerUserName(nsACString& userName);
  nsIMAPNamespace *GetNamespaceForFolder();
  void            SetNamespaceForFolder(nsIMAPNamespace *ns);

  nsMsgIMAPFolderACL * GetFolderACL();
  nsresult CreateACLRightsStringForFolder(nsAString& rightsString);
  nsresult GetBodysToDownload(nsTArray<nsMsgKey> *keysOfMessagesToDownload);
  // Uber message copy service
  nsresult CopyMessagesWithStream(nsIMsgFolder* srcFolder,
                                    nsIArray* messages,
                                    bool isMove,
                                    bool isCrossServerOp,
                                    nsIMsgWindow *msgWindow,
                                    nsIMsgCopyServiceListener* listener, bool allowUndo);
  nsresult CopyStreamMessage(nsIMsgDBHdr* message, nsIMsgFolder* dstFolder,
                            nsIMsgWindow *msgWindow, bool isMove);
  nsresult InitCopyState(nsISupports* srcSupport,
                          nsIArray* messages,
                          bool isMove,
                          bool selectedState,
                          bool acrossServers,
                          uint32_t newMsgFlags,
                          const nsACString &newMsgKeywords,
                          nsIMsgCopyServiceListener* listener,
                          nsIMsgWindow *msgWindow,
                          bool allowUndo);
  nsresult GetMoveCoalescer();
  nsresult PlaybackCoalescedOperations();
  virtual nsresult CreateBaseMessageURI(const nsACString& aURI) MOZ_OVERRIDE;
  // offline-ish methods
  nsresult GetClearedOriginalOp(nsIMsgOfflineImapOperation *op, nsIMsgOfflineImapOperation **originalOp, nsIMsgDatabase **originalDB);
  nsresult GetOriginalOp(nsIMsgOfflineImapOperation *op, nsIMsgOfflineImapOperation **originalOp, nsIMsgDatabase **originalDB);
  nsresult CopyMessagesOffline(nsIMsgFolder* srcFolder,
                                nsIArray* messages,
                                bool isMove,
                                nsIMsgWindow *msgWindow,
                                nsIMsgCopyServiceListener* listener);
  void SetPendingAttributes(nsIArray* messages, bool aIsMove);

  nsresult CopyOfflineMsgBody(nsIMsgFolder *srcFolder, nsIMsgDBHdr *destHdr,
                              nsIMsgDBHdr *origHdr, nsIInputStream *inputStream,
                              nsIOutputStream *outputStream);

  void GetTrashFolderName(nsAString &aFolderName);
  bool ShowPreviewText();

  // Pseudo-Offline operation playback timer
  static void PlaybackTimerCallback(nsITimer *aTimer, void *aClosure);

  nsresult CreatePlaybackTimer();

  // Allocate and initialize associated auto-sync state object.
  void InitAutoSyncState();

  bool m_initialized;
  bool m_haveDiscoveredAllFolders;
  nsCOMPtr<nsIMsgParseMailMsgState> m_msgParser;
  nsCOMPtr<nsIMsgFilterList> m_filterList;
  nsCOMPtr<nsIMsgFilterPlugin> m_filterPlugin;  // XXX should be a list
  // used with filter plugins to know when we've finished classifying and can playback moves
  bool m_msgMovedByFilter;
  nsImapMoveCoalescer *m_moveCoalescer; // strictly owned by the nsImapMailFolder
  nsCOMPtr<nsIMutableArray> m_junkMessagesToMarkAsRead;
  /// list of keys to be moved to the junk folder
  nsTArray<nsMsgKey> mSpamKeysToMove;
  /// the junk destination folder
  nsCOMPtr<nsIMsgFolder> mSpamFolder;
  nsMsgKey m_curMsgUid;
  uint32_t m_uidValidity;

  // These three vars are used to store counts from STATUS or SELECT command
  // They include deleted messages, so they can differ from the generic
  // folder total and unread counts.
  int32_t m_numServerRecentMessages;
  int32_t m_numServerUnseenMessages;
  int32_t m_numServerTotalMessages;
  // if server supports UIDNEXT, we store it here.
  int32_t m_nextUID;

  int32_t  m_nextMessageByteLength;
  nsCOMPtr<nsIUrlListener> m_urlListener;
  bool m_urlRunning;

  // undo move/copy transaction support
  nsRefPtr<nsMsgTxn> m_pendingUndoTxn;
  nsRefPtr<nsImapMailCopyState> m_copyState;
  char m_hierarchyDelimiter;
  int32_t m_boxFlags;
  nsCString m_onlineFolderName;
  nsCString m_ownerUserName;  // username of the "other user," as in
  // "Other Users' Mailboxes"

  nsCString m_adminUrl;   // url to run to set admin privileges for this folder
  nsIMAPNamespace  *m_namespace;
  bool m_verifiedAsOnlineFolder;
  bool m_explicitlyVerify; // whether or not we need to explicitly verify this through LIST
  bool m_folderIsNamespace;
  bool m_folderNeedsSubscribing;
  bool m_folderNeedsAdded;
  bool m_folderNeedsACLListed;
  bool m_performingBiff;
  bool m_folderQuotaCommandIssued;
  bool m_folderQuotaDataIsValid;
  bool m_updatingFolder;
  // These two vars are used to keep track of compaction state so we can know
  // when to send a done notification.
  bool m_compactingOfflineStore;
  bool m_expunging;
  bool m_applyIncomingFilters; // apply filters to this folder, even if not the inbox
  nsMsgIMAPFolderACL *m_folderACL;
  uint32_t     m_aclFlags;
  uint32_t     m_supportedUserFlags;

  // determines if we are on GMail server
  bool m_isGmailServer;
  // offline imap support
  bool m_downloadingFolderForOfflineUse;
  bool m_filterListRequiresBody;

  // auto-sync (automatic message download) support
  nsRefPtr<nsAutoSyncState> m_autoSyncStateObj;

  // Quota support
  nsCString m_folderQuotaRoot;
  uint32_t m_folderQuotaUsedKB;
  uint32_t m_folderQuotaMaxKB;

  // Pseudo-Offline Playback support
  nsPlaybackRequest *m_pendingPlaybackReq;
  nsCOMPtr<nsITimer> m_playbackTimer;
  nsTArray<nsRefPtr<nsImapMoveCopyMsgTxn> > m_pendingOfflineMoves;
  // hash table of mapping between messageids and message keys
  // for pseudo hdrs.
  nsDataHashtable<nsCStringHashKey, nsMsgKey> m_pseudoHdrs;

  nsTArray<nsMsgKey> m_keysToFetch;
  uint32_t m_totalKeysToFetch;

};
#endif
