/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifdef MOZ_LOGGING
#define FORCE_PR_LOG /* Allow logging in the release build */
#endif
#include "nsMsgCopyService.h"
#include "nsCOMArray.h"
#include "nspr.h"
#include "nsIFile.h"
#include "nsIMsgFolderNotificationService.h"
#include "nsMsgBaseCID.h"
#include "nsIMutableArray.h"
#include "nsArrayUtils.h"
#include "nsComponentManagerUtils.h"
#include "nsServiceManagerUtils.h"
#include "nsMsgUtils.h"

static PRLogModuleInfo *gCopyServiceLog;

// ******************** nsCopySource ******************
//

nsCopySource::nsCopySource() : m_processed(false)
{
  MOZ_COUNT_CTOR(nsCopySource);
  m_messageArray = do_CreateInstance(NS_ARRAY_CONTRACTID);
}

nsCopySource::nsCopySource(nsIMsgFolder* srcFolder) :
    m_processed(false)
{
  MOZ_COUNT_CTOR(nsCopySource);
  m_messageArray = do_CreateInstance(NS_ARRAY_CONTRACTID);
  m_msgFolder = srcFolder;
}

nsCopySource::~nsCopySource()
{
  MOZ_COUNT_DTOR(nsCopySource);
}

void nsCopySource::AddMessage(nsIMsgDBHdr* aMsg)
{
  m_messageArray->AppendElement(aMsg, false);
}

// ************ nsCopyRequest *****************
//

nsCopyRequest::nsCopyRequest() :
    m_requestType(nsCopyMessagesType),
    m_isMoveOrDraftOrTemplate(false),
    m_processed(false),
    m_newMsgFlags(0)
{
  MOZ_COUNT_CTOR(nsCopyRequest);
}

nsCopyRequest::~nsCopyRequest()
{
  MOZ_COUNT_DTOR(nsCopyRequest);

  int32_t j = m_copySourceArray.Length();
  while(j-- > 0)
    delete m_copySourceArray.ElementAt(j);
}

