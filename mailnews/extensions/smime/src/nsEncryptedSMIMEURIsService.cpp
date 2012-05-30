/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsEncryptedSMIMEURIsService.h"

NS_IMPL_ISUPPORTS1(nsEncryptedSMIMEURIsService, nsIEncryptedSMIMEURIsService)

nsEncryptedSMIMEURIsService::nsEncryptedSMIMEURIsService()
{
}

nsEncryptedSMIMEURIsService::~nsEncryptedSMIMEURIsService()
{
}

NS_IMETHODIMP nsEncryptedSMIMEURIsService::RememberEncrypted(const nsACString & uri)
{
  // Assuming duplicates are allowed.
  mEncryptedURIs.AppendElement(uri);
  return NS_OK;
}

NS_IMETHODIMP nsEncryptedSMIMEURIsService::ForgetEncrypted(const nsACString & uri)
{
  // Assuming, this will only remove one copy of the string, if the array
  // contains multiple copies of the same string.
  mEncryptedURIs.RemoveElement(uri);
  return NS_OK;
}

NS_IMETHODIMP nsEncryptedSMIMEURIsService::IsEncrypted(const nsACString & uri, bool *_retval)
{
  *_retval = (mEncryptedURIs.IndexOf(uri) != -1);
  return NS_OK;
}
