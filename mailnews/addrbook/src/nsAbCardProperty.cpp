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
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Seth Spitzer <sspitzer@netscape.com>
 *   Pierre Phaneuf <pp@ludusdesign.com>
 *   Mark Banner <mark@standard8.demon.co.uk>
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

#include "nsAbCardProperty.h"	 
#include "nsIServiceManager.h"
#include "nsXPIDLString.h"
#include "nsAbBaseCID.h"
#include "nsCOMPtr.h"
#include "nsReadableUtils.h"
#include "nsUnicharUtils.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "nsIAbDirectory.h"
#include "plbase64.h"
#include "nsIAddrBookSession.h"
#include "nsIStringBundle.h"
#include "nsIAddressBook.h"
#include "plstr.h"
#include "nsIRDFResource.h"
#include "nsIRDFService.h"
#include "nsRDFCID.h"

#include "nsEscape.h"
#include "nsVCardObj.h"

#include "mozITXTToHTMLConv.h"

#define PREF_MAIL_ADDR_BOOK_LASTNAMEFIRST "mail.addr_book.lastnamefirst"

const char sAddrbookProperties[] = "chrome://messenger/locale/addressbook/addressBook.properties";

enum EAppendType {
  eAppendLine,
  eAppendLabel,
  eAppendCityStateZip
};

struct AppendItem {
  const char *mColumn;
  const char *mLabel;
  EAppendType mAppendType;
};

static const AppendItem NAME_ATTRS_ARRAY[] = { 
	{kDisplayNameColumn, "propertyDisplayName", eAppendLabel},   
	{kNicknameColumn, "propertyNickname", eAppendLabel},
	{kPriEmailColumn, "", eAppendLine},       
	{k2ndEmailColumn, "", eAppendLine},
  {kAimScreenNameColumn, "propertyScreenName", eAppendLabel},
};

static const AppendItem PHONE_ATTRS_ARRAY[] = { 
	{kWorkPhoneColumn, "propertyWork", eAppendLabel},   
	{kHomePhoneColumn, "propertyHome", eAppendLabel},
	{kFaxColumn, "propertyFax", eAppendLabel},       
	{kPagerColumn, "propertyPager", eAppendLabel},
	{kCellularColumn, "propertyCellular", eAppendLabel}
};

static const AppendItem HOME_ATTRS_ARRAY[] = { 
	{kHomeAddressColumn, "", eAppendLine},   
	{kHomeAddress2Column, "", eAppendLine},
	{kHomeCityColumn, "", eAppendCityStateZip},       
	{kHomeCountryColumn, "", eAppendLine},
	{kWebPage2Column, "", eAppendLine}
};

static const AppendItem WORK_ATTRS_ARRAY[] = { 
	{kJobTitleColumn, "", eAppendLine},   
	{kDepartmentColumn, "", eAppendLine},
	{kCompanyColumn, "", eAppendLine},
	{kWorkAddressColumn, "", eAppendLine},   
	{kWorkAddress2Column, "", eAppendLine},
	{kWorkCityColumn, "", eAppendCityStateZip},       
	{kWorkCountryColumn, "", eAppendLine},
	{kWebPage1Column, "", eAppendLine}
};

static const AppendItem CUSTOM_ATTRS_ARRAY[] = { 
	{kCustom1Column, "propertyCustom1", eAppendLabel},   
	{kCustom2Column, "propertyCustom2", eAppendLabel},
	{kCustom3Column, "propertyCustom3", eAppendLabel},       
	{kCustom4Column, "propertyCustom4", eAppendLabel},
	{kNotesColumn, "", eAppendLine}
};

nsAbCardProperty::nsAbCardProperty(void)
{
  m_LastModDate = 0;

  m_PreferMailFormat = nsIAbPreferMailFormat::unknown;
  m_PopularityIndex = 0;
  m_AllowRemoteContent = PR_FALSE;
  m_IsMailList = PR_FALSE;
}

nsAbCardProperty::~nsAbCardProperty(void)
{
}

NS_IMPL_ISUPPORTS1(nsAbCardProperty, nsIAbCard)

////////////////////////////////////////////////////////////////////////////////

NS_IMETHODIMP nsAbCardProperty::GetPopularityIndex(PRUint32 *aPopularityIndex)
{
  *aPopularityIndex = m_PopularityIndex;
  return NS_OK;
}

NS_IMETHODIMP nsAbCardProperty::SetPopularityIndex(PRUint32 aPopularityIndex)
{
  m_PopularityIndex = aPopularityIndex;
  return NS_OK;
}

NS_IMETHODIMP nsAbCardProperty::GetAllowRemoteContent(PRBool *aAllowRemoteContent)
{
  *aAllowRemoteContent = m_AllowRemoteContent;
  return NS_OK;
}

NS_IMETHODIMP nsAbCardProperty::SetAllowRemoteContent(PRBool aAllowRemoteContent)
{
  m_AllowRemoteContent = aAllowRemoteContent;
  return NS_OK;
}

NS_IMETHODIMP nsAbCardProperty::GetPreferMailFormat(PRUint32 *aFormat)
{
  *aFormat = m_PreferMailFormat;	
  return NS_OK;
}

NS_IMETHODIMP nsAbCardProperty::SetPreferMailFormat(PRUint32 aFormat)
{
  m_PreferMailFormat = aFormat;
  return NS_OK;
}

NS_IMETHODIMP nsAbCardProperty::GetIsMailList(PRBool *aIsMailList)
{
    *aIsMailList = m_IsMailList;
    return NS_OK;
}

NS_IMETHODIMP nsAbCardProperty::SetIsMailList(PRBool aIsMailList)
{
    m_IsMailList = aIsMailList;
    return NS_OK;
}

NS_IMETHODIMP nsAbCardProperty::GetMailListURI(char **aMailListURI)
{
  if (aMailListURI)
  {
    *aMailListURI = ToNewCString(m_MailListURI);
    return (*aMailListURI) ? NS_OK : NS_ERROR_OUT_OF_MEMORY;
  }
  else
    return NS_ERROR_NULL_POINTER;
}

NS_IMETHODIMP nsAbCardProperty::SetMailListURI(const char *aMailListURI)
{
  if (aMailListURI)
  {
    m_MailListURI = aMailListURI;
    return NS_OK;
  }
  else
    return NS_ERROR_NULL_POINTER;
}

