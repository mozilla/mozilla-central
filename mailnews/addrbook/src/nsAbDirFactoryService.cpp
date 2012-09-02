/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsComponentManagerUtils.h"
#include "nsServiceManagerUtils.h"
#include "nsIIOService.h"
#include "nsNetCID.h"
#include "nsMemory.h"
#include "nsStringGlue.h"
#include "plstr.h"

#include "nsAbBaseCID.h"
#include "nsAbDirFactoryService.h"
#include "nsIAbDirFactory.h"
#include "mozilla/Services.h"

NS_IMPL_ISUPPORTS1(nsAbDirFactoryService, nsIAbDirFactoryService)

nsAbDirFactoryService::nsAbDirFactoryService()
{
}

nsAbDirFactoryService::~nsAbDirFactoryService()
{
}

/* nsIAbDirFactory getDirFactory (in string uri); */
NS_IMETHODIMP
nsAbDirFactoryService::GetDirFactory(const nsACString &aURI,
                                     nsIAbDirFactory** aDirFactory)
{
  NS_ENSURE_ARG_POINTER(aDirFactory);

  nsresult rv;

  // Obtain the network IO service
  nsCOMPtr<nsIIOService> nsService =
    mozilla::services::GetIOService();
  NS_ENSURE_TRUE(nsService, NS_ERROR_UNEXPECTED);
    
  // Extract the scheme
  nsAutoCString scheme;
  rv = nsService->ExtractScheme(aURI, scheme);
  NS_ENSURE_SUCCESS(rv, rv);

  // Try to find a factory using the component manager.
  nsAutoCString contractID;
  contractID.AssignLiteral(NS_AB_DIRECTORY_FACTORY_CONTRACTID_PREFIX);
  contractID.Append(scheme);

  return CallCreateInstance(contractID.get(), aDirFactory);
}
