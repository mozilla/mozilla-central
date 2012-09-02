/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*

  Outlook Express (Win32) settings

*/

#include "nsCOMPtr.h"
#include "nscore.h"
#include "nsMsgUtils.h"
#include "nsOEImport.h"
#include "nsIComponentManager.h"
#include "nsIServiceManager.h"
#include "nsOERegUtil.h"
#include "nsIMsgAccountManager.h"
#include "nsIMsgAccount.h"
#include "nsIImportSettings.h"
#include "nsOESettings.h"
#include "nsMsgBaseCID.h"
#include "nsMsgCompCID.h"
#include "nsMsgI18N.h"
#include "nsISmtpService.h"
#include "nsISmtpServer.h"
#include "nsOEStringBundle.h"
#include "OEDebugLog.h"
#include "nsIPop3IncomingServer.h"
#include "nsIImapIncomingServer.h"
#include "nsINntpIncomingServer.h"
#include "stdlib.h"
#include <windows.h>
#include "nsIWindowsRegKey.h"
#include "nsComponentManagerUtils.h"

#ifdef MOZILLA_INTERNAL_API
#include "nsNativeCharsetUtils.h"
#else
#include "nsMsgI18N.h"
#define NS_CopyNativeToUnicode(source, dest) \
        nsMsgI18NConvertToUnicode(nsMsgI18NFileSystemCharset(), source, dest)
#define NS_CopyUnicodeToNative(source, dest) \
        nsMsgI18NConvertFromUnicode(nsMsgI18NFileSystemCharset(), source, dest)
#endif

class OESettings {
public:
  static nsresult GetDefaultMailAccount(nsAString &aMailAccount);
  static nsresult GetCheckMailInterval(uint32_t *aInterval);
  static nsresult Find50Key(nsIWindowsRegKey **aKey);
  static nsresult Find40Key(nsIWindowsRegKey **aKey);
  static nsresult FindAccountsKey(nsIWindowsRegKey **aKey);

  static bool DoImport(nsIMsgAccount **ppAccount);

  static bool DoIMAPServer(nsIMsgAccountManager *aMgr,
                           nsIWindowsRegKey *aKey,
                           const nsString &aServerName,
                           nsIMsgAccount **ppAccount);
  static bool DoPOP3Server(nsIMsgAccountManager *aMgr,
                           nsIWindowsRegKey *aKey,
                           const nsString &aServerName,
                           nsIMsgAccount **ppAccount);
  static bool DoNNTPServer(nsIMsgAccountManager *aMgr,
                           nsIWindowsRegKey *aKey,
                           const nsString &aServerName,
                           nsIMsgAccount **ppAccount);

  static void SetIncomingServerProperties(nsIMsgIncomingServer *aServer,
                                          nsIWindowsRegKey *aKey,
                                          const nsString &aKeyNamePrefix);

  static void SetIdentities(nsIMsgAccountManager *aMgr,
                            nsIMsgAccount *aAccount,
                            nsIWindowsRegKey *aKey,
                            const nsString &aIncomgUserName,
                            int32_t authMethodIncoming, bool isNNTP);
  static void SetSmtpServer(const nsString &aSmtpServer,
                            nsIWindowsRegKey *aKey,
                            nsIMsgIdentity *aId,
                            const nsString &aIncomgUserName,
                            int32_t authMethodIncoming);
  static nsresult GetAccountName(nsIWindowsRegKey *aKey,
                                 const nsString &aDefaultName,
                                 nsAString &aAccountName);
  static bool IsKB933612Applied();
};

static uint32_t checkNewMailTime;// OE global setting, let's default to 30
static bool     checkNewMail;    // OE global setting, let's default to false
                                 // This won't cause unwanted autodownloads-
                                 // user can set prefs after import

////////////////////////////////////////////////////////////////////////
nsresult nsOESettings::Create(nsIImportSettings** aImport)
{
    NS_PRECONDITION(aImport != nullptr, "null ptr");
    if (! aImport)
        return NS_ERROR_NULL_POINTER;

    *aImport = new nsOESettings();
    if (! *aImport)
        return NS_ERROR_OUT_OF_MEMORY;

    NS_ADDREF(*aImport);
    return NS_OK;
}

nsOESettings::nsOESettings()
{
}

nsOESettings::~nsOESettings()
{
}

NS_IMPL_ISUPPORTS1(nsOESettings, nsIImportSettings)

