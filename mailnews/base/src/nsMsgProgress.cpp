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
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jean-Francois Ducarroz <ducarroz@netscape.com>
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

#include "nsMsgProgress.h"

#include "nsIBaseWindow.h"
#include "nsISupportsArray.h"
#include "nsXPCOM.h"
#include "nsISupportsPrimitives.h"
#include "nsIComponentManager.h"
#include "nsNetError.h"
#include "nsInt64.h"
#include "nsIWindowWatcher.h"
#include "nsServiceManagerUtils.h"

NS_IMPL_THREADSAFE_ADDREF(nsMsgProgress)
NS_IMPL_THREADSAFE_RELEASE(nsMsgProgress)

NS_INTERFACE_MAP_BEGIN(nsMsgProgress)
  NS_INTERFACE_MAP_ENTRY_AMBIGUOUS(nsISupports, nsIMsgStatusFeedback)
  NS_INTERFACE_MAP_ENTRY(nsIMsgProgress)
  NS_INTERFACE_MAP_ENTRY(nsIMsgStatusFeedback)
  NS_INTERFACE_MAP_ENTRY(nsIWebProgressListener)
  NS_INTERFACE_MAP_ENTRY(nsIProgressEventSink)
  NS_INTERFACE_MAP_ENTRY(nsISupportsWeakReference)
NS_INTERFACE_MAP_END_THREADSAFE


nsMsgProgress::nsMsgProgress()
{
  m_closeProgress = PR_FALSE;
  m_processCanceled = PR_FALSE;
  m_pendingStateFlags = -1;
  m_pendingStateValue = 0;
}

nsMsgProgress::~nsMsgProgress()
{
  (void)ReleaseListeners();
}

