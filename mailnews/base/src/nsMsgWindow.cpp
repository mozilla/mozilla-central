/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsMsgWindow.h"
#include "nsIURILoader.h"
#include "nsCURILoader.h"
#include "nsIDocShell.h"
#include "nsIDocShellTreeItem.h"
#include "nsIDocShellTreeNode.h"
#include "nsIDOMElement.h"
#include "nsIDOMWindow.h"
#include "nsTransactionManagerCID.h"
#include "nsIComponentManager.h"
#include "nsILoadGroup.h"
#include "nsIMsgMailNewsUrl.h"
#include "nsIInterfaceRequestor.h"
#include "nsIInterfaceRequestorUtils.h"
#include "nsIWebProgress.h"
#include "nsIWebProgressListener.h"
#include "nsPIDOMWindow.h"
#include "nsIPrompt.h"
#include "nsICharsetConverterManager.h"
#include "nsIChannel.h"
#include "nsIRequestObserver.h"
#include "netCore.h"
#include "prmem.h"
#include "plbase64.h"
#include "nsMsgI18N.h"
#include "nsIWebNavigation.h"
#include "nsISupportsObsolete.h"
#include "nsMsgContentPolicy.h"
#include "nsComponentManagerUtils.h"
#include "nsServiceManagerUtils.h"
#include "nsIAuthPrompt.h"

// used to dispatch urls to default protocol handlers
#include "nsCExternalHandlerService.h"
#include "nsIExternalProtocolService.h"

static NS_DEFINE_CID(kTransactionManagerCID, NS_TRANSACTIONMANAGER_CID);

NS_IMPL_ISUPPORTS3(nsMsgWindow,
                              nsIMsgWindow,
                              nsIURIContentListener,
                              nsISupportsWeakReference)

nsMsgWindow::nsMsgWindow()
{
  mCharsetOverride = false;
  m_stopped = false;
}

nsMsgWindow::~nsMsgWindow()
{
  CloseWindow();
}

