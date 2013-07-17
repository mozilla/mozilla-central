/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
 * strongly consider adding it to the other place it goes too!  These can be
 * found in paths like so: mailnews/.../build/WhateverFactory.cpp
 * 
 * If you do not, your (static) release builds will be quite pleasant, but
 * (dynamic) debug builds will disappoint you by not having your component in
 * them.
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


////////////////////////////////////////////////////////////////////////////////
// Core Module Include Files
////////////////////////////////////////////////////////////////////////////////

#include "mozilla/ModuleUtils.h"
#include "nsIFactory.h"
#include "nsISupports.h"
#include "nsIModule.h"
#include "pratom.h"
#include "nsICategoryManager.h"
#include "nsIComponentManager.h"
#include "nsIServiceManager.h"
#include "nsCRT.h"
#include "nsCOMPtr.h"
#include "msgCore.h"

////////////////////////////////////////////////////////////////////////////////
// mailnews base includes
////////////////////////////////////////////////////////////////////////////////
#include "nsMsgBaseCID.h"
#include "rdf.h"
#include "nsMessengerBootstrap.h"
#include "nsMessenger.h"
#include "nsIContentViewer.h"
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
#include "nsMsgKeyArray.h"
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
#include "nsRssIncomingServer.h"
#include "nsRssService.h"
#include "nsMsgBrkMBoxStore.h"
#include "nsMsgMaildirStore.h"
#include "nsMsgTagService.h"
#include "nsMsgFolderNotificationService.h"
#include "nsMailDirProvider.h"

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

////////////////////////////////////////////////////////////////////////////////
// addrbook includes
////////////////////////////////////////////////////////////////////////////////
#include "nsAbBaseCID.h"
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
#include "nsAbLDAPReplicationService.h"
#include "nsAbLDAPReplicationQuery.h"
#include "nsAbLDAPReplicationData.h"
// XXX These files are not being built as they don't work. Bug 311632 should
// fix them.
//#include "nsAbLDAPChangeLogQuery.h"
//#include "nsAbLDAPChangeLogData.h"
#endif


#if defined(MOZ_MAPI_SUPPORT)
#include "nsAbOutlookDirFactory.h"
#include "nsAbOutlookDirectory.h"
#endif

#ifdef XP_MACOSX
#include "nsAbOSXDirectory.h"
#include "nsAbOSXCard.h"
#include "nsAbOSXDirFactory.h"
#endif

////////////////////////////////////////////////////////////////////////////////
// bayesian spam filter includes
////////////////////////////////////////////////////////////////////////////////
#include "nsBayesianFilterCID.h"
#include "nsBayesianFilter.h"

////////////////////////////////////////////////////////////////////////////////
// compose includes
////////////////////////////////////////////////////////////////////////////////
#include "nsMsgCompCID.h"

#include "nsMsgSendLater.h"
#include "nsSmtpUrl.h"
#include "nsISmtpService.h"
#include "nsSmtpService.h"
#include "nsMsgComposeService.h"
#include "nsMsgComposeContentHandler.h"
#include "nsMsgCompose.h"
#include "nsMsgComposeParams.h"
#include "nsMsgComposeProgressParams.h"
#include "nsMsgAttachment.h"
#include "nsMsgSend.h"
#include "nsMsgQuote.h"
#include "nsURLFetcher.h"
#include "nsSmtpServer.h"
#include "nsMsgCompUtils.h"

////////////////////////////////////////////////////////////////////////////////
// imap includes
////////////////////////////////////////////////////////////////////////////////
#include "nsMsgImapCID.h"
#include "nsIMAPHostSessionList.h"
#include "nsImapIncomingServer.h"
#include "nsImapService.h"
#include "nsImapMailFolder.h"
#include "nsImapUrl.h"
#include "nsImapProtocol.h"
#include "nsAutoSyncManager.h"

////////////////////////////////////////////////////////////////////////////////
// local includes
////////////////////////////////////////////////////////////////////////////////
#include "nsMsgLocalCID.h"

#include "nsMailboxUrl.h"
#include "nsPop3URL.h"
#include "nsMailboxService.h"
#include "nsLocalMailFolder.h"
#include "nsParseMailbox.h"
#include "nsPop3Service.h"

#ifdef HAVE_MOVEMAIL
#include "nsMovemailService.h"
#include "nsMovemailIncomingServer.h"
#endif /* HAVE_MOVEMAIL */

#include "nsNoneService.h"
#include "nsPop3IncomingServer.h"
#include "nsNoIncomingServer.h"

///////////////////////////////////////////////////////////////////////////////
// msgdb includes
///////////////////////////////////////////////////////////////////////////////
#include "nsMsgDBCID.h"
#include "nsMailDatabase.h"
#include "nsNewsDatabase.h"
#include "nsImapMailDatabase.h"

///////////////////////////////////////////////////////////////////////////////
// mime includes
///////////////////////////////////////////////////////////////////////////////
#include "nsMsgMimeCID.h"
#include "nsStreamConverter.h"
#include "nsMimeObjectClassAccess.h"
#include "nsMimeConverter.h"
#include "nsMsgHeaderParser.h"

///////////////////////////////////////////////////////////////////////////////
// mime emitter includes
///////////////////////////////////////////////////////////////////////////////
#include "nsMimeEmitterCID.h"
#include "nsIMimeEmitter.h"
#include "nsMimeHtmlEmitter.h"
#include "nsMimeRawEmitter.h"
#include "nsMimeXmlEmitter.h"
#include "nsMimePlainEmitter.h"

///////////////////////////////////////////////////////////////////////////////
// news includes
///////////////////////////////////////////////////////////////////////////////
#include "nsMsgNewsCID.h"
#include "nsNntpUrl.h"
#include "nsNntpService.h"
#include "nsNntpIncomingServer.h"
#include "nsNNTPNewsgroupPost.h"
#include "nsNNTPNewsgroupList.h"
#include "nsNNTPArticleList.h"
#include "nsNewsDownloadDialogArgs.h"
#include "nsNewsFolder.h"

///////////////////////////////////////////////////////////////////////////////
// mail views includes
///////////////////////////////////////////////////////////////////////////////
#include "nsMsgMailViewsCID.h"
#include "nsMsgMailViewList.h"

///////////////////////////////////////////////////////////////////////////////
// mdn includes
///////////////////////////////////////////////////////////////////////////////
#include "nsMsgMdnCID.h"
#include "nsMsgMdnGenerator.h"

///////////////////////////////////////////////////////////////////////////////
// vcard includes
///////////////////////////////////////////////////////////////////////////////
#include "nsMimeContentTypeHandler.h"

///////////////////////////////////////////////////////////////////////////////
// FTS3 Tokenizer
///////////////////////////////////////////////////////////////////////////////
#include "nsFts3TokenizerCID.h"
#include "nsFts3Tokenizer.h"

////////////////////////////////////////////////////////////////////////////////
// PGP/MIME includes
////////////////////////////////////////////////////////////////////////////////
#include "nsPgpMimeProxy.h"

////////////////////////////////////////////////////////////////////////////////
// mailnews base factories
////////////////////////////////////////////////////////////////////////////////
using namespace mozilla::mailnews;

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
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgKeyArray)
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
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgTagService)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgFolderNotificationService)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsCidProtocolHandler)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMailDirProvider)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgShutdownService)
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
NS_DEFINE_NAMED_CID(NS_MSGKEYARRAY_CID);
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

