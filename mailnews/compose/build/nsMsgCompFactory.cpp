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
#include "msgCore.h"

#include "nsISupports.h"
#include "nsCOMPtr.h"

#include "nsIFactory.h"
#include "nsICategoryManager.h"
#include "nsIServiceManager.h"
#include "nsServiceManagerUtils.h"
#include "nsIModule.h"

#include "pratom.h"
#include "nsMsgCompCID.h"

/* Include all of the interfaces our factory can generate components for */
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

NS_GENERIC_FACTORY_CONSTRUCTOR(nsSmtpService)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsSmtpServer)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgCompose)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgComposeParams)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgComposeSendListener)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgComposeProgressParams)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgCompFields)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgAttachment)
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

const mozilla::Module::CIDEntry kMsgComposeCIDs[] = {
  { &kNS_MSGCOMPOSE_CID, false, NULL, nsMsgComposeConstructor},
  { &kNS_MSGCOMPOSESERVICE_CID, false, NULL, nsMsgComposeServiceConstructor},
  { &kNS_MSGCOMPOSECONTENTHANDLER_CID, false, NULL, nsMsgComposeContentHandlerConstructor},
  { &kNS_MSGCOMPOSEPARAMS_CID, false, NULL, nsMsgComposeParamsConstructor},
  { &kNS_MSGCOMPOSESENDLISTENER_CID, false, NULL, nsMsgComposeSendListenerConstructor},
  { &kNS_MSGCOMPOSEPROGRESSPARAMS_CID, false, NULL, nsMsgComposeProgressParamsConstructor},
  { &kNS_MSGCOMPFIELDS_CID, false, NULL, nsMsgCompFieldsConstructor},
  { &kNS_MSGATTACHMENT_CID, false, NULL, nsMsgAttachmentConstructor},
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
  { NULL}
};

const mozilla::Module::ContractIDEntry kMsgComposeContracts[] = {
  { NS_MSGCOMPOSE_CONTRACTID, &kNS_MSGCOMPOSE_CID},
  { NS_MSGCOMPOSESERVICE_CONTRACTID, &kNS_MSGCOMPOSESERVICE_CID},
  { NS_MSGCOMPOSESTARTUPHANDLER_CONTRACTID, &kNS_MSGCOMPOSESERVICE_CID},
  { NS_MSGCOMPOSECONTENTHANDLER_CONTRACTID, &kNS_MSGCOMPOSECONTENTHANDLER_CID},
  { NS_MSGCOMPOSEPARAMS_CONTRACTID, &kNS_MSGCOMPOSEPARAMS_CID},
  { NS_MSGCOMPOSESENDLISTENER_CONTRACTID, &kNS_MSGCOMPOSESENDLISTENER_CID},
  { NS_MSGCOMPOSEPROGRESSPARAMS_CONTRACTID, &kNS_MSGCOMPOSEPROGRESSPARAMS_CID},
  { NS_MSGCOMPFIELDS_CONTRACTID, &kNS_MSGCOMPFIELDS_CID},
  { NS_MSGATTACHMENT_CONTRACTID, &kNS_MSGATTACHMENT_CID},
  { NS_MSGSEND_CONTRACTID, &kNS_MSGSEND_CID},
  { NS_MSGSENDLATER_CONTRACTID, &kNS_MSGSENDLATER_CID},
  { NS_SMTPSERVICE_CONTRACTID, &kNS_SMTPSERVICE_CID},
  { NS_MAILTOHANDLER_CONTRACTID, &kNS_SMTPSERVICE_CID},
  { NS_SMTPSERVER_CONTRACTID, &kNS_SMTPSERVER_CID},
  { NS_SMTPURL_CONTRACTID, &kNS_SMTPURL_CID},
  { NS_MAILTOURL_CONTRACTID, &kNS_MAILTOURL_CID},
  { NS_MSGQUOTE_CONTRACTID, &kNS_MSGQUOTE_CID},
  { NS_MSGQUOTELISTENER_CONTRACTID, &kNS_MSGQUOTELISTENER_CID},
  { NS_URLFETCHER_CONTRACTID, &kNS_URLFETCHER_CID},
  { NS_MSGCOMPUTILS_CONTRACTID, &kNS_MSGCOMPUTILS_CID},
  { NULL }
};

static const mozilla::Module::CategoryEntry kMsgComposeCategories[] = {
  { "command-line-handler", "m-compose",
                                  NS_MSGCOMPOSESTARTUPHANDLER_CONTRACTID},
  { NULL }
};

static const mozilla::Module kMsgComposeModule = {
    mozilla::Module::kVersion,
    kMsgComposeCIDs,
    kMsgComposeContracts,
    kMsgComposeCategories,
    NULL,
    NULL,
    NULL
};

NSMODULE_DEFN(msg_compose) = &kMsgComposeModule;

