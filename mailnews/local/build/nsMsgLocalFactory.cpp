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
 *   Adam D. Moss <adam@gimp.org>
 *   Seth Spitzer <sspitzer@mozilla.org>
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

#include "msgCore.h" // for pre-compiled headers...
#include "mozilla/ModuleUtils.h"
#include "nsMsgLocalCID.h"

// include files for components this factory creates...
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
#include "nsRssService.h"
#include "nsRssIncomingServer.h"
#include "nsCOMPtr.h"

// private factory declarations for each component we know how to produce

NS_GENERIC_FACTORY_CONSTRUCTOR(nsMailboxUrl)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsPop3URL)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgMailboxParser)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMailboxService)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsPop3Service)
#ifdef HAVE_MOVEMAIL
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMovemailService)
#endif /* HAVE_MOVEMAIL */
NS_GENERIC_FACTORY_CONSTRUCTOR(nsNoneService)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgLocalMailFolder)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsParseMailMessageState)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsPop3IncomingServer)
#ifdef HAVE_MOVEMAIL
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMovemailIncomingServer)
#endif /* HAVE_MOVEMAIL */
NS_GENERIC_FACTORY_CONSTRUCTOR(nsNoIncomingServer)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsRssService)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsRssIncomingServer)

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

const mozilla::Module::CIDEntry kMsgLocalCIDs[] = {
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
  { NULL }
};

const mozilla::Module::ContractIDEntry kMsgLocalContracts[] = {
  { NS_MAILBOXURL_CONTRACTID, &kNS_MAILBOXURL_CID},
  { NS_MAILBOXSERVICE_CONTRACTID1, &kNS_MAILBOXSERVICE_CID},
  { NS_MAILBOXSERVICE_CONTRACTID2, &kNS_MAILBOXSERVICE_CID},
  { NS_MAILBOXSERVICE_CONTRACTID3, &kNS_MAILBOXSERVICE_CID},
  { NS_MAILBOXSERVICE_CONTRACTID4, &kNS_MAILBOXSERVICE_CID},
  { NS_MAILBOXPARSER_CONTRACTID, &kNS_MAILBOXPARSER_CID },
  { NS_POP3URL_CONTRACTID, &kNS_POP3URL_CID},
  { NS_POP3SERVICE_CONTRACTID1, &kNS_POP3SERVICE_CID},
  { NS_POP3SERVICE_CONTRACTID2, &kNS_POP3SERVICE_CID},
  { NS_NONESERVICE_CONTRACTID, &kNS_NONESERVICE_CID},
#ifdef HAVE_MOVEMAIL
  { NS_MOVEMAILSERVICE_CONTRACTID, &kNS_MOVEMAILSERVICE_CID},
#endif /* HAVE_MOVEMAIL */
  { NS_POP3PROTOCOLINFO_CONTRACTID, &kNS_POP3SERVICE_CID},
  { NS_NONEPROTOCOLINFO_CONTRACTID, &kNS_NONESERVICE_CID},
#ifdef HAVE_MOVEMAIL
  { NS_MOVEMAILPROTOCOLINFO_CONTRACTID, &kNS_MOVEMAILSERVICE_CID},
#endif /* HAVE_MOVEMAIL */
  { NS_LOCALMAILFOLDERRESOURCE_CONTRACTID, &kNS_LOCALMAILFOLDERRESOURCE_CID},
  { NS_POP3INCOMINGSERVER_CONTRACTID, &kNS_POP3INCOMINGSERVER_CID},
#ifdef HAVE_MOVEMAIL
  { NS_MOVEMAILINCOMINGSERVER_CONTRACTID, &kNS_MOVEMAILINCOMINGSERVER_CID},
#endif /* HAVE_MOVEMAIL */
  { NS_NOINCOMINGSERVER_CONTRACTID, &kNS_NOINCOMINGSERVER_CID},
  { NS_PARSEMAILMSGSTATE_CONTRACTID, &kNS_PARSEMAILMSGSTATE_CID},
  { NS_RSSSERVICE_CONTRACTID, &kNS_RSSSERVICE_CID},
  { NS_RSSPROTOCOLINFO_CONTRACTID, &kNS_RSSSERVICE_CID},
  { NS_RSSINCOMINGSERVER_CONTRACTID, &kNS_RSSINCOMINGSERVER_CID},
  {NULL }
};

static const mozilla::Module kMsgLocalModule = {
    mozilla::Module::kVersion,
    kMsgLocalCIDs,
    kMsgLocalContracts,
};

NSMODULE_DEFN(msglocal) = &kMsgLocalModule;
