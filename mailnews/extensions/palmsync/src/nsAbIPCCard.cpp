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
 * Portions created by the Initial Developer are Copyright (C) 2002
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Created by: Rajiv Dayal <rdayal@netscape.com>
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

#include <windows.h>
#include <tchar.h>

#include "nsAbIPCCard.h"
#include "nsUnicharUtils.h"
#include "nsIAddrDatabase.h"
#include "prdtoa.h"
#include "PalmSyncImp.h"

extern PRLogModuleInfo *PALMSYNC;

#define CONVERT_ASSIGNTO_UNICODE(d, s, convertCRLF)  d.Truncate();\
                                        if((char*) s) d.AppendASCII((char*)s);\
                                        if (convertCRLF) \
                                          d.ReplaceSubstring(NS_LITERAL_STRING("\x0D\x0A").get(),NS_LITERAL_STRING(" ").get());

#define CONVERT_CRLF_TO_SPACE(d, s) d.Assign(s); \
                                    d.ReplaceSubstring(NS_LITERAL_STRING("\x0D\x0A").get(),NS_LITERAL_STRING(" ").get());

NS_IMPL_ISUPPORTS_INHERITED0(nsAbIPCCard, nsAbCardProperty)

nsAbIPCCard::nsAbIPCCard()
{
    mRecordId = 0;
    mCategoryId = -1;
    mStatus = -1;
    PR_LOG(PALMSYNC, PR_LOG_DEBUG, ("nsAbIPCCard::nsAbIPCCard \n"));
}

nsAbIPCCard::~nsAbIPCCard()
{
   
}

nsAbIPCCard::nsAbIPCCard(nsIAbCard *card)
{
    Copy(card);
}

nsAbIPCCard::nsAbIPCCard(nsABCOMCardStruct *card, PRBool isUnicode)
{
    if(isUnicode)
        Copy(card);
    else
        ConvertToUnicodeAndCopy(card);
}

NS_IMETHODIMP nsAbIPCCard::Copy(nsIAbCard *srcCard)
{
    NS_ENSURE_ARG_POINTER(srcCard);

    nsString palmIDStr;
    nsresult rv = srcCard->GetPropertyAsAString(CARD_ATTRIB_PALMID, palmIDStr);
   if (NS_SUCCEEDED(rv) && !palmIDStr.IsEmpty()) {
     PRFloat64 f = PR_strtod(NS_LossyConvertUTF16toASCII(palmIDStr).get(), nsnull);
     PRInt64 l;
     LL_D2L(l, f);
     LL_L2UI(mRecordId, l);
   }
   else
     mRecordId = 0;

   PRUint32 rowID = 0;
   srcCard->GetPropertyAsUint32("DbRowID", &rowID);
   SetPropertyAsUint32("DbRowID", rowID);

   PRUint32 key = 0;
   srcCard->GetPropertyAsUint32("RecordKey", &key);
   SetPropertyAsUint32("RecordKey", key);

   PRUint32 lastModifiedDate = 0;
   srcCard->GetPropertyAsUint32(kLastModifiedDateProperty, &lastModifiedDate);
   mStatus = (lastModifiedDate) ? ATTR_MODIFIED : ATTR_NEW;


    rv = nsAbCardProperty::Copy(srcCard);
    // do we need to join the work and home addresses?
    // or split them?

    return rv;
}