NS_IMETHODIMP nsAbCardProperty::GetCardValue(const char *attrname, nsAString &value)
{
  NS_ENSURE_ARG_POINTER(attrname);

  nsresult rv = NS_OK;

  switch (attrname[0]) {
    case '_': // _AimScreenName
      rv = GetAimScreenName(value);
      break;
    case 'A':
      // AllowRemoteContent, AnniversaryYear, AnniversaryMonth, AnniversaryDay
      switch (attrname[11]) {
        case 'C':
        {
          PRBool allowRemoteContent = PR_FALSE;
          GetAllowRemoteContent(&allowRemoteContent);
          value = allowRemoteContent ? NS_LITERAL_STRING("true") :
                                       NS_LITERAL_STRING("false");
          break;
        }
        case 'Y':
          rv = GetAnniversaryYear(value);
          break;
        case 'M':
          rv = GetAnniversaryMonth(value);
          break;
        case 'D':
          rv = GetAnniversaryDay(value);
          break;
        default:
      rv = NS_ERROR_UNEXPECTED;
      break;
      }
      break;
    case 'B':
      // BirthYear, BirthMonth, BirthDay
      switch (attrname[5]) {
        case 'Y':
          rv = GetBirthYear(value);
          break;
        case 'M':
          rv = GetBirthMonth(value);
          break;
        case 'D':
          rv = GetBirthDay(value);
          break;
        default:
          rv = NS_ERROR_UNEXPECTED;
          break;
      }
      break;
    case 'C':
      switch (attrname[1]) {
        case 'o':
          rv = GetCompany(value);
          break;
        case 'a': // Category
          rv = GetCategory(value);
          break;
        case 'e':
          if (strlen(attrname) <= 14)
          rv = GetCellularNumber(value);
          else
            rv = GetCellularNumberType(value);
          break;
        case 'u':
          switch (attrname[6]) {
            case '1':
              rv = GetCustom1(value);
              break;
            case '2':
              rv = GetCustom2(value);
              break;
            case '3':
              rv = GetCustom3(value);
              break;
            case '4':
              rv = GetCustom4(value);
              break;
            default:
              rv = NS_ERROR_UNEXPECTED;
              break;
          }
          break;
        default:
          rv = NS_ERROR_UNEXPECTED;
          break;
      }
      break;
    case 'D':
      if (attrname[1] == 'i') 
        rv = GetDisplayName(value);
      else if (attrname[2] == 'f')
        rv = GetDefaultAddress(value);
      else 
        rv = GetDepartment(value);
      break;
    case 'F':
      switch (attrname[1]) {
      case 'i':
        rv = GetFirstName(value);
        break;
      case 'a':
        if ((attrname[2] == 'x'))
          if (strlen(attrname) <= 9)
        rv = GetFaxNumber(value);
          else
            rv = GetFaxNumberType(value);
        else
          rv = GetFamilyName(value);
        break;
      default:
        rv = NS_ERROR_UNEXPECTED;
        break;
      }
      break;
    case 'H':
      switch (attrname[4]) {
        case 'A':
          if (attrname[11] == '\0')
            rv = GetHomeAddress(value);
          else 
            rv = GetHomeAddress2(value);
          break;
        case 'C':
          if (attrname[5] == 'i')
            rv = GetHomeCity(value);
          else 
            rv = GetHomeCountry(value);
          break;
        case 'P':
          if (strlen(attrname) <= 9)
          rv = GetHomePhone(value);
          else
            rv = GetHomePhoneType(value);
          break;
        case 'S':
          rv = GetHomeState(value);
          break;
        case 'Z':
          rv = GetHomeZipCode(value);
          break;
        default:
          rv = NS_ERROR_UNEXPECTED;
          break;
      }
      break;
    case 'J':
      rv = GetJobTitle(value);
      break;
    case 'L':
      if (attrname[1] == 'a') {
        if (attrname[4] == 'N') 
          rv = GetLastName(value);
        else {
          // XXX todo
          // fix me?  LDAP code gets here
          PRUint32 lastModifiedDate;
          rv = GetLastModifiedDate(&lastModifiedDate);
          value.AssignLiteral("0Z");
        }
      }
      else
        rv = NS_ERROR_UNEXPECTED;
      break;
    case 'N':
      if (attrname[1] == 'o')
        rv = GetNotes(value);
      else 
        rv = GetNickName(value);
      break;
    case 'P':
      switch (attrname[2]) { 
        case 'e':
        {
          PRUint32 format;
          rv = GetPreferMailFormat(&format);

          switch (format) {
            case nsIAbPreferMailFormat::html:
              value.AssignLiteral("html");
              break;
            case nsIAbPreferMailFormat::plaintext:
              value.AssignLiteral("plaintext");
              break;
            case nsIAbPreferMailFormat::unknown:
            default :
              value.AssignLiteral("unknown");
              break;
          }
          break;
        }
        case 'g':
          if (strlen(attrname) <= 11)
          rv = GetPagerNumber(value);
          else
            rv = GetPagerNumberType(value);
          break;
        case 'i':
          rv = GetPrimaryEmail(value);
          break;
        case 'o':
          if (attrname[8] == 'L')
            rv = GetPhoneticLastName(value);
          else if (attrname[8] == 'F')
            rv = GetPhoneticFirstName(value);
          break;
        default:
          rv = NS_ERROR_UNEXPECTED;
          break;
      }
      break;
    case 'S':
      if (attrname[1] == 'e')
      rv = GetSecondEmail(value);
      else
        rv = GetSpouseName(value);
      break;
    case 'W': 
      if (attrname[1] == 'e') {
        if (attrname[7] == '1')
          rv = GetWebPage1(value);
        else 
          rv = GetWebPage2(value);
      }
      else {
        switch (attrname[4]) {
          case 'A':
            if (attrname[11] == '\0')
              rv = GetWorkAddress(value);
            else 
              rv = GetWorkAddress2(value);
            break;
          case 'C':
            if (attrname[5] == 'i')
              rv = GetWorkCity(value);
            else 
              rv = GetWorkCountry(value);
            break;
          case 'P':
            if (strlen(attrname) <= 9)
            rv = GetWorkPhone(value);
            else
              rv = GetWorkPhoneType(value);
            break;
          case 'S':
            rv = GetWorkState(value);
            break;
          case 'Z':
            rv = GetWorkZipCode(value);
            break;
          default:
            rv = NS_ERROR_UNEXPECTED;
            break;
        }
      }
      break;
    default:
      rv = NS_ERROR_UNEXPECTED;
      break;
  }

  // don't assert here, as failure is expected in certain cases
  // we call GetCardValue() from nsAbView::Init() to determine if the 
  // saved sortColumn is valid or not.
  return rv;
}

