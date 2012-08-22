/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifdef MOZ_LOGGING
#define FORCE_PR_LOG /* Allow logging in the release build */
#endif

#include "nsMsgBiffManager.h"
#include "nsIMsgAccountManager.h"
#include "nsMsgBaseCID.h"
#include "nsStatusBarBiffManager.h"
#include "nsCOMArray.h"
#include "prlog.h"
#include "nspr.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "nsIObserverService.h"
#include "nsComponentManagerUtils.h"
#include "nsServiceManagerUtils.h"
#include "nsMsgUtils.h"
#include "mozilla/Services.h"

#define PREF_BIFF_JITTER "mail.biff.add_interval_jitter"

static NS_DEFINE_CID(kStatusBarBiffManagerCID, NS_STATUSBARBIFFMANAGER_CID);

static PRLogModuleInfo *MsgBiffLogModule = nullptr;

NS_IMPL_ISUPPORTS4(nsMsgBiffManager, nsIMsgBiffManager,
                   nsIIncomingServerListener, nsIObserver,
                   nsISupportsWeakReference)

void OnBiffTimer(nsITimer *timer, void *aBiffManager)
{
  nsMsgBiffManager *biffManager = (nsMsgBiffManager*)aBiffManager;
  biffManager->PerformBiff();
}

nsMsgBiffManager::nsMsgBiffManager()
{
  mHaveShutdown = false;
  mInited = false;
}

nsMsgBiffManager::~nsMsgBiffManager()
{
  if (mBiffTimer)
    mBiffTimer->Cancel();

  if (!mHaveShutdown)
    Shutdown();

  nsCOMPtr<nsIObserverService> observerService =
    mozilla::services::GetObserverService();
  if (observerService)
  {
    observerService->RemoveObserver(this, "wake_notification");
    observerService->RemoveObserver(this, "sleep_notification");
  }
}

