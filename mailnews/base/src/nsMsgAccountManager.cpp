/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 *   Alec Flett <alecf@netscape.com>
 *   Seth Spitzer <sspitzer@netscape.com>
 *   Bhuvan Racham <racham@netscape.com>
 *   David Bienvenu <bienvenu@mozilla.org>
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

/*
 * The account manager service - manages all accounts, servers, and identities
 */

#include "nsIComponentManager.h"
#include "nsIServiceManager.h"
#include "nsISupportsArray.h"
#include "nsIArray.h"
#include "nsArrayUtils.h"
#include "nsMsgAccountManager.h"
#include "nsMsgBaseCID.h"
#include "nsMsgCompCID.h"
#include "nsMsgDBCID.h"
#include "prmem.h"
#include "prcmon.h"
#include "prthread.h"
#include "plstr.h"
#include "nsString.h"
#include "nsUnicharUtils.h"
#include "nscore.h"
#include "prprf.h"
#include "nsIMsgFolderCache.h"
#include "nsMsgUtils.h"
#include "nsILocalFile.h"
#include "nsIURL.h"
#include "nsNetCID.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "nsISmtpService.h"
#include "nsIMsgBiffManager.h"
#include "nsIMsgPurgeService.h"
#include "nsIObserverService.h"
#include "nsINoIncomingServer.h"
#include "nsIMsgMailSession.h"
#include "nsIDirectoryService.h"
#include "nsAppDirectoryServiceDefs.h"
#include "nsMailDirServiceDefs.h"
#include "nsMsgFolderFlags.h"
#include "nsIRDFService.h"
#include "nsRDFCID.h"
#include "nsIImapIncomingServer.h"
#include "nsIImapUrl.h"
#include "nsIMessengerOSIntegration.h"
#include "nsICategoryManager.h"
#include "nsISupportsPrimitives.h"
#include "nsIMsgFilterService.h"
#include "nsIMsgFilter.h"
#include "nsIMsgSearchSession.h"
#include "nsIDBChangeListener.h"
#include "nsIDBFolderInfo.h"
#include "nsIMsgHdr.h"
#include "nsILineInputStream.h"
#include "nsThreadUtils.h"
#include "nsNetUtil.h"
#include "nsIStringBundle.h"
#include "nsMsgMessageFlags.h"

#define PREF_MAIL_ACCOUNTMANAGER_ACCOUNTS "mail.accountmanager.accounts"
#define PREF_MAIL_ACCOUNTMANAGER_DEFAULTACCOUNT "mail.accountmanager.defaultaccount"
#define PREF_MAIL_ACCOUNTMANAGER_LOCALFOLDERSSERVER "mail.accountmanager.localfoldersserver"
#define PREF_MAIL_SERVER_PREFIX "mail.server."
#define ACCOUNT_PREFIX "account"
#define SERVER_PREFIX "server"
#define ID_PREFIX "id"
#define ABOUT_TO_GO_OFFLINE_TOPIC "network:offline-about-to-go-offline"
#define ACCOUNT_DELIMITER ","
#define APPEND_ACCOUNTS_VERSION_PREF_NAME "append_preconfig_accounts.version"
#define MAILNEWS_ROOT_PREF "mailnews."
#define PREF_MAIL_ACCOUNTMANAGER_APPEND_ACCOUNTS "mail.accountmanager.appendaccounts"

static NS_DEFINE_CID(kMsgAccountCID, NS_MSGACCOUNT_CID);
static NS_DEFINE_CID(kMsgFolderCacheCID, NS_MSGFOLDERCACHE_CID);

// use this to search for all servers with the given hostname/iid and
// put them in "servers"
struct findServerEntry {
  const nsACString& hostname;
  const nsACString& username;
  const nsACString& type;
  const PRInt32 port;
  const PRBool useRealSetting;
  nsIMsgIncomingServer *server;
  findServerEntry(const nsACString& aHostName, const nsACString& aUserName,
                  const nsACString& aType, PRInt32 aPort, PRBool aUseRealSetting)
    : hostname(aHostName),
      username(aUserName),
      type(aType),
      port(aPort),
      useRealSetting(aUseRealSetting),
      server(nsnull)
    {}
};

typedef struct _findServerByKeyEntry {
  nsCString key;
  PRInt32 index;
} findServerByKeyEntry;

// use this to search for all servers that match "server" and
// put all identities in "identities"
typedef struct _findIdentitiesByServerEntry {
  nsISupportsArray *identities;
  nsIMsgIncomingServer *server;
} findIdentitiesByServerEntry;

typedef struct _findServersByIdentityEntry {
  nsISupportsArray *servers;
  nsIMsgIdentity *identity;
} findServersByIdentityEntry;

typedef struct _findAccountByKeyEntry {
  nsCString  key;
  nsIMsgAccount* account;
} findAccountByKeyEntry;

NS_IMPL_THREADSAFE_ISUPPORTS5(nsMsgAccountManager,
                              nsIMsgAccountManager,
                              nsIObserver,
                              nsISupportsWeakReference,
                              nsIUrlListener,
                              nsIFolderListener)

nsMsgAccountManager::nsMsgAccountManager() :
  m_accountsLoaded(PR_FALSE),
  m_emptyTrashInProgress(PR_FALSE),
  m_cleanupInboxInProgress(PR_FALSE),
  m_haveShutdown(PR_FALSE),
  m_shutdownInProgress(PR_FALSE),
  m_userAuthenticated(PR_FALSE),
  m_loadingVirtualFolders(PR_FALSE),
  m_virtualFoldersLoaded(PR_FALSE)
{
}

nsMsgAccountManager::~nsMsgAccountManager()
{
  nsresult rv;

  if(!m_haveShutdown)
  {
    Shutdown();
    //Don't remove from Observer service in Shutdown because Shutdown also gets called
    //from xpcom shutdown observer.  And we don't want to remove from the service in that case.
    nsCOMPtr<nsIObserverService> observerService =
         do_GetService("@mozilla.org/observer-service;1", &rv);
    if (NS_SUCCEEDED(rv))
    {
      observerService->RemoveObserver(this, NS_XPCOM_SHUTDOWN_OBSERVER_ID);
      observerService->RemoveObserver(this, ABOUT_TO_GO_OFFLINE_TOPIC);
    }
  }
}

nsresult nsMsgAccountManager::Init()
{
  nsresult rv;

  m_identities.Init();
  m_incomingServers.Init();

  rv = NS_NewISupportsArray(getter_AddRefs(m_accounts));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = NS_NewISupportsArray(getter_AddRefs(mFolderListeners));

  nsCOMPtr<nsIObserverService> observerService =
           do_GetService("@mozilla.org/observer-service;1", &rv);
  if (NS_SUCCEEDED(rv))
  {
    observerService->AddObserver(this, NS_XPCOM_SHUTDOWN_OBSERVER_ID, PR_TRUE);
    observerService->AddObserver(this, "quit-application" , PR_TRUE);
    observerService->AddObserver(this, ABOUT_TO_GO_OFFLINE_TOPIC, PR_TRUE);
    observerService->AddObserver(this, "profile-before-change", PR_TRUE);
  }

  return NS_OK;
}

