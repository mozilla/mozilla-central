/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "msgCore.h"
#include "netCore.h"
#include "nsNetUtil.h"
#include "nsImapOfflineSync.h"
#include "nsImapMailFolder.h"
#include "nsMsgFolderFlags.h"
#include "nsIRDFService.h"
#include "nsMsgBaseCID.h"
#include "nsRDFCID.h"
#include "nsIMsgMailNewsUrl.h"
#include "nsIMsgAccountManager.h"
#include "nsINntpIncomingServer.h"
#include "nsIRequestObserver.h"
#include "nsDirectoryServiceDefs.h"
#include "nsISeekableStream.h"
#include "nsIMsgCopyService.h"
#include "nsImapProtocol.h"
#include "nsMsgUtils.h"
#include "nsIMutableArray.h"
#include "nsIAutoSyncManager.h"
#include "nsAlgorithm.h"

static NS_DEFINE_CID(kRDFServiceCID, NS_RDFSERVICE_CID);

NS_IMPL_ISUPPORTS3(nsImapOfflineSync, nsIUrlListener, nsIMsgCopyServiceListener, nsIDBChangeListener)

nsImapOfflineSync::nsImapOfflineSync(nsIMsgWindow *window, nsIUrlListener *listener, nsIMsgFolder *singleFolderOnly, bool isPseudoOffline)
{
  m_singleFolderToUpdate = singleFolderOnly;
  m_window = window;
  // not the perfect place for this, but I think it will work.
  if (m_window)
    m_window->SetStopped(false);

  mCurrentPlaybackOpType = nsIMsgOfflineImapOperation::kFlagsChanged;
  m_mailboxupdatesStarted = false;
  m_mailboxupdatesFinished = false;
  m_createdOfflineFolders = false;
  m_pseudoOffline = isPseudoOffline;
  m_KeyIndex = 0;
  mCurrentUIDValidity = nsMsgKey_None;
  m_listener = listener;
}

nsImapOfflineSync::~nsImapOfflineSync()
{
}

void      nsImapOfflineSync::SetWindow(nsIMsgWindow *window)
{
  m_window = window;
}

NS_IMETHODIMP nsImapOfflineSync::OnStartRunningUrl(nsIURI* url)
{
    return NS_OK;
}

NS_IMETHODIMP
nsImapOfflineSync::OnStopRunningUrl(nsIURI* url, nsresult exitCode)
{
  nsresult rv = exitCode;

  // where do we make sure this gets cleared when we start running urls?
  bool stopped = false;
  if (m_window)
    m_window->GetStopped(&stopped);

  if (m_curTempFile)
  {
    m_curTempFile->Remove(false);
    m_curTempFile = nullptr;
  }
  // NS_BINDING_ABORTED is used for the user pressing stop, which
  // should cause us to abort the offline process. Other errors
  // should allow us to continue.
  if (stopped)
  {
    if (m_listener)
      m_listener->OnStopRunningUrl(url, NS_BINDING_ABORTED);
    return NS_OK;
  }
  nsCOMPtr<nsIImapUrl> imapUrl = do_QueryInterface(url);

  if (imapUrl)
    nsImapProtocol::LogImapUrl(NS_SUCCEEDED(rv) ?
                               "offline imap url succeeded " :
                               "offline imap url failed ", imapUrl);

  // If we succeeded, or it was an imap move/copy that timed out, clear the
  // operation.
  bool moveCopy = mCurrentPlaybackOpType == nsIMsgOfflineImapOperation::kMsgCopy ||
    mCurrentPlaybackOpType == nsIMsgOfflineImapOperation::kMsgMoved;
  if (NS_SUCCEEDED(exitCode) || exitCode == NS_MSG_ERROR_IMAP_COMMAND_FAILED ||
      (moveCopy && exitCode == NS_ERROR_NET_TIMEOUT))
  {
    ClearCurrentOps();
    rv = ProcessNextOperation();
  }
  // else if it's a non-stop error, and we're doing multiple folders,
  // go to the next folder.
  else if (!m_singleFolderToUpdate)
  {
    rv = AdvanceToNextFolder();
    if (NS_SUCCEEDED(rv))
      rv = ProcessNextOperation();
    else if (m_listener)
      m_listener->OnStopRunningUrl(url, rv);
  }

  return rv;
}

// leaves m_currentServer at the next imap or local mail "server" that
// might have offline events to playback. If no more servers,
// m_currentServer will be left at nullptr.
// Also, sets up m_serverEnumerator to enumerate over the server
nsresult nsImapOfflineSync::AdvanceToNextServer()
{
  nsresult rv = NS_OK;

  if (!m_allServers)
  {
    NS_ASSERTION(!m_currentServer, "this shouldn't be set");
    m_currentServer = nullptr;
    nsCOMPtr<nsIMsgAccountManager> accountManager = 
             do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
    NS_ASSERTION(accountManager && NS_SUCCEEDED(rv), "couldn't get account mgr");
    if (!accountManager || NS_FAILED(rv)) return rv;

    rv = accountManager->GetAllServers(getter_AddRefs(m_allServers));
    NS_ENSURE_SUCCESS(rv, rv);
  }
  uint32_t serverIndex = (m_currentServer) ? m_allServers->IndexOf(m_currentServer) + 1 : 0;
  m_currentServer = nullptr;
  uint32_t numServers; 
  m_allServers->Count(&numServers);
  nsCOMPtr <nsIMsgFolder> rootFolder;

  while (serverIndex < numServers)
  {
    nsCOMPtr <nsISupports> serverSupports = getter_AddRefs(m_allServers->ElementAt(serverIndex));
    serverIndex++;

    nsCOMPtr<nsIMsgIncomingServer> server = do_QueryInterface(serverSupports);
    nsCOMPtr <nsINntpIncomingServer> newsServer = do_QueryInterface(server);
    if (newsServer) // news servers aren't involved in offline imap
      continue;
    if (server)
    {
      m_currentServer = server;
      server->GetRootFolder(getter_AddRefs(rootFolder));
      if (rootFolder)
      {
        m_allFolders = do_CreateInstance(NS_SUPPORTSARRAY_CONTRACTID, &rv);
        NS_ENSURE_TRUE(m_allFolders, rv);
        rv = rootFolder->ListDescendents(m_allFolders);
        if (NS_SUCCEEDED(rv))
          m_allFolders->Enumerate(getter_AddRefs(m_serverEnumerator));
        if (NS_SUCCEEDED(rv) && m_serverEnumerator)
        {
          rv = m_serverEnumerator->First();
          if (NS_SUCCEEDED(rv))
            break;
        }
      }
    }
  }
  return rv;
}