////////////////////////////////////////////////////////////////////////////////
// addrbook factories
////////////////////////////////////////////////////////////////////////////////
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsAbManager,Init)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbContentHandler)
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

#if defined(MOZ_MAPI_SUPPORT)
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
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbLDAPReplicationService)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbLDAPReplicationQuery)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbLDAPProcessReplicationData)
// XXX These files are not being built as they don't work. Bug 311632 should
// fix them.
//NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbLDAPChangeLogQuery)
//NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbLDAPProcessChangeLogData)
#endif


NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbDirectoryQueryProxy)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbView)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgVCardService)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbLDIFService)

#ifdef XP_MACOSX
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbOSXDirectory)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbOSXCard)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAbOSXDirFactory)
#endif

NS_DEFINE_NAMED_CID(NS_ABMANAGER_CID);
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
#if defined(MOZ_MAPI_SUPPORT)
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

////////////////////////////////////////////////////////////////////////////////
// bayesian spam filter factories
////////////////////////////////////////////////////////////////////////////////
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsBayesianFilter, Init)

NS_DEFINE_NAMED_CID(NS_BAYESIANFILTER_CID);

////////////////////////////////////////////////////////////////////////////////
// compose factories
////////////////////////////////////////////////////////////////////////////////
NS_GENERIC_FACTORY_CONSTRUCTOR(nsSmtpService)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsSmtpServer)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgCompose)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgComposeParams)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgComposeSendListener)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgComposeProgressParams)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgCompFields)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgAttachment)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgAttachmentData)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgAttachedFile)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgComposeAndSend)
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsMsgSendLater, Init)
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsMsgComposeService, Init)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgComposeContentHandler)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgQuote)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgQuoteListener)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsSmtpUrl)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMailtoUrl)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsURLFetcher)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgCompUtils)

NS_DEFINE_NAMED_CID(NS_MSGCOMPOSE_CID);
NS_DEFINE_NAMED_CID(NS_MSGCOMPOSESERVICE_CID);
NS_DEFINE_NAMED_CID(NS_MSGCOMPOSECONTENTHANDLER_CID);
NS_DEFINE_NAMED_CID(NS_MSGCOMPOSEPARAMS_CID);
NS_DEFINE_NAMED_CID(NS_MSGCOMPOSESENDLISTENER_CID);
NS_DEFINE_NAMED_CID(NS_MSGCOMPOSEPROGRESSPARAMS_CID);
NS_DEFINE_NAMED_CID(NS_MSGCOMPFIELDS_CID);
NS_DEFINE_NAMED_CID(NS_MSGATTACHMENT_CID);
NS_DEFINE_NAMED_CID(NS_MSGATTACHMENTDATA_CID);
NS_DEFINE_NAMED_CID(NS_MSGATTACHEDFILE_CID);
NS_DEFINE_NAMED_CID(NS_MSGSEND_CID);
NS_DEFINE_NAMED_CID(NS_MSGSENDLATER_CID);
NS_DEFINE_NAMED_CID(NS_SMTPSERVICE_CID);
NS_DEFINE_NAMED_CID(NS_SMTPSERVER_CID);
NS_DEFINE_NAMED_CID(NS_SMTPURL_CID);
NS_DEFINE_NAMED_CID(NS_MAILTOURL_CID);
NS_DEFINE_NAMED_CID(NS_MSGQUOTE_CID);
NS_DEFINE_NAMED_CID(NS_MSGQUOTELISTENER_CID);
NS_DEFINE_NAMED_CID(NS_URLFETCHER_CID);
NS_DEFINE_NAMED_CID(NS_MSGCOMPUTILS_CID);

////////////////////////////////////////////////////////////////////////////////
// imap factories
////////////////////////////////////////////////////////////////////////////////
NS_GENERIC_FACTORY_CONSTRUCTOR(nsImapUrl)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsImapProtocol)
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsIMAPHostSessionList, Init)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsImapIncomingServer)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsImapService)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsImapMailFolder)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsImapMockChannel)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAutoSyncManager)

NS_DEFINE_NAMED_CID(NS_IMAPURL_CID);
NS_DEFINE_NAMED_CID(NS_IMAPPROTOCOL_CID);
NS_DEFINE_NAMED_CID(NS_IMAPMOCKCHANNEL_CID);
NS_DEFINE_NAMED_CID(NS_IIMAPHOSTSESSIONLIST_CID);
NS_DEFINE_NAMED_CID(NS_IMAPINCOMINGSERVER_CID);
NS_DEFINE_NAMED_CID(NS_IMAPRESOURCE_CID);
NS_DEFINE_NAMED_CID(NS_IMAPSERVICE_CID);
NS_DEFINE_NAMED_CID(NS_AUTOSYNCMANAGER_CID);

////////////////////////////////////////////////////////////////////////////////
// local factories
////////////////////////////////////////////////////////////////////////////////
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMailboxUrl)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsPop3URL)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgMailboxParser)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMailboxService)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsPop3Service)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsNoneService)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgLocalMailFolder)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsParseMailMessageState)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsPop3IncomingServer)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsRssIncomingServer)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsRssService)
#ifdef HAVE_MOVEMAIL
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMovemailIncomingServer)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMovemailService)
#endif /* HAVE_MOVEMAIL */
NS_GENERIC_FACTORY_CONSTRUCTOR(nsNoIncomingServer)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgBrkMBoxStore)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgMaildirStore)

NS_DEFINE_NAMED_CID(NS_MAILBOXURL_CID);
NS_DEFINE_NAMED_CID(NS_MAILBOXSERVICE_CID);
NS_DEFINE_NAMED_CID(NS_MAILBOXPARSER_CID);
NS_DEFINE_NAMED_CID(NS_POP3URL_CID);
NS_DEFINE_NAMED_CID(NS_POP3SERVICE_CID);
NS_DEFINE_NAMED_CID(NS_NONESERVICE_CID);
#ifdef HAVE_MOVEMAIL
NS_DEFINE_NAMED_CID(NS_MOVEMAILSERVICE_CID);
#endif /* HAVE_MOVEMAIL */
NS_DEFINE_NAMED_CID(NS_LOCALMAILFOLDERRESOURCE_CID);
NS_DEFINE_NAMED_CID(NS_POP3INCOMINGSERVER_CID);
#ifdef HAVE_MOVEMAIL
NS_DEFINE_NAMED_CID(NS_MOVEMAILINCOMINGSERVER_CID);
#endif /* HAVE_MOVEMAIL */
NS_DEFINE_NAMED_CID(NS_NOINCOMINGSERVER_CID);
NS_DEFINE_NAMED_CID(NS_PARSEMAILMSGSTATE_CID);
NS_DEFINE_NAMED_CID(NS_RSSSERVICE_CID);
NS_DEFINE_NAMED_CID(NS_RSSINCOMINGSERVER_CID);
NS_DEFINE_NAMED_CID(NS_BRKMBOXSTORE_CID);
NS_DEFINE_NAMED_CID(NS_MAILDIRSTORE_CID);

