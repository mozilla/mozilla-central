/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


#include "nsCOMPtr.h"
#include "nsAbLDAPChangeLogQuery.h"
#include "nsAbLDAPReplicationService.h"
#include "nsAbLDAPChangeLogData.h"
#include "nsAbUtils.h"
#include "prprf.h"
#include "nsDirPrefs.h"
#include "nsAbBaseCID.h"


// The tables below were originally in nsAbLDAPProperties.cpp, which has since
// gone away.
static const char * sChangeLogRootDSEAttribs[] =
{ 
  "changelog", 
  "firstChangeNumber", 
  "lastChangeNumber",
  "dataVersion"
};
static const char * sChangeLogEntryAttribs[] =
{ 
  "targetdn", 
  "changetype"
};


NS_IMPL_ISUPPORTS_INHERITED1(nsAbLDAPChangeLogQuery, nsAbLDAPReplicationQuery, nsIAbLDAPChangeLogQuery)

nsAbLDAPChangeLogQuery::nsAbLDAPChangeLogQuery()
{
}

nsAbLDAPChangeLogQuery::~nsAbLDAPChangeLogQuery()
{

}

// this is to be defined only till this is not hooked to SSL to get authDN and authPswd
#define USE_AUTHDLG

NS_IMETHODIMP nsAbLDAPChangeLogQuery::Init(const nsACString & aPrefName, nsIWebProgressListener *aProgressListener)
{
    if(aPrefName.IsEmpty()) 
        return NS_ERROR_UNEXPECTED;

    mDirPrefName = aPrefName;

    nsresult rv = InitLDAPData();
    if(NS_FAILED(rv)) 
        return rv;

    // create the ChangeLog Data Processor
    mDataProcessor =  do_CreateInstance(NS_ABLDAP_PROCESSCHANGELOGDATA_CONTRACTID, &rv);
    if(NS_FAILED(rv)) 
        return rv;

    // 'this' initialized
    mInitialized = true;

    return mDataProcessor->Init(this, aProgressListener);
}

NS_IMETHODIMP nsAbLDAPChangeLogQuery::DoReplicationQuery()
{
    if(!mInitialized) 
        return NS_ERROR_NOT_INITIALIZED;

#ifdef USE_AUTHDLG
    return ConnectToLDAPServer(mURL, EmptyCString());
#else
    mDataProcessor->PopulateAuthData();
    return ConnectToLDAPServer(mURL, mAuthDN);
#endif
}

NS_IMETHODIMP nsAbLDAPChangeLogQuery::QueryAuthDN(const nsACString & aValueUsedToFindDn)
{
  if (!mInitialized)
    return NS_ERROR_NOT_INITIALIZED;

  nsCOMPtr<nsIAbLDAPAttributeMap> attrMap;
  nsresult rv = mDirectory->GetAttributeMap(getter_AddRefs(attrMap));
  NS_ENSURE_SUCCESS(rv, rv);

    nsCAutoString filter;
    rv = attrMap->GetFirstAttribute(NS_LITERAL_CSTRING("PrimaryEmail"), filter);
    NS_ENSURE_SUCCESS(rv, rv);

    filter += '=';
    filter += aValueUsedToFindDn;

    nsCAutoString dn;
    rv = mURL->GetDn(dn);
    if(NS_FAILED(rv)) 
        return rv;

    rv = CreateNewLDAPOperation();
    NS_ENSURE_SUCCESS(rv, rv);

    // XXX We really should be using LDAP_NO_ATTRS here once its exposed via
    // the XPCOM layer of the directory code.
    return mOperation->SearchExt(dn, nsILDAPURL::SCOPE_SUBTREE, filter, 
                               0, nullptr,
                               0, 0);
}

NS_IMETHODIMP nsAbLDAPChangeLogQuery::QueryRootDSE()
{
    if(!mInitialized) 
        return NS_ERROR_NOT_INITIALIZED;

    nsresult rv = CreateNewLDAPOperation();
    NS_ENSURE_SUCCESS(rv, rv);
    return mOperation->SearchExt(EmptyCString(), nsILDAPURL::SCOPE_BASE, 
                                 NS_LITERAL_CSTRING("objectclass=*"), 
                                 sizeof(sChangeLogRootDSEAttribs),
                                 sChangeLogRootDSEAttribs, 0, 0);
}

NS_IMETHODIMP nsAbLDAPChangeLogQuery::QueryChangeLog(const nsACString & aChangeLogDN, int32_t aLastChangeNo)
{
  if (!mInitialized)
    return NS_ERROR_NOT_INITIALIZED;
  if (aChangeLogDN.IsEmpty()) 
    return NS_ERROR_UNEXPECTED;

  int32_t lastChangeNumber;
  nsresult rv = mDirectory->GetLastChangeNumber(&lastChangeNumber);
  NS_ENSURE_SUCCESS(rv, rv);

  // make sure that the filter here just have one condition 
  // and should not be enclosed in enclosing brackets.
  // also condition '>' doesnot work, it should be '>='/
  nsCAutoString filter (NS_LITERAL_CSTRING("changenumber>="));
  filter.AppendInt(lastChangeNumber + 1);

  rv = CreateNewLDAPOperation();
  NS_ENSURE_SUCCESS(rv, rv);

  return mOperation->SearchExt(aChangeLogDN, nsILDAPURL::SCOPE_ONELEVEL, filter, 
                               sizeof(sChangeLogEntryAttribs),
                               sChangeLogEntryAttribs, 0, 0);
}

NS_IMETHODIMP nsAbLDAPChangeLogQuery::QueryChangedEntries(const nsACString & aChangedEntryDN)
{
    if(!mInitialized) 
        return NS_ERROR_NOT_INITIALIZED;
    if(aChangedEntryDN.IsEmpty()) 
        return NS_ERROR_UNEXPECTED;

    nsCAutoString urlFilter;
    nsresult rv = mURL->GetFilter(urlFilter);
    if(NS_FAILED(rv)) 
        return rv;

    int32_t scope;
    rv = mURL->GetScope(&scope);
    if(NS_FAILED(rv)) 
        return rv;

    CharPtrArrayGuard attributes;
    rv = mURL->GetAttributes(attributes.GetSizeAddr(), attributes.GetArrayAddr());
    if(NS_FAILED(rv)) 
        return rv;

    rv = CreateNewLDAPOperation();
    NS_ENSURE_SUCCESS(rv, rv);
    return mOperation->SearchExt(aChangedEntryDN, scope, urlFilter, 
                               attributes.GetSize(), attributes.GetArray(),
                               0, 0);
}