nsresult nsMsgWindow::Init()
{
  // register ourselves as a content listener with the uri dispatcher service
  nsresult rv;
  nsCOMPtr<nsIURILoader> dispatcher =
           do_GetService(NS_URI_LOADER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = dispatcher->RegisterContentListener(this);
  if (NS_FAILED(rv))
    return rv;

  // create Undo/Redo Transaction Manager
  mTransactionManager = do_CreateInstance(kTransactionManagerCID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  return mTransactionManager->SetMaxTransactionCount(-1);
}

NS_IMETHODIMP nsMsgWindow::GetMessageWindowDocShell(nsIDocShell ** aDocShell)
{
  *aDocShell = nullptr;
  nsCOMPtr<nsIDocShell> docShell(do_QueryReferent(mMessageWindowDocShellWeak));
  if (!docShell)
  {
    // if we don't have a docshell, then we need to look up the message pane docshell
    nsCOMPtr<nsIDocShell> rootShell(do_QueryReferent(mRootDocShellWeak));
    if (rootShell)
    {
      nsCOMPtr<nsIDocShellTreeNode> rootAsNode(do_QueryInterface(rootShell));
      nsCOMPtr<nsIDocShellTreeItem> msgDocShellItem;
      if(rootAsNode)
         rootAsNode->FindChildWithName(NS_LITERAL_STRING("messagepane").get(),
                                       true, false, nullptr, nullptr,
                                       getter_AddRefs(msgDocShellItem));
      NS_ENSURE_TRUE(msgDocShellItem, NS_ERROR_FAILURE);
      docShell = do_QueryInterface(msgDocShellItem);
      // we don't own mMessageWindowDocShell so don't try to keep a reference to it!
      mMessageWindowDocShellWeak = do_GetWeakReference(docShell);
    }
  }
  docShell.swap(*aDocShell);
  return NS_OK;
}

NS_IMETHODIMP nsMsgWindow::CloseWindow()
{
  nsresult rv = NS_OK;
  nsCOMPtr<nsIURILoader> dispatcher = do_GetService(NS_URI_LOADER_CONTRACTID, &rv);
  if (dispatcher) // on shut down it's possible dispatcher will be null.
    rv = dispatcher->UnRegisterContentListener(this);

  mMsgWindowCommands = nullptr;
  mStatusFeedback = nullptr;

  StopUrls();

  nsCOMPtr<nsIDocShell> messagePaneDocShell(do_QueryReferent(mMessageWindowDocShellWeak));
  if (messagePaneDocShell)
  {
    nsCOMPtr<nsIURIContentListener> listener(do_GetInterface(messagePaneDocShell));
    if (listener)
      listener->SetParentContentListener(nullptr);
    SetRootDocShell(nullptr);
    mMessageWindowDocShellWeak = nullptr;
  }

  // in case nsMsgWindow leaks, make sure other stuff doesn't leak.
  mTransactionManager = nullptr;
  return NS_OK;
}

NS_IMETHODIMP nsMsgWindow::GetStatusFeedback(nsIMsgStatusFeedback **aStatusFeedback)
{
  NS_ENSURE_ARG_POINTER(aStatusFeedback);
  NS_IF_ADDREF(*aStatusFeedback = mStatusFeedback);
  return NS_OK;
}

NS_IMETHODIMP nsMsgWindow::SetStatusFeedback(nsIMsgStatusFeedback * aStatusFeedback)
{
  mStatusFeedback = aStatusFeedback;
  nsCOMPtr<nsIDocShell> messageWindowDocShell;
  GetMessageWindowDocShell(getter_AddRefs(messageWindowDocShell));

  // register our status feedback object as a web progress listener
  nsCOMPtr<nsIWebProgress> webProgress(do_GetInterface(messageWindowDocShell));
  if (webProgress && mStatusFeedback && messageWindowDocShell)
  {
    nsCOMPtr<nsIWebProgressListener> webProgressListener = do_QueryInterface(mStatusFeedback);
    webProgress->AddProgressListener(webProgressListener, nsIWebProgress::NOTIFY_ALL);
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgWindow::SetWindowCommands(nsIMsgWindowCommands * aMsgWindowCommands)
{
  mMsgWindowCommands = aMsgWindowCommands;
  return NS_OK;
}

NS_IMETHODIMP nsMsgWindow::GetWindowCommands(nsIMsgWindowCommands **aMsgWindowCommands)
{
  NS_ENSURE_ARG_POINTER(aMsgWindowCommands);
  NS_IF_ADDREF(*aMsgWindowCommands = mMsgWindowCommands);
  return NS_OK;
}

NS_IMETHODIMP nsMsgWindow::GetMsgHeaderSink(nsIMsgHeaderSink * *aMsgHdrSink)
{
  NS_ENSURE_ARG_POINTER(aMsgHdrSink);
  NS_IF_ADDREF(*aMsgHdrSink = mMsgHeaderSink);
  return NS_OK;
}

NS_IMETHODIMP nsMsgWindow::SetMsgHeaderSink(nsIMsgHeaderSink * aMsgHdrSink)
{
  mMsgHeaderSink = aMsgHdrSink;
  return NS_OK;
}

NS_IMETHODIMP nsMsgWindow::GetTransactionManager(nsITransactionManager * *aTransactionManager)
{
  NS_ENSURE_ARG_POINTER(aTransactionManager);
  NS_IF_ADDREF(*aTransactionManager = mTransactionManager);
  return NS_OK;
}

NS_IMETHODIMP nsMsgWindow::SetTransactionManager(nsITransactionManager * aTransactionManager)
{
  mTransactionManager = aTransactionManager;
  return NS_OK;
}

NS_IMETHODIMP nsMsgWindow::GetOpenFolder(nsIMsgFolder * *aOpenFolder)
{
  NS_ENSURE_ARG_POINTER(aOpenFolder);
  NS_IF_ADDREF(*aOpenFolder = mOpenFolder);
  return NS_OK;
}

NS_IMETHODIMP nsMsgWindow::SetOpenFolder(nsIMsgFolder * aOpenFolder)
{
  mOpenFolder = aOpenFolder;
  return NS_OK;
}

NS_IMETHODIMP nsMsgWindow::GetRootDocShell(nsIDocShell * *aDocShell)
{
  if (mRootDocShellWeak)
    CallQueryReferent(mRootDocShellWeak.get(), aDocShell);
  else
    *aDocShell = nullptr;
  return NS_OK;
}

NS_IMETHODIMP nsMsgWindow::GetAuthPrompt(nsIAuthPrompt * *aAuthPrompt)
{
  NS_ENSURE_ARG_POINTER(aAuthPrompt);
  if (!mRootDocShellWeak)
    return NS_ERROR_FAILURE;

  nsresult rv;
  nsCOMPtr<nsIDocShell> docShell(do_QueryReferent(mRootDocShellWeak.get(), &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAuthPrompt> prompt = do_GetInterface(docShell, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  prompt.swap(*aAuthPrompt);

  return rv;
}

NS_IMETHODIMP nsMsgWindow::SetRootDocShell(nsIDocShell * aDocShell)
{
  nsresult rv;
  nsCOMPtr<nsIWebProgressListener> contentPolicyListener =
    do_GetService(NS_MSGCONTENTPOLICY_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  
  // remove the content policy webProgressListener from the root doc shell
  // we're currently holding, so we don't keep listening for loads that
  // we don't care about
  if (mRootDocShellWeak) {
    nsCOMPtr<nsIWebProgress> oldWebProgress = 
      do_QueryReferent(mRootDocShellWeak, &rv);
    if (NS_SUCCEEDED(rv)) {
      rv = oldWebProgress->RemoveProgressListener(contentPolicyListener);
      NS_ASSERTION(NS_SUCCEEDED(rv), "failed to remove old progress listener");
    } 
  }
  
  // Query for the doc shell and release it
  mRootDocShellWeak = nullptr;
  if (aDocShell)
  {
    mRootDocShellWeak = do_GetWeakReference(aDocShell);

    nsCOMPtr<nsIDocShell> messagePaneDocShell;
    GetMessageWindowDocShell(getter_AddRefs(messagePaneDocShell));
    nsCOMPtr<nsIURIContentListener> listener(do_GetInterface(messagePaneDocShell));
    if (listener)
      listener->SetParentContentListener(this);
  
    // set the contentPolicy webProgressListener on the root docshell for this
    // window so that it can allow JavaScript for non-message content
    nsCOMPtr<nsIWebProgress> docShellProgress = 
      do_QueryInterface(aDocShell, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    
    rv = docShellProgress->AddProgressListener(contentPolicyListener,
                                               nsIWebProgress::NOTIFY_LOCATION);
    NS_ENSURE_SUCCESS(rv, rv);
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgWindow::GetMailCharacterSet(nsACString& aMailCharacterSet)
{
  aMailCharacterSet = mMailCharacterSet;
  return NS_OK;
}

NS_IMETHODIMP nsMsgWindow::SetMailCharacterSet(const nsACString& aMailCharacterSet)
{
  mMailCharacterSet.Assign(aMailCharacterSet);

  // Convert to a canonical charset name instead of using the charset name from the message header as is.
  // This is needed for charset menu item to have a check mark correctly.
  nsresult rv;
  nsCOMPtr <nsICharsetConverterManager> ccm =
    do_GetService(NS_CHARSETCONVERTERMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  return ccm->GetCharsetAlias(PromiseFlatCString(aMailCharacterSet).get(),
                              mMailCharacterSet);
}

NS_IMETHODIMP nsMsgWindow::GetCharsetOverride(bool *aCharsetOverride)
{
  NS_ENSURE_ARG_POINTER(aCharsetOverride);
  *aCharsetOverride = mCharsetOverride;
  return NS_OK;
}

NS_IMETHODIMP nsMsgWindow::SetCharsetOverride(bool aCharsetOverride)
{
  mCharsetOverride = aCharsetOverride;
  return NS_OK;
}

NS_IMETHODIMP nsMsgWindow::GetDomWindow(nsIDOMWindow **aWindow)
{
  NS_ENSURE_ARG_POINTER(aWindow);
  if (mDomWindow)
    CallQueryReferent(mDomWindow.get(), aWindow);
  else
    *aWindow = nullptr;
  return NS_OK;
}

NS_IMETHODIMP nsMsgWindow::SetDomWindow(nsIDOMWindow * aWindow)
{
  NS_ENSURE_ARG_POINTER(aWindow);
  mDomWindow = do_GetWeakReference(aWindow);

  nsCOMPtr<nsPIDOMWindow> win(do_QueryInterface(aWindow));
  nsIDocShell *docShell = nullptr;
  if (win)
    docShell = win->GetDocShell();

  nsCOMPtr<nsIDocShellTreeItem> docShellAsItem(do_QueryInterface(docShell));

  if(docShellAsItem)
  {
    nsCOMPtr<nsIDocShellTreeItem> rootAsItem;
    docShellAsItem->GetSameTypeRootTreeItem(getter_AddRefs(rootAsItem));

    nsCOMPtr<nsIDocShell> rootAsShell(do_QueryInterface(rootAsItem));
    SetRootDocShell(rootAsShell);

    // force ourselves to figure out the message pane
    nsCOMPtr<nsIDocShell> messageWindowDocShell;
    GetMessageWindowDocShell(getter_AddRefs(messageWindowDocShell));
  }

  return NS_OK;
}

NS_IMETHODIMP nsMsgWindow::SetNotificationCallbacks(nsIInterfaceRequestor * aNotificationCallbacks)
{
  mNotificationCallbacks = aNotificationCallbacks;
  return NS_OK;
}

NS_IMETHODIMP nsMsgWindow::GetNotificationCallbacks(nsIInterfaceRequestor **aNotificationCallbacks)
{
  NS_ENSURE_ARG_POINTER(aNotificationCallbacks);
  NS_IF_ADDREF(*aNotificationCallbacks = mNotificationCallbacks);
  return NS_OK;
}

NS_IMETHODIMP nsMsgWindow::StopUrls()
{
  m_stopped = true;
  nsCOMPtr<nsIWebNavigation> webnav(do_QueryReferent(mRootDocShellWeak));
  return webnav ? webnav->Stop(nsIWebNavigation::STOP_NETWORK) : NS_ERROR_FAILURE;
}

// nsIURIContentListener support
NS_IMETHODIMP nsMsgWindow::OnStartURIOpen(nsIURI* aURI, bool* aAbortOpen)
{
  return NS_OK;
}

NS_IMETHODIMP nsMsgWindow::DoContent(const char *aContentType, bool aIsContentPreferred,
                                     nsIRequest *request, nsIStreamListener **aContentHandler, bool *aAbortProcess)
{
  if (aContentType)
  {
    // forward the DoContent call to our docshell
    nsCOMPtr<nsIDocShell> messageWindowDocShell;
    GetMessageWindowDocShell(getter_AddRefs(messageWindowDocShell));
    nsCOMPtr<nsIURIContentListener> ctnListener = do_QueryInterface(messageWindowDocShell);
    if (ctnListener)
    {
        nsCOMPtr<nsIChannel> aChannel = do_QueryInterface(request);
        if (!aChannel) return NS_ERROR_FAILURE;

      // get the url for the channel...let's hope it is a mailnews url so we can set our msg hdr sink on it..
      // right now, this is the only way I can think of to force the msg hdr sink into the mime converter so it can
      // get too it later...
      nsCOMPtr<nsIURI> uri;
      aChannel->GetURI(getter_AddRefs(uri));
      if (uri)
      {
        nsCOMPtr<nsIMsgMailNewsUrl> mailnewsUrl(do_QueryInterface(uri));
        if (mailnewsUrl)
          mailnewsUrl->SetMsgWindow(this);
      }
      return ctnListener->DoContent(aContentType, aIsContentPreferred, request, aContentHandler, aAbortProcess);
    }
  }
  return NS_OK;
}

NS_IMETHODIMP
nsMsgWindow::IsPreferred(const char * aContentType,
                         char ** aDesiredContentType,
                         bool * aCanHandleContent)
{
  *aCanHandleContent = false;
  return NS_OK;
}

NS_IMETHODIMP nsMsgWindow::CanHandleContent(const char * aContentType,
                                            bool aIsContentPreferred,
                                            char ** aDesiredContentType,
                                            bool * aCanHandleContent)

{
  // the mail window knows nothing about the default content types
  // its docshell can handle...ask the content area if it can handle
  // the content type...

  nsCOMPtr<nsIDocShell> messageWindowDocShell;
  GetMessageWindowDocShell(getter_AddRefs(messageWindowDocShell));
  nsCOMPtr<nsIURIContentListener> ctnListener (do_GetInterface(messageWindowDocShell));
  if (ctnListener)
    return ctnListener->CanHandleContent(aContentType, aIsContentPreferred,
                                         aDesiredContentType, aCanHandleContent);
  else
    *aCanHandleContent = false;
  return NS_OK;
}

NS_IMETHODIMP nsMsgWindow::GetParentContentListener(nsIURIContentListener** aParent)
{
  NS_ENSURE_ARG_POINTER(aParent);
  *aParent = nullptr;
  return NS_OK;
}

NS_IMETHODIMP nsMsgWindow::SetParentContentListener(nsIURIContentListener* aParent)
{
  return NS_OK;
}

NS_IMETHODIMP nsMsgWindow::GetLoadCookie(nsISupports ** aLoadCookie)
{
  NS_ENSURE_ARG_POINTER(aLoadCookie);
  *aLoadCookie = nullptr;
  return NS_OK;
}

NS_IMETHODIMP nsMsgWindow::SetLoadCookie(nsISupports * aLoadCookie)
{
  return NS_OK;
}

NS_IMETHODIMP nsMsgWindow::GetPromptDialog(nsIPrompt **aPrompt)
{
  NS_ENSURE_ARG_POINTER(aPrompt);
  nsresult rv;
  nsCOMPtr<nsIDocShell> rootShell(do_QueryReferent(mRootDocShellWeak, &rv));
  if (rootShell)
  {
    nsCOMPtr<nsIPrompt> dialog;
    dialog = do_GetInterface(rootShell, &rv);
    dialog.swap(*aPrompt);
  }
  return rv;
}

NS_IMETHODIMP
nsMsgWindow::DisplayHTMLInMessagePane(const nsAString& title, const nsAString& body, bool clearMsgHdr)
{
  if (clearMsgHdr && mMsgWindowCommands)
    mMsgWindowCommands->ClearMsgPane();

  nsString htmlStr;
  htmlStr.Append(NS_LITERAL_STRING("<html><head><meta http-equiv=\"Content-Type\" content=\"text/html; charset=UTF-8\"></head><body>").get());
  htmlStr.Append(body);
  htmlStr.Append(NS_LITERAL_STRING("</body></html>").get());

  char *encodedHtml = PL_Base64Encode(NS_ConvertUTF16toUTF8(htmlStr).get(), 0, nullptr);
  if (!encodedHtml)
    return NS_ERROR_OUT_OF_MEMORY;

  nsCString dataSpec;
  dataSpec = "data:text/html;base64,";
  dataSpec += encodedHtml;

  PR_FREEIF(encodedHtml);

  nsCOMPtr <nsIDocShell> docShell;
  GetMessageWindowDocShell(getter_AddRefs(docShell));
  NS_ENSURE_TRUE(docShell, NS_ERROR_FAILURE);

  nsCOMPtr<nsIWebNavigation> webNav(do_QueryInterface(docShell));
  NS_ENSURE_TRUE(webNav, NS_ERROR_FAILURE);

  return webNav->LoadURI(NS_ConvertASCIItoUTF16(dataSpec).get(),
                         nsIWebNavigation::LOAD_FLAGS_NONE,
                         nullptr, nullptr, nullptr);
}

NS_IMPL_GETSET(nsMsgWindow, Stopped, bool, m_stopped)
