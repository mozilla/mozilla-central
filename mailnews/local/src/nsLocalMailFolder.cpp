/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "prlog.h"

#include "msgCore.h"    // precompiled header...
#include "nsArrayEnumerator.h"
#include "nsLocalMailFolder.h"
#include "nsMsgLocalFolderHdrs.h"
#include "nsMsgFolderFlags.h"
#include "nsMsgMessageFlags.h"
#include "prprf.h"
#include "prmem.h"
#include "nsIArray.h"
#include "nsIServiceManager.h"
#include "nsIMailboxService.h"
#include "nsParseMailbox.h"
#include "nsIMsgAccountManager.h"
#include "nsIMsgWindow.h"
#include "nsCOMPtr.h"
#include "nsIRDFService.h"
#include "nsMsgDBCID.h"
#include "nsMsgUtils.h"
#include "nsLocalUtils.h"
#include "nsIPop3IncomingServer.h"
#include "nsILocalMailIncomingServer.h"
#include "nsIMsgIncomingServer.h"
#include "nsMsgBaseCID.h"
#include "nsMsgLocalCID.h"
#include "nsStringGlue.h"
#include "nsIMsgFolderCacheElement.h"
#include "nsUnicharUtils.h"
#include "nsMsgUtils.h"
#include "nsICopyMsgStreamListener.h"
#include "nsIMsgCopyService.h"
#include "nsMsgTxn.h"
#include "nsIMessenger.h"
#include "nsMsgBaseCID.h"
#include "nsNativeCharsetUtils.h"
#include "nsIDocShell.h"
#include "nsIPrompt.h"
#include "nsIInterfaceRequestor.h"
#include "nsIInterfaceRequestorUtils.h"
#include "nsIPop3URL.h"
#include "nsIMsgMailSession.h"
#include "nsIMsgFolderCompactor.h"
#include "nsNetCID.h"
#include "nsIMsgMailNewsUrl.h"
#include "nsISpamSettings.h"
#include "nsINoIncomingServer.h"
#include "nsNativeCharsetUtils.h"
#include "nsMailHeaders.h"
#include "nsCOMArray.h"
#include "nsILineInputStream.h"
#include "nsIFileStreams.h"
#include "nsAutoPtr.h"
#include "nsIRssIncomingServer.h"
#include "nsNetUtil.h"
#include "nsIMsgFolderNotificationService.h"
#include "nsReadLine.h"
#include "nsArrayUtils.h"
#include "nsIMsgTraitService.h"
#include "nsIStringEnumerator.h"
#include "mozilla/Services.h"

//////////////////////////////////////////////////////////////////////////////
// nsLocal
/////////////////////////////////////////////////////////////////////////////

nsLocalMailCopyState::nsLocalMailCopyState() :
  m_flags(0),
  m_lastProgressTime(PR_IntervalToMilliseconds(PR_IntervalNow())),
  m_curDstKey(0xffffffff),
  m_curCopyIndex(0),
  m_totalMsgCount(0),
  m_dataBufferSize(0),
  m_leftOver(0),
  m_isMove(false),
  m_dummyEnvelopeNeeded(false),
  m_fromLineSeen(false),
  m_writeFailed(false),
  m_notifyFolderLoaded(false)
{
}

nsLocalMailCopyState::~nsLocalMailCopyState()
{
  PR_Free(m_dataBuffer);
  if (m_fileStream)
    m_fileStream->Close();
  if (m_messageService)
  {
    nsCOMPtr <nsIMsgFolder> srcFolder = do_QueryInterface(m_srcSupport);
    if (srcFolder && m_message)
    {
      nsCString uri;
      srcFolder->GetUriForMsg(m_message, uri);
    }
  }
}

nsLocalFolderScanState::nsLocalFolderScanState() : m_uidl(nullptr)
{
}

nsLocalFolderScanState::~nsLocalFolderScanState()
{
}

///////////////////////////////////////////////////////////////////////////////
// nsMsgLocalMailFolder interface
///////////////////////////////////////////////////////////////////////////////

nsMsgLocalMailFolder::nsMsgLocalMailFolder(void)
  : mCopyState(nullptr), mHaveReadNameFromDB(false),
    mInitialized(false),
    mCheckForNewMessagesAfterParsing(false), m_parsingFolder(false),
    mDownloadState(DOWNLOAD_STATE_NONE)
{
}

nsMsgLocalMailFolder::~nsMsgLocalMailFolder(void)
{
}

NS_IMPL_ISUPPORTS_INHERITED2(nsMsgLocalMailFolder,
                             nsMsgDBFolder,
                             nsICopyMessageListener,
                             nsIMsgLocalMailFolder)

////////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsMsgLocalMailFolder::Init(const char* aURI)
{
  return nsMsgDBFolder::Init(aURI);
}

nsresult nsMsgLocalMailFolder::CreateChildFromURI(const nsCString &uri, nsIMsgFolder **folder)
{
  nsMsgLocalMailFolder *newFolder = new nsMsgLocalMailFolder;
  if (!newFolder)
    return NS_ERROR_OUT_OF_MEMORY;

  NS_ADDREF(*folder = newFolder);
  newFolder->Init(uri.get());
  return NS_OK;
}

NS_IMETHODIMP nsMsgLocalMailFolder::CreateLocalSubfolder(const nsAString &aFolderName,
                                                         nsIMsgFolder **aChild)
{
  NS_ENSURE_ARG_POINTER(aChild);
  nsresult rv = CreateSubfolderInternal(aFolderName, nullptr, aChild);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIMsgFolderNotificationService> notifier(
    do_GetService(NS_MSGNOTIFICATIONSERVICE_CONTRACTID));
  if (notifier)
    notifier->NotifyFolderAdded(*aChild);

  return NS_OK;
}

NS_IMETHODIMP nsMsgLocalMailFolder::GetManyHeadersToDownload(bool *retval)
{
  bool isLocked;
  // if the folder is locked, we're probably reparsing - let's build the
  // view when we've finished reparsing.
  GetLocked(&isLocked);
  if (isLocked)
  {
    *retval = true;
    return NS_OK;
  }

  return nsMsgDBFolder::GetManyHeadersToDownload(retval);
}

//run the url to parse the mailbox
NS_IMETHODIMP nsMsgLocalMailFolder::ParseFolder(nsIMsgWindow *aMsgWindow,
                                                nsIUrlListener *aListener)
{
  nsCOMPtr<nsIMsgPluggableStore> msgStore;
  nsresult rv = GetMsgStore(getter_AddRefs(msgStore));
  NS_ENSURE_SUCCESS(rv, rv);
  if (aListener != this)
    mReparseListener = aListener;
  // if parsing is synchronous, we need to set m_parsingFolder to
  // true before starting. And we need to open the db before
  // setting m_parsingFolder to true.
//  OpenDatabase();
  rv = msgStore->RebuildIndex(this, mDatabase, aMsgWindow, this);
  if (NS_SUCCEEDED(rv))
    m_parsingFolder = true;
  return rv;
}

// this won't force a reparse of the folder if the db is invalid.
NS_IMETHODIMP
nsMsgLocalMailFolder::GetMsgDatabase(nsIMsgDatabase** aMsgDatabase)
{
  return GetDatabaseWOReparse(aMsgDatabase);
}

NS_IMETHODIMP
nsMsgLocalMailFolder::GetSubFolders(nsISimpleEnumerator **aResult)
{
  if (!mInitialized)
  {
    nsCOMPtr<nsIMsgIncomingServer> server;
    nsresult rv = GetServer(getter_AddRefs(server));
    NS_ENSURE_SUCCESS(rv, NS_MSG_INVALID_OR_MISSING_SERVER);
    nsCOMPtr<nsIMsgPluggableStore> msgStore;
    // need to set this flag here to avoid infinite recursion
    mInitialized = true;
    rv = server->GetMsgStore(getter_AddRefs(msgStore));
    NS_ENSURE_SUCCESS(rv, rv);
    // This should add all existing folders as sub-folders of this folder.
    rv = msgStore->DiscoverSubFolders(this, true);

    nsCOMPtr<nsIFile> path;
    rv = GetFilePath(getter_AddRefs(path));
    if (NS_FAILED(rv))
      return rv;

    bool directory;
    path->IsDirectory(&directory);
    if (directory)
    {
      SetFlag(nsMsgFolderFlags::Mail | nsMsgFolderFlags::Elided |
              nsMsgFolderFlags::Directory);

      bool isServer;
      GetIsServer(&isServer);
      if (isServer)
      {
        nsCOMPtr<nsIMsgIncomingServer> server;
        rv = GetServer(getter_AddRefs(server));
        NS_ENSURE_SUCCESS(rv, NS_MSG_INVALID_OR_MISSING_SERVER);

        nsCOMPtr<nsILocalMailIncomingServer> localMailServer;
        localMailServer = do_QueryInterface(server, &rv);
        NS_ENSURE_SUCCESS(rv, NS_MSG_INVALID_OR_MISSING_SERVER);

        // first create the folders on disk (as empty files)
        rv = localMailServer->CreateDefaultMailboxes();
        if (NS_FAILED(rv) && rv != NS_MSG_FOLDER_EXISTS)
          return rv;

        // must happen after CreateSubFolders, or the folders won't exist.
        rv = localMailServer->SetFlagsOnDefaultMailboxes();
        if (NS_FAILED(rv))
          return rv;
      }
    }
    UpdateSummaryTotals(false);
  }

  return aResult ? NS_NewArrayEnumerator(aResult, mSubFolders) : NS_ERROR_NULL_POINTER;
}

nsresult nsMsgLocalMailFolder::GetDatabase()
{
  nsCOMPtr <nsIMsgDatabase> msgDB;
  return GetDatabaseWOReparse(getter_AddRefs(msgDB));
}

//we treat failure as null db returned
NS_IMETHODIMP nsMsgLocalMailFolder::GetDatabaseWOReparse(nsIMsgDatabase **aDatabase)
{
  NS_ENSURE_ARG(aDatabase);
  if (m_parsingFolder)
    return NS_MSG_ERROR_FOLDER_SUMMARY_OUT_OF_DATE;

  nsresult rv = NS_OK;
  if (!mDatabase)
  {
    rv = OpenDatabase();
    if (mDatabase)
    {
      mDatabase->AddListener(this);
      UpdateNewMessages();
    }
  }
  NS_IF_ADDREF(*aDatabase = mDatabase);
  if (mDatabase)
    mDatabase->SetLastUseTime(PR_Now());
  return rv;
}