NS_IMETHODIMP nsMsgBiffManager::Init()
{
  if (mInited)
    return NS_OK;

  mInited = true;
  nsresult rv;

  nsCOMPtr<nsIMsgAccountManager> accountManager = 
  do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
  if (NS_SUCCEEDED(rv))
    accountManager->AddIncomingServerListener(this);

  // in turbo mode on profile change we don't need to do anything below this
  if (mHaveShutdown)
  {
    mHaveShutdown = false;
    return NS_OK;
  }

  // Ensure status bar biff service has started
  nsCOMPtr<nsIFolderListener> statusBarBiffService = 
    do_GetService(kStatusBarBiffManagerCID, &rv);

  if (!MsgBiffLogModule)
    MsgBiffLogModule = PR_NewLogModule("MsgBiff");

  nsCOMPtr<nsIObserverService> observerService =
    mozilla::services::GetObserverService();
  if (observerService)
  {
    observerService->AddObserver(this, "sleep_notification", true);
    observerService->AddObserver(this, "wake_notification", true);
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgBiffManager::Shutdown()
{
  if (mBiffTimer) 
  {
    mBiffTimer->Cancel();
    mBiffTimer = nullptr;
  }

  nsresult rv;
  nsCOMPtr<nsIMsgAccountManager> accountManager =
    do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);
  if (NS_SUCCEEDED(rv))
    accountManager->RemoveIncomingServerListener(this);

  mHaveShutdown = true;
  mInited = false;
  return NS_OK;
}

NS_IMETHODIMP nsMsgBiffManager::Observe(nsISupports *aSubject, const char *aTopic, const PRUnichar *someData)
{
  if (!strcmp(aTopic, "sleep_notification") && mBiffTimer)
  {
    mBiffTimer->Cancel();
    mBiffTimer = nullptr;
  }
  else if (!strcmp(aTopic, "wake_notification"))
  {
    // wait 10 seconds after waking up to start biffing again.
    mBiffTimer = do_CreateInstance("@mozilla.org/timer;1");
    mBiffTimer->InitWithFuncCallback(OnBiffTimer, (void*)this, 10000,
                                     nsITimer::TYPE_ONE_SHOT);
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgBiffManager::AddServerBiff(nsIMsgIncomingServer *server)
{
  NS_ENSURE_ARG_POINTER(server);

  int32_t biffMinutes;

  nsresult rv = server->GetBiffMinutes(&biffMinutes);
  NS_ENSURE_SUCCESS(rv, rv);

  // Don't add if biffMinutes isn't > 0
  if (biffMinutes > 0)
  {
    int32_t serverIndex = FindServer(server);
    // Only add it if it hasn't been added already.
    if (serverIndex == -1)
    {
      nsBiffEntry biffEntry;
      biffEntry.server = server;
      rv = SetNextBiffTime(biffEntry, PR_Now());
      NS_ENSURE_SUCCESS(rv, rv);

      AddBiffEntry(biffEntry);
      SetupNextBiff();
    }
  }
  return NS_OK;
}

NS_IMETHODIMP nsMsgBiffManager::RemoveServerBiff(nsIMsgIncomingServer *server)
{
  int32_t pos = FindServer(server);
  if (pos != -1)
    mBiffArray.RemoveElementAt(pos);

  // Should probably reset biff time if this was the server that gets biffed
  // next.
  return NS_OK;
}


NS_IMETHODIMP nsMsgBiffManager::ForceBiff(nsIMsgIncomingServer *server)
{
  return NS_OK;
}

NS_IMETHODIMP nsMsgBiffManager::ForceBiffAll()
{
  return NS_OK;
}

NS_IMETHODIMP nsMsgBiffManager::OnServerLoaded(nsIMsgIncomingServer *server)
{
  NS_ENSURE_ARG_POINTER(server);

  bool doBiff = false;
  nsresult rv = server->GetDoBiff(&doBiff);

  if (NS_SUCCEEDED(rv) && doBiff)
    rv = AddServerBiff(server);

  return rv;
}

NS_IMETHODIMP nsMsgBiffManager::OnServerUnloaded(nsIMsgIncomingServer *server)
{
  return RemoveServerBiff(server);
}

NS_IMETHODIMP nsMsgBiffManager::OnServerChanged(nsIMsgIncomingServer *server)
{
  // nothing required.  If the hostname or username changed
  // the next time biff fires, we'll ping the right server
  return NS_OK;
}

int32_t nsMsgBiffManager::FindServer(nsIMsgIncomingServer *server)
{
  uint32_t count = mBiffArray.Length();
  for (uint32_t i = 0; i < count; i++)
  {
    if (server == mBiffArray[i].server.get())
      return i;
  }
  return -1;
}

nsresult nsMsgBiffManager::AddBiffEntry(nsBiffEntry &biffEntry)
{
  uint32_t i;
  uint32_t count = mBiffArray.Length();
  for (i = 0; i < count; i++)
  {
    if (biffEntry.nextBiffTime < mBiffArray[i].nextBiffTime)
      break;
  }
  PR_LOG(MsgBiffLogModule, PR_LOG_ALWAYS, ("inserting biff entry at %d\n", i));
  mBiffArray.InsertElementAt(i, biffEntry);
  return NS_OK;
}

nsresult nsMsgBiffManager::SetNextBiffTime(nsBiffEntry &biffEntry, PRTime currentTime)
{
  nsIMsgIncomingServer *server = biffEntry.server;
  NS_ENSURE_TRUE(server, NS_ERROR_FAILURE);

  int32_t biffInterval;
  nsresult rv = server->GetBiffMinutes(&biffInterval);
  NS_ENSURE_SUCCESS(rv, rv);

  // Add biffInterval, converted in microseconds, to current time.
  // Force 64-bit multiplication.
  PRTime chosenTimeInterval = biffInterval * 60000000LL;
  biffEntry.nextBiffTime = currentTime + chosenTimeInterval;

  // Check if we should jitter.
  nsCOMPtr<nsIPrefBranch> prefs = do_GetService(NS_PREFSERVICE_CONTRACTID);
  if (prefs)
  {
    bool shouldUseBiffJitter = false;
    prefs->GetBoolPref(PREF_BIFF_JITTER, &shouldUseBiffJitter);
    if (shouldUseBiffJitter)
    {
      // Calculate a jitter of +/-5% on chosenTimeInterval
      // - minimum 1 second (to avoid a modulo with 0)
      // - maximum 30 seconds (to avoid problems when biffInterval is very large)
      int64_t jitter = (int64_t)(0.05 * (int64_t)chosenTimeInterval);
      jitter = NS_MAX<int64_t>(1000000LL, NS_MIN<int64_t>(jitter, 30000000LL));
      jitter = ((rand() % 2) ? 1 : -1) * (rand() % jitter);

      biffEntry.nextBiffTime += jitter;
    }
  }

  return NS_OK;
}

nsresult nsMsgBiffManager::SetupNextBiff()
{
  if (mBiffArray.Length() > 0)
  {
    // Get the next biff entry
    const nsBiffEntry &biffEntry = mBiffArray[0];
    PRTime currentTime = PR_Now();
    int64_t biffDelay;
    int64_t ms(1000);

    if (currentTime > biffEntry.nextBiffTime)
    {
      // Let's wait 30 seconds before firing biff again
      biffDelay = 30 * PR_USEC_PER_SEC;
    }
    else
      biffDelay = biffEntry.nextBiffTime - currentTime;

    // Convert biffDelay into milliseconds
    int64_t timeInMS = biffDelay / ms;
    uint32_t timeInMSUint32 = (uint32_t)timeInMS;

    // Can't currently reset a timer when it's in the process of
    // calling Notify. So, just release the timer here and create a new one.
    if (mBiffTimer)
      mBiffTimer->Cancel();

    PR_LOG(MsgBiffLogModule, PR_LOG_ALWAYS, ("setting %d timer\n", timeInMSUint32));
    mBiffTimer = do_CreateInstance("@mozilla.org/timer;1");
    mBiffTimer->InitWithFuncCallback(OnBiffTimer, (void*)this, timeInMSUint32, 
                                     nsITimer::TYPE_ONE_SHOT);

  }
  return NS_OK;
}

//This is the function that does a biff on all of the servers whose time it is to biff.
nsresult nsMsgBiffManager::PerformBiff()
{
  PRTime currentTime = PR_Now();
  nsCOMArray<nsIMsgFolder> targetFolders;
  PR_LOG(MsgBiffLogModule, PR_LOG_ALWAYS, ("performing biffs\n"));

  uint32_t count = mBiffArray.Length();
  for (uint32_t i = 0; i < count; i++)
  {
    // Take a copy of the entry rather than the a reference so that we can
    // remove and add if necessary, but keep the references and memory alive.
    nsBiffEntry current = mBiffArray[i];
    if (current.nextBiffTime < currentTime)
    {
      bool serverBusy = false;
      bool serverRequiresPassword = true;
      bool passwordPromptRequired; 

      current.server->GetPasswordPromptRequired(&passwordPromptRequired);
      current.server->GetServerBusy(&serverBusy);
      current.server->GetServerRequiresPasswordForBiff(&serverRequiresPassword);
      // find the dest folder we're actually downloading to...
      nsCOMPtr<nsIMsgFolder> rootMsgFolder;
      current.server->GetRootMsgFolder(getter_AddRefs(rootMsgFolder));
      int32_t targetFolderIndex = targetFolders.IndexOfObject(rootMsgFolder);
      if (targetFolderIndex == kNotFound)
        targetFolders.AppendObject(rootMsgFolder);

      // so if we need to be authenticated to biff, check that we are
      // (since we don't want to prompt the user for password UI)
      // and make sure the server isn't already in the middle of downloading
      // new messages
      if (!serverBusy &&
          (!serverRequiresPassword || !passwordPromptRequired) &&
          targetFolderIndex == kNotFound)
      {
        nsCString serverKey;
        current.server->GetKey(serverKey);
        nsresult rv = current.server->PerformBiff(nullptr);
        PR_LOG(MsgBiffLogModule, PR_LOG_ALWAYS, ("biffing server %s rv = %x\n", serverKey.get(), rv));
      }
      else
      {
        PR_LOG(MsgBiffLogModule, PR_LOG_ALWAYS, ("not biffing server serverBusy = %d requirespassword = %d password prompt required = %d targetFolderIndex = %d\n",
          serverBusy, serverRequiresPassword, passwordPromptRequired, targetFolderIndex));
      }
      // if we didn't do this server because the destination server was already being
      // biffed into, leave this server in the biff array so it will fire next.
      if (targetFolderIndex == kNotFound)
      {
        mBiffArray.RemoveElementAt(i);
        i--; //Because we removed it we need to look at the one that just moved up.
        SetNextBiffTime(current, currentTime);
        AddBiffEntry(current);
      }
#ifdef DEBUG_David_Bienvenu
      else
        printf("dest account performing biff\n");
#endif
    }
    else
      //since we're in biff order, there's no reason to keep checking
      break;
  }
  SetupNextBiff();
  return NS_OK;
}
