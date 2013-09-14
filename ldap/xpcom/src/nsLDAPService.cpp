/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * 
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsLDAPInternal.h"
#include "nsLDAPService.h"
#include "nsLDAPConnection.h"
#include "nsLDAPOperation.h"
#include "nsIServiceManager.h"
#include "nsIConsoleService.h"
#include "nsILDAPURL.h"
#include "nsMemory.h"
#include "nsILDAPErrors.h"
#include "nsComponentManagerUtils.h"
#include "nsServiceManagerUtils.h"

using namespace mozilla;

// Constants for CIDs used here.
//
static NS_DEFINE_CID(kLDAPConnectionCID, NS_LDAPCONNECTION_CID);
static NS_DEFINE_CID(kLDAPOperationCID, NS_LDAPOPERATION_CID);

// First we provide all the methods for the "local" class
// nsLDAPServiceEntry.
//

// constructor
//
nsLDAPServiceEntry::nsLDAPServiceEntry()
    : mLeases(0),
      mTimestamp(0),
      mDelete(false),
      mRebinding(false)

{
}

// Init function
//
bool nsLDAPServiceEntry::Init()
{
    return true;
}

// Set/Get the timestamp when this server was last used. We might have
// to use an "interval" here instead, see Bug #76887.
//
PRTime nsLDAPServiceEntry::GetTimestamp()
{
    return mTimestamp;
}
void nsLDAPServiceEntry::SetTimestamp()
{
    mTimestamp = PR_Now();
}


// Increment, decrement and Get the leases. This code might go away
// with bug #75954.
//
void nsLDAPServiceEntry::IncrementLeases()
{
    mLeases++;
}
bool nsLDAPServiceEntry::DecrementLeases()
{
    if (!mLeases) {
        return false;
    }
    mLeases--;

    return true;
}
uint32_t nsLDAPServiceEntry::GetLeases()
{
    return mLeases;
}

// Get/Set the nsLDAPServer object for this entry.
//
already_AddRefed<nsILDAPServer> nsLDAPServiceEntry::GetServer()
{
    nsCOMPtr<nsILDAPServer> server = mServer;
    return server.forget();
}
bool nsLDAPServiceEntry::SetServer(nsILDAPServer *aServer)
{
    if (!aServer) {
        return false;
    }
    mServer = aServer;

    return true;
}

// Get/Set/Clear the nsLDAPConnection object for this entry.
//
already_AddRefed<nsILDAPConnection> nsLDAPServiceEntry::GetConnection()
{
    nsCOMPtr<nsILDAPConnection> conn = mConnection;
    return conn.forget();
}
void nsLDAPServiceEntry::SetConnection(nsILDAPConnection *aConnection)
{
    mConnection = aConnection;
}

// Get/Set the nsLDAPMessage object for this entry (it's a "cache").
//
already_AddRefed<nsILDAPMessage> nsLDAPServiceEntry::GetMessage()
{
    nsCOMPtr<nsILDAPMessage> message = mMessage;
    return message.forget();
}
void nsLDAPServiceEntry::SetMessage(nsILDAPMessage *aMessage)
{
    mMessage = aMessage;
}

// Push/Pop pending listeners/callback for this server entry. This is
// implemented as a "stack" on top of the nsCOMArray, since we can
// potentially have more than one listener waiting for the connection
// to be available for consumption.
//
already_AddRefed<nsILDAPMessageListener> nsLDAPServiceEntry::PopListener()
{
    if (mListeners.IsEmpty()) {
        return 0;
    }

    nsCOMPtr<nsILDAPMessageListener> listener = mListeners[0];
    mListeners.RemoveObjectAt(0);
    return listener.forget();
}
bool nsLDAPServiceEntry::PushListener(nsILDAPMessageListener *listener)
{
    return mListeners.AppendObject(listener);
}

// Mark this server to currently be rebinding. This is to avoid a
// race condition where multiple consumers could potentially request
// to reconnect the connection.
//
bool nsLDAPServiceEntry::IsRebinding()
{
    return mRebinding;
}
void nsLDAPServiceEntry::SetRebinding(bool aState)
{
    mRebinding = aState;
}

// Mark a service entry for deletion, this is "dead" code right now,
// see bug #75966.
//
bool nsLDAPServiceEntry::DeleteEntry()
{
    mDelete = true;

    return true;
}
// This is the end of the nsLDAPServiceEntry class


