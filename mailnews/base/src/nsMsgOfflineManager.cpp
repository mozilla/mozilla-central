/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * The offline manager service - manages going online and offline, and synchronization
 */
#include "msgCore.h"
#include "netCore.h"
#include "nsMsgOfflineManager.h"
#include "nsIServiceManager.h"
#include "nsMsgBaseCID.h"
#include "nsIImapService.h"
#include "nsMsgImapCID.h"
#include "nsIMsgSendLater.h"
#include "nsIMsgAccountManager.h"
#include "nsMsgCompCID.h"
#include "nsIIOService.h"
#include "nsNetCID.h"
#include "nsMsgNewsCID.h"
#include "nsINntpService.h"
#include "nsIMsgStatusFeedback.h"
#include "nsServiceManagerUtils.h"
#include "mozilla/Services.h"
#include "nsIArray.h"
#include "nsArrayUtils.h"

static NS_DEFINE_CID(kMsgSendLaterCID, NS_MSGSENDLATER_CID);

NS_IMPL_ISUPPORTS5(nsMsgOfflineManager,
                              nsIMsgOfflineManager,
                              nsIMsgSendLaterListener,
                              nsIObserver,
                              nsISupportsWeakReference,
                              nsIUrlListener)

nsMsgOfflineManager::nsMsgOfflineManager() :
  m_inProgress (false),
  m_sendUnsentMessages(false),
  m_downloadNews(false),
  m_downloadMail(false),
  m_playbackOfflineImapOps(false),
  m_goOfflineWhenDone(false),
  m_curState(eNoState),
  m_curOperation(eNoOp)
{
}

nsMsgOfflineManager::~nsMsgOfflineManager()
{
}

/* attribute nsIMsgWindow window; */
NS_IMETHODIMP nsMsgOfflineManager::GetWindow(nsIMsgWindow * *aWindow)
{
  NS_ENSURE_ARG(aWindow);
  *aWindow = m_window;
  NS_IF_ADDREF(*aWindow);
  return NS_OK;
}
NS_IMETHODIMP nsMsgOfflineManager::SetWindow(nsIMsgWindow * aWindow)
{
  m_window = aWindow;
  if (m_window)
    m_window->GetStatusFeedback(getter_AddRefs(m_statusFeedback));
  else
    m_statusFeedback = nullptr;
  return NS_OK;
}

/* attribute boolean inProgress; */
NS_IMETHODIMP nsMsgOfflineManager::GetInProgress(bool *aInProgress)
{
  NS_ENSURE_ARG(aInProgress);
  *aInProgress = m_inProgress;
  return NS_OK;
}

NS_IMETHODIMP nsMsgOfflineManager::SetInProgress(bool aInProgress)
{
  m_inProgress = aInProgress;
  return NS_OK;
}

nsresult nsMsgOfflineManager::StopRunning(nsresult exitStatus)
{
  m_inProgress = false;
  return exitStatus;
}

nsresult nsMsgOfflineManager::AdvanceToNextState(nsresult exitStatus)
{
  // NS_BINDING_ABORTED is used for the user pressing stop, which
  // should cause us to abort the offline process. Other errors
  // should allow us to continue.
  if (exitStatus == NS_BINDING_ABORTED)
  {
    return StopRunning(exitStatus);
  }
  if (m_curOperation == eGoingOnline)
  {
    switch (m_curState)
    {
    case eNoState:

      m_curState = eSendingUnsent;
      if (m_sendUnsentMessages)
      {
        SendUnsentMessages();
      }
      else
        AdvanceToNextState(NS_OK);
      break;
    case eSendingUnsent:

      m_curState = eSynchronizingOfflineImapChanges;
      if (m_playbackOfflineImapOps)
        return SynchronizeOfflineImapChanges();
      else
        AdvanceToNextState(NS_OK); // recurse to next state.
      break;
    case eSynchronizingOfflineImapChanges:
      m_curState = eDone;
      return StopRunning(exitStatus);
      default:
        NS_ASSERTION(false, "unhandled current state when going online");
    }
  }
  else if (m_curOperation == eDownloadingForOffline)
  {
    switch (m_curState)
    {
      case eNoState:
        m_curState = eDownloadingNews;
        if (m_downloadNews)
          DownloadOfflineNewsgroups();
        else
          AdvanceToNextState(NS_OK);
        break;
      case eSendingUnsent:
        if (m_goOfflineWhenDone)
        {
          SetOnlineState(false);
        }
        break;
      case eDownloadingNews:
        m_curState = eDownloadingMail;
        if (m_downloadMail)
          DownloadMail();
        else
          AdvanceToNextState(NS_OK);
        break;
      case eDownloadingMail:
        m_curState = eSendingUnsent;
        if (m_sendUnsentMessages)
          SendUnsentMessages();
        else
          AdvanceToNextState(NS_OK);
        break;
      default:
        NS_ASSERTION(false, "unhandled current state when downloading for offline");
    }

  }
  return NS_OK;
}

