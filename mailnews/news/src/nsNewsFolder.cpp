/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsIPrefBranch.h"
#include "nsIPrefService.h"
#include "prlog.h"

#include "msgCore.h"    // precompiled header...
#include "nntpCore.h"
#include "nsIMsgMailNewsUrl.h"
#include "nsNewsFolder.h"
#include "nsMsgFolderFlags.h"
#include "prprf.h"
#include "prsystem.h"
#include "nsIArray.h"
#include "nsIServiceManager.h"
#include "nsINntpService.h"
#include "nsIFolderListener.h"
#include "nsCOMPtr.h"
#include "nsIRDFService.h"
#include "nsRDFCID.h"
#include "nsMsgDBCID.h"
#include "nsMsgNewsCID.h"
#include "nsMsgUtils.h"
#include "nsNewsUtils.h"

#include "nsCOMPtr.h"
#include "nsIMsgIncomingServer.h"
#include "nsINntpIncomingServer.h"
#include "nsINewsDatabase.h"
#include "nsMsgBaseCID.h"
#include "nsILineInputStream.h"

#include "nsIMsgWindow.h"
#include "nsIDocShell.h"
#include "nsIPrompt.h"
#include "nsIWindowWatcher.h"

#include "nsNetUtil.h"
#include "nsIAuthPrompt.h"
#include "nsIURL.h"
#include "nsNetCID.h"
#include "nsINntpUrl.h"

#include "nsIInterfaceRequestor.h"
#include "nsIInterfaceRequestorUtils.h"
#include "nsArrayEnumerator.h"
#include "nsNewsDownloader.h"
#include "nsIStringBundle.h"
#include "nsMsgI18N.h"
#include "nsNativeCharsetUtils.h"
#include "nsIMsgAccountManager.h"
#include "nsArrayUtils.h"
#include "nsIMsgAsyncPrompter.h"
#include "nsIMsgFolderNotificationService.h"
#include "nsIMutableArray.h"
#include "nsILoginInfo.h"
#include "nsILoginManager.h"
#include "nsIPromptService.h"
#include "nsEmbedCID.h"
#include "nsIDOMWindow.h"
#include "mozilla/Services.h"
#include "nsAutoPtr.h"

static NS_DEFINE_CID(kRDFServiceCID, NS_RDFSERVICE_CID);

// ###tw  This really ought to be the most
// efficient file reading size for the current
// operating system.
#define NEWSRC_FILE_BUFFER_SIZE 1024

#define kNewsSortOffset 9000

#define kSizeUnknown 1

#define NEWS_SCHEME "news:"
#define SNEWS_SCHEME "snews:"

////////////////////////////////////////////////////////////////////////////////

namespace {
class AsyncAuthMigrator : public nsIMsgAsyncPromptListener {
public:
  AsyncAuthMigrator(nsIMsgNewsFolder *folder) : m_folder(folder) {}

  NS_DECL_ISUPPORTS
  NS_DECL_NSIMSGASYNCPROMPTLISTENER

  void EnqueuePrompt();

private:
  nsCOMPtr<nsIMsgNewsFolder> m_folder;
};

NS_IMPL_ISUPPORTS1(AsyncAuthMigrator, nsIMsgAsyncPromptListener)

NS_IMETHODIMP AsyncAuthMigrator::OnPromptStart(bool *retval)
{
  *retval = true;
  return m_folder->MigrateLegacyCredentials();
}

NS_IMETHODIMP AsyncAuthMigrator::OnPromptAuthAvailable()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP AsyncAuthMigrator::OnPromptCanceled()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

void AsyncAuthMigrator::EnqueuePrompt()
{
  nsCOMPtr<nsIMsgAsyncPrompter> prompter =
    do_GetService(NS_MSGASYNCPROMPTER_CONTRACTID);

  // Make up a fake unique key to prevent coalescing of prompts
  // The address of this object should be sufficient
  nsAutoCString queueKey;
  queueKey.AppendInt((int32_t)(uint64_t)this);
  prompter->QueueAsyncAuthPrompt(queueKey, false, this);
}

}

 

////////////////////////////////////////////////////////////////////////////////

nsMsgNewsFolder::nsMsgNewsFolder(void) :
     mExpungedBytes(0), mGettingNews(false),
     mInitialized(false),
     m_downloadMessageForOfflineUse(false), m_downloadingMultipleMessages(false),
     mReadSet(nullptr), mSortOrder(kNewsSortOffset)
{
  MOZ_COUNT_CTOR(nsNewsFolder); // double count these for now.
  mFolderSize = kSizeUnknown;
}

nsMsgNewsFolder::~nsMsgNewsFolder(void)
{
  MOZ_COUNT_DTOR(nsNewsFolder);
  delete mReadSet;
}

NS_IMPL_ADDREF_INHERITED(nsMsgNewsFolder, nsMsgDBFolder)
NS_IMPL_RELEASE_INHERITED(nsMsgNewsFolder, nsMsgDBFolder)

NS_IMETHODIMP nsMsgNewsFolder::QueryInterface(REFNSIID aIID, void** aInstancePtr)
{
  if (!aInstancePtr)
    return NS_ERROR_NULL_POINTER;
  *aInstancePtr = nullptr;

  if (aIID.Equals(NS_GET_IID(nsIMsgNewsFolder)))
    *aInstancePtr = static_cast<nsIMsgNewsFolder*>(this);
  if(*aInstancePtr)
  {
    AddRef();
    return NS_OK;
  }

  return nsMsgDBFolder::QueryInterface(aIID, aInstancePtr);
}

////////////////////////////////////////////////////////////////////////////////

nsresult
nsMsgNewsFolder::CreateSubFolders(nsIFile *path)
{
  nsresult rv;
  bool isNewsServer = false;
  rv = GetIsServer(&isNewsServer);
  if (NS_FAILED(rv)) return rv;

  if (isNewsServer)
  {
    nsCOMPtr<nsINntpIncomingServer> nntpServer;
    rv = GetNntpServer(getter_AddRefs(nntpServer));
    NS_ENSURE_SUCCESS(rv, rv);

    rv = nntpServer->GetNewsrcFilePath(getter_AddRefs(mNewsrcFilePath));
    NS_ENSURE_SUCCESS(rv, rv);

    rv = LoadNewsrcFileAndCreateNewsgroups();
  }
  else // is not a host, so it has no newsgroups.  (what about categories??)
    rv = NS_OK;
  return rv;
}