// Here begins the implementation for nsLDAPService
// 
NS_IMPL_ISUPPORTS2(nsLDAPService,
                              nsILDAPService,
                              nsILDAPMessageListener)


// constructor
//
nsLDAPService::nsLDAPService()
    : mLock("nsLDAPService.mLock")
{
}

// destructor
//
nsLDAPService::~nsLDAPService()
{
}

// Initializer
//
nsresult nsLDAPService::Init()
{
    return NS_OK;
}

// void addServer (in nsILDAPServer aServer);
NS_IMETHODIMP nsLDAPService::AddServer(nsILDAPServer *aServer)
{
    nsLDAPServiceEntry *entry;
    nsString key;
    nsresult rv;
    
    if (!aServer) {
        NS_ERROR("nsLDAPService::AddServer: null pointer ");
        return NS_ERROR_NULL_POINTER;
    }

    // Set up the hash key for the server entry
    //
    rv = aServer->GetKey(getter_Copies(key));
    if (NS_FAILED(rv)) {
        switch (rv) {
        // Only pass along errors we are aware of
        //
        case NS_ERROR_OUT_OF_MEMORY:
        case NS_ERROR_NULL_POINTER:
            return rv;

        default:
            return NS_ERROR_FAILURE;
        }
    }

    // Create the new service server entry, and add it into the hash table
    //
    entry = new nsLDAPServiceEntry;
    if (!entry) {
        NS_ERROR("nsLDAPService::AddServer: out of memory ");
        return NS_ERROR_OUT_OF_MEMORY;
    }
    if (!entry->Init()) {
        delete entry;
        NS_ERROR("nsLDAPService::AddServer: out of memory ");
        return NS_ERROR_OUT_OF_MEMORY;
    }

    if (!entry->SetServer(aServer)) {
        delete entry;
        return NS_ERROR_FAILURE;
    }

    // We increment the refcount here for the server entry, when
    // we purge a server completely from the service (TBD), we
    // need to decrement the counter as well.
    //
    {
        MutexAutoLock lock(mLock);

        if (mServers.Get(key)) {
            // Collision detected, lets just throw away this service entry
            // and keep the old one.
            //
            delete entry;
            return NS_ERROR_FAILURE;
        }
        mServers.Put(key, entry);
    }
    NS_ADDREF(aServer);

    return NS_OK;
}

// void deleteServer (in wstring aKey);
NS_IMETHODIMP nsLDAPService::DeleteServer(const PRUnichar *aKey)
{
    nsLDAPServiceEntry *entry;
    MutexAutoLock lock(mLock);
        
    // We should probably rename the key for this entry now that it's
    // "deleted", so that we can add in a new one with the same ID.
    // This is bug #77669.
    //
    mServers.Get(nsDependentString(aKey), &entry);
    if (entry) {
        if (entry->GetLeases() > 0) {
            return NS_ERROR_FAILURE;
        }
        entry->DeleteEntry();
    } else {
        // There is no Server entry for this key
        //
        return NS_ERROR_FAILURE;
    }

    return NS_OK;
}

// nsILDAPServer getServer (in wstring aKey);
NS_IMETHODIMP nsLDAPService::GetServer(const PRUnichar *aKey,
                                       nsILDAPServer **_retval)
{
    nsLDAPServiceEntry *entry;
    MutexAutoLock lock(mLock);

    if (!_retval) {
        NS_ERROR("nsLDAPService::GetServer: null pointer ");
        return NS_ERROR_NULL_POINTER;
    }

    if (!mServers.Get(nsDependentString(aKey), &entry)) {
        *_retval = 0;
        return NS_ERROR_FAILURE;
    }
    if (!(*_retval = entry->GetServer().get())) {
        return NS_ERROR_FAILURE;
    }

    return NS_OK;
}

