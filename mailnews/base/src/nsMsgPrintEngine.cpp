/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * nsMsgPrintEngine.cpp provides a DocShell container for use in printing.
 */

#include "nscore.h"
#include "nsCOMPtr.h"

#include "nsIComponentManager.h"

#include "nsISupports.h"

#include "nsIURI.h"

#include "nsPIDOMWindow.h"
#include "nsIContentViewer.h"
#include "nsIMsgMessageService.h"
#include "nsMsgUtils.h"
#include "nsIWebProgress.h"
#include "nsIInterfaceRequestorUtils.h"
#include "nsIMarkupDocumentViewer.h"
#include "nsMsgPrintEngine.h"
#include "nsIDocumentLoader.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "nsThreadUtils.h"
#include "nsAutoPtr.h"
#include "mozilla/Services.h"

// Interfaces Needed
#include "nsIBaseWindow.h"
#include "nsIDocShellTreeOwner.h"
#include "nsIDocShellTreeItem.h"
#include "nsIDocShellTreeNode.h"
#include "nsIWebNavigation.h"
#include "nsIChannel.h"
#include "nsIContentViewerFile.h"
#include "nsServiceManagerUtils.h"

static const char* kPrintingPromptService = "@mozilla.org/embedcomp/printingprompt-service;1";

/////////////////////////////////////////////////////////////////////////
// nsMsgPrintEngine implementation
/////////////////////////////////////////////////////////////////////////

nsMsgPrintEngine::nsMsgPrintEngine() :
  mIsDoingPrintPreview(false),
  mMsgInx(nsIMsgPrintEngine::MNAB_START)
{
  mCurrentlyPrintingURI = -1;
}


nsMsgPrintEngine::~nsMsgPrintEngine()
{
}

// Implement AddRef and Release
NS_IMPL_ISUPPORTS4(nsMsgPrintEngine,
                         nsIMsgPrintEngine, 
                         nsIWebProgressListener, 
                         nsIObserver,
                         nsISupportsWeakReference)

// nsIWebProgressListener implementation
NS_IMETHODIMP
nsMsgPrintEngine::OnStateChange(nsIWebProgress* aWebProgress, 
                   nsIRequest *aRequest, 
                   uint32_t progressStateFlags, 
                   nsresult aStatus)
{
  nsresult rv = NS_OK;

  // top-level document load data
  if (progressStateFlags & nsIWebProgressListener::STATE_IS_DOCUMENT) {
    if (progressStateFlags & nsIWebProgressListener::STATE_START) {
      // Tell the user we are loading...
      nsString msg;
      GetString(NS_LITERAL_STRING("LoadingMessageToPrint").get(), msg);
      SetStatusMessage(msg);
    }

    if (progressStateFlags & nsIWebProgressListener::STATE_STOP) {
      nsCOMPtr<nsIDocumentLoader> docLoader(do_QueryInterface(aWebProgress));
      if (docLoader) 
      {
        // Check to see if the document DOMWin that is finished loading is the same
        // one as the mail msg that we started to load.
        // We only want to print when the entire msg and all of its attachments
        // have finished loading.
        // The mail msg doc is the last one to receive the STATE_STOP notification
        nsCOMPtr<nsISupports> container;
        docLoader->GetContainer(getter_AddRefs(container));
        nsCOMPtr<nsIDOMWindow> domWindow(do_GetInterface(container));
        if (domWindow.get() != mMsgDOMWin.get()) {
          return NS_OK;
        }
      }
      nsCOMPtr<nsIWebProgressListener> wpl(do_QueryInterface(mPrintPromptService));
      if (wpl) {
        wpl->OnStateChange(nullptr, nullptr, nsIWebProgressListener::STATE_STOP|nsIWebProgressListener::STATE_IS_DOCUMENT, NS_OK);
        mPrintProgressListener = nullptr;
        mPrintProgress         = nullptr;
        mPrintProgressParams   = nullptr;
      }

      bool isPrintingCancelled = false;
      if (mPrintSettings)
      {
        mPrintSettings->GetIsCancelled(&isPrintingCancelled);
      }
      if (!isPrintingCancelled) {
        // if aWebProgress is a documentloader than the notification from
        // loading the documents. If it is NULL (or not a DocLoader) then it 
        // it coming from Printing
        if (docLoader) {
          // Now, fire off the print operation!
          rv = NS_ERROR_FAILURE;

          // Tell the user the message is loaded...
          nsString msg;
          GetString(NS_LITERAL_STRING("MessageLoaded").get(), msg);
          SetStatusMessage(msg);

          NS_ASSERTION(mDocShell,"can't print, there is no docshell");
          if ( (!mDocShell) || (!aRequest) ) 
          {
            return StartNextPrintOperation();
          }
          nsCOMPtr<nsIChannel> aChannel = do_QueryInterface(aRequest);
          if (!aChannel) return NS_ERROR_FAILURE;

          // Make sure this isn't just "about:blank" finishing....
          nsCOMPtr<nsIURI> originalURI = nullptr;
          if (NS_SUCCEEDED(aChannel->GetOriginalURI(getter_AddRefs(originalURI))) && originalURI)
          {
            nsAutoCString spec;

            if (NS_SUCCEEDED(originalURI->GetSpec(spec)))
            {      
              if (spec.Equals("about:blank"))
              {
                return StartNextPrintOperation();
              }
            }
          }

          // If something bad happens here (menaing we can fire the PLEvent, highly unlikely)
          // we will still ask the msg to print, but if the user "cancels" out of the 
          // print dialog the hidden print window will not be "closed"
          if (!FirePrintEvent()) 
          {
            PrintMsgWindow();
          }
        } else {
          FireStartNextEvent();
          rv = NS_OK;
        }
      } 
      else 
      {
        mWindow->Close();
      }
    }
  }

  return rv;
}