NS_IMETHODIMP nsAbCardProperty::SetCardValue(const char *attrname, const nsAString &value)
{
  NS_ENSURE_ARG_POINTER(attrname);

  nsresult rv = NS_OK;

  switch (attrname[0]) {
    case '_': // _AimScreenName
      rv = SetAimScreenName(value);
      break;
    case 'A':
      // AllowRemoteContent, AnniversaryYear, AnniversaryMonth, AnniversaryDay
      switch (attrname[11]) {
        case 'C':
            SetAllowRemoteContent(value.First() == 't' || value.First() == 'T');
          break;
        case 'Y':
          rv = SetAnniversaryYear(value);
          break;
        case 'M':
          rv = SetAnniversaryMonth(value);
          break;
        case 'D':
          rv = SetAnniversaryDay(value);
          break;
        default:
          rv = NS_ERROR_UNEXPECTED;
          break;
      }
      break;
    case 'B':
      // BirthYear, BirthMonth, BirthDay
      switch (attrname[5]) {
        case 'Y':
          rv = SetBirthYear(value);
          break;
        case 'M':
          rv = SetBirthMonth(value);
          break;
        case 'D':
          rv = SetBirthDay(value);
          break;
        default:
          rv = NS_ERROR_UNEXPECTED;
          break;
      }
      break;
    case 'C':
      switch (attrname[1]) {
        case 'o':
          rv = SetCompany(value);
          break;
        case 'a': // Category
          rv = SetCategory(value);
          break;
        case 'e':
          if (strlen(attrname) <= 14)
          rv = SetCellularNumber(value);
          else
            rv = SetCellularNumberType(value);
          break;
        case 'u':
          switch (attrname[6]) {
            case '1':
              rv = SetCustom1(value);
              break;
            case '2':
              rv = SetCustom2(value);
              break;
            case '3':
              rv = SetCustom3(value);
              break;
            case '4':
              rv = SetCustom4(value);
              break;
            default:
              rv = NS_ERROR_UNEXPECTED;
              break;
          }
          break;
        default:
          rv = NS_ERROR_UNEXPECTED;
          break;
      }
      break;
    case 'D':
      if (attrname[1] == 'i') 
        rv = SetDisplayName(value);
      else if (attrname[2] == 'f')
        rv = SetDefaultAddress(value);
      else 
        rv = SetDepartment(value);
      break;
    case 'F':
      switch (attrname[1]) {
      case 'i':
        rv = SetFirstName(value);
        break;
      case 'a':
        if ((attrname[2] == 'x'))
          if (strlen(attrname) <= 9)
        rv = SetFaxNumber(value);
          else
            rv = SetFaxNumberType(value);
        else
          rv = SetFamilyName(value);
        break;
      default:
        rv = NS_ERROR_UNEXPECTED;
        break;
      }
      break;
    case 'H':
      switch (attrname[4]) {
        case 'A':
          if (attrname[11] == '\0')
            rv = SetHomeAddress(value);
          else 
            rv = SetHomeAddress2(value);
          break;
        case 'C':
          if (attrname[5] == 'i')
            rv = SetHomeCity(value);
          else 
            rv = SetHomeCountry(value);
          break;
        case 'P':
          if (strlen(attrname) <= 9)
          rv = SetHomePhone(value);
          else
            rv = SetHomePhoneType(value);
          break;
        case 'S':
          rv = SetHomeState(value);
          break;
        case 'Z':
          rv = SetHomeZipCode(value);
          break;
        default:
          rv = NS_ERROR_UNEXPECTED;
          break;
      }
      break;
    case 'J':
      rv = SetJobTitle(value);
      break;
    case 'L':
      if (attrname[1] == 'a') {
        if (attrname[4] == 'N') 
          rv = SetLastName(value);
        else {
          // XXX todo 
          // fix me?  LDAP code gets here
          rv = SetLastModifiedDate(0);
        }
      }
      else
        rv = NS_ERROR_UNEXPECTED;
      break;
    case 'N':
      if (attrname[1] == 'o')
        rv = SetNotes(value);
      else 
        rv = SetNickName(value);
      break;
    case 'P':
      switch (attrname[2]) { 
        case 'e':
          switch (value.First()) {
            case 't':    // "true"
            case 'T':
              rv = SetPreferMailFormat(nsIAbPreferMailFormat::html);
              break;
            case 'f':    // "false"
            case 'F':
              rv = SetPreferMailFormat(nsIAbPreferMailFormat::plaintext);
              break;
            default:
              rv = SetPreferMailFormat(nsIAbPreferMailFormat::unknown);
              break;
          }
          break;
        case 'g':
          if (strlen(attrname) <= 11)
          rv = SetPagerNumber(value);
          else
            rv = SetPagerNumberType(value);
          break;
        case 'i':
          rv = SetPrimaryEmail(value);
          break;
        case 'o':
          if (attrname[8] == 'L')
            rv = SetPhoneticLastName(value);
          else if (attrname[8] == 'F')
            rv = SetPhoneticFirstName(value);
          break;
        default:
          rv = NS_ERROR_UNEXPECTED;
          break;
      }
      break;
    case 'S':
      if (attrname[1] == 'e')
      rv = SetSecondEmail(value);
      else
        rv = SetSpouseName(value);
      break;
    case 'W': 
      if (attrname[1] == 'e') {
        if (attrname[7] == '1')
          rv = SetWebPage1(value);
        else 
          rv = SetWebPage2(value);
      }
      else {
        switch (attrname[4]) {
          case 'A':
            if (attrname[11] == '\0')
              rv = SetWorkAddress(value);
            else 
              rv = SetWorkAddress2(value);
            break;
          case 'C':
            if (attrname[5] == 'i')
              rv = SetWorkCity(value);
            else 
              rv = SetWorkCountry(value);
            break;
          case 'P':
            if (strlen(attrname) <= 9)
            rv = SetWorkPhone(value);
            else
              rv = SetWorkPhoneType(value);
            break;
          case 'S':
            rv = SetWorkState(value);
            break;
          case 'Z':
            rv = SetWorkZipCode(value);
            break;
          default:
            rv = NS_ERROR_UNEXPECTED;
            break;
        }
      }
      break;
    default:
      rv = NS_ERROR_UNEXPECTED;
      break;
  }

  NS_ENSURE_SUCCESS(rv,rv);
  return rv;
}

NS_IMETHODIMP
nsAbCardProperty::GetLastModifiedDate(PRUint32 *aLastModifiedDate)
{
  *aLastModifiedDate = m_LastModDate;
  return NS_OK;
}

NS_IMETHODIMP
nsAbCardProperty::SetLastModifiedDate(PRUint32 aLastModifiedDate)
{
  m_LastModDate = aLastModifiedDate;
  return NS_OK;
}

#define GET_SET_STR_ATTR(_method, _member)                             \
NS_IMETHODIMP nsAbCardProperty::Get##_method(nsAString &aString)       \
{                                                                      \
  aString = _member;                                                   \
  return NS_OK;                                                        \
}                                                                      \
NS_IMETHODIMP nsAbCardProperty::Set##_method(const nsAString &aString) \
{                                                                      \
  _member = aString;                                                   \
 return NS_OK;                                                         \
}

