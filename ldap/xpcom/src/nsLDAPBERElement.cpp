/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * 
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsLDAPBERElement.h"
#include "nsStringGlue.h"
#include "nsCOMPtr.h"
#include "nsLDAPBERValue.h"

NS_IMPL_ISUPPORTS1(nsLDAPBERElement, nsILDAPBERElement)

nsLDAPBERElement::nsLDAPBERElement()
  : mElement(0)
{
}

nsLDAPBERElement::~nsLDAPBERElement()
{
  if (mElement) {
    // anything inside here is not something that we own separately from
    // this object, so free it
    ber_free(mElement, 1);
  }

  return;
}

NS_IMETHODIMP
nsLDAPBERElement::Init(nsILDAPBERValue *aValue)
{
  if (aValue) {
    return NS_ERROR_NOT_IMPLEMENTED;
  } 

  mElement = ber_alloc_t(LBER_USE_DER);
  return mElement ? NS_OK : NS_ERROR_OUT_OF_MEMORY;
}

/* void putString (in AUTF8String aString, in unsigned long aTag); */
NS_IMETHODIMP
nsLDAPBERElement::PutString(const nsACString & aString, uint32_t aTag, 
                            uint32_t *aBytesWritten)
{
  // XXX if the string translation feature of the C SDK is ever used,
  // this const_cast will break
  int i = ber_put_ostring(mElement, 
                          const_cast<char *>(PromiseFlatCString(aString).get()),
                          aString.Length(), aTag);

  if (i < 0) {
    return NS_ERROR_FAILURE;
  }

  *aBytesWritten = i;
  return NS_OK;
}

/* void startSet (); */
NS_IMETHODIMP nsLDAPBERElement::StartSet(uint32_t aTag)
{
  int i = ber_start_set(mElement, aTag);

  if (i < 0) {
    return NS_ERROR_FAILURE;
  }

  return NS_OK;
}

/* void putSet (); */
NS_IMETHODIMP nsLDAPBERElement::PutSet(uint32_t *aBytesWritten)
{
  int i = ber_put_set(mElement);

  if (i < 0) {
    return NS_ERROR_FAILURE;
  }

  *aBytesWritten = i;
  return NS_OK;
}

/* nsILDAPBERValue flatten (); */
NS_IMETHODIMP nsLDAPBERElement::GetAsValue(nsILDAPBERValue **_retval)
{
  // create the value object
  nsCOMPtr<nsILDAPBERValue> berValue = new nsLDAPBERValue();

  if (!berValue) {
    NS_ERROR("nsLDAPBERElement::GetAsValue(): out of memory"
             " creating nsLDAPBERValue object");
    return NS_ERROR_OUT_OF_MEMORY;
  }

  struct berval *bv;
  if ( ber_flatten(mElement, &bv) < 0 ) {
    return NS_ERROR_OUT_OF_MEMORY;
  }

  nsresult rv = berValue->Set(bv->bv_len, 
                              reinterpret_cast<uint8_t *>(bv->bv_val));

  // whether or not we've succeeded, we're done with the ldap c sdk struct
  ber_bvfree(bv);

  // as of this writing, this error can only be NS_ERROR_OUT_OF_MEMORY
  if (NS_FAILED(rv)) {
    return rv;
  }

  // return the raw interface pointer
  NS_ADDREF(*_retval = berValue.get());

  return NS_OK;
}
