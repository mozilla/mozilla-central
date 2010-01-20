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
 * Portions created by the Initial Developer are Copyright (C) 2001
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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
#include "nsCOMPtr.h"
#include "nsIMsgFolder.h"
#include "nsILocalFile.h"
#include "nsNetUtil.h"
#include "nsIMsgHdr.h"
#include "nsIStreamListener.h"
#include "nsIMsgMessageService.h"
#include "nsMsgDBCID.h"
#include "nsMsgUtils.h"
#include "nsISeekableStream.h"
#include "nsIDBFolderInfo.h"
#include "nsIDocShell.h"
#include "nsMsgFolderCompactor.h"
#include "nsIPrompt.h"
#include "nsIInterfaceRequestorUtils.h"
#include "nsIMsgLocalMailFolder.h"
#include "nsIMsgImapMailFolder.h"
#include "nsMailHeaders.h"
#include "nsMsgI18N.h"
#include "prprf.h"
#include "nsMsgLocalFolderHdrs.h"
#include "nsIMsgDatabase.h"
#include "nsArrayUtils.h"
#include "nsMsgMessageFlags.h"
#include "nsIMsgStatusFeedback.h"
#include "nsMsgBaseCID.h"
#include "nsIMsgFolderNotificationService.h"

//////////////////////////////////////////////////////////////////////////////
// nsFolderCompactState
//////////////////////////////////////////////////////////////////////////////

NS_IMPL_ISUPPORTS5(nsFolderCompactState, nsIMsgFolderCompactor, nsIRequestObserver, nsIStreamListener, nsICopyMessageStreamListener, nsIUrlListener)

nsFolderCompactState::nsFolderCompactState()
{
  m_fileStream = nsnull;
  m_size = 0;
  m_curIndex = -1;
  m_status = NS_OK;
  m_compactAll = PR_FALSE;
  m_compactOfflineAlso = PR_FALSE;
  m_compactingOfflineFolders = PR_FALSE;
  m_parsingFolder=PR_FALSE;
  m_folderIndex = 0;
  m_startOfMsg = PR_TRUE;
  m_needStatusLine = PR_FALSE;
}

nsFolderCompactState::~nsFolderCompactState()
{
  CloseOutputStream();

  if (NS_FAILED(m_status))
  {
    CleanupTempFilesAfterError();
    // if for some reason we failed remove the temp folder and database
  }
}

void nsFolderCompactState::CloseOutputStream()
{
  if (m_fileStream)
  {
    m_fileStream->Close();
    m_fileStream = nsnull;
  }

}

void nsFolderCompactState::CleanupTempFilesAfterError()
{
  CloseOutputStream();
  if (m_db)
    m_db->ForceClosed();
  nsCOMPtr <nsILocalFile> summaryFile;
  GetSummaryFileLocation(m_file, getter_AddRefs(summaryFile)); 
  m_file->Remove(PR_FALSE);
  summaryFile->Remove(PR_FALSE);
}

nsresult nsFolderCompactState::BuildMessageURI(const char *baseURI, PRUint32 key, nsCString& uri)
{
  uri.Append(baseURI);
  uri.Append('#');
  uri.AppendInt(key);
  return NS_OK;
}


nsresult
nsFolderCompactState::InitDB(nsIMsgDatabase *db)
{
  nsCOMPtr<nsIMsgDatabase> mailDBFactory;

  db->ListAllKeys(m_keyArray);
  nsresult rv;
  nsCOMPtr<nsIMsgDBService> msgDBService = do_GetService(NS_MSGDB_SERVICE_CONTRACTID, &rv);
  if (msgDBService) 
  {
    nsresult folderOpen = msgDBService->OpenMailDBFromFile(m_file, PR_TRUE,
                                     PR_FALSE,
                                     getter_AddRefs(m_db));

    if(NS_FAILED(folderOpen) &&
       folderOpen == NS_MSG_ERROR_FOLDER_SUMMARY_OUT_OF_DATE || 
       folderOpen == NS_MSG_ERROR_FOLDER_SUMMARY_MISSING )
    {
      // if it's out of date then reopen with upgrade.
      rv = msgDBService->OpenMailDBFromFile(m_file,
                               PR_TRUE, PR_TRUE,
                               getter_AddRefs(m_db));
    }
  }
  return rv;
}

NS_IMETHODIMP nsFolderCompactState::CompactFolders(nsIArray *aArrayOfFoldersToCompact,
                                                   nsIArray *aOfflineFolderArray,
                                                   nsIUrlListener *aUrlListener,
                                                   nsIMsgWindow *aMsgWindow)
{
  m_window = aMsgWindow;
  m_listener = aUrlListener;
  if (aArrayOfFoldersToCompact)
    m_folderArray = aArrayOfFoldersToCompact;
  else if (aOfflineFolderArray)
  {
    m_folderArray = aOfflineFolderArray;
    m_compactingOfflineFolders = PR_TRUE;
    aOfflineFolderArray = nsnull;
  }
  if (!m_folderArray)
    return NS_OK;
 
  m_compactAll = PR_TRUE;
  m_compactOfflineAlso = aOfflineFolderArray != nsnull;
  if (m_compactOfflineAlso)
    m_offlineFolderArray = aOfflineFolderArray;

  m_folderIndex = 0;
  nsresult rv = NS_OK;
  nsCOMPtr<nsIMsgFolder> firstFolder = do_QueryElementAt(m_folderArray,
                                                         m_folderIndex, &rv);

  if (NS_SUCCEEDED(rv) && firstFolder)
    Compact(firstFolder, m_compactingOfflineFolders, aUrlListener, 
            aMsgWindow);   //start with first folder from here.
  
  return rv;
}

