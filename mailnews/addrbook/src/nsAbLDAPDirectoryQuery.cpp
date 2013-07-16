/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsAbLDAPDirectoryQuery.h"
#include "nsAbBoolExprToLDAPFilter.h"
#include "nsILDAPMessage.h"
#include "nsILDAPErrors.h"
#include "nsILDAPOperation.h"
#include "nsIAbLDAPAttributeMap.h"
#include "nsIAbLDAPCard.h"
#include "nsAbUtils.h"
#include "nsAbBaseCID.h"
#include "nsStringGlue.h"
#include "prprf.h"
#include "nsServiceManagerUtils.h"
#include "nsComponentManagerUtils.h"
#include "nsCategoryManagerUtils.h"
#include "nsAbLDAPDirectory.h"
#include "nsAbLDAPListenerBase.h"
#include "nsXPCOMCIDInternal.h"

using namespace mozilla;

// nsAbLDAPListenerBase inherits nsILDAPMessageListener
class nsAbQueryLDAPMessageListener : public nsAbLDAPListenerBase
{
public:
  NS_DECL_THREADSAFE_ISUPPORTS

  // Note that the directoryUrl is the details of the ldap directory
  // without any search params or return attributes specified. The searchUrl
  // therefore has the search params and return attributes specified.
  //  nsAbQueryLDAPMessageListener(nsIAbDirectoryQuery* directoryQuery,
  nsAbQueryLDAPMessageListener(nsIAbDirectoryQueryResultListener* resultListener,
                               nsILDAPURL* directoryUrl,
                               nsILDAPURL* searchUrl,
                               nsILDAPConnection* connection,
                               nsIAbDirectoryQueryArguments* queryArguments,
                               nsIMutableArray* serverSearchControls,
                               nsIMutableArray* clientSearchControls,
                               const nsACString &login,
                               const nsACString &mechanism,
                               const int32_t resultLimit = -1,
                               const int32_t timeOut = 0);
  virtual ~nsAbQueryLDAPMessageListener ();

  // nsILDAPMessageListener
  NS_IMETHOD OnLDAPMessage(nsILDAPMessage *aMessage);

protected:
  nsresult OnLDAPMessageSearchEntry(nsILDAPMessage *aMessage);
  nsresult OnLDAPMessageSearchResult(nsILDAPMessage *aMessage);

  friend class nsAbLDAPDirectoryQuery;

  nsresult Cancel();
  virtual nsresult DoTask();
  virtual void InitFailed(bool aCancelled = false);

  nsCOMPtr<nsILDAPURL> mSearchUrl;
  nsIAbDirectoryQueryResultListener *mResultListener;
  int32_t mContextID;
  nsCOMPtr<nsIAbDirectoryQueryArguments> mQueryArguments;
  int32_t mResultLimit;

  bool mFinished;
  bool mCanceled;
  bool mWaitingForPrevQueryToFinish;

  nsCOMPtr<nsIMutableArray> mServerSearchControls;
  nsCOMPtr<nsIMutableArray> mClientSearchControls;
};


NS_IMPL_ISUPPORTS1(nsAbQueryLDAPMessageListener, nsILDAPMessageListener)

nsAbQueryLDAPMessageListener::nsAbQueryLDAPMessageListener(
        nsIAbDirectoryQueryResultListener *resultListener,
        nsILDAPURL* directoryUrl,
        nsILDAPURL* searchUrl,
        nsILDAPConnection* connection,
        nsIAbDirectoryQueryArguments* queryArguments,
        nsIMutableArray* serverSearchControls,
        nsIMutableArray* clientSearchControls,
        const nsACString &login,
        const nsACString &mechanism,
        const int32_t resultLimit,
        const int32_t timeOut) :
  nsAbLDAPListenerBase(directoryUrl, connection, login, timeOut),
  mSearchUrl(searchUrl),
  mResultListener(resultListener),
  mQueryArguments(queryArguments),
  mResultLimit(resultLimit),
  mFinished(false),
  mCanceled(false),
  mWaitingForPrevQueryToFinish(false),
  mServerSearchControls(serverSearchControls),
  mClientSearchControls(clientSearchControls)
{
  mSaslMechanism.Assign(mechanism);
}

