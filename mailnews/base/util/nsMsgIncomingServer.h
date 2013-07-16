/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsMsgIncomingServer_h__
#define nsMsgIncomingServer_h__

#include "nsIMsgIncomingServer.h"
#include "nsIPrefBranch.h"
#include "nsIMsgFilterList.h"
#include "msgCore.h"
#include "nsIMsgFolder.h"
#include "nsIFile.h"
#include "nsCOMPtr.h"
#include "nsCOMArray.h"
#include "nsIPop3IncomingServer.h"
#include "nsWeakReference.h"
#include "nsIMsgDatabase.h"
#include "nsISpamSettings.h"
#include "nsIMsgFilterPlugin.h"
#include "nsDataHashtable.h"
#include "nsIMsgPluggableStore.h"

class nsIMsgFolderCache;
class nsIMsgProtocolInfo;

/*
 * base class for nsIMsgIncomingServer - derive your class from here
 * if you want to get some free implementation
 *
 * this particular implementation is not meant to be used directly.
 */

#undef  IMETHOD_VISIBILITY
#define IMETHOD_VISIBILITY NS_VISIBILITY_DEFAULT

class NS_MSG_BASE nsMsgIncomingServer : public nsIMsgIncomingServer,
                                        public nsSupportsWeakReference
{
 public:
  nsMsgIncomingServer();
  virtual ~nsMsgIncomingServer();

  NS_DECL_THREADSAFE_ISUPPORTS
  NS_DECL_NSIMSGINCOMINGSERVER

protected:
  nsCString m_serverKey;

  // Sets m_password, if password found. Can return NS_ERROR_ABORT if the 
  // user cancels the master password dialog.
  nsresult GetPasswordWithoutUI();

  nsresult ConfigureTemporaryReturnReceiptsFilter(nsIMsgFilterList *filterList);
  nsresult ConfigureTemporaryServerSpamFilters(nsIMsgFilterList *filterList);

  nsCOMPtr <nsIMsgFolder> m_rootFolder;
  nsCOMPtr <nsIMsgDownloadSettings> m_downloadSettings;

  // For local servers, where we put messages. For imap/pop3, where we store
  // offline messages.
  nsCOMPtr <nsIMsgPluggableStore> m_msgStore;

  /// Helper routine to create local folder on disk if it doesn't exist
  /// under the account's rootFolder.
  nsresult CreateLocalFolder(const nsAString& folderName);

  static nsresult GetDeferredServers(nsIMsgIncomingServer *destServer, nsCOMArray<nsIPop3IncomingServer>& aServers);

  nsresult CreateRootFolder();
  virtual nsresult CreateRootFolderFromUri(const nsCString &serverUri,
                                           nsIMsgFolder **rootFolder) = 0;

  nsresult InternalSetHostName(const nsACString& aHostname, const char * prefName);

  nsCOMPtr <nsIFile> mFilterFile;
  nsCOMPtr <nsIMsgFilterList> mFilterList;
  nsCOMPtr <nsIMsgFilterList> mEditableFilterList;
  nsCOMPtr<nsIPrefBranch> mPrefBranch;
  nsCOMPtr<nsIPrefBranch> mDefPrefBranch;

  // these allow us to handle duplicate incoming messages, e.g. delete them.
  nsDataHashtable<nsCStringHashKey,int32_t> m_downloadedHdrs;
  int32_t  m_numMsgsDownloaded;
static PLDHashOperator evictOldEntries(nsCStringHashKey::KeyType aKey, int32_t &aData, void *aClosure);
private:
  uint32_t m_biffState;
  bool m_serverBusy;
  nsCOMPtr <nsISpamSettings> mSpamSettings;
  nsCOMPtr<nsIMsgFilterPlugin> mFilterPlugin;  // XXX should be a list

protected:
  nsCString m_password;
  bool m_canHaveFilters;
  bool m_displayStartupPage;
  bool mPerformingBiff;
};

#undef  IMETHOD_VISIBILITY
#define IMETHOD_VISIBILITY NS_VISIBILITY_HIDDEN

#endif // nsMsgIncomingServer_h__
