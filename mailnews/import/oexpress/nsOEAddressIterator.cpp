/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


/*

  A sample of XPConnect. This file contains an implementation of
  nsISample.

*/
#include "nscore.h"
#include "nsCOMPtr.h"
#include "nsStringGlue.h"
#include "nsMsgUtils.h"
#include "nsComponentManagerUtils.h"
#include "nsIServiceManager.h"
#include "nsIImportService.h"
#include "nsIImportFieldMap.h"
#include "nsABBaseCID.h"
#include "nsIAbCard.h"
#include "prprf.h"

#include "nsOEAddressIterator.h"

#include "OEDebugLog.h"

typedef struct {
  int32_t    mozField;
  int32_t    multiLine;
  ULONG    mapiTag;
} MAPIFields;

enum {
  ieidPR_DISPLAY_NAME = 0,
  ieidPR_ENTRYID,
  ieidPR_OBJECT_TYPE,
  ieidMax
};

/*
  Fields in MAPI, not in Mozilla
  PR_OFFICE_LOCATION
  FIX - PR_BIRTHDAY - stored as PT_SYSTIME - FIX to extract for moz address book birthday
  PR_DISPLAY_NAME_PREFIX - Mr., Mrs. Dr., etc.
  PR_SPOUSE_NAME
  PR_GENDER - integer, not text
  FIX - PR_CONTACT_EMAIL_ADDRESSES - multiuline strings for email addresses, needs
    parsing to get secondary email address for mozilla
*/

#define kIsMultiLine  -2
#define  kNoMultiLine  -1

static MAPIFields  gMapiFields[] = {
  { 35, kIsMultiLine, PR_COMMENT},
  { 6, kNoMultiLine, PR_BUSINESS_TELEPHONE_NUMBER},
  { 7, kNoMultiLine, PR_HOME_TELEPHONE_NUMBER},
  { 25, kNoMultiLine, PR_COMPANY_NAME},
  { 23, kNoMultiLine, PR_TITLE},
  { 10, kNoMultiLine, PR_CELLULAR_TELEPHONE_NUMBER},
  { 9, kNoMultiLine, PR_PAGER_TELEPHONE_NUMBER},
  { 8, kNoMultiLine, PR_BUSINESS_FAX_NUMBER},
  { 8, kNoMultiLine, PR_HOME_FAX_NUMBER},
  { 22, kNoMultiLine, PR_COUNTRY},
  { 19, kNoMultiLine, PR_LOCALITY},
  { 20, kNoMultiLine, PR_STATE_OR_PROVINCE},
  { 17, 18, PR_STREET_ADDRESS},
  { 21, kNoMultiLine, PR_POSTAL_CODE},
  { 27, kNoMultiLine, PR_PERSONAL_HOME_PAGE},
  { 26, kNoMultiLine, PR_BUSINESS_HOME_PAGE},
  { 13, kNoMultiLine, PR_HOME_ADDRESS_CITY},
  { 16, kNoMultiLine, PR_HOME_ADDRESS_COUNTRY},
  { 15, kNoMultiLine, PR_HOME_ADDRESS_POSTAL_CODE},
  { 14, kNoMultiLine, PR_HOME_ADDRESS_STATE_OR_PROVINCE},
  { 11, 12, PR_HOME_ADDRESS_STREET},
  { 24, kNoMultiLine, PR_DEPARTMENT_NAME}
};

nsOEAddressIterator::nsOEAddressIterator(CWAB *pWab, nsIAddrDatabase *database)
{
  m_pWab = pWab;
  m_database = database;
}

nsOEAddressIterator::~nsOEAddressIterator()
{
}

