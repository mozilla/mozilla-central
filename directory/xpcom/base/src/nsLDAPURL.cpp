/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * 
 * ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is the mozilla.org LDAP XPCOM SDK.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2000
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Dan Mosedale <dmose@mozilla.org>
 *   Leif Hedstrom <leif@netscape.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

#include "nsLDAPURL.h"
#include "nsReadableUtils.h"
#include "netCore.h"
#include "plstr.h"
#include "nsCOMPtr.h"
#include "nsNetCID.h"
#include "nsComponentManagerUtils.h"
#include "nsIStandardURL.h"

// The two schemes we support, LDAP and LDAPS
//
NS_NAMED_LITERAL_CSTRING(LDAP_SCHEME, "ldap");
NS_NAMED_LITERAL_CSTRING(LDAP_SSL_SCHEME, "ldaps");

NS_IMPL_THREADSAFE_ISUPPORTS2(nsLDAPURL, nsILDAPURL, nsIURI)

nsLDAPURL::nsLDAPURL()
    : mScope(SCOPE_BASE),
      mOptions(0)
{
}

nsLDAPURL::~nsLDAPURL()
{
}

nsresult
nsLDAPURL::Init(PRUint32 aUrlType, PRInt32 aDefaultPort,
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

  PRUint32 count = mAttributes.Count();
  if (count)
  {
    aPath.Append('?');
    PRUint32 index = 0;

    while (index < count)
    {
      aPath.Append(*(mAttributes.CStringAt(index++)));
      if (index < count)
        aPath.Append(',');
    }
  }

  if (mScope || !mFilter.IsEmpty())
  {
    aPath.Append((count ? "?" : "??"));
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
  PRUint32 rv, count;
  LDAPURLDesc *desc;
  nsCString str;
  char **attributes;

  // This is from the LDAP C-SDK, which currently doesn't
  // support everything from RFC 2255... :(
  //
  rv = ldap_url_parse(aPath.get(), &desc);
  switch (rv) {
  case LDAP_SUCCESS:
    // The base URL can pick up the host & port details and deal with them
    // better than we can
    mDN = desc->lud_dn;
    mScope = desc->lud_scope;
    mFilter = desc->lud_filter;
    mOptions = desc->lud_options;

    // Set the attributes array, need to count it first.
    //
    count = 0;
    attributes = desc->lud_attrs;
    while (attributes && *attributes++)
      count++;

    if (count) {
      rv = SetAttributes(count, const_cast<const char **>(desc->lud_attrs));
      // This error could only be out-of-memory, so pass it up
      //
      if (NS_FAILED(rv)) {
        return rv;
      }
    } else {
      mAttributes.Clear();
    }

    ldap_free_urldesc(desc);
    return NS_OK;

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

  rv = SetPathInternal(nsPromiseFlatCString(aSpec));
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
nsLDAPURL::GetPort(PRInt32 *_retval)
{
  if (!mBaseURL)
    return NS_ERROR_NOT_INITIALIZED;

  return mBaseURL->GetPort(_retval);
}

NS_IMETHODIMP 
nsLDAPURL::SetPort(PRInt32 aPort)
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

  nsresult rv = SetPathInternal(nsPromiseFlatCString(aPath));
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
NS_IMETHODIMP nsLDAPURL::Equals(nsIURI *other, PRBool *_retval)
{
  *_retval = PR_FALSE;
  if (other)
  {
    nsresult rv;
    nsCOMPtr<nsILDAPURL> otherURL(do_QueryInterface(other, &rv));
    if (NS_SUCCEEDED(rv))
    {
      nsCAutoString thisSpec, otherSpec;
      PRUint32 otherOptions;

      rv = GetSpec(thisSpec);
      NS_ENSURE_SUCCESS(rv, rv);

      rv = otherURL->GetSpec(otherSpec);
      NS_ENSURE_SUCCESS(rv, rv);

      rv = otherURL->GetOptions(&otherOptions);
      NS_ENSURE_SUCCESS(rv, rv);

      if (thisSpec == otherSpec && mOptions == otherOptions)
        *_retval = PR_TRUE;
    }
  }
  return NS_OK;
}

// boolean schemeIs(in const char * scheme);
//
NS_IMETHODIMP nsLDAPURL::SchemeIs(const char *aScheme, PRBool *aEquals)
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

  nsLDAPURL *clone;
  NS_NEWXPCOM(clone, nsLDAPURL);
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

// void getAttributes (out unsigned long aCount, 
//                     [array, size_is (aCount), retval] out string aAttrs);
//
NS_IMETHODIMP nsLDAPURL::GetAttributes(PRUint32 *aCount, char ***_retval)
{
    NS_ENSURE_ARG_POINTER(aCount);
    NS_ENSURE_ARG_POINTER(_retval);

    PRUint32 index = 0;
    PRUint32 count;
    char **cArray = nsnull;

    if (!_retval) {
        NS_ERROR("nsLDAPURL::GetAttributes: null pointer ");
        return NS_ERROR_NULL_POINTER;
    }

    count = mAttributes.Count();
    if (count > 0) {
        cArray = static_cast<char **>(nsMemory::Alloc(count * sizeof(char *)));
        if (!cArray) {
            NS_ERROR("nsLDAPURL::GetAttributes: out of memory ");
            return NS_ERROR_OUT_OF_MEMORY;
        }

        // Loop through the string array, and build up the C-array.
        //
        while (index < count) {
            if (!(cArray[index] = ToNewCString(*(mAttributes.CStringAt(index))))) {
                NS_FREE_XPCOM_ALLOCATED_POINTER_ARRAY(index, cArray);
                NS_ERROR("nsLDAPURL::GetAttributes: out of memory ");
                return NS_ERROR_OUT_OF_MEMORY;
            }
            index++;
        }
    }
    *aCount = count;
    *_retval = cArray;

    return NS_OK;
}
// void setAttributes (in unsigned long aCount,
//                     [array, size_is (aCount)] in string aAttrs); */
NS_IMETHODIMP nsLDAPURL::SetAttributes(PRUint32 count, const char **aAttrs)
{
  if (!mBaseURL)
    return NS_ERROR_NOT_INITIALIZED;

  if (count)
    NS_ENSURE_ARG_POINTER(aAttrs);

  mAttributes.Clear();
  for (PRUint32 i = 0; i < count; ++i)
  {
    if (!mAttributes.AppendCString(nsDependentCString(aAttrs[i])))
    {
      NS_ERROR("nsLDAPURL::SetAttributes: out of memory ");
      return NS_ERROR_OUT_OF_MEMORY;
    }
  }

  // Now get the current path
  nsCString newPath;
  GetPathInternal(newPath);

  // and update the base url
  return mBaseURL->SetPath(newPath);
}

NS_IMETHODIMP nsLDAPURL::AddAttribute(const char *aAttribute)
{
  if (!mBaseURL)
    return NS_ERROR_NOT_INITIALIZED;

  NS_ENSURE_ARG_POINTER(aAttribute);

  nsDependentCString str(aAttribute);

  if (mAttributes.IndexOfIgnoreCase(str) >= 0)
    return NS_OK;

  if (!mAttributes.AppendCString(str)) {
    NS_ERROR("nsLDAPURL::AddAttribute: out of memory ");
    return NS_ERROR_OUT_OF_MEMORY;
  }

  // Now get the current path
  nsCString newPath;
  GetPathInternal(newPath);

  // and update the base url
  return mBaseURL->SetPath(newPath);
}

NS_IMETHODIMP nsLDAPURL::RemoveAttribute(const char *aAttribute)
{
  if (!mBaseURL)
    return NS_ERROR_NOT_INITIALIZED;

  NS_ENSURE_ARG_POINTER(aAttribute);
  mAttributes.RemoveCString(nsDependentCString(aAttribute));

  // Now get the current path
  nsCString newPath;
  GetPathInternal(newPath);

  // and update the base url
  return mBaseURL->SetPath(newPath);
}

NS_IMETHODIMP nsLDAPURL::HasAttribute(const char *aAttribute, PRBool *_retval)
{
  NS_ENSURE_ARG_POINTER(aAttribute);
  NS_ENSURE_ARG_POINTER(_retval);

  *_retval = mAttributes.IndexOfIgnoreCase(nsDependentCString(aAttribute)) >= 0;
  return NS_OK;
}

NS_IMETHODIMP nsLDAPURL::GetScope(PRInt32 *_retval)
{
  NS_ENSURE_ARG_POINTER(_retval);
  *_retval = mScope;
  return NS_OK;
}

NS_IMETHODIMP nsLDAPURL::SetScope(PRInt32 aScope)
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

NS_IMETHODIMP nsLDAPURL::GetOptions(PRUint32 *_retval)
{
  NS_ENSURE_ARG_POINTER(_retval);
  *_retval = mOptions;
  return NS_OK;
}

NS_IMETHODIMP nsLDAPURL::SetOptions(PRUint32 aOptions)
{
  // Secure is the only option supported at the moment
  if (mOptions & OPT_SECURE == aOptions & OPT_SECURE)
    return NS_OK;

  mOptions = aOptions;

  if (aOptions & OPT_SECURE == OPT_SECURE)
    return SetScheme(LDAP_SSL_SCHEME);

  return SetScheme(LDAP_SCHEME);
}
