/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * 
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsLDAPURL.h"
#include "netCore.h"
#include "plstr.h"
#include "nsCOMPtr.h"
#include "nsNetCID.h"
#include "nsComponentManagerUtils.h"
#include "nsIStandardURL.h"
#include "nsMsgUtils.h"

// The two schemes we support, LDAP and LDAPS
//
NS_NAMED_LITERAL_CSTRING(LDAP_SCHEME, "ldap");
NS_NAMED_LITERAL_CSTRING(LDAP_SSL_SCHEME, "ldaps");

NS_IMPL_ISUPPORTS2(nsLDAPURL, nsILDAPURL, nsIURI)

nsLDAPURL::nsLDAPURL()
    : mScope(SCOPE_BASE),
      mOptions(0)
{
}

nsLDAPURL::~nsLDAPURL()
{
}

nsresult
nsLDAPURL::Init(uint32_t aUrlType, int32_t aDefaultPort,
                const nsACString &aSpec, const char* aOriginCharset,
                nsIURI *aBaseURI)
{
  if (!mBaseURL)
  {
    mBaseURL = do_CreateInstance(NS_STANDARDURL_CONTRACTID);
    if (!mBaseURL)
      return NS_ERROR_OUT_OF_MEMORY;
  }

  nsresult rv;
  nsCOMPtr<nsIStandardURL> standardURL(do_QueryInterface(mBaseURL, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = standardURL->Init(aUrlType, aDefaultPort, aSpec, aOriginCharset,
                         aBaseURI);
  NS_ENSURE_SUCCESS(rv, rv);

  // Now get the spec from the mBaseURL in case it was a relative one
  nsCString spec;
  rv = mBaseURL->GetSpec(spec);
  NS_ENSURE_SUCCESS(rv, rv);

  return SetSpec(spec);
}

void
nsLDAPURL::GetPathInternal(nsCString &aPath)
{
  aPath.Assign('/');

  if (!mDN.IsEmpty())
    aPath.Append(mDN);

  if (!mAttributes.IsEmpty())
    aPath.Append('?');

  // If mAttributes isn't empty, cut off the internally stored commas at start
  // and end, and append to the path.
  if (!mAttributes.IsEmpty())
    aPath.Append(Substring(mAttributes, 1, mAttributes.Length() - 2));

  if (mScope || !mFilter.IsEmpty())
  {
    aPath.Append((mAttributes.IsEmpty() ? "??" : "?"));
    if (mScope)
    {
      if (mScope == SCOPE_ONELEVEL)
        aPath.Append("one");
      else if (mScope == SCOPE_SUBTREE)
        aPath.Append("sub");
    }
    if (!mFilter.IsEmpty())
    {
      aPath.Append('?');
      aPath.Append(mFilter);
    }
  }
}

nsresult
nsLDAPURL::SetPathInternal(const nsCString &aPath)
{
  LDAPURLDesc *desc;

  // This is from the LDAP C-SDK, which currently doesn't
  // support everything from RFC 2255... :(
  //
  int err = ldap_url_parse(aPath.get(), &desc);
  switch (err) {
  case LDAP_SUCCESS: {
    // The base URL can pick up the host & port details and deal with them
    // better than we can
    mDN = desc->lud_dn;
    mScope = desc->lud_scope;
    mFilter = desc->lud_filter;
    mOptions = desc->lud_options;
    nsresult rv = SetAttributeArray(desc->lud_attrs);
    if (NS_FAILED(rv))
      return rv;

    ldap_free_urldesc(desc);
    return NS_OK;
  }

  case LDAP_URL_ERR_NOTLDAP:
  case LDAP_URL_ERR_NODN:
  case LDAP_URL_ERR_BADSCOPE:
    return NS_ERROR_MALFORMED_URI;

  case LDAP_URL_ERR_MEM:
    NS_ERROR("nsLDAPURL::SetSpec: out of memory ");
    return NS_ERROR_OUT_OF_MEMORY;

  case LDAP_URL_ERR_PARAM: 
    return NS_ERROR_INVALID_POINTER;
  }

  // This shouldn't happen...
  return NS_ERROR_UNEXPECTED;
}

// A string representation of the URI. Setting the spec 
// causes the new spec to be parsed, initializing the URI. Setting
// the spec (or any of the accessors) causes also any currently
// open streams on the URI's channel to be closed.

NS_IMETHODIMP 
nsLDAPURL::GetSpec(nsACString &_retval)
{
  if (!mBaseURL)
    return NS_ERROR_NOT_INITIALIZED;

  return mBaseURL->GetSpec(_retval);
}

NS_IMETHODIMP 
nsLDAPURL::SetSpec(const nsACString &aSpec)
{
  if (!mBaseURL)
    return NS_ERROR_NOT_INITIALIZED;

  // Cache the original spec in case we don't like what we've been passed and
  // need to reset ourselves.
  nsCString originalSpec;
  nsresult rv = mBaseURL->GetSpec(originalSpec);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = mBaseURL->SetSpec(aSpec);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = SetPathInternal(PromiseFlatCString(aSpec));
  if (NS_FAILED(rv))
    mBaseURL->SetSpec(originalSpec);

  return rv;
}

NS_IMETHODIMP nsLDAPURL::GetPrePath(nsACString &_retval)
{
  if (!mBaseURL)
    return NS_ERROR_NOT_INITIALIZED;

  return mBaseURL->GetPrePath(_retval);
}

NS_IMETHODIMP nsLDAPURL::GetScheme(nsACString &_retval)
{
  if (!mBaseURL)
    return NS_ERROR_NOT_INITIALIZED;

  return mBaseURL->GetScheme(_retval);
}

NS_IMETHODIMP nsLDAPURL::SetScheme(const nsACString &aScheme)
{
  if (!mBaseURL)
    return NS_ERROR_NOT_INITIALIZED;

  if (aScheme.Equals(LDAP_SCHEME, nsCaseInsensitiveCStringComparator()))
    mOptions &= !OPT_SECURE;
  else if (aScheme.Equals(LDAP_SSL_SCHEME,
                          nsCaseInsensitiveCStringComparator()))
    mOptions |= OPT_SECURE;
  else
    return NS_ERROR_MALFORMED_URI;

  return mBaseURL->SetScheme(aScheme);
}

NS_IMETHODIMP 
nsLDAPURL::GetUserPass(nsACString &_retval)
{
  _retval.Truncate();
  return NS_OK;
}

NS_IMETHODIMP
nsLDAPURL::SetUserPass(const nsACString &aUserPass)
{
  return NS_OK;
}

NS_IMETHODIMP
nsLDAPURL::GetUsername(nsACString &_retval)
{
  _retval.Truncate();
  return NS_OK;
}

NS_IMETHODIMP
nsLDAPURL::SetUsername(const nsACString &aUsername)
{
  return NS_OK;
}

NS_IMETHODIMP 
nsLDAPURL::GetPassword(nsACString &_retval)
{
  _retval.Truncate();
  return NS_OK;
}

NS_IMETHODIMP 
nsLDAPURL::SetPassword(const nsACString &aPassword)
{
  return NS_OK;
}

NS_IMETHODIMP 
nsLDAPURL::GetHostPort(nsACString &_retval)
{
  if (!mBaseURL)
    return NS_ERROR_NOT_INITIALIZED;

  return mBaseURL->GetHostPort(_retval);
}

NS_IMETHODIMP 
nsLDAPURL::SetHostPort(const nsACString &aHostPort)
{
  if (!mBaseURL)
    return NS_ERROR_NOT_INITIALIZED;

  return mBaseURL->SetHostPort(aHostPort);
}

NS_IMETHODIMP 
nsLDAPURL::GetHost(nsACString &_retval)
{
  if (!mBaseURL)
    return NS_ERROR_NOT_INITIALIZED;

  return mBaseURL->GetHost(_retval);
}

NS_IMETHODIMP 
nsLDAPURL::SetHost(const nsACString &aHost)
{
  if (!mBaseURL)
    return NS_ERROR_NOT_INITIALIZED;

  return mBaseURL->SetHost(aHost);
}

NS_IMETHODIMP 
nsLDAPURL::GetPort(int32_t *_retval)
{
  if (!mBaseURL)
    return NS_ERROR_NOT_INITIALIZED;

  return mBaseURL->GetPort(_retval);
}

NS_IMETHODIMP 
nsLDAPURL::SetPort(int32_t aPort)
{
  if (!mBaseURL)
    return NS_ERROR_NOT_INITIALIZED;

  return mBaseURL->SetPort(aPort);
}

NS_IMETHODIMP nsLDAPURL::GetPath(nsACString &_retval)
{
  if (!mBaseURL)
    return NS_ERROR_NOT_INITIALIZED;

  return mBaseURL->GetPath(_retval);
}

NS_IMETHODIMP nsLDAPURL::SetPath(const nsACString &aPath)
{
  if (!mBaseURL)
    return NS_ERROR_NOT_INITIALIZED;

  nsresult rv = SetPathInternal(PromiseFlatCString(aPath));
  NS_ENSURE_SUCCESS(rv, rv);

  return mBaseURL->SetPath(aPath);
}

NS_IMETHODIMP nsLDAPURL::GetAsciiSpec(nsACString &_retval)
{
  if (!mBaseURL)
    return NS_ERROR_NOT_INITIALIZED;

  // XXX handle extra items?
  return mBaseURL->GetAsciiSpec(_retval);
}

NS_IMETHODIMP nsLDAPURL::GetAsciiHost(nsACString &_retval)
{
  if (!mBaseURL)
    return NS_ERROR_NOT_INITIALIZED;

  return mBaseURL->GetAsciiHost(_retval);
}

NS_IMETHODIMP nsLDAPURL::GetOriginCharset(nsACString &result)
{
  if (!mBaseURL)
    return NS_ERROR_NOT_INITIALIZED;

  return mBaseURL->GetOriginCharset(result);
}

// boolean equals (in nsIURI other)
// (based on nsSimpleURI::Equals)
NS_IMETHODIMP nsLDAPURL::Equals(nsIURI *other, bool *_retval)
{
  *_retval = false;
  if (other)
  {
    nsresult rv;
    nsCOMPtr<nsILDAPURL> otherURL(do_QueryInterface(other, &rv));
    if (NS_SUCCEEDED(rv))
    {
      nsAutoCString thisSpec, otherSpec;
      uint32_t otherOptions;

      rv = GetSpec(thisSpec);
      NS_ENSURE_SUCCESS(rv, rv);

      rv = otherURL->GetSpec(otherSpec);
      NS_ENSURE_SUCCESS(rv, rv);

      rv = otherURL->GetOptions(&otherOptions);
      NS_ENSURE_SUCCESS(rv, rv);

      if (thisSpec == otherSpec && mOptions == otherOptions)
        *_retval = true;
    }
  }
  return NS_OK;
}

// boolean schemeIs(in const char * scheme);
//
NS_IMETHODIMP nsLDAPURL::SchemeIs(const char *aScheme, bool *aEquals)
{
  if (!mBaseURL)
    return NS_ERROR_NOT_INITIALIZED;

  return mBaseURL->SchemeIs(aScheme, aEquals);
}

// nsIURI clone ();
//
NS_IMETHODIMP nsLDAPURL::Clone(nsIURI **aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);

  nsLDAPURL *clone = new nsLDAPURL();

  if (!clone)
    return NS_ERROR_OUT_OF_MEMORY;

  clone->mDN = mDN;
  clone->mScope = mScope;
  clone->mFilter = mFilter;
  clone->mOptions = mOptions;
  clone->mAttributes = mAttributes;

  nsresult rv = mBaseURL->Clone(getter_AddRefs(clone->mBaseURL));
  NS_ENSURE_SUCCESS(rv, rv);

  NS_ADDREF(*aResult = clone);
  return NS_OK;
}

// string resolve (in string relativePath);
//
NS_IMETHODIMP nsLDAPURL::Resolve(const nsACString &relativePath,
                                 nsACString &_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

// The following attributes come from nsILDAPURL

// attribute AUTF8String dn;
//
NS_IMETHODIMP nsLDAPURL::GetDn(nsACString& _retval)
{
    _retval.Assign(mDN);
    return NS_OK;
}
NS_IMETHODIMP nsLDAPURL::SetDn(const nsACString& aDn)
{
  if (!mBaseURL)
    return NS_ERROR_NOT_INITIALIZED;

  mDN.Assign(aDn);

  // Now get the current path
  nsCString newPath;
  GetPathInternal(newPath);

  // and update the base url
  return mBaseURL->SetPath(newPath);
}

NS_IMETHODIMP nsLDAPURL::GetAttributes(nsACString &aAttributes)
{
  if (mAttributes.IsEmpty())
  {
    aAttributes.Truncate();
    return NS_OK;
  }

  NS_ASSERTION(mAttributes[0] == ',' &&
               mAttributes[mAttributes.Length() - 1] == ',',
               "mAttributes does not begin and end with a comma");

  // We store the string internally with comma before and after, so strip
  // them off here.
  aAttributes = Substring(mAttributes, 1, mAttributes.Length() - 2);
  return NS_OK;
}

NS_IMETHODIMP nsLDAPURL::SetAttributes(const nsACString &aAttributes)
{
  if (!mBaseURL)
    return NS_ERROR_NOT_INITIALIZED;

  if (aAttributes.IsEmpty())
    mAttributes.Truncate();
  else
  {
    // We need to make sure we start off the string with a comma.
    if (aAttributes[0] != ',')
      mAttributes = ',';

    mAttributes.Append(aAttributes);

    // Also end with a comma if appropriate.
    if (mAttributes[mAttributes.Length() - 1] != ',')
      mAttributes.Append(',');
  }

  // Now get the current path
  nsCString newPath;
  GetPathInternal(newPath);

  // and update the base url
  return mBaseURL->SetPath(newPath);
}

nsresult nsLDAPURL::SetAttributeArray(char** aAttributes)
{
  mAttributes.Truncate();

  while (aAttributes && *aAttributes)
  {
    // Always start with a comma as that's what we store internally.
    mAttributes.Append(',');
    mAttributes.Append(*aAttributes);
    ++aAttributes;
  }

  // Add a comma on the end if we have something.
  if (!mAttributes.IsEmpty())
    mAttributes.Append(',');

  return NS_OK;
}

NS_IMETHODIMP nsLDAPURL::AddAttribute(const nsACString &aAttribute)
{
  if (!mBaseURL)
    return NS_ERROR_NOT_INITIALIZED;

  if (mAttributes.IsEmpty())
  {
    mAttributes = ',';
    mAttributes.Append(aAttribute);
    mAttributes.Append(',');
  }
  else
  {
    // Wrap the attribute in commas, so that we can do an exact match.
    nsAutoCString findAttribute(",");
    findAttribute.Append(aAttribute);
    findAttribute.Append(',');

    // Check to see if the attribute is already stored. If it is, then also
    // check to see if it is the last attribute in the string, or if the next
    // character is a comma, this means we won't match substrings.
    int32_t pos = mAttributes.Find(findAttribute, CaseInsensitiveCompare);
    if (pos != -1)
      return NS_OK;

    mAttributes.Append(Substring(findAttribute, 1));
  }

  // Now get the current path
  nsCString newPath;
  GetPathInternal(newPath);

  // and update the base url
  return mBaseURL->SetPath(newPath);
}

NS_IMETHODIMP nsLDAPURL::RemoveAttribute(const nsACString &aAttribute)
{
  if (!mBaseURL)
    return NS_ERROR_NOT_INITIALIZED;

  if (mAttributes.IsEmpty())
    return NS_OK;

  nsAutoCString findAttribute(",");
  findAttribute.Append(aAttribute);
  findAttribute.Append(',');

  if (mAttributes.Equals(findAttribute, nsCaseInsensitiveCStringComparator()))
    mAttributes.Truncate();
  else
  {
    int32_t pos = mAttributes.Find(findAttribute, CaseInsensitiveCompare);
    if (pos == -1)
      return NS_OK;

    mAttributes.Cut(pos, findAttribute.Length() - 1);
  }

  // Now get the current path
  nsCString newPath;
  GetPathInternal(newPath);

  // and update the base url
  return mBaseURL->SetPath(newPath);
}

NS_IMETHODIMP nsLDAPURL::HasAttribute(const nsACString &aAttribute,
                                      bool *_retval)
{
  NS_ENSURE_ARG_POINTER(_retval);

  nsAutoCString findAttribute(",");
  findAttribute.Append(aAttribute);
  findAttribute.Append(',');

  *_retval = mAttributes.Find(findAttribute, CaseInsensitiveCompare) != -1;
  return NS_OK;
}

NS_IMETHODIMP nsLDAPURL::GetScope(int32_t *_retval)
{
  NS_ENSURE_ARG_POINTER(_retval);
  *_retval = mScope;
  return NS_OK;
}

NS_IMETHODIMP nsLDAPURL::SetScope(int32_t aScope)
{
  if (!mBaseURL)
    return NS_ERROR_NOT_INITIALIZED;

  // Only allow scopes supported by the C-SDK
  if ((aScope != SCOPE_BASE) && (aScope != SCOPE_ONELEVEL) &&
      (aScope != SCOPE_SUBTREE))
    return NS_ERROR_MALFORMED_URI;

  mScope = aScope;

  // Now get the current path
  nsCString newPath;
  GetPathInternal(newPath);

  // and update the base url
  return mBaseURL->SetPath(newPath);
}

NS_IMETHODIMP nsLDAPURL::GetFilter(nsACString& _retval)
{
    _retval.Assign(mFilter);
    return NS_OK;
}
NS_IMETHODIMP nsLDAPURL::SetFilter(const nsACString& aFilter)
{
  if (!mBaseURL)
    return NS_ERROR_NOT_INITIALIZED;

  mFilter.Assign(aFilter);

  if (mFilter.IsEmpty())
    mFilter.AssignLiteral("(objectclass=*)");

  // Now get the current path
  nsCString newPath;
  GetPathInternal(newPath);

  // and update the base url
  return mBaseURL->SetPath(newPath);
}

NS_IMETHODIMP nsLDAPURL::GetOptions(uint32_t *_retval)
{
  NS_ENSURE_ARG_POINTER(_retval);
  *_retval = mOptions;
  return NS_OK;
}

NS_IMETHODIMP nsLDAPURL::SetOptions(uint32_t aOptions)
{
  // Secure is the only option supported at the moment
  if (mOptions & OPT_SECURE == aOptions & OPT_SECURE)
    return NS_OK;

  mOptions = aOptions;

  if (aOptions & OPT_SECURE == OPT_SECURE)
    return SetScheme(LDAP_SSL_SCHEME);

  return SetScheme(LDAP_SCHEME);
}

NS_IMETHODIMP nsLDAPURL::SetRef(const nsACString &aRef)
{
  return mBaseURL->SetRef(aRef);
}

NS_IMETHODIMP
nsLDAPURL::GetRef(nsACString &result)
{
  return mBaseURL->GetRef(result);
}

NS_IMETHODIMP nsLDAPURL::EqualsExceptRef(nsIURI *other, bool *result)
{
  return mBaseURL->EqualsExceptRef(other, result);
}

NS_IMETHODIMP
nsLDAPURL::CloneIgnoringRef(nsIURI** result)
{
  return mBaseURL->CloneIgnoringRef(result);
}

NS_IMETHODIMP
nsLDAPURL::GetSpecIgnoringRef(nsACString &result)
{
  return mBaseURL->GetSpecIgnoringRef(result);
}

NS_IMETHODIMP
nsLDAPURL::GetHasRef(bool *result)
{
  return mBaseURL->GetHasRef(result);
}
