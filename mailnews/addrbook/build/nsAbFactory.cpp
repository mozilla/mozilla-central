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

#include "mozilla/ModuleUtils.h"
#include "nsIFactory.h"
#include "nsISupports.h"
#include "nsIModule.h"

#include "nsAbBaseCID.h"
#include "pratom.h"
#include "nsICategoryManager.h"
#include "nsIComponentManager.h"
#include "nsIServiceManager.h"
#include "rdf.h"
#include "nsCOMPtr.h"

#include "nsDirectoryDataSource.h"
#include "nsAbBSDirectory.h"
#include "nsAbMDBDirectory.h"
#include "nsAbMDBCard.h"
#include "nsAbDirFactoryService.h"
#include "nsAbMDBDirFactory.h"
#include "nsAddrDatabase.h"
#include "nsAbManager.h"
#include "nsAbContentHandler.h"
#include "nsAbDirProperty.h"
#include "nsAbAddressCollector.h"
#include "nsAddbookProtocolHandler.h"
#include "nsAddbookUrl.h"
#include "nsCURILoader.h"

#include "nsAbDirectoryQuery.h"
#include "nsAbBooleanExpression.h"
#include "nsAbDirectoryQueryProxy.h"
#include "nsAbView.h"
#include "nsMsgVCardService.h"
#include "nsAbLDIFService.h"

#if defined(MOZ_LDAP_XPCOM)
#include "nsAbLDAPDirectory.h"
#include "nsAbLDAPDirectoryQuery.h"
#include "nsAbLDAPCard.h"
#include "nsAbLDAPDirFactory.h"
#include "nsAbLDAPAutoCompFormatter.h"
#include "nsAbLDAPReplicationService.h"
#include "nsAbLDAPReplicationQuery.h"
#include "nsAbLDAPReplicationData.h"
// XXX These files are not being built as they don't work. Bug 311632 should
// fix them.
//#include "nsAbLDAPChangeLogQuery.h"
//#include "nsAbLDAPChangeLogData.h"
#include "nsLDAPAutoCompleteSession.h"
#endif

#if defined(XP_WIN) && !defined(__MINGW32__)
#include "nsAbOutlookDirFactory.h"
#include "nsAbOutlookDirectory.h"
#endif

#ifdef XP_MACOSX
#include "nsAbOSXDirectory.h"
#include "nsAbOSXCard.h"
#include "nsAbOSXDirFactory.h"
#endif

NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsAbManager,Init)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbContentHandler)
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsAbDirectoryDataSource,Init)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbDirProperty)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbCardProperty)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbBSDirectory)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbMDBDirectory)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbMDBCard)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAddrDatabase)
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsAbAddressCollector,Init)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAddbookUrl)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbDirFactoryService)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbMDBDirFactory)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAddbookProtocolHandler)

#if defined(XP_WIN) && !defined(__MINGW32__)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbOutlookDirectory)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbOutlookDirFactory)
#endif

NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbDirectoryQueryArguments)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbBooleanConditionString)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbBooleanExpression)

#if defined(MOZ_LDAP_XPCOM)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbLDAPDirectory)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbLDAPDirectoryQuery)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbLDAPCard)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbLDAPDirFactory)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbLDAPAutoCompFormatter)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbLDAPReplicationService)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbLDAPReplicationQuery)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbLDAPProcessReplicationData)
// XXX These files are not being built as they don't work. Bug 311632 should
// fix them.
//NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbLDAPChangeLogQuery)
//NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbLDAPProcessChangeLogData)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsLDAPAutoCompleteSession)
#endif

NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbDirectoryQueryProxy)

#ifdef XP_MACOSX
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbOSXDirectory)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbOSXCard)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbOSXDirFactory)
#endif

NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbView)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgVCardService)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbLDIFService)

