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
 *   Pierre Phaneuf <pp@ludusdesign.com>
 *   Seth Spitzer <sspitzer@netscape.com>
 *   Karsten Düsterloh <mnyromyr@tprac.de>
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

/* ****************************************************************************
 * ATTENTION! ATTENTION! ATTENTION! ATTENTION! ATTENTION! ATTENTION! ATTENTION!
 * ATTENTION! ATTENTION! ATTENTION! ATTENTION! ATTENTION! ATTENTION! ATTENTION!
 * 
 * ATTENTION! ATTENTION! ATTENTION! ATTENTION! ATTENTION! ATTENTION! ATTENTION!
 * ATTENTION! ATTENTION! ATTENTION! ATTENTION! ATTENTION! ATTENTION! ATTENTION!
 * 
 * Dear Mortals,
 * 
 * Please be advised that if you are adding something here, you should also
 * strongly consider adding it to mailnews/build/nsMailModule.cpp as well!
 * 
 * If you do not, your dynamic builds will be quite pleasant, but (static)
 * release builds will disappoint you by not having your component in them.
 * 
 * Yours truly,
 * The ghost that haunts the MailNews codebase.
 * 
 * ATTENTION! ATTENTION! ATTENTION! ATTENTION! ATTENTION! ATTENTION! ATTENTION!
 * ATTENTION! ATTENTION! ATTENTION! ATTENTION! ATTENTION! ATTENTION! ATTENTION!
 * 
 * ATTENTION! ATTENTION! ATTENTION! ATTENTION! ATTENTION! ATTENTION! ATTENTION!
 * ATTENTION! ATTENTION! ATTENTION! ATTENTION! ATTENTION! ATTENTION! ATTENTION!
 * ****************************************************************************/

#include "mozilla/ModuleUtils.h"
#include "nsIFactory.h"
#include "nsISupports.h"
#include "msgCore.h"
#include "nsIModule.h"
#include "nsMsgBaseCID.h"
#include "pratom.h"
#include "nsICategoryManager.h"
#include "nsIComponentManager.h"
#include "nsIServiceManager.h"
#include "rdf.h"
#include "nsCOMPtr.h"

#include "nsMessengerBootstrap.h"
#include "nsMessenger.h"

#include "nsIContentViewer.h"

/* Include all of the interfaces our factory can generate components for */

#include "nsMsgMailSession.h"
#include "nsMsgAccount.h"
#include "nsMsgAccountManager.h"
#include "nsMsgIdentity.h"
#include "nsMsgIncomingServer.h"
#include "nsMsgFolderDataSource.h"

#include "nsMsgAccountManagerDS.h"

#include "nsMsgBiffManager.h"
#include "nsMsgPurgeService.h"
#include "nsStatusBarBiffManager.h"

#include "nsCopyMessageStreamListener.h"
#include "nsMsgCopyService.h"

#include "nsMsgFolderCache.h"

#include "nsMsgStatusFeedback.h"

#include "nsMsgFilterService.h"
#include "nsMsgWindow.h"

#include "nsMsgServiceProvider.h"
#include "nsSubscribeDataSource.h"
#include "nsSubscribableServer.h"

#ifdef NS_PRINTING
#include "nsMsgPrintEngine.h"
#endif
#include "nsMsgSearchSession.h"
#include "nsMsgSearchTerm.h"
#include "nsMsgSearchAdapter.h"
#include "nsMsgFolderCompactor.h"
#include "nsMsgThreadedDBView.h"
#include "nsMsgSpecialViews.h"
#include "nsMsgXFVirtualFolderDBView.h"
#include "nsMsgQuickSearchDBView.h"
#include "nsMsgGroupView.h"

#include "nsMsgOfflineManager.h"

#include "nsMsgProgress.h"
#include "nsSpamSettings.h"
#include "nsMsgContentPolicy.h"
#include "nsCidProtocolHandler.h"
#include "nsMsgTagService.h"
#include "nsMsgFolderNotificationService.h"

