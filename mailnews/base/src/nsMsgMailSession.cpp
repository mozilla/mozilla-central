/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "msgCore.h" // for pre-compiled headers
#include "nsMsgBaseCID.h"
#include "nsMsgMailSession.h"
#include "nsIMsgMessageService.h"
#include "nsMsgUtils.h"
#include "nsIMsgAccountManager.h"
#include "nsIChromeRegistry.h"
#include "nsIDirectoryService.h"
#include "nsAppDirectoryServiceDefs.h"
#include "nsPIDOMWindow.h"
#include "nsIDocShell.h"
#include "nsIDOMDocument.h"
#include "nsIDOMElement.h"
#include "nsIObserverService.h"
#include "nsIAppStartup.h"
#include "nsToolkitCompsCID.h"
#include "nsISupportsPrimitives.h"
#include "nsIAppShellService.h"
#include "nsAppShellCID.h"
#include "nsIWindowMediator.h"
#include "nsIWindowWatcher.h"
#include "nsIMsgMailNewsUrl.h"
#include "prcmon.h"
#include "nsThreadUtils.h"
#include "nsComponentManagerUtils.h"
#include "nsServiceManagerUtils.h"
#include "nsIProperties.h"
#include "mozilla/Services.h"

NS_IMPL_ISUPPORTS2(nsMsgMailSession, nsIMsgMailSession, nsIFolderListener)

nsMsgMailSession::nsMsgMailSession()
{
}


nsMsgMailSession::~nsMsgMailSession()
{
  Shutdown();
}

nsresult nsMsgMailSession::Init()
{
  // Ensures the shutdown service is initialised
  nsresult rv;
  nsCOMPtr<nsIMsgShutdownService> shutdownService =
    do_GetService(NS_MSGSHUTDOWNSERVICE_CONTRACTID, &rv);
  return rv;
}

nsresult nsMsgMailSession::Shutdown()
{
  return NS_OK;
}

NS_IMETHODIMP nsMsgMailSession::AddFolderListener(nsIFolderListener *aListener,
                                                  uint32_t aNotifyFlags)
{
  NS_ENSURE_ARG_POINTER(aListener);

  // we don't care about the notification flags for equivalence purposes
  int32_t index = mListeners.IndexOf(aListener);
  NS_ASSERTION(index == -1, "tried to add duplicate listener");
  if (index == -1)
  {
    folderListener newListener(aListener, aNotifyFlags);
    mListeners.AppendElement(newListener);
  }

  return NS_OK;
}

NS_IMETHODIMP nsMsgMailSession::RemoveFolderListener(nsIFolderListener *aListener)
{
  NS_ENSURE_ARG_POINTER(aListener);

  int32_t index = mListeners.IndexOf(aListener);
  NS_ASSERTION(index != -1, "removing non-existent listener");
  if (index != -1)
    mListeners.RemoveElementAt(index);

  return NS_OK;
}

#define NOTIFY_FOLDER_LISTENERS(propertyflag_, propertyfunc_, params_) \
  PR_BEGIN_MACRO                                                       \
  nsTObserverArray<folderListener>::ForwardIterator iter(mListeners);  \
  while (iter.HasMore()) {                                             \
    const folderListener &fL = iter.GetNext();                         \
    if (fL.mNotifyFlags & nsIFolderListener::propertyflag_)            \
      fL.mListener->propertyfunc_ params_;                             \
  }                                                                    \
  PR_END_MACRO

NS_IMETHODIMP
nsMsgMailSession::OnItemPropertyChanged(nsIMsgFolder *aItem,
                                        nsIAtom *aProperty,
                                        const char* aOldValue,
                                        const char* aNewValue)
{
  NOTIFY_FOLDER_LISTENERS(propertyChanged, OnItemPropertyChanged,
                          (aItem, aProperty, aOldValue, aNewValue));
  return NS_OK;
}

