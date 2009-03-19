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
 *   Mark Banner <bugzilla@standard8.plus.com>
 *   Jeremy Laine <jeremy.laine@m4x.org>
 *   Simon Wilkinson <simon@sxw.org.uk>
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
#include "nsIAbManager.h"
#include "nsServiceManagerUtils.h"
#include "nsComponentManagerUtils.h"
#include "nsAutoLock.h"
#include "nsNetCID.h"
#include "nsIIOService.h"
#include "nsCOMArray.h"
#include "nsArrayEnumerator.h"
#include "nsEnumeratorUtils.h"
#include "nsIAbLDAPAttributeMap.h"
#include "nsIAbMDBDirectory.h"
#include "nsILDAPURL.h"
#include "nsILDAPConnection.h"
#include "nsAppDirectoryServiceDefs.h"
#include "nsDirectoryServiceUtils.h"
#include "nsILocalFile.h"
#include "nsILDAPModification.h"
#include "nsILDAPService.h"
#include "nsIAbLDAPCard.h"
#include "nsAbUtils.h"
#include "nsArrayUtils.h"
#include "nsIPrefService.h"
#include "nsIMsgAccountManager.h"
#include "nsMsgBaseCID.h"
#include "nsMsgUtils.h"

#define kDefaultMaxHits 100

nsAbLDAPDirectory::nsAbLDAPDirectory() :
  nsAbDirectoryRDFResource(),
  mPerformingQuery(PR_FALSE),
  mContext(0),
  mLock(0)
{
  mCache.Init();
}

nsAbLDAPDirectory::~nsAbLDAPDirectory()
{
  if (mLock)
    PR_DestroyLock (mLock);
}

NS_IMPL_ISUPPORTS_INHERITED3(nsAbLDAPDirectory, nsAbDirectoryRDFResource,
                             nsIAbDirectory, nsIAbDirSearchListener,
                             nsIAbLDAPDirectory)

