/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsILDAPMessage.h"
#include "nsAbLDAPReplicationData.h"
#include "nsIAbCard.h"
#include "nsAbBaseCID.h"
#include "nsAbUtils.h"
#include "nsAbLDAPReplicationQuery.h"
#include "nsILDAPErrors.h"
#include "nsComponentManagerUtils.h"
#include "nsMsgUtils.h"

// once bug # 101252 gets fixed, this should be reverted back to be non threadsafe
// implementation is not really thread safe since each object should exist 
// independently along with its related independent nsAbLDAPReplicationQuery object.
NS_IMPL_ISUPPORTS2(nsAbLDAPProcessReplicationData, nsIAbLDAPProcessReplicationData, nsILDAPMessageListener)

nsAbLDAPProcessReplicationData::nsAbLDAPProcessReplicationData() :
  nsAbLDAPListenerBase(),
  mState(kIdle),
  mProtocol(-1),
  mCount(0),
  mDBOpen(false),
  mInitialized(false)
{
}

nsAbLDAPProcessReplicationData::~nsAbLDAPProcessReplicationData()
{
  /* destructor code */
  if(mDBOpen && mReplicationDB)
      mReplicationDB->Close(false);
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
    mQuery = nullptr;
    return rv;
  }

  rv = mDirectory->GetAuthDn(mLogin);
  if (NS_FAILED(rv)) {
    mQuery = nullptr;
    return rv;
  }
  
  rv = mDirectory->GetSaslMechanism(mSaslMechanism);
  if (NS_FAILED(rv)) {
    mQuery = nullptr;
    return rv;
  }

  mInitialized = true;

  return rv;
}

NS_IMETHODIMP nsAbLDAPProcessReplicationData::GetReplicationState(int32_t *aReplicationState) 
{
    NS_ENSURE_ARG_POINTER(aReplicationState);
    *aReplicationState = mState; 
    return NS_OK; 
}

NS_IMETHODIMP nsAbLDAPProcessReplicationData::GetProtocolUsed(int32_t *aProtocolUsed) 
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

  int32_t messageType;
  nsresult rv = aMessage->GetType(&messageType);
  if (NS_FAILED(rv)) {
    Done(false);
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
    mDBOpen = false;

    // delete the unsaved replication file
    if (mReplicationFile) {
      rv = mReplicationFile->Remove(false);
      if (NS_SUCCEEDED(rv) && mDirectory) {
        nsAutoCString fileName;
        rv = mDirectory->GetReplicationFileName(fileName);
        // now put back the backed up replicated file if aborted
        if (NS_SUCCEEDED(rv) && mBackupReplicationFile)
          rv = mBackupReplicationFile->MoveToNative(nullptr, fileName);
      }
    }
  }

  Done(false);

  return rv;
}

