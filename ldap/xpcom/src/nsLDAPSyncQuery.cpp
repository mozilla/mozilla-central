/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsLDAPSyncQuery.h"
#include "nsIServiceManager.h"
#include "nsILDAPErrors.h"
#include "nsThreadUtils.h"
#include "nsILDAPMessage.h"
#include "nsComponentManagerUtils.h"
#include "nsServiceManagerUtils.h"
#include "nsMemory.h"

// nsISupports Implementation

NS_IMPL_ISUPPORTS2(nsLDAPSyncQuery, nsILDAPSyncQuery, nsILDAPMessageListener)

// Constructor
//
nsLDAPSyncQuery::nsLDAPSyncQuery() :
    mFinished(false), // This is a control variable for event loop
    mProtocolVersion(nsILDAPConnection::VERSION3)
{
}

// Destructor
//
nsLDAPSyncQuery::~nsLDAPSyncQuery()
{
}


// Messages received are passed back via this function.
// void OnLDAPMessage (in nsILDAPMessage aMessage) 
//
NS_IMETHODIMP 
nsLDAPSyncQuery::OnLDAPMessage(nsILDAPMessage *aMessage)
{
    int32_t messageType;

    // just in case.
    //
    if (!aMessage) {
        return NS_OK;
    }

    // figure out what sort of message was returned
    //
    nsresult rv = aMessage->GetType(&messageType);
    if (NS_FAILED(rv)) {
        NS_ERROR("nsLDAPSyncQuery::OnLDAPMessage(): unexpected "
                 "error in aMessage->GetType()");
        FinishLDAPQuery();
        return NS_ERROR_UNEXPECTED;
    }

    switch (messageType) {

    case nsILDAPMessage::RES_BIND:

        // a bind has completed
        //
        return OnLDAPBind(aMessage);

    case nsILDAPMessage::RES_SEARCH_ENTRY:
        
        // a search entry has been returned
        //
        return OnLDAPSearchEntry(aMessage);

    case nsILDAPMessage::RES_SEARCH_RESULT:

        // the search is finished; we're all done
        //  
        return OnLDAPSearchResult(aMessage);

    default:
        
        // Given the LDAP operations nsLDAPSyncQuery uses, we should
        // never get here.  If we do get here in a release build, it's
        // probably a bug, but maybe it's the LDAP server doing something
        // weird.  Might as well try and continue anyway.  The session should
        // eventually get reaped by the timeout code, if necessary.
        //
        NS_ERROR("nsLDAPSyncQuery::OnLDAPMessage(): unexpected "
                 "LDAP message received");
        return NS_OK;
    }
}

// void onLDAPInit (in nsresult aStatus);
//
NS_IMETHODIMP
nsLDAPSyncQuery::OnLDAPInit(nsILDAPConnection *aConn, nsresult aStatus)
{
    nsresult rv;        // temp for xpcom return values
    // create and initialize an LDAP operation (to be used for the bind)
    //  
    mOperation = do_CreateInstance("@mozilla.org/network/ldap-operation;1", 
                                   &rv);
    if (NS_FAILED(rv)) {
        FinishLDAPQuery();
        return NS_ERROR_FAILURE;
    }

    // our OnLDAPMessage accepts all result callbacks
    //
    rv = mOperation->Init(mConnection, this, nullptr);
    if (NS_FAILED(rv)) {
        FinishLDAPQuery();
        return NS_ERROR_UNEXPECTED; // this should never happen
    }

    // kick off a bind operation 
    // 
    rv = mOperation->SimpleBind(EmptyCString()); 
    if (NS_FAILED(rv)) {
        FinishLDAPQuery();
        return NS_ERROR_FAILURE;
    }
    
    return NS_OK;
}

