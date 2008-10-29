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

#include "nsAbCardProperty.h"
#include "nsAbBaseCID.h"
#include "nsIPrefService.h"
#include "nsIAddrDatabase.h"
#include "plbase64.h"
#include "nsIStringBundle.h"
#include "plstr.h"
#include "nsIRDFResource.h"
#include "nsIRDFService.h"
#include "nsRDFCID.h"
#include "nsMsgUtils.h"
#include "nsINetUtil.h"
#include "nsComponentManagerUtils.h"
#include "nsServiceManagerUtils.h"
#include "nsMemory.h"
#include "nsVCardObj.h"
#include "nsIMutableArray.h"
#include "nsArrayUtils.h"
#include "mozITXTToHTMLConv.h"

#include "nsIProperty.h"
#include "nsCOMArray.h"
#include "nsArrayEnumerator.h"

#define PREF_MAIL_ADDR_BOOK_LASTNAMEFIRST "mail.addr_book.lastnamefirst"

const char sAddrbookProperties[] = "chrome://messenger/locale/addressbook/addressBook.properties";

enum EAppendType {
  eAppendLine,
  eAppendLabel,
  eAppendCityStateZip
};

struct AppendItem {
  const char *mColumn;
  const char* mLabel;
  EAppendType mAppendType;
};

static const AppendItem NAME_ATTRS_ARRAY[] = {
  {kDisplayNameProperty, "propertyDisplayName", eAppendLabel},
  {kNicknameProperty, "propertyNickname", eAppendLabel},
  {kPriEmailProperty, "", eAppendLine},
  {k2ndEmailProperty, "", eAppendLine},
  {kScreenNameProperty, "propertyScreenName", eAppendLabel}
};

static const AppendItem PHONE_ATTRS_ARRAY[] = {
  {kWorkPhoneProperty, "propertyWork", eAppendLabel},
  {kHomePhoneProperty, "propertyHome", eAppendLabel},
  {kFaxProperty, "propertyFax", eAppendLabel},
  {kPagerProperty, "propertyPager", eAppendLabel},
  {kCellularProperty, "propertyCellular", eAppendLabel}
};

static const AppendItem HOME_ATTRS_ARRAY[] = {
  {kHomeAddressProperty, "", eAppendLine},
  {kHomeAddress2Property, "", eAppendLine},
  {kHomeCityProperty, "", eAppendCityStateZip},
  {kHomeCountryProperty, "", eAppendLine},
  {kHomeWebPageProperty, "", eAppendLine}
};

static const AppendItem WORK_ATTRS_ARRAY[] = {
  {kJobTitleProperty, "", eAppendLine},
  {kDepartmentProperty, "", eAppendLine},
  {kCompanyProperty, "", eAppendLine},
  {kWorkAddressProperty, "", eAppendLine},
  {kWorkAddress2Property, "", eAppendLine},
  {kWorkCityProperty, "", eAppendCityStateZip},
  {kWorkCountryProperty, "", eAppendLine},
  {kWorkWebPageProperty, "", eAppendLine}
};

static const AppendItem CUSTOM_ATTRS_ARRAY[] = {
  {kCustom1Property, "propertyCustom1", eAppendLabel},
  {kCustom2Property, "propertyCustom2", eAppendLabel},
  {kCustom3Property, "propertyCustom3", eAppendLabel},
  {kCustom4Property, "propertyCustom4", eAppendLabel},
  {kNotesProperty, "", eAppendLine}
};

nsAbCardProperty::nsAbCardProperty()
  : m_IsMailList(PR_FALSE)
{
  m_properties.Init();

  // Initialize some default properties
  SetPropertyAsUint32(kPreferMailFormatProperty, nsIAbPreferMailFormat::unknown);
  SetPropertyAsUint32(kPopularityIndexProperty, 0);
  // Uninitialized...
  SetPropertyAsUint32(kLastModifiedDateProperty, 0);
  SetPropertyAsBool(kAllowRemoteContentProperty, PR_FALSE);
}

nsAbCardProperty::~nsAbCardProperty(void)
{
}