GET_SET_STR_ATTR(FirstName, m_FirstName)
GET_SET_STR_ATTR(LastName, m_LastName)
GET_SET_STR_ATTR(PhoneticFirstName, m_PhoneticFirstName)
GET_SET_STR_ATTR(PhoneticLastName, m_PhoneticLastName)
GET_SET_STR_ATTR(DisplayName, m_DisplayName)
GET_SET_STR_ATTR(NickName, m_NickName)
GET_SET_STR_ATTR(PrimaryEmail, m_PrimaryEmail)
GET_SET_STR_ATTR(SecondEmail, m_SecondEmail)
GET_SET_STR_ATTR(WorkPhone, m_WorkPhone)
GET_SET_STR_ATTR(HomePhone, m_HomePhone)
GET_SET_STR_ATTR(FaxNumber, m_FaxNumber)
GET_SET_STR_ATTR(PagerNumber, m_PagerNumber)
GET_SET_STR_ATTR(CellularNumber, m_CellularNumber)
GET_SET_STR_ATTR(WorkPhoneType, m_WorkPhoneType)
GET_SET_STR_ATTR(HomePhoneType, m_HomePhoneType)
GET_SET_STR_ATTR(FaxNumberType, m_FaxNumberType)
GET_SET_STR_ATTR(PagerNumberType, m_PagerNumberType)
GET_SET_STR_ATTR(CellularNumberType, m_CellularNumberType)
GET_SET_STR_ATTR(HomeAddress, m_HomeAddress)
GET_SET_STR_ATTR(HomeAddress2, m_HomeAddress2)
GET_SET_STR_ATTR(HomeCity, m_HomeCity)
GET_SET_STR_ATTR(HomeState, m_HomeState)
GET_SET_STR_ATTR(HomeZipCode, m_HomeZipCode)
GET_SET_STR_ATTR(HomeCountry, m_HomeCountry)
GET_SET_STR_ATTR(WorkAddress, m_WorkAddress)
GET_SET_STR_ATTR(WorkAddress2, m_WorkAddress2)
GET_SET_STR_ATTR(WorkCity, m_WorkCity)
GET_SET_STR_ATTR(WorkState, m_WorkState)
GET_SET_STR_ATTR(WorkZipCode, m_WorkZipCode)
GET_SET_STR_ATTR(WorkCountry, m_WorkCountry)
GET_SET_STR_ATTR(JobTitle, m_JobTitle)
GET_SET_STR_ATTR(Department, m_Department)
GET_SET_STR_ATTR(Company, m_Company)
GET_SET_STR_ATTR(AimScreenName, m_AimScreenName)
GET_SET_STR_ATTR(AnniversaryYear, m_AnniversaryYear)
GET_SET_STR_ATTR(AnniversaryMonth, m_AnniversaryMonth)
GET_SET_STR_ATTR(AnniversaryDay, m_AnniversaryDay)
GET_SET_STR_ATTR(SpouseName, m_SpouseName)
GET_SET_STR_ATTR(FamilyName, m_FamilyName)
GET_SET_STR_ATTR(DefaultAddress, m_DefaultAddress)
GET_SET_STR_ATTR(Category, m_Category)
GET_SET_STR_ATTR(WebPage1, m_WebPage1)
GET_SET_STR_ATTR(WebPage2, m_WebPage2)
GET_SET_STR_ATTR(BirthYear, m_BirthYear)
GET_SET_STR_ATTR(BirthMonth, m_BirthMonth)
GET_SET_STR_ATTR(BirthDay, m_BirthDay)
GET_SET_STR_ATTR(Custom1, m_Custom1)
GET_SET_STR_ATTR(Custom2, m_Custom2)
GET_SET_STR_ATTR(Custom3, m_Custom3)
GET_SET_STR_ATTR(Custom4, m_Custom4)
GET_SET_STR_ATTR(Notes, m_Note)

// This function may be overriden by derived classes for
// nsAb*Card specific implementations.
NS_IMETHODIMP nsAbCardProperty::Copy(nsIAbCard* srcCard)
{
  NS_ENSURE_ARG_POINTER(srcCard);

	nsXPIDLString str;
  srcCard->GetFirstName(str);
  SetFirstName(str);

  srcCard->GetLastName(str);
  SetLastName(str);
  srcCard->GetPhoneticFirstName(str);
  SetPhoneticFirstName(str);
  srcCard->GetPhoneticLastName(str);
  SetPhoneticLastName(str);
  srcCard->GetDisplayName(str);
  SetDisplayName(str);
  srcCard->GetNickName(str);
  SetNickName(str);
  srcCard->GetPrimaryEmail(str);
  SetPrimaryEmail(str);
  srcCard->GetSecondEmail(str);
  SetSecondEmail(str);

  PRUint32 format = nsIAbPreferMailFormat::unknown;
  srcCard->GetPreferMailFormat(&format);
  SetPreferMailFormat(format);

  PRUint32 popularityIndex = 0;
  srcCard->GetPopularityIndex(&popularityIndex);
  SetPopularityIndex(popularityIndex);

  PRBool allowRemoteContent = PR_FALSE;
  srcCard->GetAllowRemoteContent(&allowRemoteContent);
  SetAllowRemoteContent(allowRemoteContent);

  srcCard->GetWorkPhone(str);
  SetWorkPhone(str);
  srcCard->GetHomePhone(str);
  SetHomePhone(str);
  srcCard->GetFaxNumber(str);
  SetFaxNumber(str);
  srcCard->GetPagerNumber(str);
  SetPagerNumber(str);
  srcCard->GetCellularNumber(str);
  SetCellularNumber(str);
  srcCard->GetWorkPhoneType(str);
  SetWorkPhoneType(str);
  srcCard->GetHomePhoneType(str);
  SetHomePhoneType(str);
  srcCard->GetFaxNumberType(str);
  SetFaxNumberType(str);
  srcCard->GetPagerNumberType(str);
  SetPagerNumberType(str);
  srcCard->GetCellularNumberType(str);
  SetCellularNumberType(str);
  srcCard->GetHomeAddress(str);
  SetHomeAddress(str);
  srcCard->GetHomeAddress2(str);
  SetHomeAddress2(str);
  srcCard->GetHomeCity(str);
  SetHomeCity(str);
  srcCard->GetHomeState(str);
  SetHomeState(str);
  srcCard->GetHomeZipCode(str);
  SetHomeZipCode(str);
  srcCard->GetHomeCountry(str);
  SetHomeCountry(str);
  srcCard->GetWorkAddress(str);
  SetWorkAddress(str);
  srcCard->GetWorkAddress2(str);
  SetWorkAddress2(str);
  srcCard->GetWorkCity(str);
  SetWorkCity(str);
  srcCard->GetWorkState(str);
  SetWorkState(str);
  srcCard->GetWorkZipCode(str);
  SetWorkZipCode(str);
  srcCard->GetWorkCountry(str);
  SetWorkCountry(str);
  srcCard->GetJobTitle(str);
  SetJobTitle(str);
  srcCard->GetDepartment(str);
  SetDepartment(str);
  srcCard->GetCompany(str);
  SetCompany(str);
  srcCard->GetAimScreenName(str);
  SetAimScreenName(str);

  srcCard->GetAnniversaryYear(str);
  SetAnniversaryYear(str);
  srcCard->GetAnniversaryMonth(str);
  SetAnniversaryMonth(str);
  srcCard->GetAnniversaryDay(str);
  SetAnniversaryDay(str);
  srcCard->GetSpouseName(str);
  SetSpouseName(str);
  srcCard->GetFamilyName(str);
  SetFamilyName(str);
  srcCard->GetDefaultAddress(str);
  SetDefaultAddress(str);
  srcCard->GetCategory(str);
  SetCategory(str);

  srcCard->GetWebPage1(str);
  SetWebPage1(str);
  srcCard->GetWebPage2(str);
  SetWebPage2(str);
  srcCard->GetBirthYear(str);
  SetBirthYear(str);
  srcCard->GetBirthMonth(str);
  SetBirthMonth(str);
  srcCard->GetBirthDay(str);
  SetBirthDay(str);
  srcCard->GetCustom1(str);
  SetCustom1(str);
  srcCard->GetCustom2(str);
  SetCustom2(str);
  srcCard->GetCustom3(str);
  SetCustom3(str);
  srcCard->GetCustom4(str);
  SetCustom4(str);
  srcCard->GetNotes(str);
  SetNotes(str);

  PRBool isMailList;
  srcCard->GetIsMailList(&isMailList);
  SetIsMailList(isMailList);

  nsXPIDLCString mailListURI;
  srcCard->GetMailListURI(getter_Copies(mailListURI));
  SetMailListURI(mailListURI);

  return NS_OK;
}