NS_IMETHODIMP
nsMsgMailSession::OnItemUnicharPropertyChanged(nsIMsgFolder *aItem,
                                               nsIAtom *aProperty,
                                               const PRUnichar* aOldValue,
                                               const PRUnichar* aNewValue)
{
  NOTIFY_FOLDER_LISTENERS(unicharPropertyChanged, OnItemUnicharPropertyChanged,
                          (aItem, aProperty, aOldValue, aNewValue));
  return NS_OK;
}

NS_IMETHODIMP
nsMsgMailSession::OnItemIntPropertyChanged(nsIMsgFolder *aItem,
                                           nsIAtom *aProperty,
                                           int32_t aOldValue,
                                           int32_t aNewValue)
{
  NOTIFY_FOLDER_LISTENERS(intPropertyChanged, OnItemIntPropertyChanged,
                          (aItem, aProperty, aOldValue, aNewValue));
  return NS_OK;
}

NS_IMETHODIMP
nsMsgMailSession::OnItemBoolPropertyChanged(nsIMsgFolder *aItem,
                                            nsIAtom *aProperty,
                                            bool aOldValue,
                                            bool aNewValue)
{
  NOTIFY_FOLDER_LISTENERS(boolPropertyChanged, OnItemBoolPropertyChanged,
                          (aItem, aProperty, aOldValue, aNewValue));
  return NS_OK;
}

NS_IMETHODIMP
nsMsgMailSession::OnItemPropertyFlagChanged(nsIMsgDBHdr *aItem,
                                            nsIAtom *aProperty,
                                            uint32_t aOldValue,
                                            uint32_t aNewValue)
{
  NOTIFY_FOLDER_LISTENERS(propertyFlagChanged, OnItemPropertyFlagChanged,
                          (aItem, aProperty, aOldValue, aNewValue));
  return NS_OK;
}

NS_IMETHODIMP nsMsgMailSession::OnItemAdded(nsIMsgFolder *aParentItem,
                                            nsISupports *aItem)
{
  NOTIFY_FOLDER_LISTENERS(added, OnItemAdded, (aParentItem, aItem));
  return NS_OK;
}

NS_IMETHODIMP nsMsgMailSession::OnItemRemoved(nsIMsgFolder *aParentItem,
                                              nsISupports *aItem)
{
  NOTIFY_FOLDER_LISTENERS(removed, OnItemRemoved, (aParentItem, aItem));
  return NS_OK;
}

NS_IMETHODIMP nsMsgMailSession::OnItemEvent(nsIMsgFolder *aFolder,
                                            nsIAtom *aEvent)
{
  NOTIFY_FOLDER_LISTENERS(event, OnItemEvent, (aFolder, aEvent));
  return NS_OK;
}

NS_IMETHODIMP
nsMsgMailSession::AddUserFeedbackListener(nsIMsgUserFeedbackListener *aListener)
{
  NS_ENSURE_ARG_POINTER(aListener);

  int32_t index = mFeedbackListeners.IndexOf(aListener);
  NS_ASSERTION(index == -1, "tried to add duplicate listener");
  if (index == -1)
    mFeedbackListeners.AppendElement(aListener);

  return NS_OK;
}

NS_IMETHODIMP
nsMsgMailSession::RemoveUserFeedbackListener(nsIMsgUserFeedbackListener *aListener)
{
  NS_ENSURE_ARG_POINTER(aListener);

  int32_t index = mFeedbackListeners.IndexOf(aListener);
  NS_ASSERTION(index != -1, "removing non-existent listener");
  if (index != -1)
    mFeedbackListeners.RemoveElementAt(index);

  return NS_OK;
}

