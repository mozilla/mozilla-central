/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// this file implements the nsMsgFilterService interface

#include "msgCore.h"
#include "nsMsgFilterService.h"
#include "nsMsgFilterList.h"
#include "nsMsgSearchScopeTerm.h"
#include "nsDirectoryServiceDefs.h"
#include "nsIPrompt.h"
#include "nsIDocShell.h"
#include "nsIInterfaceRequestor.h"
#include "nsIInterfaceRequestorUtils.h"
#include "nsIStringBundle.h"
#include "nsIMsgSearchNotify.h"
#include "nsIUrlListener.h"
#include "nsIMsgCopyServiceListener.h"
#include "nsIMsgLocalMailFolder.h"
#include "nsIMsgDatabase.h"
#include "nsIMsgHdr.h"
#include "nsIDBFolderInfo.h"
#include "nsIRDFService.h"
#include "nsMsgBaseCID.h"
#include "nsIMsgCopyService.h"
#include "nsIOutputStream.h"
#include "nsIMsgComposeService.h"
#include "nsMsgCompCID.h"
#include "nsNetUtil.h"
#include "nsMsgUtils.h"
#include "nsIMutableArray.h"
#include "nsArrayUtils.h"
#include "nsCOMArray.h"
#include "nsIMsgFilterCustomAction.h"
#include "nsArrayEnumerator.h"
#include "nsMsgMessageFlags.h"
#include "nsIMsgWindow.h"
#include "nsIMsgSearchCustomTerm.h"
#include "nsIMsgSearchTerm.h"
#include "nsIMsgThread.h"
#include "nsAutoPtr.h"
#include "nsIMsgFilter.h"

NS_IMPL_ISUPPORTS1(nsMsgFilterService, nsIMsgFilterService)

nsMsgFilterService::nsMsgFilterService()
{
}

nsMsgFilterService::~nsMsgFilterService()
{
}

NS_IMETHODIMP nsMsgFilterService::OpenFilterList(nsIFile *aFilterFile,
                                                 nsIMsgFolder *rootFolder,
                                                 nsIMsgWindow *aMsgWindow,
                                                 nsIMsgFilterList **resultFilterList)
{
  NS_ENSURE_ARG_POINTER(aFilterFile);
  NS_ENSURE_ARG_POINTER(resultFilterList);

  bool exists = false;
  nsresult rv = aFilterFile->Exists(&exists);
  if (NS_FAILED(rv) || !exists)
  {
    rv = aFilterFile->Create(nsIFile::NORMAL_FILE_TYPE, 0644);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  nsCOMPtr<nsIInputStream> fileStream;
  rv = NS_NewLocalFileInputStream(getter_AddRefs(fileStream), aFilterFile);
  NS_ENSURE_SUCCESS(rv, rv);
  NS_ENSURE_TRUE(fileStream, NS_ERROR_OUT_OF_MEMORY);

  nsRefPtr<nsMsgFilterList> filterList = new nsMsgFilterList();
  NS_ENSURE_TRUE(filterList, NS_ERROR_OUT_OF_MEMORY);
  filterList->SetFolder(rootFolder);

  // temporarily tell the filter where its file path is
  filterList->SetDefaultFile(aFilterFile);

  int64_t size = 0;
  rv = aFilterFile->GetFileSize(&size);
  if (NS_SUCCEEDED(rv) && size > 0)
    rv = filterList->LoadTextFilters(fileStream);
  fileStream->Close();
  fileStream = nullptr;
  if (NS_SUCCEEDED(rv))
  {
    int16_t version;
    filterList->GetVersion(&version);
    if (version != kFileVersion)
      SaveFilterList(filterList, aFilterFile);
  }
  else
  {
    if (rv == NS_MSG_FILTER_PARSE_ERROR && aMsgWindow)
    {
      rv = BackUpFilterFile(aFilterFile, aMsgWindow);
      NS_ENSURE_SUCCESS(rv, rv);
      rv = aFilterFile->SetFileSize(0);
      NS_ENSURE_SUCCESS(rv, rv);
      return OpenFilterList(aFilterFile, rootFolder, aMsgWindow, resultFilterList);
    }
    else if (rv == NS_MSG_CUSTOM_HEADERS_OVERFLOW && aMsgWindow)
      ThrowAlertMsg("filterCustomHeaderOverflow", aMsgWindow);
    else if (rv == NS_MSG_INVALID_CUSTOM_HEADER && aMsgWindow)
      ThrowAlertMsg("invalidCustomHeader", aMsgWindow);
  }

  NS_ADDREF(*resultFilterList = filterList);
  return rv;
}

NS_IMETHODIMP nsMsgFilterService::CloseFilterList(nsIMsgFilterList *filterList)
{
  //NS_ASSERTION(false,"CloseFilterList doesn't do anything yet");
  return NS_OK;
}

/* save without deleting */
NS_IMETHODIMP  nsMsgFilterService::SaveFilterList(nsIMsgFilterList *filterList, nsIFile *filterFile)
{
  NS_ENSURE_ARG_POINTER(filterFile);
  NS_ENSURE_ARG_POINTER(filterList);

  nsCOMPtr<nsIOutputStream> out;
  nsresult rv = NS_NewSafeLocalFileOutputStream(getter_AddRefs(out),
                                                filterFile, -1, 0600);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIOutputStream> strm;
  rv = NS_NewBufferedOutputStream(getter_AddRefs(strm), out, 4096);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = filterList->SaveToFile(strm);

  nsCOMPtr<nsISafeOutputStream> safeStream = do_QueryInterface(strm);
  NS_ASSERTION(safeStream, "expected a safe output stream");
  if (NS_SUCCEEDED(rv) && safeStream)
    rv = safeStream->Finish();

  NS_ASSERTION(NS_SUCCEEDED(rv), "failed to save filter file");
  return rv;
}

NS_IMETHODIMP nsMsgFilterService::CancelFilterList(nsIMsgFilterList *filterList)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

nsresult nsMsgFilterService::BackUpFilterFile(nsIFile *aFilterFile, nsIMsgWindow *aMsgWindow)
{
  AlertBackingUpFilterFile(aMsgWindow);

  nsCOMPtr<nsIFile> localParentDir;
  nsresult rv = aFilterFile->GetParent(getter_AddRefs(localParentDir));
  NS_ENSURE_SUCCESS(rv,rv);

  //if back-up file exists delete the back up file otherwise copy fails.
  nsCOMPtr <nsIFile> backupFile;
  rv = localParentDir->Clone(getter_AddRefs(backupFile));
  NS_ENSURE_SUCCESS(rv,rv);
  backupFile->AppendNative(NS_LITERAL_CSTRING("rulesbackup.dat"));
  bool exists;
  backupFile->Exists(&exists);
  if (exists)
    backupFile->Remove(false);

  return aFilterFile->CopyToNative(localParentDir, NS_LITERAL_CSTRING("rulesbackup.dat"));
}

nsresult nsMsgFilterService::AlertBackingUpFilterFile(nsIMsgWindow *aMsgWindow)
{
  return ThrowAlertMsg("filterListBackUpMsg", aMsgWindow);
}

nsresult //Do not use this routine if you have to call it very often because it creates a new bundle each time
nsMsgFilterService::GetStringFromBundle(const char *aMsgName, PRUnichar **aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);

  nsCOMPtr <nsIStringBundle> bundle;
  nsresult rv = GetFilterStringBundle(getter_AddRefs(bundle));
  if (NS_SUCCEEDED(rv) && bundle)
    rv = bundle->GetStringFromName(NS_ConvertASCIItoUTF16(aMsgName).get(), aResult);
  return rv;

}