#include "nsMailDirProvider.h"
#include "nsServiceManagerUtils.h"

#ifdef XP_WIN
#include "nsMessengerWinIntegration.h"
#endif
#ifdef XP_OS2
#include "nsMessengerOS2Integration.h"
#endif
#ifdef XP_MACOSX
#include "nsMessengerOSXIntegration.h"
#endif
#if defined(MOZ_WIDGET_GTK) || defined(MOZ_WIDGET_GTK2)
#include "nsMessengerUnixIntegration.h"
#endif

#include "nsCURILoader.h"
#include "nsMessengerContentHandler.h"

#include "nsStopwatch.h"

#include "MailNewsDLF.h"

using namespace mozilla::mailnews;

// private factory declarations for each component we know how to produce

NS_GENERIC_FACTORY_CONSTRUCTOR(nsMessengerBootstrap)
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsMsgMailSession, Init)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMessenger)
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsMsgAccountManager, Init)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgAccount)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgIdentity)
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsMsgFolderDataSource, Init)
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsMsgUnreadFoldersDataSource, Init)
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsMsgFavoriteFoldersDataSource, Init)
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsMsgRecentFoldersDataSource, Init)
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsMsgAccountManagerDataSource, Init)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgSearchSession)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgSearchTerm)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgSearchValidityManager)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgFilterService)
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsMsgBiffManager, Init)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgPurgeService)
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsStatusBarBiffManager, Init)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsCopyMessageStreamListener)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgCopyService)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgFolderCache)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgStatusFeedback)
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsMsgWindow,Init)
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsMsgServiceProviderService, Init)
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsSubscribeDataSource, Init)
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsSubscribableServer, Init)
#ifdef NS_PRINTING
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgPrintEngine)
#endif
NS_GENERIC_FACTORY_CONSTRUCTOR(nsFolderCompactState)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsOfflineStoreCompactState)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgThreadedDBView)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgThreadsWithUnreadDBView)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgWatchedThreadsWithUnreadDBView)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgSearchDBView)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgXFVirtualFolderDBView)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgQuickSearchDBView)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgGroupView)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgOfflineManager)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgProgress)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsSpamSettings)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsCidProtocolHandler)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgTagService)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgFolderNotificationService)
#ifdef XP_WIN
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsMessengerWinIntegration, Init)
#endif
#ifdef XP_OS2
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsMessengerOS2Integration, Init)
#endif
#ifdef XP_MACOSX
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsMessengerOSXIntegration, Init)
#endif
#if defined(MOZ_WIDGET_GTK) || defined(MOZ_WIDGET_GTK2)
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsMessengerUnixIntegration, Init)
#endif
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMessengerContentHandler)
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsMsgContentPolicy, Init)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMailDirProvider)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgShutdownService)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsStopwatch)
NS_GENERIC_FACTORY_CONSTRUCTOR(MailNewsDLF)