NS_IMPL_ISUPPORTS1(nsAbCardProperty, nsIAbCard)

////////////////////////////////////////////////////////////////////////////////

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

///////////////////////////////////////////////////////////////////////////////
// Property bag portion of nsAbCardProperty
///////////////////////////////////////////////////////////////////////////////

class nsAbSimpleProperty : public nsIProperty {
public:
    nsAbSimpleProperty(const nsACString& aName, nsIVariant* aValue)
        : mName(aName), mValue(aValue)
    {
    }

    NS_DECL_ISUPPORTS
    NS_DECL_NSIPROPERTY
protected:
    nsCString mName;
    nsCOMPtr<nsIVariant> mValue;
};

NS_IMPL_ISUPPORTS1(nsAbSimpleProperty, nsIProperty)

NS_IMETHODIMP
nsAbSimpleProperty::GetName(nsAString& aName)
{
    aName.Assign(NS_ConvertUTF8toUTF16(mName));
    return NS_OK;
}

NS_IMETHODIMP
nsAbSimpleProperty::GetValue(nsIVariant* *aValue)
{
    NS_IF_ADDREF(*aValue = mValue);
    return NS_OK;
}

static PLDHashOperator
PropertyHashToArrayFunc (const nsACString &aKey, nsIVariant* aData, void *userArg)
{
  nsCOMArray<nsIProperty>* propertyArray = static_cast<nsCOMArray<nsIProperty> *>(userArg);
  propertyArray->AppendObject(new nsAbSimpleProperty(aKey, aData));
  return PL_DHASH_NEXT;
}

NS_IMETHODIMP nsAbCardProperty::GetProperties(nsISimpleEnumerator **props)
{
  nsCOMArray<nsIProperty> propertyArray(m_properties.Count());
  m_properties.EnumerateRead(PropertyHashToArrayFunc, &propertyArray);
  return NS_NewArrayEnumerator(props, propertyArray);
}

NS_IMETHODIMP nsAbCardProperty::GetProperty(const nsACString &name,
                                            nsIVariant *defaultValue,
                                            nsIVariant **value)
{
  if (!m_properties.Get(name, value))
    NS_ADDREF(*value = defaultValue);
  return NS_OK;
}

NS_IMETHODIMP nsAbCardProperty::GetPropertyAsAString(const char *name, nsAString &value) 
{
  nsCOMPtr<nsIVariant> variant;
  return m_properties.Get(nsDependentCString(name), getter_AddRefs(variant)) ?
    variant->GetAsAString(value) : NS_ERROR_NOT_AVAILABLE;
}

NS_IMETHODIMP nsAbCardProperty::GetPropertyAsAUTF8String(const char *name, nsACString &value) 
{
  nsCOMPtr<nsIVariant> variant;
  return m_properties.Get(nsDependentCString(name), getter_AddRefs(variant)) ?
    variant->GetAsAUTF8String(value) : NS_ERROR_NOT_AVAILABLE;
}

NS_IMETHODIMP nsAbCardProperty::GetPropertyAsUint32(const char *name, PRUint32 *value) 
{
  nsCOMPtr<nsIVariant> variant;
  return m_properties.Get(nsDependentCString(name), getter_AddRefs(variant)) ?
    variant->GetAsUint32(value) : NS_ERROR_NOT_AVAILABLE;
}

NS_IMETHODIMP nsAbCardProperty::GetPropertyAsBool(const char *name, PRBool *value) 
{
  nsCOMPtr<nsIVariant> variant;
  return m_properties.Get(nsDependentCString(name), getter_AddRefs(variant)) ?
    variant->GetAsBool(value) : NS_ERROR_NOT_AVAILABLE;
}

NS_IMETHODIMP nsAbCardProperty::SetProperty(const nsACString &name, nsIVariant *value)
{
  return m_properties.Put(name, value);
}

NS_IMETHODIMP nsAbCardProperty::SetPropertyAsAString(const char *name, const nsAString &value) 
{
  nsCOMPtr<nsIWritableVariant> variant = do_CreateInstance(NS_VARIANT_CONTRACTID);
  variant->SetAsAString(value);
  return m_properties.Put(nsDependentCString(name), variant);
}

