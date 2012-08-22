/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsAbMDBDirProperty.h"	 
#include "nsIServiceManager.h"
#include "nsStringGlue.h"
#include "nsCOMPtr.h"
#include "nsAbBaseCID.h"
#include "nsAddrDatabase.h"
#include "nsIAbCard.h"
#include "nsIAbListener.h"
#include "nsArrayUtils.h"
#include "mdb.h"
#include "nsComponentManagerUtils.h"

nsAbMDBDirProperty::nsAbMDBDirProperty(void)
  : nsAbDirProperty()
{
  m_dbRowID = 0;
}

nsAbMDBDirProperty::~nsAbMDBDirProperty(void)
{ 
}


NS_IMPL_ISUPPORTS_INHERITED3(nsAbMDBDirProperty, nsAbDirProperty,
                             nsIAbDirectory,
                             nsISupportsWeakReference, nsIAbMDBDirectory)

////////////////////////////////////////////////////////////////////////////////



// nsIAbMDBDirectory attributes

NS_IMETHODIMP nsAbMDBDirProperty::GetDbRowID(uint32_t *aDbRowID)
{
	*aDbRowID = m_dbRowID;
	return NS_OK;
}

NS_IMETHODIMP nsAbMDBDirProperty::SetDbRowID(uint32_t aDbRowID)
{
	m_dbRowID = aDbRowID;
	return NS_OK;
}


// nsIAbMDBDirectory methods

/* add mailing list to the parent directory */
NS_IMETHODIMP nsAbMDBDirProperty::AddMailListToDirectory(nsIAbDirectory *mailList)
{
  if (!m_AddressList)
  {
    nsresult rv;
    m_AddressList = do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  uint32_t position;
  if (NS_FAILED(m_AddressList->IndexOf(0, mailList, &position)))
    m_AddressList->AppendElement(mailList, false);

  return NS_OK;
}

/* add addresses to the mailing list */
NS_IMETHODIMP nsAbMDBDirProperty::AddAddressToList(nsIAbCard *card)
{
  if (!m_AddressList)
  {
    nsresult rv;
    m_AddressList = do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  uint32_t position;
  if (NS_FAILED(m_AddressList->IndexOf(0, card, &position)))
    m_AddressList->AppendElement(card, false);

  return NS_OK;
}

NS_IMETHODIMP nsAbMDBDirProperty::CopyDBMailList(nsIAbMDBDirectory* srcListDB)
{
	nsresult err = NS_OK;
	nsCOMPtr<nsIAbDirectory> srcList(do_QueryInterface(srcListDB));
	if (NS_FAILED(err)) 
		return NS_ERROR_NULL_POINTER;

	CopyMailList (srcList);

	uint32_t rowID;
	srcListDB->GetDbRowID(&rowID);
	SetDbRowID(rowID);

	return NS_OK;
}


// nsIAbMDBDirectory NOT IMPLEMENTED methods

/* nsIAbDirectory addDirectory (in string uriName); */
NS_IMETHODIMP nsAbMDBDirProperty::AddDirectory(const char *uriName, nsIAbDirectory **_retval)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* [noscript] void removeElementsFromAddressList (); */
NS_IMETHODIMP nsAbMDBDirProperty::RemoveElementsFromAddressList()
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* void removeEmailAddressAt (in unsigned long aIndex); */
NS_IMETHODIMP nsAbMDBDirProperty::RemoveEmailAddressAt(uint32_t aIndex)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* [noscript] void notifyDirItemAdded (in nsISupports item); */
NS_IMETHODIMP nsAbMDBDirProperty::NotifyDirItemAdded(nsISupports *item)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* [noscript] void clearDatabase (); */
NS_IMETHODIMP nsAbMDBDirProperty::ClearDatabase()
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsAbMDBDirProperty::GetDatabaseFile(nsIFile **aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP nsAbMDBDirProperty::GetDatabase(nsIAddrDatabase **aResult)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}
