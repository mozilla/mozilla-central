/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsAbOSXDirectory.h"
#include "nsAbOSXCard.h"
#include "nsAbOSXUtils.h"
#include "nsAbQueryStringToExpression.h"
#include "nsArrayEnumerator.h"
#include "nsAutoPtr.h"
#include "nsCOMArray.h"
#include "nsEnumeratorUtils.h"
#include "nsIAbDirectoryQueryProxy.h"
#include "nsIAbManager.h"
#include "nsServiceManagerUtils.h"
#include "nsIMutableArray.h"
#include "nsArrayUtils.h"
#include "nsIAbBooleanExpression.h"
#include "nsComponentManagerUtils.h"
#include "nsISimpleEnumerator.h"

#include <AddressBook/AddressBook.h>

#define kABDeletedRecords (kABDeletedRecords? kABDeletedRecords : @"ABDeletedRecords")
#define kABUpdatedRecords (kABUpdatedRecords ? kABUpdatedRecords : @"ABUpdatedRecords")
#define kABInsertedRecords (kABInsertedRecords ? kABInsertedRecords : @"ABInsertedRecords")

static nsresult
GetOrCreateGroup(NSString *aUid, nsIAbDirectory **aResult)
{
  NS_ASSERTION(aUid, "No UID for group!.");

  nsAutoCString uri(NS_ABOSXDIRECTORY_URI_PREFIX);
  AppendToCString(aUid, uri);

  nsresult rv;
  nsCOMPtr<nsIAbManager> abManager = do_GetService(NS_ABMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAbDirectory> directory;
  rv = abManager->GetDirectory(uri, getter_AddRefs(directory));
  NS_ENSURE_SUCCESS(rv, rv);

  NS_IF_ADDREF(*aResult = directory);
  return NS_OK;
}

static nsresult
GetCard(ABRecord *aRecord, nsIAbCard **aResult, nsIAbOSXDirectory *osxDirectory)
{
  NSString *uid = [aRecord uniqueId];
  NS_ASSERTION(uid, "No UID for card!.");
  if (!uid)
    return NS_ERROR_FAILURE;

  nsAutoCString uri(NS_ABOSXCARD_URI_PREFIX);
  AppendToCString(uid, uri);
  nsCOMPtr<nsIAbOSXCard> osxCard;
  nsresult rv = osxDirectory->GetCardByUri(uri, getter_AddRefs(osxCard));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAbCard> card = do_QueryInterface(osxCard, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  NS_IF_ADDREF(*aResult = card);
  return NS_OK;
}

static nsresult
CreateCard(ABRecord *aRecord, nsIAbCard **aResult)
{
  NSString *uid = [aRecord uniqueId];
  NS_ASSERTION(uid, "No UID for card!.");
  if (!uid)
    return NS_ERROR_FAILURE;

  nsresult rv;
  nsCOMPtr<nsIAbOSXCard> osxCard = do_CreateInstance(NS_ABOSXCARD_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsAutoCString uri(NS_ABOSXCARD_URI_PREFIX);
  AppendToCString(uid, uri);

  rv = osxCard->Init(uri.get());
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAbCard> card = do_QueryInterface(osxCard, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  NS_IF_ADDREF(*aResult = card);
  return NS_OK;
}

static nsresult
Sync(NSString *aUid)
{
  ABAddressBook *addressBook = [ABAddressBook sharedAddressBook];
  ABRecord *card = [addressBook recordForUniqueId:aUid];
  if ([card isKindOfClass:[ABGroup class]])
  {
    nsCOMPtr<nsIAbDirectory> directory;
    GetOrCreateGroup(aUid, getter_AddRefs(directory));
    nsCOMPtr<nsIAbOSXDirectory> osxDirectory =
      do_QueryInterface(directory);
    
    osxDirectory->Update();
  }
  else {
    nsCOMPtr<nsIAbCard> abCard;
    nsresult rv;

    nsCOMPtr<nsIAbManager> abManager = do_GetService(NS_ABMANAGER_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIAbDirectory> directory;
    rv = abManager->GetDirectory(NS_LITERAL_CSTRING(NS_ABOSXDIRECTORY_URI_PREFIX"/"),
                                 getter_AddRefs(directory));
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIAbOSXDirectory> osxDirectory =
      do_QueryInterface(directory, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    rv = GetCard(card, getter_AddRefs(abCard), osxDirectory);
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIAbOSXCard> osxCard = do_QueryInterface(abCard);
    osxCard->Update(true);
  }
  return NS_OK;
}

@interface ABChangedMonitor : NSObject
-(void)ABChanged:(NSNotification *)aNotification;
@end

@implementation ABChangedMonitor
-(void)ABChanged:(NSNotification *)aNotification
{
  NSDictionary *changes = [aNotification userInfo];
  
  nsresult rv;
  NSArray *inserted = [changes objectForKey:kABInsertedRecords];

  if (inserted) {
    nsCOMPtr<nsIAbManager> abManager = do_GetService(NS_ABMANAGER_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS_VOID(rv);

    nsCOMPtr<nsIAbDirectory> directory;
    rv = abManager->GetDirectory(NS_LITERAL_CSTRING(NS_ABOSXDIRECTORY_URI_PREFIX"/"),
                                 getter_AddRefs(directory));
    NS_ENSURE_SUCCESS_VOID(rv);

    nsCOMPtr<nsIAbOSXDirectory> osxDirectory =
      do_QueryInterface(directory, &rv);
    NS_ENSURE_SUCCESS_VOID(rv);

    unsigned int i, count = [inserted count];
    for (i = 0; i < count; ++i) {
      ABAddressBook *addressBook =
      [ABAddressBook sharedAddressBook];
      ABRecord *card =
        [addressBook recordForUniqueId:[inserted objectAtIndex:i]];
      if ([card isKindOfClass:[ABGroup class]]) {
        nsCOMPtr<nsIAbDirectory> directory;
        GetOrCreateGroup([inserted objectAtIndex:i],
                         getter_AddRefs(directory));

        rv = osxDirectory->AssertDirectory(abManager, directory);
        NS_ENSURE_SUCCESS_VOID(rv);
      }
      else {
        nsCOMPtr<nsIAbCard> abCard;
        // Construct a card
        nsresult rv = CreateCard(card, getter_AddRefs(abCard));
        NS_ENSURE_SUCCESS_VOID(rv);
        rv = osxDirectory->AssertCard(abManager, abCard);
        NS_ENSURE_SUCCESS_VOID(rv);
      }
    }
  }
  
  NSArray *updated = [changes objectForKey:kABUpdatedRecords];
  if (updated) {
    unsigned int i, count = [updated count];
    for (i = 0; i < count; ++i) {
      NSString *uid = [updated objectAtIndex:i];
      Sync(uid);
    }
  }
  
  NSArray *deleted = [changes objectForKey:kABDeletedRecords];
  if (deleted) {

    nsCOMPtr<nsIAbManager> abManager = do_GetService(NS_ABMANAGER_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS_VOID(rv);

    nsCOMPtr<nsIAbDirectory> directory;
    rv = abManager->GetDirectory(NS_LITERAL_CSTRING(NS_ABOSXDIRECTORY_URI_PREFIX"/"),
                                 getter_AddRefs(directory));
    NS_ENSURE_SUCCESS_VOID(rv);

    nsCOMPtr<nsIAbOSXDirectory> osxDirectory =
      do_QueryInterface(directory, &rv);
    NS_ENSURE_SUCCESS_VOID(rv);

    unsigned int i, count = [deleted count];
    for (i = 0; i < count; ++i) {
      NSString *deletedUid = [deleted objectAtIndex:i];

      nsAutoCString uid;
      AppendToCString(deletedUid, uid);

      rv = osxDirectory->DeleteUid(uid);
      NS_ENSURE_SUCCESS_VOID(rv);
    }
  }
  
  if (!inserted && !updated && !deleted) {
    // XXX This is supposed to mean "everything was updated", but we get
    //     this whenever something has changed, so not sure what to do.
  }
}
@end

static nsresult
MapConditionString(nsIAbBooleanConditionString *aCondition, bool aNegate,
                   bool &aCanHandle, ABSearchElement **aResult)
{
  aCanHandle = false;
  
  nsAbBooleanConditionType conditionType = 0;
  nsresult rv = aCondition->GetCondition(&conditionType);
  NS_ENSURE_SUCCESS(rv, rv);
  
  ABSearchComparison comparison;
  switch (conditionType) {
    case nsIAbBooleanConditionTypes::Contains:
    {
      if (!aNegate) {
        comparison = kABContainsSubString;
        aCanHandle = true;
      }
      break;
    }
    case nsIAbBooleanConditionTypes::DoesNotContain:
    {
      if (aNegate) {
        comparison = kABContainsSubString;
        aCanHandle = true;
      }
      break;
    }
    case nsIAbBooleanConditionTypes::Is:
    {
      comparison = aNegate ? kABNotEqual : kABEqual;
      aCanHandle = true;
      break;
    }
    case nsIAbBooleanConditionTypes::IsNot:
    {
      comparison = aNegate ? kABEqual : kABNotEqual;
      aCanHandle = true;
      break;
    }
    case nsIAbBooleanConditionTypes::BeginsWith:
    {
      if (!aNegate) {
        comparison = kABPrefixMatch;
        aCanHandle = true;
      }
      break;
    }
    case nsIAbBooleanConditionTypes::EndsWith:
    {
      //comparison = kABSuffixMatch;
      break;
    }
    case nsIAbBooleanConditionTypes::LessThan:
    {
      comparison = aNegate ? kABGreaterThanOrEqual : kABLessThan;
      aCanHandle = true;
      break;
    }
    case nsIAbBooleanConditionTypes::GreaterThan:
    {
      comparison = aNegate ? kABLessThanOrEqual : kABGreaterThan;
      aCanHandle = true;
      break;
    }
  }
  
  if (!aCanHandle)
    return NS_OK;
  
  nsCString name;
  rv = aCondition->GetName(getter_Copies(name));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsString value;
  rv = aCondition->GetValue(getter_Copies(value));
  NS_ENSURE_SUCCESS(rv, rv);
  
  uint32_t length = value.Length();
  
  uint32_t i;
  for (i = 0; i < nsAbOSXUtils::kPropertyMapSize; ++i) {
    if (name.Equals(nsAbOSXUtils::kPropertyMap[i].mPropertyName)) {
      *aResult =
      [ABPerson searchElementForProperty:nsAbOSXUtils::kPropertyMap[i].mOSXProperty
                                   label:nsAbOSXUtils::kPropertyMap[i].mOSXLabel
                                     key:nsAbOSXUtils::kPropertyMap[i].mOSXKey
                                   value:[NSString stringWithCharacters:reinterpret_cast<const unichar*>(value.get()) length:length]
                              comparison:comparison];
      
      return NS_OK;
    }
  }
  
  if (name.EqualsLiteral("DisplayName") && comparison == kABContainsSubString) {
    ABSearchElement *first =
    [ABPerson searchElementForProperty:kABFirstNameProperty
                                 label:nil
                                   key:nil
                                 value:[NSString stringWithCharacters:reinterpret_cast<const unichar*>(value.get()) length:length]
                            comparison:comparison];
    ABSearchElement *second =
      [ABPerson searchElementForProperty:kABLastNameProperty
                                   label:nil
                                     key:nil
                                   value:[NSString stringWithCharacters:reinterpret_cast<const unichar*>(value.get()) length:length]
                              comparison:comparison];
    ABSearchElement *third =
      [ABGroup searchElementForProperty:kABGroupNameProperty
                                  label:nil
                                    key:nil
                                  value:[NSString stringWithCharacters:reinterpret_cast<const unichar*>(value.get()) length:length]
                             comparison:comparison];
    
    *aResult = [ABSearchElement searchElementForConjunction:kABSearchOr children:[NSArray arrayWithObjects:first, second, third, nil]];
    
    return NS_OK;
  }
  
  aCanHandle = false;
  
  return NS_OK;
}

static nsresult
BuildSearchElements(nsIAbBooleanExpression *aExpression,
                    bool &aCanHandle,
                    ABSearchElement **aResult)
{
  aCanHandle = true;
  
  nsCOMPtr<nsIArray> expressions;
  nsresult rv = aExpression->GetExpressions(getter_AddRefs(expressions));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsAbBooleanOperationType operation;
  rv = aExpression->GetOperation(&operation);
  NS_ENSURE_SUCCESS(rv, rv);
  
  uint32_t count;
  rv = expressions->GetLength(&count);
  NS_ENSURE_SUCCESS(rv, rv);
  
  NS_ASSERTION(count > 1 && operation != nsIAbBooleanOperationTypes::NOT,
               "This doesn't make sense!");
  
  NSMutableArray *array = nullptr;
  if (count > 1)
    array = [[NSMutableArray alloc] init];
  
  uint32_t i;
  nsCOMPtr<nsIAbBooleanConditionString> condition;
  nsCOMPtr<nsIAbBooleanExpression> subExpression;
  for (i = 0; i < count; ++i) {
    ABSearchElement *element = nullptr;
    
    condition = do_QueryElementAt(expressions, i);
    if (condition) {
      rv = MapConditionString(condition, operation == nsIAbBooleanOperationTypes::NOT, aCanHandle, &element);
      if (NS_FAILED(rv))
        break;
    }
    else {
      subExpression = do_QueryElementAt(expressions, i);
      if (subExpression) {
        rv = BuildSearchElements(subExpression, aCanHandle, &element);
        if (NS_FAILED(rv))
          break;
      }
    }
    
    if (!aCanHandle) {
      // remember to free the array when returning early
      [array release];
      return NS_OK;
    }
    
    if (element) {
      if (array)
        [array addObject:element];
      else 
        *aResult = element;
    }
  }
  
  if (array) {
    if (NS_SUCCEEDED(rv)) {
      ABSearchConjunction conjunction = operation == nsIAbBooleanOperationTypes::AND ? kABSearchAnd : kABSearchOr;
      *aResult = [ABSearchElement searchElementForConjunction:conjunction children:array];
    }
    [array release];
  }
  
  return rv;
}

static bool
Search(nsIAbBooleanExpression *aExpression, NSArray **aResult)
{
  bool canHandle = false;
  ABSearchElement *searchElement;
  nsresult rv = BuildSearchElements(aExpression, canHandle, &searchElement);
  NS_ENSURE_SUCCESS(rv, false);
  
  if (canHandle)
    *aResult = [[ABAddressBook sharedAddressBook] recordsMatchingSearchElement:searchElement];

  return canHandle;
}

static uint32_t sObserverCount = 0;
static ABChangedMonitor *sObserver = nullptr;

nsAbOSXDirectory::nsAbOSXDirectory()
{
}

nsAbOSXDirectory::~nsAbOSXDirectory()
{
  if (--sObserverCount == 0) {
    [[NSNotificationCenter defaultCenter] removeObserver:sObserver];
    [sObserver release];
  }
}

NS_IMPL_ISUPPORTS_INHERITED2(nsAbOSXDirectory,
                             nsAbDirProperty,
                             nsIAbOSXDirectory,
                             nsIAbDirSearchListener)

NS_IMETHODIMP
nsAbOSXDirectory::Init(const char *aUri)
{
  nsresult rv;
  rv = nsAbDirProperty::Init(aUri);
  NS_ENSURE_SUCCESS(rv, rv);

  ABAddressBook *addressBook = [ABAddressBook sharedAddressBook];
  if (sObserverCount == 0) {
    sObserver = [[ABChangedMonitor alloc] init];
    [[NSNotificationCenter defaultCenter] addObserver:(ABChangedMonitor*)sObserver
                                             selector:@selector(ABChanged:)
                                                 name:kABDatabaseChangedExternallyNotification
                                               object:nil];
  }
  ++sObserverCount;

  NSArray *cards;
  nsCOMPtr<nsIMutableArray> cardList;
  bool isRootOSXDirectory = false;

  if (!mIsQueryURI && mURINoQuery.Length() <= sizeof(NS_ABOSXDIRECTORY_URI_PREFIX))
    isRootOSXDirectory = true;

  if (mIsQueryURI || isRootOSXDirectory)
  {
    m_DirPrefId.AssignLiteral("ldap_2.servers.osx");

    cards = [[addressBook people] arrayByAddingObjectsFromArray:[addressBook groups]];
    if (!mCardList)
      mCardList = do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
    else
      rv = mCardList->Clear();
    NS_ENSURE_SUCCESS(rv, rv);

    cardList = mCardList;
  }
  else
  {
    nsAutoCString uid(Substring(mURINoQuery, sizeof(NS_ABOSXDIRECTORY_URI_PREFIX) - 1));
    ABRecord *card = [addressBook recordForUniqueId:[NSString stringWithUTF8String:uid.get()]];
    NS_ASSERTION([card isKindOfClass:[ABGroup class]], "Huh.");

    m_IsMailList = true;
    AppendToString([card valueForProperty:kABGroupNameProperty], m_ListDirName);

    ABGroup *group = (ABGroup*)[addressBook recordForUniqueId:[NSString stringWithUTF8String:nsAutoCString(Substring(mURINoQuery, 21)).get()]];
    cards = [[group members] arrayByAddingObjectsFromArray:[group subgroups]];

    if (!m_AddressList)
      m_AddressList = do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
    else
      rv = m_AddressList->Clear();
    NS_ENSURE_SUCCESS(rv, rv);

    cardList = m_AddressList;
  }


  nsAutoCString ourUuid;
  GetUuid(ourUuid);

  unsigned int nbCards = [cards count];
  nsCOMPtr<nsIAbCard> card;
  nsCOMPtr<nsIAbManager> abManager = do_GetService(NS_ABMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAbOSXDirectory> rootOSXDirectory;
  if (!isRootOSXDirectory)
  {
    rv = GetRootOSXDirectory(getter_AddRefs(rootOSXDirectory));
    NS_ENSURE_SUCCESS(rv, rv);
  }

  for (unsigned int i = 0; i < nbCards; ++i)
  {
    // If we're a Group, it's likely that the cards we're going
    // to create were already created in the root nsAbOSXDirectory,
    if (!isRootOSXDirectory)
      rv = GetCard([cards objectAtIndex:i], getter_AddRefs(card),
                   rootOSXDirectory);
    else
    {
      // If we're not a Group, that means we're the root nsAbOSXDirectory,
      // which means we have to create the cards from scratch.
      rv = CreateCard([cards objectAtIndex:i], getter_AddRefs(card));
    }

    NS_ENSURE_SUCCESS(rv, rv);

    // If we're not a query directory, we're going to want to
    // tell the AB Manager that we've added some cards so that they
    // show up in the address book views.
    if (!mIsQueryURI)
      AssertCard(abManager, card);

  }

  return NS_OK;
}

NS_IMETHODIMP
nsAbOSXDirectory::GetURI(nsACString &aURI)
{
  if (mURI.IsEmpty())
    return NS_ERROR_NOT_INITIALIZED;

  aURI = mURI;
  return NS_OK;
}

NS_IMETHODIMP
nsAbOSXDirectory::GetReadOnly(bool *aReadOnly)
{
  NS_ENSURE_ARG_POINTER(aReadOnly);

  *aReadOnly = true;
  return NS_OK;
}

static bool
CheckRedundantCards(nsIAbManager *aManager, nsIAbDirectory *aDirectory,
                    nsIAbCard *aCard, NSMutableArray *aCardList)
{
  nsresult rv;
  nsCOMPtr<nsIAbOSXCard> osxCard = do_QueryInterface(aCard, &rv);
  NS_ENSURE_SUCCESS(rv, false);

  nsAutoCString uri;
  rv = osxCard->GetURI(uri);
  NS_ENSURE_SUCCESS(rv, false);
  NSString *uid = [NSString stringWithUTF8String:(uri.get() + 21)];
  
  unsigned int i, count = [aCardList count];
  for (i = 0; i < count; ++i) {
    if ([[[aCardList objectAtIndex:i] uniqueId] isEqualToString:uid]) {
      [aCardList removeObjectAtIndex:i];
      break;
    }
  }

  if (i == count) {
    aManager->NotifyDirectoryItemDeleted(aDirectory, aCard);
    return true;
  }
  
  return false;
}

nsresult
nsAbOSXDirectory::GetRootOSXDirectory(nsIAbOSXDirectory **aResult)
{
  if (!mCacheTopLevelOSXAb)
  {
    // Attempt to get card from the toplevel directories
    nsresult rv;
    nsCOMPtr<nsIAbManager> abManager = do_GetService(NS_ABMANAGER_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIAbDirectory> directory;
    rv = abManager->GetDirectory(NS_LITERAL_CSTRING(NS_ABOSXDIRECTORY_URI_PREFIX"/"),
                                 getter_AddRefs(directory));
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIAbOSXDirectory> osxDirectory =
      do_QueryInterface(directory, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    mCacheTopLevelOSXAb = osxDirectory;
  }

  NS_IF_ADDREF(*aResult = mCacheTopLevelOSXAb);
  return NS_OK;
}

nsresult
nsAbOSXDirectory::Update()
{
  nsresult rv;
  nsCOMPtr<nsIAbManager> abManager = do_GetService(NS_ABMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  
  if (mIsQueryURI) {
    return NS_OK;
  }
  
  ABAddressBook *addressBook = [ABAddressBook sharedAddressBook];
  // Due to the horrible way the address book code works wrt mailing lists
  // we have to use a different list depending on what we are. This pointer
  // holds a reference to that list.
  nsIMutableArray* cardList;
  NSArray *groups, *cards;
  if (m_IsMailList) {
    ABGroup *group = (ABGroup*)[addressBook recordForUniqueId:[NSString stringWithUTF8String:nsAutoCString(Substring(mURINoQuery, 21)).get()]];
    groups = nil;
    cards = [[group members] arrayByAddingObjectsFromArray:[group subgroups]];

    if (!m_AddressList)
    {
      m_AddressList = do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
      NS_ENSURE_SUCCESS(rv, rv);
    }
    // For mailing lists, store the cards in m_AddressList
    cardList = m_AddressList;
  }
  else {
    groups = [addressBook groups];
    cards = [[addressBook people] arrayByAddingObjectsFromArray:groups];

    if (!mCardList)
    {
      mCardList = do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
      NS_ENSURE_SUCCESS(rv, rv);
    }
    // For directories, store the cards in mCardList
    cardList = mCardList;
  }
  
  NSMutableArray *mutableArray = [NSMutableArray arrayWithArray:cards];
  uint32_t addressCount;
  rv = cardList->GetLength(&addressCount);
  NS_ENSURE_SUCCESS(rv, rv);

  while (addressCount--)
  {
    nsCOMPtr<nsIAbCard> card(do_QueryElementAt(cardList, addressCount, &rv));
    if (NS_FAILED(rv))
      break;

    if (CheckRedundantCards(abManager, this, card, mutableArray))
      cardList->RemoveElementAt(addressCount);
  }
  
  NSEnumerator *enumerator = [mutableArray objectEnumerator];
  ABRecord *card;
  nsCOMPtr<nsIAbCard> abCard;
  nsCOMPtr<nsIAbOSXDirectory> rootOSXDirectory;
  rv = GetRootOSXDirectory(getter_AddRefs(rootOSXDirectory));
  NS_ENSURE_SUCCESS(rv, rv);

  while ((card = [enumerator nextObject]))
  {
    rv = GetCard(card, getter_AddRefs(abCard), rootOSXDirectory);
    if (NS_FAILED(rv))
      rv = CreateCard(card, getter_AddRefs(abCard));
    NS_ENSURE_SUCCESS(rv, rv);
    AssertCard(abManager, abCard);
  }
  
  card = (ABRecord*)[addressBook recordForUniqueId:[NSString stringWithUTF8String:nsAutoCString(Substring(mURINoQuery, 21)).get()]];
  NSString * stringValue = [card valueForProperty:kABGroupNameProperty];
  if (![stringValue isEqualToString:WrapString(m_ListDirName)])
  {
    nsAutoString oldValue(m_ListDirName);
    AssignToString(stringValue, m_ListDirName);
    nsCOMPtr<nsISupports> supports = do_QueryInterface(static_cast<nsIAbDirectory *>(this), &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    abManager->NotifyItemPropertyChanged(supports, "DirName",
                                         oldValue.get(), m_ListDirName.get());
  }
  
  if (groups)
  {
    mutableArray = [NSMutableArray arrayWithArray:groups];
    nsCOMPtr<nsIAbDirectory> directory;
    // It is ok to use m_AddressList here as only top-level directories have
    // groups, and they will be in m_AddressList
    if (m_AddressList)
    {
      rv = m_AddressList->GetLength(&addressCount);
      NS_ENSURE_SUCCESS(rv, rv);

      while (addressCount--)
      {
        directory = do_QueryElementAt(m_AddressList, addressCount, &rv);
        if (NS_FAILED(rv))
          continue;

        nsAutoCString uri;
        directory->GetURI(uri);
        uri.Cut(0, 21);
        NSString *uid = [NSString stringWithUTF8String:uri.get()];
        
        unsigned int j, arrayCount = [mutableArray count];
        for (j = 0; j < arrayCount; ++j) {
          if ([[[mutableArray objectAtIndex:j] uniqueId] isEqualToString:uid]) {
            [mutableArray removeObjectAtIndex:j];
            break;
          }
        }
        
        if (j == arrayCount) {
          UnassertDirectory(abManager, directory);
        }
      }
    }
    
    enumerator = [mutableArray objectEnumerator];
    while ((card = [enumerator nextObject])) {
      rv = GetOrCreateGroup([card uniqueId], getter_AddRefs(directory));
      NS_ENSURE_SUCCESS(rv, rv);
      
      AssertDirectory(abManager, directory);
    }
  }
  
  return NS_OK;
}

nsresult
nsAbOSXDirectory::AssertChildNodes()
{
  // Queries and mailing lists can't have childnodes.
  if (mIsQueryURI || m_IsMailList) {
    return NS_OK;
  }
  
  nsresult rv;
  nsCOMPtr<nsIAbManager> abManager =
    do_GetService(NS_ABMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  
  NSArray *groups = [[ABAddressBook sharedAddressBook] groups];
  
  unsigned int i, count = [groups count];
  
  if (count > 0 && !m_AddressList) {
    m_AddressList = do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
  }
  
  nsCOMPtr<nsIAbDirectory> directory;
  for (i = 0; i < count; ++i) {
    rv = GetOrCreateGroup([[groups objectAtIndex:i] uniqueId],
                          getter_AddRefs(directory));
    NS_ENSURE_SUCCESS(rv, rv);
    
    rv = AssertDirectory(abManager, directory);
    NS_ENSURE_SUCCESS(rv, rv);
  }
  
  return NS_OK;
}

nsresult
nsAbOSXDirectory::AssertDirectory(nsIAbManager *aManager,
                                  nsIAbDirectory *aDirectory)
{
  uint32_t pos;
  if (m_AddressList &&
      NS_SUCCEEDED(m_AddressList->IndexOf(0, aDirectory, &pos)))
    // We already have this directory, so no point in adding it again.
    return NS_OK;

  nsresult rv;
  if (!m_AddressList) {
    m_AddressList = do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
  }
  
  rv = m_AddressList->AppendElement(aDirectory, false);
  NS_ENSURE_SUCCESS(rv, rv);

  return aManager->NotifyDirectoryItemAdded(this, aDirectory);
}

nsresult
nsAbOSXDirectory::AssertCard(nsIAbManager *aManager,
                             nsIAbCard *aCard)
{
  nsAutoCString ourUuid;
  GetUuid(ourUuid);
  aCard->SetDirectoryId(ourUuid);

  nsresult rv = m_IsMailList ? m_AddressList->AppendElement(aCard, false) :
                               mCardList->AppendElement(aCard, false);
  NS_ENSURE_SUCCESS(rv, rv);

  // Get the card's URI and add it to our card store
  nsCOMPtr<nsIAbOSXCard> osxCard = do_QueryInterface(aCard, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCString uri;
  rv = osxCard->GetURI(uri);

  nsCOMPtr<nsIAbOSXCard> retrievedCard;
  if (!mCardStore.Get(uri, getter_AddRefs(retrievedCard)))
    mCardStore.Put(uri, osxCard);

  return aManager->NotifyDirectoryItemAdded(this, aCard);
}

nsresult
nsAbOSXDirectory::UnassertCard(nsIAbManager *aManager,
                               nsIAbCard *aCard,
                               nsIMutableArray *aCardList)
{
  nsresult rv;
  uint32_t pos;
  
  if (NS_SUCCEEDED(aCardList->IndexOf(0, aCard, &pos)))
    rv = aCardList->RemoveElementAt(pos);

  return aManager->NotifyDirectoryItemDeleted(this, aCard);
}

nsresult
nsAbOSXDirectory::UnassertDirectory(nsIAbManager *aManager,
                                    nsIAbDirectory *aDirectory)
{
  NS_ENSURE_TRUE(m_AddressList, NS_ERROR_NULL_POINTER);

  uint32_t pos;
  if (NS_SUCCEEDED(m_AddressList->IndexOf(0, aDirectory, &pos)))
  {
    nsresult rv = m_AddressList->RemoveElementAt(pos);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  return aManager->NotifyDirectoryItemDeleted(this, aDirectory);
}

NS_IMETHODIMP
nsAbOSXDirectory::GetChildNodes(nsISimpleEnumerator **aNodes)
{
  NS_ENSURE_ARG_POINTER(aNodes);
  
  // Queries don't have childnodes.
  if (mIsQueryURI || m_IsMailList || !m_AddressList)
    return NS_NewEmptyEnumerator(aNodes);
  
  return NS_NewArrayEnumerator(aNodes, m_AddressList);
}

NS_IMETHODIMP
nsAbOSXDirectory::GetChildCards(nsISimpleEnumerator **aCards)
{
  NS_ENSURE_ARG_POINTER(aCards);
  
  nsresult rv;
  NSArray *cards;
  if (mIsQueryURI)
  {
    nsCOMPtr<nsIAbBooleanExpression> expression;
    rv = nsAbQueryStringToExpression::Convert(mQueryString,
                                              getter_AddRefs(expression));
    NS_ENSURE_SUCCESS(rv, rv);
    
    bool canHandle = !m_IsMailList && Search(expression, &cards);
    if (!canHandle)
      return FallbackSearch(expression, aCards);

    if (!mCardList)
      mCardList = do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
    else
      mCardList->Clear();
    NS_ENSURE_SUCCESS(rv, rv);
  
    // The uuid for initializing cards
    nsAutoCString ourUuid;
    GetUuid(ourUuid);

    // Fill the results array and update the card list
    unsigned int nbCards = [cards count];
  
    unsigned int i;
    nsCOMPtr<nsIAbCard> card;
    nsCOMPtr<nsIAbOSXDirectory> rootOSXDirectory;
    rv = GetRootOSXDirectory(getter_AddRefs(rootOSXDirectory));
    NS_ENSURE_SUCCESS(rv, rv);

    for (i = 0; i < nbCards; ++i)
    {
      rv = GetCard([cards objectAtIndex:i], getter_AddRefs(card),
                   rootOSXDirectory);

      if (NS_FAILED(rv))
        rv = CreateCard([cards objectAtIndex:i],
                        getter_AddRefs(card));

      NS_ENSURE_SUCCESS(rv, rv);
      card->SetDirectoryId(ourUuid);

      mCardList->AppendElement(card, false);
    }

    return NS_NewArrayEnumerator(aCards, mCardList);
  }

  // Not a search, so just return the appropriate list of items.
  return m_IsMailList ? NS_NewArrayEnumerator(aCards, m_AddressList) :
         NS_NewArrayEnumerator(aCards, mCardList);
}

NS_IMETHODIMP
nsAbOSXDirectory::GetIsQuery(bool *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  *aResult = mIsQueryURI;
  return NS_OK;
}

/* Recursive method that searches for a child card by URI.  If it cannot find
 * it within this directory, it checks all subfolders.
 */
NS_IMETHODIMP
nsAbOSXDirectory::GetCardByUri(const nsACString &aUri, nsIAbOSXCard **aResult)
{
  nsCOMPtr<nsIAbOSXCard> osxCard;

  // Base Case
  if (mCardStore.Get(aUri, getter_AddRefs(osxCard)))
  {
    NS_IF_ADDREF(*aResult = osxCard);
    return NS_OK;
  }
  // Search children
  nsCOMPtr<nsISimpleEnumerator> enumerator;
  nsresult rv = this->GetChildNodes(getter_AddRefs(enumerator));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsISupports> item;
  bool hasMore = false;
  while (NS_SUCCEEDED(enumerator->HasMoreElements(&hasMore)) && hasMore)
  {
    rv = enumerator->GetNext(getter_AddRefs(item));
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIAbOSXDirectory> childDirectory;
    childDirectory = do_QueryInterface(item, &rv);
    if (NS_SUCCEEDED(rv))
    {
      rv = childDirectory->GetCardByUri(aUri, getter_AddRefs(osxCard));
      if (NS_SUCCEEDED(rv))
      {
        NS_IF_ADDREF(*aResult = osxCard);
        return NS_OK;
      }
    }
  }
  return NS_ERROR_FAILURE;
}

NS_IMETHODIMP
nsAbOSXDirectory::GetCardFromProperty(const char *aProperty,
                                      const nsACString &aValue,
                                      bool aCaseSensitive,
                                      nsIAbCard **aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);

  *aResult = nullptr;

  if (aValue.IsEmpty())
    return NS_OK;

  nsIMutableArray *list = m_IsMailList ? m_AddressList : mCardList;

  if (!list)
    return NS_OK;

  uint32_t length;
  nsresult rv = list->GetLength(&length);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAbCard> card;
  nsAutoCString cardValue;

  for (uint32_t i = 0; i < length && !*aResult; ++i)
  {
    card = do_QueryElementAt(list, i, &rv);
    if (NS_SUCCEEDED(rv))
    {
      rv = card->GetPropertyAsAUTF8String(aProperty, cardValue);
      if (NS_SUCCEEDED(rv))
      {
#ifdef MOZILLA_INTERNAL_API
        bool equal = aCaseSensitive ? cardValue.Equals(aValue) :
          cardValue.Equals(aValue, nsCaseInsensitiveCStringComparator());
#else
        bool equal = aCaseSensitive ? cardValue.Equals(aValue) :
          cardValue.Equals(aValue, CaseInsensitiveCompare);
#endif
        if (equal)
          NS_IF_ADDREF(*aResult = card);
      }
    }
  }
  return NS_OK;
}

NS_IMETHODIMP
nsAbOSXDirectory::GetCardsFromProperty(const char *aProperty,
                                       const nsACString &aValue,
                                       bool aCaseSensitive,
                                       nsISimpleEnumerator **aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);

  *aResult = nullptr;

  if (aValue.IsEmpty())
    return NS_NewEmptyEnumerator(aResult);

  nsIMutableArray *list = m_IsMailList ? m_AddressList : mCardList;

  if (!list)
    return NS_NewEmptyEnumerator(aResult);

  uint32_t length;
  nsresult rv = list->GetLength(&length);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMArray<nsIAbCard> resultArray;
  nsCOMPtr<nsIAbCard> card;
  nsAutoCString cardValue;

  for (uint32_t i = 0; i < length; ++i)
  {
    card = do_QueryElementAt(list, i, &rv);
    if (NS_SUCCEEDED(rv))
    {
      rv = card->GetPropertyAsAUTF8String(aProperty, cardValue);
      if (NS_SUCCEEDED(rv))
      {
#ifdef MOZILLA_INTERNAL_API
        bool equal = aCaseSensitive ? cardValue.Equals(aValue) :
          cardValue.Equals(aValue, nsCaseInsensitiveCStringComparator());
#else
        bool equal = aCaseSensitive ? cardValue.Equals(aValue) :
          cardValue.Equals(aValue, CaseInsensitiveCompare);
#endif
        if (equal)
          resultArray.AppendObject(card);
      }
    }
  }

  return NS_NewArrayEnumerator(aResult, resultArray);
}

NS_IMETHODIMP
nsAbOSXDirectory::CardForEmailAddress(const nsACString &aEmailAddress,
                                      nsIAbCard **aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);

  *aResult = nullptr;

  if (aEmailAddress.IsEmpty())
    return NS_OK;

  nsIMutableArray *list = m_IsMailList ? m_AddressList : mCardList;

  if (!list)
    return NS_OK;

  uint32_t length;
  nsresult rv = list->GetLength(&length);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAbCard> card;

  for (uint32_t i = 0; i < length && !*aResult; ++i)
  {
    card = do_QueryElementAt(list, i, &rv);
    if (NS_SUCCEEDED(rv))
    {
      bool hasEmailAddress = false;

      rv = card->HasEmailAddress(aEmailAddress, &hasEmailAddress);
      if (NS_SUCCEEDED(rv) && hasEmailAddress)
        NS_IF_ADDREF(*aResult = card);
    }
  }
  return NS_OK;
}

NS_IMETHODIMP
nsAbOSXDirectory::HasCard(nsIAbCard *aCard, bool *aHasCard)
{
  NS_ENSURE_ARG_POINTER(aCard);
  NS_ENSURE_ARG_POINTER(aHasCard);

  nsresult rv = NS_OK;
  uint32_t index;
  if (m_IsMailList)
  {
    if (m_AddressList)
      rv = m_AddressList->IndexOf(0, aCard, &index);
  }
  else if (mCardList)
    rv = mCardList->IndexOf(0, aCard, &index);

  *aHasCard = NS_SUCCEEDED(rv);

  return NS_OK;
}

NS_IMETHODIMP
nsAbOSXDirectory::HasDirectory(nsIAbDirectory *aDirectory,
                               bool *aHasDirectory)
{
  NS_ENSURE_ARG_POINTER(aDirectory);
  NS_ENSURE_ARG_POINTER(aHasDirectory);
  
  *aHasDirectory = false;

  uint32_t pos;
  if (m_AddressList && NS_SUCCEEDED(m_AddressList->IndexOf(0, aDirectory, &pos)))
    *aHasDirectory = true;

  return NS_OK;
}

NS_IMETHODIMP
nsAbOSXDirectory::OnSearchFinished(int32_t aResult, const nsAString &aErrorMsg)
{
  return NS_OK;
}

NS_IMETHODIMP
nsAbOSXDirectory::OnSearchFoundCard(nsIAbCard *aCard)
{
  nsresult rv;
  if (!m_AddressList) {
    m_AddressList = do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
  }
  
  if (!mCardList) {
    mCardList = do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  rv = m_AddressList->AppendElement(aCard, false);
  NS_ENSURE_SUCCESS(rv, rv);
  
  rv = mCardList->AppendElement(aCard, false);
  NS_ENSURE_SUCCESS(rv, rv);

  nsAutoCString ourUuid;
  GetUuid(ourUuid);
  aCard->SetDirectoryId(ourUuid);
  
  return NS_OK;
}

nsresult
nsAbOSXDirectory::FallbackSearch(nsIAbBooleanExpression *aExpression,
                                 nsISimpleEnumerator **aCards)
{
  nsresult rv;
  
  if (mCardList)
    rv = mCardList->Clear();
  else
    mCardList = do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  
  if (m_AddressList) {
    m_AddressList->Clear();
  }
  else {
    m_AddressList = do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
  }
  
  nsCOMPtr<nsIAbDirectoryQueryArguments> arguments =
    do_CreateInstance(NS_ABDIRECTORYQUERYARGUMENTS_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  
  rv = arguments->SetExpression(aExpression);
  NS_ENSURE_SUCCESS(rv, rv);
  
  // Don't search the subdirectories. If the current directory is a mailing
  // list, it won't have any subdirectories. If the current directory is an
  // addressbook, searching both it and the subdirectories (the mailing
  // lists), will yield duplicate results because every entry in a mailing
  // list will be an entry in the parent addressbook.
  rv = arguments->SetQuerySubDirectories(false);
  NS_ENSURE_SUCCESS(rv, rv);
  
  // Get the directory without the query
  nsCOMPtr<nsIAbManager> abManager = do_GetService(NS_ABMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAbDirectory> directory;
  rv = abManager->GetDirectory(mURINoQuery, getter_AddRefs(directory));
  NS_ENSURE_SUCCESS(rv, rv);

  // Initiate the proxy query with the no query directory
  nsCOMPtr<nsIAbDirectoryQueryProxy> queryProxy = 
    do_CreateInstance(NS_ABDIRECTORYQUERYPROXY_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  
  rv = queryProxy->Initiate();
  NS_ENSURE_SUCCESS(rv, rv);
  
  int32_t context = 0;
  rv = queryProxy->DoQuery(directory, arguments, this, -1, 0, &context);
  NS_ENSURE_SUCCESS(rv, rv);
  
  return NS_NewArrayEnumerator(aCards, m_AddressList);
}

nsresult nsAbOSXDirectory::DeleteUid(const nsACString &aUid)
{
  if (!m_AddressList)
    return NS_ERROR_NULL_POINTER;

  nsresult rv;
  nsCOMPtr<nsIAbManager> abManager =
    do_GetService(NS_ABMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  // At this stage we don't know if aUid represents a card or group. The OS X
  // interfaces don't give us chance to find out, so we have to go through
  // our lists to find it.

  // First, we'll see if its in the group list as it is likely to be shorter.

  // See if this item is in our address list
  uint32_t addressCount;
  rv = m_AddressList->GetLength(&addressCount);
  NS_ENSURE_SUCCESS(rv, rv);

  nsAutoCString uri(NS_ABOSXDIRECTORY_URI_PREFIX);
  uri.Append(aUid);

  // Iterate backwards in case we remove something
  while (addressCount--)
  {
    nsCOMPtr<nsIAbItem> abItem(do_QueryElementAt(m_AddressList,
                                                 addressCount, &rv));
    if (NS_FAILED(rv))
      continue;

    nsCOMPtr<nsIAbDirectory> directory(do_QueryInterface(abItem, &rv));
    if (NS_SUCCEEDED(rv))
    {
      nsAutoCString dirUri;
      directory->GetURI(dirUri);
      if (uri.Equals(dirUri))
        return UnassertDirectory(abManager, directory);
    } else {
      nsCOMPtr<nsIAbOSXCard> osxCard(do_QueryInterface(abItem, &rv));
      if (NS_SUCCEEDED(rv))
      {
        nsAutoCString cardUri;
        osxCard->GetURI(cardUri);
        if (uri.Equals(cardUri))
        {
          nsCOMPtr<nsIAbCard> card(do_QueryInterface(osxCard, &rv));
          if (NS_SUCCEEDED(rv))
            return UnassertCard(abManager, card, m_AddressList);
        }
      }
    }
  }

  // Second, see if it is one of the cards.
  if (!mCardList)
    return NS_ERROR_FAILURE;

  uri = NS_ABOSXCARD_URI_PREFIX;
  uri.Append(aUid);

  rv = mCardList->GetLength(&addressCount);
  NS_ENSURE_SUCCESS(rv, rv);

  while (addressCount--)
  {
    nsCOMPtr<nsIAbOSXCard> osxCard(do_QueryElementAt(mCardList, addressCount, &rv));
    if (NS_FAILED(rv))
      continue;

    nsAutoCString cardUri;
    osxCard->GetURI(cardUri);

    if (uri.Equals(cardUri)) {
      nsCOMPtr<nsIAbCard> card(do_QueryInterface(osxCard, &rv));
      if (NS_SUCCEEDED(rv))
        return UnassertCard(abManager, card, mCardList);
    }
  }
  return NS_OK;
}
