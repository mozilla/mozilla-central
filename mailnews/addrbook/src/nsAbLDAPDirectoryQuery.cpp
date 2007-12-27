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
 * Sun Microsystems, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2001
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Seth Spitzer <sspitzer@netscape.com>
 *   Dan Mosedale <dmose@netscape.com>
 *   Paul Sandoz <paul.sandoz@sun.com>
 *   Mark Banner <bugzilla@standard8.plus.com>
 *   Jeremy Laine <jeremy.laine@m4x.org>
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
#include "nsAutoLock.h"
#include "nsIProxyObjectManager.h"
#include "prprf.h"
#include "nsServiceManagerUtils.h"
#include "nsComponentManagerUtils.h"
#include "nsCategoryManagerUtils.h"
#include "nsAbLDAPDirectory.h"
#include "nsAbLDAPListenerBase.h"
#include "nsXPCOMCIDInternal.h"

// nsAbLDAPListenerBase inherits nsILDAPMessageListener
class nsAbQueryLDAPMessageListener : public nsAbLDAPListenerBase
{
public:
  NS_DECL_ISUPPORTS

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
                               const PRInt32 resultLimit = -1,
                               const PRInt32 timeOut = 0);
  virtual ~nsAbQueryLDAPMessageListener ();

  // nsILDAPMessageListener
  NS_IMETHOD OnLDAPMessage(nsILDAPMessage *aMessage);

protected:
  nsresult OnLDAPMessageSearchEntry(nsILDAPMessage *aMessage);
  nsresult OnLDAPMessageSearchResult(nsILDAPMessage *aMessage);

  friend class nsAbLDAPDirectoryQuery;

  nsresult Cancel();
  virtual nsresult DoTask();
  virtual void InitFailed(PRBool aCancelled = PR_FALSE);

  nsCOMPtr<nsILDAPURL> mSearchUrl;
  nsIAbDirectoryQueryResultListener *mResultListener;
  PRInt32 mContextID;
  nsCOMPtr<nsIAbDirectoryQueryArguments> mQueryArguments;
  PRInt32 mResultLimit;

  PRBool mFinished;
  PRBool mCanceled;
  PRBool mWaitingForPrevQueryToFinish;

  nsCOMPtr<nsIMutableArray> mServerSearchControls;
  nsCOMPtr<nsIMutableArray> mClientSearchControls;
};


NS_IMPL_THREADSAFE_ISUPPORTS1(nsAbQueryLDAPMessageListener, nsILDAPMessageListener)

nsAbQueryLDAPMessageListener::nsAbQueryLDAPMessageListener(
        nsIAbDirectoryQueryResultListener *resultListener,
        nsILDAPURL* directoryUrl,
        nsILDAPURL* searchUrl,
        nsILDAPConnection* connection,
        nsIAbDirectoryQueryArguments* queryArguments,
        nsIMutableArray* serverSearchControls,
        nsIMutableArray* clientSearchControls,
        const nsACString &login,
        const PRInt32 resultLimit,
        const PRInt32 timeOut) :
  nsAbLDAPListenerBase(directoryUrl, connection, login, timeOut),
  mSearchUrl(searchUrl),
  mResultListener(resultListener),
  mQueryArguments(queryArguments),
  mResultLimit(resultLimit),
  mFinished(PR_FALSE),
  mCanceled(PR_FALSE),
  mWaitingForPrevQueryToFinish(PR_FALSE),
  mServerSearchControls(serverSearchControls),
  mClientSearchControls(clientSearchControls)
{
}

nsAbQueryLDAPMessageListener::~nsAbQueryLDAPMessageListener ()
{
}

nsresult nsAbQueryLDAPMessageListener::Cancel ()
{
    nsresult rv = Initiate();
    NS_ENSURE_SUCCESS(rv, rv);

    nsAutoLock lock(mLock);

    if (mFinished || mCanceled)
        return NS_OK;

    mCanceled = PR_TRUE;
    if (!mFinished)
      mWaitingForPrevQueryToFinish = PR_TRUE;

    return NS_OK;
}