NS_IMETHODIMP nsAbCardProperty::SetPropertyAsAUTF8String(const char *name, const nsACString &value) 
{
  nsCOMPtr<nsIWritableVariant> variant = do_CreateInstance(NS_VARIANT_CONTRACTID);
  variant->SetAsAUTF8String(value);
  return m_properties.Put(nsDependentCString(name), variant);
}

NS_IMETHODIMP nsAbCardProperty::SetPropertyAsUint32(const char *name, PRUint32 value) 
{
  nsCOMPtr<nsIWritableVariant> variant = do_CreateInstance(NS_VARIANT_CONTRACTID);
  variant->SetAsUint32(value);
  return m_properties.Put(nsDependentCString(name), variant);
}

NS_IMETHODIMP nsAbCardProperty::SetPropertyAsBool(const char *name, PRBool value) 
{
  nsCOMPtr<nsIWritableVariant> variant = do_CreateInstance(NS_VARIANT_CONTRACTID);
  variant->SetAsBool(value);
  return m_properties.Put(nsDependentCString(name), variant);
}

NS_IMETHODIMP nsAbCardProperty::DeleteProperty(const nsACString &name)
{
  m_properties.Remove(name);
  return NS_OK;
}

NS_IMETHODIMP nsAbCardProperty::GetFirstName(nsAString &aString)
{
  nsresult rv = GetPropertyAsAString(kFirstNameProperty, aString);
  if (rv == NS_ERROR_NOT_AVAILABLE)
  {
    aString.Truncate();
    return NS_OK;
  }
  return rv;
}

NS_IMETHODIMP nsAbCardProperty::SetFirstName(const nsAString &aString)
{
  return SetPropertyAsAString(kFirstNameProperty, aString);
}

NS_IMETHODIMP nsAbCardProperty::GetLastName(nsAString &aString)
{
  nsresult rv = GetPropertyAsAString(kLastNameProperty, aString);
  if (rv == NS_ERROR_NOT_AVAILABLE)
  {
    aString.Truncate();
    return NS_OK;
  }
  return rv;
}

NS_IMETHODIMP nsAbCardProperty::SetLastName(const nsAString &aString)
{
  return SetPropertyAsAString(kLastNameProperty, aString);
}

NS_IMETHODIMP nsAbCardProperty::GetDisplayName(nsAString &aString)
{
  nsresult rv = GetPropertyAsAString(kDisplayNameProperty, aString);
  if (rv == NS_ERROR_NOT_AVAILABLE)
  {
    aString.Truncate();
    return NS_OK;
  }
  return rv;
}

NS_IMETHODIMP nsAbCardProperty::SetDisplayName(const nsAString &aString)
{
  return SetPropertyAsAString(kDisplayNameProperty, aString);
}

NS_IMETHODIMP nsAbCardProperty::GetPrimaryEmail(nsAString &aString)
{
  nsresult rv = GetPropertyAsAString(kPriEmailProperty, aString);
  if (rv == NS_ERROR_NOT_AVAILABLE)
  {
    aString.Truncate();
    return NS_OK;
  }
  return rv;
}

NS_IMETHODIMP nsAbCardProperty::SetPrimaryEmail(const nsAString &aString)
{
  return SetPropertyAsAString(kPriEmailProperty, aString);
}

NS_IMETHODIMP nsAbCardProperty::HasEmailAddress(const nsACString &aEmailAddress,
                                                PRBool *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);

  *aResult = PR_FALSE;

  nsCString emailAddress;
  nsresult rv = GetPropertyAsAUTF8String(kPriEmailProperty, emailAddress);
#ifdef MOZILLA_INTERNAL_API
  if (rv != NS_ERROR_NOT_AVAILABLE &&
      emailAddress.Equals(aEmailAddress, nsCaseInsensitiveCStringComparator()))
#else
  if (rv != NS_ERROR_NOT_AVAILABLE &&
      emailAddress.Equals(aEmailAddress, CaseInsensitiveCompare))