nsresult
nsMsgFilterService::GetFilterStringBundle(nsIStringBundle **aBundle)
{
  NS_ENSURE_ARG_POINTER(aBundle);

  nsCOMPtr<nsIStringBundleService> bundleService =
         mozilla::services::GetStringBundleService();
  NS_ENSURE_TRUE(bundleService, NS_ERROR_UNEXPECTED);
  nsCOMPtr<nsIStringBundle> bundle;
  if (bundleService)
    bundleService->CreateBundle("chrome://messenger/locale/filter.properties",
                                 getter_AddRefs(bundle));
  NS_IF_ADDREF(*aBundle = bundle);
  return NS_OK;
}

nsresult
nsMsgFilterService::ThrowAlertMsg(const char*aMsgName, nsIMsgWindow *aMsgWindow)
{
  nsString alertString;
  nsresult rv = GetStringFromBundle(aMsgName, getter_Copies(alertString));
  if (NS_SUCCEEDED(rv) && !alertString.IsEmpty() && aMsgWindow)
  {
    nsCOMPtr <nsIDocShell> docShell;
    aMsgWindow->GetRootDocShell(getter_AddRefs(docShell));
    if (docShell)
    {
      nsCOMPtr<nsIPrompt> dialog(do_GetInterface(docShell));
      if (dialog && !alertString.IsEmpty())
        dialog->Alert(nullptr, alertString.get());
    }
  }
  return rv;
}

// this class is used to run filters after the fact, i.e., after new mail has been downloaded from the server.
// It can do the following:
// 1. Apply a single imap or pop3 filter on a single folder.
// 2. Apply multiple filters on a single imap or pop3 folder.
// 3. Apply a single filter on multiple imap or pop3 folders in the same account.
// 4. Apply multiple filters on multiple imap or pop3 folders in the same account.
// This will be called from the front end js code in the case of the apply filters to folder menu code,
// and from the filter dialog js code with the run filter now command.


// this class holds the list of filters and folders, and applies them in turn, first iterating
// over all the filters on one folder, and then advancing to the next folder and repeating.
// For each filter,we take the filter criteria and create a search term list. Then, we execute the search.
// We are a search listener so that we can build up the list of search hits.
// Then, when the search is done, we will apply the filter action(s) en-masse, so, for example, if the action is a move,
// we calls one method to move all the messages to the destination folder. Or, mark all the messages read.
// In the case of imap operations, or imap/local  moves, the action will be asynchronous, so we'll need to be a url listener
// as well, and kick off the next filter when the action completes.
class nsMsgFilterAfterTheFact : public nsIUrlListener, public nsIMsgSearchNotify, public nsIMsgCopyServiceListener
{
public:
  nsMsgFilterAfterTheFact(nsIMsgWindow *aMsgWindow, nsIMsgFilterList *aFilterList, nsIArray *aFolderList);
  virtual ~nsMsgFilterAfterTheFact();
  NS_DECL_ISUPPORTS
  NS_DECL_NSIURLLISTENER
  NS_DECL_NSIMSGSEARCHNOTIFY
  NS_DECL_NSIMSGCOPYSERVICELISTENER