nsresult
nsLDAPSyncQuery::OnLDAPBind(nsILDAPMessage *aMessage)
{

    int32_t errCode;

    mOperation = 0;  // done with bind op; make nsCOMPtr release it

    // get the status of the bind
    //
    nsresult rv = aMessage->GetErrorCode(&errCode);
    if (NS_FAILED(rv)) {
        
        NS_ERROR("nsLDAPSyncQuery::OnLDAPBind(): couldn't get "
                 "error code from aMessage");
        FinishLDAPQuery();
        return NS_ERROR_FAILURE;
    }


    // check to be sure the bind succeeded
    //
    if (errCode != nsILDAPErrors::SUCCESS) {
        FinishLDAPQuery();
        return NS_ERROR_FAILURE;
    }

    // ok, we're starting a search
    //
    return StartLDAPSearch();
}

nsresult
nsLDAPSyncQuery::OnLDAPSearchEntry(nsILDAPMessage *aMessage)
{
  uint32_t attrCount;
  char** attributes;
  nsresult rv = aMessage->GetAttributes(&attrCount, &attributes);
  if (NS_FAILED(rv))
  {
    NS_WARNING("nsLDAPSyncQuery:OnLDAPSearchEntry(): "
               "aMessage->GetAttributes() failed");
    FinishLDAPQuery();
    return rv;
  }

  // Iterate through the attributes received in this message
  for (uint32_t i = 0; i < attrCount; i++)
  {
    PRUnichar **vals;
    uint32_t valueCount;

    // Get the values of this attribute.
    // XXX better failure handling
    rv = aMessage->GetValues(attributes[i], &valueCount, &vals);
    if (NS_FAILED(rv))
    {
      NS_WARNING("nsLDAPSyncQuery:OnLDAPSearchEntry(): "
                 "aMessage->GetValues() failed\n");
      FinishLDAPQuery();
      break;
    }

    // Store all values of this attribute in the mResults.
    for (uint32_t j = 0; j < valueCount; j++) {
      mResults.Append(PRUnichar('\n'));
      mResults.AppendASCII(attributes[i]);
      mResults.Append(PRUnichar('='));
      mResults.Append(vals[j]);
    }

    NS_FREE_XPCOM_ALLOCATED_POINTER_ARRAY(valueCount, vals);
  }
  NS_FREE_XPCOM_ALLOCATED_POINTER_ARRAY(attrCount, attributes);

  return rv;
}


nsresult
nsLDAPSyncQuery::OnLDAPSearchResult(nsILDAPMessage *aMessage)
{
    // We are done with the LDAP search.
    // Release the control variable for the eventloop and other members
    // 
    FinishLDAPQuery();
    return NS_OK;
}

nsresult
nsLDAPSyncQuery::StartLDAPSearch()
{
    nsresult rv;
    // create and initialize an LDAP operation (to be used for the search
    //  
    mOperation = 
        do_CreateInstance("@mozilla.org/network/ldap-operation;1", &rv);

    if (NS_FAILED(rv)) {
        NS_ERROR("nsLDAPSyncQuery::StartLDAPSearch(): couldn't "
                 "create @mozilla.org/network/ldap-operation;1");
        FinishLDAPQuery();
        return NS_ERROR_FAILURE;
    }

    // initialize the LDAP operation object
    //
    rv = mOperation->Init(mConnection, this, nullptr);
    if (NS_FAILED(rv)) {
        NS_ERROR("nsLDAPSyncQuery::StartLDAPSearch(): couldn't "
                 "initialize LDAP operation");
        FinishLDAPQuery();
        return NS_ERROR_UNEXPECTED;
    }

    // get the search filter associated with the directory server url; 
    //
    nsAutoCString urlFilter;
    rv = mServerURL->GetFilter(urlFilter);
    if (NS_FAILED(rv)) {
        FinishLDAPQuery();
        return NS_ERROR_UNEXPECTED;
    }

    // get the base dn to search
    //
    nsAutoCString dn;
    rv = mServerURL->GetDn(dn);
    if (NS_FAILED(rv)) {
        FinishLDAPQuery();
        return NS_ERROR_UNEXPECTED;
    }

    // and the scope
    //
    int32_t scope;
    rv = mServerURL->GetScope(&scope);
    if (NS_FAILED(rv)) {
        FinishLDAPQuery();
        return NS_ERROR_UNEXPECTED;
    }

    nsAutoCString attributes;
    rv = mServerURL->GetAttributes(attributes);
    if (NS_FAILED(rv)) {
        FinishLDAPQuery();
        return NS_ERROR_UNEXPECTED;
    }

    // time to kick off the search.
    rv = mOperation->SearchExt(dn, scope, urlFilter, attributes, 0, 0);

    if (NS_FAILED(rv)) {
        FinishLDAPQuery();
        return NS_ERROR_FAILURE;
    }

    return NS_OK;
}