nsresult nsMsgOfflineManager::SynchronizeOfflineImapChanges()
{
  nsresult rv = NS_OK;
	nsCOMPtr<nsIImapService> imapService = do_GetService(NS_IMAPSERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  return imapService->PlaybackAllOfflineOperations(m_window, this, getter_AddRefs(mOfflineImapSync));
}

nsresult nsMsgOfflineManager::SendUnsentMessages()
{
  nsresult rv;
  nsCOMPtr<nsIMsgSendLater> pMsgSendLater(do_GetService(kMsgSendLaterCID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  nsCOMPtr<nsIMsgAccountManager> accountManager = 
           do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  // now we have to iterate over the identities, finding the *unique* unsent messages folder
  // for each one, determine if they have unsent messages, and if so, add them to the list
  // of identities to send unsent messages from.
  // However, I think there's only ever one unsent messages folder at the moment,
  // so I think we'll go with that for now.
  nsCOMPtr<nsIArray> identities;

  if (NS_SUCCEEDED(rv) && accountManager)
  {
    rv = accountManager->GetAllIdentities(getter_AddRefs(identities));
    NS_ENSURE_SUCCESS(rv, rv);
  }
  nsCOMPtr <nsIMsgIdentity> identityToUse;
  uint32_t numIndentities;
  identities->GetLength(&numIndentities);
  for (uint32_t i = 0; i < numIndentities; i++)
  {
    nsCOMPtr<nsIMsgIdentity> thisIdentity(do_QueryElementAt(identities, i, &rv));
    if (NS_SUCCEEDED(rv) && thisIdentity)
    {
      nsCOMPtr <nsIMsgFolder> outboxFolder;
      pMsgSendLater->GetUnsentMessagesFolder(thisIdentity, getter_AddRefs(outboxFolder));
      if (outboxFolder)
      {
        int32_t numMessages;
        outboxFolder->GetTotalMessages(false, &numMessages);
        if (numMessages > 0)
        {
          identityToUse = thisIdentity;
          break;
        }
      }
    }
  }
  if (identityToUse) 
  { 
#ifdef MOZ_SUITE
    if (m_statusFeedback)
      pMsgSendLater->SetStatusFeedback(m_statusFeedback);
#endif

    pMsgSendLater->AddListener(this);
    rv = pMsgSendLater->SendUnsentMessages(identityToUse);
    ShowStatus("sendingUnsent");
    // if we succeeded, return - we'll run the next operation when the
    // send finishes. Otherwise, advance to the next state.
    if (NS_SUCCEEDED(rv))
      return rv;
  } 
  return AdvanceToNextState(rv);

}

#define MESSENGER_STRING_URL       "chrome://messenger/locale/messenger.properties"

nsresult nsMsgOfflineManager::ShowStatus(const char *statusMsgName)
{
  if (!mStringBundle)
  {
    nsCOMPtr<nsIStringBundleService> sBundleService = 
      mozilla::services::GetStringBundleService();
    NS_ENSURE_TRUE(sBundleService, NS_ERROR_UNEXPECTED);
    sBundleService->CreateBundle(MESSENGER_STRING_URL, getter_AddRefs(mStringBundle));
    return NS_OK;
  }

  nsString statusString;
  nsresult res = mStringBundle->GetStringFromName(NS_ConvertASCIItoUTF16(statusMsgName).get(),
						  getter_Copies(statusString));

  if (NS_SUCCEEDED(res) && m_statusFeedback)
    m_statusFeedback->ShowStatusString(statusString);

  return res;
}

nsresult nsMsgOfflineManager::DownloadOfflineNewsgroups()
{
	nsresult rv;
  ShowStatus("downloadingNewsgroups");
  nsCOMPtr<nsINntpService> nntpService(do_GetService(NS_NNTPSERVICE_CONTRACTID, &rv));
  if (NS_SUCCEEDED(rv) && nntpService)
    rv = nntpService->DownloadNewsgroupsForOffline(m_window, this);

  if (NS_FAILED(rv))
    return AdvanceToNextState(rv);
  return rv;
}

nsresult nsMsgOfflineManager::DownloadMail()
{
  nsresult rv = NS_OK;
  ShowStatus("downloadingMail");
	nsCOMPtr<nsIImapService> imapService = do_GetService(NS_IMAPSERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  return imapService->DownloadAllOffineImapFolders(m_window, this);
  // ### we should do get new mail on pop servers, and download imap messages for offline use.
}

/* void goOnline (in boolean sendUnsentMessages, in boolean playbackOfflineImapOperations, in nsIMsgWindow aMsgWindow); */
NS_IMETHODIMP nsMsgOfflineManager::GoOnline(bool sendUnsentMessages, bool playbackOfflineImapOperations, nsIMsgWindow *aMsgWindow)
{
  m_sendUnsentMessages = sendUnsentMessages;
  m_playbackOfflineImapOps = playbackOfflineImapOperations;
  m_curOperation = eGoingOnline;
  m_curState = eNoState;
  SetWindow(aMsgWindow);
  SetOnlineState(true);
  if (!m_sendUnsentMessages && !playbackOfflineImapOperations)
    return NS_OK;
  else
    AdvanceToNextState(NS_OK);
  return NS_OK;
}

/* void synchronizeForOffline (in boolean downloadNews, in boolean downloadMail, in boolean sendUnsentMessages, in boolean goOfflineWhenDone, in nsIMsgWindow aMsgWindow); */
NS_IMETHODIMP nsMsgOfflineManager::SynchronizeForOffline(bool downloadNews, bool downloadMail, bool sendUnsentMessages, bool goOfflineWhenDone, nsIMsgWindow *aMsgWindow)
{
  m_curOperation = eDownloadingForOffline;
  m_downloadNews = downloadNews;
  m_downloadMail = downloadMail;
  m_sendUnsentMessages = sendUnsentMessages;
  SetWindow(aMsgWindow);
  m_goOfflineWhenDone = goOfflineWhenDone;
  m_curState = eNoState;
  if (!downloadNews && !downloadMail && !sendUnsentMessages)
  {
    if (goOfflineWhenDone)
      return SetOnlineState(false);
  }
  else
    return AdvanceToNextState(NS_OK);
  return NS_OK;
}

nsresult nsMsgOfflineManager::SetOnlineState(bool online)
{
  nsCOMPtr<nsIIOService> netService =
    mozilla::services::GetIOService();
  NS_ENSURE_TRUE(netService, NS_ERROR_UNEXPECTED);
  return netService->SetOffline(!online);
}

  // nsIUrlListener methods

NS_IMETHODIMP
nsMsgOfflineManager::OnStartRunningUrl(nsIURI * aUrl)
{
    return NS_OK;
}

NS_IMETHODIMP
nsMsgOfflineManager::OnStopRunningUrl(nsIURI * aUrl, nsresult aExitCode)
{
  mOfflineImapSync = nullptr;

  AdvanceToNextState(aExitCode);
  return NS_OK;
}

NS_IMETHODIMP nsMsgOfflineManager::Observe(nsISupports *aSubject, const char *aTopic, const PRUnichar *someData)
{
  return NS_OK;
}

// nsIMsgSendLaterListener implementation 
NS_IMETHODIMP
nsMsgOfflineManager::OnStartSending(uint32_t aTotalMessageCount)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMsgOfflineManager::OnMessageStartSending(uint32_t aCurrentMessage,
                                           uint32_t aTotalMessageCount,
                                           nsIMsgDBHdr *aMessageHeader,
                                           nsIMsgIdentity *aIdentity)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMsgOfflineManager::OnMessageSendProgress(uint32_t aCurrentMessage,
                                           uint32_t aTotalMessageCount,
                                           uint32_t aMessageSendPercent,
                                           uint32_t aMessageCopyPercent)
{
  if (m_statusFeedback && aTotalMessageCount)
    return m_statusFeedback->ShowProgress((100 * aCurrentMessage) /
                                          aTotalMessageCount);

  return NS_OK;
}

NS_IMETHODIMP
nsMsgOfflineManager::OnMessageSendError(uint32_t aCurrentMessage,
                                        nsIMsgDBHdr *aMessageHeader,
                                        nsresult aStatus,
                                        const PRUnichar *aMsg)
{
  return NS_OK;
}

NS_IMETHODIMP
nsMsgOfflineManager::OnStopSending(nsresult aStatus,
                                   const PRUnichar *aMsg, uint32_t aTotalTried, 
                                   uint32_t aSuccessful)
{
#ifdef NS_DEBUG
  if (NS_SUCCEEDED(aStatus))
    printf("SendLaterListener::OnStopSending: Tried to send %d messages. %d successful.\n",
            aTotalTried, aSuccessful);
#endif
  return AdvanceToNextState(aStatus);
}
