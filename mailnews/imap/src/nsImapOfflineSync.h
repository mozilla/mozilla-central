/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsImapOfflineSync_H_
#define _nsImapOfflineSync_H_


#include "mozilla/Attributes.h"
#include "nsIMsgDatabase.h"
#include "nsIUrlListener.h"
#include "nsIMsgOfflineImapOperation.h"
#include "nsIMsgWindow.h"
#include "nsIMsgFolder.h"
#include "nsCOMArray.h"
#include "nsIDBChangeListener.h"

class nsImapOfflineSync : public nsIUrlListener,
                          public nsIMsgCopyServiceListener,
                          public nsIDBChangeListener {
public: // set to one folder to playback one folder only
  nsImapOfflineSync(nsIMsgWindow *window, nsIUrlListener *listener,
                    nsIMsgFolder *singleFolderOnly = nullptr,
                    bool isPseudoOffline = false);

  virtual ~nsImapOfflineSync();

  NS_DECL_ISUPPORTS
  NS_DECL_NSIURLLISTENER
  NS_DECL_NSIMSGCOPYSERVICELISTENER
  NS_DECL_NSIDBCHANGELISTENER
  virtual nsresult  ProcessNextOperation(); // this kicks off playback

  int32_t   GetCurrentUIDValidity();
  void      SetCurrentUIDValidity(int32_t uidvalidity) { mCurrentUIDValidity = uidvalidity; }

  void      SetPseudoOffline(bool pseudoOffline) {m_pseudoOffline = pseudoOffline;}
  bool      ProcessingStaleFolderUpdate() { return m_singleFolderToUpdate != nullptr; }

  bool      CreateOfflineFolder(nsIMsgFolder *folder);
  void      SetWindow(nsIMsgWindow *window);
protected:
  bool      CreateOfflineFolders();
  bool      DestFolderOnSameServer(nsIMsgFolder *destFolder);
  bool      AdvanceToNextServer();
  bool      AdvanceToNextFolder();
  void      AdvanceToFirstIMAPFolder();
  void      DeleteAllOfflineOpsForCurrentDB();
  void      ClearCurrentOps();
  // Clears m_currentDB, and unregister listener.
  void      ClearDB();
  void      ProcessFlagOperation(nsIMsgOfflineImapOperation *currentOp);
  void      ProcessKeywordOperation(nsIMsgOfflineImapOperation *op);
  void      ProcessMoveOperation(nsIMsgOfflineImapOperation *currentOp);
  void      ProcessCopyOperation(nsIMsgOfflineImapOperation *currentOp);
  void      ProcessEmptyTrash();
  void      ProcessAppendMsgOperation(nsIMsgOfflineImapOperation *currentOp,
                                      nsOfflineImapOperationType opType);

  nsCOMPtr <nsIMsgFolder> m_currentFolder;
  nsCOMPtr <nsIMsgFolder> m_singleFolderToUpdate;
  nsCOMPtr <nsIMsgWindow> m_window;
  nsCOMPtr <nsIArray> m_allServers;
  nsCOMPtr <nsIArray> m_allFolders;
  nsCOMPtr <nsIMsgIncomingServer> m_currentServer;
  nsCOMPtr <nsISimpleEnumerator> m_serverEnumerator;
  nsCOMPtr <nsIFile> m_curTempFile;

  nsTArray<nsMsgKey> m_CurrentKeys;
  nsCOMArray<nsIMsgOfflineImapOperation> m_currentOpsToClear;
  uint32_t      m_KeyIndex;
  nsCOMPtr <nsIMsgDatabase> m_currentDB;
  nsCOMPtr <nsIUrlListener> m_listener;
  int32_t	mCurrentUIDValidity;
  int32_t	mCurrentPlaybackOpType;	// kFlagsChanged -> kMsgCopy -> kMsgMoved
  bool	m_mailboxupdatesStarted;
  bool          m_mailboxupdatesFinished;
  bool	m_pseudoOffline;		// for queueing online events in offline db
  bool	m_createdOfflineFolders;
  
};

class nsImapOfflineDownloader : public nsImapOfflineSync
{
public:
  nsImapOfflineDownloader(nsIMsgWindow *window, nsIUrlListener *listener);
  virtual ~nsImapOfflineDownloader();
  virtual nsresult  ProcessNextOperation() MOZ_OVERRIDE; // this kicks off download
};

#endif