nsresult nsAbIPCCard::Copy(nsABCOMCardStruct * srcCard)
{
    NS_ENSURE_ARG_POINTER(srcCard);

    mRecordId = srcCard->dwRecordId;
    mCategoryId = srcCard->dwCategoryId;
    mStatus = srcCard->dwStatus;
    srcCard->addressToUse = CPalmSyncImp::nsUseABHomeAddressForPalmAddress(); // 0 == work, 1 == home
    PR_LOG(PALMSYNC, PR_LOG_DEBUG, ("nsAbIPCCard::Copy using %d\n", srcCard->addressToUse));

    // Each palm address field is allowed to have multiple lines
    // so replace CRLFs with spaces (since other than Notes field
    // moz only displays fields in a single line).
    nsAutoString str;
    CONVERT_CRLF_TO_SPACE(str, srcCard->firstName);
    SetFirstName(str);

    CONVERT_CRLF_TO_SPACE(str, srcCard->lastName);
    SetLastName(str);

    CONVERT_CRLF_TO_SPACE(str, srcCard->displayName);
    SetDisplayName(str);

    CONVERT_CRLF_TO_SPACE(str, srcCard->nickName);
    SetPropertyAsAString(kNicknameProperty, str);

    CONVERT_CRLF_TO_SPACE(str, srcCard->primaryEmail);
    SetPrimaryEmail(str);

    CONVERT_CRLF_TO_SPACE(str, srcCard->secondEmail);
    SetPropertyAsAString(k2ndEmailProperty, str);

    SetPropertyAsUint32(kPreferMailFormatProperty, srcCard->preferMailFormat);

    CONVERT_CRLF_TO_SPACE(str, srcCard->workPhone);
    SetPropertyAsAString(kWorkPhoneProperty, str);

    CONVERT_CRLF_TO_SPACE(str, srcCard->homePhone);
    SetPropertyAsAString(kHomePhoneProperty, str);

    CONVERT_CRLF_TO_SPACE(str, srcCard->faxNumber);
    SetPropertyAsAString(kFaxProperty, str);

    CONVERT_CRLF_TO_SPACE(str, srcCard->pagerNumber);
    SetPropertyAsAString(kPagerProperty, str);

    CONVERT_CRLF_TO_SPACE(str, srcCard->cellularNumber);
    SetPropertyAsAString(kCellularProperty, str);

    // See if home address contains multiple lines.
    SplitHomeAndWorkAddresses(srcCard, PR_TRUE);

    CONVERT_CRLF_TO_SPACE(str, srcCard->homeCity);
    SetPropertyAsAString(kHomeCityProperty, str);

    CONVERT_CRLF_TO_SPACE(str, srcCard->homeState);
    SetPropertyAsAString(kHomeStateProperty, str);

    CONVERT_CRLF_TO_SPACE(str, srcCard->homeZipCode);
    SetPropertyAsAString(kHomeZipCodeProperty, str);

    CONVERT_CRLF_TO_SPACE(str, srcCard->homeCountry);
    SetPropertyAsAString(kHomeCountryProperty, str);

    CONVERT_CRLF_TO_SPACE(str, srcCard->workCity);
    SetPropertyAsAString(kWorkCityProperty, str);

    CONVERT_CRLF_TO_SPACE(str, srcCard->workState);
    SetPropertyAsAString(kWorkStateProperty, str);

    CONVERT_CRLF_TO_SPACE(str, srcCard->workZipCode);
    SetPropertyAsAString(kWorkZipCodeProperty, str);

    CONVERT_CRLF_TO_SPACE(str, srcCard->workCountry);
    SetPropertyAsAString(kWorkCountryProperty, str);

    CONVERT_CRLF_TO_SPACE(str, srcCard->jobTitle);
    SetPropertyAsAString(kJobTitleProperty, str);

    CONVERT_CRLF_TO_SPACE(str, srcCard->department);
    SetPropertyAsAString(kDepartmentProperty, str);

    CONVERT_CRLF_TO_SPACE(str, srcCard->company);
    SetPropertyAsAString(kCompanyProperty, str);

    CONVERT_CRLF_TO_SPACE(str, srcCard->webPage1);
    SetPropertyAsAString(kWorkWebPageProperty, str);

    CONVERT_CRLF_TO_SPACE(str, srcCard->webPage2);
    SetPropertyAsAString(kHomeWebPageProperty, str);

    CONVERT_CRLF_TO_SPACE(str, srcCard->birthYear);
    SetPropertyAsAString(kBirthYearProperty, str);

    CONVERT_CRLF_TO_SPACE(str, srcCard->birthMonth);
    SetPropertyAsAString(kBirthMonthProperty, str);

    CONVERT_CRLF_TO_SPACE(str, srcCard->birthDay);
    SetPropertyAsAString(kBirthDayProperty, str);

    CONVERT_CRLF_TO_SPACE(str, srcCard->custom1);
    SetPropertyAsAString(kCustom1Property, str);

    CONVERT_CRLF_TO_SPACE(str, srcCard->custom2);
    SetPropertyAsAString(kCustom2Property, str);

    CONVERT_CRLF_TO_SPACE(str, srcCard->custom3);
    SetPropertyAsAString(kCustom3Property, str);

    CONVERT_CRLF_TO_SPACE(str, srcCard->custom4);
    SetPropertyAsAString(kCustom4Property, str);

    str.Assign(srcCard->notes);
    SetPropertyAsAString(kNotesProperty, str);
    SetPropertyAsUint32(kLastModifiedDateProperty, srcCard->lastModifiedDate);
    SetIsMailList(srcCard->isMailList);
    SetMailListURI(srcCard->mailListURI);

    return NS_OK;
}

