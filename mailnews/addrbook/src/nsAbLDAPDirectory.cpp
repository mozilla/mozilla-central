/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Paul Sandoz <paul.sandoz@sun.com> Sun Microsystems, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2001
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Seth Spitzer <sspitzer@netscape.com>
 *   Dan Mosedale <dmose@netscape.com>
 *   Paul Sandoz <paul.sandoz@sun.com>
 *   Mark Banner <mark@standard8.demon.co.uk>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

#include "nsAbLDAPDirectory.h"

#include "nsAbQueryStringToExpression.h"

#include "nsAbBaseCID.h"
#include "nsIAddrBookSession.h"
#include "nsIRDFService.h"
#include "nsIServiceManager.h"
#include "nsAutoLock.h"
#include "nsNetCID.h"
#include "nsIIOService.h"
#include "nsCOMArray.h"
#include "nsArrayEnumerator.h"
#include "nsEnumeratorUtils.h"
#include "nsIAbLDAPAttributeMap.h"
#include "nsIAbMDBDirectory.h"

#define kDefaultMaxHits 100

nsAbLDAPDirectory::nsAbLDAPDirectory() :
  nsAbDirectoryRDFResource(),
  nsAbLDAPDirectoryQuery(),
  mPerformingQuery(PR_FALSE),
  mContext(0),
  mLock(0)
{
}

nsAbLDAPDirectory::~nsAbLDAPDirectory()
{
  if (mLock)
    PR_DestroyLock (mLock);
}

NS_IMPL_ISUPPORTS_INHERITED4(nsAbLDAPDirectory, nsAbDirectoryRDFResource, nsIAbDirectory,
                             nsIAbDirectoryQuery, nsIAbDirectorySearch, nsIAbLDAPDirectory)

NS_IMETHODIMP nsAbLDAPDirectory::Init(const char* aURI)
{
  // We need to ensure that the m_DirPrefId is initialized properly
  nsCAutoString uri(aURI);

  // Find the first ? (of the search params) if there is one.
  // We know we can start at the end of the moz-abldapdirectory:// because
  // that's the URI we should have been passed.
  PRInt32 searchCharLocation = uri.FindChar('?', kLDAPDirectoryRootLen);

  if (searchCharLocation == kNotFound)
    uri.Right(m_DirPrefId, uri.Length() - kLDAPDirectoryRootLen);
  else
    uri.Mid(m_DirPrefId, kLDAPDirectoryRootLen,
            searchCharLocation - kLDAPDirectoryRootLen);

  return nsAbDirectoryRDFResource::Init(aURI);
}

nsresult nsAbLDAPDirectory::Initiate()
{
  if (!mLock)
    mLock = PR_NewLock();

  return mLock ? NS_OK : NS_ERROR_OUT_OF_MEMORY;
}

/* 
 *
 * nsIAbDirectory methods
 *
 */