nsresult nsOEAddressIterator::EnumUser(const PRUnichar * pName, LPENTRYID pEid, ULONG cbEid)
{
  IMPORT_LOG1("User: %S\n", pName);
  nsresult   rv = NS_OK;
  
  if (m_database) {
    LPMAILUSER  pUser = m_pWab->GetUser(cbEid, pEid);
    if (pUser) {
      // Get a new row from the database!
      nsCOMPtr <nsIMdbRow> newRow;
      rv = m_database->GetNewRow(getter_AddRefs(newRow));
      NS_ENSURE_SUCCESS(rv, rv);
      if (newRow && BuildCard(pName, newRow, pUser))
      {
        rv = m_database->AddCardRowToDB(newRow);
        NS_ENSURE_SUCCESS(rv, rv);
        IMPORT_LOG0("* Added entry to address book database\n");
        nsString  eMail;

        LPSPropValue  pProp = m_pWab->GetUserProperty(pUser, PR_EMAIL_ADDRESS);
        if (pProp) 
        {
          m_pWab->GetValueString(pProp, eMail);
          SanitizeValue(eMail);
          m_pWab->FreeProperty(pProp);
          m_listRows.Put(eMail, newRow);
        }
      }
      m_pWab->ReleaseUser(pUser);
    }
  }  
  
  return rv;
}

void nsOEAddressIterator::FindListRow(nsString &eMail, nsIMdbRow **cardRow)
{
  m_listRows.Get(eMail,cardRow);
}

nsresult nsOEAddressIterator::EnumList(const PRUnichar * pName, LPENTRYID pEid, ULONG cbEid, LPMAPITABLE lpTable)
{
  // If no name provided then we're done.
  if (!pName || !(*pName))
    return NS_OK;

  nsresult rv = NS_ERROR_FAILURE;
  HRESULT hr = E_FAIL;
  // Make sure we have db to work with.
  if (!m_database)
    return rv;

  nsCOMPtr <nsIMdbRow>  listRow;
  rv = m_database->GetNewListRow(getter_AddRefs(listRow));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = m_database->AddListName(listRow, NS_ConvertUTF16toUTF8(pName).get());
  NS_ENSURE_SUCCESS(rv, rv);
  rv = m_database->AddCardRowToDB(listRow);
  NS_ENSURE_SUCCESS(rv, rv);
  rv = m_database->AddListDirNode(listRow);
  NS_ENSURE_SUCCESS(rv, rv);

  LPSRowSet   lpRowAB = NULL;
  ULONG        lpcbEID = 0;
  LPENTRYID   lpEID = NULL;
  ULONG        rowCount = 0;
  int         cNumRows = 0;
  int         numListElems = 0;
  nsAutoString    uniStr;

  hr = lpTable->GetRowCount(0, &rowCount);
  //
  hr = lpTable->SeekRow(BOOKMARK_BEGINNING, 0, NULL);

  if(HR_FAILED(hr))
    return NS_ERROR_FAILURE;

  // Read all the rows of the table one by one
  do 
  {
    hr = lpTable->QueryRows(1, 0, &lpRowAB);
  
    if(HR_FAILED(hr))
      break;
  
    if(lpRowAB)
    {
      cNumRows = lpRowAB->cRows;
      if (cNumRows)
      {
        LPTSTR lpsz = lpRowAB->aRow[0].lpProps[ieidPR_DISPLAY_NAME].Value.lpszA;
        LPENTRYID lpEID = (LPENTRYID) lpRowAB->aRow[0].lpProps[ieidPR_ENTRYID].Value.bin.lpb;
        ULONG cbEID = lpRowAB->aRow[0].lpProps[ieidPR_ENTRYID].Value.bin.cb;
      
        // There are 2 kinds of objects - the MAPI_MAILUSER contact object
        // and the MAPI_DISTLIST contact object
        // For distribution lists, we will only consider MAILUSER
        // objects since we can't nest lists yet.
        if(lpRowAB->aRow[0].lpProps[ieidPR_OBJECT_TYPE].Value.l == MAPI_MAILUSER)
        {
          LPMAILUSER  pUser = m_pWab->GetUser(cbEID, lpEID);
          LPSPropValue pProp = m_pWab->GetUserProperty(pUser, PR_EMAIL_ADDRESS);
          nsString  eMail;

          nsCOMPtr <nsIMdbRow> cardRow;

          m_pWab->GetValueString(pProp, eMail);
          SanitizeValue(eMail);
          FindListRow(eMail, getter_AddRefs(cardRow));
          if (cardRow)
          {
            nsCOMPtr <nsIAbCard> userCard;
            nsCOMPtr <nsIAbCard> newCard;
            userCard = do_CreateInstance(NS_ABMDBCARD_CONTRACTID, &rv);
            NS_ENSURE_SUCCESS(rv, rv);
            m_database->InitCardFromRow(userCard,cardRow);

            m_database->AddListCardColumnsToRow(userCard, listRow, ++numListElems,
                                                getter_AddRefs(newCard),
                                                true, nullptr, nullptr);
          }
          m_pWab->FreeProperty(pProp);
          m_pWab->ReleaseUser(pUser);
        }
      }
      m_pWab->FreeProws(lpRowAB);    
    }
  } while (SUCCEEDED(hr) && cNumRows && lpRowAB);

  m_database->SetListAddressTotal(listRow, numListElems);
  return rv;
}