nsresult nsAbIPCCard::ConvertToUnicodeAndCopy(nsABCOMCardStruct * srcCard)
{
    NS_ENSURE_ARG_POINTER(srcCard);

    mRecordId = srcCard->dwRecordId;
    mCategoryId = srcCard->dwCategoryId;
    mStatus = srcCard->dwStatus;

    nsAutoString str;

    // Each palm address field is allowed to have multiple lines
    // so replace CRLFs with spaces (since other than Notes field
    // moz only displays fields in a single line).
    CONVERT_ASSIGNTO_UNICODE(str, srcCard->firstName, PR_TRUE);
    SetFirstName(str);

    CONVERT_ASSIGNTO_UNICODE(str, srcCard->lastName, PR_TRUE);
    SetLastName(str);

    CONVERT_ASSIGNTO_UNICODE(str, srcCard->displayName, PR_TRUE);
    SetDisplayName(str);

    CONVERT_ASSIGNTO_UNICODE(str, srcCard->nickName, PR_TRUE);
    SetPropertyAsAString(kNicknameProperty, str);

    CONVERT_ASSIGNTO_UNICODE(str, srcCard->primaryEmail, PR_TRUE);
    SetPrimaryEmail(str);

    CONVERT_ASSIGNTO_UNICODE(str, srcCard->secondEmail, PR_TRUE);
    SetPropertyAsAString(k2ndEmailProperty, str);

    SetPropertyAsUint32(kPreferMailFormatProperty, srcCard->preferMailFormat);

    CONVERT_ASSIGNTO_UNICODE(str, srcCard->workPhone, PR_TRUE);
    SetPropertyAsAString(kWorkPhoneProperty, str);

    CONVERT_ASSIGNTO_UNICODE(str, srcCard->homePhone, PR_TRUE);
    SetPropertyAsAString(kHomePhoneProperty, str);

    CONVERT_ASSIGNTO_UNICODE(str, srcCard->faxNumber, PR_TRUE);
    SetPropertyAsAString(kFaxProperty, str);

    CONVERT_ASSIGNTO_UNICODE(str, srcCard->pagerNumber, PR_TRUE);
    SetPropertyAsAString(kPagerProperty, str);

    CONVERT_ASSIGNTO_UNICODE(str, srcCard->cellularNumber, PR_TRUE);
    SetPropertyAsAString(kCellularProperty, str);

    // See if home address contains multiple lines.
    SplitHomeAndWorkAddresses(srcCard, PR_FALSE);

    CONVERT_ASSIGNTO_UNICODE(str, srcCard->homeCity, PR_TRUE);
    SetPropertyAsAString(kHomeCityProperty, str);

    CONVERT_ASSIGNTO_UNICODE(str, srcCard->homeState, PR_TRUE);
    SetPropertyAsAString(kHomeStateProperty, str);

    CONVERT_ASSIGNTO_UNICODE(str, srcCard->homeZipCode, PR_TRUE);
    SetPropertyAsAString(kHomeZipCodeProperty, str);

    CONVERT_ASSIGNTO_UNICODE(str, srcCard->homeCountry, PR_TRUE);
    SetPropertyAsAString(kHomeCountryProperty, str);

    CONVERT_ASSIGNTO_UNICODE(str, srcCard->workCity, PR_TRUE);
    SetPropertyAsAString(kWorkCityProperty, str);

    CONVERT_ASSIGNTO_UNICODE(str, srcCard->workState, PR_TRUE);
    SetPropertyAsAString(kWorkStateProperty, str);

    CONVERT_ASSIGNTO_UNICODE(str, srcCard->workZipCode, PR_TRUE);
    SetPropertyAsAString(kWorkZipCodeProperty, str);

    CONVERT_ASSIGNTO_UNICODE(str, srcCard->workCountry, PR_TRUE);
    SetPropertyAsAString(kWorkCountryProperty, str);

    CONVERT_ASSIGNTO_UNICODE(str, srcCard->jobTitle, PR_TRUE);
    SetPropertyAsAString(kJobTitleProperty, str);

    CONVERT_ASSIGNTO_UNICODE(str, srcCard->department, PR_TRUE);
    SetPropertyAsAString(kDepartmentProperty, str);

    CONVERT_ASSIGNTO_UNICODE(str, srcCard->company, PR_TRUE);
    SetPropertyAsAString(kCompanyProperty, str);

    CONVERT_ASSIGNTO_UNICODE(str, srcCard->webPage1, PR_TRUE);
    SetPropertyAsAString(kWorkWebPageProperty, str);

    CONVERT_ASSIGNTO_UNICODE(str, srcCard->webPage2, PR_TRUE);
    SetPropertyAsAString(kHomeWebPageProperty, str);

    CONVERT_ASSIGNTO_UNICODE(str, srcCard->birthYear, PR_TRUE);
    SetPropertyAsAString(kBirthYearProperty, str);

    CONVERT_ASSIGNTO_UNICODE(str, srcCard->birthMonth, PR_TRUE);
    SetPropertyAsAString(kBirthMonthProperty, str);

    CONVERT_ASSIGNTO_UNICODE(str, srcCard->birthDay, PR_TRUE);
    SetPropertyAsAString(kBirthDayProperty, str);

    CONVERT_ASSIGNTO_UNICODE(str, srcCard->custom1, PR_TRUE);
    SetPropertyAsAString(kCustom1Property, str);

    CONVERT_ASSIGNTO_UNICODE(str, srcCard->custom2, PR_TRUE);
    SetPropertyAsAString(kCustom2Property, str);

    CONVERT_ASSIGNTO_UNICODE(str, srcCard->custom3, PR_TRUE);
    SetPropertyAsAString(kCustom3Property, str);

    CONVERT_ASSIGNTO_UNICODE(str, srcCard->custom4, PR_TRUE);
    SetPropertyAsAString(kCustom4Property, str);

    CONVERT_ASSIGNTO_UNICODE(str, srcCard->notes, PR_FALSE);
    SetPropertyAsAString(kNotesProperty, str);

    SetPropertyAsUint32(kLastModifiedDateProperty, srcCard->lastModifiedDate);
    SetIsMailList(srcCard->isMailList);
    SetMailListURI(srcCard->mailListURI);

    return NS_OK;
}

void nsAbIPCCard::SplitAddresses(PRBool isUnicode, LPTSTR homeAddress, LPTSTR workAddress)
{
  PRInt32 idx;
  nsAutoString homeAddressStr;
  nsAutoString workAddressStr;
  if (isUnicode)
  {
    homeAddressStr.Assign(homeAddress);
    workAddressStr.Assign(workAddress);
  }
  else
  {
    CONVERT_ASSIGNTO_UNICODE(homeAddressStr, homeAddress, PR_FALSE);
    CONVERT_ASSIGNTO_UNICODE(workAddressStr, workAddress, PR_FALSE);
  }
  nsAutoString addr1, addr2;
  if ((idx = homeAddressStr.Find( "\x0D\x0A")) != kNotFound)
  {
    homeAddressStr.Left(addr1, idx);
    homeAddressStr.Right( addr2, homeAddressStr.Length() - idx - 2);  // need to minus string lenght of CRLF.
    addr2.ReplaceSubstring(NS_LITERAL_STRING("\x0D\x0A").get(),NS_LITERAL_STRING(", ").get());

    SetPropertyAsAString(kHomeAddressProperty, addr1);
    SetPropertyAsAString(kHomeAddress2Property, addr2);
  }
  else
    SetPropertyAsAString(kHomeAddressProperty, homeAddressStr);

  if ((idx = workAddressStr.Find( "\x0D\x0A")) != kNotFound)
  {
    workAddressStr.Left(addr1, idx);
    workAddressStr.Right( addr2, workAddressStr.Length() - idx - 2);  // need to minus string lenght of CRLF.
    addr2.ReplaceSubstring(NS_LITERAL_STRING("\x0D\x0A").get(),NS_LITERAL_STRING(", ").get());

    SetPropertyAsAString(kWorkAddressProperty, addr1);
    SetPropertyAsAString(kWorkAddress2Property, addr2);
  }
  else
    SetPropertyAsAString(kWorkAddressProperty, workAddressStr);
}

