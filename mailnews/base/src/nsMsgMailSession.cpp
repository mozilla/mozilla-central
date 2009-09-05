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
#include "nsIObserverService.h"
#include "nsIAppStartup.h"
#include "nsXPFEComponentsCID.h"
#include "nsISupportsPrimitives.h"
#include "nsIAppShellService.h"
#include "nsAppShellCID.h"
#include "nsIWindowMediator.h"
#include "nsIWindowWatcher.h"
#include "nsIMsgMailNewsUrl.h"
#include "prcmon.h"
#include "nsThreadUtils.h"

NS_IMPL_THREADSAFE_ADDREF(nsMsgMailSession)
NS_IMPL_THREADSAFE_RELEASE(nsMsgMailSession)
NS_INTERFACE_MAP_BEGIN(nsMsgMailSession)
  NS_INTERFACE_MAP_ENTRY(nsIMsgMailSession)
  NS_INTERFACE_MAP_ENTRY(nsIFolderListener)
  NS_INTERFACE_MAP_ENTRY_AMBIGUOUS(nsISupports, nsIMsgMailSession)
NS_INTERFACE_MAP_END_THREADSAFE
  
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
                                                  PRUint32 aNotifyFlags)
{
  NS_ENSURE_ARG_POINTER(aListener);

  // we don't care about the notification flags for equivalence purposes
  PRInt32 index = mListeners.IndexOf(aListener);
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

  PRInt32 index = mListeners.IndexOf(aListener);
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
                                           PRInt32 aOldValue,
                                           PRInt32 aNewValue)
{
  NOTIFY_FOLDER_LISTENERS(intPropertyChanged, OnItemIntPropertyChanged,
                          (aItem, aProperty, aOldValue, aNewValue));
  return NS_OK;
}

NS_IMETHODIMP
nsMsgMailSession::OnItemBoolPropertyChanged(nsIMsgFolder *aItem,
                                            nsIAtom *aProperty,
                                            PRBool aOldValue,
                                            PRBool aNewValue)
{
  NOTIFY_FOLDER_LISTENERS(boolPropertyChanged, OnItemBoolPropertyChanged,
                          (aItem, aProperty, aOldValue, aNewValue));
  return NS_OK;
}

NS_IMETHODIMP
nsMsgMailSession::OnItemPropertyFlagChanged(nsIMsgDBHdr *aItem,
                                            nsIAtom *aProperty,
                                            PRUint32 aOldValue,
                                            PRUint32 aNewValue)
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

  PRInt32 index = mFeedbackListeners.IndexOf(aListener);
  NS_ASSERTION(index == -1, "tried to add duplicate listener");
  if (index == -1)
    mFeedbackListeners.AppendElement(aListener);

  return NS_OK;
}

NS_IMETHODIMP
nsMsgMailSession::RemoveUserFeedbackListener(nsIMsgUserFeedbackListener *aListener)
{
  NS_ENSURE_ARG_POINTER(aListener);

  PRInt32 index = mFeedbackListeners.IndexOf(aListener);
  NS_ASSERTION(index != -1, "removing non-existent listener");
  if (index != -1)
    mFeedbackListeners.RemoveElementAt(index);

  return NS_OK;
}

