/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * 
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsLDAPServer.h"

NS_IMPL_ISUPPORTS1(nsLDAPServer, nsILDAPServer)

nsLDAPServer::nsLDAPServer()
    : mSizeLimit(0),
      mProtocolVersion(nsILDAPConnection::VERSION3)
{
}

nsLDAPServer::~nsLDAPServer()
{
}

// attribute wstring key;
NS_IMETHODIMP nsLDAPServer::GetKey(PRUnichar **_retval)
{
    if (!_retval) {
        NS_ERROR("nsLDAPServer::GetKey: null pointer ");
        return NS_ERROR_NULL_POINTER;
    }

    *_retval = ToNewUnicode(mKey);
    if (!*_retval) {
        return NS_ERROR_OUT_OF_MEMORY;
    }

    return NS_OK;
}
NS_IMETHODIMP nsLDAPServer::SetKey(const PRUnichar *aKey)
{
    mKey = aKey;
    return NS_OK;
}

// attribute AUTF8String username;
NS_IMETHODIMP nsLDAPServer::GetUsername(nsACString& _retval)
{
    _retval.Assign(mUsername);
    return NS_OK;
}
NS_IMETHODIMP nsLDAPServer::SetUsername(const nsACString& aUsername)
{
    mUsername.Assign(aUsername);
    return NS_OK;
}

// attribute AUTF8String password;
NS_IMETHODIMP nsLDAPServer::GetPassword(nsACString& _retval)
{
    _retval.Assign(mPassword);
    return NS_OK;
}
NS_IMETHODIMP nsLDAPServer::SetPassword(const nsACString& aPassword)
{
    mPassword.Assign(aPassword);
    return NS_OK;
}

// attribute AUTF8String binddn;
NS_IMETHODIMP nsLDAPServer::GetBinddn(nsACString& _retval)
{
    _retval.Assign(mBindDN);
    return NS_OK;
}
NS_IMETHODIMP nsLDAPServer::SetBinddn(const nsACString& aBindDN)
{
    mBindDN.Assign(aBindDN);
    return NS_OK;
}

// attribute unsigned long sizelimit;
NS_IMETHODIMP nsLDAPServer::GetSizelimit(uint32_t *_retval)
{
    if (!_retval) {
        NS_ERROR("nsLDAPServer::GetSizelimit: null pointer ");
        return NS_ERROR_NULL_POINTER;
    }

    *_retval = mSizeLimit;
    return NS_OK;
}
NS_IMETHODIMP nsLDAPServer::SetSizelimit(uint32_t aSizeLimit)
{
    mSizeLimit = aSizeLimit;
    return NS_OK;
}

// attribute nsILDAPURL url;
NS_IMETHODIMP nsLDAPServer::GetUrl(nsILDAPURL **_retval)
{
    if (!_retval) {
        NS_ERROR("nsLDAPServer::GetUrl: null pointer ");
        return NS_ERROR_NULL_POINTER;
    }

    NS_IF_ADDREF(*_retval = mURL);
    return NS_OK;
}
NS_IMETHODIMP nsLDAPServer::SetUrl(nsILDAPURL *aURL)
{
    mURL = aURL;
    return NS_OK;
}

// attribute long protocolVersion
NS_IMETHODIMP nsLDAPServer::GetProtocolVersion(uint32_t *_retval)
{
    if (!_retval) {
        NS_ERROR("nsLDAPServer::GetProtocolVersion: null pointer ");
        return NS_ERROR_NULL_POINTER;
    }

    *_retval = mProtocolVersion;
    return NS_OK;
}
NS_IMETHODIMP nsLDAPServer::SetProtocolVersion(uint32_t aVersion)
{
    if (aVersion != nsILDAPConnection::VERSION2 &&
        aVersion != nsILDAPConnection::VERSION3) {
        NS_ERROR("nsLDAPServer::SetProtocolVersion: invalid version");
        return NS_ERROR_INVALID_ARG;
    }

    mProtocolVersion = aVersion;
    return NS_OK;
}