void nsAbIPCCard::SplitHomeAndWorkAddresses(nsABCOMCardStruct * card, PRBool isUnicode)
{
  // If the address contains more than one line then split it into two 
  // (since moz only allows two address lines) and make sure all CRLFs
  // are converted to spaces in the 2nd address line. Lines are ended
  // with CRLF (done by moz conduit). So card->homeAddress2 
  // and card->workAddress2 are never used.
  SplitAddresses(isUnicode, card->homeAddress, card->workAddress);
}


PRBool nsAbIPCCard::EqualsAfterUnicodeConversion(nsABCOMCardStruct * card, nsStringArray & differingAttrs)
{
    if(!card)
        return PR_FALSE;

    // convert to Unicode first
    nsAbIPCCard card1(card, PR_FALSE);
    card1.SplitAddresses(PR_FALSE, card->homeAddress, card->workAddress);
    nsABCOMCardStruct * newCard = new nsABCOMCardStruct;
    // get the unicode nsABCOMCardStruct and compare
    card1.GetABCOMCardStruct(PR_TRUE, newCard);
    // want to split newCard home and work address

    // I think this leaks...need to free up the original values
    card1.CopyValue(PR_TRUE, kHomeAddressProperty, &newCard->homeAddress);
    card1.CopyValue(PR_TRUE, kHomeAddress2Property, &newCard->homeAddress2);
    card1.CopyValue(PR_TRUE, kWorkAddressProperty, &newCard->workAddress);
    card1.CopyValue(PR_TRUE, kWorkAddress2Property, &newCard->workAddress2);
  
    PRBool ret = Equals(newCard, differingAttrs);
    delete newCard;
    return ret;
}


PRBool nsAbIPCCard::Equals(nsABCOMCardStruct * card, nsStringArray & differingAttrs)
{
    if(!card)
        return PR_FALSE;

    differingAttrs.Clear();

    if(card->firstName)
        if (CompareValue(PR_TRUE, card->firstName, kFirstNameProperty))
            differingAttrs.AppendString(NS_LITERAL_STRING(kFirstNameProperty));
    if(card->lastName)
        if (CompareValue(PR_TRUE, card->lastName, kLastNameProperty))
            differingAttrs.AppendString(NS_LITERAL_STRING(kLastNameProperty));
    if(card->displayName)
        if (CompareValue(PR_TRUE, card->displayName, kDisplayNameProperty))
            differingAttrs.AppendString(NS_LITERAL_STRING(kDisplayNameProperty));
    if(card->nickName)
        if (CompareValue(PR_TRUE, card->nickName, kNicknameProperty))
            differingAttrs.AppendString(NS_LITERAL_STRING(kNicknameProperty));
    if(card->primaryEmail)
        if (CompareValue(PR_TRUE, card->primaryEmail, kPriEmailProperty))
            differingAttrs.AppendString(NS_LITERAL_STRING(kPriEmailProperty));
    if(card->secondEmail)
        if (CompareValue(PR_TRUE, card->secondEmail, k2ndEmailProperty))
            differingAttrs.AppendString(NS_LITERAL_STRING(k2ndEmailProperty));
    if(card->workPhone)
        if (CompareValue(PR_TRUE, card->workPhone, kWorkPhoneProperty))
            differingAttrs.AppendString(NS_LITERAL_STRING(kWorkPhoneProperty));
    if(card->homePhone)
        if (CompareValue(PR_TRUE, card->homePhone, kHomePhoneProperty))
            differingAttrs.AppendString(NS_LITERAL_STRING(kHomePhoneProperty));
    if(card->faxNumber)
        if (CompareValue(PR_TRUE, card->faxNumber, kFaxProperty))
            differingAttrs.AppendString(NS_LITERAL_STRING(kFaxProperty));
    if(card->pagerNumber)
        if (CompareValue(PR_TRUE, card->pagerNumber, kPagerProperty))
            differingAttrs.AppendString(NS_LITERAL_STRING(kPagerProperty));
    if(card->cellularNumber)
        if (CompareValue(PR_TRUE, card->cellularNumber, kCellularProperty))
            differingAttrs.AppendString(NS_LITERAL_STRING(kCellularProperty));
    // card  has home and work addresses joined, but "this" has them split
    if(card->homeAddress)
        if (CompareValue(PR_TRUE, card->homeAddress, kHomeAddressProperty))
            differingAttrs.AppendString(NS_LITERAL_STRING(kHomeAddressProperty));
    if(card->homeAddress2)
        if (CompareValue(PR_TRUE, card->homeAddress2, kHomeAddress2Property))
            differingAttrs.AppendString(NS_LITERAL_STRING(kHomeAddress2Property));
    if(card->homeCity)
        if (CompareValue(PR_TRUE, card->homeCity, kHomeCityProperty))
            differingAttrs.AppendString(NS_LITERAL_STRING(kHomeCityProperty));
    if(card->homeState)
        if (CompareValue(PR_TRUE, card->homeState, kHomeStateProperty))
            differingAttrs.AppendString(NS_LITERAL_STRING(kHomeStateProperty));
    if(card->homeZipCode)
        if (CompareValue(PR_TRUE, card->homeZipCode, kHomeZipCodeProperty))
            differingAttrs.AppendString(NS_LITERAL_STRING(kHomeZipCodeProperty));
    if(card->homeCountry)
        if (CompareValue(PR_TRUE, card->homeCountry, kHomeCountryProperty))
            differingAttrs.AppendString(NS_LITERAL_STRING(kHomeCountryProperty));
    // card->workAddress is Joined, WorkAddress and WorkAddress2 are split
    if(card->workAddress)
        if (CompareValue(PR_TRUE, card->workAddress, kWorkAddressProperty))
            differingAttrs.AppendString(NS_LITERAL_STRING(kWorkAddressProperty));
    if(card->workAddress2)
        if (CompareValue(PR_TRUE, card->workAddress2, kWorkAddress2Property))
            differingAttrs.AppendString(NS_LITERAL_STRING(kWorkAddress2Property));
    if(card->workCity)
        if (CompareValue(PR_TRUE, card->workCity, kWorkCityProperty))
            differingAttrs.AppendString(NS_LITERAL_STRING(kWorkCityProperty));
    if(card->workState)
        if (CompareValue(PR_TRUE, card->workState, kWorkStateProperty))
            differingAttrs.AppendString(NS_LITERAL_STRING(kWorkStateProperty));
    if(card->workZipCode)
        if (CompareValue(PR_TRUE, card->workZipCode, kWorkZipCodeProperty))
            differingAttrs.AppendString(NS_LITERAL_STRING(kWorkZipCodeProperty));
    if(card->workCountry)
        if (CompareValue(PR_TRUE, card->workCountry, kWorkCountryProperty))
            differingAttrs.AppendString(NS_LITERAL_STRING(kWorkCountryProperty));
    if(card->jobTitle)
        if (CompareValue(PR_TRUE, card->jobTitle, kJobTitleProperty))
            differingAttrs.AppendString(NS_LITERAL_STRING(kJobTitleProperty));
    if(card->department)
        if (CompareValue(PR_TRUE, card->department, kDepartmentProperty))
            differingAttrs.AppendString(NS_LITERAL_STRING(kDepartmentProperty));
    if(card->company)
        if (CompareValue(PR_TRUE, card->company, kCompanyProperty))
            differingAttrs.AppendString(NS_LITERAL_STRING(kCompanyProperty));
    if(card->webPage1)
        if (CompareValue(PR_TRUE, card->webPage1, kWorkWebPageProperty))
            differingAttrs.AppendString(NS_LITERAL_STRING(kWorkWebPageProperty));
    if(card->webPage2)
        if (CompareValue(PR_TRUE, card->webPage2, kWorkWebPageProperty))
            differingAttrs.AppendString(NS_LITERAL_STRING(kHomeWebPageProperty));
    if(card->birthYear)
        if (CompareValue(PR_TRUE, card->birthYear, kBirthYearProperty))
            differingAttrs.AppendString(NS_LITERAL_STRING(kBirthYearProperty));
    if(card->birthMonth)
        if (CompareValue(PR_TRUE, card->birthMonth, kBirthMonthProperty))
            differingAttrs.AppendString(NS_LITERAL_STRING(kBirthMonthProperty));
    if(card->birthDay)
        if (CompareValue(PR_TRUE, card->birthDay, kBirthDayProperty))
            differingAttrs.AppendString(NS_LITERAL_STRING(kBirthDayProperty));
    if(card->custom1)
        if (CompareValue(PR_TRUE, card->custom1, kCustom1Property))
            differingAttrs.AppendString(NS_LITERAL_STRING(kCustom1Property));
    if(card->custom2)
        if (CompareValue(PR_TRUE, card->custom2, kCustom2Property))
            differingAttrs.AppendString(NS_LITERAL_STRING(kCustom2Property));
    if(card->custom3)
        if (CompareValue(PR_TRUE, card->custom3, kCustom3Property))
            differingAttrs.AppendString(NS_LITERAL_STRING(kCustom3Property));
    if(card->custom4)
        if (CompareValue(PR_TRUE, card->custom4, kCustom4Property))
            differingAttrs.AppendString(NS_LITERAL_STRING(kCustom4Property));
    if (card->isMailList != m_IsMailList)
        differingAttrs.AppendString(NS_LITERAL_STRING(kMailListName));
    if(card->mailListURI) {
        nsCAutoString str(card->mailListURI);
        if (str.Equals(m_MailListURI, nsCaseInsensitiveCStringComparator()))
            differingAttrs.AppendString(NS_LITERAL_STRING(kMailListDescription));
    }

    return (differingAttrs.Count() == 0);
}