NS_DEFINE_NAMED_CID(NS_ABMANAGER_CID);
NS_DEFINE_NAMED_CID(NS_ABDIRECTORYDATASOURCE_CID);
NS_DEFINE_NAMED_CID(NS_ABDIRECTORY_CID);
NS_DEFINE_NAMED_CID(NS_ABMDBDIRECTORY_CID);
NS_DEFINE_NAMED_CID(NS_ABMDBCARD_CID);
NS_DEFINE_NAMED_CID(NS_ADDRDATABASE_CID);
NS_DEFINE_NAMED_CID(NS_ABCARDPROPERTY_CID);
NS_DEFINE_NAMED_CID(NS_ABDIRPROPERTY_CID);
NS_DEFINE_NAMED_CID(NS_ABADDRESSCOLLECTOR_CID);
NS_DEFINE_NAMED_CID(NS_ADDBOOKURL_CID);
NS_DEFINE_NAMED_CID(NS_ADDBOOK_HANDLER_CID);
NS_DEFINE_NAMED_CID(NS_ABCONTENTHANDLER_CID);
NS_DEFINE_NAMED_CID(NS_ABDIRFACTORYSERVICE_CID);
NS_DEFINE_NAMED_CID(NS_ABMDBDIRFACTORY_CID);
NS_DEFINE_NAMED_CID(NS_ABDIRECTORYQUERYARGUMENTS_CID);
NS_DEFINE_NAMED_CID(NS_BOOLEANCONDITIONSTRING_CID);
NS_DEFINE_NAMED_CID(NS_BOOLEANEXPRESSION_CID);
#if defined(XP_WIN) && !defined(__MINGW32__)
NS_DEFINE_NAMED_CID(NS_ABOUTLOOKDIRECTORY_CID);
NS_DEFINE_NAMED_CID(NS_ABOUTLOOKDIRFACTORY_CID);
#endif
#if defined(MOZ_LDAP_XPCOM)
NS_DEFINE_NAMED_CID(NS_ABLDAPDIRECTORY_CID);
NS_DEFINE_NAMED_CID(NS_ABLDAPDIRECTORYQUERY_CID);
NS_DEFINE_NAMED_CID(NS_ABLDAPCARD_CID);
NS_DEFINE_NAMED_CID(NS_ABLDAPDIRFACTORY_CID);
NS_DEFINE_NAMED_CID(NS_ABLDAP_REPLICATIONSERVICE_CID);
NS_DEFINE_NAMED_CID(NS_ABLDAP_REPLICATIONQUERY_CID);
NS_DEFINE_NAMED_CID(NS_ABLDAP_PROCESSREPLICATIONDATA_CID);
NS_DEFINE_NAMED_CID(NS_ABLDAPAUTOCOMPFORMATTER_CID);
NS_DEFINE_NAMED_CID(NS_LDAPAUTOCOMPLETESESSION_CID);
#endif
NS_DEFINE_NAMED_CID(NS_ABDIRECTORYQUERYPROXY_CID);
#ifdef XP_MACOSX
NS_DEFINE_NAMED_CID(NS_ABOSXDIRECTORY_CID);
NS_DEFINE_NAMED_CID(NS_ABOSXCARD_CID);
NS_DEFINE_NAMED_CID(NS_ABOSXDIRFACTORY_CID);
#endif
NS_DEFINE_NAMED_CID(NS_ABVIEW_CID);
NS_DEFINE_NAMED_CID(NS_MSGVCARDSERVICE_CID);
NS_DEFINE_NAMED_CID(NS_ABLDIFSERVICE_CID);

