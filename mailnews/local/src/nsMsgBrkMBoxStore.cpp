/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
   Class for handling Berkeley Mailbox stores.
*/

#include "prlog.h"
#include "msgCore.h"
#include "nsMsgBrkMBoxStore.h"
#include "nsIMsgFolder.h"
#include "nsMsgFolderFlags.h"
#include "nsILocalMailIncomingServer.h"
#include "nsIMsgLocalMailFolder.h"
#include "nsCOMArray.h"
#include "nsIFile.h"
#include "nsIMsgHdr.h"
#include "nsNetUtil.h"
#include "nsIMsgDatabase.h"
#include "nsNativeCharsetUtils.h"
#include "nsMsgUtils.h"
#include "nsMsgDBCID.h"
#include "nsIDBFolderInfo.h"
#include "nsIArray.h"
#include "nsArrayUtils.h"
#include "nsMsgLocalFolderHdrs.h"
#include "nsMailHeaders.h"
#include "nsReadLine.h"
#include "nsParseMailbox.h"
#include "nsIMailboxService.h"
#include "nsMsgLocalCID.h"
#include "nsIMsgFolderCompactor.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "prprf.h"
#include <cstdlib> // for std::abs(int/long)
#include <cmath> // for std::abs(float/double)

nsMsgBrkMBoxStore::nsMsgBrkMBoxStore()
{
}

nsMsgBrkMBoxStore::~nsMsgBrkMBoxStore()
{
}

NS_IMPL_ISUPPORTS1(nsMsgBrkMBoxStore, nsIMsgPluggableStore)

NS_IMETHODIMP nsMsgBrkMBoxStore::DiscoverSubFolders(nsIMsgFolder *aParentFolder,
                                                    bool aDeep)
{
  NS_ENSURE_ARG_POINTER(aParentFolder);

  nsCOMPtr<nsIFile> path;
  nsresult rv = aParentFolder->GetFilePath(getter_AddRefs(path));
  if (NS_FAILED(rv))
    return rv;

  bool exists;
  path->Exists(&exists);
  if (!exists)
    path->Create(nsIFile::DIRECTORY_TYPE, 0755);

  return AddSubFolders(aParentFolder, path, aDeep);
}

NS_IMETHODIMP nsMsgBrkMBoxStore::CreateFolder(nsIMsgFolder *aParent,
                                              const nsAString &aFolderName,
                                              nsIMsgFolder **aResult)
{
  nsCOMPtr<nsIFile> path;
  nsCOMPtr<nsIMsgFolder> child;
  nsresult rv = aParent->GetFilePath(getter_AddRefs(path));
  if (NS_FAILED(rv))
    return rv;
  //Get a directory based on our current path.
  rv = CreateDirectoryForFolder(path);
  if (NS_FAILED(rv))
    return rv;

  // Now we have a valid directory or we have returned.
  // Make sure the new folder name is valid
  nsAutoString safeFolderName(aFolderName);
  NS_MsgHashIfNecessary(safeFolderName);

  path->Append(safeFolderName);
  bool exists;
  path->Exists(&exists);
  if (exists) //check this because localized names are different from disk names
    return NS_MSG_FOLDER_EXISTS;

  path->Create(nsIFile::NORMAL_FILE_TYPE, 0600);

  //GetFlags and SetFlags in AddSubfolder will fail because we have no db at
  // this point but mFlags is set.
  rv = aParent->AddSubfolder(safeFolderName, getter_AddRefs(child));
  if (!child || NS_FAILED(rv))
  {
    path->Remove(false);
    return rv;
  }
  // Create an empty database for this mail folder, set its name from the user
  nsCOMPtr<nsIMsgDBService> msgDBService =
    do_GetService(NS_MSGDB_SERVICE_CONTRACTID, &rv);
  if (msgDBService)
  {
    nsCOMPtr<nsIMsgDatabase> unusedDB;
    rv = msgDBService->OpenFolderDB(child, true, getter_AddRefs(unusedDB));
    if (rv == NS_MSG_ERROR_FOLDER_SUMMARY_MISSING)
      rv = msgDBService->CreateNewDB(child, getter_AddRefs(unusedDB));

    if ((NS_SUCCEEDED(rv) || rv == NS_MSG_ERROR_FOLDER_SUMMARY_OUT_OF_DATE) &&
        unusedDB)
    {
      //need to set the folder name
      nsCOMPtr<nsIDBFolderInfo> folderInfo;
      rv = unusedDB->GetDBFolderInfo(getter_AddRefs(folderInfo));
      if (NS_SUCCEEDED(rv))
        folderInfo->SetMailboxName(safeFolderName);

      unusedDB->SetSummaryValid(true);
      unusedDB->Close(true);
      aParent->UpdateSummaryTotals(true);
    }
    else
    {
      path->Remove(false);
      rv = NS_MSG_CANT_CREATE_FOLDER;
    }
  }
  child.forget(aResult);
  return rv;
}

NS_IMETHODIMP nsMsgBrkMBoxStore::GetSummaryFile(nsIMsgFolder *aFolder,
                                                nsIFile **aSummaryFile)
{
  NS_ENSURE_ARG_POINTER(aFolder);
  NS_ENSURE_ARG_POINTER(aSummaryFile);

  nsresult rv;
  nsCOMPtr<nsIFile> newSummaryLocation;
  rv = aFolder->GetFilePath(getter_AddRefs(newSummaryLocation));
  NS_ENSURE_SUCCESS(rv, rv);

  nsString fileName;

  rv = newSummaryLocation->GetLeafName(fileName);
  if (NS_FAILED(rv))
    return rv;

  fileName.Append(NS_LITERAL_STRING(SUMMARY_SUFFIX));
  rv = newSummaryLocation->SetLeafName(fileName);
  NS_ENSURE_SUCCESS(rv, rv);

  newSummaryLocation.forget(aSummaryFile);
  return NS_OK;
}