NS_IMETHODIMP nsAbIPCCard::Equals(nsIAbCard *card, PRBool *_retval)
{
    NS_ENSURE_ARG_POINTER(card);
    NS_ENSURE_ARG_POINTER(_retval);

    nsString str;
    *_retval = PR_FALSE;

    card->GetFirstName(str);
    if (Compare(str, kFirstNameProperty))
        return NS_OK;

    card->GetLastName(str);
    if (Compare(str, kLastNameProperty))
        return NS_OK;

    card->GetDisplayName(str);
    if (Compare(str, kDisplayNameProperty))
        return NS_OK;

    if (NS_FAILED(card->GetPropertyAsAString(kNicknameProperty, str)))
      str.Truncate();
    if (Compare(str, kNicknameProperty))
        return NS_OK;

    card->GetPrimaryEmail(str);
    if (Compare(str, kPriEmailProperty))
        return NS_OK;

    if (NS_FAILED(card->GetPropertyAsAString(k2ndEmailProperty, str)))
      str.Truncate();
    if (Compare(str, k2ndEmailProperty))
        return NS_OK;

    if (NS_FAILED(card->GetPropertyAsAString(kWorkPhoneProperty, str)))
      str.Truncate();
    if (Compare(str, kWorkPhoneProperty))
        return NS_OK;

    if (NS_FAILED(card->GetPropertyAsAString(kHomePhoneProperty, str)))
      str.Truncate();
    if (Compare(str, kHomePhoneProperty))
        return NS_OK;

    if (NS_FAILED(card->GetPropertyAsAString(kFaxProperty, str)))
      str.Truncate();
    if (Compare(str, kFaxProperty))
        return NS_OK;

    if (NS_FAILED(card->GetPropertyAsAString(kPagerProperty, str)))
      str.Truncate();
    if (Compare(str, kPagerProperty))
        return NS_OK;

    if (NS_FAILED(card->GetPropertyAsAString(kCellularProperty, str)))
      str.Truncate();
    if (Compare(str, kCellularProperty))
        return NS_OK;

    if (NS_FAILED(card->GetPropertyAsAString(kHomeAddressProperty, str)))
      str.Truncate();
    if (Compare(str, kHomeAddressProperty))
        return NS_OK;

    if (NS_FAILED(card->GetPropertyAsAString(kHomeAddress2Property, str)))
      str.Truncate();
    if (Compare(str, kHomeAddress2Property))
        return NS_OK;

    if (NS_FAILED(card->GetPropertyAsAString(kHomeCityProperty, str)))
      str.Truncate();
    if (Compare(str, kHomeCityProperty))
        return NS_OK;

    if (NS_FAILED(card->GetPropertyAsAString(kHomeStateProperty, str)))
      str.Truncate();
    if (Compare(str, kHomeStateProperty))
        return NS_OK;

    if (NS_FAILED(card->GetPropertyAsAString(kHomeZipCodeProperty, str)))
      str.Truncate();
    if (Compare(str, kHomeZipCodeProperty))
        return NS_OK;

    if (NS_FAILED(card->GetPropertyAsAString(kHomeCountryProperty, str)))
      str.Truncate();
    if (Compare(str, kHomeCountryProperty))
        return NS_OK;

    // both card and this have their addresses split, which is correct
    if (NS_FAILED(card->GetPropertyAsAString(kWorkAddressProperty, str)))
      str.Truncate();
    if (Compare(str, kWorkAddressProperty))
        return NS_OK;

    if (NS_FAILED(card->GetPropertyAsAString(kWorkAddress2Property, str)))
      str.Truncate();
    if (Compare(str, kWorkAddress2Property))
        return NS_OK;

    if (NS_FAILED(card->GetPropertyAsAString(kWorkCityProperty, str)))
      str.Truncate();
    if (Compare(str, kWorkCityProperty))
        return NS_OK;

    if (NS_FAILED(card->GetPropertyAsAString(kWorkStateProperty, str)))
      str.Truncate();
    if (Compare(str, kWorkStateProperty))
        return NS_OK;

    if (NS_FAILED(card->GetPropertyAsAString(kWorkZipCodeProperty, str)))
      str.Truncate();
    if (Compare(str, kWorkZipCodeProperty))
        return NS_OK;

    if (NS_FAILED(card->GetPropertyAsAString(kWorkCountryProperty, str)))
      str.Truncate();
    if (Compare(str, kWorkCountryProperty))
        return NS_OK;

    if (NS_FAILED(card->GetPropertyAsAString(kJobTitleProperty, str)))
      str.Truncate();
    if (Compare(str, kJobTitleProperty))
        return NS_OK;

    if (NS_FAILED(card->GetPropertyAsAString(kDepartmentProperty, str)))
      str.Truncate();
    if (Compare(str, kDepartmentProperty))
        return NS_OK;

    if (NS_FAILED(card->GetPropertyAsAString(kCompanyProperty, str)))
      str.Truncate();
    if (Compare(str, kCompanyProperty))
        return NS_OK;

    if (NS_FAILED(card->GetPropertyAsAString(kWorkWebPageProperty, str)))
      str.Truncate();
    if (Compare(str, kWorkWebPageProperty))
        return NS_OK;

    if (NS_FAILED(card->GetPropertyAsAString(kHomeWebPageProperty, str)))
      str.Truncate();
    if (Compare(str, kHomeWebPageProperty))
        return NS_OK;

    if (NS_FAILED(card->GetPropertyAsAString(kBirthYearProperty, str)))
      str.Truncate();
    if (Compare(str, kBirthYearProperty))
        return NS_OK;

    if (NS_FAILED(card->GetPropertyAsAString(kBirthMonthProperty, str)))
      str.Truncate();
    if (Compare(str, kBirthMonthProperty))
        return NS_OK;

    if (NS_FAILED(card->GetPropertyAsAString(kBirthDayProperty, str)))
      str.Truncate();
    if (Compare(str, kBirthDayProperty))
        return NS_OK;

    if (NS_FAILED(card->GetPropertyAsAString(kCustom1Property, str)))
      str.Truncate();
    if (Compare(str, kCustom1Property))
        return NS_OK;

    if (NS_FAILED(card->GetPropertyAsAString(kCustom2Property, str)))
      str.Truncate();
    if (Compare(str, kCustom2Property))
        return NS_OK;

    if (NS_FAILED(card->GetPropertyAsAString(kCustom3Property, str)))
      str.Truncate();
    if (Compare(str, kCustom3Property))
        return NS_OK;

    if (NS_FAILED(card->GetPropertyAsAString(kCustom4Property, str)))
      str.Truncate();
    if (Compare(str, kCustom4Property))
        return NS_OK;

    PRBool isMailList=PR_FALSE;
    card->GetIsMailList(&isMailList);
    if (isMailList != m_IsMailList)
        return NS_OK;

    nsCString str2;
    card->GetMailListURI(getter_Copies(str2));
    if (m_MailListURI.Equals(str2, nsCaseInsensitiveCStringComparator()))
        return NS_OK;

    *_retval = PR_TRUE;
    return NS_OK;
}