NS_IMETHODIMP nsOESettings::AutoLocate(PRUnichar **description, nsIFile **location, bool *_retval)
{
  NS_PRECONDITION(description != nullptr, "null ptr");
  NS_PRECONDITION(_retval != nullptr, "null ptr");
  if (!description || !_retval)
    return NS_ERROR_NULL_POINTER;

  *description = nsOEStringBundle::GetStringByID(OEIMPORT_NAME);

  if (location)
    *location = nullptr;

  *_retval = false;
  nsCOMPtr<nsIWindowsRegKey> key;
  if (NS_FAILED(OESettings::Find50Key(getter_AddRefs(key))) &&
      NS_FAILED(OESettings::Find40Key(getter_AddRefs(key))))
    return NS_OK;

  if (NS_SUCCEEDED(OESettings::FindAccountsKey(getter_AddRefs(key))))
    *_retval = true;

  return NS_OK;
}

NS_IMETHODIMP nsOESettings::SetLocation(nsIFile *location)
{
  return NS_OK;
}

NS_IMETHODIMP nsOESettings::Import(nsIMsgAccount **localMailAccount, bool *_retval)
{
  NS_PRECONDITION(_retval != nullptr, "null ptr");

  if (OESettings::DoImport(localMailAccount)) {
    *_retval = true;
    IMPORT_LOG0("Settings import appears successful\n");
  }
  else {
    *_retval = false;
    IMPORT_LOG0("Settings import returned FALSE\n");
  }

  return NS_OK;
}

