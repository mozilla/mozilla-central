/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsIMAPHostSessionList_H_
#define _nsIMAPHostSessionList_H_

#include "mozilla/Attributes.h"
#include "nsImapCore.h"
#include "nsIIMAPHostSessionList.h"
#include "nsIObserver.h"
#include "nsWeakReference.h"
#include "nspr.h"

class nsIMAPNamespaceList;
class nsIImapIncomingServer;

class nsIMAPHostInfo
{
public:
  friend class nsIMAPHostSessionList;

  nsIMAPHostInfo(const char *serverKey, nsIImapIncomingServer *server);
  ~nsIMAPHostInfo();
protected:
  nsCString fServerKey;
  char *fCachedPassword;
  nsCString fOnlineDir;
  nsIMAPHostInfo *fNextHost;
  eIMAPCapabilityFlags fCapabilityFlags;
  char *fHierarchyDelimiters;// string of top-level hierarchy delimiters
  bool fHaveWeEverDiscoveredFolders;
  char *fCanonicalOnlineSubDir;
  nsIMAPNamespaceList *fNamespaceList, *fTempNamespaceList;
  bool fNamespacesOverridable;
  bool fUsingSubscription;
  bool fOnlineTrashFolderExists;
  bool fShouldAlwaysListInbox;
  bool fHaveAdminURL;
  bool fPasswordVerifiedOnline;
  bool fDeleteIsMoveToTrash;
  bool fShowDeletedMessages;
  bool fGotNamespaces;
  nsIMAPBodyShellCache *fShellCache;
};

