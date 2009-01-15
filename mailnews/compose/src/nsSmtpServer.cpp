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
 *   Seth Spitzer <sspitzer@netscape.com>
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

#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "nsEscape.h"
#include "nsSmtpServer.h"
#include "nsNetUtil.h"
#include "nsIAuthPrompt.h"
#include "nsMsgUtils.h"
#include "nsIMsgAccountManager.h"
#include "nsMsgBaseCID.h"
#include "nsISmtpService.h"
#include "nsMsgCompCID.h"
#include "nsILoginInfo.h"
#include "nsILoginManager.h"

NS_IMPL_ADDREF(nsSmtpServer)
NS_IMPL_RELEASE(nsSmtpServer)
NS_INTERFACE_MAP_BEGIN(nsSmtpServer)
    NS_INTERFACE_MAP_ENTRY(nsISmtpServer)
    NS_INTERFACE_MAP_ENTRY(nsISupportsWeakReference)
    NS_INTERFACE_MAP_ENTRY_AMBIGUOUS(nsISupports, nsISmtpServer)
NS_INTERFACE_MAP_END

nsSmtpServer::nsSmtpServer():
    mKey("")
{
    m_logonFailed = PR_FALSE;
    getPrefs();
}

nsSmtpServer::~nsSmtpServer()
{
}

NS_IMETHODIMP
nsSmtpServer::GetKey(char * *aKey)
{
    if (!aKey) return NS_ERROR_NULL_POINTER;
    if (mKey.IsEmpty())
        *aKey = nsnull;
    else
        *aKey = ToNewCString(mKey);
    return NS_OK;
}

NS_IMETHODIMP
nsSmtpServer::SetKey(const char * aKey)
{
    NS_ASSERTION(aKey, "Bad key pointer");
    mKey = aKey;
    return getPrefs();
}