////////////////////////////////////////////////////////////////////////////////
// msgdb factories
////////////////////////////////////////////////////////////////////////////////
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgDBService)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMailDatabase)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsNewsDatabase)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsImapMailDatabase)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgRetentionSettings)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgDownloadSettings)

NS_DEFINE_NAMED_CID(NS_MAILDB_CID);
NS_DEFINE_NAMED_CID(NS_NEWSDB_CID);
NS_DEFINE_NAMED_CID(NS_IMAPDB_CID);
NS_DEFINE_NAMED_CID(NS_MSG_RETENTIONSETTINGS_CID);
NS_DEFINE_NAMED_CID(NS_MSG_DOWNLOADSETTINGS_CID);
NS_DEFINE_NAMED_CID(NS_MSGDB_SERVICE_CID);

////////////////////////////////////////////////////////////////////////////////
// mime factories
////////////////////////////////////////////////////////////////////////////////
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMimeObjectClassAccess)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMimeConverter)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsStreamConverter)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgHeaderParser)

NS_DEFINE_NAMED_CID(NS_MIME_OBJECT_CLASS_ACCESS_CID);
NS_DEFINE_NAMED_CID(NS_MIME_CONVERTER_CID);
NS_DEFINE_NAMED_CID(NS_MSGHEADERPARSER_CID);
NS_DEFINE_NAMED_CID(NS_MAILNEWS_MIME_STREAM_CONVERTER_CID);

////////////////////////////////////////////////////////////////////////////////
// mime emitter factories
////////////////////////////////////////////////////////////////////////////////
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMimeRawEmitter)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMimeXmlEmitter)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMimePlainEmitter)
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsMimeHtmlDisplayEmitter, Init)

NS_DEFINE_NAMED_CID(NS_HTML_MIME_EMITTER_CID);
NS_DEFINE_NAMED_CID(NS_XML_MIME_EMITTER_CID);
NS_DEFINE_NAMED_CID(NS_PLAIN_MIME_EMITTER_CID);
NS_DEFINE_NAMED_CID(NS_RAW_MIME_EMITTER_CID);

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
NS_GENERIC_FACTORY_CONSTRUCTOR(nsFts3Tokenizer)

NS_DEFINE_NAMED_CID(NS_FTS3TOKENIZER_CID);

////////////////////////////////////////////////////////////////////////////////
// news factories
////////////////////////////////////////////////////////////////////////////////
NS_GENERIC_FACTORY_CONSTRUCTOR(nsNntpUrl)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsNntpService)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsNntpIncomingServer)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsNNTPArticleList)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsNNTPNewsgroupPost)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsNNTPNewsgroupList)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgNewsFolder)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsNewsDownloadDialogArgs)

NS_DEFINE_NAMED_CID(NS_NNTPSERVICE_CID);
NS_DEFINE_NAMED_CID(NS_NNTPURL_CID);
NS_DEFINE_NAMED_CID(NS_NEWSFOLDERRESOURCE_CID);
NS_DEFINE_NAMED_CID(NS_NNTPINCOMINGSERVER_CID);
NS_DEFINE_NAMED_CID(NS_NNTPNEWSGROUPPOST_CID);
NS_DEFINE_NAMED_CID(NS_NNTPNEWSGROUPLIST_CID);
NS_DEFINE_NAMED_CID(NS_NNTPARTICLELIST_CID);
NS_DEFINE_NAMED_CID(NS_NEWSDOWNLOADDIALOGARGS_CID);

////////////////////////////////////////////////////////////////////////////////
// mail view factories
////////////////////////////////////////////////////////////////////////////////
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgMailViewList)

NS_DEFINE_NAMED_CID(NS_MSGMAILVIEWLIST_CID);

////////////////////////////////////////////////////////////////////////////////
// mdn factories
////////////////////////////////////////////////////////////////////////////////
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgMdnGenerator)

NS_DEFINE_NAMED_CID(NS_MSGMDNGENERATOR_CID);

////////////////////////////////////////////////////////////////////////////////
// vcard factories
////////////////////////////////////////////////////////////////////////////////

NS_DEFINE_NAMED_CID(NS_VCARD_CONTENT_TYPE_HANDLER_CID);

// XXX this vcard stuff needs cleaned up to use a generic factory constructor
extern "C" MimeObjectClass *
MIME_VCardCreateContentTypeHandlerClass(const char *content_type,
                                        contentTypeHandlerInitStruct *initStruct);

static nsresult nsVCardMimeContentTypeHandlerConstructor(nsISupports *aOuter,
                                                        REFNSIID aIID,
                                                        void **aResult)
{
  nsresult rv;
  nsMimeContentTypeHandler *inst = nullptr;

  if (NULL == aResult)
  {
    rv = NS_ERROR_NULL_POINTER;
    return rv;
  }
  *aResult = NULL;
  if (NULL != aOuter)
  {
    rv = NS_ERROR_NO_AGGREGATION;
    return rv;
  }
  inst = new nsMimeContentTypeHandler("text/x-vcard", &MIME_VCardCreateContentTypeHandlerClass);
  if (inst == NULL)
    return NS_ERROR_OUT_OF_MEMORY;

  NS_ADDREF(inst);
  rv = inst->QueryInterface(aIID,aResult);
  NS_RELEASE(inst);

  return rv;
}

////////////////////////////////////////////////////////////////////////////////
// PGP/MIME factories
////////////////////////////////////////////////////////////////////////////////

NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsPgpMimeProxy, Init)

NS_DEFINE_NAMED_CID(NS_PGPMIMEPROXY_CID);

NS_DEFINE_NAMED_CID(NS_PGPMIME_CONTENT_TYPE_HANDLER_CID);

extern "C" MimeObjectClass *
MIME_PgpMimeCreateContentTypeHandlerClass(const char *content_type,
                                        contentTypeHandlerInitStruct *initStruct);

static nsresult
nsPgpMimeMimeContentTypeHandlerConstructor(nsISupports *aOuter,
                                         REFNSIID aIID,
                                         void **aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  NS_ENSURE_FALSE(aOuter, NS_ERROR_NO_AGGREGATION);
  *aResult = nullptr;

  nsRefPtr<nsMimeContentTypeHandler> inst(
    new nsMimeContentTypeHandler("mulitpart/encrypted",
                                 &MIME_PgpMimeCreateContentTypeHandlerClass));

  NS_ENSURE_TRUE(inst, NS_ERROR_OUT_OF_MEMORY);

  return inst->QueryInterface(aIID, aResult);
}

