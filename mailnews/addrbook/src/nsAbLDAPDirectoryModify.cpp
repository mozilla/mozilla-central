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
 *   Mark Banner <bugzilla@standard8.plus.com>
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

#include "nsAbLDAPDirectoryModify.h"
#include "nsAutoLock.h"
#include "nsILDAPMessage.h"
#include "nsILDAPConnection.h"
#include "nsILDAPErrors.h"
#include "nsILDAPModification.h"
#include "nsIServiceManager.h"
#include "nsIProxyObjectManager.h"
#include "nsIAbLDAPDirectory.h"
#include "nsIMutableArray.h"
#include "nsComponentManagerUtils.h"
#include "nsServiceManagerUtils.h"
#include "nsXPCOMCIDInternal.h"

#include <stdio.h>

class nsAbModifyLDAPMessageListener : public nsAbLDAPListenerBase
{
public:
  NS_DECL_ISUPPORTS

  nsAbModifyLDAPMessageListener(const PRInt32 type,
                                const nsACString &cardDN,
                                nsIArray* modArray,
                                const nsACString &newRDN,
                                const nsACString &newBaseDN,
                                nsILDAPURL* directoryUrl,
                                nsILDAPConnection* connection,
                                nsIMutableArray* serverSearchControls,
                                nsIMutableArray* clientSearchControls,
                                const nsACString &login,
                                const PRInt32 timeOut = 0);
  virtual ~nsAbModifyLDAPMessageListener();

  // nsILDAPMessageListener
  NS_IMETHOD OnLDAPMessage(nsILDAPMessage *aMessage);

protected:
  nsresult Cancel();
  virtual void InitFailed(PRBool aCancelled = PR_FALSE);
  virtual nsresult DoTask();
  nsresult DoMainTask();
  nsresult OnLDAPMessageModifyResult(nsILDAPMessage *aMessage);
  nsresult OnLDAPMessageRenameResult(nsILDAPMessage *aMessage);

  PRInt32 mType;
  nsCString mCardDN;
  nsCOMPtr<nsIArray> mModification;
  nsCString mNewRDN;
  nsCString mNewBaseDN;

  PRBool mFinished;
  PRBool mCanceled;
  PRBool mFlagRename;

  nsCOMPtr<nsILDAPOperation> mModifyOperation;
  nsCOMPtr<nsIMutableArray> mServerSearchControls;
  nsCOMPtr<nsIMutableArray> mClientSearchControls;
};


NS_IMPL_THREADSAFE_ISUPPORTS1(nsAbModifyLDAPMessageListener, nsILDAPMessageListener)

nsAbModifyLDAPMessageListener::nsAbModifyLDAPMessageListener(
    const PRInt32 type,
    const nsACString &cardDN,
    nsIArray* modArray,
    const nsACString &newRDN,
    const nsACString &newBaseDN,
    nsILDAPURL* directoryUrl,
    nsILDAPConnection* connection,
    nsIMutableArray* serverSearchControls,
    nsIMutableArray* clientSearchControls,
    const nsACString &login,
    const PRInt32 timeOut) :
    nsAbLDAPListenerBase(directoryUrl, connection, login, timeOut),
    mType(type),
    mCardDN(cardDN),
    mModification(modArray),
    mNewRDN(newRDN),
    mNewBaseDN(newBaseDN),
    mFinished(PR_FALSE),
    mCanceled(PR_FALSE),
    mFlagRename(PR_FALSE),
    mServerSearchControls(serverSearchControls),
    mClientSearchControls(clientSearchControls)
{
  if (mType == nsILDAPModification::MOD_REPLACE &&
      !mNewRDN.IsEmpty() && !mNewBaseDN.IsEmpty())
    mFlagRename = PR_TRUE;
}

nsAbModifyLDAPMessageListener::~nsAbModifyLDAPMessageListener ()
{
}

nsresult nsAbModifyLDAPMessageListener::Cancel ()
{
  nsresult rv = Initiate();
  NS_ENSURE_SUCCESS(rv, rv);

  nsAutoLock lock(mLock);

  if (mFinished || mCanceled)
    return NS_OK;

  mCanceled = PR_TRUE;

  return NS_OK;
}

NS_IMETHODIMP nsAbModifyLDAPMessageListener::OnLDAPMessage(nsILDAPMessage *aMessage)
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

    // for these messages, no matter the outcome, we're done
    if ((messageType == nsILDAPMessage::RES_ADD) || 
        (messageType == nsILDAPMessage::RES_DELETE) ||
        (messageType == nsILDAPMessage::RES_MODIFY))
      mFinished = PR_TRUE;
    else if (mCanceled)
    {
      mFinished = PR_TRUE;
      cancelOperation = PR_TRUE;
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
      mFlagRename = PR_FALSE;
      rv = OnLDAPMessageRenameResult(aMessage);
      if (NS_FAILED(rv)) 
        // Rename failed, so we stop here
        mFinished = PR_TRUE;
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
    mCanceled = mFinished = PR_FALSE;
  }

  return rv;
}

void nsAbModifyLDAPMessageListener::InitFailed(PRBool aCancelled)
{
  // XXX Just cancel the operation for now
  // we'll need to review this when we've got the proper listeners in place.
  Cancel();
}

nsresult nsAbModifyLDAPMessageListener::DoTask()
{
  nsresult rv;
  mCanceled = mFinished = PR_FALSE;

  mModifyOperation = do_CreateInstance(NS_LDAPOPERATION_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIProxyObjectManager> proxyObjMgr = do_GetService(NS_XPCOMPROXY_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsILDAPMessageListener> proxyListener;
  rv = proxyObjMgr->GetProxyForObject( NS_PROXY_TO_MAIN_THREAD,
                             NS_GET_IID(nsILDAPMessageListener),
                             this, NS_PROXY_SYNC | NS_PROXY_ALWAYS,
                             getter_AddRefs(proxyListener));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = mModifyOperation->Init (mConnection, proxyListener, nsnull);
  NS_ENSURE_SUCCESS(rv, rv);

  // XXX do we need the search controls?
  rv = mModifyOperation->SetServerControls(mServerSearchControls);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = mModifyOperation->SetClientControls(mClientSearchControls);
  NS_ENSURE_SUCCESS(rv, rv);

  if (mFlagRename)
    return mModifyOperation->Rename(mCardDN, mNewRDN, mNewBaseDN, PR_TRUE);

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
  
  PRInt32 errCode;
  rv = aMessage->GetErrorCode(&errCode);
  NS_ENSURE_SUCCESS(rv, rv);
 
  if (errCode != nsILDAPErrors::SUCCESS)
  {
    nsCAutoString errMessage;
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
  
  PRInt32 errCode;
  rv = aMessage->GetErrorCode(&errCode);
  NS_ENSURE_SUCCESS(rv, rv);

  if (errCode != nsILDAPErrors::SUCCESS)
  {
    nsCAutoString errMessage;
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
                                           const PRInt32 &updateType,
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

  PRUint32 protocolVersion;
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
                              _messageListener, nsnull, protocolVersion);
}