const mozilla::Module::CIDEntry kAddressBookCIDs[] = {
  { &kNS_ABMANAGER_CID, false, NULL, nsAbManagerConstructor },
  { &kNS_ABDIRECTORYDATASOURCE_CID, false, NULL, nsAbDirectoryDataSourceConstructor },
  { &kNS_ABDIRECTORY_CID, false, NULL, nsAbBSDirectoryConstructor },
  { &kNS_ABMDBDIRECTORY_CID, false, NULL, nsAbMDBDirectoryConstructor },
  { &kNS_ABMDBCARD_CID, false, NULL, nsAbMDBCardConstructor },
  { &kNS_ADDRDATABASE_CID, false, NULL, nsAddrDatabaseConstructor },
  { &kNS_ABCARDPROPERTY_CID, false, NULL, nsAbCardPropertyConstructor },
  { &kNS_ABDIRPROPERTY_CID, false, NULL, nsAbDirPropertyConstructor },
  { &kNS_ABADDRESSCOLLECTOR_CID, false, NULL, nsAbAddressCollectorConstructor },
  { &kNS_ADDBOOKURL_CID, false, NULL, nsAddbookUrlConstructor },
  { &kNS_ADDBOOK_HANDLER_CID, false, NULL, nsAddbookProtocolHandlerConstructor },
  { &kNS_ABCONTENTHANDLER_CID, false, NULL, nsAbContentHandlerConstructor },
  { &kNS_ABDIRFACTORYSERVICE_CID, false, NULL, nsAbDirFactoryServiceConstructor },
  { &kNS_ABMDBDIRFACTORY_CID, false, NULL, nsAbMDBDirFactoryConstructor },
#if defined(XP_WIN) && !defined(__MINGW32__)
  { &kNS_ABOUTLOOKDIRECTORY_CID, false, NULL, nsAbOutlookDirectoryConstructor },
  { &kNS_ABOUTLOOKDIRFACTORY_CID, false, NULL, nsAbOutlookDirFactoryConstructor },
#endif
  { &kNS_ABDIRECTORYQUERYARGUMENTS_CID, false, NULL, nsAbDirectoryQueryArgumentsConstructor },
  { &kNS_BOOLEANCONDITIONSTRING_CID, false, NULL, nsAbBooleanConditionStringConstructor },
  { &kNS_BOOLEANEXPRESSION_CID, false, NULL, nsAbBooleanExpressionConstructor },
#if defined(MOZ_LDAP_XPCOM)
  { &kNS_ABLDAPDIRECTORY_CID, false, NULL, nsAbLDAPDirectoryConstructor },
  { &kNS_ABLDAPDIRECTORYQUERY_CID, false, NULL, nsAbLDAPDirectoryQueryConstructor },
  { &kNS_ABLDAPCARD_CID, false, NULL, nsAbLDAPCardConstructor },
  { &kNS_ABLDAP_REPLICATIONSERVICE_CID, false, NULL, nsAbLDAPReplicationServiceConstructor },
  { &kNS_ABLDAP_REPLICATIONQUERY_CID, false, NULL, nsAbLDAPReplicationQueryConstructor },
  { &kNS_ABLDAP_PROCESSREPLICATIONDATA_CID, false, NULL, nsAbLDAPProcessReplicationDataConstructor },
  { &kNS_ABLDAPDIRFACTORY_CID, false, NULL, nsAbLDAPDirFactoryConstructor },
  { &kNS_ABLDAPAUTOCOMPFORMATTER_CID, false, NULL, nsAbLDAPAutoCompFormatterConstructor },
  { &kNS_LDAPAUTOCOMPLETESESSION_CID, false, NULL, nsLDAPAutoCompleteSessionConstructor },
#endif
  { &kNS_ABDIRECTORYQUERYPROXY_CID, false, NULL, nsAbDirectoryQueryProxyConstructor },
#ifdef XP_MACOSX
  { &kNS_ABOSXDIRECTORY_CID, false, NULL, nsAbOSXDirectoryConstructor },
  { &kNS_ABOSXCARD_CID, false, NULL, nsAbOSXCardConstructor },
  { &kNS_ABOSXDIRFACTORY_CID, false, NULL, nsAbOSXDirFactoryConstructor },
#endif
  { &kNS_ABVIEW_CID, false, NULL, nsAbViewConstructor },
  { &kNS_MSGVCARDSERVICE_CID, false, NULL, nsMsgVCardServiceConstructor },
  { &kNS_ABLDIFSERVICE_CID, false, NULL, nsAbLDIFServiceConstructor },
  { NULL }
};