nsresult nsImapOfflineSync::AdvanceToNextFolder()
{
  nsresult rv;
  // we always start by changing flags
  mCurrentPlaybackOpType = nsIMsgOfflineImapOperation::kFlagsChanged;

  if (m_currentFolder)
  {
    m_currentFolder->SetMsgDatabase(nullptr);
    m_currentFolder = nullptr;
  }

  if (!m_currentServer)
     rv = AdvanceToNextServer();
  else
    rv = m_serverEnumerator->Next();
  if (NS_FAILED(rv))
    rv = AdvanceToNextServer();

  if (NS_SUCCEEDED(rv) && m_serverEnumerator)
  {
    nsCOMPtr <nsISupports> supports;
    rv = m_serverEnumerator->CurrentItem(getter_AddRefs(supports));
    m_currentFolder = do_QueryInterface(supports);
  }
  ClearDB();
  return rv;
}

void nsImapOfflineSync::AdvanceToFirstIMAPFolder()
{
  nsresult rv;
  m_currentServer = nullptr;
  nsCOMPtr <nsIMsgImapMailFolder> imapFolder;
  do
  {
    rv = AdvanceToNextFolder();
    if (m_currentFolder)
      imapFolder = do_QueryInterface(m_currentFolder);
  }
  while (NS_SUCCEEDED(rv) && m_currentFolder && !imapFolder);
}

void nsImapOfflineSync::ProcessFlagOperation(nsIMsgOfflineImapOperation *op)
{
  nsCOMPtr <nsIMsgOfflineImapOperation> currentOp = op;
  nsTArray<nsMsgKey> matchingFlagKeys;
  uint32_t currentKeyIndex = m_KeyIndex;

  imapMessageFlagsType matchingFlags;
  currentOp->GetNewFlags(&matchingFlags);
  imapMessageFlagsType flagOperation;
  imapMessageFlagsType newFlags;
  bool flagsMatch = true;
  do
  { // loop for all messsages with the same flags
    if (flagsMatch)
    {
      nsMsgKey curKey;
      currentOp->GetMessageKey(&curKey);
      matchingFlagKeys.AppendElement(curKey);
      currentOp->SetPlayingBack(true);
      m_currentOpsToClear.AppendObject(currentOp);
    }
    currentOp = nullptr;
    if (++currentKeyIndex < m_CurrentKeys.Length())
      m_currentDB->GetOfflineOpForKey(m_CurrentKeys[currentKeyIndex], false,
        getter_AddRefs(currentOp));
    if (currentOp)
    {
      currentOp->GetFlagOperation(&flagOperation);
      currentOp->GetNewFlags(&newFlags);
    }
    flagsMatch = (flagOperation & nsIMsgOfflineImapOperation::kFlagsChanged)
                  && (newFlags == matchingFlags);
  } while (currentOp);

  if (!matchingFlagKeys.IsEmpty())
  {
    nsAutoCString uids;
    nsImapMailFolder::AllocateUidStringFromKeys(matchingFlagKeys.Elements(), matchingFlagKeys.Length(), uids);
    uint32_t curFolderFlags;
    m_currentFolder->GetFlags(&curFolderFlags);

    if (uids.get() && (curFolderFlags & nsMsgFolderFlags::ImapBox)) 
    {
      nsresult rv = NS_OK;
      nsCOMPtr <nsIMsgImapMailFolder> imapFolder = do_QueryInterface(m_currentFolder);
      nsCOMPtr <nsIURI> uriToSetFlags;
      if (imapFolder)
      {
        rv = imapFolder->SetImapFlags(uids.get(), matchingFlags, getter_AddRefs(uriToSetFlags));
        if (NS_SUCCEEDED(rv) && uriToSetFlags)
        {
          nsCOMPtr <nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(uriToSetFlags);
          if (mailnewsUrl)
            mailnewsUrl->RegisterListener(this);
        }
      }
    }
  }
  else
    ProcessNextOperation();
}

void nsImapOfflineSync::ProcessKeywordOperation(nsIMsgOfflineImapOperation *op)
{
  nsCOMPtr <nsIMsgOfflineImapOperation> currentOp = op;
  nsTArray<nsMsgKey> matchingKeywordKeys;
  uint32_t currentKeyIndex = m_KeyIndex;

  nsAutoCString keywords;
  if (mCurrentPlaybackOpType == nsIMsgOfflineImapOperation::kAddKeywords)
    currentOp->GetKeywordsToAdd(getter_Copies(keywords));
  else
    currentOp->GetKeywordsToRemove(getter_Copies(keywords));
  bool keywordsMatch = true;	
  do
  { // loop for all messsages with the same keywords
    if (keywordsMatch)
    {
      nsMsgKey curKey;
      currentOp->GetMessageKey(&curKey);
      matchingKeywordKeys.AppendElement(curKey);
      currentOp->SetPlayingBack(true);
      m_currentOpsToClear.AppendObject(currentOp);
    }
    currentOp = nullptr;
    if (++currentKeyIndex < m_CurrentKeys.Length())
      m_currentDB->GetOfflineOpForKey(m_CurrentKeys[currentKeyIndex], false,
        getter_AddRefs(currentOp));
    if (currentOp)
    {
      nsAutoCString curOpKeywords;
      nsOfflineImapOperationType operation;
      currentOp->GetOperation(&operation);
      if (mCurrentPlaybackOpType == nsIMsgOfflineImapOperation::kAddKeywords)
        currentOp->GetKeywordsToAdd(getter_Copies(curOpKeywords));
      else
        currentOp->GetKeywordsToRemove(getter_Copies(curOpKeywords));
      keywordsMatch = (operation & mCurrentPlaybackOpType)
                  && (curOpKeywords.Equals(keywords));
    }
  } while (currentOp);

  if (!matchingKeywordKeys.IsEmpty())
  {
    uint32_t curFolderFlags;
    m_currentFolder->GetFlags(&curFolderFlags);

    if (curFolderFlags & nsMsgFolderFlags::ImapBox)
    {
      nsresult rv = NS_OK;
      nsCOMPtr <nsIMsgImapMailFolder> imapFolder = do_QueryInterface(m_currentFolder);
      nsCOMPtr <nsIURI> uriToStoreCustomKeywords;
      if (imapFolder)
      {
        rv = imapFolder->StoreCustomKeywords(m_window, 
                    (mCurrentPlaybackOpType == nsIMsgOfflineImapOperation::kAddKeywords) ? keywords : EmptyCString(), 
                    (mCurrentPlaybackOpType == nsIMsgOfflineImapOperation::kRemoveKeywords) ? keywords : EmptyCString(), 
                    matchingKeywordKeys.Elements(), 
                    matchingKeywordKeys.Length(), getter_AddRefs(uriToStoreCustomKeywords));
        if (NS_SUCCEEDED(rv) && uriToStoreCustomKeywords)
        {
          nsCOMPtr <nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(uriToStoreCustomKeywords);
          if (mailnewsUrl)
            mailnewsUrl->RegisterListener(this);
        }
      }
    }
  }
  else
    ProcessNextOperation();
}