nsresult nsMsgAccountManager::Shutdown()
{
  if (m_haveShutdown)     // do not shutdown twice
    return NS_OK;

  nsresult rv;

  SaveVirtualFolders();

  nsCOMPtr<nsIMsgDBService> msgDBService = do_GetService(NS_MSGDB_SERVICE_CONTRACTID, &rv);
  if (msgDBService)
  {
    PRInt32 numVFListeners = m_virtualFolderListeners.Count();
    for(PRInt32 i = 0; i < numVFListeners; i++)
      msgDBService->UnregisterPendingListener(m_virtualFolderListeners[i]);
  }
  if(m_msgFolderCache)
    WriteToFolderCache(m_msgFolderCache);
  (void)ShutdownServers();
  (void)UnloadAccounts();

  //shutdown removes nsIIncomingServer listener from biff manager, so do it after accounts have been unloaded
  nsCOMPtr<nsIMsgBiffManager> biffService = do_GetService(NS_MSGBIFFMANAGER_CONTRACTID, &rv);
  if (NS_SUCCEEDED(rv) && biffService)
    biffService->Shutdown();

  //shutdown removes nsIIncomingServer listener from purge service, so do it after accounts have been unloaded
  nsCOMPtr<nsIMsgPurgeService> purgeService = do_GetService(NS_MSGPURGESERVICE_CONTRACTID, &rv);
  if (NS_SUCCEEDED(rv) && purgeService)
    purgeService->Shutdown();

  m_msgFolderCache = nsnull;
  m_haveShutdown = PR_TRUE;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgAccountManager::GetShutdownInProgress(PRBool *_retval)
{
    NS_ENSURE_ARG_POINTER(_retval);
    *_retval = m_shutdownInProgress;
    return NS_OK;
}

NS_IMETHODIMP
nsMsgAccountManager::GetUserNeedsToAuthenticate(PRBool *aRetval)
{
  NS_ENSURE_ARG_POINTER(aRetval);
  if (!m_userAuthenticated)
    return m_prefs->GetBoolPref("mail.password_protect_local_cache", aRetval);
  *aRetval = !m_userAuthenticated;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgAccountManager::SetUserNeedsToAuthenticate(PRBool aUserNeedsToAuthenticate)
{
  m_userAuthenticated = !aUserNeedsToAuthenticate;
  return NS_OK;
}

NS_IMETHODIMP nsMsgAccountManager::Observe(nsISupports *aSubject, const char *aTopic, const PRUnichar *someData)
{
  if(!strcmp(aTopic,NS_XPCOM_SHUTDOWN_OBSERVER_ID))
  {
    Shutdown();
    return NS_OK;
  }

  if (!strcmp(aTopic,"quit-application"))
  {
    m_shutdownInProgress = PR_TRUE;
    return NS_OK;
  }

  if (!strcmp(aTopic, ABOUT_TO_GO_OFFLINE_TOPIC))
  {
    nsAutoString dataString(NS_LITERAL_STRING("offline"));
    if (someData)
    {
      nsAutoString someDataString(someData);
      if (dataString.Equals(someDataString))
        CloseCachedConnections();
    }
    return NS_OK;
  }

  if (!strcmp(aTopic, "profile-before-change"))
  {
    Shutdown();
    return NS_OK;
  }

 return NS_OK;
}

nsresult
nsMsgAccountManager::getPrefService()
{
  nsresult rv = NS_OK;
  if (!m_prefs)
    m_prefs = do_GetService(NS_PREFSERVICE_CONTRACTID, &rv);
  return rv;
}


void
nsMsgAccountManager::getUniqueAccountKey(const char * prefix,
                                         nsISupportsArray *accounts,
                                         nsCString& aResult)
{
  PRInt32 i=1;
  findAccountByKeyEntry findEntry;
  findEntry.account = nsnull;

  do {
    findEntry.account = nsnull;
    aResult = prefix;
    aResult.AppendInt(i++);
    findEntry.key = aResult.get();
    accounts->EnumerateForwards(findAccountByKey, (void *)&findEntry);
  } while (findEntry.account);
}

nsresult
nsMsgAccountManager::CreateIdentity(nsIMsgIdentity **_retval)
{
  NS_ENSURE_ARG_POINTER(_retval);
  nsresult rv;
  nsCAutoString key;
  nsCOMPtr<nsIMsgIdentity> identity;
  PRInt32 i = 1;
  do {
    key.AssignLiteral(ID_PREFIX);
    key.AppendInt(i++);
    m_identities.Get(key, getter_AddRefs(identity));
  } while (identity);

  rv = createKeyedIdentity(key, _retval);
  return rv;
}

NS_IMETHODIMP
nsMsgAccountManager::GetIdentity(const nsACString& key, nsIMsgIdentity **_retval)
{
  NS_ENSURE_ARG_POINTER(_retval);
  nsresult rv = NS_OK;
  *_retval = nsnull;

  if (!key.IsEmpty())
  {
    nsCOMPtr<nsIMsgIdentity> identity;
    m_identities.Get(key, getter_AddRefs(identity));
    if (identity)
      identity.swap(*_retval);
    else // identity doesn't exist. create it.
      rv = createKeyedIdentity(key, _retval);
  }

  return rv;
}

/*
 * the shared identity-creation code
 * create an identity and add it to the accountmanager's list.
 */
nsresult
nsMsgAccountManager::createKeyedIdentity(const nsACString& key,
                                         nsIMsgIdentity ** aIdentity)
{
  nsresult rv;
  nsCOMPtr<nsIMsgIdentity> identity =
      do_CreateInstance(NS_MSGIDENTITY_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  identity->SetKey(key);
  m_identities.Put(key, identity);
  identity.swap(*aIdentity);
  return NS_OK;
}

NS_IMETHODIMP
nsMsgAccountManager::CreateIncomingServer(const nsACString&  username,
                                          const nsACString& hostname,
                                          const nsACString& type,
                                          nsIMsgIncomingServer **_retval)
{
  NS_ENSURE_ARG_POINTER(_retval);

  nsresult rv = LoadAccounts();
  NS_ENSURE_SUCCESS(rv, rv);

  nsCAutoString key;
  nsCOMPtr<nsIMsgIncomingServer> server;
  PRInt32 i = 1;
  do {
    key.AssignLiteral(SERVER_PREFIX);
    key.AppendInt(i++);
    m_incomingServers.Get(key, getter_AddRefs(server));
  } while (server);
  return createKeyedServer(key, username, hostname, type, _retval);
}

NS_IMETHODIMP
nsMsgAccountManager::GetIncomingServer(const nsACString& key,
                                       nsIMsgIncomingServer **_retval)
{
  NS_ENSURE_ARG_POINTER(_retval);
  nsresult rv;

  if (m_incomingServers.Get(key, _retval))
    return NS_OK;

  // server doesn't exist, so create it
  // this is really horrible because we are doing our own prefname munging
  // instead of leaving it up to the incoming server.
  // this should be fixed somehow so that we can create the incoming server
  // and then read from the incoming server's attributes

  // in order to create the right kind of server, we have to look
  // at the pref for this server to get the username, hostname, and type
  nsCAutoString serverPrefPrefix(PREF_MAIL_SERVER_PREFIX);
  serverPrefPrefix.Append(key);

  nsCString serverType;
  nsCAutoString serverPref (serverPrefPrefix);
  serverPref.AppendLiteral(".type");
  rv = m_prefs->GetCharPref(serverPref.get(), getter_Copies(serverType));
  NS_ENSURE_SUCCESS(rv, NS_ERROR_NOT_INITIALIZED);

  //
  // .userName
  serverPref = serverPrefPrefix;
  serverPref.AppendLiteral(".userName");
  nsCString username;
  rv = m_prefs->GetCharPref(serverPref.get(), getter_Copies(username));

  // .hostname
  serverPref = serverPrefPrefix;
  serverPref.AppendLiteral(".hostname");
  nsCString hostname;
  rv = m_prefs->GetCharPref(serverPref.get(), getter_Copies(hostname));
  NS_ENSURE_SUCCESS(rv, NS_ERROR_NOT_INITIALIZED);

  // the server type doesn't exist. That's bad.
  return createKeyedServer(key, username, hostname, serverType, _retval);
}

NS_IMETHODIMP
nsMsgAccountManager::RemoveIncomingServer(nsIMsgIncomingServer *aServer, 
                                          PRBool aCleanupFiles)
{
  nsCString serverKey;
  nsresult rv = aServer->GetKey(serverKey);
  NS_ENSURE_SUCCESS(rv, rv);

  LogoutOfServer(aServer); // close cached connections and forget session password

  // invalidate the FindServer() cache if we are removing the cached server
  if (m_lastFindServerResult == aServer)
    SetLastServerFound(nsnull, EmptyCString(), EmptyCString(), 0, EmptyCString());

  m_incomingServers.Remove(serverKey);

  nsCOMPtr<nsIMsgFolder> rootFolder;
  nsCOMPtr<nsISupportsArray> allDescendents;

  rv = aServer->GetRootFolder(getter_AddRefs(rootFolder));
  NS_ENSURE_SUCCESS(rv, rv);
  rv = NS_NewISupportsArray(getter_AddRefs(allDescendents));
  NS_ENSURE_SUCCESS(rv, rv);
  rootFolder->ListDescendents(allDescendents);

  PRUint32 cnt = 0;
  rv = allDescendents->Count(&cnt);
  NS_ENSURE_SUCCESS(rv, rv);

  for (PRUint32 i = 0; i < cnt; i++)
  {
    nsCOMPtr<nsIMsgFolder> folder = do_QueryElementAt(allDescendents, i);
    if (folder)
      folder->ForceDBClosed();
  }

  mFolderListeners->EnumerateForwards(removeListenerFromFolder, (void*)rootFolder);
  NotifyServerUnloaded(aServer);
  if (aCleanupFiles)
  {
    rv = aServer->RemoveFiles();
    NS_ENSURE_SUCCESS(rv, rv);
  }

  // now clear out the server once and for all.
  // watch out! could be scary
  aServer->ClearAllValues();
  rootFolder->Shutdown(PR_TRUE);
  return rv;
}

/*
 * create a server when you know the key and the type
 */
nsresult
nsMsgAccountManager::createKeyedServer(const nsACString& key,
                                       const nsACString& username,
                                       const nsACString& hostname,
                                       const nsACString& type,
                                       nsIMsgIncomingServer ** aServer)
{
  nsresult rv;
  *aServer = nsnull;

  //construct the contractid
  nsCAutoString serverContractID(NS_MSGINCOMINGSERVER_CONTRACTID_PREFIX);
  serverContractID += type;

  // finally, create the server
  nsCOMPtr<nsIMsgIncomingServer> server =
           do_CreateInstance(serverContractID.get(), &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  PRInt32 port;
  nsCOMPtr <nsIMsgIncomingServer> existingServer;
  server->SetKey(key);
  server->SetType(type);
  server->SetUsername(username);
  server->SetHostName(hostname);
  server->GetPort(&port);
  FindRealServer(username, hostname, type, port, getter_AddRefs(existingServer));
  // don't allow duplicate servers.
  if (existingServer)
    return NS_ERROR_FAILURE;

  m_incomingServers.Put(key, server);

  // now add all listeners that are supposed to be
  // waiting on root folders
  nsCOMPtr<nsIMsgFolder> rootFolder;
  rv = server->GetRootFolder(getter_AddRefs(rootFolder));
  NS_ENSURE_SUCCESS(rv, rv);
  mFolderListeners->EnumerateForwards(addListenerToFolder,
                                      (void *)(nsIMsgFolder*)rootFolder);
  server.swap(*aServer);
  return NS_OK;
}

PRBool
nsMsgAccountManager::addListenerToFolder(nsISupports *element, void *data)
{
  nsresult rv;
  nsIMsgFolder *rootFolder = (nsIMsgFolder *)data;
  nsCOMPtr<nsIFolderListener> listener = do_QueryInterface(element, &rv);
  NS_ENSURE_SUCCESS(rv, PR_TRUE);

  rootFolder->AddFolderListener(listener);
  return PR_TRUE;
}

PRBool
nsMsgAccountManager::removeListenerFromFolder(nsISupports *element, void *data)
{
  nsresult rv;
  nsIMsgFolder *rootFolder = (nsIMsgFolder *)data;
  nsCOMPtr<nsIFolderListener> listener = do_QueryInterface(element, &rv);
  NS_ENSURE_SUCCESS(rv, PR_TRUE);

  rootFolder->RemoveFolderListener(listener);
  return PR_TRUE;
}

NS_IMETHODIMP
nsMsgAccountManager::DuplicateAccount(nsIMsgAccount *aAccount)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsMsgAccountManager::RemoveIdentity(nsIMsgIdentity *aIdentity)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMsgAccountManager::RemoveAccount(nsIMsgAccount *aAccount)
{
  NS_ENSURE_ARG_POINTER(aAccount);
  nsresult rv;
  rv = LoadAccounts();
  NS_ENSURE_SUCCESS(rv, rv);

  // order is important!
  // remove it from the prefs first
  nsCString key;
  rv = aAccount->GetKey(key);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = removeKeyedAccount(key);
  NS_ENSURE_SUCCESS(rv, rv);

  // we were able to save the new prefs (i.e. not locked) so now remove it
  // from the account manager... ignore the error though, because the only
  // possible problem is that it wasn't in the hash table anyway... and if
  // so, it doesn't matter.
  m_accounts->RemoveElement(aAccount);

  // if it's the default, clear the default account
  if (m_defaultAccount.get() == aAccount)
    SetDefaultAccount(nsnull);

  // XXX - need to figure out if this is the last time this server is
  // being used, and only send notification then.
  // (and only remove from hashtable then too!)
  nsCOMPtr<nsIMsgIncomingServer> server;
  rv = aAccount->GetIncomingServer(getter_AddRefs(server));
  if (NS_SUCCEEDED(rv) && server) {
    rv = RemoveIncomingServer(server, PR_FALSE);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  nsCOMPtr<nsISupportsArray> identityArray;
  rv = aAccount->GetIdentities(getter_AddRefs(identityArray));
  if (NS_SUCCEEDED(rv)) {
    PRUint32 count=0;
    identityArray->Count(&count);
    PRUint32 i;
    for (i = 0; i < count; i++)
    {
      nsCOMPtr<nsIMsgIdentity> identity( do_QueryElementAt(identityArray, i, &rv));
      PRBool identityStillUsed = PR_FALSE;
      // for each identity, see if any existing account still uses it, 
      // and if not, clear it.
      if (NS_SUCCEEDED(rv))
      {
        PRUint32 numAccounts;
        m_accounts->Count(&numAccounts);
        PRUint32 index;
        for (index = 0; index < numAccounts && !identityStillUsed; index++) 
        {
          nsCOMPtr<nsIMsgAccount> existingAccount;
          rv = m_accounts->QueryElementAt(index, NS_GET_IID(nsIMsgAccount),
                                          (void **)getter_AddRefs(existingAccount));
          if (NS_SUCCEEDED(rv)) 
          {
            nsCOMPtr<nsISupportsArray> existingIdentitiesArray;
  
            rv = existingAccount->GetIdentities(getter_AddRefs(existingIdentitiesArray));
            if (existingIdentitiesArray->IndexOf(identity) != kNotFound)
            {
              identityStillUsed = PR_TRUE;
              break;
            }
          }
        }
      }
      // clear out all identity information if no other account uses it.
      if (!identityStillUsed)
        identity->ClearAllValues();
    }
  }

  aAccount->ClearAllValues();
  return NS_OK;
}

// remove the account with the given key.
// note that this does NOT remove any of the related prefs
// (like the server, identity, etc)
nsresult
nsMsgAccountManager::removeKeyedAccount(const nsCString& key)
{
  nsresult rv;
  rv = getPrefService();
  NS_ENSURE_SUCCESS(rv, rv);

  nsCString accountList;
  rv = m_prefs->GetCharPref(PREF_MAIL_ACCOUNTMANAGER_ACCOUNTS, getter_Copies(accountList));
  NS_ENSURE_SUCCESS(rv, rv);

  // reconstruct the new account list, re-adding all accounts except
  // the one with 'key'
  nsCAutoString newAccountList;
  char *newStr = accountList.BeginWriting();
  char *token = NS_strtok(",", &newStr);
  while (token) {
    nsCAutoString testKey(token);
    testKey.StripWhitespace();

    // re-add the candidate key only if it's not the key we're looking for
    if (!testKey.IsEmpty() && !testKey.Equals(key)) {
      if (!newAccountList.IsEmpty())
        newAccountList.Append(',');
      newAccountList += testKey;
    }

    token = NS_strtok(",", &newStr);
  }

  // Update mAccountKeyList to reflect the deletion
  mAccountKeyList = newAccountList;

  // now write the new account list back to the prefs
  return m_prefs->SetCharPref(PREF_MAIL_ACCOUNTMANAGER_ACCOUNTS,
                                newAccountList.get());
}

/* get the default account. If no default account, pick the first account */
NS_IMETHODIMP
nsMsgAccountManager::GetDefaultAccount(nsIMsgAccount **aDefaultAccount)
{
  NS_ENSURE_ARG_POINTER(aDefaultAccount);
  nsresult rv;
  rv = LoadAccounts();
  NS_ENSURE_SUCCESS(rv, rv);

  PRUint32 count;
  if (!m_defaultAccount) {
    m_accounts->Count(&count);
    if (!count) {
      *aDefaultAccount = nsnull;
      return NS_ERROR_FAILURE;
    }

    nsCString defaultKey;
    rv = m_prefs->GetCharPref(PREF_MAIL_ACCOUNTMANAGER_DEFAULTACCOUNT, getter_Copies(defaultKey));

    if (NS_SUCCEEDED(rv))
      GetAccount(defaultKey, getter_AddRefs(m_defaultAccount));

    if (!m_defaultAccount) {
      PRUint32 index;
      PRBool foundValidDefaultAccount = PR_FALSE;
      for (index = 0; index < count; index++) {
        nsCOMPtr<nsIMsgAccount> account( do_QueryElementAt(m_accounts, index, &rv));
        if (NS_SUCCEEDED(rv)) {
          // get incoming server
          nsCOMPtr <nsIMsgIncomingServer> server;
          rv = account->GetIncomingServer(getter_AddRefs(server));
          NS_ENSURE_SUCCESS(rv,rv);

          PRBool canBeDefaultServer = PR_FALSE;
          if (server)
            server->GetCanBeDefaultServer(&canBeDefaultServer);

          // if this can serve as default server, set it as default and
          // break outof the loop.
          if (canBeDefaultServer) {
            SetDefaultAccount(account);
            foundValidDefaultAccount = PR_TRUE;
            break;
          }
        }
      }

      if (!foundValidDefaultAccount) {
        // get the first account and use it.
        // we need to fix this scenario.
        NS_WARNING("No valid default account found, just using first (FIXME)");
        nsCOMPtr<nsIMsgAccount> firstAccount( do_QueryElementAt(m_accounts, 0));
        SetDefaultAccount(firstAccount);
      }
    }
  }

  NS_IF_ADDREF(*aDefaultAccount = m_defaultAccount);
  return NS_OK;
}

NS_IMETHODIMP
nsMsgAccountManager::SetDefaultAccount(nsIMsgAccount * aDefaultAccount)
{
  if (m_defaultAccount != aDefaultAccount)
  {
    nsCOMPtr<nsIMsgAccount> oldAccount = m_defaultAccount;
    m_defaultAccount = aDefaultAccount;
    setDefaultAccountPref(aDefaultAccount); // it's ok if this fails
    notifyDefaultServerChange(oldAccount, aDefaultAccount); // ok if notifications fail
  }
  return NS_OK;
}

// fire notifications
nsresult
nsMsgAccountManager::notifyDefaultServerChange(nsIMsgAccount *aOldAccount,
                                               nsIMsgAccount *aNewAccount)
{
  nsresult rv;

  nsCOMPtr<nsIMsgIncomingServer> server;
  nsCOMPtr<nsIMsgFolder> rootFolder;

  // first tell old server it's no longer the default
  if (aOldAccount) {
    rv = aOldAccount->GetIncomingServer(getter_AddRefs(server));
    if (NS_SUCCEEDED(rv) && server) {
      rv = server->GetRootFolder(getter_AddRefs(rootFolder));
      if (NS_SUCCEEDED(rv) && rootFolder)
        rootFolder->NotifyBoolPropertyChanged(kDefaultServerAtom,
                                              PR_TRUE, PR_FALSE);
    }
  }

    // now tell new server it is.
  if (aNewAccount) {
    rv = aNewAccount->GetIncomingServer(getter_AddRefs(server));
    if (NS_SUCCEEDED(rv) && server) {
      rv = server->GetRootFolder(getter_AddRefs(rootFolder));
      if (NS_SUCCEEDED(rv) && rootFolder)
        rootFolder->NotifyBoolPropertyChanged(kDefaultServerAtom,
                                              PR_FALSE, PR_TRUE);
    }
  }

  if (aOldAccount && aNewAccount)  //only notify if the user goes and changes default account
  {
    nsCOMPtr<nsIObserverService> observerService =
      do_GetService("@mozilla.org/observer-service;1", &rv);

    if (NS_SUCCEEDED(rv))
      observerService->NotifyObservers(nsnull,"mailDefaultAccountChanged",nsnull);
  }

  return NS_OK;
}

nsresult
nsMsgAccountManager::setDefaultAccountPref(nsIMsgAccount* aDefaultAccount)
{
  nsresult rv;

  rv = getPrefService();
  NS_ENSURE_SUCCESS(rv,rv);

  if (aDefaultAccount) {
    nsCString key;
    rv = aDefaultAccount->GetKey(key);
    NS_ENSURE_SUCCESS(rv, rv);

    rv = m_prefs->SetCharPref(PREF_MAIL_ACCOUNTMANAGER_DEFAULTACCOUNT, key.get());
    NS_ENSURE_SUCCESS(rv,rv);
  }
  else
    m_prefs->ClearUserPref(PREF_MAIL_ACCOUNTMANAGER_DEFAULTACCOUNT);

  return NS_OK;
}

// enumaration for sending unload notifications
PLDHashOperator
nsMsgAccountManager::hashUnloadServer(nsCStringHashKey::KeyType aKey, nsCOMPtr<nsIMsgIncomingServer>& aServer, void* aClosure)
{
  nsresult rv;
  nsMsgAccountManager *accountManager = (nsMsgAccountManager*) aClosure;
  accountManager->NotifyServerUnloaded(aServer);

  nsCOMPtr<nsIMsgFolder> rootFolder;
  rv = aServer->GetRootFolder(getter_AddRefs(rootFolder));

  accountManager->mFolderListeners->EnumerateForwards(removeListenerFromFolder,
                                      (void *)(nsIMsgFolder*)rootFolder);

  if(NS_SUCCEEDED(rv))
    rootFolder->Shutdown(PR_TRUE);

  return PL_DHASH_NEXT;
}

void nsMsgAccountManager::LogoutOfServer(nsIMsgIncomingServer *aServer)
{
  nsresult rv = aServer->Shutdown();
  NS_ASSERTION(NS_SUCCEEDED(rv), "Shutdown of server failed");
  rv = aServer->ForgetSessionPassword();
  NS_ASSERTION(NS_SUCCEEDED(rv), "failed to remove the password associated with server");
}

NS_IMETHODIMP nsMsgAccountManager::GetFolderCache(nsIMsgFolderCache* *aFolderCache)
{
  NS_ENSURE_ARG_POINTER(aFolderCache);
  nsresult rv = NS_OK;

  if (!m_msgFolderCache)
  {
    m_msgFolderCache = do_CreateInstance(kMsgFolderCacheCID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIFile> cacheFile;
    rv = NS_GetSpecialDirectory(NS_APP_MESSENGER_FOLDER_CACHE_50_FILE,
                                getter_AddRefs(cacheFile));
    NS_ENSURE_SUCCESS(rv, rv);
    m_msgFolderCache->Init(cacheFile);
  }

  NS_IF_ADDREF(*aFolderCache = m_msgFolderCache);
  return rv;
}

static PLDHashOperator
hashWriteFolderCache(nsCStringHashKey::KeyType aKey, nsCOMPtr<nsIMsgIncomingServer>& aServer, void* aClosure)
{
  nsIMsgFolderCache *folderCache = (nsIMsgFolderCache *) aClosure;
  aServer->WriteToFolderCache(folderCache);
  return PL_DHASH_NEXT;
}

static PLDHashOperator
hashCleanupOnExit(nsCStringHashKey::KeyType aKey, nsCOMPtr<nsIMsgIncomingServer>& aServer, void* aClosure)
{
  PRBool emptyTrashOnExit = PR_FALSE;
  PRBool cleanupInboxOnExit = PR_FALSE;
  nsresult rv;

  if (WeAreOffline())
    return PL_DHASH_STOP;

  aServer->GetEmptyTrashOnExit(&emptyTrashOnExit);
  nsCOMPtr <nsIImapIncomingServer> imapserver = do_QueryInterface(aServer);
  if (imapserver)
  {
    imapserver->GetCleanupInboxOnExit(&cleanupInboxOnExit);
    imapserver->SetShuttingDown(PR_TRUE);
  }
  if (emptyTrashOnExit || cleanupInboxOnExit)
  {
    nsCOMPtr<nsIMsgFolder> root;
    aServer->GetRootFolder(getter_AddRefs(root));
    nsCString type;
    aServer->GetType(type);
    if (root)
    {
      nsCOMPtr<nsIMsgFolder> folder;
      folder = do_QueryInterface(root);
      if (folder)
      {
         nsCString passwd;
         PRBool serverRequiresPasswordForAuthentication = PR_TRUE;
         PRBool isImap = type.EqualsLiteral("imap");
         if (isImap)
         {
           aServer->GetServerRequiresPasswordForBiff(&serverRequiresPasswordForAuthentication);
           aServer->GetPassword(passwd);
         }
         if (!isImap || (isImap && (!serverRequiresPasswordForAuthentication || !passwd.IsEmpty())))
         {
           nsCOMPtr<nsIUrlListener> urlListener;
           nsCOMPtr<nsIMsgAccountManager> accountManager =
                    do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
           NS_ENSURE_SUCCESS(rv, PL_DHASH_NEXT);
           
           if (isImap)
             urlListener = do_QueryInterface(accountManager, &rv);

           if (isImap && cleanupInboxOnExit)
           {
             nsCOMPtr<nsISimpleEnumerator> enumerator;
             rv = folder->GetSubFolders(getter_AddRefs(enumerator));
             if (NS_SUCCEEDED(rv))
             {
               PRBool hasMore;
               while (NS_SUCCEEDED(enumerator->HasMoreElements(&hasMore)) &&
                      hasMore)
               {
                 nsCOMPtr<nsISupports> item;
                 enumerator->GetNext(getter_AddRefs(item));
 
                 nsCOMPtr<nsIMsgFolder> inboxFolder(do_QueryInterface(item));
                 if (!inboxFolder)
                   continue;

                 PRUint32 flags;
                 inboxFolder->GetFlags(&flags);
                 if (flags & nsMsgFolderFlags::Inbox)
                 {
                   rv = inboxFolder->Compact(urlListener, nsnull /* msgwindow */);
                   if (NS_SUCCEEDED(rv))
                     accountManager->SetFolderDoingCleanupInbox(inboxFolder);
                   break;
                 }
               }
             }
           }

           if (emptyTrashOnExit)
           {
             rv = folder->EmptyTrash(nsnull, urlListener);
             if (isImap && NS_SUCCEEDED(rv))
               accountManager->SetFolderDoingEmptyTrash(folder);
           }

           if (isImap && urlListener)
           {
             nsIThread *thread = NS_GetCurrentThread();

             PRBool inProgress = PR_FALSE;
             if (cleanupInboxOnExit)
             {
               PRInt32 loopCount = 0; // used to break out after 5 seconds
               accountManager->GetCleanupInboxInProgress(&inProgress);
               while (inProgress && loopCount++ < 5000)
               {
                 accountManager->GetCleanupInboxInProgress(&inProgress);
                 PR_CEnterMonitor(folder);
                 PR_CWait(folder, PR_MicrosecondsToInterval(1000UL));
                 PR_CExitMonitor(folder);
                 NS_ProcessPendingEvents(thread);
               }
             }
             if (emptyTrashOnExit)
             {
               accountManager->GetEmptyTrashInProgress(&inProgress);
               PRInt32 loopCount = 0;
               while (inProgress && loopCount++ < 5000)
               {
                 accountManager->GetEmptyTrashInProgress(&inProgress);
                 PR_CEnterMonitor(folder);
                 PR_CWait(folder, PR_MicrosecondsToInterval(1000UL));
                 PR_CExitMonitor(folder);
                 NS_ProcessPendingEvents(thread);
               }
             }
           }
         }
       }
     }
   }
   return PL_DHASH_NEXT;
}

static PLDHashOperator
hashCloseCachedConnections(nsCStringHashKey::KeyType aKey, nsCOMPtr<nsIMsgIncomingServer>& aServer, void* aClosure)
{
  aServer->CloseCachedConnections();
  return PL_DHASH_NEXT;
}

static PLDHashOperator
hashShutdown(nsCStringHashKey::KeyType aKey, nsCOMPtr<nsIMsgIncomingServer>& aServer, void* aClosure)
{
  aServer->Shutdown();
  return PL_DHASH_NEXT;
}

/* readonly attribute nsISupportsArray accounts; */
NS_IMETHODIMP
nsMsgAccountManager::GetAccounts(nsISupportsArray **_retval)
{
  nsresult rv;
  rv = LoadAccounts();
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsISupportsArray> accounts;
  NS_NewISupportsArray(getter_AddRefs(accounts));
  accounts->AppendElements(m_accounts);
  accounts.swap(*_retval);
  return NS_OK;
}

/* nsISupportsArray GetAllIdentities (); */
NS_IMETHODIMP
nsMsgAccountManager::GetAllIdentities(nsISupportsArray **_retval)
{
  nsresult rv;
  rv = LoadAccounts();
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsISupportsArray> identities;
  rv = NS_NewISupportsArray(getter_AddRefs(identities));
  NS_ENSURE_SUCCESS(rv, rv);

  // convert hash table->nsISupportsArray of identities
  m_accounts->EnumerateForwards(getIdentitiesToArray,
                                (void *)(nsISupportsArray*)identities);
  // convert nsISupportsArray->nsISupportsArray
  // when do we free the nsISupportsArray?
  identities.swap(*_retval);
  return rv;
}

PRBool
nsMsgAccountManager::addIdentityIfUnique(nsISupports *element, void *aData)
{
  nsresult rv;
  nsCOMPtr<nsIMsgIdentity> identity = do_QueryInterface(element, &rv);
  if (NS_FAILED(rv))
    return PR_TRUE;

  nsISupportsArray *array = (nsISupportsArray*)aData;
  
  nsCString key;
  rv = identity->GetKey(key);
  if (NS_FAILED(rv))
    return PR_TRUE;

  PRUint32 count = 0;
  rv = array->Count(&count);
  if (NS_FAILED(rv))
    return PR_TRUE;

  PRBool found=PR_FALSE;
  PRUint32 i;
  for (i = 0; i < count; i++) {
    nsCOMPtr<nsIMsgIdentity> thisIdentity( do_QueryElementAt(array, i, &rv));
    if (NS_FAILED(rv)) 
      continue;

    nsCString thisKey;
    thisIdentity->GetKey(thisKey);
    if (key.Equals(thisKey)) {
      found = PR_TRUE;
      break;
    }
  }

  if (!found)
    array->AppendElement(identity);

  return PR_TRUE;
}

PRBool
nsMsgAccountManager::getIdentitiesToArray(nsISupports *element, void *aData)
{
  nsresult rv;
  nsCOMPtr<nsIMsgAccount> account = do_QueryInterface(element, &rv);
  if (NS_FAILED(rv))
    return PR_TRUE;

  nsCOMPtr<nsISupportsArray> identities;
  rv = account->GetIdentities(getter_AddRefs(identities));
  if (NS_FAILED(rv))
    return PR_TRUE;

  identities->EnumerateForwards(addIdentityIfUnique, aData);

  return PR_TRUE;
}

static PLDHashOperator
hashGetServersToArray(nsCStringHashKey::KeyType aKey, nsCOMPtr<nsIMsgIncomingServer>& aServer, void* aClosure)
{
  nsISupportsArray *array = (nsISupportsArray*) aClosure;
  nsCOMPtr<nsISupports> serverSupports = do_QueryInterface(aServer);
  array->AppendElement(aServer);
  return PL_DHASH_NEXT;
}

/* nsISupportsArray GetAllServers (); */
NS_IMETHODIMP
nsMsgAccountManager::GetAllServers(nsISupportsArray **_retval)
{
  nsresult rv;
  rv = LoadAccounts();
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsISupportsArray> servers;
  rv = NS_NewISupportsArray(getter_AddRefs(servers));
  NS_ENSURE_SUCCESS(rv, rv);

  // enumerate by going through the list of accounts, so that we
  // get the order correct
  m_incomingServers.Enumerate(hashGetServersToArray,
                              (void *)(nsISupportsArray*)servers);
  servers.swap(*_retval);
  return rv;
}

nsresult
nsMsgAccountManager::LoadAccounts()
{
  nsresult rv;

  // for now safeguard multiple calls to this function
  if (m_accountsLoaded)
    return NS_OK;

  kDefaultServerAtom = do_GetAtom("DefaultServer");

  //Ensure biff service has started
  nsCOMPtr<nsIMsgBiffManager> biffService =
           do_GetService(NS_MSGBIFFMANAGER_CONTRACTID, &rv);

  if (NS_SUCCEEDED(rv))
    biffService->Init();

  //Ensure purge service has started
  nsCOMPtr<nsIMsgPurgeService> purgeService =
           do_GetService(NS_MSGPURGESERVICE_CONTRACTID, &rv);

  if (NS_SUCCEEDED(rv))
    purgeService->Init();

  // Ensure messenger OS integration service has started
  // note, you can't expect the integrationService to be there
  // we don't have OS integration on all platforms.
  nsCOMPtr<nsIMessengerOSIntegration> integrationService =
           do_GetService(NS_MESSENGEROSINTEGRATION_CONTRACTID, &rv);

  // mail.accountmanager.accounts is the main entry point for all accounts
  nsCString accountList;
  rv = getPrefService();
  if (NS_SUCCEEDED(rv)) {
    rv = m_prefs->GetCharPref(PREF_MAIL_ACCOUNTMANAGER_ACCOUNTS, getter_Copies(accountList));

    /**
     * Check to see if we need to add pre-configured accounts.
     * Following prefs are important to note in understanding the procedure here.
     *
     * 1. pref("mailnews.append_preconfig_accounts.version", version number);
     * This pref registers the current version in the user prefs file. A default value
     * is stored in mailnews.js file. If a given vendor needs to add more preconfigured
     * accounts, the default version number can be increased. Comparing version
     * number from user's prefs file and the default one from mailnews.js, we
     * can add new accounts and any other version level changes that need to be done.
     *
     * 2. pref("mail.accountmanager.appendaccounts", <comma separated account list>);
     * This pref contains the list of pre-configured accounts that ISP/Vendor wants to
     * to add to the existing accounts list.
     */
    nsCOMPtr<nsIPrefService> prefservice(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
    NS_ENSURE_SUCCESS(rv,rv);

    nsCOMPtr<nsIPrefBranch> defaultsPrefBranch;
    rv = prefservice->GetDefaultBranch(MAILNEWS_ROOT_PREF, getter_AddRefs(defaultsPrefBranch));
    NS_ENSURE_SUCCESS(rv,rv);

    nsCOMPtr<nsIPrefBranch> prefBranch;
    rv = prefservice->GetBranch(MAILNEWS_ROOT_PREF, getter_AddRefs(prefBranch));
    NS_ENSURE_SUCCESS(rv,rv);

    PRInt32 appendAccountsCurrentVersion=0;
    PRInt32 appendAccountsDefaultVersion=0;
    rv = prefBranch->GetIntPref(APPEND_ACCOUNTS_VERSION_PREF_NAME, &appendAccountsCurrentVersion);
    NS_ENSURE_SUCCESS(rv,rv);

    rv = defaultsPrefBranch->GetIntPref(APPEND_ACCOUNTS_VERSION_PREF_NAME, &appendAccountsDefaultVersion);
    NS_ENSURE_SUCCESS(rv,rv);

    // Update the account list if needed
    if ((appendAccountsCurrentVersion <= appendAccountsDefaultVersion)) {

      // Get a list of pre-configured accounts
      nsCString appendAccountList;
      rv = m_prefs->GetCharPref(PREF_MAIL_ACCOUNTMANAGER_APPEND_ACCOUNTS, getter_Copies(appendAccountList));

      // If there are pre-configured accounts, we need to add them to the existing list.
      if (!appendAccountList.IsEmpty()) {
        if (!accountList.IsEmpty()) {
          nsCStringArray existingAccountsArray;
          ParseString(accountList.get(), ACCOUNT_DELIMITER, existingAccountsArray);

          // Tokenize the data and add each account if it is not already there
          // in the user's current mailnews account list
          char *newAccountStr = appendAccountList.BeginWriting();
          char *token = NS_strtok(ACCOUNT_DELIMITER, &newAccountStr);

          nsCAutoString newAccount;
          while (token) {
            if (token && *token) {
              newAccount.Assign(token);
              newAccount.StripWhitespace();

              if (existingAccountsArray.IndexOf(newAccount) == -1) {
                accountList.Append(',');
                accountList.Append(newAccount);
              }
            }
            token = NS_strtok(ACCOUNT_DELIMITER, &newAccountStr);
          }
        }
        else {
          accountList = appendAccountList;
        }
        // Increase the version number so that updates will happen as and when needed
        rv = prefBranch->SetIntPref(APPEND_ACCOUNTS_VERSION_PREF_NAME, appendAccountsCurrentVersion + 1);
      }
    }
  }

  m_accountsLoaded = PR_TRUE;  //It is ok to return null accounts like when we create new profile
  m_haveShutdown = PR_FALSE;

  if (accountList.IsEmpty())
    return NS_OK;

  /* parse accountList and run loadAccount on each string, comma-separated */
  nsCOMPtr<nsIMsgAccount> account;
  char *newStr = accountList.BeginWriting();
  nsCAutoString str;
  for (char *token = NS_strtok(",", &newStr); token; token = NS_strtok(",", &newStr))
  {
    str = token;
    str.StripWhitespace();

    if (str.IsEmpty() ||
        NS_FAILED(createKeyedAccount(str, getter_AddRefs(account))) ||
        !account) {
      NS_WARNING("unexpected entry in account list; prefs corrupt?");
      continue;
    }

    // force load of accounts (need to find a better way to do this)
    nsCOMPtr<nsISupportsArray> identities;
    account->GetIdentities(getter_AddRefs(identities));

    nsCOMPtr<nsIMsgIncomingServer> server;
    account->GetIncomingServer(getter_AddRefs(server));
    // if no server, we should get rid of the account.
    if (!server)
      RemoveAccount(account);
  }

  nsCOMPtr<nsIMsgMailSession> mailSession = do_GetService(NS_MSGMAILSESSION_CONTRACTID, &rv);

  if (NS_SUCCEEDED(rv))
    mailSession->AddFolderListener(this, nsIFolderListener::added | nsIFolderListener::removed);
  return NS_OK;
}

// this routine goes through all the identities and makes sure
// that the special folders for each identity have the
// correct special folder flags set, e.g, the Sent folder has
// the sent flag set.
//
// it also goes through all the spam settings for each account
// and makes sure the folder flags are set there, too
NS_IMETHODIMP
nsMsgAccountManager::SetSpecialFolders()
{
  nsresult rv;
  nsCOMPtr<nsIRDFService> rdf = do_GetService("@mozilla.org/rdf/rdf-service;1", &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr<nsISupportsArray> identities;
  GetAllIdentities(getter_AddRefs(identities));

  PRUint32 idCount = 0;
  identities->Count(&idCount);

  PRUint32 id;
  nsCString identityKey;

  for (id = 0; id < idCount; id++)
  {
    nsCOMPtr<nsIMsgIdentity> thisIdentity(do_QueryElementAt(identities, id, &rv));
    if (NS_FAILED(rv))
      continue;

    if (NS_SUCCEEDED(rv) && thisIdentity)
    {
      nsCString folderUri;
      nsCOMPtr<nsIRDFResource> res;
      nsCOMPtr<nsIMsgFolder> folder;
      thisIdentity->GetFccFolder(folderUri);
      if (!folderUri.IsEmpty() && NS_SUCCEEDED(rdf->GetResource(folderUri, getter_AddRefs(res))))
      {
        folder = do_QueryInterface(res, &rv);
        nsCOMPtr <nsIMsgFolder> parent;
        if (folder && NS_SUCCEEDED(rv))
        {
          rv = folder->GetParent(getter_AddRefs(parent));
          if (NS_SUCCEEDED(rv) && parent)
            rv = folder->SetFlag(nsMsgFolderFlags::SentMail);
        }
      }
      thisIdentity->GetDraftFolder(folderUri);
      if (!folderUri.IsEmpty() && NS_SUCCEEDED(rdf->GetResource(folderUri, getter_AddRefs(res))))
      {
        folder = do_QueryInterface(res, &rv);
        nsCOMPtr <nsIMsgFolder> parent;
        if (folder && NS_SUCCEEDED(rv))
        {
          rv = folder->GetParent(getter_AddRefs(parent));
          if (NS_SUCCEEDED(rv) && parent)
            rv = folder->SetFlag(nsMsgFolderFlags::Drafts);
        }
      }
      thisIdentity->GetArchiveFolder(folderUri);
      if (!folderUri.IsEmpty() && NS_SUCCEEDED(rdf->GetResource(folderUri, getter_AddRefs(res))))
      {
        folder = do_QueryInterface(res, &rv);
        nsCOMPtr <nsIMsgFolder> parent;
        if (folder && NS_SUCCEEDED(rv))
        {
          rv = folder->GetParent(getter_AddRefs(parent));
          if (NS_SUCCEEDED(rv) && parent)
            rv = folder->SetFlag(nsMsgFolderFlags::Archive);
        }
      }
      thisIdentity->GetStationeryFolder(folderUri);
      if (!folderUri.IsEmpty() && NS_SUCCEEDED(rdf->GetResource(folderUri, getter_AddRefs(res))))
      {
        folder = do_QueryInterface(res, &rv);
        if (folder && NS_SUCCEEDED(rv))
        {
          nsCOMPtr <nsIMsgFolder> parent;
          rv = folder->GetParent(getter_AddRefs(parent));
          if (NS_SUCCEEDED(rv) && parent) // only set flag if folder is real
            rv = folder->SetFlag(nsMsgFolderFlags::Templates);
        }
      }
    }
  }

  // XXX todo
  // get all servers
  // get all spam settings for each server
  // set the JUNK folder flag on the spam folders, right?
  return NS_OK;
}

NS_IMETHODIMP
nsMsgAccountManager::UnloadAccounts()
{
  // release the default account
  kDefaultServerAtom = nsnull;
  m_defaultAccount=nsnull;
  m_incomingServers.Enumerate(hashUnloadServer, this);

  m_accounts->Clear();          // will release all elements
  m_identities.Clear();
  m_incomingServers.Clear();
  m_accountsLoaded = PR_FALSE;
  mAccountKeyList.Truncate();
  SetLastServerFound(nsnull, EmptyCString(), EmptyCString(), 0, EmptyCString());
  return NS_OK;
}

NS_IMETHODIMP
nsMsgAccountManager::ShutdownServers()
{
  m_incomingServers.Enumerate(hashShutdown, nsnull);
  return NS_OK;
}

NS_IMETHODIMP
nsMsgAccountManager::CloseCachedConnections()
{
  m_incomingServers.Enumerate(hashCloseCachedConnections, nsnull);
  return NS_OK;
}

NS_IMETHODIMP
nsMsgAccountManager::CleanupOnExit()
{
  m_incomingServers.Enumerate(hashCleanupOnExit, nsnull);
  return NS_OK;
}

NS_IMETHODIMP
nsMsgAccountManager::WriteToFolderCache(nsIMsgFolderCache *folderCache)
{
  m_incomingServers.Enumerate(hashWriteFolderCache, folderCache);
  return folderCache->Close();
}

nsresult
nsMsgAccountManager::createKeyedAccount(const nsCString& key,
                                        nsIMsgAccount ** aAccount)
{

  nsresult rv;
  nsCOMPtr<nsIMsgAccount> account = do_CreateInstance(kMsgAccountCID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  account->SetKey(key);

  // add to internal nsISupportsArray
  m_accounts->AppendElement(static_cast<nsISupports*>(account));

  // add to string list
  if (mAccountKeyList.IsEmpty())
    mAccountKeyList = key;
  else {
    mAccountKeyList.Append(',');
    mAccountKeyList.Append(key);
  }

  rv = getPrefService();
  if (NS_SUCCEEDED(rv))
    m_prefs->SetCharPref(PREF_MAIL_ACCOUNTMANAGER_ACCOUNTS, mAccountKeyList.get());
  account.swap(*aAccount);
  return NS_OK;
}

NS_IMETHODIMP
nsMsgAccountManager::CreateAccount(nsIMsgAccount **_retval)
{
  NS_ENSURE_ARG_POINTER(_retval);

  nsCAutoString key;
  getUniqueAccountKey(ACCOUNT_PREFIX, m_accounts, key);

  return createKeyedAccount(key, _retval);
}

NS_IMETHODIMP
nsMsgAccountManager::GetAccount(const nsACString& key, nsIMsgAccount **_retval)
{
  NS_ENSURE_ARG_POINTER(_retval);

  findAccountByKeyEntry findEntry;
  findEntry.key = key;
  findEntry.account = nsnull;

  m_accounts->EnumerateForwards(findAccountByKey, (void *)&findEntry);

  if (findEntry.account)
    NS_ADDREF(*_retval = findEntry.account);
  else
    *_retval = nsnull;

  // not found, create on demand
  return NS_OK;
}

NS_IMETHODIMP
nsMsgAccountManager::FindServerIndex(nsIMsgIncomingServer* server, PRInt32* result)
{
  NS_ENSURE_ARG_POINTER(server);
  nsresult rv;

  nsCString key;
  rv = server->GetKey(key);

  findServerByKeyEntry findEntry;
  findEntry.key = key;
  findEntry.index = -1;

  // do this by account because the account list is in order
  m_accounts->EnumerateForwards(findServerIndexByServer, (void *)&findEntry);

  // even if the search failed, we can return index.
  // this means that all servers not in the array return an index higher
  // than all "registered" servers
  *result = findEntry.index;
  return NS_OK;
}

PRBool
nsMsgAccountManager::findServerIndexByServer(nsISupports *element, void *aData)
{
  nsresult rv;

  nsCOMPtr<nsIMsgAccount> account = do_QueryInterface(element);
  findServerByKeyEntry *entry = (findServerByKeyEntry*) aData;

  // increment the index;
  entry->index++;

  nsCOMPtr<nsIMsgIncomingServer> server;
  rv = account->GetIncomingServer(getter_AddRefs(server));
  if (!server || NS_FAILED(rv))
    return PR_TRUE;

  nsCString key;
  rv = server->GetKey(key);
  if (NS_FAILED(rv))
    return PR_TRUE;

  // stop when found,
  // index will be set to the current index
  return !key.Equals(entry->key);
}

PRBool
nsMsgAccountManager::findAccountByKey(nsISupports* element, void *aData)
{
  nsresult rv;
  nsCOMPtr<nsIMsgAccount> account = do_QueryInterface(element, &rv);
  if (NS_FAILED(rv))
    return PR_TRUE;

  findAccountByKeyEntry *entry = (findAccountByKeyEntry*) aData;

  nsCString key;
  account->GetKey(key);
  if (key.Equals(entry->key))
  {
    entry->account = account;
    return PR_FALSE;        // stop when found
  }
  return PR_TRUE;
}

NS_IMETHODIMP nsMsgAccountManager::AddIncomingServerListener(nsIIncomingServerListener *serverListener)
{
  m_incomingServerListeners.AppendObject(serverListener);
  return NS_OK;
}

NS_IMETHODIMP nsMsgAccountManager::RemoveIncomingServerListener(nsIIncomingServerListener *serverListener)
{
  m_incomingServerListeners.RemoveObject(serverListener);
  return NS_OK;
}

NS_IMETHODIMP nsMsgAccountManager::NotifyServerLoaded(nsIMsgIncomingServer *server)
{
  PRInt32 count = m_incomingServerListeners.Count();
  for(PRInt32 i = 0; i < count; i++)
  {
    nsIIncomingServerListener* listener = m_incomingServerListeners[i];
    listener->OnServerLoaded(server);
  }

  return NS_OK;
}

NS_IMETHODIMP nsMsgAccountManager::NotifyServerUnloaded(nsIMsgIncomingServer *server)
{
  PRInt32 count = m_incomingServerListeners.Count();
  server->SetFilterList(nsnull); // clear this to cut shutdown leaks. we are always passing valid non-null server here.

  for(PRInt32 i = 0; i < count; i++)
  {
    nsIIncomingServerListener* listener = m_incomingServerListeners[i];
    listener->OnServerUnloaded(server);
  }

  return NS_OK;
}

NS_IMETHODIMP nsMsgAccountManager::NotifyServerChanged(nsIMsgIncomingServer *server)
{
  PRInt32 count = m_incomingServerListeners.Count();
  for(PRInt32 i = 0; i < count; i++)
  {
    nsIIncomingServerListener* listener = m_incomingServerListeners[i];
    listener->OnServerChanged(server);
  }

  return NS_OK;
}

NS_IMETHODIMP
nsMsgAccountManager::FindServerByURI(nsIURI *aURI, PRBool aRealFlag,
                                nsIMsgIncomingServer** aResult)
{
  nsresult rv;

  // Get username and hostname and port so we can get the server
  nsCAutoString username;
  nsCAutoString escapedUsername;
  rv = aURI->GetUserPass(escapedUsername);
  if (NS_SUCCEEDED(rv) && !escapedUsername.IsEmpty())
    MsgUnescapeString(escapedUsername, 0,  username);

  nsCAutoString hostname;
  nsCAutoString escapedHostname;
  rv = aURI->GetHost(escapedHostname);
  if (NS_SUCCEEDED(rv) && !escapedHostname.IsEmpty())
    MsgUnescapeString(escapedHostname, 0, hostname);

  nsCAutoString type;
  rv = aURI->GetScheme(type);
  if (NS_SUCCEEDED(rv) && !type.IsEmpty())
  {
    // now modify type if pop or news
    if (type.EqualsLiteral("pop"))
      type.AssignLiteral("pop3");
    // we use "nntp" in the server list so translate it here.
    else if (type.EqualsLiteral("news"))
      type.AssignLiteral("nntp");
    // we use "any" as the wildcard type.
    else if (type.EqualsLiteral("any"))
      type.Truncate();
  }

  PRInt32 port = 0;
  // check the port of the scheme is not 'none' or blank
  if (!(type.EqualsLiteral("none") || type.IsEmpty()))
  {
    rv = aURI->GetPort(&port);
    // Set the port to zero if we got a -1 (use default)
    if (NS_SUCCEEDED(rv) && (port == -1))
      port = 0;
  }

  return findServerInternal(username, hostname, type, port, aRealFlag, aResult);
}

nsresult
nsMsgAccountManager::findServerInternal(const nsACString& username,
                                        const nsACString& hostname,
                                        const nsACString& type,
                                        PRInt32 port,
                                        PRBool aRealFlag,
                                        nsIMsgIncomingServer** aResult)
{
  // If 'aRealFlag' is set then we want to scan all existing accounts
  // to make sure there's no duplicate including those whose host and/or
  // user names have been changed.
  if (!aRealFlag &&
      (m_lastFindServerUserName.Equals(username)) &&
      (m_lastFindServerHostName.Equals(hostname)) &&
      (m_lastFindServerType.Equals(type)) &&
      (m_lastFindServerPort == port) &&
      m_lastFindServerResult)
  {
    NS_ADDREF(*aResult = m_lastFindServerResult);
    return NS_OK;
  }

  nsCOMPtr<nsISupportsArray> servers;
  nsresult rv = GetAllServers(getter_AddRefs(servers));
  NS_ENSURE_SUCCESS(rv, rv);

  findServerEntry serverInfo(hostname, username, type, port, aRealFlag);
  servers->EnumerateForwards(findServerUrl, (void *)&serverInfo);

  if (!serverInfo.server)
    return NS_ERROR_UNEXPECTED;

  // cache for next time
  if (!aRealFlag)
    SetLastServerFound(serverInfo.server, hostname, username, port, type);

  NS_ADDREF(*aResult = serverInfo.server);
  return NS_OK;
}

NS_IMETHODIMP
nsMsgAccountManager::FindServer(const nsACString& username,
                                const nsACString& hostname,
                                const nsACString& type,
                                nsIMsgIncomingServer** aResult)
{
  return findServerInternal(username, hostname, type, 0, PR_FALSE, aResult);
}

// Interface called by UI js only (always return true).
NS_IMETHODIMP
nsMsgAccountManager::FindRealServer(const nsACString& username,
                                    const nsACString& hostname,
                                    const nsACString& type,
                                    PRInt32 port,
                                    nsIMsgIncomingServer** aResult)
{
  *aResult = nsnull;
  findServerInternal(username, hostname, type, port, PR_TRUE, aResult);
  return NS_OK;
}

PRBool
nsMsgAccountManager::findAccountByServerKey(nsISupports *element,
                                          void *aData)
{
  nsresult rv;
  findAccountByKeyEntry *entry = (findAccountByKeyEntry*)aData;
  nsCOMPtr<nsIMsgAccount> account = do_QueryInterface(element, &rv);
  if (NS_FAILED(rv))
    return PR_TRUE;

  nsCOMPtr<nsIMsgIncomingServer> server;
  rv = account->GetIncomingServer(getter_AddRefs(server));
  if (!server || NS_FAILED(rv))
    return PR_TRUE;

  nsCString key;
  rv = server->GetKey(key);
  if (NS_FAILED(rv))
    return PR_TRUE;

  // if the keys are equal, the servers are equal
  if (key.Equals(entry->key))
  {
    entry->account = account;
    return PR_FALSE; // stop on first found account
  }
  return PR_TRUE;
}

NS_IMETHODIMP
nsMsgAccountManager::FindAccountForServer(nsIMsgIncomingServer *server,
                                            nsIMsgAccount **aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);

  if (!server)
  {
    (*aResult) = nsnull;
    return NS_OK;
  }

  nsresult rv;

  nsCString key;
  rv = server->GetKey(key);
  NS_ENSURE_SUCCESS(rv, rv);

  findAccountByKeyEntry entry;
  entry.key = key;
  entry.account = nsnull;

  m_accounts->EnumerateForwards(findAccountByServerKey, (void *)&entry);

  if (entry.account)
    NS_ADDREF(*aResult = entry.account);
  return NS_OK;
}

// if the aElement matches the given hostname, add it to the given array
PRBool
nsMsgAccountManager::findServerUrl(nsISupports *aElement, void *data)
{
  nsresult rv;

  nsCOMPtr<nsIMsgIncomingServer> server = do_QueryInterface(aElement);
  if (!server)
    return PR_TRUE;

  findServerEntry *entry = (findServerEntry*) data;

  nsCString thisHostname;
  if (entry->useRealSetting)
    rv = server->GetRealHostName(thisHostname);
  else
    rv = server->GetHostName(thisHostname);
  if (NS_FAILED(rv))
    return PR_TRUE;

  nsCString thisUsername;
  if (entry->useRealSetting)
    rv = server->GetRealUsername(thisUsername);
  else
    rv = server->GetUsername(thisUsername);
  if (NS_FAILED(rv))
    return PR_TRUE;

  nsCString thisType;
  rv = server->GetType(thisType);
  if (NS_FAILED(rv))
    return PR_TRUE;

  PRInt32 thisPort = -1; // use the default port identifier
  // Don't try and get a port for the 'none' scheme
  if (!thisType.EqualsLiteral("none"))
  {
    rv = server->GetPort(&thisPort);
    NS_ENSURE_TRUE(NS_SUCCEEDED(rv), PR_TRUE);
  }

  // treat "" as a wild card, so if the caller passed in "" for the desired attribute
  // treat it as a match
  if ((entry->type.IsEmpty() || thisType.Equals(entry->type)) &&
      (entry->hostname.IsEmpty() || thisHostname.Equals(entry->hostname, nsCaseInsensitiveCStringComparator())) &&
      (!(entry->port != 0) || (entry->port == thisPort)) &&
      (entry->username.IsEmpty() || thisUsername.Equals(entry->username)))
  {
    entry->server = server;
    return PR_FALSE; // stop on first find
  }
  return PR_TRUE;
}

NS_IMETHODIMP
nsMsgAccountManager::GetFirstIdentityForServer(nsIMsgIncomingServer *aServer, nsIMsgIdentity **aIdentity)
{
  NS_ENSURE_ARG_POINTER(aServer);
  NS_ENSURE_ARG_POINTER(aIdentity);

  nsCOMPtr<nsISupportsArray> identities;
  nsresult rv = GetIdentitiesForServer(aServer, getter_AddRefs(identities));
  NS_ENSURE_SUCCESS(rv, rv);

  // not all servers have identities
  // for example, Local Folders
  PRUint32 numIdentities;
  rv = identities->Count(&numIdentities);
  NS_ENSURE_SUCCESS(rv, rv);

  if (numIdentities > 0)
  {
    nsCOMPtr<nsIMsgIdentity> identity;
    rv = identities->QueryElementAt(0, NS_GET_IID(nsIMsgIdentity),
                                  (void **)getter_AddRefs(identity));
    NS_ENSURE_SUCCESS(rv, rv);
    identity.swap(*aIdentity);
  }
  else
    *aIdentity = nsnull;
  return rv;
}

NS_IMETHODIMP
nsMsgAccountManager::GetIdentitiesForServer(nsIMsgIncomingServer *server,
                                            nsISupportsArray **_retval)
{
  NS_ENSURE_ARG_POINTER(server);
  NS_ENSURE_ARG_POINTER(_retval);
  nsresult rv;
  rv = LoadAccounts();
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsISupportsArray> identities;
  rv = NS_NewISupportsArray(getter_AddRefs(identities));
  NS_ENSURE_SUCCESS(rv, rv);

  findIdentitiesByServerEntry identityInfo;
  identityInfo.server = server;
  identityInfo.identities = identities;

  m_accounts->EnumerateForwards(findIdentitiesForServer,
                                (void *)&identityInfo);

  // do an addref for the caller.
  identities.swap(*_retval);
  return NS_OK;
}

PRBool
nsMsgAccountManager::findIdentitiesForServer(nsISupports* element, void *aData)
{
  nsresult rv;
  nsCOMPtr<nsIMsgAccount> account = do_QueryInterface(element, &rv);
  if (NS_FAILED(rv))
    return PR_TRUE;

  findIdentitiesByServerEntry *entry = (findIdentitiesByServerEntry*)aData;

  nsCOMPtr<nsIMsgIncomingServer> thisServer;
  rv = account->GetIncomingServer(getter_AddRefs(thisServer));
  if (NS_FAILED(rv))
    return PR_TRUE;

  nsCString serverKey;
//  NS_ASSERTION(thisServer, "thisServer is null");
  NS_ASSERTION(entry, "entry is null");
  NS_ASSERTION(entry->server, "entry->server is null");
  // if this happens, bail.
  if (!thisServer || !entry || !(entry->server))
    return PR_TRUE;

  entry->server->GetKey(serverKey);
  nsCString thisServerKey;
  thisServer->GetKey(thisServerKey);
  if (serverKey.Equals(thisServerKey))
  {
    // add all these elements to the nsISupports array
    nsCOMPtr<nsISupportsArray> theseIdentities;
    rv = account->GetIdentities(getter_AddRefs(theseIdentities));
    if (NS_SUCCEEDED(rv))
      rv = entry->identities->AppendElements(theseIdentities);
  }

  return PR_TRUE;
}

NS_IMETHODIMP
nsMsgAccountManager::GetServersForIdentity(nsIMsgIdentity *identity,
                                           nsISupportsArray **_retval)
{
  nsresult rv;
  rv = LoadAccounts();
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsISupportsArray> servers;
  rv = NS_NewISupportsArray(getter_AddRefs(servers));
  NS_ENSURE_SUCCESS(rv, rv);

  findServersByIdentityEntry serverInfo;
  serverInfo.identity = identity;
  serverInfo.servers = servers;

  m_accounts->EnumerateForwards(findServersForIdentity,
                                (void *)&serverInfo);
  servers.swap(*_retval);
  return NS_OK;
}

PRBool
nsMsgAccountManager::findServersForIdentity(nsISupports *element, void *aData)
{
  nsresult rv;
  nsCOMPtr<nsIMsgAccount> account = do_QueryInterface(element, &rv);
  if (NS_FAILED(rv))
    return PR_TRUE;

  findServersByIdentityEntry *entry = (findServersByIdentityEntry*)aData;

  nsCOMPtr<nsISupportsArray> identities;
  account->GetIdentities(getter_AddRefs(identities));

  PRUint32 idCount=0;
  identities->Count(&idCount);

  PRUint32 id;
  nsCString identityKey;
  rv = entry->identity->GetKey(identityKey);
  for (id = 0; id < idCount; id++)
  {
    nsCOMPtr<nsIMsgIdentity> thisIdentity( do_QueryElementAt(identities, id, &rv));
    if (NS_SUCCEEDED(rv))
    {
      nsCString thisIdentityKey;
      rv = thisIdentity->GetKey(thisIdentityKey);

      if (NS_SUCCEEDED(rv) && identityKey.Equals(thisIdentityKey))
      {
        nsCOMPtr<nsIMsgIncomingServer> thisServer;
        rv = account->GetIncomingServer(getter_AddRefs(thisServer));
        if (thisServer && NS_SUCCEEDED(rv))
        {
          entry->servers->AppendElement(thisServer);
          break;
        }
      }
    }
  }
  return PR_TRUE;
}

static PLDHashOperator
hashAddListener(nsCStringHashKey::KeyType aKey, nsCOMPtr<nsIMsgIncomingServer>& aServer, void* aClosure)
{
  nsIFolderListener* listener = (nsIFolderListener *) aClosure;
  nsresult rv;
  nsCOMPtr<nsIMsgFolder> rootFolder;
  rv = aServer->GetRootFolder(getter_AddRefs(rootFolder));
  NS_ENSURE_SUCCESS(rv, PL_DHASH_NEXT);
  rv = rootFolder->AddFolderListener(listener);
  return PL_DHASH_NEXT;
}

static PLDHashOperator
hashRemoveListener(nsCStringHashKey::KeyType aKey, nsCOMPtr<nsIMsgIncomingServer>& aServer, void* aClosure)
{
  nsIFolderListener* listener = (nsIFolderListener *) aClosure;

  nsresult rv;
  nsCOMPtr<nsIMsgFolder> rootFolder;
  rv = aServer->GetRootFolder(getter_AddRefs(rootFolder));
  NS_ENSURE_SUCCESS(rv, PL_DHASH_NEXT);

  rv = rootFolder->RemoveFolderListener(listener);
  return PL_DHASH_NEXT;
}

NS_IMETHODIMP
nsMsgAccountManager::AddRootFolderListener(nsIFolderListener *aListener)
{
  NS_ENSURE_TRUE(aListener, NS_OK);
  mFolderListeners->AppendElement(aListener);
  m_incomingServers.Enumerate(hashAddListener, (void *)aListener);
  return NS_OK;
}

NS_IMETHODIMP
nsMsgAccountManager::RemoveRootFolderListener(nsIFolderListener *aListener)
{
  NS_ENSURE_TRUE(aListener, NS_OK);
  mFolderListeners->RemoveElement(aListener);
  m_incomingServers.Enumerate(hashRemoveListener, (void *)aListener);
  return NS_OK;
}

NS_IMETHODIMP nsMsgAccountManager::SetLocalFoldersServer(nsIMsgIncomingServer *aServer)
{
  NS_ENSURE_ARG_POINTER(aServer);
  nsresult rv;
  nsCString key;
  rv = aServer->GetKey(key);
  NS_ENSURE_SUCCESS(rv, rv);

  return m_prefs->SetCharPref(PREF_MAIL_ACCOUNTMANAGER_LOCALFOLDERSSERVER, key.get());
}

NS_IMETHODIMP nsMsgAccountManager::GetLocalFoldersServer(nsIMsgIncomingServer **aServer)
{
  NS_ENSURE_ARG_POINTER(aServer);
  nsresult rv;
  nsCString serverKey;

  if (!m_prefs)
    getPrefService();
  rv = m_prefs->GetCharPref(PREF_MAIL_ACCOUNTMANAGER_LOCALFOLDERSSERVER, getter_Copies(serverKey));

  if (NS_SUCCEEDED(rv) && !serverKey.IsEmpty())
  {
    rv = GetIncomingServer(serverKey, aServer);
    if (NS_SUCCEEDED(rv))
      return rv;
    // otherwise, we're going to fall through to looking for an existing local
    // folders account, because now we fail creating one if one already exists.
  }

  // try ("nobody","Local Folders","none"), and work down to any "none" server.
  rv = FindServer(NS_LITERAL_CSTRING("nobody"), NS_LITERAL_CSTRING("Local Folders"),
                  NS_LITERAL_CSTRING("none"), aServer);
  if (NS_FAILED(rv) || !*aServer)
  {
      rv = FindServer(NS_LITERAL_CSTRING("nobody"), EmptyCString(), NS_LITERAL_CSTRING("none"), aServer);
      if (NS_FAILED(rv) || !*aServer)
      {
          rv = FindServer(EmptyCString(), NS_LITERAL_CSTRING("Local Folders"), 
                          NS_LITERAL_CSTRING("none"), aServer);
          if (NS_FAILED(rv) || !*aServer)
              rv = FindServer(EmptyCString(), EmptyCString(), NS_LITERAL_CSTRING("none"), aServer);
      }
  }

  NS_ENSURE_SUCCESS(rv, rv);
  if (!*aServer)
    return NS_ERROR_FAILURE;

  rv = SetLocalFoldersServer(*aServer);
  return rv;
}

nsresult nsMsgAccountManager::GetLocalFoldersPrettyName(nsString &localFoldersName)
{
  // we don't want "nobody at Local Folders" to show up in the
  // folder pane, so we set the pretty name to a localized "Local Folders"
  nsCOMPtr<nsIStringBundle> bundle;
  nsresult rv;
  nsCOMPtr<nsIStringBundleService> sBundleService =
    do_GetService(NS_STRINGBUNDLE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  if (sBundleService)
    rv = sBundleService->CreateBundle("chrome://messenger/locale/messenger.properties",
                                      getter_AddRefs(bundle));
  NS_ENSURE_SUCCESS(rv, rv);

  return bundle->GetStringFromName(NS_LITERAL_STRING("localFolders").get(), getter_Copies(localFoldersName));
}

NS_IMETHODIMP
nsMsgAccountManager::CreateLocalMailAccount()
{
  // create the server
  nsCOMPtr<nsIMsgIncomingServer> server;
  nsresult rv = CreateIncomingServer(NS_LITERAL_CSTRING("nobody"),
                            NS_LITERAL_CSTRING("Local Folders"),
                            NS_LITERAL_CSTRING("none"), getter_AddRefs(server));
  NS_ENSURE_SUCCESS(rv,rv);
  
  nsString localFoldersName;
  rv = GetLocalFoldersPrettyName(localFoldersName);
  NS_ENSURE_SUCCESS(rv, rv);
  server->SetPrettyName(localFoldersName);
  
  nsCOMPtr<nsINoIncomingServer> noServer;
  noServer = do_QueryInterface(server, &rv);
  if (NS_FAILED(rv)) return rv;
  
  // create the directory structure for old 4.x "Local Mail"
  // under <profile dir>/Mail/Local Folders or
  // <"mail.directory" pref>/Local Folders
  nsCOMPtr <nsIFile> mailDir;
  nsCOMPtr <nsILocalFile> localFile;
  PRBool dirExists;
    
  // we want <profile>/Mail
  rv = NS_GetSpecialDirectory(NS_APP_MAIL_50_DIR, getter_AddRefs(mailDir));
  if (NS_FAILED(rv)) return rv;
  localFile = do_QueryInterface(mailDir);
  
  rv = mailDir->Exists(&dirExists);
  if (NS_SUCCEEDED(rv) && !dirExists)
    rv = mailDir->Create(nsIFile::DIRECTORY_TYPE, 0775);
  if (NS_FAILED(rv)) return rv;
  
  // set the default local path for "none"
  rv = server->SetDefaultLocalPath(localFile);
  if (NS_FAILED(rv)) return rv;
  
  // Create an account when valid server values are established.
  // This will keep the status of accounts sane by avoiding the addition of incomplete accounts.
  nsCOMPtr<nsIMsgAccount> account;
  rv = CreateAccount(getter_AddRefs(account));
  if (NS_FAILED(rv)) return rv;
  
  // notice, no identity for local mail
  // hook the server to the account
  // after we set the server's local path
  // (see bug #66018)
  account->SetIncomingServer(server);
  
  // remember this as the local folders server
  return SetLocalFoldersServer(server);  
}

  // nsIUrlListener methods

NS_IMETHODIMP
nsMsgAccountManager::OnStartRunningUrl(nsIURI * aUrl)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMsgAccountManager::OnStopRunningUrl(nsIURI * aUrl, nsresult aExitCode)
{
  if (aUrl)
  {
    nsCOMPtr<nsIImapUrl> imapUrl = do_QueryInterface(aUrl);
    if (imapUrl)
    {
      nsImapAction imapAction = nsIImapUrl::nsImapTest;
      imapUrl->GetImapAction(&imapAction);
      switch(imapAction)
      {
        case nsIImapUrl::nsImapExpungeFolder:
          if (m_folderDoingCleanupInbox)
          {
            PR_CEnterMonitor(m_folderDoingCleanupInbox);
            PR_CNotifyAll(m_folderDoingCleanupInbox);
            m_cleanupInboxInProgress = PR_FALSE;
            PR_CExitMonitor(m_folderDoingCleanupInbox);
            m_folderDoingCleanupInbox=nsnull;   //reset to nsnull
          }
          break;
        case nsIImapUrl::nsImapDeleteAllMsgs:
          if (m_folderDoingEmptyTrash)
          {
            PR_CEnterMonitor(m_folderDoingEmptyTrash);
            PR_CNotifyAll(m_folderDoingEmptyTrash);
            m_emptyTrashInProgress = PR_FALSE;
            PR_CExitMonitor(m_folderDoingEmptyTrash);
            m_folderDoingEmptyTrash = nsnull;  //reset to nsnull;
          }
          break;
        default:
          break;
       }
     }
   }
   return NS_OK;
}

NS_IMETHODIMP
nsMsgAccountManager::SetFolderDoingEmptyTrash(nsIMsgFolder *folder)
{
  m_folderDoingEmptyTrash = folder;
  m_emptyTrashInProgress = PR_TRUE;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgAccountManager::GetEmptyTrashInProgress(PRBool *bVal)
{
  NS_ENSURE_ARG_POINTER(bVal);
  *bVal = m_emptyTrashInProgress;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgAccountManager::SetFolderDoingCleanupInbox(nsIMsgFolder *folder)
{
  m_folderDoingCleanupInbox = folder;
  m_cleanupInboxInProgress = PR_TRUE;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgAccountManager::GetCleanupInboxInProgress(PRBool *bVal)
{
  NS_ENSURE_ARG_POINTER(bVal);
  *bVal = m_cleanupInboxInProgress;
  return NS_OK;
}

void
nsMsgAccountManager::SetLastServerFound(nsIMsgIncomingServer *server, const nsACString& hostname, 
                                        const nsACString& username, const PRInt32 port, const nsACString& type)
{
  m_lastFindServerResult = server;
  m_lastFindServerHostName = hostname;
  m_lastFindServerUserName = username;
  m_lastFindServerPort = port;
  m_lastFindServerType = type;
}

NS_IMETHODIMP
nsMsgAccountManager::SaveAccountInfo()
{
  nsresult rv;
  nsCOMPtr<nsIPrefService> pref(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv,rv);
  return pref->SavePrefFile(nsnull);
}

NS_IMETHODIMP
nsMsgAccountManager::GetChromePackageName(const nsACString& aExtensionName, nsACString& aChromePackageName)
{
  nsresult rv;
  nsCOMPtr<nsICategoryManager> catman = do_GetService(NS_CATEGORYMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr<nsISimpleEnumerator> e;
  rv = catman->EnumerateCategory(MAILNEWS_ACCOUNTMANAGER_EXTENSIONS, getter_AddRefs(e));
  if(NS_SUCCEEDED(rv) && e) {
    while (PR_TRUE) {
      nsCOMPtr<nsISupportsCString> catEntry;
      rv = e->GetNext(getter_AddRefs(catEntry));
      if (NS_FAILED(rv) || !catEntry)
        break;

      nsCAutoString entryString;
      rv = catEntry->GetData(entryString);
      if (NS_FAILED(rv))
         break;

      nsCString contractidString;
      rv = catman->GetCategoryEntry(MAILNEWS_ACCOUNTMANAGER_EXTENSIONS, entryString.get(), 
                                    getter_Copies(contractidString));
      if (NS_FAILED(rv))
        break;

      nsCOMPtr <nsIMsgAccountManagerExtension> extension = do_GetService(contractidString.get(), &rv);
      if (NS_FAILED(rv) || !extension)
        break;

      nsCString name;
      rv = extension->GetName(name);
      if (NS_FAILED(rv))
        break;

      if (name.Equals(aExtensionName))
        return extension->GetChromePackageName(aChromePackageName);
    }
  }
  return NS_ERROR_UNEXPECTED;
}

class VirtualFolderChangeListener : public nsIDBChangeListener
{
public:
  VirtualFolderChangeListener();
  ~VirtualFolderChangeListener() {}

  NS_DECL_ISUPPORTS
  NS_DECL_NSIDBCHANGELISTENER

  nsresult Init();

  nsCOMPtr <nsIMsgFolder> m_virtualFolder; // folder we're listening to db changes on behalf of.
  nsCOMPtr <nsIMsgFolder> m_folderWatching; // folder whose db we're listening to.
  nsCOMPtr <nsISupportsArray> m_searchTerms;
  nsCOMPtr <nsIMsgSearchSession> m_searchSession;
  PRBool m_searchOnMsgStatus;
};

NS_IMPL_ISUPPORTS1(VirtualFolderChangeListener, nsIDBChangeListener)

VirtualFolderChangeListener::VirtualFolderChangeListener() : m_searchOnMsgStatus(PR_FALSE)
{}

nsresult VirtualFolderChangeListener::Init()
{
  nsCOMPtr <nsIMsgDatabase> msgDB;
  nsCOMPtr <nsIDBFolderInfo> dbFolderInfo;

  nsresult rv = m_virtualFolder->GetDBFolderInfoAndDB(getter_AddRefs(dbFolderInfo), getter_AddRefs(msgDB));
  if (NS_SUCCEEDED(rv) && msgDB)
  {
    nsCString searchTermString;
    dbFolderInfo->GetCharProperty("searchStr", searchTermString);
    nsCOMPtr<nsIMsgFilterService> filterService = do_GetService(NS_MSGFILTERSERVICE_CONTRACTID, &rv);
    nsCOMPtr<nsIMsgFilterList> filterList;
    rv = filterService->GetTempFilterList(m_virtualFolder, getter_AddRefs(filterList));
    NS_ENSURE_SUCCESS(rv, rv);
    nsCOMPtr <nsIMsgFilter> tempFilter;
    filterList->CreateFilter(NS_LITERAL_STRING("temp"), getter_AddRefs(tempFilter));
    NS_ENSURE_SUCCESS(rv, rv);
    filterList->ParseCondition(tempFilter, searchTermString.get());
    NS_ENSURE_SUCCESS(rv, rv);
    m_searchSession = do_CreateInstance(NS_MSGSEARCHSESSION_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsISupportsArray> searchTerms;
    rv = tempFilter->GetSearchTerms(getter_AddRefs(searchTerms));
    NS_ENSURE_SUCCESS(rv, rv);

    // we add the search scope right before we match the header,
    // because we don't want the search scope caching the body input
    // stream, because that holds onto the mailbox file, breaking
    // compaction.

    // add each item in termsArray to the search session
    PRUint32 numTerms;
    searchTerms->Count(&numTerms);
    for (PRUint32 i = 0; i < numTerms; i++)
    {
      nsCOMPtr <nsIMsgSearchTerm> searchTerm (do_QueryElementAt(searchTerms, i));
      nsMsgSearchAttribValue attrib;
      searchTerm->GetAttrib(&attrib);
      if (attrib == nsMsgSearchAttrib::MsgStatus)
        m_searchOnMsgStatus = true;
      m_searchSession->AppendTerm(searchTerm);
    }
  }
  return rv;
}

  /**
   * nsIDBChangeListener
   */

NS_IMETHODIMP
VirtualFolderChangeListener::OnHdrPropertyChanged(nsIMsgDBHdr *aHdrChanged, PRBool aPreChange, PRUint32 *aStatus, 
                                                 nsIDBChangeListener *aInstigator)
{
  const PRUint32 kMatch = 0x1;
  const PRUint32 kRead = 0x2;
  const PRUint32 kNew = 0x4;
  NS_ENSURE_ARG_POINTER(aHdrChanged);
  NS_ENSURE_ARG_POINTER(aStatus);

  PRUint32 flags;
  PRBool match;
  nsCOMPtr<nsIMsgDatabase> msgDB;
  nsresult rv = m_folderWatching->GetMsgDatabase(getter_AddRefs(msgDB));
  NS_ENSURE_SUCCESS(rv, rv);
  // we don't want any early returns from this function, until we've
  // called ClearScopes on the search session.
  m_searchSession->AddScopeTerm(nsMsgSearchScope::offlineMail, m_folderWatching);
  rv = m_searchSession->MatchHdr(aHdrChanged, msgDB, &match);
  m_searchSession->ClearScopes();
  NS_ENSURE_SUCCESS(rv, rv);
  aHdrChanged->GetFlags(&flags);
  
  if (aPreChange) // We're looking at the old header, save status
  {
    *aStatus = 0;
    if (match)
      *aStatus |= kMatch;
    if (flags & nsMsgMessageFlags::Read)
      *aStatus |= kRead;
    if (flags & nsMsgMessageFlags::New)
      *aStatus |= kNew;
    return NS_OK;
  }
  
  // This is the post change section where changes are detected

  PRBool wasMatch = *aStatus & kMatch;
  if (!match && !wasMatch) // header not in virtual folder
    return NS_OK;

  PRInt32 totalDelta = 0, unreadDelta = 0, newDelta = 0;

  if (match) {
    totalDelta++;
    if (!(flags & nsMsgMessageFlags::Read))
      unreadDelta++;
    if (flags & nsMsgMessageFlags::New)
      newDelta++;
  }

  if (wasMatch) {
    totalDelta--;
    if (!(*aStatus & kRead)) unreadDelta--;
    if (*aStatus & kNew) newDelta--;
  }

  if ( !(unreadDelta || totalDelta || newDelta) )
    return NS_OK;

  nsCOMPtr<nsIMsgDatabase> virtDatabase;
  nsCOMPtr<nsIDBFolderInfo> dbFolderInfo;
  rv = m_virtualFolder->GetDBFolderInfoAndDB(getter_AddRefs(dbFolderInfo),
                        getter_AddRefs(virtDatabase));
  NS_ENSURE_SUCCESS(rv, rv);

  if (unreadDelta)
    dbFolderInfo->ChangeNumUnreadMessages(unreadDelta);

  if (newDelta)
  {
    PRInt32 numNewMessages;
    m_virtualFolder->GetNumNewMessages(PR_FALSE, &numNewMessages);
    m_virtualFolder->SetNumNewMessages(numNewMessages + newDelta);
    m_virtualFolder->SetHasNewMessages(numNewMessages + newDelta > 0);
  }

  if (totalDelta)
  {
    dbFolderInfo->ChangeNumMessages(totalDelta);
    nsCString searchUri;
    m_virtualFolder->GetURI(searchUri);
    msgDB->UpdateHdrInCache(searchUri.get(), aHdrChanged, totalDelta == 1);
  }

  m_virtualFolder->UpdateSummaryTotals(PR_TRUE); // force update from db.
  virtDatabase->Commit(nsMsgDBCommitType::kLargeCommit);

  return NS_OK;
}

NS_IMETHODIMP VirtualFolderChangeListener::OnHdrFlagsChanged(nsIMsgDBHdr *aHdrChanged, PRUint32 aOldFlags, PRUint32 aNewFlags, nsIDBChangeListener *aInstigator)
{
  nsCOMPtr <nsIMsgDatabase> msgDB;

  nsresult rv = m_folderWatching->GetMsgDatabase(getter_AddRefs(msgDB));
  PRBool oldMatch = PR_FALSE, newMatch = PR_FALSE;
  // we don't want any early returns from this function, until we've
  // called ClearScopes 0n the search session.
  m_searchSession->AddScopeTerm(nsMsgSearchScope::offlineMail, m_folderWatching);
  rv = m_searchSession->MatchHdr(aHdrChanged, msgDB, &newMatch);
  if (NS_SUCCEEDED(rv) && m_searchOnMsgStatus)
  {
    // if status is a search criteria, check if the header matched before
    // it changed, in order to determine if we need to bump the counts.
    aHdrChanged->SetFlags(aOldFlags);
    rv = m_searchSession->MatchHdr(aHdrChanged, msgDB, &oldMatch);
    aHdrChanged->SetFlags(aNewFlags); // restore new flags even on match failure.
  }
  else
    oldMatch = newMatch;
  m_searchSession->ClearScopes();
  NS_ENSURE_SUCCESS(rv, rv);
  // we don't want to change the total counts if this virtual folder is open in a view,
  // because we won't remove the header from view while it's open. On the other hand,
  // it's hard to fix the count when the user clicks away to another folder, w/o re-running
  // the search, or setting some sort of pending count change.
  // Maybe this needs to be handled in the view code...the view could do the same calculation
  // and also keep track of the counts changed. Then, when the view was closed, if it's a virtual
  // folder, it could update the counts for the db.
  if (oldMatch != newMatch || (oldMatch && (aOldFlags & nsMsgMessageFlags::Read) != (aNewFlags & nsMsgMessageFlags::Read)))
  {
    nsCOMPtr <nsIMsgDatabase> virtDatabase;
    nsCOMPtr <nsIDBFolderInfo> dbFolderInfo;

    rv = m_virtualFolder->GetDBFolderInfoAndDB(getter_AddRefs(dbFolderInfo), getter_AddRefs(virtDatabase));
    NS_ENSURE_SUCCESS(rv, rv);
    PRInt32 totalDelta = 0,  unreadDelta = 0;
    if (oldMatch != newMatch)
    {
 //     PRBool isOpen = PR_FALSE;
//      nsCOMPtr <nsIMsgMailSession> mailSession = do_GetService(NS_MSGMAILSESSION_CONTRACTID);
//      if (mailSession && aFolder)
//        mailSession->IsFolderOpenInWindow(m_virtualFolder, &isOpen);
      // we can't remove headers that no longer match - but we might add headers that newly match, someday.
//      if (!isOpen)
        totalDelta = (oldMatch) ? -1 : 1;
    }
    PRBool msgHdrIsRead;
    aHdrChanged->GetIsRead(&msgHdrIsRead);
    if (oldMatch == newMatch) // read flag changed state
      unreadDelta = (msgHdrIsRead) ? -1 : 1;
    else if (oldMatch) // else header should removed
      unreadDelta = (aOldFlags & nsMsgMessageFlags::Read) ? 0 : -1;
    else               // header should be added
      unreadDelta = (aNewFlags & nsMsgMessageFlags::Read) ? 0 : 1;
    if (unreadDelta)
      dbFolderInfo->ChangeNumUnreadMessages(unreadDelta);
    if (totalDelta)
      dbFolderInfo->ChangeNumMessages(totalDelta);
    if (unreadDelta == -1 && aOldFlags & nsMsgMessageFlags::New)
    {
      PRInt32 numNewMessages;
      m_virtualFolder->GetNumNewMessages(PR_FALSE, &numNewMessages);
      m_virtualFolder->SetNumNewMessages(numNewMessages - 1);
      if (numNewMessages == 1)
        m_virtualFolder->SetHasNewMessages(PR_FALSE);
    }
    if (totalDelta)
    {
      nsCString searchUri;
      m_virtualFolder->GetURI(searchUri);
      msgDB->UpdateHdrInCache(searchUri.get(), aHdrChanged, totalDelta == 1);
    }

    m_virtualFolder->UpdateSummaryTotals(PR_TRUE); // force update from db.
    virtDatabase->Commit(nsMsgDBCommitType::kLargeCommit);
  }
  return rv;
}

NS_IMETHODIMP VirtualFolderChangeListener::OnHdrDeleted(nsIMsgDBHdr *aHdrDeleted, nsMsgKey aParentKey, PRInt32 aFlags, nsIDBChangeListener *aInstigator)
{
  nsCOMPtr <nsIMsgDatabase> msgDB;

  nsresult rv = m_folderWatching->GetMsgDatabase(getter_AddRefs(msgDB));
  NS_ENSURE_SUCCESS(rv, rv);
  PRBool match = PR_FALSE;
  m_searchSession->AddScopeTerm(nsMsgSearchScope::offlineMail, m_folderWatching);
  rv = m_searchSession->MatchHdr(aHdrDeleted, msgDB, &match);
  m_searchSession->ClearScopes();
  if (match)
  {
    nsCOMPtr <nsIMsgDatabase> virtDatabase;
    nsCOMPtr <nsIDBFolderInfo> dbFolderInfo;

    rv = m_virtualFolder->GetDBFolderInfoAndDB(getter_AddRefs(dbFolderInfo), getter_AddRefs(virtDatabase));
    NS_ENSURE_SUCCESS(rv, rv);
    PRBool msgHdrIsRead;
    aHdrDeleted->GetIsRead(&msgHdrIsRead);
    if (!msgHdrIsRead)
      dbFolderInfo->ChangeNumUnreadMessages(-1);
    dbFolderInfo->ChangeNumMessages(-1);
    if (aFlags & nsMsgMessageFlags::New)
    {
      PRInt32 numNewMessages;
      m_virtualFolder->GetNumNewMessages(PR_FALSE, &numNewMessages);
      m_virtualFolder->SetNumNewMessages(numNewMessages - 1);
      if (numNewMessages == 1)
        m_virtualFolder->SetHasNewMessages(PR_FALSE);
    }
    
    nsCString searchUri;
    m_virtualFolder->GetURI(searchUri);
    msgDB->UpdateHdrInCache(searchUri.get(), aHdrDeleted, PR_FALSE);

    m_virtualFolder->UpdateSummaryTotals(PR_TRUE); // force update from db.
    virtDatabase->Commit(nsMsgDBCommitType::kLargeCommit);
  }
  return rv;
}

NS_IMETHODIMP VirtualFolderChangeListener::OnHdrAdded(nsIMsgDBHdr *aNewHdr, nsMsgKey aParentKey, PRInt32 aFlags, nsIDBChangeListener *aInstigator)
{
  nsCOMPtr <nsIMsgDatabase> msgDB;

  nsresult rv = m_folderWatching->GetMsgDatabase(getter_AddRefs(msgDB));
  NS_ENSURE_SUCCESS(rv, rv);
  PRBool match = PR_FALSE;
  m_searchSession->AddScopeTerm(nsMsgSearchScope::offlineMail, m_folderWatching);
  rv = m_searchSession->MatchHdr(aNewHdr, msgDB, &match);
  m_searchSession->ClearScopes();
  if (match)
  {
    nsCOMPtr <nsIMsgDatabase> virtDatabase;
    nsCOMPtr <nsIDBFolderInfo> dbFolderInfo;

    rv = m_virtualFolder->GetDBFolderInfoAndDB(getter_AddRefs(dbFolderInfo), getter_AddRefs(virtDatabase));
    NS_ENSURE_SUCCESS(rv, rv);
    PRBool msgHdrIsRead;
    PRUint32 msgFlags;
    aNewHdr->GetIsRead(&msgHdrIsRead);
    aNewHdr->GetFlags(&msgFlags);
    if (!msgHdrIsRead)
      dbFolderInfo->ChangeNumUnreadMessages(1);
    if (msgFlags & nsMsgMessageFlags::New)
    {
      PRInt32 numNewMessages;
      m_virtualFolder->GetNumNewMessages(PR_FALSE, &numNewMessages);
      m_virtualFolder->SetHasNewMessages(PR_TRUE);
      m_virtualFolder->SetNumNewMessages(numNewMessages + 1);
    }
    nsCString searchUri;
    m_virtualFolder->GetURI(searchUri);
    msgDB->UpdateHdrInCache(searchUri.get(), aNewHdr, PR_TRUE);
    dbFolderInfo->ChangeNumMessages(1);
    m_virtualFolder->UpdateSummaryTotals(true); // force update from db.
    virtDatabase->Commit(nsMsgDBCommitType::kLargeCommit);
  }
  return rv;
}

NS_IMETHODIMP VirtualFolderChangeListener::OnParentChanged(nsMsgKey aKeyChanged, nsMsgKey oldParent, nsMsgKey newParent, nsIDBChangeListener *aInstigator)
{
  return NS_OK;
}

NS_IMETHODIMP VirtualFolderChangeListener::OnAnnouncerGoingAway(nsIDBChangeAnnouncer *instigator)
{
  nsCOMPtr <nsIMsgDatabase> msgDB = do_QueryInterface(instigator);
  if (msgDB)
    msgDB->RemoveListener(this);
  return NS_OK;
}

NS_IMETHODIMP VirtualFolderChangeListener::OnReadChanged(nsIDBChangeListener *aInstigator)
{
  return NS_OK;
}

NS_IMETHODIMP VirtualFolderChangeListener::OnJunkScoreChanged(nsIDBChangeListener *aInstigator)
{
  return NS_OK;
}

nsresult nsMsgAccountManager::GetVirtualFoldersFile(nsCOMPtr<nsILocalFile>& file)
{
  nsCOMPtr<nsIFile> profileDir;
  nsresult rv = NS_GetSpecialDirectory(NS_APP_USER_PROFILE_50_DIR, getter_AddRefs(profileDir));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = profileDir->AppendNative(nsDependentCString("virtualFolders.dat"));
  if (NS_SUCCEEDED(rv))
    file = do_QueryInterface(profileDir, &rv);
  return rv;
}

NS_IMETHODIMP nsMsgAccountManager::LoadVirtualFolders()
{
  nsCOMPtr <nsILocalFile> file;
  GetVirtualFoldersFile(file);
  if (!file)
    return NS_ERROR_FAILURE;

  m_loadingVirtualFolders = PR_TRUE;

  nsresult rv;
  nsCOMPtr<nsIMsgDBService> msgDBService = do_GetService(NS_MSGDB_SERVICE_CONTRACTID, &rv);
  if (msgDBService)
  {
     NS_ENSURE_SUCCESS(rv, rv);
     nsCOMPtr<nsIFileInputStream> fileStream = do_CreateInstance(NS_LOCALFILEINPUTSTREAM_CONTRACTID, &rv);
     NS_ENSURE_SUCCESS(rv, rv);

     rv = fileStream->Init(file,  PR_RDONLY, 0664, PR_FALSE);
     nsCOMPtr <nsILineInputStream> lineInputStream(do_QueryInterface(fileStream));

    PRBool isMore = PR_TRUE;
    nsCAutoString buffer;
    PRInt32 version = -1;
    nsCOMPtr <nsIMsgFolder> virtualFolder;
    nsCOMPtr <nsIDBFolderInfo> dbFolderInfo;
    nsCOMPtr<nsIRDFResource> resource;
    nsCOMPtr<nsIRDFService> rdf(do_GetService("@mozilla.org/rdf/rdf-service;1", &rv));
    NS_ENSURE_SUCCESS(rv, rv);

    while (isMore &&
           NS_SUCCEEDED(lineInputStream->ReadLine(buffer, &isMore)))
    {
      if (buffer.Length() > 0)
      {
        if (version == -1)
        {
          buffer.Cut(0, 8);
          PRInt32 irv;
          version = buffer.ToInteger(&irv);
          continue;
        }
        if (Substring(buffer, 0, 4).Equals("uri="))
        {
          buffer.Cut(0, 4);

          rv = rdf->GetResource(buffer, getter_AddRefs(resource));
          NS_ENSURE_SUCCESS(rv, rv);

          virtualFolder = do_QueryInterface(resource, &rv);
          NS_ENSURE_SUCCESS(rv, rv);
          if (virtualFolder)
          {
            nsCOMPtr <nsIMsgFolder> grandParent;
            nsCOMPtr <nsIMsgFolder> oldParent;
            nsCOMPtr <nsIMsgFolder> parentFolder;
            PRBool isServer;
            do
            {
              // need to add the folder as a sub-folder of its parent.
              PRInt32 lastSlash = buffer.RFindChar('/');
              if (lastSlash == kNotFound)
                break;
              nsDependentCSubstring parentUri(buffer, 0, lastSlash);
              // hold a reference so it won't get deleted before it's parented.
              oldParent = parentFolder;

              rdf->GetResource(parentUri, getter_AddRefs(resource));
              parentFolder = do_QueryInterface(resource);
              if (parentFolder)
              {
                nsAutoString currentFolderNameStr;
                nsCAutoString currentFolderNameCStr;
                MsgUnescapeString(nsCString(Substring(buffer, lastSlash + 1, buffer.Length())), 0, currentFolderNameCStr);
                CopyUTF8toUTF16(currentFolderNameCStr, currentFolderNameStr);
                nsCOMPtr <nsIMsgFolder> childFolder;
                nsCOMPtr <nsIMsgDatabase> db;
                // force db to get created.
                virtualFolder->GetMsgDatabase(getter_AddRefs(db));
                if (db)
                  rv = db->GetDBFolderInfo(getter_AddRefs(dbFolderInfo));
                else
                  break;

                parentFolder->AddSubfolder(currentFolderNameStr, getter_AddRefs(childFolder));
                virtualFolder->SetFlag(nsMsgFolderFlags::Virtual);
                if (childFolder)
                  parentFolder->NotifyItemAdded(childFolder);
                // here we make sure if our parent is rooted - if not, we're
                // going to loop and add our parent as a child of its grandparent
                // and repeat until we get to the server, or a folder that
                // has its parent set.
                parentFolder->GetParent(getter_AddRefs(grandParent));
                parentFolder->GetIsServer(&isServer);
                buffer.SetLength(lastSlash);
              }
              else
                break;
            } while (!grandParent && !isServer);
          }
        }
        else if (dbFolderInfo && Substring(buffer, 0, 6).Equals("scope="))
        {
          buffer.Cut(0, 6);
          // if this is a cross folder virtual folder, we have a list of folders uris,
          // and we have to add a pending listener for each of them.
          if (buffer.Length())
          {
            dbFolderInfo->SetCharProperty("searchFolderUri", buffer);
            AddVFListenersForVF(virtualFolder, buffer, rdf, msgDBService);
          }
          else // this folder is useless
          {
          }
        }
        else if (dbFolderInfo && Substring(buffer, 0, 6).Equals("terms="))
        {
          buffer.Cut(0, 6);
          dbFolderInfo->SetCharProperty("searchStr", buffer);
        }
        else if (dbFolderInfo && Substring(buffer, 0, 13).Equals("searchOnline="))
        {
          buffer.Cut(0, 13);
          dbFolderInfo->SetBooleanProperty("searchOnline", buffer.Equals("true"));
        }
      }
    }
  }

  m_loadingVirtualFolders = PR_FALSE;
  m_virtualFoldersLoaded = PR_TRUE;
  return rv;
}

NS_IMETHODIMP nsMsgAccountManager::SaveVirtualFolders()
{
  if (!m_virtualFoldersLoaded)
    return NS_OK;
  nsCOMPtr<nsISupportsArray> allServers;
  nsresult rv = GetAllServers(getter_AddRefs(allServers));
  nsCOMPtr <nsILocalFile> file;
  if (allServers)
  {
    PRUint32 count = 0;
    allServers->Count(&count);
    PRUint32 i;
    nsCOMPtr <nsIOutputStream> outputStream;
    for (i = 0; i < count; i++)
    {
      nsCOMPtr<nsIMsgIncomingServer> server = do_QueryElementAt(allServers, i);
      if (server)
      {
        nsCOMPtr <nsIMsgFolder> rootFolder;
        server->GetRootFolder(getter_AddRefs(rootFolder));
        if (rootFolder)
        {
          nsCOMPtr <nsIArray> virtualFolders;
          rv = rootFolder->GetFoldersWithFlags(nsMsgFolderFlags::Virtual,
                                               getter_AddRefs(virtualFolders));
          NS_ENSURE_SUCCESS(rv, rv);
          PRUint32 vfCount;
          virtualFolders->GetLength(&vfCount);
          if (!outputStream)
          {
            GetVirtualFoldersFile(file);
            rv = NS_NewLocalFileOutputStream(getter_AddRefs(outputStream),
                                             file,
                                             PR_CREATE_FILE | PR_WRONLY | PR_TRUNCATE,
                                             0664);
            NS_ENSURE_SUCCESS(rv, rv);
            WriteLineToOutputStream("version=", "1", outputStream);

          }
          for (PRUint32 folderIndex = 0; folderIndex < vfCount; folderIndex++)
          {
            nsCOMPtr <nsIRDFResource> folderRes (do_QueryElementAt(virtualFolders, folderIndex));
            nsCOMPtr <nsIMsgFolder> msgFolder = do_QueryInterface(folderRes);
            const char *uri;
            nsCOMPtr <nsIMsgDatabase> db;
            nsCOMPtr <nsIDBFolderInfo> dbFolderInfo;
            rv = msgFolder->GetDBFolderInfoAndDB(getter_AddRefs(dbFolderInfo), getter_AddRefs(db)); // force db to get created.
            if (dbFolderInfo)
            {
              nsCString srchFolderUri;
              nsCString searchTerms;
              PRBool searchOnline = PR_FALSE;
              dbFolderInfo->GetBooleanProperty("searchOnline", PR_FALSE, &searchOnline);
              dbFolderInfo->GetCharProperty("searchFolderUri", srchFolderUri);
              dbFolderInfo->GetCharProperty("searchStr", searchTerms);
              folderRes->GetValueConst(&uri);
              if (!srchFolderUri.IsEmpty() && !searchTerms.IsEmpty())
              {
                WriteLineToOutputStream("uri=", uri, outputStream);
                WriteLineToOutputStream("scope=", srchFolderUri.get(), outputStream);
                WriteLineToOutputStream("terms=", searchTerms.get(), outputStream);
                WriteLineToOutputStream("searchOnline=", searchOnline ? "true" : "false", outputStream);
              }
            }
          }
        }
      }
   }
   if (outputStream)
    outputStream->Close();
  }
  return rv;
}

nsresult nsMsgAccountManager::WriteLineToOutputStream(const char *prefix, const char * line, nsIOutputStream *outputStream)
{
  PRUint32 writeCount;
  outputStream->Write(prefix, strlen(prefix), &writeCount);
  outputStream->Write(line, strlen(line), &writeCount);
  outputStream->Write("\n", 1, &writeCount);
  return NS_OK;
}

nsresult nsMsgAccountManager::AddVFListenersForVF(nsIMsgFolder *virtualFolder,
                                                  const nsCString& srchFolderUris,
                                                  nsIRDFService *rdf,
                                                  nsIMsgDBService *msgDBService)
{
  nsCStringArray folderUris;
  ParseString(srchFolderUris, '|', folderUris);
  nsCOMPtr <nsIRDFResource> resource;

  for (PRInt32 i = 0; i < folderUris.Count(); i++)
  {
    rdf->GetResource(*(folderUris[i]), getter_AddRefs(resource));
    nsCOMPtr <nsIMsgFolder> realFolder = do_QueryInterface(resource);
    VirtualFolderChangeListener *dbListener = new VirtualFolderChangeListener();
    NS_ENSURE_TRUE(dbListener, NS_ERROR_OUT_OF_MEMORY);
    m_virtualFolderListeners.AppendObject(dbListener);
    dbListener->m_virtualFolder = virtualFolder;
    dbListener->m_folderWatching = realFolder;
    dbListener->Init();
    msgDBService->RegisterPendingListener(realFolder, dbListener);
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgAccountManager::OnItemAdded(nsIMsgFolder *parentItem, nsISupports *item)
{
  nsCOMPtr<nsIMsgFolder> folder = do_QueryInterface(item);
  // just kick out with a success code if the item in question is not a folder
  if (!folder)
    return NS_OK;
  PRUint32 folderFlags;
  folder->GetFlags(&folderFlags);
  nsresult rv = NS_OK;
  // need to make sure this isn't happening during loading of virtualfolders.dat
  if (folderFlags & nsMsgFolderFlags::Virtual && !m_loadingVirtualFolders)
  {
    // When a new virtual folder is added, need to create a db Listener for it.
    nsCOMPtr<nsIMsgDBService> msgDBService = do_GetService(NS_MSGDB_SERVICE_CONTRACTID, &rv);
    if (msgDBService)
    {
      nsCOMPtr <nsIMsgDatabase> virtDatabase;
      nsCOMPtr <nsIDBFolderInfo> dbFolderInfo;
      rv = folder->GetDBFolderInfoAndDB(getter_AddRefs(dbFolderInfo), getter_AddRefs(virtDatabase));
      NS_ENSURE_SUCCESS(rv, rv);
      nsCString srchFolderUri;
      dbFolderInfo->GetCharProperty("searchFolderUri", srchFolderUri);
      nsCOMPtr<nsIRDFService> rdf(do_GetService("@mozilla.org/rdf/rdf-service;1", &rv));
      AddVFListenersForVF(folder, srchFolderUri, rdf, msgDBService);
    }
    rv = SaveVirtualFolders();
  }
  return rv;
}

NS_IMETHODIMP nsMsgAccountManager::OnItemRemoved(nsIMsgFolder *parentItem, nsISupports *item)
{
  nsCOMPtr<nsIMsgFolder> folder = do_QueryInterface(item);
  // just kick out with a success code if the item in question is not a folder
  if (!folder)
    return NS_OK;
  nsresult rv = NS_OK;
  PRUint32 folderFlags;
  folder->GetFlags(&folderFlags);
  if (folderFlags & nsMsgFolderFlags::Virtual) // if we removed a VF, flush VF list to disk.
  {
    rv = SaveVirtualFolders();
    // clear flags on deleted folder if it's a virtual folder, so that creating a new folder
    // with the same name doesn't cause confusion.
    folder->SetFlags(0);
  }
  // need to check if the underlying folder for a VF was removed, in which case we need to
  // remove the virtual folder.

 return rv;
}

NS_IMETHODIMP nsMsgAccountManager::OnItemPropertyChanged(nsIMsgFolder *item, nsIAtom *property, const char *oldValue, const char *newValue)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsMsgAccountManager::OnItemIntPropertyChanged(nsIMsgFolder *item, nsIAtom *property, PRInt32 oldValue, PRInt32 newValue)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsMsgAccountManager::OnItemBoolPropertyChanged(nsIMsgFolder *item, nsIAtom *property, PRBool oldValue, PRBool newValue)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsMsgAccountManager::OnItemUnicharPropertyChanged(nsIMsgFolder *item, nsIAtom *property, const PRUnichar *oldValue, const PRUnichar *newValue)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


NS_IMETHODIMP nsMsgAccountManager::OnItemPropertyFlagChanged(nsIMsgDBHdr *item, nsIAtom *property, PRUint32 oldFlag, PRUint32 newFlag)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsMsgAccountManager::OnItemEvent(nsIMsgFolder *aFolder, nsIAtom *aEvent)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}
