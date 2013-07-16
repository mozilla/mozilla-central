/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "msgCore.h"

#include "nsIWebProgress.h"
#include "nsIXULBrowserWindow.h"
#include "nsMsgStatusFeedback.h"
#include "nsIDocument.h"
#include "nsIDOMElement.h"
#include "nsIDocShell.h"
#include "nsIDocShellTreeItem.h"
#include "nsIChannel.h"
#include "prinrval.h"
#include "nsIMsgMailNewsUrl.h"
#include "nsIMimeMiscStatus.h"
#include "nsIMsgWindow.h"
#include "nsMsgUtils.h"
#include "nsIMsgHdr.h"
#include "nsIMsgFolder.h"
#include "nsServiceManagerUtils.h"
#include "mozilla/Services.h"

#define MSGFEEDBACK_TIMER_INTERVAL 500

nsMsgStatusFeedback::nsMsgStatusFeedback() :
  m_lastPercent(0),
  m_lastProgressTime(0)
{
  nsCOMPtr<nsIStringBundleService> bundleService =
    mozilla::services::GetStringBundleService();

  if (bundleService)
    bundleService->CreateBundle("chrome://messenger/locale/messenger.properties",
                                getter_AddRefs(mBundle));

  m_msgLoadedAtom = MsgGetAtom("msgLoaded");
}

nsMsgStatusFeedback::~nsMsgStatusFeedback()
{
  mBundle = nullptr;
}

NS_IMPL_ISUPPORTS4(nsMsgStatusFeedback, nsIMsgStatusFeedback,
  nsIProgressEventSink, nsIWebProgressListener, nsISupportsWeakReference)

//////////////////////////////////////////////////////////////////////////////////
// nsMsgStatusFeedback::nsIWebProgressListener
//////////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP
nsMsgStatusFeedback::OnProgressChange(nsIWebProgress* aWebProgress,
                                      nsIRequest* aRequest,
                                      int32_t aCurSelfProgress,
                                      int32_t aMaxSelfProgress, 
                                      int32_t aCurTotalProgress,
                                      int32_t aMaxTotalProgress)
{
  int32_t percentage = 0;
  if (aMaxTotalProgress > 0)
  {
    percentage =  (aCurTotalProgress * 100) / aMaxTotalProgress;
    if (percentage)
      ShowProgress(percentage);
  }

   return NS_OK;
}
      