nsresult
nsCopyRequest::Init(nsCopyRequestType type, nsISupports* aSupport,
                    nsIMsgFolder* dstFolder,
                    bool bVal, uint32_t newMsgFlags, 
                    const nsACString &newMsgKeywords,
                    nsIMsgCopyServiceListener* listener,
                    nsIMsgWindow* msgWindow, bool allowUndo)
{
  nsresult rv = NS_OK;
  m_requestType = type;
  m_srcSupport = aSupport;
  m_dstFolder = dstFolder;
  m_isMoveOrDraftOrTemplate = bVal;
  m_allowUndo = allowUndo;
  m_newMsgFlags = newMsgFlags;
  m_newMsgKeywords = newMsgKeywords;

  if (listener)
      m_listener = listener;
  if (msgWindow)
  {
    m_msgWindow = msgWindow;
    if (m_allowUndo)
      msgWindow->GetTransactionManager(getter_AddRefs(m_txnMgr));
  }
  if (type == nsCopyFoldersType)
  {
    // To support multiple copy folder operations to the same destination, we
    // need to save the leaf name of the src file spec so that FindRequest() is
    // able to find the right request when copy finishes.
    nsCOMPtr<nsIMsgFolder> srcFolder = do_QueryInterface(aSupport, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    nsString folderName;
    rv = srcFolder->GetName(folderName);
    NS_ENSURE_SUCCESS(rv, rv);
    m_dstFolderName = folderName;
  }

  return rv;
}

nsCopySource*
nsCopyRequest::AddNewCopySource(nsIMsgFolder* srcFolder)
{
  nsCopySource* newSrc = new nsCopySource(srcFolder);
  if (newSrc)
  {
      m_copySourceArray.AppendElement(newSrc);
      if (srcFolder == m_dstFolder)
        newSrc->m_processed = true;
  }
  return newSrc;
}

// ************* nsMsgCopyService ****************
//


nsMsgCopyService::nsMsgCopyService()
{
  gCopyServiceLog = PR_NewLogModule("MsgCopyService");
}

nsMsgCopyService::~nsMsgCopyService()
{
  int32_t i = m_copyRequests.Length();

  while (i-- > 0)
    ClearRequest(m_copyRequests.ElementAt(i), NS_ERROR_FAILURE);
}

void nsMsgCopyService::LogCopyCompletion(nsISupports *aSrc, nsIMsgFolder *aDest)
{
  nsCString srcFolderUri, destFolderUri;
  nsCOMPtr<nsIMsgFolder> srcFolder(do_QueryInterface(aSrc));
  if (srcFolder)
    srcFolder->GetURI(srcFolderUri);
  aDest->GetURI(destFolderUri);
  PR_LOG(gCopyServiceLog, PR_LOG_ALWAYS,
         ("NotifyCompletion - src %s dest %s\n",
          srcFolderUri.get(), destFolderUri.get()));
}

void nsMsgCopyService::LogCopyRequest(const char *logMsg, nsCopyRequest* aRequest)
{
  nsCString srcFolderUri, destFolderUri;
  nsCOMPtr<nsIMsgFolder> srcFolder(do_QueryInterface(aRequest->m_srcSupport));
  if (srcFolder)
    srcFolder->GetURI(srcFolderUri);
  aRequest->m_dstFolder->GetURI(destFolderUri);
  uint32_t numMsgs = 0;
  if (aRequest->m_requestType == nsCopyMessagesType &&
      aRequest->m_copySourceArray.Length() > 0 &&
      aRequest->m_copySourceArray[0]->m_messageArray)
    aRequest->m_copySourceArray[0]->m_messageArray->GetLength(&numMsgs);
  PR_LOG(gCopyServiceLog, PR_LOG_ALWAYS,
         ("request %lx %s - src %s dest %s numItems %d type=%d",
         aRequest, logMsg, srcFolderUri.get(),
         destFolderUri.get(), numMsgs, aRequest->m_requestType));
}

nsresult
nsMsgCopyService::ClearRequest(nsCopyRequest* aRequest, nsresult rv)
{
  if (aRequest)
  {
    if (PR_LOG_TEST(gCopyServiceLog, PR_LOG_ALWAYS))
      LogCopyRequest(NS_SUCCEEDED(rv) ? "Clearing OK request" 
                                      : "Clearing failed request", aRequest);

    // Send notifications to nsIMsgFolderListeners
    if (NS_SUCCEEDED(rv) && aRequest->m_requestType == nsCopyFoldersType)
    {
      nsCOMPtr<nsIMsgFolderNotificationService> notifier(do_GetService(NS_MSGNOTIFICATIONSERVICE_CONTRACTID));
      if (notifier)
      {
        bool hasListeners;
        notifier->GetHasListeners(&hasListeners);
        if (hasListeners)
        {
          // Iterate over the copy sources and append their message arrays to this mutable array
          // or in the case of folders, the source folder.
          int32_t cnt, i;
          cnt = aRequest->m_copySourceArray.Length();
          for (i = 0; i < cnt; i++)
          {
            nsCopySource *copySource = aRequest->m_copySourceArray.ElementAt(i);
            notifier->NotifyFolderMoveCopyCompleted(aRequest->m_isMoveOrDraftOrTemplate, copySource->m_msgFolder, aRequest->m_dstFolder);
          }
        }
      }
    }

    // undo stuff
    if (aRequest->m_allowUndo &&
        aRequest->m_copySourceArray.Length() > 1 &&
        aRequest->m_txnMgr)
        aRequest->m_txnMgr->EndBatch(false);

    m_copyRequests.RemoveElement(aRequest);
    if (aRequest->m_listener)
        aRequest->m_listener->OnStopCopy(rv);
    delete aRequest;
  }

  return rv;
}

nsresult
nsMsgCopyService::QueueRequest(nsCopyRequest* aRequest, bool *aCopyImmediately)
{
  NS_ENSURE_ARG_POINTER(aRequest);
  NS_ENSURE_ARG_POINTER(aCopyImmediately);
  *aCopyImmediately = true;
  nsCopyRequest* copyRequest;

  uint32_t cnt = m_copyRequests.Length();
  for (uint32_t i = 0; i < cnt; i++)
  {
    copyRequest = m_copyRequests.ElementAt(i);
    if (aRequest->m_requestType == nsCopyFoldersType)
    {
      // For copy folder, see if both destination folder (root)
      // (ie, Local Folder) and folder name (ie, abc) are the same.
      if (copyRequest->m_dstFolderName == aRequest->m_dstFolderName &&
          copyRequest->m_dstFolder.get() == aRequest->m_dstFolder.get())
      {
        *aCopyImmediately = false;
        break;
      }
    }
    else if (copyRequest->m_dstFolder.get() == aRequest->m_dstFolder.get())  //if dst are same and we already have a request, we cannot copy immediately
    {
      *aCopyImmediately = false;
      break;
    }
  }
  return NS_OK;
}

nsresult
nsMsgCopyService::DoCopy(nsCopyRequest* aRequest)
{
  NS_ENSURE_ARG(aRequest);
  bool copyImmediately;
  QueueRequest(aRequest, &copyImmediately);
  m_copyRequests.AppendElement(aRequest);
  if (PR_LOG_TEST(gCopyServiceLog, PR_LOG_ALWAYS))
    LogCopyRequest(copyImmediately ? "DoCopy" : "QueueRequest", aRequest);

  // if no active request for this dest folder then we can copy immediately
  if (copyImmediately)
    return DoNextCopy();

  return NS_OK;
}

nsresult
nsMsgCopyService::DoNextCopy()
{
  nsresult rv = NS_OK;
  nsCopyRequest* copyRequest = nullptr;
  nsCopySource* copySource = nullptr;
  uint32_t i, j, scnt;

  uint32_t cnt = m_copyRequests.Length();
  if (cnt > 0)
  {
    nsCOMArray<nsIMsgFolder> activeTargets;

    // ** jt -- always FIFO
    for (i = 0; i < cnt; i++)
    {
      copyRequest = m_copyRequests.ElementAt(i);
      copySource = nullptr;
      scnt = copyRequest->m_copySourceArray.Length();
      if (!copyRequest->m_processed)
      {
        // if the target folder of this request already has an active
        // copy request, skip this request for now.
        if (activeTargets.IndexOfObject(copyRequest->m_dstFolder) != kNotFound)
        {
          copyRequest = nullptr;
          continue;
        }
        if (scnt <= 0)
            goto found; // must be CopyFileMessage
        for (j = 0; j < scnt; j++)
        {
          copySource = copyRequest->m_copySourceArray.ElementAt(j);
          if (!copySource->m_processed)
            goto found;
        }
        if (j >= scnt) // all processed set the value
          copyRequest->m_processed = true;
      }
      if (copyRequest->m_processed) // keep track of folders actively getting copied to.
        activeTargets.AppendObject(copyRequest->m_dstFolder);
    }
    found:
      if (copyRequest && !copyRequest->m_processed)
      {
          if (copyRequest->m_listener)
              copyRequest->m_listener->OnStartCopy();
          if (copyRequest->m_requestType == nsCopyMessagesType &&
              copySource)
          {
              copySource->m_processed = true;
              rv = copyRequest->m_dstFolder->CopyMessages
                  (copySource->m_msgFolder, copySource->m_messageArray,
                   copyRequest->m_isMoveOrDraftOrTemplate,
                   copyRequest->m_msgWindow, copyRequest->m_listener, false, copyRequest->m_allowUndo);   //isFolder operation false

          }
          else if (copyRequest->m_requestType == nsCopyFoldersType )
          {
              copySource->m_processed = true;
              rv = copyRequest->m_dstFolder->CopyFolder
                  (copySource->m_msgFolder,
                   copyRequest->m_isMoveOrDraftOrTemplate,
                   copyRequest->m_msgWindow, copyRequest->m_listener);
              // If it's a copy folder operation and the destination
              // folder already exists, CopyFolder() returns an error w/o sending
              // a completion notification, so clear it here.
              if (NS_FAILED(rv))
                ClearRequest(copyRequest, rv);

          }
          else if (copyRequest->m_requestType == nsCopyFileMessageType)
          {
            nsCOMPtr<nsIFile> aFile(do_QueryInterface(copyRequest->m_srcSupport, &rv));
            if (NS_SUCCEEDED(rv))
            {
                // ** in case of saving draft/template; the very first
                // time we may not have the original message to replace
                // with; if we do we shall have an instance of copySource
                nsCOMPtr<nsIMsgDBHdr> aMessage;
                if (copySource)
                {
                    aMessage = do_QueryElementAt(copySource->m_messageArray,
                                                 0, &rv);
                    copySource->m_processed = true;
                }
                copyRequest->m_processed = true;
                rv = copyRequest->m_dstFolder->CopyFileMessage
                    (aFile, aMessage,
                     copyRequest->m_isMoveOrDraftOrTemplate,
                     copyRequest->m_newMsgFlags,
                     copyRequest->m_newMsgKeywords,
                     copyRequest->m_msgWindow,
                     copyRequest->m_listener);
            }
          }
      }
    }
    return rv;
}

/**
 * Find a request in m_copyRequests which matches the passed in source 
 * and destination folders.
 *
 * @param aSupport the iSupports of the source folder.
 * @param dstFolder the destination folder of the copy request.
 */
nsCopyRequest*
nsMsgCopyService::FindRequest(nsISupports* aSupport,
                              nsIMsgFolder* dstFolder)
{
  nsCopyRequest* copyRequest = nullptr;
  uint32_t cnt = m_copyRequests.Length();
  for (uint32_t i = 0; i < cnt; i++)
  {
    copyRequest = m_copyRequests.ElementAt(i);
    if (copyRequest->m_requestType == nsCopyFoldersType)
    {
        // If the src is different then check next request.
        if (copyRequest->m_srcSupport.get() != aSupport)
        {
          copyRequest = nullptr;
          continue;
        }

        // See if the parent of the copied folder is the same as the one when the request was made.
        // Note if the destination folder is already a server folder then no need to get parent.
        nsCOMPtr <nsIMsgFolder> parentMsgFolder;
        nsresult rv = NS_OK;
        bool isServer=false;
        dstFolder->GetIsServer(&isServer);
        if (!isServer)
          rv = dstFolder->GetParent(getter_AddRefs(parentMsgFolder));
        if ((NS_FAILED(rv)) || (!parentMsgFolder && !isServer) || (copyRequest->m_dstFolder.get() != parentMsgFolder))
        {
          copyRequest = nullptr;
          continue;
        }

        // Now checks if the folder name is the same.
        nsString folderName;
        rv = dstFolder->GetName(folderName);
        if (NS_FAILED(rv))
        {
          copyRequest = nullptr;
          continue;
        }

        if (copyRequest->m_dstFolderName == folderName)
          break;
    }
    else if (copyRequest->m_srcSupport.get() == aSupport &&
        copyRequest->m_dstFolder.get() == dstFolder)
        break;
    else
        copyRequest = nullptr;
  }

  return copyRequest;
}

NS_IMPL_ISUPPORTS1(nsMsgCopyService, nsIMsgCopyService)

NS_IMETHODIMP
nsMsgCopyService::CopyMessages(nsIMsgFolder* srcFolder, /* UI src folder */
                               nsIArray* messages,
                               nsIMsgFolder* dstFolder,
                               bool isMove,
                               nsIMsgCopyServiceListener* listener,
                               nsIMsgWindow* window,
                               bool allowUndo)
{
  NS_ENSURE_ARG_POINTER(srcFolder);
  NS_ENSURE_ARG_POINTER(messages);
  NS_ENSURE_ARG_POINTER(dstFolder);

  PR_LOG(gCopyServiceLog, PR_LOG_DEBUG, ("CopyMessages"));

  if (srcFolder == dstFolder)
  {
    NS_ERROR("src and dest folders for msg copy can't be the same");
    return NS_ERROR_FAILURE;
  }
  nsCopyRequest* copyRequest;
  nsCopySource* copySource = nullptr;
  nsCOMArray<nsIMsgDBHdr> msgArray;
  uint32_t cnt;
  nsCOMPtr<nsIMsgDBHdr> msg;
  nsCOMPtr<nsIMsgFolder> curFolder;
  nsCOMPtr<nsISupports> aSupport;
  nsresult rv;

  // XXX TODO
  // JUNK MAIL RELATED
  // make sure dest folder exists
  // and has proper flags, before we start copying?

  copyRequest = new nsCopyRequest();
  if (!copyRequest)
    return NS_ERROR_OUT_OF_MEMORY;

  aSupport = do_QueryInterface(srcFolder, &rv);

  rv = copyRequest->Init(nsCopyMessagesType, aSupport, dstFolder, isMove,
                        0 /* new msg flags, not used */, EmptyCString(), 
                        listener, window, allowUndo);
  if (NS_FAILED(rv))
    goto done;

  messages->GetLength(&cnt);

  if (PR_LOG_TEST(gCopyServiceLog, PR_LOG_ALWAYS))
    LogCopyRequest("CopyMessages request", copyRequest);

  // duplicate the message array so we could sort the messages by it's
  // folder easily
  for (uint32_t i = 0; i < cnt; i++)
  {
    nsCOMPtr<nsIMsgDBHdr> currMsg = do_QueryElementAt(messages, i);
    msgArray.AppendObject(currMsg);
  }

  cnt = msgArray.Count();

  while (cnt-- > 0)
  {
    msg = msgArray[cnt];
    rv = msg->GetFolder(getter_AddRefs(curFolder));

    if (NS_FAILED(rv))
      goto done;
    if (!copySource)
    {
      copySource = copyRequest->AddNewCopySource(curFolder);
      if (!copySource)
      {
         rv = NS_ERROR_OUT_OF_MEMORY;
         goto done;
      }
    }

    if (curFolder == copySource->m_msgFolder)
    {
      copySource->AddMessage(msg);
      msgArray.RemoveObjectAt(cnt);
    }

    if (cnt == 0)
    {
      cnt = msgArray.Count();
      if (cnt > 0)
        copySource = nullptr; // * force to create a new one and
                             // * continue grouping the messages
    }
  }

  // undo stuff
  if (NS_SUCCEEDED(rv) && copyRequest->m_allowUndo && copyRequest->m_copySourceArray.Length() > 1 &&
      copyRequest->m_txnMgr)
    copyRequest->m_txnMgr->BeginBatch(nullptr);

done:

    if (NS_FAILED(rv))
      delete copyRequest;
    else
      rv = DoCopy(copyRequest);

    return rv;
}

NS_IMETHODIMP
nsMsgCopyService::CopyFolders(nsIArray* folders,
                              nsIMsgFolder* dstFolder,
                              bool isMove,
                              nsIMsgCopyServiceListener* listener,
                              nsIMsgWindow* window)
{
  NS_ENSURE_ARG_POINTER(folders);
  NS_ENSURE_ARG_POINTER(dstFolder);
  nsCopyRequest* copyRequest;
  nsCopySource* copySource = nullptr;
  nsresult rv;
  uint32_t cnt;
  nsCOMPtr<nsIMsgFolder> curFolder;
  nsCOMPtr<nsISupports> support;

  rv = folders->GetLength(&cnt);   //if cnt is zero it cannot to get this point, will be detected earlier
  if (cnt > 1)
    NS_ASSERTION((NS_SUCCEEDED(rv)),"More than one folders to copy");

  support = do_QueryElementAt(folders, 0);

  copyRequest = new nsCopyRequest();
  if (!copyRequest) return NS_ERROR_OUT_OF_MEMORY;

  rv = copyRequest->Init(nsCopyFoldersType, support, dstFolder,
    isMove, 0 /* new msg flags, not used */ , EmptyCString(), listener, window, false);
  NS_ENSURE_SUCCESS(rv, rv);

  curFolder = do_QueryInterface(support, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  copySource = copyRequest->AddNewCopySource(curFolder);
  if (!copySource)
    rv = NS_ERROR_OUT_OF_MEMORY;

  if (NS_FAILED(rv))
  {
    delete copyRequest;
    NS_ENSURE_SUCCESS(rv, rv);
  }
  else
    rv = DoCopy(copyRequest);

  return rv;
}

NS_IMETHODIMP
nsMsgCopyService::CopyFileMessage(nsIFile* file,
                                  nsIMsgFolder* dstFolder,
                                  nsIMsgDBHdr* msgToReplace,
                                  bool isDraft,
                                  uint32_t aMsgFlags,
                                  const nsACString &aNewMsgKeywords,
                                  nsIMsgCopyServiceListener* listener,
                                  nsIMsgWindow* window)
{
  nsresult rv = NS_ERROR_NULL_POINTER;
  nsCopyRequest* copyRequest;
  nsCopySource* copySource = nullptr;
  nsCOMPtr<nsISupports> fileSupport;
  nsCOMPtr<nsITransactionManager> txnMgr;

  NS_ENSURE_ARG_POINTER(file);
  NS_ENSURE_ARG_POINTER(dstFolder);

  if (window)
    window->GetTransactionManager(getter_AddRefs(txnMgr));
  copyRequest = new nsCopyRequest();
  if (!copyRequest) return rv;
  fileSupport = do_QueryInterface(file, &rv);
  if (NS_FAILED(rv)) goto done;

  rv = copyRequest->Init(nsCopyFileMessageType, fileSupport, dstFolder,
                         isDraft, aMsgFlags, aNewMsgKeywords, listener, window, false);
  if (NS_FAILED(rv)) goto done;

  if (msgToReplace)
  {
    // The actual source of the message is a file not a folder, but
    // we still need an nsCopySource to reference the old message header
    // which will be used to recover message metadata.
    copySource = copyRequest->AddNewCopySource(nullptr);
    if (!copySource)
    {
        rv = NS_ERROR_OUT_OF_MEMORY;
        goto done;
    }
    copySource->AddMessage(msgToReplace);
  }

done:
    if (NS_FAILED(rv))
    {
      delete copyRequest;
    }
    else
    {
      rv = DoCopy(copyRequest);
    }

    return rv;
}

NS_IMETHODIMP
nsMsgCopyService::NotifyCompletion(nsISupports* aSupport,
                                   nsIMsgFolder* dstFolder,
                                   nsresult result)
{
  if (PR_LOG_TEST(gCopyServiceLog, PR_LOG_ALWAYS))
    LogCopyCompletion(aSupport, dstFolder);
  nsCopyRequest* copyRequest = nullptr;
  uint32_t numOrigRequests = m_copyRequests.Length();
  do
  {
    // loop for copy requests, because if we do a cross server folder copy,
    // we'll have a copy request for the folder copy, which will in turn
    // generate a copy request for the messages in the folder, which
    // will have the same src support.
    copyRequest = FindRequest(aSupport, dstFolder);

    if (copyRequest)
    {
      // ClearRequest can cause a new request to get added to m_copyRequests
      // with matching source and dest folders if the copy listener starts
      // a new copy. We want to ignore any such request here, because it wasn't
      // the one that was completed. So we keep track of how many original
      // requests there were.
      if (m_copyRequests.IndexOf(copyRequest) >= numOrigRequests)
        break;
      // check if this copy request is done by making sure all the
      // sources have been processed.
      int32_t sourceIndex, sourceCount;
      sourceCount = copyRequest->m_copySourceArray.Length();
      for (sourceIndex = 0; sourceIndex < sourceCount;)
      {
        if (!(copyRequest->m_copySourceArray.ElementAt(sourceIndex))->m_processed)
            break;
         sourceIndex++;
      }
      // if all sources processed, mark the request as processed
      if (sourceIndex >= sourceCount)
        copyRequest->m_processed = true;
      // if this request is done, or failed, clear it.
      if (copyRequest->m_processed || NS_FAILED(result))
      {
        ClearRequest(copyRequest, result);
        numOrigRequests--;
      }
      else
        break;
    }
    else
      break;
  }
  while (copyRequest);

  return DoNextCopy();
}