NS_IMETHODIMP
nsMsgMailSession::AlertUser(const nsAString &aMessage, nsIMsgMailNewsUrl *aUrl)
{
  bool listenersNotified = false;
  nsTObserverArray<nsCOMPtr<nsIMsgUserFeedbackListener> >::ForwardIterator iter(mFeedbackListeners);
  nsCOMPtr<nsIMsgUserFeedbackListener> listener;

  while (iter.HasMore())
  {
    bool notified = false;
    listener = iter.GetNext();
    listener->OnAlert(aMessage, aUrl, &notified);
    listenersNotified = listenersNotified || notified;
  }

  // If the listeners notified the user, then we don't need to. Also exit if
  // aUrl is null because we won't have a nsIMsgWindow in that case.
  if (listenersNotified || !aUrl)
    return NS_OK;

  // If the url hasn't got a message window, then the error was a generated as a
  // result of background activity (e.g. autosync, biff, etc), and hence we
  // shouldn't prompt either.
  nsCOMPtr<nsIMsgWindow> msgWindow;
  aUrl->GetMsgWindow(getter_AddRefs(msgWindow));

  if (!msgWindow)
    return NS_OK;

  nsCOMPtr<nsIPrompt> dialog;
  msgWindow->GetPromptDialog(getter_AddRefs(dialog));

  if (!dialog) // if we didn't get one, use the default....
  {
    nsresult rv;
    nsCOMPtr<nsIWindowWatcher> wwatch =
      do_GetService(NS_WINDOWWATCHER_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    wwatch->GetNewPrompter(0, getter_AddRefs(dialog));
  }

  if (dialog)
    return dialog->Alert(nullptr, PromiseFlatString(aMessage).get());

  return NS_OK;
}

nsresult nsMsgMailSession::GetTopmostMsgWindow(nsIMsgWindow **aMsgWindow)
{
  NS_ENSURE_ARG_POINTER(aMsgWindow);

  *aMsgWindow = nullptr;

  uint32_t count = mWindows.Count();

  if (count == 1)
  {
    NS_ADDREF(*aMsgWindow = mWindows[0]);
    return (*aMsgWindow) ? NS_OK : NS_ERROR_FAILURE;
  }
  else if (count > 1)
  {
    // If multiple message windows then we have lots more work.
    nsresult rv;

    // The msgWindows array does not hold z-order info. Use mediator to get
    // the top most window then match that with the msgWindows array.
    nsCOMPtr<nsIWindowMediator> windowMediator =
      do_GetService(NS_WINDOWMEDIATOR_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsISimpleEnumerator> windowEnum;

#if defined (XP_UNIX)
    // The window managers under Unix/X11 do not support ZOrder information,
    // so we have to use the normal enumeration call here.
    rv = windowMediator->GetEnumerator(nullptr, getter_AddRefs(windowEnum));
#else
    rv = windowMediator->GetZOrderDOMWindowEnumerator(nullptr, true,
                                                      getter_AddRefs(windowEnum));
#endif

    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsISupports> windowSupports;
    nsCOMPtr<nsPIDOMWindow> topMostWindow;
    nsCOMPtr<nsIDOMDocument> domDocument;
    nsCOMPtr<nsIDOMElement> domElement;
    nsAutoString windowType;
    bool more;

    // loop to get the top most with attibute "mail:3pane" or "mail:messageWindow"
    windowEnum->HasMoreElements(&more);
    while (more)
    {
      rv = windowEnum->GetNext(getter_AddRefs(windowSupports));
      NS_ENSURE_SUCCESS(rv, rv);
      NS_ENSURE_TRUE(windowSupports, NS_ERROR_FAILURE);

      topMostWindow = do_QueryInterface(windowSupports, &rv);
      NS_ENSURE_SUCCESS(rv, rv);
      NS_ENSURE_TRUE(topMostWindow, NS_ERROR_FAILURE);

      rv = topMostWindow->GetDocument(getter_AddRefs(domDocument));
      NS_ENSURE_SUCCESS(rv, rv);
      NS_ENSURE_TRUE(domDocument, NS_ERROR_FAILURE);

      rv = domDocument->GetDocumentElement(getter_AddRefs(domElement));
      NS_ENSURE_SUCCESS(rv, rv);
      NS_ENSURE_TRUE(domElement, NS_ERROR_FAILURE);

      rv = domElement->GetAttribute(NS_LITERAL_STRING("windowtype"), windowType);
      NS_ENSURE_SUCCESS(rv, rv);

      if (windowType.EqualsLiteral("mail:3pane") ||
          windowType.EqualsLiteral("mail:messageWindow"))
        break;

      windowEnum->HasMoreElements(&more);
    }

    // identified the top most window
    if (more)
    {
      // use this for the match
      nsIDocShell *topDocShell = topMostWindow->GetDocShell();

      // loop for the msgWindow array to find the match
      nsCOMPtr<nsIDocShell> docShell;

      while (count)
      {
        nsIMsgWindow *msgWindow = mWindows[--count];

        rv = msgWindow->GetRootDocShell(getter_AddRefs(docShell));
        NS_ENSURE_SUCCESS(rv, rv);

        if (topDocShell == docShell)
        {
          NS_IF_ADDREF(*aMsgWindow = msgWindow);
          break;
        }
      }
    }
  }

  return (*aMsgWindow) ? NS_OK : NS_ERROR_FAILURE;
}

NS_IMETHODIMP nsMsgMailSession::AddMsgWindow(nsIMsgWindow *msgWindow)
{
  NS_ENSURE_ARG_POINTER(msgWindow);

  mWindows.AppendObject(msgWindow);
  return NS_OK;
}

NS_IMETHODIMP nsMsgMailSession::RemoveMsgWindow(nsIMsgWindow *msgWindow)
{
  mWindows.RemoveObject(msgWindow);
  // Mac keeps a hidden window open so the app doesn't shut down when
  // the last window is closed. So don't shutdown the account manager in that
  // case. Similarly, for suite, we don't want to disable mailnews when the
  // last mail window is closed.
#if !defined(XP_MACOSX) && !defined(MOZ_SUITE)
  if (!mWindows.Count())
  {
    nsresult rv;
    nsCOMPtr<nsIMsgAccountManager> accountManager = 
      do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
    if (NS_FAILED(rv))
      return rv;
    accountManager->CleanupOnExit();
  }
#endif
  return NS_OK;
}

NS_IMETHODIMP nsMsgMailSession::IsFolderOpenInWindow(nsIMsgFolder *folder, bool *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);

  *aResult = false;

  uint32_t count = mWindows.Count();

  for(uint32_t i = 0; i < count; i++)
  {
    nsCOMPtr<nsIMsgFolder> openFolder;
    mWindows[i]->GetOpenFolder(getter_AddRefs(openFolder));
    if (folder == openFolder.get())
    {
      *aResult = true;
      break;
    }
  }

  return NS_OK;
}

NS_IMETHODIMP
nsMsgMailSession::ConvertMsgURIToMsgURL(const char *aURI, nsIMsgWindow *aMsgWindow, char **aURL)
{
  NS_ENSURE_ARG_POINTER(aURI);
  NS_ENSURE_ARG_POINTER(aURL);

  // convert the rdf msg uri into a url that represents the message...
  nsCOMPtr <nsIMsgMessageService> msgService;
  nsresult rv = GetMessageServiceFromURI(nsDependentCString(aURI), getter_AddRefs(msgService));
  NS_ENSURE_SUCCESS(rv, NS_ERROR_NULL_POINTER);

  nsCOMPtr<nsIURI> tURI;
  rv = msgService->GetUrlForUri(aURI, getter_AddRefs(tURI), aMsgWindow);
  NS_ENSURE_SUCCESS(rv, NS_ERROR_NULL_POINTER);

  nsAutoCString urlString;
  if (NS_SUCCEEDED(tURI->GetSpec(urlString)))
  {
    *aURL = ToNewCString(urlString);
    NS_ENSURE_ARG_POINTER(aURL);
  }
  return rv;
}

//----------------------------------------------------------------------------------------
// GetSelectedLocaleDataDir - If a locale is selected, appends the selected locale to the
//                            defaults data dir and returns that new defaults data dir
//----------------------------------------------------------------------------------------
nsresult
nsMsgMailSession::GetSelectedLocaleDataDir(nsIFile *defaultsDir)
{
  NS_ENSURE_ARG_POINTER(defaultsDir);

  bool baseDirExists = false;
  nsresult rv = defaultsDir->Exists(&baseDirExists);
  NS_ENSURE_SUCCESS(rv, rv);

  if (baseDirExists) {
    nsCOMPtr<nsIXULChromeRegistry> packageRegistry =
      mozilla::services::GetXULChromeRegistryService();
    if (packageRegistry) {
      nsAutoCString localeName;
      rv = packageRegistry->GetSelectedLocale(NS_LITERAL_CSTRING("global-region"), localeName);

      if (NS_SUCCEEDED(rv) && !localeName.IsEmpty()) {
        bool localeDirExists = false;
        nsCOMPtr<nsIFile> localeDataDir;

        rv = defaultsDir->Clone(getter_AddRefs(localeDataDir));
        NS_ENSURE_SUCCESS(rv, rv);

        rv = localeDataDir->AppendNative(localeName);
        NS_ENSURE_SUCCESS(rv, rv);

        rv = localeDataDir->Exists(&localeDirExists);
        NS_ENSURE_SUCCESS(rv, rv);

        if (localeDirExists) {
          // use locale provider instead
          rv = defaultsDir->AppendNative(localeName);
          NS_ENSURE_SUCCESS(rv, rv);
        }
      }
    }
  }
  return NS_OK;
}

//----------------------------------------------------------------------------------------
// GetDataFilesDir - Gets the application's default folder and then appends the
//                   subdirectory named passed in as param dirName. If there is a selected
//                   locale, will append that to the dir path before returning the value
//----------------------------------------------------------------------------------------
NS_IMETHODIMP
nsMsgMailSession::GetDataFilesDir(const char* dirName, nsIFile **dataFilesDir)
{

  NS_ENSURE_ARG_POINTER(dirName);
  NS_ENSURE_ARG_POINTER(dataFilesDir);

  nsresult rv;
  nsCOMPtr<nsIProperties> directoryService =
    do_GetService(NS_DIRECTORY_SERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIFile> defaultsDir;
  rv = directoryService->Get(NS_APP_DEFAULTS_50_DIR,
                             NS_GET_IID(nsIFile),
                             getter_AddRefs(defaultsDir));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = defaultsDir->AppendNative(nsDependentCString(dirName));
  if (NS_SUCCEEDED(rv))
    rv = GetSelectedLocaleDataDir(defaultsDir);

  NS_IF_ADDREF(*dataFilesDir = defaultsDir);

  return rv;
}

/********************************************************************************/

NS_IMPL_ISUPPORTS3(nsMsgShutdownService, nsIMsgShutdownService, nsIUrlListener, nsIObserver)

nsMsgShutdownService::nsMsgShutdownService()
: mQuitMode(nsIAppStartup::eAttemptQuit),
  mProcessedShutdown(false),
  mQuitForced(false),
  mReadyToQuit(false)
{
  nsCOMPtr<nsIObserverService> observerService =
    mozilla::services::GetObserverService();
  if (observerService)
  {
    observerService->AddObserver(this, "quit-application-requested", false);
    observerService->AddObserver(this, "quit-application-granted", false);
    observerService->AddObserver(this, "quit-application", false);
  }
}

nsMsgShutdownService::~nsMsgShutdownService()
{
  nsCOMPtr<nsIObserverService> observerService =
    mozilla::services::GetObserverService();
  if (observerService)
  {  
    observerService->RemoveObserver(this, "quit-application-requested");
    observerService->RemoveObserver(this, "quit-application-granted");
    observerService->RemoveObserver(this, "quit-application");
  }
}

nsresult nsMsgShutdownService::ProcessNextTask()
{
  bool shutdownTasksDone = true;

  int32_t count = mShutdownTasks.Count();
  if (mTaskIndex < count)
  {
    shutdownTasksDone = false;

    nsCOMPtr<nsIMsgShutdownTask> curTask = mShutdownTasks[mTaskIndex];
    nsString taskName;
    curTask->GetCurrentTaskName(taskName); 
    SetStatusText(taskName);

    nsCOMPtr<nsIMsgMailSession> mailSession = do_GetService(NS_MSGMAILSESSION_CONTRACTID);
    NS_ENSURE_TRUE(mailSession, NS_ERROR_FAILURE);

    nsCOMPtr<nsIMsgWindow> topMsgWindow;
    mailSession->GetTopmostMsgWindow(getter_AddRefs(topMsgWindow));

    bool taskIsRunning = true;
    nsresult rv = curTask->DoShutdownTask(this, topMsgWindow, &taskIsRunning);
    if (NS_FAILED(rv) || !taskIsRunning)
    {
      // We have failed, let's go on to the next task.
      mTaskIndex++;
      mMsgProgress->OnProgressChange(nullptr, nullptr, 0, 0, mTaskIndex, count);
      ProcessNextTask();
    }
  }

  if (shutdownTasksDone)
  {
    if (mMsgProgress)
      mMsgProgress->OnStateChange(nullptr, nullptr, nsIWebProgressListener::STATE_STOP, NS_OK);
    AttemptShutdown();
  }

  return NS_OK;
}

void nsMsgShutdownService::AttemptShutdown()
{
  if (mQuitForced)
  {
    PR_CEnterMonitor(this);
    mReadyToQuit = true;
    PR_CNotifyAll(this);
    PR_CExitMonitor(this);
  }
  else
  {
    nsCOMPtr<nsIAppStartup> appStartup =
      do_GetService(NS_APPSTARTUP_CONTRACTID);
    NS_ENSURE_TRUE_VOID(appStartup);
    NS_ENSURE_SUCCESS_VOID(appStartup->Quit(mQuitMode));
  }
}

NS_IMETHODIMP nsMsgShutdownService::SetShutdownListener(nsIWebProgressListener *inListener)
{
  NS_ENSURE_TRUE(mMsgProgress, NS_ERROR_FAILURE);
  mMsgProgress->RegisterListener(inListener);
  return NS_OK;
}

NS_IMETHODIMP nsMsgShutdownService::Observe(nsISupports *aSubject,
                                            const char *aTopic,
                                            const PRUnichar *aData)
{
  // Due to bug 459376 we don't always get quit-application-requested and
  // quit-application-granted. quit-application-requested is preferred, but if
  // we don't then we have to hook onto quit-application, but we don't want
  // to do the checking twice so we set some flags to prevent that.
  if (!strcmp(aTopic, "quit-application-granted"))
  {
    // Quit application has been requested and granted, therefore we will shut
    // down. 
    mProcessedShutdown = true;
    return NS_OK;
  }

  // If we've already processed a shutdown notification, no need to do it again.
  if (!strcmp(aTopic, "quit-application"))
  {
    if (mProcessedShutdown)
      return NS_OK;
    else
      mQuitForced = true;
  }

  nsCOMPtr<nsIObserverService> observerService =
    mozilla::services::GetObserverService();
  NS_ENSURE_STATE(observerService);
  
  nsCOMPtr<nsISimpleEnumerator> listenerEnum;
  nsresult rv = observerService->EnumerateObservers("msg-shutdown", getter_AddRefs(listenerEnum));
  if (NS_SUCCEEDED(rv) && listenerEnum)
  {
    bool hasMore;
    listenerEnum->HasMoreElements(&hasMore);
    if (!hasMore)
      return NS_OK;

    while (hasMore)
    {
      nsCOMPtr<nsISupports> curObject;
      listenerEnum->GetNext(getter_AddRefs(curObject));
      
      nsCOMPtr<nsIMsgShutdownTask> curTask = do_QueryInterface(curObject);
      if (curTask)
      {
        bool shouldRunTask;
        curTask->GetNeedsToRunTask(&shouldRunTask);
        if (shouldRunTask)
          mShutdownTasks.AppendObject(curTask);
      }
      
      listenerEnum->HasMoreElements(&hasMore);
    }

    if (mShutdownTasks.Count() < 1)
      return NS_ERROR_FAILURE;
    
    mTaskIndex = 0;
    
    mMsgProgress = do_CreateInstance(NS_MSGPROGRESS_CONTRACTID);
    NS_ENSURE_TRUE(mMsgProgress, NS_ERROR_FAILURE);
    
    nsCOMPtr<nsIMsgMailSession> mailSession = do_GetService(NS_MSGMAILSESSION_CONTRACTID);
    NS_ENSURE_TRUE(mailSession, NS_ERROR_FAILURE);

    nsCOMPtr<nsIMsgWindow> topMsgWindow;
    mailSession->GetTopmostMsgWindow(getter_AddRefs(topMsgWindow));
    
    nsCOMPtr<nsIDOMWindow> internalDomWin;
    if (topMsgWindow)
      topMsgWindow->GetDomWindow(getter_AddRefs(internalDomWin));
    
    if (!internalDomWin)
    {
      // First see if there is a window open. 
      nsCOMPtr<nsIWindowMediator> winMed = do_GetService(NS_WINDOWMEDIATOR_CONTRACTID);
      winMed->GetMostRecentWindow(nullptr, getter_AddRefs(internalDomWin));
      
      //If not use the hidden window.
      if (!internalDomWin)
      {
        nsCOMPtr<nsIAppShellService> appShell(do_GetService(NS_APPSHELLSERVICE_CONTRACTID));
        appShell->GetHiddenDOMWindow(getter_AddRefs(internalDomWin));
        NS_ENSURE_TRUE(internalDomWin, NS_ERROR_FAILURE);  // bail if we don't get a window.
      }
    }

    if (!mQuitForced)
    {
      nsCOMPtr<nsISupportsPRBool> stopShutdown = do_QueryInterface(aSubject);
      stopShutdown->SetData(true);

      // If the attempted quit was a restart, be sure to restart the app once
      // the tasks have been run. This is usually the case when addons or
      // updates are going to be installed.
      if (aData && nsDependentString(aData).EqualsLiteral("restart"))
        mQuitMode |= nsIAppStartup::eRestart;
    }

    mMsgProgress->OpenProgressDialog(internalDomWin, topMsgWindow, 
                                     "chrome://messenger/content/shutdownWindow.xul", 
                                     false, nullptr);

    if (mQuitForced)
    {
      nsCOMPtr<nsIThread> thread(do_GetCurrentThread());

      mReadyToQuit = false;
      while (!mReadyToQuit)
      {
        PR_CEnterMonitor(this);
        // Waiting for 50 milliseconds
        PR_CWait(this, PR_MicrosecondsToInterval(50000UL));
        PR_CExitMonitor(this);
        NS_ProcessPendingEvents(thread);
      }
    }
  }
  
  return NS_OK;
}

// nsIUrlListener
NS_IMETHODIMP nsMsgShutdownService::OnStartRunningUrl(nsIURI *url)
{
  return NS_OK;
}

NS_IMETHODIMP nsMsgShutdownService::OnStopRunningUrl(nsIURI *url, nsresult aExitCode)
{
  mTaskIndex++;

  if (mMsgProgress)
  {
    int32_t numTasks = mShutdownTasks.Count();
    mMsgProgress->OnProgressChange(nullptr, nullptr, 0, 0, mTaskIndex, numTasks);
  }

  ProcessNextTask();
  return NS_OK;
}

NS_IMETHODIMP nsMsgShutdownService::GetNumTasks(int32_t *inNumTasks)
{
  *inNumTasks = mShutdownTasks.Count();
  return NS_OK;
}

NS_IMETHODIMP nsMsgShutdownService::StartShutdownTasks()
{
  ProcessNextTask();
  return NS_OK;
}

NS_IMETHODIMP nsMsgShutdownService::CancelShutdownTasks()
{
  AttemptShutdown();
  return NS_OK;
}

NS_IMETHODIMP nsMsgShutdownService::SetStatusText(const nsAString & inStatusString)
{
  nsString statusString(inStatusString);
  if (mMsgProgress)
    mMsgProgress->OnStatusChange(nullptr, nullptr, NS_OK, nsString(statusString).get());
  return NS_OK;
}
