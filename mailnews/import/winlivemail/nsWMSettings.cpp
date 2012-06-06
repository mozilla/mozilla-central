/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*

  Windows Live Mail (Win32) settings

*/

#include "nsCOMPtr.h"
#include "nscore.h"
#include "nsStringGlue.h"
#include "nsMsgUtils.h"
#include "nsWMImport.h"
#include "nsIComponentManager.h"
#include "nsIServiceManager.h"
#include "nsIMsgAccountManager.h"
#include "nsIMsgAccount.h"
#include "nsIImportSettings.h"
#include "nsWMSettings.h"
#include "nsMsgBaseCID.h"
#include "nsMsgCompCID.h"
#include "nsMsgI18N.h"
#include "nsISmtpService.h"
#include "nsISmtpServer.h"
#include "nsWMStringBundle.h"
#include "WMDebugLog.h"
#include "nsIPop3IncomingServer.h"
#include "nsIImapIncomingServer.h"
#include "nsINntpIncomingServer.h"
#include "stdlib.h"
#include "nsIFile.h"
#include "nsISimpleEnumerator.h"
#include "nsIMutableArray.h"
#include "nsIDOMDocument.h"
#include "nsNetUtil.h"
#include "nsIDOMNodeList.h"
#include "nsIFileStreams.h"
#include "nsIDOMParser.h"
#include "nsIDOMElement.h"
#include "nsTArray.h"
#include <windows.h>
#include "nsIWindowsRegKey.h"
#include "nsCOMArray.h"

class WMSettings {
public:
  static nsresult FindWMKey(nsIWindowsRegKey* akey);
  static bool getOEacctFiles(nsIFile* file, nsCOMArray<nsIFile>& fileArray);
  static nsresult GetValueForTag(nsIDOMDocument *xmlDoc,
                                 const nsAString& tagName,
                                 nsAString &value);
  static nsresult MakeXMLdoc(nsIDOMDocument** xmlDoc,
                             nsIFile* file);
  static bool DoImport(nsIMsgAccount **ppAccount);
  static bool DoIMAPServer(nsIMsgAccountManager *pMgr,
                             nsIDOMDocument *xmlDoc,
                             const nsString& serverName,
                             nsIMsgAccount **ppAccount);
  static bool DoPOP3Server(nsIMsgAccountManager *pMgr,
                             nsIDOMDocument *xmlDoc,
                             const nsString& serverName,
                             nsIMsgAccount **ppAccount);
  static bool DoNNTPServer(nsIMsgAccountManager *pMgr,
                             nsIDOMDocument *xmlDoc,
                             const nsString& serverName,
                             nsIMsgAccount **ppAccount);
  static void SetIdentities(nsIMsgAccountManager *pMgr, nsIMsgAccount *pAcc,
                            nsIDOMDocument *xmlDoc, nsAutoString &userName,
                            PRInt32 authMethodIncoming, bool isNNTP);
  static void SetSmtpServer(nsIDOMDocument *xmlDoc, nsIMsgIdentity *id,
                            nsAutoString& inUserName, PRInt32 authMethodIncoming);
};

static PRInt32 checkNewMailTime;// WM global setting, let's default to 30
static bool    checkNewMail;    // WM global setting, let's default to false
                                // This won't cause unwanted autodownloads-
                                // user can set prefs after import

////////////////////////////////////////////////////////////////////////
nsresult nsWMSettings::Create(nsIImportSettings** aImport)
{
    NS_PRECONDITION(aImport != nsnull, "null ptr");
    if (! aImport)
        return NS_ERROR_NULL_POINTER;

    *aImport = new nsWMSettings();
    if (! *aImport)
        return NS_ERROR_OUT_OF_MEMORY;

    NS_ADDREF(*aImport);
    return NS_OK;
}

nsWMSettings::nsWMSettings()
{
}

nsWMSettings::~nsWMSettings()
{
}

NS_IMPL_ISUPPORTS1(nsWMSettings, nsIImportSettings)

