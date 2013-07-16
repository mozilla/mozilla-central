/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsAbLDAPDirectoryModify.h"
#include "nsILDAPMessage.h"
#include "nsILDAPConnection.h"
#include "nsILDAPErrors.h"
#include "nsILDAPModification.h"
#include "nsIServiceManager.h"
#include "nsIAbLDAPDirectory.h"
#include "nsIMutableArray.h"
#include "nsComponentManagerUtils.h"
#include "nsServiceManagerUtils.h"

#include <stdio.h>

using namespace mozilla;

class nsAbModifyLDAPMessageListener : public nsAbLDAPListenerBase
{
public:
  NS_DECL_THREADSAFE_ISUPPORTS

  nsAbModifyLDAPMessageListener(const int32_t type,
                                const nsACString &cardDN,
                                nsIArray* modArray,
                                const nsACString &newRDN,
                                const nsACString &newBaseDN,
                                nsILDAPURL* directoryUrl,
                                nsILDAPConnection* connection,
                                nsIMutableArray* serverSearchControls,
                                nsIMutableArray* clientSearchControls,
                                const nsACString &login,
                                const int32_t timeOut = 0);
  virtual ~nsAbModifyLDAPMessageListener();

  // nsILDAPMessageListener
  NS_IMETHOD OnLDAPMessage(nsILDAPMessage *aMessage);

protected:
  nsresult Cancel();
  virtual void InitFailed(bool aCancelled = false);
  virtual nsresult DoTask();
  nsresult DoMainTask();
  nsresult OnLDAPMessageModifyResult(nsILDAPMessage *aMessage);
  nsresult OnLDAPMessageRenameResult(nsILDAPMessage *aMessage);

  int32_t mType;
  nsCString mCardDN;
  nsCOMPtr<nsIArray> mModification;
  nsCString mNewRDN;
  nsCString mNewBaseDN;

  bool mFinished;
  bool mCanceled;
  bool mFlagRename;

  nsCOMPtr<nsILDAPOperation> mModifyOperation;
  nsCOMPtr<nsIMutableArray> mServerSearchControls;
  nsCOMPtr<nsIMutableArray> mClientSearchControls;
};


NS_IMPL_ISUPPORTS1(nsAbModifyLDAPMessageListener, nsILDAPMessageListener)

nsAbModifyLDAPMessageListener::nsAbModifyLDAPMessageListener(
    const int32_t type,
    const nsACString &cardDN,
    nsIArray* modArray,
    const nsACString &newRDN,
    const nsACString &newBaseDN,
    nsILDAPURL* directoryUrl,
    nsILDAPConnection* connection,
    nsIMutableArray* serverSearchControls,
    nsIMutableArray* clientSearchControls,
    const nsACString &login,
    const int32_t timeOut) :
    nsAbLDAPListenerBase(directoryUrl, connection, login, timeOut),
    mType(type),
    mCardDN(cardDN),
    mModification(modArray),
    mNewRDN(newRDN),
    mNewBaseDN(newBaseDN),
    mFinished(false),
    mCanceled(false),
    mFlagRename(false),
    mServerSearchControls(serverSearchControls),
    mClientSearchControls(clientSearchControls)
{
  if (mType == nsILDAPModification::MOD_REPLACE &&
      !mNewRDN.IsEmpty() && !mNewBaseDN.IsEmpty())
    mFlagRename = true;
}

nsAbModifyLDAPMessageListener::~nsAbModifyLDAPMessageListener ()
{
}

nsresult nsAbModifyLDAPMessageListener::Cancel ()
{
  nsresult rv = Initiate();
  NS_ENSURE_SUCCESS(rv, rv);

  MutexAutoLock lock(mLock);

  if (mFinished || mCanceled)
    return NS_OK;

  mCanceled = true;

  return NS_OK;
}

