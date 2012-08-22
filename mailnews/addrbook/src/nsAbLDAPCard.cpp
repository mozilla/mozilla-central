/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsAbLDAPCard.h"
#include "nsIMutableArray.h"
#include "nsCOMPtr.h"
#include "nsILDAPModification.h"
#include "nsILDAPBERValue.h"
#include "nsILDAPMessage.h"
#include "nsIAbLDAPAttributeMap.h"
#include "nsServiceManagerUtils.h"
#include "nsComponentManagerUtils.h"
#include "nsAbBaseCID.h"
#include "nsAbUtils.h"
#include "nsILDAPErrors.h"

#include <stdio.h>

#define kDNColumn "DN"

nsAbLDAPCard::nsAbLDAPCard()
{
}

nsAbLDAPCard::~nsAbLDAPCard()
{
}

NS_IMPL_ISUPPORTS_INHERITED1(nsAbLDAPCard, nsAbCardProperty, nsIAbLDAPCard)

/* Retrieves the changes to the LDAP card and stores them in an LDAP
 * update message.
 *
 * Calling this method changes the LDAP card, it updates the
 * meta-properties (m_*) to reflect what the LDAP contents will be once
 * the update has been performed. This allows you to do multiple (successful)
 * consecutive edits on a card in a search result. If the meta-properties
 * were not updated, incorrect assuptions would be made about what object
 * classes to add, or  what attributes to clear.
 *
 * XXX: We need to take care when integrating this code with the asynchronous
 * update dialogs, as the current code in nsAbLDAPDirectory has a problem
 * when an update fails: the modified card still gets stored and shown to
 * the user instead of being discarded. There is one especially tricky case:
 * when you do an update on a card which changes its DN, you have two
 * operations (rename, then update the other attributes). If the rename
 * operation succeeds and not the update of the attributes, you are 
 * "somewhere in between" the original card and the updated card.
*/
NS_IMETHODIMP nsAbLDAPCard::GetLDAPMessageInfo(
  nsIAbLDAPAttributeMap *aAttributeMap,
  const uint32_t aClassCount,
  const char **aClasses,
  int32_t aType,
  nsIArray **aLDAPAddMessageInfo)
{
  NS_ENSURE_ARG_POINTER(aAttributeMap);
  NS_ENSURE_ARG_POINTER(aClasses);
  NS_ENSURE_ARG_POINTER(aLDAPAddMessageInfo);
  
  nsresult rv;
  nsCOMPtr<nsIMutableArray> modArray =
    do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  
  // Add any missing object classes. We never remove any object
  // classes: if an entry has additional object classes, it's probably
  // for a good reason.
  nsCAutoString oclass;
  for (uint32_t i = 0; i < aClassCount; ++i)
  {
    oclass.Assign(nsDependentCString(aClasses[i]));
    ToLowerCase(oclass);
   
    if (m_objectClass.IndexOf(oclass) == nsTArray<nsCString>::NoIndex)
    {
      m_objectClass.AppendElement(oclass);
      printf("LDAP : adding objectClass %s\n", oclass.get());
    }
  }

  nsCOMPtr<nsILDAPModification> mod =
    do_CreateInstance("@mozilla.org/network/ldap-modification;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);
 
  nsCOMPtr<nsIMutableArray> values =
    do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  
  for (uint32_t i = 0; i < m_objectClass.Length(); ++i)
  {
    nsCOMPtr<nsILDAPBERValue> value =
      do_CreateInstance("@mozilla.org/network/ldap-ber-value;1", &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    rv = value->SetFromUTF8(m_objectClass.ElementAt(i));
    NS_ENSURE_SUCCESS(rv, rv);

    rv = values->AppendElement(value, false);
    NS_ENSURE_SUCCESS(rv, rv);
  }
  
  rv = mod->SetUpModification(aType, NS_LITERAL_CSTRING("objectClass"), values);
  NS_ENSURE_SUCCESS(rv, rv);

  modArray->AppendElement(mod, false);

  // Add card properties
  CharPtrArrayGuard props;
  rv = aAttributeMap->GetAllCardProperties(props.GetSizeAddr(),
    props.GetArrayAddr());
  NS_ENSURE_SUCCESS(rv, rv);

  nsCAutoString attr;
  nsCString propvalue;
  for (uint32_t i = 0; i < props.GetSize(); ++i)
  {
    // Skip some attributes that don't map to LDAP.
    //
    // BirthYear : by default this is mapped to 'birthyear',
    // which is not part of mozillaAbPersonAlpha
    //
    // LastModifiedDate : by default this is mapped to 'modifytimestamp',
    // which cannot be modified
    //
    // PreferMailFormat : by default this is mapped to 'mozillaUseHtmlMail',
    // which is a boolean, not plaintext/html/unknown
    if (!strcmp(props[i], kBirthYearProperty) ||
        !strcmp(props[i], kLastModifiedDateProperty) ||
        !strcmp(props[i], kPreferMailFormatProperty))
      continue;
    
    rv = aAttributeMap->GetFirstAttribute(nsDependentCString(props[i]),
      attr);
    NS_ENSURE_SUCCESS(rv, rv);
    ToLowerCase(attr);

    // If the property is not mapped to an attribute, skip it.
    if (attr.IsEmpty())
      continue;
 
    nsCOMPtr<nsILDAPModification> mod =
      do_CreateInstance("@mozilla.org/network/ldap-modification;1", &rv);
    NS_ENSURE_SUCCESS(rv, rv);
   
    uint32_t index = m_attributes.IndexOf(attr);

    rv = GetPropertyAsAUTF8String(props[i], propvalue);

    if (NS_SUCCEEDED(rv) &&!propvalue.IsEmpty())
    {
      // If the new value is not empty, add/update it
      nsCOMPtr<nsILDAPBERValue> value =
        do_CreateInstance("@mozilla.org/network/ldap-ber-value;1", &rv);
      NS_ENSURE_SUCCESS(rv, rv);

      rv = value->SetFromUTF8(propvalue);
      NS_ENSURE_SUCCESS(rv, rv);
 
      rv = mod->SetUpModificationOneValue(aType, attr, value);
      NS_ENSURE_SUCCESS(rv, rv);
    
      printf("LDAP : setting attribute %s (%s) to '%s'\n", attr.get(),
        props[i], propvalue.get());
      modArray->AppendElement(mod, false);
      if (index != nsTArray<nsCString>::NoIndex)
        m_attributes.AppendElement(attr);

    }
    else if (aType == nsILDAPModification::MOD_REPLACE &&
             index != nsTArray<nsCString>::NoIndex)
    {
      // If the new value is empty, we are performing an update
      // and the attribute was previously set, clear it
      nsCOMPtr<nsIMutableArray> novalues =
        do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
      NS_ENSURE_SUCCESS(rv, rv);

      rv = mod->SetUpModification(aType, attr, novalues);
      NS_ENSURE_SUCCESS(rv, rv);
      
      printf("LDAP : removing attribute %s (%s)\n", attr.get(), props[i]);
      modArray->AppendElement(mod, false);
      m_attributes.RemoveElementAt(index);
    }
  }

  NS_ADDREF(*aLDAPAddMessageInfo = modArray);

  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPCard::BuildRdn(nsIAbLDAPAttributeMap *aAttributeMap,
                                     const uint32_t aAttrCount,
                                     const char **aAttributes,
                                     nsACString &aRdn)
{
  NS_ENSURE_ARG_POINTER(aAttributeMap);
  NS_ENSURE_ARG_POINTER(aAttributes);
  
  nsresult rv;
  nsCString attr;
  nsCAutoString prop;
  nsCString propvalue;

  aRdn.Truncate();
  for (uint32_t i = 0; i < aAttrCount; ++i)
  {
    attr.Assign(nsDependentCString(aAttributes[i]));
   
    // Lookup the property corresponding to the attribute
    rv = aAttributeMap->GetProperty(attr, prop);
    NS_ENSURE_SUCCESS(rv, rv);

    // Get the property value
    rv = GetPropertyAsAUTF8String(prop.get(), propvalue);

    // XXX The case where an attribute needed to build the Relative
    // Distinguished Name is not set needs to be handled by the caller,
    // so as to let the user know what is missing.
    if (NS_FAILED(rv) || propvalue.IsEmpty())
    {
      NS_ERROR("nsAbLDAPCard::BuildRdn: a required attribute is not set");
      return NS_ERROR_NOT_INITIALIZED;
    }
  
    aRdn.Append(attr);
    aRdn.AppendLiteral("=");
    aRdn.Append(propvalue);
    if (i < aAttrCount - 1)
      aRdn.AppendLiteral("+");
  }
  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPCard::GetDn(nsACString &aDN)
{
  return GetPropertyAsAUTF8String(kDNColumn, aDN);
}

NS_IMETHODIMP nsAbLDAPCard::SetDn(const nsACString &aDN)
{
  SetLocalId(aDN);
  return SetPropertyAsAUTF8String(kDNColumn, aDN);
}

NS_IMETHODIMP nsAbLDAPCard::SetMetaProperties(nsILDAPMessage *aMessage)
{
  NS_ENSURE_ARG_POINTER(aMessage);
  
  // Get DN
  nsCAutoString dn;
  nsresult rv = aMessage->GetDn(dn);
  NS_ENSURE_SUCCESS(rv, rv);

  SetDn(dn);

  // Get the list of set attributes
  CharPtrArrayGuard attrs;
  rv = aMessage->GetAttributes(attrs.GetSizeAddr(), attrs.GetArrayAddr());
  NS_ENSURE_SUCCESS(rv, rv);
 
  nsCAutoString attr;
  m_attributes.Clear();
  for (uint32_t i = 0; i < attrs.GetSize(); ++i)
  {
    attr.Assign(nsDependentCString(attrs[i]));
    ToLowerCase(attr);
    m_attributes.AppendElement(attr);
  }

  // Get the objectClass values
  m_objectClass.Clear();
  PRUnicharPtrArrayGuard vals;
  rv = aMessage->GetValues("objectClass", vals.GetSizeAddr(),
    vals.GetArrayAddr());

  // objectClass is not always included in search result entries and
  // nsILDAPMessage::GetValues returns NS_ERROR_LDAP_DECODING_ERROR if the
  // requested attribute doesn't exist.
  if (rv ==  NS_ERROR_LDAP_DECODING_ERROR)
    return NS_OK;

  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCAutoString oclass;
  for (uint32_t i = 0; i < vals.GetSize(); ++i)
  {
    oclass.Assign(NS_LossyConvertUTF16toASCII(nsDependentString(vals[i])));
    ToLowerCase(oclass);
    m_objectClass.AppendElement(oclass);
  }

  return NS_OK;
}
