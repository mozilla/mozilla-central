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
 * Portions created by the Initial Developer are Copyright (C) 1999
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Seth Spitzer <sspitzer@netscape.com>
 *   Pierre Phaneuf <pp@ludusdesign.com>
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

#include "msgCore.h"  // for pre-compiled headers

#include "nsIAbCard.h"
#include "nsAbBaseCID.h"
#include "nsAbAddressCollecter.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch2.h"
#include "nsIMsgHeaderParser.h"
#include "nsIRDFService.h"
#include "nsRDFCID.h"
#include "nsStringGlue.h"
#include "prmem.h"
#include "nsServiceManagerUtils.h"
#include "nsComponentManagerUtils.h"
#include "nsIAbMDBDirectory.h"

NS_IMPL_ISUPPORTS2(nsAbAddressCollecter, nsIAbAddressCollecter, nsIObserver)

#define PREF_MAIL_COLLECT_ADDRESSBOOK "mail.collect_addressbook"

nsAbAddressCollecter::nsAbAddressCollecter()
{
}

nsAbAddressCollecter::~nsAbAddressCollecter()
{
  nsresult rv;
  nsCOMPtr<nsIPrefBranch2> pPrefBranchInt(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  if(NS_SUCCEEDED(rv))
    pPrefBranchInt->RemoveObserver(PREF_MAIL_COLLECT_ADDRESSBOOK, this);
}

NS_IMETHODIMP nsAbAddressCollecter::GetCardFromAttribute(const nsACString &aName, const nsACString &aValue, nsIAbCard **aCard)
{
  NS_ENSURE_ARG_POINTER(aCard);
  if (m_database)
    // Please DO NOT change the 3rd param of GetCardFromAttribute() call to 
    // PR_TRUE (ie, case insensitive) without reading bugs #128535 and #121478.
    return m_database->GetCardFromAttribute(m_directory.get(),
                                            PromiseFlatCString(aName).get(),
                                            aValue, PR_FALSE /* retain case */,
                                            aCard);

  return NS_ERROR_FAILURE;
}

NS_IMETHODIMP
nsAbAddressCollecter::CollectAddress(const nsACString &aAddresses,
                                     PRBool aCreateCard,
                                     PRUint32 aSendFormat)
{
  // note that we're now setting the whole recipient list,
  // not just the pretty name of the first recipient.
  PRUint32 numAddresses;
  char *names;
  char *addresses;

  nsresult rv;
  nsCOMPtr<nsIMsgHeaderParser> pHeader = do_GetService(NS_MAILNEWS_MIME_HEADER_PARSER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  rv = pHeader->ParseHeaderAddresses(PromiseFlatCString(aAddresses).get(),
                                     &names, &addresses, &numAddresses);
  NS_ASSERTION(NS_SUCCEEDED(rv), "failed to parse, so can't collect");
  if (NS_FAILED(rv))
    return NS_OK;

  char *curNamePtr = names;
  char *curAddressPtr = addresses;

  for (PRUint32 i = 0; i < numAddresses; i++)
  {
    nsDependentCString curAddress(curAddressPtr);
    curAddressPtr += curAddress.Length() + 1;

    nsCString unquotedName;
    rv = pHeader->UnquotePhraseOrAddr(curNamePtr, PR_FALSE,
                                      getter_Copies(unquotedName));
    curNamePtr += strlen(curNamePtr) + 1;
    NS_ASSERTION(NS_SUCCEEDED(rv), "failed to unquote name");
    if (NS_FAILED(rv))
      continue;

    // Don't allow collection of addresses with no email address, it makes
    // no sense. Whilst we should never get here in most normal cases, we
    // should still be careful.
    if (curAddress.IsEmpty())
      continue;

    CollectSingleAddress(curAddress, unquotedName, aCreateCard, aSendFormat,
                         PR_FALSE);
  }

  PR_FREEIF(addresses);
  PR_FREEIF(names);
  return NS_OK;
}

NS_IMETHODIMP
nsAbAddressCollecter::CollectSingleAddress(const nsACString &aEmail,
                                           const nsACString &aDisplayName,
                                           PRBool aCreateCard,
                                           PRUint32 aSendFormat,
                                           PRBool aSkipCheckExisting)
{
  nsresult rv;
  nsCOMPtr<nsIAbCard> card;
  PRBool emailAddressIn2ndEmailColumn = PR_FALSE;

  if (!aSkipCheckExisting)
  {
    rv = GetCardFromAttribute(NS_LITERAL_CSTRING(kPriEmailProperty),
                              aEmail, getter_AddRefs(card));
    // We've not found a card, but is this address actually in the additional
    // email column?
    if (!card)
    {
      rv = GetCardFromAttribute(NS_LITERAL_CSTRING(k2ndEmailProperty),
                                aEmail, getter_AddRefs(card));
      if (card)
        emailAddressIn2ndEmailColumn = PR_TRUE;
    }
  }

  if (!card && (aCreateCard || aSkipCheckExisting))
  {
    card = do_CreateInstance(NS_ABCARDPROPERTY_CONTRACTID, &rv);
    if (NS_SUCCEEDED(rv) && card && m_directory)
    {
      // Set up the fields for the new card.
      SetNamesForCard(card, aDisplayName);
      AutoCollectScreenName(card, aEmail);

      if (NS_SUCCEEDED(card->SetPrimaryEmail(NS_ConvertUTF8toUTF16(aEmail))))
      {
        card->SetPropertyAsUint32(kPreferMailFormatProperty, aSendFormat);

        nsCOMPtr<nsIAbCard> addedCard;
        rv = m_directory->AddCard(card, getter_AddRefs(addedCard));
        NS_ASSERTION(NS_SUCCEEDED(rv), "failed to add card");
      }
    }
  }
  else if (card && !emailAddressIn2ndEmailColumn)
  {
    // address is already in the AB, so update the names
    PRBool modifiedCard = PR_FALSE;

    nsString displayName;
    card->GetDisplayName(displayName);
    // If we already have a display name, don't set the names on the card.
    if (displayName.IsEmpty() && !aDisplayName.IsEmpty())
      modifiedCard = SetNamesForCard(card, aDisplayName);

    if (aSendFormat != nsIAbPreferMailFormat::unknown)
    {
      PRUint32 currentFormat;
      rv = card->GetPropertyAsUint32(kPreferMailFormatProperty,
                                     &currentFormat);
      NS_ASSERTION(NS_SUCCEEDED(rv), "failed to get preferred mail format");

      // we only want to update the AB if the current format is unknown
      if (currentFormat == nsIAbPreferMailFormat::unknown &&
          NS_SUCCEEDED(card->SetPropertyAsUint32(kPreferMailFormatProperty,
                                                 aSendFormat)))
        modifiedCard = PR_TRUE;
    }

    if (modifiedCard && m_directory)
      m_directory->ModifyCard(card);
  }

  return NS_OK;
}

// Works out the screen name to put on the card for some well-known addresses
void
nsAbAddressCollecter::AutoCollectScreenName(nsIAbCard *aCard,
                                            const nsACString &aEmail)
{
  if (!aCard)
    return;

  PRInt32 atPos = aEmail.FindChar('@');
  if (atPos == -1)
    return;

  const nsACString& domain = Substring(aEmail, atPos + 1);

  // username in 
  // username@aol.com (America Online)
  // username@cs.com (Compuserve)
  // username@netscape.net (Netscape webmail)
  // are all AIM screennames.  autocollect that info.
  if (!domain.IsEmpty() &&
      (domain.Equals("aol.com") || domain.Equals("cs.com") ||
       domain.Equals("netscape.net")))
    aCard->SetPropertyAsAUTF8String(kScreenNameProperty, Substring(aEmail, 0, atPos));
}

// Returns true if the card was modified successfully.
PRBool
nsAbAddressCollecter::SetNamesForCard(nsIAbCard *aSenderCard,
                                      const nsACString &aFullName)
{
  nsCString firstName;
  nsCString lastName;
  PRBool modifiedCard = PR_FALSE;

  if (NS_SUCCEEDED(aSenderCard->SetDisplayName(NS_ConvertUTF8toUTF16(aFullName))))
    modifiedCard = PR_TRUE;

  // Now split up the full name.
  SplitFullName(nsCString(aFullName), firstName, lastName);

  if (!firstName.IsEmpty() &&
      NS_SUCCEEDED(aSenderCard->SetFirstName(NS_ConvertUTF8toUTF16(firstName))))
    modifiedCard = PR_TRUE;

  if (!lastName.IsEmpty() &&
      NS_SUCCEEDED(aSenderCard->SetLastName(NS_ConvertUTF8toUTF16(lastName))))
    modifiedCard = PR_TRUE;

  return modifiedCard;
}

// Splits the first and last name based on the space between them.
void
nsAbAddressCollecter::SplitFullName(const nsCString &aFullName, nsCString &aFirstName,
                                    nsCString &aLastName)
{
  int index = aFullName.RFindChar(' ');
  if (index != -1)
  {
    aLastName = Substring(aFullName, index + 1);
    aFirstName = Substring(aFullName, 0, index);
  }
}

// Observes the collected address book pref in case it changes.
NS_IMETHODIMP nsAbAddressCollecter::Observe(nsISupports *aSubject, const char *aTopic, const PRUnichar *aData)
{
  nsCOMPtr<nsIPrefBranch2> pPrefBranchInt = do_QueryInterface(aSubject);
  if (!pPrefBranchInt) {
    NS_ASSERTION(pPrefBranchInt, "failed to get prefs");
    return NS_OK;
  }

  nsresult rv;
  nsCString prefVal;
  pPrefBranchInt->GetCharPref(PREF_MAIL_COLLECT_ADDRESSBOOK,
                              getter_Copies(prefVal));
  rv = SetAbURI(prefVal);
  NS_ASSERTION(NS_SUCCEEDED(rv),"failed to change collected ab");
  return NS_OK;
}

// Initialises the collecter with the required items.
nsresult nsAbAddressCollecter::Init(void)
{
  nsresult rv;
  nsCOMPtr<nsIPrefBranch2> pPrefBranchInt(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = pPrefBranchInt->AddObserver(PREF_MAIL_COLLECT_ADDRESSBOOK, this, PR_FALSE);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCString prefVal;
  pPrefBranchInt->GetCharPref(PREF_MAIL_COLLECT_ADDRESSBOOK,
                              getter_Copies(prefVal));
  return SetAbURI(prefVal);
}

// Performs the necessary changes to set up the collecter for the specified
// collected address book.
nsresult nsAbAddressCollecter::SetAbURI(nsCString &aURI)
{
  if (aURI.IsEmpty())
    aURI.AssignLiteral(kPersonalAddressbookUri);

  if (aURI == m_abURI)
    return NS_OK;

  m_database = nsnull;
  m_directory = nsnull;
  m_abURI = aURI;

  nsresult rv;
  nsCOMPtr<nsIRDFService> rdfService = do_GetService("@mozilla.org/rdf/rdf-service;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIRDFResource> resource;
  rv = rdfService->GetResource(m_abURI, getter_AddRefs(resource));
  NS_ENSURE_SUCCESS(rv, rv);

  m_directory = do_QueryInterface(resource, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAbMDBDirectory> mdbDir(do_QueryInterface(m_directory, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = mdbDir->GetDatabase(getter_AddRefs(m_database));
  NS_ENSURE_SUCCESS(rv, rv);

  return rv;
}