  nsresult  AdvanceToNextFolder();  // kicks off the process
protected:
  virtual   nsresult  RunNextFilter();
  nsresult  ApplyFilter(bool *aApplyMore = nullptr);
  nsresult  OnEndExecution(nsresult executionStatus); // do what we have to do to cleanup.
  bool      ContinueExecutionPrompt();
  nsresult  DisplayConfirmationPrompt(nsIMsgWindow *msgWindow, const PRUnichar *confirmString, bool *confirmed);
  nsCOMPtr<nsIMsgWindow>      m_msgWindow;
  nsCOMPtr<nsIMsgFilterList>  m_filters;
  nsCOMPtr<nsIArray>          m_folders;
  nsCOMPtr<nsIMsgFolder>      m_curFolder;
  nsCOMPtr<nsIMsgDatabase>    m_curFolderDB;
  nsCOMPtr<nsIMsgFilter>      m_curFilter;
  uint32_t                    m_curFilterIndex;
  uint32_t                    m_curFolderIndex;
  uint32_t                    m_numFilters;
  uint32_t                    m_numFolders;
  nsTArray<nsMsgKey>          m_searchHits;
  nsCOMPtr<nsIMutableArray>   m_searchHitHdrs;
  nsCOMPtr<nsIMsgSearchSession> m_searchSession;
  uint32_t                    m_nextAction; // next filter action to perform
};

NS_IMPL_ISUPPORTS3(nsMsgFilterAfterTheFact, nsIUrlListener, nsIMsgSearchNotify, nsIMsgCopyServiceListener)

nsMsgFilterAfterTheFact::nsMsgFilterAfterTheFact(nsIMsgWindow *aMsgWindow, nsIMsgFilterList *aFilterList, nsIArray *aFolderList)
{
  m_curFilterIndex = m_curFolderIndex = m_nextAction = 0;
  m_msgWindow = aMsgWindow;
  m_filters = aFilterList;
  m_folders = aFolderList;
  m_filters->GetFilterCount(&m_numFilters);
  m_folders->GetLength(&m_numFolders);

  NS_ADDREF(this); // we own ourselves, and will release ourselves when execution is done.

  m_searchHitHdrs = do_CreateInstance(NS_ARRAY_CONTRACTID);
}

nsMsgFilterAfterTheFact::~nsMsgFilterAfterTheFact()
{
}

// do what we have to do to cleanup.
nsresult nsMsgFilterAfterTheFact::OnEndExecution(nsresult executionStatus)
{
  if (m_searchSession)
    m_searchSession->UnregisterListener(this);

  if (m_filters)
    (void)m_filters->FlushLogIfNecessary();

  Release(); // release ourselves.
  return executionStatus;
}