NS_DEFINE_NAMED_CID(NS_MESSENGERBOOTSTRAP_CID);
NS_DEFINE_NAMED_CID(NS_MESSENGERWINDOWSERVICE_CID);
NS_DEFINE_NAMED_CID(NS_MSGMAILSESSION_CID);
NS_DEFINE_NAMED_CID(NS_MESSENGER_CID);
NS_DEFINE_NAMED_CID(NS_MSGACCOUNTMANAGER_CID);
NS_DEFINE_NAMED_CID(NS_MSGACCOUNT_CID);
NS_DEFINE_NAMED_CID(NS_MSGIDENTITY_CID);
NS_DEFINE_NAMED_CID(NS_MAILNEWSFOLDERDATASOURCE_CID);
NS_DEFINE_NAMED_CID(NS_MAILNEWSUNREADFOLDERDATASOURCE_CID);
NS_DEFINE_NAMED_CID(NS_MAILNEWSFAVORITEFOLDERDATASOURCE_CID);
NS_DEFINE_NAMED_CID(NS_MAILNEWSRECENTFOLDERDATASOURCE_CID);
NS_DEFINE_NAMED_CID(NS_MSGACCOUNTMANAGERDATASOURCE_CID);
NS_DEFINE_NAMED_CID(NS_MSGFILTERSERVICE_CID);
NS_DEFINE_NAMED_CID(NS_MSGSEARCHSESSION_CID);
NS_DEFINE_NAMED_CID(NS_MSGSEARCHTERM_CID);
NS_DEFINE_NAMED_CID(NS_MSGSEARCHVALIDITYMANAGER_CID);
NS_DEFINE_NAMED_CID(NS_MSGBIFFMANAGER_CID);
NS_DEFINE_NAMED_CID(NS_MSGPURGESERVICE_CID);
NS_DEFINE_NAMED_CID(NS_STATUSBARBIFFMANAGER_CID);
NS_DEFINE_NAMED_CID(NS_COPYMESSAGESTREAMLISTENER_CID);
NS_DEFINE_NAMED_CID(NS_MSGCOPYSERVICE_CID);
NS_DEFINE_NAMED_CID(NS_MSGFOLDERCACHE_CID);
NS_DEFINE_NAMED_CID(NS_MSGSTATUSFEEDBACK_CID);
NS_DEFINE_NAMED_CID(NS_MSGWINDOW_CID);
#ifdef NS_PRINTING
NS_DEFINE_NAMED_CID(NS_MSG_PRINTENGINE_CID);
#endif
NS_DEFINE_NAMED_CID(NS_MSGSERVICEPROVIDERSERVICE_CID);
NS_DEFINE_NAMED_CID(NS_SUBSCRIBEDATASOURCE_CID);
NS_DEFINE_NAMED_CID(NS_SUBSCRIBABLESERVER_CID);
NS_DEFINE_NAMED_CID(NS_MSGLOCALFOLDERCOMPACTOR_CID);
NS_DEFINE_NAMED_CID(NS_MSG_OFFLINESTORECOMPACTOR_CID);
NS_DEFINE_NAMED_CID(NS_MSGTHREADEDDBVIEW_CID);
NS_DEFINE_NAMED_CID(NS_MSGTHREADSWITHUNREADDBVIEW_CID);
NS_DEFINE_NAMED_CID(NS_MSGWATCHEDTHREADSWITHUNREADDBVIEW_CID);
NS_DEFINE_NAMED_CID(NS_MSGSEARCHDBVIEW_CID);
NS_DEFINE_NAMED_CID(NS_MSGQUICKSEARCHDBVIEW_CID);
NS_DEFINE_NAMED_CID(NS_MSG_XFVFDBVIEW_CID);
NS_DEFINE_NAMED_CID(NS_MSG_GROUPDBVIEW_CID);
NS_DEFINE_NAMED_CID(NS_MSGOFFLINEMANAGER_CID);
NS_DEFINE_NAMED_CID(NS_MSGPROGRESS_CID);
NS_DEFINE_NAMED_CID(NS_SPAMSETTINGS_CID);
NS_DEFINE_NAMED_CID(NS_CIDPROTOCOL_CID);
NS_DEFINE_NAMED_CID(NS_MSGTAGSERVICE_CID);
NS_DEFINE_NAMED_CID(NS_MSGNOTIFICATIONSERVICE_CID);
#ifdef XP_WIN
NS_DEFINE_NAMED_CID(NS_MESSENGERWININTEGRATION_CID);
#endif
#ifdef XP_OS2
NS_DEFINE_NAMED_CID(NS_MESSENGEROS2INTEGRATION_CID);
#endif
#ifdef XP_MACOSX
NS_DEFINE_NAMED_CID(NS_MESSENGEROSXINTEGRATION_CID);
#endif
#if defined(MOZ_WIDGET_GTK) || defined(MOZ_WIDGET_GTK2)
NS_DEFINE_NAMED_CID(NS_MESSENGERUNIXINTEGRATION_CID);
#endif
NS_DEFINE_NAMED_CID(NS_MESSENGERCONTENTHANDLER_CID);
NS_DEFINE_NAMED_CID(NS_MSGCONTENTPOLICY_CID);
NS_DEFINE_NAMED_CID(NS_MSGSHUTDOWNSERVICE_CID);
NS_DEFINE_NAMED_CID(MAILDIRPROVIDER_CID);
NS_DEFINE_NAMED_CID(NS_STOPWATCH_CID);
NS_DEFINE_NAMED_CID(NS_MAILNEWSDLF_CID);