void
nsImapOfflineSync::ProcessAppendMsgOperation(nsIMsgOfflineImapOperation *currentOp, int32_t opType)
{
  nsCOMPtr <nsIMsgDBHdr> mailHdr;
  nsMsgKey msgKey;
  currentOp->GetMessageKey(&msgKey);
  nsresult rv = m_currentDB->GetMsgHdrForKey(msgKey, getter_AddRefs(mailHdr)); 
  if (NS_SUCCEEDED(rv) && mailHdr)
  {
    uint64_t messageOffset;
    uint32_t messageSize;
    mailHdr->GetMessageOffset(&messageOffset);
    mailHdr->GetOfflineMessageSize(&messageSize);
    nsCOMPtr<nsIFile> tmpFile;

    if (NS_FAILED(GetSpecialDirectoryWithFileName(NS_OS_TEMP_DIR,
                                                  "nscpmsg.txt",
                                                  getter_AddRefs(tmpFile))))
      return;

    if (NS_FAILED(tmpFile->CreateUnique(nsIFile::NORMAL_FILE_TYPE, 00600)))
      return;

    nsCOMPtr <nsIOutputStream> outputStream;
    rv = MsgNewBufferedFileOutputStream(getter_AddRefs(outputStream), tmpFile, PR_WRONLY | PR_CREATE_FILE, 00600);
    if (NS_SUCCEEDED(rv) && outputStream)
    {
      nsCString moveDestination;
      currentOp->GetDestinationFolderURI(getter_Copies(moveDestination));
      nsCOMPtr<nsIRDFService> rdf(do_GetService(kRDFServiceCID, &rv));
      nsCOMPtr<nsIRDFResource> res;
      if (NS_FAILED(rv)) return ; // ### return error code.
      rv = rdf->GetResource(moveDestination, getter_AddRefs(res));
      if (NS_SUCCEEDED(rv))
      {
        nsCOMPtr<nsIMsgFolder> destFolder(do_QueryInterface(res, &rv));
        if (NS_SUCCEEDED(rv) && destFolder)
        {
          nsCOMPtr <nsIInputStream> offlineStoreInputStream;
          rv = destFolder->GetOfflineStoreInputStream(getter_AddRefs(offlineStoreInputStream));
          if (NS_SUCCEEDED(rv) && offlineStoreInputStream)
          {
            nsCOMPtr<nsISeekableStream> seekStream = do_QueryInterface(offlineStoreInputStream);
            NS_ASSERTION(seekStream, "non seekable stream - can't read from offline msg");
            if (seekStream)
            {
              rv = seekStream->Seek(PR_SEEK_SET, messageOffset);
              if (NS_SUCCEEDED(rv))
              {
                // now, copy the dest folder offline store msg to the temp file
                int32_t inputBufferSize = 10240;
                char *inputBuffer = nullptr;
                
                while (!inputBuffer && (inputBufferSize >= 512))
                {
                  inputBuffer = (char *) PR_Malloc(inputBufferSize);
                  if (!inputBuffer)
                    inputBufferSize /= 2;
                }
                int32_t bytesLeft;
                uint32_t bytesRead, bytesWritten;
                bytesLeft = messageSize;
                rv = NS_OK;
                while (bytesLeft > 0 && NS_SUCCEEDED(rv))
                {
                  int32_t bytesToRead = NS_MIN(inputBufferSize, bytesLeft);
                  rv = offlineStoreInputStream->Read(inputBuffer, bytesToRead, &bytesRead);
                  if (NS_SUCCEEDED(rv) && bytesRead > 0)
                  {
                    rv = outputStream->Write(inputBuffer, bytesRead, &bytesWritten);
                    NS_ASSERTION(bytesWritten == bytesRead, "wrote out correct number of bytes");
                  }
                  else
                    break;
                  bytesLeft -= bytesRead;
                }
                outputStream->Flush();
                outputStream->Close();
                if (NS_SUCCEEDED(rv))
                {
                  nsCOMPtr<nsIFile> cloneTmpFile;
                  // clone the tmp file to defeat nsIFile's stat/size caching.
                  tmpFile->Clone(getter_AddRefs(cloneTmpFile));
                  m_curTempFile = do_QueryInterface(cloneTmpFile);
                  nsCOMPtr<nsIMsgCopyService> copyService = do_GetService(NS_MSGCOPYSERVICE_CONTRACTID);
                  if (copyService)
                    rv = copyService->CopyFileMessage(cloneTmpFile, destFolder,
                    /* nsIMsgDBHdr* msgToReplace */ nullptr,
                    true /* isDraftOrTemplate */,
                    0, // new msg flags - are there interesting flags here?
                    EmptyCString(), /* are there keywords we should get? */
                      this,
                      m_window);
                }
                else
                  tmpFile->Remove(false);
              }
              currentOp->SetPlayingBack(true);
              m_currentOpsToClear.AppendObject(currentOp);
              m_currentDB->DeleteHeader(mailHdr, nullptr, true, true);
            }
          }
          // want to close in failure case too
          outputStream->Close();
        }
      }
    }
  }
  else
  {
    m_currentDB->RemoveOfflineOp(currentOp);
    ProcessNextOperation();
  }
}

void nsImapOfflineSync::ClearCurrentOps()
{
  int32_t opCount = m_currentOpsToClear.Count();
  for (int32_t i = opCount - 1; i >= 0; i--)
  {
    m_currentOpsToClear[i]->SetPlayingBack(false);
    m_currentOpsToClear[i]->ClearOperation(mCurrentPlaybackOpType);
    m_currentOpsToClear.RemoveObjectAt(i);
  }
}

