/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
   Class for handling Maildir stores.
*/

#include "prprf.h"
#include "prlog.h"
#include "msgCore.h"
#include "nsMsgMaildirStore.h"
#include "nsIMsgFolder.h"
#include "nsISimpleEnumerator.h"
#include "nsMsgFolderFlags.h"
#include "nsILocalMailIncomingServer.h"
#include "nsCOMArray.h"
#include "nsIFile.h"
#include "nsNetUtil.h"
#include "nsIMsgDatabase.h"
#include "nsNativeCharsetUtils.h"
#include "nsMsgUtils.h"
#include "nsMsgDBCID.h"
#include "nsIDBFolderInfo.h"
#include "nsIMutableArray.h"
#include "nsArrayUtils.h"
#include "nsMailHeaders.h"
#include "nsParseMailbox.h"
#include "nsIMailboxService.h"
#include "nsMsgLocalCID.h"
#include "nsIMsgLocalMailFolder.h"
#include "nsITimer.h"
#include "nsIMailboxUrl.h"
#include "nsIMsgMailNewsUrl.h"
#include "nsLocalUndoTxn.h"
#include "nsIMessenger.h"

static PRLogModuleInfo* MailDirLog;

nsMsgMaildirStore::nsMsgMaildirStore()
{
  MailDirLog = PR_NewLogModule("MailDirStore");
}

nsMsgMaildirStore::~nsMsgMaildirStore()
{
}

NS_IMPL_ISUPPORTS1(nsMsgMaildirStore, nsIMsgPluggableStore)

// Iterates over the folders in the "path" directory, and adds subfolders to
// parent for each Maildir folder found.
nsresult nsMsgMaildirStore::AddSubFolders(nsIMsgFolder *parent, nsIFile *path,
                                          bool deep)
{
  nsCOMArray<nsIFile> currentDirEntries;

  nsCOMPtr<nsISimpleEnumerator> directoryEnumerator;
  nsresult rv = path->GetDirectoryEntries(getter_AddRefs(directoryEnumerator));
  NS_ENSURE_SUCCESS(rv, rv);

  bool hasMore;
  while (NS_SUCCEEDED(directoryEnumerator->HasMoreElements(&hasMore)) &&
         hasMore)
  {
    nsCOMPtr<nsISupports> aSupport;
    directoryEnumerator->GetNext(getter_AddRefs(aSupport));
    nsCOMPtr<nsIFile> currentFile(do_QueryInterface(aSupport, &rv));
    if (currentFile) {
      nsAutoString leafName;
      currentFile->GetLeafName(leafName);
      bool isDirectory = false;
      currentFile->IsDirectory(&isDirectory);
      // Make sure this really is a mail folder dir (i.e., a directory that
      // contains cur and tmp sub-dirs, and not a .sbd or .mozmsgs dir).
      if (isDirectory && !nsShouldIgnoreFile(leafName))
        currentDirEntries.AppendObject(currentFile);
    }
  }

  // add the folders
  int32_t count = currentDirEntries.Count();
  for (int32_t i = 0; i < count; ++i)
  {
    nsCOMPtr<nsIFile> currentFile(currentDirEntries[i]);

    nsAutoString leafName;
    currentFile->GetLeafName(leafName);

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
        NS_ENSURE_SUCCESS(rv, rv);

        // Construct the .sbd directory path for the possible children of the
        // folder.
        GetDirectoryForFolder(path);
        bool directory = false;
        // Check that <folder>.sbd really is a directory.
        path->IsDirectory(&directory);
        if (directory)
          AddSubFolders(child, path, true);
      }
    }
  }
  return rv == NS_MSG_FOLDER_EXISTS ? NS_OK : rv;
}

NS_IMETHODIMP nsMsgMaildirStore::DiscoverSubFolders(nsIMsgFolder *aParentFolder,
                                                    bool aDeep)
{
  NS_ENSURE_ARG_POINTER(aParentFolder);

  nsCOMPtr<nsIFile> path;
  nsresult rv = aParentFolder->GetFilePath(getter_AddRefs(path));
  NS_ENSURE_SUCCESS(rv, rv);

  bool isServer, directory = false;
  aParentFolder->GetIsServer(&isServer);
  if (!isServer)
    GetDirectoryForFolder(path);

  path->IsDirectory(&directory);
  if (directory)
    rv = AddSubFolders(aParentFolder, path, aDeep);

  return (rv == NS_MSG_FOLDER_EXISTS) ? NS_OK : rv;
}

/**
 *Create a Maildir-style folder with "tmp", " and "cur" subfolders
 * but no "new" subfolder, because it's not sensical in the mail client context.
 ("new" directory is for messages on the server that haven't been seen by a
*  mail client).
 * aFolderName is already "safe" - it has been through NS_MsgHashIfNecessary
 */