PRBool nsAbIPCCard::CompareValue(PRBool isUnicode, LPTSTR cardValue, const char *attribute)
{
    if(cardValue) {
        if(isUnicode) {
            if (Compare(nsDependentString(cardValue), attribute))
                return PR_FALSE;
        }
        else {
            nsAutoString str;
            CONVERT_ASSIGNTO_UNICODE(str, cardValue, PR_TRUE);
            if (Compare(str, attribute))
                return PR_FALSE;
        }
    }

    return PR_TRUE;
}

PRBool nsAbIPCCard::Compare(nsString &cardValue, const char *attribute)
{
  nsAutoString attribValue;
  GetPropertyAsAString(attribute, attribValue);
  return ::Compare(cardValue, attribValue, nsCaseInsensitiveStringComparator());
}
PRBool nsAbIPCCard::Same(nsABCOMCardStruct * card, PRBool isUnicode)
{
    if(!card)
        return PR_FALSE;

    if(mRecordId && card->dwRecordId) 
        return (mRecordId == card->dwRecordId);

    if(CompareValue(isUnicode, card->firstName, kFirstNameProperty))
        if(CompareValue(isUnicode, card->lastName, kLastNameProperty))
            if(CompareValue(isUnicode, card->displayName, kDisplayNameProperty))
                if(CompareValue(isUnicode, card->nickName, kNicknameProperty))
                    return PR_TRUE;

    return PR_FALSE;
}


