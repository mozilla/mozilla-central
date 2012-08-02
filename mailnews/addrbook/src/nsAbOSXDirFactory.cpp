/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsAbOSXDirFactory.h"
#include "nsAbBaseCID.h"
#include "nsEnumeratorUtils.h"
#include "nsIAbDirectory.h"
#include "nsIAbManager.h"
#include "nsStringGlue.h"
#include "nsServiceManagerUtils.h"
#include "nsAbOSXDirectory.h"

NS_IMPL_ISUPPORTS1(nsAbOSXDirFactory, nsIAbDirFactory)

NS_IMETHODIMP
nsAbOSXDirFactory::GetDirectories(const nsAString &aDirName,
                                  const nsACString &aURI,
                                  const nsACString &aPrefName,
                                  nsISimpleEnumerator **aDirectories)
{
  NS_ENSURE_ARG_POINTER(aDirectories);
  
  *aDirectories = nullptr;

  nsresult rv;
  nsCOMPtr<nsIAbManager> abManager(do_GetService(NS_ABMANAGER_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAbDirectory> directory;
  rv = abManager->GetDirectory(NS_LITERAL_CSTRING(NS_ABOSXDIRECTORY_URI_PREFIX "/"),
                               getter_AddRefs(directory));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsIAbOSXDirectory> osxDirectory(do_QueryInterface(directory, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = osxDirectory->AssertChildNodes();
  NS_ENSURE_SUCCESS(rv, rv);
  
  return NS_NewSingletonEnumerator(aDirectories, osxDirectory);
}

// No actual deletion, since you cannot create the address books from Mozilla.
NS_IMETHODIMP
nsAbOSXDirFactory::DeleteDirectory(nsIAbDirectory *aDirectory)
{
  return NS_OK;
}