nsresult nsMsgFilterAfterTheFact::RunNextFilter()
{
  if (m_curFilterIndex >= m_numFilters)
    return AdvanceToNextFolder();

  nsresult rv = m_filters->GetFilterAt(m_curFilterIndex++, getter_AddRefs(m_curFilter));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr <nsISupportsArray> searchTerms;
  rv = m_curFilter->GetSearchTerms(getter_AddRefs(searchTerms));
  NS_ENSURE_SUCCESS(rv, rv);
  if (m_searchSession)
    m_searchSession->UnregisterListener(this);
  m_searchSession = do_CreateInstance(NS_MSGSEARCHSESSION_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsMsgSearchScopeValue searchScope = nsMsgSearchScope::offlineMail;
  uint32_t termCount;
  searchTerms->Count(&termCount);
  for (uint32_t termIndex = 0; termIndex < termCount; termIndex++)
  {
    nsCOMPtr <nsIMsgSearchTerm> term;
    rv = searchTerms->QueryElementAt(termIndex, NS_GET_IID(nsIMsgSearchTerm), getter_AddRefs(term));
    NS_ENSURE_SUCCESS(rv, rv);
    rv = m_searchSession->AppendTerm(term);
    NS_ENSURE_SUCCESS(rv, rv);
  }
  m_searchSession->RegisterListener(this,
                                    nsIMsgSearchSession::allNotifications);

  rv = m_searchSession->AddScopeTerm(searchScope, m_curFolder);
  NS_ENSURE_SUCCESS(rv, rv);
  m_nextAction = 0;
  // it's possible that this error handling will need to be rearranged when mscott lands the UI for
  // doing filters based on sender in PAB, because we can't do that for IMAP. I believe appending the
  // search term will fail, or the Search itself will fail synchronously. In that case, we'll
  // have to ignore the filter, I believe. Ultimately, we'd like to re-work the search backend
  // so that it can do this.
  return m_searchSession->Search(m_msgWindow);
}

nsresult nsMsgFilterAfterTheFact::AdvanceToNextFolder()
{
  if (m_curFolderIndex >= m_numFolders)
    return OnEndExecution(NS_OK);

  nsresult rv = m_folders->QueryElementAt(m_curFolderIndex++, NS_GET_IID(nsIMsgFolder), getter_AddRefs(m_curFolder));
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr <nsIDBFolderInfo> dbFolderInfo;
  rv = m_curFolder->GetDBFolderInfoAndDB(getter_AddRefs(dbFolderInfo), getter_AddRefs(m_curFolderDB));
  if (rv == NS_MSG_ERROR_FOLDER_SUMMARY_OUT_OF_DATE)
  {
    nsCOMPtr<nsIMsgLocalMailFolder> localFolder = do_QueryInterface(m_curFolder, &rv);
    if (NS_SUCCEEDED(rv) && localFolder)
      return localFolder->ParseFolder(m_msgWindow, this);
  }
  return RunNextFilter();
}

NS_IMETHODIMP nsMsgFilterAfterTheFact::OnStartRunningUrl(nsIURI *aUrl)
{
  return NS_OK;
}

NS_IMETHODIMP nsMsgFilterAfterTheFact::OnStopRunningUrl(nsIURI *aUrl, nsresult aExitCode)
{
  bool continueExecution = NS_SUCCEEDED(aExitCode);
  if (!continueExecution)
    continueExecution = ContinueExecutionPrompt();

  return (continueExecution) ? RunNextFilter() : OnEndExecution(aExitCode);
}

NS_IMETHODIMP nsMsgFilterAfterTheFact::OnSearchHit(nsIMsgDBHdr *header, nsIMsgFolder *folder)
{
  NS_ENSURE_ARG_POINTER(header);

  nsMsgKey msgKey;
  header->GetMessageKey(&msgKey);
  m_searchHits.AppendElement(msgKey);
  m_searchHitHdrs->AppendElement(header, false);
  return NS_OK;
}

NS_IMETHODIMP nsMsgFilterAfterTheFact::OnSearchDone(nsresult status)
{
  bool continueExecution = NS_SUCCEEDED(status);
  if (!continueExecution)
    continueExecution = ContinueExecutionPrompt();

  if (continueExecution)
    return m_searchHits.IsEmpty() ? RunNextFilter() : ApplyFilter();

  return OnEndExecution(status);
}

NS_IMETHODIMP nsMsgFilterAfterTheFact::OnNewSearch()
{
  m_searchHits.Clear();
  m_searchHitHdrs->Clear();
  return NS_OK;
}

nsresult nsMsgFilterAfterTheFact::ApplyFilter(bool *aApplyMore)
{
  nsresult rv = NS_OK;
  bool applyMoreActions;
  if (!aApplyMore)
    aApplyMore = &applyMoreActions;
  *aApplyMore = true;
  if (m_curFilter && m_curFolder)
  {
    // we're going to log the filter actions before firing them because some actions are async
    bool loggingEnabled = false;
    if (m_filters)
      (void)m_filters->GetLoggingEnabled(&loggingEnabled);

    nsCOMPtr<nsIArray> actionList;

    rv = m_curFilter->GetSortedActionList(getter_AddRefs(actionList));
    NS_ENSURE_SUCCESS(rv, rv);

    uint32_t numActions;
    actionList->GetLength(&numActions);

    // We start from m_nextAction to allow us to continue applying actions
    // after the return from an async copy.
    for (uint32_t actionIndex = m_nextAction;
         actionIndex < numActions && *aApplyMore;
         actionIndex++)
    {
      nsCOMPtr<nsIMsgRuleAction> filterAction;
      rv = actionList->QueryElementAt(actionIndex, NS_GET_IID(nsIMsgRuleAction),
                                                   getter_AddRefs(filterAction));
      if (NS_FAILED(rv) || !filterAction)
        continue;

      nsMsgRuleActionType actionType;
      if (NS_FAILED(filterAction->GetType(&actionType)))
        continue;

      nsCString actionTargetFolderUri;
      if (actionType == nsMsgFilterAction::MoveToFolder ||
          actionType == nsMsgFilterAction::CopyToFolder)
      {
        rv = filterAction->GetTargetFolderUri(actionTargetFolderUri);
        if (NS_FAILED(rv) || actionTargetFolderUri.IsEmpty())
        {
          NS_ASSERTION(false, "actionTargetFolderUri is empty");
          continue;
        }
      }

      if (loggingEnabled)
      {
          for (uint32_t msgIndex = 0; msgIndex < m_searchHits.Length(); msgIndex++)
          {
            nsCOMPtr <nsIMsgDBHdr> msgHdr;
            m_searchHitHdrs->QueryElementAt(msgIndex, NS_GET_IID(nsIMsgDBHdr), getter_AddRefs(msgHdr));
            if (msgHdr)
              (void)m_curFilter->LogRuleHit(filterAction, msgHdr);
          }
      }
      // all actions that pass "this" as a listener in order to chain filter execution
      // when the action is finished need to return before reaching the bottom of this
      // routine, because we run the next filter at the end of this routine.
      switch (actionType)
      {
      case nsMsgFilterAction::Delete:
        // we can't pass ourselves in as a copy service listener because the copy service
        // listener won't get called in several situations (e.g., the delete model is imap delete)
        // and we rely on the listener getting called to continue the filter application.
        // This means we're going to end up firing off the delete, and then subsequently
        // issuing a search for the next filter, which will block until the delete finishes.
        m_curFolder->DeleteMessages(m_searchHitHdrs, m_msgWindow, false, false, nullptr, false /*allow Undo*/ );
        for (uint32_t i = 0; i < m_searchHits.Length(); i++)
          m_curFolder->OrProcessingFlags(m_searchHits[i], nsMsgProcessingFlags::FilterToMove);
        //if we are deleting then we couldn't care less about applying remaining filter actions
        *aApplyMore = false;
        break;
      case nsMsgFilterAction::MoveToFolder:
      case nsMsgFilterAction::CopyToFolder:
      {
        // if moving or copying to a different file, do it.
        nsCString uri;
        rv = m_curFolder->GetURI(uri);
        if (!actionTargetFolderUri.IsEmpty() &&
            !uri.Equals(actionTargetFolderUri))
        {
          nsCOMPtr<nsIRDFService> rdf = do_GetService("@mozilla.org/rdf/rdf-service;1",&rv);
          nsCOMPtr<nsIRDFResource> res;
          rv = rdf->GetResource(actionTargetFolderUri, getter_AddRefs(res));
          NS_ENSURE_SUCCESS(rv, rv);

          nsCOMPtr<nsIMsgFolder> destIFolder(do_QueryInterface(res, &rv));
          NS_ENSURE_SUCCESS(rv, rv);

          bool canFileMessages = true;
          nsCOMPtr<nsIMsgFolder> parentFolder;
          destIFolder->GetParent(getter_AddRefs(parentFolder));
          if (parentFolder)
            destIFolder->GetCanFileMessages(&canFileMessages);
          if (!parentFolder || !canFileMessages)
          {
            m_curFilter->SetEnabled(false);
            destIFolder->ThrowAlertMsg("filterDisabled",m_msgWindow);
            // we need to explicitly save the filter file.
            m_filters->SaveToDefaultFile();
            // In the case of applying multiple filters
            // we might want to remove the filter from the list, but
            // that's a bit evil since we really don't know that we own
            // the list. Disabling it doesn't do a lot of good since
            // we still apply disabled filters. Currently, we don't
            // have any clients that apply filters to multiple folders,
            // so this might be the edge case of an edge case.
            return RunNextFilter();
          }
          nsCOMPtr<nsIMsgCopyService> copyService = do_GetService(NS_MSGCOPYSERVICE_CONTRACTID, &rv);
          if (copyService)
          {
            rv = copyService->CopyMessages(m_curFolder, m_searchHitHdrs,
                destIFolder, actionType == nsMsgFilterAction::MoveToFolder,
                this, m_msgWindow, false);
            // We'll continue after a copy, but not after a move
            if (NS_SUCCEEDED(rv) && actionType == nsMsgFilterAction::CopyToFolder
                                 && actionIndex < numActions - 1)
              m_nextAction = actionIndex + 1;
            else
              m_nextAction = 0; // OnStopCopy tests this to move to next filter
            // Tell postplugin filters if we are moving the message.
            if (actionType == nsMsgFilterAction::MoveToFolder)
              for (uint32_t i = 0; i < m_searchHits.Length(); i++)
                m_curFolder->OrProcessingFlags(m_searchHits[i],
                                               nsMsgProcessingFlags::FilterToMove);
            return rv;
          }
        }
        //we have already moved the hdrs so we can't apply more actions
        if (actionType == nsMsgFilterAction::MoveToFolder)
          *aApplyMore = false;
      }
        break;
      case nsMsgFilterAction::MarkRead:
          // crud, no listener support here - we'll probably just need to go on and apply
          // the next filter, and, in the imap case, rely on multiple connection and url
          // queueing to stay out of trouble
        m_curFolder->MarkMessagesRead(m_searchHitHdrs, true);
        break;
      case nsMsgFilterAction::MarkUnread:
        m_curFolder->MarkMessagesRead(m_searchHitHdrs, false);
        break;
      case nsMsgFilterAction::MarkFlagged:
        m_curFolder->MarkMessagesFlagged(m_searchHitHdrs, true);
        break;
      case nsMsgFilterAction::KillThread:
      case nsMsgFilterAction::WatchThread:
        {
          for (uint32_t msgIndex = 0; msgIndex < m_searchHits.Length(); msgIndex++)
          {
            nsCOMPtr <nsIMsgDBHdr> msgHdr;
            m_searchHitHdrs->QueryElementAt(msgIndex, NS_GET_IID(nsIMsgDBHdr), getter_AddRefs(msgHdr));
            if (msgHdr)
            {
              nsCOMPtr <nsIMsgThread> msgThread;
              nsMsgKey threadKey;
              m_curFolderDB->GetThreadContainingMsgHdr(msgHdr, getter_AddRefs(msgThread));
              if (msgThread)
              {
                msgThread->GetThreadKey(&threadKey);
                if (actionType == nsMsgFilterAction::KillThread)
                  m_curFolderDB->MarkThreadIgnored(msgThread, threadKey, true, nullptr);
                else
                  m_curFolderDB->MarkThreadWatched(msgThread, threadKey, true, nullptr);
              }
            }
          }
        }
        break;
      case nsMsgFilterAction::KillSubthread:
        {
          for (uint32_t msgIndex = 0; msgIndex < m_searchHits.Length(); msgIndex++)
          {
            nsCOMPtr <nsIMsgDBHdr> msgHdr;
            m_searchHitHdrs->QueryElementAt(msgIndex, NS_GET_IID(nsIMsgDBHdr), getter_AddRefs(msgHdr));
            if (msgHdr)
              m_curFolderDB->MarkHeaderKilled(msgHdr, true, nullptr);
          }
        }
        break;
      case nsMsgFilterAction::ChangePriority:
          {
              nsMsgPriorityValue filterPriority;
              filterAction->GetPriority(&filterPriority);
              for (uint32_t msgIndex = 0; msgIndex < m_searchHits.Length(); msgIndex++)
              {
                nsCOMPtr <nsIMsgDBHdr> msgHdr;
                m_searchHitHdrs->QueryElementAt(msgIndex, NS_GET_IID(nsIMsgDBHdr), getter_AddRefs(msgHdr));
                if (msgHdr)
                  msgHdr->SetPriority(filterPriority);
              }
          }
        break;
      case nsMsgFilterAction::Label:
        {
            nsMsgLabelValue filterLabel;
            filterAction->GetLabel(&filterLabel);
            m_curFolder->SetLabelForMessages(m_searchHitHdrs, filterLabel);
        }
        break;
      case nsMsgFilterAction::AddTag:
        {
            nsCString keyword;
            filterAction->GetStrValue(keyword);
            m_curFolder->AddKeywordsToMessages(m_searchHitHdrs, keyword);
        }
        break;
      case nsMsgFilterAction::JunkScore:
      {
        nsAutoCString junkScoreStr;
        int32_t junkScore;
        filterAction->GetJunkScore(&junkScore);
        junkScoreStr.AppendInt(junkScore);
        m_curFolder->SetJunkScoreForMessages(m_searchHitHdrs, junkScoreStr);
        break;
      }
      case nsMsgFilterAction::Forward:
        {
          nsCString forwardTo;
          filterAction->GetStrValue(forwardTo);
          nsCOMPtr<nsIMsgIncomingServer> server;
          rv = m_curFolder->GetServer(getter_AddRefs(server));
          NS_ENSURE_SUCCESS(rv, rv);
          if (!forwardTo.IsEmpty())
          {
            nsCOMPtr<nsIMsgComposeService> compService = 
              do_GetService(NS_MSGCOMPOSESERVICE_CONTRACTID, &rv);
            NS_ENSURE_SUCCESS(rv, rv);
            for (uint32_t msgIndex = 0; msgIndex < m_searchHits.Length(); msgIndex++)
            {
              nsCOMPtr<nsIMsgDBHdr> msgHdr(do_QueryElementAt(m_searchHitHdrs,
                                           msgIndex));
              if (msgHdr)
                rv = compService->ForwardMessage(NS_ConvertASCIItoUTF16(forwardTo),
                                                 msgHdr, m_msgWindow, server,
                                                 nsIMsgComposeService::kForwardAsDefault);
            }
          }
        }
        break;
      case nsMsgFilterAction::Reply:
        {
          nsCString replyTemplateUri;
          filterAction->GetStrValue(replyTemplateUri);
          nsCOMPtr <nsIMsgIncomingServer> server;
          rv = m_curFolder->GetServer(getter_AddRefs(server));
          NS_ENSURE_SUCCESS(rv, rv);
          if (!replyTemplateUri.IsEmpty())
          {
            nsCOMPtr <nsIMsgComposeService> compService = do_GetService (NS_MSGCOMPOSESERVICE_CONTRACTID) ;
            if (compService)
            {
              for (uint32_t msgIndex = 0; msgIndex < m_searchHits.Length(); msgIndex++)
              {
                nsCOMPtr <nsIMsgDBHdr> msgHdr;
                m_searchHitHdrs->QueryElementAt(msgIndex, NS_GET_IID(nsIMsgDBHdr), getter_AddRefs(msgHdr));
                if (msgHdr)
                  rv = compService->ReplyWithTemplate(msgHdr, replyTemplateUri.get(), m_msgWindow, server);
              }
            }
          }
        }
        break;
      case nsMsgFilterAction::DeleteFromPop3Server:
        {
          nsCOMPtr <nsIMsgLocalMailFolder> localFolder = do_QueryInterface(m_curFolder);
          if (localFolder)
          {
            // This action ignores the deleteMailLeftOnServer preference
            localFolder->MarkMsgsOnPop3Server(m_searchHitHdrs, POP3_FORCE_DEL);

            nsCOMPtr<nsIMutableArray> partialMsgs;
            // Delete the partial headers. They're useless now
            // that the server copy is being deleted.
            for (uint32_t msgIndex = 0; msgIndex < m_searchHits.Length(); msgIndex++)
            {
              nsCOMPtr <nsIMsgDBHdr> msgHdr;
              m_searchHitHdrs->QueryElementAt(msgIndex, NS_GET_IID(nsIMsgDBHdr), getter_AddRefs(msgHdr));
              if (msgHdr)
              {
                uint32_t flags;
                msgHdr->GetFlags(&flags);
                if (flags & nsMsgMessageFlags::Partial)
                {
                  if (!partialMsgs)
                    partialMsgs = do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
                  NS_ENSURE_SUCCESS(rv, rv);
                  partialMsgs->AppendElement(msgHdr, false);
                }
              }
            }
            if (partialMsgs)
              m_curFolder->DeleteMessages(partialMsgs, m_msgWindow, true, false, nullptr, false);
          }
        }
        break;
      case nsMsgFilterAction::FetchBodyFromPop3Server:
        {
          nsCOMPtr <nsIMsgLocalMailFolder> localFolder = do_QueryInterface(m_curFolder);
          if (localFolder)
          {
            nsCOMPtr<nsIMutableArray> messages(do_CreateInstance(NS_ARRAY_CONTRACTID, &rv));
            NS_ENSURE_SUCCESS(rv, rv);
            for (uint32_t msgIndex = 0; msgIndex < m_searchHits.Length(); msgIndex++)
            {
              nsCOMPtr <nsIMsgDBHdr> msgHdr;
              m_searchHitHdrs->QueryElementAt(msgIndex, NS_GET_IID(nsIMsgDBHdr), getter_AddRefs(msgHdr));
              if (msgHdr)
              {
                uint32_t flags = 0;
                msgHdr->GetFlags(&flags);
                if (flags & nsMsgMessageFlags::Partial)
                  messages->AppendElement(msgHdr, false);
              }
            }
            uint32_t msgsToFetch;
            messages->GetLength(&msgsToFetch);
            if (msgsToFetch > 0)
              m_curFolder->DownloadMessagesForOffline(messages, m_msgWindow);
          }
        }
        break;

      case nsMsgFilterAction::StopExecution:
      {
        // don't apply any more filters
        *aApplyMore = false;
      }
      break;

      case nsMsgFilterAction::Custom:
      {
        nsMsgFilterTypeType filterType;
        m_curFilter->GetFilterType(&filterType);
        nsCOMPtr<nsIMsgFilterCustomAction> customAction;
        rv = filterAction->GetCustomAction(getter_AddRefs(customAction));
        NS_ENSURE_SUCCESS(rv, rv);

        nsAutoCString value;
        filterAction->GetStrValue(value);
        customAction->Apply(m_searchHitHdrs, value, this,
                            filterType, m_msgWindow);

        bool isAsync = false;
        customAction->GetIsAsync(&isAsync);
        if (isAsync)
          return NS_OK;
      }
      break;

      default:
        break;
      }
    }
  }

  if (*aApplyMore)
    rv = RunNextFilter();

  return rv;
}

NS_IMETHODIMP nsMsgFilterService::GetTempFilterList(nsIMsgFolder *aFolder, nsIMsgFilterList **aFilterList)
{
  NS_ENSURE_ARG_POINTER(aFilterList);

  nsMsgFilterList *filterList = new nsMsgFilterList;
  NS_ENSURE_TRUE(filterList, NS_ERROR_OUT_OF_MEMORY);
  NS_ADDREF(*aFilterList = filterList);
  (*aFilterList)->SetFolder(aFolder);
  filterList->m_temporaryList = true;
  return NS_OK;
}

NS_IMETHODIMP nsMsgFilterService::ApplyFiltersToFolders(nsIMsgFilterList *aFilterList, nsIArray *aFolders, nsIMsgWindow *aMsgWindow)
{
  NS_ENSURE_ARG_POINTER(aFilterList);
  NS_ENSURE_ARG_POINTER(aFolders);

  nsMsgFilterAfterTheFact *filterExecutor = new nsMsgFilterAfterTheFact(aMsgWindow, aFilterList, aFolders);
  if (filterExecutor)
    return filterExecutor->AdvanceToNextFolder();
  else
    return NS_ERROR_OUT_OF_MEMORY;
}

NS_IMETHODIMP nsMsgFilterService::AddCustomAction(nsIMsgFilterCustomAction *aAction)
{
  mCustomActions.AppendObject(aAction);
  return NS_OK;
}

NS_IMETHODIMP nsMsgFilterService::GetCustomActions(nsISimpleEnumerator** aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);

  return NS_NewArrayEnumerator(aResult, mCustomActions);
}