//void requestConnection (in wstring aKey,
//                        in nsILDAPMessageListener aMessageListener);
NS_IMETHODIMP nsLDAPService::RequestConnection(const PRUnichar *aKey,
                                 nsILDAPMessageListener *aListener)
{
    nsLDAPServiceEntry *entry;
    nsCOMPtr<nsILDAPConnection> conn;
    nsCOMPtr<nsILDAPMessage> message;
    nsresult rv;

    if (!aListener) {
        NS_ERROR("nsLDAPService::RequestConection: null pointer ");
        return NS_ERROR_NULL_POINTER;
    }

    // Try to find a possibly cached connection and LDAP message.
    //
    {
        MutexAutoLock lock(mLock);

        if (!mServers.Get(nsDependentString(aKey), &entry)) {
            return NS_ERROR_FAILURE;
        }
        entry->SetTimestamp();

        conn = entry->GetConnection();
        message = entry->GetMessage();
    }

    if (conn) {
        if (message) {
            // We already have the connection, and the message, ready to
            // be used. This might be confusing, since we actually call
            // the listener before this function returns, see bug #75899.
            //
            aListener->OnLDAPMessage(message);
            return NS_OK;
        }
    } else {
        rv = EstablishConnection(entry, aListener);
        if (NS_FAILED(rv)) {
            return rv;
        }

    }

    // We got a new connection, now push the listeners on our stack,
    // until we get the LDAP message back.
    //
    {
        MutexAutoLock lock(mLock);
            
        if (!mServers.Get(nsDependentString(aKey), &entry) ||
            !entry->PushListener(static_cast<nsILDAPMessageListener *>
                                            (aListener))) {
            return NS_ERROR_FAILURE;
        }
    }

    return NS_OK;
}

// nsILDAPConnection getConnection (in wstring aKey);
NS_IMETHODIMP nsLDAPService::GetConnection(const PRUnichar *aKey,
                                           nsILDAPConnection **_retval)
{
    nsLDAPServiceEntry *entry;
    MutexAutoLock lock(mLock);

    if (!_retval) {
        NS_ERROR("nsLDAPService::GetConnection: null pointer ");
        return NS_ERROR_NULL_POINTER;
    }

    if (!mServers.Get(nsDependentString(aKey), &entry)) {
        *_retval = 0;
        return NS_ERROR_FAILURE;
    }
    entry->SetTimestamp();
    entry->IncrementLeases();
    if (!(*_retval = entry->GetConnection().get())){
        return NS_ERROR_FAILURE;
    }

    return NS_OK;
}

// void releaseConnection (in wstring aKey);
NS_IMETHODIMP nsLDAPService::ReleaseConnection(const PRUnichar *aKey)
{
    nsLDAPServiceEntry *entry;
    MutexAutoLock lock(mLock);

    if (!mServers.Get(nsDependentString(aKey), &entry)) {
        return NS_ERROR_FAILURE;
    }

    if (entry->GetLeases() > 0) {
        entry->SetTimestamp();
        entry->DecrementLeases();
    } else {
        // Releasing a non-leased connection is currently a No-Op.
        //
    }

    return NS_OK;
}

// void reconnectConnection (in wstring aKey,
//                           in nsILDAPMessageListener aMessageListener);
NS_IMETHODIMP nsLDAPService::ReconnectConnection(const PRUnichar *aKey,
                                 nsILDAPMessageListener *aListener)
{
    nsLDAPServiceEntry *entry;
    nsresult rv;

    if (!aListener) {
        NS_ERROR("nsLDAPService::ReconnectConnection: null pointer ");
        return NS_ERROR_NULL_POINTER;
    }

    {
        MutexAutoLock lock(mLock);
        
        if (!mServers.Get(nsDependentString(aKey), &entry)) {
            return NS_ERROR_FAILURE;
        }
        entry->SetTimestamp();

        if (entry->IsRebinding()) {
            if (!entry->PushListener(aListener)) {
                return NS_ERROR_FAILURE;
            }

            return NS_OK;
        }

        // Clear the old connection and message, which should get garbaged
        // collected now. We mark this as being "rebinding" now, and it
        // we be marked as finished either if there's an error condition,
        // or if the OnLDAPMessage() method gets called (i.e. bind() done).
        //
        entry->SetMessage(0);
        entry->SetConnection(0);

        // Get a new connection
        //
        entry->SetRebinding(true);
    }

    rv = EstablishConnection(entry, aListener);
    if (NS_FAILED(rv)) {
        return rv;
    }

    {
        MutexAutoLock lock(mLock);
        
        if (!entry->PushListener(static_cast<nsILDAPMessageListener *>
                                            (aListener))) {
            entry->SetRebinding(false);
            return NS_ERROR_FAILURE;
        }
    }

    return NS_OK;
}

