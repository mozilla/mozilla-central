/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
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
 * Portions created by the Initial Developer are Copyright (C) 1999
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Pierre Phaneuf <pp@ludusdesign.com>
 *   Seth Spitzer <sspitzer@netscape.com>
 *   Karsten Düsterloh <mnyromyr@tprac.de>
 *   Geoffrey C. Wenger <gwenger@qualcomm.com>
 *   Jeff Beckley <beckley@qualcomm.com>
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

NS_IMPL_ISUPPORTS1(nsMsgFilterService, nsIMsgFilterService)

nsMsgFilterService::nsMsgFilterService()
{
}

nsMsgFilterService::~nsMsgFilterService()
{
}

NS_IMETHODIMP nsMsgFilterService::OpenFilterList(nsILocalFile *aFilterFile, nsIMsgFolder *rootFolder, nsIMsgWindow *aMsgWindow, nsIMsgFilterList **resultFilterList)
{
  nsresult rv = NS_OK;
        PRBool exists;
        aFilterFile->Exists(&exists);
        if (!exists)
        {
          rv = aFilterFile->Create(nsIFile::NORMAL_FILE_TYPE, 0644);
          NS_ENSURE_SUCCESS(rv, rv);
        }

  nsCOMPtr <nsIInputStream> fileStream;
        rv = NS_NewLocalFileInputStream(getter_AddRefs(fileStream), aFilterFile);
        NS_ENSURE_SUCCESS(rv, rv);

  if (!fileStream)
    return NS_ERROR_OUT_OF_MEMORY;

  nsMsgFilterList *filterList = new nsMsgFilterList();
  if (!filterList)
    return NS_ERROR_OUT_OF_MEMORY;
  NS_ADDREF(filterList);
    filterList->SetFolder(rootFolder);

    // temporarily tell the filter where it's file path is
    filterList->SetDefaultFile(aFilterFile);

    PRInt64 size;
    rv = aFilterFile->GetFileSize(&size);
  if (NS_SUCCEEDED(rv) && size > 0)
    rv = filterList->LoadTextFilters(fileStream);
  fileStream->Close();
  fileStream =nsnull;
  if (NS_SUCCEEDED(rv))
  {
    *resultFilterList = filterList;
        PRInt16 version;
        filterList->GetVersion(&version);
    if (version != kFileVersion)
    {

      SaveFilterList(filterList, aFilterFile);
    }
  }
  else
  {
    NS_RELEASE(filterList);
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
    else if(rv == NS_MSG_INVALID_CUSTOM_HEADER && aMsgWindow)
      ThrowAlertMsg("invalidCustomHeader", aMsgWindow);
  }
  return rv;
}

NS_IMETHODIMP nsMsgFilterService::CloseFilterList(nsIMsgFilterList *filterList)
{
  //NS_ASSERTION(PR_FALSE,"CloseFilterList doesn't do anything yet");
  return NS_OK;
}

/* save without deleting */
NS_IMETHODIMP  nsMsgFilterService::SaveFilterList(nsIMsgFilterList *filterList, nsILocalFile *filterFile)
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

nsresult nsMsgFilterService::BackUpFilterFile(nsILocalFile *aFilterFile, nsIMsgWindow *aMsgWindow)
{
  nsresult rv;
  AlertBackingUpFilterFile(aMsgWindow);

  nsCOMPtr<nsIFile> localParentDir;
  rv = aFilterFile->GetParent(getter_AddRefs(localParentDir));
  NS_ENSURE_SUCCESS(rv,rv);

  //if back-up file exists delete the back up file otherwise copy fails.
  nsCOMPtr <nsIFile> backupFile;
  rv = localParentDir->Clone(getter_AddRefs(backupFile));
  NS_ENSURE_SUCCESS(rv,rv);
  backupFile->AppendNative(NS_LITERAL_CSTRING("rulesbackup.dat"));
  PRBool exists;
  backupFile->Exists(&exists);
  if (exists)
    backupFile->Remove(PR_FALSE);

  return aFilterFile->CopyToNative(localParentDir, NS_LITERAL_CSTRING("rulesbackup.dat"));
}