void nsOEAddressIterator::SanitizeValue(nsString& val)
{
  MsgReplaceSubstring(val, NS_LITERAL_STRING("\r\n"), NS_LITERAL_STRING(", "));
  MsgReplaceChar(val, "\r\n", ',');
}

void nsOEAddressIterator::SplitString(nsString& val1, nsString& val2)
{
  // Find the last line if there is more than one!
  int32_t idx = val1.RFind("\x0D\x0A");
  int32_t  cnt = 2;
  if (idx == -1) {
    cnt = 1;
    idx = val1.RFindChar(13);
  }
  if (idx == -1)
    idx= val1.RFindChar(10);
  if (idx != -1) {
    val2 = Substring(val1, idx + cnt);
    val1.SetLength(idx);
    SanitizeValue(val1);
  }
}

void nsOEAddressIterator::SetBirthDay(nsIMdbRow *newRow, PRTime& birthDay)
{
  PRExplodedTime exploded;
  PR_ExplodeTime(birthDay, PR_LocalTimeParameters, &exploded);

  char stringValue[5];
  PR_snprintf(stringValue, sizeof(stringValue), "%04d", exploded.tm_year);
  m_database->AddBirthYear(newRow, stringValue);
  PR_snprintf(stringValue, sizeof(stringValue), "%02d", exploded.tm_month + 1);
  m_database->AddBirthMonth(newRow, stringValue);
  PR_snprintf(stringValue, sizeof(stringValue), "%02d", exploded.tm_mday);
  m_database->AddBirthDay(newRow, stringValue);
}

