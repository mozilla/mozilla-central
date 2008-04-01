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
 *   Joshua Cranmer <Pidgeot18@gmail.com>
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
#include "nsMsgBaseCID.h"

#include "mozStorageCID.h"
#include "mozIStorageService.h"
#include "mozIStorageStatement.h"

nsMsgFolderCache::nsMsgFolderCache()
: m_dbConnection(nsnull)
{
}

nsMsgFolderCache::~nsMsgFolderCache()
{
  // Clear the cache elements first, for good measure.
  m_cacheElements.Clear();
  if (m_dbConnection)
  {
    // If this still exists, roll it back
    m_dbConnection->RollbackTransaction();
    m_dbConnection->Close();
  }
}

NS_IMPL_ISUPPORTS1(nsMsgFolderCache, nsIMsgFolderCache)

nsresult nsMsgFolderCache::OpenSQL(nsIFile * dbFile, PRBool create)
{
  // If we have an old connection, this is bad. We'll just clean up as neatly
  // as possible and hope for the best.
  NS_ASSERTION(!m_dbConnection, "Should not reuse for multiple SQL files!");
  if (m_dbConnection)
  {
    m_dbConnection->RollbackTransaction();
    m_dbConnection->Close();
  }

  nsresult rv;
  nsCOMPtr<mozIStorageService> storageService = do_GetService(MOZ_STORAGE_SERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = storageService->OpenDatabase(dbFile, getter_AddRefs(m_dbConnection));
  NS_ENSURE_SUCCESS(rv, rv);

  PRBool connectionReady;
  m_dbConnection->GetConnectionReady(&connectionReady);
  if (!connectionReady)
    return NS_ERROR_FAILURE;

  /***************************************************************************
   *                      BIG BOLD NOTE TO PAY ATTENTION TO                  *
   ***************************************************************************
   * If changing the schema, change the schema version and add handling to   *
   * the bottom part of the if statement.                                    *
   ***************************************************************************/
  if (create)
  {
    // XXX: drop table if exists?
    rv = m_dbConnection->ExecuteSimpleSQL(NS_LITERAL_CSTRING(
          "CREATE TABLE entries ("
          "folderKey CHAR,"
          "propertyName CHAR,"
          "value CHAR)"));
    NS_ENSURE_SUCCESS(rv, rv);
  }
  else
  {
    // Get the schema version
    PRInt32 schemaVersion;
    rv = m_dbConnection->GetSchemaVersion(&schemaVersion);
    NS_ENSURE_SUCCESS(rv, rv);
    NS_ENSURE_TRUE(schemaVersion == 0, NS_ERROR_FAILURE);
  }

  // Preload all cache entries...
  nsCOMPtr<mozIStorageStatement> folderQuery;
  rv = m_dbConnection->CreateStatement(NS_LITERAL_CSTRING(
        "SELECT DISTINCT folderKey FROM entries"), getter_AddRefs(folderQuery));
  NS_ENSURE_SUCCESS(rv, rv);

  PRBool hasMore;
  nsCString value;
  while (NS_SUCCEEDED(folderQuery->ExecuteStep(&hasMore)) && hasMore)
  {
    folderQuery->GetUTF8String(0, value);
    nsMsgFolderCacheElement* element = new nsMsgFolderCacheElement(
        this->m_dbConnection, value);
    m_cacheElements.Put(value, element);
  }
  m_dbConnection->BeginTransaction();
  return NS_OK;
}

NS_IMETHODIMP nsMsgFolderCache::Init(nsIFile *aFile)
{
  NS_ENSURE_ARG_POINTER(aFile);

  m_cacheElements.Init();

  PRBool exists;
  aFile->Exists(&exists);

#ifdef DEBUG
  printf("Initializing folder cache\n");
#endif

  nsresult rv = OpenSQL(aFile, !exists);

  // If we can't open a database, let's destroy it and rebuild it...
  if (NS_FAILED(rv) && exists)
  {
    // If we got halfway, close it.
    if (m_dbConnection)
    {
      m_dbConnection->Close();
      m_dbConnection = nsnull;
    }
#ifdef DEBUG
    printf("Initialization failed, recreating database\n");
#endif
    aFile->Remove(PR_FALSE);
    rv = OpenSQL(aFile, PR_TRUE);
  }
  return rv;
}

NS_IMETHODIMP nsMsgFolderCache::GetCacheElement(const nsACString& pathKey,
    PRBool createIfMissing, nsIMsgFolderCacheElement **result)
{
  NS_ENSURE_ARG_POINTER(result);
  NS_ENSURE_TRUE(!pathKey.IsEmpty(), NS_ERROR_FAILURE);
  NS_ENSURE_TRUE(m_dbConnection, NS_ERROR_NOT_INITIALIZED);

  nsCOMPtr<nsIMsgFolderCacheElement> folderCacheEl;
  m_cacheElements.Get(pathKey, getter_AddRefs(folderCacheEl));
  folderCacheEl.swap(*result);

  if (*result)
    return NS_OK;
  
  if (createIfMissing)
  {
    folderCacheEl = new nsMsgFolderCacheElement(this->m_dbConnection, pathKey);
    
    // Copy a new hash key for storage purposes
    m_cacheElements.Put(nsDependentCString(pathKey), folderCacheEl);
    folderCacheEl.swap(*result);
  }
  return NS_ERROR_FAILURE;
}

NS_IMETHODIMP nsMsgFolderCache::RemoveElement(const nsACString& key)
{
  NS_ENSURE_TRUE(m_dbConnection, NS_ERROR_NOT_INITIALIZED);
#ifdef DEBUG
  printf("Removing element %s from cache.\n", PromiseFlatCString(key).get());
#endif
  nsCOMPtr<nsIMsgFolderCacheElement> folderCacheEl;
  if (!m_cacheElements.Get(key, getter_AddRefs(folderCacheEl)))
    return NS_ERROR_FAILURE;
  m_cacheElements.Remove(key);

  nsCOMPtr<mozIStorageStatement> statement;
  nsresult rv = m_dbConnection->CreateStatement(NS_LITERAL_CSTRING(
        "DELETE FROM entries WHERE folderKey=?1"), getter_AddRefs(statement));
  NS_ENSURE_SUCCESS(rv, rv);
  rv = statement->BindUTF8StringParameter(0, key);
  NS_ENSURE_SUCCESS(rv, rv);
  return statement->Execute();
}

NS_IMETHODIMP nsMsgFolderCache::Clear()
{
  NS_ENSURE_TRUE(m_dbConnection, NS_ERROR_NOT_INITIALIZED);
#ifdef DEBUG
  printf("Clearing cache\n");
#endif
  m_cacheElements.Clear();

  return m_dbConnection->ExecuteSimpleSQL(NS_LITERAL_CSTRING(
        "DELETE FROM entries"));
}

NS_IMETHODIMP nsMsgFolderCache::Close()
{
  nsresult rv = Commit(PR_TRUE);
  NS_ENSURE_SUCCESS(rv, rv);
  
  rv = m_dbConnection->Close();
  m_dbConnection = nsnull;
  return rv;
}

NS_IMETHODIMP nsMsgFolderCache::Commit(PRBool compress)
{
  NS_ENSURE_TRUE(m_dbConnection, NS_ERROR_NOT_INITIALIZED);
  nsresult rv = m_dbConnection->CommitTransaction();
  NS_ENSURE_SUCCESS(rv, rv);

  if (compress)
  {
    rv = m_dbConnection->ExecuteSimpleSQL(NS_LITERAL_CSTRING("VACUUM"));
    NS_ENSURE_SUCCESS(rv, rv);
  }

  // Reinitiate our transaction
  return m_dbConnection->BeginTransaction();
}