// this is an interface to a linked list of host info's    
class nsIMAPHostSessionList : public nsIImapHostSessionList, public nsIObserver, public nsSupportsWeakReference
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIOBSERVER  

  nsIMAPHostSessionList();
  virtual ~nsIMAPHostSessionList();
  nsresult Init();
  // Host List
  NS_IMETHOD AddHostToList(const char *serverKey, 
                            nsIImapIncomingServer *server) MOZ_OVERRIDE;
  NS_IMETHOD ResetAll() MOZ_OVERRIDE;

  // Capabilities
  NS_IMETHOD GetHostHasAdminURL(const char *serverKey, bool &result) MOZ_OVERRIDE;
  NS_IMETHOD SetHostHasAdminURL(const char *serverKey, bool hasAdminUrl) MOZ_OVERRIDE;
  // Subscription
  NS_IMETHOD GetHostIsUsingSubscription(const char *serverKey, bool &result) MOZ_OVERRIDE;
  NS_IMETHOD SetHostIsUsingSubscription(const char *serverKey, bool usingSubscription) MOZ_OVERRIDE;

  // Passwords
  NS_IMETHOD GetPasswordForHost(const char *serverKey, nsString &result) MOZ_OVERRIDE;
  NS_IMETHOD SetPasswordForHost(const char *serverKey, const char *password) MOZ_OVERRIDE;
  NS_IMETHOD GetPasswordVerifiedOnline(const char *serverKey, bool &result) MOZ_OVERRIDE;
  NS_IMETHOD SetPasswordVerifiedOnline(const char *serverKey) MOZ_OVERRIDE;

  // OnlineDir
  NS_IMETHOD GetOnlineDirForHost(const char *serverKey,
                                 nsString &result) MOZ_OVERRIDE;
  NS_IMETHOD SetOnlineDirForHost(const char *serverKey,
                                 const char *onlineDir) MOZ_OVERRIDE;

  // Delete is move to trash folder
  NS_IMETHOD GetDeleteIsMoveToTrashForHost(const char *serverKey, bool &result) MOZ_OVERRIDE;
  NS_IMETHOD SetDeleteIsMoveToTrashForHost(const char *serverKey, bool isMoveToTrash) MOZ_OVERRIDE;
  // imap delete model (or not)
  NS_IMETHOD GetShowDeletedMessagesForHost(const char *serverKey, bool &result) MOZ_OVERRIDE;
  NS_IMETHOD SetShowDeletedMessagesForHost(const char *serverKey, bool showDeletedMessages) MOZ_OVERRIDE;

  // Get namespaces
  NS_IMETHOD GetGotNamespacesForHost(const char *serverKey, bool &result) MOZ_OVERRIDE;
  NS_IMETHOD SetGotNamespacesForHost(const char *serverKey, bool gotNamespaces) MOZ_OVERRIDE;
  // Folders
  NS_IMETHOD SetHaveWeEverDiscoveredFoldersForHost(const char *serverKey, bool discovered) MOZ_OVERRIDE;
  NS_IMETHOD GetHaveWeEverDiscoveredFoldersForHost(const char *serverKey, bool &result) MOZ_OVERRIDE;

  // Trash Folder
  NS_IMETHOD SetOnlineTrashFolderExistsForHost(const char *serverKey, bool exists) MOZ_OVERRIDE;
  NS_IMETHOD GetOnlineTrashFolderExistsForHost(const char *serverKey, bool &result) MOZ_OVERRIDE;

  // INBOX
  NS_IMETHOD GetOnlineInboxPathForHost(const char *serverKey, nsString &result) MOZ_OVERRIDE;
  NS_IMETHOD GetShouldAlwaysListInboxForHost(const char *serverKey, bool &result) MOZ_OVERRIDE;
  NS_IMETHOD SetShouldAlwaysListInboxForHost(const char *serverKey, bool shouldList) MOZ_OVERRIDE;

  // Namespaces
  NS_IMETHOD GetNamespaceForMailboxForHost(const char *serverKey, const char *mailbox_name, nsIMAPNamespace *&result) MOZ_OVERRIDE;
  NS_IMETHOD SetNamespaceFromPrefForHost(const char *serverKey, const char *namespacePref, EIMAPNamespaceType type) MOZ_OVERRIDE;
  NS_IMETHOD AddNewNamespaceForHost(const char *serverKey, nsIMAPNamespace *ns) MOZ_OVERRIDE;
  NS_IMETHOD ClearServerAdvertisedNamespacesForHost(const char *serverKey) MOZ_OVERRIDE;
  NS_IMETHOD ClearPrefsNamespacesForHost(const char *serverKey) MOZ_OVERRIDE;
  NS_IMETHOD GetDefaultNamespaceOfTypeForHost(const char *serverKey, EIMAPNamespaceType type, nsIMAPNamespace *&result) MOZ_OVERRIDE;
  NS_IMETHOD SetNamespacesOverridableForHost(const char *serverKey, bool overridable) MOZ_OVERRIDE;
  NS_IMETHOD GetNamespacesOverridableForHost(const char *serverKey,bool &result) MOZ_OVERRIDE;
  NS_IMETHOD GetNumberOfNamespacesForHost(const char *serverKey, uint32_t &result) MOZ_OVERRIDE;
  NS_IMETHOD GetNamespaceNumberForHost(const char *serverKey, int32_t n, nsIMAPNamespace * &result) MOZ_OVERRIDE;
  // ### dmb hoo boy, how are we going to do this?
  NS_IMETHOD CommitNamespacesForHost(nsIImapIncomingServer *host) MOZ_OVERRIDE;
  NS_IMETHOD FlushUncommittedNamespacesForHost(const char *serverKey, bool &result) MOZ_OVERRIDE;

  // Hierarchy Delimiters
  NS_IMETHOD SetNamespaceHierarchyDelimiterFromMailboxForHost(const char *serverKey, const char *boxName, char delimiter) MOZ_OVERRIDE;

  // Message Body Shells
  NS_IMETHOD AddShellToCacheForHost(const char *serverKey, nsIMAPBodyShell *shell) MOZ_OVERRIDE;
  NS_IMETHOD FindShellInCacheForHost(const char *serverKey, const char *mailboxName, const char *UID, IMAP_ContentModifiedType modType, nsIMAPBodyShell	**result) MOZ_OVERRIDE;
  NS_IMETHOD ClearShellCacheForHost(const char *serverKey) MOZ_OVERRIDE;
  PRMonitor *gCachedHostInfoMonitor;
  nsIMAPHostInfo *fHostInfoList;
protected:
  nsresult SetNamespacesPrefForHost(nsIImapIncomingServer *aHost,
                                    EIMAPNamespaceType type,
                                    const char *pref);
  nsIMAPHostInfo *FindHost(const char *serverKey);
};
#endif