NS_IMETHODIMP nsAbModifyLDAPMessageListener::OnLDAPMessage(nsILDAPMessage *aMessage)
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

    // for these messages, no matter the outcome, we're done
    if ((messageType == nsILDAPMessage::RES_ADD) || 
        (messageType == nsILDAPMessage::RES_DELETE) ||
        (messageType == nsILDAPMessage::RES_MODIFY))
      mFinished = true;
    else if (mCanceled)
    {
      mFinished = true;
      cancelOperation = true;
    }
  }
  // Leave lock

  //    nsCOMPtr<nsIAbDirectoryQueryResult> queryResult;
  if (!cancelOperation)
  {
    switch (messageType)
    {
    case nsILDAPMessage::RES_BIND:
      rv = OnLDAPMessageBind(aMessage);
      if (NS_FAILED(rv)) 
        // We know the bind failed and hence the message has an error, so we
        // can just call ModifyResult with the message and that'll sort it out
        // for us.
        rv = OnLDAPMessageModifyResult(aMessage);
      break;
    case nsILDAPMessage::RES_ADD:
    case nsILDAPMessage::RES_MODIFY:
    case nsILDAPMessage::RES_DELETE:
      rv = OnLDAPMessageModifyResult(aMessage);
      break;
    case nsILDAPMessage::RES_MODDN:
      mFlagRename = false;
      rv = OnLDAPMessageRenameResult(aMessage);
      if (NS_FAILED(rv)) 
        // Rename failed, so we stop here
        mFinished = true;
      break;
    default:
      break;
    }
  }
  else
  {
    if (mModifyOperation)
      rv = mModifyOperation->AbandonExt();

    // reset because we might re-use this listener...except don't do this
    // until the search is done, so we'll ignore results from a previous
    // search.
    mCanceled = mFinished = false;
  }

  return rv;
}

void nsAbModifyLDAPMessageListener::InitFailed(bool aCancelled)
{
  // XXX Just cancel the operation for now
  // we'll need to review this when we've got the proper listeners in place.
  Cancel();
}

