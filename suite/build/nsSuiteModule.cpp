/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "mozilla/ModuleUtils.h"
#include "nsSuiteDirectoryProvider.h"
#include "nsThunderbirdProfileMigrator.h"
#include "nsNetCID.h"
#include "nsRDFCID.h"
#include "nsFeedSniffer.h"

#if defined(XP_WIN)
#include "nsWindowsShellService.h"
#elif defined(XP_MACOSX)
#include "nsMacShellService.h"
#elif defined(MOZ_WIDGET_GTK2)
#include "nsGNOMEShellService.h"
#endif

#define NS_SUITEPROFILEMIGRATOR_CONTRACTID_PREFIX "@mozilla.org/profile/migrator;1?app=suite&type="

/////////////////////////////////////////////////////////////////////////////

#if defined(XP_WIN)
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsWindowsShellService, Init)
#elif defined(XP_MACOSX)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMacShellService)
#elif defined(MOZ_WIDGET_GTK2)
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsGNOMEShellService, Init)
#endif
NS_GENERIC_FACTORY_CONSTRUCTOR(nsSuiteDirectoryProvider)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsThunderbirdProfileMigrator)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsFeedSniffer)

#if defined(NS_SUITEWININTEGRATION_CID)
NS_DEFINE_NAMED_CID(NS_SUITEWININTEGRATION_CID);
#elif defined(NS_SUITEMACINTEGRATION_CID)
NS_DEFINE_NAMED_CID(NS_SUITEMACINTEGRATION_CID);
#elif defined(NS_SUITEGNOMEINTEGRATION_CID)
NS_DEFINE_NAMED_CID(NS_SUITEGNOMEINTEGRATION_CID);
#endif
NS_DEFINE_NAMED_CID(NS_SUITEDIRECTORYPROVIDER_CID);
NS_DEFINE_NAMED_CID(NS_THUNDERBIRDPROFILEMIGRATOR_CID);
NS_DEFINE_NAMED_CID(NS_FEEDSNIFFER_CID);

/////////////////////////////////////////////////////////////////////////////

static const mozilla::Module::CIDEntry kSuiteCIDs[] = {
#if defined(NS_SUITEWININTEGRATION_CID)
  { &kNS_SUITEWININTEGRATION_CID, false, NULL, nsWindowsShellServiceConstructor },
#elif defined(NS_SUITEMACINTEGRATION_CID)
  { &kNS_SUITEMACINTEGRATION_CID, false, NULL, nsMacShellServiceConstructor },
#elif defined(NS_SUITEGNOMEINTEGRATION_CID)
  { &kNS_SUITEGNOMEINTEGRATION_CID, false, NULL, nsGNOMEShellServiceConstructor },
#endif
  { &kNS_SUITEDIRECTORYPROVIDER_CID, false, NULL, nsSuiteDirectoryProviderConstructor },
  { &kNS_THUNDERBIRDPROFILEMIGRATOR_CID, false, NULL, nsThunderbirdProfileMigratorConstructor },
  { &kNS_FEEDSNIFFER_CID, false, NULL, nsFeedSnifferConstructor },
  { NULL }
};

static const mozilla::Module::ContractIDEntry kSuiteContracts[] = {
#if defined(NS_SUITEWININTEGRATION_CID)
  { NS_SUITESHELLSERVICE_CONTRACTID, &kNS_SUITEWININTEGRATION_CID },
#elif defined(NS_SUITEMACINTEGRATION_CID)
  { NS_SUITESHELLSERVICE_CONTRACTID, &kNS_SUITEMACINTEGRATION_CID },
#elif defined(NS_SUITEGNOMEINTEGRATION_CID)
  { NS_SUITESHELLSERVICE_CONTRACTID, &kNS_SUITEGNOMEINTEGRATION_CID },
#endif
  { NS_SUITEDIRECTORYPROVIDER_CONTRACTID, &kNS_SUITEDIRECTORYPROVIDER_CID },
  { NS_SUITEPROFILEMIGRATOR_CONTRACTID_PREFIX "thunderbird", &kNS_THUNDERBIRDPROFILEMIGRATOR_CID },
  { NS_FEEDSNIFFER_CONTRACTID, &kNS_FEEDSNIFFER_CID },
  { NULL }
};

static const mozilla::Module::CategoryEntry kSuiteCategories[] = {
  { XPCOM_DIRECTORY_PROVIDER_CATEGORY, "suite-directory-provider", NS_SUITEDIRECTORYPROVIDER_CONTRACTID },
  { NS_CONTENT_SNIFFER_CATEGORY, "Feed Sniffer", NS_FEEDSNIFFER_CONTRACTID },
  { NULL }
};

static const mozilla::Module kSuiteModule = {
  mozilla::Module::kVersion,
  kSuiteCIDs,
  kSuiteContracts,
  kSuiteCategories
};

NSMODULE_DEFN(SuiteModule) = &kSuiteModule;
