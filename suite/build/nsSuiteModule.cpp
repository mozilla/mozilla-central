/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
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
 *   Joe Hewitt <hewitt@netscape.com> (Original Author)
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

#include "nsIGenericFactory.h"
#include "nsSuiteDirectoryProvider.h"
#include "nsProfileMigrator.h"
#include "nsSeamonkeyProfileMigrator.h"
#include "nsThunderbirdProfileMigrator.h"
#include "nsInternetSearchService.h"
#include "nsLocalSearchService.h"
#include "nsIGenericFactory.h"
#include "nsRDFCID.h"
#include "nsBookmarksService.h"

#if defined(XP_WIN)
#include "nsUrlWidget.h"
#include "nsWindowsShellService.h"
#endif

/////////////////////////////////////////////////////////////////////////////

#if defined(XP_WIN)
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsUrlWidget, Init)
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsWindowsShellService, Init)
#endif // Windows
NS_GENERIC_FACTORY_CONSTRUCTOR(nsSuiteDirectoryProvider)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsProfileMigrator)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsSeamonkeyProfileMigrator)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsThunderbirdProfileMigrator)
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(LocalSearchDataSource, Init)
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(InternetSearchDataSource, Init)
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsBookmarksService, Init)

/////////////////////////////////////////////////////////////////////////////

static const nsModuleComponentInfo components[] = {
#ifdef XP_WIN
  { NS_IURLWIDGET_CLASSNAME, NS_IURLWIDGET_CID,
    NS_IURLWIDGET_CONTRACTID, nsUrlWidgetConstructor },
  { "SeaMonkey Windows Integration",
    NS_SUITEWININTEGRATION_CID,
    NS_SUITEWININTEGRATION_CONTRACTID,
    nsWindowsShellServiceConstructor },
#endif // XP_WIN

  { "nsSuiteDirectoryProvider",
    NS_SUITEDIRECTORYPROVIDER_CID,
    NS_SUITEDIRECTORYPROVIDER_CONTRACTID,
    nsSuiteDirectoryProviderConstructor,
    nsSuiteDirectoryProvider::Register,
    nsSuiteDirectoryProvider::Unregister },

  { "Profile Migrator",
    NS_SUITEPROFILEMIGRATOR_CID,
    NS_PROFILEMIGRATOR_CONTRACTID,
    nsProfileMigratorConstructor },
  
  { "SeaMonkey Profile Migrator",
    NS_SEAMONKEYPROFILEMIGRATOR_CID,
    NS_SUITEPROFILEMIGRATOR_CONTRACTID_PREFIX "seamonkey",
    nsSeamonkeyProfileMigratorConstructor },

  { "Thunderbird Profile Migrator",
    NS_THUNDERBIRDPROFILEMIGRATOR_CID,
    NS_SUITEPROFILEMIGRATOR_CONTRACTID_PREFIX "thunderbird",
    nsThunderbirdProfileMigratorConstructor },

  { "Local Search",
    NS_RDFFINDDATASOURCE_CID,
    NS_LOCALSEARCH_SERVICE_CONTRACTID,
    LocalSearchDataSourceConstructor },

  { "Local Search",
    NS_RDFFINDDATASOURCE_CID,
    NS_LOCALSEARCH_DATASOURCE_CONTRACTID,
    LocalSearchDataSourceConstructor },

  { "Internet Search",
    NS_RDFSEARCHDATASOURCE_CID,
    NS_INTERNETSEARCH_SERVICE_CONTRACTID,
    InternetSearchDataSourceConstructor },

  { "Internet Search",
    NS_RDFSEARCHDATASOURCE_CID,
    NS_INTERNETSEARCH_DATASOURCE_CONTRACTID,
    InternetSearchDataSourceConstructor },

  { "Bookmarks",
    NS_BOOKMARKS_SERVICE_CID,
    NS_BOOKMARKS_SERVICE_CONTRACTID,
    nsBookmarksServiceConstructor },

  { "Bookmarks",
    NS_BOOKMARKS_SERVICE_CID,
    "@mozilla.org/embeddor.implemented/bookmark-charset-resolver;1",
    nsBookmarksServiceConstructor },

  { "Bookmarks",
    NS_BOOKMARKS_SERVICE_CID,
    NS_BOOKMARKS_DATASOURCE_CONTRACTID,
    nsBookmarksServiceConstructor }
};

NS_IMPL_NSGETMODULE(SuiteModule, components)
