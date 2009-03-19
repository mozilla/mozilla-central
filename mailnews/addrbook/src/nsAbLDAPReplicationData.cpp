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
 * Rajiv Dayal <rdayal@netscape.com>
 * Portions created by the Initial Developer are Copyright (C) 2002
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Dan Mosedale <dan.mosedale@oracle.com>
 *  Mark Banner <bugzilla@standard8.demon.co.uk>
 *  Simon Willkinson <simon@sxw.org.uk>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

#include "nsILDAPMessage.h"
#include "nsAbLDAPReplicationData.h"
#include "nsIAbCard.h"
#include "nsAbBaseCID.h"
#include "nsAbUtils.h"
#include "nsAbLDAPReplicationQuery.h"
#include "nsProxiedService.h"
#include "nsIRDFService.h"
#include "nsIRDFResource.h"
#include "nsILDAPErrors.h"
#include "nsComponentManagerUtils.h"
#include "nsXPCOMCIDInternal.h"

// once bug # 101252 gets fixed, this should be reverted back to be non threadsafe
// implementation is not really thread safe since each object should exist 
// independently along with its related independent nsAbLDAPReplicationQuery object.
NS_IMPL_THREADSAFE_ISUPPORTS2(nsAbLDAPProcessReplicationData, nsIAbLDAPProcessReplicationData, nsILDAPMessageListener)

nsAbLDAPProcessReplicationData::nsAbLDAPProcessReplicationData() :
  nsAbLDAPListenerBase(),
  mState(kIdle),
  mProtocol(-1),
  mCount(0),
  mDBOpen(PR_FALSE),
  mInitialized(PR_FALSE)
{
}

nsAbLDAPProcessReplicationData::~nsAbLDAPProcessReplicationData()
{
  /* destructor code */
  if(mDBOpen && mReplicationDB)
      mReplicationDB->Close(PR_FALSE);
}

NS_IMETHODIMP nsAbLDAPProcessReplicationData::Init(
  nsIAbLDAPDirectory *aDirectory,
  nsILDAPConnection *aConnection,
  nsILDAPURL* aURL,
  nsIAbLDAPReplicationQuery *aQuery,
  nsIWebProgressListener *aProgressListener)
{
  NS_ENSURE_ARG_POINTER(aDirectory);
  NS_ENSURE_ARG_POINTER(aConnection);
  NS_ENSURE_ARG_POINTER(aURL);
  NS_ENSURE_ARG_POINTER(aQuery);

  mDirectory = aDirectory;
  mConnection = aConnection;
  mDirectoryUrl = aURL;
  mQuery = aQuery;

  mListener = aProgressListener;

  nsresult rv = mDirectory->GetAttributeMap(getter_AddRefs(mAttrMap));
  if (NS_FAILED(rv)) {
    mQuery = nsnull;
    return rv;
  }

  rv = mDirectory->GetAuthDn(mLogin);
  if (NS_FAILED(rv)) {
    mQuery = nsnull;
    return rv;
  }
  
  rv = mDirectory->GetSaslMechanism(mSaslMechanism);
  if (NS_FAILED(rv)) {
    mQuery = nsnull;
    return rv;
  }

  mInitialized = PR_TRUE;

  return rv;
}

NS_IMETHODIMP nsAbLDAPProcessReplicationData::GetReplicationState(PRInt32 *aReplicationState) 
{
    NS_ENSURE_ARG_POINTER(aReplicationState);
    *aReplicationState = mState; 
    return NS_OK; 
}

NS_IMETHODIMP nsAbLDAPProcessReplicationData::GetProtocolUsed(PRInt32 *aProtocolUsed) 
{
    NS_ENSURE_ARG_POINTER(aProtocolUsed);
    *aProtocolUsed = mProtocol; 
    return NS_OK; 
}

NS_IMETHODIMP nsAbLDAPProcessReplicationData::OnLDAPMessage(nsILDAPMessage *aMessage)
{
  NS_ENSURE_ARG_POINTER(aMessage);

  if (!mInitialized)
    return NS_ERROR_NOT_INITIALIZED;

  PRInt32 messageType;
  nsresult rv = aMessage->GetType(&messageType);
  if (NS_FAILED(rv)) {
    Done(PR_FALSE);
    return rv;
  }

  switch (messageType)
  {
  case nsILDAPMessage::RES_BIND:
    rv = OnLDAPMessageBind(aMessage);
    if (NS_FAILED(rv))
      rv = Abort();
    break;
  case nsILDAPMessage::RES_SEARCH_ENTRY:
    rv = OnLDAPSearchEntry(aMessage);
    break;
  case nsILDAPMessage::RES_SEARCH_RESULT:
    rv = OnLDAPSearchResult(aMessage);
    break;
  default:
    // for messageTypes we do not handle return NS_OK to LDAP and move ahead.
    rv = NS_OK;
    break;
  }

  return rv;
}