// Get the current attributes of the mbox file, corrected for caching
void nsMsgBrkMBoxStore::GetMailboxModProperties(nsIMsgFolder *aFolder,
                                                int64_t *aSize, uint32_t *aDate)
{
  // We'll simply return 0 on errors.
  *aDate = 0;
  *aSize = 0;
  nsCOMPtr<nsIFile> pathFile;
  nsresult rv = aFolder->GetFilePath(getter_AddRefs(pathFile));
  NS_ENSURE_SUCCESS_VOID(rv);

  rv = pathFile->GetFileSize(aSize);
  NS_ENSURE_SUCCESS_VOID(rv);

  PRTime lastModTime;
  rv = pathFile->GetLastModifiedTime(&lastModTime);
  NS_ENSURE_SUCCESS_VOID(rv);

  *aDate = (uint32_t) (lastModTime / PR_MSEC_PER_SEC);
}

NS_IMETHODIMP nsMsgBrkMBoxStore::HasSpaceAvailable(nsIMsgFolder *aFolder,
                                                   int64_t aSpaceRequested,
                                                   bool *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  NS_ENSURE_ARG_POINTER(aFolder);

  nsCOMPtr<nsIFile> pathFile;
  nsresult rv = aFolder->GetFilePath(getter_AddRefs(pathFile));
  NS_ENSURE_SUCCESS(rv, rv);

  int64_t fileSize;
  rv = pathFile->GetFileSize(&fileSize);
  NS_ENSURE_SUCCESS(rv, rv);

  // Allow the mbox to only reach 0xFFC00000 = 4 GiB - 4 MiB for now.
  *aResult = ((fileSize + aSpaceRequested) < 0xFFC00000) &&
              DiskSpaceAvailableInStore(pathFile, aSpaceRequested);

  return NS_OK;
}

static bool gGotGlobalPrefs = false;
static int32_t gTimeStampLeeway = 60;

NS_IMETHODIMP nsMsgBrkMBoxStore::IsSummaryFileValid(nsIMsgFolder *aFolder,
                                                    nsIMsgDatabase *aDB,
                                                    bool *aResult)
{
  NS_ENSURE_ARG_POINTER(aFolder);
  NS_ENSURE_ARG_POINTER(aDB);
  NS_ENSURE_ARG_POINTER(aResult);
  // We only check local folders for db validity.
  nsCOMPtr<nsIMsgLocalMailFolder> localFolder(do_QueryInterface(aFolder));
  if (!localFolder)
  {
    *aResult = true;
    return NS_OK;
  }

  nsCOMPtr<nsIFile> pathFile;
  nsresult rv = aFolder->GetFilePath(getter_AddRefs(pathFile));
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr<nsIDBFolderInfo> folderInfo;
  rv = aDB->GetDBFolderInfo(getter_AddRefs(folderInfo));
  NS_ENSURE_SUCCESS(rv, rv);
  uint64_t folderSize;
  uint32_t folderDate;
  int32_t numUnreadMessages;

  *aResult = false;

  folderInfo->GetNumUnreadMessages(&numUnreadMessages);
  folderInfo->GetFolderSize(&folderSize);
  folderInfo->GetFolderDate(&folderDate);

  int64_t fileSize = 0;
  uint32_t actualFolderTimeStamp = 0;
  GetMailboxModProperties(aFolder, &fileSize, &actualFolderTimeStamp);

  if (folderSize == fileSize && numUnreadMessages >= 0)
  {
    if (!folderSize)
    {
      *aResult = true;
      return NS_OK;
    }
    if (!gGotGlobalPrefs)
    {
      nsCOMPtr<nsIPrefBranch> pPrefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID));
      if (pPrefBranch)
      {
        rv = pPrefBranch->GetIntPref("mail.db_timestamp_leeway", &gTimeStampLeeway);
        gGotGlobalPrefs = true;
      }
    }
    // if those values are ok, check time stamp
    if (gTimeStampLeeway == 0)
      *aResult = folderDate == actualFolderTimeStamp;
    else
      *aResult = std::abs((int32_t) (actualFolderTimeStamp - folderDate)) <= gTimeStampLeeway;
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgBrkMBoxStore::SetSummaryFileValid(nsIMsgFolder *aFolder,
                                                     nsIMsgDatabase *aDB,
                                                     bool aValid)
{
  NS_ENSURE_ARG_POINTER(aFolder);
  NS_ENSURE_ARG_POINTER(aDB);
  // We only need to do this for local folders.
  nsCOMPtr<nsIMsgLocalMailFolder> localFolder(do_QueryInterface(aFolder));
  if (!localFolder)
    return NS_OK;

  nsCOMPtr<nsIFile> pathFile;
  nsresult rv = aFolder->GetFilePath(getter_AddRefs(pathFile));
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr<nsIDBFolderInfo> folderInfo;
  rv = aDB->GetDBFolderInfo(getter_AddRefs(folderInfo));
  NS_ENSURE_SUCCESS(rv, rv);
  bool exists;
  pathFile->Exists(&exists);
  if (!exists)
    return NS_MSG_ERROR_FOLDER_MISSING;

  if (aValid)
  {
    uint32_t actualFolderTimeStamp;
    int64_t fileSize;
    GetMailboxModProperties(aFolder, &fileSize, &actualFolderTimeStamp);
    folderInfo->SetFolderSize(fileSize);
    folderInfo->SetFolderDate(actualFolderTimeStamp);
  }
  else
  {
    folderInfo->SetVersion(0); // that ought to do the trick.
  }
  aDB->Commit(nsMsgDBCommitType::kLargeCommit);
  return rv;
}