const mozilla::Module::CIDEntry kMailNewsBaseCIDs[] = {
  { &kNS_MESSENGERBOOTSTRAP_CID, false, NULL, nsMessengerBootstrapConstructor },
  { &kNS_MESSENGERWINDOWSERVICE_CID, false, NULL, nsMessengerBootstrapConstructor },
  { &kNS_MSGMAILSESSION_CID, false, NULL, nsMsgMailSessionConstructor },
  { &kNS_MESSENGER_CID, false, NULL, nsMessengerConstructor },
  { &kNS_MSGACCOUNTMANAGER_CID, false, NULL, nsMsgAccountManagerConstructor },
  { &kNS_MSGACCOUNT_CID, false, NULL, nsMsgAccountConstructor },
  { &kNS_MSGIDENTITY_CID, false, NULL, nsMsgIdentityConstructor },
  { &kNS_MAILNEWSFOLDERDATASOURCE_CID, false, NULL, nsMsgFolderDataSourceConstructor },
  { &kNS_MAILNEWSUNREADFOLDERDATASOURCE_CID, false, NULL, nsMsgUnreadFoldersDataSourceConstructor },
  { &kNS_MAILNEWSFAVORITEFOLDERDATASOURCE_CID, false, NULL, nsMsgFavoriteFoldersDataSourceConstructor },
  { &kNS_MAILNEWSRECENTFOLDERDATASOURCE_CID, false, NULL, nsMsgRecentFoldersDataSourceConstructor },
  { &kNS_MSGACCOUNTMANAGERDATASOURCE_CID, false, NULL, nsMsgAccountManagerDataSourceConstructor },
  { &kNS_MSGFILTERSERVICE_CID, false, NULL, nsMsgFilterServiceConstructor },
  { &kNS_MSGSEARCHSESSION_CID, false, NULL, nsMsgSearchSessionConstructor },
  { &kNS_MSGSEARCHTERM_CID, false, NULL, nsMsgSearchTermConstructor },
  { &kNS_MSGSEARCHVALIDITYMANAGER_CID, false, NULL, nsMsgSearchValidityManagerConstructor },
  { &kNS_MSGBIFFMANAGER_CID, false, NULL, nsMsgBiffManagerConstructor },
  { &kNS_MSGPURGESERVICE_CID, false, NULL, nsMsgPurgeServiceConstructor },
  { &kNS_STATUSBARBIFFMANAGER_CID, false, NULL, nsStatusBarBiffManagerConstructor },
  { &kNS_COPYMESSAGESTREAMLISTENER_CID, false, NULL, nsCopyMessageStreamListenerConstructor },
  { &kNS_MSGCOPYSERVICE_CID, false, NULL, nsMsgCopyServiceConstructor },
  { &kNS_MSGFOLDERCACHE_CID, false, NULL, nsMsgFolderCacheConstructor },
  { &kNS_MSGSTATUSFEEDBACK_CID, false, NULL, nsMsgStatusFeedbackConstructor },
  { &kNS_MSGWINDOW_CID, false, NULL, nsMsgWindowConstructor },
#ifdef NS_PRINTING
  { &kNS_MSG_PRINTENGINE_CID, false, NULL, nsMsgPrintEngineConstructor },
#endif
  { &kNS_MSGSERVICEPROVIDERSERVICE_CID, false, NULL, nsMsgServiceProviderServiceConstructor },
  { &kNS_SUBSCRIBEDATASOURCE_CID, false, NULL, nsSubscribeDataSourceConstructor },
  { &kNS_SUBSCRIBABLESERVER_CID, false, NULL, nsSubscribableServerConstructor },
  { &kNS_MSGLOCALFOLDERCOMPACTOR_CID, false, NULL, nsFolderCompactStateConstructor },
  { &kNS_MSG_OFFLINESTORECOMPACTOR_CID, false, NULL, nsOfflineStoreCompactStateConstructor },
  { &kNS_MSGTHREADEDDBVIEW_CID, false, NULL, nsMsgThreadedDBViewConstructor },
  { &kNS_MSGTHREADSWITHUNREADDBVIEW_CID, false, NULL, nsMsgThreadsWithUnreadDBViewConstructor },
  { &kNS_MSGWATCHEDTHREADSWITHUNREADDBVIEW_CID, false, NULL, nsMsgWatchedThreadsWithUnreadDBViewConstructor },
  { &kNS_MSGSEARCHDBVIEW_CID, false, NULL, nsMsgSearchDBViewConstructor },
  { &kNS_MSGQUICKSEARCHDBVIEW_CID, false, NULL, nsMsgQuickSearchDBViewConstructor },
  { &kNS_MSG_XFVFDBVIEW_CID, false, NULL, nsMsgXFVirtualFolderDBViewConstructor },
  { &kNS_MSG_GROUPDBVIEW_CID, false, NULL, nsMsgGroupViewConstructor },
  { &kNS_MSGOFFLINEMANAGER_CID, false, NULL, nsMsgOfflineManagerConstructor },
  { &kNS_MSGPROGRESS_CID, false, NULL, nsMsgProgressConstructor },
  { &kNS_SPAMSETTINGS_CID, false, NULL, nsSpamSettingsConstructor },
  { &kNS_CIDPROTOCOL_CID, false, NULL, nsCidProtocolHandlerConstructor },
  { &kNS_MSGTAGSERVICE_CID, false, NULL, nsMsgTagServiceConstructor },
  { &kNS_MSGNOTIFICATIONSERVICE_CID, false, NULL, nsMsgFolderNotificationServiceConstructor },
#ifdef XP_WIN
  { &kNS_MESSENGERWININTEGRATION_CID, false, NULL, nsMessengerWinIntegrationConstructor },
#endif
#ifdef XP_OS2
  { &kNS_MESSENGEROS2INTEGRATION_CID, false, NULL, nsMessengerOS2IntegrationConstructor },
#endif
#ifdef XP_MACOSX
  { &kNS_MESSENGEROSXINTEGRATION_CID, false, NULL, nsMessengerOSXIntegrationConstructor },
#endif
#if defined(MOZ_WIDGET_GTK) || defined(MOZ_WIDGET_GTK2)
  { &kNS_MESSENGERUNIXINTEGRATION_CID, false, NULL, nsMessengerUnixIntegrationConstructor },
#endif
  { &kNS_MESSENGERCONTENTHANDLER_CID, false, NULL, nsMessengerContentHandlerConstructor },
  { &kNS_MSGCONTENTPOLICY_CID, false, NULL, nsMsgContentPolicyConstructor },
  { &kNS_MSGSHUTDOWNSERVICE_CID, false, NULL, nsMsgShutdownServiceConstructor },
  { &kMAILDIRPROVIDER_CID, false, NULL, nsMailDirProviderConstructor },
  { &kNS_STOPWATCH_CID, false, NULL, nsStopwatchConstructor },
  { &kNS_MAILNEWSDLF_CID, false, NULL, MailNewsDLFConstructor },
  {NULL}
};