// Makes sure the database is open and exists.  If the database is out of date,
// then this call will run an async url to reparse the folder. The passed in
// url listener will get called when the url is done.
NS_IMETHODIMP nsMsgLocalMailFolder::GetDatabaseWithReparse(nsIUrlListener *aReparseUrlListener, nsIMsgWindow *aMsgWindow,
                                                           nsIMsgDatabase **aMsgDatabase)
{
  nsresult rv = NS_OK;
  // if we're already reparsing, just remember the listener so we can notify it
  // when we've finished.
  if (m_parsingFolder)
  {
    NS_ASSERTION(!mReparseListener, "can't have an existing listener");
    mReparseListener = aReparseUrlListener;
    return NS_MSG_ERROR_FOLDER_SUMMARY_OUT_OF_DATE;
  }

  if (!mDatabase)
  {
    nsCOMPtr <nsIFile> pathFile;
    rv = GetFilePath(getter_AddRefs(pathFile));
    if (NS_FAILED(rv))
      return rv;

    bool exists;
    rv = pathFile->Exists(&exists);
    NS_ENSURE_SUCCESS(rv,rv);
    if (!exists)
      return NS_ERROR_NULL_POINTER;  //mDatabase will be null at this point.

    nsCOMPtr<nsIMsgDBService> msgDBService = do_GetService(NS_MSGDB_SERVICE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    nsresult folderOpen = msgDBService->OpenFolderDB(this, true,
                                                     getter_AddRefs(mDatabase));
    if (folderOpen == NS_MSG_ERROR_FOLDER_SUMMARY_OUT_OF_DATE)
    {
      nsCOMPtr <nsIDBFolderInfo> dbFolderInfo;
      nsCOMPtr <nsIDBFolderInfo> transferInfo;
      if (mDatabase)
      {
        mDatabase->GetDBFolderInfo(getter_AddRefs(dbFolderInfo));
        if (dbFolderInfo)
        {
          dbFolderInfo->SetNumMessages(0);
          dbFolderInfo->SetNumUnreadMessages(0);
          dbFolderInfo->GetTransferInfo(getter_AddRefs(transferInfo));
        }
        dbFolderInfo = nullptr;

        // A backup message database might have been created earlier, for example
        // if the user requested a reindex. We'll use the earlier one if we can,
        // otherwise we'll try to backup at this point.
        if (NS_FAILED(OpenBackupMsgDatabase()))
        {
          CloseAndBackupFolderDB(EmptyCString());
          if (NS_FAILED(OpenBackupMsgDatabase()) && mBackupDatabase)
          {
            mBackupDatabase->RemoveListener(this);
            mBackupDatabase = nullptr;
          }
        }
        else
          mDatabase->ForceClosed();

        mDatabase = nullptr;
      }
      nsCOMPtr <nsIFile> summaryFile;
      rv = GetSummaryFileLocation(pathFile, getter_AddRefs(summaryFile));
      NS_ENSURE_SUCCESS(rv, rv);
      // Remove summary file.
      summaryFile->Remove(false);

      // if it's out of date then reopen with upgrade.
      rv = msgDBService->CreateNewDB(this, getter_AddRefs(mDatabase));
      NS_ENSURE_SUCCESS(rv, rv);

      if (transferInfo && mDatabase)
      {
        SetDBTransferInfo(transferInfo);
        mDatabase->SetSummaryValid(false);
      }
    }
    else if (folderOpen == NS_MSG_ERROR_FOLDER_SUMMARY_MISSING)
    {
      rv = msgDBService->CreateNewDB(this, getter_AddRefs(mDatabase));
    }

    if (mDatabase)
    {
      if (mAddListener)
        mDatabase->AddListener(this);

      // if we have to regenerate the folder, run the parser url.
      if (folderOpen == NS_MSG_ERROR_FOLDER_SUMMARY_MISSING ||
          folderOpen == NS_MSG_ERROR_FOLDER_SUMMARY_OUT_OF_DATE)
      {
        if (NS_FAILED(rv = ParseFolder(aMsgWindow, aReparseUrlListener)))
        {
          if (rv == NS_MSG_FOLDER_BUSY)
          {
            mDatabase->RemoveListener(this);  //we need to null out the db so that parsing gets kicked off again.
            mDatabase = nullptr;
            ThrowAlertMsg("parsingFolderFailed", aMsgWindow);
          }
          return rv;
        }

        return NS_ERROR_NOT_INITIALIZED;
      }

      // We have a valid database so lets extract necessary info.
      UpdateSummaryTotals(true);
    }
  }
  NS_IF_ADDREF(*aMsgDatabase = mDatabase);
  return rv;
}

NS_IMETHODIMP
nsMsgLocalMailFolder::UpdateFolder(nsIMsgWindow *aWindow)
{
  (void) RefreshSizeOnDisk();
  nsresult rv;

  if (!PromptForMasterPasswordIfNecessary())
    return NS_ERROR_FAILURE;

  //If we don't currently have a database, get it.  Otherwise, the folder has been updated (presumably this
  //changes when we download headers when opening inbox).  If it's updated, send NotifyFolderLoaded.
  if (!mDatabase)
  {
    // return of NS_ERROR_NOT_INITIALIZED means running parsing URL
    rv = GetDatabaseWithReparse(this, aWindow, getter_AddRefs(mDatabase));
    if (NS_SUCCEEDED(rv))
      NotifyFolderEvent(mFolderLoadedAtom);
  }
  else
  {
    bool valid;
    rv = mDatabase->GetSummaryValid(&valid);
    // don't notify folder loaded or try compaction if db isn't valid
    // (we're probably reparsing or copying msgs to it)
    if (NS_SUCCEEDED(rv) && valid)
      NotifyFolderEvent(mFolderLoadedAtom);
    else if (mCopyState)
      mCopyState->m_notifyFolderLoaded = true; //defer folder loaded notification
    else if (!m_parsingFolder)// if the db was already open, it's probably OK to load it if not parsing
      NotifyFolderEvent(mFolderLoadedAtom);
  }
  bool filtersRun;
  bool hasNewMessages;
  GetHasNewMessages(&hasNewMessages);
  if (mDatabase)
    ApplyRetentionSettings();
  // if we have new messages, try the filter plugins.
  if (NS_SUCCEEDED(rv) && hasNewMessages)
    (void) CallFilterPlugins(aWindow, &filtersRun);
  // Callers should rely on folder loaded event to ensure completion of loading. So we'll
  // return NS_OK even if parsing is still in progress
  if (rv == NS_ERROR_NOT_INITIALIZED)
    rv = NS_OK;
  return rv;
}

NS_IMETHODIMP
nsMsgLocalMailFolder::GetMessages(nsISimpleEnumerator **result)
{
  nsCOMPtr <nsIMsgDatabase> msgDB;
  nsresult rv = GetDatabaseWOReparse(getter_AddRefs(msgDB));
  return NS_SUCCEEDED(rv) ? msgDB->EnumerateMessages(result) : rv;
}

NS_IMETHODIMP nsMsgLocalMailFolder::GetFolderURL(nsACString& aUrl)
{
  nsresult rv;
  nsCOMPtr<nsIFile> path;
  rv = GetFilePath(getter_AddRefs(path));
  if (NS_FAILED(rv))
    return rv;

  rv = NS_GetURLSpecFromFile(path, aUrl);
  NS_ENSURE_SUCCESS(rv, rv);

  aUrl.Replace(0, strlen("file:"), "mailbox:");

  return NS_OK;
}

NS_IMETHODIMP nsMsgLocalMailFolder::CreateStorageIfMissing(nsIUrlListener* aUrlListener)
{
  nsresult rv;
  nsCOMPtr<nsIMsgFolder> msgParent;
  GetParent(getter_AddRefs(msgParent));

  // parent is probably not set because *this* was probably created by rdf
  // and not by folder discovery. So, we have to compute the parent.
  if (!msgParent)
  {
    nsAutoCString folderName(mURI);
    nsAutoCString uri;
    int32_t leafPos = folderName.RFindChar('/');
    nsAutoCString parentName(folderName);
    if (leafPos > 0)
    {
      // If there is a hierarchy, there is a parent.
      // Don't strip off slash if it's the first character
      parentName.SetLength(leafPos);
      // get the corresponding RDF resource
      // RDF will create the folder resource if it doesn't already exist
      nsCOMPtr<nsIRDFService> rdf = do_GetService("@mozilla.org/rdf/rdf-service;1", &rv);
      NS_ENSURE_SUCCESS(rv,rv);

      nsCOMPtr<nsIRDFResource> resource;
      rv = rdf->GetResource(parentName, getter_AddRefs(resource));
      NS_ENSURE_SUCCESS(rv,rv);

      msgParent = do_QueryInterface(resource, &rv);
      NS_ENSURE_SUCCESS(rv,rv);
    }
  }

  if (msgParent)
  {
    nsString folderName;
    GetName(folderName);
    rv = msgParent->CreateSubfolder(folderName, nullptr);
    // by definition, this is OK.
    if (rv == NS_MSG_FOLDER_EXISTS)
      return NS_OK;
  }

  return rv;
}

NS_IMETHODIMP
nsMsgLocalMailFolder::CreateSubfolder(const nsAString& folderName, nsIMsgWindow *msgWindow)
{
  nsCOMPtr<nsIMsgFolder> newFolder;
  nsresult rv = CreateSubfolderInternal(folderName, msgWindow, getter_AddRefs(newFolder));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIMsgFolderNotificationService> notifier(do_GetService(NS_MSGNOTIFICATIONSERVICE_CONTRACTID));
  if (notifier)
    notifier->NotifyFolderAdded(newFolder);

  return NS_OK;
}

nsresult
nsMsgLocalMailFolder::CreateSubfolderInternal(const nsAString& folderName,
                                              nsIMsgWindow *msgWindow,
                                              nsIMsgFolder **aNewFolder)
{
  nsresult rv = CheckIfFolderExists(folderName, this, msgWindow);
  // No need for an assertion: we already throw an alert.
  if (NS_FAILED(rv))
    return rv;
  nsCOMPtr<nsIMsgPluggableStore> msgStore;
  rv = GetMsgStore(getter_AddRefs(msgStore));
  NS_ENSURE_SUCCESS(rv, rv);
  rv = msgStore->CreateFolder(this, folderName, aNewFolder);
  if (rv == NS_MSG_ERROR_INVALID_FOLDER_NAME)
  {
    ThrowAlertMsg("folderCreationFailed", msgWindow);
    // I'm returning this value so the dialog stays up
    return NS_MSG_FOLDER_EXISTS;
  }
  if (rv == NS_MSG_FOLDER_EXISTS)
  {
    ThrowAlertMsg("folderExists", msgWindow);
    return NS_MSG_FOLDER_EXISTS;
  }

  nsCOMPtr<nsIMsgFolder> child = *aNewFolder;

  if (NS_SUCCEEDED(rv))
  {
    //we need to notify explicitly the flag change because it failed when we did AddSubfolder
    child->OnFlagChange(mFlags);
    child->SetPrettyName(folderName);  //because empty trash will create a new trash folder
    NotifyItemAdded(child);
    if (aNewFolder)
      child.swap(*aNewFolder);
  }
  return rv;
}

NS_IMETHODIMP nsMsgLocalMailFolder::CompactAll(nsIUrlListener *aListener,
                                               nsIMsgWindow *aMsgWindow,
                                               bool aCompactOfflineAlso)
{
  nsresult rv = NS_OK;
  nsCOMPtr<nsIMutableArray> folderArray;
  nsCOMPtr<nsIMsgFolder> rootFolder;
  nsCOMPtr<nsIArray> allDescendents;
  rv = GetRootFolder(getter_AddRefs(rootFolder));
  nsCOMPtr<nsIMsgPluggableStore> msgStore;
  GetMsgStore(getter_AddRefs(msgStore));
  bool storeSupportsCompaction;
  msgStore->GetSupportsCompaction(&storeSupportsCompaction);
  if (!storeSupportsCompaction)
    return NotifyCompactCompleted();

  if (NS_SUCCEEDED(rv) && rootFolder)
  {
    rv = rootFolder->GetDescendants(getter_AddRefs(allDescendents));
    NS_ENSURE_SUCCESS(rv, rv);
    uint32_t cnt = 0;
    rv = allDescendents->GetLength(&cnt);
    NS_ENSURE_SUCCESS(rv, rv);
    folderArray = do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
    uint32_t expungedBytes = 0;
    for (uint32_t i = 0; i < cnt; i++)
    {
      nsCOMPtr<nsIMsgFolder> folder = do_QueryElementAt(allDescendents, i, &rv);
      NS_ENSURE_SUCCESS(rv, rv);

      expungedBytes = 0;
      if (folder)
        rv = folder->GetExpungedBytes(&expungedBytes);

      NS_ENSURE_SUCCESS(rv, rv);

      if (expungedBytes > 0)
        rv = folderArray->AppendElement(folder, false);
    }
    rv = folderArray->GetLength(&cnt);
    NS_ENSURE_SUCCESS(rv,rv);
    if (cnt == 0)
      return NotifyCompactCompleted();
  }
  nsCOMPtr <nsIMsgFolderCompactor> folderCompactor =  do_CreateInstance(NS_MSGLOCALFOLDERCOMPACTOR_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  return folderCompactor->CompactFolders(folderArray, nullptr,
                                         aListener, aMsgWindow);
}

NS_IMETHODIMP nsMsgLocalMailFolder::Compact(nsIUrlListener *aListener, nsIMsgWindow *aMsgWindow)
{
  nsCOMPtr<nsIMsgPluggableStore> msgStore;
  nsresult rv = GetMsgStore(getter_AddRefs(msgStore));
  NS_ENSURE_SUCCESS(rv, rv);
  bool supportsCompaction;
  msgStore->GetSupportsCompaction(&supportsCompaction);
  if (supportsCompaction)
    return msgStore->CompactFolder(this, aListener, aMsgWindow);
  return NS_OK;
}

NS_IMETHODIMP nsMsgLocalMailFolder::EmptyTrash(nsIMsgWindow *msgWindow,
                                               nsIUrlListener *aListener)
{
  nsresult rv;
  nsCOMPtr<nsIMsgFolder> trashFolder;
  rv = GetTrashFolder(getter_AddRefs(trashFolder));
  if (NS_SUCCEEDED(rv))
  {
    uint32_t flags;
    nsCString trashUri;
    trashFolder->GetURI(trashUri);
    trashFolder->GetFlags(&flags);
    int32_t totalMessages = 0;
    rv = trashFolder->GetTotalMessages(true, &totalMessages);
    if (totalMessages <= 0)
    {
      nsCOMPtr<nsISimpleEnumerator> enumerator;
      rv = trashFolder->GetSubFolders(getter_AddRefs(enumerator));
      NS_ENSURE_SUCCESS(rv,rv);
      // Any folders to deal with?
      bool hasMore;
      rv = enumerator->HasMoreElements(&hasMore);
      if (NS_FAILED(rv) || !hasMore)
        return NS_OK;
    }
    nsCOMPtr<nsIMsgFolder> parentFolder;
    rv = trashFolder->GetParent(getter_AddRefs(parentFolder));
    if (NS_SUCCEEDED(rv) && parentFolder)
    {
      nsCOMPtr <nsIDBFolderInfo> transferInfo;
      trashFolder->GetDBTransferInfo(getter_AddRefs(transferInfo));
      trashFolder->SetParent(nullptr);
      parentFolder->PropagateDelete(trashFolder, true, msgWindow);
      parentFolder->CreateSubfolder(NS_LITERAL_STRING("Trash"), nullptr);
      nsCOMPtr<nsIMsgFolder> newTrashFolder;
      rv = GetTrashFolder(getter_AddRefs(newTrashFolder));
      if (NS_SUCCEEDED(rv) && newTrashFolder)
      {
        nsCOMPtr <nsIMsgLocalMailFolder> localTrash = do_QueryInterface(newTrashFolder);
        newTrashFolder->SetDBTransferInfo(transferInfo);
        if (localTrash)
          localTrash->RefreshSizeOnDisk();
        // update the summary totals so the front end will
        // show the right thing for the new trash folder
        // see bug #161999
        nsCOMPtr<nsIDBFolderInfo> dbFolderInfo;
        nsCOMPtr<nsIMsgDatabase> db;
        newTrashFolder->GetDBFolderInfoAndDB(getter_AddRefs(dbFolderInfo), getter_AddRefs(db));
        if (dbFolderInfo)
        {
          dbFolderInfo->SetNumUnreadMessages(0);
          dbFolderInfo->SetNumMessages(0);
        }
        newTrashFolder->UpdateSummaryTotals(true);
      }
    }
  }
  return rv;
}

nsresult nsMsgLocalMailFolder::IsChildOfTrash(bool *result)
{
  NS_ENSURE_ARG_POINTER(result);
  uint32_t parentFlags = 0;
  *result = false;
  bool isServer;
  nsresult rv = GetIsServer(&isServer);
  if (NS_FAILED(rv) || isServer)
    return NS_OK;

  rv= GetFlags(&parentFlags);  //this is the parent folder
  if (parentFlags & nsMsgFolderFlags::Trash)
  {
    *result = true;
    return rv;
  }

  nsCOMPtr<nsIMsgFolder> parentFolder;
  nsCOMPtr<nsIMsgFolder> thisFolder;
  rv = QueryInterface(NS_GET_IID(nsIMsgFolder), (void **) getter_AddRefs(thisFolder));

  while (!isServer)
  {
    thisFolder->GetParent(getter_AddRefs(parentFolder));
    if (!parentFolder)
      return NS_OK;

    rv = parentFolder->GetIsServer(&isServer);
    if (NS_FAILED(rv) || isServer)
      return NS_OK;

    rv = parentFolder->GetFlags(&parentFlags);
    if (NS_FAILED(rv))
      return NS_OK;

    if (parentFlags & nsMsgFolderFlags::Trash)
    {
      *result = true;
      return rv;
    }

    thisFolder = parentFolder;
  }
  return rv;
}

NS_IMETHODIMP nsMsgLocalMailFolder::Delete()
{
  nsresult rv;
  nsCOMPtr<nsIMsgDBService> msgDBService = do_GetService(NS_MSGDB_SERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  msgDBService->CachedDBForFolder(this, getter_AddRefs(mDatabase));
  if (mDatabase)
  {
    mDatabase->ForceClosed();
    mDatabase = nullptr;
  }

  nsCOMPtr<nsIMsgIncomingServer> server;
  rv = GetServer(getter_AddRefs(server));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIMsgPluggableStore> msgStore;

  rv = server->GetMsgStore(getter_AddRefs(msgStore));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr <nsIFile> summaryFile;
  rv = msgStore->GetSummaryFile(this, getter_AddRefs(summaryFile));
  NS_ENSURE_SUCCESS(rv, rv);

  //Clean up .sbd folder if it exists.
  // Remove summary file.
  summaryFile->Remove(false);

  return msgStore->DeleteFolder(this);
}

NS_IMETHODIMP nsMsgLocalMailFolder::DeleteSubFolders(nsIArray *folders, nsIMsgWindow *msgWindow)
{
  nsresult rv;
  bool isChildOfTrash;
  IsChildOfTrash(&isChildOfTrash);

  // we don't allow multiple folder selection so this is ok.
  nsCOMPtr<nsIMsgFolder> folder = do_QueryElementAt(folders, 0);
  uint32_t folderFlags = 0;
  if (folder)
    folder->GetFlags(&folderFlags);
  // when deleting from trash, or virtual folder, just delete it.
  if (isChildOfTrash || folderFlags & nsMsgFolderFlags::Virtual)
    return nsMsgDBFolder::DeleteSubFolders(folders, msgWindow);

  nsCOMPtr<nsIMsgFolder> trashFolder;
  rv = GetTrashFolder(getter_AddRefs(trashFolder));
  if (NS_SUCCEEDED(rv))
  {
    if (folder)
    {
      nsCOMPtr<nsIMsgCopyService> copyService(do_GetService(NS_MSGCOPYSERVICE_CONTRACTID, &rv));
      NS_ENSURE_SUCCESS(rv, rv);
      rv = copyService->CopyFolders(folders, trashFolder, true, nullptr, msgWindow);
    }
  }
  return rv;
}

nsresult nsMsgLocalMailFolder::ConfirmFolderDeletion(nsIMsgWindow *aMsgWindow,
                                                     nsIMsgFolder *aFolder, bool *aResult)
{
  NS_ENSURE_ARG(aResult);
  NS_ENSURE_ARG(aMsgWindow);
  NS_ENSURE_ARG(aFolder);
  nsCOMPtr<nsIDocShell> docShell;
  aMsgWindow->GetRootDocShell(getter_AddRefs(docShell));
  if (docShell)
  {
    bool confirmDeletion = true;
    nsresult rv;
    nsCOMPtr<nsIPrefBranch> pPrefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
    NS_ENSURE_SUCCESS(rv, rv);
    pPrefBranch->GetBoolPref("mailnews.confirm.moveFoldersToTrash", &confirmDeletion);
    if (confirmDeletion)
    {
      nsCOMPtr<nsIStringBundleService> bundleService =
        mozilla::services::GetStringBundleService();
      NS_ENSURE_TRUE(bundleService, NS_ERROR_UNEXPECTED);
      nsCOMPtr<nsIStringBundle> bundle;
      rv = bundleService->CreateBundle("chrome://messenger/locale/localMsgs.properties", getter_AddRefs(bundle));
      NS_ENSURE_SUCCESS(rv, rv);

      nsAutoString folderName;
      rv = aFolder->GetName(folderName);
      NS_ENSURE_SUCCESS(rv, rv);
      const PRUnichar *formatStrings[1] = { folderName.get() };

      nsAutoString deleteFolderDialogTitle;
      rv = bundle->GetStringFromName(
        NS_LITERAL_STRING("pop3DeleteFolderDialogTitle").get(),
        getter_Copies(deleteFolderDialogTitle));
      NS_ENSURE_SUCCESS(rv, rv);

      nsAutoString deleteFolderButtonLabel;
      rv = bundle->GetStringFromName(
        NS_LITERAL_STRING("pop3DeleteFolderButtonLabel").get(),
        getter_Copies(deleteFolderButtonLabel));
      NS_ENSURE_SUCCESS(rv, rv);

      nsAutoString confirmationStr;
      rv = bundle->FormatStringFromName(
        NS_LITERAL_STRING("pop3MoveFolderToTrash").get(), formatStrings, 1,
        getter_Copies(confirmationStr));
      NS_ENSURE_SUCCESS(rv, rv);

      nsCOMPtr<nsIPrompt> dialog(do_GetInterface(docShell));
      if (dialog)
      {
        int32_t buttonPressed = 0;
        // Default the dialog to "cancel".
        const uint32_t buttonFlags =
          (nsIPrompt::BUTTON_TITLE_IS_STRING * nsIPrompt::BUTTON_POS_0) +
          (nsIPrompt::BUTTON_TITLE_CANCEL * nsIPrompt::BUTTON_POS_1);
        bool dummyValue = false;
        rv = dialog->ConfirmEx(deleteFolderDialogTitle.get(), confirmationStr.get(),
                               buttonFlags,  deleteFolderButtonLabel.get(),
                               nullptr, nullptr, nullptr, &dummyValue,
                               &buttonPressed);
        NS_ENSURE_SUCCESS(rv, rv);
        *aResult = !buttonPressed; // "ok" is in position 0
      }
    }
    else
      *aResult = true;
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgLocalMailFolder::Rename(const nsAString& aNewName, nsIMsgWindow *msgWindow)
{
  // Renaming to the same name is easy
  if (mName.Equals(aNewName))
    return NS_OK;

  nsCOMPtr<nsIMsgFolder> parentFolder;
  nsresult rv = GetParent(getter_AddRefs(parentFolder));
  if (!parentFolder)
    return NS_ERROR_NULL_POINTER;

  rv = CheckIfFolderExists(aNewName, parentFolder, msgWindow);
  if (NS_FAILED(rv))
    return rv;

  nsCOMPtr<nsIMsgPluggableStore> msgStore;
  nsCOMPtr<nsIMsgFolder> newFolder;
  rv = GetMsgStore(getter_AddRefs(msgStore));
  NS_ENSURE_SUCCESS(rv, rv);
  rv = msgStore->RenameFolder(this, aNewName, getter_AddRefs(newFolder));
  if (NS_FAILED(rv))
  {
    if (msgWindow)
      (void) ThrowAlertMsg((rv == NS_MSG_FOLDER_EXISTS) ?
                            "folderExists" : "folderRenameFailed", msgWindow);
    return rv;
  }

  int32_t count = mSubFolders.Count();
    if (newFolder)
    {
      // Because we just renamed the db, w/o setting the pretty name in it,
      // we need to force the pretty name to be correct.
      // SetPrettyName won't write the name to the db if it doesn't think the
      // name has changed. This hack forces the pretty name to get set in the db.
      // We could set the new pretty name on the db before renaming the .msf file,
      // but if the rename failed, it would be out of sync.
      newFolder->SetPrettyName(EmptyString());
      newFolder->SetPrettyName(aNewName);
      bool changed = false;
      MatchOrChangeFilterDestination(newFolder, true /*caseInsenstive*/, &changed);
      if (changed)
        AlertFilterChanged(msgWindow);

      if (count > 0)
        newFolder->RenameSubFolders(msgWindow, this);

      // Discover the subfolders inside this folder (this is recursive)
      newFolder->GetSubFolders(nullptr);

      // the newFolder should have the same flags
      newFolder->SetFlags(mFlags);
      if (parentFolder)
      {
        SetParent(nullptr);
        parentFolder->PropagateDelete(this, false, msgWindow);
        parentFolder->NotifyItemAdded(newFolder);
      }
      SetFilePath(nullptr); // forget our path, since this folder object renamed itself
      nsCOMPtr<nsIAtom> folderRenameAtom = MsgGetAtom("RenameCompleted");
      newFolder->NotifyFolderEvent(folderRenameAtom);

      nsCOMPtr<nsIMsgFolderNotificationService> notifier(do_GetService(NS_MSGNOTIFICATIONSERVICE_CONTRACTID));
      if (notifier)
        notifier->NotifyFolderRenamed(this, newFolder);
    }
  return rv;
}

NS_IMETHODIMP nsMsgLocalMailFolder::RenameSubFolders(nsIMsgWindow *msgWindow, nsIMsgFolder *oldFolder)
{
  nsresult rv =NS_OK;
  mInitialized = true;

  uint32_t flags;
  oldFolder->GetFlags(&flags);
  SetFlags(flags);

  nsCOMPtr<nsISimpleEnumerator> enumerator;
  rv = oldFolder->GetSubFolders(getter_AddRefs(enumerator));
  NS_ENSURE_SUCCESS(rv, rv);

  bool hasMore;
  while (NS_SUCCEEDED(enumerator->HasMoreElements(&hasMore)) && hasMore)
  {
    nsCOMPtr<nsISupports> item;
    enumerator->GetNext(getter_AddRefs(item));

    nsCOMPtr<nsIMsgFolder> msgFolder(do_QueryInterface(item));
    if (!msgFolder)
      continue;

    nsString folderName;
    rv = msgFolder->GetName(folderName);
    nsCOMPtr <nsIMsgFolder> newFolder;
    AddSubfolder(folderName, getter_AddRefs(newFolder));
    if (newFolder)
    {
      newFolder->SetPrettyName(folderName);
      bool changed = false;
      msgFolder->MatchOrChangeFilterDestination(newFolder, true /*caseInsenstive*/, &changed);
      if (changed)
        msgFolder->AlertFilterChanged(msgWindow);
      newFolder->RenameSubFolders(msgWindow, msgFolder);
    }
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgLocalMailFolder::GetPrettyName(nsAString& prettyName)
{
  return nsMsgDBFolder::GetPrettyName(prettyName);
}

NS_IMETHODIMP nsMsgLocalMailFolder::SetPrettyName(const nsAString& aName)
{
  nsresult rv = nsMsgDBFolder::SetPrettyName(aName);
  NS_ENSURE_SUCCESS(rv, rv);
  nsCString folderName;
  rv = GetStringProperty("folderName", folderName);
  NS_ConvertUTF16toUTF8 utf8FolderName(mName);
  return NS_FAILED(rv) || !folderName.Equals(utf8FolderName) ? SetStringProperty("folderName", utf8FolderName) : rv;
}

NS_IMETHODIMP nsMsgLocalMailFolder::GetName(nsAString& aName)
{
  ReadDBFolderInfo(false);
  return nsMsgDBFolder::GetName(aName);
}

nsresult nsMsgLocalMailFolder::OpenDatabase()
{
  nsresult rv;
  nsCOMPtr<nsIMsgDBService> msgDBService = do_GetService(NS_MSGDB_SERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr <nsIFile> file;
  rv = GetFilePath(getter_AddRefs(file));

  rv = msgDBService->OpenFolderDB(this, true, getter_AddRefs(mDatabase));
    if (rv == NS_MSG_ERROR_FOLDER_SUMMARY_MISSING)
    {
    // check if we're a real folder by looking at the parent folder.
    nsCOMPtr<nsIMsgFolder> parent;
    GetParent(getter_AddRefs(parent));
    if (parent)
    {
      // This little dance creates an empty .msf file and then checks
      // if the db is valid - this works if the folder is empty, which
      // we don't have a direct way of checking.
      nsCOMPtr<nsIMsgDatabase> db;
      rv = msgDBService->CreateNewDB(this, getter_AddRefs(db));
      if (db)
      {
        UpdateSummaryTotals(true);
        db->Close(true);
        mDatabase = nullptr;
        db = nullptr;
        rv = msgDBService->OpenFolderDB(this, false,
                                        getter_AddRefs(mDatabase));
        if (NS_FAILED(rv))
          mDatabase = nullptr;
      }
    }
  }
  else if (NS_FAILED(rv))
    mDatabase = nullptr;

  return rv;
}

NS_IMETHODIMP
nsMsgLocalMailFolder::GetDBFolderInfoAndDB(nsIDBFolderInfo **folderInfo, nsIMsgDatabase **db)
{
  if (!db || !folderInfo || !mPath || mIsServer)
    return NS_ERROR_NULL_POINTER;   //ducarroz: should we use NS_ERROR_INVALID_ARG?

  nsresult rv;
  if (mDatabase)
    rv = NS_OK;
  else
  {
    rv = OpenDatabase();

    if (mAddListener && mDatabase)
      mDatabase->AddListener(this);
  }

  NS_IF_ADDREF(*db = mDatabase);
  if (NS_SUCCEEDED(rv) && *db)
    rv = (*db)->GetDBFolderInfo(folderInfo);
  return rv;
}

NS_IMETHODIMP nsMsgLocalMailFolder::ReadFromFolderCacheElem(nsIMsgFolderCacheElement *element)
{
  NS_ENSURE_ARG_POINTER(element);
  nsresult rv = nsMsgDBFolder::ReadFromFolderCacheElem(element);
  NS_ENSURE_SUCCESS(rv, rv);
  nsCString utf8Name;
  rv = element->GetStringProperty("folderName", utf8Name);
  NS_ENSURE_SUCCESS(rv, rv);
  CopyUTF8toUTF16(utf8Name, mName);
  return rv;
}

NS_IMETHODIMP nsMsgLocalMailFolder::WriteToFolderCacheElem(nsIMsgFolderCacheElement *element)
{
  NS_ENSURE_ARG_POINTER(element);
  nsMsgDBFolder::WriteToFolderCacheElem(element);
  return element->SetStringProperty("folderName", NS_ConvertUTF16toUTF8(mName));
}

NS_IMETHODIMP nsMsgLocalMailFolder::GetDeletable(bool *deletable)
{
  NS_ENSURE_ARG_POINTER(deletable);

  bool isServer;
  GetIsServer(&isServer);
  *deletable = !(isServer || (mFlags & nsMsgFolderFlags::SpecialUse));
  return NS_OK;
}

NS_IMETHODIMP nsMsgLocalMailFolder::RefreshSizeOnDisk()
{
  uint32_t oldFolderSize = mFolderSize;
  mFolderSize = 0; // we set this to 0 to force it to get recalculated from disk
  if (NS_SUCCEEDED(GetSizeOnDisk(&mFolderSize)))
    NotifyIntPropertyChanged(kFolderSizeAtom, oldFolderSize, mFolderSize);
  return NS_OK;
}

NS_IMETHODIMP nsMsgLocalMailFolder::GetSizeOnDisk(uint32_t* aSize)
{
  NS_ENSURE_ARG_POINTER(aSize);
  nsresult rv = NS_OK;
  if (!mFolderSize)
  {
    nsCOMPtr <nsIFile> file;
    rv = GetFilePath(getter_AddRefs(file));
    NS_ENSURE_SUCCESS(rv, rv);
    int64_t folderSize;
    rv = file->GetFileSize(&folderSize);
    NS_ENSURE_SUCCESS(rv, rv);

    mFolderSize = (uint32_t) folderSize;
  }
  *aSize = mFolderSize;
  return rv;
}

nsresult
nsMsgLocalMailFolder::GetTrashFolder(nsIMsgFolder** result)
{
  NS_ENSURE_ARG_POINTER(result);
  nsresult rv;
  nsCOMPtr<nsIMsgFolder> rootFolder;
  rv = GetRootFolder(getter_AddRefs(rootFolder));
  if (NS_SUCCEEDED(rv))
  {
    rootFolder->GetFolderWithFlags(nsMsgFolderFlags::Trash, result);
    if (!*result)
      rv = NS_ERROR_FAILURE;
  }
  return rv;
}

NS_IMETHODIMP
nsMsgLocalMailFolder::DeleteMessages(nsIArray *messages,
                                     nsIMsgWindow *msgWindow,
                                     bool deleteStorage, bool isMove,
                                     nsIMsgCopyServiceListener* listener, bool allowUndo)
{
  NS_ENSURE_ARG_POINTER(messages);

  uint32_t messageCount;
  nsresult rv = messages->GetLength(&messageCount);
  NS_ENSURE_SUCCESS(rv, rv);

  // shift delete case - (delete to trash is handled in EndMove)
  // this is also the case when applying retention settings.
  if (deleteStorage && !isMove)
  {
    MarkMsgsOnPop3Server(messages, POP3_DELETE);
  }

  bool isTrashFolder = mFlags & nsMsgFolderFlags::Trash;

  // notify on delete from trash and shift-delete
  if (!isMove && (deleteStorage || isTrashFolder))
  {
    nsCOMPtr<nsIMsgFolderNotificationService> notifier(do_GetService(NS_MSGNOTIFICATIONSERVICE_CONTRACTID));
    if (notifier)
        notifier->NotifyMsgsDeleted(messages);
  }

  if (!deleteStorage && !isTrashFolder)
  {
    nsCOMPtr<nsIMsgFolder> trashFolder;
    rv = GetTrashFolder(getter_AddRefs(trashFolder));
    if (NS_SUCCEEDED(rv))
    {
      nsCOMPtr<nsIMsgCopyService> copyService = do_GetService(NS_MSGCOPYSERVICE_CONTRACTID, &rv);
      NS_ENSURE_SUCCESS(rv, rv);
      return copyService->CopyMessages(this, messages, trashFolder,
                                       true, listener, msgWindow, allowUndo);
    }
  }
  else
  {
    nsCOMPtr <nsIMsgDatabase> msgDB;
    rv = GetDatabaseWOReparse(getter_AddRefs(msgDB));
    if (NS_SUCCEEDED(rv))
    {
      if (deleteStorage && isMove && GetDeleteFromServerOnMove())
        MarkMsgsOnPop3Server(messages, POP3_DELETE);

      nsCOMPtr<nsISupports> msgSupport;
      rv = EnableNotifications(allMessageCountNotifications, false, true /*dbBatching*/);
      if (NS_SUCCEEDED(rv))
      {
        nsCOMPtr<nsIMsgPluggableStore> msgStore;
        rv = GetMsgStore(getter_AddRefs(msgStore));
        if (NS_SUCCEEDED(rv))
        {
          rv = msgStore->DeleteMessages(messages);
          GetDatabase();
          nsCOMPtr<nsIMsgDBHdr> msgDBHdr;
          if (mDatabase)
          {
        for (uint32_t i = 0; i < messageCount; ++i)
        {
              msgDBHdr = do_QueryElementAt(messages, i, &rv);
              rv = mDatabase->DeleteHeader(msgDBHdr, nullptr, false, true);
            }
          }
        }
      }
      else if (rv == NS_MSG_FOLDER_BUSY)
        ThrowAlertMsg("deletingMsgsFailed", msgWindow);

      // we are the source folder here for a move or shift delete
      //enable notifications because that will close the file stream
      // we've been caching, mark the db as valid, and commit it.
      EnableNotifications(allMessageCountNotifications, true, true /*dbBatching*/);
      if (!isMove)
        NotifyFolderEvent(NS_SUCCEEDED(rv) ? mDeleteOrMoveMsgCompletedAtom : mDeleteOrMoveMsgFailedAtom);
      if (msgWindow && !isMove)
        AutoCompact(msgWindow);
    }
  }
  return rv;
}

NS_IMETHODIMP
nsMsgLocalMailFolder::MarkMessagesRead(nsIArray *aMessages, bool aMarkRead)
{
  nsresult rv = nsMsgDBFolder::MarkMessagesRead(aMessages, aMarkRead);
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr<nsIMsgPluggableStore> msgStore;
  rv = GetMsgStore(getter_AddRefs(msgStore));
  NS_ENSURE_SUCCESS(rv, rv);
  return msgStore->ChangeFlags(aMessages, nsMsgMessageFlags::Read, aMarkRead);
}

NS_IMETHODIMP
nsMsgLocalMailFolder::MarkMessagesFlagged(nsIArray *aMessages,
                                          bool aMarkFlagged)
{
  nsresult rv = nsMsgDBFolder::MarkMessagesFlagged(aMessages, aMarkFlagged);
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr<nsIMsgPluggableStore> msgStore;
  rv = GetMsgStore(getter_AddRefs(msgStore));
  NS_ENSURE_SUCCESS(rv, rv);
  return msgStore->ChangeFlags(aMessages, nsMsgMessageFlags::Marked,
                               aMarkFlagged);
}

nsresult
nsMsgLocalMailFolder::InitCopyState(nsISupports* aSupport,
                                    nsIArray* messages,
                                    bool isMove,
                                    nsIMsgCopyServiceListener* listener,
                                    nsIMsgWindow *msgWindow, bool isFolder,
                                    bool allowUndo)
{
  nsCOMPtr<nsIFile> path;

  NS_ASSERTION(!mCopyState, "already copying a msg into this folder");
  if (mCopyState)
    return NS_ERROR_FAILURE; // already has a  copy in progress

  // get mDatabase set, so we can use it to add new hdrs to this db.
  // calling GetDatabase will set mDatabase - we use the comptr
  // here to avoid doubling the refcnt on mDatabase. We don't care if this
  // fails - we just want to give it a chance. It will definitely fail in
  // nsLocalMailFolder::EndCopy because we will have written data to the folder
  // and changed its size.
  nsCOMPtr <nsIMsgDatabase> msgDB;
  GetDatabaseWOReparse(getter_AddRefs(msgDB));
  bool isLocked;

  GetLocked(&isLocked);
  if (isLocked)
    return NS_MSG_FOLDER_BUSY;

  AcquireSemaphore(static_cast<nsIMsgLocalMailFolder*>(this));

  mCopyState = new nsLocalMailCopyState();
  NS_ENSURE_TRUE(mCopyState, NS_ERROR_OUT_OF_MEMORY);

  mCopyState->m_dataBuffer = (char*) PR_CALLOC(COPY_BUFFER_SIZE+1);
  NS_ENSURE_TRUE(mCopyState->m_dataBuffer, NS_ERROR_OUT_OF_MEMORY);

  mCopyState->m_dataBufferSize = COPY_BUFFER_SIZE;
  mCopyState->m_destDB = msgDB;

  //Before we continue we should verify that there is enough diskspace.
  //XXX How do we do this?
  nsresult rv;
  mCopyState->m_srcSupport = do_QueryInterface(aSupport, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  mCopyState->m_messages = messages;
  mCopyState->m_curCopyIndex = 0;
  mCopyState->m_isMove = isMove;
  mCopyState->m_isFolder = isFolder;
  mCopyState->m_allowUndo = allowUndo;
  mCopyState->m_msgWindow = msgWindow;
  rv = messages->GetLength(&mCopyState->m_totalMsgCount);
  if (listener)
    mCopyState->m_listener = do_QueryInterface(listener, &rv);
  mCopyState->m_copyingMultipleMessages = false;
  mCopyState->m_wholeMsgInStream = false;

  // If we have source messages then we need destination messages too.
  if (messages)
    mCopyState->m_destMessages = do_CreateInstance(NS_ARRAY_CONTRACTID);

  return rv;
}

NS_IMETHODIMP nsMsgLocalMailFolder::OnAnnouncerGoingAway(nsIDBChangeAnnouncer *instigator)
{
  if (mCopyState)
    mCopyState->m_destDB = nullptr;
  return nsMsgDBFolder::OnAnnouncerGoingAway(instigator);
}

NS_IMETHODIMP
nsMsgLocalMailFolder::OnCopyCompleted(nsISupports *srcSupport, bool moveCopySucceeded)
{
  if (mCopyState && mCopyState->m_notifyFolderLoaded)
    NotifyFolderEvent(mFolderLoadedAtom);

  (void) RefreshSizeOnDisk();
  // we are the destination folder for a move/copy
  bool haveSemaphore;
  nsresult rv = TestSemaphore(static_cast<nsIMsgLocalMailFolder*>(this), &haveSemaphore);
  if (NS_SUCCEEDED(rv) && haveSemaphore)
    ReleaseSemaphore(static_cast<nsIMsgLocalMailFolder*>(this));

  if (mCopyState && !mCopyState->m_newMsgKeywords.IsEmpty() &&
      mCopyState->m_newHdr)
  {
    nsCOMPtr<nsIMutableArray> messageArray(do_CreateInstance(NS_ARRAY_CONTRACTID, &rv));
    NS_ENSURE_TRUE(messageArray, rv);
    messageArray->AppendElement(mCopyState->m_newHdr, false);
    AddKeywordsToMessages(messageArray, mCopyState->m_newMsgKeywords);
  }
  if (moveCopySucceeded && mDatabase)
  {
    mDatabase->SetSummaryValid(true);
    (void) CloseDBIfFolderNotOpen();
  }

  delete mCopyState;
  mCopyState = nullptr;
  nsCOMPtr<nsIMsgCopyService> copyService = do_GetService(NS_MSGCOPYSERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  return copyService->NotifyCompletion(srcSupport, this, moveCopySucceeded ? NS_OK : NS_ERROR_FAILURE);
}

nsresult
nsMsgLocalMailFolder::SortMessagesBasedOnKey(nsTArray<nsMsgKey> &aKeyArray, nsIMsgFolder *srcFolder, nsIMutableArray* messages)
{
  nsresult rv = NS_OK;
  uint32_t numMessages = aKeyArray.Length();

  nsCOMPtr <nsIMsgDBHdr> msgHdr;
  nsCOMPtr<nsIDBFolderInfo> folderInfo;
  nsCOMPtr<nsIMsgDatabase> db;
  rv = srcFolder->GetDBFolderInfoAndDB(getter_AddRefs(folderInfo), getter_AddRefs(db));
  if (NS_SUCCEEDED(rv) && db)
    for (uint32_t i=0;i < numMessages; i++)
    {
      rv = db->GetMsgHdrForKey(aKeyArray[i], getter_AddRefs(msgHdr));
      NS_ENSURE_SUCCESS(rv,rv);
      if (msgHdr)
        messages->AppendElement(msgHdr, false);
    }
  return rv;
}

bool nsMsgLocalMailFolder::CheckIfSpaceForCopy(nsIMsgWindow *msgWindow,
                                                 nsIMsgFolder *srcFolder,
                                                 nsISupports *srcSupports,
                                                 bool isMove,
                                                 int64_t totalMsgSize)
{
  nsCOMPtr<nsIMsgPluggableStore> msgStore;
  nsresult rv = GetMsgStore(getter_AddRefs(msgStore));
  NS_ENSURE_SUCCESS(rv, false);
  bool spaceAvailable;
  rv = msgStore->HasSpaceAvailable(this, totalMsgSize, &spaceAvailable);
  if (!spaceAvailable)
  {
    ThrowAlertMsg("mailboxTooLarge", msgWindow);
    if (isMove && srcFolder)
      srcFolder->NotifyFolderEvent(mDeleteOrMoveMsgFailedAtom);
    OnCopyCompleted(srcSupports, false);
    return false;
  }
  return true;
}

NS_IMETHODIMP
nsMsgLocalMailFolder::CopyMessages(nsIMsgFolder* srcFolder, nsIArray*
                                   messages, bool isMove,
                                   nsIMsgWindow *msgWindow,
                                   nsIMsgCopyServiceListener* listener,
                                   bool isFolder, bool allowUndo)
{
  nsCOMPtr<nsISupports> srcSupport = do_QueryInterface(srcFolder);
  bool isServer;
  nsresult rv = GetIsServer(&isServer);
  if (NS_SUCCEEDED(rv) && isServer)
  {
    NS_ERROR("Destination is the root folder. Cannot move/copy here");
    if (isMove)
      srcFolder->NotifyFolderEvent(mDeleteOrMoveMsgFailedAtom);
    return OnCopyCompleted(srcSupport, false);
  }

  UpdateTimestamps(allowUndo);
  nsCString protocolType;
  rv = srcFolder->GetURI(protocolType);
  protocolType.SetLength(protocolType.FindChar(':'));

  bool needOfflineBody = (WeAreOffline() &&
    (MsgLowerCaseEqualsLiteral(protocolType, "imap") ||
     MsgLowerCaseEqualsLiteral(protocolType, "news")));
  int64_t totalMsgSize = 0;
  uint32_t numMessages = 0;
  messages->GetLength(&numMessages);
  for (uint32_t i = 0; i < numMessages; i++)
  {
    nsCOMPtr<nsIMsgDBHdr> message(do_QueryElementAt(messages, i, &rv));
    if (NS_SUCCEEDED(rv) && message)
    {
      nsMsgKey key;
      uint32_t msgSize;
      message->GetMessageSize(&msgSize);

      /* 200 is a per-message overhead to account for any extra data added
         to the message.
      */
      totalMsgSize += msgSize + 200;

      if (needOfflineBody)
      {
        bool hasMsgOffline = false;
        message->GetMessageKey(&key);
        srcFolder->HasMsgOffline(key, &hasMsgOffline);
        if (!hasMsgOffline)
        {
          if (isMove)
            srcFolder->NotifyFolderEvent(mDeleteOrMoveMsgFailedAtom);
          ThrowAlertMsg("cantMoveMsgWOBodyOffline", msgWindow);
          return OnCopyCompleted(srcSupport, false);
        }
      }
    }
  }

  if (!CheckIfSpaceForCopy(msgWindow, srcFolder, srcSupport, isMove,
                           totalMsgSize))
    return NS_OK;

  NS_ENSURE_SUCCESS(rv, rv);
  bool storeDidCopy = false;
  nsCOMPtr<nsIMsgPluggableStore> msgStore;
  rv = GetMsgStore(getter_AddRefs(msgStore));
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr<nsITransaction> undoTxn;
  rv = msgStore->CopyMessages(isMove, messages, this, listener,
                              getter_AddRefs(undoTxn), &storeDidCopy);
  if (storeDidCopy)
  {
    NS_ASSERTION(undoTxn, "if store does copy, it needs to add undo action");
    if (msgWindow && undoTxn)
    {
      nsCOMPtr<nsITransactionManager> txnMgr;
      msgWindow->GetTransactionManager(getter_AddRefs(txnMgr));
      if (txnMgr)
        txnMgr->DoTransaction(undoTxn);
    }
    if (isMove)
      srcFolder->NotifyFolderEvent(NS_SUCCEEDED(rv) ? mDeleteOrMoveMsgCompletedAtom :
                                                      mDeleteOrMoveMsgFailedAtom);

    return rv;
  }
  // If the store doesn't do the copy, we'll stream the source messages into
  // the target folder, using getMsgInputStream and getNewMsgOutputStream.

  // don't update the counts in the dest folder until it is all over
  EnableNotifications(allMessageCountNotifications, false, false /*dbBatching*/);  //dest folder doesn't need db batching

  // sort the message array by key
  uint32_t numMsgs = 0;
  messages->GetLength(&numMsgs);
  nsTArray<nsMsgKey> keyArray(numMsgs);
  if (numMsgs > 1)
  {
    for (uint32_t i = 0; i < numMsgs; i++)
    {
      nsCOMPtr<nsIMsgDBHdr> aMessage = do_QueryElementAt(messages, i, &rv);
      if (NS_SUCCEEDED(rv) && aMessage)
      {
        nsMsgKey key;
        aMessage->GetMessageKey(&key);
        keyArray.AppendElement(key);
      }
    }

    keyArray.Sort();

    nsCOMPtr<nsIMutableArray> sortedMsgs(do_CreateInstance(NS_ARRAY_CONTRACTID));
    rv = SortMessagesBasedOnKey(keyArray, srcFolder, sortedMsgs);
    NS_ENSURE_SUCCESS(rv, rv);

    rv = InitCopyState(srcSupport, sortedMsgs, isMove, listener, msgWindow, isFolder, allowUndo);
  }
  else
    rv = InitCopyState(srcSupport, messages, isMove, listener, msgWindow, isFolder, allowUndo);

  if (NS_FAILED(rv))
  {
    ThrowAlertMsg("operationFailedFolderBusy", msgWindow);
    (void) OnCopyCompleted(srcSupport, false);
    return rv;
  }

  if (!MsgLowerCaseEqualsLiteral(protocolType, "mailbox"))
  {
    mCopyState->m_dummyEnvelopeNeeded = true;
    nsParseMailMessageState* parseMsgState = new nsParseMailMessageState();
    if (parseMsgState)
    {
      nsCOMPtr<nsIMsgDatabase> msgDb;
      mCopyState->m_parseMsgState = parseMsgState;
      GetDatabaseWOReparse(getter_AddRefs(msgDb));
      if (msgDb)
        parseMsgState->SetMailDB(msgDb);
    }
  }

  // undo stuff
  if (allowUndo)    //no undo for folder move/copy or or move/copy from search window
  {
    nsRefPtr<nsLocalMoveCopyMsgTxn> msgTxn = new nsLocalMoveCopyMsgTxn;
    if (msgTxn && NS_SUCCEEDED(msgTxn->Init(srcFolder, this, isMove)))
    {
      msgTxn->SetMsgWindow(msgWindow);
      if (isMove)
      {
        if (mFlags & nsMsgFolderFlags::Trash)
          msgTxn->SetTransactionType(nsIMessenger::eDeleteMsg);
        else
          msgTxn->SetTransactionType(nsIMessenger::eMoveMsg);
      }
      else
        msgTxn->SetTransactionType(nsIMessenger::eCopyMsg);
      msgTxn.swap(mCopyState->m_undoMsgTxn);
    }
  }

  if (numMsgs > 1 && ((MsgLowerCaseEqualsLiteral(protocolType, "imap") && !WeAreOffline()) ||
                      MsgLowerCaseEqualsLiteral(protocolType, "mailbox")))
  {
    mCopyState->m_copyingMultipleMessages = true;
    rv = CopyMessagesTo(mCopyState->m_messages, keyArray, msgWindow, this, isMove);
    if (NS_FAILED(rv))
    {
      NS_ERROR("copy message failed");
      (void) OnCopyCompleted(srcSupport, false);
    }
  }
  else
  {
    nsCOMPtr<nsISupports> msgSupport = do_QueryElementAt(mCopyState->m_messages, 0);
    if (msgSupport)
    {
      rv = CopyMessageTo(msgSupport, this, msgWindow, isMove);
      if (NS_FAILED(rv))
      {
        NS_ASSERTION(false, "copy message failed");
        (void) OnCopyCompleted(srcSupport, false);
      }
    }
  }
  // if this failed immediately, need to turn back on notifications and inform FE.
  if (NS_FAILED(rv))
  {
    if (isMove)
      srcFolder->NotifyFolderEvent(mDeleteOrMoveMsgFailedAtom);
    EnableNotifications(allMessageCountNotifications, true, false /*dbBatching*/);  //dest folder doesn't need db batching
  }
  return rv;
}
// for srcFolder that are on different server than the dstFolder.
// "this" is the parent of the new dest folder.
nsresult
nsMsgLocalMailFolder::CopyFolderAcrossServer(nsIMsgFolder* srcFolder, nsIMsgWindow *msgWindow,
                  nsIMsgCopyServiceListener *listener )
{
  mInitialized = true;

  nsString folderName;
  srcFolder->GetName(folderName);

  nsCOMPtr<nsIMsgFolder> newMsgFolder;
  nsresult rv = CreateSubfolderInternal(folderName, msgWindow, getter_AddRefs(newMsgFolder));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsISimpleEnumerator> messages;
  rv = srcFolder->GetMessages(getter_AddRefs(messages));

  nsCOMPtr<nsIMutableArray> msgArray(do_CreateInstance(NS_ARRAY_CONTRACTID));

  bool hasMoreElements;
  nsCOMPtr<nsISupports> aSupport;

  if (messages)
    messages->HasMoreElements(&hasMoreElements);

  while (hasMoreElements && NS_SUCCEEDED(rv))
  {
    rv = messages->GetNext(getter_AddRefs(aSupport));
    rv = msgArray->AppendElement(aSupport, false);
    messages->HasMoreElements(&hasMoreElements);
  }

  uint32_t numMsgs=0;
  msgArray->GetLength(&numMsgs);

  if (numMsgs > 0 )   //if only srcFolder has messages..
    newMsgFolder->CopyMessages(srcFolder, msgArray, false, msgWindow, listener, true /* is folder*/, false /* allowUndo */);
  else
  {
    nsCOMPtr <nsIMsgLocalMailFolder> localFolder = do_QueryInterface(newMsgFolder);
    if (localFolder)
    {
      // normally these would get called from ::EndCopy when the last message
      // was finished copying. But since there are no messages, we have to call
      // them explicitly.
      nsCOMPtr<nsISupports> srcSupports = do_QueryInterface(newMsgFolder);
      localFolder->CopyAllSubFolders(srcFolder, msgWindow, listener);
      return localFolder->OnCopyCompleted(srcSupports, true);
    }
  }
  return NS_OK;  // otherwise the front-end will say Exception::CopyFolder
}

nsresult    //copy the sub folders
nsMsgLocalMailFolder::CopyAllSubFolders(nsIMsgFolder *srcFolder,
                                      nsIMsgWindow *msgWindow,
                                      nsIMsgCopyServiceListener *listener )
{
  nsCOMPtr<nsISimpleEnumerator> enumerator;
  nsresult rv = srcFolder->GetSubFolders(getter_AddRefs(enumerator));
  NS_ENSURE_SUCCESS(rv, rv);

  bool hasMore;
  while (NS_SUCCEEDED(enumerator->HasMoreElements(&hasMore)) && hasMore)
  {
    nsCOMPtr<nsISupports> item;
    enumerator->GetNext(getter_AddRefs(item));

    nsCOMPtr<nsIMsgFolder> folder(do_QueryInterface(item));
    if (folder)
      CopyFolderAcrossServer(folder, msgWindow, listener);
  }
  return rv;
}

NS_IMETHODIMP
nsMsgLocalMailFolder::CopyFolder( nsIMsgFolder* srcFolder, bool isMoveFolder,
                                   nsIMsgWindow *msgWindow,
                                   nsIMsgCopyServiceListener* listener)
{
  NS_ENSURE_ARG_POINTER(srcFolder);
  // isMoveFolder == true when "this" and srcFolder are on same server
  return isMoveFolder ? CopyFolderLocal(srcFolder, isMoveFolder, msgWindow, listener ) :
                      CopyFolderAcrossServer(srcFolder, msgWindow, listener );
}

NS_IMETHODIMP
nsMsgLocalMailFolder::CopyFolderLocal(nsIMsgFolder *srcFolder,
                                      bool isMoveFolder,
                                      nsIMsgWindow *msgWindow,
                                      nsIMsgCopyServiceListener *aListener)
{
  mInitialized = true;
  bool isChildOfTrash;
  nsresult rv = IsChildOfTrash(&isChildOfTrash);
  if (NS_SUCCEEDED(rv) && isChildOfTrash)
  {
    // do it just for the parent folder (isMoveFolder is true for parent only) if we are deleting/moving a folder tree
    // don't confirm for rss folders.
    if (isMoveFolder)
    {
      // if there's a msgWindow, confirm the deletion
      if (msgWindow) 
      {

        bool okToDelete = false;
        ConfirmFolderDeletion(msgWindow, srcFolder, &okToDelete);
        if (!okToDelete)
          return NS_MSG_ERROR_COPY_FOLDER_ABORTED;
      }
      // if we are moving a favorite folder to trash, we should clear the favorites flag
      // so it gets removed from the view.
      srcFolder->ClearFlag(nsMsgFolderFlags::Favorite);
    }

    bool match = false;
    rv = srcFolder->MatchOrChangeFilterDestination(nullptr, false, &match);
    if (match && msgWindow)
    {
      bool confirmed = false;
      srcFolder->ConfirmFolderDeletionForFilter(msgWindow, &confirmed);
      if (!confirmed)
        return NS_MSG_ERROR_COPY_FOLDER_ABORTED;
    }
  }
  nsString folderName;
  srcFolder->GetName(folderName);
  rv = CheckIfFolderExists(folderName, this, msgWindow);
  if (NS_FAILED(rv))
    return rv;

  nsCOMPtr<nsIMsgPluggableStore> msgStore;
  rv = GetMsgStore(getter_AddRefs(msgStore));
    NS_ENSURE_SUCCESS(rv, rv);
  return msgStore->CopyFolder(srcFolder, this, isMoveFolder, msgWindow,
                              aListener);
}

NS_IMETHODIMP
nsMsgLocalMailFolder::CopyFileMessage(nsIFile* aFile, 
                                      nsIMsgDBHdr *msgToReplace,
                                      bool isDraftOrTemplate,
                                      uint32_t newMsgFlags,
                                      const nsACString &aNewMsgKeywords,
                                      nsIMsgWindow *msgWindow,
                                      nsIMsgCopyServiceListener* listener)
{
  NS_ENSURE_ARG_POINTER(aFile);
  nsresult rv = NS_ERROR_NULL_POINTER;
  nsParseMailMessageState* parseMsgState = nullptr;
  int64_t fileSize = 0;

  nsCOMPtr<nsISupports> fileSupport(do_QueryInterface(aFile, &rv));

  aFile->GetFileSize(&fileSize);
  if (!CheckIfSpaceForCopy(msgWindow, nullptr, fileSupport, false, fileSize))
    return NS_OK;

  nsCOMPtr<nsIMutableArray> messages(do_CreateInstance(NS_ARRAY_CONTRACTID));

  if (msgToReplace)
    messages->AppendElement(msgToReplace, false);

  rv = InitCopyState(fileSupport, messages, msgToReplace ? true : false,
                     listener, msgWindow, false, false);
  if (NS_SUCCEEDED(rv))
  {
    if (mCopyState)
      mCopyState->m_newMsgKeywords = aNewMsgKeywords;

    parseMsgState = new nsParseMailMessageState();
    NS_ENSURE_TRUE(parseMsgState, NS_ERROR_OUT_OF_MEMORY);
      nsCOMPtr<nsIMsgDatabase> msgDb;
      mCopyState->m_parseMsgState = parseMsgState;
      GetDatabaseWOReparse(getter_AddRefs(msgDb));
      if (msgDb)
        parseMsgState->SetMailDB(msgDb);

    nsCOMPtr<nsIInputStream> inputStream;
    rv = NS_NewLocalFileInputStream(getter_AddRefs(inputStream), aFile);

    // All or none for adding a message file to the store
    if (NS_SUCCEEDED(rv) && fileSize > PR_INT32_MAX)
        rv = NS_ERROR_ILLEGAL_VALUE; // may need error code for max msg size

    if (NS_SUCCEEDED(rv) && inputStream) 
    {
      char buffer[5];
      uint32_t readCount;
      rv = inputStream->Read(buffer, 5, &readCount);
      if (NS_SUCCEEDED(rv)) 
      {
        if (strncmp(buffer, "From ", 5))
          mCopyState->m_dummyEnvelopeNeeded = true;
        nsCOMPtr <nsISeekableStream> seekableStream = do_QueryInterface(inputStream, &rv);
        if (NS_SUCCEEDED(rv))
          seekableStream->Seek(nsISeekableStream::NS_SEEK_SET, 0);
      }
    }

     mCopyState->m_wholeMsgInStream = true;
     if (NS_SUCCEEDED(rv))
      rv = BeginCopy(nullptr);

    if (NS_SUCCEEDED(rv))
      rv = CopyData(inputStream, (int32_t) fileSize);

    if (NS_SUCCEEDED(rv))
      rv = EndCopy(true);

    //mDatabase should have been initialized above - if we got msgDb
    // If we were going to delete, here is where we would do it. But because
    // existing code already supports doing those deletes, we are just going
    // to end the copy.
    if (NS_SUCCEEDED(rv) && msgToReplace && mDatabase)
      rv = OnCopyCompleted(fileSupport, true);

    if (inputStream)
      inputStream->Close();
  }

  if (NS_FAILED(rv))
    (void) OnCopyCompleted(fileSupport, false);

  return rv;
}

nsresult nsMsgLocalMailFolder::DeleteMessage(nsISupports *message,
                                             nsIMsgWindow *msgWindow,
                                             bool deleteStorage, bool commit)
{
  nsresult rv = NS_OK;
  if (deleteStorage)
  {
    nsCOMPtr <nsIMsgDBHdr> msgDBHdr(do_QueryInterface(message, &rv));

    if (NS_SUCCEEDED(rv))
    {
      GetDatabase();
      if (mDatabase)
        rv = mDatabase->DeleteHeader(msgDBHdr, nullptr, commit, true);
    }
  }
  return rv;
}

NS_IMETHODIMP nsMsgLocalMailFolder::GetNewMessages(nsIMsgWindow *aWindow, nsIUrlListener *aListener)
{
  nsCOMPtr<nsIMsgIncomingServer> server;
  nsresult rv = GetServer(getter_AddRefs(server));
  NS_ENSURE_SUCCESS(rv, NS_MSG_INVALID_OR_MISSING_SERVER);

  nsCOMPtr<nsILocalMailIncomingServer> localMailServer = do_QueryInterface(server, &rv);
  NS_ENSURE_SUCCESS(rv, NS_MSG_INVALID_OR_MISSING_SERVER);

  // XXX todo, move all this into nsILocalMailIncomingServer's GetNewMail
  // so that we don't have to have RSS foo here.
  nsCOMPtr<nsIRssIncomingServer> rssServer = do_QueryInterface(server, &rv);
  if (NS_SUCCEEDED(rv))
    return localMailServer->GetNewMail(aWindow, aListener, this, nullptr);

  nsCOMPtr<nsIMsgFolder> inbox;
  nsCOMPtr<nsIMsgFolder> rootFolder;
  rv = server->GetRootMsgFolder(getter_AddRefs(rootFolder));
  if (NS_SUCCEEDED(rv) && rootFolder)
  {
    rootFolder->GetFolderWithFlags(nsMsgFolderFlags::Inbox, getter_AddRefs(inbox));
  }
  nsCOMPtr<nsIMsgLocalMailFolder> localInbox = do_QueryInterface(inbox, &rv);
  if (NS_SUCCEEDED(rv))
  {
    bool valid = false;
    nsCOMPtr <nsIMsgDatabase> db;
    // this will kick off a reparse if the db is out of date.
    rv = localInbox->GetDatabaseWithReparse(nullptr, aWindow, getter_AddRefs(db));
    if (NS_SUCCEEDED(rv))
    {
      db->GetSummaryValid(&valid);
      rv = valid ? localMailServer->GetNewMail(aWindow, aListener, inbox, nullptr) :
                   localInbox->SetCheckForNewMessagesAfterParsing(true);
    }
  }
  return rv;
}

nsresult nsMsgLocalMailFolder::WriteStartOfNewMessage()
{
  nsCOMPtr <nsISeekableStream> seekableStream = do_QueryInterface(mCopyState->m_fileStream);
  int64_t filePos;
  seekableStream->Tell(&filePos);

  // CopyFileMessage() and CopyMessages() from servers other than pop3
  if (mCopyState->m_parseMsgState)
  {
    if (mCopyState->m_parseMsgState->m_newMsgHdr)
      mCopyState->m_parseMsgState->m_newMsgHdr->GetMessageKey(&mCopyState->m_curDstKey);
    mCopyState->m_parseMsgState->SetEnvelopePos(filePos);
    mCopyState->m_parseMsgState->SetState(nsIMsgParseMailMsgState::ParseHeadersState);
  }
  if (mCopyState->m_dummyEnvelopeNeeded)
  {
    nsCString result;
    nsAutoCString nowStr;
    MsgGenerateNowStr(nowStr);
    result.AppendLiteral("From - ");
    result.Append(nowStr);
    result.Append(MSG_LINEBREAK);

    // *** jt - hard code status line for now; come back later
    nsresult rv;
    nsCOMPtr <nsIMsgDBHdr> curSourceMessage = do_QueryElementAt(mCopyState->m_messages,
                                                                mCopyState->m_curCopyIndex, &rv);

    char statusStrBuf[50];
    if (curSourceMessage)
    {
      uint32_t dbFlags = 0;
      curSourceMessage->GetFlags(&dbFlags);

      // write out x-mozilla-status, but make sure we don't write out nsMsgMessageFlags::Offline
      PR_snprintf(statusStrBuf, sizeof(statusStrBuf), X_MOZILLA_STATUS_FORMAT MSG_LINEBREAK,
        dbFlags & ~(nsMsgMessageFlags::RuntimeOnly | nsMsgMessageFlags::Offline) & 0x0000FFFF);
    }
    else
      strcpy(statusStrBuf, "X-Mozilla-Status: 0001" MSG_LINEBREAK);
    uint32_t bytesWritten;
    mCopyState->m_fileStream->Write(result.get(), result.Length(), &bytesWritten);
    if (mCopyState->m_parseMsgState)
        mCopyState->m_parseMsgState->ParseAFolderLine(
          result.get(), result.Length());
    mCopyState->m_fileStream->Write(statusStrBuf, strlen(statusStrBuf), &bytesWritten);
    if (mCopyState->m_parseMsgState)
        mCopyState->m_parseMsgState->ParseAFolderLine(
        statusStrBuf, strlen(statusStrBuf));
    result = "X-Mozilla-Status2: 00000000" MSG_LINEBREAK;
    mCopyState->m_fileStream->Write(result.get(), result.Length(), &bytesWritten);
    if (mCopyState->m_parseMsgState)
        mCopyState->m_parseMsgState->ParseAFolderLine(
          result.get(), result.Length());
    result = X_MOZILLA_KEYWORDS;
    mCopyState->m_fileStream->Write(result.get(), result.Length(), &bytesWritten);
    if (mCopyState->m_parseMsgState)
        mCopyState->m_parseMsgState->ParseAFolderLine(
          result.get(), result.Length());
   mCopyState->m_fromLineSeen = true;
  }
  else
    mCopyState->m_fromLineSeen = false;

  mCopyState->m_curCopyIndex++;
  return NS_OK;
}

nsresult nsMsgLocalMailFolder::InitCopyMsgHdrAndFileStream()
{
  nsCOMPtr<nsIMsgPluggableStore> msgStore;
  nsresult rv = GetMsgStore(getter_AddRefs(mCopyState->m_msgStore));
  NS_ENSURE_SUCCESS(rv, rv);
  bool reusable;
  rv = mCopyState->m_msgStore->
         GetNewMsgOutputStream(this, getter_AddRefs(mCopyState->m_newHdr),
                               &reusable,
                               getter_AddRefs(mCopyState->m_fileStream));
  NS_ENSURE_SUCCESS(rv, rv);
  if (mCopyState->m_parseMsgState)
    mCopyState->m_parseMsgState->SetNewMsgHdr(mCopyState->m_newHdr);
  return rv;
}

//nsICopyMessageListener
NS_IMETHODIMP nsMsgLocalMailFolder::BeginCopy(nsIMsgDBHdr *message)
{
  if (!mCopyState)
    return NS_ERROR_NULL_POINTER;

  nsresult rv;
  if (!mCopyState->m_copyingMultipleMessages)
  {
    rv = InitCopyMsgHdrAndFileStream();
    NS_ENSURE_SUCCESS(rv, rv);
  }
  nsCOMPtr <nsISeekableStream> seekableStream = do_QueryInterface(mCopyState->m_fileStream, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  seekableStream->Seek(nsISeekableStream::NS_SEEK_END, 0);

  int32_t messageIndex = (mCopyState->m_copyingMultipleMessages) ? mCopyState->m_curCopyIndex - 1 : mCopyState->m_curCopyIndex;
  NS_ASSERTION(!mCopyState->m_copyingMultipleMessages || mCopyState->m_curCopyIndex >= 0, "mCopyState->m_curCopyIndex invalid");
  // by the time we get here, m_curCopyIndex is 1 relative because WriteStartOfNewMessage increments it
  mCopyState->m_messages->QueryElementAt(messageIndex, NS_GET_IID(nsIMsgDBHdr),
                                  (void **)getter_AddRefs(mCopyState->m_message));
  // The flags of the source message can get changed when it is deleted, so
  // save them here.
  if (mCopyState->m_message)
    mCopyState->m_message->GetFlags(&(mCopyState->m_flags));
  DisplayMoveCopyStatusMsg();
  if (mCopyState->m_listener)
    mCopyState->m_listener->OnProgress(mCopyState->m_curCopyIndex, mCopyState->m_totalMsgCount);
  // if we're copying more than one message, StartMessage will handle this.
  return !mCopyState->m_copyingMultipleMessages ? WriteStartOfNewMessage() : rv;
}

NS_IMETHODIMP nsMsgLocalMailFolder::CopyData(nsIInputStream *aIStream, int32_t aLength)
{
  //check to make sure we have control of the write.
  bool haveSemaphore;
  nsresult rv = NS_OK;

  rv = TestSemaphore(static_cast<nsIMsgLocalMailFolder*>(this), &haveSemaphore);
  if (NS_FAILED(rv))
    return rv;
  if (!haveSemaphore)
    return NS_MSG_FOLDER_BUSY;

  if (!mCopyState)
    return NS_ERROR_OUT_OF_MEMORY;

  uint32_t readCount;
  //allocate one extra byte for '\0' at the end and another extra byte at the
  //front to insert a '>' if we have a "From" line
  //allocate 2 more for crlf that may be needed for those without crlf at end of file
  if ( aLength + mCopyState->m_leftOver + 4 > mCopyState->m_dataBufferSize )
  {
    char *newBuffer = (char *) PR_REALLOC(mCopyState->m_dataBuffer, aLength + mCopyState->m_leftOver + 4);
    if (!newBuffer)
      return NS_ERROR_OUT_OF_MEMORY;

    mCopyState->m_dataBuffer = newBuffer;
    mCopyState->m_dataBufferSize = aLength + mCopyState->m_leftOver + 3;
  }

  nsCOMPtr <nsISeekableStream> seekableStream = do_QueryInterface(mCopyState->m_fileStream, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  seekableStream->Seek(nsISeekableStream::NS_SEEK_END, 0);

  rv = aIStream->Read(mCopyState->m_dataBuffer + mCopyState->m_leftOver + 1, aLength, &readCount);
  NS_ENSURE_SUCCESS(rv, rv);
  mCopyState->m_leftOver += readCount;
  mCopyState->m_dataBuffer[mCopyState->m_leftOver + 1] ='\0';
  char *start = mCopyState->m_dataBuffer + 1;
  char *endBuffer = mCopyState->m_dataBuffer + mCopyState->m_leftOver + 1;

  uint32_t lineLength;
  uint32_t bytesWritten;

  while (1)
  {
    char *end = PL_strnpbrk(start, "\r\n", endBuffer - start);
    if (!end)
    {
      mCopyState->m_leftOver -= (start - mCopyState->m_dataBuffer - 1);
      // In CopyFileMessage, a complete message is being copied in a single
      // call to CopyData, and if it does not have a LINEBREAK at the EOF,
      // then end will be null after reading the last line, and we need
      // to append the LINEBREAK to the buffer to enable transfer of the last line.
      if (mCopyState->m_wholeMsgInStream)
      {
        end = start + mCopyState->m_leftOver;
        memcpy (end, MSG_LINEBREAK + '\0', MSG_LINEBREAK_LEN + 1);
      }
      else
      {
        memmove (mCopyState->m_dataBuffer + 1, start, mCopyState->m_leftOver);
        break;
      }
    }

    //need to set the linebreak_len each time
    uint32_t linebreak_len = 1; //assume CR or LF
    if (*end == '\r' && *(end+1) == '\n')
      linebreak_len = 2;  //CRLF

    if (!mCopyState->m_fromLineSeen)
    {
      mCopyState->m_fromLineSeen = true;
      NS_ASSERTION(strncmp(start, "From ", 5) == 0,
        "Fatal ... bad message format\n");
    }
    else if (strncmp(start, "From ", 5) == 0)
    {
      //if we're at the beginning of the buffer, we've reserved a byte to
      //insert a '>'.  If we're in the middle, we're overwriting the previous
      //line ending, but we've already written it to m_fileStream, so it's OK.
      *--start = '>';
    }

    lineLength = end - start + linebreak_len;
    rv = mCopyState->m_fileStream->Write(start, lineLength, &bytesWritten);
    if (bytesWritten != lineLength || NS_FAILED(rv))
    {
      ThrowAlertMsg("copyMsgWriteFailed", mCopyState->m_msgWindow);
      mCopyState->m_writeFailed = true;
      return NS_MSG_ERROR_WRITING_MAIL_FOLDER;
    }

    if (mCopyState->m_parseMsgState)
      mCopyState->m_parseMsgState->ParseAFolderLine(start, lineLength);

    start = end + linebreak_len;
    if (start >= endBuffer)
    {
      mCopyState->m_leftOver = 0;
      break;
    }
  }
  return rv;
}

void nsMsgLocalMailFolder::CopyPropertiesToMsgHdr(nsIMsgDBHdr *destHdr,
                                                  nsIMsgDBHdr *srcHdr,
                                                  bool aIsMove)
{
  nsresult rv;
  nsCOMPtr<nsIPrefBranch> prefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS_VOID(rv);

  nsCString dontPreserve;

  // These preferences exist so that extensions can control which properties
  // are preserved in the database when a message is moved or copied. All
  // properties are preserved except those listed in these preferences
  if (aIsMove)
    prefBranch->GetCharPref("mailnews.database.summary.dontPreserveOnMove",
                            getter_Copies(dontPreserve));
  else
    prefBranch->GetCharPref("mailnews.database.summary.dontPreserveOnCopy",
                            getter_Copies(dontPreserve));

  CopyHdrPropertiesWithSkipList(destHdr, srcHdr, dontPreserve);
}

void
nsMsgLocalMailFolder::CopyHdrPropertiesWithSkipList(nsIMsgDBHdr *destHdr,
                                                    nsIMsgDBHdr *srcHdr,
                                                    const nsCString &skipList)
{
  nsCOMPtr<nsIUTF8StringEnumerator> propertyEnumerator;
  nsresult rv = srcHdr->GetPropertyEnumerator(getter_AddRefs(propertyEnumerator));
  NS_ENSURE_SUCCESS_VOID(rv);

  // We'll add spaces at beginning and end so we can search for space-name-space
  nsCString dontPreserveEx(NS_LITERAL_CSTRING(" "));
  dontPreserveEx.Append(skipList);
  dontPreserveEx.AppendLiteral(" ");

  nsAutoCString property;
  nsCString sourceString;
  bool hasMore;
  while (NS_SUCCEEDED(propertyEnumerator->HasMore(&hasMore)) && hasMore)
  {
    propertyEnumerator->GetNext(property);
    nsAutoCString propertyEx(NS_LITERAL_CSTRING(" "));
    propertyEx.Append(property);
    propertyEx.AppendLiteral(" ");
    if (dontPreserveEx.Find(propertyEx) != -1) // -1 is not found
      continue;

    srcHdr->GetStringProperty(property.get(), getter_Copies(sourceString));
    destHdr->SetStringProperty(property.get(), sourceString.get());
  }

  nsMsgLabelValue label = 0;
  srcHdr->GetLabel(&label);
  destHdr->SetLabel(label);
}

NS_IMETHODIMP nsMsgLocalMailFolder::EndCopy(bool aCopySucceeded)
{
  if (!mCopyState)
    return NS_OK;

  // we are the destination folder for a move/copy
  nsresult rv = aCopySucceeded ? NS_OK : NS_ERROR_FAILURE;

  if (!aCopySucceeded || mCopyState->m_writeFailed)
  {
    if (mCopyState->m_curDstKey != nsMsgKey_None)
      mCopyState->m_msgStore->DiscardNewMessage(mCopyState->m_fileStream,
                                                mCopyState->m_newHdr);

    if (mCopyState->m_fileStream)
      mCopyState->m_fileStream->Close();

    if (!mCopyState->m_isMove)
    {
      // passing true because the messages that have been successfully 
      // copied have their corresponding hdrs in place. The message that has 
      // failed has been truncated so the msf file and berkeley mailbox 
      // are in sync.
      (void) OnCopyCompleted(mCopyState->m_srcSupport, true);
      // enable the dest folder
      EnableNotifications(allMessageCountNotifications, true, false /*dbBatching*/); //dest folder doesn't need db batching
    }
    return NS_OK;
  }

  bool multipleCopiesFinished = (mCopyState->m_curCopyIndex >= mCopyState->m_totalMsgCount);

  nsRefPtr<nsLocalMoveCopyMsgTxn> localUndoTxn = mCopyState->m_undoMsgTxn;

  nsCOMPtr <nsISeekableStream> seekableStream;
  NS_ASSERTION(mCopyState->m_leftOver == 0, "whoops, something wrong with previous copy");
  mCopyState->m_leftOver = 0; // reset to 0.
  // need to reset this in case we're move/copying multiple msgs.
  mCopyState->m_fromLineSeen = false;

  // flush the copied message. We need a close at the end to get the
  // file size and time updated correctly.
  if (mCopyState->m_fileStream)
  {
    seekableStream = do_QueryInterface(mCopyState->m_fileStream);
    if (mCopyState->m_dummyEnvelopeNeeded)
    {
      uint32_t bytesWritten;
      seekableStream->Seek(nsISeekableStream::NS_SEEK_END, 0);
      mCopyState->m_fileStream->Write(MSG_LINEBREAK, MSG_LINEBREAK_LEN, &bytesWritten);
      if (mCopyState->m_parseMsgState)
        mCopyState->m_parseMsgState->ParseAFolderLine(CRLF, MSG_LINEBREAK_LEN);
    }
    // flush the copied message. We need a close at the end to get the
    // file size and time updated correctly.
    seekableStream = do_QueryInterface(mCopyState->m_fileStream);
    if (mCopyState->m_dummyEnvelopeNeeded)
    {
      uint32_t bytesWritten;
      seekableStream->Seek(nsISeekableStream::NS_SEEK_END, 0);
      mCopyState->m_fileStream->Write(MSG_LINEBREAK, MSG_LINEBREAK_LEN,
                                      &bytesWritten);
      if (mCopyState->m_parseMsgState)
        mCopyState->m_parseMsgState->ParseAFolderLine(CRLF, MSG_LINEBREAK_LEN);
    }
    // flush the copied message. We need a close at the end to get the
    // file size and time updated correctly.
    rv = mCopyState->m_msgStore->FinishNewMessage(mCopyState->m_fileStream,
                                             mCopyState->m_newHdr);
    if (NS_SUCCEEDED(rv) && mCopyState->m_newHdr)
      mCopyState->m_newHdr->GetMessageKey(&mCopyState->m_curDstKey);
    if (multipleCopiesFinished)
      mCopyState->m_fileStream->Close();
    else
      mCopyState->m_fileStream->Flush();
    mCopyState->m_msgStore->FinishNewMessage(mCopyState->m_fileStream,
                                             mCopyState->m_newHdr);
  }
  //Copy the header to the new database
  if (mCopyState->m_message)
  {
    //  CopyMessages() goes here, and CopyFileMessages() with metadata to save;
    nsCOMPtr<nsIMsgDBHdr> newHdr;
    if (!mCopyState->m_parseMsgState)
    {
      if (mCopyState->m_destDB)
      {
        if (mCopyState->m_newHdr)
        {
          newHdr = mCopyState->m_newHdr;
          CopyHdrPropertiesWithSkipList(newHdr, mCopyState->m_message,
                                        NS_LITERAL_CSTRING("storeToken msgOffset"));
//          UpdateNewMsgHdr(mCopyState->m_message, newHdr);
          // We need to copy more than just what UpdateNewMsgHdr does. In fact,
          // I think we want to copy almost every property other than
          // storeToken and msgOffset.
          mCopyState->m_destDB->AddNewHdrToDB(newHdr, true);
        }
        else
        {
        rv = mCopyState->m_destDB->CopyHdrFromExistingHdr(mCopyState->m_curDstKey,
          mCopyState->m_message, true,
          getter_AddRefs(newHdr));
        }
        uint32_t newHdrFlags;
        if (newHdr)
        {
          // turn off offline flag - it's not valid for local mail folders.
          newHdr->AndFlags(~nsMsgMessageFlags::Offline, &newHdrFlags);
          mCopyState->m_destMessages->AppendElement(newHdr, false);
        }
      }
      // we can do undo with the dest folder db, see bug #198909
      //else
      //  mCopyState->m_undoMsgTxn = nullptr; //null out the transaction because we can't undo w/o the msg db
    }

    // if we plan on allowing undo, (if we have a mCopyState->m_parseMsgState or not)
    // we need to save the source and dest keys on the undo txn.
    // see bug #179856 for details
    bool isImap;
    if (NS_SUCCEEDED(rv) && localUndoTxn) {
      localUndoTxn->GetSrcIsImap(&isImap);
      if (!isImap || !mCopyState->m_copyingMultipleMessages)
      {
        nsMsgKey aKey;
        uint32_t statusOffset;
        mCopyState->m_message->GetMessageKey(&aKey);
        mCopyState->m_message->GetStatusOffset(&statusOffset);
        localUndoTxn->AddSrcKey(aKey);
        localUndoTxn->AddSrcStatusOffset(statusOffset);
        localUndoTxn->AddDstKey(mCopyState->m_curDstKey);
      }
    }
  }
  nsCOMPtr<nsIMsgDBHdr> newHdr;
  // CopyFileMessage() and CopyMessages() from servers other than mailbox
  if (mCopyState->m_parseMsgState)
  {
    nsCOMPtr<nsIMsgDatabase> msgDb;
    mCopyState->m_parseMsgState->FinishHeader();
    GetDatabaseWOReparse(getter_AddRefs(msgDb));
    if (msgDb)
    {
      nsresult result = mCopyState->m_parseMsgState->GetNewMsgHdr(getter_AddRefs(newHdr));
      // we need to copy newHdr because mCopyState will get cleared 
      // in OnCopyCompleted, but we need OnCopyCompleted to know about
      // the newHdr, via mCopyState. And we send a notification about newHdr
      // after OnCopyCompleted.
      mCopyState->m_newHdr = newHdr;
      if (NS_SUCCEEDED(result) && newHdr)
      {
        // Copy message metadata.
        if (mCopyState->m_message)
        {
          // Propagate the new flag on an imap to local folder filter action
          // Flags may get changed when deleting the original source message in
          // IMAP. We have a copy of the original flags, but parseMsgState has
          // already tried to decide what those flags should be. Who to believe?
          // Let's only deal here with the flags that might get changed, Read
          // and New, and trust upstream code for everything else.
          uint32_t readAndNew = nsMsgMessageFlags::New | nsMsgMessageFlags::Read;
          uint32_t newFlags;
          newHdr->GetFlags(&newFlags);
          newHdr->SetFlags( (newFlags & ~readAndNew) | 
                            ((mCopyState->m_flags) & readAndNew));

          // Copy other message properties.
          CopyPropertiesToMsgHdr(newHdr, mCopyState->m_message, mCopyState->m_isMove);
        }
        msgDb->AddNewHdrToDB(newHdr, true);
        if (localUndoTxn)
        {
          // ** jt - recording the message size for possible undo use; the
          // message size is different for pop3 and imap4 messages
          uint32_t msgSize;
          newHdr->GetMessageSize(&msgSize);
          localUndoTxn->AddDstMsgSize(msgSize);
        }

        mCopyState->m_destMessages->AppendElement(newHdr, false);
      }
      // msgDb->SetSummaryValid(true);
      // msgDb->Commit(nsMsgDBCommitType::kLargeCommit);
    }
    else
      mCopyState->m_undoMsgTxn = nullptr; //null out the transaction because we can't undo w/o the msg db

    mCopyState->m_parseMsgState->Clear();
    if (mCopyState->m_listener) // CopyFileMessage() only
      mCopyState->m_listener->SetMessageKey((uint32_t) mCopyState->m_curDstKey);
  }

  if (!multipleCopiesFinished && !mCopyState->m_copyingMultipleMessages)
  {
    // CopyMessages() goes here; CopyFileMessage() never gets in here because
    // curCopyIndex will always be less than the mCopyState->m_totalMsgCount
    nsCOMPtr<nsISupports> aSupport = do_QueryElementAt(mCopyState->m_messages, mCopyState->m_curCopyIndex);
    rv = CopyMessageTo(aSupport, this, mCopyState->m_msgWindow, mCopyState->m_isMove);
  }
  else
  {
    // If we have some headers, then there is a source, so notify itemMoveCopyCompleted.
    // If we don't have any headers already, (eg save as draft, send) then notify itemAdded.
    // This notification is done after the messages are deleted, so that saving a new draft
    // of a message works correctly -- first an itemDeleted is sent for the old draft, then
    // an itemAdded for the new draft.
    uint32_t numHdrs;
    mCopyState->m_messages->GetLength(&numHdrs);

    if (multipleCopiesFinished && numHdrs && !mCopyState->m_isFolder)
    {
      // we need to send this notification before we delete the source messages,
      // because deleting the source messages clears out the src msg db hdr.
      nsCOMPtr<nsIMsgFolderNotificationService> notifier(do_GetService(NS_MSGNOTIFICATIONSERVICE_CONTRACTID));
      if (notifier)
        notifier->NotifyMsgsMoveCopyCompleted(mCopyState->m_isMove,
                                              mCopyState->m_messages,
                                              this, mCopyState->m_destMessages);
    }

    if (!mCopyState->m_isMove)
    {
      if (multipleCopiesFinished)
      {
        nsCOMPtr<nsIMsgFolder> srcFolder;
        srcFolder = do_QueryInterface(mCopyState->m_srcSupport);
        if (mCopyState->m_isFolder)
          CopyAllSubFolders(srcFolder, nullptr, nullptr);  //Copy all subfolders then notify completion

        if (mCopyState->m_msgWindow && mCopyState->m_undoMsgTxn)
        {
          nsCOMPtr<nsITransactionManager> txnMgr;
          mCopyState->m_msgWindow->GetTransactionManager(getter_AddRefs(txnMgr));
          if (txnMgr)
            txnMgr->DoTransaction(mCopyState->m_undoMsgTxn);
        }

        // enable the dest folder
        EnableNotifications(allMessageCountNotifications, true, false /*dbBatching*/); //dest folder doesn't need db batching
        if (srcFolder && !mCopyState->m_isFolder)
        {
          // I'm not too sure of the proper location of this event. It seems to need to be
          // after the EnableNotifications, or the folder counts can be incorrect
          // during the mDeleteOrMoveMsgCompletedAtom call.
          srcFolder->NotifyFolderEvent(mDeleteOrMoveMsgCompletedAtom);
        }
        (void) OnCopyCompleted(mCopyState->m_srcSupport, true);
      }
    }
    // Send the itemAdded notification in case we didn't send the itemMoveCopyCompleted notification earlier.
    // Posting news messages involves this, yet doesn't have the newHdr initialized, so don't send any
    // notifications in that case.
    if (!numHdrs && newHdr)
    {
      nsCOMPtr<nsIMsgFolderNotificationService> notifier(do_GetService(NS_MSGNOTIFICATIONSERVICE_CONTRACTID));
      if (notifier)
      {
        notifier->NotifyMsgAdded(newHdr);
        // We do not appear to trigger classification in this case, so let's
        // paper over the abyss by just sending the classification notification.
        nsCOMPtr <nsIMutableArray> oneHeaderArray =
          do_CreateInstance(NS_ARRAY_CONTRACTID);
        oneHeaderArray->AppendElement(newHdr, false);
        notifier->NotifyMsgsClassified(oneHeaderArray, false, false);
        // (We do not add the NotReportedClassified processing flag since we
        // just reported it!)
      }
    }
  }
  return rv;
}

static bool gGotGlobalPrefs;
static bool gDeleteFromServerOnMove;

bool nsMsgLocalMailFolder::GetDeleteFromServerOnMove()
{
  if (!gGotGlobalPrefs)
  {
    nsCOMPtr<nsIPrefBranch> pPrefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID));
    if (pPrefBranch)
    {
      pPrefBranch->GetBoolPref("mail.pop3.deleteFromServerOnMove", &gDeleteFromServerOnMove);
      gGotGlobalPrefs = true;
    }
  }
  return gDeleteFromServerOnMove;
}

NS_IMETHODIMP nsMsgLocalMailFolder::EndMove(bool moveSucceeded)
{
  nsresult rv;
  if (!mCopyState)
    return NS_OK;

  if (!moveSucceeded || mCopyState->m_writeFailed)
  {
    //Notify that a completion finished.
    nsCOMPtr<nsIMsgFolder> srcFolder = do_QueryInterface(mCopyState->m_srcSupport, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    srcFolder->NotifyFolderEvent(mDeleteOrMoveMsgFailedAtom);

    /* passing true because the messages that have been successfully copied have their corressponding
               hdrs in place. The message that has failed has been truncated so the msf file and berkeley mailbox
               are in sync*/

    (void) OnCopyCompleted(mCopyState->m_srcSupport, true);
    // enable the dest folder
    EnableNotifications(allMessageCountNotifications, true, false /*dbBatching*/ );  //dest folder doesn't need db batching
    return NS_OK;
  }

  if (mCopyState && mCopyState->m_curCopyIndex >= mCopyState->m_totalMsgCount)
  {
    //Notify that a completion finished.
    nsCOMPtr<nsIMsgFolder> srcFolder = do_QueryInterface(mCopyState->m_srcSupport, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    nsCOMPtr <nsIMsgLocalMailFolder> localSrcFolder = do_QueryInterface(srcFolder);
    if (localSrcFolder)
    {
      // if we are the trash and a local msg is being moved to us, mark the source
      // for delete from server, if so configured.
      if (mFlags & nsMsgFolderFlags::Trash)
      {
        // if we're deleting on all moves, we'll mark this message for deletion when
        // we call DeleteMessages on the source folder. So don't mark it for deletion
        // here, in that case.
        if (!GetDeleteFromServerOnMove())
          localSrcFolder->MarkMsgsOnPop3Server(mCopyState->m_messages, POP3_DELETE);
      }
    }
    // lets delete these all at once - much faster that way
    rv = srcFolder->DeleteMessages(mCopyState->m_messages, mCopyState->m_msgWindow, true, true, nullptr, mCopyState->m_allowUndo);
    AutoCompact(mCopyState->m_msgWindow);

    // enable the dest folder
    EnableNotifications(allMessageCountNotifications, true, false /*dbBatching*/); //dest folder doesn't need db batching
    // I'm not too sure of the proper location of this event. It seems to need to be
    // after the EnableNotifications, or the folder counts can be incorrect
    // during the mDeleteOrMoveMsgCompletedAtom call.
    srcFolder->NotifyFolderEvent(NS_SUCCEEDED(rv) ? mDeleteOrMoveMsgCompletedAtom : mDeleteOrMoveMsgFailedAtom);

    if (NS_SUCCEEDED(rv) && mCopyState->m_msgWindow && mCopyState->m_undoMsgTxn)
    {
      nsCOMPtr<nsITransactionManager> txnMgr;
      mCopyState->m_msgWindow->GetTransactionManager(getter_AddRefs(txnMgr));
      if (txnMgr)
        txnMgr->DoTransaction(mCopyState->m_undoMsgTxn);
    }
    (void) OnCopyCompleted(mCopyState->m_srcSupport, NS_SUCCEEDED(rv) ? true : false);  //clear the copy state so that the next message from a different folder can be move
  }

  return NS_OK;

}

// this is the beginning of the next message copied
NS_IMETHODIMP nsMsgLocalMailFolder::StartMessage()
{
  // We get crashes that we don't understand (bug 284876), so stupidly prevent that.
  NS_ENSURE_ARG_POINTER(mCopyState);
  nsresult rv = InitCopyMsgHdrAndFileStream();
  NS_ENSURE_SUCCESS(rv, rv);
  return WriteStartOfNewMessage();
}

// just finished the current message.
NS_IMETHODIMP nsMsgLocalMailFolder::EndMessage(nsMsgKey key)
{
  NS_ENSURE_ARG_POINTER(mCopyState);

  nsRefPtr<nsLocalMoveCopyMsgTxn> localUndoTxn = mCopyState->m_undoMsgTxn;
  nsCOMPtr<nsIMsgWindow> msgWindow;
  nsresult rv;

  if (localUndoTxn)
  {
    localUndoTxn->GetMsgWindow(getter_AddRefs(msgWindow));
    localUndoTxn->AddSrcKey(key);
    localUndoTxn->AddDstKey(mCopyState->m_curDstKey);
  }

  // I think this is always true for online to offline copy
  mCopyState->m_dummyEnvelopeNeeded = true;
  nsCOMPtr <nsISeekableStream> seekableStream = do_QueryInterface(mCopyState->m_fileStream, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  seekableStream->Seek(nsISeekableStream::NS_SEEK_END, 0);
  uint32_t bytesWritten;
  mCopyState->m_fileStream->Write(MSG_LINEBREAK, MSG_LINEBREAK_LEN, &bytesWritten);
  if (mCopyState->m_parseMsgState)
    mCopyState->m_parseMsgState->ParseAFolderLine(CRLF, MSG_LINEBREAK_LEN);

  // CopyFileMessage() and CopyMessages() from servers other than mailbox
  if (mCopyState->m_parseMsgState)
  {
    nsCOMPtr<nsIMsgDatabase> msgDb;
    nsCOMPtr<nsIMsgDBHdr> newHdr;

    mCopyState->m_parseMsgState->FinishHeader();

    rv = mCopyState->m_parseMsgState->GetNewMsgHdr(getter_AddRefs(newHdr));
    if (NS_SUCCEEDED(rv) && newHdr)
    {
      nsCOMPtr<nsIMsgFolder> srcFolder = do_QueryInterface(mCopyState->m_srcSupport, &rv);
      NS_ENSURE_SUCCESS(rv, rv);
      nsCOMPtr<nsIMsgDatabase> srcDB;
      srcFolder->GetMsgDatabase(getter_AddRefs(srcDB));
      if (srcDB)
      {
        nsCOMPtr <nsIMsgDBHdr> srcMsgHdr;
        srcDB->GetMsgHdrForKey(key, getter_AddRefs(srcMsgHdr));
        if (srcMsgHdr)
          CopyPropertiesToMsgHdr(newHdr, srcMsgHdr, mCopyState->m_isMove);
      }
      rv = GetDatabaseWOReparse(getter_AddRefs(msgDb));
      if (NS_SUCCEEDED(rv) && msgDb)
      {
        msgDb->AddNewHdrToDB(newHdr, true);
        if (localUndoTxn)
        {
          // ** jt - recording the message size for possible undo use; the
          // message size is different for pop3 and imap4 messages
          uint32_t msgSize;
          newHdr->GetMessageSize(&msgSize);
          localUndoTxn->AddDstMsgSize(msgSize);
        }
      }
      else
        mCopyState->m_undoMsgTxn = nullptr; //null out the transaction because we can't undo w/o the msg db
    }
    mCopyState->m_parseMsgState->Clear();

    if (mCopyState->m_listener) // CopyFileMessage() only
      mCopyState->m_listener->SetMessageKey((uint32_t) mCopyState->m_curDstKey);
  }

  if (mCopyState->m_fileStream)
    mCopyState->m_fileStream->Flush();
  return NS_OK;
}


nsresult nsMsgLocalMailFolder::CopyMessagesTo(nsIArray *messages, nsTArray<nsMsgKey> &keyArray,
                                             nsIMsgWindow *aMsgWindow, nsIMsgFolder *dstFolder,
                                             bool isMove)
{
  if (!mCopyState)
    return NS_ERROR_OUT_OF_MEMORY;

  nsresult rv;

  nsCOMPtr<nsICopyMessageStreamListener> copyStreamListener = do_CreateInstance(NS_COPYMESSAGESTREAMLISTENER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr<nsICopyMessageListener> copyListener(do_QueryInterface(dstFolder, &rv));
  NS_ENSURE_SUCCESS(rv, NS_ERROR_NO_INTERFACE);

  nsCOMPtr<nsIMsgFolder> srcFolder(do_QueryInterface(mCopyState->m_srcSupport, &rv));
  NS_ENSURE_SUCCESS(rv, NS_ERROR_NO_INTERFACE);

  rv = copyStreamListener->Init(srcFolder, copyListener, nullptr);
  if (NS_FAILED(rv))
    return rv;

  if (!mCopyState->m_messageService)
  {
    nsCString uri;
    srcFolder->GetURI(uri);
    rv = GetMessageServiceFromURI(uri, getter_AddRefs(mCopyState->m_messageService));
  }

  if (NS_SUCCEEDED(rv) && mCopyState->m_messageService)
  {
    nsCOMPtr<nsIStreamListener> streamListener(do_QueryInterface(copyStreamListener, &rv));
    NS_ENSURE_SUCCESS(rv, NS_ERROR_NO_INTERFACE);

    mCopyState->m_curCopyIndex = 0;
    // we need to kick off the first message - subsequent messages
    // are kicked off by nsMailboxProtocol when it finishes a message
    // before starting the next message. Only do this if the source folder
    // is a local folder, however. IMAP will handle calling StartMessage for
    // each message that gets downloaded, and news doesn't go through here
    // because news only downloads one message at a time, and this routine
    // is for multiple message copy.
    nsCOMPtr <nsIMsgLocalMailFolder> srcLocalFolder = do_QueryInterface(srcFolder);
    if (srcLocalFolder)
      StartMessage();
    rv = mCopyState->m_messageService->CopyMessages(keyArray.Length(),
                                                    keyArray.Elements(),
                                                    srcFolder, streamListener,
                                                    isMove, nullptr, aMsgWindow,
                                                    nullptr);
  }
  return rv;
}

nsresult nsMsgLocalMailFolder::CopyMessageTo(nsISupports *message,
                                             nsIMsgFolder *dstFolder /* dst same as "this" */,
                                             nsIMsgWindow *aMsgWindow,
                                             bool isMove)
{
  if (!mCopyState)
    return NS_ERROR_OUT_OF_MEMORY;

  nsresult rv;
  nsCOMPtr<nsIMsgDBHdr> msgHdr(do_QueryInterface(message, &rv));
  NS_ENSURE_SUCCESS(rv, NS_ERROR_NO_INTERFACE);

  mCopyState->m_message = do_QueryInterface(msgHdr, &rv);

  nsCOMPtr<nsIMsgFolder> srcFolder(do_QueryInterface(mCopyState->m_srcSupport, &rv));
  NS_ENSURE_SUCCESS(rv, NS_ERROR_NO_INTERFACE);
  nsCString uri;
  srcFolder->GetUriForMsg(msgHdr, uri);

  nsCOMPtr<nsICopyMessageStreamListener> copyStreamListener = do_CreateInstance(NS_COPYMESSAGESTREAMLISTENER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr<nsICopyMessageListener> copyListener(do_QueryInterface(dstFolder, &rv));
  NS_ENSURE_SUCCESS(rv, NS_ERROR_NO_INTERFACE);

  rv = copyStreamListener->Init(srcFolder, copyListener, nullptr);
  if (NS_FAILED(rv))
    return rv;

  if (!mCopyState->m_messageService)
    rv = GetMessageServiceFromURI(uri, getter_AddRefs(mCopyState->m_messageService));

  if (NS_SUCCEEDED(rv) && mCopyState->m_messageService)
  {
    nsCOMPtr<nsIStreamListener> streamListener(do_QueryInterface(copyStreamListener, &rv));
    NS_ENSURE_SUCCESS(rv, NS_ERROR_NO_INTERFACE);
    rv = mCopyState->m_messageService->CopyMessage(uri.get(), streamListener, isMove, nullptr, aMsgWindow, nullptr);
  }
  return rv;
}

// A message is being deleted from a POP3 mail file, so check and see if we have the message
// being deleted in the server. If so, then we need to remove the message from the server as well.
// We have saved the UIDL of the message in the popstate.dat file and we must match this uidl, so
// read the message headers and see if we have it, then mark the message for deletion from the server.
// The next time we look at mail the message will be deleted from the server.

NS_IMETHODIMP
nsMsgLocalMailFolder::MarkMsgsOnPop3Server(nsIArray *aMessages, int32_t aMark)
{
  nsLocalFolderScanState folderScanState;
  nsCOMPtr<nsIPop3IncomingServer> curFolderPop3MailServer;
  nsCOMArray<nsIPop3IncomingServer> pop3Servers; // servers with msgs deleted...

  nsCOMPtr<nsIMsgIncomingServer> incomingServer;
  nsresult rv = GetServer(getter_AddRefs(incomingServer));
  NS_ENSURE_SUCCESS(rv, NS_MSG_INVALID_OR_MISSING_SERVER);

  nsCOMPtr <nsIMsgAccountManager> accountManager = do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  // I wonder if we should run through the pop3 accounts and see if any of them have
  // leave on server set. If not, we could short-circuit some of this.

  curFolderPop3MailServer = do_QueryInterface(incomingServer, &rv);
  rv = GetFolderScanState(&folderScanState);
  NS_ENSURE_SUCCESS(rv,rv);

  uint32_t srcCount;
  aMessages->GetLength(&srcCount);

  // Filter delete requests are always honored, others are subject
  // to the deleteMailLeftOnServer preference.
  int32_t mark;
  mark = (aMark == POP3_FORCE_DEL) ? POP3_DELETE : aMark;

  for (uint32_t i = 0; i < srcCount; i++)
  {
    /* get uidl for this message */
    nsCOMPtr<nsIMsgDBHdr> msgDBHdr (do_QueryElementAt(aMessages, i, &rv));

    uint32_t flags = 0;

    if (msgDBHdr)
    {
      msgDBHdr->GetFlags(&flags);
      nsCOMPtr <nsIPop3IncomingServer> msgPop3Server = curFolderPop3MailServer;
      bool leaveOnServer = false;
      bool deleteMailLeftOnServer = false;
      // set up defaults, in case there's no x-mozilla-account header
      if (curFolderPop3MailServer)
      {
        curFolderPop3MailServer->GetDeleteMailLeftOnServer(&deleteMailLeftOnServer);
        curFolderPop3MailServer->GetLeaveMessagesOnServer(&leaveOnServer);
      }

      rv = GetUidlFromFolder(&folderScanState, msgDBHdr);
      if (!NS_SUCCEEDED(rv))
        continue;

      if (folderScanState.m_uidl)
      {
        nsCOMPtr <nsIMsgAccount> account;
        rv = accountManager->GetAccount(folderScanState.m_accountKey, getter_AddRefs(account));
        if (NS_SUCCEEDED(rv) && account)
        {
          account->GetIncomingServer(getter_AddRefs(incomingServer));
          nsCOMPtr<nsIPop3IncomingServer> curMsgPop3MailServer = do_QueryInterface(incomingServer);
          if (curMsgPop3MailServer)
          {
            msgPop3Server = curMsgPop3MailServer;
            msgPop3Server->GetDeleteMailLeftOnServer(&deleteMailLeftOnServer);
            msgPop3Server->GetLeaveMessagesOnServer(&leaveOnServer);
          }
        }
      }
      // ignore this header if not partial and leaveOnServer not set...
      // or if we can't find the pop3 server.
      if (!msgPop3Server || (! (flags & nsMsgMessageFlags::Partial) && !leaveOnServer))
        continue;
      // if marking deleted, ignore header if we're not deleting from
      // server when deleting locally.
      if (aMark == POP3_DELETE && leaveOnServer && !deleteMailLeftOnServer)
        continue;
      if (folderScanState.m_uidl)
      {
        msgPop3Server->AddUidlToMark(folderScanState.m_uidl, mark);
        // remember this pop server in list of servers with msgs deleted
        if (pop3Servers.IndexOfObject(msgPop3Server) == -1)
          pop3Servers.AppendObject(msgPop3Server);
      }
    }
  }
  if (folderScanState.m_inputStream)
    folderScanState.m_inputStream->Close();
  // need to do this for all pop3 mail servers that had messages deleted.
  uint32_t serverCount = pop3Servers.Count();
  for (uint32_t index = 0; index < serverCount; index++)
    pop3Servers[index]->MarkMessages();

  return rv;
}

NS_IMETHODIMP nsMsgLocalMailFolder::DeleteDownloadMsg(nsIMsgDBHdr *aMsgHdr, bool *aDoSelect)
{
  uint32_t numMsgs;
  char *newMsgId;

  // This method is only invoked thru DownloadMessagesForOffline()
  if (mDownloadState != DOWNLOAD_STATE_NONE)
  {
    // We only remember the first key, no matter how many
    // messages were originally selected.
    if (mDownloadState == DOWNLOAD_STATE_INITED)
    {
      aMsgHdr->GetMessageKey(&mDownloadSelectKey);
      mDownloadState = DOWNLOAD_STATE_GOTMSG;
    }

    aMsgHdr->GetMessageId(&newMsgId);

    // Walk through all the selected headers, looking for a matching
    // Message-ID.
    numMsgs = mDownloadMessages.Length();
    for (uint32_t i = 0; i < numMsgs; i++)
    {
      nsresult rv;
      nsCOMPtr<nsIMsgDBHdr> msgDBHdr = mDownloadMessages[i];
      char *oldMsgId = nullptr;
      msgDBHdr->GetMessageId(&oldMsgId);

      // Delete the first match and remove it from the array
      if (!PL_strcmp(newMsgId, oldMsgId))
      {
        rv = GetDatabase();
        if (!mDatabase)
          return rv;

        UpdateNewMsgHdr(msgDBHdr, aMsgHdr);

#if DOWNLOAD_NOTIFY_STYLE == DOWNLOAD_NOTIFY_LAST
        msgDBHdr->GetMessageKey(&mDownloadOldKey);
        msgDBHdr->GetThreadParent(&mDownloadOldParent);
        msgDBHdr->GetFlags(&mDownloadOldFlags);
        mDatabase->DeleteHeader(msgDBHdr, nullptr, false, false);
        // Tell caller we want to select this message
        if (aDoSelect)
          *aDoSelect = true;
#else
        mDatabase->DeleteHeader(msgDBHdr, nullptr, false, true);
        // Tell caller we want to select this message
        if (aDoSelect && mDownloadState == DOWNLOAD_STATE_GOTMSG)
          *aDoSelect = true;
#endif
        mDownloadMessages.RemoveElementAt(i);
        break;
      }
    }
  }

  return NS_OK;
}

NS_IMETHODIMP nsMsgLocalMailFolder::SelectDownloadMsg()
{
#if DOWNLOAD_NOTIFY_STYLE == DOWNLOAD_NOTIFY_LAST
  if (mDownloadState >= DOWNLOAD_STATE_GOTMSG)
  {
    nsresult rv = GetDatabase();
    if (!mDatabase)
      return rv;
    }
    mDatabase->NotifyKeyDeletedAll(mDownloadOldKey, mDownloadOldParent, mDownloadOldFlags, nullptr);
  }
#endif

  if (mDownloadState == DOWNLOAD_STATE_GOTMSG && mDownloadWindow)
  {
    nsAutoCString newuri;
    nsBuildLocalMessageURI(mBaseMessageURI.get(), mDownloadSelectKey, newuri);
    nsCOMPtr<nsIMsgWindowCommands> windowCommands;
    mDownloadWindow->GetWindowCommands(getter_AddRefs(windowCommands));
    if (windowCommands)
      windowCommands->SelectMessage(newuri);
    mDownloadState = DOWNLOAD_STATE_DIDSEL;
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgLocalMailFolder::DownloadMessagesForOffline(nsIArray *aMessages, nsIMsgWindow *aWindow)
{
  if (mDownloadState != DOWNLOAD_STATE_NONE)
    return NS_ERROR_FAILURE; // already has a download in progress

  // We're starting a download...
  mDownloadState = DOWNLOAD_STATE_INITED;

  MarkMsgsOnPop3Server(aMessages, POP3_FETCH_BODY);

  // Pull out all the PARTIAL messages into a new array
  uint32_t srcCount;
  aMessages->GetLength(&srcCount);

  nsresult rv;
  for (uint32_t i = 0; i < srcCount; i++)
  {
    nsCOMPtr<nsIMsgDBHdr> msgDBHdr (do_QueryElementAt(aMessages, i, &rv));
    if (NS_SUCCEEDED(rv))
    {
      uint32_t flags = 0;
      msgDBHdr->GetFlags(&flags);
      if (flags & nsMsgMessageFlags::Partial)
        mDownloadMessages.AppendElement(msgDBHdr);
    }
  }
  mDownloadWindow = aWindow;

  nsCOMPtr<nsIMsgIncomingServer> server;
  rv = GetServer(getter_AddRefs(server));
  NS_ENSURE_SUCCESS(rv, NS_MSG_INVALID_OR_MISSING_SERVER);

  nsCOMPtr<nsILocalMailIncomingServer> localMailServer = do_QueryInterface(server, &rv);
  NS_ENSURE_SUCCESS(rv, NS_MSG_INVALID_OR_MISSING_SERVER);
  return localMailServer->GetNewMail(aWindow, this, this, nullptr);
}

NS_IMETHODIMP nsMsgLocalMailFolder::NotifyDelete()
{
  NotifyFolderEvent(mDeleteOrMoveMsgCompletedAtom);
  return NS_OK;
}

// TODO:  once we move certain code into the IncomingServer (search for TODO)
// this method will go away.
// sometimes this gets called when we don't have the server yet, so
// that's why we're not calling GetServer()
void
nsMsgLocalMailFolder::GetIncomingServerType(nsCString& aServerType)
{
  nsresult rv;
  if (mType.IsEmpty())
  {
    nsCOMPtr<nsIURL> url = do_CreateInstance(NS_STANDARDURL_CONTRACTID, &rv);
    if (NS_FAILED(rv))
      return;

    rv = url->SetSpec(mURI);
    if (NS_FAILED(rv))
      return;

    nsCOMPtr<nsIMsgAccountManager> accountManager =
             do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
    if (NS_FAILED(rv))
      return;

    nsCOMPtr<nsIMsgIncomingServer> server;
    // try "none" first
    url->SetScheme(NS_LITERAL_CSTRING("none"));
    rv = accountManager->FindServerByURI(url, false, getter_AddRefs(server));
    if (NS_SUCCEEDED(rv) && server)
      mType.AssignLiteral("none");
    else
    {
      // next try "pop3"
      url->SetScheme(NS_LITERAL_CSTRING("pop3"));
      rv = accountManager->FindServerByURI(url, false, getter_AddRefs(server));
      if (NS_SUCCEEDED(rv) && server)
        mType.AssignLiteral("pop3");
      else
      {
        // next try "rss"
        url->SetScheme(NS_LITERAL_CSTRING("rss"));
        rv = accountManager->FindServerByURI(url, false, getter_AddRefs(server));
        if (NS_SUCCEEDED(rv) && server)
          mType.AssignLiteral("rss");
        else
        {
#ifdef HAVE_MOVEMAIL
          // next try "movemail"
          url->SetScheme(NS_LITERAL_CSTRING("movemail"));
          rv = accountManager->FindServerByURI(url, false, getter_AddRefs(server));
          if (NS_SUCCEEDED(rv) && server)
            mType.AssignLiteral("movemail");
#endif /* HAVE_MOVEMAIL */
        }
      }
    }
  }
  aServerType = mType;
}

nsresult nsMsgLocalMailFolder::CreateBaseMessageURI(const nsACString& aURI)
{
  return nsCreateLocalBaseMessageURI(aURI, mBaseMessageURI);
}

NS_IMETHODIMP
nsMsgLocalMailFolder::OnStartRunningUrl(nsIURI * aUrl)
{
  nsresult rv;
  nsCOMPtr<nsIPop3URL> popurl = do_QueryInterface(aUrl, &rv);
  if (NS_SUCCEEDED(rv))
  {
    nsAutoCString aSpec;
    aUrl->GetSpec(aSpec);
    if (strstr(aSpec.get(), "uidl="))
    {
      nsCOMPtr<nsIPop3Sink> popsink;
      rv = popurl->GetPop3Sink(getter_AddRefs(popsink));
      if (NS_SUCCEEDED(rv))
      {
        popsink->SetBaseMessageUri(mBaseMessageURI.get());
        nsCString messageuri;
        popurl->GetMessageUri(getter_Copies(messageuri));
        popsink->SetOrigMessageUri(messageuri);
      }
    }
  }
  return nsMsgDBFolder::OnStartRunningUrl(aUrl);
}

NS_IMETHODIMP
nsMsgLocalMailFolder::OnStopRunningUrl(nsIURI * aUrl, nsresult aExitCode)
{
  // If we just finished a DownloadMessages call, reset...
  if (mDownloadState != DOWNLOAD_STATE_NONE)
  {
    mDownloadState = DOWNLOAD_STATE_NONE;
    mDownloadMessages.Clear();
    mDownloadWindow = nullptr;
    return nsMsgDBFolder::OnStopRunningUrl(aUrl, aExitCode);
  }

  nsresult rv;
  if (NS_SUCCEEDED(aExitCode))
  {
    nsCOMPtr<nsIMsgMailSession> mailSession = do_GetService(NS_MSGMAILSESSION_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    nsCOMPtr<nsIMsgWindow> msgWindow;
    rv = mailSession->GetTopmostMsgWindow(getter_AddRefs(msgWindow));
    nsAutoCString aSpec;
    if (aUrl)
    aUrl->GetSpec(aSpec);

    if (strstr(aSpec.get(), "uidl="))
    {
      nsCOMPtr<nsIPop3URL> popurl = do_QueryInterface(aUrl, &rv);
      if (NS_SUCCEEDED(rv))
      {
        nsCString messageuri;
        rv = popurl->GetMessageUri(getter_Copies(messageuri));
        if (NS_SUCCEEDED(rv))
        {
          NS_ENSURE_SUCCESS(rv, rv);
          nsCOMPtr <nsIMsgDBHdr> msgDBHdr;
          rv = GetMsgDBHdrFromURI(messageuri.get(), getter_AddRefs(msgDBHdr));
          if (NS_SUCCEEDED(rv))
          {
            GetDatabase();
            if (mDatabase)
              mDatabase->DeleteHeader(msgDBHdr, nullptr, true, true);
          }

          nsCOMPtr<nsIPop3Sink> pop3sink;
          nsCString newMessageUri;
          rv = popurl->GetPop3Sink(getter_AddRefs(pop3sink));
          if (NS_SUCCEEDED(rv))
          {
            pop3sink->GetMessageUri(getter_Copies(newMessageUri));
            if (msgWindow)
            {
              nsCOMPtr<nsIMsgWindowCommands> windowCommands;
              msgWindow->GetWindowCommands(getter_AddRefs(windowCommands));
              if (windowCommands)
                windowCommands->SelectMessage(newMessageUri);
            }
          }
        }
      }
    }

    if (mFlags & nsMsgFolderFlags::Inbox)
    {
      if (mDatabase && mCheckForNewMessagesAfterParsing)
      {
        bool valid;
        mDatabase->GetSummaryValid(&valid);
        if (valid && msgWindow)
          rv = GetNewMessages(msgWindow, nullptr);
        mCheckForNewMessagesAfterParsing = false;
      }
    }
  }

  if (m_parsingFolder)
  {
    // Clear this before calling OnStopRunningUrl, in case the url listener
    // tries to get the database.
    m_parsingFolder = false;
    if (mReparseListener)
    {
      nsCOMPtr<nsIUrlListener> saveReparseListener = mReparseListener;
      mReparseListener = nullptr;
      saveReparseListener->OnStopRunningUrl(aUrl, aExitCode);
    }
  }
  if (mFlags & nsMsgFolderFlags::Inbox)
  {
    // if we are the inbox and running pop url
    nsCOMPtr<nsIPop3URL> popurl = do_QueryInterface(aUrl, &rv);
    if (NS_SUCCEEDED(rv))
    {
      nsCOMPtr<nsIMsgIncomingServer> server;
      GetServer(getter_AddRefs(server));
      // this is the deferred to account, in the global inbox case
      if (server)
        server->SetPerformingBiff(false);  //biff is over
    }
  }
  return nsMsgDBFolder::OnStopRunningUrl(aUrl, aExitCode);
}

nsresult nsMsgLocalMailFolder::DisplayMoveCopyStatusMsg()
{
  nsresult rv = NS_OK;
  if (mCopyState)
  {
    if (!mCopyState->m_statusFeedback)
    {
      // get msgWindow from undo txn
      nsCOMPtr<nsIMsgWindow> msgWindow;
      if (mCopyState->m_undoMsgTxn)
        mCopyState->m_undoMsgTxn->GetMsgWindow(getter_AddRefs(msgWindow));
      if (!msgWindow)
        return NS_OK; // not a fatal error.

      msgWindow->GetStatusFeedback(getter_AddRefs(mCopyState->m_statusFeedback));
    }

    if (!mCopyState->m_stringBundle)
    {
      nsCOMPtr<nsIStringBundleService> bundleService =
        mozilla::services::GetStringBundleService();
      NS_ENSURE_TRUE(bundleService, NS_ERROR_UNEXPECTED);
      rv = bundleService->CreateBundle("chrome://messenger/locale/localMsgs.properties", getter_AddRefs(mCopyState->m_stringBundle));
      NS_ENSURE_SUCCESS(rv, rv);
    }
    if (mCopyState->m_statusFeedback && mCopyState->m_stringBundle)
    {
      nsString folderName;
      GetName(folderName);
      nsAutoString numMsgSoFarString;
      numMsgSoFarString.AppendInt((mCopyState->m_copyingMultipleMessages) ? mCopyState->m_curCopyIndex : 1);

      nsAutoString totalMessagesString;
      totalMessagesString.AppendInt(mCopyState->m_totalMsgCount);
      nsString finalString;
      const PRUnichar * stringArray[] = { numMsgSoFarString.get(), totalMessagesString.get(), folderName.get() };
      rv = mCopyState->m_stringBundle->FormatStringFromName(
        (mCopyState->m_isMove) ?
        NS_LITERAL_STRING("movingMessagesStatus").get() :
        NS_LITERAL_STRING("copyingMessagesStatus").get(),
        stringArray, 3, getter_Copies(finalString));
      int64_t nowMS = PR_IntervalToMilliseconds(PR_IntervalNow());

      // only update status/progress every half second
      if (nowMS - mCopyState->m_lastProgressTime < 500 &&
          mCopyState->m_curCopyIndex < mCopyState->m_totalMsgCount)
        return NS_OK;

      mCopyState->m_lastProgressTime = nowMS;
      mCopyState->m_statusFeedback->ShowStatusString(finalString);
      mCopyState->m_statusFeedback->ShowProgress(mCopyState->m_curCopyIndex * 100 / mCopyState->m_totalMsgCount);
    }
  }
  return rv;
}

NS_IMETHODIMP
nsMsgLocalMailFolder::SetFlagsOnDefaultMailboxes(uint32_t flags)
{
  if (flags & nsMsgFolderFlags::Inbox)
    setSubfolderFlag(NS_LITERAL_STRING("Inbox"), nsMsgFolderFlags::Inbox);

  if (flags & nsMsgFolderFlags::SentMail)
    setSubfolderFlag(NS_LITERAL_STRING("Sent"), nsMsgFolderFlags::SentMail);

  if (flags & nsMsgFolderFlags::Drafts)
    setSubfolderFlag(NS_LITERAL_STRING("Drafts"), nsMsgFolderFlags::Drafts);

  if (flags & nsMsgFolderFlags::Templates)
    setSubfolderFlag(NS_LITERAL_STRING("Templates"), nsMsgFolderFlags::Templates);

  if (flags & nsMsgFolderFlags::Trash)
    setSubfolderFlag(NS_LITERAL_STRING("Trash"), nsMsgFolderFlags::Trash);

  if (flags & nsMsgFolderFlags::Queue)
    setSubfolderFlag(NS_LITERAL_STRING("Unsent Messages"), nsMsgFolderFlags::Queue);

  if (flags & nsMsgFolderFlags::Junk)
    setSubfolderFlag(NS_LITERAL_STRING("Junk"), nsMsgFolderFlags::Junk);

  if (flags & nsMsgFolderFlags::Archive)
    setSubfolderFlag(NS_LITERAL_STRING("Archives"), nsMsgFolderFlags::Archive);

  return NS_OK;
}

nsresult
nsMsgLocalMailFolder::setSubfolderFlag(const nsAString& aFolderName, uint32_t flags)
{
  // FindSubFolder() expects the folder name to be escaped
  // see bug #192043
  nsAutoCString escapedFolderName;
  nsresult rv = NS_MsgEscapeEncodeURLPath(aFolderName, escapedFolderName);
  NS_ENSURE_SUCCESS(rv,rv);
  nsCOMPtr<nsIMsgFolder> msgFolder;
  rv = FindSubFolder(escapedFolderName, getter_AddRefs(msgFolder));
  NS_ENSURE_SUCCESS(rv, rv);

  // we only want to do this if the folder *really* exists,
  // so check if it has a parent. Otherwise, we'll create the
  // .msf file when we don't want to.
  nsCOMPtr <nsIMsgFolder> parent;
  msgFolder->GetParent(getter_AddRefs(parent));
  if (!parent)
    return NS_ERROR_FAILURE;

  rv = msgFolder->SetFlag(flags);
  NS_ENSURE_SUCCESS(rv, rv);
  return msgFolder->SetPrettyName(aFolderName);
}

NS_IMETHODIMP
nsMsgLocalMailFolder::GetCheckForNewMessagesAfterParsing(bool *aCheckForNewMessagesAfterParsing)
{
  NS_ENSURE_ARG_POINTER(aCheckForNewMessagesAfterParsing);
  *aCheckForNewMessagesAfterParsing = mCheckForNewMessagesAfterParsing;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgLocalMailFolder::SetCheckForNewMessagesAfterParsing(bool aCheckForNewMessagesAfterParsing)
{
  mCheckForNewMessagesAfterParsing = aCheckForNewMessagesAfterParsing;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgLocalMailFolder::NotifyCompactCompleted()
{
  mExpungedBytes = 0;
  m_newMsgs.Clear(); // if compacted, m_newMsgs probably aren't valid.
  // if compacted, processing flags probably also aren't valid.
  ClearProcessingFlags();
  (void) RefreshSizeOnDisk();
  (void) CloseDBIfFolderNotOpen();
  nsCOMPtr <nsIAtom> compactCompletedAtom;
  compactCompletedAtom = MsgGetAtom("CompactCompleted");
  NotifyFolderEvent(compactCompletedAtom);
  return NS_OK;
}

NS_IMETHODIMP nsMsgLocalMailFolder::Shutdown(bool shutdownChildren)
{
  mInitialized = false;
  return nsMsgDBFolder::Shutdown(shutdownChildren);
}

NS_IMETHODIMP
nsMsgLocalMailFolder::OnMessageClassified(const char *aMsgURI,
  nsMsgJunkStatus aClassification,
  uint32_t aJunkPercent)

{
  nsCOMPtr<nsIMsgIncomingServer> server;
  nsresult rv = GetServer(getter_AddRefs(server));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsISpamSettings> spamSettings;
  rv = server->GetSpamSettings(getter_AddRefs(spamSettings));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCString spamFolderURI;
  rv = spamSettings->GetSpamFolderURI(getter_Copies(spamFolderURI));
  NS_ENSURE_SUCCESS(rv,rv);

  if (aMsgURI) // not end of batch
  {
    nsCOMPtr <nsIMsgDBHdr> msgHdr;
    rv = GetMsgDBHdrFromURI(aMsgURI, getter_AddRefs(msgHdr));
    NS_ENSURE_SUCCESS(rv, rv);

    nsMsgKey msgKey;
    rv = msgHdr->GetMessageKey(&msgKey);
    NS_ENSURE_SUCCESS(rv, rv);

    // check if this message needs junk classification
    uint32_t processingFlags;
    GetProcessingFlags(msgKey, &processingFlags);

    if (processingFlags & nsMsgProcessingFlags::ClassifyJunk)
    {
      nsMsgDBFolder::OnMessageClassified(aMsgURI, aClassification, aJunkPercent);

      if (aClassification == nsIJunkMailPlugin::JUNK)
      {
        bool willMoveMessage = false;

        // don't do the move when we are opening up
        // the junk mail folder or the trash folder
        // or when manually classifying messages in those folders
        if (!(mFlags & nsMsgFolderFlags::Junk || mFlags & nsMsgFolderFlags::Trash))
        {
          bool moveOnSpam = false;
          rv = spamSettings->GetMoveOnSpam(&moveOnSpam);
          NS_ENSURE_SUCCESS(rv,rv);
          if (moveOnSpam)
          {
            nsCOMPtr<nsIMsgFolder> folder;
            rv = GetExistingFolder(spamFolderURI, getter_AddRefs(folder));
            if (NS_SUCCEEDED(rv) && folder)
            {
              rv = folder->SetFlag(nsMsgFolderFlags::Junk);
              NS_ENSURE_SUCCESS(rv,rv);
              mSpamKeysToMove.AppendElement(msgKey);
              willMoveMessage = true;
            }
            else
            {
              // XXX TODO
              // JUNK MAIL RELATED
              // the listener should do
              // rv = folder->SetFlag(nsMsgFolderFlags::Junk);
              // NS_ENSURE_SUCCESS(rv,rv);
              // mSpamKeysToMove.AppendElement(msgKey);
              // willMoveMessage = true;
              rv = GetOrCreateFolder(spamFolderURI, nullptr /* aListener */);
              NS_ASSERTION(NS_SUCCEEDED(rv), "GetOrCreateFolder failed");
            }
          }
        }
        rv = spamSettings->LogJunkHit(msgHdr, willMoveMessage);
        NS_ENSURE_SUCCESS(rv,rv);
      }
    }
  }

  else // end of batch
  {
    // Parent will apply post bayes filters.
    nsMsgDBFolder::OnMessageClassified(nullptr, nsIJunkMailPlugin::UNCLASSIFIED, 0);
    nsCOMPtr<nsIMutableArray> messages(do_CreateInstance(NS_ARRAY_CONTRACTID));
    if (!mSpamKeysToMove.IsEmpty())
    {
      nsCOMPtr<nsIMsgFolder> folder;
      if (!spamFolderURI.IsEmpty())
        rv = GetExistingFolder(spamFolderURI, getter_AddRefs(folder));
      for (uint32_t keyIndex = 0; keyIndex < mSpamKeysToMove.Length(); keyIndex++)
      {
        // If an upstream filter moved this message, don't move it here.
        nsMsgKey msgKey = mSpamKeysToMove.ElementAt(keyIndex);
        nsMsgProcessingFlagType processingFlags;
        GetProcessingFlags(msgKey, &processingFlags);
        if (folder && !(processingFlags & nsMsgProcessingFlags::FilterToMove))
        {
          nsCOMPtr<nsIMsgDBHdr> mailHdr;
          rv = GetMessageHeader(msgKey, getter_AddRefs(mailHdr));
          if (NS_SUCCEEDED(rv) && mailHdr)
            messages->AppendElement(mailHdr, false);
        }
        else
        {
          // We don't need the processing flag any more.
          AndProcessingFlags(msgKey, ~nsMsgProcessingFlags::FilterToMove);
        }
      }

      if (folder)
      {
        nsCOMPtr<nsIMsgCopyService> copySvc = do_GetService(NS_MSGCOPYSERVICE_CONTRACTID, &rv);
        NS_ENSURE_SUCCESS(rv,rv);

        rv = copySvc->CopyMessages(this, messages, folder, true,
          /*nsIMsgCopyServiceListener* listener*/ nullptr, nullptr, false /*allowUndo*/);
        NS_ASSERTION(NS_SUCCEEDED(rv), "CopyMessages failed");
        if (NS_FAILED(rv))
        {
          nsAutoCString logMsg("failed to copy junk messages to junk folder rv = ");
          logMsg.AppendInt(static_cast<uint32_t>(rv), 16);
          spamSettings->LogJunkString(logMsg.get());
        }
      }
    }
    int32_t numNewMessages;
    GetNumNewMessages(false, &numNewMessages);
    uint32_t length;
    messages->GetLength(&length);
    SetNumNewMessages(numNewMessages - length);
    mSpamKeysToMove.Clear();
    // check if this is the inbox first...
    if (mFlags & nsMsgFolderFlags::Inbox)
      PerformBiffNotifications();
  }
  return NS_OK;
}

NS_IMETHODIMP
nsMsgLocalMailFolder::GetFolderScanState(nsLocalFolderScanState *aState)
{
  NS_ENSURE_ARG_POINTER(aState);

  nsresult rv = GetMsgStore(getter_AddRefs(aState->m_msgStore));
  NS_ENSURE_SUCCESS(rv, rv);
    aState->m_uidl = nullptr;
  return rv;
}

NS_IMETHODIMP
nsMsgLocalMailFolder::GetUidlFromFolder(nsLocalFolderScanState *aState, nsIMsgDBHdr *aMsgDBHdr)
{
  bool more = false;
  uint32_t size = 0, len = 0;
  const char *accountKey = nullptr;
  nsresult rv = GetMsgInputStream(aMsgDBHdr, &aState->m_streamReusable,
                                  getter_AddRefs(aState->m_inputStream));
  aState->m_seekableStream = do_QueryInterface(aState->m_inputStream);
  NS_ENSURE_SUCCESS(rv,rv);

  nsAutoPtr<nsLineBuffer<char> > lineBuffer(new nsLineBuffer<char>);
  NS_ENSURE_TRUE(lineBuffer, NS_ERROR_OUT_OF_MEMORY);

  aState->m_uidl = nullptr;

  aMsgDBHdr->GetMessageSize(&len);
  while (len > 0)
  {
    rv = NS_ReadLine(aState->m_inputStream.get(), lineBuffer.get(), aState->m_header, &more);
    if (NS_SUCCEEDED(rv))
    {
      size = aState->m_header.Length();
      if (!size)
        break;
      // this isn't quite right - need to account for line endings
      len -= size;
      // account key header will always be before X_UIDL header
      if (!accountKey)
      {
        accountKey = strstr(aState->m_header.get(), HEADER_X_MOZILLA_ACCOUNT_KEY);
        if (accountKey)
        {
          accountKey += strlen(HEADER_X_MOZILLA_ACCOUNT_KEY) + 2;
          aState->m_accountKey = accountKey;
        }
      }
      else
      {
        aState->m_uidl = strstr(aState->m_header.get(), X_UIDL);
        if (aState->m_uidl)
        {
          aState->m_uidl += X_UIDL_LEN + 2; // skip UIDL: header
          break;
        }
      }
    }
  }
  if (!aState->m_streamReusable)
  {
    aState->m_inputStream->Close();
    aState->m_inputStream = nullptr;
  }
  lineBuffer = nullptr;
  return rv;
}

/**
 * Adds a message to the end of the folder, parsing it as it goes, and
 * applying filters, if applicable.
 */
NS_IMETHODIMP
nsMsgLocalMailFolder::AddMessage(const char *aMessage, nsIMsgDBHdr **aHdr)
{
  const char *aMessages[] = {aMessage};
  nsCOMPtr<nsIArray> hdrs;
  nsresult rv = AddMessageBatch(1, aMessages, getter_AddRefs(hdrs));
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr<nsIMsgDBHdr> hdr(do_QueryElementAt(hdrs, 0, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  hdr.forget(aHdr);
  return rv;
}

NS_IMETHODIMP
nsMsgLocalMailFolder::AddMessageBatch(uint32_t aMessageCount,
                                      const char **aMessages,
                                      nsIArray **aHdrArray)
{
  NS_ENSURE_ARG_POINTER(aHdrArray);

  nsCOMPtr<nsIMsgIncomingServer> server;
  nsresult rv = GetServer(getter_AddRefs(server));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIMsgPluggableStore> msgStore;
  nsCOMPtr <nsIOutputStream> outFileStream;
  nsCOMPtr<nsIMsgDBHdr> newHdr;

  rv = server->GetMsgStore(getter_AddRefs(msgStore));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIMsgFolder> rootFolder;
  rv = GetRootFolder(getter_AddRefs(rootFolder));
  NS_ENSURE_SUCCESS(rv, rv);

  bool isLocked;

  GetLocked(&isLocked);
  if (isLocked)
    return NS_MSG_FOLDER_BUSY;

  AcquireSemaphore(static_cast<nsIMsgLocalMailFolder*>(this));

  if (NS_SUCCEEDED(rv))
  {
    nsCOMPtr<nsIMutableArray> hdrArray =
      do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    for (uint32_t i = 0; i < aMessageCount; i++)
    {
      nsRefPtr<nsParseNewMailState> newMailParser = new nsParseNewMailState;
      NS_ENSURE_TRUE(newMailParser, NS_ERROR_OUT_OF_MEMORY);
      if (!mGettingNewMessages)
        newMailParser->DisableFilters();
      bool reusable;
      rv = msgStore->GetNewMsgOutputStream(this, getter_AddRefs(newHdr),
                                      &reusable,
                                      getter_AddRefs(outFileStream));
      NS_ENSURE_SUCCESS(rv, rv);
      rv = newMailParser->Init(rootFolder, this,
                               nullptr, newHdr, outFileStream);

      uint32_t bytesWritten, messageLen = strlen(aMessages[i]);
      outFileStream->Write(aMessages[i], messageLen, &bytesWritten);
      newMailParser->BufferInput(aMessages[i], messageLen);

      msgStore->FinishNewMessage(outFileStream, newHdr);
      outFileStream->Close();
      outFileStream = nullptr;
      newMailParser->EndMsgDownload();
      newMailParser->OnStopRequest(nullptr, nullptr, NS_OK);
      hdrArray->AppendElement(newHdr, false);
    }
    NS_ADDREF(*aHdrArray = hdrArray);
  }
  ReleaseSemaphore(static_cast<nsIMsgLocalMailFolder*>(this));
  return rv;
}

NS_IMETHODIMP
nsMsgLocalMailFolder::WarnIfLocalFileTooBig(nsIMsgWindow *aWindow, bool *aTooBig)
{
  NS_ENSURE_ARG_POINTER(aTooBig);
  *aTooBig = false;
  nsCOMPtr<nsIMsgPluggableStore> msgStore;
  nsresult rv = GetMsgStore(getter_AddRefs(msgStore));
  NS_ENSURE_SUCCESS(rv, rv);
  bool spaceAvailable;
  // check if we have a reasonable amount of space left
  rv = msgStore->HasSpaceAvailable(this, 0xFFFFF, &spaceAvailable);
  if (!spaceAvailable)
    {
      ThrowAlertMsg("mailboxTooLarge", aWindow);
      *aTooBig = true;
    }
  return NS_OK;
}

NS_IMETHODIMP nsMsgLocalMailFolder::FetchMsgPreviewText(nsMsgKey *aKeysToFetch, uint32_t aNumKeys,
                                                 bool aLocalOnly, nsIUrlListener *aUrlListener,
                                                 bool *aAsyncResults)
{
  NS_ENSURE_ARG_POINTER(aKeysToFetch);
  NS_ENSURE_ARG_POINTER(aAsyncResults);

  *aAsyncResults = false;
  nsCOMPtr <nsIInputStream> inputStream;
  nsCOMPtr<nsIMsgPluggableStore> msgStore;
  nsresult rv = GetMsgStore(getter_AddRefs(msgStore));
  NS_ENSURE_SUCCESS(rv, rv);

  for (uint32_t i = 0; i < aNumKeys; i++)
  {
    nsCOMPtr <nsIMsgDBHdr> msgHdr;
    nsCString prevBody;
    rv = GetMessageHeader(aKeysToFetch[i], getter_AddRefs(msgHdr));
    NS_ENSURE_SUCCESS(rv, rv);
    // ignore messages that already have a preview body.
    msgHdr->GetStringProperty("preview", getter_Copies(prevBody));
    if (!prevBody.IsEmpty())
      continue;

    bool reusable;
    rv = GetMsgInputStream(msgHdr, &reusable, getter_AddRefs(inputStream));
    NS_ENSURE_SUCCESS(rv,rv);
    rv = GetMsgPreviewTextFromStream(msgHdr, inputStream);
  }
  return rv;
}

NS_IMETHODIMP nsMsgLocalMailFolder::AddKeywordsToMessages(nsIArray *aMessages, const nsACString& aKeywords)
{
  return ChangeKeywordForMessages(aMessages, aKeywords, true /* add */);
}
nsresult nsMsgLocalMailFolder::ChangeKeywordForMessages(nsIArray *aMessages, const nsACString& aKeywords, bool add)
{
  nsresult rv = (add) ? nsMsgDBFolder::AddKeywordsToMessages(aMessages, aKeywords)
                      : nsMsgDBFolder::RemoveKeywordsFromMessages(aMessages, aKeywords);

    NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr<nsIMsgPluggableStore> msgStore;
  GetMsgStore(getter_AddRefs(msgStore));
    NS_ENSURE_SUCCESS(rv, rv);
  return msgStore->ChangeKeywords(aMessages, aKeywords, add);
}

NS_IMETHODIMP nsMsgLocalMailFolder::RemoveKeywordsFromMessages(nsIArray *aMessages, const nsACString& aKeywords)
{
  return ChangeKeywordForMessages(aMessages, aKeywords, false /* remove */);
}

NS_IMETHODIMP nsMsgLocalMailFolder::UpdateNewMsgHdr(nsIMsgDBHdr* aOldHdr, nsIMsgDBHdr* aNewHdr)
{
  NS_ENSURE_ARG_POINTER(aOldHdr);
  NS_ENSURE_ARG_POINTER(aNewHdr);
  // Preserve any properties set on the message.
  CopyPropertiesToMsgHdr(aNewHdr, aOldHdr, true);

  // Preserve keywords manually, since they are set as don't preserve.
  nsCString keywordString;
  aOldHdr->GetStringProperty("keywords", getter_Copies(keywordString));
  aNewHdr->SetStringProperty("keywords", keywordString.get());

  // If the junk score was set by the plugin, remove junkscore to force a new
  // junk analysis, this time using the body.
  nsCString junkScoreOrigin;
  aOldHdr->GetStringProperty("junkscoreorigin", getter_Copies(junkScoreOrigin));
  if (junkScoreOrigin.EqualsLiteral("plugin"))
    aNewHdr->SetStringProperty("junkscore", "");

  return NS_OK;
}