NS_IMETHODIMP nsAbLDAPDirectory::GetURI(nsACString &aURI)
{
  nsresult rv = GetStringValue("uri", EmptyCString(), aURI);
  NS_ENSURE_SUCCESS(rv, rv);

  if (aURI.IsEmpty())
  {
    aURI.AppendLiteral(kLDAPDirectoryRoot);
    aURI.Append(m_DirPrefId);
  }

  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPDirectory::GetOperations(PRInt32 *aOperations)
{
  *aOperations = nsIAbDirectory::opSearch;
  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPDirectory::GetChildNodes(nsISimpleEnumerator* *aResult)
{
  nsCOMArray<nsIAbDirectory> children;
  return NS_NewArrayEnumerator(aResult, children);
}

NS_IMETHODIMP nsAbLDAPDirectory::GetChildCards(nsISimpleEnumerator** result)
{
    nsresult rv;
    
    // when offline, we need to get the child cards for the local, replicated mdb directory 
    PRBool offline;
    nsCOMPtr <nsIIOService> ioService = do_GetService(NS_IOSERVICE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv,rv);
    rv = ioService->GetOffline(&offline);
    NS_ENSURE_SUCCESS(rv,rv);
    
    if (offline) {
      nsCOMPtr <nsIRDFService> rdfService = do_GetService("@mozilla.org/rdf/rdf-service;1",&rv);
      NS_ENSURE_SUCCESS(rv, rv);

      nsCString fileName;
      rv = GetReplicationFileName(fileName);
      NS_ENSURE_SUCCESS(rv,rv);
      
      // if there is no fileName, bail out now.
      if (fileName.IsEmpty())
        return NS_OK;

      // perform the same query, but on the local directory
      nsCAutoString localDirectoryURI(NS_LITERAL_CSTRING(kMDBDirectoryRoot));
      localDirectoryURI.Append(fileName);
      if (mIsQueryURI) 
      {
        localDirectoryURI.AppendLiteral("?");
        localDirectoryURI.Append(mQueryString);
      }
      
      nsCOMPtr <nsIRDFResource> resource;
      rv = rdfService->GetResource(localDirectoryURI, getter_AddRefs(resource));
      NS_ENSURE_SUCCESS(rv, rv);
      
      nsCOMPtr <nsIAbDirectory> directory = do_QueryInterface(resource, &rv);
      NS_ENSURE_SUCCESS(rv, rv);

      rv = directory->GetChildCards(result);
    }
    else {
      // Start the search
      rv = StartSearch();
      NS_ENSURE_SUCCESS(rv, rv);

      rv = NS_NewEmptyEnumerator(result);
    }

    NS_ENSURE_SUCCESS(rv,rv);
    return rv;
}

NS_IMETHODIMP nsAbLDAPDirectory::HasCard(nsIAbCard* card, PRBool* hasCard)
{
  nsresult rv = Initiate ();
  NS_ENSURE_SUCCESS(rv, rv);

  nsVoidKey key (static_cast<void*>(card));

  // Enter lock
  nsAutoLock lock (mLock);

  *hasCard = mCache.Exists (&key);
  if (!*hasCard && mPerformingQuery)
    return NS_ERROR_NOT_AVAILABLE;

  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPDirectory::GetLDAPURL(nsILDAPURL** url)
{
  NS_ENSURE_ARG_POINTER(url);

  nsresult rv;
  nsCOMPtr<nsILDAPURL> result = do_CreateInstance(NS_LDAPURL_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  // Rather than using GetURI here we call GetStringValue directly so
  // we can handle the case where the URI isn't specified (see comments
  // below)
  nsCAutoString URI;
  rv = GetStringValue("uri", EmptyCString(), URI);
  if (NS_FAILED(rv) || URI.IsEmpty())
  {
    /*
     * A recent change in Mozilla now means that the LDAP Address Book
     * RDF Resource URI is based on the unique preference name value i.e.  
     * [moz-abldapdirectory://prefName]
     * Prior to this valid change it was based on the actual uri i.e. 
     * [moz-abldapdirectory://host:port/basedn]
     * Basing the resource on the prefName allows these attributes to 
     * change. 
     *
     * But the uri value was also the means by which third-party
     * products could integrate with Mozilla's LDAP Address Books
     * without necessarily having an entry in the preferences file
     * or more importantly needing to be able to change the
     * preferences entries. Thus to set the URI Spec now, it is
     * only necessary to read the uri pref entry, while in the
     * case where it is not a preference, we need to replace the
     * "moz-abldapdirectory".
     */
    nsCAutoString tempLDAPURL(mURINoQuery);
    tempLDAPURL.ReplaceSubstring("moz-abldapdirectory:", "ldap:");
    rv = result->SetSpec(tempLDAPURL);
  }
  else
  {
    rv = result->SetSpec(URI);
  }
  NS_ENSURE_SUCCESS(rv, rv);

  result.swap(*url);
  return rv;
}

NS_IMETHODIMP nsAbLDAPDirectory::SetLDAPURL(nsILDAPURL *aUrl)
{
  NS_ENSURE_ARG_POINTER(aUrl);

  nsCString tempLDAPURL;
  nsresult rv = aUrl->GetSpec(tempLDAPURL);
  NS_ENSURE_SUCCESS(rv, rv);

  return SetStringValue("uri", tempLDAPURL);
}

/* 
 *
 * nsIAbDirectorySearch methods
 *
 */

NS_IMETHODIMP nsAbLDAPDirectory::StartSearch ()
{
    if (!mIsQueryURI || mQueryString.IsEmpty())
        return NS_OK;

    nsresult rv = Initiate();
    NS_ENSURE_SUCCESS(rv, rv);

    rv = StopSearch();
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIAbDirectoryQueryArguments> arguments = do_CreateInstance(NS_ABDIRECTORYQUERYARGUMENTS_CONTRACTID,&rv);
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIAbBooleanExpression> expression;
    rv = nsAbQueryStringToExpression::Convert(mQueryString.get(),
                                              getter_AddRefs(expression));
    NS_ENSURE_SUCCESS(rv, rv);

    rv = arguments->SetExpression(expression);
    NS_ENSURE_SUCCESS(rv, rv);

    // Set the return properties to
    // return nsIAbCard interfaces
    const char *arr = "card:nsIAbCard";
    rv = arguments->SetReturnProperties(1, &arr);
    NS_ENSURE_SUCCESS(rv, rv);

    rv = arguments->SetQuerySubDirectories(PR_TRUE);
    NS_ENSURE_SUCCESS(rv, rv);

    // Set the the query listener
    nsCOMPtr<nsIAbDirectoryQueryResultListener> queryListener;
    nsAbDirSearchListener* _queryListener =
        new nsAbDirSearchListener (this);
    queryListener = _queryListener;

    // Get the max hits to return
    PRInt32 maxHits;
    rv = GetMaxHits(&maxHits);
    if (NS_FAILED(rv))
      maxHits = kDefaultMaxHits;

    // get the appropriate ldap attribute map, and pass it in via the
    // TypeSpecificArgument
    nsCOMPtr<nsIAbLDAPAttributeMap> attrMap;
    rv = GetAttributeMap(getter_AddRefs(attrMap));
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsISupports> typeSpecificArg = do_QueryInterface(attrMap, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    rv = arguments->SetTypeSpecificArg(attrMap);
    NS_ENSURE_SUCCESS(rv, rv);

    // Perform the query
    rv = DoQuery(arguments, queryListener, maxHits, 0, &mContext);
    NS_ENSURE_SUCCESS(rv, rv);

    // Enter lock
    nsAutoLock lock (mLock);
    mPerformingQuery = PR_TRUE;
    mCache.Reset ();

    return rv;
}  

NS_IMETHODIMP nsAbLDAPDirectory::StopSearch ()
{
  nsresult rv = Initiate();
  NS_ENSURE_SUCCESS(rv, rv);

  // Enter lock
  {
    nsAutoLock lockGuard(mLock);
    if (!mPerformingQuery)
      return NS_OK;
    mPerformingQuery = PR_FALSE;
  }
  // Exit lock

  return StopQuery(mContext);
}

/* 
 *
 * nsAbDirSearchListenerContext methods
 *
 */
nsresult nsAbLDAPDirectory::OnSearchFinished(PRInt32 result)
{
  nsresult rv = Initiate();
  NS_ENSURE_SUCCESS(rv, rv);

  nsAutoLock lock(mLock);
  mPerformingQuery = PR_FALSE;

  return NS_OK;
}

nsresult nsAbLDAPDirectory::OnSearchFoundCard(nsIAbCard* card)
{
  nsresult rv = Initiate();
  NS_ENSURE_SUCCESS(rv, rv);

  nsVoidKey key (static_cast<void*>(card));
  // Enter lock
  {
    nsAutoLock lock(mLock);
    mCache.Put(&key, card);
  }
  // Exit lock

  nsCOMPtr<nsIAddrBookSession> abSession = do_GetService(NS_ADDRBOOKSESSION_CONTRACTID, &rv);
  if(NS_SUCCEEDED(rv))
    abSession->NotifyDirectoryItemAdded(this, card);

  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPDirectory::GetSupportsMailingLists(PRBool *aSupportsMailingsLists)
{
  NS_ENSURE_ARG_POINTER(aSupportsMailingsLists);
  *aSupportsMailingsLists = PR_FALSE;
  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPDirectory::GetIsRemote(PRBool *aIsRemote)
{
  NS_ENSURE_ARG_POINTER(aIsRemote);
  *aIsRemote = PR_TRUE;
  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPDirectory::GetIsSecure(PRBool *aIsSecure)
{
  NS_ENSURE_ARG_POINTER(aIsSecure);

  nsCAutoString URI;
  nsresult rv = GetStringValue("uri", EmptyCString(), URI);
  NS_ENSURE_SUCCESS(rv, rv);
  
  // to determine if this is a secure directory, check if the uri is ldaps:// or not
  *aIsSecure = (strncmp(URI.get(), "ldaps:", 6) == 0);
  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPDirectory::GetSearchDuringLocalAutocomplete(PRBool *aSearchDuringLocalAutocomplete)
{
  NS_ENSURE_ARG_POINTER(aSearchDuringLocalAutocomplete);

  // always skip LDAP directories when doing local autocomplete.
  // we do the LDAP autocompleting
  // in nsLDAPAutoCompleteSession
  *aSearchDuringLocalAutocomplete = PR_FALSE;
  return NS_OK;
}

NS_IMETHODIMP
nsAbLDAPDirectory::GetSearchClientControls(nsIMutableArray **aControls)
{
  NS_IF_ADDREF(*aControls = mSearchClientControls);
  return NS_OK;
}

NS_IMETHODIMP
nsAbLDAPDirectory::SetSearchClientControls(nsIMutableArray *aControls)
{
  mSearchClientControls = aControls;
  return NS_OK;
}

NS_IMETHODIMP
nsAbLDAPDirectory::GetSearchServerControls(nsIMutableArray **aControls)
{
  NS_IF_ADDREF(*aControls = mSearchServerControls);
  return NS_OK;
}

NS_IMETHODIMP
nsAbLDAPDirectory::SetSearchServerControls(nsIMutableArray *aControls)
{
  mSearchServerControls = aControls;
  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPDirectory::GetProtocolVersion(PRUint32 *aProtocolVersion)
{
  nsCAutoString versionString;

  nsresult rv = GetStringValue("protocolVersion", NS_LITERAL_CSTRING("3"), versionString);
  NS_ENSURE_SUCCESS(rv, rv);

  *aProtocolVersion = versionString.EqualsLiteral("3") ?
    (PRUint32)nsILDAPConnection::VERSION3 :
    (PRUint32)nsILDAPConnection::VERSION2;

  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPDirectory::SetProtocolVersion(PRUint32 aProtocolVersion)
{
  // XXX We should cancel any existing LDAP connections here and
  // be ready to re-initialise them with the new auth details.
  return SetStringValue("protocolVersion",
                        aProtocolVersion == nsILDAPConnection::VERSION3 ?
                        NS_LITERAL_CSTRING("3") : NS_LITERAL_CSTRING("2"));
}

NS_IMETHODIMP nsAbLDAPDirectory::GetMaxHits(PRInt32 *aMaxHits)
{
  return GetIntValue("maxHits", kDefaultMaxHits, aMaxHits);
}

NS_IMETHODIMP nsAbLDAPDirectory::SetMaxHits(PRInt32 aMaxHits)
{
  return SetIntValue("maxHits", aMaxHits);
}

NS_IMETHODIMP nsAbLDAPDirectory::GetReplicationFileName(nsACString &aReplicationFileName)
{
  return GetStringValue("filename", EmptyCString(), aReplicationFileName);
}

NS_IMETHODIMP nsAbLDAPDirectory::SetReplicationFileName(const nsACString &aReplicationFileName)
{
  return SetStringValue("filename", aReplicationFileName);
}

NS_IMETHODIMP nsAbLDAPDirectory::GetAuthDn(nsACString &aAuthDn)
{
  return GetStringValue("auth.dn", EmptyCString(), aAuthDn);
}

NS_IMETHODIMP nsAbLDAPDirectory::SetAuthDn(const nsACString &aAuthDn)
{
  // XXX We should cancel any existing LDAP connections here and
  // be ready to re-initialise them with the new auth details.
  return SetStringValue("auth.dn", aAuthDn);
}

NS_IMETHODIMP nsAbLDAPDirectory::GetLastChangeNumber(PRInt32 *aLastChangeNumber)
{
  return GetIntValue("lastChangeNumber", -1, aLastChangeNumber);
}

NS_IMETHODIMP nsAbLDAPDirectory::SetLastChangeNumber(PRInt32 aLastChangeNumber)
{
  return SetIntValue("lastChangeNumber", aLastChangeNumber);
}

NS_IMETHODIMP nsAbLDAPDirectory::GetDataVersion(nsACString &aDataVersion)
{
  return GetStringValue("dataVersion", EmptyCString(), aDataVersion);
}

NS_IMETHODIMP nsAbLDAPDirectory::SetDataVersion(const nsACString &aDataVersion)
{
  return SetStringValue("dataVersion", aDataVersion);
}

NS_IMETHODIMP nsAbLDAPDirectory::GetAttributeMap(nsIAbLDAPAttributeMap **aAttributeMap)
{
  nsresult rv;
  nsCOMPtr<nsIAbLDAPAttributeMapService> mapSvc = 
    do_GetService("@mozilla.org/addressbook/ldap-attribute-map-service;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  return mapSvc->GetMapForPrefBranch(m_DirPrefId, aAttributeMap);
}