const mozilla::Module::CIDEntry kMailNewsCIDs[] = {
  // MailNews Base Entries
  { &kNS_MESSENGERBOOTSTRAP_CID, false, NULL, nsMessengerBootstrapConstructor },
  { &kNS_MESSENGERWINDOWSERVICE_CID, false, NULL, nsMessengerBootstrapConstructor},
  { &kNS_MSGMAILSESSION_CID, false, NULL, nsMsgMailSessionConstructor},
  { &kNS_MESSENGER_CID, false, NULL,nsMessengerConstructor},
  { &kNS_MSGACCOUNTMANAGER_CID, false, NULL, nsMsgAccountManagerConstructor},
  { &kNS_MSGACCOUNT_CID, false, NULL, nsMsgAccountConstructor},
  { &kNS_MSGIDENTITY_CID, false, NULL, nsMsgIdentityConstructor},
  { &kNS_MAILNEWSFOLDERDATASOURCE_CID, false, NULL, nsMsgFolderDataSourceConstructor},
  { &kNS_MAILNEWSUNREADFOLDERDATASOURCE_CID, false, NULL, nsMsgUnreadFoldersDataSourceConstructor},
  { &kNS_MAILNEWSFAVORITEFOLDERDATASOURCE_CID, false, NULL, nsMsgFavoriteFoldersDataSourceConstructor},
  { &kNS_MAILNEWSRECENTFOLDERDATASOURCE_CID, false, NULL, nsMsgRecentFoldersDataSourceConstructor},
  { &kNS_MSGACCOUNTMANAGERDATASOURCE_CID, false, NULL, nsMsgAccountManagerDataSourceConstructor},
  { &kNS_MSGFILTERSERVICE_CID, false, NULL, nsMsgFilterServiceConstructor},
  { &kNS_MSGSEARCHSESSION_CID, false, NULL, nsMsgSearchSessionConstructor},
  { &kNS_MSGSEARCHTERM_CID, false, NULL, nsMsgSearchTermConstructor},
  { &kNS_MSGSEARCHVALIDITYMANAGER_CID, false, NULL, nsMsgSearchValidityManagerConstructor},
  { &kNS_MSGBIFFMANAGER_CID, false, NULL, nsMsgBiffManagerConstructor},
  { &kNS_MSGPURGESERVICE_CID, false, NULL, nsMsgPurgeServiceConstructor},
  { &kNS_STATUSBARBIFFMANAGER_CID, false, NULL, nsStatusBarBiffManagerConstructor},
  { &kNS_COPYMESSAGESTREAMLISTENER_CID, false, NULL, nsCopyMessageStreamListenerConstructor},
  { &kNS_MSGCOPYSERVICE_CID, false, NULL, nsMsgCopyServiceConstructor},
  { &kNS_MSGFOLDERCACHE_CID, false, NULL, nsMsgFolderCacheConstructor},
  { &kNS_MSGSTATUSFEEDBACK_CID, false, NULL, nsMsgStatusFeedbackConstructor},
  { &kNS_MSGKEYARRAY_CID, false, NULL, nsMsgKeyArrayConstructor},
  { &kNS_MSGWINDOW_CID, false, NULL, nsMsgWindowConstructor},
#ifdef NS_PRINTING
  { &kNS_MSG_PRINTENGINE_CID, false, NULL, nsMsgPrintEngineConstructor},
#endif
  { &kNS_MSGSERVICEPROVIDERSERVICE_CID, false, NULL, nsMsgServiceProviderServiceConstructor},
  { &kNS_SUBSCRIBEDATASOURCE_CID, false, NULL, nsSubscribeDataSourceConstructor},
  { &kNS_SUBSCRIBABLESERVER_CID, false, NULL, nsSubscribableServerConstructor},
  { &kNS_MSGLOCALFOLDERCOMPACTOR_CID, false, NULL, nsFolderCompactStateConstructor},
  { &kNS_MSG_OFFLINESTORECOMPACTOR_CID, false, NULL, nsOfflineStoreCompactStateConstructor},
  { &kNS_MSGTHREADEDDBVIEW_CID, false, NULL, nsMsgThreadedDBViewConstructor},
  { &kNS_MSGTHREADSWITHUNREADDBVIEW_CID, false, NULL, nsMsgThreadsWithUnreadDBViewConstructor},
  { &kNS_MSGWATCHEDTHREADSWITHUNREADDBVIEW_CID, false, NULL, nsMsgWatchedThreadsWithUnreadDBViewConstructor
},
  { &kNS_MSGSEARCHDBVIEW_CID, false, NULL, nsMsgSearchDBViewConstructor},
  { &kNS_MSGQUICKSEARCHDBVIEW_CID, false, NULL, nsMsgQuickSearchDBViewConstructor},
  { &kNS_MSG_XFVFDBVIEW_CID, false, NULL, nsMsgXFVirtualFolderDBViewConstructor},
  { &kNS_MSG_GROUPDBVIEW_CID, false, NULL, nsMsgGroupViewConstructor},
  { &kNS_MSGOFFLINEMANAGER_CID, false, NULL, nsMsgOfflineManagerConstructor},
  { &kNS_MSGPROGRESS_CID, false, NULL, nsMsgProgressConstructor},
  { &kNS_SPAMSETTINGS_CID, false, NULL, nsSpamSettingsConstructor},
  { &kNS_CIDPROTOCOL_CID, false, NULL, nsCidProtocolHandlerConstructor},
  { &kNS_MSGTAGSERVICE_CID, false, NULL, nsMsgTagServiceConstructor},
  { &kNS_MSGNOTIFICATIONSERVICE_CID, false, NULL, nsMsgFolderNotificationServiceConstructor},
#ifdef XP_WIN
  { &kNS_MESSENGERWININTEGRATION_CID, false, NULL, nsMessengerWinIntegrationConstructor},
#endif
#ifdef XP_OS2
  { &kNS_MESSENGEROS2INTEGRATION_CID, false, NULL, nsMessengerOS2IntegrationConstructor},
#endif
#ifdef XP_MACOSX
  { &kNS_MESSENGEROSXINTEGRATION_CID, false, NULL, nsMessengerOSXIntegrationConstructor},
#endif
#if defined(MOZ_WIDGET_GTK) || defined(MOZ_WIDGET_GTK2)
  { &kNS_MESSENGERUNIXINTEGRATION_CID, false, NULL, nsMessengerUnixIntegrationConstructor},
#endif
  { &kNS_MESSENGERCONTENTHANDLER_CID, false, NULL, nsMessengerContentHandlerConstructor},
  { &kNS_MSGCONTENTPOLICY_CID, false, NULL, nsMsgContentPolicyConstructor},
  { &kNS_MSGSHUTDOWNSERVICE_CID, false, NULL, nsMsgShutdownServiceConstructor},
  { &kMAILDIRPROVIDER_CID, false, NULL, nsMailDirProviderConstructor},
  { &kNS_STOPWATCH_CID, false, NULL, nsStopwatchConstructor},
  { &kNS_MAILNEWSDLF_CID, false, NULL, MailNewsDLFConstructor},
  // Address Book Entries
  { &kNS_ABMANAGER_CID, false, NULL, nsAbManagerConstructor },
  { &kNS_ABDIRECTORY_CID, false, NULL, nsAbBSDirectoryConstructor },
  { &kNS_ABMDBDIRECTORY_CID, false, NULL, nsAbMDBDirectoryConstructor },
  { &kNS_ABMDBCARD_CID, false, NULL, nsAbMDBCardConstructor },
  { &kNS_ADDRDATABASE_CID, false, NULL, nsAddrDatabaseConstructor },
  { &kNS_ABCARDPROPERTY_CID, false, NULL, nsAbCardPropertyConstructor },
  { &kNS_ABDIRPROPERTY_CID, false, NULL, nsAbDirPropertyConstructor },
  { &kNS_ABADDRESSCOLLECTOR_CID, false, NULL, nsAbAddressCollectorConstructor },
  { &kNS_ADDBOOKURL_CID, false, NULL, nsAddbookUrlConstructor },
  { &kNS_ADDBOOK_HANDLER_CID, false, NULL, nsAddbookProtocolHandlerConstructor }
,
  { &kNS_ABCONTENTHANDLER_CID, false, NULL, nsAbContentHandlerConstructor },
  { &kNS_ABDIRFACTORYSERVICE_CID, false, NULL, nsAbDirFactoryServiceConstructor },
  { &kNS_ABMDBDIRFACTORY_CID, false, NULL, nsAbMDBDirFactoryConstructor },
#if defined(MOZ_MAPI_SUPPORT)
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
  // Bayesian Filter Entries
  { &kNS_BAYESIANFILTER_CID, false, NULL, nsBayesianFilterConstructor },
  // Compose Entries
  { &kNS_MSGCOMPOSE_CID, false, NULL, nsMsgComposeConstructor},
  { &kNS_MSGCOMPOSESERVICE_CID, false, NULL, nsMsgComposeServiceConstructor},
  { &kNS_MSGCOMPOSECONTENTHANDLER_CID, false, NULL, nsMsgComposeContentHandlerConstructor},
  { &kNS_MSGCOMPOSEPARAMS_CID, false, NULL, nsMsgComposeParamsConstructor},
  { &kNS_MSGCOMPOSESENDLISTENER_CID, false, NULL, nsMsgComposeSendListenerConstructor},
  { &kNS_MSGCOMPOSEPROGRESSPARAMS_CID, false, NULL, nsMsgComposeProgressParamsConstructor},
  { &kNS_MSGCOMPFIELDS_CID, false, NULL, nsMsgCompFieldsConstructor},
  { &kNS_MSGATTACHMENT_CID, false, NULL, nsMsgAttachmentConstructor},
  { &kNS_MSGATTACHMENTDATA_CID, false, NULL, nsMsgAttachmentDataConstructor},
  { &kNS_MSGATTACHEDFILE_CID, false, NULL, nsMsgAttachedFileConstructor},
  { &kNS_MSGSEND_CID, false, NULL, nsMsgComposeAndSendConstructor},
  { &kNS_MSGSENDLATER_CID, false, NULL, nsMsgSendLaterConstructor},
  { &kNS_SMTPSERVICE_CID, false, NULL, nsSmtpServiceConstructor},
  { &kNS_SMTPSERVER_CID, false, NULL, nsSmtpServerConstructor},
  { &kNS_SMTPURL_CID, false, NULL, nsSmtpUrlConstructor},
  { &kNS_MAILTOURL_CID, false, NULL, nsMailtoUrlConstructor},
  { &kNS_MSGQUOTE_CID, false, NULL, nsMsgQuoteConstructor},
  { &kNS_MSGQUOTELISTENER_CID, false, NULL, nsMsgQuoteListenerConstructor},
  { &kNS_URLFETCHER_CID, false, NULL, nsURLFetcherConstructor},
  { &kNS_MSGCOMPUTILS_CID, false, NULL, nsMsgCompUtilsConstructor},
  // Imap Entries
  { &kNS_IMAPURL_CID, false, NULL, nsImapUrlConstructor },
  { &kNS_IMAPPROTOCOL_CID, false, nullptr, nsImapProtocolConstructor },
  { &kNS_IMAPMOCKCHANNEL_CID, false, nullptr, nsImapMockChannelConstructor },
  { &kNS_IIMAPHOSTSESSIONLIST_CID, false, nullptr, nsIMAPHostSessionListConstructor },
  { &kNS_IMAPINCOMINGSERVER_CID, false, nullptr, nsImapIncomingServerConstructor },
  { &kNS_IMAPRESOURCE_CID, false, nullptr, nsImapMailFolderConstructor },
  { &kNS_IMAPSERVICE_CID, false, nullptr, nsImapServiceConstructor },
  { &kNS_AUTOSYNCMANAGER_CID, false, nullptr, nsAutoSyncManagerConstructor },
  // Local Entries
  { &kNS_MAILBOXURL_CID, false, NULL, nsMailboxUrlConstructor },
  { &kNS_MAILBOXSERVICE_CID, false, NULL, nsMailboxServiceConstructor },
  { &kNS_MAILBOXPARSER_CID, false, NULL, nsMsgMailboxParserConstructor },
  { &kNS_POP3URL_CID, false, NULL, nsPop3URLConstructor },
  { &kNS_POP3SERVICE_CID, false, NULL, nsPop3ServiceConstructor },
  { &kNS_NONESERVICE_CID, false, NULL, nsNoneServiceConstructor },
#ifdef HAVE_MOVEMAIL
  { &kNS_MOVEMAILSERVICE_CID, false, NULL, nsMovemailServiceConstructor },
#endif /* HAVE_MOVEMAIL */
  { &kNS_LOCALMAILFOLDERRESOURCE_CID, false, NULL, nsMsgLocalMailFolderConstructor },
  { &kNS_POP3INCOMINGSERVER_CID, false, NULL, nsPop3IncomingServerConstructor },
#ifdef HAVE_MOVEMAIL
  { &kNS_MOVEMAILINCOMINGSERVER_CID, false, NULL, nsMovemailIncomingServerConstructor },
#endif /* HAVE_MOVEMAIL */
  { &kNS_NOINCOMINGSERVER_CID, false, NULL, nsNoIncomingServerConstructor },
  { &kNS_PARSEMAILMSGSTATE_CID, false, NULL, nsParseMailMessageStateConstructor },
  { &kNS_RSSSERVICE_CID, false, NULL, nsRssServiceConstructor },
  { &kNS_RSSINCOMINGSERVER_CID, false, NULL, nsRssIncomingServerConstructor },
  { &kNS_BRKMBOXSTORE_CID, false, NULL, nsMsgBrkMBoxStoreConstructor },
  { &kNS_MAILDIRSTORE_CID, false, NULL, nsMsgMaildirStoreConstructor },
  // msgdb Entries
  { &kNS_MAILDB_CID, false, NULL, nsMailDatabaseConstructor },
  { &kNS_NEWSDB_CID, false, NULL, nsNewsDatabaseConstructor },
  { &kNS_IMAPDB_CID, false, NULL, nsImapMailDatabaseConstructor },
  { &kNS_MSG_RETENTIONSETTINGS_CID, false, NULL, nsMsgRetentionSettingsConstructor },
  { &kNS_MSG_DOWNLOADSETTINGS_CID, false, NULL, nsMsgDownloadSettingsConstructor },
  { &kNS_MSGDB_SERVICE_CID, false, NULL, nsMsgDBServiceConstructor },
  // Mime Entries
  { &kNS_MIME_OBJECT_CLASS_ACCESS_CID, false, NULL, nsMimeObjectClassAccessConstructor },
  { &kNS_MIME_CONVERTER_CID, false, NULL, nsMimeConverterConstructor },
  { &kNS_MSGHEADERPARSER_CID, false, NULL, nsMsgHeaderParserConstructor },
  { &kNS_MAILNEWS_MIME_STREAM_CONVERTER_CID, false, NULL, nsStreamConverterConstructor },
  { &kNS_HTML_MIME_EMITTER_CID, false, NULL, nsMimeHtmlDisplayEmitterConstructor},
  { &kNS_XML_MIME_EMITTER_CID, false, NULL, nsMimeXmlEmitterConstructor},
  { &kNS_PLAIN_MIME_EMITTER_CID, false, NULL, nsMimePlainEmitterConstructor},
  { &kNS_RAW_MIME_EMITTER_CID, false, NULL, nsMimeRawEmitterConstructor},
  // Fts 3
  { &kNS_FTS3TOKENIZER_CID, false, NULL, nsFts3TokenizerConstructor },
  // News Entries
  { &kNS_NNTPURL_CID, false, NULL, nsNntpUrlConstructor },
  { &kNS_NNTPSERVICE_CID, false, NULL, nsNntpServiceConstructor },
  { &kNS_NEWSFOLDERRESOURCE_CID, false, NULL, nsMsgNewsFolderConstructor },
  { &kNS_NNTPINCOMINGSERVER_CID, false, NULL, nsNntpIncomingServerConstructor },
  { &kNS_NNTPNEWSGROUPPOST_CID, false, NULL, nsNNTPNewsgroupPostConstructor },
  { &kNS_NNTPNEWSGROUPLIST_CID, false, NULL, nsNNTPNewsgroupListConstructor },
  { &kNS_NNTPARTICLELIST_CID, false, NULL, nsNNTPArticleListConstructor },
  { &kNS_NEWSDOWNLOADDIALOGARGS_CID, false, NULL, nsNewsDownloadDialogArgsConstructor },
  // Mail View Entries
  { &kNS_MSGMAILVIEWLIST_CID, false, NULL, nsMsgMailViewListConstructor },
  // mdn Entries
  { &kNS_MSGMDNGENERATOR_CID, false, NULL, nsMsgMdnGeneratorConstructor },
  // Vcard Entries
  { &kNS_VCARD_CONTENT_TYPE_HANDLER_CID, false, NULL, nsVCardMimeContentTypeHandlerConstructor},
  // PGP/MIME Entries
  { &kNS_PGPMIME_CONTENT_TYPE_HANDLER_CID, false, NULL, nsPgpMimeMimeContentTypeHandlerConstructor },
  { &kNS_PGPMIMEPROXY_CID, false, NULL, nsPgpMimeProxyConstructor },
  // Tokenizer Entries
  { NULL }
};