NS_IMETHODIMP
nsMsgPrintEngine::OnProgressChange(nsIWebProgress *aWebProgress,
                                     nsIRequest *aRequest,
                                     int32_t aCurSelfProgress,
                                     int32_t aMaxSelfProgress,
                                     int32_t aCurTotalProgress,
                                     int32_t aMaxTotalProgress)
{
    return NS_OK;
}

NS_IMETHODIMP
nsMsgPrintEngine::OnLocationChange(nsIWebProgress* aWebProgress,
                      nsIRequest* aRequest,
                      nsIURI *location,
                      uint32_t aFlags)
{
    NS_NOTREACHED("notification excluded in AddProgressListener(...)");
    return NS_OK;
}


NS_IMETHODIMP
nsMsgPrintEngine::OnStatusChange(nsIWebProgress* aWebProgress,
                    nsIRequest* aRequest,
                    nsresult aStatus,
                    const PRUnichar* aMessage)
{
    return NS_OK;
}


NS_IMETHODIMP
nsMsgPrintEngine::OnSecurityChange(nsIWebProgress *aWebProgress, 
                      nsIRequest *aRequest, 
                      uint32_t state)
{
    NS_NOTREACHED("notification excluded in AddProgressListener(...)");
    return NS_OK;
}

NS_IMETHODIMP    
nsMsgPrintEngine::SetWindow(nsIDOMWindow *aWin)
{
	if (!aWin)
  {
    // It isn't an error to pass in null for aWin, in fact it means we are shutting
    // down and we should start cleaning things up...
		return NS_OK;
  }

  mWindow = aWin;

  nsCOMPtr<nsPIDOMWindow> win( do_QueryInterface(aWin) );
  NS_ENSURE_TRUE(win, NS_ERROR_FAILURE);

  win->GetDocShell()->SetAppType(nsIDocShell::APP_TYPE_MAIL);

  nsCOMPtr<nsIDocShellTreeItem> docShellAsItem =
    do_QueryInterface(win->GetDocShell());
  NS_ENSURE_TRUE(docShellAsItem, NS_ERROR_FAILURE);

  nsCOMPtr<nsIDocShellTreeItem> rootAsItem;
  docShellAsItem->GetSameTypeRootTreeItem(getter_AddRefs(rootAsItem));

  nsCOMPtr<nsIDocShellTreeNode> rootAsNode(do_QueryInterface(rootAsItem));
  NS_ENSURE_TRUE(rootAsNode, NS_ERROR_FAILURE);

  nsCOMPtr<nsIDocShellTreeItem> childItem;
  rootAsNode->FindChildWithName(NS_LITERAL_STRING("content").get(), true,
				false, nullptr, nullptr,
				getter_AddRefs(childItem));

  mDocShell = do_QueryInterface(childItem);

  if(mDocShell)
    SetupObserver();

  return NS_OK;
}