bool nsOEAddressIterator::BuildCard(const PRUnichar * pName, nsIMdbRow *newRow, LPMAILUSER pUser)
{
  
  nsString    lastName;
  nsString    firstName;
  nsString    eMail;
  nsString    nickName;
  nsString    middleName;
  PRTime      birthDay = 0;
  
  LPSPropValue  pProp = m_pWab->GetUserProperty(pUser, PR_EMAIL_ADDRESS);
  if (pProp) {
    m_pWab->GetValueString(pProp, eMail);
    SanitizeValue(eMail);
    m_pWab->FreeProperty(pProp);
  }
  pProp = m_pWab->GetUserProperty(pUser, PR_GIVEN_NAME);
  if (pProp) {
    m_pWab->GetValueString(pProp, firstName);
    SanitizeValue(firstName);
    m_pWab->FreeProperty(pProp);
  }
  pProp = m_pWab->GetUserProperty(pUser, PR_SURNAME);
  if (pProp) {
    m_pWab->GetValueString(pProp, lastName);
    SanitizeValue(lastName);
    m_pWab->FreeProperty(pProp);
  }
  pProp = m_pWab->GetUserProperty(pUser, PR_MIDDLE_NAME);
  if (pProp) {
    m_pWab->GetValueString(pProp, middleName);
    SanitizeValue(middleName);
    m_pWab->FreeProperty(pProp);
  }
  pProp = m_pWab->GetUserProperty(pUser, PR_NICKNAME);
  if (pProp) {
    m_pWab->GetValueString(pProp, nickName);
    SanitizeValue(nickName);
    m_pWab->FreeProperty(pProp);
  }
  
  // The idea here is that firstName and lastName cannot both be empty!
  if (firstName.IsEmpty() && lastName.IsEmpty())
    firstName = pName;
  
  nsString  displayName;
  pProp = m_pWab->GetUserProperty(pUser, PR_DISPLAY_NAME);
  if (pProp) {
    m_pWab->GetValueString(pProp, displayName);
    SanitizeValue(displayName);
    m_pWab->FreeProperty(pProp);
  }
  if (displayName.IsEmpty()) {
    if (firstName.IsEmpty())
      displayName = pName;
    else {
      displayName = firstName;
      if (!middleName.IsEmpty()) {
        displayName.Append(PRUnichar(' '));
        displayName.Append(middleName);
      }
      if (!lastName.IsEmpty()) {
        displayName.Append(PRUnichar(' '));
        displayName.Append(lastName);
      }
    }
  }

  pProp = m_pWab->GetUserProperty(pUser, PR_BIRTHDAY);
  if (pProp) {
    m_pWab->GetValueTime(pProp, birthDay);
    m_pWab->FreeProperty(pProp);
  }
  
  // We now have the required fields
  // write them out followed by any optional fields!
  if (!displayName.IsEmpty())
    m_database->AddDisplayName(newRow, NS_ConvertUTF16toUTF8(displayName).get());
  if (!firstName.IsEmpty())
    m_database->AddFirstName(newRow, NS_ConvertUTF16toUTF8(firstName).get());
  if (!lastName.IsEmpty())
    m_database->AddLastName(newRow, NS_ConvertUTF16toUTF8(lastName).get());
  if (!nickName.IsEmpty())
    m_database->AddNickName(newRow, NS_ConvertUTF16toUTF8(nickName).get());
  if (!eMail.IsEmpty())
    m_database->AddPrimaryEmail(newRow, NS_ConvertUTF16toUTF8(eMail).get());

  if (birthDay)
    SetBirthDay(newRow, birthDay);
  
  // Do all of the extra fields!
  
  nsString  value;
  nsString  line2;
  nsresult  rv;
  // Create a field map
  
  nsCOMPtr<nsIImportService> impSvc(do_GetService(NS_IMPORTSERVICE_CONTRACTID, &rv));
  if (NS_SUCCEEDED(rv)) {
    nsIImportFieldMap *    pFieldMap = nullptr;
    rv = impSvc->CreateNewFieldMap(&pFieldMap);
    if (NS_SUCCEEDED(rv) && pFieldMap) {
      int max = sizeof(gMapiFields) / sizeof(MAPIFields);
      for (int i = 0; i < max; i++) {
        pProp = m_pWab->GetUserProperty(pUser, gMapiFields[i].mapiTag);
        if (pProp) {
          m_pWab->GetValueString(pProp, value);
          m_pWab->FreeProperty(pProp);
          if (!value.IsEmpty()) {
            if (gMapiFields[i].multiLine == kNoMultiLine) {
              SanitizeValue(value);
              pFieldMap->SetFieldValue(m_database, newRow, gMapiFields[i].mozField, value.get());
            }
            else if (gMapiFields[i].multiLine == kIsMultiLine) {
              pFieldMap->SetFieldValue(m_database, newRow, gMapiFields[i].mozField, value.get());
            }
            else {
              line2.Truncate();
              SplitString(value, line2);
              if (!value.IsEmpty())
                pFieldMap->SetFieldValue(m_database, newRow, gMapiFields[i].mozField, value.get());
              if (!line2.IsEmpty())
                pFieldMap->SetFieldValue(m_database, newRow, gMapiFields[i].multiLine, line2.get());
            }
          }
        }
      }
      // call fieldMap SetFieldValue based on the table of fields
      
      NS_RELEASE(pFieldMap);
    }
  }
  return true;
}