/**
 * Messages received are passed back via this function.
 *
 * @arg aMessage  The message that was returned, 0 if none was.
 *
 * void OnLDAPMessage (in nsILDAPMessage aMessage)
 */
NS_IMETHODIMP 
nsLDAPService::OnLDAPMessage(nsILDAPMessage *aMessage)
{
    nsCOMPtr<nsILDAPOperation> operation;
    nsCOMPtr<nsILDAPConnection> connection;
    int32_t messageType;

    // XXXleif: NULL messages are supposedly allowed, but the semantics
    // are not definted (yet?). This is something to look out for...
    //


    // figure out what sort of message was returned
    //
    nsresult rv = aMessage->GetType(&messageType);
    if (NS_FAILED(rv)) {
        NS_ERROR("nsLDAPService::OnLDAPMessage(): unexpected error in "
                 "nsLDAPMessage::GetType()");
        return NS_ERROR_UNEXPECTED;
    }

    switch (messageType) {
    case LDAP_RES_BIND:
        // a bind has completed
        //
        rv = aMessage->GetOperation(getter_AddRefs(operation));
        if (NS_FAILED(rv)) {
            NS_ERROR("nsLDAPService::OnLDAPMessage(): unexpected error in "
                     "nsLDAPMessage::GetOperation()");
            return NS_ERROR_UNEXPECTED;
        }

        rv = operation->GetConnection(getter_AddRefs(connection));
        if (NS_FAILED(rv)) {
            NS_ERROR("nsLDAPService::OnLDAPMessage(): unexpected error in "
                     "nsLDAPOperation::GetConnection()");
            return NS_ERROR_UNEXPECTED;
        }

        // Now we have the connection, lets find the corresponding
        // server entry in the Service.
        //
        {
            nsCOMPtr<nsILDAPMessageListener> listener;
            nsCOMPtr<nsILDAPMessage> message;
            nsLDAPServiceEntry *entry;
            MutexAutoLock lock(mLock);

            if (!mConnections.Get(connection, &entry)) {
                return NS_ERROR_FAILURE;
            }

            message = entry->GetMessage();
            if (message) {
                // We already have a message, lets keep that one.
                //
                return NS_ERROR_FAILURE;
            }

            entry->SetRebinding(false);
            entry->SetMessage(aMessage);

            // Now process all the pending callbacks/listeners. We
            // have to make sure to unlock before calling a listener,
            // since it's likely to call back into us again.
            //
            while (listener = entry->PopListener()) {
                MutexAutoUnlock unlock(mLock);
                listener->OnLDAPMessage(aMessage);
            }
        }
        break;

    default:
        NS_WARNING("nsLDAPService::OnLDAPMessage(): unexpected LDAP message "
                   "received");

        // get the console service so we can log a message
        //
        nsCOMPtr<nsIConsoleService> consoleSvc = 
            do_GetService("@mozilla.org/consoleservice;1", &rv);
        if (NS_FAILED(rv)) {
            NS_ERROR("nsLDAPChannel::OnLDAPMessage() couldn't get console "
                     "service");
            break;
        }

        // log the message
        //
        rv = consoleSvc->LogStringMessage(
            NS_LITERAL_STRING("LDAP: WARNING: nsLDAPService::OnLDAPMessage(): Unexpected LDAP message received").get());
        NS_ASSERTION(NS_SUCCEEDED(rv), "nsLDAPService::OnLDAPMessage(): "
                     "consoleSvc->LogStringMessage() failed");
        break;
    }

    return NS_OK;
}

// void onLDAPInit (in nsILDAPConnection aConn, in nsresult aStatus); */
//
NS_IMETHODIMP
nsLDAPService::OnLDAPInit(nsILDAPConnection *aConn, nsresult aStatus)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

