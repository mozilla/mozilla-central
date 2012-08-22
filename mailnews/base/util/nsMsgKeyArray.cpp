/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsMsgKeyArray.h"
#include "nsMemory.h"

NS_IMPL_ISUPPORTS1(nsMsgKeyArray, nsIMsgKeyArray)

nsMsgKeyArray::nsMsgKeyArray()
{
}

nsMsgKeyArray::~nsMsgKeyArray()
{
}

NS_IMETHODIMP nsMsgKeyArray::Sort()
{
  m_keys.Sort();
  return NS_OK;
}

NS_IMETHODIMP nsMsgKeyArray::GetKeyAt(int32_t aIndex, nsMsgKey *aKey)
{
  NS_ENSURE_ARG_POINTER(aKey);
  *aKey = m_keys[aIndex];
  return NS_OK;
}

NS_IMETHODIMP nsMsgKeyArray::GetLength(uint32_t *aLength)
{
  NS_ENSURE_ARG_POINTER(aLength);
  *aLength = m_keys.Length();
  return NS_OK;
}

NS_IMETHODIMP nsMsgKeyArray::SetCapacity(uint32_t aCapacity)
{
  m_keys.SetCapacity(aCapacity);
  return NS_OK;
}

NS_IMETHODIMP nsMsgKeyArray::AppendElement(nsMsgKey aKey)
{
  m_keys.AppendElement(aKey);
  return NS_OK;
}

NS_IMETHODIMP nsMsgKeyArray::InsertElementSorted(nsMsgKey aKey)
{
  m_keys.InsertElementSorted(aKey);
  return NS_OK;
}

NS_IMETHODIMP nsMsgKeyArray::GetArray(uint32_t *aCount, nsMsgKey **aKeys)
{
  NS_ENSURE_ARG_POINTER(aCount);
  NS_ENSURE_ARG_POINTER(aKeys);
  *aCount = m_keys.Length();
  *aKeys =
    (nsMsgKey *) nsMemory::Clone(&m_keys[0],
                                 m_keys.Length() * sizeof(nsMsgKey));
  return (*aKeys) ? NS_OK : NS_ERROR_OUT_OF_MEMORY;
}