NS_IMETHODIMP nsMsgBrkMBoxStore::DeleteFolder(nsIMsgFolder *aFolder)
{
  NS_ENSURE_ARG_POINTER(aFolder);
  //Delete mailbox
  nsCOMPtr<nsIFile> pathFile;
  nsresult rv = aFolder->GetFilePath(getter_AddRefs(pathFile));
  NS_ENSURE_SUCCESS(rv, rv);

  pathFile->Remove(false);

  bool isDirectory = false;
  pathFile->IsDirectory(&isDirectory);
  if (!isDirectory)
  {
    nsAutoString leafName;
    pathFile->GetLeafName(leafName);
    leafName.AppendLiteral(FOLDER_SUFFIX);
    pathFile->SetLeafName(leafName);
  }
  isDirectory = false;
  pathFile->IsDirectory(&isDirectory);
  //If this is a directory, then remove it.
  return isDirectory ? pathFile->Remove(true) : NS_OK;
}

NS_IMETHODIMP nsMsgBrkMBoxStore::RenameFolder(nsIMsgFolder *aFolder,
                                              const nsAString & aNewName,
                                              nsIMsgFolder **aNewFolder)
{
  NS_ENSURE_ARG_POINTER(aFolder);
  NS_ENSURE_ARG_POINTER(aNewFolder);

  uint32_t numChildren;
  aFolder->GetNumSubFolders(&numChildren);
  nsString existingName;
  aFolder->GetName(existingName);

  nsCOMPtr<nsIFile> oldPathFile;
  nsresult rv = aFolder->GetFilePath(getter_AddRefs(oldPathFile));
  if (NS_FAILED(rv))
    return rv;

  nsCOMPtr<nsIMsgFolder> parentFolder;
  rv = aFolder->GetParent(getter_AddRefs(parentFolder));
  if (!parentFolder)
    return NS_ERROR_NULL_POINTER;

  nsCOMPtr<nsISupports> parentSupport = do_QueryInterface(parentFolder);

  nsCOMPtr<nsIFile> oldSummaryFile;
  rv = GetSummaryFile(aFolder, getter_AddRefs(oldSummaryFile));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIFile> dirFile;
  oldPathFile->Clone(getter_AddRefs(dirFile));

  if (numChildren > 0)
  {
    rv = CreateDirectoryForFolder(dirFile);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  nsAutoString safeName(aNewName);
  NS_MsgHashIfNecessary(safeName);

  nsAutoCString oldLeafName;
  oldPathFile->GetNativeLeafName(oldLeafName);

  nsCOMPtr<nsIFile> parentPathFile;
  parentFolder->GetFilePath(getter_AddRefs(parentPathFile));
  NS_ENSURE_SUCCESS(rv,rv);

  bool isDirectory = false;
  parentPathFile->IsDirectory(&isDirectory);
  if (!isDirectory)
  {
    nsAutoString leafName;
    parentPathFile->GetLeafName(leafName);
    leafName.AppendLiteral(FOLDER_SUFFIX);
    rv = parentPathFile->SetLeafName(leafName);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  aFolder->ForceDBClosed();
  //save off dir name before appending .msf
  rv = oldPathFile->MoveTo(nullptr, safeName);
  if (NS_FAILED(rv))
    return rv;

  nsString dbName(safeName);
  dbName += NS_LITERAL_STRING(SUMMARY_SUFFIX);
  oldSummaryFile->MoveTo(nullptr, dbName);

  if (numChildren > 0)
  {
    // rename "*.sbd" directory
    nsAutoString newNameDirStr(safeName);
    newNameDirStr += NS_LITERAL_STRING(".sbd");
    dirFile->MoveTo(nullptr, newNameDirStr);
  }

  return parentFolder->AddSubfolder(safeName, aNewFolder);
}

NS_IMETHODIMP nsMsgBrkMBoxStore::CopyFolder(nsIMsgFolder *aSrcFolder,
                                            nsIMsgFolder *aDstFolder,
                                            bool aIsMoveFolder,
                                            nsIMsgWindow *aMsgWindow,
                                            nsIMsgCopyServiceListener *aListener)
{
  NS_ENSURE_ARG_POINTER(aSrcFolder);
  NS_ENSURE_ARG_POINTER(aDstFolder);
  nsString folderName;
  aSrcFolder->GetName(folderName);
  nsAutoString safeFolderName(folderName);
  NS_MsgHashIfNecessary(safeFolderName);
  nsCOMPtr<nsIMsgLocalMailFolder> localSrcFolder(do_QueryInterface(aSrcFolder));
  nsCOMPtr<nsIMsgDatabase> srcDB;
  if (localSrcFolder)
    localSrcFolder->GetDatabaseWOReparse(getter_AddRefs(srcDB));
  bool summaryValid = !!srcDB;
  srcDB = nullptr;
  aSrcFolder->ForceDBClosed();

  nsCOMPtr<nsIFile> oldPath;
  nsresult rv = aSrcFolder->GetFilePath(getter_AddRefs(oldPath));
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr<nsIFile> summaryFile;
  GetSummaryFileLocation(oldPath, getter_AddRefs(summaryFile));

  nsCOMPtr<nsIFile> newPath;
  rv = aDstFolder->GetFilePath(getter_AddRefs(newPath));
  NS_ENSURE_SUCCESS(rv,rv);

  bool newPathIsDirectory = false;
  newPath->IsDirectory(&newPathIsDirectory);
  if (!newPathIsDirectory)
  {
    AddDirectorySeparator(newPath);
    newPath->Create(nsIFile::DIRECTORY_TYPE, 0700);
  }

  nsCOMPtr<nsIFile> origPath;
  oldPath->Clone(getter_AddRefs(origPath));

   //copying necessary for aborting.... if failure return
  rv = oldPath->CopyTo(newPath, EmptyString());
  NS_ENSURE_SUCCESS(rv, rv); // Will fail if a file by that name exists

  // Copy to dir can fail if filespec does not exist. If copy fails, we test
  // if the filespec exist or not, if it does not that's ok, we continue
  // without copying it. If it fails and filespec exist and is not zero sized
  // there is real problem
  // Copy the file to the new dir
  rv = summaryFile->CopyTo(newPath, EmptyString());
  if (NS_FAILED(rv)) // Test if the copy is successful
  {
    // Test if the filespec has data
    bool exists;
    int64_t fileSize;
    summaryFile->Exists(&exists);
    summaryFile->GetFileSize(&fileSize);
    if (exists && fileSize > 0)
      NS_ENSURE_SUCCESS(rv, rv); // Yes, it should have worked !
    // else case is filespec is zero sized, no need to copy it,
    // not an error
  }

  nsCOMPtr<nsIMsgFolder> newMsgFolder;
  rv = aDstFolder->AddSubfolder(safeFolderName, getter_AddRefs(newMsgFolder));
  NS_ENSURE_SUCCESS(rv, rv);

  // linux and mac are not good about maintaining the file stamp when copying
  // folders around. So if the source folder db is good, set the dest db as
  // good too.
  nsCOMPtr<nsIMsgDatabase> destDB;
  if (summaryValid)
  {
    nsAutoString folderLeafName;
    origPath->GetLeafName(folderLeafName);
    newPath->Append(folderLeafName);
    nsCOMPtr<nsIMsgDBService> msgDBService =
      do_GetService(NS_MSGDB_SERVICE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    rv = msgDBService->OpenMailDBFromFile(newPath, newMsgFolder, false,
                                          true, getter_AddRefs(destDB));
    if (rv == NS_MSG_ERROR_FOLDER_SUMMARY_OUT_OF_DATE && destDB)
      destDB->SetSummaryValid(true);
  }
  newMsgFolder->SetPrettyName(folderName);
  uint32_t flags;
  aSrcFolder->GetFlags(&flags);
  newMsgFolder->SetFlags(flags);
  bool changed = false;
  rv = aSrcFolder->MatchOrChangeFilterDestination(newMsgFolder, true, &changed);
  if (changed)
    aSrcFolder->AlertFilterChanged(aMsgWindow);

  nsCOMPtr<nsISimpleEnumerator> enumerator;
  rv = aSrcFolder->GetSubFolders(getter_AddRefs(enumerator));
  NS_ENSURE_SUCCESS(rv, rv);

  // Copy subfolders to the new location
  nsresult copyStatus = NS_OK;
  nsCOMPtr<nsIMsgLocalMailFolder> localNewFolder(do_QueryInterface(newMsgFolder, &rv));
  if (NS_SUCCEEDED(rv))
  {
    bool hasMore;
    while (NS_SUCCEEDED(enumerator->HasMoreElements(&hasMore)) && hasMore &&
           NS_SUCCEEDED(copyStatus))
    {
      nsCOMPtr<nsISupports> item;
      enumerator->GetNext(getter_AddRefs(item));

      nsCOMPtr<nsIMsgFolder> folder(do_QueryInterface(item));
      if (!folder)
        continue;

      copyStatus = localNewFolder->CopyFolderLocal(folder, false,
                                                   aMsgWindow, aListener);
      // Test if the call succeeded, if not we have to stop recursive call
      if (NS_FAILED(copyStatus))
      {
        // Copy failed we have to notify caller to handle the error and stop
        // moving the folders. In case this happens to the topmost level of
        // recursive call, then we just need to break from the while loop and
        // go to error handling code.
        if (!aIsMoveFolder)
          return copyStatus;
        break;
      }
    }
  }

  if (aIsMoveFolder && NS_SUCCEEDED(copyStatus))
  {
    if (localNewFolder)
    {
      nsCOMPtr<nsISupports> srcSupport(do_QueryInterface(aSrcFolder));
      localNewFolder->OnCopyCompleted(srcSupport, true);
    }

    // Notify the "folder" that was dragged and dropped has been created. No
    // need to do this for its subfolders. isMoveFolder will be true for folder.
    aDstFolder->NotifyItemAdded(newMsgFolder);

    nsCOMPtr<nsIMsgFolder> msgParent;
    aSrcFolder->GetParent(getter_AddRefs(msgParent));
    aSrcFolder->SetParent(nullptr);
    if (msgParent)
    {
      // The files have already been moved, so delete storage false
      msgParent->PropagateDelete(aSrcFolder, false, aMsgWindow);
      oldPath->Remove(false);  //berkeley mailbox
     // We need to force closed the source db
      nsCOMPtr<nsIMsgDatabase> srcDB;
      aSrcFolder->Delete();

      nsCOMPtr<nsIFile> parentPath;
      rv = msgParent->GetFilePath(getter_AddRefs(parentPath));
      NS_ENSURE_SUCCESS(rv,rv);

      AddDirectorySeparator(parentPath);
      nsCOMPtr<nsISimpleEnumerator> children;
      parentPath->GetDirectoryEntries(getter_AddRefs(children));
      bool more;
      // checks if the directory is empty or not
      if (children && NS_SUCCEEDED(children->HasMoreElements(&more)) && !more)
        parentPath->Remove(true);
    }
  }
  else
  {
    // This is the case where the copy of a subfolder failed.
    // We have to delete the newDirectory tree to make a "rollback".
    // Someone should add a popup to warn the user that the move was not
    // possible.
    if (aIsMoveFolder && NS_FAILED(copyStatus))
    {
      nsCOMPtr<nsIMsgFolder> msgParent;
      newMsgFolder->ForceDBClosed();
      newMsgFolder->GetParent(getter_AddRefs(msgParent));
      newMsgFolder->SetParent(nullptr);
      if (msgParent)
      {
        msgParent->PropagateDelete(newMsgFolder, false, aMsgWindow);
        newMsgFolder->Delete();
        newMsgFolder->ForceDBClosed();
        AddDirectorySeparator(newPath);
        newPath->Remove(true);  //berkeley mailbox
      }
      return NS_ERROR_FAILURE;
    }
  }
  return NS_OK;
}

NS_IMETHODIMP
nsMsgBrkMBoxStore::GetNewMsgOutputStream(nsIMsgFolder *aFolder,
                                         nsIMsgDBHdr **aNewMsgHdr,
                                         bool *aReusable,
                                         nsIOutputStream **aResult)
{
  NS_ENSURE_ARG_POINTER(aFolder);
  NS_ENSURE_ARG_POINTER(aNewMsgHdr);
  NS_ENSURE_ARG_POINTER(aReusable);
  NS_ENSURE_ARG_POINTER(aResult);

#ifdef _DEBUG
  NS_ASSERTION(m_streamOutstandingFolder != aFolder, "didn't finish prev msg");
  m_streamOutstandingFolder = aFolder;
#endif
  *aReusable = true;
  nsCOMPtr<nsIFile> mboxFile;
  aFolder->GetFilePath(getter_AddRefs(mboxFile));
  nsCOMPtr<nsIMsgDatabase> db;
  aFolder->GetMsgDatabase(getter_AddRefs(db));
  if (!db && !*aNewMsgHdr)
    NS_WARNING("no db, and no message header");
  bool exists;
  mboxFile->Exists(&exists);
  if (!exists)
    mboxFile->Create(nsIFile::NORMAL_FILE_TYPE, 0600);

  nsCString URI;
  aFolder->GetURI(URI);
  nsresult rv;
  nsCOMPtr<nsISeekableStream> seekable;
  if (m_outputStreams.Get(URI, aResult))
  {
    seekable = do_QueryInterface(*aResult, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    rv = seekable->Seek(nsISeekableStream::NS_SEEK_END, 0);
    if (NS_FAILED(rv))
    {
      m_outputStreams.Remove(URI);
      NS_RELEASE(*aResult);
    }
  }
  if (!*aResult)
  {
    rv = MsgGetFileStream(mboxFile, aResult);
    NS_ASSERTION(NS_SUCCEEDED(rv), "failed opening offline store for output");
    if (NS_FAILED(rv))
      printf("failed opening offline store for %s\n", URI.get());
    NS_ENSURE_SUCCESS(rv, rv);
    seekable = do_QueryInterface(*aResult, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    rv = seekable->Seek(nsISeekableStream::NS_SEEK_END, 0);
    NS_ENSURE_SUCCESS(rv, rv);
    m_outputStreams.Put(URI, *aResult);
  }
  int64_t filePos;
  seekable->Tell(&filePos);
  if (db && !*aNewMsgHdr)
  {
    // if mbox is close to 4GB, auto-assign the msg key.
    nsMsgKey key = filePos > 0xFFFFFF00 ? nsMsgKey_None : (nsMsgKey) filePos;
    db->CreateNewHdr(key, aNewMsgHdr);
  }
  if (*aNewMsgHdr)
  {
    char storeToken[100];
    PR_snprintf(storeToken, sizeof(storeToken), "%lld", filePos);
    (*aNewMsgHdr)->SetMessageOffset(filePos);
    (*aNewMsgHdr)->SetStringProperty("storeToken", storeToken);
  }
  return rv;
}

NS_IMETHODIMP
nsMsgBrkMBoxStore::DiscardNewMessage(nsIOutputStream *aOutputStream,
                                     nsIMsgDBHdr *aNewHdr)
{
  NS_ENSURE_ARG_POINTER(aOutputStream);
  NS_ENSURE_ARG_POINTER(aNewHdr);
#ifdef _DEBUG
  m_streamOutstandingFolder = nullptr;
#endif
  uint64_t hdrOffset;
  aNewHdr->GetMessageOffset(&hdrOffset);
  aOutputStream->Close();
  nsCOMPtr<nsIFile> mboxFile;
  nsCOMPtr<nsIMsgFolder> folder;
  nsresult rv = aNewHdr->GetFolder(getter_AddRefs(folder));
  NS_ENSURE_SUCCESS(rv, rv);
  folder->GetFilePath(getter_AddRefs(mboxFile));
  return mboxFile->SetFileSize(hdrOffset);
}

NS_IMETHODIMP
nsMsgBrkMBoxStore::FinishNewMessage(nsIOutputStream *aOutputStream,
                                     nsIMsgDBHdr *aNewHdr)
{
#ifdef _DEBUG
  m_streamOutstandingFolder = nullptr;
#endif
  NS_ENSURE_ARG_POINTER(aOutputStream);
//  NS_ENSURE_ARG_POINTER(aNewHdr);
  return NS_OK;
}

NS_IMETHODIMP
nsMsgBrkMBoxStore::MoveNewlyDownloadedMessage(nsIMsgDBHdr *aNewHdr,
                                              nsIMsgFolder *aDestFolder,
                                              bool *aResult)
{
  NS_ENSURE_ARG_POINTER(aNewHdr);
  NS_ENSURE_ARG_POINTER(aDestFolder);
  NS_ENSURE_ARG_POINTER(aResult);
  *aResult = false;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgBrkMBoxStore::GetMsgInputStream(nsIMsgFolder *aMsgFolder,
                                     const nsACString &aMsgToken,
                                     int64_t *aOffset,
                                     nsIMsgDBHdr *aMsgHdr,
                                     bool *aReusable,
                                     nsIInputStream **aResult)
{
  NS_ENSURE_ARG_POINTER(aMsgFolder);
  NS_ENSURE_ARG_POINTER(aResult);
  NS_ENSURE_ARG_POINTER(aOffset);

  // If there is no store token, then we set it to the existing message offset.
  if (aMsgToken.IsEmpty())
  {
    uint64_t offset;
    NS_ENSURE_ARG_POINTER(aMsgHdr);
    aMsgHdr->GetMessageOffset(&offset);
    *aOffset = int64_t(offset);
    char storeToken[100];
    PR_snprintf(storeToken, sizeof(storeToken), "%lld", *aOffset);
    aMsgHdr->SetStringProperty("storeToken", storeToken);
  }
  else
    *aOffset = ParseUint64Str(PromiseFlatCString(aMsgToken).get());
  *aReusable = true;
  nsCString URI;
  nsCOMPtr<nsIFile> mboxFile;

  aMsgFolder->GetURI(URI);
  aMsgFolder->GetFilePath(getter_AddRefs(mboxFile));
  return NS_NewLocalFileInputStream(aResult, mboxFile);
}

NS_IMETHODIMP nsMsgBrkMBoxStore::DeleteMessages(nsIArray *aHdrArray)
{
  return ChangeFlags(aHdrArray, nsMsgMessageFlags::Expunged, true);
}

NS_IMETHODIMP
nsMsgBrkMBoxStore::CopyMessages(bool isMove, nsIArray *aHdrArray,
                               nsIMsgFolder *aDstFolder,
                               nsIMsgCopyServiceListener *aListener,
                               nsITransaction **aUndoAction,
                               bool *aCopyDone)
{
  NS_ENSURE_ARG_POINTER(aHdrArray);
  NS_ENSURE_ARG_POINTER(aDstFolder);
  NS_ENSURE_ARG_POINTER(aCopyDone);
  *aUndoAction = nullptr;
  *aCopyDone = false;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgBrkMBoxStore::GetSupportsCompaction(bool *aSupportsCompaction)
{
  NS_ENSURE_ARG_POINTER(aSupportsCompaction);
  *aSupportsCompaction = true;
  return NS_OK;
}

NS_IMETHODIMP nsMsgBrkMBoxStore::CompactFolder(nsIMsgFolder *aFolder,
                                               nsIUrlListener *aListener,
                                               nsIMsgWindow *aMsgWindow)
{
  NS_ENSURE_ARG_POINTER(aFolder);
  nsresult rv;
  nsCOMPtr<nsIMsgFolderCompactor> folderCompactor =
    do_CreateInstance(NS_MSGLOCALFOLDERCOMPACTOR_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  uint32_t expungedBytes = 0;
  aFolder->GetExpungedBytes(&expungedBytes);
  // check if we need to compact the folder
  return (expungedBytes > 0) ?
    folderCompactor->Compact(aFolder, false, aListener, aMsgWindow) :
    aFolder->NotifyCompactCompleted();
}

NS_IMETHODIMP nsMsgBrkMBoxStore::RebuildIndex(nsIMsgFolder *aFolder,
                                              nsIMsgDatabase *aMsgDB,
                                              nsIMsgWindow *aMsgWindow,
                                              nsIUrlListener *aListener)
{
  NS_ENSURE_ARG_POINTER(aFolder);
  // We don't use aMsgDB, but I think nsMsgMailDirStore needs it.
  nsCOMPtr<nsIFile> pathFile;
  nsresult rv = aFolder->GetFilePath(getter_AddRefs(pathFile));
  if (NS_FAILED(rv))
    return rv;

  bool isLocked;
  aFolder->GetLocked(&isLocked);
  if (isLocked)
  {
    NS_ASSERTION(false, "Could not get folder lock");
    return NS_MSG_FOLDER_BUSY;
  }

  nsCOMPtr<nsIMailboxService> mailboxService =
    do_GetService(NS_MAILBOXSERVICE_CONTRACTID1, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsRefPtr<nsMsgMailboxParser> parser = new nsMsgMailboxParser(aFolder);
  NS_ENSURE_TRUE(parser, NS_ERROR_OUT_OF_MEMORY);
  rv = parser->Init();
  NS_ENSURE_SUCCESS(rv, rv);

  return mailboxService->ParseMailbox(aMsgWindow, pathFile, parser, aListener,
                                      nullptr);
}

nsresult
nsMsgBrkMBoxStore::GetOutputStream(nsIArray *aHdrArray,
                                   nsCOMPtr<nsIOutputStream> &outputStream,
                                   nsCOMPtr<nsISeekableStream> &seekableStream,
                                   int64_t &restorePos)
{
  nsresult rv;
  nsCOMPtr<nsIMsgDBHdr> msgHdr = do_QueryElementAt(aHdrArray, 0, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr<nsIMsgFolder> folder;
  msgHdr->GetFolder(getter_AddRefs(folder));
  NS_ENSURE_SUCCESS(rv, rv);
  nsCString URI;
  folder->GetURI(URI);
  restorePos = -1;
  if (m_outputStreams.Get(URI, getter_AddRefs(outputStream)))
  {
    seekableStream = do_QueryInterface(outputStream);
    rv = seekableStream->Tell(&restorePos);
    if (NS_FAILED(rv))
    {
      outputStream = nullptr;
      m_outputStreams.Remove(URI);
    }
  }
  nsCOMPtr<nsIFile> mboxFile;
  folder->GetFilePath(getter_AddRefs(mboxFile));
  if (!outputStream)
  {
    rv = MsgGetFileStream(mboxFile, getter_AddRefs(outputStream));
    seekableStream = do_QueryInterface(outputStream);
    if (NS_SUCCEEDED(rv))
      m_outputStreams.Put(URI, outputStream);
  }
  return rv;
}

void nsMsgBrkMBoxStore::SetDBValid(nsIMsgDBHdr *aHdr)
{
  nsCOMPtr<nsIMsgFolder> folder;
  aHdr->GetFolder(getter_AddRefs(folder));
  if (folder)
  {
    nsCOMPtr<nsIMsgDatabase> db;
    folder->GetMsgDatabase(getter_AddRefs(db));
    if (db)
      SetSummaryFileValid(folder, db, true);
  }
}

NS_IMETHODIMP nsMsgBrkMBoxStore::ChangeFlags(nsIArray *aHdrArray,
                                             uint32_t aFlags,
                                             bool aSet)
{
  NS_ENSURE_ARG_POINTER(aHdrArray);
  nsCOMPtr<nsIOutputStream> outputStream;
  nsCOMPtr<nsISeekableStream> seekableStream;
  int64_t restoreStreamPos;

  uint32_t messageCount;
  nsresult rv = aHdrArray->GetLength(&messageCount);
  NS_ENSURE_SUCCESS(rv, rv);
  if (!messageCount)
    return NS_ERROR_INVALID_ARG;

  rv = GetOutputStream(aHdrArray, outputStream, seekableStream,
                       restoreStreamPos);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIMsgDBHdr> msgHdr;
  for (uint32_t i = 0; i < messageCount; i++)
  {
    msgHdr = do_QueryElementAt(aHdrArray, i, &rv);
    // Seek to x-mozilla-status offset and rewrite value.
    rv = UpdateFolderFlag(msgHdr, aSet, aFlags, outputStream);
    if (NS_FAILED(rv))
    {
      NS_WARNING("updateFolderFlag failed");
      break;
    }
  }
  if (restoreStreamPos != -1)
    seekableStream->Seek(nsISeekableStream::NS_SEEK_SET, restoreStreamPos);
  else if (outputStream)
    outputStream->Close();
  if (messageCount > 0)
  {
    msgHdr = do_QueryElementAt(aHdrArray, 0);
    SetDBValid(msgHdr);
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgBrkMBoxStore::ChangeKeywords(nsIArray *aHdrArray,
                                             const nsACString &aKeywords,
                                             bool aAdd)
{
  NS_ENSURE_ARG_POINTER(aHdrArray);
  nsCOMPtr<nsIOutputStream> outputStream;
  nsCOMPtr<nsISeekableStream> seekableStream;
  int64_t restoreStreamPos;

  uint32_t messageCount;
  nsresult rv = aHdrArray->GetLength(&messageCount);
  NS_ENSURE_SUCCESS(rv, rv);
  if (!messageCount)
    return NS_ERROR_INVALID_ARG;

  rv = GetOutputStream(aHdrArray, outputStream, seekableStream,
                       restoreStreamPos);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIInputStream> inputStream = do_QueryInterface(outputStream, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsAutoPtr<nsLineBuffer<char> > lineBuffer(new nsLineBuffer<char>);
  NS_ENSURE_TRUE(lineBuffer, NS_ERROR_OUT_OF_MEMORY);

  // For each message, we seek to the beginning of the x-mozilla-status header,
  // and start reading lines, looking for x-mozilla-keys: headers; If we're
  // adding the keyword and we find
  // a header with the desired keyword already in it, we don't need to
  // do anything. Likewise, if removing keyword and we don't find it,
  // we don't need to do anything. Otherwise, if adding, we need to
  // see if there's an x-mozilla-keys
  // header with room for the new keyword. If so, we replace the
  // corresponding number of spaces with the keyword. If no room,
  // we can't do anything until the folder is compacted and another
  // x-mozilla-keys header is added. In that case, we set a property
  // on the header, which the compaction code will check.

  nsTArray<nsCString> keywordArray;
  ParseString(aKeywords, ' ', keywordArray);

  nsCOMPtr<nsIMsgDBHdr> msgHdr;
  for (uint32_t i = 0; i < messageCount; ++i) // for each message
  {
    msgHdr = do_QueryElementAt(aHdrArray, i, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    uint64_t messageOffset;
    msgHdr->GetMessageOffset(&messageOffset);
    uint32_t statusOffset = 0;
    (void)msgHdr->GetStatusOffset(&statusOffset);
    uint64_t desiredOffset = messageOffset + statusOffset;

    ChangeKeywordsHelper(msgHdr, desiredOffset, lineBuffer, keywordArray,
                         aAdd, outputStream, seekableStream, inputStream);
  }
  lineBuffer = nullptr;
  if (restoreStreamPos != -1)
    seekableStream->Seek(nsISeekableStream::NS_SEEK_SET, restoreStreamPos);
  else if (outputStream)
    outputStream->Close();
  if (messageCount > 0)
  {
    msgHdr = do_QueryElementAt(aHdrArray, 0);
    SetDBValid(msgHdr);
  }
  return NS_OK;
}

// Iterates over the files in the "path" directory, and adds subfolders to
// parent for each mailbox file found.
nsresult
nsMsgBrkMBoxStore::AddSubFolders(nsIMsgFolder *parent, nsCOMPtr<nsIFile> &path,
                                 bool deep)
{
  nsresult rv;
  nsCOMPtr<nsIFile> tmp; // at top level so we can safely assign to path
  bool isDirectory;
  path->IsDirectory(&isDirectory);
  if (!isDirectory)
  {
    rv = path->Clone(getter_AddRefs(tmp));
    path = tmp;
    NS_ENSURE_SUCCESS(rv, rv);
    nsAutoString leafName;
    path->GetLeafName(leafName);
    leafName.AppendLiteral(".sbd");
    path->SetLeafName(leafName);
    path->IsDirectory(&isDirectory);
  }
  if (!isDirectory)
    return NS_OK;
  // first find out all the current subfolders and files, before using them
  // while creating new subfolders; we don't want to modify and iterate the same
  // directory at once.
  nsCOMArray<nsIFile> currentDirEntries;
  nsCOMPtr<nsISimpleEnumerator> directoryEnumerator;
  rv = path->GetDirectoryEntries(getter_AddRefs(directoryEnumerator));
  NS_ENSURE_SUCCESS(rv, rv);

  bool hasMore;
  while (NS_SUCCEEDED(directoryEnumerator->HasMoreElements(&hasMore)) &&
         hasMore)
  {
    nsCOMPtr<nsISupports> aSupport;
    directoryEnumerator->GetNext(getter_AddRefs(aSupport));
    nsCOMPtr<nsIFile> currentFile(do_QueryInterface(aSupport, &rv));
    if (currentFile)
      currentDirEntries.AppendObject(currentFile);
  }

  // add the folders
  int32_t count = currentDirEntries.Count();
  for (int32_t i = 0; i < count; ++i)
  {
    nsCOMPtr<nsIFile> currentFile(currentDirEntries[i]);

    nsAutoString leafName;
    currentFile->GetLeafName(leafName);
    directoryEnumerator->HasMoreElements(&hasMore);
    // here we should handle the case where the current file is a .sbd directory
    // w/o a matching folder file, or a directory w/o the name .sbd
    if (nsShouldIgnoreFile(leafName))
      continue;

    nsCOMPtr<nsIMsgFolder> child;
    rv = parent->AddSubfolder(leafName, getter_AddRefs(child));
    if (child)
    {
      nsString folderName;
      child->GetName(folderName);  // try to get it from cache/db
      if (folderName.IsEmpty())
        child->SetPrettyName(leafName);
      if (deep)
      {
        nsCOMPtr<nsIFile> path;
        rv = child->GetFilePath(getter_AddRefs(path));
        AddSubFolders(child, path, true);
      }
    }
  }
  return rv == NS_MSG_FOLDER_EXISTS ? NS_OK : rv;
}

/* Finds the directory associated with this folder.  That is if the path is
   c:\Inbox, it will return c:\Inbox.sbd if it succeeds.  If that path doesn't
   currently exist then it will create it. Path is strictly an out parameter.
  */
nsresult nsMsgBrkMBoxStore::CreateDirectoryForFolder(nsIFile *path)
{
  nsresult rv = NS_OK;

  bool pathIsDirectory = false;
  path->IsDirectory(&pathIsDirectory);
  if (!pathIsDirectory)
  {
    // If the current path isn't a directory, add directory separator
    // and test it out.
    nsAutoString leafName;
    path->GetLeafName(leafName);
    leafName.AppendLiteral(FOLDER_SUFFIX);
    rv = path->SetLeafName(leafName);
    if (NS_FAILED(rv))
      return rv;

    //If that doesn't exist, then we have to create this directory
    pathIsDirectory = false;
    path->IsDirectory(&pathIsDirectory);
    if (!pathIsDirectory)
    {
      bool pathExists;
      path->Exists(&pathExists);
      //If for some reason there's a file with the directory separator
      //then we are going to fail.
      rv = pathExists ? NS_MSG_COULD_NOT_CREATE_DIRECTORY :
             path->Create(nsIFile::DIRECTORY_TYPE, 0700);
    }
  }
  return rv;
}