nsAbQueryLDAPMessageListener::~nsAbQueryLDAPMessageListener ()
{
}

nsresult nsAbQueryLDAPMessageListener::Cancel ()
{
    nsresult rv = Initiate();
    NS_ENSURE_SUCCESS(rv, rv);

    MutexAutoLock lock(mLock);

    if (mFinished || mCanceled)
        return NS_OK;

    mCanceled = true;
    if (!mFinished)
      mWaitingForPrevQueryToFinish = true;

    return NS_OK;
}

NS_IMETHODIMP nsAbQueryLDAPMessageListener::OnLDAPMessage(nsILDAPMessage *aMessage)
{
  nsresult rv = Initiate();
  NS_ENSURE_SUCCESS(rv, rv);

  int32_t messageType;
  rv = aMessage->GetType(&messageType);
  NS_ENSURE_SUCCESS(rv, rv);

  bool cancelOperation = false;

  // Enter lock
  {
    MutexAutoLock lock (mLock);

    if (mFinished)
      return NS_OK;

    if (messageType == nsILDAPMessage::RES_SEARCH_RESULT)
      mFinished = true;
    else if (mCanceled)
    {
      mFinished = true;
      cancelOperation = true;
    }
  }
  // Leave lock

  if (!mResultListener)
    return NS_ERROR_NULL_POINTER;

  if (!cancelOperation)
  {
    switch (messageType)
    {
    case nsILDAPMessage::RES_BIND:
      rv = OnLDAPMessageBind(aMessage);
      if (NS_FAILED(rv)) 
        // We know the bind failed and hence the message has an error, so we
        // can just call SearchResult with the message and that'll sort it out
        // for us.
        rv = OnLDAPMessageSearchResult(aMessage);
      break;
    case nsILDAPMessage::RES_SEARCH_ENTRY:
      if (!mFinished && !mWaitingForPrevQueryToFinish)
        rv = OnLDAPMessageSearchEntry(aMessage);
      break;
    case nsILDAPMessage::RES_SEARCH_RESULT:
      mWaitingForPrevQueryToFinish = false;
      rv = OnLDAPMessageSearchResult(aMessage);
      NS_ENSURE_SUCCESS(rv, rv);
    default:
      break;
    }
  }
  else
  {
    if (mOperation)
      rv = mOperation->AbandonExt();

    rv = mResultListener->OnQueryResult(
      nsIAbDirectoryQueryResultListener::queryResultStopped, 0);

    // reset because we might re-use this listener...except don't do this
    // until the search is done, so we'll ignore results from a previous
    // search.
    if (messageType == nsILDAPMessage::RES_SEARCH_RESULT)
      mCanceled = mFinished = false;
  }

  return rv;
}