NS_IMETHODIMP nsAbCardProperty::Equals(nsIAbCard *card, PRBool *result)
{
  *result = (card == this);
  return NS_OK;
}

static VObject* myAddPropValue(VObject *o, const char *propName, const PRUnichar *propValue, PRBool *aCardHasData)
{
    if (aCardHasData)
        *aCardHasData = PR_TRUE;
    return addPropValue(o, propName, NS_ConvertUTF16toUTF8(propValue).get());
}

NS_IMETHODIMP nsAbCardProperty::ConvertToEscapedVCard(char **aResult)
{
    nsXPIDLString str;
    PRBool vCardHasData = PR_FALSE;
    VObject* vObj = newVObject(VCCardProp);
    VObject* t;
    
    // [comment from 4.x]
    // Big flame coming....so Vobject is not designed at all to work with  an array of 
    // attribute values. It wants you to have all of the attributes easily available. You
    // cannot add one attribute at a time as you find them to the vobject. Why? Because
    // it creates a property for a particular type like phone number and then that property
    // has multiple values. This implementation is not pretty. I can hear my algos prof
    // yelling from here.....I have to do a linear search through my attributes array for
    // EACH vcard property we want to set. *sigh* One day I will have time to come back
    // to this function and remedy this O(m*n) function where n = # attribute values and
    // m = # of vcard properties....  

    (void)GetDisplayName(str);
    if (!str.IsEmpty()) {
        myAddPropValue(vObj, VCFullNameProp, str.get(), &vCardHasData);
    }
    
    (void)GetLastName(str);
    if (!str.IsEmpty()) {
        t = isAPropertyOf(vObj, VCNameProp);
        if (!t)
            t = addProp(vObj, VCNameProp);
        myAddPropValue(t, VCFamilyNameProp, str.get(), &vCardHasData);
    }
    
    (void)GetFirstName(str);
    if (!str.IsEmpty()) {
        t = isAPropertyOf(vObj, VCNameProp);
        if (!t)
            t = addProp(vObj, VCNameProp);
        myAddPropValue(t, VCGivenNameProp, str.get(), &vCardHasData);
    }

    (void)GetCompany(str);
    if (!str.IsEmpty())
    {
        t = isAPropertyOf(vObj, VCOrgProp);
        if (!t)
            t = addProp(vObj, VCOrgProp);
        myAddPropValue(t, VCOrgNameProp, str.get(), &vCardHasData);
    }

    (void)GetDepartment(str);
    if (!str.IsEmpty())
    {
        t = isAPropertyOf(vObj, VCOrgProp);
        if (!t)
            t = addProp(vObj, VCOrgProp);
        myAddPropValue(t, VCOrgUnitProp, str.get(), &vCardHasData);
    }
 
    (void)GetWorkAddress2(str);
    if (!str.IsEmpty())
    {
        t = isAPropertyOf(vObj, VCAdrProp);
        if  (!t)
            t = addProp(vObj, VCAdrProp);
        myAddPropValue(t, VCPostalBoxProp, str.get(), &vCardHasData);  
    }

    (void)GetWorkAddress(str);
    if (!str.IsEmpty())
    {
        t = isAPropertyOf(vObj, VCAdrProp);
        if  (!t)
            t = addProp(vObj, VCAdrProp);
        myAddPropValue(t, VCStreetAddressProp, str.get(), &vCardHasData);
    }

    (void)GetWorkCity(str);
    if (!str.IsEmpty())
    {
        t = isAPropertyOf(vObj, VCAdrProp);
        if  (!t)
            t = addProp(vObj, VCAdrProp);
        myAddPropValue(t, VCCityProp, str.get(), &vCardHasData);
    }

    (void)GetWorkState(str);
    if (!str.IsEmpty())
    {
        t = isAPropertyOf(vObj, VCAdrProp);
        if  (!t)
            t = addProp(vObj, VCAdrProp);
        myAddPropValue(t, VCRegionProp, str.get(), &vCardHasData);
    }

    (void)GetWorkZipCode(str);
    if (!str.IsEmpty())
    {
        t = isAPropertyOf(vObj, VCAdrProp);
        if  (!t)
            t = addProp(vObj, VCAdrProp);
        myAddPropValue(t, VCPostalCodeProp, str.get(), &vCardHasData);
    }

    (void)GetWorkCountry(str);
    if (!str.IsEmpty())
    {
        t = isAPropertyOf(vObj, VCAdrProp);
        if  (!t)
            t = addProp(vObj, VCAdrProp);
        myAddPropValue(t, VCCountryNameProp, str.get(), &vCardHasData);
    }
    else
    {
        // only add this if VCAdrProp already exists
        t = isAPropertyOf(vObj, VCAdrProp);
        if (t)
        {
            addProp(t, VCDomesticProp);
        }
    }

    (void)GetPrimaryEmail(str);
    if (!str.IsEmpty())
    {
        t = myAddPropValue(vObj, VCEmailAddressProp, str.get(), &vCardHasData);  
        addProp(t, VCInternetProp);
    }
 
    (void)GetJobTitle(str);
    if (!str.IsEmpty())
    {
        myAddPropValue(vObj, VCTitleProp, str.get(), &vCardHasData);
    }

    (void)GetWorkPhone(str);
    if (!str.IsEmpty())
    {
        t = myAddPropValue(vObj, VCTelephoneProp, str.get(), &vCardHasData);
        addProp(t, VCWorkProp);
    }

    (void)GetFaxNumber(str);
    if (!str.IsEmpty())
    {
        t = myAddPropValue(vObj, VCTelephoneProp, str.get(), &vCardHasData);
        addProp(t, VCFaxProp);
    }

    (void)GetPagerNumber(str);
    if (!str.IsEmpty())
    {
        t = myAddPropValue(vObj, VCTelephoneProp, str.get(), &vCardHasData);
        addProp(t, VCPagerProp);
    }
    
    (void)GetHomePhone(str);
    if (!str.IsEmpty())
    {
        t = myAddPropValue(vObj, VCTelephoneProp, str.get(), &vCardHasData);
        addProp(t, VCHomeProp);
    }

    (void)GetCellularNumber(str);
    if (!str.IsEmpty())
    {
        t = myAddPropValue(vObj, VCTelephoneProp, str.get(), &vCardHasData);
        addProp(t, VCCellularProp);
    }

    (void)GetNotes(str);
    if (!str.IsEmpty())
    {
        myAddPropValue(vObj, VCNoteProp, str.get(), &vCardHasData);
    }
    
    PRUint32 format;
    (void)GetPreferMailFormat(&format);
    if (format == nsIAbPreferMailFormat::html) {
        myAddPropValue(vObj, VCUseHTML, NS_LITERAL_STRING("TRUE").get(), &vCardHasData);
    }
    else if (format == nsIAbPreferMailFormat::plaintext) {
        myAddPropValue(vObj, VCUseHTML, NS_LITERAL_STRING("FALSE").get(), &vCardHasData);
    }

    (void)GetWebPage1(str);
    if (!str.IsEmpty())
    {
        myAddPropValue(vObj, VCURLProp, str.get(), &vCardHasData);
    }
    
    myAddPropValue(vObj, VCVersionProp, NS_LITERAL_STRING("2.1").get(), nsnull);

    if (!vCardHasData) {
        *aResult = PL_strdup("");
        return NS_OK;
    }

    int len = 0;
    char *vCard = writeMemVObject(0, &len, vObj);
    if (vObj)
        cleanVObject(vObj);

    *aResult = nsEscape(vCard, url_Path);
    return (*aResult ? NS_OK : NS_ERROR_OUT_OF_MEMORY);
}

