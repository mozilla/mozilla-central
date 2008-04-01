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
#include "nsMsgFolderCacheElement.h"
#include "prmem.h"
#include "nsISupportsObsolete.h"
#include "mozIStorageStatement.h"

nsMsgFolderCacheElement::nsMsgFolderCacheElement(mozIStorageConnection *connection,
                                                 const nsACString &key)
: m_dbConnection(connection),
  m_folderKey(key)
{
}

nsMsgFolderCacheElement::~nsMsgFolderCacheElement()
{
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

NS_IMETHODIMP nsMsgFolderCacheElement::GetStringProperty(const char *propertyName, nsACString& result)
{
  NS_ENSURE_ARG_POINTER(propertyName);
  PRBool connReady;
  m_dbConnection->GetConnectionReady(&connReady);
  NS_ASSERTION(connReady, "The database was already closed!");

  nsCOMPtr<mozIStorageStatement> statement;
  nsresult rv = m_dbConnection->CreateStatement(NS_LITERAL_CSTRING(
        "SELECT value FROM entries WHERE folderKey=?1 AND propertyName=?2"),
      getter_AddRefs(statement));
  NS_ENSURE_SUCCESS(rv, rv);
  rv = statement->BindUTF8StringParameter(0, m_folderKey);
  NS_ENSURE_SUCCESS(rv,rv);
  rv = statement->BindUTF8StringParameter(1, nsDependentCString(propertyName));
  NS_ENSURE_SUCCESS(rv,rv);

  PRBool hasKey;
  rv = statement->ExecuteStep(&hasKey);
  NS_ENSURE_SUCCESS(rv, rv);
  if (hasKey)
    return statement->GetUTF8String(0, result);

  result.Truncate();
  return NS_ERROR_FAILURE;
}

NS_IMETHODIMP nsMsgFolderCacheElement::GetInt32Property(const char *propertyName, PRInt32 *aResult)
{
  NS_ENSURE_ARG_POINTER(propertyName);
  NS_ENSURE_ARG_POINTER(aResult);

  nsCAutoString resultStr;
  GetStringProperty(propertyName, resultStr);
  if (resultStr.IsEmpty())
    return NS_ERROR_FAILURE;

  // eww, ToInteger wants a PRInt32 whereas nsresult is a PRUint32...
  PRInt32 err;
  *aResult = resultStr.ToInteger(&err);
  return err;
}

NS_IMETHODIMP nsMsgFolderCacheElement::SetStringProperty(const char *propertyName, const nsACString& propertyValue)
{
  NS_ENSURE_ARG_POINTER(propertyName);
  PRBool connReady;
  m_dbConnection->GetConnectionReady(&connReady);
  NS_ASSERTION(connReady, "The database was already closed!");

  nsCOMPtr<mozIStorageStatement> statement;

  // Find the current property value
  nsCString currentValue;
  nsresult rv = GetStringProperty(propertyName, currentValue);
  // Update it if it exists...
  if (NS_SUCCEEDED(rv))
  {
    // Commented out to prevent large spamming of output.
    //NS_ASSERTION(!currentValue.Equals(propertyValue), "Should only set non-equal values");
    if (currentValue.Equals(propertyValue))
      return NS_OK;
    rv = m_dbConnection->CreateStatement(NS_LITERAL_CSTRING(
        "UPDATE entries SET value=?3 WHERE folderKey=?1 AND propertyName=?2"),
      getter_AddRefs(statement));
  }
  else
    rv = m_dbConnection->CreateStatement(NS_LITERAL_CSTRING(
        "INSERT INTO entries VALUES (?1, ?2, ?3)"), getter_AddRefs(statement));

  NS_ENSURE_SUCCESS(rv, rv);
  rv = statement->BindUTF8StringParameter(0, m_folderKey);
  NS_ENSURE_SUCCESS(rv, rv);
  rv = statement->BindUTF8StringParameter(1, nsCString(propertyName));
  NS_ENSURE_SUCCESS(rv, rv);
  rv = statement->BindUTF8StringParameter(2, propertyValue);
  NS_ENSURE_SUCCESS(rv, rv);
  rv = statement->Execute();
  NS_ENSURE_SUCCESS(rv, rv);
  return NS_OK;
}

NS_IMETHODIMP nsMsgFolderCacheElement::SetInt32Property(const char *propertyName, PRInt32 propertyValue)
{
  NS_ENSURE_ARG_POINTER(propertyName);
  nsCAutoString propertyStr;
  propertyStr.AppendInt(propertyValue, 10);
  return SetStringProperty(propertyName, propertyStr);
}
