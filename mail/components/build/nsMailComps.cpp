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
 * The Original Code is Thunderbird.
 *
 * The Initial Developer of the Original Code is
 * IBM Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2004
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Brian Ryner <bryner@brianryner.com>
 *  Asaf Romano <mozilla.mano@sent.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

#include "mozilla/ModuleUtils.h"
#include "nsMailMigrationCID.h"
#include "nsProfileMigrator.h"
#include "nsSeamonkeyProfileMigrator.h"

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

#if defined(XP_WIN32) && (MOZ_WINSDK_TARGETVER >= MOZ_NTDDI_LONGHORN)
#include "nsMailWinSearchHelper.h"
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsMailWinSearchHelper, Init)
#endif

NS_DEFINE_NAMED_CID(NS_THUNDERBIRD_PROFILEIMPORT_CID);
NS_DEFINE_NAMED_CID(NS_SEAMONKEYPROFILEMIGRATOR_CID);

#ifdef XP_WIN32
NS_DEFINE_NAMED_CID(NS_OEXPRESSPROFILEMIGRATOR_CID);
NS_DEFINE_NAMED_CID(NS_OUTLOOKPROFILEMIGRATOR_CID);
NS_DEFINE_NAMED_CID(NS_MAILWININTEGRATION_CID);
#if MOZ_WINSDK_TARGETVER >= MOZ_NTDDI_LONGHORN
NS_DEFINE_NAMED_CID(NS_MAILWINSEARCHHELPER_CID);
#endif // MOZ_WINSDK_TARGETVER >= MOZ_NTDDI_LONGHORN
#endif // !XP_WIN32

#if defined (XP_WIN32) || defined (XP_MACOSX)
#ifndef __LP64__
NS_DEFINE_NAMED_CID(NS_EUDORAPROFILEMIGRATOR_CID);
#endif
#endif

#ifdef MOZ_WIDGET_GTK2
NS_DEFINE_NAMED_CID(NS_MAILGNOMEINTEGRATION_CID);
#endif

#ifdef XP_MACOSX
NS_DEFINE_NAMED_CID(NS_MAILMACINTEGRATION_CID);
#endif

const mozilla::Module::CIDEntry kMailCIDs[] = {
  { &kNS_THUNDERBIRD_PROFILEIMPORT_CID, false, NULL, nsProfileMigratorConstructor },
  { &kNS_SEAMONKEYPROFILEMIGRATOR_CID, false, NULL, nsSeamonkeyProfileMigratorConstructor },
#ifdef XP_WIN32
  { &kNS_OEXPRESSPROFILEMIGRATOR_CID, false, NULL, nsOEProfileMigratorConstructor },
  { &kNS_OUTLOOKPROFILEMIGRATOR_CID, false, NULL, nsOutlookProfileMigratorConstructor },
  { &kNS_MAILWININTEGRATION_CID, false, NULL, nsWindowsShellServiceConstructor },
#if MOZ_WINSDK_TARGETVER >= MOZ_NTDDI_LONGHORN
  { &kNS_MAILWINSEARCHHELPER_CID, false, NULL, nsMailWinSearchHelperConstructor },
#endif // MOZ_WINSDK_TARGETVER >= MOZ_NTDDI_LONGHORN
#endif // !XP_WIN32
#if defined (XP_WIN32) || defined (XP_MACOSX)
#ifndef __LP64__
  { &kNS_EUDORAPROFILEMIGRATOR_CID, false, NULL, nsEudoraProfileMigratorConstructor },
#endif
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
  { NS_PROFILEMIGRATOR_CONTRACTID, &kNS_THUNDERBIRD_PROFILEIMPORT_CID },
  { NS_MAILPROFILEMIGRATOR_CONTRACTID_PREFIX "seamonkey", &kNS_SEAMONKEYPROFILEMIGRATOR_CID },
#ifdef XP_WIN32
  { NS_MAILPROFILEMIGRATOR_CONTRACTID_PREFIX "oexpress", &kNS_OEXPRESSPROFILEMIGRATOR_CID },
  { NS_MAILPROFILEMIGRATOR_CONTRACTID_PREFIX "outlook", &kNS_OUTLOOKPROFILEMIGRATOR_CID },
  { "@mozilla.org/mail/shell-service;1", &kNS_MAILWININTEGRATION_CID },
#if MOZ_WINSDK_TARGETVER >= MOZ_NTDDI_LONGHORN
  { "@mozilla.org/mail/windows-search-helper;1", &kNS_MAILWINSEARCHHELPER_CID },
#endif // MOZ_WINSDK_TARGETVER >= MOZ_NTDDI_LONGHORN
#endif // !XP_WIN32
#if defined (XP_WIN32) || defined (XP_MACOSX)
#ifndef __LP64__
  { NS_MAILPROFILEMIGRATOR_CONTRACTID_PREFIX "eudora", &kNS_EUDORAPROFILEMIGRATOR_CID },
#endif
#endif
#ifdef MOZ_WIDGET_GTK2
  { "@mozilla.org/mail/shell-service;1", &kNS_MAILGNOMEINTEGRATION_CID },
#endif
#ifdef XP_MACOSX
  { "@mozilla.org/mail/shell-service;1", &kNS_MAILMACINTEGRATION_CID },
#endif
  { NULL }
};

static const mozilla::Module kMailCompsModule = {
  mozilla::Module::kVersion,
  kMailCIDs,
  kMailContracts
};

NSMODULE_DEFN(nsMailCompsModule) = &kMailCompsModule;