// void initConnection (); 
//
nsresult nsLDAPSyncQuery::InitConnection()
{
    // Because mConnection->Init proxies back to the main thread, this
    // better be the main thread.
    NS_ENSURE_TRUE(NS_IsMainThread(), NS_ERROR_FAILURE);
    nsresult rv;        // temp for xpcom return values
    // create an LDAP connection
    //
    mConnection = do_CreateInstance("@mozilla.org/network/ldap-connection;1",
                                    &rv);
    if (NS_FAILED(rv)) {
        NS_ERROR("nsLDAPSyncQuery::InitConnection(): could "
                 "not create @mozilla.org/network/ldap-connection;1");
        FinishLDAPQuery();
        return NS_ERROR_FAILURE;
    }

    // have we been properly initialized?
    //
    if (!mServerURL) {
        NS_ERROR("nsLDAPSyncQuery::InitConnection(): mServerURL "
                 "is NULL");
        FinishLDAPQuery();
        return NS_ERROR_NOT_INITIALIZED;
    }
    rv = mConnection->Init(mServerURL, EmptyCString(), this,
                           nullptr, mProtocolVersion);
    if (NS_FAILED(rv)) {
        FinishLDAPQuery();
        return NS_ERROR_UNEXPECTED; // this should never happen
    }

    return NS_OK;
}

void
nsLDAPSyncQuery::FinishLDAPQuery()
{
    // We are done with the LDAP operation. 
    // Release the Control variable for the eventloop
    //
    mFinished = true;
    
    // Release member variables
    //
    mConnection = 0;
    mOperation = 0;
    mServerURL = 0;
 
}

/* wstring getQueryResults (in nsILDAPURL aServerURL, in unsigned long aVersion); */
NS_IMETHODIMP nsLDAPSyncQuery::GetQueryResults(nsILDAPURL *aServerURL,
                                               uint32_t aProtocolVersion,
                                               PRUnichar **_retval)
{
    nsresult rv;
    
    if (!aServerURL) {
        NS_ERROR("nsLDAPSyncQuery::GetQueryResults() called without LDAP URL");
        return NS_ERROR_FAILURE;
    }
    mServerURL = aServerURL;
    mProtocolVersion = aProtocolVersion;

    nsCOMPtr<nsIThread> currentThread = do_GetCurrentThread();

    // Start an LDAP query. 
    // InitConnection will bind to the ldap server and post a OnLDAPMessage 
    // event. This event will trigger a search and the whole operation will 
    // be carried out by chain of events
    //
    rv = InitConnection();
    if (NS_FAILED(rv))
        return rv;
    
    // We want this LDAP query to be synchronous while the XPCOM LDAP is 
    // async in nature. So this eventQueue handling will wait for the 
    // LDAP operation to be finished. 
    // mFinished controls the state of the LDAP opertion. 
    // It will be released in any case (success/failure)
    
    
    // Run the event loop, 
    // mFinished is a control variable
    //
    while (!mFinished)
        NS_ENSURE_STATE(NS_ProcessNextEvent(currentThread));

    // Return results
    //
    if (!mResults.IsEmpty()) {
        *_retval = ToNewUnicode(mResults);
        if (!_retval)
          rv = NS_ERROR_OUT_OF_MEMORY;
    }
    return rv;

}
