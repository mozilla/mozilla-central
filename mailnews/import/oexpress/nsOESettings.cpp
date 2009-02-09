/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
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
 *   Pierre Phaneuf <pp@ludusdesign.com>
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

  Outlook Express (Win32) settings

*/

#include "nsCOMPtr.h"
#include "nscore.h"
#include "nsReadableUtils.h"
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

class OESettings {
public:
  static HKEY Find50Key( void);
  static HKEY Find40Key( void);
  static HKEY FindAccountsKey( void);

  static PRBool DoImport( nsIMsgAccount **ppAccount);

  static PRBool DoIMAPServer( nsIMsgAccountManager *pMgr, HKEY hKey, char *pServerName, nsIMsgAccount **ppAccount);
  static PRBool DoPOP3Server( nsIMsgAccountManager *pMgr, HKEY hKey, char *pServerName, nsIMsgAccount **ppAccount);
  static PRBool DoNNTPServer( nsIMsgAccountManager *pMgr, HKEY hKey, char *pServerName, nsIMsgAccount **ppAccount);

  static void SetIdentities( nsIMsgAccountManager *pMgr, nsIMsgAccount *pAcc, HKEY hKey,
                             char *pIncomgUserName, PRBool useSecAuth, PRBool isNNTP);
  static void SetSmtpServer( char *pSmtpServer, HKEY hKey, nsIMsgIdentity *id,
                             char *pIncomgUserName, PRBool useSecAuth);
  static nsresult GetAccountName(HKEY hKey, char *defaultName, nsString &acctName);
};

static PRInt32 checkNewMailTime;// OE global setting, let's default to 30
static PRBool  checkNewMail;    // OE global setting, let's default to PR_FALSE
                                // This won't cause unwanted autodownloads-
                                // user can set prefs after import

