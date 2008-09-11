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
 * Sun Microsystems, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2001
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Created by: Paul Sandoz   <paul.sandoz@sun.com>
 *   Mark Banner <bugzilla@standard8.plus.com>
 *   Jeremy Laine <jeremy.laine@m4x.org>
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
  const PRUint32 aClassCount,
  const char **aClasses,
  PRInt32 aType,
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
  for (PRUint32 i = 0; i < aClassCount; ++i)
  {
    oclass.Assign(nsDependentCString(aClasses[i]));
    ToLowerCase(oclass);
   
    if (m_objectClass.IndexOf(oclass) == -1)
    {
      m_objectClass.AppendCString(oclass);
      printf("LDAP : adding objectClass %s\n", oclass.get());
    }
  }

  nsCOMPtr<nsILDAPModification> mod =
    do_CreateInstance("@mozilla.org/network/ldap-modification;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);
 
  nsCOMPtr<nsIMutableArray> values =
    do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  
  for (PRInt32 i = 0; i < m_objectClass.Count(); ++i)
  {
    nsCOMPtr<nsILDAPBERValue> value =
      do_CreateInstance("@mozilla.org/network/ldap-ber-value;1", &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    rv = value->SetFromUTF8(*m_objectClass.CStringAt(i));
    NS_ENSURE_SUCCESS(rv, rv);

    rv = values->AppendElement(value, PR_FALSE);
    NS_ENSURE_SUCCESS(rv, rv);
  }
  
  rv = mod->SetUpModification(aType, NS_LITERAL_CSTRING("objectClass"), values);
  NS_ENSURE_SUCCESS(rv, rv);

  modArray->AppendElement(mod, PR_FALSE);

  // Add card properties
  CharPtrArrayGuard props;
  rv = aAttributeMap->GetAllCardProperties(props.GetSizeAddr(),
    props.GetArrayAddr());
  NS_ENSURE_SUCCESS(rv, rv);

  nsCAutoString attr;
  nsCString propvalue;
  for (PRUint32 i = 0; i < props.GetSize(); ++i)
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
      modArray->AppendElement(mod, PR_FALSE);
      if (m_attributes.IndexOf(attr) != -1)
        m_attributes.AppendCString(attr);

    }
    else if ((aType == nsILDAPModification::MOD_REPLACE) &&
               (m_attributes.IndexOf(attr) != -1))
    {
      // If the new value is empty, we are performing an update
      // and the attribute was previously set, clear it
      nsCOMPtr<nsIMutableArray> novalues =
        do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
      NS_ENSURE_SUCCESS(rv, rv);

      rv = mod->SetUpModification(aType, attr, novalues);
      NS_ENSURE_SUCCESS(rv, rv);
      
      printf("LDAP : removing attribute %s (%s)\n", attr.get(), props[i]);
      modArray->AppendElement(mod, PR_FALSE);
      m_attributes.RemoveCString(attr);
    }
  }

  NS_ADDREF(*aLDAPAddMessageInfo = modArray);

  return NS_OK;
}

NS_IMETHODIMP nsAbLDAPCard::BuildRdn(nsIAbLDAPAttributeMap *aAttributeMap,
                                     const PRUint32 aAttrCount,
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
  for (PRUint32 i = 0; i < aAttrCount; ++i)
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
  for (PRUint32 i = 0; i < attrs.GetSize(); ++i)
  {
    attr.Assign(nsDependentCString(attrs[i]));
    ToLowerCase(attr);
    m_attributes.AppendCString(attr);
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
  for (PRUint32 i = 0; i < vals.GetSize(); ++i)
  {
    oclass.Assign(NS_LossyConvertUTF16toASCII(nsDependentString(vals[i])));
    ToLowerCase(oclass);
    m_objectClass.AppendCString(oclass);
  }

  return NS_OK;
}