NS_IMETHODIMP nsAbLDAPDirectory::GetPropertiesChromeURI(nsACString &aResult)
{
  aResult.AssignLiteral("chrome://messenger/content/addressbook/pref-directory-add.xul");
  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPDirectory::Init(const char* aURI)
{
  // We need to ensure that the m_DirPrefId is initialized properly
  nsCAutoString uri(aURI);

  // Find the first ? (of the search params) if there is one.
  // We know we can start at the end of the moz-abldapdirectory:// because
  // that's the URI we should have been passed.
  PRInt32 searchCharLocation = uri.FindChar('?', kLDAPDirectoryRootLen);

  if (searchCharLocation == -1)
    m_DirPrefId = StringTail(uri, uri.Length() - kLDAPDirectoryRootLen);
  else
    m_DirPrefId = Substring(uri, kLDAPDirectoryRootLen, searchCharLocation - kLDAPDirectoryRootLen);

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
  if (mURI.IsEmpty())
    return NS_ERROR_NOT_INITIALIZED;

  aURI = mURI;
  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPDirectory::GetChildNodes(nsISimpleEnumerator* *aResult)
{
  return NS_NewEmptyEnumerator(aResult);
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

      nsCOMPtr<nsIAbManager> abManager(do_GetService(NS_ABMANAGER_CONTRACTID,
                                                     &rv));
      NS_ENSURE_SUCCESS(rv, rv);

      nsCOMPtr <nsIAbDirectory> directory;
      rv = abManager->GetDirectory(localDirectoryURI,
                                   getter_AddRefs(directory));
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

  // Enter lock
  nsAutoLock lock (mLock);

  *hasCard = mCache.Get(card, nsnull);
  if (!*hasCard && mPerformingQuery)
    return NS_ERROR_NOT_AVAILABLE;

  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPDirectory::GetLDAPURL(nsILDAPURL** aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);

  // Rather than using GetURI here we call GetStringValue directly so
  // we can handle the case where the URI isn't specified (see comments
  // below)
  nsCAutoString URI;
  nsresult rv = GetStringValue("uri", EmptyCString(), URI);
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
    URI = mURINoQuery;
    if (StringBeginsWith(URI, NS_LITERAL_CSTRING(kLDAPDirectoryRoot)))
      URI.Replace(0, kLDAPDirectoryRootLen, NS_LITERAL_CSTRING("ldap://"));
  }

  nsCOMPtr<nsIIOService> ioService(do_GetService(NS_IOSERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIURI> result;
  rv = ioService->NewURI(URI, nsnull, nsnull, getter_AddRefs(result));
  NS_ENSURE_SUCCESS(rv, rv);

  return CallQueryInterface(result, aResult);
}

NS_IMETHODIMP nsAbLDAPDirectory::SetLDAPURL(nsILDAPURL *aUrl)
{
  NS_ENSURE_ARG_POINTER(aUrl);

  nsCAutoString oldUrl;
  // Note, it doesn't matter if GetStringValue fails - we'll just send an
  // update if its blank (i.e. old value not set).
  GetStringValue("uri", EmptyCString(), oldUrl);

  // Actually set the new value.
  nsCString tempLDAPURL;
  nsresult rv = aUrl->GetSpec(tempLDAPURL);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = SetStringValue("uri", tempLDAPURL);
  NS_ENSURE_SUCCESS(rv, rv);

  // Now we need to send an update which will ensure our indicators and
  // listeners get updated correctly.

  // See if they both start with ldaps: or ldap:
  PRBool newIsNotSecure = StringHead(tempLDAPURL, 5).Equals("ldap:");

  if (oldUrl.IsEmpty() ||
      StringHead(oldUrl, 5).Equals("ldap:") != newIsNotSecure)
  {
    // They don't so its time to send round an update.
    nsCOMPtr<nsIAbManager> abManager = do_GetService(NS_ABMANAGER_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    // We inherit from nsAbDirProperty, so this static cast should be safe.
    abManager->NotifyItemPropertyChanged(static_cast<nsAbDirProperty*>(this),
      "IsSecure",
      (newIsNotSecure ? NS_LITERAL_STRING("true") : NS_LITERAL_STRING("false")).get(),
      (newIsNotSecure ? NS_LITERAL_STRING("false") : NS_LITERAL_STRING("true")).get());
  }

  return NS_OK;
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

    rv = arguments->SetQuerySubDirectories(PR_TRUE);
    NS_ENSURE_SUCCESS(rv, rv);

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

    if (!mDirectoryQuery)
    {
      mDirectoryQuery = do_CreateInstance(NS_ABLDAPDIRECTORYQUERY_CONTRACTID,
                                          &rv);
      NS_ENSURE_SUCCESS(rv, rv);
    }

    // Perform the query
    rv = mDirectoryQuery->DoQuery(this, arguments, this, maxHits, 0, &mContext);
    NS_ENSURE_SUCCESS(rv, rv);

    // Enter lock
    nsAutoLock lock(mLock);
    mPerformingQuery = PR_TRUE;
    mCache.Clear();

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

  if (!mDirectoryQuery)
    return NS_ERROR_NULL_POINTER;

  return mDirectoryQuery->StopQuery(mContext);
}

/* 
 *
 * nsAbDirSearchListenerContext methods
 *
 */
NS_IMETHODIMP nsAbLDAPDirectory::OnSearchFinished(PRInt32 aResult, const nsAString &aErrorMessage)
{
  nsresult rv = Initiate();
  NS_ENSURE_SUCCESS(rv, rv);

  nsAutoLock lock(mLock);
  mPerformingQuery = PR_FALSE;

  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPDirectory::OnSearchFoundCard(nsIAbCard* card)
{
  nsresult rv = Initiate();
  NS_ENSURE_SUCCESS(rv, rv);

  // Enter lock
  {
    nsAutoLock lock(mLock);
    mCache.Put(card, card);
  }
  // Exit lock

  nsCOMPtr<nsIAbManager> abManager = do_GetService(NS_ABMANAGER_CONTRACTID, &rv);
  if(NS_SUCCEEDED(rv))
    abManager->NotifyDirectoryItemAdded(this, card);

  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPDirectory::GetSupportsMailingLists(PRBool *aSupportsMailingsLists)
{
  NS_ENSURE_ARG_POINTER(aSupportsMailingsLists);
  *aSupportsMailingsLists = PR_FALSE;
  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPDirectory::GetReadOnly(PRBool *aReadOnly)
{
  NS_ENSURE_ARG_POINTER(aReadOnly);

  *aReadOnly = PR_TRUE;

#ifdef MOZ_EXPERIMENTAL_WRITEABLE_LDAP
  PRBool readOnly;
  nsresult rv = GetBoolValue("readonly", PR_FALSE, &readOnly);
  NS_ENSURE_SUCCESS(rv, rv);

  if (readOnly)
    return NS_OK;

  // when online, we'll allow writing as well
  PRBool offline;
  nsCOMPtr <nsIIOService> ioService =
    do_GetService(NS_IOSERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  rv = ioService->GetOffline(&offline);
  NS_ENSURE_SUCCESS(rv,rv);

  if (!offline)
    *aReadOnly = PR_FALSE;
#endif

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

NS_IMETHODIMP nsAbLDAPDirectory::UseForAutocomplete(const nsACString &aIdentityKey,
                                                    PRBool *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);

  // Set this to false by default to make the code easier below.
  *aResult = PR_FALSE;

  nsresult rv;
  PRBool offline = PR_FALSE;
  nsCOMPtr <nsIIOService> ioService =
    do_GetService(NS_IOSERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = ioService->GetOffline(&offline);
  NS_ENSURE_SUCCESS(rv, rv);

  // If we're online, then don't allow search during local autocomplete - must
  // use the separate LDAP autocomplete session due to the current interfaces
  if (!offline)
    return NS_OK;

  // Is the use directory pref set for autocompletion?
  nsCOMPtr<nsIPrefBranch> prefs(do_GetService(NS_PREFSERVICE_CONTRACTID,
                                              &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  PRBool useDirectory = PR_FALSE;
  rv = prefs->GetBoolPref("ldap_2.autoComplete.useDirectory", &useDirectory);
  NS_ENSURE_SUCCESS(rv, rv);

  // No need to search if not set up globally for LDAP autocompletion and we've
  // not been given an identity.
  if (!useDirectory && aIdentityKey.IsEmpty())
    return NS_OK;

  nsCString prefName;
  if (!aIdentityKey.IsEmpty())
  {
    // If we have an identity string, try and find out the required directory
    // server.
    nsCOMPtr<nsIMsgAccountManager> accountManager =
      do_GetService(NS_MSGACCOUNTMANAGER_CONTRACTID, &rv);

    // If we failed, just return, we can't do much about this.
    if (NS_SUCCEEDED(rv))
    {
      nsCOMPtr<nsIMsgIdentity> identity;
      rv = accountManager->GetIdentity(aIdentityKey, getter_AddRefs(identity));
      if (NS_SUCCEEDED(rv))
      {
        PRBool overrideGlobalPref = PR_FALSE;
        identity->GetOverrideGlobalPref(&overrideGlobalPref);
        if (overrideGlobalPref)
          identity->GetDirectoryServer(prefName);
      }
    }

    // If the preference name is still empty but useDirectory is false, then
    // the global one is not available, nor is the overriden one.
    if (prefName.IsEmpty() && !useDirectory)
      return NS_OK;
  }

  // If we failed to get the identity preference, or the pref name is empty
  // try the global preference.
  if (prefName.IsEmpty())
  {
    nsresult rv = prefs->GetCharPref("ldap_2.autoComplete.directoryServer",
                                     getter_Copies(prefName));
    NS_ENSURE_SUCCESS(rv,rv);
  }

  // Now see if the pref name matches our pref id.
  if (prefName.Equals(m_DirPrefId))
  {
    // Yes it does, one last check - does the replication file exist?
    nsresult rv;
    nsCOMPtr<nsILocalFile> databaseFile;
    // If we can't get the file, then there is no database to use
    if (NS_FAILED(GetReplicationFile(getter_AddRefs(databaseFile))))
      return NS_OK;

    PRBool exists;
    rv = databaseFile->Exists(&exists);
    NS_ENSURE_SUCCESS(rv, rv);

    *aResult = exists;
  }
  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPDirectory::GetSearchClientControls(nsIMutableArray **aControls)
{
  NS_IF_ADDREF(*aControls = mSearchClientControls);
  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPDirectory::SetSearchClientControls(nsIMutableArray *aControls)
{
  mSearchClientControls = aControls;
  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPDirectory::GetSearchServerControls(nsIMutableArray **aControls)
{
  NS_IF_ADDREF(*aControls = mSearchServerControls);
  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPDirectory::SetSearchServerControls(nsIMutableArray *aControls)
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

NS_IMETHODIMP nsAbLDAPDirectory::GetSaslMechanism(nsACString &aSaslMechanism)
{
  return GetStringValue("auth.saslmech", EmptyCString(), aSaslMechanism);
}

NS_IMETHODIMP nsAbLDAPDirectory::SetSaslMechanism(const nsACString &aSaslMechanism)
{
  return SetStringValue("auth.saslmech", aSaslMechanism);
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
  NS_ENSURE_ARG_POINTER(aAttributeMap);
  
  nsresult rv;
  nsCOMPtr<nsIAbLDAPAttributeMapService> mapSvc = 
    do_GetService("@mozilla.org/addressbook/ldap-attribute-map-service;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  return mapSvc->GetMapForPrefBranch(m_DirPrefId, aAttributeMap);
}

NS_IMETHODIMP nsAbLDAPDirectory::GetReplicationFile(nsILocalFile **aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);

  nsCString fileName;
  nsresult rv = GetStringValue("filename", EmptyCString(), fileName);
  NS_ENSURE_SUCCESS(rv, rv);

 if (fileName.IsEmpty())
    return NS_ERROR_NOT_INITIALIZED;

  nsCOMPtr<nsIFile> profileDir;
  rv = NS_GetSpecialDirectory(NS_APP_USER_PROFILE_50_DIR,
                              getter_AddRefs(profileDir));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = profileDir->AppendNative(fileName);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsILocalFile> replFile(do_QueryInterface(profileDir, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  NS_ADDREF(*aResult = replFile);

  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPDirectory::GetReplicationDatabase(nsIAddrDatabase **aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);

  nsresult rv;
  nsCOMPtr<nsILocalFile> databaseFile;
 rv = GetReplicationFile(getter_AddRefs(databaseFile));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAddrDatabase> addrDBFactory =
    do_GetService(NS_ADDRDATABASE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  return addrDBFactory->Open(databaseFile, PR_FALSE /* no create */, PR_TRUE,
                           aResult);
}

NS_IMETHODIMP nsAbLDAPDirectory::AddCard(nsIAbCard *aUpdatedCard,
                                         nsIAbCard **aAddedCard)
{
  NS_ENSURE_ARG_POINTER(aUpdatedCard);
  NS_ENSURE_ARG_POINTER(aAddedCard);
  
  nsCOMPtr<nsIAbLDAPAttributeMap> attrMap;
  nsresult rv = GetAttributeMap(getter_AddRefs(attrMap));
  NS_ENSURE_SUCCESS(rv, rv);

  // Create a new LDAP card
  nsCOMPtr<nsIAbLDAPCard> card =
    do_CreateInstance(NS_ABLDAPCARD_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = Initiate();
  NS_ENSURE_SUCCESS(rv, rv);

  // Copy over the card data
  nsCOMPtr<nsIAbCard> copyToCard = do_QueryInterface(card, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = copyToCard->Copy(aUpdatedCard);
  NS_ENSURE_SUCCESS(rv, rv);
  
  // Retrieve preferences
  nsCAutoString prefString;
  rv = GetRdnAttributes(prefString);
  NS_ENSURE_SUCCESS(rv, rv);

  CharPtrArrayGuard rdnAttrs;
  rv = SplitStringList(prefString, rdnAttrs.GetSizeAddr(),
    rdnAttrs.GetArrayAddr());
  NS_ENSURE_SUCCESS(rv, rv);
  
  rv = GetObjectClasses(prefString);
  NS_ENSURE_SUCCESS(rv, rv);
  
  CharPtrArrayGuard objClass;
  rv = SplitStringList(prefString, objClass.GetSizeAddr(),
    objClass.GetArrayAddr());
  NS_ENSURE_SUCCESS(rv, rv);

  // Process updates
  nsCOMPtr<nsIArray> modArray;
  rv = card->GetLDAPMessageInfo(attrMap, objClass.GetSize(), objClass.GetArray(),
    nsILDAPModification::MOD_ADD, getter_AddRefs(modArray));
  NS_ENSURE_SUCCESS(rv, rv);
  
  // For new cards, the base DN is the search base DN
  nsCOMPtr<nsILDAPURL> currentUrl;
  rv = GetLDAPURL(getter_AddRefs(currentUrl));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCAutoString baseDN;
  rv = currentUrl->GetDn(baseDN);
  NS_ENSURE_SUCCESS(rv, rv);
 
  // Calculate DN
  nsCAutoString cardDN;
  rv = card->BuildRdn(attrMap, rdnAttrs.GetSize(), rdnAttrs.GetArray(),
    cardDN);
  NS_ENSURE_SUCCESS(rv, rv);
  cardDN.AppendLiteral(",");
  cardDN.Append(baseDN);

  rv = card->SetDn(cardDN);
  NS_ENSURE_SUCCESS(rv, rv);

  // Launch query
  rv = DoModify(this, nsILDAPModification::MOD_ADD, cardDN, modArray,
                EmptyCString(), EmptyCString());
  NS_ENSURE_SUCCESS(rv, rv);

  NS_ADDREF(*aAddedCard = copyToCard);
  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPDirectory::DeleteCards(nsIArray *aCards)
{
  PRUint32 cardCount;
  PRUint32 i;
  nsCAutoString cardDN;

  nsresult rv = aCards->GetLength(&cardCount);
  NS_ENSURE_SUCCESS(rv, rv);
 
  for (i = 0; i < cardCount; ++i)
  {
    nsCOMPtr<nsIAbLDAPCard> card(do_QueryElementAt(aCards, i, &rv));
    if (NS_FAILED(rv))
    {
      NS_WARNING("Wrong type of card passed to nsAbLDAPDirectory::DeleteCards");
      break;
    }

    // Set up the search ldap url - this is mURL
    rv = Initiate();
    NS_ENSURE_SUCCESS(rv, rv);
    
    rv = card->GetDn(cardDN);
    NS_ENSURE_SUCCESS(rv, rv);
   
    // Launch query
    rv = DoModify(this, nsILDAPModification::MOD_DELETE, cardDN, nsnull,
                  EmptyCString(), EmptyCString());
    NS_ENSURE_SUCCESS(rv, rv);
  }

  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPDirectory::ModifyCard(nsIAbCard *aUpdatedCard)
{
  NS_ENSURE_ARG_POINTER(aUpdatedCard);
  
  nsCOMPtr<nsIAbLDAPAttributeMap> attrMap;
  nsresult rv = GetAttributeMap(getter_AddRefs(attrMap));
  NS_ENSURE_SUCCESS(rv, rv);

  // Get the LDAP card
  nsCOMPtr<nsIAbLDAPCard> card = do_QueryInterface(aUpdatedCard, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = Initiate();
  NS_ENSURE_SUCCESS(rv, rv);
  
  // Retrieve preferences
  nsCAutoString prefString;
  rv = GetObjectClasses(prefString);
  NS_ENSURE_SUCCESS(rv, rv);
  
  CharPtrArrayGuard objClass;
  rv = SplitStringList(prefString, objClass.GetSizeAddr(),
    objClass.GetArrayAddr());
  NS_ENSURE_SUCCESS(rv, rv);

  // Process updates
  nsCOMPtr<nsIArray> modArray;
  rv = card->GetLDAPMessageInfo(attrMap, objClass.GetSize(), objClass.GetArray(),
    nsILDAPModification::MOD_REPLACE, getter_AddRefs(modArray));
  NS_ENSURE_SUCCESS(rv, rv);
  
  // Get current DN
  nsCAutoString oldDN;
  rv = card->GetDn(oldDN);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsILDAPService> ldapSvc = do_GetService(
    "@mozilla.org/network/ldap-service;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  // Retrieve base DN and RDN attributes
  nsCAutoString baseDN;
  nsCAutoString oldRDN;
  CharPtrArrayGuard rdnAttrs;
  rv = ldapSvc->ParseDn(oldDN.get(), oldRDN, baseDN,
                        rdnAttrs.GetSizeAddr(), rdnAttrs.GetArrayAddr());
  NS_ENSURE_SUCCESS(rv, rv);

  // Calculate new RDN and check whether it has changed
  nsCAutoString newRDN;
  rv = card->BuildRdn(attrMap, rdnAttrs.GetSize(), rdnAttrs.GetArray(),
    newRDN);
  NS_ENSURE_SUCCESS(rv, rv);
      
  if (newRDN.Equals(oldRDN))
  {
    // Launch query
    rv = DoModify(this, nsILDAPModification::MOD_REPLACE, oldDN, modArray,
                  EmptyCString(), EmptyCString());
  }
  else
  {
    // Build and store the new DN
    nsCAutoString newDN(newRDN);
    newDN.AppendLiteral(",");
    newDN.Append(baseDN);
    
    rv = card->SetDn(newDN);
    NS_ENSURE_SUCCESS(rv, rv);
    
    // Launch query
    rv = DoModify(this, nsILDAPModification::MOD_REPLACE, oldDN, modArray,
                  newRDN, baseDN);
  }
  return rv;
}

NS_IMETHODIMP nsAbLDAPDirectory::GetRdnAttributes(nsACString &aRdnAttributes)
{
  return GetStringValue("rdnAttributes", NS_LITERAL_CSTRING("cn"),
    aRdnAttributes);
}

NS_IMETHODIMP nsAbLDAPDirectory::SetRdnAttributes(const nsACString &aRdnAttributes)
{
  return SetStringValue("rdnAttributes", aRdnAttributes);
}

NS_IMETHODIMP nsAbLDAPDirectory::GetObjectClasses(nsACString &aObjectClasses)
{
  return GetStringValue("objectClasses", NS_LITERAL_CSTRING(
    "top,person,organizationalPerson,inetOrgPerson,mozillaAbPersonAlpha"),
    aObjectClasses);
}

NS_IMETHODIMP nsAbLDAPDirectory::SetObjectClasses(const nsACString &aObjectClasses)
{
  return SetStringValue("objectClasses", aObjectClasses);
}

nsresult nsAbLDAPDirectory::SplitStringList(
  const nsACString& aString,
  PRUint32 *aCount,
  char ***aValues)
{
  NS_ENSURE_ARG_POINTER(aCount);
  NS_ENSURE_ARG_POINTER(aValues);

  nsTArray<nsCString> strarr;
  ParseString(aString, ',', strarr);

  char **cArray = nsnull;
  if (!(cArray = static_cast<char **>(nsMemory::Alloc(
      strarr.Length() * sizeof(char *)))))
    return NS_ERROR_OUT_OF_MEMORY;

  for (PRUint32 i = 0; i < strarr.Length(); ++i)
  {
    if (!(cArray[i] = ToNewCString(strarr[i])))
    {
      NS_FREE_XPCOM_ALLOCATED_POINTER_ARRAY(strarr.Length(), cArray);
      return NS_ERROR_OUT_OF_MEMORY;
    }
  }

  *aCount = strarr.Length();
  *aValues = cArray;
  return NS_OK;
}