// Helper function to establish an LDAP connection properly.
//
nsresult
nsLDAPService::EstablishConnection(nsLDAPServiceEntry *aEntry,
                                   nsILDAPMessageListener *aListener)
{
    nsCOMPtr<nsILDAPOperation> operation;
    nsCOMPtr<nsILDAPServer> server;
    nsCOMPtr<nsILDAPURL> url;
    nsCOMPtr<nsILDAPConnection> conn, conn2;
    nsCOMPtr<nsILDAPMessage> message;
    nsAutoCString binddn;
    nsAutoCString password;
    uint32_t protocolVersion;
    nsresult rv;

    server = aEntry->GetServer();
    if (!server) {
        return NS_ERROR_FAILURE;
    }

    // Get username, password, and protocol version from the server entry.
    //
    rv = server->GetBinddn(binddn);
    if (NS_FAILED(rv)) {
        return NS_ERROR_FAILURE;
    }
    rv = server->GetPassword(password);
    if (NS_FAILED(rv)) {
        return NS_ERROR_FAILURE;
    }
    rv = server->GetProtocolVersion(&protocolVersion);
    if (NS_FAILED(rv)) {
        return NS_ERROR_FAILURE;
    }

    // Get the host and port out of the URL, which is in the server entry.
    //
    rv = server->GetUrl(getter_AddRefs(url));
    if (NS_FAILED(rv)) {
        return NS_ERROR_FAILURE;
    }
    // Create a new connection for this server.
    //
    conn = do_CreateInstance(kLDAPConnectionCID, &rv);
    if (NS_FAILED(rv)) {
        NS_ERROR("nsLDAPService::EstablishConnection(): could not create "
                 "@mozilla.org/network/ldap-connection;1");
        return NS_ERROR_FAILURE;
    }

    rv = conn->Init(url, binddn, this, nullptr, protocolVersion);
    if (NS_FAILED(rv)) {
        switch (rv) {
        // Only pass along errors we are aware of
        //
        case NS_ERROR_OUT_OF_MEMORY:
        case NS_ERROR_NOT_AVAILABLE:
        case NS_ERROR_FAILURE:
            return rv;

        case NS_ERROR_ILLEGAL_VALUE:
        default:
            return NS_ERROR_UNEXPECTED;
        }
    }

    // Try to detect a collision, i.e. someone established a connection
    // just before we did. If so, we drop ours. This code is somewhat
    // similar to what happens in RequestConnection(), i.e. we try to
    // call the listener directly if possible, and if not, push it on
    // the stack of pending requests.
    //
    {
        MutexAutoLock lock(mLock);

        conn2 = aEntry->GetConnection();
        message = aEntry->GetMessage();
    }

    if (conn2) {
        // Drop the new connection, we can't use it.
        //
        conn = 0;
        if (message) {
            aListener->OnLDAPMessage(message);
            return NS_OK;
        }

        {
            MutexAutoLock lock(mLock);

            if (!aEntry->PushListener(static_cast<nsILDAPMessageListener *>
                                                 (aListener))) {
                return NS_ERROR_FAILURE;
            }
        }

        return NS_OK;
    }

    // We made the connection, lets store it to the server entry,
    // and also update the reverse lookup tables (for finding the
    // server entry related to a particular connection).
    //
    {
        MutexAutoLock lock(mLock);

        aEntry->SetConnection(conn);
        mConnections.Put(conn, aEntry);
    }

    // Setup the bind() operation.
    //
    operation = do_CreateInstance(kLDAPOperationCID, &rv);
    if (NS_FAILED(rv)) {
        return NS_ERROR_FAILURE;
    }

    rv = operation->Init(conn, this, nullptr);
    if (NS_FAILED(rv)) {
        return NS_ERROR_UNEXPECTED; // this should never happen
    }

    // Start a bind operation 
    //
    // Here we need to support the password, see bug #75990
    // 
    rv = operation->SimpleBind(password);
    if (NS_FAILED(rv)) {
        switch (rv) {
        // Only pass along errors we are aware of
        //
        case NS_ERROR_LDAP_ENCODING_ERROR:
        case NS_ERROR_FAILURE:
        case NS_ERROR_OUT_OF_MEMORY:
            return rv;

        default:
            return NS_ERROR_UNEXPECTED;
        }
    }

    return NS_OK;
}

