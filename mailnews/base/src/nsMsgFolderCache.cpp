/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1999
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Pierre Phaneuf <pp@ludusdesign.com>
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

#include "msgCore.h"
#include "nsIMsgAccountManager.h"
#include "nsMsgFolderCacheElement.h"
#include "nsMsgFolderCache.h"
#include "nsMorkCID.h"
#include "nsIMdbFactoryFactory.h"
#include "nsMsgBaseCID.h"

const char *kFoldersScope = "ns:msg:db:row:scope:folders:all";	// scope for all folders table
const char *kFoldersTableKind = "ns:msg:db:table:kind:folders";

nsMsgFolderCache::nsMsgFolderCache()
{
  m_mdbEnv = nsnull;
  m_mdbStore = nsnull;
  m_mdbAllFoldersTable = nsnull;
}

// should this, could this be an nsCOMPtr ?
static nsIMdbFactory *gMDBFactory = nsnull;

nsMsgFolderCache::~nsMsgFolderCache()
{
  m_cacheElements.Clear(); // make sure the folder cache elements are released before we release our m_mdb objects...
  if (m_mdbAllFoldersTable)
    m_mdbAllFoldersTable->Release();
  if (m_mdbStore)
    m_mdbStore->Release();
  NS_IF_RELEASE(gMDBFactory);
  if (m_mdbEnv)
    m_mdbEnv->Release();
}


NS_IMPL_ISUPPORTS1(nsMsgFolderCache, nsIMsgFolderCache)

void nsMsgFolderCache::GetMDBFactory(nsIMdbFactory ** aMdbFactory)
{
  if (!mMdbFactory)
  {
    nsresult rv;
    nsCOMPtr <nsIMdbFactoryService> mdbFactoryService = do_GetService(NS_MORK_CONTRACTID, &rv);
    if (NS_SUCCEEDED(rv) && mdbFactoryService)
      rv = mdbFactoryService->GetMdbFactory(getter_AddRefs(mMdbFactory));
  }
  NS_IF_ADDREF(*aMdbFactory = mMdbFactory);
}

// initialize the various tokens and tables in our db's env
nsresult nsMsgFolderCache::InitMDBInfo()
{
  nsresult err = NS_OK;
  if (GetStore())
  {
    err = GetStore()->StringToToken(GetEnv(), kFoldersScope, &m_folderRowScopeToken);
    if (NS_SUCCEEDED(err))
    {
      err = GetStore()->StringToToken(GetEnv(), kFoldersTableKind, &m_folderTableKindToken);
      if (NS_SUCCEEDED(err))
      {
        // The table of all message hdrs will have table id 1.
        m_allFoldersTableOID.mOid_Scope = m_folderRowScopeToken;
        m_allFoldersTableOID.mOid_Id = 1;
      }
    }
  }
  return err;
}

// set up empty tables, dbFolderInfo, etc.
nsresult nsMsgFolderCache::InitNewDB()
{
  nsresult err = InitMDBInfo();
  if (NS_SUCCEEDED(err))
  {
    nsIMdbStore *store = GetStore();
    // create the unique table for the dbFolderInfo.
    mdb_err mdberr;
    mdberr = (nsresult) store->NewTable(GetEnv(), m_folderRowScopeToken,
    m_folderTableKindToken, PR_FALSE, nsnull, &m_mdbAllFoldersTable);
  }
  return err;
}

nsresult nsMsgFolderCache::InitExistingDB()
{
  nsresult err = InitMDBInfo();
  if (NS_FAILED(err))
    return err;

  err = GetStore()->GetTable(GetEnv(), &m_allFoldersTableOID, &m_mdbAllFoldersTable);
  if (NS_SUCCEEDED(err) && m_mdbAllFoldersTable)
  {
    nsIMdbTableRowCursor* rowCursor = nsnull;
    err = m_mdbAllFoldersTable->GetTableRowCursor(GetEnv(), -1, &rowCursor);
    if (NS_SUCCEEDED(err) && rowCursor)
    {
      // iterate over the table rows and create nsMsgFolderCacheElements for each.
      while (PR_TRUE)
      {
        nsresult rv;
        nsIMdbRow* hdrRow;
        mdb_pos rowPos;

        rv = rowCursor->NextRow(GetEnv(), &hdrRow, &rowPos);
        if (NS_FAILED(rv) || !hdrRow)
          break;

        rv = AddCacheElement(EmptyCString(), hdrRow, nsnull);
        hdrRow->Release();
        if (NS_FAILED(rv))
          return rv;
      }
      rowCursor->Release();
    }
  }
  else
    err = NS_ERROR_FAILURE;

  return err;
}