PRBool nsAbIPCCard::Same(nsIAbCard *card)
{
    if(!card)
        return PR_FALSE;

    nsresult rv;
    // first check the palmID for the cards if they exist
    nsString palmIDStr;
    rv = card->GetPropertyAsAString(CARD_ATTRIB_PALMID, palmIDStr);
    if (NS_SUCCEEDED(rv) && palmIDStr.get()) {
      PRInt32 palmID=0;
      PRFloat64 f = PR_strtod(NS_LossyConvertUTF16toASCII(palmIDStr).get(), nsnull);
      PRInt64 l;
      LL_D2L(l, f);
      LL_L2UI(palmID, l);
      if (palmID && mRecordId)
        return mRecordId == palmID;
    }

    nsString str;
    card->GetFirstName(str);
    if (Compare(str, kFirstNameProperty))
        return PR_FALSE;
    card->GetLastName(str);
    if (Compare(str, kLastNameProperty))
        return PR_FALSE;
    card->GetDisplayName(str);
    if (Compare(str, kDisplayNameProperty))
        return PR_FALSE;
    if (NS_FAILED(card->GetPropertyAsAString(kNicknameProperty, str)))
      str.Truncate();
    if (Compare(str, kNicknameProperty))
        return PR_FALSE;

    return PR_TRUE;
}


void nsAbIPCCard::CopyValue(PRBool isUnicode, const char *attribute, LPTSTR * result)
{
    *result = NULL;
    nsAutoString attribValue;
    GetPropertyAsAString(attribute, attribValue);
    if(attribValue.Length() && attribValue.get()) {
        PRInt32 length;
        if(isUnicode) {                                 
            length = attribValue.Length()+1;
            PRUnichar * Str = (PRUnichar *) CoTaskMemAlloc(sizeof(PRUnichar) * length);
            wcsncpy(Str, attribValue.get(), length-1);
            Str[length-1] = '\0';
            *result = Str;
        } 
        else { 
            NS_LossyConvertUTF16toASCII cStr(attribValue);
            // These strings are defined as wide in the idl, so we need to add up to 3
            // bytes of 0 byte padding at the end (if the string is an odd number of 
            // bytes long, we need one null byte to pad out the last char to a wide char
            // and then  two more nulls as a wide null terminator.
            length = cStr.Length()+3;
            char * str = (char *) CoTaskMemAlloc(length);
            strncpy(str, cStr.get(), length-1);
            str[length-1] = '\0';
            *result = (LPTSTR) str;
        } 
    }
}

