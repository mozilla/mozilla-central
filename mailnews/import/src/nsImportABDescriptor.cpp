/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


#include "nscore.h"
#include "nsImportABDescriptor.h"

////////////////////////////////////////////////////////////////////////

NS_METHOD nsImportABDescriptor::Create(nsISupports *aOuter, REFNSIID aIID, void **aResult)
{
  if (aOuter)
    return NS_ERROR_NO_AGGREGATION;

  nsImportABDescriptor *it = new nsImportABDescriptor();
  if (it == nullptr)
    return NS_ERROR_OUT_OF_MEMORY;

  NS_ADDREF(it);
  nsresult rv = it->QueryInterface(aIID, aResult);
  NS_RELEASE(it);
  return rv;
}

NS_IMPL_ISUPPORTS1(nsImportABDescriptor, nsIImportABDescriptor)

nsImportABDescriptor::nsImportABDescriptor()
  : mId(0), mRef(0), mSize(0), mImport(true)
{
}