NS_IMETHODIMP nsAbLDAPProcessReplicationData::Abort()
{
  if (!mInitialized)
    return NS_ERROR_NOT_INITIALIZED;

  nsresult rv = NS_OK;

  if (mState != kIdle && mOperation) {
    rv = mOperation->AbandonExt();
    if (NS_SUCCEEDED(rv))
      mState = kIdle;
  }

  if (mReplicationDB && mDBOpen) {
    // force close since we need to delete the file.
    mReplicationDB->ForceClosed();
    mDBOpen = PR_FALSE;

    // delete the unsaved replication file
    if (mReplicationFile) {
      rv = mReplicationFile->Remove(PR_FALSE);
      if (NS_SUCCEEDED(rv) && mDirectory) {
        nsCAutoString fileName;
        rv = mDirectory->GetReplicationFileName(fileName);
        // now put back the backed up replicated file if aborted
        if (NS_SUCCEEDED(rv) && mBackupReplicationFile)
          rv = mBackupReplicationFile->MoveToNative(nsnull, fileName);
      }
    }
  }

  Done(PR_FALSE);

  return rv;
}

nsresult nsAbLDAPProcessReplicationData::DoTask()
{
  if (!mInitialized)
    return NS_ERROR_NOT_INITIALIZED;

  nsresult rv = OpenABForReplicatedDir(PR_TRUE);
  if (NS_FAILED(rv))
    // do not call done here since it is called by OpenABForReplicationDir
    return rv;

  mOperation = do_CreateInstance(NS_LDAPOPERATION_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIProxyObjectManager> proxyObjMgr = do_GetService(NS_XPCOMPROXY_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsILDAPMessageListener> proxyListener;
  rv = proxyObjMgr->GetProxyForObject(NS_PROXY_TO_MAIN_THREAD,
                            NS_GET_IID(nsILDAPMessageListener),
                            static_cast<nsILDAPMessageListener*>(this),
                            NS_PROXY_SYNC | NS_PROXY_ALWAYS,
                            getter_AddRefs(proxyListener));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = mOperation->Init(mConnection, proxyListener, nsnull);
  NS_ENSURE_SUCCESS(rv, rv);

  // get the relevant attributes associated with the directory server url
  nsCAutoString urlFilter;
  rv = mDirectoryUrl->GetFilter(urlFilter);
  if (NS_FAILED(rv))
    return rv;

  nsCAutoString dn;
  rv = mDirectoryUrl->GetDn(dn);
  if (NS_FAILED(rv))
    return rv;

  if (dn.IsEmpty())
    return NS_ERROR_UNEXPECTED;

  PRInt32 scope;
  rv = mDirectoryUrl->GetScope(&scope);
  if (NS_FAILED(rv))
    return rv;

  CharPtrArrayGuard attributes;
  rv = mDirectoryUrl->GetAttributes(attributes.GetSizeAddr(),
                                    attributes.GetArrayAddr());
  if (NS_FAILED(rv))
    return rv;

  mState = kReplicatingAll;

  if (mListener && NS_SUCCEEDED(rv))
    mListener->OnStateChange(nsnull, nsnull,
                             nsIWebProgressListener::STATE_START, PR_TRUE);

  return mOperation->SearchExt(dn, scope, urlFilter,
                               attributes.GetSize(), attributes.GetArray(),
                               0, 0);
}

void nsAbLDAPProcessReplicationData::InitFailed(PRBool aCancelled)
{
  // Just call Done() which will ensure everything is tidied up nicely.
  Done(PR_FALSE);
}

nsresult nsAbLDAPProcessReplicationData::OnLDAPSearchEntry(nsILDAPMessage *aMessage)
{
    NS_ENSURE_ARG_POINTER(aMessage);
    if (!mInitialized)
        return NS_ERROR_NOT_INITIALIZED;
    // since this runs on the main thread and is single threaded, this will 
    // take care of entries returned by LDAP Connection thread after Abort.
    if (!mReplicationDB || !mDBOpen)
        return NS_ERROR_FAILURE;

    nsresult rv = NS_OK;

    // Although we would may naturally create an nsIAbLDAPCard here, we don't
    // need to as we are writing this straight to the database, so just create
    // the database version instead.
    nsCOMPtr<nsIAbCard> newCard(do_CreateInstance(NS_ABMDBCARD_CONTRACTID,
                                                  &rv));
    if (NS_FAILED(rv)) {
      Abort();
      return rv;
    }

    rv = mAttrMap->SetCardPropertiesFromLDAPMessage(aMessage, newCard);
    if (NS_FAILED(rv))
    {
        NS_WARNING("nsAbLDAPProcessReplicationData::OnLDAPSearchEntry"
           "No card properties could be set");
        // if some entries are bogus for us, continue with next one
        return NS_OK;
    }

    rv = mReplicationDB->CreateNewCardAndAddToDB(newCard, PR_FALSE, nsnull);
    if(NS_FAILED(rv)) {
        Abort();
        return rv;
    }

    // now set the attribute for the DN of the entry in the card in the DB
    nsCAutoString authDN;
    rv = aMessage->GetDn(authDN);
    if(NS_SUCCEEDED(rv) && !authDN.IsEmpty())
    {
        newCard->SetPropertyAsAUTF8String("_DN", authDN);
    }

    rv = mReplicationDB->EditCard(newCard, PR_FALSE, nsnull);
    if(NS_FAILED(rv)) {
        Abort();
        return rv;
    }
    

    mCount ++;

    if (mListener && !(mCount % 10)) // inform the listener every 10 entries
    {
        mListener->OnProgressChange(nsnull,nsnull,mCount, -1, mCount, -1);
        // in case if the LDAP Connection thread is starved and causes problem
        // uncomment this one and try.
        // PR_Sleep(PR_INTERVAL_NO_WAIT); // give others a chance
    }

    return rv;
}


nsresult nsAbLDAPProcessReplicationData::OnLDAPSearchResult(nsILDAPMessage *aMessage)
{
#ifdef DEBUG_rdayal
    printf("LDAP Replication : Got Results for Completion");
#endif

    NS_ENSURE_ARG_POINTER(aMessage);
    if(!mInitialized) 
        return NS_ERROR_NOT_INITIALIZED;

    PRInt32 errorCode;
    nsresult rv = aMessage->GetErrorCode(&errorCode);

    if(NS_SUCCEEDED(rv)) {
        // We are done with the LDAP search for all entries.
        if(errorCode == nsILDAPErrors::SUCCESS || errorCode == nsILDAPErrors::SIZELIMIT_EXCEEDED) {
            Done(PR_TRUE);
            if(mReplicationDB && mDBOpen) {
                rv = mReplicationDB->Close(PR_TRUE);
                NS_ASSERTION(NS_SUCCEEDED(rv), "Replication DB Close on Success failed");
                mDBOpen = PR_FALSE;
                // once we have saved the new replication file, delete the backup file
                if(mBackupReplicationFile)
                {
                    rv = mBackupReplicationFile->Remove(PR_FALSE);
                    NS_ASSERTION(NS_SUCCEEDED(rv), "Replication BackupFile Remove on Success failed");
                }
            }
            return NS_OK;
        }
    }

    // in case if GetErrorCode returned error or errorCode is not SUCCESS / SIZELIMIT_EXCEEDED
    if(mReplicationDB && mDBOpen) {
        // if error result is returned close the DB without saving ???
        // should we commit anyway ??? whatever is returned is not lost then !!
        rv = mReplicationDB->ForceClosed(); // force close since we need to delete the file.
        NS_ASSERTION(NS_SUCCEEDED(rv), "Replication DB ForceClosed on Failure failed");
        mDBOpen = PR_FALSE;
        // if error result is returned remove the replicated file
        if(mReplicationFile) {
            rv = mReplicationFile->Remove(PR_FALSE);
            NS_ASSERTION(NS_SUCCEEDED(rv), "Replication File Remove on Failure failed");
            if(NS_SUCCEEDED(rv)) {
                // now put back the backed up replicated file
                if(mBackupReplicationFile && mDirectory) 
                {
                  nsCAutoString fileName;
                  rv = mDirectory->GetReplicationFileName(fileName);
                  if (NS_SUCCEEDED(rv) && !fileName.IsEmpty())
                  {
                    rv = mBackupReplicationFile->MoveToNative(nsnull, fileName);
                    NS_ASSERTION(NS_SUCCEEDED(rv), "Replication Backup File Move back on Failure failed");
                  }
                }
            }
        }
        Done(PR_FALSE);
    }

    return NS_OK;
}

nsresult nsAbLDAPProcessReplicationData::OpenABForReplicatedDir(PRBool aCreate)
{
  if (!mInitialized)
    return NS_ERROR_NOT_INITIALIZED;

  nsresult rv = mDirectory->GetReplicationFile(getter_AddRefs(mReplicationFile));
  if (NS_FAILED(rv))
  {
     Done(PR_FALSE);
     return NS_ERROR_FAILURE;
  }

  nsCString fileName;
  rv = mReplicationFile->GetNativeLeafName(fileName);
  if (NS_FAILED(rv)) {
    Done(PR_FALSE);
    return rv;
  }

    // if the AB DB already exists backup existing one, 
    // in case if the user cancels or Abort put back the backed up file
    PRBool fileExists;
    rv = mReplicationFile->Exists(&fileExists);
    if(NS_SUCCEEDED(rv) && fileExists) {
        // create the backup file object same as the Replication file object.
        // we create a backup file here since we need to cleanup the existing file
        // for create and then commit so instead of deleting existing cards we just
        // clone the existing one for a much better performance - for Download All.
        // And also important in case if replication fails we donot lose user's existing 
        // replicated data for both Download all and Changelog.
        nsCOMPtr<nsIFile> clone;
        rv = mReplicationFile->Clone(getter_AddRefs(clone));
        if(NS_FAILED(rv))  {
            Done(PR_FALSE);
            return rv;
        }
        mBackupReplicationFile = do_QueryInterface(clone, &rv);
        if(NS_FAILED(rv))  {
            Done(PR_FALSE);
            return rv;
        }
        rv = mBackupReplicationFile->CreateUnique(nsIFile::NORMAL_FILE_TYPE, 0777);
        if(NS_FAILED(rv))  {
            Done(PR_FALSE);
            return rv;
        }
        nsAutoString backupFileLeafName;
        rv = mBackupReplicationFile->GetLeafName(backupFileLeafName);
        if(NS_FAILED(rv))  {
            Done(PR_FALSE);
            return rv;
        }
        // remove the newly created unique backup file so that move and copy succeeds.
        rv = mBackupReplicationFile->Remove(PR_FALSE);
        if(NS_FAILED(rv))  {
            Done(PR_FALSE);
            return rv;
        }

        if(aCreate) {
            // set backup file to existing replication file for move
            mBackupReplicationFile->SetNativeLeafName(fileName);

            rv = mBackupReplicationFile->MoveTo(nsnull, backupFileLeafName);
            // set the backup file leaf name now
            if (NS_SUCCEEDED(rv))
                mBackupReplicationFile->SetLeafName(backupFileLeafName);
        }
        else {
            // set backup file to existing replication file for copy
            mBackupReplicationFile->SetNativeLeafName(fileName);

            // specify the parent here specifically, 
            // passing nsnull to copy to the same dir actually renames existing file
            // instead of making another copy of the existing file.
            nsCOMPtr<nsIFile> parent;
            rv = mBackupReplicationFile->GetParent(getter_AddRefs(parent));
            if (NS_SUCCEEDED(rv))
                rv = mBackupReplicationFile->CopyTo(parent, backupFileLeafName);
            // set the backup file leaf name now
            if (NS_SUCCEEDED(rv))
                mBackupReplicationFile->SetLeafName(backupFileLeafName);
        }
        if(NS_FAILED(rv))  {
            Done(PR_FALSE);
            return rv;
        }
    }

    nsCOMPtr<nsIAddrDatabase> addrDBFactory = 
             do_GetService(NS_ADDRDATABASE_CONTRACTID, &rv);
    if(NS_FAILED(rv)) {
        if (mBackupReplicationFile)
            mBackupReplicationFile->Remove(PR_FALSE);
        Done(PR_FALSE);
        return rv;
    }
    
    rv = addrDBFactory->Open(mReplicationFile, aCreate, PR_TRUE, getter_AddRefs(mReplicationDB));
    if(NS_FAILED(rv)) {
        Done(PR_FALSE);
        if (mBackupReplicationFile)
            mBackupReplicationFile->Remove(PR_FALSE);
        return rv;
    }

    mDBOpen = PR_TRUE;  // replication DB is now Open
    return rv;
}

void nsAbLDAPProcessReplicationData::Done(PRBool aSuccess)
{
   if (!mInitialized) 
       return;

   mState = kReplicationDone;

   if (mQuery)
     mQuery->Done(aSuccess);

   if (mListener)
       mListener->OnStateChange(nsnull, nsnull, nsIWebProgressListener::STATE_STOP, aSuccess);

   // since this is called when all is done here, either on success,
   // failure or abort release the query now.
   mQuery = nsnull;
}

nsresult nsAbLDAPProcessReplicationData::DeleteCard(nsString & aDn)
{
    nsCOMPtr<nsIAbCard> cardToDelete;
    mReplicationDB->GetCardFromAttribute(nsnull, "_DN", NS_ConvertUTF16toUTF8(aDn),
                                         PR_FALSE, getter_AddRefs(cardToDelete));
    return mReplicationDB->DeleteCard(cardToDelete, PR_FALSE, nsnull);
}
