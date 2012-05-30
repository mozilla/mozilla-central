/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "mozilla/ModuleUtils.h"
#include "nsCOMPtr.h"
#include "nsMorkCID.h"
#include "nsIMdbFactoryFactory.h"
#include "mdb.h"

class nsMorkFactoryService : public nsIMdbFactoryService
{
public:
  nsMorkFactoryService() {};
  // nsISupports methods
  NS_DECL_ISUPPORTS 

  NS_IMETHOD GetMdbFactory(nsIMdbFactory **aFactory);

protected:
  nsCOMPtr<nsIMdbFactory> mMdbFactory;
};

NS_GENERIC_FACTORY_CONSTRUCTOR(nsMorkFactoryService)

NS_DEFINE_NAMED_CID(NS_MORK_CID);

const mozilla::Module::CIDEntry kMorkCIDs[] = {
  { &kNS_MORK_CID, false, NULL, nsMorkFactoryServiceConstructor },
  { NULL }
};

const mozilla::Module::ContractIDEntry kMorkContracts[] = {
  { NS_MORK_CONTRACTID, &kNS_MORK_CID },
  { NULL }
};

static const mozilla::Module kMorkModule = {
  mozilla::Module::kVersion,
  kMorkCIDs,
  kMorkContracts
};

NSMODULE_DEFN(nsMorkModule) = &kMorkModule;

NS_IMPL_ISUPPORTS1(nsMorkFactoryService, nsIMdbFactoryService)

NS_IMETHODIMP nsMorkFactoryService::GetMdbFactory(nsIMdbFactory **aFactory)
{
  if (!mMdbFactory)
    mMdbFactory = MakeMdbFactory();
  NS_IF_ADDREF(*aFactory = mMdbFactory);
  return *aFactory ? NS_OK : NS_ERROR_OUT_OF_MEMORY;
}