NS_IMETHODIMP nsAbQueryLDAPMessageListener::OnLDAPMessage(nsILDAPMessage *aMessage)
{
  nsresult rv = Initiate();
  NS_ENSURE_SUCCESS(rv, rv);

  PRInt32 messageType;
  rv = aMessage->GetType(&messageType);
  NS_ENSURE_SUCCESS(rv, rv);

  PRBool cancelOperation = PR_FALSE;

  // Enter lock
  {
    nsAutoLock lock (mLock);

    if (mFinished)
      return NS_OK;

    if (messageType == nsILDAPMessage::RES_SEARCH_RESULT)
      mFinished = PR_TRUE;
    else if (mCanceled)
    {
      mFinished = PR_TRUE;
      cancelOperation = PR_TRUE;
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
      mWaitingForPrevQueryToFinish = PR_FALSE;
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
      mCanceled = mFinished = PR_FALSE;
  }

  return rv;
}

nsresult nsAbQueryLDAPMessageListener::DoTask()
{
  nsresult rv;
  mCanceled = mFinished = PR_FALSE;

  mOperation = do_CreateInstance(NS_LDAPOPERATION_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIProxyObjectManager> proxyObjMgr = do_GetService(NS_XPCOMPROXY_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsILDAPMessageListener> proxyListener;
  rv = proxyObjMgr->GetProxyForObject(NS_PROXY_TO_MAIN_THREAD,
                            NS_GET_IID(nsILDAPMessageListener),
                            this, NS_PROXY_SYNC | NS_PROXY_ALWAYS,
                            getter_AddRefs(proxyListener));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = mOperation->Init(mConnection, proxyListener, nsnull);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCAutoString dn;
  rv = mSearchUrl->GetDn(dn);
  NS_ENSURE_SUCCESS(rv, rv);

  PRInt32 scope;
  rv = mSearchUrl->GetScope(&scope);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCAutoString filter;
  rv = mSearchUrl->GetFilter(filter);
  NS_ENSURE_SUCCESS(rv, rv);

  CharPtrArrayGuard attributes;
  rv = mSearchUrl->GetAttributes(attributes.GetSizeAddr(),
                                 attributes.GetArrayAddr());
  NS_ENSURE_SUCCESS(rv, rv);

  rv = mOperation->SetServerControls(mServerSearchControls);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = mOperation->SetClientControls(mClientSearchControls);
  NS_ENSURE_SUCCESS(rv, rv);

  return mOperation->SearchExt(dn, scope, filter, attributes.GetSize(),
                               attributes.GetArray(), mTimeOut,
                               mResultLimit);
}

void nsAbQueryLDAPMessageListener::InitFailed(PRBool aCancelled)
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
  PRInt32 errorCode;
  nsresult rv = aMessage->GetErrorCode(&errorCode);
  NS_ENSURE_SUCCESS(rv, rv);
    
  if (errorCode == nsILDAPErrors::SUCCESS || errorCode == nsILDAPErrors::SIZELIMIT_EXCEEDED)
    return mResultListener->OnQueryResult(
      nsIAbDirectoryQueryResultListener::queryResultComplete, 0);

  return mResultListener->OnQueryResult(
      nsIAbDirectoryQueryResultListener::queryResultError, errorCode);
}

// nsAbLDAPDirectoryQuery

NS_IMPL_THREADSAFE_ISUPPORTS2(nsAbLDAPDirectoryQuery, nsIAbDirectoryQuery,
                              nsIAbDirectoryQueryResultListener)

nsAbLDAPDirectoryQuery::nsAbLDAPDirectoryQuery() :
    mInitialized(PR_FALSE)
{
}

nsAbLDAPDirectoryQuery::~nsAbLDAPDirectoryQuery()
{
}

NS_IMETHODIMP nsAbLDAPDirectoryQuery::DoQuery(nsIAbDirectory *aDirectory,
  nsIAbDirectoryQueryArguments* aArguments,
  nsIAbDirSearchListener* aListener,
  PRInt32 aResultLimit,
  PRInt32 aTimeOut,
  PRInt32* _retval)
{
  NS_ENSURE_ARG_POINTER(aListener);
  NS_ENSURE_ARG_POINTER(aArguments);

  mListeners.AppendObject(aListener);

  // Ensure existing query is stopped. Context id doesn't matter here
  nsresult rv = StopQuery(0);
  NS_ENSURE_SUCCESS(rv, rv);

  mInitialized = PR_TRUE;

  // Get the current directory as LDAP specific
  nsCOMPtr<nsIAbLDAPDirectory> directory(do_QueryInterface(aDirectory, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  
  // We also need the current URL to check as well...
  nsCOMPtr<nsILDAPURL> currentUrl;
  rv = directory->GetLDAPURL(getter_AddRefs(currentUrl));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCAutoString login;
  rv = directory->GetAuthDn(login);
  NS_ENSURE_SUCCESS(rv, rv);
  
  PRUint32 protocolVersion;
  rv = directory->GetProtocolVersion(&protocolVersion);
  NS_ENSURE_SUCCESS(rv, rv);
  
  // To do:
  // Ensure query is stopped
  // If connection params have changed re-create connection
  // else reuse existing connection
  
  PRBool redoConnection = PR_FALSE;
  
  if (!mConnection || !mDirectoryUrl)
  {
    mDirectoryUrl = currentUrl;
    mCurrentLogin = login;
    mCurrentProtocolVersion = protocolVersion;
    redoConnection = PR_TRUE;
  }
  else
  {
    PRBool equal;
    rv = mDirectoryUrl->Equals(currentUrl, &equal);
      NS_ENSURE_SUCCESS(rv, rv);
  
    nsCString spec;
    mDirectoryUrl->GetSpec(spec);
    currentUrl->GetSpec(spec);

    if (!equal)
    {
      mDirectoryUrl = currentUrl;
      mCurrentLogin = login;
      mCurrentProtocolVersion = protocolVersion;
      redoConnection = PR_TRUE;
    }
    else
    {
      // Has login or version changed?
      if (login != mCurrentLogin || protocolVersion != mCurrentProtocolVersion)
      {
        redoConnection = PR_TRUE;
        mCurrentLogin = login;
        mCurrentProtocolVersion = protocolVersion;
      }
    }
  }
  
  // Now formulate the search string
  
  // Get the scope
  nsCAutoString scope;
  PRBool doSubDirectories;
  rv = aArguments->GetQuerySubDirectories (&doSubDirectories);
  NS_ENSURE_SUCCESS(rv, rv);
  scope = (doSubDirectories) ? "sub" : "one";

  // Get the return attributes
  nsCOMPtr<nsISupports> iSupportsMap;
  rv = aArguments->GetTypeSpecificArg(getter_AddRefs(iSupportsMap));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAbLDAPAttributeMap> map = do_QueryInterface(iSupportsMap, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  // Require all attributes that are mapped to card properties
  nsCAutoString returnAttributes;
  rv = map->GetAllCardAttributes(returnAttributes);
  NS_ASSERTION(NS_SUCCEEDED(rv), "GetAllCardAttributes failed");

  // Also require the objectClass attribute, it is used by
  // nsAbLDAPCard::SetMetaProperties
  returnAttributes.AppendLiteral(",objectClass");

  // Get the filter
  nsCOMPtr<nsISupports> supportsExpression;
  rv = aArguments->GetExpression (getter_AddRefs (supportsExpression));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsIAbBooleanExpression> expression (do_QueryInterface (supportsExpression, &rv));
  nsCAutoString filter;
  
  // figure out how we map attribute names to addressbook fields for this
  // query
  rv = nsAbBoolExprToLDAPFilter::Convert(map, expression, filter);
  NS_ENSURE_SUCCESS(rv, rv);

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
  if(filter.IsEmpty())
  {
    filter.AssignLiteral("(objectclass=inetorgperson)");
  }
  
  nsCAutoString host;
  rv = mDirectoryUrl->GetAsciiHost(host);
  NS_ENSURE_SUCCESS(rv, rv);
  
  PRInt32 port;
  rv = mDirectoryUrl->GetPort(&port);
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCAutoString dn;
  rv = mDirectoryUrl->GetDn(dn);
  NS_ENSURE_SUCCESS(rv, rv);
  
  PRUint32 options;
  rv = mDirectoryUrl->GetOptions(&options);
  NS_ENSURE_SUCCESS(rv, rv);
  
  // get the directoryFilter from the directory url and merge it with the user's
  // search filter
  nsCAutoString urlFilter;
  rv = mDirectoryUrl->GetFilter(urlFilter);
  
  // if urlFilter is unset (or set to the default "objectclass=*"), there's
  // no need to AND in an empty search term, so leave prefix and suffix empty
  
  nsCAutoString searchFilter;
  if (urlFilter.Length() && !urlFilter.Equals(NS_LITERAL_CSTRING("(objectclass=*)"))) 
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

  nsCString ldapSearchUrlString;
  char* _ldapSearchUrlString = 
    PR_smprintf("ldap%s://%s:%d/%s?%s?%s?%s",
                (options & nsILDAPURL::OPT_SECURE) ? "s" : "",
                host.get(),
                port,
                dn.get(),
                returnAttributes.get(),
                scope.get(),
                searchFilter.get());

  if (!_ldapSearchUrlString)
    return NS_ERROR_OUT_OF_MEMORY;

  ldapSearchUrlString = _ldapSearchUrlString;
  PR_smprintf_free(_ldapSearchUrlString);

  nsCOMPtr<nsILDAPURL> url;
  url = do_CreateInstance(NS_LDAPURL_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = url->SetSpec(ldapSearchUrlString);
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
                                     mCurrentLogin, aResultLimit, aTimeOut);
  if (_messageListener == NULL)
    return NS_ERROR_OUT_OF_MEMORY;
  
  mListener = _messageListener;
  *_retval = 1;

  // Now lets initialize the LDAP connection properly. We'll kick
  // off the bind operation in the callback function, |OnLDAPInit()|.
  rv = mConnection->Init(mDirectoryUrl, mCurrentLogin,
                         mListener, nsnull, mCurrentProtocolVersion);
  NS_ENSURE_SUCCESS(rv, rv);

  return rv;
}

/* void stopQuery (in long contextID); */
NS_IMETHODIMP nsAbLDAPDirectoryQuery::StopQuery(PRInt32 contextID)
{
  mInitialized = PR_TRUE;

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
  for (PRInt32 i = 0; i < mListeners.Count(); ++i)
    mListeners[i]->OnSearchFoundCard(aCard);

  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPDirectoryQuery::OnQueryResult(PRInt32 aResult,
                                                    PRInt32 aErrorCode)
{
  PRUint32 count = mListeners.Count();

  // XXX: Temporary fix for crasher needs reviewing as part of bug 135231.
  // Temporarily add a reference to ourselves, in case the only thing
  // keeping us alive is the link with the listener.
  NS_ADDREF_THIS();

  for (PRInt32 i = count - 1; i >= 0; --i)
  {
    mListeners[i]->OnSearchFinished(aResult, EmptyString());
    mListeners.RemoveObjectAt(i);
  }

  NS_RELEASE_THIS();

  return NS_OK;
}
