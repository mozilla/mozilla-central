/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


#include "nscore.h"
#include "nsIStringBundle.h"
#include "nsImportFieldMap.h"
#include "nsImportStringBundle.h"
#include "nsISupportsObsolete.h"
#include "nsCRTGlue.h"
#include "ImportDebug.h"
#include "nsCOMPtr.h"

////////////////////////////////////////////////////////////////////////

NS_METHOD nsImportFieldMap::Create(nsIStringBundle *aBundle, nsISupports *aOuter, REFNSIID aIID, void **aResult)
{
  if (aOuter)
    return NS_ERROR_NO_AGGREGATION;

  nsImportFieldMap *it = new nsImportFieldMap(aBundle);
  if (it == nullptr)
    return NS_ERROR_OUT_OF_MEMORY;

  NS_ADDREF(it);
  nsresult rv = it->QueryInterface(aIID, aResult);
  NS_RELEASE(it);
  return rv;
}

NS_IMPL_THREADSAFE_ISUPPORTS1(nsImportFieldMap, nsIImportFieldMap)

NS_IMPL_GETSET(nsImportFieldMap, SkipFirstRecord, bool, m_skipFirstRecord)

nsImportFieldMap::nsImportFieldMap(nsIStringBundle *aBundle)
{
  m_numFields = 0;
  m_pFields = nullptr;
  m_pActive = nullptr;
  m_allocated = 0;
  // need to init the description array
  m_mozFieldCount = 0;
    m_skipFirstRecord = false;
  nsCOMPtr<nsIStringBundle> pBundle = aBundle;

  nsString *pStr;
  for (int32_t i = IMPORT_FIELD_DESC_START; i <= IMPORT_FIELD_DESC_END; i++, m_mozFieldCount++) {
    pStr = new nsString();
    if (pBundle) {
      nsImportStringBundle::GetStringByID(i, pBundle, *pStr);
    }
    else
      pStr->AppendInt(i);
    m_descriptions.AppendElement((void *)pStr);
  }
}

nsImportFieldMap::~nsImportFieldMap()
{
  if (m_pFields)
    delete [] m_pFields;
  if (m_pActive)
    delete [] m_pActive;

  nsString *  pStr;
  for (int32_t i = 0; i < m_mozFieldCount; i++) {
    pStr = (nsString *) m_descriptions.ElementAt(i);
    delete pStr;
  }
  m_descriptions.Clear();
}


NS_IMETHODIMP nsImportFieldMap::GetNumMozFields(int32_t *aNumFields)
{
    NS_PRECONDITION(aNumFields != nullptr, "null ptr");
  if (!aNumFields)
    return NS_ERROR_NULL_POINTER;

  *aNumFields = m_mozFieldCount;
  return NS_OK;
}

NS_IMETHODIMP nsImportFieldMap::GetMapSize(int32_t *aNumFields)
{
    NS_PRECONDITION(aNumFields != nullptr, "null ptr");
  if (!aNumFields)
    return NS_ERROR_NULL_POINTER;

  *aNumFields = m_numFields;
  return NS_OK;
}

NS_IMETHODIMP nsImportFieldMap::GetFieldDescription(int32_t index, PRUnichar **_retval)
{
    NS_PRECONDITION(_retval != nullptr, "null ptr");
  if (!_retval)
    return NS_ERROR_NULL_POINTER;

  *_retval = nullptr;
  if ((index < 0) || (index >= m_descriptions.Count()))
    return NS_ERROR_FAILURE;

  *_retval = ToNewUnicode(*((nsString *)m_descriptions.ElementAt(index)));
  return NS_OK;
}

NS_IMETHODIMP nsImportFieldMap::SetFieldMapSize(int32_t size)
{
  nsresult rv = Allocate(size);
  if (NS_FAILED(rv))
    return rv;

  m_numFields = size;

  return NS_OK;
}


NS_IMETHODIMP nsImportFieldMap::DefaultFieldMap(int32_t size)
{
  nsresult rv = SetFieldMapSize(size);
  if (NS_FAILED(rv))
    return rv;
  for (int32_t i = 0; i < size; i++) {
    m_pFields[i] = i;
    m_pActive[i] = true;
  }

  return NS_OK;
}

NS_IMETHODIMP nsImportFieldMap::GetFieldMap(int32_t index, int32_t *_retval)
{
    NS_PRECONDITION(_retval != nullptr, "null ptr");
  if (!_retval)
    return NS_ERROR_NULL_POINTER;


  if ((index < 0) || (index >= m_numFields))
    return NS_ERROR_FAILURE;

  *_retval = m_pFields[index];
  return NS_OK;
}

NS_IMETHODIMP nsImportFieldMap::SetFieldMap(int32_t index, int32_t fieldNum)
{
  if (index == -1) {
    nsresult rv = Allocate(m_numFields + 1);
    if (NS_FAILED(rv))
      return rv;
    index = m_numFields;
    m_numFields++;
  }
  else {
    if ((index < 0) || (index >= m_numFields))
      return NS_ERROR_FAILURE;
  }

  if ((fieldNum != -1) && ((fieldNum < 0) || (fieldNum >= m_mozFieldCount)))
    return NS_ERROR_FAILURE;

  m_pFields[index] = fieldNum;
  return NS_OK;
}