/* AString createFilter (in unsigned long aMaxSize, in AString aPattern, in AString aPrefix, in AString aSuffix, in AString aAttr, in AString aValue); */
NS_IMETHODIMP nsLDAPService::CreateFilter(uint32_t aMaxSize, 
                                          const nsACString & aPattern,
                                          const nsACString & aPrefix,
                                          const nsACString & aSuffix,
                                          const nsACString & aAttr,
                                          const nsACString & aValue,
                                          nsACString & _retval)
{
    if (!aMaxSize) {
        return NS_ERROR_INVALID_ARG;
    }

    // figure out how big of an array we're going to need for the tokens,
    // including a trailing NULL, and allocate space for it.
    //
    const char *iter = aValue.BeginReading();
    const char *iterEnd = aValue.EndReading();
    uint32_t numTokens = CountTokens(iter, iterEnd); 
    char **valueWords;
    valueWords = static_cast<char **>(nsMemory::Alloc((numTokens + 1) *
                                                sizeof(char *)));
    if (!valueWords) {
        return NS_ERROR_OUT_OF_MEMORY;
    }

    // build the array of values
    //
    uint32_t curToken = 0;
    while (iter != iterEnd && curToken < numTokens ) {
        valueWords[curToken] = NextToken(&iter, &iterEnd);
        if ( !valueWords[curToken] ) {
            NS_FREE_XPCOM_ALLOCATED_POINTER_ARRAY(curToken, valueWords);
            return NS_ERROR_OUT_OF_MEMORY;
        }
        curToken++;
    }
    valueWords[numTokens] = 0;  // end of array signal to LDAP C SDK

    // make buffer to be used for construction 
    //
    char *buffer = static_cast<char *>(nsMemory::Alloc(aMaxSize * sizeof(char)));
    if (!buffer) {
        NS_FREE_XPCOM_ALLOCATED_POINTER_ARRAY(numTokens, valueWords);
        return NS_ERROR_OUT_OF_MEMORY;
    }

    // create the filter itself
    //
    nsresult rv;
    int result = ldap_create_filter(buffer, aMaxSize, 
                   const_cast<char *>(PromiseFlatCString(aPattern).get()),
                   const_cast<char *>(PromiseFlatCString(aPrefix).get()),
                   const_cast<char *>(PromiseFlatCString(aSuffix).get()),
                   const_cast<char *>(PromiseFlatCString(aAttr).get()),
                   const_cast<char *>(PromiseFlatCString(aValue).get()),
                   valueWords);
    switch (result) {
    case LDAP_SUCCESS:
        rv = NS_OK;
        break;

    case LDAP_SIZELIMIT_EXCEEDED:
        PR_LOG(gLDAPLogModule, PR_LOG_DEBUG, 
                   ("nsLDAPService::CreateFilter(): "
                    "filter longer than max size of %d generated", 
                    aMaxSize));
        rv = NS_ERROR_NOT_AVAILABLE;
        break;

    case LDAP_PARAM_ERROR:
        rv = NS_ERROR_INVALID_ARG;
        break;

    default:
        NS_ERROR("nsLDAPService::CreateFilter(): ldap_create_filter() "
                 "returned unexpected error");
        rv = NS_ERROR_UNEXPECTED;
        break;
    }

    _retval.Assign(buffer);

    // done with the array and the buffer
    //
    NS_FREE_XPCOM_ALLOCATED_POINTER_ARRAY(numTokens, valueWords);
    nsMemory::Free(buffer);

    return rv;
}