NS_IMETHODIMP nsMsgProgress::OpenProgressDialog(nsIDOMWindowInternal *parent, 
                                                nsIMsgWindow *aMsgWindow, 
                                                const char *dialogURL, 
                                                PRBool inDisplayModal, 
                                                nsISupports *parameters)
{
  nsresult rv;
  
  if (aMsgWindow)
  {
    SetMsgWindow(aMsgWindow);
    aMsgWindow->SetStatusFeedback(this);
  }
  
  NS_ENSURE_TRUE(!m_dialog, NS_ERROR_ALREADY_INITIALIZED);
  NS_ENSURE_ARG_POINTER(dialogURL);
  NS_ENSURE_ARG_POINTER(parent);
  
  // Set up window.arguments[0]...
  nsCOMPtr<nsISupportsArray> array;
  rv = NS_NewISupportsArray(getter_AddRefs(array));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsISupportsInterfacePointer> ifptr =
    do_CreateInstance(NS_SUPPORTS_INTERFACE_POINTER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  
  ifptr->SetData(static_cast<nsIMsgProgress*>(this));
  ifptr->SetDataIID(&NS_GET_IID(nsIMsgProgress));
  
  array->AppendElement(ifptr);
  array->AppendElement(parameters);
  
  // Open the dialog.
  nsCOMPtr<nsIDOMWindow> newWindow;
  
  nsString chromeOptions(NS_LITERAL_STRING("chrome,titlebar,dependent"));
  if (inDisplayModal)
    chromeOptions.AppendLiteral(",modal");
  
  return parent->OpenDialog(NS_ConvertASCIItoUTF16(dialogURL),
                            NS_LITERAL_STRING("_blank"),
                            chromeOptions,
                            array, getter_AddRefs(newWindow));
}

/* void closeProgressDialog (in boolean forceClose); */
NS_IMETHODIMP nsMsgProgress::CloseProgressDialog(PRBool forceClose)
{
  m_closeProgress = PR_TRUE;
  return OnStateChange(nsnull, nsnull, nsIWebProgressListener::STATE_STOP, forceClose ? NS_ERROR_FAILURE : NS_OK);
}

/* nsIPrompt GetPrompter (); */
NS_IMETHODIMP nsMsgProgress::GetPrompter(nsIPrompt **_retval)
{
  NS_ENSURE_ARG_POINTER(_retval);
  *_retval = nsnull;
  return (! m_closeProgress && m_dialog) ? m_dialog->GetPrompter(_retval) : NS_ERROR_FAILURE;
}

/* attribute boolean processCanceledByUser; */
NS_IMETHODIMP nsMsgProgress::GetProcessCanceledByUser(PRBool *aProcessCanceledByUser)
{
  NS_ENSURE_ARG_POINTER(aProcessCanceledByUser);
  *aProcessCanceledByUser = m_processCanceled;
  return NS_OK;
}
NS_IMETHODIMP nsMsgProgress::SetProcessCanceledByUser(PRBool aProcessCanceledByUser)
{
  m_processCanceled = aProcessCanceledByUser;
  OnStateChange(nsnull, nsnull, nsIWebProgressListener::STATE_STOP, NS_BINDING_ABORTED);
  return NS_OK;
}

/* void RegisterListener (in nsIWebProgressListener listener); */
NS_IMETHODIMP nsMsgProgress::RegisterListener(nsIWebProgressListener * listener)
{
  if (!listener) //Nothing to do with a null listener!
    return NS_OK;

  NS_ENSURE_ARG(this != listener); //Check for self-reference (see bug 271700)

  m_listenerList.AppendObject(listener);
  if (m_closeProgress || m_processCanceled)
    listener->OnStateChange(nsnull, nsnull, nsIWebProgressListener::STATE_STOP, 0);
  else
  {
    listener->OnStatusChange(nsnull, nsnull, 0, m_pendingStatus.get());
    if (m_pendingStateFlags != -1)
      listener->OnStateChange(nsnull, nsnull, m_pendingStateFlags, m_pendingStateValue);
  }

  return NS_OK;
}

/* void UnregisterListener (in nsIWebProgressListener listener); */
NS_IMETHODIMP nsMsgProgress::UnregisterListener(nsIWebProgressListener *listener)
{
  if (listener)
    m_listenerList.RemoveObject(listener);
  return NS_OK;
}

/* void onStateChange (in nsIWebProgress aWebProgress, in nsIRequest aRequest, in unsigned long aStateFlags, in nsresult aStatus); */
NS_IMETHODIMP nsMsgProgress::OnStateChange(nsIWebProgress *aWebProgress, nsIRequest *aRequest, PRUint32 aStateFlags, nsresult aStatus)
{
  m_pendingStateFlags = aStateFlags;
  m_pendingStateValue = aStatus;

  nsCOMPtr<nsIMsgWindow> msgWindow (do_QueryReferent(m_msgWindow));
  if (aStateFlags == nsIWebProgressListener::STATE_STOP && msgWindow && NS_FAILED(aStatus))
  {
    msgWindow->StopUrls();
    msgWindow->SetStatusFeedback(nsnull);
  }

  for (PRInt32 i = m_listenerList.Count() - 1; i >= 0; i --)
    m_listenerList[i]->OnStateChange(aWebProgress, aRequest, aStateFlags, aStatus);

  return NS_OK;
}

/* void onProgressChange (in nsIWebProgress aWebProgress, in nsIRequest aRequest, in long aCurSelfProgress, in long aMaxSelfProgress, in long aCurTotalProgress, in long aMaxTotalProgress); */
NS_IMETHODIMP nsMsgProgress::OnProgressChange(nsIWebProgress *aWebProgress, nsIRequest *aRequest, PRInt32 aCurSelfProgress, PRInt32 aMaxSelfProgress, PRInt32 aCurTotalProgress, PRInt32 aMaxTotalProgress)
{
  for (PRInt32 i = m_listenerList.Count() - 1; i >= 0; i --)
    m_listenerList[i]->OnProgressChange(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress);
  return NS_OK;
}

/* void onLocationChange (in nsIWebProgress aWebProgress, in nsIRequest aRequest, in nsIURI location); */
NS_IMETHODIMP nsMsgProgress::OnLocationChange(nsIWebProgress *aWebProgress, nsIRequest *aRequest, nsIURI *location)
{
  return NS_OK;
}

/* void onStatusChange (in nsIWebProgress aWebProgress, in nsIRequest aRequest, in nsresult aStatus, in wstring aMessage); */
NS_IMETHODIMP nsMsgProgress::OnStatusChange(nsIWebProgress *aWebProgress, nsIRequest *aRequest, nsresult aStatus, const PRUnichar *aMessage)
{
  if (aMessage && *aMessage)
    m_pendingStatus = aMessage;
  for (PRInt32 i = m_listenerList.Count() - 1; i >= 0; i --)
    m_listenerList[i]->OnStatusChange(aWebProgress, aRequest, aStatus, aMessage);
  return NS_OK;
}

/* void onSecurityChange (in nsIWebProgress aWebProgress, in nsIRequest aRequest, in unsigned long state); */
NS_IMETHODIMP nsMsgProgress::OnSecurityChange(nsIWebProgress *aWebProgress, nsIRequest *aRequest, PRUint32 state)
{
  return NS_OK;
}

nsresult nsMsgProgress::ReleaseListeners()
{
  m_listenerList.Clear();
  return NS_OK;
}

NS_IMETHODIMP nsMsgProgress::ShowStatusString(const nsAString& aStatus)
{
  return OnStatusChange(nsnull, nsnull, NS_OK, PromiseFlatString(aStatus).get());
}

NS_IMETHODIMP nsMsgProgress::SetStatusString(const nsAString& aStatus)
{
  return OnStatusChange(nsnull, nsnull, NS_OK, PromiseFlatString(aStatus).get());
}

/* void startMeteors (); */
NS_IMETHODIMP nsMsgProgress::StartMeteors()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

/* void stopMeteors (); */
NS_IMETHODIMP nsMsgProgress::StopMeteors()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

/* void showProgress (in long percent); */
NS_IMETHODIMP nsMsgProgress::ShowProgress(PRInt32 percent)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsMsgProgress::SetWrappedStatusFeedback(nsIMsgStatusFeedback * aJSStatusFeedback)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsMsgProgress::SetMsgWindow(nsIMsgWindow *aMsgWindow)
{
  m_msgWindow = do_GetWeakReference(aMsgWindow);
  return NS_OK;
}

NS_IMETHODIMP nsMsgProgress::GetMsgWindow(nsIMsgWindow **aMsgWindow)
{
  NS_ENSURE_ARG_POINTER(aMsgWindow);

  if (m_msgWindow)
    CallQueryReferent(m_msgWindow.get(), aMsgWindow);
  else
    *aMsgWindow = nsnull;

  return NS_OK;
}

NS_IMETHODIMP nsMsgProgress::OnProgress(nsIRequest *request, nsISupports* ctxt,
                                        PRUint64 aProgress, PRUint64 aProgressMax)
{
  // XXX: What should the nsIWebProgress be?
  // XXX: This truncates 64-bit to 32-bit
  return OnProgressChange(nsnull, request, nsUint64(aProgress), nsUint64(aProgressMax),
                          nsUint64(aProgress) /* current total progress */, nsUint64(aProgressMax) /* max total progress */);
}

NS_IMETHODIMP nsMsgProgress::OnStatus(nsIRequest *request, nsISupports* ctxt,
                                      nsresult aStatus, const PRUnichar* aStatusArg)
{
  nsresult rv;
  nsCOMPtr<nsIStringBundleService> sbs = do_GetService(NS_STRINGBUNDLE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  nsString str;
  rv = sbs->FormatStatusMessage(aStatus, aStatusArg, getter_Copies(str));
  NS_ENSURE_SUCCESS(rv, rv);
  return ShowStatusString(str);
}