NS_IMETHODIMP nsWMSettings::AutoLocate(PRUnichar **description,
                                       nsIFile **location, bool *_retval)
{
  NS_PRECONDITION(description != nsnull, "null ptr");
  NS_PRECONDITION(_retval != nsnull, "null ptr");
  if (!description || !_retval)
    return NS_ERROR_NULL_POINTER;

  *description = nsWMStringBundle::GetStringByID(WMIMPORT_NAME);
  *_retval = false;

  nsCOMPtr<nsIWindowsRegKey> key =
    do_CreateInstance("@mozilla.org/windows-registry-key;1");
  if (location)
    *location = nsnull;
  if (NS_SUCCEEDED(WMSettings::FindWMKey(key)))
    *_retval = true;

  return NS_OK;
}

NS_IMETHODIMP nsWMSettings::SetLocation(nsIFile *location)
{
  return NS_OK;
}

NS_IMETHODIMP nsWMSettings::Import(nsIMsgAccount **localMailAccount,
                                   bool *_retval)
{
  NS_PRECONDITION(_retval != nsnull, "null ptr");

  if (WMSettings::DoImport(localMailAccount)) {
    *_retval = true;
    IMPORT_LOG0("Settings import appears successful\n");
  }
  else {
    *_retval = false;
    IMPORT_LOG0("Settings import returned FALSE\n");
  }

  return NS_OK;
}

nsresult WMSettings::FindWMKey(nsIWindowsRegKey* akey)
{
  nsresult rv;
  NS_ENSURE_ARG(akey);
  rv = akey->Open(nsIWindowsRegKey::ROOT_KEY_CURRENT_USER,
                  NS_LITERAL_STRING("Software\\Microsoft\\Windows Live Mail"),
                  nsIWindowsRegKey::ACCESS_QUERY_VALUE);
  if (NS_SUCCEEDED(rv))
    return rv;
  rv = akey->Open(nsIWindowsRegKey::ROOT_KEY_CURRENT_USER,
                  NS_LITERAL_STRING("Software\\Microsoft\\Windows Mail"),
                  nsIWindowsRegKey::ACCESS_QUERY_VALUE);
  return rv;
}

bool WMSettings::getOEacctFiles(nsIFile* file,
                                  nsCOMArray<nsIFile>& fileArray)
{
  nsresult rv;
  nsCOMPtr<nsISimpleEnumerator> entries;
  rv = file->GetDirectoryEntries(getter_AddRefs(entries));
  if (NS_FAILED(rv) || !entries)
    return false;

  bool hasMore;
  while (NS_SUCCEEDED(entries->HasMoreElements(&hasMore)) && hasMore) {
    nsCOMPtr<nsISupports> sup;
    entries->GetNext(getter_AddRefs(sup));
    if (!sup)
      return false;
    nsCOMPtr<nsIFile> fileX = do_QueryInterface(sup);
    if (!fileX)
      return false;
    nsString name;
    if (NS_FAILED(fileX->GetLeafName(name)))
      return false;
    bool isDir;
    if (NS_FAILED(fileX->IsDirectory(&isDir)))
      return false;
    if (isDir) {
      getOEacctFiles(fileX, fileArray);
    }
    else {
      if (StringEndsWith(name, NS_LITERAL_STRING(".oeaccount")))
        fileArray.AppendObject(fileX);
    }
  }
  return true;
}

nsresult WMSettings::GetValueForTag(nsIDOMDocument *xmlDoc,
                                    const nsAString& tagName,
                                    nsAString &value)
{
  nsCOMPtr<nsIDOMNodeList> list;
  if (NS_FAILED(xmlDoc->GetElementsByTagName(tagName, getter_AddRefs(list))))
    return NS_ERROR_FAILURE;
  nsCOMPtr<nsIDOMNode> domNode;
  list->Item(0, getter_AddRefs(domNode));
  if (!domNode)
    return NS_ERROR_FAILURE;
  return domNode->GetTextContent(value);
}