const mozilla::Module::ContractIDEntry kMailNewsBaseContracts[] = {
  { NS_MESSENGERBOOTSTRAP_CONTRACTID, &kNS_MESSENGERBOOTSTRAP_CID },
  { NS_MESSENGERWINDOWSERVICE_CONTRACTID, &kNS_MESSENGERWINDOWSERVICE_CID },
  { NS_MSGMAILSESSION_CONTRACTID, &kNS_MSGMAILSESSION_CID },
  { NS_MESSENGER_CONTRACTID, &kNS_MESSENGER_CID },
  { NS_MSGACCOUNTMANAGER_CONTRACTID, &kNS_MSGACCOUNTMANAGER_CID },
  { NS_MSGACCOUNT_CONTRACTID, &kNS_MSGACCOUNT_CID },
  { NS_MSGIDENTITY_CONTRACTID, &kNS_MSGIDENTITY_CID },
  { NS_MAILNEWSFOLDERDATASOURCE_CONTRACTID, &kNS_MAILNEWSFOLDERDATASOURCE_CID },
  { NS_MAILNEWSUNREADFOLDERDATASOURCE_CONTRACTID, &kNS_MAILNEWSUNREADFOLDERDATASOURCE_CID },
  { NS_MAILNEWSFAVORITEFOLDERDATASOURCE_CONTRACTID, &kNS_MAILNEWSFAVORITEFOLDERDATASOURCE_CID },
  { NS_MAILNEWSRECENTFOLDERDATASOURCE_CONTRACTID, &kNS_MAILNEWSRECENTFOLDERDATASOURCE_CID },
  { NS_RDF_DATASOURCE_CONTRACTID_PREFIX "msgaccountmanager", &kNS_MSGACCOUNTMANAGERDATASOURCE_CID },
  { NS_MSGFILTERSERVICE_CONTRACTID, &kNS_MSGFILTERSERVICE_CID },
  { NS_MSGSEARCHSESSION_CONTRACTID, &kNS_MSGSEARCHSESSION_CID },
  { NS_MSGSEARCHTERM_CONTRACTID, &kNS_MSGSEARCHTERM_CID },
  { NS_MSGSEARCHVALIDITYMANAGER_CONTRACTID, &kNS_MSGSEARCHVALIDITYMANAGER_CID },
  { NS_MSGBIFFMANAGER_CONTRACTID, &kNS_MSGBIFFMANAGER_CID },
  { NS_MSGPURGESERVICE_CONTRACTID, &kNS_MSGPURGESERVICE_CID },
  { NS_STATUSBARBIFFMANAGER_CONTRACTID, &kNS_STATUSBARBIFFMANAGER_CID },
  { NS_COPYMESSAGESTREAMLISTENER_CONTRACTID, &kNS_COPYMESSAGESTREAMLISTENER_CID },
  { NS_MSGCOPYSERVICE_CONTRACTID, &kNS_MSGCOPYSERVICE_CID },
  { NS_MSGFOLDERCACHE_CONTRACTID, &kNS_MSGFOLDERCACHE_CID },
  { NS_MSGSTATUSFEEDBACK_CONTRACTID, &kNS_MSGSTATUSFEEDBACK_CID },
  { NS_MSGWINDOW_CONTRACTID, &kNS_MSGWINDOW_CID },
#ifdef NS_PRINTING
  { NS_MSGPRINTENGINE_CONTRACTID, &kNS_MSG_PRINTENGINE_CID },
#endif
  { NS_MSGSERVICEPROVIDERSERVICE_CONTRACTID, &kNS_MSGSERVICEPROVIDERSERVICE_CID },
  { NS_SUBSCRIBEDATASOURCE_CONTRACTID, &kNS_SUBSCRIBEDATASOURCE_CID },
  { NS_SUBSCRIBABLESERVER_CONTRACTID, &kNS_SUBSCRIBABLESERVER_CID },
  { NS_MSGLOCALFOLDERCOMPACTOR_CONTRACTID, &kNS_MSGLOCALFOLDERCOMPACTOR_CID },
  { NS_MSGOFFLINESTORECOMPACTOR_CONTRACTID, &kNS_MSG_OFFLINESTORECOMPACTOR_CID },
  { NS_MSGTHREADEDDBVIEW_CONTRACTID, &kNS_MSGTHREADEDDBVIEW_CID },
  { NS_MSGTHREADSWITHUNREADDBVIEW_CONTRACTID, &kNS_MSGTHREADSWITHUNREADDBVIEW_CID },
  { NS_MSGWATCHEDTHREADSWITHUNREADDBVIEW_CONTRACTID, &kNS_MSGWATCHEDTHREADSWITHUNREADDBVIEW_CID },
  { NS_MSGSEARCHDBVIEW_CONTRACTID, &kNS_MSGSEARCHDBVIEW_CID },
  { NS_MSGQUICKSEARCHDBVIEW_CONTRACTID, &kNS_MSGQUICKSEARCHDBVIEW_CID },
  { NS_MSGXFVFDBVIEW_CONTRACTID, &kNS_MSG_XFVFDBVIEW_CID },
  { NS_MSGGROUPDBVIEW_CONTRACTID, &kNS_MSG_GROUPDBVIEW_CID },
  { NS_MSGOFFLINEMANAGER_CONTRACTID, &kNS_MSGOFFLINEMANAGER_CID },
  { NS_MSGPROGRESS_CONTRACTID, &kNS_MSGPROGRESS_CID },
  { NS_SPAMSETTINGS_CONTRACTID, &kNS_SPAMSETTINGS_CID },
  { NS_CIDPROTOCOLHANDLER_CONTRACTID, &kNS_CIDPROTOCOL_CID },
  { NS_MSGTAGSERVICE_CONTRACTID, &kNS_MSGTAGSERVICE_CID },
  { NS_MSGNOTIFICATIONSERVICE_CONTRACTID, &kNS_MSGNOTIFICATIONSERVICE_CID },
#ifdef XP_WIN
  { NS_MESSENGEROSINTEGRATION_CONTRACTID, &kNS_MESSENGERWININTEGRATION_CID },
#endif
#ifdef XP_OS2
  { NS_MESSENGEROSINTEGRATION_CONTRACTID, &kNS_MESSENGEROS2INTEGRATION_CID },
#endif
#ifdef XP_MACOSX
  { NS_MESSENGEROSINTEGRATION_CONTRACTID, &kNS_MESSENGEROSXINTEGRATION_CID },
#endif
#if defined(MOZ_WIDGET_GTK) || defined(MOZ_WIDGET_GTK2)
  { NS_MESSENGEROSINTEGRATION_CONTRACTID, &kNS_MESSENGERUNIXINTEGRATION_CID },
#endif
  { NS_MESSENGERCONTENTHANDLER_CONTRACTID, &kNS_MESSENGERCONTENTHANDLER_CID },
  { NS_MSGCONTENTPOLICY_CONTRACTID, &kNS_MSGCONTENTPOLICY_CID },
  { NS_MSGSHUTDOWNSERVICE_CONTRACTID, &kNS_MSGSHUTDOWNSERVICE_CID },
  { NS_MAILDIRPROVIDER_CONTRACTID, &kMAILDIRPROVIDER_CID },
  { NS_STOPWATCH_CONTRACTID, &kNS_STOPWATCH_CID },
  { NS_MAILNEWSDLF_CONTRACTID, &kNS_MAILNEWSDLF_CID },
  { NULL }
};

static const mozilla::Module::CategoryEntry kMailNewsBaseCategories[] = {
    { XPCOM_DIRECTORY_PROVIDER_CATEGORY, "mail-directory-provider", NS_MAILDIRPROVIDER_CONTRACTID },
    { "content-policy", NS_MSGCONTENTPOLICY_CONTRACTID, NS_MSGCONTENTPOLICY_CONTRACTID },
    MAILNEWSDLF_CATEGORIES
#ifdef XP_MACOSX
    { "app-startup", NS_MESSENGEROSINTEGRATION_CONTRACTID, "service," NS_MESSENGEROSINTEGRATION_CONTRACTID },
#endif
    { NULL }
};

static const mozilla::Module kMailNewsBaseModule = {
  mozilla::Module::kVersion,
  kMailNewsBaseCIDs,
  kMailNewsBaseContracts,
  kMailNewsBaseCategories
};

NSMODULE_DEFN(mailnewsbase_provider) = &kMailNewsBaseModule;

