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
 *   Nick Kreeger <nick.kreeger@park.edu>
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
#include "nsMsgImapCID.h"

#include "netCore.h"

#include "nsIServiceManager.h"
#include "nsIComponentManager.h"

#include "nsIIMAPHostSessionList.h"
#include "nsImapService.h"

#include "nsImapUrl.h"
#include "nsCOMPtr.h"
#include "nsIMsgFolder.h"
#include "nsIMsgImapMailFolder.h"
#include "nsIImapIncomingServer.h"
#include "nsIImapServerSink.h"
#include "nsIImapMockChannel.h"
#include "nsImapUtils.h"
#include "nsIDocShell.h"
#include "nsIDocShellLoadInfo.h"
#include "nsIRDFService.h"
#include "nsReadableUtils.h"
#include "nsRDFCID.h"
#include "nsEscape.h"
#include "nsIMsgStatusFeedback.h"
#include "nsIPrefBranch.h"
#include "nsIPrefService.h"
#include "nsILoadGroup.h"
#include "nsIMsgAccountManager.h"
#include "nsMsgBaseCID.h"
#include "nsMsgFolderFlags.h"
#include "nsISubscribableServer.h"
#include "nsIDirectoryService.h"
#include "nsMailDirServiceDefs.h"
#include "nsIWebNavigation.h"
#include "nsImapStringBundle.h"
#include "plbase64.h"
#include "nsImapOfflineSync.h"
#include "nsIMsgHdr.h"
#include "nsMsgUtils.h"
#include "nsICacheService.h"
#include "nsIStreamListenerTee.h"
#include "nsNetCID.h"
#include "nsMsgI18N.h"
#include "nsIOutputStream.h"
#include "nsIInputStream.h"
#include "nsISeekableStream.h"
#include "nsICopyMsgStreamListener.h"
#include "nsIMsgParseMailMsgState.h"
#include "nsMsgLocalCID.h"
#include "nsIOutputStream.h"
#include "nsIDocShell.h"
#include "nsIDocShellLoadInfo.h"
#include "nsIDOMWindowInternal.h"
#include "nsIMessengerWindowService.h"
#include "nsIWindowMediator.h"
#include "nsIPrompt.h"
#include "nsIWindowWatcher.h"
#include "nsImapProtocol.h"
#include "nsIMsgMailSession.h"
#include "nsIStreamConverterService.h"
#include "nsIAutoSyncManager.h"
#include "nsThreadUtils.h"
#include "nsNetUtil.h"
#include "nsInt64.h"
#include "nsMsgMessageFlags.h"

#define PREF_MAIL_ROOT_IMAP "mail.root.imap"            // old - for backward compatibility only
#define PREF_MAIL_ROOT_IMAP_REL "mail.root.imap-rel"

static NS_DEFINE_CID(kImapUrlCID, NS_IMAPURL_CID);
static NS_DEFINE_CID(kCImapMockChannel, NS_IMAPMOCKCHANNEL_CID);
static NS_DEFINE_CID(kCacheServiceCID, NS_CACHESERVICE_CID);


static const char sequenceString[] = "SEQUENCE";
static const char uidString[] = "UID";

static PRBool gInitialized = PR_FALSE;
static PRInt32 gMIMEOnDemandThreshold = 15000;
static PRBool gMIMEOnDemand = PR_FALSE;

NS_IMPL_THREADSAFE_ADDREF(nsImapService)
NS_IMPL_THREADSAFE_RELEASE(nsImapService)
NS_IMPL_QUERY_INTERFACE6(nsImapService,
                         nsIImapService,
                         nsIMsgMessageService,
                         nsIProtocolHandler,
                         nsIMsgProtocolInfo,
                         nsIMsgMessageFetchPartService,
                         nsIContentHandler)

nsImapService::nsImapService()
{
  mPrintingOperation = PR_FALSE;
  if (!gInitialized)
  {
    nsresult rv;
    nsCOMPtr<nsIPrefBranch> prefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv)); 
    if (NS_SUCCEEDED(rv) && prefBranch) 
    {
      prefBranch->GetBoolPref("mail.imap.mime_parts_on_demand", &gMIMEOnDemand);
      prefBranch->GetIntPref("mail.imap.mime_parts_on_demand_threshold", &gMIMEOnDemandThreshold);
    }

    // initialize auto-sync service
    nsCOMPtr<nsIAutoSyncManager> autoSyncMgr = do_GetService(NS_AUTOSYNCMANAGER_CONTRACTID, &rv);
    if (NS_SUCCEEDED(rv) && autoSyncMgr) 
    {
      // auto-sync manager initialization goes here
      // assign new strategy objects here... 
    }
    NS_ASSERTION(autoSyncMgr != nsnull, "*** Cannot initialize nsAutoSyncManager service.");

    gInitialized = PR_TRUE;
  }
}

nsImapService::~nsImapService()
{
}

char nsImapService::GetHierarchyDelimiter(nsIMsgFolder *aMsgFolder)
{
  char delimiter = '/';
  if (aMsgFolder)
  {
    nsCOMPtr<nsIMsgImapMailFolder> imapFolder = do_QueryInterface(aMsgFolder);
    if (imapFolder)
      imapFolder->GetHierarchyDelimiter(&delimiter);
  }
  return delimiter;
}