nsresult WMSettings::MakeXMLdoc(nsIDOMDocument** xmlDoc,
                                nsIFile* file)
{
  nsresult rv;
  nsCOMPtr<nsIFileInputStream> stream =
    do_CreateInstance(NS_LOCALFILEINPUTSTREAM_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = stream->Init(file, PR_RDONLY, -1, 0);
  nsCOMPtr<nsIDOMParser> parser = do_CreateInstance(NS_DOMPARSER_CONTRACTID);
  NS_ENSURE_STATE(parser);
  PRInt64 filesize;
  file->GetFileSize(&filesize);
  return parser->ParseFromStream(stream, nsnull, PRInt32(filesize),
                                 "application/xml", xmlDoc);
}

bool WMSettings::DoImport(nsIMsgAccount **ppAccount)
{
  nsresult rv;

  // do the windows registry stuff first
  nsCOMPtr<nsIWindowsRegKey> key =
    do_CreateInstance("@mozilla.org/windows-registry-key;1");
  if (NS_FAILED(FindWMKey(key))) {
    IMPORT_LOG0("*** Error finding Windows Live Mail registry account keys\n");
    return false;
  }
  // 'poll for messages' setting in WM is a global setting-Like OE
  // for all accounts dword ==0xffffffff for don't poll else 1/60000 = minutes
  checkNewMailTime = 30;
  checkNewMail = false;
  nsCOMPtr<nsIWindowsRegKey> subKey;
  if (NS_SUCCEEDED(key->OpenChild(NS_LITERAL_STRING("mail"),
                                  nsIWindowsRegKey::ACCESS_QUERY_VALUE,
                                  getter_AddRefs(subKey)))) {
    PRUint32 dwordResult = -1;
    rv = subKey->ReadIntValue(NS_LITERAL_STRING("Poll For Mail"), &dwordResult); // reg_dword
    subKey->Close();
    if (NS_SUCCEEDED(rv) && dwordResult != -1){
      checkNewMail = true;
      checkNewMailTime = dwordResult / 60000;
    }
  }
  // these are in main windowsmail key and if they don't exist-not to worry
  // (less than 64 chars) e.g. account{4A18B81E-83CA-472A-8D7F-5301C0B97B8D}.oeaccount
  nsAutoString  defMailAcct, defNewsAcct;
  key->ReadStringValue(NS_LITERAL_STRING("Default Mail Account"), defMailAcct); // ref_sz
  key->ReadStringValue(NS_LITERAL_STRING("Default News Account"), defNewsAcct); // ref_sz

  // This is essential to proceed; it is the location on disk of xml-type account files;
  // it is in reg_expand_sz so it will need expanding to absolute path.
  nsString  storeRoot;
  rv = key->ReadStringValue(NS_LITERAL_STRING("Store Root"), storeRoot);
  key->Close();  // Finished with windows registry key. We do not want to return before this closing
  if (NS_FAILED(rv) || storeRoot.IsEmpty()) {
    IMPORT_LOG0("*** Error finding Windows Live Mail Store Root\n");
    return false;
  }

  nsCOMPtr<nsIFile> file(do_CreateInstance(NS_LOCAL_FILE_CONTRACTID));
  if (!file) {
    IMPORT_LOG0("*** Failed to create an nsIFile!\n");
    return false;
  }
  nsCOMPtr<nsIMsgAccountManager> accMgr =
           do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
  if (NS_FAILED(rv)) {
    IMPORT_LOG0("*** Failed to create an account manager!\n");
    return false;
  }

  PRUint32 size = ::ExpandEnvironmentStringsW((LPCWSTR)storeRoot.get(), nsnull, 0);
  nsString expandedStoreRoot;
  expandedStoreRoot.SetLength(size - 1);
  if (expandedStoreRoot.Length() != size - 1)
    return false;
  ::ExpandEnvironmentStringsW((LPCWSTR)storeRoot.get(),
                              (LPWSTR)expandedStoreRoot.BeginWriting(),
                              size);
  storeRoot = expandedStoreRoot;

  if (NS_FAILED(file->InitWithPath(storeRoot))) {
    IMPORT_LOG0("*** Failed get store root!\n");
    return false;
  }
  nsCOMArray<nsIFile> fileArray;
  if (!getOEacctFiles(file, fileArray)) {
    IMPORT_LOG0("*** Failed to get OEacctFiles!\n");
    return false;
  }

  // Loop through *.oeaccounts files looking for POP3 & IMAP & NNTP accounts
  // Ignore LDAP for now!
  int accounts = 0;
  nsCOMPtr<nsIDOMDocument> xmlDoc;

  for (PRInt32 i = fileArray.Count() - 1 ; i >= 0; i--){
    MakeXMLdoc(getter_AddRefs(xmlDoc), fileArray[i]);

    nsAutoString value;
    nsCOMPtr<nsIMsgAccount> anAccount;
    if (NS_SUCCEEDED(GetValueForTag(xmlDoc, NS_LITERAL_STRING("IMAP_Server"),
        value)))
      if (DoIMAPServer(accMgr, xmlDoc, value, getter_AddRefs(anAccount)))
        accounts++;
    if (NS_SUCCEEDED(GetValueForTag(xmlDoc, NS_LITERAL_STRING("NNTP_Server"),
        value)))
      if (DoNNTPServer(accMgr, xmlDoc, value, getter_AddRefs(anAccount)))
        accounts++;
    if (NS_SUCCEEDED(GetValueForTag(xmlDoc, NS_LITERAL_STRING("POP3_Server"),
        value)))
      if (DoPOP3Server(accMgr, xmlDoc, value, getter_AddRefs(anAccount)))
        accounts++;

    if (anAccount) {
      nsString name;
      // Is this the default account?
      fileArray[i]->GetLeafName(name);
      if (defMailAcct.Equals(name))
        accMgr->SetDefaultAccount(anAccount);
    }
  }

  // Now save the new acct info to pref file.
  rv = accMgr->SaveAccountInfo();
  NS_ASSERTION(NS_SUCCEEDED(rv), "Can't save account info to pref file");

  return accounts != 0;
}

bool WMSettings::DoIMAPServer(nsIMsgAccountManager *pMgr,
                                nsIDOMDocument *xmlDoc,
                                const nsString& serverName,
                                nsIMsgAccount **ppAccount)
{
  PRInt32 authMethod;   // Secure Password Authentication (SPA)
  nsresult errorCode;
  if (ppAccount)
    *ppAccount = nsnull;

  nsAutoString userName, value;
  if (NS_FAILED(GetValueForTag(xmlDoc, NS_LITERAL_STRING("IMAP_User_Name"),
                               userName)))
    return false;
  bool result = false;
  // I now have a user name/server name pair, find out if it already exists?
  nsCOMPtr<nsIMsgIncomingServer> in;
  nsresult rv = pMgr->FindServer(NS_ConvertUTF16toUTF8(userName),
                                 NS_ConvertUTF16toUTF8(serverName),
                                 NS_LITERAL_CSTRING("imap"),
                                 getter_AddRefs(in));
  if (NS_FAILED(rv) || (in == nsnull)) {
    // Create the incoming server and an account for it?
    rv = pMgr->CreateIncomingServer(NS_ConvertUTF16toUTF8(userName),
                                    NS_ConvertUTF16toUTF8(serverName),
                                    NS_LITERAL_CSTRING("imap"),
                                    getter_AddRefs(in));
    if (NS_SUCCEEDED(rv) && in) {
      nsCOMPtr<nsIImapIncomingServer> imapServer = do_QueryInterface(in);
      if (!imapServer){
        IMPORT_LOG1("*** Failed to create nsIImapIncomingServer for %S!\n",
                    serverName.get());
        return false;
      }
      GetValueForTag(xmlDoc, NS_LITERAL_STRING("IMAP_Root_Folder"), value);
      if (!value.IsEmpty())
        imapServer->SetServerDirectory(NS_ConvertUTF16toUTF8(value));

      GetValueForTag(xmlDoc, NS_LITERAL_STRING("IMAP_Secure_Connection"), value);
      if (value.ToInteger(&errorCode, 16))
        in->SetSocketType(nsMsgSocketType::SSL);

      GetValueForTag(xmlDoc, NS_LITERAL_STRING("IMAP_Use_Sicily"), value);
      bool secAuth = (bool)value.ToInteger(&errorCode, 16);
      authMethod = secAuth ? nsMsgAuthMethod::secure :
                             nsMsgAuthMethod::passwordCleartext;
      in->SetAuthMethod(authMethod);

      GetValueForTag(xmlDoc, NS_LITERAL_STRING("IMAP_Port"), value);
      if (!value.IsEmpty())
        in->SetPort(value.ToInteger(&errorCode, 16));

      GetValueForTag(xmlDoc, NS_LITERAL_STRING("Account_Name"), value);
      if (!value.IsEmpty())
        rv = in->SetPrettyName(value);
      in->SetDoBiff(checkNewMail);
      in->SetBiffMinutes(checkNewMailTime);

      IMPORT_LOG2("Created IMAP server named: %S, userName: %S\n",
                  serverName.get(), userName.get());

      // We have a server, create an account.
      nsCOMPtr<nsIMsgAccount> account;
      rv = pMgr->CreateAccount(getter_AddRefs(account));
      if (NS_SUCCEEDED(rv) && account) {
        rv = account->SetIncomingServer(in);

        IMPORT_LOG0("Created an account and set the IMAP server "
                    "as the incoming server\n");

        // Fiddle with the identities
        SetIdentities(pMgr, account, xmlDoc, userName, authMethod, false);
        result = true;
        if (ppAccount)
          account.forget(ppAccount);
      }
    }
  }
  else if (NS_SUCCEEDED(rv) && in) {
    // for an existing server we create another identity,
    //  TB lists under 'manage identities'
    nsCOMPtr<nsIMsgAccount> account;
    rv = pMgr->FindAccountForServer(in, getter_AddRefs(account));
    if (NS_SUCCEEDED(rv) && account) {
      IMPORT_LOG0("Created an identity and added to existing "
                  "IMAP incoming server\n");
      // Fiddle with the identities
      in->GetAuthMethod(&authMethod);
      SetIdentities(pMgr, account, xmlDoc, userName, authMethod, false);
      result = true;
      if (ppAccount)
        account.forget(ppAccount);
    }
  }
  else
    result = true;
  return result;
}

bool WMSettings::DoPOP3Server(nsIMsgAccountManager *pMgr,
                                nsIDOMDocument *xmlDoc,
                                const nsString& serverName,
                                nsIMsgAccount **ppAccount)
{
  PRInt32 authMethod;   // Secure Password Authentication (SPA)
  nsresult errorCode;
  if (ppAccount)
    *ppAccount = nsnull;

  nsAutoString userName, value;
  if (NS_FAILED(GetValueForTag(xmlDoc, NS_LITERAL_STRING("POP3_User_Name"),
                               userName)))
    return false;
  bool result = false;
  // I now have a user name/server name pair, find out if it already exists?
  nsCOMPtr<nsIMsgIncomingServer> in;
  nsresult rv = pMgr->FindServer(NS_ConvertUTF16toUTF8(userName),
                                 NS_ConvertUTF16toUTF8(serverName),
                                 NS_LITERAL_CSTRING("pop3"),
                                 getter_AddRefs(in));
  if (NS_FAILED(rv) || (in == nsnull)) {
    // Create the incoming server and an account for it?
    rv = pMgr->CreateIncomingServer(NS_ConvertUTF16toUTF8(userName),
                                    NS_ConvertUTF16toUTF8(serverName),
                                    NS_LITERAL_CSTRING("pop3"),
                                    getter_AddRefs(in));
    if (NS_SUCCEEDED(rv) && in) {
      nsCOMPtr<nsIPop3IncomingServer> pop3Server = do_QueryInterface(in);
      if (!pop3Server){
        IMPORT_LOG1("*** Failed to create nsIPop3IncomingServer for %S!\n",
          serverName.get());
        return false;
      }

      GetValueForTag(xmlDoc, NS_LITERAL_STRING("POP3_Secure_Connection"), value);
      if (value.ToInteger(&errorCode, 16))
        in->SetSocketType(nsMsgSocketType::SSL);

      GetValueForTag(xmlDoc, NS_LITERAL_STRING("POP3_Use_Sicily"), value);
      bool secAuth = (bool)value.ToInteger(&errorCode, 16);
      authMethod = secAuth ? nsMsgAuthMethod::secure :
                             nsMsgAuthMethod::passwordCleartext;
      in->SetAuthMethod(authMethod);

      GetValueForTag(xmlDoc, NS_LITERAL_STRING("POP3_Port"), value);
      if (!value.IsEmpty())
        in->SetPort(value.ToInteger(&errorCode, 16));

      GetValueForTag(xmlDoc, NS_LITERAL_STRING("POP3_Skip_Account"), value);
      if (!value.IsEmpty())
        // OE:0=='Include this account when receiving mail or synchronizing'==
        // TB:1==ActMgr:Server:advanced:Include this server when getting new mail
        pop3Server->SetDeferGetNewMail(value.ToInteger(&errorCode, 16) == 0);
      else
        pop3Server->SetDeferGetNewMail(false);
      GetValueForTag(xmlDoc, NS_LITERAL_STRING("Leave_Mail_On_Server"), value);
      if (!value.IsEmpty())
        pop3Server->SetLeaveMessagesOnServer((bool)value.ToInteger(&errorCode, 16));
      GetValueForTag(xmlDoc, NS_LITERAL_STRING("Remove_When_Deleted"), value);
      if (!value.IsEmpty())
        pop3Server->SetDeleteMailLeftOnServer((bool)value.ToInteger(&errorCode, 16));
      GetValueForTag(xmlDoc, NS_LITERAL_STRING("Remove_When_Expired"), value);
      if (!value.IsEmpty())
        pop3Server->SetDeleteByAgeFromServer((bool)value.ToInteger(&errorCode, 16));
      GetValueForTag(xmlDoc, NS_LITERAL_STRING("Expire_Days"), value);
      if (!value.IsEmpty())
        pop3Server->SetNumDaysToLeaveOnServer(value.ToInteger(&errorCode, 16));
      GetValueForTag(xmlDoc, NS_LITERAL_STRING("Account_Name"), value);
      if (!value.IsEmpty())
        rv = in->SetPrettyName(value);

      in->SetDoBiff(checkNewMail);
      in->SetBiffMinutes(checkNewMailTime);

      // set local folders as the Inbox to use for this POP3 server
      nsCOMPtr<nsIMsgIncomingServer> localFoldersServer;
      pMgr->GetLocalFoldersServer(getter_AddRefs(localFoldersServer));
      if (!localFoldersServer) {
        // XXX: We may need to move this local folder creation
        // code to the generic nsImportSettings code
        // if the other import modules end up needing to do this too.
        // if Local Folders does not exist already, create it
        rv = pMgr->CreateLocalMailAccount();
        if (NS_FAILED(rv)) {
          IMPORT_LOG0("*** Failed to create Local Folders!\n");
          return false;
        }
        pMgr->GetLocalFoldersServer(getter_AddRefs(localFoldersServer));
      }

      // now get the account for this server
      nsCOMPtr<nsIMsgAccount> localFoldersAccount;
      pMgr->FindAccountForServer(localFoldersServer,
                                 getter_AddRefs(localFoldersAccount));
      if (localFoldersAccount) {
        nsCString localFoldersAcctKey;
        localFoldersAccount->GetKey(localFoldersAcctKey);
        pop3Server->SetDeferredToAccount(localFoldersAcctKey);
      }

      IMPORT_LOG2("Created POP3 server named: %S, userName: %S\n",
                  serverName.get(), userName.get());

      // We have a server, create an account.
      nsCOMPtr<nsIMsgAccount> account;
      rv = pMgr->CreateAccount(getter_AddRefs(account));
      if (NS_SUCCEEDED(rv) && account) {
        rv = account->SetIncomingServer(in);
        IMPORT_LOG0("Created a new account and set the incoming "
                    "server to the POP3 server.\n");

        // Fiddle with the identities
        SetIdentities(pMgr, account, xmlDoc, userName, authMethod, false);
        result = true;
        if (ppAccount)
          account.forget(ppAccount);
      }
    }
  }
  else if (NS_SUCCEEDED(rv) && in) {
    IMPORT_LOG2("Existing POP3 server named: %S, userName: %S\n",
                serverName.get(), userName.get());
    // for an existing server we create another identity,
    // TB listed under 'manage identities'
    nsCOMPtr<nsIMsgAccount>  account;
    rv = pMgr->FindAccountForServer(in, getter_AddRefs(account));
    if (NS_SUCCEEDED(rv) && account) {
      IMPORT_LOG0("Created identity and added to existing POP3 incoming server.\n");
      // Fiddle with the identities
      in->GetAuthMethod(&authMethod);
      SetIdentities(pMgr, account, xmlDoc, userName, authMethod, false);
      result = true;
      if (ppAccount)
        account.forget(ppAccount);
    }
  }
  else
    result = true;
  return result;
}

bool WMSettings::DoNNTPServer(nsIMsgAccountManager *pMgr,
                                nsIDOMDocument *xmlDoc,
                                const nsString& serverName,
                                nsIMsgAccount **ppAccount)
{
  PRInt32 authMethod;
  nsresult errorCode;
  if (ppAccount)
    *ppAccount = nsnull;

  nsAutoString userName, value;
  // this only exists if NNTP server requires it or not, anonymous login
  GetValueForTag(xmlDoc, NS_LITERAL_STRING("NNTP_User_Name"), userName);
  bool result = false;

  // I now have a user name/server name pair, find out if it already exists?
  // NNTP can have empty user name.  This is wild card in findserver
  nsCOMPtr<nsIMsgIncomingServer> in;
  nsresult rv = pMgr->FindServer(EmptyCString(),
                         NS_ConvertUTF16toUTF8(serverName),
                         NS_LITERAL_CSTRING("nntp"),
                         getter_AddRefs(in));
  if (NS_FAILED(rv) || (in == nsnull)) {
    // Create the incoming server and an account for it?
    rv = pMgr->CreateIncomingServer(nsDependentCString(""),
                                    NS_ConvertUTF16toUTF8(serverName),
                                    NS_LITERAL_CSTRING("nntp"),
                                    getter_AddRefs(in));
    if (NS_SUCCEEDED(rv) && in) {

      nsCOMPtr<nsINntpIncomingServer> nntpServer = do_QueryInterface(in);
      if (!nntpServer) {
        IMPORT_LOG1("*** Failed to create nsINnntpIncomingServer for %S!\n",
          serverName.get());
        return false;
      }
      if (!userName.IsEmpty()) {  // if username req'd then auth req'd
        nntpServer->SetPushAuth(true);
        in->SetUsername(NS_ConvertUTF16toUTF8(userName));
      }

      nsAutoString value;
      GetValueForTag(xmlDoc, NS_LITERAL_STRING("NNTP_Port"), value);
      if (!value.IsEmpty()) {
        in->SetPort(value.ToInteger(&errorCode, 16));
      }

      GetValueForTag(xmlDoc, NS_LITERAL_STRING("Account_Name"), value);
      if (!value.IsEmpty()) {
        in->SetPrettyName(value);
      }

      GetValueForTag(xmlDoc, NS_LITERAL_STRING("NNTP_Use_Sicily"), value);
      bool secAuth = (bool)value.ToInteger(&errorCode, 16);
      authMethod = secAuth ? nsMsgAuthMethod::secure :
                             nsMsgAuthMethod::passwordCleartext;
      in->SetAuthMethod(authMethod);

      IMPORT_LOG2("Created NNTP server named: %S, userName: %S\n",
                  serverName.get(), userName.get());

      // We have a server, create an account.
      nsCOMPtr<nsIMsgAccount> account;
      rv = pMgr->CreateAccount(getter_AddRefs(account));
      if (NS_SUCCEEDED(rv) && account) {
        rv = account->SetIncomingServer(in);

        IMPORT_LOG0("Created an account and set the NNTP server "
                    "as the incoming server\n");

        // Fiddle with the identities
        SetIdentities(pMgr, account, xmlDoc, userName, authMethod, true);
        result = true;
        if (ppAccount)
          account.forget(ppAccount);
      }
    }
  }
  else if (NS_SUCCEEDED(rv) && in) {
    // for the existing server...
    nsCOMPtr<nsIMsgAccount> account;
    rv = pMgr->FindAccountForServer(in, getter_AddRefs(account));
    if (NS_SUCCEEDED(rv) && account) {
      IMPORT_LOG0("Using existing account and set the "
                  "NNTP server as the incoming server\n");
      // Fiddle with the identities
      in->GetAuthMethod(&authMethod);
      SetIdentities(pMgr, account, xmlDoc, userName, authMethod, true);
      result = true;
      if (ppAccount)
        account.forget(ppAccount);
    }
  }
  else
    result = true;
  return result;
}

void WMSettings::SetIdentities(nsIMsgAccountManager *pMgr, nsIMsgAccount *pAcc,
                               nsIDOMDocument *xmlDoc, nsAutoString &inUserName,
                               PRInt32 authMethodIncoming, bool isNNTP)
{
  // Get the relevant information for an identity
  // BUG 470587. Don't set this: id->SetIdentityName(fullName);
  nsresult rv;
  nsAutoString value;

  nsCOMPtr<nsIMsgIdentity> id;
  rv = pMgr->CreateIdentity(getter_AddRefs(id));
  if (id) {
    IMPORT_LOG0("Created identity and added to the account\n");
    GetValueForTag(xmlDoc, isNNTP ?
      NS_LITERAL_STRING("NNTP_Display_Name") :
      NS_LITERAL_STRING("SMTP_Display_Name"), value);
    id->SetFullName(value);
    IMPORT_LOG1("\tname: %S\n", value.get());

    GetValueForTag(xmlDoc, isNNTP ?
      NS_LITERAL_STRING("NNTP_Organization_Name") :
      NS_LITERAL_STRING("SMTP_Organization_Name"), value);
    id->SetOrganization(value);

    GetValueForTag(xmlDoc, isNNTP ?
      NS_LITERAL_STRING("NNTP_Email_Address") :
      NS_LITERAL_STRING("SMTP_Email_Address"), value);
    id->SetEmail(NS_ConvertUTF16toUTF8(value));
    IMPORT_LOG1("\temail: %S\n", value.get());

    GetValueForTag(xmlDoc,  isNNTP ?
      NS_LITERAL_STRING("NNTP_Reply_To_Email_Address") :
      NS_LITERAL_STRING("SMTP_Reply_To_Email_Address"), value);
    id->SetReplyTo(NS_ConvertUTF16toUTF8(value));

    // Windows users are used to top style quoting.
    id->SetReplyOnTop(isNNTP ? 0 : 1);
    pAcc->AddIdentity(id);
  }

  if (!isNNTP)  // NNTP does not use SMTP in OE or TB
    SetSmtpServer(xmlDoc, id, inUserName, authMethodIncoming);
}

void WMSettings::SetSmtpServer(nsIDOMDocument *xmlDoc, nsIMsgIdentity *id,
                               nsAutoString& inUserName, PRInt32 authMethodIncoming)
{
  nsresult errorCode;

  // set the id.smtpserver accordingly
  if (!id)
    return;
  nsCString smtpServerKey, userName;
  nsAutoString value, smtpName;
  if (NS_FAILED(GetValueForTag(xmlDoc, NS_LITERAL_STRING("SMTP_Server"), smtpName)))
    return;

  // first we have to calculate the smtp user name which is based on sicily
  // smtp user name depends on sicily which may or not exist
  PRInt32 useSicily = 0;
  GetValueForTag(xmlDoc, NS_LITERAL_STRING("SMTP_Use_Sicily"), value);
  useSicily = (PRInt32)value.ToInteger(&errorCode,16);

  switch (useSicily) {
    case 1 : case 3 :
      GetValueForTag(xmlDoc, NS_LITERAL_STRING("SMTP_User_Name"), value);
      CopyUTF16toUTF8(value, userName);
      break;
    case 2 :
      CopyUTF16toUTF8(inUserName, userName);
      break;
    default :
      break; // initial userName == ""
  }

  nsresult rv;
  nsCOMPtr<nsISmtpService>
    smtpService(do_GetService(NS_SMTPSERVICE_CONTRACTID, &rv));
  if (NS_SUCCEEDED(rv) && smtpService) {
    nsCOMPtr<nsISmtpServer> extgServer;
    // don't try to make another server
    // regardless if username doesn't match
    rv = smtpService->FindServer(userName.get(),
                                 NS_ConvertUTF16toUTF8(smtpName).get(),
                                 getter_AddRefs(extgServer));
    if (NS_SUCCEEDED(rv) && extgServer) {
      // set our account keyed to this smptserver key
      extgServer->GetKey(getter_Copies(smtpServerKey));
      id->SetSmtpServerKey(smtpServerKey);

      IMPORT_LOG1("SMTP server already exists: %S\n", smtpName);
    }
    else {
      nsCOMPtr<nsISmtpServer> smtpServer;
      rv = smtpService->CreateSmtpServer(getter_AddRefs(smtpServer));
      if (NS_SUCCEEDED(rv) && smtpServer) {
        GetValueForTag(xmlDoc, NS_LITERAL_STRING("SMTP_Port"), value);
        if (!value.IsEmpty()) {
          smtpServer->SetPort(value.ToInteger(&errorCode,16));
        }

        GetValueForTag(xmlDoc, NS_LITERAL_STRING("SMTP_Secure_Connection"),
                       value);
        if (!value.IsEmpty()) {
          if (value.ToInteger(&errorCode, 16) == 1)
            smtpServer->SetSocketType(nsMsgSocketType::SSL);
          else
            smtpServer->SetSocketType(nsMsgSocketType::plain);
        }
        smtpServer->SetUsername(userName);
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

        smtpServer->SetHostname(NS_ConvertUTF16toUTF8(smtpName));

        smtpServer->GetKey(getter_Copies(smtpServerKey));
        id->SetSmtpServerKey(smtpServerKey);

        IMPORT_LOG1("Created new SMTP server: %S\n", smtpName);
      }
    }
  }
}
