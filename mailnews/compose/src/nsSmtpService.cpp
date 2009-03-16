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
 *   Pierre Phaneuf <pp@ludusdesign.com>
 *   Olivier Parniere BT Global Services / Etat francais Ministere de la Defense
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

#include "msgCore.h"    // precompiled header...
#include "nsReadableUtils.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "nsIIOService.h"
#include "nsIPipe.h"
#include "nsNetCID.h"
#include "nsMsgUtils.h"
#include "nsNetUtil.h"
#include "nsSmtpService.h"
#include "nsIMsgMailSession.h"
#include "nsMsgBaseCID.h"
#include "nsMsgCompCID.h"
#include "nsArrayEnumerator.h"
#include "nsSmtpUrl.h"
#include "nsSmtpProtocol.h"
#include "nsCOMPtr.h"
#include "nsIMsgIdentity.h"
#include "nsIPrompt.h"
#include "nsIWindowWatcher.h"
#include "nsIUTF8ConverterService.h"
#include "nsUConvCID.h"
#include "nsAutoPtr.h"
#include "nsComposeStrings.h"

#define SERVER_DELIMITER ','
#define APPEND_SERVERS_VERSION_PREF_NAME "append_preconfig_smtpservers.version"
#define MAIL_ROOT_PREF "mail."
#define PREF_MAIL_SMTPSERVERS "mail.smtpservers"
#define PREF_MAIL_SMTPSERVERS_APPEND_SERVERS "mail.smtpservers.appendsmtpservers"
#define PREF_MAIL_SMTP_DEFAULTSERVER "mail.smtp.defaultserver"

typedef struct _findServerByKeyEntry {
    const char *key;
    nsISmtpServer *server;
} findServerByKeyEntry;

typedef struct _findServerByHostnameEntry {
    nsCString hostname;
    nsCString username;
    nsISmtpServer *server;
} findServerByHostnameEntry;

static NS_DEFINE_CID(kCSmtpUrlCID, NS_SMTPURL_CID);
static NS_DEFINE_CID(kCMailtoUrlCID, NS_MAILTOURL_CID);

// foward declarations...
nsresult
NS_MsgBuildSmtpUrl(nsIFile * aFilePath,
                   nsISmtpServer *aServer,
                   const char* aRecipients, 
                   nsIMsgIdentity * aSenderIdentity,
                   nsIUrlListener * aUrlListener,
                   nsIMsgStatusFeedback *aStatusFeedback,
                   nsIInterfaceRequestor* aNotificationCallbacks,
                   nsIURI ** aUrl,
                   PRBool aRequestDSN);

nsresult NS_MsgLoadSmtpUrl(nsIURI * aUrl, nsISupports * aConsumer, nsIRequest ** aRequest);

nsSmtpService::nsSmtpService() :
    mSmtpServersLoaded(PR_FALSE)
{
}

nsSmtpService::~nsSmtpService()
{
    // save the SMTP servers to disk

}

NS_IMPL_ISUPPORTS2(nsSmtpService, nsISmtpService, nsIProtocolHandler)


NS_IMETHODIMP nsSmtpService::SendMailMessage(nsIFile * aFilePath,
                                        const char * aRecipients, 
                                        nsIMsgIdentity * aSenderIdentity,
                                        const char * aPassword,
                                        nsIUrlListener * aUrlListener, 
                                        nsIMsgStatusFeedback *aStatusFeedback,
                                        nsIInterfaceRequestor* aNotificationCallbacks,
                                        PRBool aRequestDSN,
                                        nsIURI ** aURL,
                                        nsIRequest ** aRequest)
{
  nsIURI * urlToRun = nsnull;
  nsresult rv = NS_OK;

  nsCOMPtr<nsISmtpServer> smtpServer;
  rv = GetSmtpServerByIdentity(aSenderIdentity, getter_AddRefs(smtpServer));

  if (NS_SUCCEEDED(rv) && smtpServer)
  {
    if (aPassword && *aPassword)
      smtpServer->SetPassword(nsDependentCString(aPassword));

    // this ref counts urlToRun
    rv = NS_MsgBuildSmtpUrl(aFilePath, smtpServer, aRecipients, aSenderIdentity,
                            aUrlListener, aStatusFeedback, 
                            aNotificationCallbacks, &urlToRun, aRequestDSN);
    if (NS_SUCCEEDED(rv) && urlToRun)	
      rv = NS_MsgLoadSmtpUrl(urlToRun, nsnull, aRequest);

    if (aURL) // does the caller want a handle on the url?
      *aURL = urlToRun; // transfer our ref count to the caller....
    else
      NS_IF_RELEASE(urlToRun);
  }

  return rv;
}


