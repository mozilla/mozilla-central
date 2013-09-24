/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "msgCore.h"    // precompiled header...
#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "nsIIOService.h"
#include "nsIPipe.h"
#include "nsNetCID.h"
#include "nsMsgUtils.h"
#include "nsNetUtil.h"
#include "nsSmtpService.h"
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
#include "nsIAsyncInputStream.h"

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
                   bool aRequestDSN);

nsresult NS_MsgLoadSmtpUrl(nsIURI * aUrl, nsISupports * aConsumer, nsIRequest ** aRequest);

nsSmtpService::nsSmtpService() :
    mSmtpServersLoaded(false)
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
                                        bool aRequestDSN,
                                        nsIURI ** aURL,
                                        nsIRequest ** aRequest)
{
  nsIURI * urlToRun = nullptr;
  nsresult rv = NS_OK;

  nsCOMPtr<nsISmtpServer> smtpServer;
  rv = GetServerByIdentity(aSenderIdentity, getter_AddRefs(smtpServer));

  if (NS_SUCCEEDED(rv) && smtpServer)
  {
    if (aPassword && *aPassword)
      smtpServer->SetPassword(nsDependentCString(aPassword));

    // this ref counts urlToRun
    rv = NS_MsgBuildSmtpUrl(aFilePath, smtpServer, aRecipients, aSenderIdentity,
                            aUrlListener, aStatusFeedback, 
                            aNotificationCallbacks, &urlToRun, aRequestDSN);
    if (NS_SUCCEEDED(rv) && urlToRun)	
      rv = NS_MsgLoadSmtpUrl(urlToRun, nullptr, aRequest);

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
                            bool aRequestDSN)
{
  // mscott: this function is a convience hack until netlib actually dispatches
  // smtp urls. in addition until we have a session to get a password, host and
  // other stuff from, we need to use default values....
  // ..for testing purposes....

    nsCString smtpHostName;
    nsCString smtpUserName;
    int32_t smtpPort;
    int32_t socketType;

    aSmtpServer->GetHostname(smtpHostName);
    aSmtpServer->GetUsername(smtpUserName);
    aSmtpServer->GetPort(&smtpPort);
    aSmtpServer->GetSocketType(&socketType);

    if (!smtpPort)
      smtpPort = (socketType == nsMsgSocketType::SSL) ?
        nsISmtpUrl::DEFAULT_SMTPS_PORT :  nsISmtpUrl::DEFAULT_SMTP_PORT;

  nsresult rv;
  nsCOMPtr<nsISmtpUrl> smtpUrl(do_CreateInstance(kCSmtpUrlCID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsAutoCString urlSpec("smtp://");

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

  rv = url->SetSpec(urlSpec);
  NS_ENSURE_SUCCESS(rv, rv);

  smtpUrl->SetRecipients(aRecipients);
  smtpUrl->SetRequestDSN(aRequestDSN);
  smtpUrl->SetPostMessageFile(aFilePath);
  smtpUrl->SetSenderIdentity(aSenderIdentity);
  if (aNotificationCallbacks)
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

  if (aUrlListener)
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

  nsresult rv = NS_MsgBuildSmtpUrl(nullptr, aServer,
                          nullptr, nullptr, aUrlListener, nullptr,
                          nullptr , getter_AddRefs(urlToRun), false);
  if (NS_SUCCEEDED(rv) && urlToRun)
  {
    nsCOMPtr<nsIMsgMailNewsUrl> url(do_QueryInterface(urlToRun, &rv));
    NS_ENSURE_SUCCESS(rv, rv);
    url->SetMsgWindow(aMsgWindow);
    rv = NS_MsgLoadSmtpUrl(urlToRun, nullptr, nullptr /* aRequest */);
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

NS_IMETHODIMP nsSmtpService::GetDefaultPort(int32_t *aDefaultPort)
{
    nsresult rv = NS_OK;
    if (aDefaultPort)
        *aDefaultPort = nsISmtpUrl::DEFAULT_SMTP_PORT;
    else
        rv = NS_ERROR_NULL_POINTER;
    return rv;
}

NS_IMETHODIMP 
nsSmtpService::AllowPort(int32_t port, const char *scheme, bool *_retval)
{
    // allow smtp to run on any port
    *_retval = true;
    return NS_OK;
}

NS_IMETHODIMP nsSmtpService::GetProtocolFlags(uint32_t *result)
{
    *result = URI_NORELATIVE | ALLOWS_PROXY | URI_LOADABLE_BY_ANYONE |
      URI_NON_PERSISTABLE | URI_DOES_NOT_RETURN_DATA |
      URI_FORBIDS_COOKIE_ACCESS;
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

  nsAutoCString utf8Spec;
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
    rv = mailtoUrl->SetSpec(utf8Spec);
  else
    rv = mailtoUrl->SetSpec(aSpec);
  NS_ENSURE_SUCCESS(rv, rv);

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
  nsresult rv = pipe->Init(false, false, 0, 0, nullptr);
  if (NS_FAILED(rv)) 
    return rv;
  
  pipe->GetInputStream(getter_AddRefs(pipeIn));
  pipe->GetOutputStream(getter_AddRefs(pipeOut));

  pipeOut->Close();

  return NS_NewInputStreamChannel(_retval, aURI, pipeIn,
                                  NS_LITERAL_CSTRING("application/x-mailto"));
}


NS_IMETHODIMP
nsSmtpService::GetServers(nsISimpleEnumerator **aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);

  // now read in the servers from prefs if necessary
  uint32_t serverCount = mSmtpServers.Count();

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
  prefService->GetBranch(nullptr, getter_AddRefs(prefRootBranch));
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

  int32_t appendSmtpServersCurrentVersion = 0;
  int32_t appendSmtpServersDefaultVersion = 0;
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

  for (uint32_t i = 0; i < servers.Length(); i++) {
    nsCOMPtr<nsISmtpServer> server;
    GetServerByKey(servers[i].get(), getter_AddRefs(server));
  }

  saveKeyList();

  mSmtpServersLoaded = true;
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
  
  *aServer = nullptr;
  // always returns NS_OK, just leaving *aServer at nullptr
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
          return NS_OK;

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

bool
nsSmtpService::findServerByKey(nsISmtpServer *aServer, void *aData)
{
  findServerByKeyEntry *entry = (findServerByKeyEntry*) aData;

  nsCString key;
  nsresult rv = aServer->GetKey(getter_Copies(key));
  if (NS_FAILED(rv))
    return true;

  if (key.Equals(entry->key)) 
  {
    entry->server = aServer;
    return false;
  }
    
  return true;
}

NS_IMETHODIMP
nsSmtpService::CreateServer(nsISmtpServer **aResult)
{
    if (!aResult) return NS_ERROR_NULL_POINTER;

    loadSmtpServers();
    nsresult rv;
    int32_t i = 0;
    bool unique = false;

    findServerByKeyEntry entry;
    nsAutoCString key;

    do {
        key = "smtp";
        key.AppendInt(++i);
        entry.key = key.get();
        entry.server = nullptr;

        mSmtpServers.EnumerateForwards(findServerByKey, (void *)&entry);
        if (!entry.server) unique=true;

    } while (!unique);

    rv = createKeyedServer(key.get(), aResult);
    NS_ENSURE_SUCCESS(rv, rv);
    return saveKeyList();
}


nsresult
nsSmtpService::GetServerByKey(const char* aKey, nsISmtpServer **aResult)
{
    NS_ENSURE_ARG_POINTER(aResult);

    if (!aKey || !*aKey)
    {
      NS_ASSERTION(false, "bad key");
      return NS_ERROR_FAILURE;
    }
    findServerByKeyEntry entry;
    entry.key = aKey;
    entry.server = nullptr;
    mSmtpServers.EnumerateForwards(findServerByKey, (void *)&entry);

    if (entry.server) {
        NS_ADDREF(*aResult = entry.server);
        return NS_OK;
    }

    // not found in array, I guess we load it
    return createKeyedServer(aKey, aResult);
}

NS_IMETHODIMP
nsSmtpService::DeleteServer(nsISmtpServer *aServer)
{
    if (!aServer) return NS_OK;

    int32_t idx = mSmtpServers.IndexOf(aServer);
    if (idx == -1)
      return NS_OK;

    nsCString serverKey;
    aServer->GetKey(getter_Copies(serverKey));
    
    mSmtpServers.RemoveObjectAt(idx);

    if (mDefaultSmtpServer.get() == aServer)
        mDefaultSmtpServer = nullptr;
    if (mSessionDefaultServer.get() == aServer)
        mSessionDefaultServer = nullptr;
    
    nsAutoCString newServerList;
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
    return NS_OK;
}

bool
nsSmtpService::findServerByHostname(nsISmtpServer *aServer, void *aData)
{
  findServerByHostnameEntry *entry = (findServerByHostnameEntry*)aData;

  nsCString hostname;
  nsresult rv = aServer->GetHostname(hostname);
  if (NS_FAILED(rv))
    return true;

  nsCString username;
  rv = aServer->GetUsername(username);
  if (NS_FAILED(rv))
    return true;

  bool checkHostname = !entry->hostname.IsEmpty();
  bool checkUsername = !entry->username.IsEmpty();
    
  if ((!checkHostname ||
       (entry->hostname.Equals(hostname, nsCaseInsensitiveCStringComparator())) &&
       (!checkUsername ||
        entry->username.Equals(username, nsCaseInsensitiveCStringComparator()))))
  {
    entry->server = aServer;
    return false;        // stop when found
  }
  return true;
}

NS_IMETHODIMP
nsSmtpService::FindServer(const char *aUsername,
                          const char *aHostname, nsISmtpServer ** aResult)
{
    NS_ENSURE_ARG_POINTER(aResult);

    findServerByHostnameEntry entry;
    entry.server = nullptr;
    entry.hostname = aHostname;
    entry.username = aUsername;

    mSmtpServers.EnumerateForwards(findServerByHostname, (void *)&entry);

    // entry.server may be null, but that's ok.
    // just return null if no server is found
    NS_IF_ADDREF(*aResult = entry.server);
    
    return NS_OK;
}

NS_IMETHODIMP
nsSmtpService::GetServerByIdentity(nsIMsgIdentity *aSenderIdentity,
                                   nsISmtpServer **aSmtpServer)
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
