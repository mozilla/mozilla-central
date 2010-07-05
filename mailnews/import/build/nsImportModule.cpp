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

////////////////////////////////////////////////////////////////////////////////
// Core Module Include Files
////////////////////////////////////////////////////////////////////////////////
#include "nsCOMPtr.h"
#include "mozilla/ModuleUtils.h"

////////////////////////////////////////////////////////////////////////////////
// core import Include Files
////////////////////////////////////////////////////////////////////////////////
#include "nsImportService.h"
#include "nsImportMimeEncode.h"
#include "nsImportStringBundle.h"

NS_DEFINE_NAMED_CID(NS_IMPORTSERVICE_CID);
NS_DEFINE_NAMED_CID(NS_IMPORTMIMEENCODE_CID);
////////////////////////////////////////////////////////////////////////////////
// text import Include Files
////////////////////////////////////////////////////////////////////////////////
#include "nsTextImport.h"

NS_DEFINE_NAMED_CID(NS_TEXTIMPORT_CID);

////////////////////////////////////////////////////////////////////////////////
// nsComm4x import Include Files
////////////////////////////////////////////////////////////////////////////////
#include "nsComm4xProfile.h"
#include "nsComm4xMailStringBundle.h"
#include "nsComm4xMailImport.h"

NS_DEFINE_NAMED_CID(NS_COMM4XMAILIMPORT_CID);
NS_DEFINE_NAMED_CID(NS_ICOMM4XPROFILE_CID);
NS_DEFINE_NAMED_CID(NS_COMM4XMAILIMPL_CID);
////////////////////////////////////////////////////////////////////////////////
// eudora import Include Files
////////////////////////////////////////////////////////////////////////////////
#if defined(XP_WIN) || defined(XP_MACOSX)
#include "nsEudoraImport.h"
#include "nsEudoraStringBundle.h"

NS_DEFINE_NAMED_CID(NS_EUDORAIMPORT_CID);
#endif

////////////////////////////////////////////////////////////////////////////////
// Apple Mail import Include Files
////////////////////////////////////////////////////////////////////////////////
#if defined(XP_MACOSX)
#include "nsAppleMailImport.h"

NS_DEFINE_NAMED_CID(NS_APPLEMAILIMPORT_CID);
NS_DEFINE_NAMED_CID(NS_APPLEMAILIMPL_CID);
#endif

////////////////////////////////////////////////////////////////////////////////
// outlook import Include Files
////////////////////////////////////////////////////////////////////////////////
#ifdef XP_WIN
#include "nsOEImport.h"
#include "nsOEStringBundle.h"
#include "nsOutlookImport.h"
#include "nsOutlookStringBundle.h"
#include "nsWMImport.h"
#include "nsWMStringBundle.h"

NS_DEFINE_NAMED_CID(NS_OEIMPORT_CID);
NS_DEFINE_NAMED_CID(NS_OUTLOOKIMPORT_CID);
NS_DEFINE_NAMED_CID(NS_WMIMPORT_CID);
#endif // XP_WIN

////////////////////////////////////////////////////////////////////////////////
// core import factories
////////////////////////////////////////////////////////////////////////////////
NS_GENERIC_FACTORY_CONSTRUCTOR(nsImportService)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsIImportMimeEncodeImpl)

////////////////////////////////////////////////////////////////////////////////
// text import factories
////////////////////////////////////////////////////////////////////////////////
NS_GENERIC_FACTORY_CONSTRUCTOR(nsTextImport)

////////////////////////////////////////////////////////////////////////////////
// nsComm4x import factories
////////////////////////////////////////////////////////////////////////////////
NS_GENERIC_FACTORY_CONSTRUCTOR(nsComm4xMailImport)
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(ImportComm4xMailImpl, Initialize)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsComm4xProfile)

////////////////////////////////////////////////////////////////////////////////
// eudora import factories
////////////////////////////////////////////////////////////////////////////////
#if defined(XP_WIN) || defined(XP_MACOSX)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsEudoraImport)
#endif

////////////////////////////////////////////////////////////////////////////////
// apple mail import factories
////////////////////////////////////////////////////////////////////////////////
#if defined(XP_MACOSX)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsAppleMailImportModule)
NS_GENERIC_FACTORY_CONSTRUCTOR_INIT(nsAppleMailImportMail, Initialize)
#endif

////////////////////////////////////////////////////////////////////////////////
// outlook import factories
////////////////////////////////////////////////////////////////////////////////
#ifdef XP_WIN
NS_GENERIC_FACTORY_CONSTRUCTOR(nsOEImport)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsOutlookImport)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsWMImport)
#endif // XP_WIN

