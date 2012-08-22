/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsIImapHostSessionList_H_
#define _nsIImapHostSessionList_H_

#include "nsISupports.h"
#include "nsImapCore.h"

class nsIMAPBodyShellCache;
class nsIMAPBodyShell;
class nsIImapIncomingServer;

// f4d89e3e-77da-492c-962b-7835f0742c22
#define NS_IIMAPHOSTSESSIONLIST_IID \
{ 0xf4d89e3e, 0x77da, 0x492c, {0x96, 0x2b, 0x78, 0x35, 0xf0, 0x74, 0x2c, 0x22 } }

// this is an interface to a linked list of host info's    
class nsIImapHostSessionList : public nsISupports
{
public:
  NS_DECLARE_STATIC_IID_ACCESSOR(NS_IIMAPHOSTSESSIONLIST_IID)

  // Host List
  NS_IMETHOD  AddHostToList(const char *serverKey, nsIImapIncomingServer *server) = 0;
  NS_IMETHOD ResetAll() = 0;

  // Capabilities
  NS_IMETHOD  GetHostHasAdminURL(const char *serverKey, bool &result) = 0;
  NS_IMETHOD  SetHostHasAdminURL(const char *serverKey, bool hasAdminUrl) = 0;
  // Subscription
  NS_IMETHOD  GetHostIsUsingSubscription(const char *serverKey, bool &result) = 0;
  NS_IMETHOD  SetHostIsUsingSubscription(const char *serverKey, bool usingSubscription) = 0;

  // Passwords
  NS_IMETHOD  GetPasswordForHost(const char *serverKey, nsString &result) = 0;
  NS_IMETHOD  SetPasswordForHost(const char *serverKey, const char *password) = 0;
  NS_IMETHOD  GetPasswordVerifiedOnline(const char *serverKey, bool &result) = 0;
  NS_IMETHOD  SetPasswordVerifiedOnline(const char *serverKey) = 0;

  // OnlineDir
  NS_IMETHOD GetOnlineDirForHost(const char *serverKey,
                                 nsString &result) = 0;
  NS_IMETHOD SetOnlineDirForHost(const char *serverKey,
                                 const char *onlineDir) = 0;

  // Delete is move to trash folder
  NS_IMETHOD GetDeleteIsMoveToTrashForHost(const char *serverKey, bool &result) = 0;
  NS_IMETHOD SetDeleteIsMoveToTrashForHost(const char *serverKey, bool isMoveToTrash) = 0;
  NS_IMETHOD GetShowDeletedMessagesForHost(const char *serverKey, bool &result) = 0;

  NS_IMETHOD SetShowDeletedMessagesForHost(const char *serverKey, bool showDeletedMessages) = 0;

  // Get namespaces
  NS_IMETHOD GetGotNamespacesForHost(const char *serverKey, bool &result) = 0;
  NS_IMETHOD SetGotNamespacesForHost(const char *serverKey, bool gotNamespaces) = 0;

  // Folders
  NS_IMETHOD SetHaveWeEverDiscoveredFoldersForHost(const char *serverKey, bool discovered) = 0;
  NS_IMETHOD GetHaveWeEverDiscoveredFoldersForHost(const char *serverKey, bool &result) = 0;

  // Trash Folder
  NS_IMETHOD SetOnlineTrashFolderExistsForHost(const char *serverKey, bool exists) = 0;
  NS_IMETHOD GetOnlineTrashFolderExistsForHost(const char *serverKey, bool &result) = 0;
  
  // INBOX
  NS_IMETHOD  GetOnlineInboxPathForHost(const char *serverKey, nsString &result) = 0;
  NS_IMETHOD  GetShouldAlwaysListInboxForHost(const char *serverKey, bool &result) = 0;
  NS_IMETHOD  SetShouldAlwaysListInboxForHost(const char *serverKey, bool shouldList) = 0;

  // Namespaces
  NS_IMETHOD  GetNamespaceForMailboxForHost(const char *serverKey, const char *mailbox_name, nsIMAPNamespace * & result) = 0;
  NS_IMETHOD  SetNamespaceFromPrefForHost(const char *serverKey, const char *namespacePref, EIMAPNamespaceType type) = 0;
  NS_IMETHOD  AddNewNamespaceForHost(const char *serverKey, nsIMAPNamespace *ns) = 0;
  NS_IMETHOD  ClearServerAdvertisedNamespacesForHost(const char *serverKey) = 0;
  NS_IMETHOD  ClearPrefsNamespacesForHost(const char *serverKey) = 0;
  NS_IMETHOD  GetDefaultNamespaceOfTypeForHost(const char *serverKey, EIMAPNamespaceType type, nsIMAPNamespace * & result) = 0;
  NS_IMETHOD  SetNamespacesOverridableForHost(const char *serverKey, bool overridable) = 0;
  NS_IMETHOD  GetNamespacesOverridableForHost(const char *serverKey,bool &result) = 0;
  NS_IMETHOD  GetNumberOfNamespacesForHost(const char *serverKey, uint32_t &result) = 0;
  NS_IMETHOD  GetNamespaceNumberForHost(const char *serverKey, int32_t n, nsIMAPNamespace * &result) = 0;
  // ### dmb hoo boy, how are we going to do this?
  NS_IMETHOD  CommitNamespacesForHost(nsIImapIncomingServer *server) = 0;
  NS_IMETHOD  FlushUncommittedNamespacesForHost(const char *serverKey, bool &result) = 0;
  
  // Hierarchy Delimiters
  NS_IMETHOD  SetNamespaceHierarchyDelimiterFromMailboxForHost(const char *serverKey, const char *boxName, char delimiter) = 0;

  // Message Body Shells
  NS_IMETHOD  AddShellToCacheForHost(const char *serverKey, nsIMAPBodyShell *shell) = 0;
  NS_IMETHOD  FindShellInCacheForHost(const char *serverKey, const char *mailboxName, const char *UID, IMAP_ContentModifiedType modType, nsIMAPBodyShell **result) = 0;
  NS_IMETHOD  ClearShellCacheForHost(const char *serverKey) = 0;
};

NS_DEFINE_STATIC_IID_ACCESSOR(nsIImapHostSessionList,
                              NS_IIMAPHOSTSESSIONLIST_IID)

#endif