const mozilla::Module::ContractIDEntry kMailNewsContracts[] = {
  // MailNews Base Entries
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
  { NS_MSGKEYARRAY_CONTRACTID, &kNS_MSGKEYARRAY_CID },
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
  // Address Book Entries
  { NS_ABMANAGER_CONTRACTID, &kNS_ABMANAGER_CID },
  { NS_ABMANAGERSTARTUPHANDLER_CONTRACTID, &kNS_ABMANAGER_CID },
  { NS_ABDIRECTORY_CONTRACTID, &kNS_ABDIRECTORY_CID },
  { NS_ABMDBDIRECTORY_CONTRACTID, &kNS_ABMDBDIRECTORY_CID },
  { NS_ABMDBCARD_CONTRACTID, &kNS_ABMDBCARD_CID },
  { NS_ADDRDATABASE_CONTRACTID, &kNS_ADDRDATABASE_CID },
  { NS_ABCARDPROPERTY_CONTRACTID, &kNS_ABCARDPROPERTY_CID },
  { NS_ABDIRPROPERTY_CONTRACTID, &kNS_ABDIRPROPERTY_CID },
  { NS_ABADDRESSCOLLECTOR_CONTRACTID, &kNS_ABADDRESSCOLLECTOR_CID },
  { NS_ADDBOOKURL_CONTRACTID, &kNS_ADDBOOKURL_CID },
  { NS_NETWORK_PROTOCOL_CONTRACTID_PREFIX "addbook", &kNS_ADDBOOK_HANDLER_CID },
  { NS_CONTENT_HANDLER_CONTRACTID_PREFIX"application/x-addvcard", &kNS_ABCONTENTHANDLER_CID },
  { NS_CONTENT_HANDLER_CONTRACTID_PREFIX"text/x-vcard", &kNS_ABCONTENTHANDLER_CID },
  { NS_ABDIRFACTORYSERVICE_CONTRACTID, &kNS_ABDIRFACTORYSERVICE_CID },
  { NS_ABMDBDIRFACTORY_CONTRACTID, &kNS_ABMDBDIRFACTORY_CID },
#if defined(MOZ_MAPI_SUPPORT)
  { NS_ABOUTLOOKDIRECTORY_CONTRACTID, &kNS_ABOUTLOOKDIRECTORY_CID },
  { NS_ABOUTLOOKDIRFACTORY_CONTRACTID, &kNS_ABOUTLOOKDIRFACTORY_CID },
#endif
  { NS_ABDIRECTORYQUERYARGUMENTS_CONTRACTID, &kNS_ABDIRECTORYQUERYARGUMENTS_CID },
  { NS_BOOLEANCONDITIONSTRING_CONTRACTID, &kNS_BOOLEANCONDITIONSTRING_CID },
  { NS_BOOLEANEXPRESSION_CONTRACTID, &kNS_BOOLEANEXPRESSION_CID },

#if defined(MOZ_LDAP_XPCOM)
  { NS_ABLDAPDIRECTORY_CONTRACTID, &kNS_ABLDAPDIRECTORY_CID },
  { NS_ABLDAPDIRECTORYQUERY_CONTRACTID, &kNS_ABLDAPDIRECTORYQUERY_CID },
  { NS_ABLDAPCARD_CONTRACTID, &kNS_ABLDAPCARD_CID },
  { NS_ABLDAPDIRFACTORY_CONTRACTID, &kNS_ABLDAPDIRFACTORY_CID },
  { NS_ABLDAP_REPLICATIONSERVICE_CONTRACTID, &kNS_ABLDAP_REPLICATIONSERVICE_CID },
  { NS_ABLDAP_REPLICATIONQUERY_CONTRACTID, &kNS_ABLDAP_REPLICATIONQUERY_CID },
  { NS_ABLDAP_PROCESSREPLICATIONDATA_CONTRACTID, &kNS_ABLDAP_PROCESSREPLICATIONDATA_CID },
  { NS_ABLDAPACDIRFACTORY_CONTRACTID, &kNS_ABLDAPDIRFACTORY_CID },
  { NS_ABLDAPSACDIRFACTORY_CONTRACTID, &kNS_ABLDAPDIRFACTORY_CID },
#endif

  { NS_ABDIRECTORYQUERYPROXY_CONTRACTID, &kNS_ABDIRECTORYQUERYPROXY_CID },
#ifdef XP_MACOSX
  { NS_ABOSXDIRECTORY_CONTRACTID, &kNS_ABOSXDIRECTORY_CID },
  { NS_ABOSXCARD_CONTRACTID, &kNS_ABOSXCARD_CID },
  { NS_ABOSXDIRFACTORY_CONTRACTID, &kNS_ABOSXDIRFACTORY_CID },
#endif
  { NS_ABVIEW_CONTRACTID, &kNS_ABVIEW_CID },
  { NS_MSGVCARDSERVICE_CONTRACTID, &kNS_MSGVCARDSERVICE_CID },
  { NS_ABLDIFSERVICE_CONTRACTID, &kNS_ABLDIFSERVICE_CID },
  // Bayesian Filter Entries
 { NS_BAYESIANFILTER_CONTRACTID, &kNS_BAYESIANFILTER_CID },
  // Compose Entries
  { NS_MSGCOMPOSE_CONTRACTID, &kNS_MSGCOMPOSE_CID },
  { NS_MSGCOMPOSESERVICE_CONTRACTID, &kNS_MSGCOMPOSESERVICE_CID },
  { NS_MSGCOMPOSESTARTUPHANDLER_CONTRACTID, &kNS_MSGCOMPOSESERVICE_CID },
  { NS_MSGCOMPOSECONTENTHANDLER_CONTRACTID, &kNS_MSGCOMPOSECONTENTHANDLER_CID },
  { NS_MSGCOMPOSEPARAMS_CONTRACTID, &kNS_MSGCOMPOSEPARAMS_CID },
  { NS_MSGCOMPOSESENDLISTENER_CONTRACTID, &kNS_MSGCOMPOSESENDLISTENER_CID },
  { NS_MSGCOMPOSEPROGRESSPARAMS_CONTRACTID, &kNS_MSGCOMPOSEPROGRESSPARAMS_CID },
  { NS_MSGCOMPFIELDS_CONTRACTID, &kNS_MSGCOMPFIELDS_CID },
  { NS_MSGATTACHMENT_CONTRACTID, &kNS_MSGATTACHMENT_CID },
  { NS_MSGATTACHMENTDATA_CONTRACTID, &kNS_MSGATTACHMENTDATA_CID },
  { NS_MSGATTACHEDFILE_CONTRACTID, &kNS_MSGATTACHEDFILE_CID },
  { NS_MSGSEND_CONTRACTID, &kNS_MSGSEND_CID },
  { NS_MSGSENDLATER_CONTRACTID, &kNS_MSGSENDLATER_CID },
  { NS_SMTPSERVICE_CONTRACTID, &kNS_SMTPSERVICE_CID },
  { NS_MAILTOHANDLER_CONTRACTID, &kNS_SMTPSERVICE_CID },
  { NS_SMTPSERVER_CONTRACTID, &kNS_SMTPSERVER_CID },
  { NS_SMTPURL_CONTRACTID, &kNS_SMTPURL_CID },
  { NS_MAILTOURL_CONTRACTID, &kNS_MAILTOURL_CID },
  { NS_MSGQUOTE_CONTRACTID, &kNS_MSGQUOTE_CID },
  { NS_MSGQUOTELISTENER_CONTRACTID, &kNS_MSGQUOTELISTENER_CID },
  { NS_URLFETCHER_CONTRACTID, &kNS_URLFETCHER_CID },
  { NS_MSGCOMPUTILS_CONTRACTID, &kNS_MSGCOMPUTILS_CID },
  // Imap Entries
  { NS_IMAPINCOMINGSERVER_CONTRACTID, &kNS_IMAPINCOMINGSERVER_CID },
  { NS_RDF_RESOURCE_FACTORY_CONTRACTID_PREFIX "imap", &kNS_IMAPRESOURCE_CID },
  { "@mozilla.org/messenger/messageservice;1?type=imap-message", &kNS_IMAPSERVICE_CID },
  { "@mozilla.org/messenger/messageservice;1?type=imap", &kNS_IMAPSERVICE_CID },
  { NS_IMAPSERVICE_CONTRACTID, &kNS_IMAPSERVICE_CID },
  { NS_NETWORK_PROTOCOL_CONTRACTID_PREFIX "imap", &kNS_IMAPSERVICE_CID },
  { NS_IMAPPROTOCOLINFO_CONTRACTID, &kNS_IMAPSERVICE_CID },
  { NS_CONTENT_HANDLER_CONTRACTID_PREFIX"x-application-imapfolder", &kNS_IMAPSERVICE_CID },
  { NS_AUTOSYNCMANAGER_CONTRACTID, &kNS_AUTOSYNCMANAGER_CID },
  // Local Entries
  { NS_MAILBOXURL_CONTRACTID, &kNS_MAILBOXURL_CID },
  { NS_MAILBOXSERVICE_CONTRACTID1, &kNS_MAILBOXSERVICE_CID },
  { NS_MAILBOXSERVICE_CONTRACTID2, &kNS_MAILBOXSERVICE_CID },
  { NS_MAILBOXSERVICE_CONTRACTID3, &kNS_MAILBOXSERVICE_CID },
  { NS_MAILBOXSERVICE_CONTRACTID4, &kNS_MAILBOXSERVICE_CID },
  { NS_MAILBOXPARSER_CONTRACTID, &kNS_MAILBOXPARSER_CID },
  { NS_POP3URL_CONTRACTID, &kNS_POP3URL_CID },
  { NS_POP3SERVICE_CONTRACTID1, &kNS_POP3SERVICE_CID },
  { NS_POP3SERVICE_CONTRACTID2, &kNS_POP3SERVICE_CID },
  { NS_NONESERVICE_CONTRACTID, &kNS_NONESERVICE_CID },
#ifdef HAVE_MOVEMAIL
  { NS_MOVEMAILSERVICE_CONTRACTID, &kNS_MOVEMAILSERVICE_CID },
#endif /* HAVE_MOVEMAIL */
  { NS_POP3PROTOCOLINFO_CONTRACTID, &kNS_POP3SERVICE_CID },
  { NS_NONEPROTOCOLINFO_CONTRACTID, &kNS_NONESERVICE_CID },
#ifdef HAVE_MOVEMAIL
  { NS_MOVEMAILPROTOCOLINFO_CONTRACTID, &kNS_MOVEMAILSERVICE_CID },
#endif /* HAVE_MOVEMAIL */
  { NS_LOCALMAILFOLDERRESOURCE_CONTRACTID, &kNS_LOCALMAILFOLDERRESOURCE_CID },
  { NS_POP3INCOMINGSERVER_CONTRACTID, &kNS_POP3INCOMINGSERVER_CID },
#ifdef HAVE_MOVEMAIL
  { NS_MOVEMAILINCOMINGSERVER_CONTRACTID, &kNS_MOVEMAILINCOMINGSERVER_CID },
#endif /* HAVE_MOVEMAIL */
  { NS_BRKMBOXSTORE_CONTRACTID, &kNS_BRKMBOXSTORE_CID },
  { NS_MAILDIRSTORE_CONTRACTID, &kNS_MAILDIRSTORE_CID },
  { NS_NOINCOMINGSERVER_CONTRACTID, &kNS_NOINCOMINGSERVER_CID },
  { NS_PARSEMAILMSGSTATE_CONTRACTID, &kNS_PARSEMAILMSGSTATE_CID },
  { NS_RSSSERVICE_CONTRACTID, &kNS_RSSSERVICE_CID },
  { NS_RSSPROTOCOLINFO_CONTRACTID, &kNS_RSSSERVICE_CID },
  { NS_RSSINCOMINGSERVER_CONTRACTID, &kNS_RSSINCOMINGSERVER_CID },
  // msgdb Entries
  { NS_MAILBOXDB_CONTRACTID, &kNS_MAILDB_CID },
  { NS_NEWSDB_CONTRACTID, &kNS_NEWSDB_CID },
  { NS_IMAPDB_CONTRACTID, &kNS_IMAPDB_CID },
  { NS_MSG_RETENTIONSETTINGS_CONTRACTID, &kNS_MSG_RETENTIONSETTINGS_CID },
  { NS_MSG_DOWNLOADSETTINGS_CONTRACTID, &kNS_MSG_DOWNLOADSETTINGS_CID },
  { NS_MSGDB_SERVICE_CONTRACTID, &kNS_MSGDB_SERVICE_CID },
  // Mime Entries
  { NS_MIME_OBJECT_CONTRACTID, &kNS_MIME_OBJECT_CLASS_ACCESS_CID },
  { NS_MIME_CONVERTER_CONTRACTID, &kNS_MIME_CONVERTER_CID },
  { NS_MAILNEWS_MIME_HEADER_PARSER_CONTRACTID, &kNS_MSGHEADERPARSER_CID },
  { NS_MAILNEWS_MIME_STREAM_CONVERTER_CONTRACTID, &kNS_MAILNEWS_MIME_STREAM_CONVERTER_CID },
  { NS_MAILNEWS_MIME_STREAM_CONVERTER_CONTRACTID1, &kNS_MAILNEWS_MIME_STREAM_CONVERTER_CID },
  { NS_MAILNEWS_MIME_STREAM_CONVERTER_CONTRACTID2, &kNS_MAILNEWS_MIME_STREAM_CONVERTER_CID },
  { NS_HTML_MIME_EMITTER_CONTRACTID, &kNS_HTML_MIME_EMITTER_CID },
  { NS_XML_MIME_EMITTER_CONTRACTID, &kNS_XML_MIME_EMITTER_CID },
  { NS_PLAIN_MIME_EMITTER_CONTRACTID, &kNS_PLAIN_MIME_EMITTER_CID },
  { NS_RAW_MIME_EMITTER_CONTRACTID, &kNS_RAW_MIME_EMITTER_CID },
  // FTS3
  { NS_FTS3TOKENIZER_CONTRACTID, &kNS_FTS3TOKENIZER_CID },
  // News Entries
  { NS_NNTPURL_CONTRACTID, &kNS_NNTPURL_CID },
  { NS_NNTPSERVICE_CONTRACTID, &kNS_NNTPSERVICE_CID },
  { NS_NEWSSTARTUPHANDLER_CONTRACTID, &kNS_NNTPSERVICE_CID },
  { NS_NNTPPROTOCOLINFO_CONTRACTID, &kNS_NNTPSERVICE_CID },
  { NS_NNTPMESSAGESERVICE_CONTRACTID, &kNS_NNTPSERVICE_CID },
  { NS_NEWSMESSAGESERVICE_CONTRACTID, &kNS_NNTPSERVICE_CID },
  { NS_NEWSPROTOCOLHANDLER_CONTRACTID, &kNS_NNTPSERVICE_CID },
  { NS_SNEWSPROTOCOLHANDLER_CONTRACTID, &kNS_NNTPSERVICE_CID },
  { NS_NNTPPROTOCOLHANDLER_CONTRACTID, &kNS_NNTPSERVICE_CID },
  { NS_CONTENT_HANDLER_CONTRACTID_PREFIX"x-application-newsgroup", &kNS_NNTPSERVICE_CID },
  { NS_CONTENT_HANDLER_CONTRACTID_PREFIX"x-application-newsgroup-listids", &kNS_NNTPSERVICE_CID },
  { NS_NEWSFOLDERRESOURCE_CONTRACTID, &kNS_NEWSFOLDERRESOURCE_CID },
  { NS_NNTPINCOMINGSERVER_CONTRACTID, &kNS_NNTPINCOMINGSERVER_CID },
  { NS_NNTPNEWSGROUPPOST_CONTRACTID, &kNS_NNTPNEWSGROUPPOST_CID },
  { NS_NNTPNEWSGROUPLIST_CONTRACTID, &kNS_NNTPNEWSGROUPLIST_CID },
  { NS_NNTPARTICLELIST_CONTRACTID, &kNS_NNTPARTICLELIST_CID },
  { NS_NEWSDOWNLOADDIALOGARGS_CONTRACTID, &kNS_NEWSDOWNLOADDIALOGARGS_CID },
  // Mail View Entries
  { NS_MSGMAILVIEWLIST_CONTRACTID, &kNS_MSGMAILVIEWLIST_CID },
  // mdn Entries
  { NS_MSGMDNGENERATOR_CONTRACTID, &kNS_MSGMDNGENERATOR_CID },
  // Vcard Entries
  { "@mozilla.org/mimecth;1?type=text/x-vcard", &kNS_VCARD_CONTENT_TYPE_HANDLER_CID },
  // PGP/MIME Entries
  { "@mozilla.org/mimecth;1?type=multipart/encrypted", &kNS_PGPMIME_CONTENT_TYPE_HANDLER_CID },
  { NS_PGPMIMEPROXY_CONTRACTID, &kNS_PGPMIMEPROXY_CID },
  // Tokenizer Entries
  { NULL }
};