NS_IMETHODIMP nsImportFieldMap::GetFieldActive(int32_t index, bool *active)
{
    NS_PRECONDITION(active != nullptr, "null ptr");
  if (!active)
    return NS_ERROR_NULL_POINTER;
  if ((index < 0) || (index >= m_numFields))
    return NS_ERROR_FAILURE;

  *active = m_pActive[index];
  return NS_OK;
}

NS_IMETHODIMP nsImportFieldMap::SetFieldActive(int32_t index, bool active)
{
  if ((index < 0) || (index >= m_numFields))
    return NS_ERROR_FAILURE;

  m_pActive[index] = active;
  return NS_OK;
}


NS_IMETHODIMP nsImportFieldMap::SetFieldValue(nsIAddrDatabase *database, nsIMdbRow *row, int32_t fieldNum, const PRUnichar *value)
{
  NS_PRECONDITION(database != nullptr, "null ptr");
  NS_PRECONDITION(row != nullptr, "null ptr");
  NS_PRECONDITION(value != nullptr, "null ptr");
  if (!database || !row || !value)
    return NS_ERROR_NULL_POINTER;

  // Allow the special value for a null field
  if (fieldNum == -1)
    return NS_OK;

  if ((fieldNum < 0) || (fieldNum >= m_mozFieldCount))
    return NS_ERROR_FAILURE;

  // UGGG!!!!! lot's of typing here!
  nsresult rv;

  nsString str(value);
  char *pVal = ToNewUTF8String(str);

  switch(fieldNum) {
  case 0:
    rv = database->AddFirstName(row, pVal);
    break;
  case 1:
    rv = database->AddLastName(row, pVal);
    break;
  case 2:
    rv = database->AddDisplayName(row, pVal);
    break;
  case 3:
    rv = database->AddNickName(row, pVal);
    break;
  case 4:
    rv = database->AddPrimaryEmail(row, pVal);
    break;
  case 5:
    rv = database->Add2ndEmail(row, pVal);
    break;
  case 6:
    rv = database->AddWorkPhone(row, pVal);
    break;
  case 7:
    rv = database->AddHomePhone(row, pVal);
    break;
  case 8:
    rv = database->AddFaxNumber(row, pVal);
    break;
  case 9:
    rv = database->AddPagerNumber(row, pVal);
    break;
  case 10:
    rv = database->AddCellularNumber(row, pVal);
    break;
  case 11:
    rv = database->AddHomeAddress(row, pVal);
    break;
  case 12:
    rv = database->AddHomeAddress2(row, pVal);
    break;
  case 13:
    rv = database->AddHomeCity(row, pVal);
    break;
  case 14:
    rv = database->AddHomeState(row, pVal);
    break;
  case 15:
    rv = database->AddHomeZipCode(row, pVal);
    break;
  case 16:
    rv = database->AddHomeCountry(row, pVal);
    break;
  case 17:
    rv = database->AddWorkAddress(row, pVal);
    break;
  case 18:
    rv = database->AddWorkAddress2(row, pVal);
    break;
  case 19:
    rv = database->AddWorkCity(row, pVal);
    break;
  case 20:
    rv = database->AddWorkState(row, pVal);
    break;
  case 21:
    rv = database->AddWorkZipCode(row, pVal);
    break;
  case 22:
    rv = database->AddWorkCountry(row, pVal);
    break;
  case 23:
    rv = database->AddJobTitle(row, pVal);
    break;
  case 24:
    rv = database->AddDepartment(row, pVal);
    break;
  case 25:
    rv = database->AddCompany(row, pVal);
    break;
  case 26:
    rv = database->AddWebPage1(row, pVal);
    break;
  case 27:
    rv = database->AddWebPage2(row, pVal);
    break;
  case 28:
    rv = database->AddBirthYear(row, pVal);
    break;
  case 29:
    rv = database->AddBirthMonth(row, pVal);
    break;
  case 30:
    rv = database->AddBirthDay(row, pVal);
    break;
  case 31:
    rv = database->AddCustom1(row, pVal);
    break;
  case 32:
    rv = database->AddCustom2(row, pVal);
    break;
  case 33:
    rv = database->AddCustom3(row, pVal);
    break;
  case 34:
    rv = database->AddCustom4(row, pVal);
    break;
  case 35:
    rv = database->AddNotes(row, pVal);
    break;
  case 36:
    rv = database->AddAimScreenName(row, pVal);
    break;
  default:
    /* Get the field description, and add it as an anonymous attr? */
    /* OR WHAT???? */
    {
      rv = NS_ERROR_FAILURE;
    }
  }

  NS_Free(pVal);

  return rv;
}


nsresult nsImportFieldMap::Allocate(int32_t newSize)
{
  if (newSize <= m_allocated)
    return NS_OK;

  int32_t sz = m_allocated;
  while (sz < newSize)
    sz += 30;

  int32_t  *pData = new int32_t[ sz];
  if (!pData)
    return NS_ERROR_OUT_OF_MEMORY;
  bool *pActive = new bool[sz];
  if (!pActive) {
    delete [] pData;
    return NS_ERROR_OUT_OF_MEMORY;
  }

  int32_t  i;
  for (i = 0; i < sz; i++) {
    pData[i] = -1;
    pActive[i] = true;
  }
  if (m_numFields) {
    for (i = 0; i < m_numFields; i++) {
      pData[i] = m_pFields[i];
      pActive[i] = m_pActive[i];
    }
    delete [] m_pFields;
    delete [] m_pActive;
  }
  m_allocated = sz;
  m_pFields = pData;
  m_pActive = pActive;
  return NS_OK;
}