nsresult nsMsgFilterService::AlertBackingUpFilterFile(nsIMsgWindow *aMsgWindow)
{
  return ThrowAlertMsg("filterListBackUpMsg", aMsgWindow);
}

nsresult //Do not use this routine if you have to call it very often because it creates a new bundle each time
nsMsgFilterService::GetStringFromBundle(const char *aMsgName, PRUnichar **aResult)
{
  nsresult rv=NS_OK;
  NS_ENSURE_ARG_POINTER(aResult);
  nsCOMPtr <nsIStringBundle> bundle;
  rv = GetFilterStringBundle(getter_AddRefs(bundle));
  if (NS_SUCCEEDED(rv) && bundle)
    rv=bundle->GetStringFromName(NS_ConvertASCIItoUTF16(aMsgName).get(), aResult);
  return rv;

}

nsresult
nsMsgFilterService::GetFilterStringBundle(nsIStringBundle **aBundle)
{
  nsresult rv=NS_OK;
  NS_ENSURE_ARG_POINTER(aBundle);
  nsCOMPtr<nsIStringBundleService> bundleService =
         do_GetService(NS_STRINGBUNDLE_CONTRACTID, &rv);
  nsCOMPtr<nsIStringBundle> bundle;
  if (bundleService && NS_SUCCEEDED(rv))
    bundleService->CreateBundle("chrome://messenger/locale/filter.properties",
                                 getter_AddRefs(bundle));
  NS_IF_ADDREF(*aBundle = bundle);
  return rv;
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
        dialog->Alert(nsnull, alertString.get());
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
  nsMsgFilterAfterTheFact(nsIMsgWindow *aMsgWindow, nsIMsgFilterList *aFilterList, nsISupportsArray *aFolderList);
  virtual ~nsMsgFilterAfterTheFact();
  NS_DECL_ISUPPORTS
  NS_DECL_NSIURLLISTENER
  NS_DECL_NSIMSGSEARCHNOTIFY
  NS_DECL_NSIMSGCOPYSERVICELISTENER

  nsresult  AdvanceToNextFolder();  // kicks off the process
protected:
  virtual   nsresult  RunNextFilter();
  nsresult  ApplyFilter(PRBool *aApplyMore = nsnull);
  nsresult  OnEndExecution(nsresult executionStatus); // do what we have to do to cleanup.
  PRBool    ContinueExecutionPrompt();
  nsresult  DisplayConfirmationPrompt(nsIMsgWindow *msgWindow, const PRUnichar *confirmString, PRBool *confirmed);
  nsCOMPtr <nsIMsgWindow>     m_msgWindow;
  nsCOMPtr <nsIMsgFilterList> m_filters;
  nsCOMPtr <nsISupportsArray> m_folders;
  nsCOMPtr <nsIMsgFolder>     m_curFolder;
  nsCOMPtr <nsIMsgDatabase>   m_curFolderDB;
  nsCOMPtr <nsIMsgFilter>     m_curFilter;
  PRUint32                    m_curFilterIndex;
  PRUint32                    m_curFolderIndex;
  PRUint32                    m_numFilters;
  PRUint32                    m_numFolders;
  nsTArray<nsMsgKey>          m_searchHits;
  nsCOMPtr<nsIMutableArray>   m_searchHitHdrs;
  nsCOMPtr <nsIMsgSearchSession> m_searchSession;
  PRUint32                    m_nextAction; // next filter action to perform
};

NS_IMPL_ISUPPORTS3(nsMsgFilterAfterTheFact, nsIUrlListener, nsIMsgSearchNotify, nsIMsgCopyServiceListener)