NS_IMETHODIMP
nsMsgFilterService::GetCustomAction(const nsACString & aId,
                                    nsIMsgFilterCustomAction** aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);

  for (int32_t i = 0; i < mCustomActions.Count(); i++)
  {
    nsAutoCString id;
    nsresult rv = mCustomActions[i]->GetId(id);
    if (NS_SUCCEEDED(rv) && aId.Equals(id))
    {
      NS_ADDREF(*aResult = mCustomActions[i]);
      return NS_OK;
    }
  }
  aResult = nullptr;
  return NS_ERROR_FAILURE;
}

NS_IMETHODIMP nsMsgFilterService::AddCustomTerm(nsIMsgSearchCustomTerm *aTerm)
{
  mCustomTerms.AppendObject(aTerm);
  return NS_OK;
}

NS_IMETHODIMP nsMsgFilterService::GetCustomTerms(nsISimpleEnumerator** aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);

  return NS_NewArrayEnumerator(aResult, mCustomTerms);
}

NS_IMETHODIMP
nsMsgFilterService::GetCustomTerm(const nsACString& aId,
                                    nsIMsgSearchCustomTerm** aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);

  for (int32_t i = 0; i < mCustomTerms.Count(); i++)
  {
    nsAutoCString id;
    nsresult rv = mCustomTerms[i]->GetId(id);
    if (NS_SUCCEEDED(rv) && aId.Equals(id))
    {
      NS_ADDREF(*aResult = mCustomTerms[i]);
      return NS_OK;
    }
  }
  aResult = nullptr;
  // we use a null result to indicate failure to find a term
  return NS_OK;
}