NS_IMETHODIMP
nsFolderCompactState::Compact(nsIMsgFolder *folder, PRBool aOfflineStore,
                              nsIUrlListener *aListener, nsIMsgWindow *aMsgWindow)
{
  NS_ENSURE_ARG_POINTER(folder);
  m_listener = aListener;
  if (!m_compactingOfflineFolders && !aOfflineStore)
  {
    nsCOMPtr <nsIMsgImapMailFolder> imapFolder = do_QueryInterface(folder);
    if (imapFolder)
      return imapFolder->Expunge(this, aMsgWindow);
  }
   m_window = aMsgWindow;
   nsresult rv;
   nsCOMPtr<nsIMsgDatabase> db;
   nsCOMPtr<nsIDBFolderInfo> folderInfo;
   nsCOMPtr<nsIMsgDatabase> mailDBFactory;
   nsCOMPtr<nsILocalFile> path;
   nsCString baseMessageURI;

   nsCOMPtr <nsIMsgLocalMailFolder> localFolder = do_QueryInterface(folder, &rv);
   if (NS_SUCCEEDED(rv) && localFolder)
   {
     rv=localFolder->GetDatabaseWOReparse(getter_AddRefs(db));
     if (NS_FAILED(rv) || !db)
     {
       if (rv == NS_MSG_ERROR_FOLDER_SUMMARY_MISSING ||
           rv == NS_MSG_ERROR_FOLDER_SUMMARY_OUT_OF_DATE)
       {
         m_folder = folder;  //will be used to compact
         m_parsingFolder = PR_TRUE;
         rv = localFolder->ParseFolder(m_window, this);
       }
       return rv;
     }
     else
     {
       PRBool valid;  
       rv = db->GetSummaryValid(&valid); 
       if (!valid) //we are probably parsing the folder because we selected it.
       {
         folder->NotifyCompactCompleted();
         if (m_compactAll)
           return CompactNextFolder();
         else
           return NS_OK;
       }
     }
   }
   else
   {
     rv = folder->GetMsgDatabase(getter_AddRefs(db));
     NS_ENSURE_SUCCESS(rv, rv);
   }
   rv = folder->GetFilePath(getter_AddRefs(path));
   NS_ENSURE_SUCCESS(rv, rv);

   rv = folder->GetBaseMessageURI(baseMessageURI);
   NS_ENSURE_SUCCESS(rv, rv);
    
   rv = Init(folder, baseMessageURI.get(), db, path, m_window);
   NS_ENSURE_SUCCESS(rv, rv);

   PRBool isLocked;
   m_folder->GetLocked(&isLocked);
   if(!isLocked)
   {
     nsCOMPtr <nsISupports> supports = do_QueryInterface(static_cast<nsIMsgFolderCompactor*>(this));
     m_folder->AcquireSemaphore(supports);
     return StartCompacting();
   }
   else
   {
     m_folder->NotifyCompactCompleted();
     m_folder->ThrowAlertMsg("compactFolderDeniedLock", m_window);
     CleanupTempFilesAfterError();
     if (m_compactAll)
       return CompactNextFolder();
     else
       return NS_OK;
   }
}

nsresult nsFolderCompactState::ShowStatusMsg(const nsString& aMsg)
{
  nsCOMPtr <nsIMsgStatusFeedback> statusFeedback;
  if (m_window)
  {
    m_window->GetStatusFeedback(getter_AddRefs(statusFeedback));
    if (statusFeedback && !aMsg.IsEmpty())
      return statusFeedback->SetStatusString(aMsg);
  }
  return NS_OK;
}

