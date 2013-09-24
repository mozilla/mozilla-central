/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsNntpIncomingServer.h"
#include "nsIPrefBranch.h"
#include "nsIPrefService.h"
#include "nsNewsFolder.h"
#include "nsIMsgFolder.h"
#include "nsIFile.h"
#include "nsCOMPtr.h"
#include "nsINntpService.h"
#include "nsINNTPProtocol.h"
#include "nsMsgNewsCID.h"
#include "nsNNTPProtocol.h"
#include "nsIDirectoryService.h"
#include "nsMailDirServiceDefs.h"
#include "nsMsgUtils.h"
#include "nsIPrompt.h"
#include "nsIStringBundle.h"
#include "nntpCore.h"
#include "nsIWindowWatcher.h"
#include "nsITreeColumns.h"
#include "nsIDOMElement.h"
#include "nsMsgFolderFlags.h"
#include "nsMsgI18N.h"
#include "nsUnicharUtils.h"
#include "nsISupportsObsolete.h"
#include "nsILineInputStream.h"
#include "nsNetUtil.h"
#include "nsISimpleEnumerator.h"
#include "nsMsgUtils.h"
#include "mozilla/Services.h"
#include "nsITreeBoxObject.h"

#define INVALID_VERSION         0
#define VALID_VERSION           2
#define NEW_NEWS_DIR_NAME       "News"
#define PREF_MAIL_NEWSRC_ROOT   "mail.newsrc_root"
#define PREF_MAIL_NEWSRC_ROOT_REL "mail.newsrc_root-rel"
#define PREF_MAILNEWS_VIEW_DEFAULT_CHARSET "mailnews.view_default_charset"
#define HOSTINFO_FILE_NAME      "hostinfo.dat"

#define NEWS_DELIMITER          '.'

// this platform specific junk is so the newsrc filenames we create
// will resemble the migrated newsrc filenames.
#if defined(XP_UNIX)
#define NEWSRC_FILE_PREFIX "newsrc-"
#define NEWSRC_FILE_SUFFIX ""
#else
#define NEWSRC_FILE_PREFIX ""
#define NEWSRC_FILE_SUFFIX ".rc"
#endif /* XP_UNIX */

// ###tw  This really ought to be the most
// efficient file reading size for the current
// operating system.
#define HOSTINFO_FILE_BUFFER_SIZE 1024

#include "nsMsgUtils.h"

/**
 * A comparator class to do cases insensitive comparisons for nsTArray.Sort()
 */
class nsCStringLowerCaseComparator
{
public:
  bool Equals(const nsCString &a, const nsCString &b) const
  {
    return a.Equals(b, nsCaseInsensitiveCStringComparator());
  }

  bool LessThan(const nsCString &a, const nsCString &b) const
  {
    return Compare(a, b, nsCaseInsensitiveCStringComparator());
  }
};

static NS_DEFINE_CID(kSubscribableServerCID, NS_SUBSCRIBABLESERVER_CID);

NS_IMPL_ADDREF_INHERITED(nsNntpIncomingServer, nsMsgIncomingServer)
NS_IMPL_RELEASE_INHERITED(nsNntpIncomingServer, nsMsgIncomingServer)

NS_INTERFACE_MAP_BEGIN(nsNntpIncomingServer)
    NS_INTERFACE_MAP_ENTRY(nsINntpIncomingServer)
    NS_INTERFACE_MAP_ENTRY(nsIUrlListener)
    NS_INTERFACE_MAP_ENTRY(nsISubscribableServer)
    NS_INTERFACE_MAP_ENTRY(nsITreeView)
NS_INTERFACE_MAP_END_INHERITING(nsMsgIncomingServer)

nsNntpIncomingServer::nsNntpIncomingServer()
{
  mNewsrcHasChanged = false;

  mGetOnlyNew = true;

  mHostInfoLoaded = false;
  mHostInfoHasChanged = false;
  mVersion = INVALID_VERSION;

  mLastGroupDate = 0;
  mUniqueId = 0;
  mHasSeenBeginGroups = false;
  mPostingAllowed = false;
  mLastUpdatedTime = 0;

  // these atoms are used for subscribe search
  mSubscribedAtom = MsgGetAtom("subscribed");
  mNntpAtom = MsgGetAtom("nntp");

  // we have server wide and per group filters
  m_canHaveFilters = true;

  SetupNewsrcSaveTimer();
}

nsNntpIncomingServer::~nsNntpIncomingServer()
{
    nsresult rv;

    if (mNewsrcSaveTimer) {
        mNewsrcSaveTimer->Cancel();
        mNewsrcSaveTimer = nullptr;
    }
    rv = ClearInner();
    NS_ASSERTION(NS_SUCCEEDED(rv), "ClearInner failed");

    rv = CloseCachedConnections();
    NS_ASSERTION(NS_SUCCEEDED(rv), "CloseCachedConnections failed");
}

NS_IMPL_SERVERPREF_BOOL(nsNntpIncomingServer, NotifyOn, "notify.on")
NS_IMPL_SERVERPREF_BOOL(nsNntpIncomingServer, MarkOldRead, "mark_old_read")
NS_IMPL_SERVERPREF_BOOL(nsNntpIncomingServer, Abbreviate, "abbreviate")
NS_IMPL_SERVERPREF_BOOL(nsNntpIncomingServer, PushAuth, "always_authenticate")
NS_IMPL_SERVERPREF_BOOL(nsNntpIncomingServer, SingleSignon, "singleSignon")
NS_IMPL_SERVERPREF_INT(nsNntpIncomingServer, MaxArticles, "max_articles")