nsresult nsSmtpServer::getPrefs()
{
    nsresult rv;
    nsCOMPtr<nsIPrefService> prefs(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
    if (NS_FAILED(rv))
        return rv;

    nsCAutoString branchName;
    branchName.AssignLiteral("mail.smtpserver.");
    branchName += mKey;
    branchName.Append('.');
    rv = prefs->GetBranch(branchName.get(), getter_AddRefs(mPrefBranch));
    if (NS_FAILED(rv))
        return rv;

    if(!mDefPrefBranch) {
        branchName.AssignLiteral("mail.smtpserver.default.");
        rv = prefs->GetBranch(branchName.get(), getter_AddRefs(mDefPrefBranch));
        if (NS_FAILED(rv))
            return rv;
    }

    return NS_OK;
}

NS_IMETHODIMP
nsSmtpServer::GetHostname(nsACString &aHostname)
{
  nsCString result;
  nsresult rv = mPrefBranch->GetCharPref("hostname", getter_Copies(result));
  if (NS_FAILED(rv))
    aHostname.Truncate();
  else
    aHostname = result;

  return NS_OK;
}

NS_IMETHODIMP
nsSmtpServer::SetHostname(const nsACString &aHostname)
{
  if (!aHostname.IsEmpty())
    return mPrefBranch->SetCharPref("hostname", PromiseFlatCString(aHostname).get());

  // If the pref value is already empty, ClearUserPref will return
  // NS_ERROR_UNEXPECTED, so don't check the rv here.
  mPrefBranch->ClearUserPref("hostname");
  return NS_OK;
}

NS_IMETHODIMP
nsSmtpServer::GetDescription(nsACString &aDescription)
{
    nsCString temp;
    mPrefBranch->GetCharPref("description", getter_Copies(temp));
    aDescription.Assign(temp);
    return NS_OK;
}

NS_IMETHODIMP
nsSmtpServer::SetDescription(const nsACString &aDescription)
{
    if (!aDescription.IsEmpty())
        return mPrefBranch->SetCharPref("description", PromiseFlatCString(aDescription).get());
    else
        mPrefBranch->ClearUserPref("description");
    return NS_OK;
}

// if GetPort returns 0, it means default port
NS_IMETHODIMP
nsSmtpServer::GetPort(PRInt32 *aPort)
{
  NS_ENSURE_ARG_POINTER(aPort);
  if (NS_FAILED(mPrefBranch->GetIntPref("port", aPort)))
    *aPort = 0;
  return NS_OK;
}

NS_IMETHODIMP
nsSmtpServer::SetPort(PRInt32 aPort)
{
  if (aPort)
    return mPrefBranch->SetIntPref("port", aPort);

  mPrefBranch->ClearUserPref("port");
  return NS_OK;
}

NS_IMETHODIMP
nsSmtpServer::GetDisplayname(char * *aDisplayname)
{
    nsresult rv;
    NS_ENSURE_ARG_POINTER(aDisplayname);

    nsCString hostname;
    rv = mPrefBranch->GetCharPref("hostname", getter_Copies(hostname));
    if (NS_FAILED(rv)) {
        *aDisplayname=nsnull;
        return NS_OK;
    }
    PRInt32 port;
    rv = mPrefBranch->GetIntPref("port", &port);
    if (NS_FAILED(rv))
        port = 0;

    if (port) {
        hostname.Append(':');
        hostname.AppendInt(port);
    }

    *aDisplayname = ToNewCString(hostname);
    return NS_OK;
}

NS_IMETHODIMP
nsSmtpServer::GetTrySSL(PRInt32 *trySSL)
{
  NS_ENSURE_ARG_POINTER(trySSL);
  getIntPrefWithDefault("try_ssl", trySSL, 0);
  return NS_OK;
}

NS_IMETHODIMP
nsSmtpServer::SetTrySSL(PRInt32 trySSL)
{
    return mPrefBranch->SetIntPref("try_ssl", trySSL);
}

NS_IMETHODIMP
nsSmtpServer::GetUseSecAuth(PRBool *useSecAuth)
{
    nsresult rv;
    NS_ENSURE_ARG_POINTER(useSecAuth);
    rv = mPrefBranch->GetBoolPref("useSecAuth", useSecAuth);
    if (NS_FAILED(rv))
        mDefPrefBranch->GetBoolPref("useSecAuth", useSecAuth);
    return NS_OK;
}

NS_IMETHODIMP
nsSmtpServer::SetUseSecAuth(const PRBool useSecAuth)
{
    return mPrefBranch->SetBoolPref("useSecAuth", useSecAuth);
}

NS_IMETHODIMP
nsSmtpServer::GetTrySecAuth(PRBool *trySecAuth)
{
    nsresult rv;
    NS_ENSURE_ARG_POINTER(trySecAuth);
    rv = mPrefBranch->GetBoolPref("trySecAuth", trySecAuth);
    if (NS_FAILED(rv))
        mDefPrefBranch->GetBoolPref("trySecAuth", trySecAuth);
    return NS_OK;
}

NS_IMETHODIMP
nsSmtpServer::SetTrySecAuth(const PRBool trySecAuth)
{
    return mPrefBranch->SetBoolPref("trySecAuth", trySecAuth);
}

NS_IMETHODIMP
nsSmtpServer::GetHelloArgument(char * *aHelloArgument)
{
    nsresult rv;
    NS_ENSURE_ARG_POINTER(aHelloArgument);
    rv = mPrefBranch->GetCharPref("hello_argument", aHelloArgument);
    if (NS_FAILED(rv))
    {
        rv = mDefPrefBranch->GetCharPref("hello_argument", aHelloArgument);
        if (NS_FAILED(rv))
            *aHelloArgument = nsnull;
    }
    return NS_OK;
}

NS_IMETHODIMP
nsSmtpServer::GetAuthMethod(PRInt32 *authMethod)
{
  NS_ENSURE_ARG_POINTER(authMethod);
  getIntPrefWithDefault("auth_method", authMethod, 1);
  return NS_OK;
}

void
nsSmtpServer::getIntPrefWithDefault(const char *prefName,
                                    PRInt32 *val,
                                    PRInt32 defVal)
{
  nsresult rv = mPrefBranch->GetIntPref(prefName, val);
  if (NS_SUCCEEDED(rv))
    return;

  rv = mDefPrefBranch->GetIntPref(prefName, val);
  if (NS_FAILED(rv))
    // last resort
    *val = defVal;
}

NS_IMETHODIMP
nsSmtpServer::SetAuthMethod(PRInt32 authMethod)
{
    return mPrefBranch->SetIntPref("auth_method", authMethod);
}

NS_IMETHODIMP
nsSmtpServer::GetUsername(nsACString &aUsername)
{
  nsCString result;
  nsresult rv = mPrefBranch->GetCharPref("username", getter_Copies(result));
  if (NS_FAILED(rv))
    aUsername.Truncate();
  else
    aUsername = result;
  return NS_OK;
}

NS_IMETHODIMP
nsSmtpServer::SetUsername(const nsACString &aUsername)
{
  if (!aUsername.IsEmpty())
    return mPrefBranch->SetCharPref("username", PromiseFlatCString(aUsername).get());

  // If the pref value is already empty, ClearUserPref will return
  // NS_ERROR_UNEXPECTED, so don't check the rv here.
  mPrefBranch->ClearUserPref("username");
  return NS_OK;
}

NS_IMETHODIMP
nsSmtpServer::GetPassword(nsACString& aPassword)
{
    if (m_password.IsEmpty() && !m_logonFailed)
    {
      // try to avoid prompting the user for another password. If the user has set
      // the appropriate pref, we'll use the password from an incoming server, if
      // the user has already logged onto that server.

      // if this is set, we'll only use this, and not the other prefs
      // user_pref("mail.smtpserver.smtp1.incomingAccount", "server1");

      // if this is set, we'll accept an exact match of user name and server
      // user_pref("mail.smtp.useMatchingHostNameServer", true);

      // if this is set, and we don't find an exact match of user and host name,
      // we'll accept a match of username and domain, where domain
      // is everything after the first '.'
      // user_pref("mail.smtp.useMatchingDomainServer", true);

      nsCString accountKey;
      PRBool useMatchingHostNameServer = PR_FALSE;
      PRBool useMatchingDomainServer = PR_FALSE;
      mPrefBranch->GetCharPref("incomingAccount", getter_Copies(accountKey));

      nsCOMPtr<nsIMsgAccountManager> accountManager = do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID);
      nsCOMPtr<nsIMsgIncomingServer> incomingServerToUse;
      if (accountManager)
      {
        if (!accountKey.IsEmpty())
          accountManager->GetIncomingServer(accountKey, getter_AddRefs(incomingServerToUse));
        else
        {
          nsresult rv;
          nsCOMPtr<nsIPrefBranch> prefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
          NS_ENSURE_SUCCESS(rv,rv);
          prefBranch->GetBoolPref("mail.smtp.useMatchingHostNameServer", &useMatchingHostNameServer);
          prefBranch->GetBoolPref("mail.smtp.useMatchingDomainServer", &useMatchingDomainServer);
          if (useMatchingHostNameServer || useMatchingDomainServer)
          {
            nsCString userName;
            nsCString hostName;
            GetHostname(hostName);
            GetUsername(userName);
            if (useMatchingHostNameServer)
              // pass in empty type and port=0, to match imap and pop3.
              accountManager->FindRealServer(userName, hostName, EmptyCString(), 0, getter_AddRefs(incomingServerToUse));
            PRInt32 dotPos = -1;
            if (!incomingServerToUse && useMatchingDomainServer
              && (dotPos = hostName.FindChar('.')) != kNotFound)
            {
              hostName.Cut(0, dotPos);
              nsCOMPtr<nsISupportsArray> allServers;
              accountManager->GetAllServers(getter_AddRefs(allServers));
              if (allServers)
              {
                PRUint32 count = 0;
                allServers->Count(&count);
                PRUint32 i;
                for (i = 0; i < count; i++)
                {
                  nsCOMPtr<nsIMsgIncomingServer> server = do_QueryElementAt(allServers, i);
                  if (server)
                  {
                    nsCString serverUserName;
                    nsCString serverHostName;
                    server->GetRealUsername(serverUserName);
                    server->GetRealHostName(serverHostName);
                    if (serverUserName.Equals(userName))
                    {
                      PRInt32 serverDotPos = serverHostName.FindChar('.');
                      if (serverDotPos != kNotFound)
                      {
                        serverHostName.Cut(0, serverDotPos);
                        if (serverHostName.Equals(hostName))
                        {
                          incomingServerToUse = server;
                          break;
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      if (incomingServerToUse)
        return incomingServerToUse->GetPassword(aPassword);
    }
    aPassword = m_password;
    return NS_OK;
}

NS_IMETHODIMP
nsSmtpServer::VerifyLogon(nsIUrlListener *aUrlListener)
{
  nsresult rv;
  nsCOMPtr<nsISmtpService> smtpService(do_GetService(NS_SMTPSERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  return smtpService->VerifyLogon(this, aUrlListener);
}


NS_IMETHODIMP
nsSmtpServer::SetPassword(const nsACString& aPassword)
{
  m_password = aPassword;
  return NS_OK;
}

NS_IMETHODIMP
nsSmtpServer::GetPasswordWithUI(const PRUnichar * aPromptMessage, const
                                PRUnichar *aPromptTitle,
                                nsIAuthPrompt* aDialog,
                                nsACString &aPassword)
{
    nsresult rv = NS_OK;
    if (m_password.IsEmpty())
    {
        NS_ENSURE_ARG_POINTER(aDialog);

        // prompt the user for the password
        if (NS_SUCCEEDED(rv))
        {
            nsString uniPassword;
            PRBool okayValue = PR_TRUE;
            nsCString serverUri;
            rv = GetServerURI(serverUri);
            if (NS_FAILED(rv))
                return rv;

            nsCOMPtr<nsIPrefBranch> prefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
            NS_ENSURE_SUCCESS(rv, rv);

            PRBool passwordProtectLocalCache = PR_FALSE;

            (void) prefBranch->GetBoolPref("mail.password_protect_local_cache",
                                           &passwordProtectLocalCache);

            rv = aDialog->PromptPassword(aPromptTitle, aPromptMessage,
              NS_ConvertASCIItoUTF16(serverUri).get(),
              passwordProtectLocalCache ? nsIAuthPrompt::SAVE_PASSWORD_NEVER
                                        : nsIAuthPrompt::SAVE_PASSWORD_PERMANENTLY,
              getter_Copies(uniPassword), &okayValue);
            if (NS_FAILED(rv))
                return rv;

            if (!okayValue) // if the user pressed cancel, just return NULL;
            {
                aPassword.Truncate();
                return rv;
            }

            // we got a password back...so remember it
            nsCString aCStr;
            LossyCopyUTF16toASCII(uniPassword, aCStr);

            rv = SetPassword(aCStr);
            if (NS_FAILED(rv))
                return rv;
        } // if we got a prompt dialog
    } // if the password is empty

    return GetPassword(aPassword);
}

NS_IMETHODIMP
nsSmtpServer::GetUsernamePasswordWithUI(const PRUnichar * aPromptMessage, const
                                PRUnichar *aPromptTitle,
                                nsIAuthPrompt* aDialog,
                                nsACString &aUsername,
                                nsACString &aPassword)
{
    nsresult rv = NS_OK;

    if (m_password.IsEmpty()) {
        NS_ENSURE_ARG_POINTER(aDialog);
        // prompt the user for the password
        if (NS_SUCCEEDED(rv))
        {
            nsString uniUsername;
            nsString uniPassword;
            PRBool okayValue = PR_TRUE;
            nsCString serverUri;
            rv = GetServerURI(serverUri);
            if (NS_FAILED(rv))
                return rv;

            nsCOMPtr<nsIPrefBranch> prefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
            NS_ENSURE_SUCCESS(rv, rv);

            PRBool passwordProtectLocalCache = PR_FALSE;

            (void) prefBranch->GetBoolPref("mail.password_protect_local_cache",
                                           &passwordProtectLocalCache);

            rv = aDialog->PromptUsernameAndPassword(aPromptTitle, aPromptMessage,
              NS_ConvertASCIItoUTF16(serverUri).get(),
              passwordProtectLocalCache ? nsIAuthPrompt::SAVE_PASSWORD_NEVER
                                        : nsIAuthPrompt::SAVE_PASSWORD_PERMANENTLY,
              getter_Copies(uniUsername), getter_Copies(uniPassword), &okayValue);
            if (NS_FAILED(rv))
                return rv;

            if (!okayValue) // if the user pressed cancel, just return NULL;
            {
              aUsername.Truncate();
              aPassword.Truncate();
              return rv;
            }

            // we got a userid and password back...so remember it
            nsCString aCStr;

            LossyCopyUTF16toASCII(uniUsername, aCStr);
            rv = SetUsername(aCStr);
            if (NS_FAILED(rv))
                return rv;

            LossyCopyUTF16toASCII(uniPassword, aCStr);
            rv = SetPassword(aCStr);
            if (NS_FAILED(rv))
                return rv;
        } // if we got a prompt dialog
    } // if the password is empty

    rv = GetUsername(aUsername);
    if (NS_FAILED(rv))
        return rv;
    return GetPassword(aPassword);
}

NS_IMETHODIMP
nsSmtpServer::ForgetPassword()
{
  nsresult rv;
  nsCOMPtr<nsILoginManager> loginMgr =
    do_GetService(NS_LOGINMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  // Get the current server URI without the username
  nsCAutoString serverUri(NS_LITERAL_CSTRING("smtp://"));

  nsCString hostname;
  rv = GetHostname(hostname);

  if (NS_SUCCEEDED(rv) && !hostname.IsEmpty()) {
    nsCString escapedHostname;
    *((char **)getter_Copies(escapedHostname)) =
      nsEscape(hostname.get(), url_Path);
    // not all servers have a hostname
    serverUri.Append(escapedHostname);
  }

  PRUint32 count;
  nsILoginInfo** logins;

  NS_ConvertUTF8toUTF16 currServer(serverUri);

  nsCString serverCUsername;
  rv = GetUsername(serverCUsername);
  NS_ENSURE_SUCCESS(rv, rv);

  NS_ConvertUTF8toUTF16 serverUsername(serverCUsername);

  rv = loginMgr->FindLogins(&count, currServer, EmptyString(),
                            currServer, &logins);
  NS_ENSURE_SUCCESS(rv, rv);

  // There should only be one-login stored for this url, however just in case
  // there isn't.
  nsString username;
  for (PRUint32 i = 0; i < count; ++i)
  {
    if (NS_SUCCEEDED(logins[i]->GetUsername(username)) &&
        username.Equals(serverUsername))
    {
      // If this fails, just continue, we'll still want to remove the password
      // from our local cache.
      loginMgr->RemoveLogin(logins[i]);
    }
  }
  NS_FREE_XPCOM_ISUPPORTS_POINTER_ARRAY(count, logins);

  rv = SetPassword(EmptyCString());
  m_logonFailed = PR_TRUE;
  return rv;
}

NS_IMETHODIMP
nsSmtpServer::GetServerURI(nsACString &aResult)
{
    nsCAutoString uri(NS_LITERAL_CSTRING("smtp://"));

    nsCString username;
    nsresult rv = GetUsername(username);

    if (NS_SUCCEEDED(rv) && !username.IsEmpty()) {
        nsCString escapedUsername;
        MsgEscapeString(username, nsINetUtil::ESCAPE_XALPHAS, escapedUsername);
        // not all servers have a username
        uri.Append(escapedUsername);
        uri.AppendLiteral("@");
    }

    nsCString hostname;
    rv = GetHostname(hostname);

    if (NS_SUCCEEDED(rv) && !hostname.IsEmpty()) {
        nsCString escapedHostname;
        *((char **)getter_Copies(escapedHostname)) =
            nsEscape(hostname.get(), url_Path);
        // not all servers have a hostname
        uri.Append(escapedHostname);
    }

    aResult = uri;
    return NS_OK;
}

NS_IMETHODIMP
nsSmtpServer::ClearAllValues()
{
  return mPrefBranch->DeleteBranch("");
}
