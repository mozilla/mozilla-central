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
 * Portions created by the Initial Developer are Copyright (C) 1998
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

/**
   Interface for representing Local Mail folders.
*/

#ifndef nsMsgLocalMailFolder_h__
#define nsMsgLocalMailFolder_h__

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
  PRInt64 m_lastProgressTime;

  nsMsgKey m_curDstKey;
  PRUint32 m_curCopyIndex;
  nsCOMPtr <nsIMsgMessageService> m_messageService;
  /// The number of messages in m_messages.
  PRUint32 m_totalMsgCount;
  char *m_dataBuffer;
  PRUint32 m_dataBufferSize;
  PRUint32 m_leftOver;
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
  nsCOMPtr <nsIMsgDBHdr> newHdr;
};

struct nsLocalFolderScanState
{
  nsLocalFolderScanState();
  ~nsLocalFolderScanState();

  nsCOMPtr<nsILocalFile> m_localFile;
  nsCOMPtr<nsIFileInputStream> m_fileStream;
  nsCOMPtr<nsIInputStream> m_inputStream;
  nsCOMPtr<nsISeekableStream> m_seekableStream;
  nsCOMPtr<nsILineInputStream> m_fileLineStream;
  nsCString m_header;
  nsCString m_accountKey;
  const char *m_uidl; // memory is owned by m_header
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
  NS_IMETHOD Init(const char *aURI);

  // nsIUrlListener methods
  NS_IMETHOD OnStartRunningUrl(nsIURI * aUrl);
  NS_IMETHOD OnStopRunningUrl(nsIURI * aUrl, nsresult aExitCode);

  // nsIMsgFolder methods:
  NS_IMETHOD GetSubFolders(nsISimpleEnumerator* *aResult);
  NS_IMETHOD GetMsgDatabase(nsIMsgDatabase **aMsgDatabase);

  NS_IMETHOD OnAnnouncerGoingAway(nsIDBChangeAnnouncer *instigator);
  NS_IMETHOD GetMessages(nsISimpleEnumerator **result);
  NS_IMETHOD UpdateFolder(nsIMsgWindow *aWindow);

  NS_IMETHOD CreateSubfolder(const nsAString& folderName ,nsIMsgWindow *msgWindow);
  NS_IMETHOD AddSubfolder(const nsAString& folderName, nsIMsgFolder** newFolder);

  NS_IMETHOD Compact(nsIUrlListener *aListener, nsIMsgWindow *aMsgWindow);
  NS_IMETHOD CompactAll(nsIUrlListener *aListener, nsIMsgWindow *aMsgWindow, bool aCompactOfflineAlso);
  NS_IMETHOD EmptyTrash(nsIMsgWindow *msgWindow, nsIUrlListener *aListener);
  NS_IMETHOD Delete ();
  NS_IMETHOD DeleteSubFolders(nsIArray *folders, nsIMsgWindow *msgWindow);
  NS_IMETHOD CreateStorageIfMissing(nsIUrlListener* urlListener);
  NS_IMETHOD Rename (const nsAString& aNewName, nsIMsgWindow *msgWindow);
  NS_IMETHOD RenameSubFolders (nsIMsgWindow *msgWindow, nsIMsgFolder *oldFolder);

  NS_IMETHOD GetPrettyName(nsAString& prettyName); // Override of the base, for top-level mail folder
  NS_IMETHOD SetPrettyName(const nsAString& aName);

  NS_IMETHOD GetFolderURL(nsACString& url);

  NS_IMETHOD  GetManyHeadersToDownload(bool *retval);

  NS_IMETHOD GetDeletable (bool *deletable); 
  NS_IMETHOD GetRequiresCleanup(bool *requiresCleanup);
  NS_IMETHOD GetSizeOnDisk(PRUint32* size);

  NS_IMETHOD  GetDBFolderInfoAndDB(nsIDBFolderInfo **folderInfo, nsIMsgDatabase **db);

