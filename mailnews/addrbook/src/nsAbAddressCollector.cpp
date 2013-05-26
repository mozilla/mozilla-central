/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "msgCore.h"  // for pre-compiled headers
#include "nsISimpleEnumerator.h"

#include "nsIAbCard.h"
#include "nsAbBaseCID.h"
#include "nsAbAddressCollector.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "nsIMsgHeaderParser.h"
#include "nsStringGlue.h"
#include "prmem.h"
#include "nsServiceManagerUtils.h"
#include "nsComponentManagerUtils.h"
#include "nsIAbManager.h"

NS_IMPL_ISUPPORTS2(nsAbAddressCollector, nsIAbAddressCollector, nsIObserver)

#define PREF_MAIL_COLLECT_ADDRESSBOOK "mail.collect_addressbook"

nsAbAddressCollector::nsAbAddressCollector()
{
}

nsAbAddressCollector::~nsAbAddressCollector()
{
  nsresult rv;
  nsCOMPtr<nsIPrefBranch> pPrefBranchInt(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
  if (NS_SUCCEEDED(rv))
    pPrefBranchInt->RemoveObserver(PREF_MAIL_COLLECT_ADDRESSBOOK, this);
}

/**
 * Returns the first card found with a given property name/value pair. This
 * returns an already addrefed pointer to the card if the card is found.
 */
already_AddRefed<nsIAbCard>
nsAbAddressCollector::GetCardFromProperty(const char *aName,
                                          const nsACString &aValue,
                                          nsIAbDirectory **aDirectory)
{
  nsresult rv;
  nsCOMPtr<nsIAbManager> abManager(do_GetService(NS_ABMANAGER_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, nullptr);

  nsCOMPtr<nsISimpleEnumerator> enumerator;
  rv = abManager->GetDirectories(getter_AddRefs(enumerator));
  NS_ENSURE_SUCCESS(rv, nullptr);

  bool hasMore;
  nsCOMPtr<nsISupports> supports;
  nsCOMPtr<nsIAbDirectory> directory;
  nsCOMPtr<nsIAbCard> result;
  while (NS_SUCCEEDED(enumerator->HasMoreElements(&hasMore)) && hasMore)
  {
    rv = enumerator->GetNext(getter_AddRefs(supports));
    NS_ENSURE_SUCCESS(rv, nullptr);

    directory = do_QueryInterface(supports, &rv);
    if (NS_FAILED(rv))
      continue;

    // Some implementations may return NS_ERROR_NOT_IMPLEMENTED here,
    // so just catch the value and continue.
    if (NS_FAILED(directory->GetCardFromProperty(aName, aValue, true,
                                                 getter_AddRefs(result))))
      continue;

    if (result)
    {
      if (aDirectory)
        directory.forget(aDirectory);
      return result.forget();
    }
  }
  return nullptr;
}

NS_IMETHODIMP
nsAbAddressCollector::CollectAddress(const nsACString &aAddresses,
                                     bool aCreateCard,
                                     uint32_t aSendFormat)
{
  // If we've not got a valid directory, no point in going any further
  if (!mDirectory)
    return NS_OK;

  // note that we're now setting the whole recipient list,
  // not just the pretty name of the first recipient.
  uint32_t numAddresses;
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

  for (uint32_t i = 0; i < numAddresses; i++)
  {
    nsDependentCString curAddress(curAddressPtr);
    curAddressPtr += curAddress.Length() + 1;

    nsCString unquotedName;
    rv = pHeader->UnquotePhraseOrAddr(curNamePtr, false,
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
                         false);
  }

  PR_FREEIF(addresses);
  PR_FREEIF(names);
  return NS_OK;
}

NS_IMETHODIMP
nsAbAddressCollector::CollectSingleAddress(const nsACString &aEmail,
                                           const nsACString &aDisplayName,
                                           bool aCreateCard,
                                           uint32_t aSendFormat,
                                           bool aSkipCheckExisting)
{
  if (!mDirectory)
    return NS_OK;

  nsresult rv;
  nsCOMPtr<nsIAbCard> card;
  bool emailAddressIn2ndEmailColumn = false;

  nsCOMPtr<nsIAbDirectory> originDirectory;

  if (!aSkipCheckExisting)
  {
    card = GetCardFromProperty(kPriEmailProperty, aEmail,
                               getter_AddRefs(originDirectory));
    // We've not found a card, but is this address actually in the additional
    // email column?
    if (!card)
    {
      card = GetCardFromProperty(k2ndEmailProperty, aEmail,
                                 getter_AddRefs(originDirectory));
      if (card)
        emailAddressIn2ndEmailColumn = true;
    }
  }

  if (!card && (aCreateCard || aSkipCheckExisting))
  {
    card = do_CreateInstance(NS_ABCARDPROPERTY_CONTRACTID, &rv);
    if (NS_SUCCEEDED(rv) && card)
    {
      // Set up the fields for the new card.
      SetNamesForCard(card, aDisplayName);
      AutoCollectScreenName(card, aEmail);

      if (NS_SUCCEEDED(card->SetPrimaryEmail(NS_ConvertUTF8toUTF16(aEmail))))
      {
        card->SetPropertyAsUint32(kPreferMailFormatProperty, aSendFormat);

        nsCOMPtr<nsIAbCard> addedCard;
        rv = mDirectory->AddCard(card, getter_AddRefs(addedCard));
        NS_ASSERTION(NS_SUCCEEDED(rv), "failed to add card");
      }
    }
  }
  else if (card && !emailAddressIn2ndEmailColumn && originDirectory)
  {
    // It could be that the origin directory is read-only, so don't try and
    // write to it if it is.
    bool readOnly;
    rv = originDirectory->GetReadOnly(&readOnly);
    NS_ENSURE_SUCCESS(rv, rv);

    if (readOnly)
      return NS_OK;

    // address is already in the AB, so update the names
    bool modifiedCard = false;

    nsString displayName;
    card->GetDisplayName(displayName);
    // If we already have a display name, don't set the names on the card.
    if (displayName.IsEmpty() && !aDisplayName.IsEmpty())
      modifiedCard = SetNamesForCard(card, aDisplayName);

    if (aSendFormat != nsIAbPreferMailFormat::unknown)
    {
      uint32_t currentFormat;
      rv = card->GetPropertyAsUint32(kPreferMailFormatProperty,
                                     &currentFormat);
      NS_ASSERTION(NS_SUCCEEDED(rv), "failed to get preferred mail format");

      // we only want to update the AB if the current format is unknown
      if (currentFormat == nsIAbPreferMailFormat::unknown &&
          NS_SUCCEEDED(card->SetPropertyAsUint32(kPreferMailFormatProperty,
                                                 aSendFormat)))
        modifiedCard = true;
    }

    if (modifiedCard)
      originDirectory->ModifyCard(card);
  }

  return NS_OK;
}

// Works out the screen name to put on the card for some well-known addresses
void
nsAbAddressCollector::AutoCollectScreenName(nsIAbCard *aCard,
                                            const nsACString &aEmail)
{
  if (!aCard)
    return;

  int32_t atPos = aEmail.FindChar('@');
  if (atPos == -1)
    return;

  const nsACString& domain = Substring(aEmail, atPos + 1);

  if (domain.IsEmpty())
    return;
  // username in 
  // username@aol.com (America Online)
  // username@cs.com (Compuserve)
  // username@netscape.net (Netscape webmail)
  // are all AIM screennames.  autocollect that info.
  if (domain.Equals("aol.com") || domain.Equals("cs.com") ||
      domain.Equals("netscape.net"))
    aCard->SetPropertyAsAUTF8String(kScreenNameProperty, Substring(aEmail, 0, atPos));
  else if (domain.Equals("gmail.com") || domain.Equals("googlemail.com"))
    aCard->SetPropertyAsAUTF8String(kGtalkProperty, Substring(aEmail, 0, atPos));
}

// Returns true if the card was modified successfully.
bool
nsAbAddressCollector::SetNamesForCard(nsIAbCard *aSenderCard,
                                      const nsACString &aFullName)
{
  nsCString firstName;
  nsCString lastName;
  bool modifiedCard = false;

  if (NS_SUCCEEDED(aSenderCard->SetDisplayName(NS_ConvertUTF8toUTF16(aFullName))))
    modifiedCard = true;

  // Now split up the full name.
  SplitFullName(nsCString(aFullName), firstName, lastName);

  if (!firstName.IsEmpty() &&
      NS_SUCCEEDED(aSenderCard->SetFirstName(NS_ConvertUTF8toUTF16(firstName))))
    modifiedCard = true;

  if (!lastName.IsEmpty() &&
      NS_SUCCEEDED(aSenderCard->SetLastName(NS_ConvertUTF8toUTF16(lastName))))
    modifiedCard = true;

  if (modifiedCard)
    aSenderCard->SetPropertyAsBool("PreferDisplayName", false);

  return modifiedCard;
}

// Splits the first and last name based on the space between them.
void
nsAbAddressCollector::SplitFullName(const nsCString &aFullName, nsCString &aFirstName,
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
NS_IMETHODIMP
nsAbAddressCollector::Observe(nsISupports *aSubject, const char *aTopic,
                              const PRUnichar *aData)
{
  nsCOMPtr<nsIPrefBranch> prefBranch = do_QueryInterface(aSubject);
  if (!prefBranch) {
    NS_ASSERTION(prefBranch, "failed to get prefs");
    return NS_OK;
  }

  SetUpAbFromPrefs(prefBranch);
  return NS_OK;
}

// Initialises the collector with the required items.
nsresult
nsAbAddressCollector::Init(void)
{
  nsresult rv;
  nsCOMPtr<nsIPrefBranch> prefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID,
                                                   &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = prefBranch->AddObserver(PREF_MAIL_COLLECT_ADDRESSBOOK, this, false);
  NS_ENSURE_SUCCESS(rv, rv);

  SetUpAbFromPrefs(prefBranch);
  return NS_OK;
}

// Performs the necessary changes to set up the collector for the specified
// collected address book.
void
nsAbAddressCollector::SetUpAbFromPrefs(nsIPrefBranch *aPrefBranch)
{
  nsCString abURI;
  aPrefBranch->GetCharPref(PREF_MAIL_COLLECT_ADDRESSBOOK,
                           getter_Copies(abURI));

  if (abURI.IsEmpty())
    abURI.AssignLiteral(kPersonalAddressbookUri);

  if (abURI == mABURI)
    return;

  mDirectory = nullptr;
  mABURI = abURI;

  nsresult rv;
  nsCOMPtr<nsIAbManager> abManager(do_GetService(NS_ABMANAGER_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS_VOID(rv);

  rv = abManager->GetDirectory(mABURI, getter_AddRefs(mDirectory));
  NS_ENSURE_SUCCESS_VOID(rv);

  bool readOnly;
  rv = mDirectory->GetReadOnly(&readOnly);
  NS_ENSURE_SUCCESS_VOID(rv);

  // If the directory is read-only, we can't write to it, so just blank it out
  // here, and warn because we shouldn't hit this (UI is wrong).
  if (readOnly)
  {
    NS_ERROR("Address Collection book preferences is set to a read-only book. "
             "Address collection will not take place.");
    mDirectory = nullptr;
  }
}
