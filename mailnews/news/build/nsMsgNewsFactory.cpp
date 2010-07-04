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

#include "nsISupports.h"
#include "mozilla/ModuleUtils.h"

#include "msgCore.h"
#include "pratom.h"
#include "nsICategoryManager.h"
#include "nsIComponentManager.h"
#include "nsIServiceManager.h"
#include "nsCOMPtr.h"

#include "nsNewsFolder.h"
#include "nsMsgNewsCID.h"

/* Include all of the interfaces our factory can generate components for */
#include "nsNntpUrl.h"
#include "nsNntpService.h"
#include "nsNntpIncomingServer.h"
#include "nsNNTPNewsgroupPost.h"
#include "nsNNTPNewsgroupList.h"
#include "nsNNTPArticleList.h"
#include "nsNewsDownloadDialogArgs.h"
#include "nsCURILoader.h"
#include "nsServiceManagerUtils.h"

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

static const mozilla::Module::CategoryEntry kMsgNewsCategories[] = {
  { "command-line-handler", "m-news", NS_NEWSSTARTUPHANDLER_CONTRACTID },
  { NULL }
};

const mozilla::Module::CIDEntry kMsgNewsCIDs[] = {
  { &kNS_NNTPURL_CID, false, NULL, nsNntpUrlConstructor },
  { &kNS_NNTPSERVICE_CID, false, NULL, nsNntpServiceConstructor },
  { &kNS_NEWSFOLDERRESOURCE_CID, false, NULL, nsMsgNewsFolderConstructor },
  { &kNS_NNTPINCOMINGSERVER_CID, false, NULL, nsNntpIncomingServerConstructor },
  { &kNS_NNTPNEWSGROUPPOST_CID, false, NULL, nsNNTPNewsgroupPostConstructor },
  { &kNS_NNTPNEWSGROUPLIST_CID, false, NULL, nsNNTPNewsgroupListConstructor },
  { &kNS_NNTPARTICLELIST_CID, false, NULL, nsNNTPArticleListConstructor },
  { &kNS_NEWSDOWNLOADDIALOGARGS_CID, false, NULL, nsNewsDownloadDialogArgsConstructor },
  { NULL }
};

const mozilla::Module::ContractIDEntry kMsgNewsContracts[] = {
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
  { NULL }
};

static const mozilla::Module kMsgNewsModule = {
    mozilla::Module::kVersion,
    kMsgNewsCIDs,
    kMsgNewsContracts,
    kMsgNewsCategories
};

NSMODULE_DEFN(msgnews) = &kMsgNewsModule;