NS_IMETHODIMP nsAbCardProperty::ConvertToBase64EncodedXML(char **result)
{
  nsresult rv;
  nsString xmlStr;

  xmlStr.AppendLiteral("<?xml version=\"1.0\"?>\n"
                       "<?xml-stylesheet type=\"text/css\" href=\"chrome://messenger/content/addressbook/print.css\"?>\n"
                       "<directory>\n");

  // Get Address Book string and set it as title of XML document
  nsCOMPtr<nsIStringBundle> bundle;
  nsCOMPtr<nsIStringBundleService> stringBundleService = do_GetService(NS_STRINGBUNDLE_CONTRACTID, &rv); 
  if (NS_SUCCEEDED(rv)) {
    rv = stringBundleService->CreateBundle(sAddrbookProperties, getter_AddRefs(bundle));
    if (NS_SUCCEEDED(rv)) {
      nsXPIDLString addrBook;
      rv = bundle->GetStringFromName(NS_LITERAL_STRING("addressBook").get(), getter_Copies(addrBook));
      if (NS_SUCCEEDED(rv)) {
        xmlStr.AppendLiteral("<title xmlns=\"http://www.w3.org/1999/xhtml\">");
        xmlStr.Append(addrBook);
        xmlStr.AppendLiteral("</title>\n");
      }
    }
  }

  nsXPIDLString xmlSubstr;
  rv = ConvertToXMLPrintData(xmlSubstr);
  NS_ENSURE_SUCCESS(rv,rv);

  xmlStr.Append(xmlSubstr);
  xmlStr.AppendLiteral("</directory>\n");

  *result = PL_Base64Encode(NS_ConvertUTF16toUTF8(xmlStr).get(), 0, nsnull);
  return (*result ? NS_OK : NS_ERROR_OUT_OF_MEMORY);
}

