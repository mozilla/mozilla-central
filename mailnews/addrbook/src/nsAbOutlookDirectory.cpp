/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#include "nsAbOutlookDirectory.h"
#include "nsAbWinHelper.h"

#include "nsAbBaseCID.h"
#include "nsIAbCard.h"
#include "nsStringGlue.h"
#include "nsAbDirectoryQuery.h"
#include "nsIAbBooleanExpression.h"
#include "nsIAbManager.h"
#include "nsIAbMDBDirectory.h"
#include "nsAbQueryStringToExpression.h"
#include "nsAbUtils.h"
#include "nsEnumeratorUtils.h"
#include "nsServiceManagerUtils.h"
#include "nsComponentManagerUtils.h"
#include "prlog.h"
#include "prthread.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "nsCRTGlue.h"
#include "nsArrayUtils.h"
#include "nsArrayEnumerator.h"
#include "nsMsgUtils.h"

#ifdef PR_LOGGING
static PRLogModuleInfo* gAbOutlookDirectoryLog
    = PR_NewLogModule("nsAbOutlookDirectoryLog");
#endif

#define PRINTF(args) PR_LOG(gAbOutlookDirectoryLog, PR_LOG_DEBUG, args)

nsAbOutlookDirectory::nsAbOutlookDirectory(void)
  : nsAbDirProperty(),
  mCurrentQueryId(0), mSearchContext(-1),
  mAbWinType(nsAbWinType_Unknown), mMapiData(nullptr)
{
    mMapiData = new nsMapiEntry ;
    mProtector = PR_NewLock() ;
}

nsAbOutlookDirectory::~nsAbOutlookDirectory(void)
{
    if (mMapiData) { delete mMapiData ; }
    if (mProtector) { PR_DestroyLock(mProtector) ; }
}

NS_IMPL_ISUPPORTS_INHERITED3(nsAbOutlookDirectory, nsAbDirProperty,
                             nsIAbDirectoryQuery, nsIAbDirectorySearch,
                             nsIAbDirSearchListener)

NS_IMETHODIMP nsAbOutlookDirectory::Init(const char *aUri)
{
  nsresult rv = nsAbDirProperty::Init(aUri);
  NS_ENSURE_SUCCESS(rv, rv);

  nsAutoCString entry;
  nsAutoCString stub;

  mAbWinType = getAbWinType(kOutlookDirectoryScheme, mURINoQuery.get(), stub, entry);
  if (mAbWinType == nsAbWinType_Unknown) {
    PRINTF(("Huge problem URI=%s.\n", mURINoQuery));
    return NS_ERROR_INVALID_ARG;
  }
  nsAbWinHelperGuard mapiAddBook (mAbWinType);
  nsString prefix;
  nsAutoString unichars;
  ULONG objectType = 0;

  if (!mapiAddBook->IsOK())
    return NS_ERROR_FAILURE;

  mMapiData->Assign(entry);
  if (!mapiAddBook->GetPropertyLong(*mMapiData, PR_OBJECT_TYPE, objectType)) {
    PRINTF(("Cannot get type.\n"));
    return NS_ERROR_FAILURE;
  }
  if (!mapiAddBook->GetPropertyUString(*mMapiData, PR_DISPLAY_NAME_W, unichars)) {
    PRINTF(("Cannot get name.\n"));
    return NS_ERROR_FAILURE;
  }

  if (mAbWinType == nsAbWinType_Outlook)
    prefix.AssignLiteral("OP ");
  else
    prefix.AssignLiteral("OE ");
  prefix.Append(unichars);

  if (objectType == MAPI_DISTLIST) {
    m_IsMailList = true;
    SetDirName(unichars);
  }
  else {
    m_IsMailList = false;
    SetDirName(prefix);
  }

  return UpdateAddressList();
}

// nsIAbDirectory methods

NS_IMETHODIMP nsAbOutlookDirectory::GetDirType(int32_t *aDirType)
{
  NS_ENSURE_ARG_POINTER(aDirType);
  *aDirType = MAPIDirectory;
  return NS_OK;
}

NS_IMETHODIMP nsAbOutlookDirectory::GetURI(nsACString &aURI)
{
  if (mURI.IsEmpty())
    return NS_ERROR_NOT_INITIALIZED;

  aURI = mURI;
  return NS_OK;
}

