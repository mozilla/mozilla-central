/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsLDAPInternal.h"
#include "nsIServiceManager.h"
#include "nsStringGlue.h"
#include "nsIComponentManager.h"
#include "nsIDNSRecord.h"
#include "nsLDAPConnection.h"
#include "nsLDAPMessage.h"
#include "nsThreadUtils.h"
#include "nsIConsoleService.h"
#include "nsIDNSService.h"
#include "nsINetAddr.h"
#include "nsIRequestObserver.h"
#include "nsError.h"
#include "nsLDAPOperation.h"
#include "nsILDAPErrors.h"
#include "nsIClassInfoImpl.h"
#include "nsILDAPURL.h"
#include "nsIObserverService.h"
#include "mozilla/Services.h"
#include "nsMemory.h"
#include "nsLDAPUtils.h"

using namespace mozilla;

const char kConsoleServiceContractId[] = "@mozilla.org/consoleservice;1";
const char kDNSServiceContractId[] = "@mozilla.org/network/dns-service;1";

// constructor
//
nsLDAPConnection::nsLDAPConnection()
    : mConnectionHandle(0),
      mPendingOperationsMutex("nsLDAPConnection.mPendingOperationsMutex"),
      mPendingOperations(10),
      mSSL(false),
      mVersion(nsILDAPConnection::VERSION3),
      mDNSRequest(0)
{
}

// destructor
//
nsLDAPConnection::~nsLDAPConnection()
{
  nsCOMPtr<nsIObserverService> obsServ =
      do_GetService(NS_OBSERVERSERVICE_CONTRACTID);
  if (obsServ)
      obsServ->RemoveObserver(this, "profile-change-net-teardown");
  Close();
}

NS_IMPL_ADDREF(nsLDAPConnection)
NS_IMPL_RELEASE(nsLDAPConnection)
NS_IMPL_CLASSINFO(nsLDAPConnection, NULL, nsIClassInfo::THREADSAFE,
                  NS_LDAPCONNECTION_CID)

NS_INTERFACE_MAP_BEGIN(nsLDAPConnection)
  NS_INTERFACE_MAP_ENTRY(nsILDAPConnection)
  NS_INTERFACE_MAP_ENTRY(nsISupportsWeakReference)
  NS_INTERFACE_MAP_ENTRY(nsIDNSListener)
  NS_INTERFACE_MAP_ENTRY(nsIObserver)
  NS_INTERFACE_MAP_ENTRY_AMBIGUOUS(nsISupports, nsILDAPConnection)
  NS_IMPL_QUERY_CLASSINFO(nsLDAPConnection)
NS_INTERFACE_MAP_END_THREADSAFE
NS_IMPL_CI_INTERFACE_GETTER4(nsLDAPConnection, nsILDAPConnection,
                             nsISupportsWeakReference, nsIDNSListener,
                             nsIObserver)