// nsMsgApplyFiltersToMessages overrides nsMsgFilterAfterTheFact in order to
// apply filters to a list of messages, rather than an entire folder
class nsMsgApplyFiltersToMessages : public nsMsgFilterAfterTheFact
{
public:
  nsMsgApplyFiltersToMessages(nsIMsgWindow *aMsgWindow, nsIMsgFilterList *aFilterList, nsIArray *aFolderList, nsIArray *aMsgHdrList, nsMsgFilterTypeType aFilterType);

protected:
  virtual   nsresult  RunNextFilter();

  nsCOMArray<nsIMsgDBHdr> m_msgHdrList;
  nsMsgFilterTypeType     m_filterType;
};

nsMsgApplyFiltersToMessages::nsMsgApplyFiltersToMessages(nsIMsgWindow *aMsgWindow, nsIMsgFilterList *aFilterList, nsIArray *aFolderList, nsIArray *aMsgHdrList, nsMsgFilterTypeType aFilterType)
: nsMsgFilterAfterTheFact(aMsgWindow, aFilterList, aFolderList),
  m_filterType(aFilterType)
{
  nsCOMPtr<nsISimpleEnumerator> msgEnumerator;
  if (NS_SUCCEEDED(aMsgHdrList->Enumerate(getter_AddRefs(msgEnumerator))))
  {
    uint32_t length;
    if (NS_SUCCEEDED(aMsgHdrList->GetLength(&length)))
      m_msgHdrList.SetCapacity(length);

    bool hasMore;
    while (NS_SUCCEEDED(msgEnumerator->HasMoreElements(&hasMore)) && hasMore)
    {
      nsCOMPtr<nsIMsgDBHdr> msgHdr;
      if (NS_SUCCEEDED(msgEnumerator->GetNext(getter_AddRefs(msgHdr))) && msgHdr)
        m_msgHdrList.AppendObject(msgHdr);
    }
  }
}

