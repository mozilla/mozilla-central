/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "mozilla/ModuleUtils.h"
#include "nsMailMigrationCID.h"
#include "nsProfileMigrator.h"
#include "nsSeamonkeyProfileMigrator.h"
#include "DirectoryProvider.h"

using namespace mozilla::mail;

NS_GENERIC_FACTORY_CONSTRUCTOR(DirectoryProvider)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsProfileMigrator)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsSeamonkeyProfileMigrator)

#ifdef XP_WIN32

#include "nsOEProfileMigrator.h"
NS_GENERIC_FACTORY_CONSTRUCTOR(nsOEProfileMigrator)

#include "nsOutlookProfileMigrator.h"
NS_GENERIC_FACTORY_CONSTRUCTOR(nsOutlookProfileMigrator)

#include "nsMailWinIntegration.h"
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsWindowsShellService, Init)
#endif

#if defined(XP_WIN32) || defined(XP_MACOSX)
#include "nsEudoraProfileMigrator.h"
NS_GENERIC_FACTORY_CONSTRUCTOR(nsEudoraProfileMigrator)
#endif
#ifdef MOZ_WIDGET_GTK2
#include "nsMailGNOMEIntegration.h"
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsMailGNOMEIntegration, Init)
#endif
#ifdef XP_MACOSX
#include "nsMailMacIntegration.h"
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMailMacIntegration)
#endif

#if defined(XP_WIN32)
#include "nsMailWinSearchHelper.h"
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsMailWinSearchHelper, Init)
#endif

NS_DEFINE_NAMED_CID(NS_MAILDIRECTORYPROVIDER_CID);
NS_DEFINE_NAMED_CID(NS_THUNDERBIRD_PROFILEIMPORT_CID);
NS_DEFINE_NAMED_CID(NS_SEAMONKEYPROFILEMIGRATOR_CID);

#ifdef XP_WIN32
NS_DEFINE_NAMED_CID(NS_OEXPRESSPROFILEMIGRATOR_CID);
NS_DEFINE_NAMED_CID(NS_OUTLOOKPROFILEMIGRATOR_CID);
NS_DEFINE_NAMED_CID(NS_MAILWININTEGRATION_CID);
NS_DEFINE_NAMED_CID(NS_MAILWINSEARCHHELPER_CID);
#endif // !XP_WIN32

#if defined (XP_WIN32) || defined (XP_MACOSX)
NS_DEFINE_NAMED_CID(NS_EUDORAPROFILEMIGRATOR_CID);
#endif

#ifdef MOZ_WIDGET_GTK2
NS_DEFINE_NAMED_CID(NS_MAILGNOMEINTEGRATION_CID);
#endif

#ifdef XP_MACOSX
NS_DEFINE_NAMED_CID(NS_MAILMACINTEGRATION_CID);
#endif

const mozilla::Module::CIDEntry kMailCIDs[] = {
  { &kNS_MAILDIRECTORYPROVIDER_CID, false, NULL, DirectoryProviderConstructor },
  { &kNS_THUNDERBIRD_PROFILEIMPORT_CID, false, NULL, nsProfileMigratorConstructor },
  { &kNS_SEAMONKEYPROFILEMIGRATOR_CID, false, NULL, nsSeamonkeyProfileMigratorConstructor },
#ifdef XP_WIN32
  { &kNS_OEXPRESSPROFILEMIGRATOR_CID, false, NULL, nsOEProfileMigratorConstructor },
  { &kNS_OUTLOOKPROFILEMIGRATOR_CID, false, NULL, nsOutlookProfileMigratorConstructor },
  { &kNS_MAILWININTEGRATION_CID, false, NULL, nsWindowsShellServiceConstructor },
  { &kNS_MAILWINSEARCHHELPER_CID, false, NULL, nsMailWinSearchHelperConstructor },
#endif // !XP_WIN32
#if defined (XP_WIN32) || defined (XP_MACOSX)
  { &kNS_EUDORAPROFILEMIGRATOR_CID, false, NULL, nsEudoraProfileMigratorConstructor },
#endif
#ifdef MOZ_WIDGET_GTK2
  { &kNS_MAILGNOMEINTEGRATION_CID, false, NULL, nsMailGNOMEIntegrationConstructor },
#endif
#ifdef XP_MACOSX
  { &kNS_MAILMACINTEGRATION_CID, false, NULL, nsMailMacIntegrationConstructor },
#endif
  { NULL }
};

const mozilla::Module::ContractIDEntry kMailContracts[] = {
  { NS_MAILDIRECTORYPROVIDER_CONTRACTID, &kNS_MAILDIRECTORYPROVIDER_CID },
  { NS_PROFILEMIGRATOR_CONTRACTID, &kNS_THUNDERBIRD_PROFILEIMPORT_CID },
  { NS_MAILPROFILEMIGRATOR_CONTRACTID_PREFIX "seamonkey", &kNS_SEAMONKEYPROFILEMIGRATOR_CID },
#ifdef XP_WIN32
  { NS_MAILPROFILEMIGRATOR_CONTRACTID_PREFIX "oexpress", &kNS_OEXPRESSPROFILEMIGRATOR_CID },
  { NS_MAILPROFILEMIGRATOR_CONTRACTID_PREFIX "outlook", &kNS_OUTLOOKPROFILEMIGRATOR_CID },
  { "@mozilla.org/mail/shell-service;1", &kNS_MAILWININTEGRATION_CID },
  { "@mozilla.org/mail/windows-search-helper;1", &kNS_MAILWINSEARCHHELPER_CID },
#endif // !XP_WIN32
#if defined (XP_WIN32) || defined (XP_MACOSX)
  { NS_MAILPROFILEMIGRATOR_CONTRACTID_PREFIX "eudora", &kNS_EUDORAPROFILEMIGRATOR_CID },
#endif
#ifdef MOZ_WIDGET_GTK2
  { "@mozilla.org/mail/shell-service;1", &kNS_MAILGNOMEINTEGRATION_CID },
#endif
#ifdef XP_MACOSX
  { "@mozilla.org/mail/shell-service;1", &kNS_MAILMACINTEGRATION_CID },
#endif
  { NULL }
};

static const mozilla::Module::CategoryEntry kMailCategories[] = {
  { XPCOM_DIRECTORY_PROVIDER_CATEGORY, "mailcomps-directory-provider", NS_MAILDIRECTORYPROVIDER_CONTRACTID },
  { NULL }
};

static const mozilla::Module kMailCompsModule = {
  mozilla::Module::kVersion,
  kMailCIDs,
  kMailContracts,
  kMailCategories
};

NSMODULE_DEFN(nsMailCompsModule) = &kMailCompsModule;