static const mozilla::Module::CategoryEntry kMailNewsCategories[] = {
  // MailNews Base Entries
  { XPCOM_DIRECTORY_PROVIDER_CATEGORY, "mail-directory-provider", NS_MAILDIRPROVIDER_CONTRACTID },
  { "content-policy", NS_MSGCONTENTPOLICY_CONTRACTID, NS_MSGCONTENTPOLICY_CONTRACTID },
  MAILNEWSDLF_CATEGORIES
#ifdef XP_MACOSX
  { "app-startup", NS_MESSENGEROSINTEGRATION_CONTRACTID, "service," NS_MESSENGEROSINTEGRATION_CONTRACTID}
,
#endif
  // Address Book Entries
  { "command-line-handler", "m-addressbook", NS_ABMANAGERSTARTUPHANDLER_CONTRACTID },
  // Bayesian Filter Entries
  // Compose Entries
  { "command-line-handler", "m-compose", NS_MSGCOMPOSESTARTUPHANDLER_CONTRACTID },
  // Imap Entries
  // Local Entries
  // msgdb Entries
  // Mime Entries
  { "mime-emitter", NS_HTML_MIME_EMITTER_CONTRACTID, NS_HTML_MIME_EMITTER_CONTRACTID },
  { "mime-emitter", NS_XML_MIME_EMITTER_CONTRACTID, NS_XML_MIME_EMITTER_CONTRACTID },
  { "mime-emitter", NS_PLAIN_MIME_EMITTER_CONTRACTID, NS_PLAIN_MIME_EMITTER_CONTRACTID },
  { "mime-emitter", NS_RAW_MIME_EMITTER_CONTRACTID, NS_RAW_MIME_EMITTER_CONTRACTID },
  // News Entries
  { "command-line-handler", "m-news", NS_NEWSSTARTUPHANDLER_CONTRACTID },
  // Mail View Entries
  // mdn Entries
  // Tokenizer Entries
  { NULL }
};

static void
msgMailNewsModuleDtor()
{
  nsAddrDatabase::CleanupCache();
  nsMsgDatabase::CleanupCache();
}

static const mozilla::Module kMailNewsModule = {
  mozilla::Module::kVersion,
  kMailNewsCIDs,
  kMailNewsContracts,
  kMailNewsCategories,
  NULL,
  NULL,
  msgMailNewsModuleDtor
};

NSMODULE_DEFN(nsMailModule) = &kMailNewsModule;

