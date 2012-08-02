/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "msgCore.h"
#include "nsMsgFolderCacheElement.h"
#include "prmem.h"
#include "nsISupportsObsolete.h"

nsMsgFolderCacheElement::nsMsgFolderCacheElement()
{
  m_mdbRow = nullptr;
  m_owningCache = nullptr;
}

nsMsgFolderCacheElement::~nsMsgFolderCacheElement()
{
  NS_IF_RELEASE(m_mdbRow);
  // circular reference, don't do it.
  // NS_IF_RELEASE(m_owningCache);
}

NS_IMPL_ISUPPORTS1(nsMsgFolderCacheElement, nsIMsgFolderCacheElement)

NS_IMETHODIMP nsMsgFolderCacheElement::GetKey(nsACString& aFolderKey)
{
  aFolderKey = m_folderKey;
  return NS_OK;
}

NS_IMETHODIMP nsMsgFolderCacheElement::SetKey(const nsACString& aFolderKey)
{
  m_folderKey = aFolderKey;
  return NS_OK;
}

void nsMsgFolderCacheElement::SetOwningCache(nsMsgFolderCache *owningCache)
{
  m_owningCache = owningCache;
  // circular reference, don't do it.
  //  if (owningCache)
  //    NS_ADDREF(owningCache);
}

NS_IMETHODIMP nsMsgFolderCacheElement::GetStringProperty(const char *propertyName, nsACString& result)
{
  NS_ENSURE_ARG_POINTER(propertyName);
  NS_ENSURE_TRUE(m_mdbRow && m_owningCache, NS_ERROR_FAILURE);

  mdb_token property_token;
  nsresult ret = m_owningCache->GetStore()->StringToToken(m_owningCache->GetEnv(),  propertyName, &property_token);
  if (NS_SUCCEEDED(ret))
    ret = m_owningCache->RowCellColumnToCharPtr(m_mdbRow, property_token, result);
  return ret;
}

NS_IMETHODIMP nsMsgFolderCacheElement::GetInt32Property(const char *propertyName, PRInt32 *aResult)
{
  NS_ENSURE_ARG_POINTER(propertyName);
  NS_ENSURE_ARG_POINTER(aResult);
  NS_ENSURE_TRUE(m_mdbRow, NS_ERROR_FAILURE);

  nsCString resultStr;
  GetStringProperty(propertyName, resultStr);
  if (resultStr.IsEmpty())
    return NS_ERROR_FAILURE;

  PRInt32 result = 0;
  for (PRUint32 index = 0; index < resultStr.Length(); index++)
  {
    char C = resultStr.CharAt(index);
    PRInt8 unhex = ((C >= '0' && C <= '9') ? C - '0' :
    ((C >= 'A' && C <= 'F') ? C - 'A' + 10 :
     ((C >= 'a' && C <= 'f') ? C - 'a' + 10 : -1)));
    if (unhex < 0)
      break;
    result = (result << 4) | unhex;
  }
  *aResult = result;
  return NS_OK;
}

NS_IMETHODIMP nsMsgFolderCacheElement::SetStringProperty(const char *propertyName, const nsACString& propertyValue)
{
  NS_ENSURE_ARG_POINTER(propertyName);
  NS_ENSURE_TRUE(m_mdbRow, NS_ERROR_FAILURE);
  nsresult rv = NS_OK;
  mdb_token property_token;

  if (m_owningCache)
  {
    rv = m_owningCache->GetStore()->StringToToken(m_owningCache->GetEnv(), propertyName, &property_token);
    if (NS_SUCCEEDED(rv))
    {
      struct mdbYarn yarn;

      yarn.mYarn_Grow = NULL;
      if (m_mdbRow)
      {
        nsCString propertyVal (propertyValue);
        yarn.mYarn_Buf = (void *) propertyVal.get();
        yarn.mYarn_Size = strlen((const char *) yarn.mYarn_Buf) + 1;
        yarn.mYarn_Fill = yarn.mYarn_Size - 1;
        yarn.mYarn_Form = 0; // what to do with this? we're storing csid in the msg hdr...
        rv = m_mdbRow->AddColumn(m_owningCache->GetEnv(), property_token, &yarn);
        return rv;
      }
    }
  }
  return rv;
}

NS_IMETHODIMP nsMsgFolderCacheElement::SetInt32Property(const char *propertyName, PRInt32 propertyValue)
{
  NS_ENSURE_ARG_POINTER(propertyName);
  NS_ENSURE_TRUE(m_mdbRow, NS_ERROR_FAILURE);
  nsCAutoString propertyStr;
  propertyStr.AppendInt(propertyValue, 16);
  return SetStringProperty(propertyName, propertyStr);
}

void nsMsgFolderCacheElement::SetMDBRow(nsIMdbRow *row)
{
  if (m_mdbRow)
    NS_RELEASE(m_mdbRow);
  NS_IF_ADDREF(m_mdbRow = row);
}
