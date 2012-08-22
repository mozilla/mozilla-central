/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsAbDirProperty.h"	 
#include "nsAbBaseCID.h"
#include "nsIAbCard.h"
#include "nsDirPrefs.h"
#include "nsIPrefService.h"
#include "nsIPrefLocalizedString.h"
#include "nsServiceManagerUtils.h"
#include "nsComponentManagerUtils.h"
#include "prmem.h"
#include "nsIAbManager.h"

// From nsDirPrefs
#define kDefaultPosition 1

nsAbDirProperty::nsAbDirProperty(void)
  : m_LastModifiedDate(0),
    mIsValidURI(false),
    mIsQueryURI(false)
{
	m_IsMailList = false;
}

nsAbDirProperty::~nsAbDirProperty(void)
{
#if 0
  // this code causes a regression #138647
  // don't turn it on until you figure it out
  if (m_AddressList) {
    uint32_t count;
    nsresult rv;
    rv = m_AddressList->GetLength(&count);
    NS_ASSERTION(NS_SUCCEEDED(rv), "Count failed");
    int32_t i;
    for (i = count - 1; i >= 0; i--)
      m_AddressList->RemoveElementAt(i);
  }
#endif
}

NS_IMPL_ISUPPORTS4(nsAbDirProperty, nsIAbDirectory, nsISupportsWeakReference,
                              nsIAbCollection, nsIAbItem)

NS_IMETHODIMP nsAbDirProperty::GetUuid(nsACString &uuid)
{
  // XXX: not all directories have a dirPrefId...
  nsresult rv = GetDirPrefId(uuid);
  NS_ENSURE_SUCCESS(rv, rv);
  uuid.Append('&');
  nsString dirName;
  GetDirName(dirName);
  uuid.Append(NS_ConvertUTF16toUTF8(dirName));
  return rv;
}

NS_IMETHODIMP nsAbDirProperty::GenerateName(int32_t aGenerateFormat,
                                            nsIStringBundle *aBundle,
                                            nsAString &name)
{
  return GetDirName(name);
}

NS_IMETHODIMP nsAbDirProperty::GetPropertiesChromeURI(nsACString &aResult)
{
  aResult.AssignLiteral("chrome://messenger/content/addressbook/abAddressBookNameDialog.xul");
  return NS_OK;
}

