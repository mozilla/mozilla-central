/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsIURI.h"
#include "nsNetCID.h"
#include "nsAddbookUrl.h"
#include "nsStringGlue.h"
#include "nsAbBaseCID.h"
#include "nsComponentManagerUtils.h"
#include "nsAutoPtr.h"

/////////////////////////////////////////////////////////////////////////////////////
// addbook url definition
/////////////////////////////////////////////////////////////////////////////////////
nsAddbookUrl::nsAddbookUrl()
{
  m_baseURL = do_CreateInstance(NS_SIMPLEURI_CONTRACTID);

  mOperationType = nsIAddbookUrlOperation::InvalidUrl; 
}

nsAddbookUrl::~nsAddbookUrl()
{
}

NS_IMPL_ISUPPORTS2(nsAddbookUrl, nsIAddbookUrl, nsIURI)

NS_IMETHODIMP 
nsAddbookUrl::SetSpec(const nsACString &aSpec)
{
  nsresult rv = m_baseURL->SetSpec(aSpec);
  NS_ENSURE_SUCCESS(rv, rv);
  return ParseUrl();
}

nsresult nsAddbookUrl::ParseUrl()
{
  nsAutoCString pathStr;

  nsresult rv = m_baseURL->GetPath(pathStr);
  NS_ENSURE_SUCCESS(rv,rv);

  if (strstr(pathStr.get(), "?action=print"))
    mOperationType = nsIAddbookUrlOperation::PrintAddressBook;
  else if (strstr(pathStr.get(), "?action=add"))
    mOperationType = nsIAddbookUrlOperation::AddVCard;
  else
    mOperationType = nsIAddbookUrlOperation::InvalidUrl;
  return NS_OK;
}

////////////////////////////////////////////////////////////////////////////////////
// Begin nsIURI support
////////////////////////////////////////////////////////////////////////////////////


NS_IMETHODIMP nsAddbookUrl::GetSpec(nsACString &aSpec)
{
	return m_baseURL->GetSpec(aSpec);
}

NS_IMETHODIMP nsAddbookUrl::GetPrePath(nsACString &aPrePath)
{
	return m_baseURL->GetPrePath(aPrePath);
}

NS_IMETHODIMP nsAddbookUrl::GetScheme(nsACString &aScheme)
{
	return m_baseURL->GetScheme(aScheme);
}

NS_IMETHODIMP nsAddbookUrl::SetScheme(const nsACString &aScheme)
{
	return m_baseURL->SetScheme(aScheme);
}

NS_IMETHODIMP nsAddbookUrl::GetUserPass(nsACString &aUserPass)
{
	return m_baseURL->GetUserPass(aUserPass);
}

NS_IMETHODIMP nsAddbookUrl::SetUserPass(const nsACString &aUserPass)
{
	return m_baseURL->SetUserPass(aUserPass);
}

NS_IMETHODIMP nsAddbookUrl::GetUsername(nsACString &aUsername)
{
	return m_baseURL->GetUsername(aUsername);
}

NS_IMETHODIMP nsAddbookUrl::SetUsername(const nsACString &aUsername)
{
	return m_baseURL->SetUsername(aUsername);
}

NS_IMETHODIMP nsAddbookUrl::GetPassword(nsACString &aPassword)
{
	return m_baseURL->GetPassword(aPassword);
}

NS_IMETHODIMP nsAddbookUrl::SetPassword(const nsACString &aPassword)
{
	return m_baseURL->SetPassword(aPassword);
}

NS_IMETHODIMP nsAddbookUrl::GetHostPort(nsACString &aHostPort)
{
	return m_baseURL->GetHostPort(aHostPort);
}

NS_IMETHODIMP nsAddbookUrl::SetHostPort(const nsACString &aHostPort)
{
	return m_baseURL->SetHostPort(aHostPort);
}

NS_IMETHODIMP nsAddbookUrl::GetHost(nsACString &aHost)
{
	return m_baseURL->GetHost(aHost);
}

NS_IMETHODIMP nsAddbookUrl::SetHost(const nsACString &aHost)
{
	return m_baseURL->SetHost(aHost);
}

NS_IMETHODIMP nsAddbookUrl::GetPort(int32_t *aPort)
{
	return m_baseURL->GetPort(aPort);
}