nsresult nsAbQueryLDAPMessageListener::DoTask()
{
  nsresult rv;
  mCanceled = mFinished = false;

  mOperation = do_CreateInstance(NS_LDAPOPERATION_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = mOperation->Init(mConnection, this, nullptr);
  NS_ENSURE_SUCCESS(rv, rv);

  nsAutoCString dn;
  rv = mSearchUrl->GetDn(dn);
  NS_ENSURE_SUCCESS(rv, rv);

  int32_t scope;
  rv = mSearchUrl->GetScope(&scope);
  NS_ENSURE_SUCCESS(rv, rv);

  nsAutoCString filter;
  rv = mSearchUrl->GetFilter(filter);
  NS_ENSURE_SUCCESS(rv, rv);

  nsAutoCString attributes;
  rv = mSearchUrl->GetAttributes(attributes);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = mOperation->SetServerControls(mServerSearchControls);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = mOperation->SetClientControls(mClientSearchControls);
  NS_ENSURE_SUCCESS(rv, rv);

  return mOperation->SearchExt(dn, scope, filter, attributes, mTimeOut,
                               mResultLimit);
}

void nsAbQueryLDAPMessageListener::InitFailed(bool aCancelled)
{
  if (!mResultListener)
    return;

  // In the !aCancelled case we know there was an error, but we won't be
  // able to translate it, so just return an error code of zero.
  mResultListener->OnQueryResult(
      aCancelled ? nsIAbDirectoryQueryResultListener::queryResultStopped :
                   nsIAbDirectoryQueryResultListener::queryResultError, 0);
}

nsresult nsAbQueryLDAPMessageListener::OnLDAPMessageSearchEntry(nsILDAPMessage *aMessage)
{
  nsresult rv;

  if (!mResultListener)
    return NS_ERROR_NULL_POINTER;

  // the map for translating between LDAP attrs <-> addrbook fields
  nsCOMPtr<nsISupports> iSupportsMap;
  rv = mQueryArguments->GetTypeSpecificArg(getter_AddRefs(iSupportsMap));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAbLDAPAttributeMap> map = do_QueryInterface(iSupportsMap, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAbCard> card = do_CreateInstance(NS_ABLDAPCARD_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = map->SetCardPropertiesFromLDAPMessage(aMessage, card);
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsIAbLDAPCard> ldapCard = do_QueryInterface(card, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = ldapCard->SetMetaProperties(aMessage);
  NS_ENSURE_SUCCESS(rv, rv);

  return mResultListener->OnQueryFoundCard(card);
}

nsresult nsAbQueryLDAPMessageListener::OnLDAPMessageSearchResult(nsILDAPMessage *aMessage)
{
  int32_t errorCode;
  nsresult rv = aMessage->GetErrorCode(&errorCode);
  NS_ENSURE_SUCCESS(rv, rv);
    
  if (errorCode == nsILDAPErrors::SUCCESS || errorCode == nsILDAPErrors::SIZELIMIT_EXCEEDED)
    return mResultListener->OnQueryResult(
      nsIAbDirectoryQueryResultListener::queryResultComplete, 0);

  return mResultListener->OnQueryResult(
      nsIAbDirectoryQueryResultListener::queryResultError, errorCode);
}

// nsAbLDAPDirectoryQuery

NS_IMPL_ISUPPORTS2(nsAbLDAPDirectoryQuery, nsIAbDirectoryQuery,
                              nsIAbDirectoryQueryResultListener)

nsAbLDAPDirectoryQuery::nsAbLDAPDirectoryQuery() :
    mInitialized(false)
{
}

nsAbLDAPDirectoryQuery::~nsAbLDAPDirectoryQuery()
{
}

NS_IMETHODIMP nsAbLDAPDirectoryQuery::DoQuery(nsIAbDirectory *aDirectory,
  nsIAbDirectoryQueryArguments* aArguments,
  nsIAbDirSearchListener* aListener,
  int32_t aResultLimit,
  int32_t aTimeOut,
  int32_t* _retval)
{
  NS_ENSURE_ARG_POINTER(aListener);
  NS_ENSURE_ARG_POINTER(aArguments);

  mListeners.AppendObject(aListener);

  // Ensure existing query is stopped. Context id doesn't matter here
  nsresult rv = StopQuery(0);
  NS_ENSURE_SUCCESS(rv, rv);

  mInitialized = true;

  // Get the current directory as LDAP specific
  nsCOMPtr<nsIAbLDAPDirectory> directory(do_QueryInterface(aDirectory, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  
  // We also need the current URL to check as well...
  nsCOMPtr<nsILDAPURL> currentUrl;
  rv = directory->GetLDAPURL(getter_AddRefs(currentUrl));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsAutoCString login;
  rv = directory->GetAuthDn(login);
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsAutoCString saslMechanism;
  rv = directory->GetSaslMechanism(saslMechanism);
  NS_ENSURE_SUCCESS(rv, rv);
  
  uint32_t protocolVersion;
  rv = directory->GetProtocolVersion(&protocolVersion);
  NS_ENSURE_SUCCESS(rv, rv);
  
  // To do:
  // Ensure query is stopped
  // If connection params have changed re-create connection
  // else reuse existing connection
  
  bool redoConnection = false;
  
  if (!mConnection || !mDirectoryUrl)
  {
    mDirectoryUrl = currentUrl;
    aDirectory->GetUuid(mDirectoryId);
    mCurrentLogin = login;
    mCurrentMechanism = saslMechanism;
    mCurrentProtocolVersion = protocolVersion;
    redoConnection = true;
  }
  else
  {
    bool equal;
    rv = mDirectoryUrl->Equals(currentUrl, &equal);
      NS_ENSURE_SUCCESS(rv, rv);
  
    nsCString spec;
    mDirectoryUrl->GetSpec(spec);
    currentUrl->GetSpec(spec);

    if (!equal)
    {
      mDirectoryUrl = currentUrl;
      aDirectory->GetUuid(mDirectoryId);
      mCurrentLogin = login;
      mCurrentMechanism = saslMechanism;
      mCurrentProtocolVersion = protocolVersion;
      redoConnection = true;
    }
    else
    {
      // Has login or version changed?
      if (login != mCurrentLogin ||
          saslMechanism != mCurrentMechanism ||
          protocolVersion != mCurrentProtocolVersion)
      {
        redoConnection = true;
        mCurrentLogin = login;
        mCurrentMechanism = saslMechanism;
        mCurrentProtocolVersion = protocolVersion;
      }
    }
  }

  nsCOMPtr<nsIURI> uri;
  rv = mDirectoryUrl->Clone(getter_AddRefs(uri));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsILDAPURL> url(do_QueryInterface(uri, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  // Get/Set the return attributes
  nsCOMPtr<nsISupports> iSupportsMap;
  rv = aArguments->GetTypeSpecificArg(getter_AddRefs(iSupportsMap));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAbLDAPAttributeMap> map = do_QueryInterface(iSupportsMap, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  // Require all attributes that are mapped to card properties
  nsAutoCString returnAttributes;
  rv = map->GetAllCardAttributes(returnAttributes);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = url->SetAttributes(returnAttributes);
  // Now do the error check
  NS_ENSURE_SUCCESS(rv, rv);

  // Also require the objectClass attribute, it is used by
  // nsAbLDAPCard::SetMetaProperties
  rv = url->AddAttribute(NS_LITERAL_CSTRING("objectClass"));

  nsAutoCString filter;

  // Get filter from arguments if set:
  rv = aArguments->GetFilter(filter);
  NS_ENSURE_SUCCESS(rv, rv);
  
  if (filter.IsEmpty()) {
    // Get the filter
    nsCOMPtr<nsISupports> supportsExpression;
    rv = aArguments->GetExpression(getter_AddRefs(supportsExpression));
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIAbBooleanExpression> expression(do_QueryInterface(supportsExpression, &rv));

    // figure out how we map attribute names to addressbook fields for this
    // query
    rv = nsAbBoolExprToLDAPFilter::Convert(map, expression, filter);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  /*
   * Mozilla itself cannot arrive here with a blank filter
   * as the nsAbLDAPDirectory::StartSearch() disallows it.
   * But 3rd party LDAP query integration with Mozilla begins 
   * in this method.
   *
   * Default the filter string if blank, otherwise it gets
   * set to (objectclass=*) which returns everything. Set 
   * the default to (objectclass=inetorgperson) as this 
   * is the most appropriate default objectclass which is 
   * central to the makeup of the mozilla ldap address book 
   * entries.
   */
  if (filter.IsEmpty())
  {
    filter.AssignLiteral("(objectclass=inetorgperson)");
  }

  // get the directoryFilter from the directory url and merge it with the user's
  // search filter
  nsAutoCString urlFilter;
  rv = mDirectoryUrl->GetFilter(urlFilter);
  
  // if urlFilter is unset (or set to the default "objectclass=*"), there's
  // no need to AND in an empty search term, so leave prefix and suffix empty
  
  nsAutoCString searchFilter;
  if (urlFilter.Length() && !urlFilter.EqualsLiteral("(objectclass=*)"))
  {
    // if urlFilter isn't parenthesized, we need to add in parens so that
    // the filter works as a term to &
    //
    if (urlFilter[0] != '(')
    {
      searchFilter = NS_LITERAL_CSTRING("(&(");
      searchFilter.Append(urlFilter);
      searchFilter.AppendLiteral(")");
    }
    else
    {
      searchFilter = NS_LITERAL_CSTRING("(&");
      searchFilter.Append(urlFilter);
    }
  
    searchFilter += filter;
    searchFilter += ')';
  } 
  else
    searchFilter = filter;

  rv = url->SetFilter(searchFilter);
  NS_ENSURE_SUCCESS(rv, rv);

  // Now formulate the search string
  
  // Get the scope
  int32_t scope;
  bool doSubDirectories;
  rv = aArguments->GetQuerySubDirectories (&doSubDirectories);
  NS_ENSURE_SUCCESS(rv, rv);
  scope = doSubDirectories ? nsILDAPURL::SCOPE_SUBTREE :
                             nsILDAPURL::SCOPE_ONELEVEL;

  rv = url->SetScope(scope);
  NS_ENSURE_SUCCESS(rv, rv);

  // too soon? Do we need a new listener?
  // If we already have a connection, and don't need to re-do it, give it the
  // new search details and go for it...
  if (!redoConnection)
  {
    nsAbQueryLDAPMessageListener *msgListener = 
      static_cast<nsAbQueryLDAPMessageListener *>(static_cast<nsILDAPMessageListener *>(mListener.get()));
    if (msgListener)
    {
      // Ensure the urls are correct
      msgListener->mDirectoryUrl = mDirectoryUrl;
      msgListener->mSearchUrl = url;
      // Also ensure we set the correct result limit
      msgListener->mResultLimit = aResultLimit;
      return msgListener->DoTask();
    }
  }
  
  nsCOMPtr<nsIAbLDAPDirectory> abLDAPDir = do_QueryInterface(aDirectory, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIMutableArray> serverSearchControls;
  rv = abLDAPDir->GetSearchServerControls(getter_AddRefs(serverSearchControls));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIMutableArray> clientSearchControls;
  rv = abLDAPDir->GetSearchClientControls(getter_AddRefs(clientSearchControls));
  NS_ENSURE_SUCCESS(rv, rv);

  // Create the new connection (which cause the old one to be dropped if necessary)
  mConnection = do_CreateInstance(NS_LDAPCONNECTION_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAbDirectoryQueryResultListener> resultListener =
    do_QueryInterface((nsIAbDirectoryQuery*)this, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  // Initiate LDAP message listener
  nsAbQueryLDAPMessageListener* _messageListener =
    new nsAbQueryLDAPMessageListener(resultListener, mDirectoryUrl, url,
                                     mConnection, aArguments,
                                     serverSearchControls, clientSearchControls,
                                     mCurrentLogin, mCurrentMechanism,
                                     aResultLimit, aTimeOut);
  if (_messageListener == NULL)
    return NS_ERROR_OUT_OF_MEMORY;
  
  mListener = _messageListener;
  *_retval = 1;

  // Now lets initialize the LDAP connection properly. We'll kick
  // off the bind operation in the callback function, |OnLDAPInit()|.
  rv = mConnection->Init(mDirectoryUrl, mCurrentLogin,
                         mListener, nullptr, mCurrentProtocolVersion);
  NS_ENSURE_SUCCESS(rv, rv);

  return rv;
}

/* void stopQuery (in long contextID); */
NS_IMETHODIMP nsAbLDAPDirectoryQuery::StopQuery(int32_t contextID)
{
  mInitialized = true;

  if (!mListener)
    return NS_OK;

  nsAbQueryLDAPMessageListener *listener = 
    static_cast<nsAbQueryLDAPMessageListener *>(static_cast<nsILDAPMessageListener *>(mListener.get()));
  if (listener)
    return listener->Cancel();

  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPDirectoryQuery::OnQueryFoundCard(nsIAbCard *aCard)
{
  aCard->SetDirectoryId(mDirectoryId);

  for (int32_t i = 0; i < mListeners.Count(); ++i)
    mListeners[i]->OnSearchFoundCard(aCard);

  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPDirectoryQuery::OnQueryResult(int32_t aResult,
                                                    int32_t aErrorCode)
{
  uint32_t count = mListeners.Count();

  // XXX: Temporary fix for crasher needs reviewing as part of bug 135231.
  // Temporarily add a reference to ourselves, in case the only thing
  // keeping us alive is the link with the listener.
  NS_ADDREF_THIS();

  for (int32_t i = count - 1; i >= 0; --i)
  {
    mListeners[i]->OnSearchFinished(aResult, EmptyString());
    mListeners.RemoveObjectAt(i);
  }

  NS_RELEASE_THIS();

  return NS_OK;
}
