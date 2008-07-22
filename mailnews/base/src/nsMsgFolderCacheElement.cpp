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
#include "nsMsgFolderCacheElement.h"
#include "prmem.h"
#include "nsISupportsObsolete.h"

nsMsgFolderCacheElement::nsMsgFolderCacheElement()
{
  m_mdbRow = nsnull;
  m_owningCache = nsnull;
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