nsresult nsAbIPCCard::GetABCOMCardStruct(PRBool isUnicode, nsABCOMCardStruct * card)
{
    NS_ENSURE_ARG_POINTER(card);

    // If memset() call is missing, callers of MS COM nsSynchronizeAB() will
    // receive a different return code even if nsSynchronizeAB() return S_OK.
    memset(card, 0, sizeof(nsABCOMCardStruct));
    card->dwRecordId = mRecordId;
    card->dwCategoryId = mCategoryId;
    card->dwStatus = mStatus;
    card->addressToUse = CPalmSyncImp::nsUseABHomeAddressForPalmAddress(); // 0 == home, 1 == work
    PR_LOG(PALMSYNC, PR_LOG_DEBUG, ("nsAbIPCCard::GetABCOMCardStruct using %d\n", card->addressToUse));

    CopyValue(isUnicode, kFirstNameProperty, &card->firstName);
    CopyValue(isUnicode, kLastNameProperty, &card->lastName);
    CopyValue(isUnicode, kDisplayNameProperty, &card->displayName);
    CopyValue(isUnicode, kNicknameProperty, &card->nickName);
    CopyValue(isUnicode, kPriEmailProperty, &card->primaryEmail);
    CopyValue(isUnicode, k2ndEmailProperty, &card->secondEmail);
    CopyValue(isUnicode, kWorkPhoneProperty, &card->workPhone);
    CopyValue(isUnicode, kHomePhoneProperty, &card->homePhone);
    CopyValue(isUnicode, kFaxProperty, &card->faxNumber);
    CopyValue(isUnicode, kPagerProperty, &card->pagerNumber);
    CopyValue(isUnicode, kCellularProperty, &card->cellularNumber);
    // See if home address contains multiple lines.
    JoinHomeAndWorkAddresses(isUnicode, card);
    CopyValue(isUnicode, kHomeCityProperty, &card->homeCity);
    CopyValue(isUnicode, kHomeStateProperty, &card->homeState);
    CopyValue(isUnicode, kHomeZipCodeProperty, &card->homeZipCode);
    CopyValue(isUnicode, kHomeCountryProperty, &card->homeCountry);
    CopyValue(isUnicode, kWorkCityProperty, &card->workCity);
    CopyValue(isUnicode, kWorkStateProperty, &card->workState);
    CopyValue(isUnicode, kWorkZipCodeProperty, &card->workZipCode);
    CopyValue(isUnicode, kWorkCountryProperty, &card->workCountry);
    CopyValue(isUnicode, kJobTitleProperty, &card->jobTitle);
    CopyValue(isUnicode, kDepartmentProperty, &card->department);
    CopyValue(isUnicode, kCompanyProperty, &card->company);
    CopyValue(isUnicode, kWorkWebPageProperty, &card->webPage1);
    CopyValue(isUnicode, kHomeWebPageProperty, &card->webPage2);
    CopyValue(isUnicode, kBirthYearProperty, &card->birthYear);
    CopyValue(isUnicode, kBirthMonthProperty, &card->birthMonth);
    CopyValue(isUnicode, kBirthDayProperty, &card->birthDay);
    CopyValue(isUnicode, kCustom1Property, &card->custom1);
    CopyValue(isUnicode, kCustom2Property, &card->custom2);
    CopyValue(isUnicode, kCustom3Property, &card->custom3);
    CopyValue(isUnicode, kCustom4Property, &card->custom4);
    CopyValue(isUnicode, kNotesProperty, &card->notes);

    GetPropertyAsUint32(kLastModifiedDateProperty,
                        (PRUint32*)&card->lastModifiedDate);
    GetPropertyAsUint32(kPreferMailFormatProperty,
                        (PRUint32*)&card->preferMailFormat);
    card->addressToUse = CPalmSyncImp::nsUseABHomeAddressForPalmAddress(); // 0 == home, 1 == work
    nsAutoString homePhone, workPhone;
    GetPropertyAsAString(kHomePhoneProperty, homePhone);
    GetPropertyAsAString(kWorkPhoneProperty, workPhone);
    if (CPalmSyncImp::nsPreferABHomePhoneForPalmPhone())
      card->preferredPhoneNum = (homePhone.IsEmpty()) ? (workPhone.IsEmpty() ? 4 : 1) : 2;
    else
      card->preferredPhoneNum = (workPhone.IsEmpty()) ? 2 : (workPhone.IsEmpty() ? 4 : 1);
    card->isMailList = m_IsMailList;
    // Can't use ToNewCString() call here becasue MSCOM will complaint about
    // memory deallocation (ie, NdrPointerFree()) use CoTaskMemAlloc() instead.
    if (m_MailListURI.IsEmpty())
      card->mailListURI = NULL;
    else
    {
      PRInt32 length = m_MailListURI.Length()+1;
      char * str = (char *) CoTaskMemAlloc(sizeof(char) * length);
      strncpy(str, m_MailListURI.get(), length-1);
      str[length-1] = '\0';
      card->mailListURI = str;
    }

    return NS_OK;
}

void nsAbIPCCard::JoinAddress(PRBool isUnicode, LPTSTR *ptrAddress, nsString &address1, nsString &address2)
{
  // If the two address lines in a moz card are not empty
  // then join the lines into a single line separated by
  // '\x0A'. This is the format expected by Palm.
  *ptrAddress = NULL;
  PRUint32 strLength= address1.Length() + address2.Length();
  if(!strLength)
    return;

  // Allocate space for 'strLength' plus three for nulls and one for "\x0A".
  // These strings are defined as wide in the idl, so we need to add up to 3
  // bytes of 0 byte padding at the end (if the string is an odd number of 
  // bytes long, we need one null byte to pad out the last char to a wide char
  // and then  two more nulls as a wide null terminator.
  strLength += 4;
  if(isUnicode)
  { 
    PRUnichar * uniStr = (PRUnichar *) CoTaskMemAlloc(sizeof(PRUnichar) * (strLength));
    if(address1.Length())
    {
      wcsncpy(uniStr, address1.get(), strLength-1);
      uniStr[strLength-1] = '\0';
      if(address2.Length())
      {
        wcsncat(uniStr, (const wchar_t *)"\x0A", strLength-1);
        wcsncat(uniStr, address2.get(), strLength-1);
        uniStr[strLength-1] = '\0';
      }
    }
    else
    {
      wcsncpy(uniStr, address2.get(), strLength-1);
      uniStr[strLength-1] = '\0';
    }

    *ptrAddress = uniStr;
  } 
  else
  { 
    char * str = (char *) CoTaskMemAlloc(strLength);
    if(address1.Length())
    {
      NS_LossyConvertUTF16toASCII cStr(address1);
      strncpy(str, cStr.get(), strLength-1);
      str[strLength-1] = '\0';
      if(address2.Length())
      {
        LossyCopyUTF16toASCII(address2, cStr);
        strncat(str, "\x0A", strLength-1);
        strncat(str, cStr.get(), strLength-1);
        str[strLength-1] = '\0';
      }
    }
    else
    {
      NS_LossyConvertUTF16toASCII cStr(address2);
      strncpy(str, cStr.get(), strLength-1);
      str[strLength-1] = '\0';
    }
    *ptrAddress = (LPTSTR) str;
  } 
}
void nsAbIPCCard::JoinHomeAndWorkAddresses(PRBool isUnicode, nsABCOMCardStruct * card)
{
  nsAutoString address, address2;
  GetPropertyAsAString(kHomeAddressProperty, address);
  GetPropertyAsAString(kHomeAddress2Property, address2);
  JoinAddress(isUnicode, &card->homeAddress, address, address2);

  address.Truncate();
  address2.Truncate();
  GetPropertyAsAString(kWorkAddressProperty, address);
  GetPropertyAsAString(kWorkAddress2Property, address2);
  JoinAddress(isUnicode, &card->workAddress, address, address2);
}