////////////////////////////////////////////////////////////////////////
nsresult nsOESettings::Create(nsIImportSettings** aImport)
{
    NS_PRECONDITION(aImport != nsnull, "null ptr");
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

NS_IMETHODIMP nsOESettings::AutoLocate(PRUnichar **description, nsIFile **location, PRBool *_retval)
{
  NS_PRECONDITION(description != nsnull, "null ptr");
  NS_PRECONDITION(_retval != nsnull, "null ptr");
  if (!description || !_retval)
    return( NS_ERROR_NULL_POINTER);

  *description = nsOEStringBundle::GetStringByID( OEIMPORT_NAME);
  *_retval = PR_FALSE;

  if (location)
    *location = nsnull;
  HKEY  key;
  key = OESettings::Find50Key();
  if (key != nsnull) {
    *_retval = PR_TRUE;
    ::RegCloseKey( key);
  }
  else {
    key = OESettings::Find40Key();
    if (key != nsnull) {
      *_retval = PR_TRUE;
      ::RegCloseKey( key);
    }
  }
  if (*_retval) {
    key = OESettings::FindAccountsKey();
    if (key == nsnull) {
      *_retval = PR_FALSE;
    }
    else {
      ::RegCloseKey( key);
    }
  }

  return( NS_OK);
}

NS_IMETHODIMP nsOESettings::SetLocation(nsIFile *location)
{
  return( NS_OK);
}

NS_IMETHODIMP nsOESettings::Import(nsIMsgAccount **localMailAccount, PRBool *_retval)
{
  NS_PRECONDITION( _retval != nsnull, "null ptr");

  if (OESettings::DoImport( localMailAccount)) {
    *_retval = PR_TRUE;
    IMPORT_LOG0( "Settings import appears successful\n");
  }
  else {
    *_retval = PR_FALSE;
    IMPORT_LOG0( "Settings import returned FALSE\n");
  }

  return( NS_OK);
}

HKEY OESettings::FindAccountsKey( void)
{
  HKEY  sKey;

  if (::RegOpenKeyEx( HKEY_CURRENT_USER, "Identities", 0, KEY_QUERY_VALUE, &sKey) == ERROR_SUCCESS) {
    BYTE *  pBytes = nsOERegUtil::GetValueBytes( sKey, "Default User ID");
    ::RegCloseKey( sKey);
    if (pBytes) {
      nsCString  key( "Identities\\");
      key += (const char *)pBytes;
      nsOERegUtil::FreeValueBytes( pBytes);
      key += "\\Software\\Microsoft\\Internet Account Manager\\Accounts";
      if (::RegOpenKeyEx( HKEY_CURRENT_USER, key.get(), 0, KEY_QUERY_VALUE | KEY_ENUMERATE_SUB_KEYS, &sKey) == ERROR_SUCCESS) {
        return( sKey);
      }
    }
  }

  if (::RegOpenKeyEx( HKEY_CURRENT_USER, "Software\\Microsoft\\Internet Account Manager\\Accounts", 0, KEY_QUERY_VALUE | KEY_ENUMERATE_SUB_KEYS, &sKey) == ERROR_SUCCESS) {
    return( sKey);
  }

  return( nsnull);
}

HKEY OESettings::Find50Key( void)
{
  PRBool    success = PR_FALSE;
  HKEY    sKey;

  if (::RegOpenKeyEx( HKEY_CURRENT_USER, "Identities", 0, KEY_QUERY_VALUE, &sKey) == ERROR_SUCCESS) {
    BYTE *  pBytes = nsOERegUtil::GetValueBytes( sKey, "Default User ID");
    ::RegCloseKey( sKey);
    if (pBytes) {
      nsCString  key( "Identities\\");
      key += (const char *)pBytes;
      nsOERegUtil::FreeValueBytes( pBytes);
      key += "\\Software\\Microsoft\\Outlook Express\\5.0";
      if (::RegOpenKeyEx( HKEY_CURRENT_USER, key.get(), 0, KEY_QUERY_VALUE, &sKey) == ERROR_SUCCESS) {
        return( sKey);
      }
    }
  }

  return( nsnull);
}

HKEY OESettings::Find40Key( void)
{
  HKEY  sKey;
  if (::RegOpenKeyEx( HKEY_CURRENT_USER, "Software\\Microsoft\\Outlook Express", 0, KEY_QUERY_VALUE, &sKey) == ERROR_SUCCESS) {
    return( sKey);
  }

  return( nsnull);
}

PRBool OESettings::DoImport( nsIMsgAccount **ppAccount)
{
  HKEY  hKey = FindAccountsKey();
  if (hKey == nsnull) {
    IMPORT_LOG0( "*** Error finding Outlook Express registry account keys\n");
    return( PR_FALSE);
  }

  nsresult  rv;

  nsCOMPtr<nsIMsgAccountManager> accMgr =
           do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
    if (NS_FAILED(rv)) {
    IMPORT_LOG0( "*** Failed to create a account manager!\n");
    ::RegCloseKey( hKey);
    return( PR_FALSE);
  }

  HKEY    subKey;
  nsCString  defMailName;
  // OE has default mail account here when it has been
  // set up by transfer or has multiple identities
  // look below for orig code that looked in new OE installs
  if (::RegOpenKeyEx(HKEY_CURRENT_USER, "Identities", 0,
                     KEY_QUERY_VALUE, &subKey) == ERROR_SUCCESS) {
    BYTE *  pBytes = nsOERegUtil::GetValueBytes(subKey, "Default User ID");
    ::RegCloseKey( subKey);
    if (pBytes) {
      nsCString  key( "Identities\\");
      key += (const char *)pBytes;
      nsOERegUtil::FreeValueBytes( pBytes);
      key += "\\Software\\Microsoft\\Internet Account Manager";
      if (::RegOpenKeyEx(HKEY_CURRENT_USER, key.get(), 0,
                         KEY_QUERY_VALUE , &subKey) == ERROR_SUCCESS) {
        BYTE * pBytes = nsOERegUtil::GetValueBytes(subKey,
                                                   "Default Mail Account");
        ::RegCloseKey( subKey);
        if (pBytes) {
          defMailName = (const char *)pBytes;
          nsOERegUtil::FreeValueBytes( pBytes);
        }
      }
    }
  }

  // else it must be here in original install location from orig code
  if (defMailName.IsEmpty()) {
    if (::RegOpenKeyEx(HKEY_CURRENT_USER,
                       "Software\\Microsoft\\Outlook Express",  0,
                       KEY_QUERY_VALUE, &subKey) == ERROR_SUCCESS) {
      BYTE *  pBytes = nsOERegUtil::GetValueBytes(subKey,
                                                  "Default Mail Account");
      ::RegCloseKey( subKey);
      if (pBytes) {
        defMailName = (const char *)pBytes;
        nsOERegUtil::FreeValueBytes( pBytes);
      }
    }
  }
  // else defmailname will be "".  No big deal.

  // 'poll for messages' setting in OE is a global setting
  // in OE options general tab and in following global OE
  // registry location.
  // for all accounts poll interval is a 32 bit value, 0 for
  // "don't poll", else milliseconds
  HKEY    subSubKey;

  subKey = Find50Key();
  if (!subKey )
    subKey = Find40Key();
  // above key not critical

  checkNewMailTime = 30;
  checkNewMail = PR_FALSE;
  if (subKey){
    if (::RegOpenKeyEx(subKey, "Mail", 0, KEY_QUERY_VALUE,
                       &subSubKey) == ERROR_SUCCESS) {
      ::RegCloseKey( subKey);
      BYTE *  pBytes = nsOERegUtil::GetValueBytes( subSubKey, "Poll For Mail");
      ::RegCloseKey( subSubKey);
      if (pBytes) {
        if (*(PRInt32 *)pBytes != -1){
          checkNewMail = PR_TRUE;
          checkNewMailTime = *(PRInt32 *)pBytes / 60000;
        }
        nsOERegUtil::FreeValueBytes( pBytes);
      }
    }
  }

  // Iterate the accounts looking for POP3 & IMAP accounts...
  // Ignore LDAP for now!
  DWORD      index = 0;
  DWORD      numChars;
  TCHAR      keyName[256];
  LONG       result = ERROR_SUCCESS;
  BYTE *     pBytes;
  int        accounts = 0;
  nsCString  keyComp;

  while (result == ERROR_SUCCESS) {
    numChars = 256;
    result = ::RegEnumKeyEx( hKey, index, keyName, &numChars, NULL, NULL, NULL, NULL);
    index++;
    if (result == ERROR_SUCCESS) {
      if (::RegOpenKeyEx( hKey, keyName, 0, KEY_QUERY_VALUE, &subKey) == ERROR_SUCCESS) {
        // Get the values for this account.
        IMPORT_LOG1( "Opened Outlook Express account: %s\n", (char *)keyName);

        nsIMsgAccount  *anAccount = nsnull;
        pBytes = nsOERegUtil::GetValueBytes( subKey, "IMAP Server");
        if (pBytes) {
          if (DoIMAPServer( accMgr, subKey, (char *)pBytes, &anAccount))
            accounts++;
          nsOERegUtil::FreeValueBytes( pBytes);
        }

        pBytes = nsOERegUtil::GetValueBytes( subKey, "NNTP Server");
        if (pBytes) {
          if (DoNNTPServer( accMgr, subKey, (char *)pBytes, &anAccount))
            accounts++;
          nsOERegUtil::FreeValueBytes( pBytes);
        }

        pBytes = nsOERegUtil::GetValueBytes( subKey, "POP3 Server");
        if (pBytes) {
            if (DoPOP3Server( accMgr, subKey, (char *)pBytes, &anAccount)) {
              accounts++;
          }
          nsOERegUtil::FreeValueBytes( pBytes);
        }

        if (anAccount) {
          // Is this the default account?
          keyComp = keyName;
          if (keyComp.Equals( defMailName)) {
            accMgr->SetDefaultAccount( anAccount);
          }
          NS_RELEASE( anAccount);
        }

        ::RegCloseKey( subKey);
      }
    }
  }
  ::RegCloseKey( hKey);

  // Now save the new acct info to pref file.
  rv = accMgr->SaveAccountInfo();
  NS_ASSERTION(NS_SUCCEEDED(rv), "Can't save account info to pref file");

  return( accounts != 0);
}

nsresult OESettings::GetAccountName(HKEY hKey, char *defaultName, nsString &acctName)
{
  BYTE *pAccName = nsOERegUtil::GetValueBytes( hKey, "Account Name");
  nsresult rv = NS_OK;
  if (pAccName) {
    rv = nsMsgI18NConvertToUnicode(nsMsgI18NFileSystemCharset(),
                                   nsDependentCString((const char *)pAccName), acctName);
    nsOERegUtil::FreeValueBytes( pAccName);
  }
  else
    acctName.AssignASCII(defaultName);
  return rv;
}

PRBool OESettings::DoIMAPServer( nsIMsgAccountManager *pMgr, HKEY hKey, char *pServerName, nsIMsgAccount **ppAccount)
{
  PRBool useSecAuth;    // Secure Password Authentication
  if (ppAccount)
    *ppAccount = nsnull;

  char * pUserName;
  pUserName = (char *)nsOERegUtil::GetValueBytes(hKey, "IMAP User Name");
  if (!pUserName)
    return( PR_FALSE);

  PRBool result = PR_FALSE;

  // I now have a user name/server name pair, find out if it already exists?
  nsCOMPtr<nsIMsgIncomingServer> in;
  nsresult rv = pMgr->FindServer(nsDependentCString(pUserName),
                                 nsDependentCString(pServerName),
                                 NS_LITERAL_CSTRING("imap"),
                                 getter_AddRefs(in));
  if (NS_FAILED( rv) || (in == nsnull)) {
    // Create the incoming server and an account for it?
    rv = pMgr->CreateIncomingServer(nsDependentCString(pUserName),
                                    nsDependentCString(pServerName),
                                    NS_LITERAL_CSTRING("imap"),
                                    getter_AddRefs(in));
    if (NS_SUCCEEDED( rv) && in) {
      BYTE * pRootFolder = nsOERegUtil::GetValueBytes(hKey, "IMAP Root Folder");
      if (pRootFolder)
      {
        nsCOMPtr<nsIImapIncomingServer> imapServer = do_QueryInterface(in);
        imapServer->SetServerDirectory(nsDependentCString((const char *) pRootFolder));
        nsOERegUtil::FreeValueBytes(pRootFolder);
      }

      BYTE * pSecureConnection = nsOERegUtil::GetValueBytes(hKey, "IMAP Secure Connection");
      if (pSecureConnection)
      {
        if (*pSecureConnection)
          in->SetSocketType(nsIMsgIncomingServer::useSSL);
        nsOERegUtil::FreeValueBytes(pSecureConnection);
      }

      BYTE * pPort = nsOERegUtil::GetValueBytes(hKey, "IMAP Port");
      if (pPort)
      {
        in->SetPort(*(PRInt32 *) pPort);
        nsOERegUtil::FreeValueBytes(pPort);
      }

      BYTE * pBytesTemp = nsOERegUtil::GetValueBytes(hKey, "IMAP Use Sicily");
      if (pBytesTemp)
      {
        in->SetUseSecAuth(*(PRBool *)pBytesTemp);
        useSecAuth = *(PRBool *)pBytesTemp;
        nsOERegUtil::FreeValueBytes(pBytesTemp);
      }
      else {
        in->SetUseSecAuth(PR_FALSE);
        useSecAuth = PR_FALSE;
      }

      in->SetDoBiff(checkNewMail);
      in->SetBiffMinutes(checkNewMailTime);

      IMPORT_LOG2("Created IMAP server named: %s, userName: %s\n",
                   pServerName, pUserName);

      nsString prettyName;
      if (NS_SUCCEEDED(GetAccountName(hKey, pServerName, prettyName)))
        rv = in->SetPrettyName(prettyName);

      // We have a server, create an account.
      nsCOMPtr<nsIMsgAccount> account;
      rv = pMgr->CreateAccount(getter_AddRefs( account));
      if (NS_SUCCEEDED( rv) && account) {
        rv = account->SetIncomingServer(in);

        IMPORT_LOG0("Created an account and set the IMAP server as the incoming server\n");

        // Fiddle with the identities
        SetIdentities(pMgr, account, hKey, pUserName, useSecAuth, PR_FALSE);
        result = PR_TRUE;
        if (ppAccount)
          account->QueryInterface(NS_GET_IID(nsIMsgAccount), (void **)ppAccount);
      }
    }
  }
  else if (NS_SUCCEEDED(rv) && in) {
    // for an existing server we create another identity,
    //  TB lists under 'manage identities'
    nsCOMPtr<nsIMsgAccount> account;
    rv = pMgr->FindAccountForServer(in, getter_AddRefs( account));
    if (NS_SUCCEEDED( rv) && account) {
      IMPORT_LOG0("Created an identity and added to existing IMAP incoming server\n");
      // Fiddle with the identities
      in->GetUseSecAuth(&useSecAuth);
      SetIdentities(pMgr, account, hKey, pUserName, useSecAuth, PR_FALSE);
      result = PR_TRUE;
      if (ppAccount)
        account->QueryInterface(NS_GET_IID(nsIMsgAccount),
                                 (void **)ppAccount);
    }
  }
  else
    result = PR_TRUE;
  nsOERegUtil::FreeValueBytes((BYTE *) pUserName);
  return( result);
}

PRBool OESettings::DoPOP3Server( nsIMsgAccountManager *pMgr, HKEY hKey, char *pServerName, nsIMsgAccount **ppAccount)
{
  PRBool useSecAuth;    // Secure Password Authentication
  if (ppAccount)
    *ppAccount = nsnull;

  char * pUserName;
  pUserName = (char *)nsOERegUtil::GetValueBytes( hKey, "POP3 User Name");
  if (!pUserName)
    return( PR_FALSE);

  PRBool result = PR_FALSE;

  // I now have a user name/server name pair, find out if it already exists?
  nsCOMPtr<nsIMsgIncomingServer> in;
  nsresult rv = pMgr->FindServer(nsDependentCString(pUserName),
                                 nsDependentCString(pServerName),
                                 NS_LITERAL_CSTRING("pop3"),
                                 getter_AddRefs( in));
  if (NS_FAILED( rv) || (in == nsnull)) {
    // Create the incoming server and an account for it?
    rv = pMgr->CreateIncomingServer(nsDependentCString(pUserName),
                                    nsDependentCString(pServerName),
                                    NS_LITERAL_CSTRING("pop3"),
                                    getter_AddRefs( in));
    if (NS_SUCCEEDED( rv) && in) {
      BYTE * pSecureConnection = nsOERegUtil::GetValueBytes( hKey, "POP3 Secure Connection");
      if (pSecureConnection)
      {
        if (*pSecureConnection)
          in->SetSocketType(nsIMsgIncomingServer::useSSL);
        nsOERegUtil::FreeValueBytes(pSecureConnection);
      }

      BYTE * pPort = nsOERegUtil::GetValueBytes( hKey, "POP3 Port");
      if (pPort)
      {
        in->SetPort(*(PRInt32 *) pPort);
        nsOERegUtil::FreeValueBytes(pPort);
      }

      BYTE * pBytesTemp = nsOERegUtil::GetValueBytes( hKey, "POP3 Use Sicily");
      if (pBytesTemp)
      {
        in->SetUseSecAuth(*(PRBool *)pBytesTemp );
        useSecAuth = *(PRBool *)pBytesTemp;
        nsOERegUtil::FreeValueBytes(pBytesTemp);
      }
      else {
        in->SetUseSecAuth( PR_FALSE);
        useSecAuth = PR_FALSE;
      }

      in->SetDoBiff(checkNewMail);
      in->SetBiffMinutes(checkNewMailTime);
      nsCOMPtr<nsIPop3IncomingServer> pop3Server = do_QueryInterface(in);
      if (pop3Server) {
        // set local folders as the Inbox to use for this POP3 server
        nsCOMPtr<nsIMsgIncomingServer> localFoldersServer;
        pMgr->GetLocalFoldersServer(getter_AddRefs(localFoldersServer));

        if (!localFoldersServer)
        {
          // If Local Folders does not exist already, create it

          if (NS_FAILED(pMgr->CreateLocalMailAccount())) {
            IMPORT_LOG0("*** Failed to create Local Folders!\n");
            return PR_FALSE;
          }

          pMgr->GetLocalFoldersServer(getter_AddRefs(localFoldersServer));
        }

        // now get the account for this server
        nsCOMPtr<nsIMsgAccount> localFoldersAccount;
        pMgr->FindAccountForServer(localFoldersServer, getter_AddRefs(localFoldersAccount));
        if (localFoldersAccount)
        {
          nsCString localFoldersAcctKey;
          localFoldersAccount->GetKey(localFoldersAcctKey);
          pop3Server->SetDeferredToAccount(localFoldersAcctKey);
        }

        pBytesTemp = nsOERegUtil::GetValueBytes(hKey, "POP3 Skip Account");
        if (pBytesTemp)
        {
        // OE:0=='Include this account when receiving mail or synchronizing'==
        // TB:1==AM:Server:advanced:Include this server when getting new mail
          pop3Server->SetDeferGetNewMail(*pBytesTemp == 0);
          nsOERegUtil::FreeValueBytes(pBytesTemp);
        }
        else
          pop3Server->SetDeferGetNewMail(PR_FALSE);
        pBytesTemp = nsOERegUtil::GetValueBytes(hKey, "Leave Mail On Server");
        if (pBytesTemp)
        {
          pop3Server->SetLeaveMessagesOnServer(*pBytesTemp == 1);
          nsOERegUtil::FreeValueBytes(pBytesTemp);
        }
        pBytesTemp = nsOERegUtil::GetValueBytes(hKey, "Remove When Deleted");
        if (pBytesTemp)
        {
          pop3Server->SetDeleteMailLeftOnServer(*pBytesTemp == 1);
          nsOERegUtil::FreeValueBytes(pBytesTemp);
        }
        pBytesTemp = nsOERegUtil::GetValueBytes(hKey, "Remove When Expired");
        if (pBytesTemp)
        {
          pop3Server->SetDeleteByAgeFromServer(*pBytesTemp == 1);
          nsOERegUtil::FreeValueBytes(pBytesTemp);
        }
        pBytesTemp = nsOERegUtil::GetValueBytes(hKey, "Expire Days");
        if (pBytesTemp)
        {
          pop3Server->SetNumDaysToLeaveOnServer(*(PRInt32*)pBytesTemp );
          nsOERegUtil::FreeValueBytes(pBytesTemp);
        }
      }
      IMPORT_LOG2("Created POP3 server named: %s, userName: %s\n",
                   pServerName, pUserName);
      nsString prettyName;
      if (NS_SUCCEEDED(GetAccountName(hKey, pServerName, prettyName)))
        rv = in->SetPrettyName( prettyName);

      // We have a server, create an account.
      nsCOMPtr<nsIMsgAccount>  account;
      rv = pMgr->CreateAccount(getter_AddRefs( account));
      if (NS_SUCCEEDED( rv) && account) {
        rv = account->SetIncomingServer(in);
        IMPORT_LOG0("Created a new account and set the incoming server to the POP3 server.\n");

        // Fiddle with the identities
        SetIdentities(pMgr, account, hKey, pUserName, useSecAuth, PR_FALSE);
        result = PR_TRUE;
        if (ppAccount)
          account->QueryInterface(NS_GET_IID(nsIMsgAccount),
                                   (void **)ppAccount);
      }
    }
  } 
  else if (NS_SUCCEEDED(rv) && in) {
    IMPORT_LOG2("Existing POP3 server named: %s, userName: %s\n",
                pServerName, pUserName);
    // for an existing server we create another identity,
    // TB listed under 'manage identities'
    nsCOMPtr<nsIMsgAccount>  account;
    rv = pMgr->FindAccountForServer(in, getter_AddRefs( account));
    if (NS_SUCCEEDED(rv) && account) {
      IMPORT_LOG0("Created identity and added to existing POP3 incoming server.\n");
      // Fiddle with the identities
      in->GetUseSecAuth(&useSecAuth);
      SetIdentities(pMgr, account, hKey, pUserName, useSecAuth, PR_FALSE);
      result = PR_TRUE;
      if (ppAccount)
        account->QueryInterface(NS_GET_IID(nsIMsgAccount), (void **)ppAccount);
    }
  }
  else
    result = PR_TRUE;
  nsOERegUtil::FreeValueBytes((BYTE *) pUserName);
  return result;
}

PRBool OESettings::DoNNTPServer( nsIMsgAccountManager *pMgr, HKEY hKey,
                                char *pServerName, nsIMsgAccount **ppAccount)
{
  if (ppAccount)
    *ppAccount = nsnull;

  char * pUserName;
  // this only exists if NNTP server requires it or not anon login
  pUserName = (char *)nsOERegUtil::GetValueBytes(hKey, "NNTP User Name");

  PRBool result = PR_FALSE;

  // I now have a user name/server name pair, find out if it already exists?
  // NNTP can have empty user name.  This is wild card in findserver
  nsCOMPtr<nsIMsgIncomingServer> in;
  nsresult rv = pMgr->FindServer(nsDependentCString(""),
                                 nsDependentCString(pServerName),
                                 NS_LITERAL_CSTRING("nntp"),
                                 getter_AddRefs(in));
  if (NS_FAILED( rv) || (in == nsnull)) {
    // Create the incoming server and an account for it?
    rv = pMgr->CreateIncomingServer(nsDependentCString(""),
                                    nsDependentCString(pServerName),
                                    NS_LITERAL_CSTRING("nntp"),
                                    getter_AddRefs(in));
    if (NS_SUCCEEDED( rv) && in) {
      BYTE * pBytesTemp = nsOERegUtil::GetValueBytes(hKey, "NNTP Port");
      if (pBytesTemp && *(PRInt32 *)pBytesTemp != 119)
        in->SetPort(*(PRInt32 *) pBytesTemp);
      nsOERegUtil::FreeValueBytes(pBytesTemp);

      // do nntpincomingserver stuff
      nsCOMPtr<nsINntpIncomingServer> nntpServer = do_QueryInterface(in);
      if (nntpServer && pUserName && (strnlen(pUserName, 2) > 0)) {
        nntpServer->SetPushAuth(PR_TRUE);
        in->SetUsername(nsDependentCString(pUserName));
      }

      IMPORT_LOG2("Created NNTP server named: %s, userName: %s\n",
                   pServerName, pUserName? pUserName : "");

      nsString prettyName;
      if (NS_SUCCEEDED(GetAccountName(hKey, pServerName, prettyName)))
        rv = in->SetPrettyName(prettyName);

      // We have a server, create an account.
      nsCOMPtr<nsIMsgAccount> account;
      rv = pMgr->CreateAccount(getter_AddRefs( account));
      if (NS_SUCCEEDED(rv) && account) {
        rv = account->SetIncomingServer(in);

        IMPORT_LOG0("Created an account and set the NNTP server as the incoming server\n");

        // Fiddle with the identities
        SetIdentities(pMgr, account, hKey, pUserName, 0, PR_TRUE);
        result = PR_TRUE;
        if (ppAccount)
          account->QueryInterface(NS_GET_IID(nsIMsgAccount), (void **)ppAccount);
      }
    }
  }
  else if (NS_SUCCEEDED(rv) && in) {
    // for the existing server...
    nsCOMPtr<nsIMsgAccount> account;
    rv = pMgr->FindAccountForServer(in, getter_AddRefs( account));
    if (NS_SUCCEEDED( rv) && account) {
      IMPORT_LOG0("Using existing account and set the NNTP server as the incoming server\n");
      // Fiddle with the identities
      SetIdentities(pMgr, account, hKey, pUserName, 0, PR_TRUE);
      result = PR_TRUE;
      if (ppAccount)
        account->QueryInterface(NS_GET_IID(nsIMsgAccount),
                                 (void **)ppAccount);
    }
  }
  else
    result = PR_TRUE;
  nsOERegUtil::FreeValueBytes((BYTE *) pUserName);
  return result;
}

void OESettings::SetIdentities(nsIMsgAccountManager *pMgr, nsIMsgAccount *pAcc,
                               HKEY hKey, char *pIncomgUserName,
                               PRBool useSecAuth, PRBool isNNTP )
{
  // Get the relevant information for an identity
  char *pSmtpServer = (char *)nsOERegUtil::GetValueBytes(hKey, "SMTP Server");
  char *pName = (char *)nsOERegUtil::GetValueBytes(hKey, isNNTP ? "NNTP Display Name" : "SMTP Display Name");
  char *pEmail = (char *)nsOERegUtil::GetValueBytes(hKey, isNNTP ? "NNTP Email Address" : "SMTP Email Address");
  char *pReply = (char *)nsOERegUtil::GetValueBytes(hKey, isNNTP ? "NNTP Reply To Email Address" : "SMTP Reply To Email Address");
  char *pOrgName = (char *)nsOERegUtil::GetValueBytes(hKey, isNNTP ? "NNTP Organization Name" : "SMTP Organization Name");

  nsresult rv;

    nsCOMPtr<nsIMsgIdentity> id;
    rv = pMgr->CreateIdentity(getter_AddRefs(id));
    if (id) {
      nsAutoString fullName, organization;
      rv = nsMsgI18NConvertToUnicode(nsMsgI18NFileSystemCharset(),
                                     nsCString(pName), fullName);
      if (NS_SUCCEEDED(rv))
        id->SetFullName(fullName);
// BUG 470587. Don't set this: id->SetIdentityName(fullName);

      rv = nsMsgI18NConvertToUnicode(nsMsgI18NFileSystemCharset(),
                                     nsCString(pOrgName), organization);
      if (NS_SUCCEEDED(rv))
        id->SetOrganization(organization);

      id->SetEmail(nsCString(pEmail));
      if (pReply)
        id->SetReplyTo(nsCString(pReply));

      // Outlook Express users are used to top style quoting.
      id->SetReplyOnTop(isNNTP ? 0 : 1);
      pAcc->AddIdentity(id);

      IMPORT_LOG0("Created identity and added to the account\n");
      IMPORT_LOG1("\tname: %s\n", pName);
      IMPORT_LOG1("\temail: %s\n", pEmail);
    }

  if (!isNNTP)  // NNTP does not use SMTP in OE or TB
    SetSmtpServer( pSmtpServer, hKey, id, pIncomgUserName, useSecAuth);

  nsOERegUtil::FreeValueBytes((BYTE *)pName);
  nsOERegUtil::FreeValueBytes((BYTE *)pSmtpServer);
  nsOERegUtil::FreeValueBytes((BYTE *)pEmail);
  nsOERegUtil::FreeValueBytes((BYTE *)pReply);
}

void OESettings::SetSmtpServer(char *pSmtpServer, HKEY hKey,
                               nsIMsgIdentity *id, char *pIncomgUserName,
                               PRBool useSecAuth)
{
  // set the id.smtpserver accordingly
  // first we have to calculate the smtp user name which is based on sicily
  if (!hKey || !id || !pIncomgUserName || !pSmtpServer)
    return;
  nsCString smtpServerKey, userName;
  BYTE *pBytes;
  // smtp user name depends on sicily which may or not exist
  PRInt32 useSicily = 0;
  if (pBytes = nsOERegUtil::GetValueBytes(hKey, "SMTP Use Sicily")){
    useSicily = *(PRInt32 *)pBytes;
    nsOERegUtil::FreeValueBytes(pBytes);
  }
  switch (useSicily) {
    case 1 : case 3 :
      // has to go in whether empty or no
      // shouldn't be empty but better safe than sorry
      if (pBytes = nsOERegUtil::GetValueBytes(hKey, "SMTP User Name")){
        userName = (char *)pBytes;  // this may be empty; shouldn't be non-existent
        nsOERegUtil::FreeValueBytes(pBytes);
      }
      break;
    case 2 :
      userName = pIncomgUserName;
      break;
    default :
      break; // initial userName == ""
  }

  nsresult rv;
  nsCOMPtr<nsISmtpService> smtpService(do_GetService(NS_SMTPSERVICE_CONTRACTID, &rv));
  if (NS_SUCCEEDED(rv) && smtpService) {
    nsCOMPtr<nsISmtpServer> foundServer;
    // don't try to make another server
    // regardless if username doesn't match
    rv = smtpService->FindServer(userName.get(), pSmtpServer,
                                 getter_AddRefs( foundServer));
    if (NS_SUCCEEDED( rv) && foundServer) {
      // set our account keyed to this smptserver key
      foundServer->GetKey(getter_Copies(smtpServerKey));
      id->SetSmtpServerKey(smtpServerKey);

      IMPORT_LOG1("SMTP server already exists: %s\n", pSmtpServer);
    }
    else {
      nsCOMPtr<nsISmtpServer> smtpServer;
      rv = smtpService->CreateSmtpServer(getter_AddRefs( smtpServer));
      if (NS_SUCCEEDED( rv) && smtpServer) {
        pBytes = nsOERegUtil::GetValueBytes(hKey, "SMTP Port");
        if (pBytes)
        {
          smtpServer->SetPort(*(PRInt32 *) pBytes);
          nsOERegUtil::FreeValueBytes(pBytes);
        }
        pBytes = nsOERegUtil::GetValueBytes(hKey,"SMTP Secure Connection");
        if (pBytes)
        {
          if (*(PRInt32 *)pBytes == 1)
            smtpServer->SetTrySSL(nsIMsgIncomingServer::useSSL);
          else
            smtpServer->SetTrySSL(nsIMsgIncomingServer::defaultSocket);
          nsOERegUtil::FreeValueBytes(pBytes);
        }
        smtpServer->SetUsername(userName);
        switch (useSicily) {
          case 1 :
            smtpServer->SetAuthMethod(1);
            smtpServer->SetUseSecAuth(PR_TRUE);  // useSecAuth
            break;
          case 2 : // requires authentication use incoming settings
            smtpServer->SetAuthMethod(1);
            smtpServer->SetUseSecAuth(useSecAuth);
            break;
          case 3 :
            smtpServer->SetAuthMethod(1);
            smtpServer->SetUseSecAuth(PR_FALSE);
            break;
          default:
            smtpServer->SetAuthMethod(0);
            smtpServer->SetUseSecAuth(PR_FALSE);
        }

        smtpServer->SetHostname(nsDependentCString(pSmtpServer));

        smtpServer->GetKey(getter_Copies(smtpServerKey));
        id->SetSmtpServerKey(smtpServerKey);

        IMPORT_LOG1("Created new SMTP server: %s\n", pSmtpServer);
      }
    }
  }
}