NS_IMETHODIMP
nsMsgStatusFeedback::OnStateChange(nsIWebProgress* aWebProgress,
                                   nsIRequest* aRequest,
                                   uint32_t aProgressStateFlags,
                                   nsresult aStatus)
{
  nsresult rv;

  NS_ENSURE_TRUE(mBundle, NS_ERROR_NULL_POINTER);
  if (aProgressStateFlags & STATE_IS_NETWORK)
  {
    if (aProgressStateFlags & STATE_START)
    {
      m_lastPercent = 0;
      StartMeteors();
      nsString loadingDocument;
      rv = mBundle->GetStringFromName(NS_LITERAL_STRING("documentLoading").get(),
                                      getter_Copies(loadingDocument));
      if (NS_SUCCEEDED(rv))
        ShowStatusString(loadingDocument);
    }
    else if (aProgressStateFlags & STATE_STOP)
    {
      // if we are loading message for display purposes, this STATE_STOP notification is 
      // the only notification we get when layout is actually done rendering the message. We need
      // to fire the appropriate msgHdrSink notification in this particular case.
      nsCOMPtr<nsIChannel> channel = do_QueryInterface(aRequest);
      if (channel) 
      {
        nsCOMPtr<nsIURI> uri; 
        channel->GetURI(getter_AddRefs(uri));
        nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl (do_QueryInterface(uri));
        if (mailnewsUrl)
        {
          // get the url type
          bool messageDisplayUrl;
          mailnewsUrl->IsUrlType(nsIMsgMailNewsUrl::eDisplay, &messageDisplayUrl);

          if (messageDisplayUrl)
          {              
            // get the header sink
            nsCOMPtr<nsIMsgWindow> msgWindow;
            mailnewsUrl->GetMsgWindow(getter_AddRefs(msgWindow));
            if (msgWindow)
            {
              nsCOMPtr<nsIMsgHeaderSink> hdrSink;
              msgWindow->GetMsgHeaderSink(getter_AddRefs(hdrSink));
              if (hdrSink)
                hdrSink->OnEndMsgDownload(mailnewsUrl);
            }
            // get the folder and notify that the msg has been loaded. We're 
            // using NotifyPropertyFlagChanged. To be completely consistent,
            // we'd send a similar notification that the old message was
            // unloaded.
            nsCOMPtr <nsIMsgDBHdr> msgHdr;
            nsCOMPtr <nsIMsgFolder> msgFolder;
            mailnewsUrl->GetFolder(getter_AddRefs(msgFolder));
            nsCOMPtr <nsIMsgMessageUrl> msgUrl = do_QueryInterface(mailnewsUrl);
            if (msgUrl)
            {
              // not sending this notification is not a fatal error...
              (void) msgUrl->GetMessageHeader(getter_AddRefs(msgHdr));
              if (msgFolder && msgHdr)
                msgFolder->NotifyPropertyFlagChanged(msgHdr, m_msgLoadedAtom, 0, 1);
            }
          }
        }
      }
      StopMeteors();
      nsString documentDone;
      rv = mBundle->GetStringFromName(NS_LITERAL_STRING("documentDone").get(),
                                      getter_Copies(documentDone));
      if (NS_SUCCEEDED(rv))
        ShowStatusString(documentDone);
    }
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgStatusFeedback::OnLocationChange(nsIWebProgress* aWebProgress,
                                                    nsIRequest* aRequest,
                                                    nsIURI* aLocation,
                                                    uint32_t aFlags)
{
   return NS_OK;
}

NS_IMETHODIMP 
nsMsgStatusFeedback::OnStatusChange(nsIWebProgress* aWebProgress,
                                    nsIRequest* aRequest,
                                    nsresult aStatus,
                                    const PRUnichar* aMessage)
{
    return NS_OK;
}


NS_IMETHODIMP 
nsMsgStatusFeedback::OnSecurityChange(nsIWebProgress *aWebProgress, 
                                    nsIRequest *aRequest, 
                                    uint32_t state)
{
    return NS_OK;
}


NS_IMETHODIMP
nsMsgStatusFeedback::ShowStatusString(const nsAString& aStatus)
{
  nsCOMPtr<nsIMsgStatusFeedback> jsStatusFeedback(do_QueryReferent(mJSStatusFeedbackWeak));
  if (jsStatusFeedback)
    jsStatusFeedback->ShowStatusString(aStatus);
  return NS_OK;
}

NS_IMETHODIMP
nsMsgStatusFeedback::SetStatusString(const nsAString& aStatus)
{
  nsCOMPtr<nsIMsgStatusFeedback> jsStatusFeedback(do_QueryReferent(mJSStatusFeedbackWeak));
  if (jsStatusFeedback)
    jsStatusFeedback->SetStatusString(aStatus);
  return NS_OK;
}

NS_IMETHODIMP
nsMsgStatusFeedback::ShowProgress(int32_t aPercentage)
{
  // if the percentage hasn't changed...OR if we are going from 0 to 100% in one step
  // then don't bother....just fall out....
  if (aPercentage == m_lastPercent || (m_lastPercent == 0 && aPercentage >= 100))
    return NS_OK;
  
  m_lastPercent = aPercentage;

  int64_t nowMS = 0;
  if (aPercentage < 100)	// always need to do 100%
  {
    nowMS = PR_IntervalToMilliseconds(PR_IntervalNow());
    if (nowMS < m_lastProgressTime + 250)
      return NS_OK;
  }

  m_lastProgressTime = nowMS;
  nsCOMPtr<nsIMsgStatusFeedback> jsStatusFeedback(do_QueryReferent(mJSStatusFeedbackWeak));
  if (jsStatusFeedback)
    jsStatusFeedback->ShowProgress(aPercentage);
  return NS_OK;
}

NS_IMETHODIMP
nsMsgStatusFeedback::StartMeteors()
{
  nsCOMPtr<nsIMsgStatusFeedback> jsStatusFeedback(do_QueryReferent(mJSStatusFeedbackWeak));
  if (jsStatusFeedback)
    jsStatusFeedback->StartMeteors();
  return NS_OK;
}

NS_IMETHODIMP
nsMsgStatusFeedback::StopMeteors()
{
  nsCOMPtr<nsIMsgStatusFeedback> jsStatusFeedback(do_QueryReferent(mJSStatusFeedbackWeak));
  if (jsStatusFeedback)
    jsStatusFeedback->StopMeteors();
  return NS_OK;
}

NS_IMETHODIMP nsMsgStatusFeedback::SetWrappedStatusFeedback(nsIMsgStatusFeedback * aJSStatusFeedback)
{
  NS_ENSURE_ARG_POINTER(aJSStatusFeedback);
  mJSStatusFeedbackWeak = do_GetWeakReference(aJSStatusFeedback);
  return NS_OK;
}

NS_IMETHODIMP nsMsgStatusFeedback::OnProgress(nsIRequest *request, nsISupports* ctxt, 
                                          uint64_t aProgress, uint64_t aProgressMax)
{
  // XXX: What should the nsIWebProgress be?
  // XXX: this truncates 64-bit to 32-bit
  return OnProgressChange(nullptr, request, int32_t(aProgress), int32_t(aProgressMax), 
                          int32_t(aProgress) /* current total progress */, int32_t(aProgressMax) /* max total progress */);
}

NS_IMETHODIMP nsMsgStatusFeedback::OnStatus(nsIRequest *request, nsISupports* ctxt, 
                                            nsresult aStatus, const PRUnichar* aStatusArg)
{
  nsresult rv;
  nsCOMPtr<nsIStringBundleService> sbs =
    mozilla::services::GetStringBundleService();
  NS_ENSURE_TRUE(sbs, NS_ERROR_UNEXPECTED);
  nsString str;
  rv = sbs->FormatStatusMessage(aStatus, aStatusArg, getter_Copies(str));
  NS_ENSURE_SUCCESS(rv, rv);
  return ShowStatusString(str);
}