nsresult nsMsgFolderCache::OpenMDB(const nsACString& dbName, PRBool exists)
{
  nsresult ret=NS_OK;
  nsCOMPtr<nsIMdbFactory> mdbFactory;
  GetMDBFactory(getter_AddRefs(mdbFactory));
  if (mdbFactory)
  {
    ret = mdbFactory->MakeEnv(nsnull, &m_mdbEnv);
    if (NS_SUCCEEDED(ret))
    {
      nsIMdbThumb *thumb = nsnull;
      nsIMdbHeap* dbHeap = 0;
      mdb_bool dbFrozen = mdbBool_kFalse; // not readonly, we want modifiable

      if (m_mdbEnv)
        m_mdbEnv->SetAutoClear(PR_TRUE);
      if (exists)
      {
        mdbOpenPolicy inOpenPolicy;
        mdb_bool canOpen;
        mdbYarn outFormatVersion;

        nsIMdbFile* oldFile = 0;
        ret = mdbFactory->OpenOldFile(m_mdbEnv, dbHeap, nsCString(dbName).get(),
          dbFrozen, &oldFile);
        if ( oldFile )
        {
          if (NS_SUCCEEDED(ret))
          {
            ret = mdbFactory->CanOpenFilePort(m_mdbEnv, oldFile, // file to investigate
              &canOpen, &outFormatVersion);
            if (NS_SUCCEEDED(ret) && canOpen)
            {
              inOpenPolicy.mOpenPolicy_ScopePlan.mScopeStringSet_Count = 0;
              inOpenPolicy.mOpenPolicy_MinMemory = 0;
              inOpenPolicy.mOpenPolicy_MaxLazy = 0;

              ret = mdbFactory->OpenFileStore(m_mdbEnv, NULL, oldFile, &inOpenPolicy,
                &thumb);
            }
            else
              ret = NS_MSG_ERROR_FOLDER_SUMMARY_OUT_OF_DATE;
          }
          NS_RELEASE(oldFile); // always release our file ref, store has own
        }
      }
      if (NS_SUCCEEDED(ret) && thumb)
      {
        mdb_count outTotal;    // total somethings to do in operation
        mdb_count outCurrent;  // subportion of total completed so far
        mdb_bool outDone = PR_FALSE;      // is operation finished?
        mdb_bool outBroken;     // is operation irreparably dead and broken?
        do
        {
          ret = thumb->DoMore(m_mdbEnv, &outTotal, &outCurrent, &outDone, &outBroken);
          if (ret != 0)
          {// mork isn't really doing NS errors yet.
            outDone = PR_TRUE;
            break;
          }
        }
        while (NS_SUCCEEDED(ret) && !outBroken && !outDone);
        // m_mdbEnv->ClearErrors(); // ### temporary...
        if (NS_SUCCEEDED(ret) && outDone)
        {
          ret = mdbFactory->ThumbToOpenStore(m_mdbEnv, thumb, &m_mdbStore);
          if (NS_SUCCEEDED(ret) && m_mdbStore)
            ret = InitExistingDB();
        }
#ifdef DEBUG_bienvenu1
        DumpContents();
#endif
      }
      else // ### need error code saying why open file store failed
      {
        nsIMdbFile* newFile = 0;
        ret = mdbFactory->CreateNewFile(m_mdbEnv, dbHeap, nsCString(dbName).get(), &newFile);
        if ( newFile )
        {
          if (NS_SUCCEEDED(ret))
          {
            mdbOpenPolicy inOpenPolicy;

            inOpenPolicy.mOpenPolicy_ScopePlan.mScopeStringSet_Count = 0;
            inOpenPolicy.mOpenPolicy_MinMemory = 0;
            inOpenPolicy.mOpenPolicy_MaxLazy = 0;

            ret = mdbFactory->CreateNewFileStore(m_mdbEnv, dbHeap,
              newFile, &inOpenPolicy, &m_mdbStore);
            if (NS_SUCCEEDED(ret))
              ret = InitNewDB();
          }
          NS_RELEASE(newFile); // always release our file ref, store has own
        }

      }
      NS_IF_RELEASE(thumb);
    }
  }
  return ret;
}

NS_IMETHODIMP nsMsgFolderCache::Init(nsIFile *aFile)
{
  NS_ENSURE_ARG_POINTER(aFile);

  m_cacheElements.Init();

  PRBool exists;
  aFile->Exists(&exists);

  nsCAutoString dbPath;
  aFile->GetNativePath(dbPath);
  // ### evil cast until MDB supports file streams.
  nsresult rv = OpenMDB(dbPath, exists);
  // if this fails and panacea.dat exists, try blowing away the db and recreating it
  if (NS_FAILED(rv) && exists)
  {
    if (m_mdbStore)
      m_mdbStore->Release();
    aFile->Remove(PR_FALSE);
    rv = OpenMDB(dbPath, PR_FALSE);
  }
  return rv;
}