static const mozilla::Module::CategoryEntry kMailNewsImportCategories[] = {
  // XXX These CIDs should match the explicit CIDs defined in the header files,
  // or be changed so that they are contract IDs (with appropraite code updates)
  { "mailnewsimport", "{A5991D01-ADA7-11d3-A9C2-00A0CC26DA63}", "addressbook"},
  { "mailnewsimport", "{647cc990-2bdb-11d6-92a0-0010a4b26cda}", kComm4xMailSupportsString},
#if defined(XP_WIN) || defined(XP_MACOSX)
  { "mailnewsimport", "{c8448da0-8f83-11d3-a206-00a0cc26da63}", kEudoraSupportsString},
#endif
#ifdef XP_WIN
  { "mailnewsimport", "{42bc82bc-8e9f-4597-8b6e-e529daaf3af1}", kWMSupportsString },
  { "mailnewsimport", "{1DB469A0-8B00-11d3-A206-00A0CC26DA63}", kOutlookSupportsString },
  { "mailnewsimport", "{be0bc880-1742-11d3-a206-00a0cc26da63}", kOESupportsString},
#endif
#if defined(XP_MACOSX)
  { "mailnewsimport", "{6d3f101c-70ec-4e04-b68d-9908d1aeddf3}", kAppleMailSupportsString },
#endif
  { NULL }
};

  const mozilla::Module::CIDEntry kMailNewsImportCIDs[] = {
  { &kNS_IMPORTSERVICE_CID, false, NULL, nsImportServiceConstructor },
  { &kNS_IMPORTMIMEENCODE_CID, false, NULL, nsIImportMimeEncodeImplConstructor },
  { &kNS_TEXTIMPORT_CID, false, NULL, nsTextImportConstructor },
  { &kNS_COMM4XMAILIMPORT_CID, false, NULL, nsComm4xMailImportConstructor },
  { &kNS_COMM4XMAILIMPL_CID, false, NULL, ImportComm4xMailImplConstructor},
  { &kNS_ICOMM4XPROFILE_CID, false, NULL, nsComm4xProfileConstructor },
#if defined(XP_WIN) || defined(XP_MACOSX)
  { &kNS_EUDORAIMPORT_CID, false, NULL, nsEudoraImportConstructor },
#endif
#if defined(XP_MACOSX)
  { &kNS_APPLEMAILIMPORT_CID, false, NULL, nsAppleMailImportModuleConstructor },
  { &kNS_APPLEMAILIMPL_CID, false, NULL, nsAppleMailImportMailConstructor },
#endif

#ifdef XP_WIN
  { &kNS_OEIMPORT_CID, false, NULL, nsOEImportConstructor },
  { &kNS_WMIMPORT_CID, false, NULL, nsWMImportConstructor },
  { &kNS_OUTLOOKIMPORT_CID, false, NULL, nsOutlookImportConstructor },
#endif
  { NULL }
};

  const mozilla::Module::ContractIDEntry kMailNewsImportContracts[] = {
  { NS_IMPORTSERVICE_CONTRACTID, &kNS_IMPORTSERVICE_CID},
  { "@mozilla.org/import/import-mimeencode;1", &kNS_IMPORTMIMEENCODE_CID},
  { "@mozilla.org/import/import-text;1", &kNS_TEXTIMPORT_CID},
  { "@mozilla.org/import/import-comm4xMail;1", &kNS_COMM4XMAILIMPORT_CID},
  { NS_COMM4XMAILIMPL_CONTRACTID, &kNS_COMM4XMAILIMPL_CID},
  { NS_ICOMM4XPROFILE_CONTRACTID, &kNS_ICOMM4XPROFILE_CID},
#if defined(XP_WIN) || defined(XP_MACOSX)
  { "@mozilla.org/import/import-eudora;1", &kNS_EUDORAIMPORT_CID},
#endif
#if defined(XP_MACOSX)
  { "@mozilla.org/import/import-applemail;1", &kNS_APPLEMAILIMPORT_CID},
  { NS_APPLEMAILIMPL_CONTRACTID, &kNS_APPLEMAILIMPL_CID},
#endif

#ifdef XP_WIN
  { "@mozilla.org/import/import-oe;1", &kNS_OEIMPORT_CID},
  { "@mozilla.org/import/import-wm;1", &kNS_WMIMPORT_CID},
  { "@mozilla.org/import/import-outlook;1", &kNS_OUTLOOKIMPORT_CID},
#endif
  { NULL }
};


static void importModuleDtor()
{
#if defined(XP_WIN) || defined(XP_MACOSX)
    nsEudoraStringBundle::Cleanup();
#endif

#ifdef XP_WIN

    nsOEStringBundle::Cleanup();
    nsWMStringBundle::Cleanup();
    nsOutlookStringBundle::Cleanup();

#endif
}

static const mozilla::Module kMailNewsImportModule = {
  mozilla::Module::kVersion,
  kMailNewsImportCIDs,
  kMailNewsImportContracts,
  kMailNewsImportCategories,
  NULL,
  NULL,
  importModuleDtor
};

NSMODULE_DEFN(mailnewsimport) = &kMailNewsImportModule;


