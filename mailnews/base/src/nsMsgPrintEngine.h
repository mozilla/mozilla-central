/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// nsMsgPrintEngine.h: declaration of nsMsgPrintEngine class
// implementing mozISimpleContainer,
// which provides a DocShell container for use in simple programs
// using the layout engine

#include "nscore.h"
#include "nsCOMPtr.h"

#include "nsIDocShell.h"
#include "nsIDocShell.h"
#include "nsIMsgPrintEngine.h"
#include "nsIStreamListener.h"
#include "nsIWebProgressListener.h"
#include "nsIMsgStatusFeedback.h"
#include "nsIStringBundle.h"
#include "nsIWebBrowserPrint.h"
#include "nsIWebProgressListener.h"
#include "nsWeakReference.h"
#include "nsIPrintSettings.h"
#include "nsIObserver.h"

// Progress Dialog
#include "nsIPrintProgress.h"
#include "nsIPrintProgressParams.h"
#include "nsIPrintingPromptService.h"

class nsMsgPrintEngine : public nsIMsgPrintEngine,
                         public nsIWebProgressListener,
                         public nsIObserver,
                         public nsSupportsWeakReference {

public:
  nsMsgPrintEngine();
  virtual ~nsMsgPrintEngine();

  // nsISupports
  NS_DECL_ISUPPORTS

  // nsIMsgPrintEngine interface
  NS_DECL_NSIMSGPRINTENGINE

  // For nsIWebProgressListener
  NS_DECL_NSIWEBPROGRESSLISTENER

  // For nsIObserver
  NS_DECL_NSIOBSERVER

  void PrintMsgWindow();
  NS_IMETHOD  StartNextPrintOperation();

protected:

  bool        FirePrintEvent();
  nsresult    FireStartNextEvent();
  nsresult    FireThatLoadOperationStartup(const nsString& uri);
  nsresult    FireThatLoadOperation(const nsString& uri);
  void        InitializeDisplayCharset();
  void        SetupObserver();
  nsresult    SetStatusMessage(const nsString& aMsgString);
  void GetString(const PRUnichar *aStringName, nsString& aOutString);
  nsresult    ShowProgressDialog(bool aIsForPrinting, bool& aDoNotify);

  nsCOMPtr<nsIDocShell>       mDocShell;
  nsCOMPtr<nsIDOMWindow>      mWindow;
  nsCOMPtr<nsIDOMWindow>      mParentWindow;
  int32_t                     mURICount;
  nsTArray<nsString>          mURIArray;
  int32_t                     mCurrentlyPrintingURI;

  nsCOMPtr<nsIContentViewer>  mContentViewer;
  nsCOMPtr<nsIStringBundle>   mStringBundle;    // String bundles...
  nsCOMPtr<nsIMsgStatusFeedback> mFeedback;     // Tell the user something why don't ya'
  nsCOMPtr<nsIWebBrowserPrint> mWebBrowserPrint;
  nsCOMPtr<nsIPrintSettings>   mPrintSettings;
  nsCOMPtr<nsIDOMWindow>       mMsgDOMWin;
  bool                         mIsDoingPrintPreview;
  nsCOMPtr<nsIObserver>        mStartupPPObs;
  int32_t                      mMsgInx;

  // Progress Dialog
  
  nsCOMPtr<nsIPrintingPromptService> mPrintPromptService;
  nsCOMPtr<nsIWebProgressListener> mPrintProgressListener;
  nsCOMPtr<nsIPrintProgress>       mPrintProgress;
  nsCOMPtr<nsIPrintProgressParams> mPrintProgressParams;
  nsString                         mLoadURI;
};