// N.B., this returns an escaped folder name, appropriate for putting in a url.
nsresult nsImapService::GetFolderName(nsIMsgFolder *aImapFolder, nsACString &aFolderName)
{
  nsresult rv;
  nsCOMPtr<nsIMsgImapMailFolder> aFolder(do_QueryInterface(aImapFolder, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCString onlineName;
  // online name is in imap utf-7 - leave it that way
  rv = aFolder->GetOnlineName(onlineName);
  NS_ENSURE_SUCCESS(rv, rv);
  if (onlineName.IsEmpty())
  {
    nsCString uri;
    rv = aImapFolder->GetURI(uri);
    NS_ENSURE_SUCCESS(rv, rv);
    nsCString hostname;
    rv = aImapFolder->GetHostname(hostname);
    NS_ENSURE_SUCCESS(rv, rv);
    rv = nsImapURI2FullName(kImapRootURI, hostname.get(), uri.get(), getter_Copies(onlineName));
  }
  // if the hierarchy delimiter is not '/', then we want to escape slashes;
  // otherwise, we do want to escape slashes.
  // we want to escape slashes and '^' first, otherwise, nsEscape will lose them
  PRBool escapeSlashes = (GetHierarchyDelimiter(aImapFolder) != '/');
  if (escapeSlashes && !onlineName.IsEmpty())
  {
    char* escapedOnlineName;
    rv = nsImapUrl::EscapeSlashes(onlineName.get(), &escapedOnlineName);
    if (NS_SUCCEEDED(rv))
      onlineName.Adopt(escapedOnlineName);
  }
  // need to escape everything else
  aFolderName.Adopt(nsEscape(onlineName.get(), url_Path));
  return rv;
}

NS_IMETHODIMP nsImapService::SelectFolder(nsIEventTarget *aClientEventTarget, 
                                          nsIMsgFolder *aImapMailFolder, 
                                          nsIUrlListener *aUrlListener, 
                                          nsIMsgWindow *aMsgWindow,
                                          nsIURI **aURL)
{
  NS_ENSURE_ARG_POINTER(aImapMailFolder);
  NS_ENSURE_ARG_POINTER(aClientEventTarget);

  if (WeAreOffline())
    return NS_MSG_ERROR_OFFLINE;

  PRBool canOpenThisFolder = PR_TRUE;
  nsCOMPtr<nsIMsgImapMailFolder> imapFolder = do_QueryInterface(aImapMailFolder);
  if (imapFolder)
    imapFolder->GetCanOpenFolder(&canOpenThisFolder);

  if (!canOpenThisFolder) 
    return NS_OK;

  nsresult rv;
  nsCOMPtr<nsIImapUrl> imapUrl;
  nsCAutoString urlSpec;
  char hierarchyDelimiter = GetHierarchyDelimiter(aImapMailFolder);
  rv = CreateStartOfImapUrl(EmptyCString(), getter_AddRefs(imapUrl),
                            aImapMailFolder, aUrlListener, urlSpec, hierarchyDelimiter);

  if (NS_SUCCEEDED(rv) && imapUrl)
  {
    // nsImapUrl::SetSpec() will set the imap action properly
    rv = imapUrl->SetImapAction(nsIImapUrl::nsImapSelectFolder);

    nsCOMPtr<nsIMsgMailNewsUrl> mailNewsUrl = do_QueryInterface(imapUrl);
    // if no msg window, we won't put up error messages (this is almost certainly a biff-inspired get new msgs)
    if (!aMsgWindow)
      mailNewsUrl->SetSuppressErrorMsgs(PR_TRUE);
    mailNewsUrl->SetMsgWindow(aMsgWindow);
    mailNewsUrl->SetUpdatingFolder(PR_TRUE);
    rv = SetImapUrlSink(aImapMailFolder, imapUrl);

    if (NS_SUCCEEDED(rv))
    {
      nsCAutoString folderName;
      GetFolderName(aImapMailFolder, folderName);
      urlSpec.Append("/select>");
      urlSpec.Append(hierarchyDelimiter);
      urlSpec.Append(folderName);
      rv = mailNewsUrl->SetSpec(urlSpec);
      if (NS_SUCCEEDED(rv))
        rv = GetImapConnectionAndLoadUrl(aClientEventTarget, imapUrl, nsnull, aURL);
    }
  } // if we have a url to run....

  return rv;
}

// lite select, used to verify UIDVALIDITY while going on/offline
NS_IMETHODIMP nsImapService::LiteSelectFolder(nsIEventTarget *aClientEventTarget,
                                              nsIMsgFolder *aImapMailFolder,
                                              nsIUrlListener *aUrlListener,
                                              nsIMsgWindow *aMsgWindow,
                                              nsIURI **aURL)
{
  return FolderCommand(aClientEventTarget, aImapMailFolder, aUrlListener,
                       "/liteselect>", nsIImapUrl::nsImapLiteSelectFolder, aMsgWindow, aURL);
}

NS_IMETHODIMP nsImapService::GetUrlForUri(const char *aMessageURI, 
                                          nsIURI **aURL, 
                                          nsIMsgWindow *aMsgWindow) 
{
  nsresult rv = NS_OK;

  nsCAutoString messageURI(aMessageURI);

  if (messageURI.Find(NS_LITERAL_CSTRING("&type=application/x-message-display")) != kNotFound)
    return NS_NewURI(aURL, aMessageURI);

  nsCOMPtr<nsIMsgFolder> folder;
  nsCAutoString msgKey;
  rv = DecomposeImapURI(messageURI, getter_AddRefs(folder), msgKey);
  if (NS_SUCCEEDED(rv))
  {
    nsCOMPtr<nsIImapUrl> imapUrl;
    nsCAutoString urlSpec;
    char hierarchyDelimiter = GetHierarchyDelimiter(folder);
    rv = CreateStartOfImapUrl(messageURI, getter_AddRefs(imapUrl), folder, nsnull, urlSpec, hierarchyDelimiter);
    NS_ENSURE_SUCCESS(rv, rv);
    rv = SetImapUrlSink(folder, imapUrl);
    NS_ENSURE_SUCCESS(rv, rv);
    nsCOMPtr <nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(imapUrl);
    PRBool useLocalCache = PR_FALSE;
    folder->HasMsgOffline(atoi(msgKey.get()), &useLocalCache);
    mailnewsUrl->SetMsgIsInLocalCache(useLocalCache);

    nsCOMPtr<nsIURI> url = do_QueryInterface(imapUrl);
    url->GetSpec(urlSpec);
    urlSpec.Append("fetch>UID>");
    urlSpec.Append(hierarchyDelimiter);

    nsCAutoString folderName;
    GetFolderName(folder, folderName);
    urlSpec.Append(folderName);
    urlSpec.Append(">");
    urlSpec.Append(msgKey);
    rv = url->SetSpec(urlSpec);
    imapUrl->QueryInterface(NS_GET_IID(nsIURI), (void **) aURL);
  }

  return rv;
}

NS_IMETHODIMP nsImapService::OpenAttachment(const char *aContentType, 
                                            const char *aFileName,
                                            const char *aUrl, 
                                            const char *aMessageUri, 
                                            nsISupports *aDisplayConsumer, 
                                            nsIMsgWindow *aMsgWindow, 
                                            nsIUrlListener *aUrlListener)
{
  nsresult rv = NS_OK;
  // okay this is a little tricky....we may have to fetch the mime part
  // or it may already be downloaded for us....the only way i can tell to 
  // distinguish the two events is to search for ?section or ?part
  
  nsCAutoString uri(aMessageUri);
  nsCAutoString urlString(aUrl);
  urlString.ReplaceSubstring("/;section", "?section");
  
  // more stuff i don't understand
  PRInt32 sectionPos = urlString.Find("?section");
  // if we have a section field then we must be dealing with a mime part we need to fetchf
  if (sectionPos > 0)
  {
    nsCAutoString mimePart;
    
    urlString.Right(mimePart, urlString.Length() - sectionPos); 
    uri.Append(mimePart);
    uri += "&type=";
    uri += aContentType;
    uri += "&filename=";
    uri += aFileName;
  }
  else
  {
    // try to extract the specific part number out from the url string
    const char *partStart = PL_strstr(aUrl, "part=");
    if (!partStart)
      return NS_ERROR_FAILURE;
    nsDependentCString part(partStart);
    uri += "?";
    uri += Substring(part, 0, part.FindChar('&'));
    uri += "&type=";
    uri += aContentType;
    uri += "&filename=";
    uri += aFileName;
  }

  nsCOMPtr<nsIMsgFolder> folder;
  nsCAutoString msgKey;
  nsCAutoString uriMimePart;
  nsCAutoString	folderURI;
  nsMsgKey key;

  rv = DecomposeImapURI(uri, getter_AddRefs(folder), msgKey);
  rv = nsParseImapMessageURI(uri.get(), folderURI, &key, getter_Copies(uriMimePart));
  if (NS_SUCCEEDED(rv))
  {
    nsCOMPtr<nsIImapMessageSink> imapMessageSink(do_QueryInterface(folder, &rv));
    if (NS_SUCCEEDED(rv))
    {
      nsCOMPtr<nsIImapUrl> imapUrl;
      nsCAutoString urlSpec;
      char hierarchyDelimiter = GetHierarchyDelimiter(folder);
      rv = CreateStartOfImapUrl(uri, getter_AddRefs(imapUrl), folder, aUrlListener, urlSpec, hierarchyDelimiter);
      NS_ENSURE_SUCCESS(rv, rv);

      urlSpec.Append("/fetch>UID>");
      urlSpec.Append(hierarchyDelimiter);

      nsCString folderName;
      GetFolderName(folder, folderName);
      urlSpec.Append(folderName);
      urlSpec.Append(">");
      urlSpec.Append(msgKey);
      urlSpec.Append(uriMimePart);

      if (!uriMimePart.IsEmpty())
      {
        nsCOMPtr<nsIMsgMailNewsUrl> mailUrl (do_QueryInterface(imapUrl));
        if (mailUrl)
        {
          mailUrl->SetSpec(urlSpec);
          mailUrl->SetFileName(nsDependentCString(aFileName));
        }
        rv =  FetchMimePart(imapUrl, nsIImapUrl::nsImapOpenMimePart, folder, imapMessageSink,
                            nsnull, aDisplayConsumer, msgKey, uriMimePart);
      }
    } // if we got a message sink
  } // if we parsed the message uri

  return rv;
}

NS_IMETHODIMP nsImapService::FetchMimePart(nsIURI *aURI, 
                                           const char *aMessageURI, 
                                           nsISupports *aDisplayConsumer, 
                                           nsIMsgWindow *aMsgWindow, 
                                           nsIUrlListener *aUrlListener, 
                                           nsIURI **aURL)
{
  nsresult rv = NS_OK;
  nsCOMPtr<nsIMsgFolder> folder;
  nsCAutoString messageURI(aMessageURI);
  nsCAutoString msgKey;
  nsCAutoString mimePart;
  nsCAutoString folderURI;
  nsMsgKey key;
  
  rv = DecomposeImapURI(messageURI, getter_AddRefs(folder), msgKey);
  rv = nsParseImapMessageURI(aMessageURI, folderURI, &key, getter_Copies(mimePart));
  if (NS_SUCCEEDED(rv))
  {
    nsCOMPtr<nsIImapMessageSink> imapMessageSink(do_QueryInterface(folder, &rv));
    if (NS_SUCCEEDED(rv))
    {
      nsCOMPtr<nsIImapUrl> imapUrl = do_QueryInterface(aURI);
      nsCOMPtr<nsIMsgMailNewsUrl> msgurl (do_QueryInterface(aURI));
      
      msgurl->SetMsgWindow(aMsgWindow);
      msgurl->RegisterListener(aUrlListener);
      
      if (!mimePart.IsEmpty())
      {
        return FetchMimePart(imapUrl, nsIImapUrl::nsImapMsgFetch, folder, imapMessageSink,
          aURL, aDisplayConsumer, msgKey, mimePart);
      }
    }
  }
  return rv;
}

NS_IMETHODIMP nsImapService::DisplayMessage(const char *aMessageURI,
                                            nsISupports *aDisplayConsumer,  
                                            nsIMsgWindow *aMsgWindow,
                                            nsIUrlListener *aUrlListener,
                                            const char *aCharsetOverride,
                                            nsIURI **aURL)
{
  nsresult rv = NS_OK;
  nsCOMPtr<nsIMsgFolder> folder;
  nsCAutoString msgKey;
  nsCAutoString mimePart;
  nsCAutoString	folderURI;
  nsMsgKey key;
  nsCAutoString messageURI(aMessageURI);

  PRInt32 typeIndex = messageURI.Find("&type=application/x-message-display");
  if (typeIndex != kNotFound)
  {
    // This happens with forward inline of a message/rfc822 attachment opened in
    // a standalone msg window.
    // So, just cut to the chase and call AsyncOpen on a channel.
    nsCOMPtr <nsIURI> uri;
    messageURI.Cut(typeIndex, sizeof("&type=application/x-message-display") - 1);
    rv = NS_NewURI(getter_AddRefs(uri), messageURI.get());
    NS_ENSURE_SUCCESS(rv, rv);
    if (aURL)
      NS_IF_ADDREF(*aURL = uri);
    nsCOMPtr<nsIStreamListener> aStreamListener = do_QueryInterface(aDisplayConsumer, &rv);
    if (NS_SUCCEEDED(rv) && aStreamListener)
    {
      nsCOMPtr<nsIChannel> aChannel;
      nsCOMPtr<nsILoadGroup> aLoadGroup;
      nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(uri, &rv);
      if (NS_SUCCEEDED(rv) && mailnewsUrl)
        mailnewsUrl->GetLoadGroup(getter_AddRefs(aLoadGroup));

      rv = NewChannel(uri, getter_AddRefs(aChannel));
      NS_ENSURE_SUCCESS(rv, rv);

      nsCOMPtr<nsISupports> aCtxt = do_QueryInterface(uri);
      //  now try to open the channel passing in our display consumer as the listener
      return aChannel->AsyncOpen(aStreamListener, aCtxt);
    }
  }

  rv = DecomposeImapURI(messageURI, getter_AddRefs(folder), msgKey);
  if (msgKey.IsEmpty())
    return NS_MSG_MESSAGE_NOT_FOUND;

  rv = nsParseImapMessageURI(aMessageURI, folderURI, &key, getter_Copies(mimePart));
  if (NS_SUCCEEDED(rv))
  {
    nsCOMPtr<nsIImapMessageSink> imapMessageSink(do_QueryInterface(folder, &rv));
    if (NS_SUCCEEDED(rv))
    {
      nsCOMPtr<nsIImapUrl> imapUrl;
      nsCAutoString urlSpec;
      char hierarchyDelimiter = GetHierarchyDelimiter(folder);
      rv = CreateStartOfImapUrl(messageURI, getter_AddRefs(imapUrl), folder, aUrlListener, urlSpec, hierarchyDelimiter);
      NS_ENSURE_SUCCESS(rv, rv);
      if (!mimePart.IsEmpty())
      {
        return FetchMimePart(imapUrl, nsIImapUrl::nsImapMsgFetch, folder, imapMessageSink,
                             aURL, aDisplayConsumer, msgKey, mimePart);
      }

      nsCOMPtr<nsIMsgMailNewsUrl> msgurl (do_QueryInterface(imapUrl));
      nsCOMPtr<nsIMsgI18NUrl> i18nurl (do_QueryInterface(imapUrl));
      i18nurl->SetCharsetOverRide(aCharsetOverride);

      PRUint32 messageSize;
      PRBool useMimePartsOnDemand = gMIMEOnDemand;
      PRBool shouldStoreMsgOffline = PR_FALSE;
      PRBool hasMsgOffline = PR_FALSE;

      nsCOMPtr<nsIMsgIncomingServer> aMsgIncomingServer;

      if (imapMessageSink)
        imapMessageSink->GetMessageSizeFromDB(msgKey.get(), &messageSize);

      msgurl->SetMsgWindow(aMsgWindow);

      rv = msgurl->GetServer(getter_AddRefs(aMsgIncomingServer));

      if (NS_SUCCEEDED(rv) && aMsgIncomingServer)
      {
        nsCOMPtr<nsIImapIncomingServer> aImapServer(do_QueryInterface(aMsgIncomingServer, &rv));
        if (NS_SUCCEEDED(rv) && aImapServer)
          aImapServer->GetMimePartsOnDemand(&useMimePartsOnDemand);
      }

      nsCAutoString uriStr(aMessageURI);
      PRInt32 keySeparator = uriStr.RFindChar('#');
      if(keySeparator != -1)
      {
        PRInt32 keyEndSeparator = uriStr.FindCharInSet("/?&", 
                                                       keySeparator); 
        PRInt32 mpodFetchPos = uriStr.Find("fetchCompleteMessage=true", PR_FALSE, keyEndSeparator);
        if (mpodFetchPos != -1)
          useMimePartsOnDemand = PR_FALSE;
      }

      if (folder)
      {
        folder->ShouldStoreMsgOffline(key, &shouldStoreMsgOffline);
        folder->HasMsgOffline(key, &hasMsgOffline);
      }
      imapUrl->SetStoreResultsOffline(shouldStoreMsgOffline);
      msgurl->SetAddToMemoryCache(!hasMsgOffline);
      imapUrl->SetFetchPartsOnDemand(
        useMimePartsOnDemand && messageSize >= (PRUint32) gMIMEOnDemandThreshold);

      if (hasMsgOffline)
        msgurl->SetMsgIsInLocalCache(PR_TRUE);

      nsCOMPtr<nsIPrefBranch> prefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
      // Should the message fetch force a peek or a traditional fetch?
      // Force peek if there is a delay in marking read (or no auto-marking at all).
      // This is because a FETCH (BODY[]) will implicitly set tha \Seen flag on the msg,
      // but a FETCH (BODY.PEEK[]) won't.
      PRBool forcePeek = PR_FALSE;
      if (NS_SUCCEEDED(rv) && prefBranch)
      {
        PRBool markReadAuto = PR_TRUE;
        prefBranch->GetBoolPref("mailnews.mark_message_read.auto", &markReadAuto);
        PRBool markReadDelay = PR_FALSE;
        prefBranch->GetBoolPref("mailnews.mark_message_read.delay", &markReadDelay);
        forcePeek = (!markReadAuto || markReadDelay);
      }

      rv = FetchMessage(imapUrl, forcePeek ? nsIImapUrl::nsImapMsgFetchPeek : nsIImapUrl::nsImapMsgFetch, 
                        folder, imapMessageSink, aMsgWindow, aDisplayConsumer, msgKey, PR_FALSE, 
                        (mPrintingOperation) ? NS_LITERAL_CSTRING("print") : EmptyCString(), aURL);
    }
  }
  return rv;
}


nsresult nsImapService::FetchMimePart(nsIImapUrl *aImapUrl,
                                      nsImapAction aImapAction,
                                      nsIMsgFolder *aImapMailFolder, 
                                      nsIImapMessageSink *aImapMessage,
                                      nsIURI **aURL,
                                      nsISupports *aDisplayConsumer, 
                                      const nsACString &messageIdentifierList,
                                      const nsACString &mimePart) 
{
  NS_ENSURE_ARG_POINTER(aImapUrl);
  NS_ENSURE_ARG_POINTER(aImapMailFolder);
  NS_ENSURE_ARG_POINTER(aImapMessage);

  // create a protocol instance to handle the request.
  // NOTE: once we start working with multiple connections, this step will be much more complicated...but for now
  // just create a connection and process the request.
  nsCAutoString urlSpec;
  nsresult rv = SetImapUrlSink(aImapMailFolder, aImapUrl);
  nsImapAction actionToUse = aImapAction;
  if (actionToUse == nsImapUrl::nsImapOpenMimePart)
    actionToUse = nsIImapUrl::nsImapMsgFetch;

  nsCOMPtr<nsIMsgMailNewsUrl> msgurl (do_QueryInterface(aImapUrl));
  if (aImapMailFolder && msgurl && !messageIdentifierList.IsEmpty())
  {
    PRBool useLocalCache = PR_FALSE;
    aImapMailFolder->HasMsgOffline(atoi(nsCString(messageIdentifierList).get()), &useLocalCache);
    msgurl->SetMsgIsInLocalCache(useLocalCache);
  }
  rv = aImapUrl->SetImapMessageSink(aImapMessage);
  if (NS_SUCCEEDED(rv))
  {
    nsCOMPtr<nsIURI> url = do_QueryInterface(aImapUrl);
    url->GetSpec(urlSpec);
    
    // rhp: If we are displaying this message for the purpose of printing, we
    // need to append the header=print option.
    //
    if (mPrintingOperation)
      urlSpec.Append("?header=print");
    
    rv = url->SetSpec(urlSpec);
    
    rv = aImapUrl->SetImapAction(actionToUse /* nsIImapUrl::nsImapMsgFetch */);
    if (aImapMailFolder && aDisplayConsumer)
    {
      nsCOMPtr<nsIMsgIncomingServer> aMsgIncomingServer;
      rv = aImapMailFolder->GetServer(getter_AddRefs(aMsgIncomingServer));
      if (NS_SUCCEEDED(rv) && aMsgIncomingServer)
      {
        PRBool interrupted;
        nsCOMPtr<nsIImapIncomingServer>
          aImapServer(do_QueryInterface(aMsgIncomingServer, &rv));
        if (NS_SUCCEEDED(rv) && aImapServer)
          aImapServer->PseudoInterruptMsgLoad(aImapMailFolder, nsnull, &interrupted);
      }
    }
    // if the display consumer is a docshell, then we should run the url in the docshell.
    // otherwise, it should be a stream listener....so open a channel using AsyncRead
    // and the provided stream listener....
    
    nsCOMPtr<nsIDocShell> docShell(do_QueryInterface(aDisplayConsumer, &rv));
    if (NS_SUCCEEDED(rv) && docShell)
    {
      nsCOMPtr<nsIDocShellLoadInfo> loadInfo;
      // DIRTY LITTLE HACK --> if we are opening an attachment we want the docshell to
      // treat this load as if it were a user click event. Then the dispatching stuff will be much
      // happier.
      if (aImapAction == nsImapUrl::nsImapOpenMimePart)
      {
        docShell->CreateLoadInfo(getter_AddRefs(loadInfo));
        loadInfo->SetLoadType(nsIDocShellLoadInfo::loadLink);
      }
      
      rv = docShell->LoadURI(url, loadInfo, nsIWebNavigation::LOAD_FLAGS_NONE, PR_FALSE);
    }
    else
    {
      nsCOMPtr<nsIStreamListener> aStreamListener = do_QueryInterface(aDisplayConsumer, &rv);
      if (NS_SUCCEEDED(rv) && aStreamListener)
      {
        nsCOMPtr<nsIChannel> aChannel;
        nsCOMPtr<nsILoadGroup> loadGroup;
        nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(aImapUrl, &rv);
        if (NS_SUCCEEDED(rv) && mailnewsUrl)
          mailnewsUrl->GetLoadGroup(getter_AddRefs(loadGroup));
        
        rv = NewChannel(url, getter_AddRefs(aChannel));
        NS_ENSURE_SUCCESS(rv, rv);
        
        // we need a load group to hold onto the channel. When the request is finished,
        // it'll get removed from the load group, and the channel will go away,
        // which will free the load group.
        if (!loadGroup)
          loadGroup = do_CreateInstance(NS_LOADGROUP_CONTRACTID);

        aChannel->SetLoadGroup(loadGroup);

        nsCOMPtr<nsISupports> aCtxt = do_QueryInterface(url);
        //  now try to open the channel passing in our display consumer as the listener
        rv = aChannel->AsyncOpen(aStreamListener, aCtxt);
      }
      else // do what we used to do before
      {
        // I'd like to get rid of this code as I believe that we always get a docshell
        // or stream listener passed into us in this method but i'm not sure yet...
        // I'm going to use an assert for now to figure out if this is ever getting called
#if defined(DEBUG_mscott) || defined(DEBUG_bienvenu)
        NS_ASSERTION(0, "oops...someone still is reaching this part of the code");
#endif
        rv = GetImapConnectionAndLoadUrl(NS_GetCurrentThread(), aImapUrl,
                                         aDisplayConsumer, aURL);
      }
    }
  }
  return rv;
}

//
// rhp: Right now, this is the same as simple DisplayMessage, but it will change
// to support print rendering.
//
NS_IMETHODIMP nsImapService::DisplayMessageForPrinting(const char *aMessageURI,
                                                       nsISupports *aDisplayConsumer,  
                                                       nsIMsgWindow *aMsgWindow,
                                                       nsIUrlListener *aUrlListener,
                                                       nsIURI **aURL) 
{
  mPrintingOperation = PR_TRUE;
  nsresult rv = DisplayMessage(aMessageURI, aDisplayConsumer, aMsgWindow, aUrlListener, nsnull, aURL);
  mPrintingOperation = PR_FALSE;
  return rv;
}

NS_IMETHODIMP nsImapService::CopyMessage(const char *aSrcMailboxURI, 
                                         nsIStreamListener *aMailboxCopy, 
                                         PRBool moveMessage,
                                         nsIUrlListener *aUrlListener, 
                                         nsIMsgWindow *aMsgWindow, 
                                         nsIURI **aURL)
{
  NS_ENSURE_ARG_POINTER(aSrcMailboxURI);
  NS_ENSURE_ARG_POINTER(aMailboxCopy);
  
  nsresult rv;
  nsCOMPtr<nsISupports> streamSupport;
  streamSupport = do_QueryInterface(aMailboxCopy, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsIMsgFolder> folder;
  nsCAutoString msgKey;
  rv = DecomposeImapURI(nsDependentCString(aSrcMailboxURI), getter_AddRefs(folder), msgKey);
  if (NS_SUCCEEDED(rv))
  {
    nsCOMPtr<nsIImapMessageSink> imapMessageSink(do_QueryInterface(folder, &rv));
    if (NS_SUCCEEDED(rv))
    {
      nsCOMPtr<nsIImapUrl> imapUrl;
      nsCAutoString urlSpec;
      char hierarchyDelimiter = GetHierarchyDelimiter(folder);
      PRBool hasMsgOffline = PR_FALSE;
      nsMsgKey key = atoi(msgKey.get());

      rv = CreateStartOfImapUrl(nsDependentCString(aSrcMailboxURI), getter_AddRefs(imapUrl),
                                folder, aUrlListener, urlSpec, hierarchyDelimiter);
      if (folder)
      {
        nsCOMPtr<nsIMsgMailNewsUrl> msgurl (do_QueryInterface(imapUrl));
        folder->HasMsgOffline(key, &hasMsgOffline);
        if (msgurl)
          msgurl->SetMsgIsInLocalCache(hasMsgOffline);
      }
      // now try to download the message
      nsImapAction imapAction = nsIImapUrl::nsImapOnlineToOfflineCopy;
      if (moveMessage)
        imapAction = nsIImapUrl::nsImapOnlineToOfflineMove; 
      rv = FetchMessage(imapUrl,imapAction, folder, imapMessageSink,aMsgWindow, 
                        streamSupport, msgKey, PR_FALSE, EmptyCString(), aURL);
    } // if we got an imap message sink
  } // if we decomposed the imap message 
  return rv;
}

NS_IMETHODIMP nsImapService::CopyMessages(nsTArray<nsMsgKey> &keys, 
                                          nsIMsgFolder *srcFolder, 
                                          nsIStreamListener *aMailboxCopy, 
                                          PRBool moveMessage,
                                          nsIUrlListener *aUrlListener, 
                                          nsIMsgWindow *aMsgWindow, 
                                          nsIURI **aURL)
{
  NS_ENSURE_ARG_POINTER(aMailboxCopy);

  nsresult rv;
  nsCOMPtr<nsISupports> streamSupport = do_QueryInterface(aMailboxCopy, &rv);
  if (!streamSupport || NS_FAILED(rv)) 
    return rv;
  
  nsCOMPtr<nsIMsgFolder> folder = srcFolder;
  nsCAutoString msgKey;
  if (NS_SUCCEEDED(rv))
  {
    nsCOMPtr<nsIImapMessageSink> imapMessageSink(do_QueryInterface(folder, &rv));
    if (NS_SUCCEEDED(rv))
    {
      // we generate the uri for the first message so that way on down the line,
      // GetMessage in nsCopyMessageStreamListener will get an unescaped username
      // and be able to find the msg hdr. See bug 259656 for details
      nsCString uri;
      srcFolder->GenerateMessageURI(keys[0], uri);

      nsCString messageIds;
      PRUint32 numKeys = keys.Length();
      AllocateImapUidString(keys.Elements(), numKeys, nsnull, messageIds);
      nsCOMPtr<nsIImapUrl> imapUrl;
      nsCAutoString urlSpec;
      char hierarchyDelimiter = GetHierarchyDelimiter(folder);
      rv = CreateStartOfImapUrl(uri, getter_AddRefs(imapUrl), folder, aUrlListener, urlSpec, hierarchyDelimiter);
      nsImapAction action;
      if (moveMessage) // don't use ?: syntax here, it seems to break the Mac.
        action = nsIImapUrl::nsImapOnlineToOfflineMove;
      else
        action = nsIImapUrl::nsImapOnlineToOfflineCopy;
      imapUrl->SetCopyState(aMailboxCopy);
      // now try to display the message
      rv = FetchMessage(imapUrl, action, folder, imapMessageSink, aMsgWindow, 
                        streamSupport, messageIds, PR_FALSE, EmptyCString(), aURL);
      // ### end of copy operation should know how to do the delete.if this is a move
      
    } // if we got an imap message sink
  } // if we decomposed the imap message 
  return rv;
}

NS_IMETHODIMP nsImapService::Search(nsIMsgSearchSession *aSearchSession, 
                                    nsIMsgWindow *aMsgWindow, 
                                    nsIMsgFolder *aMsgFolder, 
                                    const char *aSearchUri)
{
  nsresult rv = NS_OK;
  nsCAutoString	folderURI;

  nsCOMPtr<nsIImapUrl> imapUrl;
  nsCOMPtr <nsIUrlListener> urlListener = do_QueryInterface(aSearchSession);

  nsCAutoString urlSpec;
  char hierarchyDelimiter = GetHierarchyDelimiter(aMsgFolder);
  rv = CreateStartOfImapUrl(EmptyCString(), getter_AddRefs(imapUrl), 
                            aMsgFolder, urlListener, urlSpec, hierarchyDelimiter);
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr<nsIMsgMailNewsUrl> msgurl (do_QueryInterface(imapUrl));

  msgurl->SetMsgWindow(aMsgWindow);
  msgurl->SetSearchSession(aSearchSession);
  rv = SetImapUrlSink(aMsgFolder, imapUrl);

  if (NS_SUCCEEDED(rv))
  {
    nsCString folderName;
    GetFolderName(aMsgFolder, folderName);

    nsCOMPtr <nsIMsgMailNewsUrl> mailNewsUrl = do_QueryInterface(imapUrl);
    if (!aMsgWindow)
      mailNewsUrl->SetSuppressErrorMsgs(PR_TRUE);

    urlSpec.Append("/search>UID>");
    urlSpec.Append(hierarchyDelimiter);
    urlSpec.Append(folderName);
    urlSpec.Append('>');
    // escape aSearchUri so that IMAP special characters (i.e. '\')
    // won't be replaced with '/' in NECKO.
    // it will be unescaped in nsImapUrl::ParseUrl().
    char *search_cmd = nsEscape((char *)aSearchUri, url_XAlphas);
    urlSpec.Append(search_cmd);
    NS_Free(search_cmd);
    rv = mailNewsUrl->SetSpec(urlSpec);
    if (NS_SUCCEEDED(rv))
      rv = GetImapConnectionAndLoadUrl(NS_GetCurrentThread(), imapUrl, nsnull, nsnull);
  }
  return rv;
}

// just a helper method to break down imap message URIs....
nsresult nsImapService::DecomposeImapURI(const nsACString &aMessageURI, 
                                         nsIMsgFolder **aFolder, 
                                         nsACString &aMsgKey)
{
  nsMsgKey msgKey;
  nsresult rv = DecomposeImapURI(aMessageURI, aFolder, &msgKey);
  NS_ENSURE_SUCCESS(rv,rv);

  if (msgKey) 
  {
    nsCAutoString messageIdString;
    messageIdString.AppendInt(msgKey);
    aMsgKey = messageIdString;
  }

  return rv;
}

// just a helper method to break down imap message URIs....
nsresult nsImapService::DecomposeImapURI(const nsACString &aMessageURI, 
                                         nsIMsgFolder **aFolder, 
                                         nsMsgKey *aMsgKey)
{
  NS_ENSURE_ARG_POINTER(aFolder);
  NS_ENSURE_ARG_POINTER(aMsgKey);
  
  nsresult rv = NS_OK;
  nsCAutoString folderURI;
  rv = nsParseImapMessageURI(nsDependentCString(aMessageURI).get(), folderURI, aMsgKey, nsnull);
  NS_ENSURE_SUCCESS(rv,rv);
  
  nsCOMPtr <nsIRDFService> rdf = do_GetService("@mozilla.org/rdf/rdf-service;1",&rv);
  NS_ENSURE_SUCCESS(rv,rv);
  
  nsCOMPtr<nsIRDFResource> res;
  rv = rdf->GetResource(folderURI, getter_AddRefs(res));
  NS_ENSURE_SUCCESS(rv,rv);
  
  nsCOMPtr<nsIMsgFolder> msgFolder = do_QueryInterface(res);
  if (!msgFolder)
    return NS_ERROR_FAILURE;
  
  msgFolder.swap(*aFolder);
  
  return NS_OK;
}

NS_IMETHODIMP nsImapService::SaveMessageToDisk(const char *aMessageURI, 
                                               nsIFile *aFile, 
                                               PRBool aAddDummyEnvelope, 
                                               nsIUrlListener *aUrlListener, 
                                               nsIURI **aURL,
                                               PRBool canonicalLineEnding,
                                               nsIMsgWindow *aMsgWindow)
{
  nsresult rv = NS_OK;
  nsCOMPtr<nsIMsgFolder> folder;
  nsCOMPtr<nsIImapUrl> imapUrl;
  nsCAutoString msgKey;

  rv = DecomposeImapURI(nsDependentCString(aMessageURI), getter_AddRefs(folder), msgKey);
  NS_ENSURE_SUCCESS(rv, rv);

  PRBool hasMsgOffline = PR_FALSE;

  if (folder)
    folder->HasMsgOffline(atoi(msgKey.get()), &hasMsgOffline);

  nsCAutoString urlSpec;
  char hierarchyDelimiter = GetHierarchyDelimiter(folder);
  rv = CreateStartOfImapUrl(nsDependentCString(aMessageURI), getter_AddRefs(imapUrl), 
                            folder, aUrlListener, urlSpec, hierarchyDelimiter);
  if (NS_SUCCEEDED(rv)) 
  {
    nsCOMPtr<nsIImapMessageSink> imapMessageSink(do_QueryInterface(folder, &rv));
    NS_ENSURE_SUCCESS(rv, rv);  
    nsCOMPtr<nsIMsgMessageUrl> msgUrl = do_QueryInterface(imapUrl, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    msgUrl->SetMessageFile(aFile);
    msgUrl->SetAddDummyEnvelope(aAddDummyEnvelope);
    msgUrl->SetCanonicalLineEnding(canonicalLineEnding);

    nsCOMPtr <nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(msgUrl);
    if (mailnewsUrl)
      mailnewsUrl->SetMsgIsInLocalCache(hasMsgOffline);

    nsCOMPtr <nsIStreamListener> saveAsListener;
    mailnewsUrl->GetSaveAsListener(aAddDummyEnvelope, aFile, getter_AddRefs(saveAsListener));

    return FetchMessage(imapUrl, nsIImapUrl::nsImapSaveMessageToDisk, folder, imapMessageSink, 
                        aMsgWindow, saveAsListener, msgKey, PR_FALSE, EmptyCString(), aURL);
  }
  return rv;
}

/* fetching RFC822 messages */
/* imap4://HOST>fetch><UID>>MAILBOXPATH>x */
/*   'x' is the message UID */
/* will set the 'SEEN' flag */
NS_IMETHODIMP nsImapService::AddImapFetchToUrl(nsIURI *aUrl,
                                               nsIMsgFolder *aImapMailFolder,
                                               const nsACString &aMessageIdentifierList,
                                               const nsACString &aAdditionalHeader)
{
  nsCAutoString urlSpec;
  aUrl->GetSpec(urlSpec);

  char hierarchyDelimiter = GetHierarchyDelimiter(aImapMailFolder);

  urlSpec.Append("fetch>UID>");
  urlSpec.Append(hierarchyDelimiter);

  nsCAutoString folderName;
  GetFolderName(aImapMailFolder, folderName);
  urlSpec.Append(folderName);

  urlSpec.Append(">");
  urlSpec.Append(aMessageIdentifierList);

  if (!aAdditionalHeader.IsEmpty())
  {
    urlSpec.Append("?header=");
    urlSpec.Append(aAdditionalHeader);
  }

  return aUrl->SetSpec(urlSpec);
}

NS_IMETHODIMP nsImapService::FetchMessage(nsIImapUrl *aImapUrl,
                                          nsImapAction aImapAction,
                                          nsIMsgFolder *aImapMailFolder, 
                                          nsIImapMessageSink *aImapMessage,
                                          nsIMsgWindow *aMsgWindow,
                                          nsISupports *aDisplayConsumer, 
                                          const nsACString &messageIdentifierList,
                                          PRBool aConvertDataToText,
                                          const nsACString &aAdditionalHeader,
                                          nsIURI **aURL)
{
  NS_ENSURE_ARG_POINTER(aImapUrl);
  NS_ENSURE_ARG_POINTER(aImapMailFolder);
  NS_ENSURE_ARG_POINTER(aImapMessage);

  nsresult rv;
  nsCOMPtr<nsIURI> url = do_QueryInterface(aImapUrl);

  rv = AddImapFetchToUrl(url, aImapMailFolder, messageIdentifierList, aAdditionalHeader);
  NS_ENSURE_SUCCESS(rv, rv);

  if (WeAreOffline())
  {
    PRBool msgIsInCache = PR_FALSE;
    nsCOMPtr<nsIMsgMailNewsUrl> msgUrl(do_QueryInterface(aImapUrl));
    msgUrl->GetMsgIsInLocalCache(&msgIsInCache);
    if (!msgIsInCache)
      IsMsgInMemCache(url, aImapMailFolder, nsnull, &msgIsInCache);

    // Display the "offline" message if we didn't find it in the memory cache either
    if (!msgIsInCache)
    {
      nsCOMPtr<nsIMsgIncomingServer> server;
      rv = aImapMailFolder->GetServer(getter_AddRefs(server));
      if (server && aDisplayConsumer)
        rv = server->DisplayOfflineMsg(aMsgWindow);
      return rv;
    }
  }

  if (aURL)
    NS_IF_ADDREF(*aURL = url);

  return GetMessageFromUrl(aImapUrl, aImapAction, aImapMailFolder, aImapMessage,
                           aMsgWindow, aDisplayConsumer, aConvertDataToText, aURL);
}

nsresult nsImapService::GetMessageFromUrl(nsIImapUrl *aImapUrl,
                                          nsImapAction aImapAction,
                                          nsIMsgFolder *aImapMailFolder,
                                          nsIImapMessageSink *aImapMessage,
                                          nsIMsgWindow *aMsgWindow,
                                          nsISupports *aDisplayConsumer,
                                          PRBool aConvertDataToText,
                                          nsIURI **aURL)
{
  nsresult rv = SetImapUrlSink(aImapMailFolder, aImapUrl);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = aImapUrl->SetImapMessageSink(aImapMessage);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = aImapUrl->SetImapAction(aImapAction);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIURI> url(do_QueryInterface(aImapUrl));

  // if the display consumer is a docshell, then we should run the url in the docshell.
  // otherwise, it should be a stream listener....so open a channel using AsyncRead
  // and the provided stream listener....
  
  nsCOMPtr<nsIDocShell> docShell(do_QueryInterface(aDisplayConsumer, &rv));
  if (aImapMailFolder && docShell)
  {
    nsCOMPtr<nsIMsgIncomingServer> aMsgIncomingServer;
    rv = aImapMailFolder->GetServer(getter_AddRefs(aMsgIncomingServer));
    if (NS_SUCCEEDED(rv) && aMsgIncomingServer)
    {
      PRBool interrupted;
      nsCOMPtr<nsIImapIncomingServer>
        aImapServer(do_QueryInterface(aMsgIncomingServer, &rv));
      if (NS_SUCCEEDED(rv) && aImapServer)
        aImapServer->PseudoInterruptMsgLoad(aImapMailFolder, aMsgWindow, &interrupted);
    }
  }
  if (NS_SUCCEEDED(rv) && docShell)
  {
    NS_ASSERTION(!aConvertDataToText, "can't convert to text when using docshell");
    rv = docShell->LoadURI(url, nsnull, nsIWebNavigation::LOAD_FLAGS_NONE, PR_FALSE);
  }
  else
  {
    nsCOMPtr<nsIStreamListener> streamListener = do_QueryInterface(aDisplayConsumer, &rv);
    nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(aImapUrl, &rv);
    if (aMsgWindow && mailnewsUrl)
      mailnewsUrl->SetMsgWindow(aMsgWindow);
    if (NS_SUCCEEDED(rv) && streamListener)
    {
      nsCOMPtr<nsIChannel> channel;
      nsCOMPtr<nsILoadGroup> loadGroup;
      if (NS_SUCCEEDED(rv) && mailnewsUrl)
        mailnewsUrl->GetLoadGroup(getter_AddRefs(loadGroup));
      
      rv = NewChannel(url, getter_AddRefs(channel));
      NS_ENSURE_SUCCESS(rv, rv);
      
      // we need a load group to hold onto the channel. When the request is finished,
      // it'll get removed from the load group, and the channel will go away,
      // which will free the load group.
      if (!loadGroup)
        loadGroup = do_CreateInstance(NS_LOADGROUP_CONTRACTID);

      rv = channel->SetLoadGroup(loadGroup);
      NS_ENSURE_SUCCESS(rv, rv);
      
      if (aConvertDataToText)
      {
        nsCOMPtr<nsIStreamListener> conversionListener;
        nsCOMPtr<nsIStreamConverterService> streamConverter = do_GetService("@mozilla.org/streamConverters;1", &rv);
        NS_ENSURE_SUCCESS(rv, rv);
        rv = streamConverter->AsyncConvertData("message/rfc822",
                                               "*/*", streamListener, channel, getter_AddRefs(conversionListener));
        NS_ENSURE_SUCCESS(rv, rv);
        streamListener = conversionListener; // this is our new listener.
      }

      nsCOMPtr<nsISupports> aCtxt = do_QueryInterface(url);
      //  now try to open the channel passing in our display consumer as the listener 
      rv = channel->AsyncOpen(streamListener, aCtxt);
    }
    else // do what we used to do before
    {
      // I'd like to get rid of this code as I believe that we always get a docshell
      // or stream listener passed into us in this method but i'm not sure yet...
      // I'm going to use an assert for now to figure out if this is ever getting called
#if defined(DEBUG_mscott) || defined(DEBUG_bienvenu)
      NS_ASSERTION(0, "oops...someone still is reaching this part of the code");
#endif
      rv = GetImapConnectionAndLoadUrl(NS_GetCurrentThread(), aImapUrl,
                                       aDisplayConsumer, aURL);
    }
  }
  return rv;
}

// this method streams a message to the passed in consumer, with an optional stream converter
// and additional header (e.g., "header=filter")
NS_IMETHODIMP nsImapService::StreamMessage(const char *aMessageURI, 
                                           nsISupports *aConsumer, 
                                           nsIMsgWindow *aMsgWindow,
                                           nsIUrlListener *aUrlListener, 
                                           PRBool aConvertData,
                                           const nsACString &aAdditionalHeader,
                                           PRBool aLocalOnly,
                                           nsIURI **aURL)
{
  NS_ENSURE_ARG_POINTER(aMessageURI);
  nsCOMPtr<nsIMsgFolder> folder;
  nsCAutoString msgKey;
  nsCAutoString mimePart;
  nsCAutoString folderURI;
  nsMsgKey key;

  nsresult rv = DecomposeImapURI(nsDependentCString(aMessageURI), getter_AddRefs(folder), msgKey);
  NS_ENSURE_SUCCESS(rv, rv);

  if (msgKey.IsEmpty())
    return NS_MSG_MESSAGE_NOT_FOUND;
  rv = nsParseImapMessageURI(aMessageURI, folderURI, &key, getter_Copies(mimePart));
  if (NS_SUCCEEDED(rv))
  {
    nsCOMPtr<nsIImapMessageSink> imapMessageSink(do_QueryInterface(folder, &rv));
    if (NS_SUCCEEDED(rv))
    {
      nsCOMPtr<nsIImapUrl> imapUrl;
      nsCAutoString urlSpec;
      char hierarchyDelimiter = GetHierarchyDelimiter(folder);
      rv = CreateStartOfImapUrl(nsDependentCString(aMessageURI), getter_AddRefs(imapUrl), 
                                folder, aUrlListener, urlSpec, hierarchyDelimiter);
      NS_ENSURE_SUCCESS(rv, rv);
      nsCOMPtr<nsIMsgMailNewsUrl> msgurl (do_QueryInterface(imapUrl));
      nsCOMPtr<nsIURI> url(do_QueryInterface(imapUrl));

      // We need to add the fetch command here for the cache lookup to behave correctly
      rv = AddImapFetchToUrl(url, folder, msgKey, aAdditionalHeader);
      NS_ENSURE_SUCCESS(rv, rv);

      nsCOMPtr<nsIMsgIncomingServer> aMsgIncomingServer;

      msgurl->SetMsgWindow(aMsgWindow);
      rv = msgurl->GetServer(getter_AddRefs(aMsgIncomingServer));

      // Try to check if the message is offline
      PRBool hasMsgOffline = PR_FALSE;
      folder->HasMsgOffline(key, &hasMsgOffline);
      msgurl->SetMsgIsInLocalCache(hasMsgOffline);

      // If we don't have the message available locally, and we can't get it over
      // the network, return with an error
      if (aLocalOnly || WeAreOffline())
      {
        PRBool isMsgInMemCache = PR_FALSE;
        if (!hasMsgOffline)
        {
          rv = IsMsgInMemCache(url, folder, nsnull, &isMsgInMemCache);
          NS_ENSURE_SUCCESS(rv, rv);

          if (!isMsgInMemCache)
            return NS_ERROR_FAILURE;
        }
      }

      imapUrl->SetFetchPartsOnDemand(PR_FALSE);
      msgurl->SetAddToMemoryCache(PR_TRUE);

      PRBool shouldStoreMsgOffline = PR_FALSE;
      folder->ShouldStoreMsgOffline(key, &shouldStoreMsgOffline);
      imapUrl->SetStoreResultsOffline(shouldStoreMsgOffline);
      rv = GetMessageFromUrl(imapUrl, nsIImapUrl::nsImapMsgFetchPeek, folder,
                             imapMessageSink, aMsgWindow, aConsumer,
                             aConvertData, aURL);
    }
  }
  return rv;
}

NS_IMETHODIMP nsImapService::IsMsgInMemCache(nsIURI *aUrl,
                                             nsIMsgFolder *aImapMailFolder,
                                             nsICacheEntryDescriptor **aCacheEntry,
                                             PRBool *aResult)
{
  NS_ENSURE_ARG_POINTER(aUrl);
  NS_ENSURE_ARG_POINTER(aImapMailFolder);
  *aResult = PR_FALSE;

  // Poke around in the memory cache
  if (mCacheSession)
  {
    nsresult rv;
    nsCOMPtr<nsIImapMailFolderSink> folderSink(do_QueryInterface(aImapMailFolder, &rv));
    NS_ENSURE_SUCCESS(rv, rv);

    PRInt32 uidValidity = -1;
    folderSink->GetUidValidity(&uidValidity);
    // stick the uid validity in front of the url, so that if the uid validity
    // changes, we won't re-use the wrong cache entries.
    nsCAutoString cacheKey;
    nsCAutoString escapedSpec;

    cacheKey.AppendInt(uidValidity, 16);
    aUrl->GetAsciiSpec(escapedSpec);
    cacheKey.Append(escapedSpec);
    nsCOMPtr<nsICacheEntryDescriptor> cacheEntry;
    rv = mCacheSession->OpenCacheEntry(cacheKey, nsICache::ACCESS_READ, PR_FALSE,
                                       getter_AddRefs(cacheEntry));
    if (NS_SUCCEEDED(rv))
    {
      *aResult = PR_TRUE;
      if (aCacheEntry)
        NS_IF_ADDREF(*aCacheEntry = cacheEntry);
    }
  }

  return NS_OK;
}

nsresult nsImapService::CreateStartOfImapUrl(const nsACString &aImapURI, 
                                             nsIImapUrl **imapUrl,
                                             nsIMsgFolder *aImapMailFolder,
                                             nsIUrlListener *aUrlListener,
                                             nsACString &urlSpec, 
                                             char &hierarchyDelimiter)
{
  nsresult rv = NS_OK;
  nsCString hostname;
  nsCString username;
  nsCString escapedUsername;

  rv = aImapMailFolder->GetHostname(hostname);
  NS_ENSURE_SUCCESS(rv, rv);
  rv = aImapMailFolder->GetUsername(username);
  NS_ENSURE_SUCCESS(rv, rv);

  if (!username.IsEmpty())
    *((char **)getter_Copies(escapedUsername)) = nsEscape(username.get(), url_XAlphas);

  PRInt32 port = nsIImapUrl::DEFAULT_IMAP_PORT;
  nsCOMPtr<nsIMsgIncomingServer> server;
  rv = aImapMailFolder->GetServer(getter_AddRefs(server));
  if (NS_SUCCEEDED(rv)) 
  {
    server->GetPort(&port);
    if (port == -1 || port == 0) port = nsIImapUrl::DEFAULT_IMAP_PORT;
  }

  // now we need to create an imap url to load into the connection. The url
  // needs to represent a select folder action. 
  rv = CallCreateInstance(kImapUrlCID, imapUrl);
  if (NS_SUCCEEDED(rv) && *imapUrl)
  {
    nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(*imapUrl, &rv);
    if (NS_SUCCEEDED(rv) && mailnewsUrl && aUrlListener)
      mailnewsUrl->RegisterListener(aUrlListener);
    nsCOMPtr<nsIMsgMessageUrl> msgurl(do_QueryInterface(*imapUrl));
    (*imapUrl)->SetExternalLinkUrl(PR_FALSE);
    msgurl->SetUri(nsDependentCString(aImapURI).get());

    urlSpec = "imap://";
    urlSpec.Append(escapedUsername);
    urlSpec.Append('@');
    urlSpec.Append(hostname);
    urlSpec.Append(':');

    nsCAutoString portStr;
    portStr.AppendInt(port);
    urlSpec.Append(portStr);

    // *** jefft - force to parse the urlSpec in order to search for
    // the correct incoming server
    rv = mailnewsUrl->SetSpec(urlSpec);

    hierarchyDelimiter = kOnlineHierarchySeparatorUnknown;
    nsCOMPtr <nsIMsgImapMailFolder> imapFolder = do_QueryInterface(aImapMailFolder);
    if (imapFolder)
      imapFolder->GetHierarchyDelimiter(&hierarchyDelimiter);
  }
  return rv;
}

/* fetching the headers of RFC822 messages */
/* imap4://HOST>header><UID/SEQUENCE>>MAILBOXPATH>x */
/*   'x' is the message UID or sequence number list */
/* will not affect the 'SEEN' flag */
NS_IMETHODIMP nsImapService::GetHeaders(nsIEventTarget *aClientEventTarget, 
                                        nsIMsgFolder *aImapMailFolder, 
                                        nsIUrlListener *aUrlListener, 
                                        nsIURI **aURL,
                                        const nsACString &messageIdentifierList,
                                        PRBool messageIdsAreUID)
{
  // create a protocol instance to handle the request.
  // NOTE: once we start working with multiple connections, this step will be much more complicated...but for now
  // just create a connection and process the request.
  NS_ENSURE_ARG_POINTER(aImapMailFolder);
  NS_ENSURE_ARG_POINTER(aClientEventTarget);

  nsCOMPtr<nsIImapUrl> imapUrl;
  nsCAutoString urlSpec;
  char hierarchyDelimiter = GetHierarchyDelimiter(aImapMailFolder);

  nsresult rv = CreateStartOfImapUrl(EmptyCString(), getter_AddRefs(imapUrl), aImapMailFolder, 
                                     aUrlListener, urlSpec, hierarchyDelimiter);
  if (NS_SUCCEEDED(rv) && imapUrl)
  {
    nsCOMPtr<nsIURI> uri = do_QueryInterface(imapUrl);

    rv = imapUrl->SetImapAction(nsIImapUrl::nsImapMsgFetch);
    rv = SetImapUrlSink(aImapMailFolder, imapUrl);

    if (NS_SUCCEEDED(rv))
    {
      urlSpec.Append("/header>");
      urlSpec.Append(messageIdsAreUID ? uidString : sequenceString);
      urlSpec.Append(">");
      urlSpec.Append(char (hierarchyDelimiter));

      nsCString folderName;

      GetFolderName(aImapMailFolder, folderName);
      urlSpec.Append(folderName);
      urlSpec.Append(">");
      urlSpec.Append(messageIdentifierList);
      rv = uri->SetSpec(urlSpec);

      if (NS_SUCCEEDED(rv))
        rv = GetImapConnectionAndLoadUrl(aClientEventTarget, imapUrl, nsnull, aURL);
    }
  }
  return rv;
}


/* peeking at the start of msg bodies */
/* imap4://HOST>header><UID>>MAILBOXPATH>x>n */
/*   'x' is the message UID */
/*   'n' is the number of bytes to fetch */
/* will not affect the 'SEEN' flag */
NS_IMETHODIMP nsImapService::GetBodyStart(nsIEventTarget *aClientEventTarget, 
                                          nsIMsgFolder *aImapMailFolder, 
                                          nsIUrlListener *aUrlListener, 
                                          const nsACString &messageIdentifierList,
                                          PRInt32 numBytes,
                                          nsIURI **aURL)
{
  NS_ENSURE_ARG_POINTER(aImapMailFolder);
  NS_ENSURE_ARG_POINTER(aClientEventTarget);

  nsresult rv;
  nsCOMPtr<nsIImapUrl> imapUrl;
  nsCAutoString urlSpec;

  char hierarchyDelimiter = GetHierarchyDelimiter(aImapMailFolder);
  rv = CreateStartOfImapUrl(EmptyCString(), getter_AddRefs(imapUrl), aImapMailFolder, 
    aUrlListener, urlSpec, hierarchyDelimiter);
  if (NS_SUCCEEDED(rv) && imapUrl)
  {
    rv = imapUrl->SetImapAction(nsIImapUrl::nsImapMsgPreview);
    rv = SetImapUrlSink(aImapMailFolder, imapUrl);

    if (NS_SUCCEEDED(rv))
    {
      nsCOMPtr<nsIURI> uri = do_QueryInterface(imapUrl);

      urlSpec.Append("/previewBody>");
      urlSpec.Append(uidString);
      urlSpec.Append(">");
      urlSpec.Append(hierarchyDelimiter);

      nsCString folderName;
      GetFolderName(aImapMailFolder, folderName);
      urlSpec.Append(folderName);
      urlSpec.Append(">");
      urlSpec.Append(messageIdentifierList);
      urlSpec.Append(">");
      urlSpec.AppendInt(numBytes);
      rv = uri->SetSpec(urlSpec);
      if (NS_SUCCEEDED(rv))
        rv = GetImapConnectionAndLoadUrl(aClientEventTarget, imapUrl, nsnull, aURL);
    }
  }
  return rv;
}

nsresult nsImapService::FolderCommand(nsIEventTarget *clientEventTarget, 
                                      nsIMsgFolder *imapMailFolder,
                                      nsIUrlListener *urlListener,
                                      const char *aCommand,
                                      nsImapAction imapAction,
                                      nsIMsgWindow *msgWindow,
                                      nsIURI **url)
{
  NS_ENSURE_ARG_POINTER(imapMailFolder);
  NS_ENSURE_ARG_POINTER(clientEventTarget);

  nsCOMPtr<nsIImapUrl> imapUrl;
  nsCAutoString urlSpec;

  char hierarchyDelimiter = GetHierarchyDelimiter(imapMailFolder);
  nsresult rv = CreateStartOfImapUrl(EmptyCString(), getter_AddRefs(imapUrl),
                                     imapMailFolder, urlListener, urlSpec, hierarchyDelimiter);
  if (NS_SUCCEEDED(rv) && imapUrl)
  {
    rv = imapUrl->SetImapAction(imapAction);
    rv = SetImapUrlSink(imapMailFolder, imapUrl);
    nsCOMPtr<nsIURI> uri = do_QueryInterface(imapUrl);
    nsCOMPtr<nsIMsgMailNewsUrl> mailnewsurl = do_QueryInterface(imapUrl);
    if (mailnewsurl)
      mailnewsurl->SetMsgWindow(msgWindow);

    if (NS_SUCCEEDED(rv))
    {
      urlSpec.Append(aCommand);
      urlSpec.Append(hierarchyDelimiter);

      nsCString folderName;
      GetFolderName(imapMailFolder, folderName);
      urlSpec.Append(folderName);
      rv = uri->SetSpec(urlSpec);
      if (NS_SUCCEEDED(rv))
        rv = GetImapConnectionAndLoadUrl(clientEventTarget, imapUrl, nsnull, url);
    }
  }
  return rv;
}

NS_IMETHODIMP
nsImapService::VerifyLogon(nsIMsgFolder *aFolder, nsIUrlListener *aUrlListener,
                           nsIMsgWindow *aMsgWindow, nsIURI **aURL)
{
  nsCOMPtr<nsIImapUrl> imapUrl;
  nsCAutoString urlSpec;

  char delimiter = '/'; // shouldn't matter what is is.
  nsresult rv = CreateStartOfImapUrl(EmptyCString(), getter_AddRefs(imapUrl), aFolder,
                                     aUrlListener, urlSpec, delimiter);
  if (NS_SUCCEEDED(rv) && imapUrl)
  {
    nsCOMPtr<nsIURI> uri = do_QueryInterface(imapUrl);

    nsCOMPtr<nsIMsgMailNewsUrl> mailNewsUrl = do_QueryInterface(imapUrl);
    mailNewsUrl->SetSuppressErrorMsgs(PR_TRUE);
    mailNewsUrl->SetMsgWindow(aMsgWindow);
    rv = SetImapUrlSink(aFolder, imapUrl);
    urlSpec.Append("/verifyLogon");
    rv = uri->SetSpec(urlSpec);
    if (NS_SUCCEEDED(rv))
      rv = GetImapConnectionAndLoadUrl(NS_GetCurrentThread(), imapUrl, nsnull, nsnull);
    if (aURL)
      uri.forget(aURL);
  }
  return rv;
}

// Noop, used to update a folder (causes server to send changes).
NS_IMETHODIMP nsImapService::Noop(nsIEventTarget *aClientEventTarget, 
                                  nsIMsgFolder *aImapMailFolder,
                                  nsIUrlListener *aUrlListener, 
                                  nsIURI **aURL)
{
  return FolderCommand(aClientEventTarget, aImapMailFolder, aUrlListener,
                       "/selectnoop>", nsIImapUrl::nsImapSelectNoopFolder, nsnull, aURL);
}
    
// FolderStatus, used to update message counts
NS_IMETHODIMP nsImapService::UpdateFolderStatus(nsIEventTarget *aClientEventTarget, 
                                                nsIMsgFolder *aImapMailFolder,
                                                nsIUrlListener *aUrlListener, 
                                                nsIURI **aURL)
{
  return FolderCommand(aClientEventTarget, aImapMailFolder, aUrlListener,
                       "/folderstatus>", nsIImapUrl::nsImapFolderStatus, nsnull, aURL);
}

// Expunge, used to "compress" an imap folder,removes deleted messages.
NS_IMETHODIMP nsImapService::Expunge(nsIEventTarget *aClientEventTarget,
                                     nsIMsgFolder *aImapMailFolder,
                                     nsIUrlListener *aUrlListener,
                                     nsIMsgWindow *aMsgWindow,
                                     nsIURI **aURL)
{
  return FolderCommand(aClientEventTarget, aImapMailFolder, aUrlListener,
                       "/Expunge>", nsIImapUrl::nsImapExpungeFolder, aMsgWindow, aURL);
}

/* old-stle biff that doesn't download headers */
NS_IMETHODIMP nsImapService::Biff(nsIEventTarget *aClientEventTarget, 
                                  nsIMsgFolder *aImapMailFolder,
                                  nsIUrlListener *aUrlListener, 
                                  nsIURI **aURL,
                                  PRUint32 uidHighWater)
{
  NS_ENSURE_ARG_POINTER(aImapMailFolder);
  NS_ENSURE_ARG_POINTER(aClientEventTarget);

  // static const char *formatString = "biff>%c%s>%ld";
  nsCOMPtr<nsIImapUrl> imapUrl;
  nsCAutoString urlSpec;

  char hierarchyDelimiter = GetHierarchyDelimiter(aImapMailFolder);
  nsresult rv = CreateStartOfImapUrl(EmptyCString(), getter_AddRefs(imapUrl),
    aImapMailFolder, aUrlListener, urlSpec, hierarchyDelimiter);
  if (NS_SUCCEEDED(rv) && imapUrl)
  {
    rv = imapUrl->SetImapAction(nsIImapUrl::nsImapExpungeFolder);
    rv = SetImapUrlSink(aImapMailFolder, imapUrl);

    nsCOMPtr<nsIURI> uri = do_QueryInterface(imapUrl);
    if (NS_SUCCEEDED(rv))
    {
      urlSpec.Append("/Biff>");
      urlSpec.Append(hierarchyDelimiter);

      nsCString folderName;
      GetFolderName(aImapMailFolder, folderName);
      urlSpec.Append(folderName);
      urlSpec.Append(">");
      urlSpec.AppendInt(uidHighWater);
      rv = uri->SetSpec(urlSpec);
      if (NS_SUCCEEDED(rv))
        rv = GetImapConnectionAndLoadUrl(aClientEventTarget, imapUrl, nsnull, aURL);
    }
  }
  return rv;
}

NS_IMETHODIMP nsImapService::DeleteFolder(nsIEventTarget *aClientEventTarget,
                                          nsIMsgFolder *aImapMailFolder,
                                          nsIUrlListener *aUrlListener,
                                          nsIMsgWindow *aMsgWindow,
                                          nsIURI **aURL)
{
  // If it's an aol server then use 'deletefolder' url to 
  // remove all msgs first and then remove the folder itself.
  PRBool removeFolderAndMsgs = PR_FALSE;
  nsCOMPtr<nsIMsgIncomingServer> server;
  if (NS_SUCCEEDED(aImapMailFolder->GetServer(getter_AddRefs(server))) && server)
  {
    nsCOMPtr <nsIImapIncomingServer> imapServer = do_QueryInterface(server);
    if (imapServer) 
      imapServer->GetIsAOLServer(&removeFolderAndMsgs);
  }
  
  return FolderCommand(aClientEventTarget, aImapMailFolder, aUrlListener,
                       removeFolderAndMsgs ? "/deletefolder>" : "/delete>", 
                       nsIImapUrl::nsImapDeleteFolder, aMsgWindow, aURL);
}

NS_IMETHODIMP nsImapService::DeleteMessages(nsIEventTarget *aClientEventTarget, 
                                            nsIMsgFolder *aImapMailFolder, 
                                            nsIUrlListener *aUrlListener, 
                                            nsIURI **aURL,
                                            const nsACString &messageIdentifierList,
                                            PRBool messageIdsAreUID)
{
  NS_ENSURE_ARG_POINTER(aImapMailFolder);
  NS_ENSURE_ARG_POINTER(aClientEventTarget);

  // create a protocol instance to handle the request.
  // NOTE: once we start working with multiple connections, this step will be much more complicated...but for now
  // just create a connection and process the request.
  nsresult rv;
  nsCOMPtr<nsIImapUrl> imapUrl;
  nsCAutoString urlSpec;

  char hierarchyDelimiter = GetHierarchyDelimiter(aImapMailFolder);
  rv = CreateStartOfImapUrl(EmptyCString(), getter_AddRefs(imapUrl), aImapMailFolder, 
    aUrlListener, urlSpec, hierarchyDelimiter);
  if (NS_SUCCEEDED(rv) && imapUrl)
  {
    rv = imapUrl->SetImapAction(nsIImapUrl::nsImapMsgFetch);
    rv = SetImapUrlSink(aImapMailFolder, imapUrl);

    if (NS_SUCCEEDED(rv))
    {
      nsCOMPtr<nsIURI> uri = do_QueryInterface(imapUrl);

      urlSpec.Append("/deletemsg>");
      urlSpec.Append(messageIdsAreUID ? uidString : sequenceString);
      urlSpec.Append(">");
      urlSpec.Append(hierarchyDelimiter);

      nsCString folderName;
      GetFolderName(aImapMailFolder, folderName);
      urlSpec.Append(folderName);
      urlSpec.Append(">");
      urlSpec.Append(messageIdentifierList);
      rv = uri->SetSpec(urlSpec);
      if (NS_SUCCEEDED(rv))
        rv = GetImapConnectionAndLoadUrl(aClientEventTarget, imapUrl, nsnull, aURL);
    }
  }
  return rv;
}

// Delete all messages in a folder, used to empty trash
NS_IMETHODIMP nsImapService::DeleteAllMessages(nsIEventTarget *aClientEventTarget, 
                                               nsIMsgFolder *aImapMailFolder,
                                               nsIUrlListener *aUrlListener, 
                                               nsIURI **aURL)
{
  return FolderCommand(aClientEventTarget, aImapMailFolder, aUrlListener,
                      "/deleteallmsgs>", nsIImapUrl::nsImapSelectNoopFolder, nsnull, aURL);
}

NS_IMETHODIMP nsImapService::AddMessageFlags(nsIEventTarget *aClientEventTarget,
                                             nsIMsgFolder *aImapMailFolder, 
                                             nsIUrlListener *aUrlListener, 
                                             nsIURI **aURL,
                                             const nsACString &messageIdentifierList,
                                             imapMessageFlagsType flags,
                                             PRBool messageIdsAreUID)
{
  return DiddleFlags(aClientEventTarget, aImapMailFolder, aUrlListener, aURL, messageIdentifierList,
                     "addmsgflags", flags, messageIdsAreUID);
}

NS_IMETHODIMP nsImapService::SubtractMessageFlags(nsIEventTarget *aClientEventTarget,
                                                  nsIMsgFolder *aImapMailFolder, 
                                                  nsIUrlListener *aUrlListener, 
                                                  nsIURI **aURL,
                                                  const nsACString &messageIdentifierList,
                                                  imapMessageFlagsType flags,
                                                  PRBool messageIdsAreUID)
{
  return DiddleFlags(aClientEventTarget, aImapMailFolder, aUrlListener, aURL, messageIdentifierList,
                     "subtractmsgflags", flags, messageIdsAreUID);
}

NS_IMETHODIMP nsImapService::SetMessageFlags(nsIEventTarget *aClientEventTarget,
                                             nsIMsgFolder *aImapMailFolder, 
                                             nsIUrlListener *aUrlListener, 
                                             nsIURI **aURL,
                                             const nsACString &messageIdentifierList,
                                             imapMessageFlagsType flags,
                                             PRBool messageIdsAreUID)
{
  return DiddleFlags(aClientEventTarget, aImapMailFolder, aUrlListener, aURL, messageIdentifierList,
                     "setmsgflags", flags, messageIdsAreUID);
}

nsresult nsImapService::DiddleFlags(nsIEventTarget *aClientEventTarget, 
                                    nsIMsgFolder *aImapMailFolder, 
                                    nsIUrlListener *aUrlListener,
                                    nsIURI **aURL,
                                    const nsACString &messageIdentifierList,
                                    const char *howToDiddle,
                                    imapMessageFlagsType flags,
                                    PRBool messageIdsAreUID)
{
  NS_ENSURE_ARG_POINTER(aImapMailFolder);
  NS_ENSURE_ARG_POINTER(aClientEventTarget);

  // create a protocol instance to handle the request.
  // NOTE: once we start working with multiple connections, 
  //       this step will be much more complicated...but for now
  // just create a connection and process the request.
  nsCOMPtr<nsIImapUrl> imapUrl;
  nsCAutoString urlSpec;

  char hierarchyDelimiter = GetHierarchyDelimiter(aImapMailFolder);
  nsresult rv = CreateStartOfImapUrl(EmptyCString(), getter_AddRefs(imapUrl),
                                     aImapMailFolder, aUrlListener, urlSpec, hierarchyDelimiter); 
  if (NS_SUCCEEDED(rv) && imapUrl)
  {
    rv = imapUrl->SetImapAction(nsIImapUrl::nsImapMsgFetch);
    rv = SetImapUrlSink(aImapMailFolder, imapUrl);

    if (NS_SUCCEEDED(rv))
    {
      nsCOMPtr<nsIURI> uri = do_QueryInterface(imapUrl);

      urlSpec.Append('/');
      urlSpec.Append(howToDiddle);
      urlSpec.Append('>');
      urlSpec.Append(messageIdsAreUID ? uidString : sequenceString);
      urlSpec.Append(">");
      urlSpec.Append(hierarchyDelimiter);
      nsCString folderName;
      GetFolderName(aImapMailFolder, folderName);
      urlSpec.Append(folderName);
      urlSpec.Append(">");
      urlSpec.Append(messageIdentifierList);
      urlSpec.Append('>');
      urlSpec.AppendInt(flags);
      rv = uri->SetSpec(urlSpec);
      if (NS_SUCCEEDED(rv))
        rv = GetImapConnectionAndLoadUrl(aClientEventTarget, imapUrl, nsnull, aURL);
    }
  }
  return rv;
}

nsresult nsImapService::SetImapUrlSink(nsIMsgFolder *aMsgFolder, nsIImapUrl *aImapUrl)
{
  NS_ENSURE_ARG_POINTER(aMsgFolder);
  NS_ENSURE_ARG_POINTER(aImapUrl);
  
  nsresult rv;
  nsCOMPtr<nsIMsgIncomingServer> incomingServer;
  nsCOMPtr<nsIImapServerSink> imapServerSink;
    
  rv = aMsgFolder->GetServer(getter_AddRefs(incomingServer));
  if (NS_SUCCEEDED(rv) && incomingServer)
  {
    imapServerSink = do_QueryInterface(incomingServer);
    if (imapServerSink)
      aImapUrl->SetImapServerSink(imapServerSink);
  }
   
  nsCOMPtr<nsIImapMailFolderSink> imapMailFolderSink = do_QueryInterface(aMsgFolder);
  if (NS_SUCCEEDED(rv) && imapMailFolderSink)
    aImapUrl->SetImapMailFolderSink(imapMailFolderSink);
  
  nsCOMPtr<nsIImapMessageSink> imapMessageSink = do_QueryInterface(aMsgFolder);
  if (NS_SUCCEEDED(rv) && imapMessageSink)
    aImapUrl->SetImapMessageSink(imapMessageSink);
  
  nsCOMPtr <nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(aImapUrl);
  mailnewsUrl->SetFolder(aMsgFolder);

  return NS_OK;
}

NS_IMETHODIMP nsImapService::DiscoverAllFolders(nsIEventTarget *aClientEventTarget,
                                                nsIMsgFolder *aImapMailFolder,
                                                nsIUrlListener *aUrlListener,
                                                nsIMsgWindow *aMsgWindow,
                                                nsIURI **aURL)
{
  NS_ENSURE_ARG_POINTER(aImapMailFolder);
  NS_ENSURE_ARG_POINTER(aClientEventTarget);

  nsCOMPtr<nsIImapUrl> imapUrl;
  nsCAutoString urlSpec;

  char hierarchyDelimiter = GetHierarchyDelimiter(aImapMailFolder);
  nsresult rv = CreateStartOfImapUrl(EmptyCString(), getter_AddRefs(imapUrl), aImapMailFolder, 
                                     aUrlListener, urlSpec, hierarchyDelimiter);
  if (NS_SUCCEEDED (rv))
  {
    rv = SetImapUrlSink(aImapMailFolder, imapUrl);

    if (NS_SUCCEEDED(rv))
    {
      nsCOMPtr<nsIURI> uri = do_QueryInterface(imapUrl);
      nsCOMPtr<nsIMsgMailNewsUrl> mailnewsurl = do_QueryInterface(imapUrl);
      if (mailnewsurl)
        mailnewsurl->SetMsgWindow(aMsgWindow);
      urlSpec.Append("/discoverallboxes");
      nsCOMPtr <nsIURI> url = do_QueryInterface(imapUrl, &rv);
      rv = uri->SetSpec(urlSpec);
      if (NS_SUCCEEDED(rv))
        rv = GetImapConnectionAndLoadUrl(aClientEventTarget, imapUrl, nsnull, aURL);
    }
  }
  return rv;
}

NS_IMETHODIMP nsImapService::DiscoverAllAndSubscribedFolders(nsIEventTarget *aClientEventTarget,
                                                             nsIMsgFolder *aImapMailFolder,
                                                             nsIUrlListener *aUrlListener,
                                                             nsIURI **aURL)
{
  NS_ENSURE_ARG_POINTER(aImapMailFolder);
  NS_ENSURE_ARG_POINTER(aClientEventTarget);

  nsCOMPtr<nsIImapUrl> aImapUrl;
  nsCAutoString urlSpec;

  char hierarchyDelimiter = GetHierarchyDelimiter(aImapMailFolder);
  nsresult rv = CreateStartOfImapUrl(EmptyCString(), getter_AddRefs(aImapUrl), aImapMailFolder,
                                     aUrlListener, urlSpec, hierarchyDelimiter);
  if (NS_SUCCEEDED(rv) && aImapUrl)
  {
    rv = SetImapUrlSink(aImapMailFolder, aImapUrl);
    if (NS_SUCCEEDED(rv))
    {
      nsCOMPtr<nsIURI> uri = do_QueryInterface(aImapUrl);
      urlSpec.Append("/discoverallandsubscribedboxes");
      rv = uri->SetSpec(urlSpec);
      if (NS_SUCCEEDED(rv))
        rv = GetImapConnectionAndLoadUrl(aClientEventTarget, aImapUrl, nsnull, aURL);
    }
  }
  return rv;
}

NS_IMETHODIMP nsImapService::DiscoverChildren(nsIEventTarget *aClientEventTarget,
                                              nsIMsgFolder *aImapMailFolder,
                                              nsIUrlListener *aUrlListener,
                                              const nsACString &folderPath,
                                              nsIURI **aURL)
{
  NS_ENSURE_ARG_POINTER(aImapMailFolder);
  NS_ENSURE_ARG_POINTER(aClientEventTarget);

  nsCOMPtr<nsIImapUrl> aImapUrl;
  nsCAutoString urlSpec;

  char hierarchyDelimiter = GetHierarchyDelimiter(aImapMailFolder);
  nsresult rv = CreateStartOfImapUrl(EmptyCString(), getter_AddRefs(aImapUrl), aImapMailFolder, 
                                     aUrlListener, urlSpec, hierarchyDelimiter);
  if (NS_SUCCEEDED (rv))
  {
    rv = SetImapUrlSink(aImapMailFolder, aImapUrl);
    if (NS_SUCCEEDED(rv))
    {
      if (!folderPath.IsEmpty())
      {
        nsCOMPtr<nsIURI> uri = do_QueryInterface(aImapUrl);
        urlSpec.Append("/discoverchildren>");
        urlSpec.Append(hierarchyDelimiter);
        urlSpec.Append(folderPath);
        rv = uri->SetSpec(urlSpec);

        // Make sure the uri has the same hierarchy separator as the one in msg folder 
        // obj if it's not kOnlineHierarchySeparatorUnknown (ie, '^').
        char uriDelimiter;
        nsresult rv1 = aImapUrl->GetOnlineSubDirSeparator(&uriDelimiter);
        if (NS_SUCCEEDED (rv1) && hierarchyDelimiter != kOnlineHierarchySeparatorUnknown &&
            uriDelimiter != hierarchyDelimiter)
          aImapUrl->SetOnlineSubDirSeparator(hierarchyDelimiter);

        if (NS_SUCCEEDED(rv))
          rv = GetImapConnectionAndLoadUrl(aClientEventTarget, aImapUrl, nsnull, aURL);
      }
      else
        rv = NS_ERROR_FAILURE;
    }
  }
  return rv;
}

NS_IMETHODIMP nsImapService::OnlineMessageCopy(nsIEventTarget *aClientEventTarget,
                                               nsIMsgFolder *aSrcFolder,
                                               const nsACString &messageIds,
                                               nsIMsgFolder *aDstFolder,
                                               PRBool idsAreUids,
                                               PRBool isMove,
                                               nsIUrlListener *aUrlListener,
                                               nsIURI **aURL,
                                               nsISupports *copyState,
                                               nsIMsgWindow *aMsgWindow)
{
  NS_ENSURE_ARG_POINTER(aClientEventTarget);
  NS_ENSURE_ARG_POINTER(aSrcFolder);
  NS_ENSURE_ARG_POINTER(aDstFolder);

  nsresult rv;
  nsCOMPtr<nsIMsgIncomingServer> srcServer;
  nsCOMPtr<nsIMsgIncomingServer> dstServer;

  rv = aSrcFolder->GetServer(getter_AddRefs(srcServer));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = aDstFolder->GetServer(getter_AddRefs(dstServer));
  NS_ENSURE_SUCCESS(rv, rv);

  PRBool sameServer;
  rv = dstServer->Equals(srcServer, &sameServer);
  NS_ENSURE_SUCCESS(rv, rv);

  if (!sameServer) 
  {
    NS_ASSERTION(PR_FALSE, "can't use this method to copy across servers");
    // *** can only take message from the same imap host and user accnt
    return NS_ERROR_FAILURE;
  }

  nsCOMPtr<nsIImapUrl> imapUrl;
  nsCAutoString urlSpec;

  char hierarchyDelimiter = GetHierarchyDelimiter(aSrcFolder);
  rv = CreateStartOfImapUrl(EmptyCString(), getter_AddRefs(imapUrl), aSrcFolder, aUrlListener, urlSpec, hierarchyDelimiter);
  if (NS_SUCCEEDED(rv))
  {
    SetImapUrlSink(aSrcFolder, imapUrl);
    imapUrl->SetCopyState(copyState);

    nsCOMPtr<nsIMsgMailNewsUrl> msgurl (do_QueryInterface(imapUrl));

    msgurl->SetMsgWindow(aMsgWindow);
    nsCOMPtr<nsIURI> uri = do_QueryInterface(imapUrl);

    if (isMove)
      urlSpec.Append("/onlinemove>");
    else
      urlSpec.Append("/onlinecopy>");
    if (idsAreUids)
      urlSpec.Append(uidString);
    else
      urlSpec.Append(sequenceString);
    urlSpec.Append('>');
    urlSpec.Append(hierarchyDelimiter);

    nsCString folderName;
    GetFolderName(aSrcFolder, folderName);
    urlSpec.Append(folderName);
    urlSpec.Append('>');
    urlSpec.Append(messageIds);
    urlSpec.Append('>');
    urlSpec.Append(hierarchyDelimiter);
    folderName.Adopt(strdup(""));
    GetFolderName(aDstFolder, folderName);
    urlSpec.Append(folderName);

    rv = uri->SetSpec(urlSpec);
    if (NS_SUCCEEDED(rv))
      rv = GetImapConnectionAndLoadUrl(aClientEventTarget, imapUrl, nsnull, aURL);
  }
  return rv;
}

nsresult nsImapService::OfflineAppendFromFile(nsIFile *aFile,
                                              nsIURI *aUrl,
                                              nsIMsgFolder* aDstFolder,
                                              const nsACString &messageId,  // to be replaced
                                              PRBool inSelectedState, // needs to be in
                                              nsIUrlListener *aListener,
                                              nsIURI **aURL,
                                              nsISupports *aCopyState)
{
  nsCOMPtr<nsIMsgDatabase> destDB;
  nsresult rv = aDstFolder->GetMsgDatabase(getter_AddRefs(destDB));
  // ### might need to send some notifications instead of just returning

  if (NS_SUCCEEDED(rv) && destDB)
  {
    nsMsgKey fakeKey;
    destDB->GetNextFakeOfflineMsgKey(&fakeKey);

    nsCOMPtr <nsIMsgOfflineImapOperation> op;
    rv = destDB->GetOfflineOpForKey(fakeKey, PR_TRUE, getter_AddRefs(op));
    if (NS_SUCCEEDED(rv) && op)
    {
      nsCString destFolderUri;
      aDstFolder->GetURI(destFolderUri);
      op->SetOperation(nsIMsgOfflineImapOperation::kAppendDraft); // ### do we care if it's a template?
      op->SetDestinationFolderURI(destFolderUri.get());
      nsCOMPtr <nsIOutputStream> offlineStore;
      rv = aDstFolder->GetOfflineStoreOutputStream(getter_AddRefs(offlineStore));

      if (NS_SUCCEEDED(rv) && offlineStore)
      {
        PRInt64 curOfflineStorePos = 0;
        nsCOMPtr <nsISeekableStream> seekable = do_QueryInterface(offlineStore);
        if (seekable)
          seekable->Tell(&curOfflineStorePos);
        else
        {
          NS_ASSERTION(PR_FALSE, "needs to be a random store!");
          return NS_ERROR_FAILURE;
        }

        nsCOMPtr <nsIInputStream> inputStream;
        nsCOMPtr <nsIMsgParseMailMsgState> msgParser = do_CreateInstance(NS_PARSEMAILMSGSTATE_CONTRACTID, &rv);
        msgParser->SetMailDB(destDB);

        nsCOMPtr <nsILocalFile> localFile = do_QueryInterface(aFile);
        if (NS_SUCCEEDED(rv))
          rv = NS_NewLocalFileInputStream(getter_AddRefs(inputStream), localFile);
        if (NS_SUCCEEDED(rv) && inputStream)
        {
          // now, copy the temp file to the offline store for the dest folder.
          PRInt32 inputBufferSize = 10240;
          nsMsgLineStreamBuffer *inputStreamBuffer = new nsMsgLineStreamBuffer(inputBufferSize, 
                                                                               PR_TRUE,    // allocate new lines
                                                                               PR_FALSE);  // leave CRLFs on the returned string
          PRInt64 fileSize;
          aFile->GetFileSize(&fileSize);
          PRUint32 bytesWritten;
          rv = NS_OK;
//        rv = inputStream->Read(inputBuffer, inputBufferSize, &bytesRead);
//        if (NS_SUCCEEDED(rv) && bytesRead > 0)
          msgParser->SetState(nsIMsgParseMailMsgState::ParseHeadersState);
          // set the env pos to fake key so the msg hdr will have that for a key
          msgParser->SetEnvelopePos(fakeKey);
          PRBool needMoreData = PR_FALSE;
          char * newLine = nsnull;
          PRUint32 numBytesInLine = 0;
          do
          {
            newLine = inputStreamBuffer->ReadNextLine(inputStream, numBytesInLine, needMoreData); 
            if (newLine)
            {
              msgParser->ParseAFolderLine(newLine, numBytesInLine);
              rv = offlineStore->Write(newLine, numBytesInLine, &bytesWritten);
              NS_Free(newLine);
            }
          } while (newLine);

          nsCOMPtr<nsIMsgDBHdr> fakeHdr;
          msgParser->FinishHeader();
          msgParser->GetNewMsgHdr(getter_AddRefs(fakeHdr));
          if (fakeHdr)
          {
            if (NS_SUCCEEDED(rv) && fakeHdr)
            {
              PRUint32 resultFlags;
              nsInt64 tellPos = curOfflineStorePos;
              fakeHdr->SetMessageOffset((PRUint32) tellPos);
              fakeHdr->OrFlags(nsMsgMessageFlags::Offline | nsMsgMessageFlags::Read, &resultFlags);
              fakeHdr->SetOfflineMessageSize(fileSize);
              destDB->AddNewHdrToDB(fakeHdr, PR_TRUE /* notify */);
              aDstFolder->SetFlag(nsMsgFolderFlags::OfflineEvents);
            }
          }
          // tell the listener we're done.
          inputStream->Close();
          inputStream = nsnull;
          aListener->OnStopRunningUrl(aUrl, NS_OK);
          delete inputStreamBuffer;
        }
      }
    }
  }
          
  if (destDB)
    destDB->Close(PR_TRUE);
  return rv;
}

/* append message from file url */
/* imap://HOST>appendmsgfromfile>DESTINATIONMAILBOXPATH */
/* imap://HOST>appenddraftfromfile>DESTINATIONMAILBOXPATH>UID>messageId */
NS_IMETHODIMP nsImapService::AppendMessageFromFile(nsIEventTarget *aClientEventTarget,
                                                   nsIFile *aFile,
                                                   nsIMsgFolder *aDstFolder,
                                                   const nsACString &messageId,  // to be replaced
                                                   PRBool idsAreUids,
                                                   PRBool inSelectedState,       // needs to be in
                                                   nsIUrlListener *aListener,
                                                   nsIURI **aURL,
                                                   nsISupports *aCopyState,
                                                   nsIMsgWindow *aMsgWindow)
{
  NS_ENSURE_ARG_POINTER(aClientEventTarget);
  NS_ENSURE_ARG_POINTER(aFile);
  NS_ENSURE_ARG_POINTER(aDstFolder);

  nsresult rv;
  nsCOMPtr<nsIImapUrl> imapUrl;
  nsCAutoString urlSpec;

  char hierarchyDelimiter = GetHierarchyDelimiter(aDstFolder);
  rv = CreateStartOfImapUrl(EmptyCString(), getter_AddRefs(imapUrl), aDstFolder, aListener, urlSpec, hierarchyDelimiter);
  if (NS_SUCCEEDED(rv))
  {
    nsCOMPtr<nsIMsgMailNewsUrl> msgUrl = do_QueryInterface(imapUrl);
    if (msgUrl && aMsgWindow)
    {
      // we get the loadGroup from msgWindow
      msgUrl->SetMsgWindow(aMsgWindow);
    }

    SetImapUrlSink(aDstFolder, imapUrl);
    imapUrl->SetMsgFile(aFile);
    imapUrl->SetCopyState(aCopyState);

    nsCOMPtr<nsIURI> uri = do_QueryInterface(imapUrl);

    if (inSelectedState)
      urlSpec.Append("/appenddraftfromfile>");
    else
      urlSpec.Append("/appendmsgfromfile>");

    urlSpec.Append(hierarchyDelimiter);

    nsCString folderName;
    GetFolderName(aDstFolder, folderName);
    urlSpec.Append(folderName);

    if (inSelectedState)
    {
      urlSpec.Append('>');
      if (idsAreUids)
        urlSpec.Append(uidString);
      else
        urlSpec.Append(sequenceString);
      urlSpec.Append('>');
      if (!messageId.IsEmpty())
        urlSpec.Append(messageId);
    }
    
    rv = uri->SetSpec(urlSpec);
    if (WeAreOffline())
    {
      // handle offline append to drafts or templates folder here.
      return OfflineAppendFromFile(aFile, uri, aDstFolder, messageId, inSelectedState, aListener, aURL, aCopyState);
    }
    if (NS_SUCCEEDED(rv))
      rv = GetImapConnectionAndLoadUrl(aClientEventTarget, imapUrl, nsnull, aURL);
  }
  return rv;
}

nsresult nsImapService::GetImapConnectionAndLoadUrl(nsIEventTarget *aClientEventTarget,
                                                    nsIImapUrl *aImapUrl,
                                                    nsISupports *aConsumer,
                                                    nsIURI **aURL)
{
  NS_ENSURE_ARG(aImapUrl);

  PRBool isValidUrl;
  aImapUrl->GetValidUrl(&isValidUrl);
  if (!isValidUrl)
    return NS_ERROR_FAILURE;

  if (WeAreOffline())
  {
    nsImapAction imapAction;

    // the only thing we can do offline is fetch messages.
    // ### TODO - need to look at msg copy, save attachment, etc. when we
    // have offline message bodies.
    aImapUrl->GetImapAction(&imapAction);
    if (imapAction != nsIImapUrl::nsImapMsgFetch && imapAction != nsIImapUrl::nsImapSaveMessageToDisk)
      return NS_MSG_ERROR_OFFLINE;
  }

  nsresult rv = NS_OK;
  nsCOMPtr<nsIMsgIncomingServer> aMsgIncomingServer;
  nsCOMPtr<nsIMsgMailNewsUrl> msgUrl = do_QueryInterface(aImapUrl);
  rv = msgUrl->GetServer(getter_AddRefs(aMsgIncomingServer));
    
  if (aURL)
  {
    nsCOMPtr<nsIURI> msgUrlUri = do_QueryInterface(msgUrl);
    msgUrlUri.swap(*aURL);
  }

  if (NS_SUCCEEDED(rv) && aMsgIncomingServer)
  {
    nsCOMPtr<nsIImapIncomingServer> aImapServer(do_QueryInterface(aMsgIncomingServer, &rv));
    if (NS_SUCCEEDED(rv) && aImapServer)
      rv = aImapServer->GetImapConnectionAndLoadUrl(aClientEventTarget, aImapUrl, aConsumer);
  }
  return rv;
}

NS_IMETHODIMP nsImapService::MoveFolder(nsIEventTarget *eventTarget, 
                                        nsIMsgFolder *srcFolder,
                                        nsIMsgFolder *dstFolder, 
                                        nsIUrlListener *urlListener, 
                                        nsIMsgWindow *msgWindow, 
                                        nsIURI **url)
{
  NS_ENSURE_ARG_POINTER(eventTarget);
  NS_ENSURE_ARG_POINTER(srcFolder);
  NS_ENSURE_ARG_POINTER(dstFolder);

  nsCOMPtr<nsIImapUrl> imapUrl;
  nsCAutoString urlSpec;
  nsresult rv;

  char default_hierarchyDelimiter = GetHierarchyDelimiter(dstFolder);
  rv = CreateStartOfImapUrl(EmptyCString(), getter_AddRefs(imapUrl), dstFolder, 
                            urlListener, urlSpec, default_hierarchyDelimiter);
  if (NS_SUCCEEDED(rv) && imapUrl)
  {
    rv = SetImapUrlSink(dstFolder, imapUrl);
    if (NS_SUCCEEDED(rv))
    {
      nsCOMPtr<nsIMsgMailNewsUrl> mailNewsUrl = do_QueryInterface(imapUrl);
      if (mailNewsUrl)
        mailNewsUrl->SetMsgWindow(msgWindow);
      char hierarchyDelimiter = kOnlineHierarchySeparatorUnknown;
      nsCString folderName;

      nsCOMPtr<nsIURI> uri = do_QueryInterface(imapUrl);
      GetFolderName(srcFolder, folderName);
      urlSpec.Append("/movefolderhierarchy>");
      urlSpec.Append(hierarchyDelimiter);
      urlSpec.Append(folderName);
      urlSpec.Append('>');
      GetFolderName(dstFolder, folderName);
      if (!folderName.IsEmpty())
      {
        urlSpec.Append(hierarchyDelimiter);
        urlSpec.Append(folderName);
      }
      rv = uri->SetSpec(urlSpec);
      if (NS_SUCCEEDED(rv))
      {
        GetFolderName(srcFolder, folderName);
        rv = GetImapConnectionAndLoadUrl(eventTarget, imapUrl, nsnull, url);
      }
    }
  }
  return rv;
}

NS_IMETHODIMP nsImapService::RenameLeaf(nsIEventTarget *eventTarget, 
                                        nsIMsgFolder *srcFolder,
                                        const nsAString &newLeafName, 
                                        nsIUrlListener *urlListener,
                                        nsIMsgWindow *msgWindow, 
                                        nsIURI **url)
{
  NS_ENSURE_ARG_POINTER(eventTarget);
  NS_ENSURE_ARG_POINTER(srcFolder);
  
  nsCOMPtr<nsIImapUrl> imapUrl;
  nsCAutoString urlSpec;
  nsresult rv;

  char hierarchyDelimiter = GetHierarchyDelimiter(srcFolder);
  rv = CreateStartOfImapUrl(EmptyCString(), getter_AddRefs(imapUrl), srcFolder, 
                            urlListener, urlSpec, hierarchyDelimiter);
  if (NS_SUCCEEDED(rv))
  {
    rv = SetImapUrlSink(srcFolder, imapUrl);
    if (NS_SUCCEEDED(rv))
    {
      nsCOMPtr<nsIURI> uri = do_QueryInterface(imapUrl);
      nsCOMPtr<nsIMsgMailNewsUrl> mailNewsUrl = do_QueryInterface(imapUrl);
      if (mailNewsUrl)
        mailNewsUrl->SetMsgWindow(msgWindow);
      nsCString folderName;
      GetFolderName(srcFolder, folderName);
      urlSpec.Append("/rename>");
      urlSpec.Append(hierarchyDelimiter);
      urlSpec.Append(folderName);
      urlSpec.Append('>');
      urlSpec.Append(hierarchyDelimiter);
      nsCAutoString cStrFolderName(folderName);
      // Unescape the name before looking for parent path
      nsUnescape(cStrFolderName.BeginWriting());
      PRInt32 leafNameStart = cStrFolderName.RFindChar(hierarchyDelimiter);
      if (leafNameStart != -1)
      {
        cStrFolderName.SetLength(leafNameStart+1);
        urlSpec.Append(cStrFolderName);
      }

      nsCAutoString utfNewName;
      CopyUTF16toMUTF7(nsDependentString(newLeafName), utfNewName);
      char* escapedNewName = nsEscape(utfNewName.get(), url_Path);
      NS_ENSURE_TRUE(escapedNewName, NS_ERROR_OUT_OF_MEMORY);
      nsCString escapedSlashName;
      rv = nsImapUrl::EscapeSlashes(escapedNewName, getter_Copies(escapedSlashName));
      NS_ENSURE_SUCCESS(rv, rv);
      NS_Free(escapedNewName);
      urlSpec.Append(escapedSlashName);

      rv = uri->SetSpec(urlSpec);
      if (NS_SUCCEEDED(rv))
        rv = GetImapConnectionAndLoadUrl(eventTarget, imapUrl, nsnull, url);
    } // if (NS_SUCCEEDED(rv))
  } // if (NS_SUCCEEDED(rv) && imapUrl)
  return rv;
}

NS_IMETHODIMP nsImapService::CreateFolder(nsIEventTarget  *eventTarget,
                                          nsIMsgFolder *parent,
                                          const nsAString &newFolderName,
                                          nsIUrlListener *urlListener, 
                                          nsIURI **url)
{
  NS_ENSURE_ARG_POINTER(eventTarget);
  NS_ENSURE_ARG_POINTER(parent);

  nsCOMPtr<nsIImapUrl> imapUrl;
  nsCAutoString urlSpec;
  nsresult rv;

  char hierarchyDelimiter = GetHierarchyDelimiter(parent);
  rv = CreateStartOfImapUrl(EmptyCString(), getter_AddRefs(imapUrl), parent, 
                            urlListener, urlSpec, hierarchyDelimiter);
  if (NS_SUCCEEDED(rv) && imapUrl)
  {
    rv = SetImapUrlSink(parent, imapUrl);
    if (NS_SUCCEEDED(rv))
    {
      nsCOMPtr<nsIURI> uri = do_QueryInterface(imapUrl);

      nsCString folderName;
      GetFolderName(parent, folderName);
      urlSpec.Append("/create>");
      urlSpec.Append(hierarchyDelimiter);
      if (!folderName.IsEmpty())
      {
        nsCString canonicalName;
        nsImapUrl::ConvertToCanonicalFormat(folderName.get(),
                                            hierarchyDelimiter,
                                            getter_Copies(canonicalName));
        urlSpec.Append(canonicalName);
        urlSpec.Append(hierarchyDelimiter);
      }

      nsCAutoString utfNewName;
      rv = CopyUTF16toMUTF7(nsDependentString(newFolderName), utfNewName);
      NS_ENSURE_SUCCESS(rv, rv);
      char* escapedFolderName = nsEscape(utfNewName.get(), url_Path);
      urlSpec.Append(escapedFolderName);
      NS_Free(escapedFolderName);

      rv = uri->SetSpec(urlSpec);
      if (NS_SUCCEEDED(rv))
        rv = GetImapConnectionAndLoadUrl(eventTarget, imapUrl, nsnull, url);
    } // if (NS_SUCCEEDED(rv))
  } // if (NS_SUCCEEDED(rv) && imapUrl)
  return rv;
}

NS_IMETHODIMP nsImapService::EnsureFolderExists(nsIEventTarget *eventTarget, 
                                                nsIMsgFolder *parent,
                                                const nsAString &newFolderName, 
                                                nsIUrlListener *urlListener, 
                                                nsIURI **url)
{
  NS_ENSURE_ARG_POINTER(eventTarget);
  NS_ENSURE_ARG_POINTER(parent);

  nsCOMPtr<nsIImapUrl> imapUrl;
  nsCAutoString urlSpec;
  nsresult rv;

  char hierarchyDelimiter = GetHierarchyDelimiter(parent);
  rv = CreateStartOfImapUrl(EmptyCString(), getter_AddRefs(imapUrl), parent, urlListener, urlSpec, hierarchyDelimiter);
  if (NS_SUCCEEDED(rv) && imapUrl)
  {
    rv = SetImapUrlSink(parent, imapUrl);
    if (NS_SUCCEEDED(rv))
    {
      nsCOMPtr<nsIURI> uri = do_QueryInterface(imapUrl);

      nsCString folderName;
      GetFolderName(parent, folderName);
      urlSpec.Append("/ensureExists>");
      urlSpec.Append(hierarchyDelimiter);
      if (!folderName.IsEmpty())
      {
        urlSpec.Append(folderName);
        urlSpec.Append(hierarchyDelimiter);
      }
      nsCAutoString utfNewName; 
      CopyUTF16toMUTF7(nsDependentString(newFolderName), utfNewName);
      char* escapedFolderName = nsEscape(utfNewName.get(), url_Path);
      urlSpec.Append(escapedFolderName);
      NS_Free(escapedFolderName);

      rv = uri->SetSpec(urlSpec);
      if (NS_SUCCEEDED(rv))
        rv = GetImapConnectionAndLoadUrl(eventTarget, imapUrl, nsnull, url);
    } // if (NS_SUCCEEDED(rv))
  } // if (NS_SUCCEEDED(rv) && imapUrl)
  return rv;
}

NS_IMETHODIMP nsImapService::ListFolder(nsIEventTarget *aClientEventTarget,
                                        nsIMsgFolder *aImapMailFolder,
                                        nsIUrlListener *aUrlListener,
                                        nsIURI **aURL)
{
  return FolderCommand(aClientEventTarget, aImapMailFolder, aUrlListener,
                       "/listfolder>", nsIImapUrl::nsImapListFolder, nsnull, aURL);
}

NS_IMETHODIMP nsImapService::GetScheme(nsACString &aScheme)
{
  aScheme.Assign("imap");
  return NS_OK; 
}

NS_IMETHODIMP nsImapService::GetDefaultPort(PRInt32 *aDefaultPort)
{
  NS_ENSURE_ARG_POINTER(aDefaultPort);
  *aDefaultPort = nsIImapUrl::DEFAULT_IMAP_PORT;
  return NS_OK;
}

NS_IMETHODIMP nsImapService::GetProtocolFlags(PRUint32 *result)
{
  *result = URI_STD | URI_FORBIDS_AUTOMATIC_DOCUMENT_REPLACEMENT |
  URI_DANGEROUS_TO_LOAD | ALLOWS_PROXY;
  return NS_OK;
}

NS_IMETHODIMP nsImapService::AllowPort(PRInt32 port, const char *scheme, PRBool *aRetVal)
{
  // allow imap to run on any port
  *aRetVal = PR_TRUE;
  return NS_OK;
}

NS_IMETHODIMP nsImapService::GetDefaultDoBiff(PRBool *aDoBiff)
{
  NS_ENSURE_ARG_POINTER(aDoBiff);
  // by default, do biff for IMAP servers
  *aDoBiff = PR_TRUE;    
  return NS_OK;
}

NS_IMETHODIMP nsImapService::GetDefaultServerPort(PRBool isSecure, PRInt32 *aDefaultPort)
{
  nsresult rv = NS_OK;
  
  // Return Secure IMAP Port if secure option chosen i.e., if isSecure is TRUE
  if (isSecure)
    *aDefaultPort = nsIImapUrl::DEFAULT_IMAPS_PORT;
  else    
    rv = GetDefaultPort(aDefaultPort);
  
  return rv;
}

// this method first tries to find an exact username and hostname match with the given url
// then, tries to find any account on the passed in imap host in case this is a url to 
// a shared imap folder.
nsresult nsImapService::GetServerFromUrl(nsIImapUrl *aImapUrl, nsIMsgIncomingServer **aServer)
{
  nsresult rv;
  nsCString folderName;
  nsCAutoString userPass;
  nsCAutoString hostName;
  nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(aImapUrl);
  
  // if we can't get a folder name out of the url then I think this is an error
  aImapUrl->CreateCanonicalSourceFolderPathString(getter_Copies(folderName));
  if (folderName.IsEmpty())
  {
    rv = mailnewsUrl->GetFileName(folderName);
    NS_ENSURE_SUCCESS(rv, rv);
  }
  
  nsCOMPtr<nsIMsgAccountManager> accountManager = do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  
  rv = accountManager->FindServerByURI(mailnewsUrl, PR_FALSE, aServer);
  
  // look for server with any user name, in case we're trying to subscribe
  // to a folder with some one else's user name like the following
  // "IMAP://userSharingFolder@server1/SharedFolderName"
  if (NS_FAILED(rv) || !aServer)
  {
    nsCAutoString turl;
    nsCOMPtr<nsIURL> url = do_CreateInstance(NS_STANDARDURL_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    
    mailnewsUrl->GetSpec(turl);
    rv = url->SetSpec(turl);
    NS_ENSURE_SUCCESS(rv, rv);
    
    url->SetUserPass(EmptyCString());
    rv = accountManager->FindServerByURI(url, PR_FALSE, aServer);
    if (*aServer)
      aImapUrl->SetExternalLinkUrl(PR_TRUE);
  }
  
    // if we can't extract the imap server from this url then give up!!!
  NS_ENSURE_TRUE(*aServer, NS_ERROR_FAILURE);
  return rv;
}

NS_IMETHODIMP nsImapService::NewURI(const nsACString &aSpec,
                                    const char *aOriginCharset,  // ignored 
                                    nsIURI *aBaseURI,
                                    nsIURI **aRetVal)
{
  nsresult rv;
  nsCOMPtr<nsIImapUrl> aImapUrl = do_CreateInstance(kImapUrlCID, &rv);
  if (NS_SUCCEEDED(rv))
  {
    // now extract lots of fun information...
    nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(aImapUrl);
    //nsCAutoString unescapedSpec(aSpec);
    // nsUnescape(unescapedSpec.BeginWriting());

    // set the spec
    if (aBaseURI) 
    {
      nsCAutoString newSpec;
      aBaseURI->Resolve(aSpec, newSpec);
      mailnewsUrl->SetSpec(newSpec);
    } 
    else 
      mailnewsUrl->SetSpec(aSpec);

    nsCString folderName;

    // if we can't get a folder name out of the url then I think this is an error
    aImapUrl->CreateCanonicalSourceFolderPathString(getter_Copies(folderName));
    if (folderName.IsEmpty())
    {
      rv = mailnewsUrl->GetFileName(folderName);
      NS_ENSURE_SUCCESS(rv, rv);
    }

    nsCOMPtr <nsIMsgIncomingServer> server;
    rv = GetServerFromUrl(aImapUrl, getter_AddRefs(server));
    // if we can't extract the imap server from this url then give up!!!
    NS_ENSURE_SUCCESS(rv, rv);
    NS_ENSURE_TRUE(server, NS_ERROR_FAILURE);

    // now try to get the folder in question...
    nsCOMPtr<nsIMsgFolder> rootFolder;
    server->GetRootFolder(getter_AddRefs(rootFolder));
    if (rootFolder && !folderName.IsEmpty())
    {
      nsCOMPtr<nsIMsgFolder> folder;
      nsCOMPtr <nsIMsgImapMailFolder> imapRoot = do_QueryInterface(rootFolder, &rv);
      nsCOMPtr <nsIMsgImapMailFolder> subFolder;
      if (imapRoot)
      {
        imapRoot->FindOnlineSubFolder(folderName, getter_AddRefs(subFolder));
        folder = do_QueryInterface(subFolder, &rv);
      }
      if (NS_SUCCEEDED(rv))
      {
        nsCOMPtr<nsIImapMessageSink> msgSink = do_QueryInterface(folder);
        rv = aImapUrl->SetImapMessageSink(msgSink);

        nsCOMPtr<nsIMsgFolder> msgFolder = do_QueryInterface(folder);
        rv = SetImapUrlSink(msgFolder, aImapUrl);	
        nsCAutoString msgKey;

         nsCString messageIdString;
         aImapUrl->GetListOfMessageIds(messageIdString);
         if (!messageIdString.IsEmpty())
        {
          PRBool useLocalCache = PR_FALSE;
          msgFolder->HasMsgOffline(atoi(messageIdString.get()), &useLocalCache);  
          mailnewsUrl->SetMsgIsInLocalCache(useLocalCache);
        }
      }
    }

    // if we are fetching a part, be sure to enable fetch parts on demand
    PRBool mimePartSelectorDetected = PR_FALSE;
    aImapUrl->GetMimePartSelectorDetected(&mimePartSelectorDetected);
    if (mimePartSelectorDetected)
      aImapUrl->SetFetchPartsOnDemand(PR_TRUE);

    // we got an imap url, so be sure to return it...
    nsCOMPtr<nsIURI> imapUri = do_QueryInterface(aImapUrl);
    imapUri.swap(*aRetVal);
  }

  return rv;
}

NS_IMETHODIMP nsImapService::NewChannel(nsIURI *aURI, nsIChannel **aRetVal)
{
  NS_ENSURE_ARG_POINTER(aRetVal);
  NS_ENSURE_ARG_POINTER(aURI);
  nsresult rv;
  *aRetVal = nsnull;
  nsCOMPtr<nsIImapUrl> imapUrl = do_QueryInterface(aURI, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr <nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(imapUrl, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  // imap can't open and return a channel right away...the url needs to go in the imap url queue 
  // until we find a connection which can run the url..in order to satisfy necko, we're going to return
  // a mock imap channel....
  nsCOMPtr<nsIImapMockChannel> channel = do_CreateInstance(kCImapMockChannel, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  channel->SetURI(aURI);
  nsCOMPtr<nsIMsgWindow> msgWindow;
  mailnewsUrl->GetMsgWindow(getter_AddRefs(msgWindow));
  if (msgWindow)
  {
    nsCOMPtr<nsIDocShell> msgDocShell;
    msgWindow->GetRootDocShell(getter_AddRefs(msgDocShell));
    if (msgDocShell) 
    {
      nsCOMPtr <nsIProgressEventSink> prevEventSink;
      channel->GetProgressEventSink(getter_AddRefs(prevEventSink));
      nsCOMPtr<nsIInterfaceRequestor> docIR(do_QueryInterface(msgDocShell));
      channel->SetNotificationCallbacks(docIR);
      // we want to use our existing event sink.
      if (prevEventSink)
        channel->SetProgressEventSink(prevEventSink);
    }
  }
  imapUrl->SetMockChannel(channel); // the imap url holds a weak reference so we can pass the channel into the imap protocol when we actually run the url

  PRBool externalLinkUrl;
  imapUrl->GetExternalLinkUrl(&externalLinkUrl);
  if (externalLinkUrl)
  {
    // everything after here is to handle clicking on an external link. We only want
    // to do this if we didn't run the url through the various nsImapService methods,
    // which we can tell by seeing if the sinks have been setup on the url or not.
    nsCOMPtr <nsIMsgIncomingServer> server;
    rv = GetServerFromUrl(imapUrl, getter_AddRefs(server));
    NS_ENSURE_SUCCESS(rv, rv);
    nsCString folderName;
    imapUrl->CreateCanonicalSourceFolderPathString(getter_Copies(folderName));
    if (folderName.IsEmpty())
    {
      rv = mailnewsUrl->GetFileName(folderName);
      if (!folderName.IsEmpty())
        NS_UnescapeURL(folderName);
    }
    // if the parent is null, then the folder doesn't really exist, so see if the user
    // wants to subscribe to it./
    nsCOMPtr<nsIMsgFolder> aFolder;
    // now try to get the folder in question...
    nsCOMPtr<nsIMsgFolder> rootFolder;
    server->GetRootFolder(getter_AddRefs(rootFolder));
    nsCOMPtr <nsIMsgImapMailFolder> imapRoot = do_QueryInterface(rootFolder);
    nsCOMPtr <nsIMsgImapMailFolder> subFolder;
    if (imapRoot)
    {
      imapRoot->FindOnlineSubFolder(folderName, getter_AddRefs(subFolder));
      aFolder = do_QueryInterface(subFolder);
    }
    nsCOMPtr <nsIMsgFolder> parent;
    if (aFolder)
      aFolder->GetParent(getter_AddRefs(parent));
    nsCString serverKey;
    nsCAutoString userPass;
    rv = mailnewsUrl->GetUserPass(userPass);
    server->GetKey(serverKey);
    nsCString fullFolderName;
    if (parent)
      fullFolderName = folderName;
    if (!parent && !folderName.IsEmpty())  // check if this folder is another user's folder
    {
      fullFolderName = nsIMAPNamespaceList::GenerateFullFolderNameWithDefaultNamespace(serverKey.get(), 
                                                                                       folderName.get(),
                                                                                       userPass.get(),
                                                                                       kOtherUsersNamespace,
                                                                                       nsnull);
      // if this is another user's folder, let's see if we're already subscribed to it.
      rv = imapRoot->FindOnlineSubFolder(fullFolderName, getter_AddRefs(subFolder));
      aFolder = do_QueryInterface(subFolder);
      if (aFolder)
        aFolder->GetParent(getter_AddRefs(parent));
    }
    // if we couldn't get the fullFolderName, then we probably couldn't find
    // the other user's namespace, in which case, we shouldn't try to subscribe to it.
    if (!parent && !folderName.IsEmpty() && !fullFolderName.IsEmpty())
    {
      // this folder doesn't exist - check if the user wants to subscribe to this folder.
      nsCOMPtr<nsIPrompt> dialog;
      nsCOMPtr<nsIWindowWatcher> wwatch(do_GetService(NS_WINDOWWATCHER_CONTRACTID, &rv));
      NS_ENSURE_SUCCESS(rv, rv);
      wwatch->GetNewPrompter(nsnull, getter_AddRefs(dialog));
      
      nsString statusString, confirmText;
      nsCOMPtr<nsIStringBundle> bundle;
      rv = IMAPGetStringBundle(getter_AddRefs(bundle));
      NS_ENSURE_SUCCESS(rv, rv);
        // need to convert folder name from mod-utf7 to unicode
      nsAutoString unescapedName;
      if (NS_FAILED(CopyMUTF7toUTF16(fullFolderName, unescapedName)))
        CopyASCIItoUTF16(fullFolderName, unescapedName);
      const PRUnichar *formatStrings[1] = { unescapedName.get() };
      
      rv = bundle->FormatStringFromID(IMAP_SUBSCRIBE_PROMPT,
                                      formatStrings, 1,
                                      getter_Copies(confirmText));
      NS_ENSURE_SUCCESS(rv,rv);
      
      PRBool confirmResult = PR_FALSE;
      rv = dialog->Confirm(nsnull, confirmText.get(), &confirmResult);
      NS_ENSURE_SUCCESS(rv, rv);
      
      if (confirmResult)
      {
        nsCOMPtr <nsIImapIncomingServer> imapServer = do_QueryInterface(server);
        if (imapServer)
        {
          nsCOMPtr <nsIURI> subscribeURI;
          // now we have the real folder name to try to subscribe to. Let's try running
          // a subscribe url and returning that as the uri we've created.
          // We need to convert this to unicode because that's what subscribe wants :-(
          // It's already in mod-utf7.
          nsAutoString unicodeName;
          CopyASCIItoUTF16(fullFolderName, unicodeName);
          rv = imapServer->SubscribeToFolder(unicodeName, PR_TRUE, getter_AddRefs(subscribeURI));
          if (NS_SUCCEEDED(rv) && subscribeURI)
          {
            nsCOMPtr <nsIImapUrl> imapSubscribeUrl = do_QueryInterface(subscribeURI);
            if (imapSubscribeUrl)
              imapSubscribeUrl->SetExternalLinkUrl(PR_TRUE);
            nsCOMPtr <nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(subscribeURI);
            if (mailnewsUrl)
            {
              nsCOMPtr<nsIMsgMailSession> mailSession = do_GetService(NS_MSGMAILSESSION_CONTRACTID, &rv);
              NS_ENSURE_SUCCESS(rv, rv);
              nsCOMPtr <nsIMsgWindow> msgWindow;
              rv = mailSession->GetTopmostMsgWindow(getter_AddRefs(msgWindow));
              if (NS_SUCCEEDED(rv) && msgWindow)
              {
                mailnewsUrl->SetMsgWindow(msgWindow);
                nsCOMPtr <nsIUrlListener> listener = do_QueryInterface(rootFolder);
                if (listener)
                  mailnewsUrl->RegisterListener(listener);
              }
            }
          }
        }
      }
      // error out this channel, so it'll stop trying to run the url.
      rv = NS_ERROR_FAILURE;
      *aRetVal = nsnull;
    }
    // this folder exists - check if this is a click on a link to the folder
    // in which case, we'll select it.
    else if (!fullFolderName.IsEmpty())  
    {         
      nsCOMPtr<nsIMsgFolder> imapFolder;
      nsCOMPtr<nsIImapServerSink> serverSink;
      
      mailnewsUrl->GetFolder(getter_AddRefs(imapFolder));
      imapUrl->GetImapServerSink(getter_AddRefs(serverSink));
      // need to see if this is a link click - one way is to check if the url is set up correctly
      // if not, it's probably a url click. We need a better way of doing this. 
      if (!imapFolder)
      {
        nsCOMPtr<nsIMsgMailSession> mailSession = do_GetService(NS_MSGMAILSESSION_CONTRACTID, &rv);
        NS_ENSURE_SUCCESS(rv, rv);
        nsCOMPtr <nsIMsgWindow> msgWindow;
        rv = mailSession->GetTopmostMsgWindow(getter_AddRefs(msgWindow));
        if (NS_SUCCEEDED(rv) && msgWindow)
        {
          nsCString uri;
          rootFolder->GetURI(uri);
          uri.Append('/');
          uri.Append(fullFolderName);
          nsCOMPtr<nsIMsgWindowCommands> windowCommands;
          msgWindow->GetWindowCommands(getter_AddRefs(windowCommands));
          if (windowCommands)
            windowCommands->SelectFolder(uri);
            // error out this channel, so it'll stop trying to run the url.
          *aRetVal = nsnull;
          rv = NS_ERROR_FAILURE;
        }
        else
        {
          // make sure the imap action is selectFolder, so the content type
          // will be x-application-imapfolder, so ::HandleContent will
          // know to open a new 3 pane window.
          imapUrl->SetImapAction(nsIImapUrl::nsImapSelectFolder);
        }
      }
    }
  }
  if (NS_SUCCEEDED(rv))
    NS_IF_ADDREF(*aRetVal = channel);
  return rv;
}

NS_IMETHODIMP nsImapService::SetDefaultLocalPath(nsILocalFile *aPath)
{
  NS_ENSURE_ARG(aPath);
  return NS_SetPersistentFile(PREF_MAIL_ROOT_IMAP_REL, PREF_MAIL_ROOT_IMAP, aPath);
}       

NS_IMETHODIMP nsImapService::GetDefaultLocalPath(nsILocalFile **aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  *aResult = nsnull;
  
  PRBool havePref;
  nsCOMPtr<nsILocalFile> localFile;    
  nsresult rv = NS_GetPersistentFile(PREF_MAIL_ROOT_IMAP_REL,
                                     PREF_MAIL_ROOT_IMAP,
                                     NS_APP_IMAP_MAIL_50_DIR,
                                     havePref,
                                     getter_AddRefs(localFile));
  
  PRBool exists;
  rv = localFile->Exists(&exists);
  if (NS_SUCCEEDED(rv) && !exists)
    rv = localFile->Create(nsIFile::DIRECTORY_TYPE, 0775);
  NS_ENSURE_SUCCESS(rv, rv);
  
  if (!havePref || !exists) 
  {
    rv = NS_SetPersistentFile(PREF_MAIL_ROOT_IMAP_REL, PREF_MAIL_ROOT_IMAP, localFile);
    NS_ASSERTION(NS_SUCCEEDED(rv), "Failed to set root dir pref.");
  }
  
  localFile.swap(*aResult);
  return NS_OK;
}

NS_IMETHODIMP nsImapService::GetServerIID(nsIID **aServerIID)
{
  *aServerIID = new nsIID(NS_GET_IID(nsIImapIncomingServer));
  return NS_OK;
}

NS_IMETHODIMP nsImapService::GetRequiresUsername(PRBool *aRequiresUsername)
{
	NS_ENSURE_ARG_POINTER(aRequiresUsername);
	*aRequiresUsername = PR_TRUE;
	return NS_OK;
}

NS_IMETHODIMP nsImapService::GetPreflightPrettyNameWithEmailAddress(PRBool *aPreflightPrettyNameWithEmailAddress)
{
	NS_ENSURE_ARG_POINTER(aPreflightPrettyNameWithEmailAddress);
	*aPreflightPrettyNameWithEmailAddress = PR_TRUE;
	return NS_OK;
}

NS_IMETHODIMP nsImapService::GetCanLoginAtStartUp(PRBool *aCanLoginAtStartUp)
{
  NS_ENSURE_ARG_POINTER(aCanLoginAtStartUp);
  *aCanLoginAtStartUp = PR_TRUE;
  return NS_OK;
}

NS_IMETHODIMP nsImapService::GetCanDelete(PRBool *aCanDelete)
{
  NS_ENSURE_ARG_POINTER(aCanDelete);
  *aCanDelete = PR_TRUE;
  return NS_OK;
}

NS_IMETHODIMP nsImapService::GetCanDuplicate(PRBool *aCanDuplicate)
{
  NS_ENSURE_ARG_POINTER(aCanDuplicate);
  *aCanDuplicate = PR_TRUE;
  return NS_OK;
}        

NS_IMETHODIMP nsImapService::GetCanGetMessages(PRBool *aCanGetMessages)
{
  NS_ENSURE_ARG_POINTER(aCanGetMessages);
  *aCanGetMessages = PR_TRUE;
  return NS_OK;
}        

NS_IMETHODIMP nsImapService::GetCanGetIncomingMessages(PRBool *aCanGetIncomingMessages)
{
  NS_ENSURE_ARG_POINTER(aCanGetIncomingMessages);
  *aCanGetIncomingMessages = PR_TRUE;
  return NS_OK;
}    

NS_IMETHODIMP nsImapService::GetShowComposeMsgLink(PRBool *showComposeMsgLink)
{
  NS_ENSURE_ARG_POINTER(showComposeMsgLink);
  *showComposeMsgLink = PR_TRUE;
  return NS_OK;
}        

NS_IMETHODIMP nsImapService::GetSpecialFoldersDeletionAllowed(PRBool *specialFoldersDeletionAllowed)
{
  NS_ENSURE_ARG_POINTER(specialFoldersDeletionAllowed);
  *specialFoldersDeletionAllowed = PR_FALSE;
  return NS_OK;
}

NS_IMETHODIMP nsImapService::GetListOfFoldersWithPath(nsIImapIncomingServer *aServer, 
                                                      nsIMsgWindow *aMsgWindow, 
                                                      const nsACString &folderPath)
{
  nsresult rv;

#ifdef DEBUG_sspitzer
  printf("GetListOfFoldersWithPath(%s)\n",folderPath);
#endif
  nsCOMPtr<nsIMsgIncomingServer> server = do_QueryInterface(aServer);
  if (!server) 
    return NS_ERROR_FAILURE;

  nsCOMPtr<nsIMsgFolder> rootMsgFolder;
  rv = server->GetRootMsgFolder(getter_AddRefs(rootMsgFolder));

  NS_ENSURE_TRUE(NS_SUCCEEDED(rv) && rootMsgFolder, NS_ERROR_FAILURE);

  nsCOMPtr<nsIUrlListener> listener = do_QueryInterface(aServer, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  if (!listener) 
    return NS_ERROR_FAILURE;

  // Locate the folder so that the correct hierarchical delimiter is used in the folder
  // pathnames, otherwise root's (ie, '^') is used and this is wrong.
  nsCOMPtr<nsIMsgFolder> msgFolder;
  if (rootMsgFolder && !folderPath.IsEmpty())
  {
    // If the folder path contains 'INBOX' of any forms, we need to convert it to uppercase
    // before finding it under the root folder. We do the same in PossibleImapMailbox().
    nsCAutoString tempFolderName(folderPath);
    nsCAutoString tokenStr, remStr, changedStr;
    PRInt32 slashPos = tempFolderName.FindChar('/');
    if (slashPos > 0)
    {
      tempFolderName.Left(tokenStr,slashPos);
      tempFolderName.Right(remStr, tempFolderName.Length()-slashPos);
    }
    else
      tokenStr.Assign(tempFolderName);

    if (tokenStr.Equals(NS_LITERAL_CSTRING("INBOX"), nsCaseInsensitiveCStringComparator()) && 
        !tokenStr.Equals(NS_LITERAL_CSTRING("INBOX")))
      changedStr.Append("INBOX");
    else
      changedStr.Append(tokenStr);

    if (slashPos > 0 ) 
      changedStr.Append(remStr);

    rv = rootMsgFolder->FindSubFolder(changedStr, getter_AddRefs(msgFolder));
  }
  return DiscoverChildren(NS_GetCurrentThread(), msgFolder, listener, folderPath, nsnull);
}

NS_IMETHODIMP nsImapService::GetListOfFoldersOnServer(nsIImapIncomingServer *aServer, 
                                                      nsIMsgWindow *aMsgWindow)
{
  nsresult rv;

  nsCOMPtr<nsIMsgIncomingServer> server = do_QueryInterface(aServer);
  if (!server) 
    return NS_ERROR_FAILURE;

  nsCOMPtr<nsIMsgFolder> rootMsgFolder;
  rv = server->GetRootMsgFolder(getter_AddRefs(rootMsgFolder));

  NS_ENSURE_SUCCESS(rv, rv);
  if (!rootMsgFolder) 
    return NS_ERROR_FAILURE;

  nsCOMPtr<nsIUrlListener> listener = do_QueryInterface(aServer, &rv);
  NS_ENSURE_TRUE(NS_SUCCEEDED(rv) && listener, NS_ERROR_FAILURE);

  return DiscoverAllAndSubscribedFolders(NS_GetCurrentThread(), rootMsgFolder, listener, nsnull);
} 

NS_IMETHODIMP nsImapService::SubscribeFolder(nsIEventTarget *eventTarget, 
                                             nsIMsgFolder *aFolder,
                                             const nsAString &aFolderName, 
                                             nsIUrlListener *urlListener, 
                                             nsIURI **url)
{
  return ChangeFolderSubscription(eventTarget, aFolder, aFolderName, 
                                  "/subscribe>", urlListener, url);
}

nsresult nsImapService::ChangeFolderSubscription(nsIEventTarget *eventTarget, 
                                                 nsIMsgFolder *folder,
                                                 const nsAString &folderName, 
                                                 const char *command,
                                                 nsIUrlListener *urlListener, 
                                                 nsIURI **url)
{
  NS_ENSURE_ARG_POINTER(eventTarget);
  NS_ENSURE_ARG_POINTER(folder);

  nsCOMPtr<nsIImapUrl> imapUrl;
  nsCAutoString urlSpec;
  nsresult rv;
  char hierarchyDelimiter = GetHierarchyDelimiter(folder);
  rv = CreateStartOfImapUrl(EmptyCString(), getter_AddRefs(imapUrl), folder, urlListener,
                            urlSpec, hierarchyDelimiter);
  if (NS_SUCCEEDED(rv) && imapUrl)
  {
    rv = SetImapUrlSink(folder, imapUrl);
    if (NS_SUCCEEDED(rv))
    {
      nsCOMPtr<nsIURI> uri = do_QueryInterface(imapUrl);
      urlSpec.Append(command);
      urlSpec.Append(hierarchyDelimiter);
      nsCAutoString utfFolderName;
      rv = CopyUTF16toMUTF7(nsDependentString(folderName), utfFolderName);
      NS_ENSURE_SUCCESS(rv, rv);
      char* escapedFolderName = nsEscape(utfFolderName.get(), url_Path);
      urlSpec.Append(escapedFolderName);
      NS_Free(escapedFolderName);
      rv = uri->SetSpec(urlSpec);
      if (NS_SUCCEEDED(rv))
        rv = GetImapConnectionAndLoadUrl(eventTarget, imapUrl, nsnull, url);
    }
  }
  return rv;
}

NS_IMETHODIMP nsImapService::UnsubscribeFolder(nsIEventTarget *aEventTarget, 
                                               nsIMsgFolder *aFolder,
                                               const nsAString &aFolderName, 
                                               nsIUrlListener *aUrlListener, 
                                               nsIURI **aUrl)
{
  return ChangeFolderSubscription(aEventTarget, aFolder, aFolderName, 
                                  "/unsubscribe>", aUrlListener, aUrl);
}

NS_IMETHODIMP nsImapService::GetFolderAdminUrl(nsIEventTarget *aClientEventTarget,
                                               nsIMsgFolder *aImapMailFolder,
                                               nsIMsgWindow *aMsgWindow,
                                               nsIUrlListener *aUrlListener,
                                               nsIURI **aURL)
{
  return FolderCommand(aClientEventTarget, aImapMailFolder, aUrlListener,
                       "/refreshfolderurls>", nsIImapUrl::nsImapRefreshFolderUrls, aMsgWindow, aURL);
}

NS_IMETHODIMP nsImapService::IssueCommandOnMsgs(nsIEventTarget *aClientEventTarget,
                                                nsIMsgFolder *anImapFolder,
                                                nsIMsgWindow *aMsgWindow,
                                                const nsACString &aCommand,
                                                const nsACString &uids,
                                                nsIURI **aURL)
{
  NS_ENSURE_ARG_POINTER(aClientEventTarget);
  NS_ENSURE_ARG_POINTER(anImapFolder);
  NS_ENSURE_ARG_POINTER(aMsgWindow);
  nsCOMPtr<nsIImapUrl> imapUrl;
  nsCAutoString urlSpec;
  nsresult rv;
  char hierarchyDelimiter = GetHierarchyDelimiter(anImapFolder);
  rv = CreateStartOfImapUrl(EmptyCString(), getter_AddRefs(imapUrl), anImapFolder, nsnull, urlSpec, hierarchyDelimiter);

  if (NS_SUCCEEDED(rv) && imapUrl)
  {
    // nsImapUrl::SetSpec() will set the imap action properly
    rv = imapUrl->SetImapAction(nsIImapUrl::nsImapUserDefinedMsgCommand);

    nsCOMPtr <nsIMsgMailNewsUrl> mailNewsUrl = do_QueryInterface(imapUrl);
    mailNewsUrl->SetMsgWindow(aMsgWindow);
    mailNewsUrl->SetUpdatingFolder(PR_TRUE);
    rv = SetImapUrlSink(anImapFolder, imapUrl);

    if (NS_SUCCEEDED(rv))
    {
      nsCString folderName;
      GetFolderName(anImapFolder, folderName);
      urlSpec.Append("/");
      urlSpec.Append(aCommand);
      urlSpec.Append(">");
      urlSpec.Append(uidString);
      urlSpec.Append(">");
      urlSpec.Append(hierarchyDelimiter);
      urlSpec.Append(folderName);
      urlSpec.Append(">");
      urlSpec.Append(uids);
      rv = mailNewsUrl->SetSpec(urlSpec);
      if (NS_SUCCEEDED(rv))
        rv = GetImapConnectionAndLoadUrl(aClientEventTarget, imapUrl, nsnull, aURL);
    }
  } // if we have a url to run....

  return rv;
}

NS_IMETHODIMP nsImapService::FetchCustomMsgAttribute(nsIEventTarget *aClientEventTarget,
                                                     nsIMsgFolder *anImapFolder,
                                                     nsIMsgWindow *aMsgWindow,
                                                     const nsACString &aAttribute,
                                                     const nsACString &uids,
                                                     nsIURI **aURL)
{
  NS_ENSURE_ARG_POINTER(aClientEventTarget);
  NS_ENSURE_ARG_POINTER(anImapFolder);
  NS_ENSURE_ARG_POINTER(aMsgWindow);

  nsCOMPtr<nsIImapUrl> imapUrl;
  nsCAutoString urlSpec;
  nsresult rv;
  char hierarchyDelimiter = GetHierarchyDelimiter(anImapFolder);
  rv = CreateStartOfImapUrl(EmptyCString(), getter_AddRefs(imapUrl), anImapFolder, 
                            nsnull, urlSpec, hierarchyDelimiter);
  if (NS_SUCCEEDED(rv) && imapUrl)
  {
    // nsImapUrl::SetSpec() will set the imap action properly
    rv = imapUrl->SetImapAction(nsIImapUrl::nsImapUserDefinedFetchAttribute);

    nsCOMPtr <nsIMsgMailNewsUrl> mailNewsUrl = do_QueryInterface(imapUrl);
    mailNewsUrl->SetMsgWindow(aMsgWindow);
    mailNewsUrl->SetUpdatingFolder(PR_TRUE);
    rv = SetImapUrlSink(anImapFolder, imapUrl);

    if (NS_SUCCEEDED(rv))
    {
      nsCString folderName;
      GetFolderName(anImapFolder, folderName);
      urlSpec.Append("/customFetch>UID>");
      urlSpec.Append(hierarchyDelimiter);
      urlSpec.Append(folderName);
      urlSpec.Append(">");
      urlSpec.Append(uids);
      urlSpec.Append(">");
      urlSpec.Append(aAttribute);
      rv = mailNewsUrl->SetSpec(urlSpec);
      if (NS_SUCCEEDED(rv))
        rv = GetImapConnectionAndLoadUrl(aClientEventTarget, imapUrl, nsnull, aURL);
    }
  } // if we have a url to run....

  return rv;
}

NS_IMETHODIMP nsImapService::StoreCustomKeywords(nsIEventTarget *aClientEventTarget,
                                                 nsIMsgFolder *anImapFolder,
                                                 nsIMsgWindow *aMsgWindow,
                                                 const nsACString &flagsToAdd,
                                                 const nsACString &flagsToSubtract,
                                                 const nsACString &uids,
                                                 nsIURI **aURL)
{
  NS_ENSURE_ARG_POINTER(aClientEventTarget);
  NS_ENSURE_ARG_POINTER(anImapFolder);
  nsCOMPtr<nsIImapUrl> imapUrl;
  nsCAutoString urlSpec;
  nsresult rv;
  char hierarchyDelimiter = GetHierarchyDelimiter(anImapFolder);
  rv = CreateStartOfImapUrl(EmptyCString(), getter_AddRefs(imapUrl), anImapFolder, nsnull, urlSpec, hierarchyDelimiter);

  if (NS_SUCCEEDED(rv) && imapUrl)
  {
    // nsImapUrl::SetSpec() will set the imap action properly
    rv = imapUrl->SetImapAction(nsIImapUrl::nsImapMsgStoreCustomKeywords);

    nsCOMPtr <nsIMsgMailNewsUrl> mailNewsUrl = do_QueryInterface(imapUrl);
    mailNewsUrl->SetMsgWindow(aMsgWindow);
    mailNewsUrl->SetUpdatingFolder(PR_TRUE);
    rv = SetImapUrlSink(anImapFolder, imapUrl);

    if (NS_SUCCEEDED(rv))
    {
      nsCString folderName;
      GetFolderName(anImapFolder, folderName);
      urlSpec.Append("/customKeywords>UID>");
      urlSpec.Append(hierarchyDelimiter);
      urlSpec.Append(folderName);
      urlSpec.Append(">");
      urlSpec.Append(uids);
      urlSpec.Append(">");
      urlSpec.Append(flagsToAdd);
      urlSpec.Append(">");
      urlSpec.Append(flagsToSubtract);
      rv = mailNewsUrl->SetSpec(urlSpec);
      if (NS_SUCCEEDED(rv))
        rv = GetImapConnectionAndLoadUrl(aClientEventTarget, imapUrl, nsnull, aURL);
    }
  } // if we have a url to run....

  return rv;
}


NS_IMETHODIMP nsImapService::DownloadMessagesForOffline(const nsACString &messageIds, 
                                                        nsIMsgFolder *aFolder, 
                                                        nsIUrlListener *aUrlListener, 
                                                        nsIMsgWindow *aMsgWindow)
{
  NS_ENSURE_ARG_POINTER(aFolder);

  nsCOMPtr<nsIImapUrl> imapUrl;
  nsCAutoString urlSpec;
  nsresult rv;
  char hierarchyDelimiter = GetHierarchyDelimiter(aFolder);
  rv = CreateStartOfImapUrl(EmptyCString(), getter_AddRefs(imapUrl), aFolder, nsnull,
                            urlSpec, hierarchyDelimiter);
  if (NS_SUCCEEDED(rv) && imapUrl)
  {
    nsCOMPtr<nsIURI> runningURI;
    // need to pass in stream listener in order to get the channel created correctly
    nsCOMPtr<nsIImapMessageSink> imapMessageSink(do_QueryInterface(aFolder, &rv));
    rv = FetchMessage(imapUrl, nsImapUrl::nsImapMsgDownloadForOffline,aFolder,
                      imapMessageSink, aMsgWindow, nsnull, messageIds,
                      PR_FALSE, EmptyCString(), getter_AddRefs(runningURI));
    if (runningURI && aUrlListener)
    {
      nsCOMPtr<nsIMsgMailNewsUrl> msgurl (do_QueryInterface(runningURI));
      nsCOMPtr<nsIImapUrl> imapUrl(do_QueryInterface(runningURI));
      if (msgurl)
        msgurl->RegisterListener(aUrlListener);
      if (imapUrl)
        imapUrl->SetStoreResultsOffline(PR_TRUE);
    }
  }
  return rv;
}

NS_IMETHODIMP nsImapService::MessageURIToMsgHdr(const char *uri, nsIMsgDBHdr **aRetVal)
{
  NS_ENSURE_ARG_POINTER(uri);
  NS_ENSURE_ARG_POINTER(aRetVal);

  nsresult rv = NS_OK;
  nsCOMPtr<nsIMsgFolder> folder;
  nsMsgKey msgKey;

  rv = DecomposeImapURI(nsDependentCString(uri), getter_AddRefs(folder), &msgKey);
  NS_ENSURE_SUCCESS(rv,rv);

  rv = folder->GetMessageHeader(msgKey, aRetVal);
  NS_ENSURE_SUCCESS(rv,rv);
  return NS_OK;
}

NS_IMETHODIMP nsImapService::PlaybackAllOfflineOperations(nsIMsgWindow *aMsgWindow, 
                                                          nsIUrlListener *aListener, 
                                                          nsISupports **aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  nsresult rv;
  nsImapOfflineSync *goOnline = new nsImapOfflineSync(aMsgWindow, aListener, nsnull);
  if (goOnline)
  {
    rv = goOnline->QueryInterface(NS_GET_IID(nsISupports), (void **) aResult); 
    NS_ENSURE_SUCCESS(rv, rv);
    if (NS_SUCCEEDED(rv) && *aResult)
      return goOnline->ProcessNextOperation();
  }
  return NS_ERROR_OUT_OF_MEMORY;
}

NS_IMETHODIMP nsImapService::DownloadAllOffineImapFolders(nsIMsgWindow *aMsgWindow, 
                                                          nsIUrlListener *aListener)
{
  nsImapOfflineDownloader *downloadForOffline = new nsImapOfflineDownloader(aMsgWindow, aListener);
  if (downloadForOffline)
  {
    // hold reference to this so it won't get deleted out from under itself.
    NS_ADDREF(downloadForOffline); 
    nsresult rv = downloadForOffline->ProcessNextOperation();
    NS_RELEASE(downloadForOffline);
    return rv;
  }
  return NS_ERROR_OUT_OF_MEMORY;
}


NS_IMETHODIMP nsImapService::GetCacheSession(nsICacheSession **result)
{
  nsresult rv = NS_OK;
  if (!mCacheSession)
  {
    nsCOMPtr<nsICacheService> serv = do_GetService(kCacheServiceCID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    
    rv = serv->CreateSession("IMAP-anywhere", nsICache::STORE_ANYWHERE, nsICache::STREAM_BASED, getter_AddRefs(mCacheSession));
    NS_ENSURE_SUCCESS(rv, rv);
    rv = mCacheSession->SetDoomEntriesIfExpired(PR_FALSE);
  }

  NS_IF_ADDREF(*result = mCacheSession);
  return rv;
}

NS_IMETHODIMP nsImapService::HandleContent(const char *aContentType, 
                                           nsIInterfaceRequestor *aWindowContext, 
                                           nsIRequest *request)
{
  nsresult rv;
  NS_ENSURE_ARG_POINTER(request);
  
  nsCOMPtr<nsIChannel> aChannel = do_QueryInterface(request, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  if (PL_strcasecmp(aContentType, "x-application-imapfolder") == 0)
  {
    nsCOMPtr<nsIURI> uri;
    rv = aChannel->GetURI(getter_AddRefs(uri));
    NS_ENSURE_SUCCESS(rv, rv);

    if (uri)
    {
      request->Cancel(NS_BINDING_ABORTED);
      nsCOMPtr<nsIWindowMediator> mediator(do_GetService(NS_WINDOWMEDIATOR_CONTRACTID, &rv));
      NS_ENSURE_SUCCESS(rv, rv);
      nsCAutoString uriStr;

      uri->GetSpec(uriStr);

      // imap uri's are unescaped, so unescape the url.
      NS_UnescapeURL(uriStr);
      nsCOMPtr <nsIMessengerWindowService> messengerWindowService = do_GetService(NS_MESSENGERWINDOWSERVICE_CONTRACTID,&rv);
      NS_ENSURE_SUCCESS(rv, rv);

      rv = messengerWindowService->OpenMessengerWindowWithUri("mail:3pane", uriStr.get(), nsMsgKey_None);
      NS_ENSURE_SUCCESS(rv, rv);
    }
  } 
  else 
  {
    // The content-type was not x-application-imapfolder
    return NS_ERROR_WONT_HANDLE_CONTENT;
  }

  return rv;
}
