/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "mozilla/mailnews/Services.h"

#include "nsIObserverService.h"
#include "nsIObserver.h"
#include "nsServiceManagerUtils.h"

// All of the includes for the services we initiate here
#include "mozINewMailNotificationService.h"
#include "nsIAbManager.h"
#include "nsIImapService.h"
#include "nsIImportService.h"
#include "nsIMimeConverter.h"
#include "nsIMsgAccountManager.h"
#include "nsIMsgComposeService.h"
#include "nsIMsgCopyService.h"
#include "nsIMsgDatabase.h"
#include "nsIMsgFilterService.h"
#include "nsIMsgFolderNotificationService.h"
#include "nsIMsgHeaderParser.h"
#include "nsIMsgMailSession.h"
#include "nsIMsgTagService.h"
#include "nsINntpService.h"
#include "nsIPop3Service.h"
#include "nsISmtpService.h"

namespace mozilla {
namespace services {

namespace {
class ShutdownObserver MOZ_FINAL : public nsIObserver
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIOBSERVER

  static void EnsureInitialized();
private:
  void ShutdownServices();
  static ShutdownObserver *sShutdownObserver;
  static bool sShuttingDown;
};

bool ShutdownObserver::sShuttingDown = false;
ShutdownObserver *ShutdownObserver::sShutdownObserver = nullptr;
}

#define MOZ_SERVICE(NAME, TYPE, CONTRACT_ID) \
  static TYPE *g##NAME = nullptr; \
  already_AddRefed<TYPE> Get##NAME() \
  { \
    ShutdownObserver::EnsureInitialized(); \
    if (!g##NAME) \
    { \
      nsCOMPtr<TYPE> os = do_GetService(CONTRACT_ID); \
      os.forget(&g##NAME); \
      MOZ_ASSERT(g##NAME, "This service is unexpectedly missing."); \
    } \
    NS_IF_ADDREF(g##NAME); \
    return g##NAME; \
  }
#include "mozilla/mailnews/ServiceList.h"
#undef MOZ_SERVICE

NS_IMPL_ISUPPORTS1(ShutdownObserver, nsIObserver)

NS_IMETHODIMP ShutdownObserver::Observe(nsISupports *aSubject,
    const char *aTopic, const PRUnichar *aData)
{
  if (!strcmp(aTopic, "xpcom-shutdown-threads"))
    ShutdownServices();
  return NS_OK;
}

void ShutdownObserver::EnsureInitialized()
{
  MOZ_ASSERT(!sShuttingDown, "It is illegal to use this code after shutdown!");
  if (!sShutdownObserver)
  {
    sShutdownObserver = new ShutdownObserver;
    sShutdownObserver->AddRef();
    nsCOMPtr<nsIObserverService> obs(mozilla::services::GetObserverService());
    MOZ_ASSERT(obs, "This should never be null");
    obs->AddObserver(sShutdownObserver, "xpcom-shutdown-threads", false);
  }
}

void ShutdownObserver::ShutdownServices()
{
  sShuttingDown = true;
  MOZ_ASSERT(sShutdownObserver, "Shutting down twice?");
  sShutdownObserver->Release();
  sShutdownObserver = nullptr;
#define MOZ_SERVICE(NAME, TYPE, CONTRACT_ID) NS_IF_RELEASE(g##NAME);
#include "mozilla/mailnews/ServiceList.h"
#undef MOZ_SERVICE
}

} // namespace services
} // namespace mozilla
