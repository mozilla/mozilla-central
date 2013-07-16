/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "mozilla/ModuleUtils.h"
#include "nsISupports.h"
#include "nsCOMPtr.h"

#include "nsIFactory.h"
#include "nsIServiceManager.h"
#include "nsIModule.h"

#include "nsMsgSMIMECID.h"
#include "nsMsgCompCID.h"

/* Include all of the interfaces our factory can generate components for */
#include "nsMsgComposeSecure.h"
#include "nsSMimeJSHelper.h"
#include "nsEncryptedSMIMEURIsService.h"

NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgComposeSecure)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsMsgSMIMEComposeFields)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsSMimeJSHelper)
NS_GENERIC_FACTORY_CONSTRUCTOR(nsEncryptedSMIMEURIsService)

NS_DEFINE_NAMED_CID(NS_MSGCOMPOSESECURE_CID);
NS_DEFINE_NAMED_CID(NS_MSGSMIMECOMPFIELDS_CID);
NS_DEFINE_NAMED_CID(NS_SMIMEJSJELPER_CID);
NS_DEFINE_NAMED_CID(NS_SMIMEENCRYPTURISERVICE_CID);

const mozilla::Module::CIDEntry kMsgSMIMECIDs[] = {
  { &kNS_MSGCOMPOSESECURE_CID, false, NULL, nsMsgComposeSecureConstructor },
  { &kNS_MSGSMIMECOMPFIELDS_CID, false, NULL, nsMsgSMIMEComposeFieldsConstructor },
  { &kNS_SMIMEJSJELPER_CID, false, NULL, nsSMimeJSHelperConstructor },
  { &kNS_SMIMEENCRYPTURISERVICE_CID, false, NULL, nsEncryptedSMIMEURIsServiceConstructor },
  { NULL }
};

const mozilla::Module::ContractIDEntry kMsgSMIMEContracts[] = {
  { NS_MSGCOMPOSESECURE_CONTRACTID, &kNS_MSGCOMPOSESECURE_CID },
  { NS_MSGSMIMECOMPFIELDS_CONTRACTID, &kNS_MSGSMIMECOMPFIELDS_CID },
  { NS_SMIMEJSHELPER_CONTRACTID, &kNS_SMIMEJSJELPER_CID },
  { NS_SMIMEENCRYPTURISERVICE_CONTRACTID, &kNS_SMIMEENCRYPTURISERVICE_CID },
  { NULL }
};

/////////////////////////////////////////////////////////////////////////////
//
/////////////////////////////////////////////////////////////////////////////

static const mozilla::Module kMsgSMIMEModule = {
    mozilla::Module::kVersion,
    kMsgSMIMECIDs,
    kMsgSMIMEContracts
};

NSMODULE_DEFN(nsMsgSMIMEModule) = &kMsgSMIMEModule;