NS_IMETHODIMP nsAbOutlookDirectory::GetChildNodes(nsISimpleEnumerator **aNodes)
{
  NS_ENSURE_ARG_POINTER(aNodes);

  *aNodes = nullptr;
    
  if (mIsQueryURI) {
    return NS_NewEmptyEnumerator(aNodes);
  }

  nsresult rv;
  nsCOMPtr<nsIMutableArray> nodeList(do_CreateInstance(NS_ARRAY_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = GetChildNodes(nodeList);
  NS_ENSURE_SUCCESS(rv, rv);

  return NS_NewArrayEnumerator(aNodes, nodeList);
}

NS_IMETHODIMP nsAbOutlookDirectory::GetChildCards(nsISimpleEnumerator **aCards)
{
  NS_ENSURE_ARG_POINTER(aCards);
  *aCards = nullptr;

  nsresult rv;
  nsCOMPtr<nsIMutableArray> cardList(do_CreateInstance(NS_ARRAY_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  mCardList.Clear();

  rv = mIsQueryURI ? StartSearch() : GetChildCards(cardList, nullptr);

  NS_ENSURE_SUCCESS(rv, rv);
  if (!m_AddressList)
  {
    m_AddressList = do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  // Fill the results array and update the card list
  // Also update the address list and notify any changes.
  uint32_t nbCards = 0;

  NS_NewArrayEnumerator(aCards, cardList);
  cardList->GetLength(&nbCards);

  nsCOMPtr<nsIAbCard> card;
  nsCOMPtr<nsIAbManager> abManager(do_GetService(NS_ABMANAGER_CONTRACTID,
                                   &rv));
  NS_ENSURE_SUCCESS(rv, rv);


  for (uint32_t i = 0; i < nbCards; ++i)
  {
    card = do_QueryElementAt(cardList, i, &rv);
    if (NS_FAILED(rv))
      continue;

    if (!mCardList.Get(card, nullptr))
    {
      // We are dealing with a new element (probably directly
      // added from Outlook), we may need to sync m_AddressList
      mCardList.Put(card, card);

      bool isMailList = false;

      rv = card->GetIsMailList(&isMailList);
      NS_ENSURE_SUCCESS(rv, rv);
      if (isMailList)
      {
        // We can have mailing lists only in folder,
        // we must add the directory to m_AddressList
        nsCString mailListUri;
        rv = card->GetMailListURI(getter_Copies(mailListUri));
        NS_ENSURE_SUCCESS(rv, rv);
        nsCOMPtr<nsIAbDirectory> mailList;
        rv = abManager->GetDirectory(mailListUri, getter_AddRefs(mailList));
        NS_ENSURE_SUCCESS(rv, rv);

        m_AddressList->AppendElement(mailList, false);
        NotifyItemAddition(mailList);
      }
      else if (m_IsMailList)
      {
        m_AddressList->AppendElement(card, false);
        NotifyItemAddition(card);
      }
    }
  }
  return rv;
}

NS_IMETHODIMP nsAbOutlookDirectory::GetIsQuery(bool *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  *aResult = mIsQueryURI;
  return NS_OK;
}

NS_IMETHODIMP nsAbOutlookDirectory::HasCard(nsIAbCard *aCard, bool *aHasCard)
{
  if (!aCard || !aHasCard)
    return NS_ERROR_NULL_POINTER;

  *aHasCard = mCardList.Get(aCard, nullptr);
  return NS_OK;
}

NS_IMETHODIMP nsAbOutlookDirectory::HasDirectory(nsIAbDirectory *aDirectory, bool *aHasDirectory)
{
  NS_ENSURE_ARG_POINTER(aDirectory);
  NS_ENSURE_ARG_POINTER(aHasDirectory);

  *aHasDirectory = false;

  uint32_t pos;
  if (m_AddressList && NS_SUCCEEDED(m_AddressList->IndexOf(0, aDirectory, &pos)))
      *aHasDirectory = true;

  return NS_OK;
}


static nsresult ExtractCardEntry(nsIAbCard *aCard, nsCString& aEntry)
{
  aEntry.Truncate();

  nsCString uri;
  aCard->GetPropertyAsAUTF8String("OutlookEntryURI", uri);

  // If we don't have a URI, uri will be empty. getAbWinType doesn't set
  // aEntry to anything if uri is empty, so it will be truncated, allowing us
  // to accept cards not initialized by us.
  nsAutoCString stub;
  getAbWinType(kOutlookCardScheme, uri.get(), stub, aEntry);
  return NS_OK;
}

static nsresult ExtractDirectoryEntry(nsIAbDirectory *aDirectory, nsCString& aEntry)
{
  aEntry.Truncate();
  nsCString uri;
  nsresult rv = aDirectory->GetURI(uri);
  NS_ENSURE_SUCCESS(rv, rv);

  nsAutoCString stub;
  nsAbWinType objType = getAbWinType(kOutlookDirectoryScheme, uri.get(), stub, aEntry);

  return NS_OK;
}

NS_IMETHODIMP nsAbOutlookDirectory::DeleteCards(nsIArray *aCardList)
{
    if (mIsQueryURI) { return NS_ERROR_NOT_IMPLEMENTED ; }
    if (!aCardList) { return NS_ERROR_NULL_POINTER ; }
    uint32_t nbCards = 0 ;
    nsresult retCode = NS_OK ;
    nsAbWinHelperGuard mapiAddBook (mAbWinType) ;

    if (!mapiAddBook->IsOK()) { return NS_ERROR_FAILURE ; }
    
    retCode = aCardList->GetLength(&nbCards);
    NS_ENSURE_SUCCESS(retCode, retCode) ;
    uint32_t i = 0 ;
    nsAutoCString entryString ;
    nsMapiEntry cardEntry ;

    for (i = 0 ; i < nbCards ; ++ i) {
        nsCOMPtr<nsIAbCard> card(do_QueryElementAt(aCardList, i, &retCode));
        NS_ENSURE_SUCCESS(retCode, retCode);

        retCode = ExtractCardEntry(card, entryString) ;
        if (NS_SUCCEEDED(retCode) && !entryString.IsEmpty()) {
            card->SetDirectoryId(EmptyCString());

            cardEntry.Assign(entryString) ;
            if (!mapiAddBook->DeleteEntry(*mMapiData, cardEntry)) {
                PRINTF(("Cannot delete card %s.\n", entryString.get())) ;
            }
            else {
                mCardList.Remove(card);
                if (m_IsMailList && m_AddressList) 
                {
                    uint32_t pos;
                    if (NS_SUCCEEDED(m_AddressList->IndexOf(0, card, &pos)))
                        m_AddressList->RemoveElementAt(pos);
                }
                retCode = NotifyItemDeletion(card);
                NS_ENSURE_SUCCESS(retCode, retCode) ;
            }
        }
        else {
            PRINTF(("Card doesn't belong in this directory.\n")) ;
        }
    }
    return NS_OK ;
}

NS_IMETHODIMP nsAbOutlookDirectory::DeleteDirectory(nsIAbDirectory *aDirectory)
{
    if (mIsQueryURI) { return NS_ERROR_NOT_IMPLEMENTED ; }
    if (!aDirectory) { return NS_ERROR_NULL_POINTER ; }
    nsresult retCode = NS_OK ;
    nsAbWinHelperGuard mapiAddBook (mAbWinType) ;
    nsAutoCString entryString ;

    if (!mapiAddBook->IsOK()) { return NS_ERROR_FAILURE ; }
    retCode = ExtractDirectoryEntry(aDirectory, entryString) ;
    if (NS_SUCCEEDED(retCode) && !entryString.IsEmpty()) {
        nsMapiEntry directoryEntry ;

        directoryEntry.Assign(entryString) ;
        if (!mapiAddBook->DeleteEntry(*mMapiData, directoryEntry)) {
            PRINTF(("Cannot delete directory %s.\n", entryString.get())) ;
        }
        else {
            uint32_t pos;
            if (m_AddressList && NS_SUCCEEDED(m_AddressList->IndexOf(0, aDirectory, &pos)))
                m_AddressList->RemoveElementAt(pos);

            retCode = NotifyItemDeletion(aDirectory);
            NS_ENSURE_SUCCESS(retCode, retCode);
        }
    }
    else {
        PRINTF(("Directory doesn't belong to this folder.\n")) ;
    }
    return retCode ;
}

NS_IMETHODIMP nsAbOutlookDirectory::AddCard(nsIAbCard *aData, nsIAbCard **addedCard)
{
    if (mIsQueryURI)
      return NS_ERROR_NOT_IMPLEMENTED;

    NS_ENSURE_ARG_POINTER(aData);

    nsresult retCode = NS_OK ;
    bool hasCard = false ;
    
    retCode = HasCard(aData, &hasCard) ;
    NS_ENSURE_SUCCESS(retCode, retCode) ;
    if (hasCard) {
        PRINTF(("Has card.\n")) ;
        NS_IF_ADDREF(*addedCard = aData);
        return NS_OK ; 
    }
    retCode = CreateCard(aData, addedCard) ;
    NS_ENSURE_SUCCESS(retCode, retCode) ;
    
    mCardList.Put(*addedCard, *addedCard);

    if (!m_AddressList)
    {
        m_AddressList = do_CreateInstance(NS_ARRAY_CONTRACTID, &retCode);
        NS_ENSURE_SUCCESS(retCode, retCode);
    }

    if (m_IsMailList)
        m_AddressList->AppendElement(*addedCard, false);
    NotifyItemAddition(*addedCard) ;
    return retCode ;
}

NS_IMETHODIMP nsAbOutlookDirectory::DropCard(nsIAbCard *aData, bool needToCopyCard)
{
    nsCOMPtr <nsIAbCard> addedCard;
    return AddCard(aData, getter_AddRefs(addedCard));
}

NS_IMETHODIMP nsAbOutlookDirectory::AddMailList(nsIAbDirectory *aMailList, nsIAbDirectory **addedList)
{
  if (mIsQueryURI)
    return NS_ERROR_NOT_IMPLEMENTED;
  NS_ENSURE_ARG_POINTER(aMailList);
  NS_ENSURE_ARG_POINTER(addedList);
  if (m_IsMailList)
    return NS_OK;
  nsAbWinHelperGuard mapiAddBook (mAbWinType);
  nsAutoCString entryString;
  nsMapiEntry newEntry;
  bool didCopy = false;

  if (!mapiAddBook->IsOK())
    return NS_ERROR_FAILURE;
  nsresult rv = ExtractDirectoryEntry(aMailList, entryString);
  if (NS_SUCCEEDED(rv) && !entryString.IsEmpty())
  {
      nsMapiEntry sourceEntry;

      sourceEntry.Assign(entryString);
      mapiAddBook->CopyEntry(*mMapiData, sourceEntry, newEntry);
  }
  if (newEntry.mByteCount == 0)
  {
    if (!mapiAddBook->CreateDistList(*mMapiData, newEntry))
        return NS_ERROR_FAILURE;
  }
  else {
    didCopy = true;
  }
  newEntry.ToString(entryString);
  nsAutoCString uri;

  buildAbWinUri(kOutlookDirectoryScheme, mAbWinType, uri);
  uri.Append(entryString);

  nsCOMPtr<nsIAbManager> abManager(do_GetService(NS_ABMANAGER_CONTRACTID,
                                   &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAbDirectory> newList;
  rv = abManager->GetDirectory(uri, getter_AddRefs(newList));
  NS_ENSURE_SUCCESS(rv, rv);

  if (!didCopy)
  {
    rv = newList->CopyMailList(aMailList);
    NS_ENSURE_SUCCESS(rv, rv);
    rv = newList->EditMailListToDatabase(nullptr);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  if (!m_AddressList)
  {
    m_AddressList = do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
  }
  m_AddressList->AppendElement(newList, false);
  NotifyItemAddition(newList);
  NS_IF_ADDREF(*addedList = newList);

  return rv;
}

NS_IMETHODIMP nsAbOutlookDirectory::EditMailListToDatabase(nsIAbCard *listCard)
{
  if (mIsQueryURI)
    return NS_ERROR_NOT_IMPLEMENTED;

  nsresult rv;
  nsString name;
  nsAbWinHelperGuard mapiAddBook(mAbWinType);

  if (!mapiAddBook->IsOK())
    return NS_ERROR_FAILURE;

  rv = GetDirName(name);
  NS_ENSURE_SUCCESS(rv, rv);

  if (!mapiAddBook->SetPropertyUString(*mMapiData, PR_DISPLAY_NAME_W,
                                       name.get()))
    return NS_ERROR_FAILURE;

  return CommitAddressList();
}

struct OutlookTableAttr
{
    const char *mOuterName ;
    ULONG mMapiProp ;
} ;

// Here, we are forced to use the Ascii versions of the properties
// instead of the widechar ones, because the content restriction
// operators do not work on unicode strings in mapi.
static const OutlookTableAttr OutlookTableStringToProp [] = 
{
    {kFirstNameProperty, PR_GIVEN_NAME_A},
    {kLastNameProperty, PR_SURNAME_A},
    {kDisplayNameProperty, PR_DISPLAY_NAME_A},
    {kNicknameProperty, PR_NICKNAME_A},
    {kPriEmailProperty, PR_EMAIL_ADDRESS_A},
    {kWorkPhoneProperty, PR_BUSINESS_TELEPHONE_NUMBER_A},
    {kHomePhoneProperty, PR_HOME_TELEPHONE_NUMBER_A},
    {kFaxProperty, PR_BUSINESS_FAX_NUMBER_A},
    {kPagerProperty, PR_PAGER_TELEPHONE_NUMBER_A},
    {kCellularProperty, PR_MOBILE_TELEPHONE_NUMBER_A},
    {kHomeAddressProperty, PR_HOME_ADDRESS_STREET_A},
    {kHomeCityProperty, PR_HOME_ADDRESS_CITY_A},
    {kHomeStateProperty, PR_HOME_ADDRESS_STATE_OR_PROVINCE_A},
    {kHomeZipCodeProperty, PR_HOME_ADDRESS_POSTAL_CODE_A},
    {kHomeCountryProperty, PR_HOME_ADDRESS_COUNTRY_A},
    {kWorkAddressProperty, PR_BUSINESS_ADDRESS_STREET_A}, 
    {kWorkCityProperty, PR_BUSINESS_ADDRESS_CITY_A},
    {kWorkStateProperty, PR_BUSINESS_ADDRESS_STATE_OR_PROVINCE_A},
    {kWorkZipCodeProperty, PR_BUSINESS_ADDRESS_POSTAL_CODE_A},
    {kWorkCountryProperty, PR_BUSINESS_ADDRESS_COUNTRY_A},
    {kJobTitleProperty, PR_TITLE_A},
    {kDepartmentProperty, PR_DEPARTMENT_NAME_A},
    {kCompanyProperty, PR_COMPANY_NAME_A},
    {kWorkWebPageProperty, PR_BUSINESS_HOME_PAGE_A},
    {kHomeWebPageProperty, PR_PERSONAL_HOME_PAGE_A},
    // For the moment, we don't support querying on the birthday
    // sub-elements.
#if 0
    {kBirthYearProperty, PR_BIRTHDAY},
    {kBirthMonthProperty, PR_BIRTHDAY}, 
    {kBirthDayProperty, PR_BIRTHDAY},
#endif // 0
    {kNotesProperty, PR_COMMENT_A}
} ;

static const uint32_t OutlookTableNbProps = sizeof(OutlookTableStringToProp) /
                                            sizeof(OutlookTableStringToProp [0]) ;

static ULONG findPropertyTag(const char *aName) {
    uint32_t i = 0 ;
    
    for (i = 0 ; i < OutlookTableNbProps ; ++ i) {
        if (strcmp(aName, OutlookTableStringToProp [i].mOuterName) == 0) {
            return OutlookTableStringToProp [i].mMapiProp ;
        }
    }
    return 0 ;
}

static nsresult BuildRestriction(nsIAbBooleanConditionString *aCondition, 
                                 SRestriction& aRestriction,
                                 bool& aSkipItem)
{
    if (!aCondition) { return NS_ERROR_NULL_POINTER ; }
    aSkipItem = false ;
    nsAbBooleanConditionType conditionType = 0 ;
    nsresult retCode = NS_OK ;
    nsCString name;
    nsString value;
    ULONG propertyTag = 0 ;
    nsAutoCString valueAscii ;
    
    retCode = aCondition->GetCondition(&conditionType) ;
    NS_ENSURE_SUCCESS(retCode, retCode) ;
    retCode = aCondition->GetName(getter_Copies(name)) ;
    NS_ENSURE_SUCCESS(retCode, retCode) ;
    retCode = aCondition->GetValue(getter_Copies(value)) ;
    NS_ENSURE_SUCCESS(retCode, retCode) ;
    LossyCopyUTF16toASCII(value, valueAscii);
    propertyTag = findPropertyTag(name.get()) ;
    if (propertyTag == 0) {
        aSkipItem = true ;
        return retCode ;
    }
    switch (conditionType) {
    case nsIAbBooleanConditionTypes::Exists :
        aRestriction.rt = RES_EXIST ;
        aRestriction.res.resExist.ulPropTag = propertyTag ;
        break ;
    case nsIAbBooleanConditionTypes::DoesNotExist :
        aRestriction.rt = RES_NOT ;
        aRestriction.res.resNot.lpRes = new SRestriction ;
        aRestriction.res.resNot.lpRes->rt = RES_EXIST ;
        aRestriction.res.resNot.lpRes->res.resExist.ulPropTag = propertyTag ;
        break ;
    case nsIAbBooleanConditionTypes::Contains :
        aRestriction.rt = RES_CONTENT ;
        aRestriction.res.resContent.ulFuzzyLevel = FL_SUBSTRING | FL_LOOSE ;
        aRestriction.res.resContent.ulPropTag = propertyTag ;
        aRestriction.res.resContent.lpProp = new SPropValue ;
        aRestriction.res.resContent.lpProp->ulPropTag = propertyTag ;
        aRestriction.res.resContent.lpProp->Value.lpszA = strdup(valueAscii.get()) ;
        break ;
    case nsIAbBooleanConditionTypes::DoesNotContain :
        aRestriction.rt = RES_NOT ;
        aRestriction.res.resNot.lpRes = new SRestriction ;
        aRestriction.res.resNot.lpRes->rt = RES_CONTENT ;
        aRestriction.res.resNot.lpRes->res.resContent.ulFuzzyLevel = FL_SUBSTRING | FL_LOOSE ;
        aRestriction.res.resNot.lpRes->res.resContent.ulPropTag = propertyTag ;
        aRestriction.res.resNot.lpRes->res.resContent.lpProp = new SPropValue ;
        aRestriction.res.resNot.lpRes->res.resContent.lpProp->ulPropTag = propertyTag ;
        aRestriction.res.resNot.lpRes->res.resContent.lpProp->Value.lpszA = strdup(valueAscii.get()) ;
        break ;
    case nsIAbBooleanConditionTypes::Is :
        aRestriction.rt = RES_CONTENT ;
        aRestriction.res.resContent.ulFuzzyLevel = FL_FULLSTRING | FL_LOOSE ;
        aRestriction.res.resContent.ulPropTag = propertyTag ;
        aRestriction.res.resContent.lpProp = new SPropValue ;
        aRestriction.res.resContent.lpProp->ulPropTag = propertyTag ;
        aRestriction.res.resContent.lpProp->Value.lpszA = strdup(valueAscii.get()) ;
        break ;
    case nsIAbBooleanConditionTypes::IsNot :
        aRestriction.rt = RES_NOT ;
        aRestriction.res.resNot.lpRes = new SRestriction ;
        aRestriction.res.resNot.lpRes->rt = RES_CONTENT ;
        aRestriction.res.resNot.lpRes->res.resContent.ulFuzzyLevel = FL_FULLSTRING | FL_LOOSE ;
        aRestriction.res.resNot.lpRes->res.resContent.ulPropTag = propertyTag ;
        aRestriction.res.resNot.lpRes->res.resContent.lpProp = new SPropValue ;
        aRestriction.res.resNot.lpRes->res.resContent.lpProp->ulPropTag = propertyTag ;
        aRestriction.res.resNot.lpRes->res.resContent.lpProp->Value.lpszA = strdup(valueAscii.get()) ;
        break ;
    case nsIAbBooleanConditionTypes::BeginsWith :
        aRestriction.rt = RES_CONTENT ;
        aRestriction.res.resContent.ulFuzzyLevel = FL_PREFIX | FL_LOOSE ;
        aRestriction.res.resContent.ulPropTag = propertyTag ;
        aRestriction.res.resContent.lpProp = new SPropValue ;
        aRestriction.res.resContent.lpProp->ulPropTag = propertyTag ;
        aRestriction.res.resContent.lpProp->Value.lpszA = strdup(valueAscii.get()) ;
        break ;
    case nsIAbBooleanConditionTypes::EndsWith :
        // This condition should be implemented through regular expressions,
        // but MAPI doesn't match them correctly.
#if 0
        aRestriction.rt = RES_PROPERTY ;
        aRestriction.res.resProperty.relop = RELOP_RE ;
        aRestriction.res.resProperty.ulPropTag = propertyTag ;
        aRestriction.res.resProperty.lpProp = new SPropValue ;
        aRestriction.res.resProperty.lpProp->ulPropTag = propertyTag ;
        aRestriction.res.resProperty.lpProp->Value.lpszA = strdup(valueAscii.get()) ;
#else
        aSkipItem = true ;
#endif // 0
        break ;
    case nsIAbBooleanConditionTypes::SoundsLike :
        // This condition cannot be implemented in MAPI.
        aSkipItem = true ;
        break ;
    case nsIAbBooleanConditionTypes::RegExp :
        // This condition should be implemented this way, but the following
        // code will never match (through MAPI's fault).
#if 0
        aRestriction.rt = RES_PROPERTY ;
        aRestriction.res.resProperty.relop = RELOP_RE ;
        aRestriction.res.resProperty.ulPropTag = propertyTag ;
        aRestriction.res.resProperty.lpProp = new SPropValue ;
        aRestriction.res.resProperty.lpProp->ulPropTag = propertyTag ;
        aRestriction.res.resProperty.lpProp->Value.lpszA = strdup(valueAscii.get()) ;
#else
        aSkipItem = true ;
#endif // 0
        break ;
    case nsIAbBooleanConditionTypes::LessThan :
        aRestriction.rt = RES_PROPERTY ;
        aRestriction.res.resProperty.relop = RELOP_LT ;
        aRestriction.res.resProperty.ulPropTag = propertyTag ;
        aRestriction.res.resProperty.lpProp = new SPropValue ;
        aRestriction.res.resProperty.lpProp->ulPropTag = propertyTag ;
        aRestriction.res.resProperty.lpProp->Value.lpszA = strdup(valueAscii.get()) ;
        break ;
    case nsIAbBooleanConditionTypes::GreaterThan :
        aRestriction.rt = RES_PROPERTY ;
        aRestriction.res.resProperty.relop = RELOP_GT ;
        aRestriction.res.resProperty.ulPropTag = propertyTag ;
        aRestriction.res.resProperty.lpProp = new SPropValue ;
        aRestriction.res.resProperty.lpProp->ulPropTag = propertyTag ;
        aRestriction.res.resProperty.lpProp->Value.lpszA = strdup(valueAscii.get()) ;
        break ;
    default :
        aSkipItem = true ;
        break ;
    }
    return retCode ;
}

static nsresult BuildRestriction(nsIAbBooleanExpression *aLevel, 
                                 SRestriction& aRestriction)
{
    if (!aLevel) { return NS_ERROR_NULL_POINTER ; }
    aRestriction.rt = RES_COMMENT ;
    nsresult retCode = NS_OK ;
    nsAbBooleanOperationType operationType = 0 ;
    uint32_t nbExpressions = 0 ;
    nsCOMPtr<nsIArray> expressions;

    retCode = aLevel->GetOperation(&operationType);
    NS_ENSURE_SUCCESS(retCode, retCode);
    retCode = aLevel->GetExpressions(getter_AddRefs(expressions));
    NS_ENSURE_SUCCESS(retCode, retCode);
    retCode = expressions->GetLength(&nbExpressions);
    NS_ENSURE_SUCCESS(retCode, retCode);
    if (nbExpressions == 0) { 
        PRINTF(("Error, no expressions.\n")) ;
        return NS_OK ;
    }
    if (operationType == nsIAbBooleanOperationTypes::NOT && nbExpressions != 1) {
        PRINTF(("Error, unary operation NOT with multiple operands.\n")) ;
        return NS_OK ;
    }
    LPSRestriction restrictionArray = new SRestriction [nbExpressions] ;
    uint32_t realNbExpressions = 0 ;
    bool skipItem = false ;
    uint32_t i = 0 ;

    nsCOMPtr<nsIAbBooleanConditionString> condition;
    nsCOMPtr<nsIAbBooleanExpression> subExpression;

    for (i = 0; i < nbExpressions; ++i) {
      condition = do_QueryElementAt(expressions, i, &retCode);

      if (NS_SUCCEEDED(retCode)) {
        retCode = BuildRestriction(condition, *restrictionArray, skipItem);
        if (NS_SUCCEEDED(retCode)) {
          if (!skipItem) {
            ++restrictionArray;
            ++realNbExpressions;
          }
        }
        else
          PRINTF(("Cannot build restriction for item %d %08x.\n", i, retCode));
      }
      else { 
        subExpression = do_QueryElementAt(expressions, i, &retCode);

        if (NS_SUCCEEDED(retCode)) {
          retCode = BuildRestriction(subExpression, *restrictionArray);
          if (NS_SUCCEEDED(retCode)) {
            if (restrictionArray->rt != RES_COMMENT) {
              ++restrictionArray;
              ++realNbExpressions;
            }
          }
        }
        else
          PRINTF(("Cannot get interface for item %d %08x.\n", i, retCode));
      }
    }

    restrictionArray -= realNbExpressions ;
    if (realNbExpressions > 1) {
        if (operationType == nsIAbBooleanOperationTypes::OR) {
            aRestriction.rt = RES_OR ;
            aRestriction.res.resOr.lpRes = restrictionArray ;
            aRestriction.res.resOr.cRes = realNbExpressions ;
        }
        else if (operationType == nsIAbBooleanOperationTypes::AND) {
            aRestriction.rt = RES_AND ;
            aRestriction.res.resAnd.lpRes = restrictionArray ;
            aRestriction.res.resAnd.cRes = realNbExpressions ;
        }
        else {
            PRINTF(("Unsupported operation %d.\n", operationType)) ;
        }
    }
    else if (realNbExpressions == 1) {
        if (operationType == nsIAbBooleanOperationTypes::NOT) {
            aRestriction.rt = RES_NOT ;
            // This copy is to ensure that every NOT restriction is being 
            // allocated by new and not new[] (see destruction of restriction)
            aRestriction.res.resNot.lpRes = new SRestriction ;
            memcpy(aRestriction.res.resNot.lpRes, restrictionArray, sizeof(SRestriction)) ;
        }
        else {
            // Case where the restriction array is redundant,
            // we need to fill the restriction directly.
            memcpy(&aRestriction, restrictionArray, sizeof(SRestriction)) ;
        }
        delete [] restrictionArray ;
    }
    if (aRestriction.rt == RES_COMMENT) {
        // This means we haven't really built any useful expression
        delete [] restrictionArray ;
    }
    return NS_OK ;
}

static nsresult BuildRestriction(nsIAbDirectoryQueryArguments *aArguments, 
                                 SRestriction& aRestriction)
{
    if (!aArguments) { return NS_ERROR_NULL_POINTER ; }
    nsresult retCode = NS_OK ;
    nsCOMPtr<nsIAbBooleanExpression> booleanQuery ;

    retCode = aArguments->GetExpression(getter_AddRefs(booleanQuery)) ;
    NS_ENSURE_SUCCESS(retCode, retCode) ;
    retCode = BuildRestriction(booleanQuery, aRestriction) ;
    return retCode ;
}

static void DestroyRestriction(SRestriction& aRestriction)
{
    switch(aRestriction.rt) {
    case RES_AND :
    case RES_OR :
        {
            for (ULONG i = 0 ; i < aRestriction.res.resAnd.cRes ; ++ i) {
                DestroyRestriction(aRestriction.res.resAnd.lpRes [i]) ;
            }
            delete [] aRestriction.res.resAnd.lpRes ;
        }
        break ;
    case RES_COMMENT :
        break ;
    case RES_CONTENT :
        if (PROP_TYPE(aRestriction.res.resContent.ulPropTag) == PT_UNICODE) {
            NS_Free(aRestriction.res.resContent.lpProp->Value.lpszW) ;
        }
        else if (PROP_TYPE(aRestriction.res.resContent.ulPropTag) == PT_STRING8) {
            NS_Free(aRestriction.res.resContent.lpProp->Value.lpszA) ;
        }
        delete aRestriction.res.resContent.lpProp ;
        break ;
    case RES_EXIST :
        break ;
    case RES_NOT :
        DestroyRestriction(*aRestriction.res.resNot.lpRes) ;
        delete aRestriction.res.resNot.lpRes ;
        break ;
    case RES_BITMASK :
    case RES_COMPAREPROPS :
        break ;
    case RES_PROPERTY :
        if (PROP_TYPE(aRestriction.res.resProperty.ulPropTag) == PT_UNICODE) {
            NS_Free(aRestriction.res.resProperty.lpProp->Value.lpszW) ;
        }
        else if (PROP_TYPE(aRestriction.res.resProperty.ulPropTag) == PT_STRING8) {
            NS_Free(aRestriction.res.resProperty.lpProp->Value.lpszA) ;
        }
        delete aRestriction.res.resProperty.lpProp ;
    case RES_SIZE :
    case RES_SUBRESTRICTION :
        break ;
    }
}

struct QueryThreadArgs 
{
    nsAbOutlookDirectory *mThis ;
    SRestriction mRestriction ;
    nsCOMPtr<nsIAbDirSearchListener> mListener ;
    int32_t mResultLimit ;
    int32_t mTimeout ;
    int32_t mThreadId ;
} ;

static void QueryThreadFunc(void *aArguments)
{
    QueryThreadArgs *arguments = reinterpret_cast<QueryThreadArgs *>(aArguments) ;

    if (!aArguments) { return ; }
    arguments->mThis->ExecuteQuery(arguments->mRestriction, arguments->mListener,
                                   arguments->mResultLimit, arguments->mTimeout,
                                   arguments->mThreadId) ;
    DestroyRestriction(arguments->mRestriction) ;
    delete arguments ;
}

NS_IMETHODIMP nsAbOutlookDirectory::DoQuery(nsIAbDirectory *aDirectory,
                                            nsIAbDirectoryQueryArguments *aArguments,
                                            nsIAbDirSearchListener *aListener,
                                            int32_t aResultLimit, int32_t aTimeout,
                                            int32_t *aReturnValue)
{
  if (!aArguments || !aListener || !aReturnValue)  { 
    return NS_ERROR_NULL_POINTER;
  }
  *aReturnValue = -1;
    
  QueryThreadArgs *threadArgs = new QueryThreadArgs;
  PRThread *newThread = nullptr;

  if (!threadArgs)
    return NS_ERROR_OUT_OF_MEMORY;

  nsresult rv = BuildRestriction(aArguments, threadArgs->mRestriction);
  NS_ENSURE_SUCCESS(rv, rv);

  threadArgs->mThis = this;
  threadArgs->mListener = aListener;
  threadArgs->mResultLimit = aResultLimit;
  threadArgs->mTimeout = aTimeout;

  PR_Lock(mProtector);
  *aReturnValue = ++mCurrentQueryId;
  PR_Unlock(mProtector);

  threadArgs->mThreadId = *aReturnValue;
  newThread = PR_CreateThread(PR_USER_THREAD,
                              QueryThreadFunc,
                              threadArgs,
                              PR_PRIORITY_NORMAL,
                              PR_GLOBAL_THREAD,
                              PR_UNJOINABLE_THREAD,
                              0);

  if (!newThread ) {
    DestroyRestriction(threadArgs->mRestriction);
    delete threadArgs;
    return NS_ERROR_OUT_OF_MEMORY;
  }

  mQueryThreads.Put(*aReturnValue, newThread);
  return NS_OK;
}

NS_IMETHODIMP nsAbOutlookDirectory::StopQuery(int32_t aContext)
{
    PRThread *queryThread;
    if (mQueryThreads.Get(aContext, &queryThread)) {
        PR_Interrupt(queryThread);
        mQueryThreads.Remove(aContext);
    }
    return NS_OK;
}

// nsIAbDirectorySearch methods
NS_IMETHODIMP nsAbOutlookDirectory::StartSearch(void)
{
    if (!mIsQueryURI) { return NS_ERROR_NOT_IMPLEMENTED ; }
    nsresult retCode = NS_OK ;
    
    retCode = StopSearch() ;
    NS_ENSURE_SUCCESS(retCode, retCode) ;
    mCardList.Clear();

    nsCOMPtr<nsIAbBooleanExpression> expression ;

    nsCOMPtr<nsIAbDirectoryQueryArguments> arguments = do_CreateInstance(NS_ABDIRECTORYQUERYARGUMENTS_CONTRACTID,&retCode);
    NS_ENSURE_SUCCESS(retCode, retCode);

    retCode = nsAbQueryStringToExpression::Convert(mQueryString, getter_AddRefs(expression)) ;
    NS_ENSURE_SUCCESS(retCode, retCode) ;
    retCode = arguments->SetExpression(expression) ;
    NS_ENSURE_SUCCESS(retCode, retCode) ;

    retCode = arguments->SetQuerySubDirectories(true) ;
    NS_ENSURE_SUCCESS(retCode, retCode) ;

    return DoQuery(this, arguments, this, -1, 0, &mSearchContext);
}

NS_IMETHODIMP nsAbOutlookDirectory::StopSearch(void) 
{
    if (!mIsQueryURI) { return NS_ERROR_NOT_IMPLEMENTED ; }
    return StopQuery(mSearchContext) ;
}

// nsIAbDirSearchListener
NS_IMETHODIMP nsAbOutlookDirectory::OnSearchFinished(int32_t aResult,
                                                     const nsAString &aErrorMsg)
{
  return NS_OK;
}

NS_IMETHODIMP nsAbOutlookDirectory::OnSearchFoundCard(nsIAbCard *aCard) 
{
  mCardList.Put(aCard, aCard);
  nsresult rv;
  nsCOMPtr<nsIAbManager> abManager(do_GetService(NS_ABMANAGER_CONTRACTID, &rv));
  if (NS_SUCCEEDED(rv))
    rv = abManager->NotifyDirectoryItemAdded(this, aCard);

  return rv;
}

nsresult nsAbOutlookDirectory::ExecuteQuery(SRestriction &aRestriction,
                                            nsIAbDirSearchListener *aListener,
                                            int32_t aResultLimit, int32_t aTimeout,
                                            int32_t aThreadId) 

{
  if (!aListener)
    return NS_ERROR_NULL_POINTER;

  nsresult retCode = NS_OK;

  nsCOMPtr<nsIMutableArray> resultsArray(do_CreateInstance(NS_ARRAY_CONTRACTID,
                                                           &retCode));
  NS_ENSURE_SUCCESS(retCode, retCode);

  retCode = GetChildCards(resultsArray,
                          aRestriction.rt == RES_COMMENT ? nullptr : &aRestriction);
  NS_ENSURE_SUCCESS(retCode, retCode);

  uint32_t nbResults = 0;
  retCode = resultsArray->GetLength(&nbResults);
  NS_ENSURE_SUCCESS(retCode, retCode);

  if (aResultLimit > 0 && nbResults > static_cast<uint32_t>(aResultLimit)) { 
    nbResults = static_cast<uint32_t>(aResultLimit) ; 
  }

  uint32_t i = 0;
  nsCOMPtr<nsIAbCard> card;
    
  for (i = 0 ; i < nbResults ; ++ i) {
    card = do_QueryElementAt(resultsArray, i, &retCode);
    NS_ENSURE_SUCCESS(retCode, retCode);

    aListener->OnSearchFoundCard(card);
  }

  mQueryThreads.Remove(aThreadId);

  aListener->OnSearchFinished(nsIAbDirectoryQueryResultListener::queryResultComplete,
                              EmptyString());
  return retCode;
}

// This function expects the aCards array to already be created.
nsresult nsAbOutlookDirectory::GetChildCards(nsIMutableArray *aCards,
                                             void *aRestriction)
{
  nsAbWinHelperGuard mapiAddBook(mAbWinType);

  if (!mapiAddBook->IsOK())
    return NS_ERROR_FAILURE;

  nsMapiEntryArray cardEntries;
  LPSRestriction restriction = (LPSRestriction) aRestriction;

  if (!mapiAddBook->GetCards(*mMapiData, restriction, cardEntries)) {
    PRINTF(("Cannot get cards.\n"));
    return NS_ERROR_FAILURE;
  }

  nsAutoCString ourUuid;
  GetUuid(ourUuid);

  nsAutoCString entryId;
  nsAutoCString uriName;
  nsCOMPtr<nsIAbCard> childCard;
  nsresult rv;

  for (ULONG card = 0; card < cardEntries.mNbEntries; ++card) {
    cardEntries.mEntries[card].ToString(entryId);
    buildAbWinUri(kOutlookCardScheme, mAbWinType, uriName);
    uriName.Append(entryId);

    rv = OutlookCardForURI(uriName, getter_AddRefs(childCard));
    NS_ENSURE_SUCCESS(rv, rv);
    childCard->SetDirectoryId(ourUuid);

    aCards->AppendElement(childCard, false);
  }
  return rv;
}

nsresult nsAbOutlookDirectory::GetChildNodes(nsIMutableArray* aNodes)
{
  NS_ENSURE_ARG_POINTER(aNodes);

  aNodes->Clear();

  nsAbWinHelperGuard mapiAddBook(mAbWinType);
  nsMapiEntryArray nodeEntries;

  if (!mapiAddBook->IsOK())
      return NS_ERROR_FAILURE;

  if (!mapiAddBook->GetNodes(*mMapiData, nodeEntries))
  {
    PRINTF(("Cannot get nodes.\n"));
    return NS_ERROR_FAILURE;
  }

  nsAutoCString entryId;
  nsAutoCString uriName;
  nsresult rv = NS_OK;

  nsCOMPtr<nsIAbManager> abManager(do_GetService(NS_ABMANAGER_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  for (ULONG node = 0; node < nodeEntries.mNbEntries; ++node)
  {
    nodeEntries.mEntries[node].ToString(entryId);
    buildAbWinUri(kOutlookDirectoryScheme, mAbWinType, uriName);
    uriName.Append(entryId);

    nsCOMPtr <nsIAbDirectory> directory;
    rv = abManager->GetDirectory(uriName, getter_AddRefs(directory));
    NS_ENSURE_SUCCESS(rv, rv);

    aNodes->AppendElement(directory, false);
  }
  return rv;
}

nsresult nsAbOutlookDirectory::NotifyItemDeletion(nsISupports *aItem) 
{
  nsresult rv;
  nsCOMPtr<nsIAbManager> abManager(do_GetService(NS_ABMANAGER_CONTRACTID, &rv));

  if (NS_SUCCEEDED(rv))
    rv = abManager->NotifyDirectoryItemDeleted(this, aItem);

  return rv;
}

nsresult nsAbOutlookDirectory::NotifyItemAddition(nsISupports *aItem) 
{
  nsresult rv;
  nsCOMPtr<nsIAbManager> abManager = do_GetService(NS_ABMANAGER_CONTRACTID, &rv);
  if (NS_SUCCEEDED(rv))
    rv = abManager->NotifyDirectoryItemAdded(this, aItem);

  return rv;
}

// This is called from EditMailListToDatabase.
// We got m_AddressList containing the list of cards the mailing
// list is supposed to contain at the end.
nsresult nsAbOutlookDirectory::CommitAddressList(void)
{
  if (!m_IsMailList) { 
    PRINTF(("We are not in a mailing list, no commit can be done.\n"));
    return NS_ERROR_UNEXPECTED;
  }

  nsresult rv;
  uint32_t i = 0;
  nsCOMPtr<nsIMutableArray> oldList(do_CreateInstance(NS_ARRAY_CONTRACTID, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = GetChildCards(oldList, nullptr);
  NS_ENSURE_SUCCESS(rv, rv);

  if (!m_AddressList)
    return NS_ERROR_NULL_POINTER;

  uint32_t nbCards = 0;
  rv = m_AddressList->GetLength(&nbCards);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsISupports> element;
  nsCOMPtr<nsIAbCard> newCard;
  uint32_t pos;

  for (i = 0; i < nbCards; ++i) {
    element = do_QueryElementAt(m_AddressList, i, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    if (NS_SUCCEEDED(oldList->IndexOf(0, element, &pos))) {
        rv = oldList->RemoveElementAt(pos);
        NS_ENSURE_SUCCESS(rv, rv);

        // The entry was not already there
        nsCOMPtr<nsIAbCard> card(do_QueryInterface(element, &rv));
        NS_ENSURE_SUCCESS(rv, rv);

        rv = CreateCard(card, getter_AddRefs(newCard));
        NS_ENSURE_SUCCESS(rv, rv);
        m_AddressList->ReplaceElementAt(newCard, i, false);
    }
  }
  return DeleteCards(oldList);
}

nsresult nsAbOutlookDirectory::UpdateAddressList(void)
{
    if (!m_AddressList)
    {
	nsresult rv;
        m_AddressList = do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
        NS_ENSURE_SUCCESS(rv, rv);
    }

    return m_IsMailList ? GetChildCards(m_AddressList, nullptr) :
                          GetChildNodes(m_AddressList);
}

nsresult nsAbOutlookDirectory::CreateCard(nsIAbCard *aData, nsIAbCard **aNewCard) 
{
    if (!aData || !aNewCard) { return NS_ERROR_NULL_POINTER ; }
    *aNewCard = nullptr ;
    nsresult retCode = NS_OK ;
    nsAbWinHelperGuard mapiAddBook (mAbWinType) ;
    nsMapiEntry newEntry ;
    nsAutoCString entryString ;
    bool didCopy = false ;

    if (!mapiAddBook->IsOK()) { return NS_ERROR_FAILURE ; }
    // If we get an nsIAbCard that maps onto an Outlook card uri
    // we simply copy the contents of the Outlook card.
    retCode = ExtractCardEntry(aData, entryString) ;
    if (NS_SUCCEEDED(retCode) && !entryString.IsEmpty()) {
        nsMapiEntry sourceEntry ;
        
        
        sourceEntry.Assign(entryString) ;
        if (m_IsMailList) {
            // In the case of a mailing list, we can use the address
            // as a direct template to build the new one (which is done
            // by CopyEntry).
            mapiAddBook->CopyEntry(*mMapiData, sourceEntry, newEntry) ;
            didCopy = true ;
        }
        else {
            // Else, we have to create a temporary address and copy the
            // source into it. Yes it's silly.
            mapiAddBook->CreateEntry(*mMapiData, newEntry) ;
        }
    }
    // If this approach doesn't work, well we're back to creating and copying.
    if (newEntry.mByteCount == 0) {
        // In the case of a mailing list, we cannot directly create a new card,
        // we have to create a temporary one in a real folder (to be able to use
        // templates) and then copy it to the mailing list.
        if (m_IsMailList) {
            nsMapiEntry parentEntry ;
            nsMapiEntry temporaryEntry ;

            if (!mapiAddBook->GetDefaultContainer(parentEntry)) {
                return NS_ERROR_FAILURE ;
            }
            if (!mapiAddBook->CreateEntry(parentEntry, temporaryEntry)) {
                return NS_ERROR_FAILURE ;
            }
            if (!mapiAddBook->CopyEntry(*mMapiData, temporaryEntry, newEntry)) {
                return NS_ERROR_FAILURE ;
            }
            if (!mapiAddBook->DeleteEntry(parentEntry, temporaryEntry)) {
                return NS_ERROR_FAILURE ;
            }
        }
        // If we're on a real address book folder, we can directly create an
        // empty card.
        else if (!mapiAddBook->CreateEntry(*mMapiData, newEntry)) {
            return NS_ERROR_FAILURE ;
        }
    }
    newEntry.ToString(entryString) ;
    nsAutoCString uri ;

    buildAbWinUri(kOutlookCardScheme, mAbWinType, uri) ;
    uri.Append(entryString) ;
    
    nsCOMPtr<nsIAbCard> newCard;
    retCode = OutlookCardForURI(uri, getter_AddRefs(newCard));
    NS_ENSURE_SUCCESS(retCode, retCode);

    nsAutoCString ourUuid;
    GetUuid(ourUuid);
    newCard->SetDirectoryId(ourUuid);

    if (!didCopy) {
        retCode = newCard->Copy(aData) ;
        NS_ENSURE_SUCCESS(retCode, retCode) ;
        retCode = ModifyCard(newCard) ;
        NS_ENSURE_SUCCESS(retCode, retCode) ;
    }
    *aNewCard = newCard ;
    NS_ADDREF(*aNewCard) ;
    return retCode ;
}

static void UnicodeToWord(const PRUnichar *aUnicode, WORD& aWord)
{
    aWord = 0 ;
    if (aUnicode == nullptr || *aUnicode == 0) { return ; }
    nsresult errorCode = NS_OK;
    nsAutoString unichar (aUnicode) ;

    aWord = static_cast<WORD>(unichar.ToInteger(&errorCode));
    if (NS_FAILED(errorCode)) {
        PRINTF(("Error conversion string %S: %08x.\n", unichar.get(), errorCode)) ;
    }
}

#define PREF_MAIL_ADDR_BOOK_LASTNAMEFIRST "mail.addr_book.lastnamefirst"


NS_IMETHODIMP nsAbOutlookDirectory::ModifyCard(nsIAbCard *aModifiedCard)
{
  NS_ENSURE_ARG_POINTER(aModifiedCard);

  nsString *properties = nullptr;
  nsAutoString utility;
  nsAbWinHelperGuard mapiAddBook(mAbWinType);

  if (!mapiAddBook->IsOK())
    return NS_ERROR_FAILURE;

  nsCString entry;
  nsresult retCode = ExtractCardEntry(aModifiedCard, entry);
  NS_ENSURE_SUCCESS(retCode, retCode);
  // If we don't have the card entry, we can't work.
  if (entry.IsEmpty())
    return NS_ERROR_FAILURE;

  nsMapiEntry mapiData;
  mapiData.Assign(entry);

  // First, all the standard properties in one go
  properties = new nsString[index_LastProp];
  if (!properties) {
    return NS_ERROR_OUT_OF_MEMORY;
  }
  aModifiedCard->GetFirstName(properties[index_FirstName]);
  aModifiedCard->GetLastName(properties[index_LastName]);
  // This triple search for something to put in the name
  // is because in the case of a mailing list edition in 
  // Mozilla, the display name will not be provided, and 
  // MAPI doesn't allow that, so we fall back on an optional
  // name, and when all fails, on the email address.
  aModifiedCard->GetDisplayName(properties[index_DisplayName]);
  if (*properties[index_DisplayName].get() == 0) {
    nsresult rv;
    nsCOMPtr<nsIPrefBranch> prefBranch =
      do_GetService(NS_PREFSERVICE_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv,rv);

    int32_t format;
    rv = prefBranch->GetIntPref(PREF_MAIL_ADDR_BOOK_LASTNAMEFIRST, &format);
    NS_ENSURE_SUCCESS(rv,rv);

    rv = aModifiedCard->GenerateName(format, nullptr,
                                     properties[index_DisplayName]);
    NS_ENSURE_SUCCESS(rv,rv);

    if (*properties[index_DisplayName].get() == 0) {
      aModifiedCard->GetPrimaryEmail(properties[index_DisplayName]);
    }
  }
  aModifiedCard->SetDisplayName(properties[index_DisplayName]);
  aModifiedCard->GetPrimaryEmail(properties[index_EmailAddress]);
  aModifiedCard->GetPropertyAsAString(kNicknameProperty, properties[index_NickName]);
  aModifiedCard->GetPropertyAsAString(kWorkPhoneProperty, properties[index_WorkPhoneNumber]);
  aModifiedCard->GetPropertyAsAString(kHomePhoneProperty, properties[index_HomePhoneNumber]);
  aModifiedCard->GetPropertyAsAString(kFaxProperty, properties[index_WorkFaxNumber]);
  aModifiedCard->GetPropertyAsAString(kPagerProperty, properties[index_PagerNumber]);
  aModifiedCard->GetPropertyAsAString(kCellularProperty, properties[index_MobileNumber]);
  aModifiedCard->GetPropertyAsAString(kHomeCityProperty, properties[index_HomeCity]);
  aModifiedCard->GetPropertyAsAString(kHomeStateProperty, properties[index_HomeState]);
  aModifiedCard->GetPropertyAsAString(kHomeZipCodeProperty, properties[index_HomeZip]);
  aModifiedCard->GetPropertyAsAString(kHomeCountryProperty, properties[index_HomeCountry]);
  aModifiedCard->GetPropertyAsAString(kWorkCityProperty, properties[index_WorkCity]);
  aModifiedCard->GetPropertyAsAString(kWorkStateProperty, properties[index_WorkState]);
  aModifiedCard->GetPropertyAsAString(kWorkZipCodeProperty, properties[index_WorkZip]);
  aModifiedCard->GetPropertyAsAString(kWorkCountryProperty, properties[index_WorkCountry]);
  aModifiedCard->GetPropertyAsAString(kJobTitleProperty, properties[index_JobTitle]);
  aModifiedCard->GetPropertyAsAString(kDepartmentProperty, properties[index_Department]);
  aModifiedCard->GetPropertyAsAString(kCompanyProperty, properties[index_Company]);
  aModifiedCard->GetPropertyAsAString(kWorkWebPageProperty, properties[index_WorkWebPage]);
  aModifiedCard->GetPropertyAsAString(kHomeWebPageProperty, properties[index_HomeWebPage]);
  aModifiedCard->GetPropertyAsAString(kNotesProperty, properties[index_Comments]);
  if (!mapiAddBook->SetPropertiesUString(mapiData, OutlookCardMAPIProps,
                                         index_LastProp, properties)) {
    PRINTF(("Cannot set general properties.\n")) ;
  }

  delete [] properties;
  nsString unichar;
  nsString unichar2;
  WORD year = 0;
  WORD month = 0;
  WORD day = 0;

  aModifiedCard->GetPropertyAsAString(kHomeAddressProperty, unichar);
  aModifiedCard->GetPropertyAsAString(kHomeAddress2Property, unichar2);

  utility.Assign(unichar.get());
  if (!utility.IsEmpty())
    utility.AppendLiteral("\r\n");

  utility.Append(unichar2.get());
  if (!mapiAddBook->SetPropertyUString(mapiData, PR_HOME_ADDRESS_STREET_W, utility.get())) {
    PRINTF(("Cannot set home address.\n")) ;
  }

  unichar.Truncate();
  aModifiedCard->GetPropertyAsAString(kWorkAddressProperty, unichar);
  unichar2.Truncate();
  aModifiedCard->GetPropertyAsAString(kWorkAddress2Property, unichar2);

  utility.Assign(unichar.get());
  if (!utility.IsEmpty())
    utility.AppendLiteral("\r\n");

  utility.Append(unichar2.get());
  if (!mapiAddBook->SetPropertyUString(mapiData, PR_BUSINESS_ADDRESS_STREET_W, utility.get())) {
    PRINTF(("Cannot set work address.\n")) ;
  }

  unichar.Truncate();
  aModifiedCard->GetPropertyAsAString(kBirthYearProperty, unichar);
  UnicodeToWord(unichar.get(), year);
  unichar.Truncate();
  aModifiedCard->GetPropertyAsAString(kBirthMonthProperty, unichar);
  UnicodeToWord(unichar.get(), month);
  unichar.Truncate();
  aModifiedCard->GetPropertyAsAString(kBirthDayProperty, unichar);
  UnicodeToWord(unichar.get(), day);
  if (!mapiAddBook->SetPropertyDate(mapiData, PR_BIRTHDAY, year, month, day)) {
    PRINTF(("Cannot set date.\n")) ;
  }

  return retCode;
}

NS_IMETHODIMP nsAbOutlookDirectory::OnQueryFoundCard(nsIAbCard *aCard)
{
  return OnSearchFoundCard(aCard);
}

NS_IMETHODIMP nsAbOutlookDirectory::OnQueryResult(int32_t aResult,
                                                  int32_t aErrorCode)
{
  return OnSearchFinished(aResult, EmptyString());
}

NS_IMETHODIMP nsAbOutlookDirectory::UseForAutocomplete(const nsACString &aIdentityKey, bool *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  *aResult = false;
  return NS_OK;
}

static void splitString(nsString& aSource, nsString& aTarget)
{
  aTarget.Truncate();
  int32_t offset = aSource.FindChar('\n');

  if (offset >= 0)
  {
    const PRUnichar *source = aSource.get() + offset + 1;
    while (*source)
    {
      if (*source == '\n' || *source == '\r')
        aTarget.Append(PRUnichar(' '));
      else
        aTarget.Append(*source);
      ++source;
    }
    aSource.SetLength(offset);
  }
}

nsresult OutlookCardForURI(const nsACString &aUri, nsIAbCard **newCard)
{
  NS_ENSURE_ARG_POINTER(newCard);

  nsAutoCString entry;
  nsAutoCString stub;
  uint32_t abWinType = getAbWinType(kOutlookCardScheme,
    PromiseFlatCString(aUri).get(), stub, entry);
  if (abWinType == nsAbWinType_Unknown)
  {
    PRINTF(("Huge problem URI=%s.\n", PromiseFlatCString(aUri).get()));
    return NS_ERROR_INVALID_ARG;
  }

  nsAbWinHelperGuard mapiAddBook(abWinType);
  if (!mapiAddBook->IsOK())
    return NS_ERROR_FAILURE;

  nsresult rv;
  nsCOMPtr<nsIAbCard> card = do_CreateInstance(NS_ABCARDPROPERTY_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  card->SetPropertyAsAUTF8String("OutlookEntryURI", aUri);
  card->SetLocalId(aUri);

  nsMapiEntry mapiData;
  mapiData.Assign(entry);

  nsString unichars[index_LastProp];

  if (mapiAddBook->GetPropertiesUString(mapiData, OutlookCardMAPIProps,
                                        index_LastProp, unichars))
  {
    card->SetFirstName(unichars[index_FirstName]);
    card->SetLastName(unichars[index_LastName]);
    card->SetDisplayName(unichars[index_DisplayName]);
    card->SetPrimaryEmail(unichars[index_EmailAddress]);
    card->SetPropertyAsAString(kNicknameProperty, unichars[index_NickName]);
    card->SetPropertyAsAString(kWorkPhoneProperty, unichars[index_WorkPhoneNumber]);
    card->SetPropertyAsAString(kHomePhoneProperty, unichars[index_HomePhoneNumber]);
    card->SetPropertyAsAString(kFaxProperty, unichars[index_WorkFaxNumber]);
    card->SetPropertyAsAString(kPagerProperty, unichars[index_PagerNumber]);
    card->SetPropertyAsAString(kCellularProperty, unichars[index_MobileNumber]);
    card->SetPropertyAsAString(kHomeCityProperty, unichars[index_HomeCity]);
    card->SetPropertyAsAString(kHomeStateProperty, unichars[index_HomeState]);
    card->SetPropertyAsAString(kHomeZipCodeProperty, unichars[index_HomeZip]);
    card->SetPropertyAsAString(kHomeCountryProperty, unichars[index_HomeCountry]);
    card->SetPropertyAsAString(kWorkCityProperty, unichars[index_WorkCity]);
    card->SetPropertyAsAString(kWorkStateProperty, unichars[index_WorkState]);
    card->SetPropertyAsAString(kWorkZipCodeProperty, unichars[index_WorkZip]);
    card->SetPropertyAsAString(kWorkCountryProperty, unichars[index_WorkCountry]);
    card->SetPropertyAsAString(kJobTitleProperty, unichars[index_JobTitle]);
    card->SetPropertyAsAString(kDepartmentProperty, unichars[index_Department]);
    card->SetPropertyAsAString(kCompanyProperty, unichars[index_Company]);
    card->SetPropertyAsAString(kWorkWebPageProperty, unichars[index_WorkWebPage]);
    card->SetPropertyAsAString(kHomeWebPageProperty, unichars[index_HomeWebPage]);
    card->SetPropertyAsAString(kNotesProperty, unichars[index_Comments]);
  }

  ULONG cardType = 0;
  if (mapiAddBook->GetPropertyLong(mapiData, PR_OBJECT_TYPE, cardType))
  {
    card->SetIsMailList(cardType == MAPI_DISTLIST);
    if (cardType == MAPI_DISTLIST)
    {
      nsAutoCString normalChars;
      buildAbWinUri(kOutlookDirectoryScheme, abWinType, normalChars);
      normalChars.Append(entry);
      card->SetMailListURI(normalChars.get());
    }
  }

  nsAutoString unichar;
  nsAutoString unicharBis;
  if (mapiAddBook->GetPropertyUString(mapiData, PR_HOME_ADDRESS_STREET_W, unichar))
  {
    splitString(unichar, unicharBis);
    card->SetPropertyAsAString(kHomeAddressProperty, unichar);
    card->SetPropertyAsAString(kHomeAddress2Property, unicharBis);
  }
  if (mapiAddBook->GetPropertyUString(mapiData, PR_BUSINESS_ADDRESS_STREET_W,
                                      unichar))
  {
    splitString(unichar, unicharBis);
    card->SetPropertyAsAString(kWorkAddressProperty, unichar);
    card->SetPropertyAsAString(kWorkAddress2Property, unicharBis);
  }

  WORD year = 0, month = 0, day = 0;
  if (mapiAddBook->GetPropertyDate(mapiData, PR_BIRTHDAY, year, month, day))
  {
    card->SetPropertyAsUint32(kBirthYearProperty, year);
    card->SetPropertyAsUint32(kBirthMonthProperty, month);
    card->SetPropertyAsUint32(kBirthDayProperty, day);
  }

  card.swap(*newCard);
  return NS_OK;
}