nsresult
nsFolderCompactState::Init(nsIMsgFolder *folder, const char *baseMsgUri, nsIMsgDatabase *db,
                           nsILocalFile *path, nsIMsgWindow *aMsgWindow)
{
  nsresult rv;

  m_folder = folder;
  m_baseMessageUri = baseMsgUri;
  m_file = do_CreateInstance(NS_LOCAL_FILE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  m_file->InitWithFile(path);
  // need to make sure the temp file goes in the same real directory
  // as the original file, so resolve sym links.
  m_file->SetFollowLinks(PR_TRUE);

  m_file->SetNativeLeafName(NS_LITERAL_CSTRING("nstmp"));
  m_file->CreateUnique(nsIFile::NORMAL_FILE_TYPE, 00600);   //make sure we are not crunching existing nstmp file
  m_window = aMsgWindow;
  m_keyArray.Clear();
  m_totalMsgSize = 0;
  rv = InitDB(db);
  if (NS_FAILED(rv))
  {
    CleanupTempFilesAfterError();
    return rv;
  }

  m_size = m_keyArray.Length();
  m_curIndex = 0;
  
  rv = NS_NewLocalFileOutputStream(getter_AddRefs(m_fileStream), m_file, -1, 00600);
  if (NS_FAILED(rv)) 
    m_folder->ThrowAlertMsg("compactFolderWriteFailed", m_window);
  else
    rv = GetMessageServiceFromURI(nsDependentCString(baseMsgUri),
                                getter_AddRefs(m_messageService));
  if (NS_FAILED(rv))
  {
    m_status = rv;
    Release(); // let go of ourselves...
  }
  return rv;
}

void nsFolderCompactState::ShowCompactingStatusMsg()
{
  nsString statusString;
  nsresult rv = m_folder->GetStringWithFolderNameFromBundle("compactingFolder", statusString);
  if (!statusString.IsEmpty() && NS_SUCCEEDED(rv))
    ShowStatusMsg(statusString);
}

NS_IMETHODIMP nsFolderCompactState::OnStartRunningUrl(nsIURI *url)
{
  return NS_OK;
}

NS_IMETHODIMP nsFolderCompactState::OnStopRunningUrl(nsIURI *url, nsresult status)
{
  if (m_parsingFolder)
  {
    m_parsingFolder = PR_FALSE;
    if (NS_SUCCEEDED(status))
      status = Compact(m_folder, m_compactingOfflineFolders, this, m_window);
    else if (m_compactAll)
      CompactNextFolder();
  }
  else if (m_compactAll) // this should be the imap case only
  {
    nsCOMPtr <nsIMsgFolder> prevFolder = do_QueryElementAt(m_folderArray,
                                                           m_folderIndex);
    if (prevFolder)
      prevFolder->SetMsgDatabase(nsnull);
    CompactNextFolder();
  }
  else if (m_listener)
  {
    CompactCompleted(status);
  }
  return NS_OK;
}

nsresult nsFolderCompactState::StartCompacting()
{
  nsresult rv = NS_OK;
  // Notify that compaction is beginning.  We do this even if there are no
  // messages to be copied because the summary database still gets blown away
  // which is still pretty interesting.  (And we like consistency.)
  nsCOMPtr<nsIMsgFolderNotificationService>
    notifier(do_GetService(NS_MSGNOTIFICATIONSERVICE_CONTRACTID));
  if (notifier)
    notifier->NotifyItemEvent(m_folder,
                              NS_LITERAL_CSTRING("FolderCompactStart"),
                              nsnull);
  if (m_size > 0)
  {

    ShowCompactingStatusMsg();
    AddRef();
    rv = m_messageService->CopyMessages(m_keyArray, m_folder, this, PR_FALSE, nsnull, m_window, nsnull);
    // m_curIndex = m_size;  // advance m_curIndex to the end - we're done

  }
  else
  { // no messages to copy with
    FinishCompact();
//    Release(); // we don't "own" ourselves yet.
  }
  return rv;
}

nsresult
nsFolderCompactState::FinishCompact()
{
    // All okay time to finish up the compact process
  nsresult rv = NS_OK;
  nsCOMPtr<nsILocalFile> path;
  nsCOMPtr<nsIDBFolderInfo> folderInfo; 

    // get leaf name and database name of the folder
  rv = m_folder->GetFilePath(getter_AddRefs(path));
  nsCOMPtr <nsILocalFile> folderPath = do_CreateInstance(NS_LOCAL_FILE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr <nsILocalFile> summaryFile;
  folderPath->InitWithFile(path);
  // need to make sure we put the .msf file in the same directory
  // as the original mailbox, so resolve symlinks.
  folderPath->SetFollowLinks(PR_TRUE);
  GetSummaryFileLocation(folderPath, getter_AddRefs(summaryFile));
  
  nsCString leafName;
  summaryFile->GetNativeLeafName(leafName);
  nsCAutoString dbName(leafName);

  path->GetNativeLeafName(leafName);

    // close down the temp file stream; preparing for deleting the old folder
    // and its database; then rename the temp folder and database
  m_fileStream->Flush();
  m_fileStream->Close();
  m_fileStream = nsnull;

  // make sure the new database is valid.
  // Close it so we can rename the .msf file.
  if (m_db)
  {
    m_db->SetSummaryValid(PR_TRUE);
    m_db->ForceClosed();
    m_db = nsnull;
  }

  nsCOMPtr <nsILocalFile> newSummaryFile;
  GetSummaryFileLocation(m_file, getter_AddRefs(newSummaryFile));

  nsCOMPtr <nsIDBFolderInfo> transferInfo;
  m_folder->GetDBTransferInfo(getter_AddRefs(transferInfo));

  // close down database of the original folder
  m_folder->ForceDBClosed();

  nsCOMPtr<nsIFile> cloneFile;
  PRInt64 fileSize;
  m_file->Clone(getter_AddRefs(cloneFile));
  cloneFile->GetFileSize(&fileSize);
  PRBool tempFileRightSize = (fileSize == m_totalMsgSize);
  NS_ASSERTION(tempFileRightSize, "temp file not of expected size in compact");
  
  PRBool folderRenameSucceeded = PR_FALSE;
  PRBool msfRenameSucceeded = PR_FALSE;
  if (tempFileRightSize)
  {
    PRBool summaryFileExists;
    // remove the old folder and database
    rv = summaryFile->Remove(PR_FALSE);
    summaryFile->Exists(&summaryFileExists);
    if (NS_SUCCEEDED(rv) && !summaryFileExists)
    {
      PRBool folderPathExists;
      rv = folderPath->Remove(PR_FALSE);
      folderPath->Exists(&folderPathExists);
      if (NS_SUCCEEDED(rv) && !folderPathExists)
      {
        // rename the copied folder and database to be the original folder and
        // database 
        rv = m_file->MoveToNative((nsIFile *) nsnull, leafName);
        NS_ASSERTION(NS_SUCCEEDED(rv), "error renaming compacted folder");
        if (NS_SUCCEEDED(rv))
        {
          folderRenameSucceeded = PR_TRUE;
          rv = newSummaryFile->MoveToNative((nsIFile *) nsnull, dbName);
          NS_ASSERTION(NS_SUCCEEDED(rv), "error renaming compacted folder's db");
          msfRenameSucceeded = NS_SUCCEEDED(rv);
        }
      }
    }
    NS_ASSERTION(msfRenameSucceeded && folderRenameSucceeded, "rename failed in compact");
  }
  if (!folderRenameSucceeded)
    m_file->Remove(PR_FALSE);
  if (!msfRenameSucceeded)
    newSummaryFile->Remove(PR_FALSE);
  rv = ReleaseFolderLock();
  NS_ASSERTION(NS_SUCCEEDED(rv),"folder lock not released successfully");
  if (msfRenameSucceeded && folderRenameSucceeded)
  {
    m_folder->SetDBTransferInfo(transferInfo);

    nsCOMPtr <nsIDBFolderInfo> dbFolderInfo;

    m_folder->GetDBFolderInfoAndDB(getter_AddRefs(dbFolderInfo), getter_AddRefs(m_db));

    // since we're transferring info from the old db, we need to reset the expunged bytes,
    // and set the summary valid again.
    if(dbFolderInfo)
      dbFolderInfo->SetExpungedBytes(0);
  }
  if (m_db)
    m_db->Close(PR_TRUE);
  m_db = nsnull;

  // Notify that compaction of the folder is completed.
  nsCOMPtr<nsIMsgFolderNotificationService>
    notifier(do_GetService(NS_MSGNOTIFICATIONSERVICE_CONTRACTID));
  if (notifier)
    notifier->NotifyItemEvent(m_folder,
                              NS_LITERAL_CSTRING("FolderCompactFinish"),
                              nsnull);
  m_folder->NotifyCompactCompleted();

  if (m_compactAll)
    rv = CompactNextFolder();
  else
    CompactCompleted(NS_OK);
      
  return rv;
}

void nsFolderCompactState::CompactCompleted(nsresult exitCode)
{
  NS_WARN_IF_FALSE(NS_SUCCEEDED(exitCode),
                   "nsFolderCompactState::CompactCompleted failed");
  if (m_listener)
    m_listener->OnStopRunningUrl(nsnull, exitCode);
  ShowDoneStatus();
}

nsresult
nsFolderCompactState::ReleaseFolderLock()
{
  nsresult result = NS_OK;
  if (!m_folder) return result;
  PRBool haveSemaphore;
  nsCOMPtr <nsISupports> supports = do_QueryInterface(static_cast<nsIMsgFolderCompactor*>(this));
  result = m_folder->TestSemaphore(supports, &haveSemaphore);
  if(NS_SUCCEEDED(result) && haveSemaphore)
    result = m_folder->ReleaseSemaphore(supports);
  return result;
}

void nsFolderCompactState::ShowDoneStatus()
{
  if (m_folder)
  {
    nsString statusString;
    nsresult rv = m_folder->GetStringWithFolderNameFromBundle("doneCompacting", statusString);
    if (!statusString.IsEmpty() && NS_SUCCEEDED(rv))
      ShowStatusMsg(statusString);
  }
}

nsresult
nsFolderCompactState::CompactNextFolder()
{
  m_folderIndex++;
  PRUint32 cnt = 0;
  nsresult rv = m_folderArray->GetLength(&cnt);
  NS_ENSURE_SUCCESS(rv, rv);
  // m_folderIndex might be > cnt if we compact offline stores,
  // and get back here from OnStopRunningUrl.
  if (m_folderIndex >= cnt)
  {
    if (!m_compactOfflineAlso || m_compactingOfflineFolders)
    {
      CompactCompleted(NS_OK);
      return rv;
    }
    m_compactingOfflineFolders = PR_TRUE;
    nsCOMPtr<nsIMsgFolder> folder = do_QueryElementAt(m_folderArray,
                                                      m_folderIndex-1, &rv);
    if (NS_SUCCEEDED(rv) && folder)
      return folder->CompactAllOfflineStores(this, m_window, m_offlineFolderArray);
    else
      NS_WARNING("couldn't get folder to compact offline stores");

  }
  nsCOMPtr<nsIMsgFolder> folder = do_QueryElementAt(m_folderArray,
                                                    m_folderIndex, &rv);

  if (NS_SUCCEEDED(rv) && folder)
    rv = Compact(folder, m_compactingOfflineFolders, m_listener, m_window);
  else
    CompactCompleted(rv);
  return rv;
}

nsresult
nsFolderCompactState::GetMessage(nsIMsgDBHdr **message)
{
  return GetMsgDBHdrFromURI(m_messageUri.get(), message);
}


NS_IMETHODIMP
nsFolderCompactState::OnStartRequest(nsIRequest *request, nsISupports *ctxt)
{
  return StartMessage();
}

NS_IMETHODIMP
nsFolderCompactState::OnStopRequest(nsIRequest *request, nsISupports *ctxt,
                                    nsresult status)
{
  nsresult rv = status;
  nsCOMPtr<nsIMsgDBHdr> msgHdr;
  nsCOMPtr<nsIMsgDBHdr> newMsgHdr;

  if (NS_FAILED(rv)) goto done;
  EndCopy(nsnull, status);
  if (m_curIndex >= m_size)
  {
    msgHdr = nsnull;
    newMsgHdr = nsnull;
    // no more to copy finish it up
   FinishCompact();
    Release(); // kill self
  }
  else
  {
    // in case we're not getting an error, we still need to pretend we did get an error,
    // because the compact did not successfully complete.
    if (NS_SUCCEEDED(status))
    {
      m_folder->NotifyCompactCompleted();
      CleanupTempFilesAfterError();
      ReleaseFolderLock();
      Release();
    }
  }

done:
  if (NS_FAILED(rv)) {
    m_status = rv; // set the status to rv so the destructor can remove the
                   // temp folder and database
    m_folder->NotifyCompactCompleted();
    ReleaseFolderLock();
    Release(); // kill self
    return rv;
  }
  return rv;
}

NS_IMETHODIMP
nsFolderCompactState::OnDataAvailable(nsIRequest *request, nsISupports *ctxt,
                                      nsIInputStream *inStr,
                                      PRUint32 sourceOffset, PRUint32 count)
{
  if (!m_fileStream || !inStr) 
    return NS_ERROR_FAILURE;

  nsresult rv = NS_OK;
  PRUint32 msgFlags;
  PRBool checkForKeyword = m_startOfMsg;
  PRBool addKeywordHdr = PR_FALSE;
  PRUint32 needToGrowKeywords = 0;
  PRUint32 statusOffset;
  nsCString msgHdrKeywords;

  if (m_startOfMsg)
  {
    m_statusOffset = 0;
    m_addedHeaderSize = 0;
    m_messageUri.SetLength(0); // clear the previous message uri
    if (NS_SUCCEEDED(BuildMessageURI(m_baseMessageUri.get(), m_keyArray[m_curIndex],
                                m_messageUri)))
    {
      rv = GetMessage(getter_AddRefs(m_curSrcHdr));
      NS_ENSURE_SUCCESS(rv, rv);
      if (m_curSrcHdr)
      {
        (void) m_curSrcHdr->GetFlags(&msgFlags);
        (void) m_curSrcHdr->GetStatusOffset(&statusOffset);
        
        if (statusOffset == 0)
          m_needStatusLine = PR_TRUE;
        // x-mozilla-status lines should be at the start of the headers, and the code
        // below assumes everything will fit in m_dataBuffer - if there's not
        // room, skip the keyword stuff.
        if (statusOffset > sizeof(m_dataBuffer) - 1024)
        {
          checkForKeyword = PR_FALSE;
          NS_ASSERTION(PR_FALSE, "status offset past end of read buffer size");
          
        }
      }
    }
    m_startOfMsg = PR_FALSE;
  }
  PRUint32 maxReadCount, readCount, writeCount;
  PRUint32 bytesWritten;
  
  while (NS_SUCCEEDED(rv) && (PRInt32) count > 0)
  {
    maxReadCount = count > sizeof(m_dataBuffer) - 1 ? sizeof(m_dataBuffer) - 1 : count;
    writeCount = 0;
    rv = inStr->Read(m_dataBuffer, maxReadCount, &readCount);
    
    // if status offset is past the number of bytes we read, it's probably bogus,
    // and we shouldn't do any of the keyword stuff.
    if (statusOffset + X_MOZILLA_STATUS_LEN > readCount)
      checkForKeyword = PR_FALSE;
    
    if (NS_SUCCEEDED(rv))
    {
      if (checkForKeyword)
      {
        // make sure that status offset really points to x-mozilla-status line
        if  (!strncmp(m_dataBuffer + statusOffset, X_MOZILLA_STATUS, X_MOZILLA_STATUS_LEN))
        {
          const char *keywordHdr = PL_strnrstr(m_dataBuffer, HEADER_X_MOZILLA_KEYWORDS, readCount);
          if (keywordHdr)
            m_curSrcHdr->GetUint32Property("growKeywords", &needToGrowKeywords);
          else
            addKeywordHdr = PR_TRUE;
          m_curSrcHdr->GetStringProperty("keywords", getter_Copies(msgHdrKeywords));
        }
        checkForKeyword = PR_FALSE;
      }
      PRUint32 blockOffset = 0;
      if (m_needStatusLine)
      {
        m_needStatusLine = PR_FALSE;
        // we need to parse out the "From " header, write it out, then 
        // write out the x-mozilla-status headers, and set the 
        // status offset of the dest hdr for later use 
        // in OnEndCopy).
        if (!strncmp(m_dataBuffer, "From ", 5))
        {
          blockOffset = 5;
          // skip from line
          MsgAdvanceToNextLine(m_dataBuffer, blockOffset, readCount);
          char statusLine[50];
          m_fileStream->Write(m_dataBuffer, blockOffset, &writeCount);
          m_statusOffset = blockOffset;
          PR_snprintf(statusLine, sizeof(statusLine), X_MOZILLA_STATUS_FORMAT MSG_LINEBREAK, msgFlags & 0xFFFF);
          m_fileStream->Write(statusLine, strlen(statusLine), &m_addedHeaderSize);
          PR_snprintf(statusLine, sizeof(statusLine), X_MOZILLA_STATUS2_FORMAT MSG_LINEBREAK, msgFlags & 0xFFFF0000);
          m_fileStream->Write(statusLine, strlen(statusLine), &bytesWritten);
          m_addedHeaderSize += bytesWritten;
        }
        else
        {
          NS_ASSERTION(PR_FALSE, "not an envelope");
          // try to mark the db as invalid so it will be reparsed.
          nsCOMPtr <nsIMsgDatabase> srcDB;
          m_folder->GetMsgDatabase(getter_AddRefs(srcDB));
          if (srcDB)
          {
            srcDB->SetSummaryValid(PR_FALSE);
            srcDB->ForceClosed();
          }
        }
      }
#define EXTRA_KEYWORD_HDR "                                                                                 "MSG_LINEBREAK

       // if status offset isn't in the first block, this code won't work. There's no good reason
      // for the status offset not to be at the beginning of the message anyway.
      if (addKeywordHdr)
      {
        // if blockOffset is set, we added x-mozilla-status headers so
        // file pointer is already past them.
        if (!blockOffset)
        {
          blockOffset = statusOffset;
          // skip x-mozilla-status and status2 lines.
          MsgAdvanceToNextLine(m_dataBuffer, blockOffset, readCount);
          MsgAdvanceToNextLine(m_dataBuffer, blockOffset, readCount);
          // need to rewrite the headers up to and including the x-mozilla-status2 header
          m_fileStream->Write(m_dataBuffer, blockOffset, &writeCount);
        }
        // we should write out the existing keywords from the msg hdr, if any.
        if (msgHdrKeywords.IsEmpty())
        { // no keywords, so write blank header
          m_fileStream->Write(X_MOZILLA_KEYWORDS, sizeof(X_MOZILLA_KEYWORDS) - 1, &bytesWritten);
          m_addedHeaderSize += bytesWritten;
        }
        else
        {
          if (msgHdrKeywords.Length() < sizeof(X_MOZILLA_KEYWORDS) - sizeof(HEADER_X_MOZILLA_KEYWORDS) + 10 /* allow some slop */)
          { // keywords fit in normal blank header, so replace blanks in keyword hdr with keywords
            nsCAutoString keywordsHdr(X_MOZILLA_KEYWORDS);
            keywordsHdr.Replace(sizeof(HEADER_X_MOZILLA_KEYWORDS) + 1, msgHdrKeywords.Length(), msgHdrKeywords);
            m_fileStream->Write(keywordsHdr.get(), keywordsHdr.Length(), &bytesWritten);
            m_addedHeaderSize += bytesWritten;
          }
          else
          { // keywords don't fit, so write out keywords on one line and an extra blank line
            nsCString newKeywordHeader(HEADER_X_MOZILLA_KEYWORDS ": ");
            newKeywordHeader.Append(msgHdrKeywords);
            newKeywordHeader.Append(MSG_LINEBREAK EXTRA_KEYWORD_HDR);
            m_fileStream->Write(newKeywordHeader.get(), newKeywordHeader.Length(), &bytesWritten);
            m_addedHeaderSize += bytesWritten;
          }
        }
        addKeywordHdr = PR_FALSE;
      }
      else if (needToGrowKeywords)
      {
        blockOffset = statusOffset;
        if (!strncmp(m_dataBuffer + blockOffset, X_MOZILLA_STATUS, X_MOZILLA_STATUS_LEN))
          MsgAdvanceToNextLine(m_dataBuffer, blockOffset, readCount); // skip x-mozilla-status hdr
        if (!strncmp(m_dataBuffer + blockOffset, X_MOZILLA_STATUS2, X_MOZILLA_STATUS2_LEN))
          MsgAdvanceToNextLine(m_dataBuffer, blockOffset, readCount); // skip x-mozilla-status2 hdr
        PRUint32 preKeywordBlockOffset = blockOffset;
        if (!strncmp(m_dataBuffer + blockOffset, HEADER_X_MOZILLA_KEYWORDS, sizeof(HEADER_X_MOZILLA_KEYWORDS) - 1))
        {
          do
          {
            // skip x-mozilla-keywords hdr and any existing continuation headers
            MsgAdvanceToNextLine(m_dataBuffer, blockOffset, readCount);
          }
          while (m_dataBuffer[blockOffset] == ' ');
        }
        PRInt32 oldKeywordSize = blockOffset - preKeywordBlockOffset;

        // rewrite the headers up to and including the x-mozilla-status2 header
        m_fileStream->Write(m_dataBuffer, preKeywordBlockOffset, &writeCount);
        // let's just rewrite all the keywords on several lines and add a blank line,
        // instead of worrying about which are missing.
        PRBool done = PR_FALSE;
        nsCAutoString keywordHdr(HEADER_X_MOZILLA_KEYWORDS ": ");
        PRInt32 nextBlankOffset = 0;
        PRInt32 curHdrLineStart = 0;
        PRInt32 newKeywordSize = 0;
        while (!done)
        {
          nextBlankOffset = msgHdrKeywords.FindChar(' ', nextBlankOffset);
          if (nextBlankOffset == kNotFound)
          {
            nextBlankOffset = msgHdrKeywords.Length();
            done = PR_TRUE;
          }
          if (nextBlankOffset - curHdrLineStart > 90 || done)
          {
            keywordHdr.Append(nsDependentCSubstring(msgHdrKeywords, curHdrLineStart, msgHdrKeywords.Length() - curHdrLineStart));
            keywordHdr.Append(MSG_LINEBREAK);
            m_fileStream->Write(keywordHdr.get(), keywordHdr.Length(), &bytesWritten);
            newKeywordSize += bytesWritten;
            curHdrLineStart = nextBlankOffset;
            keywordHdr.Assign(' ');
          }
          nextBlankOffset++;
        }
        m_fileStream->Write(EXTRA_KEYWORD_HDR, sizeof(EXTRA_KEYWORD_HDR) - 1, &bytesWritten);
        newKeywordSize += bytesWritten;
        m_addedHeaderSize += newKeywordSize - oldKeywordSize;
        m_curSrcHdr->SetUint32Property("growKeywords", 0);
        needToGrowKeywords = PR_FALSE;
        writeCount += blockOffset - preKeywordBlockOffset; // fudge writeCount

      }
      if (readCount <= blockOffset)
      {
        NS_ASSERTION(PR_FALSE, "bad block offset");
        // not sure what to do to handle this.
      
      }
      m_fileStream->Write(m_dataBuffer + blockOffset, readCount - blockOffset, &bytesWritten);
      writeCount += bytesWritten;
      count -= readCount;
      if (writeCount != readCount)
      {
        m_folder->ThrowAlertMsg("compactFolderWriteFailed", m_window);
        return NS_MSG_ERROR_WRITING_MAIL_FOLDER;
      }
    }
  }
  return rv;
}

nsOfflineStoreCompactState::nsOfflineStoreCompactState()
{
}

nsOfflineStoreCompactState::~nsOfflineStoreCompactState()
{
}


nsresult
nsOfflineStoreCompactState::InitDB(nsIMsgDatabase *db)
{
  // Start with the list of messages we have offline as the possible
  // message to keep when compacting the offline store.
  db->ListAllOfflineMsgs(&m_keyArray);
  // Filter out msgs that have the "pendingRemoval" attribute set.
  nsCOMPtr<nsIMsgDBHdr> hdr;
  nsString pendingRemoval;
  for (PRInt32 i = m_keyArray.Length() - 1; i >= 0; i--)
  {
    nsresult rv = db->GetMsgHdrForKey(m_keyArray[i], getter_AddRefs(hdr));
    NS_ENSURE_SUCCESS(rv, rv);
    hdr->GetProperty("pendingRemoval", pendingRemoval);
    if (!pendingRemoval.IsEmpty())
    {
      m_keyArray.RemoveElementAt(i);
      // Turn off offline flag for message, since after the compact is completed;
      // we won't have the message in the offline store.
      PRUint32 resultFlags;
      hdr->AndFlags(~nsMsgMessageFlags::Offline, &resultFlags);
      // We need to clear this in case the user changes the offline retention
      // settings.
      hdr->SetStringProperty("pendingRemoval", "");
    }
  }
  m_db = db;
  return NS_OK;
}

nsresult nsOfflineStoreCompactState::CopyNextMessage()
{
  m_messageUri.SetLength(0); // clear the previous message uri
  nsresult rv = BuildMessageURI(m_baseMessageUri.get(), m_keyArray[m_curIndex],
                                m_messageUri);
  NS_ENSURE_SUCCESS(rv, rv);
  m_startOfMsg = PR_TRUE;
  nsCOMPtr<nsISupports> thisSupports;
  QueryInterface(NS_GET_IID(nsISupports), getter_AddRefs(thisSupports));
  rv = m_messageService->StreamMessage(m_messageUri.get(), thisSupports, m_window, nsnull,
                                  PR_FALSE, EmptyCString(), PR_TRUE, nsnull);
  // if copy fails, we clear the offline flag on the source message.
  if (NS_FAILED(rv))
  {
    nsCOMPtr<nsIMsgDBHdr> hdr;
    GetMessage(getter_AddRefs(hdr));
    if (hdr)
    {
      PRUint32 resultFlags;
      hdr->AndFlags(~nsMsgMessageFlags::Offline, &resultFlags);
    }
  }
  // In theory, we might be able to stream the next message, so
  // return NS_OK, not rv.
  return NS_OK;
}

NS_IMETHODIMP
nsOfflineStoreCompactState::OnStopRequest(nsIRequest *request, nsISupports *ctxt,
                                          nsresult status)
{
  nsresult rv = status;
  nsCOMPtr<nsIURI> uri;
  nsCOMPtr<nsIMsgDBHdr> msgHdr;
  nsCOMPtr<nsIMsgDBHdr> newMsgHdr;
  nsCOMPtr <nsIMsgStatusFeedback> statusFeedback;
  ReleaseFolderLock();

  // The NS_MSG_ERROR_MSG_NOT_OFFLINE error should allow us to continue, so we
  // check for it specifically and don't terminate the compaction.
  if (NS_FAILED(rv) && rv != NS_MSG_ERROR_MSG_NOT_OFFLINE)
    goto done;
  uri = do_QueryInterface(ctxt, &rv);
  if (NS_FAILED(rv)) goto done;
  rv = GetMessage(getter_AddRefs(msgHdr));
  if (NS_FAILED(rv)) goto done;

  if (msgHdr)
  {
    if (NS_SUCCEEDED(status))
    {
      msgHdr->SetMessageOffset(m_startOfNewMsg);
      msgHdr->SetOfflineMessageSize(m_offlineMsgSize);
    }
    else
    {
      PRUint32 resultFlags;
      msgHdr->AndFlags(~nsMsgMessageFlags::Offline, &resultFlags);
    }
  }

  if (m_window)
  {
    m_window->GetStatusFeedback(getter_AddRefs(statusFeedback));
    if (statusFeedback)
      statusFeedback->ShowProgress (100 * m_curIndex / m_size);
  }
    // advance to next message 
  m_curIndex ++;
  if (m_curIndex >= m_size)
  {
    m_db->Commit(nsMsgDBCommitType::kLargeCommit);
    msgHdr = nsnull;
    newMsgHdr = nsnull;
    // no more to copy finish it up
    FinishCompact();
    Release(); // kill self
  }
  else
  {
    rv = CopyNextMessage();
  }

done:
  if (NS_FAILED(rv)) {
    m_status = rv; // set the status to rv so the destructor can remove the
                   // temp folder and database
    Release(); // kill self
    return rv;
  }
  return rv;
}
 

nsresult
nsOfflineStoreCompactState::FinishCompact()
{
  // All okay time to finish up the compact process
  nsCOMPtr<nsILocalFile> path;
  PRUint32 flags;

    // get leaf name and database name of the folder
  m_folder->GetFlags(&flags);
  nsresult rv = m_folder->GetFilePath(getter_AddRefs(path));

  nsCString leafName;
  path->GetNativeLeafName(leafName);

    // close down the temp file stream; preparing for deleting the old folder
    // and its database; then rename the temp folder and database
  m_fileStream->Flush();
  m_fileStream->Close();
  m_fileStream = nsnull;

    // make sure the new database is valid
  nsCOMPtr <nsIDBFolderInfo> dbFolderInfo;
  m_db->GetDBFolderInfo(getter_AddRefs(dbFolderInfo));
  if (dbFolderInfo)
    dbFolderInfo->SetExpungedBytes(0);
  // this forces the m_folder to update mExpungedBytes from the db folder info.
  PRUint32 expungedBytes;
  m_folder->GetExpungedBytes(&expungedBytes);
  m_folder->UpdateSummaryTotals(PR_TRUE);
  m_db->SetSummaryValid(PR_TRUE);

    // remove the old folder 
  path->Remove(PR_FALSE);

    // rename the copied folder to be the original folder 
  m_file->MoveToNative((nsIFile *) nsnull, leafName);

  ShowStatusMsg(EmptyString());
  if (m_compactAll)
    rv = CompactNextFolder();
  return rv;
}


NS_IMETHODIMP
nsFolderCompactState::Init(nsIMsgFolder *srcFolder, nsICopyMessageListener *destination, nsISupports *listenerData)
{
  return NS_OK;
}

NS_IMETHODIMP
nsFolderCompactState::StartMessage()
{
  nsresult rv = NS_ERROR_FAILURE;
  NS_ASSERTION(m_fileStream, "Fatal, null m_fileStream...\n");
  if (m_fileStream)
  {
    nsCOMPtr <nsISeekableStream> seekableStream = do_QueryInterface(m_fileStream, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    // this will force an internal flush, but not a sync. Tell should really do an internal flush,
    // but it doesn't, and I'm afraid to change that nsIFileStream.cpp code anymore.
    seekableStream->Seek(nsISeekableStream::NS_SEEK_CUR, 0);
    // record the new message key for the message
    PRInt64 curStreamPos;
    seekableStream->Tell(&curStreamPos);
    m_startOfNewMsg = curStreamPos;
    rv = NS_OK;
  }
  return rv;
}

NS_IMETHODIMP
nsFolderCompactState::EndMessage(nsMsgKey key)
{
  return NS_OK;
}

NS_IMETHODIMP
nsFolderCompactState::EndCopy(nsISupports *url, nsresult aStatus)
{
  nsCOMPtr<nsIMsgDBHdr> msgHdr;
  nsCOMPtr<nsIMsgDBHdr> newMsgHdr;

  if (m_curIndex >= m_size)
  {
    NS_ASSERTION(PR_FALSE, "m_curIndex out of bounds");
    return NS_OK;
  }

  /**
   * Done with the current message; copying the existing message header
   * to the new database.
   * XXX This will need to be changed when we support local mail folders
   * > 4GB. We'll need to set the messageOffset attribute on the new header,
   * and assign the nsMsgKey some other way.
   */
  if (m_curSrcHdr)
    m_db->CopyHdrFromExistingHdr((nsMsgKey) m_startOfNewMsg, m_curSrcHdr, PR_TRUE,
                               getter_AddRefs(newMsgHdr));
  m_curSrcHdr = nsnull;
  if (newMsgHdr)
  {
    if ( m_statusOffset != 0)
      newMsgHdr->SetStatusOffset(m_statusOffset);
      
    PRUint32 msgSize;
    (void) newMsgHdr->GetMessageSize(&msgSize);
    if (m_addedHeaderSize)
    {
      msgSize += m_addedHeaderSize;
      newMsgHdr->SetMessageSize(msgSize);
    }
    m_totalMsgSize += msgSize;
  }

//  m_db->Commit(nsMsgDBCommitType::kLargeCommit);  // no sense commiting until the end
    // advance to next message 
  m_curIndex ++;
  m_startOfMsg = PR_TRUE;
  nsCOMPtr <nsIMsgStatusFeedback> statusFeedback;
  if (m_window)
  {
    m_window->GetStatusFeedback(getter_AddRefs(statusFeedback));
    if (statusFeedback)
      statusFeedback->ShowProgress (100 * m_curIndex / m_size);
  }
  return NS_OK;
}

nsresult nsOfflineStoreCompactState::StartCompacting()
{
  nsresult rv = NS_OK;
  if (m_size > 0 && m_curIndex == 0)
  {
    AddRef(); // we own ourselves, until we're done, anyway.
    ShowCompactingStatusMsg();
    rv = CopyNextMessage();
  }
  else
  { // no messages to copy with
    ReleaseFolderLock();
    FinishCompact();
//    Release(); // we don't "own" ourselves yet.
  }
  return rv;
}

NS_IMETHODIMP
nsOfflineStoreCompactState::OnDataAvailable(nsIRequest *request, nsISupports *ctxt,
                                            nsIInputStream *inStr,
                                            PRUint32 sourceOffset, PRUint32 count)
{
  if (!m_fileStream || !inStr) 
    return NS_ERROR_FAILURE;

  nsresult rv = NS_OK;

  if (m_startOfMsg)
  {
    m_statusOffset = 0;
    m_offlineMsgSize = 0;
    m_messageUri.SetLength(0); // clear the previous message uri
    if (NS_SUCCEEDED(BuildMessageURI(m_baseMessageUri.get(), m_keyArray[m_curIndex],
                                m_messageUri)))
    {
      rv = GetMessage(getter_AddRefs(m_curSrcHdr));
      NS_ENSURE_SUCCESS(rv, rv);
    }
  }
  PRUint32 maxReadCount, readCount, writeCount;
  PRUint32 bytesWritten;

  while (NS_SUCCEEDED(rv) && (PRInt32) count > 0)
  {
    maxReadCount = count > sizeof(m_dataBuffer) - 1 ? sizeof(m_dataBuffer) - 1 : count;
    writeCount = 0;
    rv = inStr->Read(m_dataBuffer, maxReadCount, &readCount);

    if (NS_SUCCEEDED(rv))
    {
      if (m_startOfMsg)
      {
        m_startOfMsg = PR_FALSE;
        // check if there's an envelope header; if not, write one.
        if (strncmp(m_dataBuffer, "From ", 5))
        {
          m_fileStream->Write("From "CRLF, 7, &bytesWritten);
          m_offlineMsgSize += bytesWritten;
        }
      }
      m_fileStream->Write(m_dataBuffer, readCount, &bytesWritten);
      m_offlineMsgSize += bytesWritten;
      writeCount += bytesWritten;
      count -= readCount;
      if (writeCount != readCount)
      {
        m_folder->ThrowAlertMsg("compactFolderWriteFailed", m_window);
        return NS_MSG_ERROR_WRITING_MAIL_FOLDER;
      }
    }
  }
  return rv;
}