NS_IMETHODIMP nsAbDirProperty::GetDirName(nsAString &aDirName)
{
  if (m_DirPrefId.IsEmpty())
  {
    aDirName = m_ListDirName;
    return NS_OK;
  }

  nsCString dirName;
  nsresult rv = GetLocalizedStringValue("description", EmptyCString(), dirName);
  NS_ENSURE_SUCCESS(rv, rv);

  // In TB 2 only some prefs had chrome:// URIs. We had code in place that would
  // only get the localized string pref for the particular address books that
  // were built-in.
  // Additionally, nsIPrefBranch::getComplexValue will only get a non-user-set,
  // non-locked pref value if it is a chrome:// URI and will get the string
  // value at that chrome URI. This breaks extensions/autoconfig that want to
  // set default pref values and allow users to change directory names.
  //
  // Now we have to support this, and so if for whatever reason we fail to get
  // the localized version, then we try and get the non-localized version
  // instead. If the string value is empty, then we'll just get the empty value
  // back here.
  if (dirName.IsEmpty())
  {
    rv = GetStringValue("description", EmptyCString(), dirName);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  CopyUTF8toUTF16(dirName, aDirName);
  return NS_OK;
}

// XXX Although mailing lists could use the NotifyItemPropertyChanged
// mechanism here, it requires some rework on how we write/save data
// relating to mailing lists, so we're just using the old method of a
// local variable to store the mailing list name.
NS_IMETHODIMP nsAbDirProperty::SetDirName(const nsAString &aDirName)
{
  if (m_DirPrefId.IsEmpty())
  {
    m_ListDirName = aDirName;
    return NS_OK;
  }

  // Store the old value.
  nsString oldDirName;
  nsresult rv = GetDirName(oldDirName);
  NS_ENSURE_SUCCESS(rv, rv);

  // Save the new value
  rv = SetLocalizedStringValue("description", NS_ConvertUTF16toUTF8(aDirName));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAbManager> abManager = do_GetService(NS_ABMANAGER_CONTRACTID, &rv);

  if (NS_SUCCEEDED(rv))
    // We inherit from nsIAbDirectory, so this static cast should be safe.
    abManager->NotifyItemPropertyChanged(static_cast<nsIAbDirectory*>(this),
                                         "DirName", oldDirName.get(),
                                         nsString(aDirName).get());

  return NS_OK;
}

NS_IMETHODIMP nsAbDirProperty::GetDirType(int32_t *aDirType)
{
  return GetIntValue("dirType", LDAPDirectory, aDirType);
}

NS_IMETHODIMP nsAbDirProperty::GetFileName(nsACString &aFileName)
{
  return GetStringValue("filename", EmptyCString(), aFileName);
}

NS_IMETHODIMP nsAbDirProperty::GetURI(nsACString &aURI)
{
  // XXX Should we complete this for Mailing Lists?
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsAbDirProperty::GetPosition(int32_t *aPosition)
{
  return GetIntValue("position", kDefaultPosition, aPosition);
}

NS_IMETHODIMP nsAbDirProperty::GetLastModifiedDate(uint32_t *aLastModifiedDate)
{
  NS_ENSURE_ARG_POINTER(aLastModifiedDate);
  *aLastModifiedDate = m_LastModifiedDate;
  return NS_OK;
}

NS_IMETHODIMP nsAbDirProperty::SetLastModifiedDate(uint32_t aLastModifiedDate)
{
	if (aLastModifiedDate)
	{
		m_LastModifiedDate = aLastModifiedDate;
	}
	return NS_OK;
}

NS_IMETHODIMP nsAbDirProperty::GetListNickName(nsAString &aListNickName)
{
  aListNickName = m_ListNickName;
  return NS_OK;
}

NS_IMETHODIMP nsAbDirProperty::SetListNickName(const nsAString &aListNickName)
{
  m_ListNickName = aListNickName;
  return NS_OK;
}

NS_IMETHODIMP nsAbDirProperty::GetDescription(nsAString &aDescription)
{
  aDescription = m_Description;
  return NS_OK;
}

NS_IMETHODIMP nsAbDirProperty::SetDescription(const nsAString &aDescription)
{
  m_Description = aDescription;
  return NS_OK;
}

NS_IMETHODIMP nsAbDirProperty::GetIsMailList(bool *aIsMailList)
{
	*aIsMailList = m_IsMailList;
	return NS_OK;
}

NS_IMETHODIMP nsAbDirProperty::SetIsMailList(bool aIsMailList)
{
	m_IsMailList = aIsMailList;
	return NS_OK;
}

NS_IMETHODIMP nsAbDirProperty::GetAddressLists(nsIMutableArray * *aAddressLists)
{
  if (!m_AddressList) 
  {
    nsresult rv;
    m_AddressList = do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  *aAddressLists = m_AddressList;
  NS_ADDREF(*aAddressLists);
  return NS_OK;
}

NS_IMETHODIMP nsAbDirProperty::SetAddressLists(nsIMutableArray * aAddressLists)
{
  m_AddressList = aAddressLists;
  return NS_OK;
}

NS_IMETHODIMP nsAbDirProperty::CopyMailList(nsIAbDirectory* srcList)
{
  SetIsMailList(true);

  nsString str;
  srcList->GetDirName(str);
  SetDirName(str);
  srcList->GetListNickName(str);
  SetListNickName(str);
  srcList->GetDescription(str);
  SetDescription(str);

  nsCOMPtr<nsIMutableArray> pAddressLists;
  srcList->GetAddressLists(getter_AddRefs(pAddressLists));
  SetAddressLists(pAddressLists);
  return NS_OK;
}

NS_IMETHODIMP nsAbDirProperty::GetIsQuery(bool *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  // Mailing lists are not queries by default, individual directory types
  // will override this.
  *aResult = false;
  return NS_OK;
}

NS_IMETHODIMP
nsAbDirProperty::Init(const char *aURI)
{
  mURINoQuery = aURI;
  mURI = aURI;
  mIsValidURI = true;

  int32_t searchCharLocation = mURINoQuery.FindChar('?');
  if (searchCharLocation >= 0)
  {
    mQueryString = Substring(mURINoQuery, searchCharLocation + 1);
    mURINoQuery.SetLength(searchCharLocation);
    mIsQueryURI = true;
  }

  return NS_OK;
}

// nsIAbDirectory NOT IMPLEMENTED methods
NS_IMETHODIMP
nsAbDirProperty::GetChildNodes(nsISimpleEnumerator **childList)
{ return NS_ERROR_NOT_IMPLEMENTED; }

NS_IMETHODIMP
nsAbDirProperty::GetChildCards(nsISimpleEnumerator **childCards)
{ return NS_ERROR_NOT_IMPLEMENTED; }

NS_IMETHODIMP
nsAbDirProperty::DeleteDirectory(nsIAbDirectory *directory)
{ return NS_ERROR_NOT_IMPLEMENTED; }

NS_IMETHODIMP
nsAbDirProperty::HasCard(nsIAbCard *cards, bool *hasCard)
{ return NS_ERROR_NOT_IMPLEMENTED; }

NS_IMETHODIMP
nsAbDirProperty::HasDirectory(nsIAbDirectory *dir, bool *hasDir)
{ return NS_ERROR_NOT_IMPLEMENTED; }

NS_IMETHODIMP
nsAbDirProperty::CreateNewDirectory(const nsAString &aDirName,
                                    const nsACString &aURI,
                                    uint32_t aType,
                                    const nsACString &aPrefName,
                                    nsACString &aResult)
{ return NS_ERROR_NOT_IMPLEMENTED; }

NS_IMETHODIMP
nsAbDirProperty::CreateDirectoryByURI(const nsAString &aDisplayName,
                                      const nsACString &aURI)
{ return NS_ERROR_NOT_IMPLEMENTED; }

NS_IMETHODIMP nsAbDirProperty::AddMailList(nsIAbDirectory *list, nsIAbDirectory **addedList)
{ return NS_ERROR_NOT_IMPLEMENTED; }

NS_IMETHODIMP nsAbDirProperty::EditMailListToDatabase(nsIAbCard *listCard)
{ return NS_ERROR_NOT_IMPLEMENTED; }

NS_IMETHODIMP nsAbDirProperty::AddCard(nsIAbCard *childCard, nsIAbCard **addedCard)
{ return NS_ERROR_NOT_IMPLEMENTED; }

NS_IMETHODIMP nsAbDirProperty::ModifyCard(nsIAbCard *aModifiedCard)
{ return NS_ERROR_NOT_IMPLEMENTED; }

NS_IMETHODIMP nsAbDirProperty::DeleteCards(nsIArray *cards)
{ return NS_ERROR_NOT_IMPLEMENTED; }

NS_IMETHODIMP nsAbDirProperty::DropCard(nsIAbCard *childCard, bool needToCopyCard)
{ return NS_ERROR_NOT_IMPLEMENTED; }

NS_IMETHODIMP nsAbDirProperty::CardForEmailAddress(const nsACString &aEmailAddress,
                                                   nsIAbCard ** aAbCard)
{ return NS_ERROR_NOT_IMPLEMENTED; }

NS_IMETHODIMP nsAbDirProperty::GetCardFromProperty(const char *aProperty,
                                                   const nsACString &aValue,
                                                   bool caseSensitive,
                                                   nsIAbCard **result)
{ return NS_ERROR_NOT_IMPLEMENTED; }

NS_IMETHODIMP nsAbDirProperty::GetCardsFromProperty(const char *aProperty,
                                                    const nsACString &aValue,
                                                    bool caseSensitive,
                                                    nsISimpleEnumerator **result)
{ return NS_ERROR_NOT_IMPLEMENTED; }


NS_IMETHODIMP nsAbDirProperty::GetSupportsMailingLists(bool *aSupportsMailingsLists)
{
  NS_ENSURE_ARG_POINTER(aSupportsMailingsLists);
  // We don't currently support nested mailing lists, so only return true if
  // we're not a mailing list.
  *aSupportsMailingsLists = !m_IsMailList;
  return NS_OK;
}

NS_IMETHODIMP nsAbDirProperty::GetReadOnly(bool *aReadOnly)
{
  NS_ENSURE_ARG_POINTER(aReadOnly);
  // Default is that we are writable. Any implementation that is read-only must
  // override this method.
  *aReadOnly = false;
  return NS_OK;
}

NS_IMETHODIMP nsAbDirProperty::GetIsRemote(bool *aIsRemote)
{
  NS_ENSURE_ARG_POINTER(aIsRemote);
  *aIsRemote = false;
  return NS_OK;
}

NS_IMETHODIMP nsAbDirProperty::GetIsSecure(bool *aIsSecure)
{
  NS_ENSURE_ARG_POINTER(aIsSecure);
  *aIsSecure = false;
  return NS_OK;
}

NS_IMETHODIMP nsAbDirProperty::UseForAutocomplete(const nsACString &aIdentityKey,
                                                  bool *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);

  // Is local autocomplete enabled?
  nsresult rv;
  nsCOMPtr<nsIPrefBranch> prefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID,
                                                   &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  return prefBranch->GetBoolPref("mail.enable_autocomplete", aResult);
}

NS_IMETHODIMP nsAbDirProperty::GetDirPrefId(nsACString &aDirPrefId)
{
  aDirPrefId = m_DirPrefId;
  return NS_OK;
}

NS_IMETHODIMP nsAbDirProperty::SetDirPrefId(const nsACString &aDirPrefId)
{
  if (!m_DirPrefId.Equals(aDirPrefId))
  {
    m_DirPrefId.Assign(aDirPrefId);
    // Clear the directory pref branch so that it is re-initialized next
    // time its required.
    m_DirectoryPrefs = nullptr;
  }
  return NS_OK;
}

nsresult nsAbDirProperty::InitDirectoryPrefs()
{
  if (m_DirPrefId.IsEmpty())
    return NS_ERROR_NOT_INITIALIZED;
    
  nsresult rv;
  nsCOMPtr<nsIPrefService> prefService(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCString realPrefId(m_DirPrefId);
  realPrefId.Append('.');

  return prefService->GetBranch(realPrefId.get(), getter_AddRefs(m_DirectoryPrefs));
}

NS_IMETHODIMP nsAbDirProperty::GetIntValue(const char *aName,
                                          int32_t aDefaultValue,
                                          int32_t *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);

  if (!m_DirectoryPrefs && NS_FAILED(InitDirectoryPrefs()))
    return NS_ERROR_NOT_INITIALIZED;

  if (NS_FAILED(m_DirectoryPrefs->GetIntPref(aName, aResult)))
    *aResult = aDefaultValue;

  return NS_OK;
}

NS_IMETHODIMP nsAbDirProperty::GetBoolValue(const char *aName,
                                           bool aDefaultValue,
                                           bool *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);

  if (!m_DirectoryPrefs && NS_FAILED(InitDirectoryPrefs()))
    return NS_ERROR_NOT_INITIALIZED;

  if (NS_FAILED(m_DirectoryPrefs->GetBoolPref(aName, aResult)))
    *aResult = aDefaultValue;

  return NS_OK;
}

NS_IMETHODIMP nsAbDirProperty::GetStringValue(const char *aName,
                                              const nsACString &aDefaultValue, 
                                              nsACString &aResult)
{
  if (!m_DirectoryPrefs && NS_FAILED(InitDirectoryPrefs()))
    return NS_ERROR_NOT_INITIALIZED;

  nsCString value;

    /* unfortunately, there may be some prefs out there which look like (null) */
  if (NS_SUCCEEDED(m_DirectoryPrefs->GetCharPref(aName, getter_Copies(value))) &&
      !value.EqualsLiteral("(null"))
    aResult = value;
  else
    aResult = aDefaultValue;

  return NS_OK;
}
/*
 * Get localized unicode string pref from properties file, convert into an
 * UTF8 string since address book prefs store as UTF8 strings. So far there
 * are 2 default prefs stored in addressbook.properties.
 * "ldap_2.servers.pab.description"
 * "ldap_2.servers.history.description"
 */
NS_IMETHODIMP nsAbDirProperty::GetLocalizedStringValue(const char *aName,
                                                       const nsACString &aDefaultValue, 
                                                       nsACString &aResult)
{
  if (!m_DirectoryPrefs && NS_FAILED(InitDirectoryPrefs()))
    return NS_ERROR_NOT_INITIALIZED;

  nsString wvalue;
  nsCOMPtr<nsIPrefLocalizedString> locStr;

  nsresult rv = m_DirectoryPrefs->GetComplexValue(aName,
                                                  NS_GET_IID(nsIPrefLocalizedString),
                                                  getter_AddRefs(locStr));
  if (NS_SUCCEEDED(rv))
  {
    rv = locStr->ToString(getter_Copies(wvalue));
    NS_ENSURE_SUCCESS(rv, rv);
  }

  if (wvalue.IsEmpty())
    aResult = aDefaultValue;
  else
    CopyUTF16toUTF8(wvalue, aResult);

  return NS_OK;
}

NS_IMETHODIMP nsAbDirProperty::SetIntValue(const char *aName,
                                          int32_t aValue)
{
  if (!m_DirectoryPrefs && NS_FAILED(InitDirectoryPrefs()))
    return NS_ERROR_NOT_INITIALIZED;

  return m_DirectoryPrefs->SetIntPref(aName, aValue);
}

NS_IMETHODIMP nsAbDirProperty::SetBoolValue(const char *aName,
                                           bool aValue)
{
  if (!m_DirectoryPrefs && NS_FAILED(InitDirectoryPrefs()))
    return NS_ERROR_NOT_INITIALIZED;

  return m_DirectoryPrefs->SetBoolPref(aName, aValue);
}

NS_IMETHODIMP nsAbDirProperty::SetStringValue(const char *aName,
                                              const nsACString &aValue)
{
  if (!m_DirectoryPrefs && NS_FAILED(InitDirectoryPrefs()))
    return NS_ERROR_NOT_INITIALIZED;

  return m_DirectoryPrefs->SetCharPref(aName, nsCString(aValue).get());
}

NS_IMETHODIMP nsAbDirProperty::SetLocalizedStringValue(const char *aName,
                                                       const nsACString &aValue)
{
  if (!m_DirectoryPrefs && NS_FAILED(InitDirectoryPrefs()))
    return NS_ERROR_NOT_INITIALIZED;

  nsresult rv;
  nsCOMPtr<nsIPrefLocalizedString> locStr(
    do_CreateInstance(NS_PREFLOCALIZEDSTRING_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = locStr->SetData(NS_ConvertUTF8toUTF16(aValue).get());
  NS_ENSURE_SUCCESS(rv, rv);

  return m_DirectoryPrefs->SetComplexValue(aName,
                                           NS_GET_IID(nsIPrefLocalizedString),
                                           locStr);
}
