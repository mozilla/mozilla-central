/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsAbLDAPDirectory.h"

#include "nsAbQueryStringToExpression.h"

#include "nsAbBaseCID.h"
#include "nsIAbManager.h"
#include "nsServiceManagerUtils.h"
#include "nsComponentManagerUtils.h"
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
#include "nsIFile.h"
#include "nsILDAPModification.h"
#include "nsILDAPService.h"
#include "nsIAbLDAPCard.h"
#include "nsAbUtils.h"
#include "nsArrayUtils.h"
#include "nsIPrefService.h"
#include "nsIMsgAccountManager.h"
#include "nsMsgBaseCID.h"
#include "nsMsgUtils.h"
#include "mozilla/Services.h"

#define kDefaultMaxHits 100

using namespace mozilla;

nsAbLDAPDirectory::nsAbLDAPDirectory() :
  nsAbDirProperty(),
  mPerformingQuery(false),
  mContext(0),
  mLock("nsAbLDAPDirectory.mLock")
{
}

nsAbLDAPDirectory::~nsAbLDAPDirectory()
{
}

NS_IMPL_ISUPPORTS_INHERITED3(nsAbLDAPDirectory, nsAbDirProperty,
                             nsISupportsWeakReference, nsIAbDirSearchListener,
                             nsIAbLDAPDirectory)

