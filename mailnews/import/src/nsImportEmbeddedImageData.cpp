/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsImportEmbeddedImageData.h"

NS_IMPL_ISUPPORTS1(nsImportEmbeddedImageData, nsIMsgEmbeddedImageData)

nsImportEmbeddedImageData::nsImportEmbeddedImageData()
{
}

nsImportEmbeddedImageData::nsImportEmbeddedImageData(
  nsIURI *aUri, const nsACString &aCid) : m_uri(aUri), m_cid(aCid)
{
}

nsImportEmbeddedImageData::nsImportEmbeddedImageData(
  nsIURI *aUri, const nsACString &aCid, const nsACString &aName)
  : m_uri(aUri), m_cid(aCid), m_name(aName)
{
}

nsImportEmbeddedImageData::~nsImportEmbeddedImageData()
{
}

NS_IMETHODIMP nsImportEmbeddedImageData::GetUri(nsIURI **aUri)
{
  NS_ENSURE_ARG_POINTER(aUri);
  NS_IF_ADDREF(*aUri = m_uri);
  return NS_OK;
}

NS_IMETHODIMP nsImportEmbeddedImageData::SetUri(nsIURI *aUri)
{
  m_uri = aUri;
  return NS_OK;
}

NS_IMETHODIMP nsImportEmbeddedImageData::GetCid(nsACString &aCid)
{
  aCid = m_cid;
  return NS_OK;
}

NS_IMETHODIMP nsImportEmbeddedImageData::SetCid(const nsACString &aCid)
{
  m_cid = aCid;
  return NS_OK;
}

NS_IMETHODIMP nsImportEmbeddedImageData::GetName(nsACString &aName)
{
  aName = m_name;
  return NS_OK;
}

NS_IMETHODIMP nsImportEmbeddedImageData::SetName(const nsACString &aName)
{
  m_name = aName;
  return NS_OK;
}