nsresult nsMsgApplyFiltersToMessages::RunNextFilter()
{
  while (m_curFilterIndex < m_numFilters)
  {
    nsMsgFilterTypeType filterType;
    bool isEnabled;
    nsresult rv = m_filters->GetFilterAt(m_curFilterIndex++, getter_AddRefs(m_curFilter));
    NS_ENSURE_SUCCESS(rv, rv);
    rv = m_curFilter->GetFilterType(&filterType);
    NS_ENSURE_SUCCESS(rv, rv);
    if (!(filterType & m_filterType))
      continue;
    rv = m_curFilter->GetEnabled(&isEnabled);
    NS_ENSURE_SUCCESS(rv, rv);
    if (!isEnabled)
      continue;

    nsCOMPtr<nsIMsgSearchScopeTerm> scope(new nsMsgSearchScopeTerm(nullptr, nsMsgSearchScope::offlineMail, m_curFolder));
    if (!scope)
      return NS_ERROR_OUT_OF_MEMORY;
    m_curFilter->SetScope(scope);
    OnNewSearch();

    for (int32_t i = 0; i < m_msgHdrList.Count(); i++)
    {
      nsIMsgDBHdr* msgHdr = m_msgHdrList[i];
      bool matched;

      rv = m_curFilter->MatchHdr(msgHdr, m_curFolder, m_curFolderDB, nullptr, 0, &matched);

      if (NS_SUCCEEDED(rv) && matched)
      {
        // In order to work with nsMsgFilterAfterTheFact::ApplyFilter we initialize
        // nsMsgFilterAfterTheFact's information with a search hit now for the message
        // that we're filtering.
        OnSearchHit(msgHdr, m_curFolder);
      }
    }
    m_curFilter->SetScope(nullptr);

    if (m_searchHits.Length() > 0)
    {
      bool applyMore = true;

      m_nextAction = 0;
      rv = ApplyFilter(&applyMore);
      NS_ENSURE_SUCCESS(rv, rv);
      if (applyMore)
      {
        // If there are more filters to apply, then ApplyFilter() would have
        // called RunNextFilter() itself, and so we should exit out afterwards
        return NS_OK;
      }

      // If we get here we're done applying filters for those messages that
      // matched, so remove them from the message header list
      for (uint32_t msgIndex = 0; msgIndex < m_searchHits.Length(); msgIndex++)
      {
        nsCOMPtr <nsIMsgDBHdr> msgHdr;
        m_searchHitHdrs->QueryElementAt(msgIndex, NS_GET_IID(nsIMsgDBHdr), getter_AddRefs(msgHdr));
        if (msgHdr)
          m_msgHdrList.RemoveObject(msgHdr);
      }

      if (!m_msgHdrList.Count())
        break;
    }
  }

  return AdvanceToNextFolder();
}