nsresult nsAbLDAPProcessReplicationData::DoTask()
{
  if (!mInitialized)
    return NS_ERROR_NOT_INITIALIZED;

  nsresult rv = OpenABForReplicatedDir(true);
  if (NS_FAILED(rv))
    // do not call done here since it is called by OpenABForReplicationDir
    return rv;

  mOperation = do_CreateInstance(NS_LDAPOPERATION_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = mOperation->Init(mConnection, this, nullptr);
  NS_ENSURE_SUCCESS(rv, rv);

  // get the relevant attributes associated with the directory server url
  nsAutoCString urlFilter;
  rv = mDirectoryUrl->GetFilter(urlFilter);
  if (NS_FAILED(rv))
    return rv;

  nsAutoCString dn;
  rv = mDirectoryUrl->GetDn(dn);
  if (NS_FAILED(rv))
    return rv;

  if (dn.IsEmpty())
    return NS_ERROR_UNEXPECTED;

  int32_t scope;
  rv = mDirectoryUrl->GetScope(&scope);
  if (NS_FAILED(rv))
    return rv;

  nsAutoCString attributes;
  rv = mDirectoryUrl->GetAttributes(attributes);
  if (NS_FAILED(rv))
    return rv;

  mState = kReplicatingAll;

  if (mListener && NS_SUCCEEDED(rv))
    // XXX Cast from bool to nsresult
    mListener->OnStateChange(nullptr, nullptr,
                             nsIWebProgressListener::STATE_START,
                             static_cast<nsresult>(true));

  return mOperation->SearchExt(dn, scope, urlFilter, attributes, 0, 0);
}

void nsAbLDAPProcessReplicationData::InitFailed(bool aCancelled)
{
  // Just call Done() which will ensure everything is tidied up nicely.
  Done(false);
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

    rv = mReplicationDB->CreateNewCardAndAddToDB(newCard, false, nullptr);
    if(NS_FAILED(rv)) {
        Abort();
        return rv;
    }

    // now set the attribute for the DN of the entry in the card in the DB
    nsAutoCString authDN;
    rv = aMessage->GetDn(authDN);
    if(NS_SUCCEEDED(rv) && !authDN.IsEmpty())
    {
        newCard->SetPropertyAsAUTF8String("_DN", authDN);
    }

    rv = mReplicationDB->EditCard(newCard, false, nullptr);
    if(NS_FAILED(rv)) {
        Abort();
        return rv;
    }
    

    mCount ++;

    if (mListener && !(mCount % 10)) // inform the listener every 10 entries
    {
        mListener->OnProgressChange(nullptr,nullptr,mCount, -1, mCount, -1);
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

    int32_t errorCode;
    nsresult rv = aMessage->GetErrorCode(&errorCode);

    if(NS_SUCCEEDED(rv)) {
        // We are done with the LDAP search for all entries.
        if(errorCode == nsILDAPErrors::SUCCESS || errorCode == nsILDAPErrors::SIZELIMIT_EXCEEDED) {
            Done(true);
            if(mReplicationDB && mDBOpen) {
                rv = mReplicationDB->Close(true);
                NS_ASSERTION(NS_SUCCEEDED(rv), "Replication DB Close on Success failed");
                mDBOpen = false;
                // once we have saved the new replication file, delete the backup file
                if(mBackupReplicationFile)
                {
                    rv = mBackupReplicationFile->Remove(false);
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
        mDBOpen = false;
        // if error result is returned remove the replicated file
        if(mReplicationFile) {
            rv = mReplicationFile->Remove(false);
            NS_ASSERTION(NS_SUCCEEDED(rv), "Replication File Remove on Failure failed");
            if(NS_SUCCEEDED(rv)) {
                // now put back the backed up replicated file
                if(mBackupReplicationFile && mDirectory) 
                {
                  nsAutoCString fileName;
                  rv = mDirectory->GetReplicationFileName(fileName);
                  if (NS_SUCCEEDED(rv) && !fileName.IsEmpty())
                  {
                    rv = mBackupReplicationFile->MoveToNative(nullptr, fileName);
                    NS_ASSERTION(NS_SUCCEEDED(rv), "Replication Backup File Move back on Failure failed");
                  }
                }
            }
        }
        Done(false);
    }

    return NS_OK;
}

nsresult nsAbLDAPProcessReplicationData::OpenABForReplicatedDir(bool aCreate)
{
  if (!mInitialized)
    return NS_ERROR_NOT_INITIALIZED;

  nsresult rv = mDirectory->GetReplicationFile(getter_AddRefs(mReplicationFile));
  if (NS_FAILED(rv))
  {
     Done(false);
     return NS_ERROR_FAILURE;
  }

  nsCString fileName;
  rv = mReplicationFile->GetNativeLeafName(fileName);
  if (NS_FAILED(rv)) {
    Done(false);
    return rv;
  }

    // if the AB DB already exists backup existing one, 
    // in case if the user cancels or Abort put back the backed up file
    bool fileExists;
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
            Done(false);
            return rv;
        }
        mBackupReplicationFile = do_QueryInterface(clone, &rv);
        if(NS_FAILED(rv))  {
            Done(false);
            return rv;
        }
        rv = mBackupReplicationFile->CreateUnique(nsIFile::NORMAL_FILE_TYPE, 0777);
        if(NS_FAILED(rv))  {
            Done(false);
            return rv;
        }
        nsAutoString backupFileLeafName;
        rv = mBackupReplicationFile->GetLeafName(backupFileLeafName);
        if(NS_FAILED(rv))  {
            Done(false);
            return rv;
        }
        // remove the newly created unique backup file so that move and copy succeeds.
        rv = mBackupReplicationFile->Remove(false);
        if(NS_FAILED(rv))  {
            Done(false);
            return rv;
        }

        if(aCreate) {
            // set backup file to existing replication file for move
            mBackupReplicationFile->SetNativeLeafName(fileName);

            rv = mBackupReplicationFile->MoveTo(nullptr, backupFileLeafName);
            // set the backup file leaf name now
            if (NS_SUCCEEDED(rv))
                mBackupReplicationFile->SetLeafName(backupFileLeafName);
        }
        else {
            // set backup file to existing replication file for copy
            mBackupReplicationFile->SetNativeLeafName(fileName);

            // specify the parent here specifically, 
            // passing nullptr to copy to the same dir actually renames existing file
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
            Done(false);
            return rv;
        }
    }

    nsCOMPtr<nsIAddrDatabase> addrDBFactory = 
             do_GetService(NS_ADDRDATABASE_CONTRACTID, &rv);
    if(NS_FAILED(rv)) {
        if (mBackupReplicationFile)
            mBackupReplicationFile->Remove(false);
        Done(false);
        return rv;
    }
    
    rv = addrDBFactory->Open(mReplicationFile, aCreate, true, getter_AddRefs(mReplicationDB));
    if(NS_FAILED(rv)) {
        Done(false);
        if (mBackupReplicationFile)
            mBackupReplicationFile->Remove(false);
        return rv;
    }

    mDBOpen = true;  // replication DB is now Open
    return rv;
}

void nsAbLDAPProcessReplicationData::Done(bool aSuccess)
{
   if (!mInitialized) 
       return;

   mState = kReplicationDone;

   if (mQuery)
     mQuery->Done(aSuccess);

   if (mListener)
       // XXX Cast from bool to nsresult
       mListener->OnStateChange(nullptr, nullptr,
           nsIWebProgressListener::STATE_STOP,
           static_cast<nsresult>(aSuccess));

   // since this is called when all is done here, either on success,
   // failure or abort release the query now.
   mQuery = nullptr;
}

nsresult nsAbLDAPProcessReplicationData::DeleteCard(nsString & aDn)
{
    nsCOMPtr<nsIAbCard> cardToDelete;
    mReplicationDB->GetCardFromAttribute(nullptr, "_DN", NS_ConvertUTF16toUTF8(aDn),
                                         false, getter_AddRefs(cardToDelete));
    return mReplicationDB->DeleteCard(cardToDelete, false, nullptr);
}