NS_IMETHODIMP
nsMsgNewsFolder::AddNewsgroup(const nsACString &name, const nsACString& setStr,
                              nsIMsgFolder **child)
{
  NS_ENSURE_ARG_POINTER(child);
  nsresult rv;
  nsCOMPtr <nsIRDFService> rdf = do_GetService(kRDFServiceCID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr <nsINntpIncomingServer> nntpServer;
  rv = GetNntpServer(getter_AddRefs(nntpServer));
  if (NS_FAILED(rv)) return rv;

  nsAutoCString uri(mURI);
  uri.Append('/');
  // URI should use UTF-8
  // (see RFC2396 Uniform Resource Identifiers (URI): Generic Syntax)

  // we are handling newsgroup names in UTF-8
  NS_ConvertUTF8toUTF16 nameUtf16(name);

  nsAutoCString escapedName;
  rv = NS_MsgEscapeEncodeURLPath(nameUtf16, escapedName);
  if (NS_FAILED(rv)) return rv;

  rv = nntpServer->AddNewsgroup(nameUtf16);
  if (NS_FAILED(rv)) return rv;

  uri.Append(escapedName);

  nsCOMPtr<nsIRDFResource> res;
  rv = rdf->GetResource(uri, getter_AddRefs(res));
  if (NS_FAILED(rv)) return rv;

  nsCOMPtr<nsIMsgFolder> folder(do_QueryInterface(res, &rv));
  if (NS_FAILED(rv)) return rv;

  nsCOMPtr<nsIMsgNewsFolder> newsFolder(do_QueryInterface(res, &rv));
  if (NS_FAILED(rv)) return rv;

  // cache this for when we open the db
  rv = newsFolder->SetReadSetFromStr(setStr);

  // I don't have a good time to do this, but this is as good as any...
  nsRefPtr<AsyncAuthMigrator> delayedPrompt(new AsyncAuthMigrator(newsFolder));
  delayedPrompt->EnqueuePrompt();

  rv = folder->SetParent(this);
  NS_ENSURE_SUCCESS(rv,rv);

  // this what shows up in the UI
  rv = folder->SetName(nameUtf16);
  NS_ENSURE_SUCCESS(rv,rv);

  rv = folder->SetFlag(nsMsgFolderFlags::Newsgroup);
  if (NS_FAILED(rv)) return rv;

  int32_t numExistingGroups = mSubFolders.Count();

  // add kNewsSortOffset (9000) to prevent this problem:  1,10,11,2,3,4,5
  // We use 9000 instead of 1000 so newsgroups will sort to bottom of flat folder views
  rv = folder->SetSortOrder(numExistingGroups + kNewsSortOffset);
  NS_ENSURE_SUCCESS(rv,rv);

  mSubFolders.AppendObject(folder);
  folder->SetParent(this);
  folder.swap(*child);
  return rv;
}

nsresult nsMsgNewsFolder::ParseFolder(nsIFile *path)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

nsresult
nsMsgNewsFolder::AddDirectorySeparator(nsIFile *path)
{
  // don't concat the full separator with .sbd
  return (mURI.Equals(kNewsRootURI)) ?
                  NS_OK :
                  nsMsgDBFolder::AddDirectorySeparator(path);
}


NS_IMETHODIMP
nsMsgNewsFolder::GetSubFolders(nsISimpleEnumerator **aResult)
{
  if (!mInitialized)
  {
    // do this first, so we make sure to do it, even on failure.
    // see bug #70494
    mInitialized = true;

    nsCOMPtr<nsIFile> path;
    nsresult rv = GetFilePath(getter_AddRefs(path));
    if (NS_FAILED(rv)) return rv;

    rv = CreateSubFolders(path);
    if (NS_FAILED(rv)) return rv;

    // force ourselves to get initialized from cache
    // Don't care if it fails.  this will fail the first time after
    // migration, but we continue on.  see #66018
    (void)UpdateSummaryTotals(false);
  }

  return aResult ? NS_NewArrayEnumerator(aResult, mSubFolders) : NS_ERROR_NULL_POINTER;
}

//Makes sure the database is open and exists.  If the database is valid then
//returns NS_OK.  Otherwise returns a failure error value.
nsresult nsMsgNewsFolder::GetDatabase()
{
  nsresult rv;
  if (!mDatabase)
  {
    nsCOMPtr<nsIMsgDBService> msgDBService = do_GetService(NS_MSGDB_SERVICE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv,rv);

    // Get the database, blowing it away if it's out of date.
    rv = msgDBService->OpenFolderDB(this, false, getter_AddRefs(mDatabase));
    if (NS_FAILED(rv))
      rv = msgDBService->CreateNewDB(this, getter_AddRefs(mDatabase));
    NS_ENSURE_SUCCESS(rv, rv);

    if(mAddListener)
      rv = mDatabase->AddListener(this);

    nsCOMPtr<nsINewsDatabase> db = do_QueryInterface(mDatabase, &rv);
    if (NS_FAILED(rv))
      return rv;

    rv = db->SetReadSet(mReadSet);
    if (NS_FAILED(rv))
      return rv;

    rv = UpdateSummaryTotals(true);
    if (NS_FAILED(rv))
      return rv;
  }
  return NS_OK;
}

NS_IMETHODIMP
nsMsgNewsFolder::GetDatabaseWithoutCache(nsIMsgDatabase **db)
{
  NS_ENSURE_ARG_POINTER(db);

  // The simplest way to perform this operation is to get the database normally
  // and then clear our information about it if we didn't already hold it open.
  bool wasCached = !!mDatabase;
  nsresult rv = GetDatabase();
  NS_IF_ADDREF(*db = mDatabase);

  // If the DB was not open before, close our reference to it now.
  if (!wasCached && mDatabase)
  {
    mDatabase->RemoveListener(this);
    mDatabase = nullptr;
  }

  return rv;
}

NS_IMETHODIMP
nsMsgNewsFolder::UpdateFolder(nsIMsgWindow *aWindow)
{
  // Get news.get_messages_on_select pref
  nsresult rv;
  nsCOMPtr<nsIPrefBranch> prefBranch = do_GetService(NS_PREFSERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  bool getMessagesOnSelect = true;
  prefBranch->GetBoolPref("news.get_messages_on_select", &getMessagesOnSelect);

  // Only if news.get_messages_on_select is true do we get new messages automatically
  if (getMessagesOnSelect)
  {
    rv = GetDatabase(); // want this cached...
    if (NS_SUCCEEDED(rv))
    {
      if (mDatabase)
      {
        nsCOMPtr<nsIMsgRetentionSettings> retentionSettings;
        nsresult rv = GetRetentionSettings(getter_AddRefs(retentionSettings));
        if (NS_SUCCEEDED(rv))
          rv = mDatabase->ApplyRetentionSettings(retentionSettings, false);
      }
      rv = AutoCompact(aWindow);
      NS_ENSURE_SUCCESS(rv,rv);
      // GetNewMessages has to be the last rv set before we get to the next check, so
      // that we'll have rv set to NS_MSG_ERROR_OFFLINE when offline and send
      // a folder loaded notification to the front end.
      rv = GetNewMessages(aWindow, nullptr);
    }
    if (rv != NS_MSG_ERROR_OFFLINE)
      return rv;
  }
  // We're not getting messages because either get_messages_on_select is
  // false or we're offline. Send an immediate folder loaded notification.
  NotifyFolderEvent(mFolderLoadedAtom);
  (void) RefreshSizeOnDisk();
  return NS_OK;
}

NS_IMETHODIMP
nsMsgNewsFolder::GetCanSubscribe(bool *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  *aResult = false;

  bool isNewsServer = false;
  nsresult rv = GetIsServer(&isNewsServer);
  if (NS_FAILED(rv)) return rv;

  // you can only subscribe to news servers, not news groups
  *aResult = isNewsServer;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgNewsFolder::GetCanFileMessages(bool *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  // you can't file messages into a news server or news group
  *aResult = false;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgNewsFolder::GetCanCreateSubfolders(bool *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  *aResult = false;
  // you can't create subfolders on a news server or a news group
  return NS_OK;
}

NS_IMETHODIMP
nsMsgNewsFolder::GetCanRename(bool *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  *aResult = false;
  // you can't rename a news server or a news group
  return NS_OK;
}

NS_IMETHODIMP
nsMsgNewsFolder::GetCanCompact(bool *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  *aResult = false;
  // you can't compact a news server or a news group
  return NS_OK;
}

NS_IMETHODIMP
nsMsgNewsFolder::GetMessages(nsISimpleEnumerator **result)
{
  nsresult rv = GetDatabase();
  *result = nullptr;

  if(NS_SUCCEEDED(rv))
    rv = mDatabase->EnumerateMessages(result);

  return rv;
}

NS_IMETHODIMP nsMsgNewsFolder::GetFolderURL(nsACString& aUrl)
{
  nsCString hostName;
  nsresult rv = GetHostname(hostName);
  nsString groupName;
  rv = GetName(groupName);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIMsgIncomingServer> server;
  rv = GetServer(getter_AddRefs(server));
  NS_ENSURE_SUCCESS(rv, rv);

  int32_t socketType;
  rv = server->GetSocketType(&socketType);
  NS_ENSURE_SUCCESS(rv, rv);

  int32_t port;
  rv = server->GetPort(&port);
  NS_ENSURE_SUCCESS(rv, rv);
  const char *newsScheme = (socketType == nsMsgSocketType::SSL) ?
                           SNEWS_SCHEME : NEWS_SCHEME;
  nsCString escapedName;
  rv = NS_MsgEscapeEncodeURLPath(groupName, escapedName);
  NS_ENSURE_SUCCESS(rv, rv);
  nsCString tmpStr;
  tmpStr.Adopt(PR_smprintf("%s//%s:%ld/%s", newsScheme, hostName.get(), port,
                           escapedName.get()));
  aUrl.Assign(tmpStr);
  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::SetNewsrcHasChanged(bool newsrcHasChanged)
{
  nsresult rv;

  nsCOMPtr<nsINntpIncomingServer> nntpServer;
  rv = GetNntpServer(getter_AddRefs(nntpServer));
  if (NS_FAILED(rv)) return rv;
  return nntpServer->SetNewsrcHasChanged(newsrcHasChanged);
}

nsresult nsMsgNewsFolder::CreateChildFromURI(const nsCString &uri, nsIMsgFolder **folder)
{
  nsMsgNewsFolder *newFolder = new nsMsgNewsFolder;
  if (!newFolder)
    return NS_ERROR_OUT_OF_MEMORY;
  NS_ADDREF(*folder = newFolder);
  newFolder->Init(uri.get());
  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::CreateSubfolder(const nsAString& newsgroupName,
                                               nsIMsgWindow *msgWindow)
{
  nsresult rv = NS_OK;
  if (newsgroupName.IsEmpty())
    return NS_ERROR_FAILURE;

  nsCOMPtr<nsIMsgFolder> child;
  // Create an empty database for this mail folder, set its name from the user
  nsCOMPtr<nsIMsgDatabase> newsDBFactory;
  nsCOMPtr <nsIMsgDatabase> newsDB;

  //Now let's create the actual new folder
  rv = AddNewsgroup(NS_ConvertUTF16toUTF8(newsgroupName), EmptyCString(), getter_AddRefs(child));

  if (NS_SUCCEEDED(rv))
    SetNewsrcHasChanged(true); // subscribe UI does this - but maybe we got here through auto-subscribe

  if(NS_SUCCEEDED(rv) && child){
    nsCOMPtr <nsINntpIncomingServer> nntpServer;
    rv = GetNntpServer(getter_AddRefs(nntpServer));
    if (NS_FAILED(rv)) return rv;

    nsAutoCString dataCharset;
    rv = nntpServer->GetCharset(dataCharset);
    if (NS_FAILED(rv)) return rv;

    child->SetCharset(dataCharset);
    NotifyItemAdded(child);
    nsCOMPtr<nsIMsgFolderNotificationService> notifier(do_GetService(NS_MSGNOTIFICATIONSERVICE_CONTRACTID));
    if (notifier)
      notifier->NotifyFolderAdded(child);
  }
  return rv;
}

NS_IMETHODIMP nsMsgNewsFolder::Delete()
{
  nsresult rv = GetDatabase();

  if(NS_SUCCEEDED(rv))
  {
    mDatabase->ForceClosed();
    mDatabase = nullptr;
  }

  nsCOMPtr<nsIFile> folderPath;
  rv = GetFilePath(getter_AddRefs(folderPath));

  if (NS_SUCCEEDED(rv))
  {
    nsCOMPtr<nsIFile> summaryPath;
    rv = GetSummaryFileLocation(folderPath, getter_AddRefs(summaryPath));
    if (NS_SUCCEEDED(rv))
    {
      bool exists = false;
      rv = folderPath->Exists(&exists);

      if (NS_SUCCEEDED(rv) && exists)
        rv = folderPath->Remove(false);

      if (NS_FAILED(rv))
        NS_WARNING("Failed to remove News Folder");

      rv = summaryPath->Exists(&exists);

      if (NS_SUCCEEDED(rv) && exists)
        rv = summaryPath->Remove(false);

      if (NS_FAILED(rv))
        NS_WARNING("Failed to remove News Folder Summary File");
    }
  }

  nsCOMPtr <nsINntpIncomingServer> nntpServer;
  rv = GetNntpServer(getter_AddRefs(nntpServer));
  if (NS_FAILED(rv)) return rv;

  nsAutoString name;
  rv = GetUnicodeName(name);
  NS_ENSURE_SUCCESS(rv,rv);

  rv = nntpServer->RemoveNewsgroup(name);
  NS_ENSURE_SUCCESS(rv,rv);

  (void) RefreshSizeOnDisk();

  return SetNewsrcHasChanged(true);
}

NS_IMETHODIMP nsMsgNewsFolder::Rename(const nsAString& newName, nsIMsgWindow *msgWindow)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsMsgNewsFolder::GetAbbreviatedName(nsAString& aAbbreviatedName)
{
  nsresult rv;

  rv = nsMsgDBFolder::GetPrettyName(aAbbreviatedName);
  if(NS_FAILED(rv)) return rv;

  // only do this for newsgroup names, not for newsgroup hosts.
  bool isNewsServer = false;
  rv = GetIsServer(&isNewsServer);
  if (NS_FAILED(rv)) return rv;

  if (!isNewsServer) {
    nsCOMPtr<nsINntpIncomingServer> nntpServer;
    rv = GetNntpServer(getter_AddRefs(nntpServer));
    if (NS_FAILED(rv)) return rv;

    bool abbreviate = true;
    rv = nntpServer->GetAbbreviate(&abbreviate);
    if (NS_FAILED(rv)) return rv;

    if (abbreviate)
      rv = AbbreviatePrettyName(aAbbreviatedName, 1 /* hardcoded for now */);
  }
  return rv;
}

// original code from Oleg Rekutin
// rekusha@asan.com
// Public domain, created by Oleg Rekutin
//
// takes a newsgroup name, number of words from the end to leave unabberviated
// the newsgroup name, will get reset to the following format:
// x.x.x, where x is the first letter of each word and with the
// exception of last 'fullwords' words, which are left intact.
// If a word has a dash in it, it is abbreviated as a-b, where
// 'a' is the first letter of the part of the word before the
// dash and 'b' is the first letter of the part of the word after
// the dash
nsresult nsMsgNewsFolder::AbbreviatePrettyName(nsAString& prettyName, int32_t fullwords)
{
  nsAutoString name(prettyName);
  int32_t totalwords = 0; // total no. of words

  // get the total no. of words
  int32_t pos = 0;
  while(1)
  {
    pos = name.FindChar('.', pos);
    if(pos == -1)
    {
      totalwords++;
      break;
    }
    else
    {
      totalwords++;
      pos++;
    }
  }

  // get the no. of words to abbreviate
  int32_t abbrevnum = totalwords - fullwords;
  if (abbrevnum < 1)
    return NS_OK; // nothing to abbreviate

  // build the ellipsis
  nsAutoString out;
  out += name[0];

  int32_t length = name.Length();
  int32_t newword = 0;     // == 2 if done with all abbreviated words

  fullwords = 0;
  PRUnichar currentChar;
  for (int32_t i = 1; i < length; i++)
  {
    // this temporary assignment is needed to fix an intel mac compiler bug.
    // See Bug #327037 for details.
    currentChar = name[i];
    if (newword < 2) {
      switch (currentChar) {
      case '.':
        fullwords++;
        // check if done with all abbreviated words...
        if (fullwords == abbrevnum)
          newword = 2;
        else
          newword = 1;
        break;
      case '-':
        newword = 1;
        break;
      default:
        if (newword)
          newword = 0;
        else
          continue;
      }
    }
    out.Append(currentChar);
  }
  prettyName = out;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgNewsFolder::GetDBFolderInfoAndDB(nsIDBFolderInfo **folderInfo, nsIMsgDatabase **db)
{
  NS_ENSURE_ARG_POINTER(folderInfo);
  NS_ENSURE_ARG_POINTER(db);
  nsresult openErr;
  openErr = GetDatabase();
  *db = mDatabase;
  if (mDatabase) {
    NS_ADDREF(*db);
    if (NS_SUCCEEDED(openErr))
      openErr = (*db)->GetDBFolderInfo(folderInfo);
  }
  return openErr;
}

/* this used to be MSG_FolderInfoNews::UpdateSummaryFromNNTPInfo() */
NS_IMETHODIMP
nsMsgNewsFolder::UpdateSummaryFromNNTPInfo(int32_t oldest, int32_t youngest, int32_t total)
{
  bool newsrcHasChanged = false;

  /* First, mark all of the articles now known to be expired as read. */
  if (oldest > 1)
  {
    nsCString oldSet;
    nsCString newSet;
    mReadSet->Output(getter_Copies(oldSet));
    mReadSet->AddRange(1, oldest - 1);
    mReadSet->Output(getter_Copies(newSet));
    if (!oldSet.Equals(newSet))
      newsrcHasChanged = true;
  }

  /* Now search the newsrc line and figure out how many of these messages are marked as unread. */

  /* make sure youngest is a least 1. MSNews seems to return a youngest of 0. */
  if (youngest == 0)
    youngest = 1;

  int32_t unread = mReadSet->CountMissingInRange(oldest, youngest);
  NS_ASSERTION(unread >= 0,"CountMissingInRange reported unread < 0");
  if (unread < 0)
    // servers can send us stuff like "211 0 41 40 nz.netstatus"
    // we should handle it gracefully.
    unread = 0;

  if (unread > total)
  {
    /* This can happen when the newsrc file shows more unread than exist in the group (total is not necessarily `end - start'.) */
    unread = total;
    int32_t deltaInDB = mNumTotalMessages - mNumUnreadMessages;
    //int32_t deltaInDB = m_totalInDB - m_unreadInDB;
    /* if we know there are read messages in the db, subtract that from the unread total */
    if (deltaInDB > 0)
      unread -= deltaInDB;
  }

  bool dbWasOpen = mDatabase != nullptr;
  int32_t pendingUnreadDelta = unread - mNumUnreadMessages - mNumPendingUnreadMessages;
  int32_t pendingTotalDelta = total - mNumTotalMessages - mNumPendingTotalMessages;
  ChangeNumPendingUnread(pendingUnreadDelta);
  ChangeNumPendingTotalMessages(pendingTotalDelta);
  if (!dbWasOpen && mDatabase)
  {
    mDatabase->Commit(nsMsgDBCommitType::kLargeCommit);
    mDatabase->RemoveListener(this);
    mDatabase = nullptr;
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::GetExpungedBytesCount(uint32_t *count)
{
  NS_ENSURE_ARG_POINTER(count);
  *count = mExpungedBytes;
  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::GetDeletable(bool *deletable)
{
  *deletable = false;
  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::RefreshSizeOnDisk()
{
  uint64_t oldFolderSize = mFolderSize;
  // We set size to unknown to force it to get recalculated from disk.
  mFolderSize = kSizeUnknown;
  if (NS_SUCCEEDED(GetSizeOnDisk(&mFolderSize)))
    NotifyIntPropertyChanged(kFolderSizeAtom, oldFolderSize, mFolderSize);
  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::GetSizeOnDisk(uint32_t *size)
{
  NS_ENSURE_ARG_POINTER(size);

  // 0 is a valid folder size (meaning empty file with no offline messages),
  // but 1 is not. So use 1 as a special value meaning no file size was fetched
  // from disk yet.
  if (mFolderSize == kSizeUnknown)
  {
    nsCOMPtr<nsIFile> diskFile;
    nsresult rv = GetFilePath(getter_AddRefs(diskFile));
    NS_ENSURE_SUCCESS(rv, rv);

    // If there were no news messages downloaded for offline use, the folder file
    // may not exist yet. In that case size is 0.
    bool exists = false;
    rv = diskFile->Exists(&exists);
    if (NS_FAILED(rv) || !exists)
    {
      mFolderSize = 0;
    }
    else
    {
      int64_t fileSize;
      rv = diskFile->GetFileSize(&fileSize);
      NS_ENSURE_SUCCESS(rv, rv);
      mFolderSize = fileSize;
    }
  }

  *size = mFolderSize;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgNewsFolder::DeleteMessages(nsIArray *messages, nsIMsgWindow *aMsgWindow,
                                bool deleteStorage, bool isMove,
                                nsIMsgCopyServiceListener* listener,
                                bool allowUndo)
{
  nsresult rv = NS_OK;

  NS_ENSURE_ARG_POINTER(messages);
  NS_ENSURE_ARG_POINTER(aMsgWindow);

  if (!isMove)
  {
    nsCOMPtr<nsIMsgFolderNotificationService> notifier(do_GetService(NS_MSGNOTIFICATIONSERVICE_CONTRACTID));
    if (notifier)
      notifier->NotifyMsgsDeleted(messages);
  }

  rv = GetDatabase();
  NS_ENSURE_SUCCESS(rv, rv);

  rv = EnableNotifications(allMessageCountNotifications, false, true);
  if (NS_SUCCEEDED(rv))
  {
    uint32_t count = 0;
    rv = messages->GetLength(&count);
    NS_ENSURE_SUCCESS(rv, rv);

    for (uint32_t i = 0; i < count && NS_SUCCEEDED(rv); i++)
    {
      nsCOMPtr<nsIMsgDBHdr> msgHdr = do_QueryElementAt(messages, i, &rv);
      if (msgHdr)
        rv = mDatabase->DeleteHeader(msgHdr, nullptr, true, true);
    }
    EnableNotifications(allMessageCountNotifications, true, true);
  }
 
  if (!isMove) 
    NotifyFolderEvent(NS_SUCCEEDED(rv) ? mDeleteOrMoveMsgCompletedAtom :
      mDeleteOrMoveMsgFailedAtom);

  (void) RefreshSizeOnDisk();

  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::CancelMessage(nsIMsgDBHdr *msgHdr,
                                             nsIMsgWindow *aMsgWindow)
{
  NS_ENSURE_ARG_POINTER(msgHdr);
  NS_ENSURE_ARG_POINTER(aMsgWindow);

  nsresult rv;

  nsCOMPtr <nsINntpService> nntpService = do_GetService(NS_NNTPSERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  // for cancel, we need to
  // turn "newsmessage://sspitzer@news.mozilla.org/netscape.test#5428"
  // into "news://sspitzer@news.mozilla.org/23423@netscape.com"

  nsCOMPtr <nsIMsgIncomingServer> server;
  rv = GetServer(getter_AddRefs(server));
  NS_ENSURE_SUCCESS(rv,rv);

  nsCString serverURI;
  rv = server->GetServerURI(serverURI);
  NS_ENSURE_SUCCESS(rv,rv);

  nsCString messageID;
  rv = msgHdr->GetMessageId(getter_Copies(messageID));
  NS_ENSURE_SUCCESS(rv,rv);

  // we need to escape the message ID,
  // it might contain characters which will mess us up later, like #
  // see bug #120502
  nsCString escapedMessageID;
  MsgEscapeString(messageID, nsINetUtil::ESCAPE_URL_PATH, escapedMessageID);

  nsAutoCString cancelURL(serverURI.get());
  cancelURL += '/';
  cancelURL += escapedMessageID;
  cancelURL += "?cancel";

  nsCString messageURI;
  rv = GetUriForMsg(msgHdr, messageURI);
  NS_ENSURE_SUCCESS(rv,rv);

  return nntpService->CancelMessage(cancelURL.get(), messageURI.get(), nullptr /* consumer */, nullptr, 
                                    aMsgWindow, nullptr);
}

NS_IMETHODIMP nsMsgNewsFolder::GetNewMessages(nsIMsgWindow *aMsgWindow, nsIUrlListener *aListener)
{
  return GetNewsMessages(aMsgWindow, false, aListener);
}

NS_IMETHODIMP nsMsgNewsFolder::GetNextNMessages(nsIMsgWindow *aMsgWindow)
{
  return GetNewsMessages(aMsgWindow, true, nullptr);
}

nsresult nsMsgNewsFolder::GetNewsMessages(nsIMsgWindow *aMsgWindow, bool aGetOld, nsIUrlListener *aUrlListener)
{
  nsresult rv = NS_OK;

  bool isNewsServer = false;
  rv = GetIsServer(&isNewsServer);
  if (NS_FAILED(rv)) return rv;

  if (isNewsServer)
    // get new messages only works on a newsgroup, not a news server
    return NS_OK;

  nsCOMPtr <nsINntpService> nntpService = do_GetService(NS_NNTPSERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr<nsINntpIncomingServer> nntpServer;
  rv = GetNntpServer(getter_AddRefs(nntpServer));
  if (NS_FAILED(rv)) return rv;

  nsCOMPtr <nsIURI> resultUri;
  rv = nntpService->GetNewNews(nntpServer, mURI.get(), aGetOld, this,
                               aMsgWindow, getter_AddRefs(resultUri));
  if (aUrlListener && NS_SUCCEEDED(rv) && resultUri)
  {
    nsCOMPtr<nsIMsgMailNewsUrl> msgUrl (do_QueryInterface(resultUri));
    if (msgUrl)
      msgUrl->RegisterListener(aUrlListener);
  }
  return rv;
}

nsresult
nsMsgNewsFolder::LoadNewsrcFileAndCreateNewsgroups()
{
  nsresult rv = NS_OK;
  if (!mNewsrcFilePath) return NS_ERROR_FAILURE;

  bool exists;
  rv = mNewsrcFilePath->Exists(&exists);
  if (NS_FAILED(rv)) return rv;

  if (!exists)
    // it is ok for the newsrc file to not exist yet
    return NS_OK;

  nsCOMPtr<nsIInputStream> fileStream;
  rv = NS_NewLocalFileInputStream(getter_AddRefs(fileStream), mNewsrcFilePath);
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
    HandleNewsrcLine(line.get(), line.Length());
  }

  fileStream->Close();
  return rv;
}

int32_t
nsMsgNewsFolder::HandleNewsrcLine(const char * line, uint32_t line_size)
{
  nsresult rv;

  /* guard against blank line lossage */
  if (line[0] == '#' || line[0] == '\r' || line[0] == '\n') return 0;

  if ((line[0] == 'o' || line[0] == 'O') &&
    !PL_strncasecmp (line, "options", 7))
    return RememberLine(nsDependentCString(line));

  const char *s = nullptr;
  const char *setStr = nullptr;
  const char *end = line + line_size;

  for (s = line; s < end;  s++)
    if ((*s == ':') || (*s == '!'))
      break;

    if (*s == 0)
      /* What is this?? Well, don't just throw it away... */
      return RememberLine(nsDependentCString(line));

    bool subscribed = (*s == ':');
    setStr = s+1;

    if (*line == '\0')
      return 0;

  // previous versions of Communicator poluted the
  // newsrc files with articles
  // (this would happen when you clicked on a link like
  // news://news.mozilla.org/3746EF3F.6080309@netscape.com)
  //
  // legal newsgroup names can't contain @ or %
  //
  // News group names are structured into parts separated by dots,
  // for example "netscape.public.mozilla.mail-news".
  // Each part may be up to 14 characters long, and should consist
  // only of letters, digits, "+" and "-", with at least one letter
  //
  // @ indicates an article and %40 is @ escaped.
  // previous versions of Communicator also dumped
  // the escaped version into the newsrc file
  //
  // So lines like this in a newsrc file should be ignored:
  // 3746EF3F.6080309@netscape.com:
  // 3746EF3F.6080309%40netscape.com:
  if (PL_strchr(line, '@') || PL_strstr(line, "%40"))
    // skipping, it contains @ or %40
    subscribed = false;

  if (subscribed)
  {
    // we're subscribed, so add it
    nsCOMPtr <nsIMsgFolder> child;

    rv = AddNewsgroup(Substring(line, s), nsDependentCString(setStr), getter_AddRefs(child));
    if (NS_FAILED(rv)) return -1;
  }
  else {
    rv = RememberUnsubscribedGroup(nsDependentCString(line), nsDependentCString(setStr));
    if (NS_FAILED(rv)) return -1;
  }

  return 0;
}


nsresult
nsMsgNewsFolder::RememberUnsubscribedGroup(const nsACString& newsgroup, const nsACString& setStr)
{
  mUnsubscribedNewsgroupLines.Append(newsgroup);
  mUnsubscribedNewsgroupLines.AppendLiteral("! ");
  if (!setStr.IsEmpty())
    mUnsubscribedNewsgroupLines.Append(setStr);
  else
    mUnsubscribedNewsgroupLines.Append(MSG_LINEBREAK);
  return NS_OK;
}

int32_t
nsMsgNewsFolder::RememberLine(const nsACString& line)
{
  mOptionLines = line;
  mOptionLines.Append(MSG_LINEBREAK);
  return 0;
}

nsresult nsMsgNewsFolder::ForgetLine()
{
  mOptionLines.Truncate();
  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::GetGroupUsername(nsACString& aGroupUsername)
{
  aGroupUsername = mGroupUsername;
  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::SetGroupUsername(const nsACString& aGroupUsername)
{
  mGroupUsername = aGroupUsername;
  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::GetGroupPassword(nsACString& aGroupPassword)
{
  aGroupPassword = mGroupPassword;
  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::SetGroupPassword(const nsACString& aGroupPassword)
{
  mGroupPassword = aGroupPassword;
  return NS_OK;
}

nsresult nsMsgNewsFolder::CreateNewsgroupUrlForSignon(const char *ref,
    nsAString &result)
{
  nsresult rv;
  nsCOMPtr<nsIURL> url = do_CreateInstance(NS_STANDARDURL_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr<nsIMsgIncomingServer> server;
  rv = GetServer(getter_AddRefs(server));
  if (NS_FAILED(rv)) return rv;

  nsCOMPtr<nsINntpIncomingServer> nntpServer;
  rv = GetNntpServer(getter_AddRefs(nntpServer));
  if (NS_FAILED(rv)) return rv;

  bool singleSignon = true;
  rv = nntpServer->GetSingleSignon(&singleSignon);

  if (singleSignon)
  {
    nsCString serverURI;
    rv = server->GetServerURI(serverURI);
    NS_ENSURE_SUCCESS(rv, rv);

    rv = url->SetSpec(serverURI);
    NS_ENSURE_SUCCESS(rv, rv);
  }
  else
  {
    rv = url->SetSpec(mURI);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  int32_t port = 0;
  rv = url->GetPort(&port);
  NS_ENSURE_SUCCESS(rv, rv);

  if (port <= 0)
  {
    nsCOMPtr<nsIMsgIncomingServer> server;
    rv = GetServer(getter_AddRefs(server));
    NS_ENSURE_SUCCESS(rv, rv);

    int32_t socketType;
    nsresult rv = server->GetSocketType(&socketType);
    NS_ENSURE_SUCCESS(rv, rv);

    // Only set this for ssl newsgroups as for non-ssl connections, we don't
    // need to specify the port as it is the default for the protocol and
    // password manager "blanks" those out.
    if (socketType == nsMsgSocketType::SSL)
    {
      rv = url->SetPort(nsINntpUrl::DEFAULT_NNTPS_PORT);
      NS_ENSURE_SUCCESS(rv, rv);
    }
  }

  nsCString rawResult;
  if (ref)
  {
    rv = url->SetRef(nsDependentCString(ref));
    NS_ENSURE_SUCCESS(rv, rv);

    rv = url->GetSpec(rawResult);
    NS_ENSURE_SUCCESS(rv, rv);
  }
  else
  {
    // If the url doesn't have a path, make sure we don't get a '/' on the end
    // as that will confuse searching in password manager.
    nsCString spec;
    rv = url->GetSpec(spec);
    NS_ENSURE_SUCCESS(rv, rv);

    if (!spec.IsEmpty() && spec[spec.Length() - 1] == '/')
      rawResult = StringHead(spec, spec.Length() - 1);
    else
      rawResult = spec;
  }
  result = NS_ConvertASCIItoUTF16(rawResult);
  return NS_OK;
}

NS_IMETHODIMP
nsMsgNewsFolder::MigrateLegacyCredentials()
{
  // The original ways that authentication credentials were stored was rather
  // complicated and messy. We used separate URLs as the "HTTP realm" field to
  // permit prompting for username and password as separate dialogs. In this
  // method, we check for this, and store them in the new unified credentials
  // dialog.

  // Create the URLs that the login manager needs
  nsString signonUrl;
  nsresult rv = CreateNewsgroupUrlForSignon(nullptr, signonUrl);
  NS_ENSURE_SUCCESS(rv, rv);

  nsString usernameUrl;
  rv = CreateNewsgroupUrlForSignon("username", usernameUrl);
  NS_ENSURE_SUCCESS(rv, rv);

  nsString passwordUrl;
  rv = CreateNewsgroupUrlForSignon("password", passwordUrl);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsILoginManager> loginMgr =
    do_GetService(NS_LOGINMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  // Grab out the saved username
  uint32_t count = 0;
  nsILoginInfo **logins = nullptr;
  rv = loginMgr->FindLogins(&count, signonUrl, EmptyString(), usernameUrl,
    &logins);
  NS_ENSURE_SUCCESS(rv, rv);
  NS_ASSERTION(count <= 1, "Too many usernames?");

  nsString username;
  if (count > 0)
  {
    rv = logins[0]->GetPassword(username);
    // Remove the saved login
    loginMgr->RemoveLogin(logins[0]);
  }

  NS_FREE_XPCOM_ISUPPORTS_POINTER_ARRAY(count, logins);
  NS_ENSURE_SUCCESS(rv, rv);

  // Do the same things for the password
  rv = loginMgr->FindLogins(&count, signonUrl, EmptyString(), passwordUrl,
                            &logins);
  NS_ENSURE_SUCCESS(rv, rv);
  NS_ASSERTION(count <= 1, "Too many passwords?");

  nsString password;
  if (count > 0)
  {
    rv = logins[0]->GetPassword(password);
    loginMgr->RemoveLogin(logins[0]);
  }
  NS_FREE_XPCOM_ISUPPORTS_POINTER_ARRAY(count, logins);
  NS_ENSURE_SUCCESS(rv, rv);

  // If there is nothing to migrate, then do nothing
  if (username.IsEmpty() && password.IsEmpty())
    return NS_OK;

  // Make and add the new logon
  nsCOMPtr<nsILoginInfo> newLogin = do_CreateInstance(NS_LOGININFO_CONTRACTID);
  // We need to pass in JS equivalent to "null"; empty ("") isn't good enough
  nsString voidString;
  voidString.SetIsVoid(true);
  newLogin->Init(signonUrl, voidString, signonUrl, username, password,
    EmptyString(), EmptyString());
  return loginMgr->AddLogin(newLogin);
}

NS_IMETHODIMP
nsMsgNewsFolder::GetAuthenticationCredentials(nsIMsgWindow *aMsgWindow,
    bool mayPrompt, bool mustPrompt, bool *validCredentials)
{
  // Not strictly necessary, but it would help consumers to realize that this is
  // a rather nonsensical combination.
  NS_ENSURE_FALSE(mustPrompt && !mayPrompt, NS_ERROR_INVALID_ARG);
  NS_ENSURE_ARG_POINTER(validCredentials);

  nsCOMPtr<nsIStringBundleService> bundleService =
    mozilla::services::GetStringBundleService();
  NS_ENSURE_TRUE(bundleService, NS_ERROR_UNEXPECTED);

  nsresult rv;
  nsCOMPtr<nsIStringBundle> bundle;
  rv = bundleService->CreateBundle(NEWS_MSGS_URL, getter_AddRefs(bundle));
  NS_ENSURE_SUCCESS(rv, rv);

  nsString signonUrl;
  rv = CreateNewsgroupUrlForSignon(nullptr, signonUrl);
  NS_ENSURE_SUCCESS(rv, rv);

  // If we don't have a username or password, try to load it via the login mgr.
  // Do this even if mustPrompt is true, to prefill the dialog.
  if (mGroupUsername.IsEmpty() || mGroupPassword.IsEmpty())
  {
    nsCOMPtr<nsILoginManager> loginMgr =
      do_GetService(NS_LOGINMANAGER_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    uint32_t numLogins = 0;
    nsILoginInfo **logins = nullptr;
    rv = loginMgr->FindLogins(&numLogins, signonUrl, EmptyString(), signonUrl,
      &logins);
    NS_ENSURE_SUCCESS(rv, rv);

    if (numLogins > 0)
    {
      nsString uniUsername, uniPassword;
      logins[0]->GetUsername(uniUsername);
      logins[0]->GetPassword(uniPassword);
      mGroupUsername = NS_LossyConvertUTF16toASCII(uniUsername);
      mGroupPassword = NS_LossyConvertUTF16toASCII(uniPassword);

      *validCredentials = true;
    }
    NS_FREE_XPCOM_ISUPPORTS_POINTER_ARRAY(numLogins, logins);
  }

  // Show the prompt if we need to
  if (mustPrompt ||
      (mayPrompt && (mGroupUsername.IsEmpty() || mGroupPassword.IsEmpty())))
  {
    nsCOMPtr<nsIAuthPrompt> dialog;
    if (aMsgWindow)
    {
      rv = aMsgWindow->GetAuthPrompt(getter_AddRefs(dialog));
      NS_ENSURE_SUCCESS(rv, rv);
    }
    else
    {
      nsCOMPtr<nsIWindowWatcher> wwatch(do_GetService(NS_WINDOWWATCHER_CONTRACTID));
      if (wwatch)
        wwatch->GetNewAuthPrompter(0, getter_AddRefs(dialog));
      if (!dialog) return NS_ERROR_FAILURE;
    }

    NS_ASSERTION(dialog, "We didn't get a net prompt");
    if (dialog)
    {
      // Format the prompt text strings
      nsString promptTitle, promptText;
      bundle->GetStringFromName(NS_LITERAL_STRING("enterUserPassTitle").get(),
        getter_Copies(promptTitle));

      nsString serverName;
      nsCOMPtr<nsIMsgIncomingServer> server;
      rv = GetServer(getter_AddRefs(server));
      NS_ENSURE_SUCCESS(rv, rv);

      server->GetPrettyName(serverName);

      nsCOMPtr<nsINntpIncomingServer> nntpServer;
      rv = GetNntpServer(getter_AddRefs(nntpServer));
      NS_ENSURE_SUCCESS(rv, rv);

      bool singleSignon = true;
      nntpServer->GetSingleSignon(&singleSignon);

      const PRUnichar *params[2];
      params[0] = mName.get();
      params[1] = serverName.get();
      if (singleSignon)
        bundle->FormatStringFromName(
          NS_LITERAL_STRING("enterUserPassServer").get(),
          &params[1], 1, getter_Copies(promptText));
      else
        bundle->FormatStringFromName(
          NS_LITERAL_STRING("enterUserPassGroup").get(),
          params, 2, getter_Copies(promptText));

      // Fill the signon url for the dialog
      nsString signonURL;
      rv = CreateNewsgroupUrlForSignon(nullptr, signonURL);
      NS_ENSURE_SUCCESS(rv, rv);

      // Prefill saved username/password
      PRUnichar *uniGroupUsername = ToNewUnicode(
        NS_ConvertASCIItoUTF16(mGroupUsername));
      PRUnichar *uniGroupPassword = ToNewUnicode(
        NS_ConvertASCIItoUTF16(mGroupPassword));

      // Prompt for the dialog
      rv = dialog->PromptUsernameAndPassword(promptTitle.get(),
        promptText.get(), signonURL.get(),
        nsIAuthPrompt::SAVE_PASSWORD_PERMANENTLY,
        &uniGroupUsername, &uniGroupPassword, validCredentials);

      nsAutoString uniPasswordAdopted, uniUsernameAdopted;
      uniPasswordAdopted.Adopt(uniGroupPassword);
      uniUsernameAdopted.Adopt(uniGroupUsername);
      NS_ENSURE_SUCCESS(rv, rv);

      // Only use the username/password if the user didn't cancel.
      if (*validCredentials)
      {
        SetGroupUsername(NS_LossyConvertUTF16toASCII(uniUsernameAdopted));
        SetGroupPassword(NS_LossyConvertUTF16toASCII(uniPasswordAdopted));
      }
      else
      {
        mGroupUsername.Truncate();
        mGroupPassword.Truncate();
      }
    }
  }
  
  *validCredentials = !(mGroupUsername.IsEmpty() || mGroupPassword.IsEmpty());
  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::ForgetAuthenticationCredentials()
{
  nsString signonUrl;
  nsresult rv = CreateNewsgroupUrlForSignon(nullptr, signonUrl);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsILoginManager> loginMgr =
    do_GetService(NS_LOGINMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  uint32_t count;
  nsILoginInfo** logins;

  rv = loginMgr->FindLogins(&count, signonUrl, EmptyString(), signonUrl,
    &logins);
  NS_ENSURE_SUCCESS(rv, rv);

  // There should only be one-login stored for this url, however just in case
  // there isn't.
  for (uint32_t i = 0; i < count; ++i)
    loginMgr->RemoveLogin(logins[i]);
  NS_FREE_XPCOM_ISUPPORTS_POINTER_ARRAY(count, logins);

  // Clear out the saved passwords for anyone else who tries to call.
  mGroupUsername.Truncate();
  mGroupPassword.Truncate();

  return NS_OK;
}

// change order of subfolders (newsgroups)
// aOrientation = -1 ... aNewsgroupToMove aRefNewsgroup ...
// aOrientation =  1 ... aRefNewsgroup aNewsgroupToMove ...
NS_IMETHODIMP nsMsgNewsFolder::MoveFolder(nsIMsgFolder *aNewsgroupToMove, nsIMsgFolder *aRefNewsgroup, int32_t aOrientation)
{
  // if folders are identical do nothing
  if (aNewsgroupToMove == aRefNewsgroup)
    return NS_OK;

  nsresult rv = NS_OK;

  // get index for aNewsgroupToMove
  int32_t indexNewsgroupToMove = mSubFolders.IndexOf(aNewsgroupToMove);
  if (indexNewsgroupToMove == -1)
    // aNewsgroupToMove is no subfolder of this folder
    return NS_ERROR_INVALID_ARG;

  // get index for aRefNewsgroup
  int32_t indexRefNewsgroup = mSubFolders.IndexOf(aRefNewsgroup);
  if (indexRefNewsgroup == -1)
    // aRefNewsgroup is no subfolder of this folder
    return NS_ERROR_INVALID_ARG;

  // set new index for NewsgroupToMove
  uint32_t indexMin, indexMax;
  if (indexNewsgroupToMove < indexRefNewsgroup)
  {
    if (aOrientation < 0)
      indexRefNewsgroup--;
    indexMin = indexNewsgroupToMove;
    indexMax = indexRefNewsgroup;
  }
  else
  {
    if (aOrientation > 0)
      indexRefNewsgroup++;
    indexMin = indexRefNewsgroup;
    indexMax = indexNewsgroupToMove; 
  }

  // move NewsgroupToMove to new index and set new sort order
  NotifyItemRemoved(aNewsgroupToMove);

  if (indexNewsgroupToMove != indexRefNewsgroup)
  {
    nsCOMPtr<nsIMsgFolder> newsgroup = mSubFolders[indexNewsgroupToMove];

    mSubFolders.RemoveObjectAt(indexNewsgroupToMove);

    // indexRefNewsgroup is already set up correctly.
    mSubFolders.InsertObjectAt(newsgroup, indexRefNewsgroup);
  }
  
  for (uint32_t i = indexMin; i <= indexMax; i++)
    mSubFolders[i]->SetSortOrder(kNewsSortOffset + i);

  NotifyItemAdded(aNewsgroupToMove);  

  // write changes back to file
  nsCOMPtr<nsINntpIncomingServer> nntpServer;
  rv = GetNntpServer(getter_AddRefs(nntpServer));
  NS_ENSURE_SUCCESS(rv,rv);

  rv = nntpServer->SetNewsrcHasChanged(true);
  NS_ENSURE_SUCCESS(rv,rv);

  rv = nntpServer->WriteNewsrcFile();
  NS_ENSURE_SUCCESS(rv,rv);

  return rv;
}

nsresult nsMsgNewsFolder::CreateBaseMessageURI(const nsACString& aURI)
{
  return nsCreateNewsBaseMessageURI(nsCString(aURI).get(), mBaseMessageURI);
}

NS_IMETHODIMP
nsMsgNewsFolder::GetNewsrcLine(nsACString& newsrcLine)
{
  nsresult rv;
  nsString newsgroupNameUtf16;
  rv = GetName(newsgroupNameUtf16);
  if (NS_FAILED(rv)) return rv;
  NS_ConvertUTF16toUTF8 newsgroupName(newsgroupNameUtf16);

  newsrcLine = newsgroupName;
  newsrcLine.Append(':');

  if (mReadSet) {
    nsCString setStr;
    mReadSet->Output(getter_Copies(setStr));
    if (NS_SUCCEEDED(rv))
    {
      newsrcLine.Append(' ');
      newsrcLine.Append(setStr);
      newsrcLine.AppendLiteral(MSG_LINEBREAK);
    }
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::SetReadSetFromStr(const nsACString& newsrcLine)
{
  delete mReadSet;
  mReadSet = nsMsgKeySet::Create(nsCString(newsrcLine).get());
  NS_ENSURE_TRUE(mReadSet, NS_ERROR_OUT_OF_MEMORY);

  // Now that mReadSet is recreated, make sure it's stored in the db as well.
  nsCOMPtr<nsINewsDatabase> db = do_QueryInterface(mDatabase);
  if (db) // it's ok not to have a db here.
    db->SetReadSet(mReadSet);
  return NS_OK;
}

NS_IMETHODIMP
nsMsgNewsFolder::GetUnsubscribedNewsgroupLines(nsACString& aUnsubscribedNewsgroupLines)
{
  aUnsubscribedNewsgroupLines = mUnsubscribedNewsgroupLines;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgNewsFolder::GetOptionLines(nsACString& optionLines)
{
  optionLines = mOptionLines;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgNewsFolder::OnReadChanged(nsIDBChangeListener * aInstigator)
{
  return SetNewsrcHasChanged(true);
}

NS_IMETHODIMP
nsMsgNewsFolder::GetUnicodeName(nsAString& aName)
{
  return GetName(aName);
}

NS_IMETHODIMP
nsMsgNewsFolder::GetRawName(nsACString & aRawName)
{
  nsresult rv;
  if (mRawName.IsEmpty())
  {
    nsString name;
    rv = GetName(name);
    NS_ENSURE_SUCCESS(rv,rv);

    // convert to the server-side encoding
    nsCOMPtr <nsINntpIncomingServer> nntpServer;
    rv = GetNntpServer(getter_AddRefs(nntpServer));
    NS_ENSURE_SUCCESS(rv,rv);

    nsAutoCString dataCharset;
    rv = nntpServer->GetCharset(dataCharset);
    NS_ENSURE_SUCCESS(rv,rv);
    rv = nsMsgI18NConvertFromUnicode(dataCharset.get(), name, mRawName);

    if (NS_FAILED(rv))
      LossyCopyUTF16toASCII(name, mRawName);
  }
  aRawName = mRawName;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgNewsFolder::GetNntpServer(nsINntpIncomingServer **result)
{
  nsresult rv;
  NS_ENSURE_ARG_POINTER(result);

  nsCOMPtr<nsIMsgIncomingServer> server;
  rv = GetServer(getter_AddRefs(server));
  if (NS_FAILED(rv))
    return rv;

  nsCOMPtr<nsINntpIncomingServer> nntpServer;
  rv = server->QueryInterface(NS_GET_IID(nsINntpIncomingServer),
                              getter_AddRefs(nntpServer));
  if (NS_FAILED(rv))
    return rv;
  nntpServer.swap(*result);
  return NS_OK;
}

// this gets called after the message actually gets cancelled
// it removes the cancelled message from the db
NS_IMETHODIMP nsMsgNewsFolder::RemoveMessage(nsMsgKey key)
{
  nsresult rv = GetDatabase();
  NS_ENSURE_SUCCESS(rv, rv); // if GetDatabase succeeds, mDatabase will be non-null

  // Notify listeners of a delete for a single message
  nsCOMPtr<nsIMsgFolderNotificationService> notifier(do_GetService(NS_MSGNOTIFICATIONSERVICE_CONTRACTID));
  if (notifier)
  {
    nsCOMPtr<nsIMsgDBHdr> msgHdr;
    rv = mDatabase->GetMsgHdrForKey(key, getter_AddRefs(msgHdr));
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIMutableArray> msgHdrs(do_CreateInstance(NS_ARRAY_CONTRACTID));
    msgHdrs->AppendElement(msgHdr, false);

    notifier->NotifyMsgsDeleted(msgHdrs);
  }
  return mDatabase->DeleteMessage(key, nullptr, false);
}

NS_IMETHODIMP nsMsgNewsFolder::RemoveMessages(nsTArray<nsMsgKey> &aMsgKeys)
{
  nsresult rv = GetDatabase();
  NS_ENSURE_SUCCESS(rv, rv); // if GetDatabase succeeds, mDatabase will be non-null

  // Notify listeners of a multiple message delete
  nsCOMPtr<nsIMsgFolderNotificationService> notifier(do_GetService(NS_MSGNOTIFICATIONSERVICE_CONTRACTID));

  if (notifier)
  {
    nsCOMPtr<nsIMutableArray> msgHdrs(do_CreateInstance(NS_ARRAY_CONTRACTID));
    rv = MsgGetHeadersFromKeys(mDatabase, aMsgKeys, msgHdrs);
    NS_ENSURE_SUCCESS(rv, rv);

    notifier->NotifyMsgsDeleted(msgHdrs);
  }

  return mDatabase->DeleteMessages(aMsgKeys.Length(), aMsgKeys.Elements(), nullptr);
}

NS_IMETHODIMP nsMsgNewsFolder::CancelComplete()
{
  NotifyFolderEvent(mDeleteOrMoveMsgCompletedAtom);
  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::CancelFailed()
{
  NotifyFolderEvent(mDeleteOrMoveMsgFailedAtom);
  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::GetSaveArticleOffline(bool *aBool)
{
  NS_ENSURE_ARG(aBool);
  *aBool = m_downloadMessageForOfflineUse;
  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::SetSaveArticleOffline(bool aBool)
{
  m_downloadMessageForOfflineUse = aBool;
  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::DownloadAllForOffline(nsIUrlListener *listener, nsIMsgWindow *msgWindow)
{
  nsTArray<nsMsgKey> srcKeyArray;
  SetSaveArticleOffline(true);
  nsresult rv = NS_OK;

  // build up message keys.
  if (mDatabase)
  {
    nsCOMPtr <nsISimpleEnumerator> enumerator;
    rv = mDatabase->EnumerateMessages(getter_AddRefs(enumerator));
    if (NS_SUCCEEDED(rv) && enumerator)
    {
      bool hasMore;
      while (NS_SUCCEEDED(rv = enumerator->HasMoreElements(&hasMore)) && hasMore)
      {
        nsCOMPtr <nsIMsgDBHdr> pHeader;
        rv = enumerator->GetNext(getter_AddRefs(pHeader));
        NS_ASSERTION(NS_SUCCEEDED(rv), "nsMsgDBEnumerator broken");
        if (pHeader && NS_SUCCEEDED(rv))
        {
          bool shouldStoreMsgOffline = false;
          nsMsgKey msgKey;
          pHeader->GetMessageKey(&msgKey);
          MsgFitsDownloadCriteria(msgKey, &shouldStoreMsgOffline);
          if (shouldStoreMsgOffline)
            srcKeyArray.AppendElement(msgKey);
        }
      }
    }
  }
  DownloadNewsArticlesToOfflineStore *downloadState = new DownloadNewsArticlesToOfflineStore(msgWindow, mDatabase, this);
  if (!downloadState)
    return NS_ERROR_OUT_OF_MEMORY;
  m_downloadingMultipleMessages = true;
  rv = downloadState->DownloadArticles(msgWindow, this, &srcKeyArray);
  (void) RefreshSizeOnDisk();
  return rv;
}

NS_IMETHODIMP nsMsgNewsFolder::DownloadMessagesForOffline(nsIArray *messages, nsIMsgWindow *window)
{
  nsTArray<nsMsgKey> srcKeyArray;
  SetSaveArticleOffline(true); // ### TODO need to clear this when we've finished
  uint32_t count = 0;
  uint32_t i;
  nsresult rv = messages->GetLength(&count);
  NS_ENSURE_SUCCESS(rv, rv);

  // build up message keys.
  for (i = 0; i < count; i++)
  {
    nsMsgKey key;
    nsCOMPtr <nsIMsgDBHdr> msgDBHdr = do_QueryElementAt(messages, i, &rv);
    if (msgDBHdr)
      rv = msgDBHdr->GetMessageKey(&key);
    if (NS_SUCCEEDED(rv))
      srcKeyArray.AppendElement(key);
  }
  DownloadNewsArticlesToOfflineStore *downloadState = new DownloadNewsArticlesToOfflineStore(window, mDatabase, this);
  if (!downloadState)
    return NS_ERROR_OUT_OF_MEMORY;
  m_downloadingMultipleMessages = true;

  rv = downloadState->DownloadArticles(window, this, &srcKeyArray);
  (void) RefreshSizeOnDisk();
  return rv;
}

// line does not have a line terminator (e.g., CR or CRLF)
NS_IMETHODIMP nsMsgNewsFolder::NotifyDownloadedLine(const char *line, nsMsgKey keyOfArticle)
{
  nsresult rv = NS_OK;
  if (m_downloadMessageForOfflineUse)
  {
    if (!m_offlineHeader)
    {
      GetMessageHeader(keyOfArticle, getter_AddRefs(m_offlineHeader));
      rv = StartNewOfflineMessage();
    }
    m_numOfflineMsgLines++;
  }

  if (m_tempMessageStream)
  {
    // line now contains the linebreak.
    if (line[0] == '.' && line[MSG_LINEBREAK_LEN + 1] == 0)
    {
      // end of article.
      if (m_offlineHeader)
        EndNewOfflineMessage();

      if (m_tempMessageStream && !m_downloadingMultipleMessages)
      {
        m_tempMessageStream->Close();
        m_tempMessageStream = nullptr;
      }
    }
    else
    {
      uint32_t count = 0;
      rv = m_tempMessageStream->Write(line, strlen(line), &count);
    }
  }

  return rv;
}

NS_IMETHODIMP nsMsgNewsFolder::NotifyFinishedDownloadinghdrs()
{
  bool wasCached = !!mDatabase;
  ChangeNumPendingTotalMessages(-GetNumPendingTotalMessages());
  ChangeNumPendingUnread(-GetNumPendingUnread());
  bool filtersRun;
  // run the bayesian spam filters, if enabled.
  CallFilterPlugins(nullptr, &filtersRun);

  // If the DB was not open before, close our reference to it now.
  if (!wasCached && mDatabase)
  {
    mDatabase->Commit(nsMsgDBCommitType::kLargeCommit);
    mDatabase->RemoveListener(this);
    // This also clears all of the cached headers that may have been added while
    // we were downloading messages (and those clearing refcount cycles in the
    // database).
    mDatabase->ClearCachedHdrs();
    mDatabase = nullptr;
  }

  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::Compact(nsIUrlListener *aListener, nsIMsgWindow *aMsgWindow)
{
  nsresult rv;
  rv = GetDatabase();
  if (mDatabase)
    ApplyRetentionSettings();
  (void) RefreshSizeOnDisk();
  return rv;
}

NS_IMETHODIMP
nsMsgNewsFolder::ApplyRetentionSettings()
{
  return nsMsgDBFolder::ApplyRetentionSettings(false);
}

NS_IMETHODIMP nsMsgNewsFolder::GetMessageIdForKey(nsMsgKey key, nsACString& result)
{
  nsresult rv = GetDatabase();
  if (!mDatabase)
    return rv;
  nsCOMPtr <nsIMsgDBHdr> hdr;
  rv = mDatabase->GetMsgHdrForKey(key, getter_AddRefs(hdr));
  NS_ENSURE_SUCCESS(rv,rv);
  nsCString id;
  rv = hdr->GetMessageId(getter_Copies(id));
  result.Assign(id);
  return rv;
}

NS_IMETHODIMP nsMsgNewsFolder::SetSortOrder(int32_t order)
{
  int32_t oldOrder = mSortOrder;
  
  mSortOrder = order;
  nsCOMPtr<nsIAtom> sortOrderAtom = MsgGetAtom("SortOrder");
  // What to do if the atom can't be allocated?
  NotifyIntPropertyChanged(sortOrderAtom, oldOrder, order);
  
  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::GetSortOrder(int32_t *order)
{
  NS_ENSURE_ARG_POINTER(order);
  *order = mSortOrder;
  return NS_OK;
}

NS_IMETHODIMP nsMsgNewsFolder::Shutdown(bool shutdownChildren)
{
  if (mFilterList)
  {
    // close the filter log stream
    nsresult rv = mFilterList->SetLogStream(nullptr);
    NS_ENSURE_SUCCESS(rv,rv);
    mFilterList = nullptr;
  }

  mInitialized = false;
  if (mReadSet) {
    // the nsINewsDatabase holds a weak ref to the readset,
    // and we outlive the db, so it's safe to delete it here.
    nsCOMPtr<nsINewsDatabase> db = do_QueryInterface(mDatabase);
    if (db)
      db->SetReadSet(nullptr);
    delete mReadSet;
    mReadSet = nullptr;
  }
  return nsMsgDBFolder::Shutdown(shutdownChildren);
}

NS_IMETHODIMP
nsMsgNewsFolder::SetFilterList(nsIMsgFilterList *aFilterList)
{
  if (mIsServer)
  {
    nsCOMPtr<nsIMsgIncomingServer> server;
    nsresult rv = GetServer(getter_AddRefs(server));
    NS_ENSURE_SUCCESS(rv,rv);
    return server->SetFilterList(aFilterList);
  }

  mFilterList = aFilterList;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgNewsFolder::GetFilterList(nsIMsgWindow *aMsgWindow, nsIMsgFilterList **aResult)
{
  if (mIsServer)
  {
    nsCOMPtr<nsIMsgIncomingServer> server;
    nsresult rv = GetServer(getter_AddRefs(server));
    NS_ENSURE_SUCCESS(rv,rv);
    return server->GetFilterList(aMsgWindow, aResult);
  }

  if (!mFilterList)
  {
    nsCOMPtr<nsIFile> thisFolder;
    nsresult rv = GetFilePath(getter_AddRefs(thisFolder));
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr <nsIFile> filterFile = do_CreateInstance(NS_LOCAL_FILE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);;
    rv = filterFile->InitWithFile(thisFolder);
    NS_ENSURE_SUCCESS(rv, rv);

    // in 4.x, the news filter file was
    // C:\Program Files\Netscape\Users\meer\News\host-news.mcom.com\mcom.test.dat
    // where the summary file was
    // C:\Program Files\Netscape\Users\meer\News\host-news.mcom.com\mcom.test.snm
    // we make the rules file ".dat" in mozilla, so that migration works.

    // NOTE:
    // we don't we need to call NS_MsgHashIfNecessary()
    // it's already been hashed, if necessary
    nsCString filterFileName;
    rv = filterFile->GetNativeLeafName(filterFileName);
    NS_ENSURE_SUCCESS(rv,rv);

    filterFileName.AppendLiteral(".dat");

    rv = filterFile->SetNativeLeafName(filterFileName);
    NS_ENSURE_SUCCESS(rv,rv);

    nsCOMPtr<nsIMsgFilterService> filterService =
      do_GetService(NS_MSGFILTERSERVICE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    rv = filterService->OpenFilterList(filterFile, this, aMsgWindow, getter_AddRefs(mFilterList));
    NS_ENSURE_SUCCESS(rv, rv);
  }

  NS_IF_ADDREF(*aResult = mFilterList);
  return NS_OK;
}

NS_IMETHODIMP
nsMsgNewsFolder::GetEditableFilterList(nsIMsgWindow *aMsgWindow, nsIMsgFilterList **aResult)
{
  // We don't support pluggable filter list types for news.
  return GetFilterList(aMsgWindow, aResult);
}

NS_IMETHODIMP
nsMsgNewsFolder::SetEditableFilterList(nsIMsgFilterList *aFilterList)
{
  return SetFilterList(aFilterList);
}

NS_IMETHODIMP
nsMsgNewsFolder::OnStopRunningUrl(nsIURI *aUrl, nsresult aExitCode)
{
 if (m_tempMessageStream)
  {
    m_tempMessageStream->Close();
    m_tempMessageStream = nullptr;
  }
  m_downloadingMultipleMessages = false;
  return nsMsgDBFolder::OnStopRunningUrl(aUrl, aExitCode);
}