void nsImapOfflineSync::ProcessMoveOperation(nsIMsgOfflineImapOperation *op)
{
  nsTArray<nsMsgKey> matchingFlagKeys;
  uint32_t currentKeyIndex = m_KeyIndex;
  nsCString moveDestination;
  op->GetDestinationFolderURI(getter_Copies(moveDestination));
  bool moveMatches = true;
  nsCOMPtr <nsIMsgOfflineImapOperation> currentOp = op;
  do 
  {	// loop for all messsages with the same destination
    if (moveMatches)
    {
      nsMsgKey curKey;
      currentOp->GetMessageKey(&curKey);
      matchingFlagKeys.AppendElement(curKey);
      currentOp->SetPlayingBack(true);
      m_currentOpsToClear.AppendObject(currentOp);
    }
    currentOp = nullptr;
    
    if (++currentKeyIndex < m_CurrentKeys.Length())
    {
      nsCString nextDestination;
      nsresult rv = m_currentDB->GetOfflineOpForKey(m_CurrentKeys[currentKeyIndex], false, getter_AddRefs(currentOp));
      moveMatches = false;
      if (NS_SUCCEEDED(rv) && currentOp)
      {
        nsOfflineImapOperationType opType; 
        currentOp->GetOperation(&opType);
        if (opType & nsIMsgOfflineImapOperation::kMsgMoved)
        {
          currentOp->GetDestinationFolderURI(getter_Copies(nextDestination));
          moveMatches = moveDestination.Equals(nextDestination);
        }
      }
    }
  } 
  while (currentOp);
  
  nsCOMPtr<nsIMsgFolder> destFolder;
  GetExistingFolder(moveDestination, getter_AddRefs(destFolder));
  // if the dest folder doesn't really exist, these operations are
  // going to fail, so clear them out and move on.
  if (!destFolder)
  {
    NS_ERROR("trying to playing back move to non-existent folder");
    ClearCurrentOps();
    ProcessNextOperation();
    return;
  }
  nsCOMPtr<nsIMsgImapMailFolder> imapFolder = do_QueryInterface(m_currentFolder);
  if (imapFolder && DestFolderOnSameServer(destFolder))
  {
    imapFolder->ReplayOfflineMoveCopy(matchingFlagKeys.Elements(), matchingFlagKeys.Length(), true, destFolder,
      this, m_window);
  }
  else
  {
    nsresult rv;
    nsCOMPtr<nsIMutableArray> messages(do_CreateInstance(NS_ARRAY_CONTRACTID, &rv));
    if (NS_SUCCEEDED(rv))
    {
      for (uint32_t keyIndex = 0; keyIndex < matchingFlagKeys.Length(); keyIndex++)
      {
        nsCOMPtr<nsIMsgDBHdr> mailHdr = nullptr;
        rv = m_currentFolder->GetMessageHeader(matchingFlagKeys.ElementAt(keyIndex), getter_AddRefs(mailHdr));
        if (NS_SUCCEEDED(rv) && mailHdr)
        {
          uint32_t msgSize;
          // in case of a move, the header has already been deleted,
          // so we've really got a fake header. We need to get its flags and
          // size from the offline op to have any chance of doing the move.
          mailHdr->GetMessageSize(&msgSize);
          if (!msgSize)
          {
            imapMessageFlagsType newImapFlags;
            uint32_t msgFlags = 0;
            op->GetMsgSize(&msgSize);
            op->GetNewFlags(&newImapFlags);
            // first three bits are the same
            msgFlags |= (newImapFlags & 0x07);
            if (newImapFlags & kImapMsgForwardedFlag)
              msgFlags |= nsMsgMessageFlags::Forwarded;
            mailHdr->SetFlags(msgFlags);
            mailHdr->SetMessageSize(msgSize);
          }
          messages->AppendElement(mailHdr, false);
        }
      }
      nsCOMPtr<nsIMsgCopyService> copyService = do_GetService(NS_MSGCOPYSERVICE_CONTRACTID, &rv);
      if (copyService)
        copyService->CopyMessages(m_currentFolder, messages, destFolder, true, this, m_window, false);
    }
  }
}

// I'm tempted to make this a method on nsIMsgFolder, but that interface
// is already so huge, and there are only a few places in the code that do this.
// If there end up to be more places that need this, then we can reconsider.
bool nsImapOfflineSync::DestFolderOnSameServer(nsIMsgFolder *destFolder)
{
  nsCOMPtr<nsIMsgIncomingServer> srcServer;
  nsCOMPtr<nsIMsgIncomingServer> dstServer;

  bool sameServer = false;
  if (NS_SUCCEEDED(m_currentFolder->GetServer(getter_AddRefs(srcServer))) 
    && NS_SUCCEEDED(destFolder->GetServer(getter_AddRefs(dstServer))))
    dstServer->Equals(srcServer, &sameServer);
  return sameServer;
}

void nsImapOfflineSync::ProcessCopyOperation(nsIMsgOfflineImapOperation *aCurrentOp)
{
  nsCOMPtr<nsIMsgOfflineImapOperation> currentOp = aCurrentOp;

  nsTArray<nsMsgKey> matchingFlagKeys;
  uint32_t currentKeyIndex = m_KeyIndex;
  nsCString copyDestination;
  currentOp->GetCopyDestination(0, getter_Copies(copyDestination));
  bool copyMatches = true;
  nsresult rv;

  do { // loop for all messsages with the same destination
    if (copyMatches)
    {
      nsMsgKey curKey;
      currentOp->GetMessageKey(&curKey);
      matchingFlagKeys.AppendElement(curKey);
      currentOp->SetPlayingBack(true);
      m_currentOpsToClear.AppendObject(currentOp);
    }
    currentOp = nullptr;

    if (++currentKeyIndex < m_CurrentKeys.Length())
    {
      nsCString nextDestination;
      rv = m_currentDB->GetOfflineOpForKey(m_CurrentKeys[currentKeyIndex],
                                           false, getter_AddRefs(currentOp));
      copyMatches = false;
      if (NS_SUCCEEDED(rv) && currentOp)
      {
        nsOfflineImapOperationType opType; 
        currentOp->GetOperation(&opType);
        if (opType & nsIMsgOfflineImapOperation::kMsgCopy)
        {
          currentOp->GetCopyDestination(0, getter_Copies(nextDestination));
          copyMatches = copyDestination.Equals(nextDestination);
        }
      }
    }
  } 
  while (currentOp);

  nsAutoCString uids;
  nsCOMPtr<nsIMsgFolder> destFolder;
  GetExistingFolder(copyDestination, getter_AddRefs(destFolder));
  // if the dest folder doesn't really exist, these operations are
  // going to fail, so clear them out and move on.
  if (!destFolder)
  {
    NS_ERROR("trying to playing back copy to non-existent folder");
    ClearCurrentOps();
    ProcessNextOperation();
    return;
  }
  nsCOMPtr<nsIMsgImapMailFolder> imapFolder = do_QueryInterface(m_currentFolder);
  if (imapFolder && DestFolderOnSameServer(destFolder))
  {
    rv = imapFolder->ReplayOfflineMoveCopy(matchingFlagKeys.Elements(), matchingFlagKeys.Length(), false, destFolder,
                   this, m_window);
  }
  else
  {
    nsCOMPtr<nsIMutableArray> messages(do_CreateInstance(NS_ARRAY_CONTRACTID, &rv));
    if (messages && NS_SUCCEEDED(rv))
    {
      for (uint32_t keyIndex = 0; keyIndex < matchingFlagKeys.Length(); keyIndex++)
      {
        nsCOMPtr<nsIMsgDBHdr> mailHdr = nullptr;
        rv = m_currentFolder->GetMessageHeader(matchingFlagKeys.ElementAt(keyIndex), getter_AddRefs(mailHdr));
        if (NS_SUCCEEDED(rv) && mailHdr)
          messages->AppendElement(mailHdr, false);
      }
      nsCOMPtr<nsIMsgCopyService> copyService = do_GetService(NS_MSGCOPYSERVICE_CONTRACTID, &rv);
      if (copyService)
        copyService->CopyMessages(m_currentFolder, messages, destFolder, false, this, m_window, false);
    }
  }
}