NS_IMETHODIMP nsMsgFilterService::ApplyFilters(nsMsgFilterTypeType aFilterType,
                                               nsIArray *aMsgHdrList,
                                               nsIMsgFolder *aFolder,
                                               nsIMsgWindow *aMsgWindow)
{
  NS_ENSURE_ARG_POINTER(aFolder);

  nsCOMPtr<nsIMsgFilterList>    filterList;
  nsresult rv = aFolder->GetFilterList(aMsgWindow, getter_AddRefs(filterList));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIMutableArray> folderList(do_CreateInstance(NS_ARRAY_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  folderList->AppendElement(aFolder, false);

  // Create our nsMsgApplyFiltersToMessages object which will be called when ApplyFiltersToHdr
  // finds one or more filters that hit.
  nsMsgApplyFiltersToMessages * filterExecutor = new nsMsgApplyFiltersToMessages(aMsgWindow, filterList, folderList, aMsgHdrList, aFilterType);

  if (filterExecutor)
    return filterExecutor->AdvanceToNextFolder();

  return NS_ERROR_OUT_OF_MEMORY;
}

/* void OnStartCopy (); */
NS_IMETHODIMP nsMsgFilterAfterTheFact::OnStartCopy()
{
  return NS_OK;
}

/* void OnProgress (in uint32_t aProgress, in uint32_t aProgressMax); */
NS_IMETHODIMP nsMsgFilterAfterTheFact::OnProgress(uint32_t aProgress, uint32_t aProgressMax)
{
  return NS_OK;
}

/* void SetMessageKey (in uint32_t aKey); */
NS_IMETHODIMP nsMsgFilterAfterTheFact::SetMessageKey(uint32_t /* aKey */)
{
  return NS_OK;
}

NS_IMETHODIMP nsMsgFilterAfterTheFact::GetMessageId(nsACString& messageId)
{
  return NS_OK;
}

/* void OnStopCopy (in nsresult aStatus); */
NS_IMETHODIMP nsMsgFilterAfterTheFact::OnStopCopy(nsresult aStatus)
{
  bool continueExecution = NS_SUCCEEDED(aStatus);
  if (!continueExecution)
    continueExecution = ContinueExecutionPrompt();
  if (!continueExecution)
    return OnEndExecution(aStatus);
  if (m_nextAction) // a non-zero m_nextAction means additional actions needed
    return ApplyFilter();
  return RunNextFilter();
}

bool nsMsgFilterAfterTheFact::ContinueExecutionPrompt()
{
  if (!m_curFilter)
    return false;
  nsCOMPtr<nsIStringBundle> bundle;
  nsCOMPtr<nsIStringBundleService> bundleService =
    mozilla::services::GetStringBundleService();
  if (!bundleService)
    return false;
  bundleService->CreateBundle("chrome://messenger/locale/filter.properties",
                              getter_AddRefs(bundle));
  if (!bundle)
    return false;
  nsString filterName;
  m_curFilter->GetFilterName(filterName);
  nsString formatString;
  nsString confirmText;
  const PRUnichar *formatStrings[] =
  {
    filterName.get()
  };
  nsresult rv = bundle->FormatStringFromName(NS_LITERAL_STRING("continueFilterExecution").get(),
                                             formatStrings, 1, getter_Copies(confirmText));
  if (NS_FAILED(rv))
    return false;
  bool returnVal = false;
  (void) DisplayConfirmationPrompt(m_msgWindow, confirmText.get(), &returnVal);
  return returnVal;
}

nsresult
nsMsgFilterAfterTheFact::DisplayConfirmationPrompt(nsIMsgWindow *msgWindow, const PRUnichar *confirmString, bool *confirmed)
{
  if (msgWindow)
  {
    nsCOMPtr <nsIDocShell> docShell;
    msgWindow->GetRootDocShell(getter_AddRefs(docShell));
    if (docShell)
    {
      nsCOMPtr<nsIPrompt> dialog(do_GetInterface(docShell));
      if (dialog && confirmString)
        dialog->Confirm(nullptr, confirmString, confirmed);
    }
  }
  return NS_OK;
}