const mozilla::Module::ContractIDEntry kAddressBookContracts[] = {
  { NS_ABMANAGER_CONTRACTID, &kNS_ABMANAGER_CID },
  { NS_ABMANAGERSTARTUPHANDLER_CONTRACTID, &kNS_ABMANAGER_CID},
  { NS_ABDIRECTORYDATASOURCE_CONTRACTID, &kNS_ABDIRECTORYDATASOURCE_CID},
  { NS_ABDIRECTORY_CONTRACTID, &kNS_ABDIRECTORY_CID},
  { NS_ABMDBDIRECTORY_CONTRACTID, &kNS_ABMDBDIRECTORY_CID},
  { NS_ABMDBCARD_CONTRACTID, &kNS_ABMDBCARD_CID},
  { NS_ADDRDATABASE_CONTRACTID, &kNS_ADDRDATABASE_CID},
  { NS_ABCARDPROPERTY_CONTRACTID, &kNS_ABCARDPROPERTY_CID},
  { NS_ABDIRPROPERTY_CONTRACTID, &kNS_ABDIRPROPERTY_CID},
  { NS_ABADDRESSCOLLECTOR_CONTRACTID, &kNS_ABADDRESSCOLLECTOR_CID},
  { NS_ADDBOOKURL_CONTRACTID, &kNS_ADDBOOKURL_CID},
  { NS_NETWORK_PROTOCOL_CONTRACTID_PREFIX "addbook", &kNS_ADDBOOK_HANDLER_CID},
  { NS_CONTENT_HANDLER_CONTRACTID_PREFIX"application/x-addvcard", &kNS_ABCONTENTHANDLER_CID},
  { NS_CONTENT_HANDLER_CONTRACTID_PREFIX"text/x-vcard", &kNS_ABCONTENTHANDLER_CID},
  { NS_ABDIRFACTORYSERVICE_CONTRACTID, &kNS_ABDIRFACTORYSERVICE_CID},
  { NS_ABMDBDIRFACTORY_CONTRACTID, &kNS_ABMDBDIRFACTORY_CID},
#if defined(XP_WIN) && !defined(__MINGW32__)
  { NS_ABOUTLOOKDIRECTORY_CONTRACTID, &kNS_ABOUTLOOKDIRECTORY_CID},
  { NS_ABOUTLOOKDIRFACTORY_CONTRACTID, &kNS_ABOUTLOOKDIRFACTORY_CID},
#endif
  { NS_ABDIRECTORYQUERYARGUMENTS_CONTRACTID, &kNS_ABDIRECTORYQUERYARGUMENTS_CID},
  { NS_BOOLEANCONDITIONSTRING_CONTRACTID, &kNS_BOOLEANCONDITIONSTRING_CID},
  { NS_BOOLEANEXPRESSION_CONTRACTID, &kNS_BOOLEANEXPRESSION_CID},
#if defined(MOZ_LDAP_XPCOM)
  { NS_ABLDAPDIRECTORY_CONTRACTID, &kNS_ABLDAPDIRECTORY_CID},
  { NS_ABLDAPDIRECTORYQUERY_CONTRACTID, &kNS_ABLDAPDIRECTORYQUERY_CID},
  { NS_ABLDAPCARD_CONTRACTID, &kNS_ABLDAPCARD_CID},
  { NS_ABLDAPDIRFACTORY_CONTRACTID, &kNS_ABLDAPDIRFACTORY_CID},
  { NS_ABLDAP_REPLICATIONSERVICE_CONTRACTID, &kNS_ABLDAP_REPLICATIONSERVICE_CID},
  { NS_ABLDAP_REPLICATIONQUERY_CONTRACTID, &kNS_ABLDAP_REPLICATIONQUERY_CID},
  { NS_ABLDAP_PROCESSREPLICATIONDATA_CONTRACTID, &kNS_ABLDAP_PROCESSREPLICATIONDATA_CID},
  { NS_ABLDAPACDIRFACTORY_CONTRACTID, &kNS_ABLDAPDIRFACTORY_CID},
  { NS_ABLDAPSACDIRFACTORY_CONTRACTID, &kNS_ABLDAPDIRFACTORY_CID},
  { NS_ABLDAPAUTOCOMPFORMATTER_CONTRACTID, &kNS_ABLDAPAUTOCOMPFORMATTER_CID},
  { "@mozilla.org/autocompleteSession;1?type=ldap", &kNS_LDAPAUTOCOMPLETESESSION_CID},
#endif
  { NS_ABDIRECTORYQUERYPROXY_CONTRACTID, &kNS_ABDIRECTORYQUERYPROXY_CID},
#ifdef XP_MACOSX
  { NS_ABOSXDIRECTORY_CONTRACTID, &kNS_ABOSXDIRECTORY_CID},
  { NS_ABOSXCARD_CONTRACTID, &kNS_ABOSXCARD_CID},
  { NS_ABOSXDIRFACTORY_CONTRACTID, &kNS_ABOSXDIRFACTORY_CID},
#endif
  { NS_ABVIEW_CONTRACTID, &kNS_ABVIEW_CID},
  { NS_MSGVCARDSERVICE_CONTRACTID, &kNS_MSGVCARDSERVICE_CID},
  { NS_ABLDIFSERVICE_CONTRACTID, &kNS_ABLDIFSERVICE_CID},
  { NULL }
};

static const mozilla::Module::CategoryEntry kAddressBookCategories[] = {
  { "command-line-handler", "m-addressbook", NS_ABMANAGERSTARTUPHANDLER_CONTRACTID},
  { NULL }
};

static void
msgAbModuleDtor()
{
  nsAddrDatabase::CleanupCache();
}

static const mozilla::Module kAddressBookModule = {
  mozilla::Module::kVersion,
  kAddressBookCIDs,
  kAddressBookContracts,
  NULL,
  NULL,
  NULL,
  msgAbModuleDtor
};

NSMODULE_DEFN(addressbook) = &kAddressBookModule;