void nsImapOfflineSync::ProcessEmptyTrash()
{
  m_currentFolder->EmptyTrash(m_window, this);
  ClearDB(); // EmptyTrash closes and deletes the trash db.
}

// returns true if we found a folder to create, false if we're done creating folders.
bool nsImapOfflineSync::CreateOfflineFolders()
{
  while (m_currentFolder)
  {
    uint32_t flags;
    m_currentFolder->GetFlags(&flags);
    bool offlineCreate = (flags & nsMsgFolderFlags::CreatedOffline) != 0;
    if (offlineCreate)
    {
      if (CreateOfflineFolder(m_currentFolder))
        return true;
    }
    AdvanceToNextFolder();
  }
  return false;
}

bool nsImapOfflineSync::CreateOfflineFolder(nsIMsgFolder *folder)
{
  nsCOMPtr<nsIMsgFolder> parent;
  folder->GetParent(getter_AddRefs(parent));

  nsCOMPtr <nsIMsgImapMailFolder> imapFolder = do_QueryInterface(parent);
  nsCOMPtr <nsIURI> createFolderURI;
  nsCString onlineName;
  imapFolder->GetOnlineName(onlineName);

  NS_ConvertASCIItoUTF16 folderName(onlineName);
  nsresult rv = imapFolder->PlaybackOfflineFolderCreate(folderName, nullptr,  getter_AddRefs(createFolderURI));
  if (createFolderURI && NS_SUCCEEDED(rv))
  {
    nsCOMPtr <nsIMsgMailNewsUrl> mailnewsUrl = do_QueryInterface(createFolderURI);
    if (mailnewsUrl)
      mailnewsUrl->RegisterListener(this);
  }
  return NS_SUCCEEDED(rv) ? true : false;	// this is asynch, we have to return and be called again by the OfflineOpExitFunction
}

int32_t nsImapOfflineSync::GetCurrentUIDValidity()
{
  if (m_currentFolder)
  {
    nsCOMPtr <nsIImapMailFolderSink> imapFolderSink = do_QueryInterface(m_currentFolder);
    if (imapFolderSink)
      imapFolderSink->GetUidValidity(&mCurrentUIDValidity);
  }
  return mCurrentUIDValidity; 
}

// Playing back offline operations is one giant state machine that runs through ProcessNextOperation.
// The first state is creating online any folders created offline (we do this first, so we can play back
// any operations in them in the next pass)