/* void setParentWindow (in nsIDOMWindow ptr); */
NS_IMETHODIMP nsMsgPrintEngine::SetParentWindow(nsIDOMWindow *ptr)
{
  mParentWindow = ptr;
  return NS_OK;
}


NS_IMETHODIMP
nsMsgPrintEngine::ShowWindow(bool aShow)
{
  nsresult rv;

  NS_ENSURE_TRUE(mWindow, NS_ERROR_NOT_INITIALIZED);

  nsCOMPtr <nsPIDOMWindow> win = do_QueryInterface(mWindow, &rv);

  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr <nsIDocShellTreeItem> treeItem =
    do_QueryInterface(win->GetDocShell(), &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr <nsIDocShellTreeOwner> treeOwner;
  rv = treeItem->GetTreeOwner(getter_AddRefs(treeOwner));
  NS_ENSURE_SUCCESS(rv,rv);
  
  if (treeOwner) {
    // disable (enable) the window
    nsCOMPtr<nsIBaseWindow> baseWindow;
    baseWindow = do_QueryInterface(treeOwner, &rv);
    NS_ENSURE_SUCCESS(rv,rv);

    rv = baseWindow->SetEnabled(aShow);
    NS_ENSURE_SUCCESS(rv,rv);

    // hide or show the window
    baseWindow->SetVisibility(aShow);
  }
  return rv;
}

NS_IMETHODIMP
nsMsgPrintEngine::AddPrintURI(const PRUnichar *aMsgURI)
{
  NS_ENSURE_ARG_POINTER(aMsgURI);

  mURIArray.AppendElement(nsDependentString(aMsgURI));
  return NS_OK;
}

NS_IMETHODIMP
nsMsgPrintEngine::SetPrintURICount(int32_t aCount)
{
  mURICount = aCount;
  return NS_OK;
}

NS_IMETHODIMP
nsMsgPrintEngine::StartPrintOperation(nsIPrintSettings* aPS)
{
  NS_ENSURE_ARG_POINTER(aPS);
  mPrintSettings = aPS;

  // Load the about:blank on the tail end...
  nsresult rv = AddPrintURI(NS_LITERAL_STRING("about:blank").get()); 
  if (NS_FAILED(rv)) return rv; 
  return StartNextPrintOperation();
}

//----------------------------------------------------------------------
// Set up to use the "pluggable" Print Progress Dialog
nsresult
nsMsgPrintEngine::ShowProgressDialog(bool aIsForPrinting, bool& aDoNotify)
{
  nsresult rv;

  // default to not notifying, that if something here goes wrong
  // or we aren't going to show the progress dialog we can straight into 
  // reflowing the doc for printing.
  aDoNotify = false;

  // Assume we can't do progress and then see if we can
  bool showProgressDialog = false;

  // if it is already being shown then don't bother to find out if it should be
  // so skip this and leave mShowProgressDialog set to FALSE
  nsCOMPtr<nsIPrefBranch> prefBranch = do_GetService(NS_PREFSERVICE_CONTRACTID, &rv);
  if (NS_SUCCEEDED(rv)) 
  {
    prefBranch->GetBoolPref("print.show_print_progress", &showProgressDialog);
  }

  // Turning off the showing of Print Progress in Prefs overrides
  // whether the calling PS desire to have it on or off, so only check PS if 
  // prefs says it's ok to be on.
  if (showProgressDialog) 
  {
    mPrintSettings->GetShowPrintProgress(&showProgressDialog);
  }

  // Now open the service to get the progress dialog
  // If we don't get a service, that's ok, then just don't show progress
  if (showProgressDialog) {
    if (!mPrintPromptService) 
    {
      mPrintPromptService = do_GetService(kPrintingPromptService);
    }
    if (mPrintPromptService) 
    {
      nsCOMPtr<nsIDOMWindow> domWin(do_QueryInterface(mParentWindow));
      if (!domWin) 
      {
        domWin = mWindow;
      }

      rv = mPrintPromptService->ShowProgress(domWin, mWebBrowserPrint, mPrintSettings, this, aIsForPrinting,
                                            getter_AddRefs(mPrintProgressListener), 
                                            getter_AddRefs(mPrintProgressParams), 
                                            &aDoNotify);
      if (NS_SUCCEEDED(rv)) {

        showProgressDialog = mPrintProgressListener != nullptr && mPrintProgressParams != nullptr;

        if (showProgressDialog) 
        {
          nsIWebProgressListener* wpl = static_cast<nsIWebProgressListener*>(mPrintProgressListener.get());
          NS_ASSERTION(wpl, "nsIWebProgressListener is NULL!");
          NS_ADDREF(wpl);
          nsString msg;
          if (mIsDoingPrintPreview) {
            GetString(NS_LITERAL_STRING("LoadingMailMsgForPrintPreview").get(), msg);
          } else {
            GetString(NS_LITERAL_STRING("LoadingMailMsgForPrint").get(), msg);
          }
          if (!msg.IsEmpty()) 
            mPrintProgressParams->SetDocTitle(msg.get());
        }
      }
    }
  }
  return rv;
}


NS_IMETHODIMP
nsMsgPrintEngine::StartNextPrintOperation()
{
  nsresult      rv;

  // Only do this the first time through...
  if (mCurrentlyPrintingURI == -1)
    InitializeDisplayCharset();

  mCurrentlyPrintingURI++;

  // First, check if we are at the end of this stuff!
  if (mCurrentlyPrintingURI >= (int32_t)mURIArray.Length())
  {
    // This is the end...dum, dum, dum....my only friend...the end
    mWindow->Close();

    // Tell the user we are done...
    nsString msg;
    GetString(NS_LITERAL_STRING("PrintingComplete").get(), msg);
    SetStatusMessage(msg);
    return NS_OK;
  }

  if (!mDocShell)
    return StartNextPrintOperation();

  const nsString &uri = mURIArray[mCurrentlyPrintingURI];
  rv = FireThatLoadOperationStartup(uri);
  if (NS_FAILED(rv))
    return StartNextPrintOperation();
  else
    return rv;
}

NS_IMETHODIMP    
nsMsgPrintEngine::SetStatusFeedback(nsIMsgStatusFeedback *aFeedback)
{
	mFeedback = aFeedback;
	return NS_OK;
}

#define DATA_URL_PREFIX     "data:"
#define ADDBOOK_URL_PREFIX     "addbook:"

nsresult
nsMsgPrintEngine::FireThatLoadOperationStartup(const nsString& uri)
{
  if (!uri.IsEmpty()) 
    mLoadURI = uri;
  else
    mLoadURI.Truncate();

  bool     notify = false;
  nsresult rv     = NS_ERROR_FAILURE;
  // Don't show dialog if we are out of URLs
  //if ( mCurrentlyPrintingURI < mURIArray.Length() && !mIsDoingPrintPreview)
  if ( mCurrentlyPrintingURI < (int32_t)mURIArray.Length())
    rv = ShowProgressDialog(!mIsDoingPrintPreview, notify);
  if (NS_FAILED(rv) || !notify) 
    return FireThatLoadOperation(uri);
  return NS_OK;
}

nsresult
nsMsgPrintEngine::FireThatLoadOperation(const nsString& uri)
{
  nsresult rv;
  
  nsCString uriCStr;
  LossyCopyUTF16toASCII(uri, uriCStr);

  nsCOMPtr <nsIMsgMessageService> messageService;
  // if this is a data: url, skip it, because 
  // we've already got something we can print
  // and we know it is not a message.
  //
  // if this an about:blank url, skip it, because
  // ...
  //
  // if this is an addbook: url, skip it, because
  // we know that isn't a message.
  //
  // if this is a message part (or .eml file on disk)
  // skip it, because we don't want to print the parent message
  // we want to print the part.
  // example:  imap://sspitzer@nsmail-1:143/fetch%3EUID%3E/INBOX%3E180958?part=1.1.2&type=application/x-message-display&filename=test"
  if (!StringBeginsWith(uriCStr, NS_LITERAL_CSTRING(DATA_URL_PREFIX)) &&
      !StringBeginsWith(uriCStr, NS_LITERAL_CSTRING(ADDBOOK_URL_PREFIX)) &&
      !uriCStr.EqualsLiteral("about:blank") && 
      uriCStr.Find(NS_LITERAL_CSTRING("type=application/x-message-display")) == -1) {
    rv = GetMessageServiceFromURI(uriCStr, getter_AddRefs(messageService));
  }

  if (NS_SUCCEEDED(rv) && messageService)
    rv = messageService->DisplayMessageForPrinting(uriCStr.get(), mDocShell, nullptr, nullptr, nullptr);
  //If it's not something we know about, then just load try loading it directly.
  else
  {
    nsCOMPtr<nsIWebNavigation> webNav(do_QueryInterface(mDocShell));
    if (webNav)
      rv = webNav->LoadURI(uri.get(),                        // URI string
                           nsIWebNavigation::LOAD_FLAGS_NONE, // Load flags
                           nullptr,                            // Referring URI
                           nullptr,                            // Post data
                           nullptr);                           // Extra headers
  }
  return rv;
}

void
nsMsgPrintEngine::InitializeDisplayCharset()
{
  // libmime always converts to UTF-8 (both HTML and XML)
  if (mDocShell) 
  {
    nsCOMPtr<nsIContentViewer> cv;
    mDocShell->GetContentViewer(getter_AddRefs(cv));
    if (cv) 
    {
      nsCOMPtr<nsIMarkupDocumentViewer> muDV = do_QueryInterface(cv);
      if (muDV) 
      {
        muDV->SetForceCharacterSet(NS_LITERAL_CSTRING("UTF-8"));
      }
    }
  }
}

void
nsMsgPrintEngine::SetupObserver()
{
  if (!mDocShell)
    return;

  if (mDocShell)
  {
    nsCOMPtr<nsIWebProgress> progress(do_GetInterface(mDocShell));
    NS_ASSERTION(progress, "we were expecting a nsIWebProgress");
    if (progress) 
    {
      (void) progress->AddProgressListener((nsIWebProgressListener *)this,
                                        nsIWebProgress::NOTIFY_STATE_DOCUMENT);
    }

    // Cache a pointer to the mail message's DOMWindow 
    // so later we know when we can print when the 
    // document "loaded" msgs com thru via the Progress listener
    mMsgDOMWin = do_GetInterface(mDocShell);
  }
}

nsresult
nsMsgPrintEngine::SetStatusMessage(const nsString& aMsgString)
{
  if ( (!mFeedback) || (aMsgString.IsEmpty()) )
    return NS_OK;

  mFeedback->ShowStatusString(aMsgString);
  return NS_OK;
}

#define MESSENGER_STRING_URL       "chrome://messenger/locale/messenger.properties"

void
nsMsgPrintEngine::GetString(const PRUnichar *aStringName, nsString& outStr)
{
  outStr.Truncate();

  if (!mStringBundle)
  {
    static const char propertyURL[] = MESSENGER_STRING_URL;

    nsCOMPtr<nsIStringBundleService> sBundleService = 
      mozilla::services::GetStringBundleService();
    if (sBundleService)
      sBundleService->CreateBundle(propertyURL, getter_AddRefs(mStringBundle));
  }

  if (mStringBundle)
    mStringBundle->GetStringFromName(aStringName, getter_Copies(outStr));
  return;
}

//-----------------------------------------------------------
void
nsMsgPrintEngine::PrintMsgWindow()
{
  const char* kMsgKeys[] = {"PrintingMessage",  "PrintPreviewMessage",
                            "PrintingContact",  "PrintPreviewContact",
                            "PrintingAddrBook", "PrintPreviewAddrBook"};

  mDocShell->GetContentViewer(getter_AddRefs(mContentViewer));  
  if (mContentViewer) 
  {
    mWebBrowserPrint = do_QueryInterface(mContentViewer);
    if (mWebBrowserPrint) 
    {
      if (!mPrintSettings) 
      {
        mWebBrowserPrint->GetGlobalPrintSettings(getter_AddRefs(mPrintSettings));
      }
      
      // fix for bug #118887 and bug #176016
      // don't show the actual url when printing mail messages or addressbook cards.
      // for mail, it can review the salt.  for addrbook, it's a data:// url, which
      // means nothing to the end user.
      // needs to be " " and not "" or nullptr, otherwise, we'll still print the url
      mPrintSettings->SetDocURL(NS_LITERAL_STRING(" ").get());

      nsresult rv = NS_ERROR_FAILURE;
      if (mIsDoingPrintPreview) 
      {
        if (mStartupPPObs) {
          rv = mStartupPPObs->Observe(nullptr, nullptr, nullptr);
        }
      } 
      else 
      {
        mPrintSettings->SetPrintSilent(mCurrentlyPrintingURI != 0);
        rv = mWebBrowserPrint->Print(mPrintSettings, (nsIWebProgressListener *)this);
      }

      if (NS_FAILED(rv))
      {
        mWebBrowserPrint = nullptr;
        mContentViewer = nullptr;
        bool isPrintingCancelled = false;
        if (mPrintSettings)
        {
          mPrintSettings->GetIsCancelled(&isPrintingCancelled);
        }
        if (!isPrintingCancelled) 
        {
          StartNextPrintOperation();
        } 
        else 
        {
          mWindow->Close();
        }
      }
      else
      {
        // Tell the user we started printing...
        nsString msg;
        GetString(NS_ConvertASCIItoUTF16(kMsgKeys[mMsgInx]).get(), msg);
        SetStatusMessage(msg);
      }
    }
  }
}

//---------------------------------------------------------------
//-- Event Notification
//---------------------------------------------------------------

//---------------------------------------------------------------
class nsPrintMsgWindowEvent : public nsRunnable
{
public:
  nsPrintMsgWindowEvent(nsMsgPrintEngine *mpe)
    : mMsgPrintEngine(mpe)
  {}

  NS_IMETHOD Run()
  {
    if (mMsgPrintEngine) 
      mMsgPrintEngine->PrintMsgWindow();
    return NS_OK;
  }

private:
  nsRefPtr<nsMsgPrintEngine> mMsgPrintEngine;
};

//-----------------------------------------------------------
class nsStartNextPrintOpEvent : public nsRunnable
{
public:
  nsStartNextPrintOpEvent(nsMsgPrintEngine *mpe)
    : mMsgPrintEngine(mpe)
  {}

  NS_IMETHOD Run()
  {
    if (mMsgPrintEngine) 
      mMsgPrintEngine->StartNextPrintOperation();
    return NS_OK;
  }

private:
  nsRefPtr<nsMsgPrintEngine> mMsgPrintEngine;
};

//-----------------------------------------------------------
bool
nsMsgPrintEngine::FirePrintEvent()
{
  nsCOMPtr<nsIRunnable> event = new nsPrintMsgWindowEvent(this);
  return NS_SUCCEEDED(NS_DispatchToCurrentThread(event));
}

//-----------------------------------------------------------
nsresult
nsMsgPrintEngine::FireStartNextEvent()
{
  nsCOMPtr<nsIRunnable> event = new nsStartNextPrintOpEvent(this);
  return NS_DispatchToCurrentThread(event);
}

/* void setStartupPPObserver (in nsIObserver startupPPObs); */
NS_IMETHODIMP nsMsgPrintEngine::SetStartupPPObserver(nsIObserver *startupPPObs)
{
  mStartupPPObs = startupPPObs;
  return NS_OK;
}

/* attribute boolean doPrintPreview; */
NS_IMETHODIMP nsMsgPrintEngine::GetDoPrintPreview(bool *aDoPrintPreview)
{
  NS_ENSURE_ARG_POINTER(aDoPrintPreview);
  *aDoPrintPreview = mIsDoingPrintPreview;
  return NS_OK;
}
NS_IMETHODIMP nsMsgPrintEngine::SetDoPrintPreview(bool aDoPrintPreview)
{
  mIsDoingPrintPreview = aDoPrintPreview;
  return NS_OK;
}

/* void setMsgType (in long aMsgType); */
NS_IMETHODIMP nsMsgPrintEngine::SetMsgType(int32_t aMsgType)
{
  if (mMsgInx >= nsIMsgPrintEngine::MNAB_START && mMsgInx < nsIMsgPrintEngine::MNAB_END) 
  {
    mMsgInx = aMsgType;
    return NS_OK;
  }
  return NS_ERROR_FAILURE;
}

/*=============== nsIObserver Interface ======================*/
NS_IMETHODIMP nsMsgPrintEngine::Observe(nsISupports *aSubject, const char *aTopic, const PRUnichar *aData)
{
  return FireThatLoadOperation(mLoadURI);
}