// Parse a distinguished name (DN) and returns the relative DN,
// base DN and the list of attributes that make up the relative DN.
NS_IMETHODIMP nsLDAPService::ParseDn(const char *aDn,
                                   nsACString &aRdn,
                                   nsACString &aBaseDn,
                                   uint32_t *aRdnCount,
                                   char ***aRdnAttrs)
{
    NS_ENSURE_ARG_POINTER(aRdnCount);
    NS_ENSURE_ARG_POINTER(aRdnAttrs);

    // explode the DN
    char **dnComponents = ldap_explode_dn(aDn, 0);
    if (!dnComponents) {
        NS_ERROR("nsLDAPService::ParseDn: parsing DN failed");
        return NS_ERROR_UNEXPECTED;
    }

    // count DN components
    if (!*dnComponents || !*(dnComponents + 1)) {
        NS_ERROR("nsLDAPService::ParseDn: DN has too few components");
        ldap_value_free(dnComponents);
        return NS_ERROR_UNEXPECTED;
    }

    // get the base DN
    nsAutoCString baseDn(nsDependentCString(*(dnComponents + 1)));
    for (char **component = dnComponents + 2; *component; ++component) {
        baseDn.AppendLiteral(",");
        baseDn.Append(nsDependentCString(*component));
    }

    // explode the RDN
    char **rdnComponents = ldap_explode_rdn(*dnComponents, 0);
    if (!rdnComponents) {
        NS_ERROR("nsLDAPService::ParseDn: parsing RDN failed");
        ldap_value_free(dnComponents);
        return NS_ERROR_UNEXPECTED;
    }

    // count RDN attributes
    uint32_t rdnCount = 0;
    for (char **component = rdnComponents; *component; ++component)
        ++rdnCount;
    if (rdnCount < 1) {
        NS_ERROR("nsLDAPService::ParseDn: RDN has too few components");
        ldap_value_free(dnComponents);
        ldap_value_free(rdnComponents);
        return NS_ERROR_UNEXPECTED;
    }
  
    // get the RDN attribute names
    char **attrNameArray = static_cast<char **>(
        nsMemory::Alloc(rdnCount * sizeof(char *)));
    if (!attrNameArray) {
        NS_ERROR("nsLDAPService::ParseDn: out of memory ");
        ldap_value_free(dnComponents);
        ldap_value_free(rdnComponents);
        return NS_ERROR_OUT_OF_MEMORY;
    }
    uint32_t index = 0;
    for (char **component = rdnComponents; *component; ++component) {
        uint32_t len = 0;
        char *p;
        for (p = *component; *p != '\0' && *p != '='; ++p)
            ++len;
        if (*p != '=') {
            NS_ERROR("nsLDAPService::parseDn: "
                "could not find '=' in RDN component");
            ldap_value_free(dnComponents);
            ldap_value_free(rdnComponents);
            return NS_ERROR_UNEXPECTED;
        }
        if (!(attrNameArray[index] = (char*)NS_Alloc(len + 1))) {
            NS_ERROR("nsLDAPService::ParseDn: out of memory ");
            ldap_value_free(dnComponents);
            ldap_value_free(rdnComponents);
            NS_FREE_XPCOM_ALLOCATED_POINTER_ARRAY(index, attrNameArray);
            return NS_ERROR_OUT_OF_MEMORY;
        }
        memcpy(attrNameArray[index], *component, len);
        *(attrNameArray[index] + len) = '\0';
        ++index;
    }

    // perform assignments
    aRdn.Assign(*dnComponents);
    aBaseDn.Assign(baseDn);
    *aRdnCount = rdnCount;
    *aRdnAttrs = attrNameArray;

    ldap_value_free(dnComponents);
    ldap_value_free(rdnComponents);
    return NS_OK;
}

// Count the number of space-separated tokens between aIter and aIterEnd
//
uint32_t
nsLDAPService::CountTokens(const char *aIter,
                           const char *aIterEnd)
{
    uint32_t count(0);

    // keep iterating through the string until we hit the end
    //
    while (aIter != aIterEnd) {
    
        // move past any leading spaces
        //
        while (aIter != aIterEnd &&
               ldap_utf8isspace(const_cast<char *>(aIter))){
            ++aIter;
        }

        // move past all chars in this token
        //
        while (aIter != aIterEnd) {

            if (ldap_utf8isspace(const_cast<char *>(aIter))) {
                ++count;    // token finished; increment the count
                ++aIter;    // move past the space
                break;
            }

            ++aIter; // move to next char

            // if we've hit the end of this token and the end of this 
            // iterator simultaneous, be sure to bump the count, since we're
            // never gonna hit the IsAsciiSpace where it's normally done.
            //
            if (aIter == aIterEnd) {
                ++count;
            }

        }
    }

    return count;
}

// return the next token in this iterator
//
char*
nsLDAPService::NextToken(const char **aIter,
                         const char **aIterEnd)
{
    // move past any leading whitespace
    //
    while (*aIter != *aIterEnd &&
           ldap_utf8isspace(const_cast<char *>(*aIter))) {
        ++(*aIter);
    }

    const char *start = *aIter;

    // copy the token into our local variable
    //
    while (*aIter != *aIterEnd &&
           !ldap_utf8isspace(const_cast<char *>(*aIter))) {
        ++(*aIter);
    }

    return ToNewCString(Substring(start, *aIter));
}