nsresult nsImapOfflineSync::ProcessNextOperation()
{
  nsresult rv = NS_OK;
  // find a folder that needs to process operations
  nsIMsgFolder *deletedAllOfflineEventsInFolder = nullptr;

  // if we haven't created offline folders, and we're updating all folders,
  // first, find offline folders to create.
  if (!m_createdOfflineFolders)
  {
    if (m_singleFolderToUpdate)
    {
      if (!m_pseudoOffline)
      {
        AdvanceToFirstIMAPFolder();
        if (CreateOfflineFolders())
          return NS_OK;
      }
    }
    else
    {
      if (CreateOfflineFolders())
        return NS_OK;
      m_currentServer = nullptr;
      AdvanceToNextFolder();
    }
    m_createdOfflineFolders = true;
  }
  // if updating one folder only, restore m_currentFolder to that folder
  if (m_singleFolderToUpdate)
    m_currentFolder = m_singleFolderToUpdate;
  
  uint32_t folderFlags;
  nsCOMPtr <nsIDBFolderInfo> folderInfo;
  while (m_currentFolder && !m_currentDB)
  {
    m_currentFolder->GetFlags(&folderFlags);
    // need to check if folder has offline events, /* or is configured for offline */
    // shouldn't need to check if configured for offline use, since any folder with
    // events should have nsMsgFolderFlags::OfflineEvents set.
    if (folderFlags & (nsMsgFolderFlags::OfflineEvents /* | nsMsgFolderFlags::Offline */))
    {
      m_currentFolder->GetDBFolderInfoAndDB(getter_AddRefs(folderInfo), getter_AddRefs(m_currentDB));
      if (m_currentDB)
        m_currentDB->AddListener(this);
    }

    if (m_currentDB)
    {
      m_CurrentKeys.Clear();
      m_KeyIndex = 0;
      if ((m_currentDB->ListAllOfflineOpIds(&m_CurrentKeys) != 0) || m_CurrentKeys.IsEmpty())
      {
        ClearDB();
        folderInfo = nullptr; // can't hold onto folderInfo longer than db
        m_currentFolder->ClearFlag(nsMsgFolderFlags::OfflineEvents);
      }
      else
      {
        // trash any ghost msgs
        bool deletedGhostMsgs = false;
        for (uint32_t fakeIndex=0; fakeIndex < m_CurrentKeys.Length(); fakeIndex++)
        {
          nsCOMPtr <nsIMsgOfflineImapOperation> currentOp; 
          m_currentDB->GetOfflineOpForKey(m_CurrentKeys[fakeIndex], false, getter_AddRefs(currentOp));
          if (currentOp)
          {
            nsOfflineImapOperationType opType; 
            currentOp->GetOperation(&opType);
            
            if (opType == nsIMsgOfflineImapOperation::kMoveResult)
            {
              nsMsgKey curKey;
              currentOp->GetMessageKey(&curKey);
              m_currentDB->RemoveOfflineOp(currentOp);
              deletedGhostMsgs = true;

              // Remember the pseudo headers before we delete them,
              // and when we download new headers, tell listeners about the
              // message key change between the pseudo headers and the real
              // downloaded headers. Note that we're not currently sending
              // a msgsDeleted notifcation for these headers, but the
              // db listeners are notified about the deletion.
              // for imap folders, we should adjust the pending counts, because we
              // have a header that we know about, but don't have in the db.
              nsCOMPtr <nsIMsgImapMailFolder> imapFolder = do_QueryInterface(m_currentFolder);
              if (imapFolder)
              {
                bool hdrIsRead;
                m_currentDB->IsRead(curKey, &hdrIsRead);
                imapFolder->ChangePendingTotal(1);
                if (!hdrIsRead)
                  imapFolder->ChangePendingUnread(1);
                imapFolder->AddMoveResultPseudoKey(curKey);
              }
              m_currentDB->DeleteMessage(curKey, nullptr, false);
            }
          }
        }
        
        if (deletedGhostMsgs)
          m_currentFolder->SummaryChanged();
        
        m_CurrentKeys.Clear();
        if ( (m_currentDB->ListAllOfflineOpIds(&m_CurrentKeys) != 0) || m_CurrentKeys.IsEmpty() )
        {
          ClearDB();
          if (deletedGhostMsgs)
            deletedAllOfflineEventsInFolder = m_currentFolder;
        }
        else if (folderFlags & nsMsgFolderFlags::ImapBox)
        {
          // if pseudo offline, falls through to playing ops back.
          if (!m_pseudoOffline) 
          {
            // there are operations to playback so check uid validity
            SetCurrentUIDValidity(0); // force initial invalid state
            // do a lite select here and hook ourselves up as a listener.
            nsCOMPtr <nsIMsgImapMailFolder> imapFolder = do_QueryInterface(m_currentFolder, &rv);
            if (imapFolder)
              rv = imapFolder->LiteSelect(this, m_window);
            // this is async, we will be called again by OnStopRunningUrl.
            return rv;
          }
        }
      }
    }
    
    if (!m_currentDB)
    {
      // only advance if we are doing all folders
      if (!m_singleFolderToUpdate)
        AdvanceToNextFolder();
      else
        m_currentFolder = nullptr;	// force update of this folder now.
    }
    
  }
  
  if (m_currentFolder)
    m_currentFolder->GetFlags(&folderFlags);
  // do the current operation
  if (m_currentDB)
  {
    bool currentFolderFinished = false;
    if (!folderInfo)
      m_currentDB->GetDBFolderInfo(getter_AddRefs(folderInfo));
    // user canceled the lite select! if GetCurrentUIDValidity() == 0
    if (folderInfo && (m_KeyIndex < m_CurrentKeys.Length()) &&
        (m_pseudoOffline || (GetCurrentUIDValidity() != 0) ||
        !(folderFlags & nsMsgFolderFlags::ImapBox)))
    {
      int32_t curFolderUidValidity;
      folderInfo->GetImapUidValidity(&curFolderUidValidity);
      bool uidvalidityChanged = (!m_pseudoOffline && folderFlags & nsMsgFolderFlags::ImapBox) && (GetCurrentUIDValidity() != curFolderUidValidity);
      nsCOMPtr <nsIMsgOfflineImapOperation> currentOp;
      if (uidvalidityChanged)
        DeleteAllOfflineOpsForCurrentDB();
      else
        m_currentDB->GetOfflineOpForKey(m_CurrentKeys[m_KeyIndex], false, getter_AddRefs(currentOp));

      if (currentOp)
      {
        nsOfflineImapOperationType opType; 
        currentOp->GetOperation(&opType);
        // loop until we find the next db record that matches the current playback operation
        while (currentOp && !(opType & mCurrentPlaybackOpType))
        {
          // remove operations with no type.
          if (!opType)
            m_currentDB->RemoveOfflineOp(currentOp);
          currentOp = nullptr;
          ++m_KeyIndex;
          if (m_KeyIndex < m_CurrentKeys.Length())
            m_currentDB->GetOfflineOpForKey(m_CurrentKeys[m_KeyIndex],
                                            false, getter_AddRefs(currentOp));
          if (currentOp)
            currentOp->GetOperation(&opType);
        }
        // if we did not find a db record that matches the current playback operation,
        // then move to the next playback operation and recurse.  
        if (!currentOp)
        {
          // we are done with the current type
          if (mCurrentPlaybackOpType == nsIMsgOfflineImapOperation::kFlagsChanged)
          {
            mCurrentPlaybackOpType = nsIMsgOfflineImapOperation::kAddKeywords;
            // recurse to deal with next type of operation
            m_KeyIndex = 0;
            ProcessNextOperation();
          }
          else if (mCurrentPlaybackOpType == nsIMsgOfflineImapOperation::kAddKeywords)
          {
            mCurrentPlaybackOpType = nsIMsgOfflineImapOperation::kRemoveKeywords;
            // recurse to deal with next type of operation
            m_KeyIndex = 0;
            ProcessNextOperation();
          }
          else if (mCurrentPlaybackOpType == nsIMsgOfflineImapOperation::kRemoveKeywords)
          {
            mCurrentPlaybackOpType = nsIMsgOfflineImapOperation::kMsgCopy;
            // recurse to deal with next type of operation
            m_KeyIndex = 0;
            ProcessNextOperation();
          }
          else if (mCurrentPlaybackOpType == nsIMsgOfflineImapOperation::kMsgCopy)
          {
            mCurrentPlaybackOpType = nsIMsgOfflineImapOperation::kMsgMoved;
            // recurse to deal with next type of operation
            m_KeyIndex = 0;
            ProcessNextOperation();
          }
          else if (mCurrentPlaybackOpType == nsIMsgOfflineImapOperation::kMsgMoved)
          {
            mCurrentPlaybackOpType = nsIMsgOfflineImapOperation::kAppendDraft;
            // recurse to deal with next type of operation
            m_KeyIndex = 0;
            ProcessNextOperation();
          }
          else if (mCurrentPlaybackOpType == nsIMsgOfflineImapOperation::kAppendDraft)
          {
            mCurrentPlaybackOpType = nsIMsgOfflineImapOperation::kAppendTemplate;
            // recurse to deal with next type of operation
            m_KeyIndex = 0;
            ProcessNextOperation();
          }
          else if (mCurrentPlaybackOpType == nsIMsgOfflineImapOperation::kAppendTemplate)
          {
            mCurrentPlaybackOpType = nsIMsgOfflineImapOperation::kDeleteAllMsgs;
            m_KeyIndex = 0;
            ProcessNextOperation();
          }
          else
          {
            DeleteAllOfflineOpsForCurrentDB();
            currentFolderFinished = true;
          }
          
        }
        else
        {
          if (mCurrentPlaybackOpType == nsIMsgOfflineImapOperation::kFlagsChanged)
            ProcessFlagOperation(currentOp);
          else if (mCurrentPlaybackOpType == nsIMsgOfflineImapOperation::kAddKeywords
            ||mCurrentPlaybackOpType == nsIMsgOfflineImapOperation::kRemoveKeywords)
            ProcessKeywordOperation(currentOp);
          else if (mCurrentPlaybackOpType == nsIMsgOfflineImapOperation::kMsgCopy)
            ProcessCopyOperation(currentOp);
          else if (mCurrentPlaybackOpType == nsIMsgOfflineImapOperation::kMsgMoved)
            ProcessMoveOperation(currentOp);
          else if (mCurrentPlaybackOpType == nsIMsgOfflineImapOperation::kAppendDraft)
            ProcessAppendMsgOperation(currentOp, nsIMsgOfflineImapOperation::kAppendDraft);
          else if (mCurrentPlaybackOpType == nsIMsgOfflineImapOperation::kAppendTemplate)
            ProcessAppendMsgOperation(currentOp, nsIMsgOfflineImapOperation::kAppendTemplate);
          else if (mCurrentPlaybackOpType == nsIMsgOfflineImapOperation::kDeleteAllMsgs)
          {
            // empty trash is going to delete the db, so we'd better release the
            // reference to the offline operation first.
            currentOp = nullptr;
            ProcessEmptyTrash();
          }
          else
            NS_ERROR("invalid playback op type");
        }
      }
      else
        currentFolderFinished = true;
    }
    else
      currentFolderFinished = true;
    
    if (currentFolderFinished)
    {
      ClearDB();
      if (!m_singleFolderToUpdate)
      {
        AdvanceToNextFolder();
        ProcessNextOperation();
        return NS_OK;
      }
      else
        m_currentFolder = nullptr;
    }
  }
  
  if (!m_currentFolder && !m_mailboxupdatesStarted)
  {
    m_mailboxupdatesStarted = true;
    
    // if we are updating more than one folder then we need the iterator
    if (!m_singleFolderToUpdate)
    {
      m_currentServer = nullptr;
      AdvanceToNextFolder();
    }
    if (m_singleFolderToUpdate)
    {
      m_singleFolderToUpdate->ClearFlag(nsMsgFolderFlags::OfflineEvents);
      m_singleFolderToUpdate->UpdateFolder(m_window);
      nsCOMPtr<nsIMsgImapMailFolder> imapFolder(do_QueryInterface(m_singleFolderToUpdate));
      if (imapFolder)
      {
        nsCOMPtr<nsIUrlListener> saveListener = m_listener;
//        m_listener = nullptr;
//        imapFolder->UpdateFolderWithListener(m_window, saveListener);
      }
    }
  }
  // if we get here, then I *think* we're done. Not sure, though.
#ifdef DEBUG_bienvenu
  printf("done with offline imap sync\n");
#endif
  nsCOMPtr <nsIUrlListener> saveListener = m_listener;
  m_listener = nullptr;

  if (saveListener)
    saveListener->OnStopRunningUrl(nullptr /* don't know url */, rv);
  return rv;
}


