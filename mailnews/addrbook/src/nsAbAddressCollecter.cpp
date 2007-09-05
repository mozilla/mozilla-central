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

#include "nsIServiceManager.h"

#include "nsIAbCard.h"
#include "nsAbBaseCID.h"
#include "nsAbAddressCollecter.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch2.h"
#include "nsIAddrBookSession.h"
#include "nsIMsgHeaderParser.h"
#include "nsIRDFService.h"
#include "nsRDFCID.h"
#include "nsString.h"
#include "nsReadableUtils.h"
#include "prmem.h"
#include "nsIAddressBook.h"

NS_IMPL_ISUPPORTS2(nsAbAddressCollecter, nsIAbAddressCollecter, nsIObserver)

#define PREF_MAIL_COLLECT_ADDRESSBOOK "mail.collect_addressbook"

nsAbAddressCollecter::nsAbAddressCollecter()
{
}

nsAbAddressCollecter::~nsAbAddressCollecter()
{
  if (m_database) {
    m_database->Commit(nsAddrDBCommitType::kSessionCommit);
    m_database->Close(PR_FALSE);
    m_database = nsnull;
  }

  nsresult rv;
  nsCOMPtr<nsIPrefBranch2> pPrefBranchInt(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  if(NS_SUCCEEDED(rv))
    pPrefBranchInt->RemoveObserver(PREF_MAIL_COLLECT_ADDRESSBOOK, this);
}

NS_IMETHODIMP nsAbAddressCollecter::CollectUnicodeAddress(const nsAString &aAddress, PRBool aCreateCard, PRUint32 aSendFormat)
{
  // convert the unicode string to UTF-8...
  nsresult rv = CollectAddress(NS_ConvertUTF16toUTF8(aAddress), aCreateCard, aSendFormat);
  NS_ENSURE_SUCCESS(rv,rv);
  return rv;
}

NS_IMETHODIMP nsAbAddressCollecter::GetCardFromAttribute(const nsACString &aName, const nsACString &aValue, nsIAbCard **aCard)
{
  NS_ENSURE_ARG_POINTER(aCard);
  if (m_database)
    // Please DO NOT change the 3rd param of GetCardFromAttribute() call to 
    // PR_TRUE (ie, case insensitive) without reading bugs #128535 and #121478.
    return m_database->GetCardFromAttribute(m_directory.get(), nsCString(aName).get(),
            nsCString(aValue).get(), PR_FALSE /* retain case */, aCard);

  return NS_ERROR_FAILURE;
}

NS_IMETHODIMP nsAbAddressCollecter::CollectAddress(const nsACString &aAddress, PRBool aCreateCard, PRUint32 aSendFormat)
{
  // note that we're now setting the whole recipient list,
  // not just the pretty name of the first recipient.
  PRUint32 numAddresses;
  char *names;
  char *addresses;

  nsresult rv;
  nsCOMPtr<nsIMsgHeaderParser> pHeader = do_GetService(NS_MAILNEWS_MIME_HEADER_PARSER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  rv = pHeader->ParseHeaderAddresses(nsnull, nsCString(aAddress).get(), &names, &addresses, &numAddresses);
  NS_ASSERTION(NS_SUCCEEDED(rv), "failed to parse, so can't collect");
  if (NS_FAILED(rv))
    return NS_OK;

  char *curName = names;
  char *curAddress = addresses;

  for (PRUint32 i = 0; i < numAddresses; i++)
  {
    nsCString unquotedName;
    rv = pHeader->UnquotePhraseOrAddr(curName, PR_FALSE, getter_Copies(unquotedName));
    NS_ASSERTION(NS_SUCCEEDED(rv), "failed to unquote name");
    if (NS_FAILED(rv))
      continue;

    nsCOMPtr <nsIAbCard> existingCard;
    nsCOMPtr <nsIAbCard> cardInstance;
    PRBool emailAddressIn2ndEmailColumn = PR_FALSE;

    rv = GetCardFromAttribute(NS_LITERAL_CSTRING(kPriEmailColumn), nsDependentCString(curAddress), getter_AddRefs(existingCard));
    // We've not found a card, but is this address actually in the additional
    // email column?
    if (!existingCard)
    {
      rv = GetCardFromAttribute(NS_LITERAL_CSTRING(k2ndEmailColumn), nsDependentCString(curAddress), getter_AddRefs(existingCard));
      if (existingCard)
        emailAddressIn2ndEmailColumn = PR_TRUE;
    }

    if (!existingCard && aCreateCard)
    {
      nsCOMPtr<nsIAbCard> senderCard = do_CreateInstance(NS_ABCARDPROPERTY_CONTRACTID, &rv);
      if (NS_SUCCEEDED(rv) && senderCard)
      {
        PRBool modifiedCard;
        rv = SetNamesForCard(senderCard, unquotedName, &modifiedCard);
        NS_ASSERTION(NS_SUCCEEDED(rv), "failed to set names");

        rv = AutoCollectScreenName(senderCard, nsCString(curAddress), &modifiedCard);
        NS_ASSERTION(NS_SUCCEEDED(rv), "failed to set screenname");

        rv = senderCard->SetPrimaryEmail(NS_ConvertASCIItoUTF16(curAddress));
        NS_ASSERTION(NS_SUCCEEDED(rv), "failed to set email");

        if (aSendFormat != nsIAbPreferMailFormat::unknown)
        {
          rv = senderCard->SetPreferMailFormat(aSendFormat);
          NS_ASSERTION(NS_SUCCEEDED(rv), "failed to remember preferred mail format");
        }

        rv = AddCardToAddressBook(senderCard);
        NS_ASSERTION(NS_SUCCEEDED(rv), "failed to add card");
      }
    }
    else if (existingCard && !emailAddressIn2ndEmailColumn) { 
      // address is already in the AB, so update the names
      PRBool setNames = PR_FALSE;
      
      if (!unquotedName.IsEmpty())
      {
        rv = SetNamesForCard(existingCard, unquotedName, &setNames);
        NS_ASSERTION(NS_SUCCEEDED(rv), "failed to set names");
      }

      PRBool setScreenName = PR_FALSE; 
      rv = AutoCollectScreenName(existingCard, nsCString(curAddress), &setScreenName);
      NS_ASSERTION(NS_SUCCEEDED(rv), "failed to set screen name");

      PRBool setPreferMailFormat = PR_FALSE; 
      if (aSendFormat != nsIAbPreferMailFormat::unknown)
      {
        PRUint32 currentFormat;
        rv = existingCard->GetPreferMailFormat(&currentFormat);
        NS_ASSERTION(NS_SUCCEEDED(rv), "failed to get preferred mail format");

        // we only want to update the AB if the current format is unknown
        if (currentFormat == nsIAbPreferMailFormat::unknown) 
        {
          rv = existingCard->SetPreferMailFormat(aSendFormat);
          NS_ASSERTION(NS_SUCCEEDED(rv), "failed to remember preferred mail format");
          setPreferMailFormat = PR_TRUE;
        }
      }

      if ((setScreenName || setNames || setPreferMailFormat) && m_directory)
        m_directory->ModifyCard(existingCard);
    }

    curName += strlen(curName) + 1;
    curAddress += strlen(curAddress) + 1;
  } 

  PR_FREEIF(addresses);
  PR_FREEIF(names);
  return NS_OK;
}

nsresult nsAbAddressCollecter::AutoCollectScreenName(nsIAbCard *aCard, const nsACString &aEmail, PRBool *aModifiedCard)
{
  NS_ENSURE_ARG_POINTER(aCard);
  NS_ENSURE_ARG_POINTER(aModifiedCard);

  *aModifiedCard = PR_FALSE;

  nsCString email(aEmail);
  nsAutoString screenName;
  nsresult rv = aCard->GetAimScreenName(screenName);
  NS_ENSURE_SUCCESS(rv,rv);

  // don't override existing screennames
  if (!screenName.IsEmpty())
    return NS_OK;

  int atPos = aEmail.FindChar('@');
  if (atPos == -1) 
    return NS_OK;
    
  nsCString domain;
  email.Right(domain, aEmail.Length() - (atPos + 1));
  if (domain.IsEmpty())
    return NS_OK; 

  // username in 
  // username@aol.com (America Online)
  // username@cs.com (Compuserve)
  // username@netscape.net (Netscape webmail)
  // are all AIM screennames.  autocollect that info.
  if (domain.Equals("aol.com") || 
      domain.Equals("cs.com") || domain.Equals("netscape.net")) {
    nsCString userName;
    email.Left(userName, atPos);
  
    rv = aCard->SetAimScreenName(NS_ConvertUTF8toUTF16(userName));
    NS_ENSURE_SUCCESS(rv,rv);

    *aModifiedCard = PR_TRUE;
    return rv;
  }

  return NS_OK;
}


nsresult 
nsAbAddressCollecter::SetNamesForCard(nsIAbCard *aSenderCard, const nsACString &aFullName, PRBool *aModifiedCard)
{
  nsCString firstName;
  nsCString lastName;
  *aModifiedCard = PR_FALSE;

  nsString displayName;
  nsresult rv = aSenderCard->GetDisplayName(displayName);
  NS_ENSURE_SUCCESS(rv,rv);

  // we already have a display name, so don't do anything
  if (!displayName.IsEmpty())
    return NS_OK;

  aSenderCard->SetDisplayName(NS_ConvertUTF8toUTF16(aFullName));
  *aModifiedCard = PR_TRUE;

  rv = SplitFullName(aFullName, firstName, lastName);
  if (NS_SUCCEEDED(rv))
  {
    aSenderCard->SetFirstName(NS_ConvertUTF8toUTF16(firstName));
    
    if (!lastName.IsEmpty())
      aSenderCard->SetLastName(NS_ConvertUTF8toUTF16(lastName));
  }
  return rv;
}

nsresult nsAbAddressCollecter::SplitFullName(const nsACString &aFullName, nsACString &aFirstName, nsACString &aLastName)
{
  nsCString lastName;
  nsCString firstName;

  int index = nsCString(aFullName).RFindChar(' ');
  if (index != -1) 
  {
    nsCString(aFullName).Right(lastName, aFullName.Length() - (index + 1));
    nsCString(aFullName).Left(firstName, index);
 
    aLastName = lastName;
    aFirstName = firstName;

  }
  return NS_OK;
}

NS_IMETHODIMP nsAbAddressCollecter::Observe(nsISupports *aSubject, const char *aTopic, const PRUnichar *aData)
{
  nsCOMPtr<nsIPrefBranch2> pPrefBranchInt = do_QueryInterface(aSubject);
  NS_ASSERTION(pPrefBranchInt, "failed to get prefs");

  nsresult rv;
  nsCString prefVal;
  pPrefBranchInt->GetCharPref(PREF_MAIL_COLLECT_ADDRESSBOOK, getter_Copies(prefVal));
  rv = SetAbURI(prefVal.IsEmpty() ? nsDependentCString(kPersonalAddressbookUri) : prefVal);
  NS_ASSERTION(NS_SUCCEEDED(rv),"failed to change collected ab");
  return NS_OK;
}

nsresult nsAbAddressCollecter::Init(void)
{
  nsresult rv;
  nsCOMPtr<nsIPrefBranch2> pPrefBranchInt(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv,rv);

  rv = pPrefBranchInt->AddObserver(PREF_MAIL_COLLECT_ADDRESSBOOK, this, PR_FALSE);

  nsCString prefVal;
  pPrefBranchInt->GetCharPref(PREF_MAIL_COLLECT_ADDRESSBOOK, getter_Copies(prefVal));
  return SetAbURI(prefVal.IsEmpty() ? nsDependentCString(kPersonalAddressbookUri) : prefVal);
}

nsresult nsAbAddressCollecter::AddCardToAddressBook(nsIAbCard *card)
{
  NS_ENSURE_ARG_POINTER(card);

  nsCOMPtr <nsIAbCard> addedCard;
  if (m_directory)
    return m_directory->AddCard(card, getter_AddRefs(addedCard));

  return NS_ERROR_FAILURE;
}

nsresult nsAbAddressCollecter::SetAbURI(const nsACString &aURI)
{
  if (aURI == m_abURI)
    return NS_OK;

  if (m_database) {
    m_database->Commit(nsAddrDBCommitType::kSessionCommit);
    m_database->Close(PR_FALSE);
    m_database = nsnull;
  }
  
  m_directory = nsnull;
  m_abURI = aURI;

  nsresult rv;
  nsCOMPtr<nsIAddrBookSession> abSession = do_GetService(NS_ADDRBOOKSESSION_CONTRACTID, &rv); 
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAddressBook> addressBook = do_GetService(NS_ADDRESSBOOK_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  rv = addressBook->GetAbDatabaseFromURI(m_abURI.get(), getter_AddRefs(m_database));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIRDFService> rdfService = do_GetService("@mozilla.org/rdf/rdf-service;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr <nsIRDFResource> resource;
  rv = rdfService->GetResource(m_abURI, getter_AddRefs(resource));
  NS_ENSURE_SUCCESS(rv, rv);

  m_directory = do_QueryInterface(resource, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  return rv;
}