// The following are two convience functions I'm using to help expedite building and running a mail to url...

// short cut function for creating a mailto url...
nsresult NS_MsgBuildSmtpUrl(nsIFile * aFilePath,
                            nsISmtpServer *aSmtpServer,
                            const char * aRecipients, 
                            nsIMsgIdentity * aSenderIdentity,
                            nsIUrlListener * aUrlListener, 
                            nsIMsgStatusFeedback *aStatusFeedback,
                            nsIInterfaceRequestor* aNotificationCallbacks,
                            nsIURI ** aUrl,
                            PRBool aRequestDSN)
{
  // mscott: this function is a convience hack until netlib actually dispatches
  // smtp urls. in addition until we have a session to get a password, host and
  // other stuff from, we need to use default values....
  // ..for testing purposes....

    nsCString smtpHostName;
    nsCString smtpUserName;
    PRInt32 smtpPort;
    PRInt32 trySSL;

    aSmtpServer->GetHostname(smtpHostName);
    aSmtpServer->GetUsername(smtpUserName);
    aSmtpServer->GetPort(&smtpPort);
    aSmtpServer->GetTrySSL(&trySSL);

    if (!smtpPort)
      smtpPort = (trySSL == PREF_SECURE_ALWAYS_SMTPS) ? 
        nsISmtpUrl::DEFAULT_SMTPS_PORT :  nsISmtpUrl::DEFAULT_SMTP_PORT;

  nsresult rv;
  nsCOMPtr<nsISmtpUrl> smtpUrl(do_CreateInstance(kCSmtpUrlCID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCAutoString urlSpec("smtp://");

  if (!smtpUserName.IsEmpty())
  {
    nsCString escapedUsername;
    MsgEscapeString(smtpUserName, nsINetUtil::ESCAPE_XALPHAS,
                    escapedUsername);
    urlSpec.Append(escapedUsername);
    urlSpec.Append('@');
  }

  urlSpec.Append(smtpHostName);
  if (smtpHostName.FindChar(':') == -1)
  {
    urlSpec.Append(':');
    urlSpec.AppendInt(smtpPort);
  }

  nsCOMPtr<nsIMsgMailNewsUrl> url(do_QueryInterface(smtpUrl, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  url->SetSpec(urlSpec);
  smtpUrl->SetRecipients(aRecipients);
  smtpUrl->SetRequestDSN(aRequestDSN);
  smtpUrl->SetPostMessageFile(aFilePath);
  smtpUrl->SetSenderIdentity(aSenderIdentity);
  smtpUrl->SetNotificationCallbacks(aNotificationCallbacks);
  smtpUrl->SetSmtpServer(aSmtpServer);

  nsCOMPtr<nsIPrompt> smtpPrompt(do_GetInterface(aNotificationCallbacks));
  nsCOMPtr<nsIAuthPrompt> smtpAuthPrompt(do_GetInterface(aNotificationCallbacks));
  if (!smtpPrompt || !smtpAuthPrompt)
  {
    nsCOMPtr<nsIWindowWatcher> wwatch(do_GetService(NS_WINDOWWATCHER_CONTRACTID, &rv));
    NS_ENSURE_SUCCESS(rv, rv);

    if (!smtpPrompt)
      wwatch->GetNewPrompter(0, getter_AddRefs(smtpPrompt));
    if (!smtpAuthPrompt)
      wwatch->GetNewAuthPrompter(0, getter_AddRefs(smtpAuthPrompt));
  }

  smtpUrl->SetPrompt(smtpPrompt);            
  smtpUrl->SetAuthPrompt(smtpAuthPrompt);

  url->RegisterListener(aUrlListener);
  if (aStatusFeedback)
    url->SetStatusFeedback(aStatusFeedback);

  return CallQueryInterface(smtpUrl, aUrl);
}

nsresult NS_MsgLoadSmtpUrl(nsIURI * aUrl, nsISupports * aConsumer, nsIRequest ** aRequest)
{
  NS_ENSURE_ARG_POINTER(aUrl);

  // For now, assume the url is an smtp url and load it.
  nsresult rv;
  nsCOMPtr<nsISmtpUrl> smtpUrl(do_QueryInterface(aUrl, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  // Create a smtp protocol instance to run the url in.
  nsRefPtr<nsSmtpProtocol> smtpProtocol = new nsSmtpProtocol(aUrl);
  if (!smtpProtocol)
    return NS_ERROR_OUT_OF_MEMORY;

  // Protocol will get destroyed when url is completed.
  rv = smtpProtocol->LoadUrl(aUrl, aConsumer);
  NS_ENSURE_SUCCESS(rv, rv);

  return CallQueryInterface(smtpProtocol.get(), aRequest);
}

NS_IMETHODIMP nsSmtpService::VerifyLogon(nsISmtpServer *aServer,
                                         nsIUrlListener *aUrlListener,
                                         nsIMsgWindow *aMsgWindow,
                                         nsIURI **aURL)
{
  NS_ENSURE_ARG_POINTER(aServer);
  nsCString popHost;
  nsCString popUser;
  nsCOMPtr <nsIURI> urlToRun;

  nsresult rv = NS_MsgBuildSmtpUrl(nsnull, aServer,
                          nsnull, nsnull, aUrlListener, nsnull,
                          nsnull , getter_AddRefs(urlToRun), PR_FALSE);
  if (NS_SUCCEEDED(rv) && urlToRun)
  {
    nsCOMPtr<nsIMsgMailNewsUrl> url(do_QueryInterface(urlToRun, &rv));
    NS_ENSURE_SUCCESS(rv, rv);
    url->SetMsgWindow(aMsgWindow);
    rv = NS_MsgLoadSmtpUrl(urlToRun, nsnull, nsnull /* aRequest */);
    if (aURL)
      urlToRun.forget(aURL);
  }
  return rv;
}

NS_IMETHODIMP nsSmtpService::GetScheme(nsACString &aScheme)
{
    aScheme = "mailto";
    return NS_OK; 
}

NS_IMETHODIMP nsSmtpService::GetDefaultPort(PRInt32 *aDefaultPort)
{
    nsresult rv = NS_OK;
    if (aDefaultPort)
        *aDefaultPort = nsISmtpUrl::DEFAULT_SMTP_PORT;
    else
        rv = NS_ERROR_NULL_POINTER;
    return rv;
}

NS_IMETHODIMP 
nsSmtpService::AllowPort(PRInt32 port, const char *scheme, PRBool *_retval)
{
    // allow smtp to run on any port
    *_retval = PR_TRUE;
    return NS_OK;
}

NS_IMETHODIMP nsSmtpService::GetProtocolFlags(PRUint32 *result)
{
    *result = URI_NORELATIVE | ALLOWS_PROXY | URI_LOADABLE_BY_ANYONE |
        URI_NON_PERSISTABLE | URI_DOES_NOT_RETURN_DATA;
    return NS_OK;
}

// the smtp service is also the protocol handler for mailto urls....

NS_IMETHODIMP nsSmtpService::NewURI(const nsACString &aSpec,
                                    const char *aOriginCharset,
                                    nsIURI *aBaseURI,
                                    nsIURI **_retval)
{
  // get a new smtp url
  nsresult rv;
  nsCOMPtr<nsIURI> mailtoUrl = do_CreateInstance(kCMailtoUrlCID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCAutoString utf8Spec;
  if (aOriginCharset)
  {
    nsCOMPtr<nsIUTF8ConverterService>
      utf8Converter(do_GetService(NS_UTF8CONVERTERSERVICE_CONTRACTID, &rv));
    if (NS_SUCCEEDED(rv))
      rv = utf8Converter->ConvertURISpecToUTF8(aSpec, aOriginCharset, utf8Spec);
  }

  // utf8Spec is filled up only when aOriginCharset is specified and
  // the conversion is successful. Otherwise, fall back to aSpec.
  if (aOriginCharset && NS_SUCCEEDED(rv))
    mailtoUrl->SetSpec(utf8Spec);
  else
    mailtoUrl->SetSpec(aSpec);

  mailtoUrl.forget(_retval);
  return NS_OK;
}

NS_IMETHODIMP nsSmtpService::NewChannel(nsIURI *aURI, nsIChannel **_retval)
{
  NS_ENSURE_ARG_POINTER(aURI);
  // create an empty pipe for use with the input stream channel.
  nsCOMPtr<nsIAsyncInputStream> pipeIn;
  nsCOMPtr<nsIAsyncOutputStream> pipeOut;
  nsCOMPtr<nsIPipe> pipe = do_CreateInstance("@mozilla.org/pipe;1");
  nsresult rv = pipe->Init(PR_FALSE, PR_FALSE, 0, 0, nsnull);
  if (NS_FAILED(rv)) 
    return rv;
  
  pipe->GetInputStream(getter_AddRefs(pipeIn));
  pipe->GetOutputStream(getter_AddRefs(pipeOut));

  pipeOut->Close();

  return NS_NewInputStreamChannel(_retval, aURI, pipeIn,
                                  NS_LITERAL_CSTRING("application/x-mailto"));
}


NS_IMETHODIMP
nsSmtpService::GetSmtpServers(nsISimpleEnumerator **aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);

  // now read in the servers from prefs if necessary
  PRUint32 serverCount = mSmtpServers.Count();

  if (serverCount <= 0)
    loadSmtpServers();

  return NS_NewArrayEnumerator(aResult, mSmtpServers);
}

nsresult
nsSmtpService::loadSmtpServers()
{
  if (mSmtpServersLoaded)
    return NS_OK;
    
  nsresult rv;
  nsCOMPtr<nsIPrefService> prefService(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  if (NS_FAILED(rv))
    return rv;
  nsCOMPtr<nsIPrefBranch> prefRootBranch;
  prefService->GetBranch(nsnull, getter_AddRefs(prefRootBranch));
  if (NS_FAILED(rv))
    return rv;

  nsCString serverList;
  rv = prefRootBranch->GetCharPref(PREF_MAIL_SMTPSERVERS, getter_Copies(serverList));
  serverList.StripWhitespace();

  nsTArray<nsCString> servers;
  ParseString(serverList, SERVER_DELIMITER, servers);

  /**
   * Check to see if we need to add pre-configured smtp servers.
   * Following prefs are important to note in understanding the procedure here.
   *
   * 1. pref("mailnews.append_preconfig_smtpservers.version", version number);
   * This pref registers the current version in the user prefs file. A default value
   * is stored in mailnews.js file. If a given vendor needs to add more preconfigured
   * smtp servers, the default version number can be increased. Comparing version
   * number from user's prefs file and the default one from mailnews.js, we
   * can add new smtp servers and any other version level changes that need to be done.
   *
   * 2. pref("mail.smtpservers.appendsmtpservers", <comma separated servers list>);
   * This pref contains the list of pre-configured smp servers that ISP/Vendor wants to
   * to add to the existing servers list.
   */
  nsCOMPtr<nsIPrefBranch> defaultsPrefBranch;
  rv = prefService->GetDefaultBranch(MAIL_ROOT_PREF, getter_AddRefs(defaultsPrefBranch));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIPrefBranch> prefBranch;
  rv = prefService->GetBranch(MAIL_ROOT_PREF, getter_AddRefs(prefBranch));
  NS_ENSURE_SUCCESS(rv,rv);

  PRInt32 appendSmtpServersCurrentVersion = 0;
  PRInt32 appendSmtpServersDefaultVersion = 0;
  rv = prefBranch->GetIntPref(APPEND_SERVERS_VERSION_PREF_NAME, &appendSmtpServersCurrentVersion);
  NS_ENSURE_SUCCESS(rv,rv);

  rv = defaultsPrefBranch->GetIntPref(APPEND_SERVERS_VERSION_PREF_NAME, &appendSmtpServersDefaultVersion);
  NS_ENSURE_SUCCESS(rv,rv);

  // Update the smtp server list if needed
  if (appendSmtpServersCurrentVersion <= appendSmtpServersDefaultVersion) {
    // If there are pre-configured servers, add them to the existing server list
    nsCString appendServerList;
    rv = prefRootBranch->GetCharPref(PREF_MAIL_SMTPSERVERS_APPEND_SERVERS, getter_Copies(appendServerList));
    appendServerList.StripWhitespace();
    ParseString(appendServerList, SERVER_DELIMITER, servers);

    // Increase the version number so that updates will happen as and when needed
    prefBranch->SetIntPref(APPEND_SERVERS_VERSION_PREF_NAME, appendSmtpServersCurrentVersion + 1);
  }

  // use GetServerByKey to check if the key (pref) is already in
  // in the list. If not it calls createKeyedServer directly.

  for (PRUint32 i = 0; i < servers.Length(); i++) {
    nsCOMPtr<nsISmtpServer> server;
    GetServerByKey(servers[i].get(), getter_AddRefs(server));
  }

  saveKeyList();

  mSmtpServersLoaded = PR_TRUE;
  return NS_OK;
}

// save the list of keys
nsresult
nsSmtpService::saveKeyList()
{
    nsresult rv;
    nsCOMPtr<nsIPrefBranch> prefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
    if (NS_FAILED(rv)) return rv;
    
    return prefBranch->SetCharPref(PREF_MAIL_SMTPSERVERS, mServerKeyList.get());
}

nsresult
nsSmtpService::createKeyedServer(const char *key, nsISmtpServer** aResult)
{
    if (!key) return NS_ERROR_NULL_POINTER;
    
    nsresult rv;
    nsCOMPtr<nsISmtpServer> server = do_CreateInstance(NS_SMTPSERVER_CONTRACTID, &rv);
    if (NS_FAILED(rv)) return rv;
    
    server->SetKey(key);
    mSmtpServers.AppendObject(server);

    if (mServerKeyList.IsEmpty())
        mServerKeyList = key;
    else {
        mServerKeyList.Append(',');
        mServerKeyList += key;
    }

    if (aResult) 
       server.swap(*aResult);
    
    return NS_OK;
}

NS_IMETHODIMP
nsSmtpService::GetSessionDefaultServer(nsISmtpServer **aServer)
{
    NS_ENSURE_ARG_POINTER(aServer);
    
    if (!mSessionDefaultServer)
        return GetDefaultServer(aServer);

    NS_ADDREF(*aServer = mSessionDefaultServer);
    return NS_OK;
}

NS_IMETHODIMP
nsSmtpService::SetSessionDefaultServer(nsISmtpServer *aServer)
{
    mSessionDefaultServer = aServer;
    return NS_OK;
}

NS_IMETHODIMP
nsSmtpService::GetDefaultServer(nsISmtpServer **aServer)
{
  NS_ENSURE_ARG_POINTER(aServer);

  loadSmtpServers();
  
  *aServer = nsnull;
  // always returns NS_OK, just leaving *aServer at nsnull
  if (!mDefaultSmtpServer) {
      nsresult rv;
      nsCOMPtr<nsIPrefBranch> prefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
      if (NS_FAILED(rv)) return rv;

      // try to get it from the prefs
      nsCString defaultServerKey;
      rv = prefBranch->GetCharPref(PREF_MAIL_SMTP_DEFAULTSERVER, getter_Copies(defaultServerKey));
      if (NS_SUCCEEDED(rv) &&
          !defaultServerKey.IsEmpty()) {

          nsCOMPtr<nsISmtpServer> server;
          rv = GetServerByKey(defaultServerKey.get(),
                              getter_AddRefs(mDefaultSmtpServer));
      } else {
        // no pref set, so just return the first one, and set the pref

        // Ensure the list of servers is loaded
        loadSmtpServers();

        // nothing in the array, we had better create a new server
        // (which will add it to the array & prefs anyway)
        if (mSmtpServers.Count() == 0)
          // if there are no smtp servers then don't create one for the default.
          return nsnull;

        mDefaultSmtpServer = mSmtpServers[0];
        NS_ENSURE_TRUE(mDefaultSmtpServer, NS_ERROR_NULL_POINTER);
          
        // now we have a default server, set the prefs correctly
        nsCString serverKey;
        mDefaultSmtpServer->GetKey(getter_Copies(serverKey));
        if (NS_SUCCEEDED(rv))
          prefBranch->SetCharPref(PREF_MAIL_SMTP_DEFAULTSERVER, serverKey.get());
      }
  }

  // at this point:
  // * mDefaultSmtpServer has a valid server
  // * the key has been set in the prefs
    
  NS_IF_ADDREF(*aServer = mDefaultSmtpServer);

  return NS_OK;
}

NS_IMETHODIMP
nsSmtpService::SetDefaultServer(nsISmtpServer *aServer)
{
    NS_ENSURE_ARG_POINTER(aServer);

    mDefaultSmtpServer = aServer;

    nsCString serverKey;
    nsresult rv = aServer->GetKey(getter_Copies(serverKey));
    NS_ENSURE_SUCCESS(rv,rv);
    
    nsCOMPtr<nsIPrefBranch> prefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
    NS_ENSURE_SUCCESS(rv,rv);
    prefBranch->SetCharPref(PREF_MAIL_SMTP_DEFAULTSERVER, serverKey.get());
    return NS_OK;
}

PRBool
nsSmtpService::findServerByKey(nsISmtpServer *aServer, void *aData)
{
  findServerByKeyEntry *entry = (findServerByKeyEntry*) aData;

  nsCString key;
  nsresult rv = aServer->GetKey(getter_Copies(key));
  if (NS_FAILED(rv))
    return PR_TRUE;

  if (key.Equals(entry->key)) 
  {
    entry->server = aServer;
    return PR_FALSE;
  }
    
  return PR_TRUE;
}

NS_IMETHODIMP
nsSmtpService::CreateSmtpServer(nsISmtpServer **aResult)
{
    if (!aResult) return NS_ERROR_NULL_POINTER;

    loadSmtpServers();
    nsresult rv;
    
    PRInt32 i = 0;
    PRBool unique = PR_FALSE;

    findServerByKeyEntry entry;
    nsCAutoString key;
    
    do {
        key = "smtp";
        key.AppendInt(++i);
        
        entry.key = key.get();
        entry.server = nsnull;

        mSmtpServers.EnumerateForwards(findServerByKey, (void *)&entry);
        if (!entry.server) unique=PR_TRUE;
        
    } while (!unique);

    rv = createKeyedServer(key.get(), aResult);
    saveKeyList();
    return rv;
}


nsresult
nsSmtpService::GetServerByKey(const char* aKey, nsISmtpServer **aResult)
{
    NS_ENSURE_ARG_POINTER(aResult);

    if (!aKey || !*aKey)
    {
      NS_ASSERTION(PR_FALSE, "bad key");
      return NS_ERROR_FAILURE;
    }
    findServerByKeyEntry entry;
    entry.key = aKey;
    entry.server = nsnull;
    mSmtpServers.EnumerateForwards(findServerByKey, (void *)&entry);

    if (entry.server) {
        NS_ADDREF(*aResult = entry.server);
        return NS_OK;
    }

    // not found in array, I guess we load it
    return createKeyedServer(aKey, aResult);
}

NS_IMETHODIMP
nsSmtpService::DeleteSmtpServer(nsISmtpServer *aServer)
{
    if (!aServer) return NS_OK;

    PRInt32 idx = mSmtpServers.IndexOf(aServer);
    if (idx == -1)
      return NS_OK;

    nsCString serverKey;
    aServer->GetKey(getter_Copies(serverKey));
    
    nsresult rv = mSmtpServers.RemoveObjectAt(idx);

    if (mDefaultSmtpServer.get() == aServer)
        mDefaultSmtpServer = nsnull;
    if (mSessionDefaultServer.get() == aServer)
        mSessionDefaultServer = nsnull;
    
    nsCAutoString newServerList;
    nsCString tmpStr = mServerKeyList;
    char *newStr = tmpStr.BeginWriting();
    char *token = NS_strtok(",", &newStr);
    while (token) {
      // only re-add the string if it's not the key
      if (strcmp(token, serverKey.get()) != 0) {
          if (newServerList.IsEmpty())
              newServerList = token;
          else {
            newServerList += ',';
            newServerList += token;
          }
      }
      token = NS_strtok(",", &newStr);
    }

    // make sure the server clears out it's values....
    aServer->ClearAllValues();

    mServerKeyList = newServerList;
    saveKeyList();
    return rv;
}

PRBool
nsSmtpService::findServerByHostname(nsISmtpServer *aServer, void *aData)
{
  findServerByHostnameEntry *entry = (findServerByHostnameEntry*)aData;

  nsCString hostname;
  nsresult rv = aServer->GetHostname(hostname);
  if (NS_FAILED(rv))
    return PR_TRUE;

  nsCString username;
  rv = aServer->GetUsername(username);
  if (NS_FAILED(rv))
    return PR_TRUE;

  PRBool checkHostname = !entry->hostname.IsEmpty();
  PRBool checkUsername = !entry->username.IsEmpty();
    
  if ((!checkHostname ||
       (entry->hostname.Equals(hostname, nsCaseInsensitiveCStringComparator())) &&
       (!checkUsername ||
        entry->username.Equals(username, nsCaseInsensitiveCStringComparator()))))
  {
    entry->server = aServer;
    return PR_FALSE;        // stop when found
  }
  return PR_TRUE;
}

NS_IMETHODIMP
nsSmtpService::FindServer(const char *aUsername,
                          const char *aHostname, nsISmtpServer ** aResult)
{
    NS_ENSURE_ARG_POINTER(aResult);

    findServerByHostnameEntry entry;
    entry.server = nsnull;
    entry.hostname = aHostname;
    entry.username = aUsername;

    mSmtpServers.EnumerateForwards(findServerByHostname, (void *)&entry);

    // entry.server may be null, but that's ok.
    // just return null if no server is found
    NS_IF_ADDREF(*aResult = entry.server);
    
    return NS_OK;
}

NS_IMETHODIMP
nsSmtpService::GetSmtpServerByIdentity(nsIMsgIdentity *aSenderIdentity, nsISmtpServer **aSmtpServer)
{
  NS_ENSURE_ARG_POINTER(aSmtpServer);
  nsresult rv = NS_ERROR_FAILURE;

  // First try the identity's preferred server
  if (aSenderIdentity) 
  {
      nsCString smtpServerKey;
      rv = aSenderIdentity->GetSmtpServerKey(smtpServerKey);
      if (NS_SUCCEEDED(rv) && !(smtpServerKey.IsEmpty()))
          rv = GetServerByKey(smtpServerKey.get(), aSmtpServer);
  }

  // Fallback to the default
  if (NS_FAILED(rv) || !(*aSmtpServer))
      rv = GetDefaultServer(aSmtpServer);
  return rv;
}