NS_IMETHODIMP nsAbLDAPDirectory::GetPropertiesChromeURI(nsACString &aResult)
{
  aResult.AssignLiteral("chrome://messenger/content/addressbook/pref-directory-add.xul");
  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPDirectory::Init(const char* aURI)
{
  // We need to ensure that the m_DirPrefId is initialized properly
  nsAutoCString uri(aURI);

  // Find the first ? (of the search params) if there is one.
  // We know we can start at the end of the moz-abldapdirectory:// because
  // that's the URI we should have been passed.
  int32_t searchCharLocation = uri.FindChar('?', kLDAPDirectoryRootLen);

  if (searchCharLocation == -1)
    m_DirPrefId = Substring(uri, kLDAPDirectoryRootLen);
  else
    m_DirPrefId = Substring(uri, kLDAPDirectoryRootLen, searchCharLocation - kLDAPDirectoryRootLen);

  return nsAbDirProperty::Init(aURI);
}

nsresult nsAbLDAPDirectory::Initiate()
{
  return NS_OK;
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
    bool offline;
    nsCOMPtr <nsIIOService> ioService =
      mozilla::services::GetIOService();
    NS_ENSURE_TRUE(ioService, NS_ERROR_UNEXPECTED);
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
      nsAutoCString localDirectoryURI(NS_LITERAL_CSTRING(kMDBDirectoryRoot));
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

NS_IMETHODIMP nsAbLDAPDirectory::GetIsQuery(bool *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  *aResult = mIsQueryURI;
  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPDirectory::HasCard(nsIAbCard* card, bool* hasCard)
{
  nsresult rv = Initiate ();
  NS_ENSURE_SUCCESS(rv, rv);

  // Enter lock
  MutexAutoLock lock (mLock);

  *hasCard = mCache.Get(card, nullptr);
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
  nsAutoCString URI;
  nsresult rv = GetStringValue("uri", EmptyCString(), URI);
  if (NS_FAILED(rv) || URI.IsEmpty())
  {
    /*
     * A recent change in Mozilla now means that the LDAP Address Book
     * URI is based on the unique preference name value i.e.
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

  nsCOMPtr<nsIIOService> ioService =
    mozilla::services::GetIOService();
  NS_ENSURE_TRUE(ioService, NS_ERROR_UNEXPECTED);

  nsCOMPtr<nsIURI> result;
  rv = ioService->NewURI(URI, nullptr, nullptr, getter_AddRefs(result));
  NS_ENSURE_SUCCESS(rv, rv);

  return CallQueryInterface(result, aResult);
}

NS_IMETHODIMP nsAbLDAPDirectory::SetLDAPURL(nsILDAPURL *aUrl)
{
  NS_ENSURE_ARG_POINTER(aUrl);

  nsAutoCString oldUrl;
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
  bool newIsNotSecure = StringHead(tempLDAPURL, 5).Equals("ldap:");

  if (oldUrl.IsEmpty() ||
      StringHead(oldUrl, 5).Equals("ldap:") != newIsNotSecure)
  {
    // They don't so its time to send round an update.
    nsCOMPtr<nsIAbManager> abManager = do_GetService(NS_ABMANAGER_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    // We inherit from nsIAbDirectory, so this static cast should be safe.
    abManager->NotifyItemPropertyChanged(static_cast<nsIAbDirectory*>(this),
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
    rv = nsAbQueryStringToExpression::Convert(mQueryString,
                                              getter_AddRefs(expression));
    NS_ENSURE_SUCCESS(rv, rv);

    rv = arguments->SetExpression(expression);
    NS_ENSURE_SUCCESS(rv, rv);

    rv = arguments->SetQuerySubDirectories(true);
    NS_ENSURE_SUCCESS(rv, rv);

    // Get the max hits to return
    int32_t maxHits;
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
    MutexAutoLock lock(mLock);
    mPerformingQuery = true;
    mCache.Clear();

    return rv;
}  

NS_IMETHODIMP nsAbLDAPDirectory::StopSearch ()
{
  nsresult rv = Initiate();
  NS_ENSURE_SUCCESS(rv, rv);

  // Enter lock
  {
    MutexAutoLock lockGuard(mLock);
    if (!mPerformingQuery)
      return NS_OK;
    mPerformingQuery = false;
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
NS_IMETHODIMP nsAbLDAPDirectory::OnSearchFinished(int32_t aResult, const nsAString &aErrorMessage)
{
  nsresult rv = Initiate();
  NS_ENSURE_SUCCESS(rv, rv);

  MutexAutoLock lock(mLock);
  mPerformingQuery = false;

  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPDirectory::OnSearchFoundCard(nsIAbCard* card)
{
  nsresult rv = Initiate();
  NS_ENSURE_SUCCESS(rv, rv);

  // Enter lock
  {
    MutexAutoLock lock(mLock);
    mCache.Put(card, card);
  }
  // Exit lock

  nsCOMPtr<nsIAbManager> abManager = do_GetService(NS_ABMANAGER_CONTRACTID, &rv);
  if(NS_SUCCEEDED(rv))
    abManager->NotifyDirectoryItemAdded(this, card);

  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPDirectory::GetSupportsMailingLists(bool *aSupportsMailingsLists)
{
  NS_ENSURE_ARG_POINTER(aSupportsMailingsLists);
  *aSupportsMailingsLists = false;
  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPDirectory::GetReadOnly(bool *aReadOnly)
{
  NS_ENSURE_ARG_POINTER(aReadOnly);

  *aReadOnly = true;

#ifdef MOZ_EXPERIMENTAL_WRITEABLE_LDAP
  bool readOnly;
  nsresult rv = GetBoolValue("readonly", false, &readOnly);
  NS_ENSURE_SUCCESS(rv, rv);

  if (readOnly)
    return NS_OK;

  // when online, we'll allow writing as well
  bool offline;
  nsCOMPtr <nsIIOService> ioService =
    mozilla::services::GetIOService();
  NS_ENSURE_TRUE(ioService, NS_ERROR_UNEXPECTED);

  rv = ioService->GetOffline(&offline);
  NS_ENSURE_SUCCESS(rv,rv);

  if (!offline)
    *aReadOnly = false;
#endif

  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPDirectory::GetIsRemote(bool *aIsRemote)
{
  NS_ENSURE_ARG_POINTER(aIsRemote);
  *aIsRemote = true;
  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPDirectory::GetIsSecure(bool *aIsSecure)
{
  NS_ENSURE_ARG_POINTER(aIsSecure);

  nsAutoCString URI;
  nsresult rv = GetStringValue("uri", EmptyCString(), URI);
  NS_ENSURE_SUCCESS(rv, rv);
  
  // to determine if this is a secure directory, check if the uri is ldaps:// or not
  *aIsSecure = (strncmp(URI.get(), "ldaps:", 6) == 0);
  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPDirectory::UseForAutocomplete(const nsACString &aIdentityKey,
                                                    bool *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);

  // Set this to false by default to make the code easier below.
  *aResult = false;

  nsresult rv;
  bool offline = false;
  nsCOMPtr <nsIIOService> ioService =
    mozilla::services::GetIOService();
  NS_ENSURE_TRUE(ioService, NS_ERROR_UNEXPECTED);

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

  bool useDirectory = false;
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
        bool overrideGlobalPref = false;
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
    nsCOMPtr<nsIFile> databaseFile;
    // If we can't get the file, then there is no database to use
    if (NS_FAILED(GetReplicationFile(getter_AddRefs(databaseFile))))
      return NS_OK;

    bool exists;
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

NS_IMETHODIMP nsAbLDAPDirectory::GetProtocolVersion(uint32_t *aProtocolVersion)
{
  nsAutoCString versionString;

  nsresult rv = GetStringValue("protocolVersion", NS_LITERAL_CSTRING("3"), versionString);
  NS_ENSURE_SUCCESS(rv, rv);

  *aProtocolVersion = versionString.EqualsLiteral("3") ?
    (uint32_t)nsILDAPConnection::VERSION3 :
    (uint32_t)nsILDAPConnection::VERSION2;

  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPDirectory::SetProtocolVersion(uint32_t aProtocolVersion)
{
  // XXX We should cancel any existing LDAP connections here and
  // be ready to re-initialise them with the new auth details.
  return SetStringValue("protocolVersion",
                        aProtocolVersion == nsILDAPConnection::VERSION3 ?
                        NS_LITERAL_CSTRING("3") : NS_LITERAL_CSTRING("2"));
}

NS_IMETHODIMP nsAbLDAPDirectory::GetMaxHits(int32_t *aMaxHits)
{
  return GetIntValue("maxHits", kDefaultMaxHits, aMaxHits);
}

NS_IMETHODIMP nsAbLDAPDirectory::SetMaxHits(int32_t aMaxHits)
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

NS_IMETHODIMP nsAbLDAPDirectory::GetLastChangeNumber(int32_t *aLastChangeNumber)
{
  return GetIntValue("lastChangeNumber", -1, aLastChangeNumber);
}

NS_IMETHODIMP nsAbLDAPDirectory::SetLastChangeNumber(int32_t aLastChangeNumber)
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

NS_IMETHODIMP nsAbLDAPDirectory::GetReplicationFile(nsIFile **aResult)
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

  NS_ADDREF(*aResult = profileDir);

  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPDirectory::GetReplicationDatabase(nsIAddrDatabase **aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);

  nsresult rv;
  nsCOMPtr<nsIFile> databaseFile;
 rv = GetReplicationFile(getter_AddRefs(databaseFile));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAddrDatabase> addrDBFactory =
    do_GetService(NS_ADDRDATABASE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  return addrDBFactory->Open(databaseFile, false /* no create */, true,
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
  nsAutoCString prefString;
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

  nsAutoCString baseDN;
  rv = currentUrl->GetDn(baseDN);
  NS_ENSURE_SUCCESS(rv, rv);
 
  // Calculate DN
  nsAutoCString cardDN;
  rv = card->BuildRdn(attrMap, rdnAttrs.GetSize(), rdnAttrs.GetArray(),
    cardDN);
  NS_ENSURE_SUCCESS(rv, rv);
  cardDN.AppendLiteral(",");
  cardDN.Append(baseDN);

  rv = card->SetDn(cardDN);
  NS_ENSURE_SUCCESS(rv, rv);

  nsAutoCString ourUuid;
  GetUuid(ourUuid);
  copyToCard->SetDirectoryId(ourUuid);

  // Launch query
  rv = DoModify(this, nsILDAPModification::MOD_ADD, cardDN, modArray,
                EmptyCString(), EmptyCString());
  NS_ENSURE_SUCCESS(rv, rv);

  NS_ADDREF(*aAddedCard = copyToCard);
  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPDirectory::DeleteCards(nsIArray *aCards)
{
  uint32_t cardCount;
  uint32_t i;
  nsAutoCString cardDN;

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

    nsCOMPtr<nsIAbCard> realCard(do_QueryInterface(card));
    realCard->SetDirectoryId(EmptyCString());
   
    // Launch query
    rv = DoModify(this, nsILDAPModification::MOD_DELETE, cardDN, nullptr,
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
  nsAutoCString prefString;
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
  nsAutoCString oldDN;
  rv = card->GetDn(oldDN);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsILDAPService> ldapSvc = do_GetService(
    "@mozilla.org/network/ldap-service;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  // Retrieve base DN and RDN attributes
  nsAutoCString baseDN;
  nsAutoCString oldRDN;
  CharPtrArrayGuard rdnAttrs;
  rv = ldapSvc->ParseDn(oldDN.get(), oldRDN, baseDN,
                        rdnAttrs.GetSizeAddr(), rdnAttrs.GetArrayAddr());
  NS_ENSURE_SUCCESS(rv, rv);

  // Calculate new RDN and check whether it has changed
  nsAutoCString newRDN;
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
    nsAutoCString newDN(newRDN);
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
  uint32_t *aCount,
  char ***aValues)
{
  NS_ENSURE_ARG_POINTER(aCount);
  NS_ENSURE_ARG_POINTER(aValues);

  nsTArray<nsCString> strarr;
  ParseString(aString, ',', strarr);

  char **cArray = nullptr;
  if (!(cArray = static_cast<char **>(nsMemory::Alloc(
      strarr.Length() * sizeof(char *)))))
    return NS_ERROR_OUT_OF_MEMORY;

  for (uint32_t i = 0; i < strarr.Length(); ++i)
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