  NS_IMETHOD DeleteMessages(nsIArray *messages, 
                      nsIMsgWindow *msgWindow, bool
                      deleteStorage, bool isMove,
                      nsIMsgCopyServiceListener* listener, bool allowUndo);
  NS_IMETHOD CopyMessages(nsIMsgFolder *srcFolder, nsIArray* messages,
                          bool isMove, nsIMsgWindow *msgWindow,
                          nsIMsgCopyServiceListener* listener, bool isFolder, bool allowUndo);
  NS_IMETHOD CopyFolder(nsIMsgFolder *srcFolder, bool isMoveFolder, nsIMsgWindow *msgWindow,
                          nsIMsgCopyServiceListener* listener);
  NS_IMETHOD CopyFileMessage(nsIFile* aFile, nsIMsgDBHdr* msgToReplace,
                             bool isDraftOrTemplate, 
                             PRUint32 newMsgFlags,
                             const nsACString &aNewMsgKeywords,
                             nsIMsgWindow *msgWindow,
                             nsIMsgCopyServiceListener* listener);
  NS_IMETHOD GetNewMessages(nsIMsgWindow *aWindow, nsIUrlListener *aListener);
  NS_IMETHOD NotifyCompactCompleted();
  NS_IMETHOD Shutdown(bool shutdownChildren);

  NS_IMETHOD WriteToFolderCacheElem(nsIMsgFolderCacheElement *element);
  NS_IMETHOD ReadFromFolderCacheElem(nsIMsgFolderCacheElement *element);

  NS_IMETHOD GetName(nsAString& aName);

  // Used when headers_only is TRUE
  NS_IMETHOD DownloadMessagesForOffline(nsIArray *aMessages, nsIMsgWindow *aWindow);
  NS_IMETHOD FetchMsgPreviewText(nsMsgKey *aKeysToFetch, PRUint32 aNumKeys,
                                                 bool aLocalOnly, nsIUrlListener *aUrlListener, 
                                                 bool *aAsyncResults);
  NS_IMETHOD AddKeywordsToMessages(nsIArray *aMessages, const nsACString& aKeywords);
  NS_IMETHOD RemoveKeywordsFromMessages(nsIArray *aMessages, const nsACString& aKeywords);

protected:
  nsresult CreateChildFromURI(const nsCString &uri, nsIMsgFolder **folder);
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
  nsresult GetDatabase();
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
                             PRInt64 totalMsgSize);

  // copy multiple messages at a time from this folder
  nsresult CopyMessagesTo(nsIArray *messages, nsTArray<nsMsgKey> &keyArray,
                                       nsIMsgWindow *aMsgWindow,
                                       nsIMsgFolder *dstFolder,
                                       bool isMove);
  virtual void GetIncomingServerType(nsCString& serverType);
  nsresult InitCopyState(nsISupports* aSupport, nsIArray* messages,
                         bool isMove, nsIMsgCopyServiceListener* listener, nsIMsgWindow *msgWindow, bool isMoveFolder, bool allowUndo);
  // preserve message metadata when moving or copying messages
  void CopyPropertiesToMsgHdr(nsIMsgDBHdr *destHdr, nsIMsgDBHdr *srcHdr, bool isMove);
  virtual nsresult CreateBaseMessageURI(const nsACString& aURI);
  nsresult ChangeKeywordForMessages(nsIArray *aMessages, const nsACString& aKeyword, bool add);
  bool GetDeleteFromServerOnMove();

protected:
  nsLocalMailCopyState *mCopyState; //We only allow one of these at a time
  nsCString mType;
  bool mHaveReadNameFromDB;
  bool mInitialized;
  bool mCheckForNewMessagesAfterParsing;
  bool m_parsingFolder;
  nsCOMPtr<nsIUrlListener> mReparseListener;
  nsTArray<nsMsgKey> mSpamKeysToMove;
  nsresult setSubfolderFlag(const nsAString& aFolderName, PRUint32 flags);

  // state variables for DownloadMessagesForOffline

  // Do we notify the owning window of Delete's before or after
  // Adding the new msg?
#define DOWNLOAD_NOTIFY_FIRST 1
#define DOWNLOAD_NOTIFY_LAST  2

#ifndef DOWNLOAD_NOTIFY_STYLE
#define DOWNLOAD_NOTIFY_STYLE DOWNLOAD_NOTIFY_FIRST
#endif

  nsCOMPtr<nsISupportsArray> mDownloadMessages;
  nsCOMPtr<nsIMsgWindow> mDownloadWindow;
  nsMsgKey mDownloadSelectKey;
  PRUint32 mDownloadState;
#define DOWNLOAD_STATE_NONE 0
#define DOWNLOAD_STATE_INITED 1
#define DOWNLOAD_STATE_GOTMSG 2
#define DOWNLOAD_STATE_DIDSEL 3

#if DOWNLOAD_NOTIFY_STYLE == DOWNLOAD_NOTIFY_LAST
  nsMsgKey mDownloadOldKey;
  nsMsgKey mDownloadOldParent;
  PRUint32 mDownloadOldFlags;
#endif
};

#endif // nsMsgLocalMailFolder_h__