nsresult OESettings::GetDefaultMailAccount(nsAString &aMailAccount)
{
  nsresult rv;
  nsCOMPtr<nsIWindowsRegKey> key =
    do_CreateInstance("@mozilla.org/windows-registry-key;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsAutoString userId;
  rv = nsOERegUtil::GetDefaultUserId(userId);
  // OE has default mail account here when it has been
  // set up by transfer or has multiple identities
  // look below for orig code that looked in new OE installs
  if (NS_SUCCEEDED(rv)) {
    nsAutoString path(NS_LITERAL_STRING("Identities\\"));
    path.Append(userId);
    path.AppendLiteral("\\Software\\Microsoft\\Internet Account Manager");
    rv = key->Open(nsIWindowsRegKey::ROOT_KEY_CURRENT_USER,
                   path,
                   nsIWindowsRegKey::ACCESS_QUERY_VALUE);
    if (NS_SUCCEEDED(rv))
      key->ReadStringValue(NS_LITERAL_STRING("Default Mail Account"), aMailAccount);
  }

  if (!aMailAccount.IsEmpty())
    return NS_OK;

  // else it must be here in original install location from orig code
  rv = key->Open(nsIWindowsRegKey::ROOT_KEY_CURRENT_USER,
                 NS_LITERAL_STRING("Software\\Microsoft\\Outlook Express"),
                 nsIWindowsRegKey::ACCESS_QUERY_VALUE);
  if (NS_FAILED(rv))
    return rv;

  return key->ReadStringValue(NS_LITERAL_STRING("Default Mail Account"), aMailAccount);
}

nsresult OESettings::GetCheckMailInterval(uint32_t *aInterval)
{
  nsCOMPtr<nsIWindowsRegKey> key;
  // 'poll for messages' setting in OE is a global setting
  // in OE options general tab and in following global OE
  // registry location.
  // for all accounts poll interval is a 32 bit value, 0 for
  // "don't poll", else milliseconds
  nsresult rv = Find50Key(getter_AddRefs(key));
  if (NS_FAILED(rv))
    rv = Find40Key(getter_AddRefs(key));

  if (NS_FAILED(rv))
    return rv;

  nsCOMPtr<nsIWindowsRegKey> subKey;
  rv = key->OpenChild(NS_LITERAL_STRING("Mail"),
                      nsIWindowsRegKey::ACCESS_QUERY_VALUE,
                      getter_AddRefs(subKey));
  if (NS_FAILED(rv))
    return rv;

  uint32_t intValue;
  rv = subKey->ReadIntValue(NS_LITERAL_STRING("Poll For Mail"), &intValue);
  if (NS_SUCCEEDED(rv) && intValue != PR_UINT32_MAX)
    *aInterval = intValue / 60000;

  return rv;
}

nsresult OESettings::FindAccountsKey(nsIWindowsRegKey **aKey)
{
  nsAutoString userId;
  nsresult rv = nsOERegUtil::GetDefaultUserId(userId);
  if (NS_FAILED(rv))
    return rv;

  nsAutoString path(NS_LITERAL_STRING("Identities\\"));
  path.Append(userId);
  path.AppendLiteral("\\Software\\Microsoft\\Internet Account Manager\\Accounts");

  nsCOMPtr<nsIWindowsRegKey> key =
    do_CreateInstance("@mozilla.org/windows-registry-key;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = key->Open(nsIWindowsRegKey::ROOT_KEY_CURRENT_USER,
                 path,
                 nsIWindowsRegKey::ACCESS_QUERY_VALUE |
                 nsIWindowsRegKey::ACCESS_ENUMERATE_SUB_KEYS);
  if (NS_SUCCEEDED(rv)) {
    NS_ADDREF(*aKey = key);
    return rv;
  }

  rv = key->Open(nsIWindowsRegKey::ROOT_KEY_CURRENT_USER,
                 NS_LITERAL_STRING("Software\\Microsoft\\Internet Account Manager\\Accounts"),
                 nsIWindowsRegKey::ACCESS_QUERY_VALUE |
                 nsIWindowsRegKey::ACCESS_ENUMERATE_SUB_KEYS);
  NS_IF_ADDREF(*aKey = key);
  return rv;
}

nsresult OESettings::Find50Key(nsIWindowsRegKey **aKey)
{
  nsresult rv;
  nsCOMPtr<nsIWindowsRegKey> key =
    do_CreateInstance("@mozilla.org/windows-registry-key;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsAutoString userId;
  rv = nsOERegUtil::GetDefaultUserId(userId);
  if (NS_FAILED(rv))
    return rv;

  nsAutoString path(NS_LITERAL_STRING("Identities\\"));
  path.Append(userId);
  path.AppendLiteral("\\Software\\Microsoft\\Outlook Express\\5.0");
  rv = key->Open(nsIWindowsRegKey::ROOT_KEY_CURRENT_USER,
                 path,
                 nsIWindowsRegKey::ACCESS_QUERY_VALUE);
  NS_IF_ADDREF(*aKey = key);

  return rv;
}

nsresult OESettings::Find40Key(nsIWindowsRegKey **aKey)
{
  nsresult rv;
  nsCOMPtr<nsIWindowsRegKey> key =
    do_CreateInstance("@mozilla.org/windows-registry-key;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = key->Open(nsIWindowsRegKey::ROOT_KEY_CURRENT_USER,
                 NS_LITERAL_STRING("Software\\Microsoft\\Outlook Express"),
                 nsIWindowsRegKey::ACCESS_QUERY_VALUE);
  NS_IF_ADDREF(*aKey = key);

  return rv;
}

bool OESettings::DoImport(nsIMsgAccount **aAccount)
{
  nsCOMPtr<nsIWindowsRegKey> key;
  nsresult rv = FindAccountsKey(getter_AddRefs(key));
  if (NS_FAILED(rv)) {
    IMPORT_LOG0( "*** Error finding Outlook Express registry account keys\n");
    return false;
  }

  nsCOMPtr<nsIMsgAccountManager> accMgr =
           do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
  if (NS_FAILED(rv)) {
    IMPORT_LOG0("*** Failed to create a account manager!\n");
    return false;
  }

  nsAutoString defMailName;
  rv = GetDefaultMailAccount(defMailName);

  checkNewMail = false;
  checkNewMailTime = 30;
  rv = GetCheckMailInterval(&checkNewMailTime);
  if (NS_SUCCEEDED(rv))
    checkNewMail = true;

  // Iterate the accounts looking for POP3 & IMAP accounts...
  // Ignore LDAP for now!
  uint32_t accounts = 0;
  nsAutoString keyComp;
  uint32_t childCount = 0;
  key->GetChildCount(&childCount);
  for (uint32_t i = 0; i < childCount; i++) {
    nsAutoString keyName;
    key->GetChildName(i, keyName);

    nsCOMPtr<nsIWindowsRegKey> subKey;
    rv = key->OpenChild(keyName,
                        nsIWindowsRegKey::ACCESS_QUERY_VALUE,
                        getter_AddRefs(subKey));
    if (NS_FAILED(rv))
      continue;

    nsAutoCString nativeKeyName;
    NS_CopyUnicodeToNative(keyName, nativeKeyName);
    IMPORT_LOG1("Opened Outlook Express account: %s\n",
                nativeKeyName.get());

    nsIMsgAccount  *anAccount = nullptr;
    nsAutoString value;
    rv = subKey->ReadStringValue(NS_LITERAL_STRING("IMAP Server"), value);
    if (NS_SUCCEEDED(rv) && DoIMAPServer(accMgr, subKey, value, &anAccount))
      accounts++;

    rv = subKey->ReadStringValue(NS_LITERAL_STRING("NNTP Server"), value);
    if (NS_SUCCEEDED(rv) && DoNNTPServer(accMgr, subKey, value, &anAccount))
      accounts++;

    rv = subKey->ReadStringValue(NS_LITERAL_STRING("POP3 Server"), value);
    if (NS_SUCCEEDED(rv) && DoPOP3Server(accMgr, subKey, value, &anAccount))
      accounts++;

    if (anAccount) {
      // Is this the default account?
      keyComp = keyName;
      if (keyComp.Equals(defMailName))
        accMgr->SetDefaultAccount(anAccount);
      NS_RELEASE(anAccount);
    }
  }

  // Now save the new acct info to pref file.
  rv = accMgr->SaveAccountInfo();
  NS_ASSERTION(NS_SUCCEEDED(rv), "Can't save account info to pref file");

  return accounts != 0;
}

nsresult OESettings::GetAccountName(nsIWindowsRegKey *aKey,
                                    const nsString &aDefaultName,
                                    nsAString &aAccountName)
{
  nsresult rv;
  rv = aKey->ReadStringValue(NS_LITERAL_STRING("Account Name"), aAccountName);
  if (NS_FAILED(rv))
    aAccountName.Assign(aDefaultName);

  return NS_OK;
}

bool OESettings::DoIMAPServer(nsIMsgAccountManager *aMgr,
                              nsIWindowsRegKey *aKey,
                              const nsString &aServerName,
                              nsIMsgAccount **ppAccount)
{
  if (ppAccount)
    *ppAccount = nullptr;

  nsAutoString userName;
  nsresult rv;
  rv = aKey->ReadStringValue(NS_LITERAL_STRING("IMAP User Name"), userName);
  if (NS_FAILED(rv))
    return false;

  nsAutoCString nativeUserName;
  NS_CopyUnicodeToNative(userName, nativeUserName);
  nsAutoCString nativeServerName;
  NS_CopyUnicodeToNative(aServerName, nativeServerName);
  // I now have a user name/server name pair, find out if it already exists?
  nsCOMPtr<nsIMsgIncomingServer> in;
  rv = aMgr->FindServer(nativeUserName,
                        nativeServerName,
                        NS_LITERAL_CSTRING("imap"),
                        getter_AddRefs(in));
  if (NS_SUCCEEDED(rv)) {
    // for an existing server we create another identity,
    //  TB lists under 'manage identities'
    nsCOMPtr<nsIMsgAccount> account;
    rv = aMgr->FindAccountForServer(in, getter_AddRefs(account));
    if (NS_FAILED(rv))
      return false;

    IMPORT_LOG0("Created an identity and added to existing IMAP incoming server\n");
    // Fiddle with the identities
    int32_t authMethod;
    in->GetAuthMethod(&authMethod);
    SetIdentities(aMgr, account, aKey, userName, authMethod, false);
    if (ppAccount)
      account->QueryInterface(NS_GET_IID(nsIMsgAccount),
                              (void **)ppAccount);
    return true;
  }

  // Create the incoming server and an account for it?
  rv = aMgr->CreateIncomingServer(nativeUserName,
                                  nativeServerName,
                                  NS_LITERAL_CSTRING("imap"),
                                  getter_AddRefs(in));
  NS_ENSURE_SUCCESS(rv, false);

  nsAutoString rootFolder;
  rv = aKey->ReadStringValue(NS_LITERAL_STRING("IMAP Root Folder"), rootFolder);
  if (NS_SUCCEEDED(rv) && !rootFolder.IsEmpty()) {
    nsCOMPtr<nsIImapIncomingServer> imapServer = do_QueryInterface(in);
    nsAutoCString nativeRootFolder;
    NS_CopyUnicodeToNative(rootFolder, nativeRootFolder);
    imapServer->SetServerDirectory(nativeRootFolder);
  }

  SetIncomingServerProperties(in, aKey, NS_LITERAL_STRING("IMAP "));

  IMPORT_LOG2("Created IMAP server named: %s, userName: %s\n",
              nativeServerName.get(), nativeUserName.get());

  nsAutoString prettyName;
  if (NS_SUCCEEDED(GetAccountName(aKey, aServerName, prettyName)))
    rv = in->SetPrettyName(prettyName);

  // We have a server, create an account.
  nsCOMPtr<nsIMsgAccount> account;
  rv = aMgr->CreateAccount(getter_AddRefs(account));
  if (NS_SUCCEEDED(rv) && account) {
    rv = account->SetIncomingServer(in);

    IMPORT_LOG0("Created an account and set the IMAP server as the incoming server\n");

    // Fiddle with the identities
    int32_t authMethod;
    in->GetAuthMethod(&authMethod);
    SetIdentities(aMgr, account, aKey, userName, authMethod, false);
    if (ppAccount)
      account->QueryInterface(NS_GET_IID(nsIMsgAccount), (void **)ppAccount);
    return true;
  }

  return false;
}

bool OESettings::DoPOP3Server(nsIMsgAccountManager *aMgr,
                              nsIWindowsRegKey *aKey,
                              const nsString &aServerName,
                              nsIMsgAccount **ppAccount)
{
  if (ppAccount)
    *ppAccount = nullptr;

  nsAutoString userName;
  nsresult rv;
  rv = aKey->ReadStringValue(NS_LITERAL_STRING("POP3 User Name"), userName);
  if (NS_FAILED(rv))
    return false;

  nsAutoCString nativeUserName;
  NS_CopyUnicodeToNative(userName, nativeUserName);
  nsAutoCString nativeServerName;
  NS_CopyUnicodeToNative(aServerName, nativeServerName);

  // I now have a user name/server name pair, find out if it already exists?
  nsCOMPtr<nsIMsgIncomingServer> in;
  rv = aMgr->FindServer(nativeUserName,
                        nativeServerName,
                        NS_LITERAL_CSTRING("pop3"),
                        getter_AddRefs(in));
  if (NS_SUCCEEDED(rv)) {
    IMPORT_LOG2("Existing POP3 server named: %s, userName: %s\n",
                nativeUserName.get(), nativeServerName.get());
    // for an existing server we create another identity,
    // TB listed under 'manage identities'
    nsCOMPtr<nsIMsgAccount>  account;
    rv = aMgr->FindAccountForServer(in, getter_AddRefs(account));
    if (NS_SUCCEEDED(rv) && account) {
      IMPORT_LOG0("Created identity and added to existing POP3 incoming server.\n");
      // Fiddle with the identities
      int32_t authMethod;
      in->GetAuthMethod(&authMethod);
      SetIdentities(aMgr, account, aKey, userName, authMethod, false);
      if (ppAccount)
        account->QueryInterface(NS_GET_IID(nsIMsgAccount), (void **)ppAccount);
      return true;
    }
    return false;
  }

  // Create the incoming server and an account for it?
  rv = aMgr->CreateIncomingServer(nativeUserName,
                                  nativeServerName,
                                  NS_LITERAL_CSTRING("pop3"),
                                  getter_AddRefs( in));
  if (NS_FAILED(rv))
    return false;

  SetIncomingServerProperties(in, aKey, NS_LITERAL_STRING("POP3 "));

  nsCOMPtr<nsIPop3IncomingServer> pop3Server = do_QueryInterface(in);
  if (pop3Server) {
    // set local folders as the Inbox to use for this POP3 server
    nsCOMPtr<nsIMsgIncomingServer> localFoldersServer;
    aMgr->GetLocalFoldersServer(getter_AddRefs(localFoldersServer));

    if (!localFoldersServer)
    {
      // If Local Folders does not exist already, create it

      if (NS_FAILED(aMgr->CreateLocalMailAccount())) {
        IMPORT_LOG0("*** Failed to create Local Folders!\n");
        return false;
      }

      aMgr->GetLocalFoldersServer(getter_AddRefs(localFoldersServer));
    }

    // now get the account for this server
    nsCOMPtr<nsIMsgAccount> localFoldersAccount;
    aMgr->FindAccountForServer(localFoldersServer, getter_AddRefs(localFoldersAccount));
    if (localFoldersAccount)
    {
      nsCString localFoldersAcctKey;
      localFoldersAccount->GetKey(localFoldersAcctKey);
      pop3Server->SetDeferredToAccount(localFoldersAcctKey);
    }

    uint32_t intValue;
    rv = aKey->ReadIntValue(NS_LITERAL_STRING("POP3 Skip Account"), &intValue);
    // OE:0=='Include this account when receiving mail or synchronizing'==
    // TB:1==AM:Server:advanced:Include this server when getting new mail
    pop3Server->SetDeferGetNewMail(NS_SUCCEEDED(rv) && intValue == 0);

    rv = aKey->ReadIntValue(NS_LITERAL_STRING("Leave Mail On Server"),
                            &intValue);
    pop3Server->SetLeaveMessagesOnServer(NS_SUCCEEDED(rv) && intValue == 1);

    rv = aKey->ReadIntValue(NS_LITERAL_STRING("Remove When Deleted"),
                            &intValue);
    pop3Server->SetDeleteMailLeftOnServer(NS_SUCCEEDED(rv) && intValue == 1);

    rv = aKey->ReadIntValue(NS_LITERAL_STRING("Remove When Expired"),
                            &intValue);
    pop3Server->SetDeleteByAgeFromServer(NS_SUCCEEDED(rv) && intValue == 1);

    rv = aKey->ReadIntValue(NS_LITERAL_STRING("Expire Days"),
                            &intValue);
    if (NS_SUCCEEDED(rv))
      pop3Server->SetNumDaysToLeaveOnServer(static_cast<int32_t>(intValue));
  }
  IMPORT_LOG2("Created POP3 server named: %s, userName: %s\n",
              nativeServerName.get(), nativeUserName.get());
  nsString prettyName;
  if (NS_SUCCEEDED(GetAccountName(aKey, aServerName, prettyName)))
    rv = in->SetPrettyName(prettyName);

  // We have a server, create an account.
  nsCOMPtr<nsIMsgAccount>  account;
  rv = aMgr->CreateAccount(getter_AddRefs( account));
  if (NS_SUCCEEDED( rv) && account) {
    rv = account->SetIncomingServer(in);
    IMPORT_LOG0("Created a new account and set the incoming server to the POP3 server.\n");

    int32_t authMethod;
    in->GetAuthMethod(&authMethod);
    // Fiddle with the identities
    SetIdentities(aMgr, account, aKey, userName, authMethod, false);
    if (ppAccount)
      account->QueryInterface(NS_GET_IID(nsIMsgAccount),
                               (void **)ppAccount);
    return true;
  }

  return false;
}

bool OESettings::DoNNTPServer(nsIMsgAccountManager *aMgr,
                              nsIWindowsRegKey *aKey,
                              const nsString &aServerName,
                              nsIMsgAccount **ppAccount)
{
  if (ppAccount)
    *ppAccount = nullptr;

  nsAutoString userName;
  nsresult rv;
  // this only exists if NNTP server requires it or not anon login
  rv = aKey->ReadStringValue(NS_LITERAL_STRING("NNTP User Name"), userName);

  bool result = false;

  nsAutoCString nativeServerName;
  NS_CopyUnicodeToNative(aServerName, nativeServerName);
  // I now have a user name/server name pair, find out if it already exists?
  // NNTP can have empty user name.  This is wild card in findserver
  nsCOMPtr<nsIMsgIncomingServer> in;
  rv = aMgr->FindServer(EmptyCString(),
                        nativeServerName,
                        NS_LITERAL_CSTRING("nntp"),
                        getter_AddRefs(in));
  if (NS_FAILED(rv) || (in == nullptr)) {
    // Create the incoming server and an account for it?
    rv = aMgr->CreateIncomingServer(EmptyCString(),
                                    nativeServerName,
                                    NS_LITERAL_CSTRING("nntp"),
                                    getter_AddRefs(in));
    if (NS_SUCCEEDED(rv) && in) {
      uint32_t port = 0;
      rv = aKey->ReadIntValue(NS_LITERAL_STRING("NNTP Port"),
                              &port);
      if (NS_SUCCEEDED(rv) && port && port != 119)
        in->SetPort(static_cast<int32_t>(port));

      nsAutoCString nativeUserName;
      NS_CopyUnicodeToNative(userName, nativeUserName);
      // do nntpincomingserver stuff
      nsCOMPtr<nsINntpIncomingServer> nntpServer = do_QueryInterface(in);
      if (nntpServer && !userName.IsEmpty()) {
        nntpServer->SetPushAuth(true);
        in->SetUsername(nativeUserName);
      }

      IMPORT_LOG2("Created NNTP server named: %s, userName: %s\n",
                  nativeServerName.get(), nativeUserName.get());

      nsString prettyName;
      if (NS_SUCCEEDED(GetAccountName(aKey, aServerName, prettyName)))
        rv = in->SetPrettyName(prettyName);

      // We have a server, create an account.
      nsCOMPtr<nsIMsgAccount> account;
      rv = aMgr->CreateAccount(getter_AddRefs(account));
      if (NS_SUCCEEDED(rv) && account) {
        rv = account->SetIncomingServer(in);

        IMPORT_LOG0("Created an account and set the NNTP server as the incoming server\n");

        // Fiddle with the identities
        SetIdentities(aMgr, account, aKey, userName, 0, true);
        result = true;
        if (ppAccount)
          account->QueryInterface(NS_GET_IID(nsIMsgAccount), (void **)ppAccount);
      }
    }
  }
  else if (NS_SUCCEEDED(rv) && in) {
    // for the existing server...
    nsCOMPtr<nsIMsgAccount> account;
    rv = aMgr->FindAccountForServer(in, getter_AddRefs(account));
    if (NS_SUCCEEDED(rv) && account) {
      IMPORT_LOG0("Using existing account and set the NNTP server as the incoming server\n");
      // Fiddle with the identities
      SetIdentities(aMgr, account, aKey, userName, 0, true);
      if (ppAccount)
        account->QueryInterface(NS_GET_IID(nsIMsgAccount),
                                 (void **)ppAccount);
      return true;
    }
  }
  else
    result = true;

  return result;
}

void OESettings::SetIncomingServerProperties(nsIMsgIncomingServer *aServer,
                                             nsIWindowsRegKey *aKey,
                                             const nsString &aKeyNamePrefix)
{
  nsresult rv;
  uint32_t secureConnection = 0;
  nsString keyName(aKeyNamePrefix);
  keyName.AppendLiteral("Secure Connection");
  rv = aKey->ReadIntValue(keyName, &secureConnection);
  if (NS_SUCCEEDED(rv) && secureConnection == 1)
    aServer->SetSocketType(nsMsgSocketType::SSL);

  uint32_t port = 0;
  keyName.SetLength(aKeyNamePrefix.Length());
  keyName.AppendLiteral("Port");
  rv = aKey->ReadIntValue(keyName, &port);
  if (NS_SUCCEEDED(rv) && port)
    aServer->SetPort(static_cast<int32_t>(port));

  int32_t authMethod;
  uint32_t useSicily = 0;
  keyName.SetLength(aKeyNamePrefix.Length());
  keyName.AppendLiteral("Use Sicily");
  rv = aKey->ReadIntValue(keyName, &useSicily);
  if (NS_SUCCEEDED(rv) && useSicily)
    authMethod = nsMsgAuthMethod::secure;
  else
    authMethod = nsMsgAuthMethod::passwordCleartext;
  aServer->SetAuthMethod(authMethod);

  aServer->SetDoBiff(checkNewMail);
  aServer->SetBiffMinutes(checkNewMailTime);
}

void OESettings::SetIdentities(nsIMsgAccountManager *aMgr,
                               nsIMsgAccount *pAcc,
                               nsIWindowsRegKey *aKey,
                               const nsString &aIncomgUserName,
                               int32_t authMethodIncoming,
                               bool isNNTP)
{
  // Get the relevant information for an identity
  nsresult rv;
  nsAutoString name;
  rv = aKey->ReadStringValue(isNNTP ?
                             NS_LITERAL_STRING("NNTP Display Name") :
                             NS_LITERAL_STRING("SMTP Display Name"),
                             name);
  nsAutoString email;
  rv = aKey->ReadStringValue(isNNTP ?
                             NS_LITERAL_STRING("NNTP Email Address") :
                             NS_LITERAL_STRING("SMTP Email Address"),
                             email);
  nsAutoString reply;
  rv = aKey->ReadStringValue(isNNTP ?
                             NS_LITERAL_STRING("NNTP Reply To Email Address") :
                             NS_LITERAL_STRING("SMTP Reply To Email Address"),
                             reply);
  nsAutoString orgName;
  rv = aKey->ReadStringValue(isNNTP ?
                             NS_LITERAL_STRING("NNTP Organization Name") :
                             NS_LITERAL_STRING("SMTP Organization Name"),
                             orgName);

  nsCOMPtr<nsIMsgIdentity> id;
  rv = aMgr->CreateIdentity(getter_AddRefs(id));
  if (NS_FAILED(rv))
    return;

  id->SetFullName(name);
  //BUG 470587. Don't set this: id->SetIdentityName(fullName);

  id->SetOrganization(orgName);

  nsAutoCString nativeEmail;
  NS_CopyUnicodeToNative(email, nativeEmail);
  id->SetEmail(nativeEmail);
  if (!reply.IsEmpty()) {
    nsAutoCString nativeReply;
    NS_CopyUnicodeToNative(reply, nativeReply);
    id->SetReplyTo(nativeReply);
  }

  // Outlook Express users are used to top style quoting.
  id->SetReplyOnTop(isNNTP ? 0 : 1);
  pAcc->AddIdentity(id);

  nsAutoCString nativeName;
  NS_CopyUnicodeToNative(name, nativeName);
  IMPORT_LOG0("Created identity and added to the account\n");
  IMPORT_LOG1("\tname: %s\n", nativeName.get());
  IMPORT_LOG1("\temail: %s\n", nativeEmail.get());

  if (isNNTP)  // NNTP does not use SMTP in OE or TB
    return;
  nsAutoString smtpServer;
  rv = aKey->ReadStringValue(NS_LITERAL_STRING("SMTP Server"), smtpServer);
  SetSmtpServer(smtpServer, aKey, id, aIncomgUserName, authMethodIncoming);
}

void OESettings::SetSmtpServer(const nsString &aSmtpServer,
                               nsIWindowsRegKey *aKey,
                               nsIMsgIdentity *aId,
                               const nsString &aIncomgUserName,
                               int32_t authMethodIncoming)
{
  // set the id.smtpserver accordingly
  // first we have to calculate the smtp user name which is based on sicily
  if (!aKey || !aId || aIncomgUserName.IsEmpty() || aSmtpServer.IsEmpty())
    return;
  nsCString smtpServerKey;
  // smtp user name depends on sicily which may or not exist
  uint32_t useSicily = 0;
  nsresult rv = aKey->ReadIntValue(NS_LITERAL_STRING("SMTP Use Sicily"),
                                   &useSicily);
  nsAutoString userName;
  switch (useSicily) {
    case 1:
    case 3:
      // has to go in whether empty or no
      // shouldn't be empty but better safe than sorry
      aKey->ReadStringValue(NS_LITERAL_STRING("SMTP User Name"), userName);
      break;
    case 2:
      userName = aIncomgUserName;
      break;
    default:
      break; // initial userName == ""
  }

  nsCOMPtr<nsISmtpService> smtpService(do_GetService(NS_SMTPSERVICE_CONTRACTID, &rv));
  if (NS_SUCCEEDED(rv) && smtpService) {
    nsCOMPtr<nsISmtpServer> foundServer;
    // don't try to make another server
    // regardless if username doesn't match
    nsAutoCString nativeUserName;
    NS_CopyUnicodeToNative(userName, nativeUserName);
    nsAutoCString nativeSmtpServer;
    NS_CopyUnicodeToNative(aSmtpServer, nativeSmtpServer);
    rv = smtpService->FindServer(nativeUserName.get(),
                                 nativeSmtpServer.get(),
                                 getter_AddRefs(foundServer));
    if (NS_SUCCEEDED(rv) && foundServer) {
      // set our account keyed to this smptserver key
      foundServer->GetKey(getter_Copies(smtpServerKey));
      aId->SetSmtpServerKey(smtpServerKey);

      IMPORT_LOG1("SMTP server already exists: %s\n",
                  nativeSmtpServer.get());
    }
    else {
      nsCOMPtr<nsISmtpServer> smtpServer;
      rv = smtpService->CreateSmtpServer(getter_AddRefs(smtpServer));
      if (NS_SUCCEEDED(rv) && smtpServer) {
        uint32_t port = 0;
        rv = aKey->ReadIntValue(NS_LITERAL_STRING("SMTP Port"),
                                &port);
        if (NS_SUCCEEDED(rv) && port)
          smtpServer->SetPort(static_cast<int32_t>(port));

        int32_t socketType = nsMsgSocketType::plain;
        uint32_t secureConnection = 0;
        rv = aKey->ReadIntValue(NS_LITERAL_STRING("SMTP Secure Connection"),
                                &secureConnection);
        if (NS_SUCCEEDED(rv) && secureConnection == 1) {
          // Outlook Express does not support STARTTLS without KB933612 fix.
          if (IsKB933612Applied() && port != 465)
            socketType = nsMsgSocketType::alwaysSTARTTLS;
          else
            socketType = nsMsgSocketType::SSL;
        }
        smtpServer->SetSocketType(socketType);
        smtpServer->SetUsername(nativeUserName);
        switch (useSicily) {
          case 1 :
            smtpServer->SetAuthMethod(nsMsgAuthMethod::secure);
            break;
          case 2 : // requires SMTP authentication to use the incoming server settings
            smtpServer->SetAuthMethod(authMethodIncoming);
            break;
          case 3 :
            smtpServer->SetAuthMethod(nsMsgAuthMethod::passwordCleartext);
            break;
          default:
            smtpServer->SetAuthMethod(nsMsgAuthMethod::none);
        }

        smtpServer->SetHostname(nativeSmtpServer);

        smtpServer->GetKey(getter_Copies(smtpServerKey));
        aId->SetSmtpServerKey(smtpServerKey);

        IMPORT_LOG1("Created new SMTP server: %s\n",
                    nativeSmtpServer.get());
      }
    }
  }
}

bool OESettings::IsKB933612Applied()
{
  OSVERSIONINFOEX versionInfo = { 0 };
  versionInfo.dwOSVersionInfoSize = sizeof(versionInfo);
  GetVersionEx(reinterpret_cast<OSVERSIONINFO*>(&versionInfo));

  // Windows XP SP3 and Windows Vista SP1 include KB933612 fix.
  // See http://support.microsoft.com/kb/929123 and
  // http://support.microsoft.com/kb/933612
  switch (versionInfo.dwMajorVersion) {
    case 6:
      if ((versionInfo.dwMinorVersion == 0 && versionInfo.wServicePackMajor > 0) ||
          versionInfo.dwMinorVersion == 1) {
        return true;
      }
      break;
    case 5:
      if (versionInfo.dwMinorVersion > 0 && versionInfo.wServicePackMajor > 2)
        return true;
      break;
    default:
      break;
  }
  return false;
}