#endif
  {
    *aResult = PR_TRUE;
    return NS_OK;
  }

  rv = GetPropertyAsAUTF8String(k2ndEmailProperty, emailAddress);
#ifdef MOZILLA_INTERNAL_API
  if (rv != NS_ERROR_NOT_AVAILABLE &&
      emailAddress.Equals(aEmailAddress, nsCaseInsensitiveCStringComparator()))
#else
  if (rv != NS_ERROR_NOT_AVAILABLE &&
      emailAddress.Equals(aEmailAddress, CaseInsensitiveCompare))
#endif
    *aResult = PR_TRUE;

  return NS_OK;
}

// This function may be overridden by derived classes for
// nsAb*Card specific implementations.
NS_IMETHODIMP nsAbCardProperty::Copy(nsIAbCard* srcCard)
{
  NS_ENSURE_ARG_POINTER(srcCard);

  nsCOMPtr<nsISimpleEnumerator> properties;
  nsresult rv = srcCard->GetProperties(getter_AddRefs(properties));
  NS_ENSURE_SUCCESS(rv, rv);

  PRBool hasMore;
  nsCOMPtr<nsISupports> result;
  while (NS_SUCCEEDED(rv = properties->HasMoreElements(&hasMore)) && hasMore)
  {
    rv = properties->GetNext(getter_AddRefs(result));
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIProperty> property = do_QueryInterface(result, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    nsAutoString name;
    property->GetName(name);
    nsCOMPtr<nsIVariant> value;
    property->GetValue(getter_AddRefs(value));

    SetProperty(NS_ConvertUTF16toUTF8(name), value);
  }
  NS_ENSURE_SUCCESS(rv, rv);

  PRBool isMailList;
  srcCard->GetIsMailList(&isMailList);
  SetIsMailList(isMailList);

  nsCString mailListURI;
  srcCard->GetMailListURI(getter_Copies(mailListURI));
  SetMailListURI(mailListURI.get());

  return NS_OK;
}

NS_IMETHODIMP nsAbCardProperty::Equals(nsIAbCard *card, PRBool *result)
{
  *result = (card == this);
  return NS_OK;
}

////////////////////////////////////////////////////////////////////////////////
// The following methods are other views of a card
////////////////////////////////////////////////////////////////////////////////

// XXX: Use the category manager instead of this file to implement these
NS_IMETHODIMP nsAbCardProperty::TranslateTo(const nsACString &type, nsACString &result)
{
  if (type.EqualsLiteral("base64xml"))
    return ConvertToBase64EncodedXML(result);
  else if (type.EqualsLiteral("xml"))
  {
    nsString utf16String;
    nsresult rv = ConvertToXMLPrintData(utf16String);
    NS_ENSURE_SUCCESS(rv, rv);
    result = NS_ConvertUTF16toUTF8(utf16String);
    return NS_OK;
  }
  else if (type.EqualsLiteral("vcard"))
    return ConvertToEscapedVCard(result);

  return NS_ERROR_ILLEGAL_VALUE;
}
//
static VObject* myAddPropValue(VObject *o, const char *propName, const PRUnichar *propValue, PRBool *aCardHasData)
{
    if (aCardHasData)
        *aCardHasData = PR_TRUE;
    return addPropValue(o, propName, NS_ConvertUTF16toUTF8(propValue).get());
}

nsresult nsAbCardProperty::ConvertToEscapedVCard(nsACString &aResult)
{
    nsString str;
    nsresult rv;
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

    rv = GetPropertyAsAString(kCompanyProperty, str);
    if (NS_SUCCEEDED(rv) && !str.IsEmpty())
    {
        t = isAPropertyOf(vObj, VCOrgProp);
        if (!t)
            t = addProp(vObj, VCOrgProp);
        myAddPropValue(t, VCOrgNameProp, str.get(), &vCardHasData);
    }

    rv = GetPropertyAsAString(kDepartmentProperty, str);
    if (NS_SUCCEEDED(rv) && !str.IsEmpty())
    {
        t = isAPropertyOf(vObj, VCOrgProp);
        if (!t)
            t = addProp(vObj, VCOrgProp);
        myAddPropValue(t, VCOrgUnitProp, str.get(), &vCardHasData);
    }

    rv = GetPropertyAsAString(kWorkAddress2Property, str);
    if (NS_SUCCEEDED(rv) && !str.IsEmpty())
    {
        t = isAPropertyOf(vObj, VCAdrProp);
        if  (!t)
            t = addProp(vObj, VCAdrProp);
        myAddPropValue(t, VCPostalBoxProp, str.get(), &vCardHasData);
    }

    rv = GetPropertyAsAString(kWorkAddressProperty, str);
    if (NS_SUCCEEDED(rv) && !str.IsEmpty())
    {
        t = isAPropertyOf(vObj, VCAdrProp);
        if  (!t)
            t = addProp(vObj, VCAdrProp);
        myAddPropValue(t, VCStreetAddressProp, str.get(), &vCardHasData);
    }

    rv = GetPropertyAsAString(kWorkCityProperty, str);
    if (NS_SUCCEEDED(rv) && !str.IsEmpty())
    {
        t = isAPropertyOf(vObj, VCAdrProp);
        if  (!t)
            t = addProp(vObj, VCAdrProp);
        myAddPropValue(t, VCCityProp, str.get(), &vCardHasData);
    }

    rv = GetPropertyAsAString(kWorkStateProperty, str);
    if (NS_SUCCEEDED(rv) && !str.IsEmpty())
    {
        t = isAPropertyOf(vObj, VCAdrProp);
        if  (!t)
            t = addProp(vObj, VCAdrProp);
        myAddPropValue(t, VCRegionProp, str.get(), &vCardHasData);
    }

    rv = GetPropertyAsAString(kWorkZipCodeProperty, str);
    if (NS_SUCCEEDED(rv) && !str.IsEmpty())
    {
        t = isAPropertyOf(vObj, VCAdrProp);
        if  (!t)
            t = addProp(vObj, VCAdrProp);
        myAddPropValue(t, VCPostalCodeProp, str.get(), &vCardHasData);
    }

    rv = GetPropertyAsAString(kWorkCountryProperty, str);
    if (NS_SUCCEEDED(rv) && !str.IsEmpty())
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
    if (NS_SUCCEEDED(rv) && !str.IsEmpty())
    {
        t = myAddPropValue(vObj, VCEmailAddressProp, str.get(), &vCardHasData);
        addProp(t, VCInternetProp);
    }

    rv = GetPropertyAsAString(kJobTitleProperty, str);
    if (NS_SUCCEEDED(rv) && !str.IsEmpty())
    {
        myAddPropValue(vObj, VCTitleProp, str.get(), &vCardHasData);
    }

    rv = GetPropertyAsAString(kWorkPhoneProperty, str);
    if (NS_SUCCEEDED(rv) && !str.IsEmpty())
    {
        t = myAddPropValue(vObj, VCTelephoneProp, str.get(), &vCardHasData);
        addProp(t, VCWorkProp);
    }

    rv = GetPropertyAsAString(kFaxProperty, str);
    if (NS_SUCCEEDED(rv) && !str.IsEmpty())
    {
        t = myAddPropValue(vObj, VCTelephoneProp, str.get(), &vCardHasData);
        addProp(t, VCFaxProp);
    }

    rv = GetPropertyAsAString(kPagerProperty, str);
    if (NS_SUCCEEDED(rv) && !str.IsEmpty())
    {
        t = myAddPropValue(vObj, VCTelephoneProp, str.get(), &vCardHasData);
        addProp(t, VCPagerProp);
    }

    rv = GetPropertyAsAString(kHomePhoneProperty, str);
    if (NS_SUCCEEDED(rv) && !str.IsEmpty())
    {
        t = myAddPropValue(vObj, VCTelephoneProp, str.get(), &vCardHasData);
        addProp(t, VCHomeProp);
    }

    rv = GetPropertyAsAString(kCellularProperty, str);
    if (NS_SUCCEEDED(rv) && !str.IsEmpty())
    {
        t = myAddPropValue(vObj, VCTelephoneProp, str.get(), &vCardHasData);
        addProp(t, VCCellularProp);
    }

    rv = GetPropertyAsAString(kNotesProperty, str);
    if (NS_SUCCEEDED(rv) && !str.IsEmpty())
    {
        myAddPropValue(vObj, VCNoteProp, str.get(), &vCardHasData);
    }

    PRUint32 format;
    rv = GetPropertyAsUint32(kPreferMailFormatProperty, &format);
    if (NS_SUCCEEDED(rv) && format == nsIAbPreferMailFormat::html) {
        myAddPropValue(vObj, VCUseHTML, NS_LITERAL_STRING("TRUE").get(), &vCardHasData);
    }
    else if (NS_SUCCEEDED(rv) && format == nsIAbPreferMailFormat::plaintext) {
        myAddPropValue(vObj, VCUseHTML, NS_LITERAL_STRING("FALSE").get(), &vCardHasData);
    }

    rv = GetPropertyAsAString(kWorkWebPageProperty, str);
    if (NS_SUCCEEDED(rv) && !str.IsEmpty())
    {
        myAddPropValue(vObj, VCURLProp, str.get(), &vCardHasData);
    }

    myAddPropValue(vObj, VCVersionProp, NS_LITERAL_STRING("2.1").get(), nsnull);

    if (!vCardHasData) {
        aResult.Truncate();
        return NS_OK;
    }

    int len = 0;
    char *vCard = writeMemVObject(0, &len, vObj);
    if (vObj)
        cleanVObject(vObj);

    nsCString escResult;
    MsgEscapeString(nsDependentCString(vCard), nsINetUtil::ESCAPE_URL_PATH, escResult);
    aResult = escResult;
    return NS_OK;
}

nsresult nsAbCardProperty::ConvertToBase64EncodedXML(nsACString &result)
{
  nsresult rv;
  nsString xmlStr;

  xmlStr.AppendLiteral("<?xml version=\"1.0\"?>\n"
                       "<?xml-stylesheet type=\"text/css\" href=\"chrome://messagebody/content/addressbook/print.css\"?>\n"
                       "<directory>\n");

  // Get Address Book string and set it as title of XML document
  nsCOMPtr<nsIStringBundle> bundle;
  nsCOMPtr<nsIStringBundleService> stringBundleService = do_GetService(NS_STRINGBUNDLE_CONTRACTID, &rv);
  if (NS_SUCCEEDED(rv)) {
    rv = stringBundleService->CreateBundle(sAddrbookProperties, getter_AddRefs(bundle));
    if (NS_SUCCEEDED(rv)) {
      nsString addrBook;
      rv = bundle->GetStringFromName(NS_LITERAL_STRING("addressBook").get(), getter_Copies(addrBook));
      if (NS_SUCCEEDED(rv)) {
        xmlStr.AppendLiteral("<title xmlns=\"http://www.w3.org/1999/xhtml\">");
        xmlStr.Append(addrBook);
        xmlStr.AppendLiteral("</title>\n");
      }
    }
  }

  nsString xmlSubstr;
  rv = ConvertToXMLPrintData(xmlSubstr);
  NS_ENSURE_SUCCESS(rv,rv);

  xmlStr.Append(xmlSubstr);
  xmlStr.AppendLiteral("</directory>\n");

  result.Adopt(PL_Base64Encode(NS_ConvertUTF16toUTF8(xmlStr).get(), 0, nsnull));
  return NS_OK;
}

nsresult nsAbCardProperty::ConvertToXMLPrintData(nsAString &aXMLSubstr)
{
  nsresult rv;
  nsCOMPtr<nsIPrefBranch> prefBranch = do_GetService(NS_PREFSERVICE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  PRInt32 generatedNameFormat;
  rv = prefBranch->GetIntPref(PREF_MAIL_ADDR_BOOK_LASTNAMEFIRST, &generatedNameFormat);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIStringBundleService> stringBundleService = do_GetService(NS_STRINGBUNDLE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr<nsIStringBundle> bundle;
  rv = stringBundleService->CreateBundle(sAddrbookProperties, getter_AddRefs(bundle));
  NS_ENSURE_SUCCESS(rv,rv);

  nsString generatedName;
  rv = GenerateName(generatedNameFormat, bundle, generatedName);
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr<mozITXTToHTMLConv> conv = do_CreateInstance(MOZ_TXTTOHTMLCONV_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  nsString xmlStr;
  xmlStr.SetLength(4096); // to reduce allocations. should be enough for most cards
  xmlStr.AssignLiteral("<GeneratedName>\n");

  // use ScanTXT to convert < > & to safe values.
  nsString safeText;
  if (!generatedName.IsEmpty()) {
    rv = conv->ScanTXT(generatedName.get(), mozITXTToHTMLConv::kEntities,
                       getter_Copies(safeText));
    NS_ENSURE_SUCCESS(rv,rv);
  }

  if (safeText.IsEmpty()) {
    nsAutoString primaryEmail;
    GetPrimaryEmail(primaryEmail);

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

    nsString headingAddresses;
    rv = bundle->GetStringFromName(NS_LITERAL_STRING("headingAddresses").get(), getter_Copies(headingAddresses));
    NS_ENSURE_SUCCESS(rv, rv);

    xmlStr.Append(headingAddresses);
    xmlStr.AppendLiteral("</sectiontitle>");

    nsCOMPtr<nsIRDFService> rdfService = do_GetService("@mozilla.org/rdf/rdf-service;1", &rv);
    NS_ENSURE_SUCCESS(rv,rv);

    nsCOMPtr <nsIRDFResource> resource;
    rv = rdfService->GetResource(m_MailListURI, getter_AddRefs(resource));
    NS_ENSURE_SUCCESS(rv,rv);

    nsCOMPtr <nsIAbDirectory> mailList = do_QueryInterface(resource, &rv);
    NS_ENSURE_SUCCESS(rv,rv);

    nsCOMPtr<nsIMutableArray> addresses;
    rv = mailList->GetAddressLists(getter_AddRefs(addresses));
    if (addresses) {
      PRUint32 total = 0;
      addresses->GetLength(&total);
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
          nsString safeText;
          rv = conv->ScanTXT(displayName.get(), mozITXTToHTMLConv::kEntities,
                             getter_Copies(safeText));
          NS_ENSURE_SUCCESS(rv,rv);
          xmlStr.Append(safeText);

          xmlStr.AppendLiteral(" &lt;");

          listCard->GetPrimaryEmail(primaryEmail);

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

nsresult nsAbCardProperty::AppendSection(const AppendItem *aArray, PRInt16 aCount, const nsString& aHeading,
                                         nsIStringBundle *aBundle,
                                         mozITXTToHTMLConv *aConv,
                                         nsString &aResult)
{
  nsresult rv = NS_OK;

  aResult.AppendLiteral("<section>");

  nsString attrValue;
  PRBool sectionIsEmpty = PR_TRUE;

  PRInt16 i = 0;
  for (i=0;i<aCount;i++) {
    rv = GetPropertyAsAString(aArray[i].mColumn, attrValue);
    if (NS_SUCCEEDED(rv) && !attrValue.IsEmpty())
      sectionIsEmpty = PR_FALSE;
  }

  if (!sectionIsEmpty && !aHeading.IsEmpty()) {
    nsString heading;
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

  nsString attrValue;
  nsresult rv = GetPropertyAsAString(aItem.mColumn, attrValue);

  if (NS_FAILED(rv) || attrValue.IsEmpty())
    return NS_OK;

  aResult.Append(PRUnichar('<'));
  aResult.Append(NS_ConvertUTF8toUTF16(aItem.mColumn));
  aResult.Append(PRUnichar('>'));

  // use ScanTXT to convert < > & to safe values.
  nsString safeText;
  rv = aConv->ScanTXT(attrValue.get(), mozITXTToHTMLConv::kEntities, getter_Copies(safeText));
  NS_ENSURE_SUCCESS(rv,rv);
  aResult.Append(safeText);

  aResult.AppendLiteral("</");
  aResult.Append(NS_ConvertUTF8toUTF16(aItem.mColumn));
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
  nsString label, attrValue;

  rv = GetPropertyAsAString(aItem.mColumn, attrValue);

  if (NS_FAILED(rv) || attrValue.IsEmpty())
    return NS_OK;

  rv = aBundle->GetStringFromName(NS_ConvertUTF8toUTF16(aItem.mLabel).get(), getter_Copies(label));
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
  const char *statePropName, *zipPropName;

  if (strcmp(aItem.mColumn, kHomeCityProperty) == 0) {
    statePropName = kHomeStateProperty;
    zipPropName = kHomeZipCodeProperty;
  }
  else {
    statePropName = kWorkStateProperty;
    zipPropName = kWorkZipCodeProperty;
  }

  nsAutoString cityResult, stateResult, zipResult;

  rv = AppendLine(aItem, aConv, cityResult);
  NS_ENSURE_SUCCESS(rv,rv);

  item.mColumn = statePropName;
  item.mLabel = "";

  rv = AppendLine(item, aConv, stateResult);
  NS_ENSURE_SUCCESS(rv,rv);

  item.mColumn = zipPropName;

  rv = AppendLine(item, aConv, zipResult);
  NS_ENSURE_SUCCESS(rv,rv);

  nsString formattedString;

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

NS_IMETHODIMP nsAbCardProperty::GenerateName(PRInt32 aGenerateFormat,
                                             nsIStringBundle* aBundle,
                                             nsAString &aResult)
{
  // Cache the first and last names
  nsAutoString firstName, lastName;
  GetFirstName(firstName);
  GetLastName(lastName);

  // No need to check for aBundle present straight away, only do that if we're
  // actually going to use it.
  if (aGenerateFormat == GENERATE_DISPLAY_NAME)
    GetDisplayName(aResult);
  else if (lastName.IsEmpty())
    aResult = firstName;
  else if (firstName.IsEmpty())
    aResult = lastName;
  else {
    nsresult rv;
    nsCOMPtr<nsIStringBundle> bundle(aBundle);
    if (!bundle) {
      nsCOMPtr<nsIStringBundleService> stringBundleService =
        do_GetService(NS_STRINGBUNDLE_CONTRACTID, &rv); 
      NS_ENSURE_SUCCESS(rv, rv);
        
      rv = stringBundleService->CreateBundle(sAddrbookProperties,
                                             getter_AddRefs(bundle));
      NS_ENSURE_SUCCESS(rv, rv);
    }

    nsString result;

    if (aGenerateFormat == GENERATE_LAST_FIRST_ORDER) {
      const PRUnichar *stringParams[2] = {lastName.get(), firstName.get()};

      rv = bundle->FormatStringFromName(NS_LITERAL_STRING("lastFirstFormat").get(),
                                        stringParams, 2, getter_Copies(result));
    }
    else {
      const PRUnichar *stringParams[2] = {firstName.get(), lastName.get()};
        
      rv = bundle->FormatStringFromName(NS_LITERAL_STRING("firstLastFormat").get(),
                                        stringParams, 2, getter_Copies(result));
    }
    NS_ENSURE_SUCCESS(rv, rv); 

    aResult.Assign(result);
  }
  
  if (aResult.IsEmpty())
  {
    // see bug #211078
    // if there is no generated name at this point
    // use the userid from the email address
    // it is better than nothing.
    GetPrimaryEmail(aResult);
    PRInt32 index = aResult.FindChar('@');
    if (index != -1)
      aResult.SetLength(index);
  }

  return NS_OK;
}

NS_IMETHODIMP nsAbCardProperty::GeneratePhoneticName(PRBool aLastNameFirst,
                                                     nsAString &aResult)
{
  nsAutoString firstName, lastName;
  GetPropertyAsAString(kPhoneticFirstNameProperty, firstName);
  GetPropertyAsAString(kPhoneticLastNameProperty, lastName);

  if (aLastNameFirst)
  {
    aResult = lastName;
    aResult += firstName;
  }
  else
  {
    aResult = firstName;
    aResult += lastName;
  }

  return NS_OK;
}