nsresult
nsNntpIncomingServer::CreateRootFolderFromUri(const nsCString &serverUri,
                                              nsIMsgFolder **rootFolder)
{
  nsMsgNewsFolder *newRootFolder = new nsMsgNewsFolder;
  if (!newRootFolder)
    return NS_ERROR_OUT_OF_MEMORY;
  NS_ADDREF(*rootFolder = newRootFolder);
  newRootFolder->Init(serverUri.get());
  return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::GetNewsrcFilePath(nsIFile **aNewsrcFilePath)
{
  nsresult rv;
  if (mNewsrcFilePath)
  {
    *aNewsrcFilePath = mNewsrcFilePath;
    NS_IF_ADDREF(*aNewsrcFilePath);
    return NS_OK;
  }

  rv = GetFileValue("newsrc.file-rel", "newsrc.file", aNewsrcFilePath);
  if (NS_SUCCEEDED(rv) && *aNewsrcFilePath)
  {
    mNewsrcFilePath = *aNewsrcFilePath;
    return rv;
  }

  rv = GetNewsrcRootPath(getter_AddRefs(mNewsrcFilePath));
  if (NS_FAILED(rv)) return rv;

  nsCString hostname;
  rv = GetHostName(hostname);
  NS_ENSURE_SUCCESS(rv, rv);

  nsAutoCString newsrcFileName(NEWSRC_FILE_PREFIX);
  newsrcFileName.Append(hostname);
  newsrcFileName.Append(NEWSRC_FILE_SUFFIX);
  rv = mNewsrcFilePath->AppendNative(newsrcFileName);
  rv = mNewsrcFilePath->CreateUnique(nsIFile::NORMAL_FILE_TYPE, 0644);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = SetNewsrcFilePath(mNewsrcFilePath);
  NS_ENSURE_SUCCESS(rv, rv);

  NS_ADDREF(*aNewsrcFilePath = mNewsrcFilePath);
  return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::SetNewsrcFilePath(nsIFile *aFile)
{
    NS_ENSURE_ARG_POINTER(aFile);

    bool exists;
    nsresult rv = aFile->Exists(&exists);
    if (!exists)
    {
      rv = aFile->CreateUnique(nsIFile::NORMAL_FILE_TYPE, 0664);
      if (NS_FAILED(rv)) return rv;
    }
    return SetFileValue("newsrc.file-rel", "newsrc.file", aFile);
}

NS_IMETHODIMP
nsNntpIncomingServer::GetLocalStoreType(nsACString& type)
{
  type.AssignLiteral("news");
  return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::SetNewsrcRootPath(nsIFile *aNewsrcRootPath)
{
    NS_ENSURE_ARG(aNewsrcRootPath);
    return NS_SetPersistentFile(PREF_MAIL_NEWSRC_ROOT_REL, PREF_MAIL_NEWSRC_ROOT, aNewsrcRootPath);
}

NS_IMETHODIMP
nsNntpIncomingServer::GetNewsrcRootPath(nsIFile **aNewsrcRootPath)
{
    NS_ENSURE_ARG_POINTER(aNewsrcRootPath);
    *aNewsrcRootPath = nullptr;

    bool havePref;
    nsresult rv = NS_GetPersistentFile(PREF_MAIL_NEWSRC_ROOT_REL,
                              PREF_MAIL_NEWSRC_ROOT,
                              NS_APP_NEWS_50_DIR,
                              havePref,
                              aNewsrcRootPath);

    NS_ENSURE_SUCCESS(rv, rv);

    bool exists;
    rv = (*aNewsrcRootPath)->Exists(&exists);
    if (NS_SUCCEEDED(rv) && !exists)
        rv = (*aNewsrcRootPath)->Create(nsIFile::DIRECTORY_TYPE, 0775);
    NS_ENSURE_SUCCESS(rv, rv);

    if (!havePref || !exists)
    {
        rv = NS_SetPersistentFile(PREF_MAIL_NEWSRC_ROOT_REL, PREF_MAIL_NEWSRC_ROOT, *aNewsrcRootPath);
        NS_ASSERTION(NS_SUCCEEDED(rv), "Failed to set root dir pref.");
    }
    return rv;
}

/* static */ void nsNntpIncomingServer::OnNewsrcSaveTimer(nsITimer *timer, void *voidIncomingServer)
{
  nsNntpIncomingServer *incomingServer = (nsNntpIncomingServer*)voidIncomingServer;
  incomingServer->WriteNewsrcFile();
}

nsresult nsNntpIncomingServer::SetupNewsrcSaveTimer()
{
  int64_t ms(300000);   // hard code, 5 minutes.
  //Convert biffDelay into milliseconds
  uint32_t timeInMSUint32 = (uint32_t)ms;
  //Can't currently reset a timer when it's in the process of
  //calling Notify. So, just release the timer here and create a new one.
  if(mNewsrcSaveTimer)
    mNewsrcSaveTimer->Cancel();
  mNewsrcSaveTimer = do_CreateInstance("@mozilla.org/timer;1");
  mNewsrcSaveTimer->InitWithFuncCallback(OnNewsrcSaveTimer, (void*)this, timeInMSUint32,
                                           nsITimer::TYPE_REPEATING_SLACK);
  return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::SetCharset(const nsACString & aCharset)
{
  return SetCharValue("charset", aCharset);
}

NS_IMETHODIMP
nsNntpIncomingServer::GetCharset(nsACString & aCharset)
{
  //first we get the per-server settings mail.server.<serverkey>.charset
  nsresult rv = GetCharValue("charset", aCharset);
  NS_ENSURE_SUCCESS(rv, rv);

  //if the per-server setting is empty,we get the default charset from
  //mailnews.view_default_charset setting and set it as per-server preference.
  if (aCharset.IsEmpty()) {
    nsString defaultCharset;
    rv = NS_GetLocalizedUnicharPreferenceWithDefault(nullptr,
         PREF_MAILNEWS_VIEW_DEFAULT_CHARSET,
         NS_LITERAL_STRING("ISO-8859-1"), defaultCharset);
    NS_ENSURE_SUCCESS(rv, rv);
    LossyCopyUTF16toASCII(defaultCharset, aCharset);
    SetCharset(aCharset);
  }
  return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::WriteNewsrcFile()
{
    nsresult rv;

    bool newsrcHasChanged;
    rv = GetNewsrcHasChanged(&newsrcHasChanged);
    if (NS_FAILED(rv)) return rv;

#ifdef DEBUG_NEWS
  nsCString hostname;
  rv = GetHostName(hostname);
  if (NS_FAILED(rv)) return rv;
#endif /* DEBUG_NEWS */

    if (newsrcHasChanged) {
#ifdef DEBUG_NEWS
        printf("write newsrc file for %s\n", hostname.get());
#endif
        nsCOMPtr <nsIFile> newsrcFile;
        rv = GetNewsrcFilePath(getter_AddRefs(newsrcFile));
        if (NS_FAILED(rv)) return rv;

        nsCOMPtr<nsIOutputStream> newsrcStream;
        nsresult rv = MsgNewBufferedFileOutputStream(getter_AddRefs(newsrcStream), newsrcFile, -1, 00600);
        if (NS_FAILED(rv))
          return rv;

        nsCOMPtr<nsISimpleEnumerator> subFolders;
        nsCOMPtr<nsIMsgFolder> rootFolder;
        rv = GetRootFolder(getter_AddRefs(rootFolder));
        if (NS_FAILED(rv)) return rv;

        nsCOMPtr <nsIMsgNewsFolder> newsFolder = do_QueryInterface(rootFolder, &rv);
        if (NS_FAILED(rv)) return rv;

        uint32_t bytesWritten;
        nsCString optionLines;
        rv = newsFolder->GetOptionLines(optionLines);
        if (NS_SUCCEEDED(rv) && !optionLines.IsEmpty()) {
          newsrcStream->Write(optionLines.get(), optionLines.Length(), &bytesWritten);
#ifdef DEBUG_NEWS
               printf("option lines:\n%s", optionLines.get());
#endif /* DEBUG_NEWS */
        }
#ifdef DEBUG_NEWS
        else {
            printf("no option lines to write out\n");
        }
#endif /* DEBUG_NEWS */

        nsCString unsubscribedLines;
        rv = newsFolder->GetUnsubscribedNewsgroupLines(unsubscribedLines);
        if (NS_SUCCEEDED(rv) && !unsubscribedLines.IsEmpty()) {
          newsrcStream->Write(unsubscribedLines.get(), unsubscribedLines.Length(), &bytesWritten);
#ifdef DEBUG_NEWS
               printf("unsubscribedLines:\n%s", unsubscribedLines.get());
#endif /* DEBUG_NEWS */
        }
#ifdef DEBUG_NEWS
        else {
            printf("no unsubscribed lines to write out\n");
        }
#endif /* DEBUG_NEWS */

        rv = rootFolder->GetSubFolders(getter_AddRefs(subFolders));
        if (NS_FAILED(rv)) return rv;

        bool moreFolders;

        while (NS_SUCCEEDED(subFolders->HasMoreElements(&moreFolders)) &&
               moreFolders) {
            nsCOMPtr<nsISupports> child;
            rv = subFolders->GetNext(getter_AddRefs(child));
            if (NS_SUCCEEDED(rv) && child) {
                newsFolder = do_QueryInterface(child, &rv);
                if (NS_SUCCEEDED(rv) && newsFolder) {
                    nsCString newsrcLine;
                    rv = newsFolder->GetNewsrcLine(newsrcLine);
                    if (NS_SUCCEEDED(rv) && !newsrcLine.IsEmpty()) {
                        // write the line to the newsrc file
                        newsrcStream->Write(newsrcLine.get(), newsrcLine.Length(), &bytesWritten);
                    }
                }
            }
        }

        newsrcStream->Close();

        rv = SetNewsrcHasChanged(false);
        if (NS_FAILED(rv)) return rv;
    }
#ifdef DEBUG_NEWS
    else {
        printf("no need to write newsrc file for %s, it was not dirty\n", (hostname.get()));
    }
#endif /* DEBUG_NEWS */

    return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::SetNewsrcHasChanged(bool aNewsrcHasChanged)
{
    mNewsrcHasChanged = aNewsrcHasChanged;
    return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::GetNewsrcHasChanged(bool *aNewsrcHasChanged)
{
    if (!aNewsrcHasChanged) return NS_ERROR_NULL_POINTER;

    *aNewsrcHasChanged = mNewsrcHasChanged;
    return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::CloseCachedConnections()
{
  nsresult rv;
  nsCOMPtr<nsINNTPProtocol> connection;

  // iterate through the connection cache and close the connections.
  int32_t cnt = mConnectionCache.Count();

  for (int32_t i = 0; i < cnt; ++i)
  {
    connection = mConnectionCache[0];
    if (connection)
    {
      rv = connection->CloseConnection();
      // We need to do this instead of RemoveObjectAt(0) because the
      // above call will likely cause the object to be removed from the
      // array anyway
      mConnectionCache.RemoveObject(connection);
    }
  }

  rv = WriteNewsrcFile();
  if (NS_FAILED(rv)) return rv;

  if (!mGetOnlyNew && !mHostInfoLoaded)
  {
    rv = WriteHostInfoFile();
    NS_ENSURE_SUCCESS(rv,rv);
  }

  return NS_OK;
}

NS_IMPL_SERVERPREF_INT(nsNntpIncomingServer, MaximumConnectionsNumber,
                       "max_cached_connections")

bool
nsNntpIncomingServer::ConnectionTimeOut(nsINNTPProtocol* aConnection)
{
    bool retVal = false;
    if (!aConnection)
      return retVal;

    PRTime lastActiveTimeStamp;
    if (NS_FAILED(aConnection->GetLastActiveTimeStamp(&lastActiveTimeStamp)))
      return retVal;

    if (PR_Now() - lastActiveTimeStamp >= PRTime(170) * PR_USEC_PER_SEC)
    {
#ifdef DEBUG_seth
      printf("XXX connection timed out, close it, and remove it from the connection cache\n");
#endif
      aConnection->CloseConnection();
      mConnectionCache.RemoveObject(aConnection);
      retVal = true;
    }
    return retVal;
}


nsresult
nsNntpIncomingServer::CreateProtocolInstance(nsINNTPProtocol ** aNntpConnection, nsIURI *url,
                                             nsIMsgWindow *aMsgWindow)
{
  // create a new connection and add it to the connection cache
  // we may need to flag the protocol connection as busy so we don't get
  // a race
  // condition where someone else goes through this code
  nsNNTPProtocol *protocolInstance = new nsNNTPProtocol(this, url, aMsgWindow);
  if (!protocolInstance)
    return NS_ERROR_OUT_OF_MEMORY;

  nsresult rv = protocolInstance->QueryInterface(NS_GET_IID(nsINNTPProtocol), (void **) aNntpConnection);
  // take the protocol instance and add it to the connectionCache
  if (NS_SUCCEEDED(rv) && *aNntpConnection)
    mConnectionCache.AppendObject(*aNntpConnection);
  return rv;
}

/* By default, allow the user to open at most this many connections to one news host */
#define kMaxConnectionsPerHost 2

nsresult
nsNntpIncomingServer::GetNntpConnection(nsIURI * aUri, nsIMsgWindow *aMsgWindow,
                                        nsINNTPProtocol ** aNntpConnection)
{
  // Get our maximum connection count. We need at least 1. If the value is 0,
  // we use the default. If it's negative, we treat that as 1.
  int32_t maxConnections = kMaxConnectionsPerHost;
  nsresult rv = GetMaximumConnectionsNumber(&maxConnections);
  if (NS_FAILED(rv) || maxConnections == 0)
  {
    maxConnections = kMaxConnectionsPerHost;
    SetMaximumConnectionsNumber(maxConnections);
  }
  else if (maxConnections < 1)
  {
    maxConnections = 1;
    SetMaximumConnectionsNumber(maxConnections);
  }

  // Find a non-busy connection
  nsCOMPtr<nsINNTPProtocol> connection;
  int32_t cnt = mConnectionCache.Count();
  for (int32_t i = 0; i < cnt; i++)
  {
    connection = mConnectionCache[i];
    if (connection)
    {
      bool isBusy;
      connection->GetIsBusy(&isBusy);
      if (!isBusy)
        break;
      connection = nullptr;
    }
  }

  if (ConnectionTimeOut(connection))
  {
    connection = nullptr;
    // We have one less connection, since we closed this one.
    --cnt;
  }

  if (connection)
  {
    NS_IF_ADDREF(*aNntpConnection = connection);
    connection->SetIsCachedConnection(true);
  }
  else if (cnt < maxConnections)
  {
    // We have room for another connection. Create this connection and return
    // it to the caller.
    rv = CreateProtocolInstance(aNntpConnection, aUri, aMsgWindow);
    NS_ENSURE_SUCCESS(rv, rv);
  }
  else
  {
    // We maxed out our connection count. The caller must therefore enqueue the
    // call.
    *aNntpConnection = nullptr;
    return NS_OK;
  }

  // Initialize the URI here and now.
  return (*aNntpConnection)->Initialize(aUri, aMsgWindow);
}

NS_IMETHODIMP
nsNntpIncomingServer::GetNntpChannel(nsIURI *aURI, nsIMsgWindow *aMsgWindow,
                                     nsIChannel **aChannel)
{
  NS_ENSURE_ARG_POINTER(aChannel);

  nsCOMPtr<nsINNTPProtocol> protocol;
  nsresult rv = GetNntpConnection(aURI, aMsgWindow, getter_AddRefs(protocol));
  NS_ENSURE_SUCCESS(rv, rv);

  if (protocol)
    return CallQueryInterface(protocol, aChannel);

  // No protocol? We need our mock channel.
  nsNntpMockChannel *channel = new nsNntpMockChannel(aURI, aMsgWindow);
  if (!channel)
    return NS_ERROR_OUT_OF_MEMORY;
  NS_ADDREF(*aChannel = channel);

  m_queuedChannels.AppendElement(channel);
  return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::LoadNewsUrl(nsIURI *aURI, nsIMsgWindow *aMsgWindow,
                                  nsISupports *aConsumer)
{
  nsCOMPtr<nsINNTPProtocol> protocol;
  nsresult rv = GetNntpConnection(aURI, aMsgWindow, getter_AddRefs(protocol));
  NS_ENSURE_SUCCESS(rv, rv);

  if (protocol)
    return protocol->LoadNewsUrl(aURI, aConsumer);

  // No protocol? We need our mock channel.
  nsNntpMockChannel *channel = new nsNntpMockChannel(aURI, aMsgWindow,
                                                     aConsumer);
  if (!channel)
    return NS_ERROR_OUT_OF_MEMORY;

  m_queuedChannels.AppendElement(channel);
  return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::PrepareForNextUrl(nsNNTPProtocol *aConnection)
{
  NS_ENSURE_ARG(aConnection);

  // Start the connection on the next URL in the queue. If it can't get a URL to
  // work, drop that URL (the channel will handle failure notification) and move
  // on.
  while (m_queuedChannels.Length() > 0)
  {
    nsRefPtr<nsNntpMockChannel> channel = m_queuedChannels[0];
    m_queuedChannels.RemoveElementAt(0);
    nsresult rv = channel->AttachNNTPConnection(*aConnection);
    // If this succeeded, the connection is now running the URL.
    if (NS_SUCCEEDED(rv))
      return NS_OK;
  }
  
  // No queued uris.
  return NS_OK;
}

/* void RemoveConnection (in nsINNTPProtocol aNntpConnection); */
NS_IMETHODIMP nsNntpIncomingServer::RemoveConnection(nsINNTPProtocol *aNntpConnection)
{
  if (aNntpConnection)
    mConnectionCache.RemoveObject(aNntpConnection);

  return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::PerformExpand(nsIMsgWindow *aMsgWindow)
{
  // Get news.update_unread_on_expand pref
  nsresult rv;
  bool updateUnreadOnExpand = true;
  nsCOMPtr<nsIPrefBranch> prefBranch = do_GetService(NS_PREFSERVICE_CONTRACTID, &rv);
  if (NS_SUCCEEDED(rv))
    prefBranch->GetBoolPref("news.update_unread_on_expand", &updateUnreadOnExpand);

  // Only if news.update_unread_on_expand is true do we update the unread counts
  if (updateUnreadOnExpand)
    return DownloadMail(aMsgWindow);
  return NS_OK;
}

nsresult
nsNntpIncomingServer::DownloadMail(nsIMsgWindow *aMsgWindow)
{
  nsCOMPtr<nsIMsgFolder> rootFolder;
  nsresult rv = GetRootFolder(getter_AddRefs(rootFolder));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsISimpleEnumerator> groups;
  rv = rootFolder->GetSubFolders(getter_AddRefs(groups));
  NS_ENSURE_SUCCESS(rv, rv);

  bool hasNext;
  while (NS_SUCCEEDED(rv = groups->HasMoreElements(&hasNext)) && hasNext)
  {
    nsCOMPtr<nsISupports> nextGroup;
    rv = groups->GetNext(getter_AddRefs(nextGroup));
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIMsgFolder> group(do_QueryInterface(nextGroup));
    rv = group->GetNewMessages(aMsgWindow, nullptr);
    NS_ENSURE_SUCCESS(rv, rv);
  }
  return rv;
}

NS_IMETHODIMP
nsNntpIncomingServer::DisplaySubscribedGroup(nsIMsgNewsFolder *aMsgFolder, int32_t aFirstMessage, int32_t aLastMessage, int32_t aTotalMessages)
{
  nsresult rv;

  if (!aMsgFolder) return NS_ERROR_NULL_POINTER;
#ifdef DEBUG_NEWS
  printf("DisplaySubscribedGroup(...,%ld,%ld,%ld)\n",aFirstMessage,aLastMessage,aTotalMessages);
#endif
  rv = aMsgFolder->UpdateSummaryFromNNTPInfo(aFirstMessage,aLastMessage,aTotalMessages);
  return rv;
}

NS_IMETHODIMP
nsNntpIncomingServer::PerformBiff(nsIMsgWindow *aMsgWindow)
{
  // Biff will force a download of the messages. If the user doesn't want this
  // (e.g., there is a lot of high-traffic newsgroups), the better option is to
  // just ignore biff.
  return PerformExpand(aMsgWindow);
}

NS_IMETHODIMP nsNntpIncomingServer::GetServerRequiresPasswordForBiff(bool *aServerRequiresPasswordForBiff)
{
  NS_ENSURE_ARG_POINTER(aServerRequiresPasswordForBiff);
  *aServerRequiresPasswordForBiff = false;  // for news, biff is getting the unread counts
  return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::OnStartRunningUrl(nsIURI *url)
{
  return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::OnStopRunningUrl(nsIURI *url, nsresult exitCode)
{
  nsresult rv;
  rv = UpdateSubscribed();
  if (NS_FAILED(rv)) return rv;

  rv = StopPopulating(mMsgWindow);
  if (NS_FAILED(rv)) return rv;

  return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::ContainsNewsgroup(const nsACString &aName,
                                        bool *containsGroup)
{
    NS_ENSURE_ARG_POINTER(containsGroup);
    NS_ENSURE_FALSE(aName.IsEmpty(), NS_ERROR_FAILURE);

    if (mSubscribedNewsgroups.Length() == 0)
    {
      // If this is empty, we may need to discover folders
      nsCOMPtr<nsIMsgFolder> rootFolder;
      GetRootFolder(getter_AddRefs(rootFolder));
      if (rootFolder)
      {
        nsCOMPtr<nsISimpleEnumerator> subfolders;
        rootFolder->GetSubFolders(getter_AddRefs(subfolders));
      }
    }
    nsAutoCString unescapedName;
    MsgUnescapeString(aName, 0, unescapedName);
    *containsGroup = mSubscribedNewsgroups.Contains(aName);
    return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::SubscribeToNewsgroup(const nsACString &aName)
{
    NS_ASSERTION(!aName.IsEmpty(), "no name");
    NS_ENSURE_FALSE(aName.IsEmpty(), NS_ERROR_FAILURE);

    // If we already have this newsgroup, do nothing and report success.
    bool containsGroup = false;
    nsresult rv = ContainsNewsgroup(aName, &containsGroup);
    NS_ENSURE_SUCCESS(rv, rv);
    if (containsGroup)
      return NS_OK;

    nsCOMPtr<nsIMsgFolder> msgfolder;
    rv = GetRootMsgFolder(getter_AddRefs(msgfolder));
    NS_ENSURE_SUCCESS(rv, rv);
    NS_ENSURE_TRUE(msgfolder, NS_ERROR_FAILURE);

    return msgfolder->CreateSubfolder(NS_ConvertUTF8toUTF16(aName), nullptr);
}

bool
writeGroupToHostInfoFile(nsCString &aElement, void *aData)
{
    nsIOutputStream *stream;
    stream = (nsIOutputStream *)aData;
    NS_ASSERTION(stream, "no stream");
    if (!stream) {
        // stop, something is bad.
        return false;
    }
    return true;
}

void nsNntpIncomingServer::WriteLine(nsIOutputStream *stream, nsCString &str)
{
  uint32_t bytesWritten;
  str.Append(MSG_LINEBREAK);
  stream->Write(str.get(), str.Length(), &bytesWritten);
}
nsresult
nsNntpIncomingServer::WriteHostInfoFile()
{
  if (!mHostInfoHasChanged)
    return NS_OK;
  int32_t firstnewdate = (int32_t)mFirstNewDate;

  mLastUpdatedTime = uint32_t(PR_Now() / PR_USEC_PER_SEC);

  nsCString hostname;
  nsresult rv = GetHostName(hostname);
  NS_ENSURE_SUCCESS(rv,rv);

  if (!mHostInfoFile)
    return NS_ERROR_UNEXPECTED;
  nsCOMPtr<nsIOutputStream> hostInfoStream;
  rv = MsgNewBufferedFileOutputStream(getter_AddRefs(hostInfoStream), mHostInfoFile, -1, 00600);
  NS_ENSURE_SUCCESS(rv, rv);

  // todo, missing some formatting, see the 4.x code
  nsAutoCString header("# News host information file.");
  WriteLine(hostInfoStream, header);
  header.Assign("# This is a generated file!  Do not edit.");
  WriteLine(hostInfoStream, header);
  header.Truncate();
  WriteLine(hostInfoStream, header);
  nsAutoCString version("version=");
  version.AppendInt(VALID_VERSION);
  WriteLine(hostInfoStream, version);
  nsAutoCString newsrcname("newsrcname=");
  newsrcname.Append(hostname);
  WriteLine(hostInfoStream, hostname);
  nsAutoCString dateStr("lastgroupdate=");
  dateStr.AppendInt(mLastUpdatedTime);
  WriteLine(hostInfoStream, dateStr);
  dateStr ="firstnewdate=";
  dateStr.AppendInt(firstnewdate);
  WriteLine(hostInfoStream, dateStr);
  dateStr = "uniqueid=";
  dateStr.AppendInt(mUniqueId);
  WriteLine(hostInfoStream, dateStr);
  header.Assign(MSG_LINEBREAK"begingroups");
  WriteLine(hostInfoStream, header);

  // XXX todo, sort groups first?
  uint32_t length = mGroupsOnServer.Length();
  for (uint32_t i = 0; i < length; ++i)
  {
    uint32_t bytesWritten;
    hostInfoStream->Write(mGroupsOnServer[i].get(), mGroupsOnServer[i].Length(),
                          &bytesWritten);
    hostInfoStream->Write(MSG_LINEBREAK, MSG_LINEBREAK_LEN, &bytesWritten);
  }

  hostInfoStream->Close();
  mHostInfoHasChanged = false;
  return NS_OK;
}

nsresult
nsNntpIncomingServer::LoadHostInfoFile()
{
  nsresult rv;
  // we haven't loaded it yet
  mHostInfoLoaded = false;

  rv = GetLocalPath(getter_AddRefs(mHostInfoFile));
  if (NS_FAILED(rv)) return rv;
  if (!mHostInfoFile) return NS_ERROR_FAILURE;

  rv = mHostInfoFile->AppendNative(NS_LITERAL_CSTRING(HOSTINFO_FILE_NAME));
  if (NS_FAILED(rv)) return rv;

  bool exists;
  rv = mHostInfoFile->Exists(&exists);
  if (NS_FAILED(rv)) return rv;

  // it is ok if the hostinfo.dat file does not exist.
  if (!exists) return NS_OK;

  nsCOMPtr<nsIInputStream> fileStream;
  rv = NS_NewLocalFileInputStream(getter_AddRefs(fileStream), mHostInfoFile);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsILineInputStream> lineInputStream(do_QueryInterface(fileStream, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  bool more = true;
  nsCString line;

  while (more && NS_SUCCEEDED(rv))
  {
    rv = lineInputStream->ReadLine(line, &more);
    if (line.IsEmpty())
      continue;
    HandleLine(line.get(), line.Length());
  }
  mHasSeenBeginGroups = false;
  fileStream->Close();

  return UpdateSubscribed();
}

NS_IMETHODIMP
nsNntpIncomingServer::StartPopulatingWithUri(nsIMsgWindow *aMsgWindow, bool aForceToServer, const char *uri)
{
  nsresult rv = NS_OK;

#ifdef DEBUG_seth
  printf("StartPopulatingWithUri(%s)\n",uri);
#endif

    rv = EnsureInner();
    NS_ENSURE_SUCCESS(rv,rv);
    rv = mInner->StartPopulatingWithUri(aMsgWindow, aForceToServer, uri);
    NS_ENSURE_SUCCESS(rv,rv);

  rv = StopPopulating(mMsgWindow);
  if (NS_FAILED(rv)) return rv;

  return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::SubscribeCleanup()
{
  nsresult rv = NS_OK;
    rv = ClearInner();
    NS_ENSURE_SUCCESS(rv,rv);
  return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::StartPopulating(nsIMsgWindow *aMsgWindow, bool aForceToServer, bool aGetOnlyNew)
{
  nsresult rv;

  mMsgWindow = aMsgWindow;

  rv = EnsureInner();
  NS_ENSURE_SUCCESS(rv,rv);

  rv = mInner->StartPopulating(aMsgWindow, aForceToServer, aGetOnlyNew);
  NS_ENSURE_SUCCESS(rv,rv);

  rv = SetDelimiter(NEWS_DELIMITER);
  if (NS_FAILED(rv)) return rv;

  rv = SetShowFullName(true);
  if (NS_FAILED(rv)) return rv;

  nsCOMPtr<nsINntpService> nntpService = do_GetService(NS_NNTPSERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  mHostInfoLoaded = false;
  mVersion = INVALID_VERSION;
  mGroupsOnServer.Clear();
  mGetOnlyNew = aGetOnlyNew;

  if (!aForceToServer) {
  rv = LoadHostInfoFile();
    if (NS_FAILED(rv)) return rv;
  }

  // mHostInfoLoaded can be false if we failed to load anything
  if (aForceToServer || !mHostInfoLoaded || (mVersion != VALID_VERSION)) {
    // set these to true, so when we are done and we call WriteHostInfoFile()
    // we'll write out to hostinfo.dat
  mHostInfoHasChanged = true;
  mVersion = VALID_VERSION;

  mGroupsOnServer.Clear();
  rv = nntpService->GetListOfGroupsOnServer(this, aMsgWindow, aGetOnlyNew);
  if (NS_FAILED(rv)) return rv;
  }
  else {
  rv = StopPopulating(aMsgWindow);
  if (NS_FAILED(rv)) return rv;
  }

  return NS_OK;
}

/**
 * This method is the entry point for |nsNNTPProtocol| class. |aName| is now
 * encoded in the serverside character encoding, but we need to handle
 * newsgroup names in UTF-8 internally, So we convert |aName| to
 * UTF-8 here for later use.
 **/
NS_IMETHODIMP
nsNntpIncomingServer::AddNewsgroupToList(const char *aName)
{
    nsresult rv;

    nsAutoString newsgroupName;
    nsAutoCString dataCharset;
    rv = GetCharset(dataCharset);
    NS_ENSURE_SUCCESS(rv,rv);

    rv = nsMsgI18NConvertToUnicode(dataCharset.get(),
                                   nsDependentCString(aName),
                                   newsgroupName);
#ifdef DEBUG_jungshik
    NS_ASSERTION(NS_SUCCEEDED(rv), "newsgroup name conversion failed");
#endif
    if (NS_FAILED(rv)) {
        CopyASCIItoUTF16(nsDependentCString(aName), newsgroupName);
    }

    rv = AddTo(NS_ConvertUTF16toUTF8(newsgroupName),
               false, true, true);
    if (NS_FAILED(rv)) return rv;
    return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::SetIncomingServer(nsIMsgIncomingServer *aServer)
{
    nsresult rv = EnsureInner();
    NS_ENSURE_SUCCESS(rv,rv);
  return mInner->SetIncomingServer(aServer);
}

NS_IMETHODIMP
nsNntpIncomingServer::SetShowFullName(bool showFullName)
{
    nsresult rv = EnsureInner();
    NS_ENSURE_SUCCESS(rv,rv);
  return mInner->SetShowFullName(showFullName);
}

nsresult
nsNntpIncomingServer::ClearInner()
{
    nsresult rv = NS_OK;

    if (mInner) {
        rv = mInner->SetSubscribeListener(nullptr);
        NS_ENSURE_SUCCESS(rv,rv);

        rv = mInner->SetIncomingServer(nullptr);
        NS_ENSURE_SUCCESS(rv,rv);

        mInner = nullptr;
    }
    return NS_OK;
}

nsresult
nsNntpIncomingServer::EnsureInner()
{
    nsresult rv = NS_OK;

    if (mInner) return NS_OK;

    mInner = do_CreateInstance(kSubscribableServerCID,&rv);
    NS_ENSURE_SUCCESS(rv,rv);
    if (!mInner) return NS_ERROR_FAILURE;

    rv = SetIncomingServer(this);
    NS_ENSURE_SUCCESS(rv,rv);

    return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::GetDelimiter(char *aDelimiter)
{
    nsresult rv = EnsureInner();
    NS_ENSURE_SUCCESS(rv,rv);
    return mInner->GetDelimiter(aDelimiter);
}

NS_IMETHODIMP
nsNntpIncomingServer::SetDelimiter(char aDelimiter)
{
    nsresult rv = EnsureInner();
    NS_ENSURE_SUCCESS(rv,rv);
    return mInner->SetDelimiter(aDelimiter);
}

NS_IMETHODIMP
nsNntpIncomingServer::SetAsSubscribed(const nsACString &path)
{
    mTempSubscribed.AppendElement(path);
    if (mGetOnlyNew && (!mGroupsOnServer.Contains(path)))
      return NS_OK;

    nsresult rv = EnsureInner();
    NS_ENSURE_SUCCESS(rv,rv);
    return mInner->SetAsSubscribed(path);
}

NS_IMETHODIMP
nsNntpIncomingServer::UpdateSubscribed()
{
  nsresult rv = EnsureInner();
  NS_ENSURE_SUCCESS(rv,rv);
  mTempSubscribed.Clear();
  uint32_t length = mSubscribedNewsgroups.Length();
  for (uint32_t i = 0; i < length; ++i)
    SetAsSubscribed(mSubscribedNewsgroups[i]);
  return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::AddTo(const nsACString &aName, bool addAsSubscribed,
                            bool aSubscribable, bool changeIfExists)
{
    NS_ASSERTION(MsgIsUTF8(aName), "Non-UTF-8 newsgroup name");
    nsresult rv = EnsureInner();
    NS_ENSURE_SUCCESS(rv,rv);

    rv = AddGroupOnServer(aName);
    NS_ENSURE_SUCCESS(rv,rv);

    rv = mInner->AddTo(aName, addAsSubscribed, aSubscribable, changeIfExists);
    NS_ENSURE_SUCCESS(rv,rv);

    return rv;
}

NS_IMETHODIMP
nsNntpIncomingServer::StopPopulating(nsIMsgWindow *aMsgWindow)
{
  nsresult rv = NS_OK;

  nsCOMPtr<nsISubscribeListener> listener;
  rv = GetSubscribeListener(getter_AddRefs(listener));
  NS_ENSURE_SUCCESS(rv,rv);

  if (!listener)
    return NS_ERROR_FAILURE;

  rv = listener->OnDonePopulating();
  NS_ENSURE_SUCCESS(rv,rv);

  rv = EnsureInner();
  NS_ENSURE_SUCCESS(rv,rv);
  rv = mInner->StopPopulating(aMsgWindow);
  NS_ENSURE_SUCCESS(rv,rv);

  if (!mGetOnlyNew && !mHostInfoLoaded)
  {
    rv = WriteHostInfoFile();
    NS_ENSURE_SUCCESS(rv,rv);
  }

  //xxx todo when do I set this to null?
  //rv = ClearInner();
  //NS_ENSURE_SUCCESS(rv,rv);
  return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::SetSubscribeListener(nsISubscribeListener *aListener)
{
    nsresult rv = EnsureInner();
    NS_ENSURE_SUCCESS(rv,rv);
  return mInner->SetSubscribeListener(aListener);
}

NS_IMETHODIMP
nsNntpIncomingServer::GetSubscribeListener(nsISubscribeListener **aListener)
{
    nsresult rv = EnsureInner();
    NS_ENSURE_SUCCESS(rv,rv);
    return mInner->GetSubscribeListener(aListener);
}

NS_IMETHODIMP
nsNntpIncomingServer::Subscribe(const PRUnichar *aUnicharName)
{
  return SubscribeToNewsgroup(NS_ConvertUTF16toUTF8(aUnicharName));
}

NS_IMETHODIMP
nsNntpIncomingServer::Unsubscribe(const PRUnichar *aUnicharName)
{
  NS_ENSURE_ARG_POINTER(aUnicharName);

  nsresult rv;

  nsCOMPtr <nsIMsgFolder> serverFolder;
  rv = GetRootMsgFolder(getter_AddRefs(serverFolder));
  if (NS_FAILED(rv))
    return rv;

  if (!serverFolder)
    return NS_ERROR_FAILURE;

  // to handle non-ASCII newsgroup names, we store them internally as escaped.
  // so we need to escape and encode the name, in order to find it.
  nsAutoCString escapedName;
  rv = NS_MsgEscapeEncodeURLPath(nsDependentString(aUnicharName), escapedName);

  nsCOMPtr <nsIMsgFolder> newsgroupFolder;
  rv = serverFolder->FindSubFolder(escapedName,
                                   getter_AddRefs(newsgroupFolder));

  if (NS_FAILED(rv))
    return rv;

  if (!newsgroupFolder)
    return NS_ERROR_FAILURE;

  rv = serverFolder->PropagateDelete(newsgroupFolder, true /* delete storage */, nullptr);
  if (NS_FAILED(rv))
    return rv;

  // since we've unsubscribed to a newsgroup, the newsrc needs to be written out
  rv = SetNewsrcHasChanged(true);
  if (NS_FAILED(rv))
    return rv;

  return NS_OK;
}

nsresult
nsNntpIncomingServer::HandleLine(const char* line, uint32_t line_size)
{
  NS_ASSERTION(line, "line is null");
  if (!line)
    return NS_OK;

  // skip blank lines and comments
  if (line[0] == '#' || line[0] == '\0')
    return NS_OK;
  // ###TODO - make this truly const, maybe pass in an nsCString &

  if (mHasSeenBeginGroups) {
    // v1 hostinfo files had additional data fields delimited by commas.
    // with v2 hostinfo files, the additional data fields are removed.
    char *commaPos = (char *) PL_strchr(line,',');
    if (commaPos) *commaPos = 0;

        // newsrc entries are all in UTF-8
#ifdef DEBUG_jungshik
    NS_ASSERTION(MsgIsUTF8(nsDependentCString(line)), "newsrc line is not utf-8");
#endif
    nsresult rv = AddTo(nsDependentCString(line), false, true, true);
    NS_ASSERTION(NS_SUCCEEDED(rv),"failed to add line");
    if (NS_SUCCEEDED(rv)) {
      // since we've seen one group, we can claim we've loaded the
      // hostinfo file
      mHostInfoLoaded = true;
    }
  }
  else {
    if (PL_strncmp(line,"begingroups", 11) == 0) {
      mHasSeenBeginGroups = true;
    }
    char*equalPos = (char *) PL_strchr(line, '=');
    if (equalPos) {
      *equalPos++ = '\0';
      if (PL_strcmp(line, "lastgroupdate") == 0) {
        mLastUpdatedTime = strtoul(equalPos, nullptr, 10);
      } else if (PL_strcmp(line, "firstnewdate") == 0) {
        mFirstNewDate = strtol(equalPos, nullptr, 16);
      } else if (PL_strcmp(line, "uniqueid") == 0) {
        mUniqueId = strtol(equalPos, nullptr, 16);
      } else if (PL_strcmp(line, "version") == 0) {
        mVersion = strtol(equalPos, nullptr, 16);
      }
    }
  }

  return NS_OK;
}

nsresult
nsNntpIncomingServer::AddGroupOnServer(const nsACString &aName)
{
  mGroupsOnServer.AppendElement(aName);
  return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::AddNewsgroup(const nsAString &aName)
{
    // handle duplicates?
    mSubscribedNewsgroups.AppendElement(NS_ConvertUTF16toUTF8(aName));
    return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::RemoveNewsgroup(const nsAString &aName)
{
    // handle duplicates?
    mSubscribedNewsgroups.RemoveElement(NS_ConvertUTF16toUTF8(aName));
    return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::SetState(const nsACString &path, bool state,
                               bool *stateChanged)
{
    nsresult rv = EnsureInner();
    NS_ENSURE_SUCCESS(rv,rv);

    rv = mInner->SetState(path, state, stateChanged);
    if (*stateChanged) {
      if (state)
        mTempSubscribed.AppendElement(path);
      else
        mTempSubscribed.RemoveElement(path);
    }
    return rv;
}

NS_IMETHODIMP
nsNntpIncomingServer::HasChildren(const nsACString &path, bool *aHasChildren)
{
    nsresult rv = EnsureInner();
    NS_ENSURE_SUCCESS(rv,rv);
    return mInner->HasChildren(path, aHasChildren);
}

NS_IMETHODIMP
nsNntpIncomingServer::IsSubscribed(const nsACString &path,
                                   bool *aIsSubscribed)
{
    nsresult rv = EnsureInner();
    NS_ENSURE_SUCCESS(rv,rv);
    return mInner->IsSubscribed(path, aIsSubscribed);
}

NS_IMETHODIMP
nsNntpIncomingServer::IsSubscribable(const nsACString &path,
                                     bool *aIsSubscribable)
{
    nsresult rv = EnsureInner();
    NS_ENSURE_SUCCESS(rv,rv);
    return mInner->IsSubscribable(path, aIsSubscribable);
}

NS_IMETHODIMP
nsNntpIncomingServer::GetLeafName(const nsACString &path, nsAString &aLeafName)
{
    nsresult rv = EnsureInner();
    NS_ENSURE_SUCCESS(rv,rv);
    return mInner->GetLeafName(path, aLeafName);
}

NS_IMETHODIMP
nsNntpIncomingServer::GetFirstChildURI(const nsACString &path, nsACString &aResult)
{
    nsresult rv = EnsureInner();
    NS_ENSURE_SUCCESS(rv,rv);
    return mInner->GetFirstChildURI(path, aResult);
}

NS_IMETHODIMP
nsNntpIncomingServer::GetChildren(const nsACString &aPath,
                                  nsISimpleEnumerator **aResult)
{
    nsresult rv = EnsureInner();
    NS_ENSURE_SUCCESS(rv,rv);
    return mInner->GetChildren(aPath, aResult);
}

NS_IMETHODIMP
nsNntpIncomingServer::CommitSubscribeChanges()
{
    nsresult rv;

    // we force the newrc to be dirty, so it will get written out when
    // we call WriteNewsrcFile()
    rv = SetNewsrcHasChanged(true);
    NS_ENSURE_SUCCESS(rv,rv);
    return WriteNewsrcFile();
}

NS_IMETHODIMP
nsNntpIncomingServer::ForgetPassword()
{
    nsresult rv;

    // clear password of root folder (for the news account)
    nsCOMPtr<nsIMsgFolder> rootFolder;
    rv = GetRootFolder(getter_AddRefs(rootFolder));
    NS_ENSURE_SUCCESS(rv,rv);
    if (!rootFolder) return NS_ERROR_FAILURE;

    nsCOMPtr <nsIMsgNewsFolder> newsFolder = do_QueryInterface(rootFolder, &rv);
    NS_ENSURE_SUCCESS(rv,rv);
    if (!newsFolder) return NS_ERROR_FAILURE;

    rv = newsFolder->ForgetAuthenticationCredentials();
    NS_ENSURE_SUCCESS(rv,rv);

    // clear password of all child folders
    nsCOMPtr<nsISimpleEnumerator> subFolders;

    rv = rootFolder->GetSubFolders(getter_AddRefs(subFolders));
    NS_ENSURE_SUCCESS(rv,rv);

    bool moreFolders = false;

    nsresult return_rv = NS_OK;

    while (NS_SUCCEEDED(subFolders->HasMoreElements(&moreFolders)) &&
           moreFolders) {
        nsCOMPtr<nsISupports> child;
        rv = subFolders->GetNext(getter_AddRefs(child));
        if (NS_SUCCEEDED(rv) && child) {
            newsFolder = do_QueryInterface(child, &rv);
            if (NS_SUCCEEDED(rv) && newsFolder) {
                rv = newsFolder->ForgetAuthenticationCredentials();
                if (NS_FAILED(rv)) return_rv = rv;
            }
            else {
                return_rv = NS_ERROR_FAILURE;
            }
        }
    }

    return return_rv;
}

NS_IMETHODIMP
nsNntpIncomingServer::GetSupportsExtensions(bool *aSupportsExtensions)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsNntpIncomingServer::SetSupportsExtensions(bool aSupportsExtensions)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsNntpIncomingServer::AddExtension(const char *extension)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsNntpIncomingServer::QueryExtension(const char *extension, bool *result)
{
#ifdef DEBUG_seth
  printf("no extension support yet\n");
#endif
  *result = false;
  return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::GetPostingAllowed(bool *aPostingAllowed)
{
  *aPostingAllowed = mPostingAllowed;
  return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::SetPostingAllowed(bool aPostingAllowed)
{
  mPostingAllowed = aPostingAllowed;
  return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::GetLastUpdatedTime(uint32_t *aLastUpdatedTime)
{
  *aLastUpdatedTime = mLastUpdatedTime;
  return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::SetLastUpdatedTime(uint32_t aLastUpdatedTime)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsNntpIncomingServer::AddPropertyForGet(const char *name, const char *value)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsNntpIncomingServer::QueryPropertyForGet(const char *name, char **value)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsNntpIncomingServer::AddSearchableGroup(const nsAString &name)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsNntpIncomingServer::QuerySearchableGroup(const nsAString &name, bool *result)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsNntpIncomingServer::AddSearchableHeader(const char *name)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsNntpIncomingServer::QuerySearchableHeader(const char *name, bool *result)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsNntpIncomingServer::FindGroup(const nsACString &name, nsIMsgNewsFolder **result)
{
  NS_ENSURE_ARG_POINTER(result);

  nsresult rv;
  nsCOMPtr <nsIMsgFolder> serverFolder;
  rv = GetRootMsgFolder(getter_AddRefs(serverFolder));
  NS_ENSURE_SUCCESS(rv,rv);

  if (!serverFolder) return NS_ERROR_FAILURE;

  // Escape the name for using FindSubFolder
  nsAutoCString escapedName;
  rv = MsgEscapeString(name, nsINetUtil::ESCAPE_URL_PATH, escapedName);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr <nsIMsgFolder> subFolder;
  rv = serverFolder->FindSubFolder(escapedName, getter_AddRefs(subFolder));
  NS_ENSURE_SUCCESS(rv,rv);
  if (!subFolder) return NS_ERROR_FAILURE;

  rv = subFolder->QueryInterface(NS_GET_IID(nsIMsgNewsFolder), (void**)result);
  NS_ENSURE_SUCCESS(rv,rv);
  if (!*result) return NS_ERROR_FAILURE;
  return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::GetFirstGroupNeedingExtraInfo(nsACString &result)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsNntpIncomingServer::SetGroupNeedsExtraInfo(const nsACString &name,
                                             bool needsExtraInfo)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


NS_IMETHODIMP
nsNntpIncomingServer::GroupNotFound(nsIMsgWindow *aMsgWindow,
                                    const nsAString &aName, bool aOpening)
{
  nsresult rv;
  nsCOMPtr <nsIPrompt> prompt;

  if (aMsgWindow) {
    rv = aMsgWindow->GetPromptDialog(getter_AddRefs(prompt));
    NS_ASSERTION(NS_SUCCEEDED(rv), "no prompt from the msg window");
  }

  if (!prompt) {
    nsCOMPtr<nsIWindowWatcher> wwatch(do_GetService(NS_WINDOWWATCHER_CONTRACTID));
    rv = wwatch->GetNewPrompter(nullptr, getter_AddRefs(prompt));
    NS_ENSURE_SUCCESS(rv,rv);
  }

  nsCOMPtr <nsIStringBundleService> bundleService =
    mozilla::services::GetStringBundleService();
  NS_ENSURE_TRUE(bundleService, NS_ERROR_UNEXPECTED);

  nsCOMPtr <nsIStringBundle> bundle;
  rv = bundleService->CreateBundle(NEWS_MSGS_URL, getter_AddRefs(bundle));
  NS_ENSURE_SUCCESS(rv,rv);

  nsCString hostname;
  rv = GetRealHostName(hostname);
  NS_ENSURE_SUCCESS(rv,rv);

  NS_ConvertUTF8toUTF16 hostStr(hostname);

  nsString groupName(aName);
  const PRUnichar *formatStrings[2] = { groupName.get(), hostStr.get() };
  nsString confirmText;
  rv = bundle->FormatStringFromName(
                    NS_LITERAL_STRING("autoUnsubscribeText").get(),
                    formatStrings, 2,
                    getter_Copies(confirmText));
  NS_ENSURE_SUCCESS(rv,rv);

  bool confirmResult = false;
  rv = prompt->Confirm(nullptr, confirmText.get(), &confirmResult);
  NS_ENSURE_SUCCESS(rv,rv);

  if (confirmResult) {
    rv = Unsubscribe(groupName.get());
    NS_ENSURE_SUCCESS(rv,rv);
  }

  return rv;
}

NS_IMETHODIMP
nsNntpIncomingServer::SetPrettyNameForGroup(const nsAString &name,
                                            const nsAString &prettyName)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsNntpIncomingServer::GetCanSearchMessages(bool *canSearchMessages)
{
    NS_ENSURE_ARG_POINTER(canSearchMessages);
    *canSearchMessages = true;
    return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::GetOfflineSupportLevel(int32_t *aSupportLevel)
{
    NS_ENSURE_ARG_POINTER(aSupportLevel);
    nsresult rv;

    rv = GetIntValue("offline_support_level", aSupportLevel);
    if (*aSupportLevel != OFFLINE_SUPPORT_LEVEL_UNDEFINED) return rv;

    // set default value
    *aSupportLevel = OFFLINE_SUPPORT_LEVEL_EXTENDED;
    return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::GetDefaultCopiesAndFoldersPrefsToServer(bool *aCopiesAndFoldersOnServer)
{
    NS_ENSURE_ARG_POINTER(aCopiesAndFoldersOnServer);

    /**
     * When a news account is created, the copies and folder prefs for the
     * associated identity don't point to folders on the server.
     * This makes sense, since there is no "Drafts" folder on a news server.
     * They'll point to the ones on "Local Folders"
     */

    *aCopiesAndFoldersOnServer = false;
    return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::GetCanCreateFoldersOnServer(bool *aCanCreateFoldersOnServer)
{
    NS_ENSURE_ARG_POINTER(aCanCreateFoldersOnServer);

    // No folder creation on news servers. Return false.
    *aCanCreateFoldersOnServer = false;
    return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::SetSearchValue(const nsAString &aSearchValue)
{
  nsCString searchValue = NS_ConvertUTF16toUTF8(aSearchValue);
  searchValue.CompressWhitespace(true, true);

  if (mTree) {
    mTree->BeginUpdateBatch();
    mTree->RowCountChanged(0, -mSubscribeSearchResult.Length());
  }

  nsTArray<nsCString> searchStringParts;
  if (!searchValue.IsEmpty())
    ParseString(searchValue, ' ', searchStringParts);

  mSubscribeSearchResult.Clear();
  uint32_t length = mGroupsOnServer.Length();
  for (uint32_t i = 0; i < length; i++)
  {
    // check that all parts of the search string occur
    bool found = true;
    for (uint32_t j = 0; j < searchStringParts.Length(); ++j) {
      nsCString::const_iterator start, end;
      mGroupsOnServer[i].BeginReading(start);
      mGroupsOnServer[i].EndReading(end);
      if (!CaseInsensitiveFindInReadable(searchStringParts[j], start, end)){
        found = false;
        break;
      }
    }

    if (found)
      mSubscribeSearchResult.AppendElement(mGroupsOnServer[i]);
  }

  nsCStringLowerCaseComparator comparator;
  mSubscribeSearchResult.Sort(comparator);

  if (mTree)
  {
    mTree->RowCountChanged(0, mSubscribeSearchResult.Length());
    mTree->EndUpdateBatch();
  }

  return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::GetSupportsSubscribeSearch(bool *retVal)
{
    *retVal = true;
    return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::GetRowCount(int32_t *aRowCount)
{
    *aRowCount = mSubscribeSearchResult.Length();
    return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::GetSelection(nsITreeSelection * *aSelection)
{
  *aSelection = mTreeSelection;
  NS_IF_ADDREF(*aSelection);
  return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::SetSelection(nsITreeSelection * aSelection)
{
  mTreeSelection = aSelection;
  return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::GetRowProperties(int32_t index, nsAString& properties)
{
    return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::GetCellProperties(int32_t row, nsITreeColumn* col, nsAString& properties)
{
    if (!IsValidRow(row))
      return NS_ERROR_UNEXPECTED;

    NS_ENSURE_ARG_POINTER(col);

    const PRUnichar* colID;
    col->GetIdConst(&colID);
    if (colID[0] == 's') {
        // if <name> is in our temporary list of subscribed groups
        // add the "subscribed" property so the check mark shows up
        // in the "subscribedCol"
        if (mSearchResultSortDescending)
          row = mSubscribeSearchResult.Length() - 1 - row;
        if (mTempSubscribed.Contains(mSubscribeSearchResult.ElementAt(row))) {
          properties.AssignLiteral("subscribed");
        }
    }
    else if (colID[0] == 'n') {
      // add the "nntp" property to the "nameCol"
      // so we get the news folder icon in the search view
      properties.AssignLiteral("nntp");
    }
    return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::GetColumnProperties(nsITreeColumn* col, nsAString& properties)
{
    return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::IsContainer(int32_t index, bool *_retval)
{
    *_retval = false;
    return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::IsContainerOpen(int32_t index, bool *_retval)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsNntpIncomingServer::IsContainerEmpty(int32_t index, bool *_retval)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsNntpIncomingServer::IsSeparator(int32_t index, bool *_retval)
{
    *_retval = false;
    return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::IsSorted(bool *_retval)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsNntpIncomingServer::CanDrop(int32_t index,
                              int32_t orientation,
                              nsIDOMDataTransfer *dataTransfer,
                              bool *_retval)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsNntpIncomingServer::Drop(int32_t row,
                           int32_t orientation,
                           nsIDOMDataTransfer *dataTransfer)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsNntpIncomingServer::GetParentIndex(int32_t rowIndex, int32_t *_retval)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsNntpIncomingServer::HasNextSibling(int32_t rowIndex, int32_t afterIndex, bool *_retval)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsNntpIncomingServer::GetLevel(int32_t index, int32_t *_retval)
{
    *_retval = 0;
    return NS_OK;
}

bool
nsNntpIncomingServer::IsValidRow(int32_t row)
{
  return ((row >= 0) && (row < (int32_t)mSubscribeSearchResult.Length()));
}

NS_IMETHODIMP
nsNntpIncomingServer::GetImageSrc(int32_t row, nsITreeColumn* col, nsAString& _retval)
{
  return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::GetProgressMode(int32_t row, nsITreeColumn* col, int32_t* _retval)
{
  return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::GetCellValue(int32_t row, nsITreeColumn* col, nsAString& _retval)
{
  return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::GetCellText(int32_t row, nsITreeColumn* col, nsAString& _retval)
{
    if (!IsValidRow(row))
      return NS_ERROR_UNEXPECTED;

    NS_ENSURE_ARG_POINTER(col);

    const PRUnichar* colID;
    col->GetIdConst(&colID);

    nsresult rv = NS_OK;
    if (colID[0] == 'n') {
      nsAutoCString str;
      if (mSearchResultSortDescending)
        row = mSubscribeSearchResult.Length() - 1 - row;
      // some servers have newsgroup names that are non ASCII.  we store
      // those as escaped. unescape here so the UI is consistent
      rv = NS_MsgDecodeUnescapeURLPath(mSubscribeSearchResult.ElementAt(row), _retval);
    }
    return rv;
}

NS_IMETHODIMP
nsNntpIncomingServer::SetTree(nsITreeBoxObject *tree)
{
  mTree = tree;
  if (!tree)
      return NS_OK;

  nsCOMPtr<nsITreeColumns> cols;
  tree->GetColumns(getter_AddRefs(cols));
  if (!cols)
      return NS_OK;

  nsCOMPtr<nsITreeColumn> col;
  cols->GetKeyColumn(getter_AddRefs(col));
  if (!col)
      return NS_OK;

  nsCOMPtr<nsIDOMElement> element;
  col->GetElement(getter_AddRefs(element));
  if (!element)
      return NS_OK;

  nsAutoString dir;
  element->GetAttribute(NS_LITERAL_STRING("sortDirection"), dir);
  mSearchResultSortDescending = dir.EqualsLiteral("descending");
  return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::ToggleOpenState(int32_t index)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsNntpIncomingServer::CycleHeader(nsITreeColumn* col)
{
    NS_ENSURE_ARG_POINTER(col);

    bool cycler;
    col->GetCycler(&cycler);
    if (!cycler) {
        NS_NAMED_LITERAL_STRING(dir, "sortDirection");
        nsCOMPtr<nsIDOMElement> element;
        col->GetElement(getter_AddRefs(element));
        mSearchResultSortDescending = !mSearchResultSortDescending;
        element->SetAttribute(dir, mSearchResultSortDescending ?
            NS_LITERAL_STRING("descending") : NS_LITERAL_STRING("ascending"));
        mTree->Invalidate();
    }
    return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::SelectionChanged()
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsNntpIncomingServer::CycleCell(int32_t row, nsITreeColumn* col)
{
    return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::IsEditable(int32_t row, nsITreeColumn* col, bool *_retval)
{
    *_retval = false;
    return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::IsSelectable(int32_t row, nsITreeColumn* col, bool *_retval)
{
    *_retval = false;
    return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::SetCellValue(int32_t row, nsITreeColumn* col, const nsAString& value)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsNntpIncomingServer::SetCellText(int32_t row, nsITreeColumn* col, const nsAString& value)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsNntpIncomingServer::PerformAction(const PRUnichar *action)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsNntpIncomingServer::PerformActionOnRow(const PRUnichar *action, int32_t row)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsNntpIncomingServer::PerformActionOnCell(const PRUnichar *action, int32_t row, nsITreeColumn* col)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsNntpIncomingServer::GetCanFileMessagesOnServer(bool *aCanFileMessagesOnServer)
{
    NS_ENSURE_ARG_POINTER(aCanFileMessagesOnServer);

    // No folder creation on news servers. Return false.
    *aCanFileMessagesOnServer = false;
    return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::GetFilterScope(nsMsgSearchScopeValue *filterScope)
{
   NS_ENSURE_ARG_POINTER(filterScope);

   *filterScope = nsMsgSearchScope::newsFilter;
   return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::GetSearchScope(nsMsgSearchScopeValue *searchScope)
{
   NS_ENSURE_ARG_POINTER(searchScope);

   if (WeAreOffline()) {
     // This value is set to the localNewsBody scope to be compatible with
     // the legacy default value.
     *searchScope = nsMsgSearchScope::localNewsBody;
   }
   else {
     *searchScope = nsMsgSearchScope::news;
   }
   return NS_OK;
}

NS_IMETHODIMP
nsNntpIncomingServer::GetSocketType(int32_t *aSocketType)
{
  NS_ENSURE_ARG_POINTER(aSocketType);
  if (!mPrefBranch)
    return NS_ERROR_NOT_INITIALIZED;

  nsresult rv = mPrefBranch->GetIntPref("socketType", aSocketType);
  if (NS_FAILED(rv))
  {
    if (!mDefPrefBranch)
      return NS_ERROR_NOT_INITIALIZED;
    rv = mDefPrefBranch->GetIntPref("socketType", aSocketType);
    if (NS_FAILED(rv))
      *aSocketType = nsMsgSocketType::plain;
  }

  // nsMsgIncomingServer::GetSocketType migrates old isSecure to socketType
  // style for mail. Unfortunately, a bug caused news socketType 0 to be stored
  // in the prefs even for isSecure true, so the migration wouldn't happen :(

  // Now that we know the socket, make sure isSecure true + socketType 0
  // doesn't mix. Migrate if that's the case here.
  if (*aSocketType == nsMsgSocketType::plain)
  {
    bool isSecure = false;
    nsresult rv2 = mPrefBranch->GetBoolPref("isSecure", &isSecure);
    if (NS_SUCCEEDED(rv2) && isSecure)
    {
      *aSocketType = nsMsgSocketType::SSL;
      // Don't call virtual method in case overrides call GetSocketType.
      nsMsgIncomingServer::SetSocketType(*aSocketType);
    }
  }
  return rv;
}

NS_IMETHODIMP
nsNntpIncomingServer::SetSocketType(int32_t aSocketType)
{
  if (!mPrefBranch)
    return NS_ERROR_NOT_INITIALIZED;
  nsresult rv = nsMsgIncomingServer::SetSocketType(aSocketType);
  if (NS_SUCCEEDED(rv))
  {
    bool isSecure = false;
    if (NS_SUCCEEDED(mPrefBranch->GetBoolPref("isSecure", &isSecure)))
    {
      // Must keep isSecure in sync since we migrate based on it... if it's set.
      rv = mPrefBranch->SetBoolPref("isSecure",
                                    aSocketType == nsMsgSocketType::SSL);
      NS_ENSURE_SUCCESS(rv, rv);
    }
  }
  return rv;
}

NS_IMETHODIMP
nsNntpIncomingServer::OnUserOrHostNameChanged(const nsACString& oldName,
                                              const nsACString& newName,
                                              bool hostnameChanged)
{
  nsresult rv;
  // 1. Do common things in the base class.
  rv = nsMsgIncomingServer::OnUserOrHostNameChanged(oldName, newName, hostnameChanged);
  NS_ENSURE_SUCCESS(rv,rv);

  // 2. Remove file hostinfo.dat so that the new subscribe
  //    list will be reloaded from the new server.
  nsCOMPtr <nsIFile> hostInfoFile;
  rv = GetLocalPath(getter_AddRefs(hostInfoFile));
  NS_ENSURE_SUCCESS(rv, rv);
  rv = hostInfoFile->AppendNative(NS_LITERAL_CSTRING(HOSTINFO_FILE_NAME));
  NS_ENSURE_SUCCESS(rv, rv);
  hostInfoFile->Remove(false);

  // 3.Unsubscribe and then subscribe the existing groups to clean up the article numbers
  //   in the rc file (this is because the old and new servers may maintain different
  //   numbers for the same articles if both servers handle the same groups).
  nsCOMPtr <nsIMsgFolder> serverFolder;
  rv = GetRootMsgFolder(getter_AddRefs(serverFolder));
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr<nsISimpleEnumerator> subFolders;
  rv = serverFolder->GetSubFolders(getter_AddRefs(subFolders));
  NS_ENSURE_SUCCESS(rv,rv);

  nsTArray<nsString> groupList;
  nsString folderName;

  // Prepare the group list
  bool hasMore;
  while (NS_SUCCEEDED(subFolders->HasMoreElements(&hasMore)) && hasMore)
  {
    nsCOMPtr<nsISupports> item;
    subFolders->GetNext(getter_AddRefs(item));
    nsCOMPtr<nsIMsgFolder> newsgroupFolder(do_QueryInterface(item));
    if (!newsgroupFolder)
      continue;

    rv = newsgroupFolder->GetName(folderName);
    NS_ENSURE_SUCCESS(rv,rv);
    groupList.AppendElement(folderName);
  }

  // If nothing subscribed then we're done.
  if (groupList.Length() == 0)
    return NS_OK;

  // Now unsubscribe & subscribe.
  uint32_t i;
  uint32_t cnt = groupList.Length();
  nsAutoCString cname;
  for (i = 0; i < cnt; i++)
  {
    // unsubscribe.
    rv = Unsubscribe(groupList[i].get());
    NS_ENSURE_SUCCESS(rv,rv);
  }

  for (i = 0; i < cnt; i++)
  {
    // subscribe.
    rv = SubscribeToNewsgroup(NS_ConvertUTF16toUTF8(groupList[i]));
    NS_ENSURE_SUCCESS(rv,rv);
  }

  // Force updating the rc file.
  return CommitSubscribeChanges();
}

NS_IMETHODIMP
nsNntpIncomingServer::GetSortOrder(int32_t* aSortOrder)
{
  NS_ENSURE_ARG_POINTER(aSortOrder);
  *aSortOrder = 500000000;
  return NS_OK;
}
