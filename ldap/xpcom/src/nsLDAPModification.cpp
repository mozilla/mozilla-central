/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsLDAPModification.h"
#include "nsILDAPBERValue.h"
#include "nsISimpleEnumerator.h"
#include "nsServiceManagerUtils.h"
#include "nsComponentManagerUtils.h"

using namespace mozilla;

NS_IMPL_ISUPPORTS1(nsLDAPModification, nsILDAPModification)

// constructor
//
nsLDAPModification::nsLDAPModification()
    : mValuesLock("nsLDAPModification.mValuesLock")
{
}

// destructor
//
nsLDAPModification::~nsLDAPModification()
{
}

nsresult
nsLDAPModification::Init()
{
  return NS_OK;
}

NS_IMETHODIMP
nsLDAPModification::GetOperation(int32_t *aOperation)
{
  NS_ENSURE_ARG_POINTER(aOperation);

  *aOperation = mOperation;
  return NS_OK;
}

NS_IMETHODIMP nsLDAPModification::SetOperation(int32_t aOperation)
{
  mOperation = aOperation;
  return NS_OK;
}

NS_IMETHODIMP
nsLDAPModification::GetType(nsACString& aType)
{
  aType.Assign(mType);
  return NS_OK;
}

NS_IMETHODIMP
nsLDAPModification::SetType(const nsACString& aType)
{
  mType.Assign(aType);
  return NS_OK;
}

NS_IMETHODIMP
nsLDAPModification::GetValues(nsIArray** aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);

  MutexAutoLock lock(mValuesLock);

  if (!mValues)
    return NS_ERROR_NOT_INITIALIZED;

  NS_ADDREF(*aResult = mValues);

  return NS_OK;
}

NS_IMETHODIMP
nsLDAPModification::SetValues(nsIArray* aValues)
{
  NS_ENSURE_ARG_POINTER(aValues);

  MutexAutoLock lock(mValuesLock);
  nsresult rv;

  if (!mValues)
    mValues = do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
  else
    rv = mValues->Clear();

  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsISimpleEnumerator> enumerator;
  rv = aValues->Enumerate(getter_AddRefs(enumerator));
  NS_ENSURE_SUCCESS(rv, rv);

  bool hasMoreElements;
  rv = enumerator->HasMoreElements(&hasMoreElements);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsISupports> value;

  while (hasMoreElements)
  {
    rv = enumerator->GetNext(getter_AddRefs(value));
    NS_ENSURE_SUCCESS(rv, rv);

    rv = mValues->AppendElement(value, false);
    NS_ENSURE_SUCCESS(rv, rv);

    rv = enumerator->HasMoreElements(&hasMoreElements);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  return NS_OK;
}

NS_IMETHODIMP
nsLDAPModification::SetUpModification(int32_t aOperation,
                                      const nsACString &aType,
                                      nsIArray *aValues)
{
  // Set the values using our local function before entering lock
  // to avoid deadlocks due to holding the same lock twice.
  nsresult rv = SetValues(aValues);

  MutexAutoLock lock(mValuesLock);

  mOperation = aOperation;
  mType.Assign(aType);

  return rv;
}

NS_IMETHODIMP
nsLDAPModification::SetUpModificationOneValue(int32_t aOperation,
                                              const nsACString &aType,
                                              nsILDAPBERValue *aValue)
{
  NS_ENSURE_ARG_POINTER(aValue);

  MutexAutoLock lock(mValuesLock);

  mOperation = aOperation;
  mType.Assign(aType);

  nsresult rv;

  if (!mValues)
    mValues = do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
  else
    rv = mValues->Clear();

  NS_ENSURE_SUCCESS(rv, rv);
  
  return mValues->AppendElement(aValue, false);
}