void nsImapOfflineSync::DeleteAllOfflineOpsForCurrentDB()
{
  m_KeyIndex = 0;
  nsCOMPtr <nsIMsgOfflineImapOperation> currentOp;
  m_currentDB->GetOfflineOpForKey(m_CurrentKeys[m_KeyIndex], false, getter_AddRefs(currentOp));
  while (currentOp)
  {
    // NS_ASSERTION(currentOp->GetOperationFlags() == 0);
    // delete any ops that have already played back
    m_currentDB->RemoveOfflineOp(currentOp);
    currentOp = nullptr;
    
    if (++m_KeyIndex < m_CurrentKeys.Length())
      m_currentDB->GetOfflineOpForKey(m_CurrentKeys[m_KeyIndex], false, getter_AddRefs(currentOp));
  }
  m_currentDB->Commit(nsMsgDBCommitType::kLargeCommit);
  // turn off nsMsgFolderFlags::OfflineEvents
  if (m_currentFolder)
    m_currentFolder->ClearFlag(nsMsgFolderFlags::OfflineEvents);
}

nsImapOfflineDownloader::nsImapOfflineDownloader(nsIMsgWindow *aMsgWindow, nsIUrlListener *aListener) : nsImapOfflineSync(aMsgWindow, aListener)
{
  // pause auto-sync service
  nsresult rv;
  nsCOMPtr<nsIAutoSyncManager> autoSyncMgr = do_GetService(NS_AUTOSYNCMANAGER_CONTRACTID, &rv);
  if (NS_SUCCEEDED(rv)) 
    autoSyncMgr->Pause();    
}

nsImapOfflineDownloader::~nsImapOfflineDownloader()
{
}