NS_IMETHODIMP nsMsgFolderCache::GetCacheElement(const nsACString& pathKey, PRBool createIfMissing,
                                                nsIMsgFolderCacheElement **result)
{
  NS_ENSURE_ARG_POINTER(result);
  NS_ENSURE_TRUE(!pathKey.IsEmpty(), NS_ERROR_FAILURE);

  nsCOMPtr<nsIMsgFolderCacheElement> folderCacheEl;
  m_cacheElements.Get(pathKey, getter_AddRefs(folderCacheEl));
  folderCacheEl.swap(*result);

  if (*result)
    return NS_OK;
  else if (createIfMissing)
  {
    nsIMdbRow* hdrRow;

    if (GetStore())
    {
      mdb_err err = GetStore()->NewRow(GetEnv(), m_folderRowScopeToken,   // row scope for row ids
        &hdrRow);
      if (NS_SUCCEEDED(err) && hdrRow)
      {
        m_mdbAllFoldersTable->AddRow(GetEnv(), hdrRow);
        nsresult ret = AddCacheElement(pathKey, hdrRow, result);
        if (*result)
          (*result)->SetStringProperty("key", pathKey);
        hdrRow->Release();
        return ret;
      }
    }
  }
  return NS_ERROR_FAILURE;
}

NS_IMETHODIMP nsMsgFolderCache::RemoveElement(const nsACString& key)
{
  nsCOMPtr<nsIMsgFolderCacheElement> folderCacheEl;
  m_cacheElements.Get(key, getter_AddRefs(folderCacheEl));
  if (!folderCacheEl)
    return NS_ERROR_FAILURE;
  nsMsgFolderCacheElement *element = static_cast<nsMsgFolderCacheElement *>(static_cast<nsISupports *>(folderCacheEl.get())); // why the double cast??
  m_mdbAllFoldersTable->CutRow(GetEnv(), element->m_mdbRow);
  m_cacheElements.Remove(key);
  return NS_OK;
}

NS_IMETHODIMP nsMsgFolderCache::Clear()
{
  m_cacheElements.Clear();
  if (m_mdbAllFoldersTable)
    m_mdbAllFoldersTable->CutAllRows(GetEnv());
  return NS_OK;
}

NS_IMETHODIMP nsMsgFolderCache::Close()
{
  return Commit(PR_TRUE);
}

NS_IMETHODIMP nsMsgFolderCache::Commit(PRBool compress)
{
  nsresult ret = NS_OK;
  nsIMdbThumb *commitThumb = nsnull;
  if (m_mdbStore)
  {
    if (compress)
      ret = m_mdbStore->CompressCommit(GetEnv(), &commitThumb);
    else
      ret = m_mdbStore->LargeCommit(GetEnv(), &commitThumb);
  }

  if (commitThumb)
  {
    mdb_count outTotal = 0;    // total somethings to do in operation
    mdb_count outCurrent = 0;  // subportion of total completed so far
    mdb_bool outDone = PR_FALSE;      // is operation finished?
    mdb_bool outBroken = PR_FALSE;     // is operation irreparably dead and broken?
    while (!outDone && !outBroken && NS_SUCCEEDED(ret))
      ret = commitThumb->DoMore(GetEnv(), &outTotal, &outCurrent, &outDone, &outBroken);
    NS_IF_RELEASE(commitThumb);
  }
  // ### do something with error, but clear it now because mork errors out on commits.
  if (GetEnv())
    GetEnv()->ClearErrors();
  return ret;
}

nsresult nsMsgFolderCache::AddCacheElement(const nsACString& key, nsIMdbRow *row, nsIMsgFolderCacheElement **result)
{
  nsMsgFolderCacheElement *cacheElement = new nsMsgFolderCacheElement;
  NS_ENSURE_TRUE(cacheElement, NS_ERROR_OUT_OF_MEMORY);
  nsCOMPtr<nsIMsgFolderCacheElement> folderCacheEl(do_QueryInterface(cacheElement));

  cacheElement->SetMDBRow(row);
  cacheElement->SetOwningCache(this);
  nsCString hashStrKey(key);
  // if caller didn't pass in key, try to get it from row.
  if (key.IsEmpty())
    folderCacheEl->GetStringProperty("key", hashStrKey);
  folderCacheEl->SetKey(hashStrKey);
  m_cacheElements.Put(hashStrKey, folderCacheEl);
  if (result)
    folderCacheEl.swap(*result);
  return NS_OK;
}

nsresult nsMsgFolderCache::RowCellColumnToCharPtr(nsIMdbRow *hdrRow, mdb_token columnToken, nsACString& resultStr)
{
  nsresult err = NS_OK;
  nsIMdbCell *hdrCell;
  if (hdrRow) // ### probably should be an error if hdrRow is NULL...
  {
    err = hdrRow->GetCell(GetEnv(), columnToken, &hdrCell);
    if (NS_SUCCEEDED(err) && hdrCell)
    {
      struct mdbYarn yarn;
      hdrCell->AliasYarn(GetEnv(), &yarn);
      resultStr.Assign((const char *)yarn.mYarn_Buf, yarn.mYarn_Fill);
      resultStr.SetLength(yarn.mYarn_Fill); // ensure the string is null terminated.
      hdrCell->Release(); // always release ref
    }
  }
  return err;
}