nsMsgFilterAfterTheFact::nsMsgFilterAfterTheFact(nsIMsgWindow *aMsgWindow, nsIMsgFilterList *aFilterList, nsISupportsArray *aFolderList)
{
  m_curFilterIndex = m_curFolderIndex = m_nextAction = 0;
  m_msgWindow = aMsgWindow;
  m_filters = aFilterList;
  m_folders = aFolderList;
  m_filters->GetFilterCount(&m_numFilters);
  m_folders->Count(&m_numFolders);

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
  nsresult rv;
  if (m_curFilterIndex >= m_numFilters)
    return AdvanceToNextFolder();

  rv = m_filters->GetFilterAt(m_curFilterIndex++, getter_AddRefs(m_curFilter));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr <nsISupportsArray> searchTerms;
  rv = m_curFilter->GetSearchTerms(getter_AddRefs(searchTerms));
  NS_ENSURE_SUCCESS(rv, rv);
  if (m_searchSession)
    m_searchSession->UnregisterListener(this);
  m_searchSession = do_CreateInstance(NS_MSGSEARCHSESSION_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsMsgSearchScopeValue searchScope = nsMsgSearchScope::offlineMail;
  PRUint32 termCount;
  searchTerms->Count(&termCount);
  for (PRUint32 termIndex = 0; termIndex < termCount; termIndex++)
  {
    nsCOMPtr <nsIMsgSearchTerm> term;
    rv = searchTerms->QueryElementAt(termIndex, NS_GET_IID(nsIMsgSearchTerm), getter_AddRefs(term));
    NS_ENSURE_SUCCESS(rv, rv);
    rv = m_searchSession->AppendTerm(term);
    NS_ENSURE_SUCCESS(rv, rv);
  }
  m_searchSession->RegisterListener(this);

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
  PRBool continueExecution = NS_SUCCEEDED(aExitCode);
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
  m_searchHitHdrs->AppendElement(header, PR_FALSE);
  return NS_OK;
}

NS_IMETHODIMP nsMsgFilterAfterTheFact::OnSearchDone(nsresult status)
{
  nsresult rv = status;
  PRBool continueExecution = NS_SUCCEEDED(status);
  if (!continueExecution)
    continueExecution = ContinueExecutionPrompt();

  if (continueExecution)
    return m_searchHits.IsEmpty() ? RunNextFilter() : ApplyFilter();
  else
    return OnEndExecution(rv);
}

NS_IMETHODIMP nsMsgFilterAfterTheFact::OnNewSearch()
{
  m_searchHits.Clear();
  m_searchHitHdrs->Clear();
  return NS_OK;
}

nsresult nsMsgFilterAfterTheFact::ApplyFilter(PRBool *aApplyMore)
{
  nsresult rv = NS_OK;
  PRBool applyMoreActions;
  if (!aApplyMore)
    aApplyMore = &applyMoreActions;
  *aApplyMore = PR_TRUE;
  if (m_curFilter && m_curFolder)
  {
    // we're going to log the filter actions before firing them because some actions are async
    PRBool loggingEnabled = PR_FALSE;
    if (m_filters)
      (void)m_filters->GetLoggingEnabled(&loggingEnabled);

    nsCOMPtr<nsISupportsArray> actionList;
    rv = NS_NewISupportsArray(getter_AddRefs(actionList));
    NS_ENSURE_SUCCESS(rv, rv);
    rv = m_curFilter->GetSortedActionList(actionList);
    NS_ENSURE_SUCCESS(rv, rv);
    PRUint32 numActions;
    actionList->Count(&numActions);

    // We start from m_nextAction to allow us to continue applying actions
    // after the return from an async copy.
    for (PRUint32 actionIndex = m_nextAction;
         actionIndex < numActions && *aApplyMore;
         actionIndex++)
    {
      nsCOMPtr<nsIMsgRuleAction> filterAction;
      actionList->QueryElementAt(actionIndex, NS_GET_IID(nsIMsgRuleAction), (void **)getter_AddRefs(filterAction));
      nsMsgRuleActionType actionType;
      if (filterAction)
        filterAction->GetType(&actionType);
      else
        continue;

      nsCString actionTargetFolderUri;
      if (actionType == nsMsgFilterAction::MoveToFolder ||
          actionType == nsMsgFilterAction::CopyToFolder)
      {
        filterAction->GetTargetFolderUri(actionTargetFolderUri);
        if (actionTargetFolderUri.IsEmpty())
        {
          NS_ASSERTION(PR_FALSE, "actionTargetFolderUri is empty");
          continue;
        }
      }

      if (loggingEnabled)
      {
          for (PRUint32 msgIndex = 0; msgIndex < m_searchHits.Length(); msgIndex++)
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
        m_curFolder->DeleteMessages(m_searchHitHdrs, m_msgWindow, PR_FALSE, PR_FALSE, nsnull, PR_FALSE /*allow Undo*/ );
        for (PRUint32 i = 0; i < m_searchHits.Length(); i++)
          m_curFolder->OrProcessingFlags(m_searchHits[i], nsMsgProcessingFlags::FilterToMove);
        //if we are deleting then we couldn't care less about applying remaining filter actions
        *aApplyMore = PR_FALSE;
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

          PRBool canFileMessages = PR_TRUE;
          nsCOMPtr<nsIMsgFolder> parentFolder;
          destIFolder->GetParent(getter_AddRefs(parentFolder));
          if (parentFolder)
            destIFolder->GetCanFileMessages(&canFileMessages);
          if (!parentFolder || !canFileMessages)
          {
            m_curFilter->SetEnabled(PR_FALSE);
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
                this, m_msgWindow, PR_FALSE);
            // We'll continue after a copy, but not after a move
            if (NS_SUCCEEDED(rv) && actionType == nsMsgFilterAction::CopyToFolder
                                 && actionIndex < numActions - 1)
              m_nextAction = actionIndex + 1;
            else
              m_nextAction = 0; // OnStopCopy tests this to move to next filter
            // Tell postplugin filters if we are moving the message.
            if (actionType == nsMsgFilterAction::MoveToFolder)
              for (PRUint32 i = 0; i < m_searchHits.Length(); i++)
                m_curFolder->OrProcessingFlags(m_searchHits[i],
                                               nsMsgProcessingFlags::FilterToMove);
            return rv;
          }
        }
        //we have already moved the hdrs so we can't apply more actions
        if (actionType == nsMsgFilterAction::MoveToFolder)
          *aApplyMore = PR_FALSE;
      }

        break;
      case nsMsgFilterAction::MarkRead:
          // crud, no listener support here - we'll probably just need to go on and apply
          // the next filter, and, in the imap case, rely on multiple connection and url
          // queueing to stay out of trouble
          m_curFolder->MarkMessagesRead(m_searchHitHdrs, PR_TRUE);
        break;
      case nsMsgFilterAction::MarkFlagged:
        m_curFolder->MarkMessagesFlagged(m_searchHitHdrs, PR_TRUE);
        break;
      case nsMsgFilterAction::KillThread:
      case nsMsgFilterAction::WatchThread:
        {
          for (PRUint32 msgIndex = 0; msgIndex < m_searchHits.Length(); msgIndex++)
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
                  m_curFolderDB->MarkThreadIgnored(msgThread, threadKey, PR_TRUE, nsnull);
                else
                  m_curFolderDB->MarkThreadWatched(msgThread, threadKey, PR_TRUE, nsnull);
              }
            }
          }
        }
        break;
      case nsMsgFilterAction::KillSubthread:
        {
          for (PRUint32 msgIndex = 0; msgIndex < m_searchHits.Length(); msgIndex++)
          {
            nsCOMPtr <nsIMsgDBHdr> msgHdr;
            m_searchHitHdrs->QueryElementAt(msgIndex, NS_GET_IID(nsIMsgDBHdr), getter_AddRefs(msgHdr));
            if (msgHdr)
              m_curFolderDB->MarkHeaderKilled(msgHdr, PR_TRUE, nsnull);
          }
        }
        break;
      case nsMsgFilterAction::ChangePriority:
          {
              nsMsgPriorityValue filterPriority;
              filterAction->GetPriority(&filterPriority);
              for (PRUint32 msgIndex = 0; msgIndex < m_searchHits.Length(); msgIndex++)
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
        nsCAutoString junkScoreStr;
        PRInt32 junkScore;
        filterAction->GetJunkScore(&junkScore);
        junkScoreStr.AppendInt(junkScore);
        m_curFolder->SetJunkScoreForMessages(m_searchHitHdrs, junkScoreStr);
        break;
      }
      case nsMsgFilterAction::Forward:
        {
          nsCString forwardTo;
          filterAction->GetStrValue(forwardTo);
          nsCOMPtr <nsIMsgIncomingServer> server;
          rv = m_curFolder->GetServer(getter_AddRefs(server));
          NS_ENSURE_SUCCESS(rv, rv);
          if (!forwardTo.IsEmpty())
          {
            nsCOMPtr <nsIMsgComposeService> compService = do_GetService (NS_MSGCOMPOSESERVICE_CONTRACTID) ;
            if (compService)
            {
              for (PRUint32 msgIndex = 0; msgIndex < m_searchHits.Length(); msgIndex++)
              {
                nsCOMPtr <nsIMsgDBHdr> msgHdr;
                m_searchHitHdrs->QueryElementAt(msgIndex, NS_GET_IID(nsIMsgDBHdr), getter_AddRefs(msgHdr));
                if (msgHdr)
                {
                  rv = compService->ForwardMessage(NS_ConvertASCIItoUTF16(forwardTo), msgHdr, m_msgWindow, server);
                }
              }
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
              for (PRUint32 msgIndex = 0; msgIndex < m_searchHits.Length(); msgIndex++)
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
            for (PRUint32 msgIndex = 0; msgIndex < m_searchHits.Length(); msgIndex++)
            {
              nsCOMPtr <nsIMsgDBHdr> msgHdr;
              m_searchHitHdrs->QueryElementAt(msgIndex, NS_GET_IID(nsIMsgDBHdr), getter_AddRefs(msgHdr));
              if (msgHdr)
              {
                PRUint32 flags;
                msgHdr->GetFlags(&flags);
                if (flags & nsMsgMessageFlags::Partial)
                {
                  if (!partialMsgs)
                    partialMsgs = do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
                  NS_ENSURE_SUCCESS(rv, rv);
                  partialMsgs->AppendElement(msgHdr, PR_FALSE);
                }
              }
            }
            if (partialMsgs)
              m_curFolder->DeleteMessages(partialMsgs, m_msgWindow, PR_TRUE, PR_FALSE, nsnull, PR_FALSE);
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
            for (PRUint32 msgIndex = 0; msgIndex < m_searchHits.Length(); msgIndex++)
            {
              nsCOMPtr <nsIMsgDBHdr> msgHdr;
              m_searchHitHdrs->QueryElementAt(msgIndex, NS_GET_IID(nsIMsgDBHdr), getter_AddRefs(msgHdr));
              if (msgHdr)
              {
                PRUint32 flags = 0;
                msgHdr->GetFlags(&flags);
                if (flags & nsMsgMessageFlags::Partial)
                  messages->AppendElement(msgHdr, PR_FALSE);
              }
            }
            PRUint32 msgsToFetch;
            messages->GetLength(&msgsToFetch);
            if (msgsToFetch > 0)
              m_curFolder->DownloadMessagesForOffline(messages, m_msgWindow);
          }
        }
        break;

      case nsMsgFilterAction::StopExecution:
      {
        // don't apply any more filters
        *aApplyMore = PR_FALSE;
      }
      break;

      case nsMsgFilterAction::Custom:
      {
        nsMsgFilterTypeType filterType;
        m_curFilter->GetFilterType(&filterType);
        nsCOMPtr<nsIMsgFilterCustomAction> customAction;
        rv = filterAction->GetCustomAction(getter_AddRefs(customAction));
        NS_ENSURE_SUCCESS(rv, rv);

        nsCAutoString value;
        filterAction->GetStrValue(value);
        customAction->Apply(m_searchHitHdrs, value, this,
                            filterType, m_msgWindow);

        PRBool isAsync = PR_FALSE;
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
  filterList->m_temporaryList = PR_TRUE;
  return NS_OK;
}

NS_IMETHODIMP nsMsgFilterService::ApplyFiltersToFolders(nsIMsgFilterList *aFilterList, nsISupportsArray *aFolders, nsIMsgWindow *aMsgWindow)
{
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
  return NS_NewArrayEnumerator(aResult, mCustomActions);
}

NS_IMETHODIMP
nsMsgFilterService::GetCustomAction(const nsACString & aId,
                                    nsIMsgFilterCustomAction** aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  for (PRInt32 i = 0; i < mCustomActions.Count(); i++)
  {
    nsCAutoString id;
    nsresult rv = mCustomActions[i]->GetId(id);
    if (NS_SUCCEEDED(rv) && aId.Equals(id))
    {
      NS_ADDREF(*aResult = mCustomActions[i]);
      return NS_OK;
    }
  }
  aResult = nsnull;
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
  for (PRInt32 i = 0; i < mCustomTerms.Count(); i++)
  {
    nsCAutoString id;
    nsresult rv = mCustomTerms[i]->GetId(id);
    if (NS_SUCCEEDED(rv) && aId.Equals(id))
    {
      NS_ADDREF(*aResult = mCustomTerms[i]);
      return NS_OK;
    }
  }
  aResult = nsnull;
  // we use a null result to indicate failure to find a term
  return NS_OK;
}

// nsMsgApplyFiltersToMessages overrides nsMsgFilterAfterTheFact in order to
// apply filters to a list of messages, rather than an entire folder
class nsMsgApplyFiltersToMessages : public nsMsgFilterAfterTheFact
{
public:
  nsMsgApplyFiltersToMessages(nsIMsgWindow *aMsgWindow, nsIMsgFilterList *aFilterList, nsISupportsArray *aFolderList, nsIArray *aMsgHdrList, nsMsgFilterTypeType aFilterType);

protected:
  virtual   nsresult  RunNextFilter();

  nsCOMArray<nsIMsgDBHdr> m_msgHdrList;
  nsMsgFilterTypeType     m_filterType;
};

nsMsgApplyFiltersToMessages::nsMsgApplyFiltersToMessages(nsIMsgWindow *aMsgWindow, nsIMsgFilterList *aFilterList, nsISupportsArray *aFolderList, nsIArray *aMsgHdrList, nsMsgFilterTypeType aFilterType)
: nsMsgFilterAfterTheFact(aMsgWindow, aFilterList, aFolderList),
  m_filterType(aFilterType)
{
  nsCOMPtr<nsISimpleEnumerator> msgEnumerator;
  if (NS_SUCCEEDED(aMsgHdrList->Enumerate(getter_AddRefs(msgEnumerator))))
  {
    PRUint32 length;
    if (NS_SUCCEEDED(aMsgHdrList->GetLength(&length)))
      m_msgHdrList.SetCapacity(length);

    PRBool hasMore;
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
    PRBool isEnabled;
    nsresult rv;

    rv = m_filters->GetFilterAt(m_curFilterIndex++, getter_AddRefs(m_curFilter));
    NS_ENSURE_SUCCESS(rv, rv);
    rv = m_curFilter->GetFilterType(&filterType);
    NS_ENSURE_SUCCESS(rv, rv);
    if (!(filterType & m_filterType))
      continue;
    rv = m_curFilter->GetEnabled(&isEnabled);
    NS_ENSURE_SUCCESS(rv, rv);
    if (!isEnabled)
      continue;

    nsCOMPtr<nsIMsgSearchScopeTerm> scope(new nsMsgSearchScopeTerm(nsnull, nsMsgSearchScope::offlineMail, m_curFolder));
    if (!scope)
      return NS_ERROR_OUT_OF_MEMORY;
    m_curFilter->SetScope(scope);
    OnNewSearch();

    for (PRInt32 i = 0; i < m_msgHdrList.Count(); i++)
    {
      nsIMsgDBHdr* msgHdr = m_msgHdrList[i];
      PRBool matched;

      rv = m_curFilter->MatchHdr(msgHdr, m_curFolder, m_curFolderDB, nsnull, 0, &matched);

      if (NS_SUCCEEDED(rv) && matched)
      {
        // In order to work with nsMsgFilterAfterTheFact::ApplyFilter we initialize
        // nsMsgFilterAfterTheFact's information with a search hit now for the message
        // that we're filtering.
        OnSearchHit(msgHdr, m_curFolder);
      }
    }
    m_curFilter->SetScope(nsnull);

    if (m_searchHits.Length() > 0)
    {
      PRBool applyMore = PR_TRUE;

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
      for (PRUint32 msgIndex = 0; msgIndex < m_searchHits.Length(); msgIndex++)
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

  nsCOMPtr<nsISupportsArray>    folderList;
  rv = NS_NewISupportsArray( getter_AddRefs(folderList) );
  NS_ENSURE_SUCCESS(rv, rv);
  folderList->AppendElement(aFolder);

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

/* void OnProgress (in PRUint32 aProgress, in PRUint32 aProgressMax); */
NS_IMETHODIMP nsMsgFilterAfterTheFact::OnProgress(PRUint32 aProgress, PRUint32 aProgressMax)
{
  return NS_OK;
}

/* void SetMessageKey (in PRUint32 aKey); */
NS_IMETHODIMP nsMsgFilterAfterTheFact::SetMessageKey(PRUint32 /* aKey */)
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
  PRBool continueExecution = NS_SUCCEEDED(aStatus);
  if (!continueExecution)
    continueExecution = ContinueExecutionPrompt();
  if (!continueExecution)
    return OnEndExecution(aStatus);
  if (m_nextAction) // a non-zero m_nextAction means additional actions needed
    return ApplyFilter();
  return RunNextFilter();
}

PRBool nsMsgFilterAfterTheFact::ContinueExecutionPrompt()
{
  PRBool returnVal = PR_FALSE;
  nsresult rv;
  nsCOMPtr <nsIStringBundle> bundle;
  nsCOMPtr<nsIStringBundleService> bundleService = do_GetService(NS_STRINGBUNDLE_CONTRACTID, &rv);
  if (bundleService && NS_SUCCEEDED(rv))
    bundleService->CreateBundle("chrome://messenger/locale/filter.properties",
                                 getter_AddRefs(bundle));
  if (NS_SUCCEEDED(rv) && bundle)
  {
    nsString filterName;
    m_curFilter->GetFilterName(filterName);
    nsString formatString;
    nsString confirmText;
    const PRUnichar *formatStrings[] =
    {
      filterName.get()
    };
    rv = bundle->FormatStringFromName(NS_LITERAL_STRING("continueFilterExecution").get(),
                                      formatStrings, 1, getter_Copies(confirmText));
    if (NS_SUCCEEDED(rv))
    {
      rv = DisplayConfirmationPrompt(m_msgWindow, confirmText.get(), &returnVal);
    }
  }
  return returnVal;
}
nsresult
nsMsgFilterAfterTheFact::DisplayConfirmationPrompt(nsIMsgWindow *msgWindow, const PRUnichar *confirmString, PRBool *confirmed)
{
  nsresult rv=NS_OK;
  if (msgWindow)
  {
    nsCOMPtr <nsIDocShell> docShell;
    msgWindow->GetRootDocShell(getter_AddRefs(docShell));
    if (docShell)
    {
      nsCOMPtr<nsIPrompt> dialog(do_GetInterface(docShell));
      if (dialog && confirmString)
        dialog->Confirm(nsnull, confirmString, confirmed);
    }
  }
  return rv;
}