nsresult nsImapOfflineDownloader::ProcessNextOperation()
{
  nsresult rv = NS_OK;
  if (!m_mailboxupdatesStarted)
  {
    m_mailboxupdatesStarted = true;
    // Update the INBOX first so the updates on the remaining
    // folders pickup the results of any filter moves.
    nsCOMPtr<nsIMsgAccountManager> accountManager = 
             do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
    if (NS_FAILED(rv)) return rv;
    nsCOMPtr<nsISupportsArray> servers;
  
    rv = accountManager->GetAllServers(getter_AddRefs(servers));
    if (NS_FAILED(rv)) return rv;
  }
  if (!m_mailboxupdatesFinished)
  {
    AdvanceToNextServer();
    if (m_currentServer)
    {
      nsCOMPtr <nsIMsgFolder> rootMsgFolder;
      m_currentServer->GetRootFolder(getter_AddRefs(rootMsgFolder));
      nsCOMPtr<nsIMsgFolder> inbox;
      if (rootMsgFolder)
      {
          rootMsgFolder->GetFolderWithFlags(nsMsgFolderFlags::Inbox,
                                            getter_AddRefs(inbox));
          if (inbox)
          {
            nsCOMPtr <nsIMsgFolder> offlineImapFolder;
            nsCOMPtr <nsIMsgImapMailFolder> imapInbox = do_QueryInterface(inbox);
            if (imapInbox)
            {
              rootMsgFolder->GetFolderWithFlags(nsMsgFolderFlags::Offline,
                                                getter_AddRefs(offlineImapFolder));
              if (!offlineImapFolder)
              {
                // no imap folders configured for offline use - check if the account is set up
                // so that we always download inbox msg bodies for offline use
                nsCOMPtr <nsIImapIncomingServer> imapServer = do_QueryInterface(m_currentServer);
                if (imapServer)
                {
                  bool downloadBodiesOnGetNewMail = false;
                  imapServer->GetDownloadBodiesOnGetNewMail(&downloadBodiesOnGetNewMail);
                  if (downloadBodiesOnGetNewMail)
                    offlineImapFolder = inbox;
                }
              }
            }
            // if this isn't an imap inbox, or we have an offline imap sub-folder, then update the inbox.
            // otherwise, it's an imap inbox for an account with no folders configured for offline use,
            // so just advance to the next server.
            if (!imapInbox || offlineImapFolder)
            {
              // here we should check if this a pop3 server/inbox, and the user doesn't want
              // to download pop3 mail for offline use.
              if (!imapInbox)
              {
              }
              rv = inbox->GetNewMessages(m_window, this);
              if (NS_SUCCEEDED(rv))
                return rv; // otherwise, fall through.
            }
          }
      }
      return ProcessNextOperation(); // recurse and do next server.
    }
    else
    {
      m_allServers = nullptr;
      m_mailboxupdatesFinished = true;
    }
  }
  AdvanceToNextFolder();

  while (m_currentFolder)
  {
    uint32_t folderFlags;

    ClearDB();
    nsCOMPtr <nsIMsgImapMailFolder> imapFolder;
    if (m_currentFolder)
      imapFolder = do_QueryInterface(m_currentFolder);
    m_currentFolder->GetFlags(&folderFlags);
    // need to check if folder has offline events, or is configured for offline
    if (imapFolder && folderFlags & nsMsgFolderFlags::Offline &&
      ! (folderFlags & nsMsgFolderFlags::Virtual))
    {
      rv = m_currentFolder->DownloadAllForOffline(this, m_window);
      if (NS_SUCCEEDED(rv) || rv == NS_BINDING_ABORTED)
        return rv;
      // if this fails and the user didn't cancel/stop, fall through to code that advances to next folder
    }
    AdvanceToNextFolder();
  }
  if (m_listener)
    m_listener->OnStopRunningUrl(nullptr, NS_OK);
  return rv;
}


NS_IMETHODIMP nsImapOfflineSync::OnStartCopy()
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* void OnProgress (in uint32_t aProgress, in uint32_t aProgressMax); */
NS_IMETHODIMP nsImapOfflineSync::OnProgress(uint32_t aProgress, uint32_t aProgressMax)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* void SetMessageKey (in uint32_t aKey); */
NS_IMETHODIMP nsImapOfflineSync::SetMessageKey(uint32_t aKey)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* [noscript] void GetMessageId (in nsCString aMessageId); */
NS_IMETHODIMP nsImapOfflineSync::GetMessageId(nsACString& messageId)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* void OnStopCopy (in nsresult aStatus); */
NS_IMETHODIMP nsImapOfflineSync::OnStopCopy(nsresult aStatus)
{
  return OnStopRunningUrl(nullptr, aStatus);
}

void nsImapOfflineSync::ClearDB()
{
  m_currentOpsToClear.Clear();
  if (m_currentDB)
    m_currentDB->RemoveListener(this);
  m_currentDB = nullptr;
}

NS_IMETHODIMP
nsImapOfflineSync::OnHdrPropertyChanged(nsIMsgDBHdr *aHdrToChange,
    bool aPreChange, uint32_t *aStatus, nsIDBChangeListener * aInstigator)
{
  return NS_OK;
}


NS_IMETHODIMP
nsImapOfflineSync::OnHdrFlagsChanged(nsIMsgDBHdr *aHdrChanged,
    uint32_t aOldFlags, uint32_t aNewFlags, nsIDBChangeListener *aInstigator)
{
    return NS_OK;
}

NS_IMETHODIMP
nsImapOfflineSync::OnHdrDeleted(nsIMsgDBHdr *aHdrChanged,
    nsMsgKey aParentKey, int32_t aFlags, nsIDBChangeListener *aInstigator)
{
    return NS_OK;
}

NS_IMETHODIMP
nsImapOfflineSync::OnHdrAdded(nsIMsgDBHdr *aHdrAdded,
    nsMsgKey aParentKey, int32_t aFlags, nsIDBChangeListener *aInstigator)
{
    return NS_OK;
}

/* void OnParentChanged (in nsMsgKey aKeyChanged, in nsMsgKey oldParent, in nsMsgKey newParent, in nsIDBChangeListener aInstigator); */
NS_IMETHODIMP
nsImapOfflineSync::OnParentChanged(nsMsgKey aKeyChanged,
    nsMsgKey oldParent, nsMsgKey newParent, nsIDBChangeListener *aInstigator)
{
    return NS_OK;
}

/* void OnAnnouncerGoingAway (in nsIDBChangeAnnouncer instigator); */
NS_IMETHODIMP
nsImapOfflineSync::OnAnnouncerGoingAway(nsIDBChangeAnnouncer *instigator)
{
  ClearDB();
  return NS_OK;
}

NS_IMETHODIMP nsImapOfflineSync::OnEvent(nsIMsgDatabase *aDB, const char *aEvent)
{
  return NS_OK;
}

/* void OnReadChanged (in nsIDBChangeListener instigator); */
NS_IMETHODIMP
nsImapOfflineSync::OnReadChanged(nsIDBChangeListener *instigator)
{
    return NS_OK;
}

/* void OnJunkScoreChanged (in nsIDBChangeListener instigator); */
NS_IMETHODIMP
nsImapOfflineSync::OnJunkScoreChanged(nsIDBChangeListener *instigator)
{
    return NS_OK;
}