NS_IMETHODIMP nsAddbookUrl::SetPort(int32_t aPort)
{
	return m_baseURL->SetPort(aPort);
}

NS_IMETHODIMP nsAddbookUrl::GetPath(nsACString &aPath)
{
	return m_baseURL->GetPath(aPath);
}

NS_IMETHODIMP nsAddbookUrl::SetPath(const nsACString &aPath)
{
  m_baseURL->SetPath(aPath);
  return ParseUrl();
}

NS_IMETHODIMP nsAddbookUrl::GetAsciiHost(nsACString &aHostA)
{
	return m_baseURL->GetAsciiHost(aHostA);
}

NS_IMETHODIMP nsAddbookUrl::GetAsciiSpec(nsACString &aSpecA)
{
	return m_baseURL->GetAsciiSpec(aSpecA);
}

NS_IMETHODIMP nsAddbookUrl::GetOriginCharset(nsACString &aOriginCharset)
{
    return m_baseURL->GetOriginCharset(aOriginCharset);
}

NS_IMETHODIMP nsAddbookUrl::SchemeIs(const char *aScheme, bool *_retval)
{
	return m_baseURL->SchemeIs(aScheme, _retval);
}

NS_IMETHODIMP nsAddbookUrl::Equals(nsIURI *other, bool *_retval)
{
  // The passed-in URI might be an nsMailtoUrl. Pass our inner URL to its
  // Equals method. The other nsMailtoUrl will then pass its inner URL to
  // to the Equals method of our inner URL. Other URIs will return false.
  if (other)
    return other->Equals(m_baseURL, _retval);

  return m_baseURL->Equals(other, _retval);
}

NS_IMETHODIMP nsAddbookUrl::Clone(nsIURI **_retval)
{
  NS_ENSURE_ARG_POINTER(_retval);

  nsRefPtr<nsAddbookUrl> clone = new nsAddbookUrl();

  if (!clone)
    return NS_ERROR_OUT_OF_MEMORY;

  nsresult rv = m_baseURL->Clone(getter_AddRefs(clone->m_baseURL));
  NS_ENSURE_SUCCESS(rv, rv);
  clone->ParseUrl();
  *_retval = clone.forget().get();
  return NS_OK;
}	

NS_IMETHODIMP nsAddbookUrl::Resolve(const nsACString &relativePath, nsACString &result) 
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
nsAddbookUrl::GetRef(nsACString &result)
{
  return m_baseURL->GetRef(result);
}

NS_IMETHODIMP
nsAddbookUrl::SetRef(const nsACString &aRef)
{
  m_baseURL->SetRef(aRef);
  return ParseUrl();
}

NS_IMETHODIMP nsAddbookUrl::EqualsExceptRef(nsIURI *other, bool *_retval)
{
  // The passed-in URI might be an nsMailtoUrl. Pass our inner URL to its
  // Equals method. The other nsMailtoUrl will then pass its inner URL to
  // to the Equals method of our inner URL. Other URIs will return false.
  if (other)
    return other->EqualsExceptRef(m_baseURL, _retval);

  return m_baseURL->EqualsExceptRef(other, _retval);
}

NS_IMETHODIMP
nsAddbookUrl::CloneIgnoringRef(nsIURI** _retval)
{
  NS_ENSURE_ARG_POINTER(_retval);

  nsRefPtr<nsAddbookUrl> clone = new nsAddbookUrl();

  if (!clone)
    return NS_ERROR_OUT_OF_MEMORY;

  nsresult rv = m_baseURL->CloneIgnoringRef(getter_AddRefs(clone->m_baseURL));
  NS_ENSURE_SUCCESS(rv, rv);
  clone->ParseUrl();
  *_retval = clone.forget().get();
  return NS_OK;
}

NS_IMETHODIMP
nsAddbookUrl::GetSpecIgnoringRef(nsACString &result)
{
  return m_baseURL->GetSpecIgnoringRef(result);
}

NS_IMETHODIMP
nsAddbookUrl::GetHasRef(bool *result)
{
  return m_baseURL->GetHasRef(result);
}

//
// Specific nsAddbookUrl operations
//
NS_IMETHODIMP 
nsAddbookUrl::GetAddbookOperation(int32_t *_retval)
{
  *_retval = mOperationType;
  return NS_OK;
}