nsresult nsAbModifyLDAPMessageListener::DoTask()
{
  nsresult rv;
  mCanceled = mFinished = false;

  mModifyOperation = do_CreateInstance(NS_LDAPOPERATION_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = mModifyOperation->Init (mConnection, this, nullptr);
  NS_ENSURE_SUCCESS(rv, rv);

  // XXX do we need the search controls?
  rv = mModifyOperation->SetServerControls(mServerSearchControls);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = mModifyOperation->SetClientControls(mClientSearchControls);
  NS_ENSURE_SUCCESS(rv, rv);

  if (mFlagRename)
    return mModifyOperation->Rename(mCardDN, mNewRDN, mNewBaseDN, true);

  switch (mType)
  {
    case nsILDAPModification::MOD_ADD:
      return mModifyOperation->AddExt(mCardDN, mModification);
    case nsILDAPModification::MOD_DELETE:
      return mModifyOperation->DeleteExt(mCardDN);
    case nsILDAPModification::MOD_REPLACE:
      return mModifyOperation->ModifyExt(mCardDN, mModification);
    default:
      NS_ERROR("Bad LDAP modification requested");
      return NS_ERROR_UNEXPECTED;
  }
}

nsresult nsAbModifyLDAPMessageListener::OnLDAPMessageModifyResult(nsILDAPMessage *aMessage)
{
  nsresult rv;
  NS_ENSURE_ARG_POINTER(aMessage);
  
  int32_t errCode;
  rv = aMessage->GetErrorCode(&errCode);
  NS_ENSURE_SUCCESS(rv, rv);
 
  if (errCode != nsILDAPErrors::SUCCESS)
  {
    nsAutoCString errMessage;
    rv = aMessage->GetErrorMessage(errMessage);
    NS_ENSURE_SUCCESS(rv, rv);

    printf("LDAP modification failed (code: %i, message: %s)\n",
           errCode, errMessage.get());
    return NS_ERROR_FAILURE;
  }
  
  printf("LDAP modification succeeded\n");
  return NS_OK;
}

nsresult nsAbModifyLDAPMessageListener::OnLDAPMessageRenameResult(nsILDAPMessage *aMessage)
{
  nsresult rv;
  NS_ENSURE_ARG_POINTER(aMessage);
  
  int32_t errCode;
  rv = aMessage->GetErrorCode(&errCode);
  NS_ENSURE_SUCCESS(rv, rv);

  if (errCode != nsILDAPErrors::SUCCESS)
  {
    nsAutoCString errMessage;
    rv = aMessage->GetErrorMessage(errMessage);
    NS_ENSURE_SUCCESS(rv, rv);

    printf("LDAP rename failed (code: %i, message: %s)\n",
           errCode, errMessage.get());
    return NS_ERROR_FAILURE;
  }
  
  // Rename succeeded, now update the card DN and
  // process the main task
  mCardDN.Assign(mNewRDN);
  mCardDN.AppendLiteral(",");
  mCardDN.Append(mNewBaseDN);
     
  printf("LDAP rename succeeded\n");
  return DoTask();
}
 
nsAbLDAPDirectoryModify::nsAbLDAPDirectoryModify()
{
}

nsAbLDAPDirectoryModify::~nsAbLDAPDirectoryModify()
{
}

nsresult nsAbLDAPDirectoryModify::DoModify(nsIAbLDAPDirectory *directory,
                                           const int32_t &updateType,
                                           const nsACString &cardDN,
                                           nsIArray* modArray,
                                           const nsACString &newRDN,
                                           const nsACString &newBaseDN)
{
  NS_ENSURE_ARG_POINTER(directory);
  // modArray may be null in the delete operation case.
  if (!modArray &&
      (updateType == nsILDAPModification::MOD_ADD ||
       updateType == nsILDAPModification::MOD_REPLACE))
    return NS_ERROR_NULL_POINTER;

  nsresult rv;

  // it's an error if we don't have a dn
  if (cardDN.IsEmpty())
    return NS_ERROR_INVALID_ARG;
 
  nsCOMPtr<nsILDAPURL> currentUrl;
  rv = directory->GetLDAPURL(getter_AddRefs(currentUrl));
  NS_ENSURE_SUCCESS(rv, rv);

  // Get the ldap connection
  nsCOMPtr<nsILDAPConnection> ldapConnection =
    do_CreateInstance(NS_LDAPCONNECTION_CONTRACTID, &rv);
  
  nsCOMPtr<nsIMutableArray> serverSearchControls;
  rv = directory->GetSearchServerControls(getter_AddRefs(serverSearchControls));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIMutableArray> clientSearchControls;
  rv = directory->GetSearchClientControls(getter_AddRefs(clientSearchControls));
  NS_ENSURE_SUCCESS(rv, rv);

  /*
  // XXX we need to fix how this all works - specifically, see the first patch
  // on bug 124553 for how the query equivalent did this
  // too soon? Do we need a new listener?
  if (alreadyInitialized)
  {
    nsAbQueryLDAPMessageListener *msgListener =
      NS_STATIC_CAST(nsAbQueryLDAPMessageListener *, 
                     NS_STATIC_CAST(nsILDAPMessageListener *, mListener.get()));
    if (msgListener)
      {
        msgListener->mUrl = url;
        return msgListener->DoSearch();
      }
  }*/

  nsCString login;
  rv = directory->GetAuthDn(login);
  NS_ENSURE_SUCCESS(rv, rv);

  uint32_t protocolVersion;
  rv = directory->GetProtocolVersion(&protocolVersion);
  NS_ENSURE_SUCCESS(rv, rv);

  // Initiate LDAP message listener
  nsAbModifyLDAPMessageListener* _messageListener =
    new nsAbModifyLDAPMessageListener(updateType, cardDN, modArray,
                                      newRDN, newBaseDN,
                                      currentUrl,
                                      ldapConnection,
                                      serverSearchControls,
                                      clientSearchControls,
                                      login,
                                      0);
  if (_messageListener == NULL)
    return NS_ERROR_OUT_OF_MEMORY;
  
  // Now lets initialize the LDAP connection properly. We'll kick
  // off the bind operation in the callback function, |OnLDAPInit()|.
  return ldapConnection->Init(currentUrl, login,
                              _messageListener, nullptr, protocolVersion);
}