NS_IMETHODIMP
nsMsgMailSession::AlertUser(const nsAString &aMessage, nsIMsgMailNewsUrl *aUrl)
{
  PRBool listenersNotified = PR_FALSE;
  nsTObserverArray<nsCOMPtr<nsIMsgUserFeedbackListener> >::ForwardIterator iter(mFeedbackListeners);
  nsCOMPtr<nsIMsgUserFeedbackListener> listener;

  while (iter.HasMore())
  {
    PRBool notified = PR_FALSE;
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
    return dialog->Alert(nsnull, PromiseFlatString(aMessage).get());

  return NS_OK;
}

nsresult nsMsgMailSession::GetTopmostMsgWindow(nsIMsgWindow* *aMsgWindow)
{
  NS_ENSURE_ARG_POINTER(aMsgWindow);
  
  *aMsgWindow = nsnull;
 
  PRUint32 count = mWindows.Count();

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
    rv = windowMediator->GetEnumerator(nsnull, getter_AddRefs(windowEnum));
#else
    rv = windowMediator->GetZOrderDOMWindowEnumerator(nsnull, PR_TRUE,
                                                      getter_AddRefs(windowEnum));
#endif

    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsISupports> windowSupports;
    nsCOMPtr<nsPIDOMWindow> topMostWindow;
    nsCOMPtr<nsIDOMDocument> domDocument;
    nsCOMPtr<nsIDOMElement> domElement;
    nsAutoString windowType;
    PRBool more;

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

NS_IMETHODIMP nsMsgMailSession::IsFolderOpenInWindow(nsIMsgFolder *folder, PRBool *aResult)
{
  if (!aResult)
    return NS_ERROR_NULL_POINTER;
  *aResult = PR_FALSE;
  
  PRUint32 count = mWindows.Count();
  
  for(PRUint32 i = 0; i < count; i++)
  {
    nsCOMPtr<nsIMsgFolder> openFolder;
    mWindows[i]->GetOpenFolder(getter_AddRefs(openFolder));
    if (folder == openFolder.get())
    {
      *aResult = PR_TRUE;
      break;
    }
  }
  
  return NS_OK;
}

NS_IMETHODIMP
nsMsgMailSession::ConvertMsgURIToMsgURL(const char *aURI, nsIMsgWindow *aMsgWindow, char **aURL)
{
  if ((!aURI) || (!aURL))
    return NS_ERROR_NULL_POINTER;

  // convert the rdf msg uri into a url that represents the message...
  nsCOMPtr <nsIMsgMessageService> msgService;
  nsresult rv = GetMessageServiceFromURI(nsDependentCString(aURI), getter_AddRefs(msgService));
  if (NS_FAILED(rv)) 
    return NS_ERROR_NULL_POINTER;

  nsCOMPtr<nsIURI> tURI;
  rv = msgService->GetUrlForUri(aURI, getter_AddRefs(tURI), aMsgWindow);
  if (NS_FAILED(rv)) 
    return NS_ERROR_NULL_POINTER;

  nsCAutoString urlString;
  if (NS_SUCCEEDED(tURI->GetSpec(urlString)))
  {
    *aURL = ToNewCString(urlString);
    if (!(aURL))
      return NS_ERROR_NULL_POINTER;
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

  nsresult rv;                                                                
  PRBool baseDirExists = PR_FALSE;                                            
  rv = defaultsDir->Exists(&baseDirExists);                               
  NS_ENSURE_SUCCESS(rv,rv);                                                   

  if (baseDirExists) {                                                        
    nsCOMPtr<nsIXULChromeRegistry> packageRegistry =
      do_GetService("@mozilla.org/chrome/chrome-registry;1", &rv);
    if (NS_SUCCEEDED(rv)) {                                                 
      nsCAutoString localeName;                                           
      rv = packageRegistry->GetSelectedLocale(NS_LITERAL_CSTRING("global-region"), localeName);

      if (NS_SUCCEEDED(rv) && !localeName.IsEmpty()) {
        PRBool localeDirExists = PR_FALSE;                              
        nsCOMPtr<nsIFile> localeDataDir;                                
        
        rv = defaultsDir->Clone(getter_AddRefs(localeDataDir));     
        NS_ENSURE_SUCCESS(rv,rv);                                       

        rv = localeDataDir->AppendNative(localeName);
        NS_ENSURE_SUCCESS(rv,rv);                                       

        rv = localeDataDir->Exists(&localeDirExists);                   
        NS_ENSURE_SUCCESS(rv,rv);                                       

        if (localeDirExists) {                                          
          // use locale provider instead                              
          rv = defaultsDir->AppendNative(localeName);
          NS_ENSURE_SUCCESS(rv,rv);                                   
        }                                                               
      }                                                                   
    }                                                                       
  }                                                                           
  return NS_OK;                                                               
} 

//----------------------------------------------------------------------------------------
// GetDataFilesDir - Gets the application's default folder and then appends the 
//                   subdirectory named passed in as param dirName. If there is a seleccted
//                   locale, will append that to the dir path before returning the value
//----------------------------------------------------------------------------------------
NS_IMETHODIMP
nsMsgMailSession::GetDataFilesDir(const char* dirName, nsIFile **dataFilesDir)
{                                                                                                                                                    
  NS_ENSURE_ARG_POINTER(dataFilesDir);

  nsresult rv;
  nsCOMPtr<nsIProperties> directoryService = 
    do_GetService(NS_DIRECTORY_SERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr<nsIFile> defaultsDir;
  rv = directoryService->Get(NS_APP_DEFAULTS_50_DIR, 
                             NS_GET_IID(nsIFile), 
                             getter_AddRefs(defaultsDir));
  NS_ENSURE_SUCCESS(rv,rv);

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
  mProcessedShutdown(PR_FALSE),
  mQuitForced(PR_FALSE),
  mReadyToQuit(PR_FALSE)
{
  nsCOMPtr<nsIObserverService> observerService = do_GetService("@mozilla.org/observer-service;1");
  if (observerService)
  {
    observerService->AddObserver(this, "quit-application-requested", PR_FALSE);
    observerService->AddObserver(this, "quit-application-granted", PR_FALSE);
    observerService->AddObserver(this, "quit-application", PR_FALSE);
  }
}

nsMsgShutdownService::~nsMsgShutdownService()
{
  nsCOMPtr<nsIObserverService> observerService = do_GetService("@mozilla.org/observer-service;1");
  if (observerService)
  {  
    observerService->RemoveObserver(this, "quit-application-requested");
    observerService->RemoveObserver(this, "quit-application-granted");
    observerService->RemoveObserver(this, "quit-application");
  }
}

nsresult nsMsgShutdownService::ProcessNextTask()
{
  PRBool shutdownTasksDone = PR_TRUE;
  
  PRInt32 count = mShutdownTasks.Count();
  if (mTaskIndex < count)
  {
    shutdownTasksDone = PR_FALSE;

    nsCOMPtr<nsIMsgShutdownTask> curTask = mShutdownTasks[mTaskIndex];    
    nsString taskName;
    curTask->GetCurrentTaskName(taskName); 
    SetStatusText(taskName);
   
    nsCOMPtr<nsIMsgMailSession> mailSession = do_GetService(NS_MSGMAILSESSION_CONTRACTID);
    NS_ENSURE_TRUE(mailSession, NS_ERROR_FAILURE);

    nsCOMPtr<nsIMsgWindow> topMsgWindow;
    mailSession->GetTopmostMsgWindow(getter_AddRefs(topMsgWindow));

    PRBool taskIsRunning = PR_TRUE;
    nsresult rv = curTask->DoShutdownTask(this, topMsgWindow, &taskIsRunning);
    if (NS_FAILED(rv) || !taskIsRunning)
    {
      // We have failed, let's go on to the next task.
      mTaskIndex++;
      mMsgProgress->OnProgressChange(nsnull, nsnull, 0, 0, mTaskIndex, count);
      ProcessNextTask();
    }
  }

  if (shutdownTasksDone)
  {
    mMsgProgress->OnStateChange(nsnull, nsnull, nsIWebProgressListener::STATE_STOP, NS_OK);
    AttemptShutdown();
  }
  
  return NS_OK;
}

void nsMsgShutdownService::AttemptShutdown()
{
  if (mQuitForced)
  {
    PR_CEnterMonitor(this);
    mReadyToQuit = PR_TRUE;
    PR_CNotifyAll(this);
    PR_CExitMonitor(this);
  }
  else
  {
    nsCOMPtr<nsIAppStartup> appStartup =
      do_GetService(NS_APPSTARTUP_CONTRACTID);
    NS_ENSURE_TRUE(appStartup, );
    NS_ENSURE_SUCCESS(appStartup->Quit(mQuitMode), );
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
    mProcessedShutdown = PR_TRUE;
    return NS_OK;
  }

  // If we've already processed a shutdown notification, no need to do it again.
  if (!strcmp(aTopic, "quit-application"))
  {
    if (mProcessedShutdown)
      return NS_OK;
    else
      mQuitForced = PR_TRUE;
  }

  nsCOMPtr<nsIObserverService> observerService = do_GetService("@mozilla.org/observer-service;1");
  NS_ENSURE_STATE(observerService);
  
  nsCOMPtr<nsISimpleEnumerator> listenerEnum;
  nsresult rv = observerService->EnumerateObservers("msg-shutdown", getter_AddRefs(listenerEnum));
  if (NS_SUCCEEDED(rv) && listenerEnum)
  {
    PRBool hasMore;
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
        PRBool shouldRunTask;
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
    
    nsCOMPtr<nsIDOMWindowInternal> internalDomWin;
    if (topMsgWindow)
      topMsgWindow->GetDomWindow(getter_AddRefs(internalDomWin));
    
    if (!internalDomWin)
    {
      // First see if there is a window open. 
      nsCOMPtr<nsIWindowMediator> winMed = do_GetService(NS_WINDOWMEDIATOR_CONTRACTID);
      winMed->GetMostRecentWindow(nsnull, getter_AddRefs(internalDomWin));
      
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
      stopShutdown->SetData(PR_TRUE);

      // If the attempted quit was a restart, be sure to restart the app once
      // the tasks have been run. This is usually the case when addons or
      // updates are going to be installed.
      if (nsDependentString(aData).EqualsLiteral("restart"))
        mQuitMode |= nsIAppStartup::eRestart;
    }

    mMsgProgress->OpenProgressDialog(internalDomWin, topMsgWindow, 
                                     "chrome://messenger/content/shutdownWindow.xul", 
                                     PR_FALSE, nsnull);

    if (mQuitForced)
    {
      nsIThread *thread = NS_GetCurrentThread();

      mReadyToQuit = PR_FALSE;
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

  PRInt32 numTasks = mShutdownTasks.Count();
  mMsgProgress->OnProgressChange(nsnull, nsnull, 0, 0, mTaskIndex, numTasks);
  
  ProcessNextTask();
  return NS_OK;
}

NS_IMETHODIMP nsMsgShutdownService::GetNumTasks(PRInt32 *inNumTasks)
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
  mMsgProgress->OnStatusChange(nsnull, nsnull, NS_OK, statusString.get());
  return NS_OK;
}