NS_IMETHODIMP nsAbCardProperty::ConvertToXMLPrintData(nsAString &aXMLSubstr)
{
  nsresult rv;
  nsCOMPtr<nsIPrefBranch> prefBranch = do_GetService(NS_PREFSERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);
  
  PRInt32 generatedNameFormat;
  rv = prefBranch->GetIntPref(PREF_MAIL_ADDR_BOOK_LASTNAMEFIRST, &generatedNameFormat);
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsIAddrBookSession> abSession = do_GetService(NS_ADDRBOOKSESSION_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);
  
  nsXPIDLString generatedName;
  rv = abSession->GenerateNameFromCard(this, generatedNameFormat, getter_Copies(generatedName));
  NS_ENSURE_SUCCESS(rv,rv);
  
  nsCOMPtr<mozITXTToHTMLConv> conv = do_CreateInstance(MOZ_TXTTOHTMLCONV_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  nsString xmlStr;
  xmlStr.SetCapacity(4096); // to reduce allocations. should be enough for most cards
  xmlStr.AssignLiteral("<GeneratedName>\n");

  nsCOMPtr<nsIStringBundle> bundle;

  nsCOMPtr<nsIStringBundleService> stringBundleService = do_GetService(NS_STRINGBUNDLE_CONTRACTID, &rv); 
  NS_ENSURE_SUCCESS(rv,rv);

  rv = stringBundleService->CreateBundle(sAddrbookProperties, getter_AddRefs(bundle));
  NS_ENSURE_SUCCESS(rv,rv); 
  
  nsXPIDLString heading;
  rv = bundle->GetStringFromName(NS_LITERAL_STRING("headingCardFor").get(), getter_Copies(heading));
  NS_ENSURE_SUCCESS(rv, rv);

  xmlStr.Append(heading);
  xmlStr.Append(PRUnichar(' '));

  // use ScanTXT to convert < > & to safe values.
  nsXPIDLString safeText;
  if (!generatedName.IsEmpty()) {
    rv = conv->ScanTXT(generatedName, mozITXTToHTMLConv::kEntities,
                       getter_Copies(safeText));
    NS_ENSURE_SUCCESS(rv,rv);
  }

  if (safeText.IsEmpty()) {
    nsAutoString primaryEmail;
    rv = GetCardValue(kPriEmailColumn, primaryEmail);
    NS_ENSURE_SUCCESS(rv,rv);

    // use ScanTXT to convert < > & to safe values.
    rv = conv->ScanTXT(primaryEmail.get(), mozITXTToHTMLConv::kEntities,
                       getter_Copies(safeText));
    NS_ENSURE_SUCCESS(rv,rv);
  }
  xmlStr.Append(safeText);
          
  xmlStr.AppendLiteral("</GeneratedName>\n"
                       "<table><tr><td>");

  rv = AppendSection(NAME_ATTRS_ARRAY, sizeof(NAME_ATTRS_ARRAY)/sizeof(AppendItem), EmptyString(), bundle, conv, xmlStr);

  xmlStr.AppendLiteral("</td></tr><tr><td>");

  rv = AppendSection(PHONE_ATTRS_ARRAY, sizeof(PHONE_ATTRS_ARRAY)/sizeof(AppendItem), NS_LITERAL_STRING("headingPhone"), bundle, conv, xmlStr);

  if (!m_IsMailList) {
    rv = AppendSection(CUSTOM_ATTRS_ARRAY, sizeof(CUSTOM_ATTRS_ARRAY)/sizeof(AppendItem), NS_LITERAL_STRING("headingOther"), bundle, conv, xmlStr);
  }
  else {
    rv = AppendSection(CUSTOM_ATTRS_ARRAY, sizeof(CUSTOM_ATTRS_ARRAY)/sizeof(AppendItem), NS_LITERAL_STRING("headingDescription"),
         bundle, conv, xmlStr);
    
    xmlStr.AppendLiteral("<section><sectiontitle>");

    rv = bundle->GetStringFromName(NS_LITERAL_STRING("headingAddresses").get(), getter_Copies(heading));
    NS_ENSURE_SUCCESS(rv, rv);

    xmlStr.Append(heading);
    xmlStr.AppendLiteral("</sectiontitle>");

    nsCOMPtr<nsIRDFService> rdfService = do_GetService("@mozilla.org/rdf/rdf-service;1", &rv);
    NS_ENSURE_SUCCESS(rv,rv);
      
    nsCOMPtr <nsIRDFResource> resource;
    rv = rdfService->GetResource(m_MailListURI, getter_AddRefs(resource));
    NS_ENSURE_SUCCESS(rv,rv);
    
    nsCOMPtr <nsIAbDirectory> mailList = do_QueryInterface(resource, &rv);
    NS_ENSURE_SUCCESS(rv,rv);
    
    nsCOMPtr<nsISupportsArray> addresses;
    rv = mailList->GetAddressLists(getter_AddRefs(addresses));
    if (addresses) {
      PRUint32 total = 0;
      addresses->Count(&total);
      if (total) {
        PRUint32 i;
        nsAutoString displayName;
        nsAutoString primaryEmail;
        for (i = 0; i < total; i++) {
          nsCOMPtr <nsIAbCard> listCard = do_QueryElementAt(addresses, i, &rv);
          NS_ENSURE_SUCCESS(rv,rv);

          xmlStr.AppendLiteral("<PrimaryEmail>\n");

          rv = listCard->GetDisplayName(displayName);
          NS_ENSURE_SUCCESS(rv,rv);

          // use ScanTXT to convert < > & to safe values.
          nsXPIDLString safeText;
          rv = conv->ScanTXT(displayName.get(), mozITXTToHTMLConv::kEntities,
                             getter_Copies(safeText));
          NS_ENSURE_SUCCESS(rv,rv);
          xmlStr.Append(safeText);

          xmlStr.AppendLiteral(" &lt;");
          
          rv = listCard->GetPrimaryEmail(primaryEmail);
          NS_ENSURE_SUCCESS(rv,rv);

          // use ScanTXT to convert < > & to safe values.
          rv = conv->ScanTXT(primaryEmail.get(), mozITXTToHTMLConv::kEntities,
                             getter_Copies(safeText));
          NS_ENSURE_SUCCESS(rv,rv);
          xmlStr.Append(safeText);

          xmlStr.AppendLiteral("&gt;</PrimaryEmail>\n");
        }
      }
    }
    xmlStr.AppendLiteral("</section>");
  }

  xmlStr.AppendLiteral("</td><td>");

  rv = AppendSection(HOME_ATTRS_ARRAY, sizeof(HOME_ATTRS_ARRAY)/sizeof(AppendItem), NS_LITERAL_STRING("headingHome"), bundle, conv, xmlStr);
  rv = AppendSection(WORK_ATTRS_ARRAY, sizeof(WORK_ATTRS_ARRAY)/sizeof(AppendItem), NS_LITERAL_STRING("headingWork"), bundle, conv, xmlStr);
  
  xmlStr.AppendLiteral("</td></tr></table>");

  aXMLSubstr = xmlStr;

  return NS_OK;
}

nsresult nsAbCardProperty::AppendData(const char *aAttrName, mozITXTToHTMLConv *aConv, nsString &aResult)
{
  nsXPIDLString attrValue;
  nsresult rv = GetCardValue(aAttrName, attrValue);
  NS_ENSURE_SUCCESS(rv,rv);

  if (attrValue.IsEmpty())
    return NS_OK;

  nsAutoString attrNameStr;
  attrNameStr.AssignWithConversion(aAttrName);
  
  aResult.Append(PRUnichar('<'));
  aResult.Append(attrNameStr);
  aResult.Append(PRUnichar('>'));
  
  // use ScanTXT to convert < > & to safe values.
  nsXPIDLString safeText;
  rv = aConv->ScanTXT(attrValue, mozITXTToHTMLConv::kEntities, getter_Copies(safeText));
  NS_ENSURE_SUCCESS(rv,rv);
  aResult.Append(safeText);

  aResult.AppendLiteral("</");
  aResult.Append(attrNameStr);
  aResult.Append(PRUnichar('>'));

  return NS_OK;
}

nsresult nsAbCardProperty::AppendSection(const AppendItem *aArray, PRInt16 aCount, const nsAFlatString& aHeading,
                                         nsIStringBundle *aBundle,
                                         mozITXTToHTMLConv *aConv,
                                         nsString &aResult)
{
  nsresult rv = NS_OK;

  aResult.AppendLiteral("<section>");

  nsXPIDLString attrValue;
  PRBool sectionIsEmpty = PR_TRUE;

  PRInt16 i = 0;
  for (i=0;i<aCount;i++) {
    rv = GetCardValue(aArray[i].mColumn, attrValue);
    NS_ENSURE_SUCCESS(rv,rv);
    sectionIsEmpty &= attrValue.IsEmpty();
  }

  if (!sectionIsEmpty && !aHeading.IsEmpty()) {
    nsXPIDLString heading;
    rv = aBundle->GetStringFromName(aHeading.get(), getter_Copies(heading));
    NS_ENSURE_SUCCESS(rv, rv);

    aResult.AppendLiteral("<sectiontitle>");
    aResult.Append(heading);
    aResult.AppendLiteral("</sectiontitle>");
  }

  for (i=0;i<aCount;i++) {
    switch (aArray[i].mAppendType) {
      case eAppendLine:
        rv = AppendLine(aArray[i], aConv, aResult);
        break;
      case eAppendLabel:
        rv = AppendLabel(aArray[i], aBundle, aConv, aResult);
        break;
      case eAppendCityStateZip:
        rv = AppendCityStateZip(aArray[i], aBundle, aConv, aResult);
        break;
      default:
        rv = NS_ERROR_FAILURE;
        break;
    }

    if (NS_FAILED(rv)) {
      NS_WARNING("append item failed");
      break;
    }
  }
  aResult.AppendLiteral("</section>");

  return rv;
}

nsresult nsAbCardProperty::AppendLine(const AppendItem &aItem,
                                      mozITXTToHTMLConv *aConv,
                                      nsString &aResult)
{
  NS_ENSURE_ARG_POINTER(aConv);

  nsXPIDLString attrValue;
  nsresult rv = GetCardValue(aItem.mColumn, attrValue);
  NS_ENSURE_SUCCESS(rv,rv);

  if (attrValue.IsEmpty())
    return NS_OK; 

  nsAutoString attrNameStr;
  attrNameStr.AssignWithConversion(aItem.mColumn);
  
  aResult.Append(PRUnichar('<'));
  aResult.Append(attrNameStr);
  aResult.Append(PRUnichar('>'));
  
  // use ScanTXT to convert < > & to safe values.
  nsXPIDLString safeText;
  rv = aConv->ScanTXT(attrValue, mozITXTToHTMLConv::kEntities, getter_Copies(safeText));
  NS_ENSURE_SUCCESS(rv,rv);
  aResult.Append(safeText);

  aResult.AppendLiteral("</");
  aResult.Append(attrNameStr);
  aResult.Append(PRUnichar('>'));

  return NS_OK;
}

nsresult nsAbCardProperty::AppendLabel(const AppendItem &aItem,
                                       nsIStringBundle *aBundle,
                                       mozITXTToHTMLConv *aConv,
                                       nsString &aResult)
{
  NS_ENSURE_ARG_POINTER(aBundle);

  nsresult rv;
  
  nsXPIDLString label;
  
  nsXPIDLString attrValue;

  rv = GetCardValue(aItem.mColumn, attrValue);
  NS_ENSURE_SUCCESS(rv,rv);

  if (attrValue.IsEmpty())
    return NS_OK;

  rv = aBundle->GetStringFromName(NS_ConvertASCIItoUTF16(aItem.mLabel).get(), getter_Copies(label));
  NS_ENSURE_SUCCESS(rv, rv);

  aResult.AppendLiteral("<labelrow><label>");

  aResult.Append(label);
  aResult.AppendLiteral(": </label>");

  rv = AppendLine(aItem, aConv, aResult);
  NS_ENSURE_SUCCESS(rv,rv);

  aResult.AppendLiteral("</labelrow>");
  
  return NS_OK;
}

nsresult nsAbCardProperty::AppendCityStateZip(const AppendItem &aItem,
                                              nsIStringBundle *aBundle,
                                              mozITXTToHTMLConv *aConv,
                                              nsString &aResult) 
{
  NS_ENSURE_ARG_POINTER(aBundle);

  nsresult rv;
  AppendItem item;
  const char *stateCol, *zipCol;

  if (strcmp(aItem.mColumn, kHomeCityColumn) == 0) {
    stateCol = kHomeStateColumn;
    zipCol = kHomeZipCodeColumn;
  }
  else {
    stateCol = kWorkStateColumn;
    zipCol = kWorkZipCodeColumn;
  }

  nsAutoString cityResult, stateResult, zipResult;

  rv = AppendLine(aItem, aConv, cityResult);
  NS_ENSURE_SUCCESS(rv,rv);
  
  item.mColumn = stateCol;
  item.mLabel = "";

  rv = AppendLine(item, aConv, stateResult);
  NS_ENSURE_SUCCESS(rv,rv);

  item.mColumn = zipCol;

  rv = AppendLine(item, aConv, zipResult);
  NS_ENSURE_SUCCESS(rv,rv);

  nsXPIDLString formattedString;

  if (!cityResult.IsEmpty() && !stateResult.IsEmpty() && !zipResult.IsEmpty()) {
    const PRUnichar *formatStrings[] = { cityResult.get(), stateResult.get(), zipResult.get() };
    rv = aBundle->FormatStringFromName(NS_LITERAL_STRING("cityAndStateAndZip").get(), formatStrings, NS_ARRAY_LENGTH(formatStrings), getter_Copies(formattedString));
    NS_ENSURE_SUCCESS(rv,rv);
  }
  else if (!cityResult.IsEmpty() && !stateResult.IsEmpty() && zipResult.IsEmpty()) {
    const PRUnichar *formatStrings[] = { cityResult.get(), stateResult.get() };
    rv = aBundle->FormatStringFromName(NS_LITERAL_STRING("cityAndStateNoZip").get(), formatStrings, NS_ARRAY_LENGTH(formatStrings), getter_Copies(formattedString));
    NS_ENSURE_SUCCESS(rv,rv);
  }
  else if ((!cityResult.IsEmpty() && stateResult.IsEmpty() && !zipResult.IsEmpty()) ||
          (cityResult.IsEmpty() && !stateResult.IsEmpty() && !zipResult.IsEmpty())) {
    const PRUnichar *formatStrings[] = { cityResult.IsEmpty() ? stateResult.get() : cityResult.get(), zipResult.get() };
    rv = aBundle->FormatStringFromName(NS_LITERAL_STRING("cityOrStateAndZip").get(), formatStrings, NS_ARRAY_LENGTH(formatStrings), getter_Copies(formattedString));
    NS_ENSURE_SUCCESS(rv,rv);
  }
  else {
    if (!cityResult.IsEmpty()) 
      formattedString = cityResult;
    else if (!stateResult.IsEmpty()) 
      formattedString = stateResult;
    else 
      formattedString = zipResult;
  }

  aResult.Append(formattedString);

  return NS_OK;
}