NS_IMETHODIMP
nsLDAPConnection::Init(nsILDAPURL *aUrl, const nsACString &aBindName,
                       nsILDAPMessageListener *aMessageListener,
                       nsISupports *aClosure, uint32_t aVersion)
{
  NS_ENSURE_ARG_POINTER(aUrl);
  NS_ENSURE_ARG_POINTER(aMessageListener);

  nsresult rv;
  nsCOMPtr<nsIObserverService> obsServ =
        do_GetService(NS_OBSERVERSERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  // We have to abort all LDAP pending operation before shutdown.
  obsServ->AddObserver(this, "profile-change-net-teardown", true);

  // Save various items that we'll use later
  mBindName.Assign(aBindName);
  mClosure = aClosure;
  mInitListener = aMessageListener;

  // Make sure we haven't called Init earlier, i.e. there's a DNS
  // request pending.
  NS_ASSERTION(!mDNSRequest, "nsLDAPConnection::Init() "
               "Connection was already initialized\n");

  // Check and save the version number
  if (aVersion != nsILDAPConnection::VERSION2 &&
      aVersion != nsILDAPConnection::VERSION3) {
    NS_ERROR("nsLDAPConnection::Init(): illegal version");
    return NS_ERROR_ILLEGAL_VALUE;
  }
  mVersion = aVersion;

  // Get the port number, SSL flag for use later, once the DNS server(s)
  // has resolved the host part.
  rv = aUrl->GetPort(&mPort);
  NS_ENSURE_SUCCESS(rv, rv);

  uint32_t options;
  rv = aUrl->GetOptions(&options);
  NS_ENSURE_SUCCESS(rv, rv);

  mSSL = options & nsILDAPURL::OPT_SECURE;

  nsCOMPtr<nsIThread> curThread = do_GetCurrentThread();
  if (!curThread) {
    NS_ERROR("nsLDAPConnection::Init(): couldn't get current thread");
    return NS_ERROR_FAILURE;
  }

  // Do the pre-resolve of the hostname, using the DNS service. This
  // will also initialize the LDAP connection properly, once we have
  // the IPs resolved for the hostname. This includes creating the
  // new thread for this connection.
  //
  // XXX - What return codes can we expect from the DNS service?
  //
  nsCOMPtr<nsIDNSService>
    pDNSService(do_GetService(kDNSServiceContractId, &rv));

  if (NS_FAILED(rv)) {
    NS_ERROR("nsLDAPConnection::Init(): couldn't create the DNS Service object");
    return NS_ERROR_FAILURE;
  }

  rv = aUrl->GetAsciiHost(mDNSHost);
  NS_ENSURE_SUCCESS(rv, rv);

  // if the caller has passed in a space-delimited set of hosts, as the
  // ldap c-sdk allows, strip off the trailing hosts for now.
  // Soon, we'd like to make multiple hosts work, but now make
  // at least the first one work.
  LdapCompressWhitespace(mDNSHost);

  int32_t spacePos = mDNSHost.FindChar(' ');
  // trim off trailing host(s)
  if (spacePos != kNotFound)
    mDNSHost.SetLength(spacePos);

  rv = pDNSService->AsyncResolve(mDNSHost, 0, this, curThread,
                                 getter_AddRefs(mDNSRequest));

  if (NS_FAILED(rv)) {
    switch (rv) {
    case NS_ERROR_OUT_OF_MEMORY:
    case NS_ERROR_UNKNOWN_HOST:
    case NS_ERROR_FAILURE:
    case NS_ERROR_OFFLINE:
      break;

    default:
      rv = NS_ERROR_UNEXPECTED;
    }
    mDNSHost.Truncate();
  }
  return rv;
}

// this might get exposed to clients, so we've broken it
// out of the destructor.
void
nsLDAPConnection::Close()
{
  int rc;
  PR_LOG(gLDAPLogModule, PR_LOG_DEBUG, ("unbinding\n"));

  if (mConnectionHandle) {
      // note that the ldap_unbind() call in the 5.0 version of the LDAP C SDK
      // appears to be exactly identical to ldap_unbind_s(), so it may in fact
      // still be synchronous
      //
      rc = ldap_unbind(mConnectionHandle);
#ifdef PR_LOGGING
      if (rc != LDAP_SUCCESS) {
          PR_LOG(gLDAPLogModule, PR_LOG_WARNING,
                 ("nsLDAPConnection::Close(): %s\n",
                  ldap_err2string(rc)));
      }
#endif
      mConnectionHandle = nullptr;
  }

  PR_LOG(gLDAPLogModule, PR_LOG_DEBUG, ("unbound\n"));

  NS_ASSERTION(!mThread || NS_SUCCEEDED(mThread->Shutdown()),
               "Failed to shutdown thread cleanly");

  // Cancel the DNS lookup if needed, and also drop the reference to the
  // Init listener (if still there).
  //
  if (mDNSRequest) {
      mDNSRequest->Cancel(NS_ERROR_ABORT);
      mDNSRequest = 0;
  }
  mInitListener = 0;

}
/** Get list of pending operation and store pointers to array
  * \param userArg pointer to nsTArray<nsILDAPOperation*>
  */
PLDHashOperator
GetListOfPendingOperations(const uint32_t &key, nsILDAPOperation *op, void *userArg)
{
  nsTArray<nsILDAPOperation*>* pending_operations = static_cast<nsTArray<nsILDAPOperation*>* >(userArg);
  pending_operations->AppendElement(op);
  return PL_DHASH_NEXT;
}

NS_IMETHODIMP
nsLDAPConnection::Observe(nsISupports *aSubject, const char *aTopic,
                          const PRUnichar *aData)
{
  if (!strcmp(aTopic, "profile-change-net-teardown")) {
    // Abort all ldap requests.
    /* We cannot use enumerate function to abort operations because
     * nsILDAPOperation::AbandonExt() is modifying list of operations
     * and this leads to starvation.
     * We have to do a copy of pending operations.
     */
    nsTArray<nsILDAPOperation*> pending_operations;
    {
      MutexAutoLock lock(mPendingOperationsMutex);
      mPendingOperations.EnumerateRead(GetListOfPendingOperations, (void *) (&pending_operations));
    }
    for (uint32_t i = 0; i < pending_operations.Length(); i++) {
      pending_operations[i]->AbandonExt();
    }
    Close();
  } else {
    NS_NOTREACHED("unexpected topic");
    return NS_ERROR_UNEXPECTED;
  }
  return NS_OK;
}

NS_IMETHODIMP
nsLDAPConnection::GetClosure(nsISupports **_retval)
{
    if (!_retval) {
        return NS_ERROR_ILLEGAL_VALUE;
    }
    NS_IF_ADDREF(*_retval = mClosure);
    return NS_OK;
}

NS_IMETHODIMP
nsLDAPConnection::SetClosure(nsISupports *aClosure)
{
    mClosure = aClosure;
    return NS_OK;
}

// who we're binding as
//
// readonly attribute AUTF8String bindName
//
NS_IMETHODIMP
nsLDAPConnection::GetBindName(nsACString& _retval)
{
    _retval.Assign(mBindName);
    return NS_OK;
}

// wrapper for ldap_get_lderrno
// XXX should copy before returning
//
NS_IMETHODIMP
nsLDAPConnection::GetLdErrno(nsACString& matched, nsACString& errString,
                             int32_t *_retval)
{
    char *match, *err;

    NS_ENSURE_ARG_POINTER(_retval);

    *_retval = ldap_get_lderrno(mConnectionHandle, &match, &err);
    matched.Assign(match);
    errString.Assign(err);
    return NS_OK;
}

// return the error string corresponding to GetLdErrno.
//
// XXX - deal with optional params
// XXX - how does ldap_perror know to look at the global errno?
//
NS_IMETHODIMP
nsLDAPConnection::GetErrorString(PRUnichar **_retval)
{
    NS_ENSURE_ARG_POINTER(_retval);

    // get the error string
    //
    char *rv = ldap_err2string(ldap_get_lderrno(mConnectionHandle, 0, 0));
    if (!rv) {
        return NS_ERROR_OUT_OF_MEMORY;
    }

    // make a copy using the XPCOM shared allocator
    //
    *_retval = ToNewUnicode(NS_ConvertUTF8toUTF16(rv));
    if (!*_retval) {
        return NS_ERROR_OUT_OF_MEMORY;
    }
    return NS_OK;
}

/**
 * Add an nsILDAPOperation to the list of operations pending on
 * this connection.  This is also mainly intended for use by the
 * nsLDAPOperation code.
 */
nsresult
nsLDAPConnection::AddPendingOperation(uint32_t aOperationID, nsILDAPOperation *aOperation)
{
  NS_ENSURE_ARG_POINTER(aOperation);

  nsIRunnable* runnable = new nsLDAPConnectionRunnable(aOperationID, aOperation,
                                                       this);
  {
    MutexAutoLock lock(mPendingOperationsMutex);
    mPendingOperations.Put((uint32_t)aOperationID, aOperation);
    PR_LOG(gLDAPLogModule, PR_LOG_DEBUG,
           ("pending operation added; total pending operations now = %d\n",
            mPendingOperations.Count()));
  }

  nsresult rv;
  if (!mThread)
  {
    rv = NS_NewThread(getter_AddRefs(mThread), runnable);
    NS_ENSURE_SUCCESS(rv, rv);
  }
  else
  {
    rv = mThread->Dispatch(runnable, nsIEventTarget::DISPATCH_NORMAL);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  return NS_OK;
}

/**
 * Remove an nsILDAPOperation from the list of operations pending on this
 * connection.  Mainly intended for use by the nsLDAPOperation code.
 *
 * @param aOperation    operation to add
 * @exception NS_ERROR_INVALID_POINTER  aOperation was NULL
 * @exception NS_ERROR_OUT_OF_MEMORY    out of memory
 * @exception NS_ERROR_FAILURE      could not delete the operation
 *
 * void removePendingOperation(in nsILDAPOperation aOperation);
 */
nsresult
nsLDAPConnection::RemovePendingOperation(uint32_t aOperationID)
{
  NS_ENSURE_TRUE(aOperationID > 0, NS_ERROR_UNEXPECTED);

  PR_LOG(gLDAPLogModule, PR_LOG_DEBUG,
         ("nsLDAPConnection::RemovePendingOperation(): operation removed\n"));

  {
    MutexAutoLock lock(mPendingOperationsMutex);
    mPendingOperations.Remove(aOperationID);
    PR_LOG(gLDAPLogModule, PR_LOG_DEBUG,
           ("nsLDAPConnection::RemovePendingOperation(): operation "
            "removed; total pending operations now = %d\n",
            mPendingOperations.Count()));
  }

  return NS_OK;
}

class nsOnLDAPMessageRunnable : public nsRunnable
{
public:
  nsOnLDAPMessageRunnable(nsLDAPMessage *aMsg, bool aClear)
    : m_msg(aMsg)
    , m_clear(aClear)
  {}
  NS_DECL_NSIRUNNABLE
private:
  nsRefPtr<nsLDAPMessage> m_msg;
  bool m_clear;
};

NS_IMETHODIMP nsOnLDAPMessageRunnable::Run()
{
  // get the message listener object.
  nsLDAPOperation *nsoperation = static_cast<nsLDAPOperation *>(m_msg->mOperation.get());
  nsCOMPtr<nsILDAPMessageListener> listener;
  nsresult rv = nsoperation->GetMessageListener(getter_AddRefs(listener));

  if (m_clear)
  {
    // try to break cycles
    nsoperation->Clear();
  }

  if (!listener)
  {
    NS_ERROR("nsLDAPConnection::InvokeMessageCallback(): probable "
             "memory corruption: GetMessageListener() returned nullptr");
    return rv;
  }

  return listener->OnLDAPMessage(m_msg);
}

nsresult
nsLDAPConnection::InvokeMessageCallback(LDAPMessage *aMsgHandle,
                                        nsILDAPMessage *aMsg,
                                        int32_t aOperation,
                                        bool aRemoveOpFromConnQ)
{
#if defined(DEBUG)
  // We only want this being logged for debug builds so as not to affect performance too much.
  PR_LOG(gLDAPLogModule, PR_LOG_DEBUG, ("InvokeMessageCallback entered\n"));
#endif

  // Get the operation.
  nsCOMPtr<nsILDAPOperation> operation;
  {
    MutexAutoLock lock(mPendingOperationsMutex);
    mPendingOperations.Get((uint32_t)aOperation, getter_AddRefs(operation));
  }

  NS_ENSURE_TRUE(operation, NS_ERROR_NULL_POINTER);

  nsLDAPMessage *msg = static_cast<nsLDAPMessage *>(aMsg);
  msg->mOperation = operation;

  // proxy the listener callback to the ui thread.
  nsRefPtr<nsOnLDAPMessageRunnable> runnable =
    new nsOnLDAPMessageRunnable(msg, aRemoveOpFromConnQ);
  // invoke the callback
  NS_DispatchToMainThread(runnable);

  // if requested (ie the operation is done), remove the operation
  // from the connection queue.
  if (aRemoveOpFromConnQ)
  {
    MutexAutoLock lock(mPendingOperationsMutex);
    mPendingOperations.Remove(aOperation);

    PR_LOG(gLDAPLogModule, PR_LOG_DEBUG,
           ("pending operation removed; total pending operations now ="
            " %d\n", mPendingOperations.Count()));
  }

  return NS_OK;
}

NS_IMETHODIMP
nsLDAPConnection::OnLookupComplete(nsICancelable *aRequest,
                                   nsIDNSRecord  *aRecord,
                                   nsresult       aStatus)
{
    nsresult rv = NS_OK;

    if (aRecord) {
        // Build mResolvedIP list
        //
        mResolvedIP.Truncate();

        int32_t index = 0;
        nsCString addrbuf;
        nsCOMPtr<nsINetAddr> addr;

        while (NS_SUCCEEDED(aRecord->GetScriptableNextAddr(0, getter_AddRefs(addr)))) {
            // We can only use v4 addresses
            //
            uint16_t family = 0;
            bool v4mapped = false;
            addr->GetFamily(&family);
            addr->GetIsV4Mapped(&v4mapped);
            if (family == nsINetAddr::FAMILY_INET || v4mapped) {
                // If there are more IPs in the list, we separate them with
                // a space, as supported/used by the LDAP C-SDK.
                //
                if (index++)
                    mResolvedIP.Append(' ');

                // Convert the IPv4 address to a string, and append it to our
                // list of IPs.  Strip leading '::FFFF:' (the IPv4-mapped-IPv6
                // indicator) if present.
                //
                addr->GetAddress(addrbuf);
                if (addrbuf[0] == ':' && addrbuf.Length() > 7)
                    mResolvedIP.Append(Substring(addrbuf, 7));
                else
                    mResolvedIP.Append(addrbuf);
            }
        }
    }

    if (NS_FAILED(aStatus)) {
        // The DNS service failed, lets pass something reasonable
        // back to the listener.
        //
        switch (aStatus) {
        case NS_ERROR_OUT_OF_MEMORY:
        case NS_ERROR_UNKNOWN_HOST:
        case NS_ERROR_FAILURE:
        case NS_ERROR_OFFLINE:
            rv = aStatus;
            break;

        default:
            rv = NS_ERROR_UNEXPECTED;
            break;
        }
    } else if (!mResolvedIP.Length()) {
        // We have no host resolved, that is very bad, and should most
        // likely have been caught earlier.
        //
        NS_ERROR("nsLDAPConnection::OnStopLookup(): the resolved IP "
                 "string is empty.\n");

        rv = NS_ERROR_UNKNOWN_HOST;
    } else {
        // We've got the IP(s) for the hostname, now lets setup the
        // LDAP connection using this information. Note that if the
        // LDAP server returns a referral, the C-SDK will perform a
        // new, synchronous DNS lookup, which might hang (but hopefully
        // if we've come this far, DNS is working properly).
        //
        mConnectionHandle = ldap_init(mResolvedIP.get(),
                                      mPort == -1 ?
                                      (mSSL ? LDAPS_PORT : LDAP_PORT) : mPort);
        // Check that we got a proper connection, and if so, setup the
        // threading functions for this connection.
        //
        if ( !mConnectionHandle ) {
            rv = NS_ERROR_FAILURE;  // LDAP C SDK API gives no useful error
        } else {
#if defined(DEBUG_dmose) || defined(DEBUG_bienvenu)
            const int lDebug = 0;
            ldap_set_option(mConnectionHandle, LDAP_OPT_DEBUG_LEVEL, &lDebug);
#endif

            // the C SDK currently defaults to v2.  if we're to use v3,
            // tell it so.
            //
            int version;
            switch (mVersion) {
            case 2:
                break;
            case 3:
                version = LDAP_VERSION3;
                ldap_set_option(mConnectionHandle, LDAP_OPT_PROTOCOL_VERSION,
                                &version);
		break;
            default:
                NS_ERROR("nsLDAPConnection::OnLookupComplete(): mVersion"
                         " invalid");
            }

            // This code sets up the current connection to use PSM for SSL
            // functionality.  Making this use libssldap instead for
            // non-browser user shouldn't be hard.

            extern nsresult nsLDAPInstallSSL(LDAP *ld, const char *aHostName);

            if (mSSL) {
                if (ldap_set_option(mConnectionHandle, LDAP_OPT_SSL,
                                    LDAP_OPT_ON) != LDAP_SUCCESS ) {
                    NS_ERROR("nsLDAPConnection::OnStopLookup(): Error"
                             " configuring connection to use SSL");
                    rv = NS_ERROR_UNEXPECTED;
                }

                rv = nsLDAPInstallSSL(mConnectionHandle, mDNSHost.get());
                if (NS_FAILED(rv)) {
                    NS_ERROR("nsLDAPConnection::OnStopLookup(): Error"
                             " installing secure LDAP routines for"
                             " connection");
                }
            }
        }
    }

    // Drop the DNS request object, we no longer need it, and set the flag
    // indicating that DNS has finished.
    //
    mDNSRequest = 0;
    mDNSHost.Truncate();

    // Call the listener, and then we can release our reference to it.
    //
    mInitListener->OnLDAPInit(this, rv);
    mInitListener = 0;

    return rv;
}

nsLDAPConnectionRunnable::nsLDAPConnectionRunnable(int32_t aOperationID,
                                                   nsILDAPOperation *aOperation,
                                                   nsLDAPConnection *aConnection)
  : mOperationID(aOperationID),  mConnection(aConnection)
{
}

nsLDAPConnectionRunnable::~nsLDAPConnectionRunnable()
{
}

NS_IMPL_ISUPPORTS1(nsLDAPConnectionRunnable, nsIRunnable)

NS_IMETHODIMP nsLDAPConnectionRunnable::Run()
{
  if (!mOperationID) {
    NS_ERROR("mOperationID is null");
    return NS_ERROR_NULL_POINTER;
  }

  LDAPMessage *msgHandle;
  bool operationFinished = true;
  nsRefPtr<nsLDAPMessage> msg;

  struct timeval timeout = { 0, 0 };

  nsCOMPtr<nsIThread> thread = do_GetCurrentThread();
  int32_t returnCode = ldap_result(mConnection->mConnectionHandle, mOperationID, LDAP_MSG_ONE, &timeout, &msgHandle);
  switch (returnCode)
  {
    // timeout
    case 0:
      // XXX do we need a timer?
      return thread->Dispatch(this, nsIEventTarget::DISPATCH_NORMAL);
    case -1:
      NS_ERROR("We don't know what went wrong with the ldap operation");
      return NS_ERROR_FAILURE;

    case LDAP_RES_SEARCH_ENTRY:
    case LDAP_RES_SEARCH_REFERENCE:
      // XXX what should we do with LDAP_RES_SEARCH_EXTENDED
      operationFinished = false;
    default:
    {
      msg = new nsLDAPMessage;
      if (!msg)
        return NS_ERROR_NULL_POINTER;

      // initialize the message, using a protected method not available
      // through nsILDAPMessage (which is why we need the raw pointer)
      nsresult rv = msg->Init(mConnection, msgHandle);

      switch (rv)
      {
        case NS_OK:
        {
          int32_t errorCode;
          msg->GetErrorCode(&errorCode);

          // maybe a version error, e.g., using v3 on a v2 server.
          // if we're using v3, try v2.
          if (errorCode == LDAP_PROTOCOL_ERROR &&
              mConnection->mVersion == nsILDAPConnection::VERSION3)
          {
            nsAutoCString password;
            mConnection->mVersion = nsILDAPConnection::VERSION2;
            ldap_set_option(mConnection->mConnectionHandle,
                            LDAP_OPT_PROTOCOL_VERSION, &mConnection->mVersion);

            if (NS_SUCCEEDED(rv))
            {
              // We don't want to notify callers that we are done, so
              // redispatch the runnable.
              // XXX do we need a timer?
              rv = thread->Dispatch(this, nsIEventTarget::DISPATCH_NORMAL);
              NS_ENSURE_SUCCESS(rv, rv);
              return NS_OK;
            }
          }
          // If we're midway through a SASL Bind, we need to continue
          // without letting our caller know what we're up to!
          //
          if (errorCode == LDAP_SASL_BIND_IN_PROGRESS) {
            struct berval *creds;
            ldap_parse_sasl_bind_result(
              mConnection->mConnectionHandle, msgHandle,
              &creds, 0);

            nsCOMPtr<nsILDAPOperation> operation;
            {
              MutexAutoLock lock(mConnection->mPendingOperationsMutex);
              mConnection->mPendingOperations.Get((uint32_t)mOperationID, getter_AddRefs(operation));
            }

            NS_ENSURE_TRUE(operation, NS_ERROR_NULL_POINTER);

            nsresult rv = operation->SaslStep(creds->bv_val, creds->bv_len);
            if (NS_SUCCEEDED(rv))
              return NS_OK;
          }
          break;
        }
          // Error code handling in here
        default:
          return NS_OK;
      }

      // invoke the callback on the nsILDAPOperation corresponding to
      // this message
      rv = mConnection->InvokeMessageCallback(msgHandle, msg, mOperationID,
                                              operationFinished);
      if (NS_FAILED(rv))
      {
        NS_ERROR("CheckLDAPOperationResult(): error invoking message"
                 " callback");
        // punt and hope things work out better next time around
        return NS_OK;
      }

      if (!operationFinished)
      {
        // XXX do we need a timer?
        rv = thread->Dispatch(this, nsIEventTarget::DISPATCH_NORMAL);
        NS_ENSURE_SUCCESS(rv, rv);
      }

      break;
    }
  }
  return NS_OK;
}