nsresult nsMsgMaildirStore::CreateMaildir(nsIFile *path)
{
  nsresult rv = path->Create(nsIFile::DIRECTORY_TYPE, 0700);
  NS_ENSURE_SUCCESS(rv, rv);

  // Create tmp, new, cur leaves
  nsCOMPtr<nsIFile> leaf(do_CreateInstance(NS_LOCAL_FILE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  leaf->InitWithFile(path);

  leaf->AppendNative(NS_LITERAL_CSTRING("tmp"));
  rv = leaf->Create(nsIFile::DIRECTORY_TYPE, 0700);
  NS_ENSURE_SUCCESS(rv, rv);

  leaf->SetNativeLeafName(NS_LITERAL_CSTRING("cur"));
  rv = leaf->Create(nsIFile::DIRECTORY_TYPE, 0700);
  NS_ENSURE_SUCCESS(rv, rv);

  return NS_OK;
}

NS_IMETHODIMP nsMsgMaildirStore::CreateFolder(nsIMsgFolder *aParent,
                                              const nsAString &aFolderName,
                                              nsIMsgFolder **aResult)
{
  nsCOMPtr <nsIFile> path;
  nsresult rv = aParent->GetFilePath(getter_AddRefs(path));
  NS_ENSURE_SUCCESS(rv, rv);

  // Get a directory based on our current path
  bool isServer;
  aParent->GetIsServer(&isServer);
  rv = CreateDirectoryForFolder(path, isServer);
  NS_ENSURE_SUCCESS(rv, rv);

  // Make sure the new folder name is valid
  nsAutoString safeFolderName(aFolderName);
  NS_MsgHashIfNecessary(safeFolderName);

  path->Append(safeFolderName);

  rv = CreateMaildir(path);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIMsgFolder> child;
  // GetFlags and SetFlags in AddSubfolder will fail because we have no db at
  // this point but mFlags is set.
  rv = aParent->AddSubfolder(safeFolderName, getter_AddRefs(child));
  if (!child || NS_FAILED(rv))
  {
    path->Remove(true); // recursive
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
      PR_LOG(MailDirLog, PR_LOG_ALWAYS,
            ("CreateFolder - failed creating db for new folder\n"));
      path->Remove(true); // recursive
      rv = NS_MSG_CANT_CREATE_FOLDER;
    }
  }
  child.swap(*aResult);
  return rv;
}

NS_IMETHODIMP nsMsgMaildirStore::HasSpaceAvailable(nsIMsgFolder *aFolder,
                                                   int64_t aSpaceRequested,
                                                   bool *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  NS_ENSURE_ARG_POINTER(aFolder);

  nsCOMPtr<nsIFile> pathFile;
  nsresult rv = aFolder->GetFilePath(getter_AddRefs(pathFile));
  NS_ENSURE_SUCCESS(rv, rv);

  *aResult = DiskSpaceAvailableInStore(pathFile, aSpaceRequested);
  return NS_OK;
}

NS_IMETHODIMP nsMsgMaildirStore::IsSummaryFileValid(nsIMsgFolder *aFolder,
                                                    nsIMsgDatabase *aDB,
                                                    bool *aResult)
{
  NS_ENSURE_ARG_POINTER(aFolder);
  NS_ENSURE_ARG_POINTER(aDB);
  NS_ENSURE_ARG_POINTER(aResult);
  *aResult = true;
  nsCOMPtr<nsIDBFolderInfo> dbFolderInfo;
  aDB->GetDBFolderInfo(getter_AddRefs(dbFolderInfo));
  nsresult rv = dbFolderInfo->GetBooleanProperty("maildirValid", false,
                                                 aResult);
  if (!*aResult)
  {
    nsCOMPtr<nsIFile> newFile;
    rv = aFolder->GetFilePath(getter_AddRefs(newFile));
    NS_ENSURE_SUCCESS(rv, rv);
    newFile->Append(NS_LITERAL_STRING("cur"));

    // If the "cur" sub-dir doesn't exist, and there are no messages
    // in the db, then the folder is probably new and the db is valid.
    bool exists;
    newFile->Exists(&exists);
    if (!exists)
    {
      int32_t numMessages;
      dbFolderInfo->GetNumMessages(&numMessages);
      if (!numMessages)
        *aResult = true;
    }
  }
  return rv;
}

NS_IMETHODIMP nsMsgMaildirStore::SetSummaryFileValid(nsIMsgFolder *aFolder,
                                                     nsIMsgDatabase *aDB,
                                                     bool aValid)
{
  NS_ENSURE_ARG_POINTER(aFolder);
  NS_ENSURE_ARG_POINTER(aDB);
  nsCOMPtr<nsIDBFolderInfo> dbFolderInfo;
  aDB->GetDBFolderInfo(getter_AddRefs(dbFolderInfo));
  return dbFolderInfo->SetBooleanProperty("maildirValid", aValid);
}

NS_IMETHODIMP nsMsgMaildirStore::GetSummaryFile(nsIMsgFolder *aFolder,
                                                nsIFile **aSummaryFile)
{
  NS_ENSURE_ARG_POINTER(aFolder);
  NS_ENSURE_ARG_POINTER(aSummaryFile);

  nsresult rv;
  nsCOMPtr <nsIFile> newSummaryLocation =
    do_CreateInstance(NS_LOCAL_FILE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIFile> pathFile;
  rv = aFolder->GetFilePath(getter_AddRefs(pathFile));
  NS_ENSURE_SUCCESS(rv, rv);

  newSummaryLocation->InitWithFile(pathFile);
  nsString fileName;

  rv = newSummaryLocation->GetLeafName(fileName);
  if (NS_FAILED(rv))
    return rv;
  fileName.Append(NS_LITERAL_STRING(SUMMARY_SUFFIX));
  rv = newSummaryLocation->SetLeafName(fileName);
  NS_ENSURE_SUCCESS(rv, rv);

  NS_IF_ADDREF(*aSummaryFile = newSummaryLocation);
  return NS_OK;
}

NS_IMETHODIMP nsMsgMaildirStore::DeleteFolder(nsIMsgFolder *aFolder)
{
  NS_ENSURE_ARG_POINTER(aFolder);

  // Delete Maildir structure
  nsCOMPtr<nsIFile> pathFile;
  nsresult rv = aFolder->GetFilePath(getter_AddRefs(pathFile));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = pathFile->Remove(true); // recursive
  AddDirectorySeparator(pathFile);
  bool exists;
  pathFile->Exists(&exists);
  if (exists)
    pathFile->Remove(true);
  return rv;
}

NS_IMETHODIMP nsMsgMaildirStore::RenameFolder(nsIMsgFolder *aFolder,
                                              const nsAString & aNewName,
                                              nsIMsgFolder **aNewFolder)
{
  NS_ENSURE_ARG_POINTER(aFolder);
  NS_ENSURE_ARG_POINTER(aNewFolder);

  // old path
  nsCOMPtr<nsIFile> oldPathFile;
  nsresult rv = aFolder->GetFilePath(getter_AddRefs(oldPathFile));
  NS_ENSURE_SUCCESS(rv, rv);

  // old sbd directory
  nsCOMPtr<nsIFile> sbdPathFile;
  uint32_t numChildren;
  aFolder->GetNumSubFolders(&numChildren);
  if (numChildren > 0)
  {
    sbdPathFile = do_CreateInstance(NS_LOCAL_FILE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    rv = sbdPathFile->InitWithFile(oldPathFile);
    NS_ENSURE_SUCCESS(rv, rv);
    GetDirectoryForFolder(sbdPathFile);
  }

  // old summary
  nsCOMPtr<nsIFile> oldSummaryFile;
  rv = GetSummaryFile(aFolder, getter_AddRefs(oldSummaryFile));
  NS_ENSURE_SUCCESS(rv, rv);

  // Validate new name
  nsAutoString safeName(aNewName);
  NS_MsgHashIfNecessary(safeName);

  aFolder->ForceDBClosed();

  // rename folder
  rv = oldPathFile->MoveTo(nullptr, safeName);
  NS_ENSURE_SUCCESS(rv, rv);

  if (numChildren > 0)
  {
    // rename "*.sbd" directory
    nsAutoString sbdName = safeName;
    sbdName += NS_LITERAL_STRING(FOLDER_SUFFIX);
    sbdPathFile->MoveTo(nullptr, sbdName);
  }

  // rename summary
  safeName += NS_LITERAL_STRING(SUMMARY_SUFFIX);
  oldSummaryFile->MoveTo(nullptr, safeName);

  nsCOMPtr<nsIMsgFolder> parentFolder;
  rv = aFolder->GetParent(getter_AddRefs(parentFolder));
  if (!parentFolder)
    return NS_ERROR_NULL_POINTER;

  return parentFolder->AddSubfolder(safeName, aNewFolder);
}

NS_IMETHODIMP nsMsgMaildirStore::CopyFolder(nsIMsgFolder *aSrcFolder,
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
  aSrcFolder->ForceDBClosed();

  nsCOMPtr<nsIFile> oldPath;
  nsresult rv = aSrcFolder->GetFilePath(getter_AddRefs(oldPath));
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr<nsIFile> summaryFile;
  GetSummaryFileLocation(oldPath, getter_AddRefs(summaryFile));

  nsCOMPtr<nsIFile> newPath;
  rv = aDstFolder->GetFilePath(getter_AddRefs(newPath));
  NS_ENSURE_SUCCESS(rv, rv);

  // create target directory based on our current path
  bool isServer;
  aDstFolder->GetIsServer(&isServer);
  rv = CreateDirectoryForFolder(newPath, isServer);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIFile> origPath;
  oldPath->Clone(getter_AddRefs(origPath));

  rv = oldPath->CopyTo(newPath, EmptyString());
  NS_ENSURE_SUCCESS(rv, rv); //will fail if a file by that name exists

  // Copy to dir can fail if file does not exist. If copy fails, we test
  // if the file exists or not, if it does not that's ok, we continue
  // without copying it. If it fails and file exist and is not zero sized
  // there is real problem.
  rv = summaryFile->CopyTo(newPath, EmptyString());
  if (!NS_SUCCEEDED(rv))
  {
    // Test if the file is not empty
    bool exists;
    int64_t fileSize;
    summaryFile->Exists(&exists);
    summaryFile->GetFileSize(&fileSize);
    if (exists && fileSize > 0)
      NS_ENSURE_SUCCESS(rv, rv); // Yes, it should have worked!
    // else case is file is zero sized, no need to copy it,
    // not an error
    // else case is file does not exist - not an error
  }

  nsCOMPtr<nsIMsgFolder> newMsgFolder;
  rv = aDstFolder->AddSubfolder(safeFolderName, getter_AddRefs(newMsgFolder));
  NS_ENSURE_SUCCESS(rv, rv);

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

      copyStatus = localNewFolder->CopyFolderLocal(folder, false, aMsgWindow,
                                                   aListener);
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

    // Notify that the folder that was dragged and dropped has been created.
    // No need to do this for its subfolders - isMoveFolder will be true for folder.
    aDstFolder->NotifyItemAdded(newMsgFolder);

    nsCOMPtr<nsIMsgFolder> msgParent;
    aSrcFolder->GetParent(getter_AddRefs(msgParent));
    aSrcFolder->SetParent(nullptr);
    if (msgParent)
    {
      // The files have already been moved, so delete storage false
      msgParent->PropagateDelete(aSrcFolder, false, aMsgWindow);
      oldPath->Remove(true);
      nsCOMPtr<nsIMsgDatabase> srcDB; // we need to force closed the source db
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
        newPath->Remove(true); //berkeley mailbox
      }
      return NS_ERROR_FAILURE;
    }
  }
  return NS_OK;
}

NS_IMETHODIMP
nsMsgMaildirStore::GetNewMsgOutputStream(nsIMsgFolder *aFolder,
                                         nsIMsgDBHdr **aNewMsgHdr,
                                         bool *aReusable,
                                         nsIOutputStream **aResult)
{
  NS_ENSURE_ARG_POINTER(aFolder);
  NS_ENSURE_ARG_POINTER(aNewMsgHdr);
  NS_ENSURE_ARG_POINTER(aReusable);
  NS_ENSURE_ARG_POINTER(aResult);

  *aReusable = false; // message per file

  nsCOMPtr<nsIMsgDatabase> db;
  aFolder->GetMsgDatabase(getter_AddRefs(db));
  if (!db)
    NS_ERROR("no db");

  nsresult rv;

  if (!*aNewMsgHdr)
  {
    rv = db->CreateNewHdr(nsMsgKey_None, aNewMsgHdr);
    NS_ENSURE_SUCCESS(rv, rv);

  }
  (*aNewMsgHdr)->SetMessageOffset(0);
  // path to the message download folder
  nsCOMPtr<nsIFile> newFile;
  rv = aFolder->GetFilePath(getter_AddRefs(newFile));
  NS_ENSURE_SUCCESS(rv, rv);
  newFile->Append(NS_LITERAL_STRING("tmp"));

  // let's check if the folder exists
  bool exists;
  newFile->Exists(&exists);
  if (!exists) {
    PR_LOG(MailDirLog, PR_LOG_ALWAYS,
           ("GetNewMsgOutputStream - tmp subfolder does not exist!!\n"));
    rv = newFile->Create(nsIFile::DIRECTORY_TYPE, 0755);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  // generate new file name
  nsAutoCString newName;
  newName.AppendInt(static_cast<int64_t>(PR_Now()));
  newFile->AppendNative(newName);
  // CreateUnique, in case we get more than one message per millisecond :-)
  newFile->CreateUnique(nsIFile::NORMAL_FILE_TYPE, 0600);
  newFile->GetNativeLeafName(newName);
  // save the file name in the message header - otherwise no way to retrieve it
  (*aNewMsgHdr)->SetStringProperty("storeToken", newName.get());
  return MsgNewBufferedFileOutputStream(aResult, newFile,
                                        PR_WRONLY | PR_CREATE_FILE, 00600);
}

NS_IMETHODIMP
nsMsgMaildirStore::DiscardNewMessage(nsIOutputStream *aOutputStream,
                                     nsIMsgDBHdr *aNewHdr)
{
  NS_ENSURE_ARG_POINTER(aOutputStream);
  NS_ENSURE_ARG_POINTER(aNewHdr);

  aOutputStream->Close();
  // file path is stored in message header property "storeToken"
  nsAutoCString fileName;
  aNewHdr->GetStringProperty("storeToken", getter_Copies(fileName));
  if (fileName.IsEmpty())
    return NS_ERROR_FAILURE;

  nsCOMPtr<nsIFile> path;
  nsCOMPtr<nsIMsgFolder> folder;
  nsresult rv = aNewHdr->GetFolder(getter_AddRefs(folder));
  NS_ENSURE_SUCCESS(rv, rv);
  rv = folder->GetFilePath(getter_AddRefs(path));
  NS_ENSURE_SUCCESS(rv, rv);

  // path to the message download folder
  path->Append(NS_LITERAL_STRING("tmp"));
  path->AppendNative(fileName);

  return path->Remove(false);
}

NS_IMETHODIMP
nsMsgMaildirStore::FinishNewMessage(nsIOutputStream *aOutputStream,
                                    nsIMsgDBHdr *aNewHdr)
{
  NS_ENSURE_ARG_POINTER(aOutputStream);
  NS_ENSURE_ARG_POINTER(aNewHdr);

  aOutputStream->Close();

  nsCOMPtr<nsIFile> folderPath;
  nsCOMPtr<nsIMsgFolder> folder;
  nsresult rv = aNewHdr->GetFolder(getter_AddRefs(folder));
  NS_ENSURE_SUCCESS(rv, rv);
  rv = folder->GetFilePath(getter_AddRefs(folderPath));
  NS_ENSURE_SUCCESS(rv, rv);

  // file path is stored in message header property
  nsAutoCString fileName;
  aNewHdr->GetStringProperty("storeToken", getter_Copies(fileName));
  if (fileName.IsEmpty())
  {
    NS_ERROR("FinishNewMessage - no storeToken in msg hdr!!\n");
    return NS_ERROR_FAILURE;
  }

  // path to the downloaded message
  nsCOMPtr<nsIFile> fromPath;
  folderPath->Clone(getter_AddRefs(fromPath));
  fromPath->Append(NS_LITERAL_STRING("tmp"));
  fromPath->AppendNative(fileName);

  // let's check if the tmp file exists
  bool exists;
  fromPath->Exists(&exists);
  if (!exists)
  {
    NS_ERROR("FinishNewMessage - oops! file does not exist!");
    return NS_ERROR_FAILURE;
  }

  // move to the "cur" subfolder
  nsCOMPtr<nsIFile> toPath;
  folderPath->Clone(getter_AddRefs(toPath));
  toPath->Append(NS_LITERAL_STRING("cur"));

  // let's check if the folder exists
  toPath->Exists(&exists);
  if (!exists)
  {
    rv = toPath->Create(nsIFile::DIRECTORY_TYPE, 0755);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  return fromPath->MoveToNative(toPath, fileName);
}

NS_IMETHODIMP
nsMsgMaildirStore::MoveNewlyDownloadedMessage(nsIMsgDBHdr *aNewHdr,
                                              nsIMsgFolder *aDestFolder,
                                              bool *aResult)
{
  NS_ENSURE_ARG_POINTER(aNewHdr);
  NS_ENSURE_ARG_POINTER(aDestFolder);
  NS_ENSURE_ARG_POINTER(aResult);

  nsCOMPtr<nsIFile> folderPath;
  nsCOMPtr<nsIMsgFolder> folder;
  nsresult rv = aNewHdr->GetFolder(getter_AddRefs(folder));
  NS_ENSURE_SUCCESS(rv, rv);
  rv = folder->GetFilePath(getter_AddRefs(folderPath));
  NS_ENSURE_SUCCESS(rv, rv);

  // file path is stored in message header property
  nsAutoCString fileName;
  aNewHdr->GetStringProperty("storeToken", getter_Copies(fileName));
  if (fileName.IsEmpty())
  {
    NS_ERROR("FinishNewMessage - no storeToken in msg hdr!!\n");
    return NS_ERROR_FAILURE;
  }

  // path to the downloaded message
  nsCOMPtr<nsIFile> fromPath;
  folderPath->Clone(getter_AddRefs(fromPath));
  fromPath->Append(NS_LITERAL_STRING("cur"));
  fromPath->AppendNative(fileName);

  // let's check if the tmp file exists
  bool exists;
  fromPath->Exists(&exists);
  if (!exists)
  {
    NS_ERROR("FinishNewMessage - oops! file does not exist!");
    return NS_ERROR_FAILURE;
  }

  // move to the "cur" subfolder
  nsCOMPtr<nsIFile> toPath;
  aDestFolder->GetFilePath(getter_AddRefs(folderPath));
  folderPath->Clone(getter_AddRefs(toPath));
  toPath->Append(NS_LITERAL_STRING("cur"));

  // let's check if the folder exists
  toPath->Exists(&exists);
  if (!exists)
  {
    rv = toPath->Create(nsIFile::DIRECTORY_TYPE, 0755);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  rv = fromPath->MoveToNative(toPath, fileName);
  *aResult = NS_SUCCEEDED(rv);
  return rv;
}

NS_IMETHODIMP
nsMsgMaildirStore::GetMsgInputStream(nsIMsgFolder *aMsgFolder,
                                     const nsACString &aMsgToken,
                                     int64_t *aOffset,
                                     nsIMsgDBHdr *aMsgHdr,
                                     bool *aReusable,
                                     nsIInputStream **aResult)
{
  NS_ENSURE_ARG_POINTER(aMsgFolder);
  NS_ENSURE_ARG_POINTER(aOffset);
  NS_ENSURE_ARG_POINTER(aResult);

  *aReusable = false; // message per file
  *aOffset = 0;

  // construct path to file
  nsCOMPtr<nsIFile> path;
  nsresult rv = aMsgFolder->GetFilePath(getter_AddRefs(path));
  NS_ENSURE_SUCCESS(rv, rv);

  if (aMsgToken.IsEmpty())
  {
    PR_LOG(MailDirLog, PR_LOG_ALWAYS,
           ("GetMsgInputStream - empty storeToken!!\n"));
    return NS_ERROR_FAILURE;
  }

  path->Append(NS_LITERAL_STRING("cur"));
  path->AppendNative(aMsgToken);

  // let's check if the folder exists
  bool exists;
  path->Exists(&exists);
  if (!exists) {
    PR_LOG(MailDirLog, PR_LOG_ALWAYS,
           ("GetMsgInputStream - oops! cur subfolder does not exist!\n"));
    rv = path->Create(nsIFile::DIRECTORY_TYPE, 0755);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  return NS_NewLocalFileInputStream(aResult, path);
}

NS_IMETHODIMP nsMsgMaildirStore::DeleteMessages(nsIArray *aHdrArray)
{
  uint32_t messageCount;
  nsresult rv = aHdrArray->GetLength(&messageCount);
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr<nsIMsgFolder> folder;

  for (uint32_t i = 0; i < messageCount; i++)
  {
    nsCOMPtr<nsIMsgDBHdr> msgHdr = do_QueryElementAt(aHdrArray, i, &rv);
    if (NS_FAILED(rv))
      continue;
    msgHdr->GetFolder(getter_AddRefs(folder));
    nsCOMPtr<nsIFile> path;
    rv = folder->GetFilePath(getter_AddRefs(path));
    NS_ENSURE_SUCCESS(rv, rv);
    nsAutoCString fileName;
    msgHdr->GetStringProperty("storeToken", getter_Copies(fileName));
    if (fileName.IsEmpty())
      return NS_ERROR_FAILURE;

    if (fileName.IsEmpty())
    {
      PR_LOG(MailDirLog, PR_LOG_ALWAYS,
             ("GetMsgInputStream - empty storeToken!!\n"));
      return NS_ERROR_FAILURE;
    }

    path->Append(NS_LITERAL_STRING("cur"));
    path->AppendNative(fileName);

    // let's check if the folder exists
    bool exists;
    path->Exists(&exists);
    path->Remove(false);
  }
  return NS_OK;
}

NS_IMETHODIMP
nsMsgMaildirStore::CopyMessages(bool aIsMove, nsIArray *aHdrArray,
                               nsIMsgFolder *aDstFolder,
                               nsIMsgCopyServiceListener *aListener,
                               nsITransaction **aUndoAction,
                               bool *aCopyDone)
{
  NS_ENSURE_ARG_POINTER(aHdrArray);
  NS_ENSURE_ARG_POINTER(aDstFolder);
  NS_ENSURE_ARG_POINTER(aCopyDone);
  NS_ENSURE_ARG_POINTER(aUndoAction);
  uint32_t messageCount;
  nsresult rv = aHdrArray->GetLength(&messageCount);
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr<nsIMsgFolder> srcFolder;
  nsCOMPtr<nsIFile> destFolderPath;
  nsCOMPtr<nsIMsgDatabase> destDB;
  nsCOMPtr<nsIMsgDatabase> srcDB;
  aDstFolder->GetMsgDatabase(getter_AddRefs(destDB));
  aDstFolder->GetFilePath(getter_AddRefs(destFolderPath));
  destFolderPath->Append(NS_LITERAL_STRING("cur"));

  nsCOMPtr<nsIMsgDBHdr> msgHdr = do_QueryElementAt(aHdrArray, 0, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  rv = msgHdr->GetFolder(getter_AddRefs(srcFolder));
  NS_ENSURE_SUCCESS(rv, rv);
  srcFolder->GetMsgDatabase(getter_AddRefs(srcDB));
  nsRefPtr<nsLocalMoveCopyMsgTxn> msgTxn = new nsLocalMoveCopyMsgTxn;
  NS_ENSURE_TRUE(msgTxn, NS_ERROR_OUT_OF_MEMORY);
  if (NS_SUCCEEDED(msgTxn->Init(srcFolder, aDstFolder, aIsMove)))
  {
    if (aIsMove)
      msgTxn->SetTransactionType(nsIMessenger::eMoveMsg);
    else
      msgTxn->SetTransactionType(nsIMessenger::eCopyMsg);
  }

  nsCOMPtr<nsIMutableArray> dstHdrs(do_CreateInstance(NS_ARRAY_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  for (uint32_t i = 0; i < messageCount; i++)
  {
    nsCOMPtr<nsIMsgDBHdr> msgHdr = do_QueryElementAt(aHdrArray, i, &rv);
    if (NS_FAILED(rv))
      continue;
    nsMsgKey srcKey;
    msgHdr->GetMessageKey(&srcKey);
    msgTxn->AddSrcKey(srcKey);
    msgHdr->GetFolder(getter_AddRefs(srcFolder));
    nsCOMPtr<nsIFile> path;
    rv = srcFolder->GetFilePath(getter_AddRefs(path));
    NS_ENSURE_SUCCESS(rv, rv);
    nsAutoCString fileName;
    msgHdr->GetStringProperty("storeToken", getter_Copies(fileName));
    if (fileName.IsEmpty())
      return NS_ERROR_FAILURE;

    if (fileName.IsEmpty())
    {
      PR_LOG(MailDirLog, PR_LOG_ALWAYS,
             ("GetMsgInputStream - empty storeToken!!\n"));
      return NS_ERROR_FAILURE;
    }

    path->Append(NS_LITERAL_STRING("cur"));
    path->AppendNative(fileName);

    nsCOMPtr<nsIFile> destFile;
    destFolderPath->Clone(getter_AddRefs(destFile));
    destFile->AppendNative(fileName);
    bool exists;
    destFile->Exists(&exists);
    if (exists)
    {
      rv = destFile->CreateUnique(nsIFile::NORMAL_FILE_TYPE, 0600);
      NS_ENSURE_SUCCESS(rv, rv);
      destFile->GetNativeLeafName(fileName);
    }
    if (aIsMove)
      path->MoveToNative(destFolderPath, fileName);
    else
      path->CopyToNative(destFolderPath, fileName);

    nsCOMPtr<nsIMsgDBHdr> destHdr;
    if (destDB)
    {
      rv = destDB->CopyHdrFromExistingHdr(nsMsgKey_None, msgHdr, true, getter_AddRefs(destHdr));
      NS_ENSURE_SUCCESS(rv, rv);
      destHdr->SetStringProperty("storeToken", fileName.get());
      dstHdrs->AppendElement(destHdr, false);
      nsMsgKey dstKey;
      destHdr->GetMessageKey(&dstKey);
      msgTxn->AddDstKey(dstKey);
    }
  }
  nsCOMPtr<nsIMsgFolderNotificationService> notifier(do_GetService(NS_MSGNOTIFICATIONSERVICE_CONTRACTID));
  if (notifier)
    notifier->NotifyMsgsMoveCopyCompleted(aIsMove, aHdrArray, aDstFolder,
                                          dstHdrs);
  if (aIsMove)
  {
    for (uint32_t i = 0; i < messageCount; ++i)
    {
      nsCOMPtr<nsIMsgDBHdr> msgDBHdr(do_QueryElementAt(aHdrArray, i, &rv));
      rv = srcDB->DeleteHeader(msgDBHdr, nullptr, false, true);
    }
  }
  *aCopyDone = true;
  nsCOMPtr<nsISupports> srcSupports(do_QueryInterface(srcFolder));
  nsCOMPtr<nsIMsgLocalMailFolder> localDest(do_QueryInterface(aDstFolder));
  if (localDest)
    localDest->OnCopyCompleted(srcSupports, true);
  if (aListener)
    aListener->OnStopCopy(NS_OK);
  msgTxn.forget(aUndoAction);
  return NS_OK;
}

NS_IMETHODIMP
nsMsgMaildirStore::GetSupportsCompaction(bool *aSupportsCompaction)
{
  NS_ENSURE_ARG_POINTER(aSupportsCompaction);
  *aSupportsCompaction = false;
  return NS_OK;
}

NS_IMETHODIMP nsMsgMaildirStore::CompactFolder(nsIMsgFolder *aFolder,
                                               nsIUrlListener *aListener,
                                               nsIMsgWindow *aMsgWindow)
{
  return NS_OK;
}

class MaildirStoreParser
{
public:
  MaildirStoreParser(nsIMsgFolder *aFolder, nsIMsgDatabase *aMsgDB,
                     nsISimpleEnumerator *aDirectoryEnumerator,
                     nsIUrlListener *aUrlListener);
  virtual ~MaildirStoreParser();

  nsresult ParseNextMessage(nsIFile *aFile);
  static void TimerCallback(nsITimer *aTimer, void *aClosure);
  nsresult StartTimer();

  nsCOMPtr<nsISimpleEnumerator> m_directoryEnumerator;
  nsCOMPtr<nsIMsgFolder> m_folder;
  nsCOMPtr<nsIMsgDatabase> m_db;
  nsCOMPtr<nsITimer> m_timer;
  nsCOMPtr<nsIUrlListener> m_listener;
};

MaildirStoreParser::MaildirStoreParser(nsIMsgFolder *aFolder,
                                       nsIMsgDatabase *aMsgDB,
                                       nsISimpleEnumerator *aDirEnum,
                                       nsIUrlListener *aUrlListener)
{
  m_folder = aFolder;
  m_db = aMsgDB;
  m_directoryEnumerator = aDirEnum;
  m_listener = aUrlListener;
}

MaildirStoreParser::~MaildirStoreParser()
{
}

nsresult MaildirStoreParser::ParseNextMessage(nsIFile *aFile)
{
  nsresult rv;
  nsCOMPtr<nsIInputStream> inputStream;
  nsCOMPtr<nsIMsgParseMailMsgState> msgParser =
    do_CreateInstance(NS_PARSEMAILMSGSTATE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  msgParser->SetMailDB(m_db);
  nsCOMPtr<nsIMsgDBHdr> newMsgHdr;
  rv = m_db->CreateNewHdr(nsMsgKey_None, getter_AddRefs(newMsgHdr));
  NS_ENSURE_SUCCESS(rv, rv);

  newMsgHdr->SetMessageOffset(0);

  rv = NS_NewLocalFileInputStream(getter_AddRefs(inputStream), aFile);
  if (NS_SUCCEEDED(rv) && inputStream)
  {
    int32_t inputBufferSize = 10240;
    nsMsgLineStreamBuffer *inputStreamBuffer =
      new nsMsgLineStreamBuffer(inputBufferSize, true, false);
    int64_t fileSize;
    aFile->GetFileSize(&fileSize);
    msgParser->SetNewMsgHdr(newMsgHdr);
    msgParser->SetState(nsIMsgParseMailMsgState::ParseHeadersState);
    msgParser->SetEnvelopePos(0);
    bool needMoreData = false;
    char * newLine = nullptr;
    uint32_t numBytesInLine = 0;
    // we only have to read the headers, because we know the message size
    // from the file size. So we can do this in one time slice.
    do
    {
      newLine = inputStreamBuffer->ReadNextLine(inputStream, numBytesInLine,
                                                needMoreData);
      if (newLine)
      {
        msgParser->ParseAFolderLine(newLine, numBytesInLine);
        NS_Free(newLine);
      }
    } while (newLine && numBytesInLine > 0);

    msgParser->FinishHeader();
    // A single message needs to be less than 4GB
    newMsgHdr->SetMessageSize((uint32_t) fileSize);
    m_db->AddNewHdrToDB(newMsgHdr, true);
    nsAutoCString storeToken;
    aFile->GetNativeLeafName(storeToken);
    newMsgHdr->SetStringProperty("storeToken", storeToken.get());
  }
  NS_ENSURE_SUCCESS(rv, rv);
  return rv;
}

void MaildirStoreParser::TimerCallback(nsITimer *aTimer, void *aClosure)
{
  MaildirStoreParser *parser = (MaildirStoreParser *) aClosure;
  bool hasMore;
  parser->m_directoryEnumerator->HasMoreElements(&hasMore);
  if (!hasMore)
  {
    nsCOMPtr<nsIMsgPluggableStore> store;
    parser->m_folder->GetMsgStore(getter_AddRefs(store));
    parser->m_timer->Cancel();
    parser->m_db->SetSummaryValid(true);
//    store->SetSummaryFileValid(parser->m_folder, parser->m_db, true);
    if (parser->m_listener)
    {
      nsresult rv;
      nsCOMPtr<nsIMailboxUrl> mailboxurl =
        do_CreateInstance(NS_MAILBOXURL_CONTRACTID, &rv);
      if (NS_SUCCEEDED(rv) && mailboxurl)
      {
        nsCOMPtr<nsIMsgMailNewsUrl> url = do_QueryInterface(mailboxurl);
        url->SetUpdatingFolder(true);
        nsAutoCString uriSpec("mailbox://");
        // ### TODO - what if SetSpec fails?
        (void) url->SetSpec(uriSpec);
        parser->m_listener->OnStopRunningUrl(url, NS_OK);
      }
    }
    return;
  }
  nsCOMPtr<nsISupports> aSupport;
  parser->m_directoryEnumerator->GetNext(getter_AddRefs(aSupport));
  nsresult rv;
  nsCOMPtr<nsIFile> currentFile(do_QueryInterface(aSupport, &rv));
  NS_ENSURE_SUCCESS_VOID(rv);
  parser->ParseNextMessage(currentFile);
  // ### TODO - what if this fails?
}

nsresult MaildirStoreParser::StartTimer()
{
  nsresult rv;
  m_timer = do_CreateInstance("@mozilla.org/timer;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  m_timer->InitWithFuncCallback(TimerCallback, (void *) this, 0,
                                          nsITimer::TYPE_REPEATING_SLACK);
  return NS_OK;
}

NS_IMETHODIMP nsMsgMaildirStore::RebuildIndex(nsIMsgFolder *aFolder,
                                              nsIMsgDatabase *aMsgDB,
                                              nsIMsgWindow *aMsgWindow,
                                              nsIUrlListener *aListener)
{
  NS_ENSURE_ARG_POINTER(aFolder);
  // This code needs to iterate over the maildir files, and parse each
  // file and add a msg hdr to the db for the file.
  nsCOMPtr<nsIFile> path;
  nsresult rv = aFolder->GetFilePath(getter_AddRefs(path));
  NS_ENSURE_SUCCESS(rv, rv);
  path->Append(NS_LITERAL_STRING("cur"));

  nsCOMPtr<nsISimpleEnumerator> directoryEnumerator;
  rv = path->GetDirectoryEntries(getter_AddRefs(directoryEnumerator));
  NS_ENSURE_SUCCESS(rv, rv);

  MaildirStoreParser *fileParser = new MaildirStoreParser(aFolder, aMsgDB,
                                                          directoryEnumerator,
                                                          aListener);
  NS_ENSURE_TRUE(fileParser, NS_ERROR_OUT_OF_MEMORY);
  fileParser->StartTimer();
  return NS_OK;
}

NS_IMETHODIMP nsMsgMaildirStore::ChangeFlags(nsIArray *aHdrArray,
                                             uint32_t aFlags,
                                             bool aSet)
{
  NS_ENSURE_ARG_POINTER(aHdrArray);

  uint32_t messageCount;
  nsresult rv = aHdrArray->GetLength(&messageCount);
  NS_ENSURE_SUCCESS(rv, rv);

  for (uint32_t i = 0; i < messageCount; i++)
  {
    nsCOMPtr<nsIMsgDBHdr> msgHdr = do_QueryElementAt(aHdrArray, i, &rv);
    // get output stream for header
    nsCOMPtr<nsIOutputStream> outputStream;
    rv = GetOutputStream(msgHdr, outputStream);
    NS_ENSURE_SUCCESS(rv, rv);
    // Seek to x-mozilla-status offset and rewrite value.
    rv = UpdateFolderFlag(msgHdr, aSet, aFlags, outputStream);
    if (NS_FAILED(rv))
      NS_WARNING("updateFolderFlag failed");
  }
  return NS_OK;
}

// get output stream from header
nsresult
nsMsgMaildirStore::GetOutputStream(nsIMsgDBHdr *aHdr,
                                   nsCOMPtr<nsIOutputStream> &aOutputStream)
{
  // file name is stored in message header property "storeToken"
  nsAutoCString fileName;
  aHdr->GetStringProperty("storeToken", getter_Copies(fileName));
  if (fileName.IsEmpty())
    return NS_ERROR_FAILURE;

  nsCOMPtr<nsIMsgFolder> folder;
  nsresult rv = aHdr->GetFolder(getter_AddRefs(folder));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIFile> folderPath;
  rv = folder->GetFilePath(getter_AddRefs(folderPath));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIFile> maildirFile;
  folderPath->Clone(getter_AddRefs(maildirFile));
  maildirFile->Append(NS_LITERAL_STRING("cur"));
  maildirFile->AppendNative(fileName);

  return MsgGetFileStream(maildirFile, getter_AddRefs(aOutputStream));
}

NS_IMETHODIMP nsMsgMaildirStore::ChangeKeywords(nsIArray *aHdrArray,
                                             const nsACString &aKeywords,
                                             bool aAdd)
{
  NS_ENSURE_ARG_POINTER(aHdrArray);
  NS_ENSURE_ARG_POINTER(aHdrArray);
  nsCOMPtr<nsIOutputStream> outputStream;
  nsCOMPtr<nsISeekableStream> seekableStream;

  uint32_t messageCount;
  nsresult rv = aHdrArray->GetLength(&messageCount);
  NS_ENSURE_SUCCESS(rv, rv);
  if (!messageCount)
    return NS_ERROR_INVALID_ARG;

  nsAutoPtr<nsLineBuffer<char> > lineBuffer(new nsLineBuffer<char>);
  NS_ENSURE_TRUE(lineBuffer, NS_ERROR_OUT_OF_MEMORY);

  nsTArray<nsCString> keywordArray;
  ParseString(aKeywords, ' ', keywordArray);

  for (uint32_t i = 0; i < messageCount; ++i) // for each message
  {
    nsCOMPtr<nsIMsgDBHdr> message = do_QueryElementAt(aHdrArray, i, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    // get output stream for header
    nsCOMPtr<nsIOutputStream> outputStream;
    rv = GetOutputStream(message, outputStream);
    NS_ENSURE_SUCCESS(rv, rv);
    nsCOMPtr <nsIInputStream> inputStream = do_QueryInterface(outputStream, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    nsCOMPtr <nsISeekableStream> seekableStream(do_QueryInterface(inputStream, &rv));
    NS_ENSURE_SUCCESS(rv, rv);
    uint32_t statusOffset = 0;
    (void)message->GetStatusOffset(&statusOffset);
    uint64_t desiredOffset = statusOffset;

    ChangeKeywordsHelper(message, desiredOffset, lineBuffer, keywordArray,
                         aAdd, outputStream, seekableStream, inputStream);
    if (inputStream)
      inputStream->Close();
    // ### TODO - if growKeywords property is set on the message header,
    // we need to rewrite the message file with extra room for the keywords,
    // or schedule some sort of background task to do this.
  }
  lineBuffer = nullptr;
  return NS_OK;
}

/**
 * Finds the directory associated with this folder. That is if the path is
 * c:\Inbox, it will return c:\Inbox.sbd if it succeeds. Path is strictly
 * an out parameter.
 */
nsresult nsMsgMaildirStore::GetDirectoryForFolder(nsIFile *path)
{
  // add directory separator to the path
  nsAutoString leafName;
  path->GetLeafName(leafName);
  leafName.AppendLiteral(FOLDER_SUFFIX);
  return path->SetLeafName(leafName);
}

nsresult nsMsgMaildirStore::CreateDirectoryForFolder(nsIFile *path,
                                                     bool aIsServer)
{
  nsresult rv = NS_OK;
  if (!aIsServer)
  {
    rv = GetDirectoryForFolder(path);
    NS_ENSURE_SUCCESS(rv, rv);
  }
  bool pathIsDirectory = false;
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
  return rv;
}
