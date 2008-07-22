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
* Peter Van der Beken.
* Portions created by the Initial Developer are Copyright (C) 2004
* the Initial Developer. All Rights Reserved.
*
* Contributor(s):
*   Peter Van der Beken <peterv@propagandism.org>
*
*
* Alternatively, the contents of this file may be used under the terms of
* either the GNU General Public License Version 2 or later (the "GPL"), or
* the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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
#include "nsIRDFService.h"
#include "nsServiceManagerUtils.h"
#include "nsIMutableArray.h"
#include "nsArrayUtils.h"
#include "nsIAbBooleanExpression.h"
#include "nsComponentManagerUtils.h"

#include <AddressBook/AddressBook.h>
#if (MAC_OS_X_VERSION_MAX_ALLOWED < MAC_OS_X_VERSION_10_3)
#define kABDeletedRecords @"ABDeletedRecords"
#define kABUpdatedRecords @"ABUpdatedRecords"
#define kABInsertedRecords @"ABInsertedRecords"
#elif (MAC_OS_X_VERSION_MIN_REQUIRED < MAC_OS_X_VERSION_10_3)
#define kABDeletedRecords (kABDeletedRecords? kABDeletedRecords : @"ABDeletedRecords")
#define kABUpdatedRecords (kABUpdatedRecords ? kABUpdatedRecords : @"ABUpdatedRecords")
#define kABInsertedRecords (kABInsertedRecords ? kABInsertedRecords : @"ABInsertedRecords")
#endif

static nsresult
ConvertToGroupResource(nsIRDFService *aRDFService, NSString *aUid,
                       nsIAbDirectory **aResult)
{
  NS_ASSERTION(aUid, "No UID for group!.");
  
  *aResult = nsnull;
  
  nsCAutoString uri(NS_ABOSXDIRECTORY_URI_PREFIX);
  AppendToCString(aUid, uri);
  
  nsCOMPtr<nsIRDFResource> resource;
  nsresult rv = aRDFService->GetResource(uri, getter_AddRefs(resource));
  NS_ENSURE_SUCCESS(rv, rv);
  
  return CallQueryInterface(resource, aResult);
}

static nsresult
ConvertToCard(nsIRDFService *aRDFService, ABRecord *aRecord,
              nsIAbCard **aResult)
{
  *aResult = nsnull;
  
  NSString *uid = [aRecord uniqueId];
  NS_ASSERTION(uid, "No UID for card!.");
  if (!uid)
    return NS_ERROR_FAILURE;
  
  nsCAutoString uri(NS_ABOSXCARD_URI_PREFIX);
  AppendToCString(uid, uri);
  
  nsCOMPtr<nsIRDFResource> resource;
  nsresult rv = aRDFService->GetResource(uri, getter_AddRefs(resource));
  NS_ENSURE_SUCCESS(rv, rv);
  
  return CallQueryInterface(resource, aResult);
}

static nsresult
Update(nsIRDFService *aRDFService, NSString *aUid)
{
  ABAddressBook *addressBook = [ABAddressBook sharedAddressBook];
  ABRecord *card = [addressBook recordForUniqueId:aUid];
  if ([card isKindOfClass:[ABGroup class]]) {
    nsCOMPtr<nsIAbDirectory> directory;
    ConvertToGroupResource(aRDFService, aUid, getter_AddRefs(directory));
    nsCOMPtr<nsIAbOSXDirectory> osxDirectory =
      do_QueryInterface(directory);
    
    osxDirectory->Update();
  }
  else {
    nsCOMPtr<nsIAbCard> abCard;
    ConvertToCard(aRDFService, card, getter_AddRefs(abCard));
    nsCOMPtr<nsIAbOSXCard> osxCard = do_QueryInterface(abCard);
    
    osxCard->Update(PR_TRUE);
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
  nsCOMPtr<nsIRDFService> rdfService =
    do_GetService("@mozilla.org/rdf/rdf-service;1", &rv);
  NS_ENSURE_SUCCESS(rv, );
  
  NSArray *inserted = [changes objectForKey:kABInsertedRecords];
  if (inserted) {
    nsCOMPtr<nsIRDFResource> resource;
    rv = rdfService->GetResource(NS_LITERAL_CSTRING(NS_ABOSXDIRECTORY_URI_PREFIX"/"),
                                 getter_AddRefs(resource));
    NS_ENSURE_SUCCESS(rv, );
    
    nsCOMPtr<nsIAbOSXDirectory> osxDirectory =
      do_QueryInterface(resource, &rv);
    NS_ENSURE_SUCCESS(rv, );
    
    nsCOMPtr<nsIAbManager> abManager =
      do_GetService(NS_ABMANAGER_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, );
    
    unsigned int i, count = [inserted count];
    for (i = 0; i < count; ++i) {
      ABAddressBook *addressBook =
      [ABAddressBook sharedAddressBook];
      ABRecord *card =
        [addressBook recordForUniqueId:[inserted objectAtIndex:i]];
      if ([card isKindOfClass:[ABGroup class]]) {
        nsCOMPtr<nsIAbDirectory> directory;
        ConvertToGroupResource(rdfService, [inserted objectAtIndex:i],
                               getter_AddRefs(directory));
        
        rv = osxDirectory->AssertDirectory(abManager, directory);
        NS_ENSURE_SUCCESS(rv, );
      }
      else {
        nsCOMPtr<nsIAbCard> abCard;
        ConvertToCard(rdfService, card, getter_AddRefs(abCard));
        
        rv = osxDirectory->AssertCard(abManager, abCard);
        NS_ENSURE_SUCCESS(rv, );
      }
    }
  }
  
  NSArray *updated = [changes objectForKey:kABUpdatedRecords];
  if (updated) {
    unsigned int i, count = [updated count];
    for (i = 0; i < count; ++i) {
      NSString *uid = [updated objectAtIndex:i];
      Update(rdfService, uid);
    }
  }
  
  NSArray *deleted = [changes objectForKey:kABDeletedRecords];
  if (deleted) {
    nsCOMPtr<nsIRDFResource> resource;
    rv = rdfService->GetResource(NS_LITERAL_CSTRING(NS_ABOSXDIRECTORY_URI_PREFIX"/"),
                                 getter_AddRefs(resource));
    NS_ENSURE_SUCCESS(rv, );
    
    nsCOMPtr<nsIAbOSXDirectory> osxDirectory =
      do_QueryInterface(resource, &rv);
    NS_ENSURE_SUCCESS(rv, );

    unsigned int i, count = [deleted count];
    for (i = 0; i < count; ++i) {
      NSString *deletedUid = [deleted objectAtIndex:i];

      nsCAutoString uid;
      AppendToCString(deletedUid, uid);

      rv = osxDirectory->DeleteUid(uid);
      NS_ENSURE_SUCCESS(rv, );
    }
  }
  
  if (!inserted && !updated && !deleted) {
    // XXX This is supposed to mean "everything was updated", but we get
    //     this whenever something has changed, so not sure what to do.
  }
}
@end

static nsresult
MapConditionString(nsIAbBooleanConditionString *aCondition, PRBool aNegate,
                   PRBool &aCanHandle, ABSearchElement **aResult)
{
  aCanHandle = PR_FALSE;
  
  nsAbBooleanConditionType conditionType = 0;
  nsresult rv = aCondition->GetCondition(&conditionType);
  NS_ENSURE_SUCCESS(rv, rv);
  
  ABSearchComparison comparison;
  switch (conditionType) {
    case nsIAbBooleanConditionTypes::Contains:
    {
      if (!aNegate) {
        comparison = kABContainsSubString;
        aCanHandle = PR_TRUE;
      }
      break;
    }
    case nsIAbBooleanConditionTypes::DoesNotContain:
    {
      if (aNegate) {
        comparison = kABContainsSubString;
        aCanHandle = PR_TRUE;
      }
      break;
    }
    case nsIAbBooleanConditionTypes::Is:
    {
      comparison = aNegate ? kABNotEqual : kABEqual;
      aCanHandle = PR_TRUE;
      break;
    }
    case nsIAbBooleanConditionTypes::IsNot:
    {
      comparison = aNegate ? kABEqual : kABNotEqual;
      aCanHandle = PR_TRUE;
      break;
    }
    case nsIAbBooleanConditionTypes::BeginsWith:
    {
      if (!aNegate) {
        comparison = kABPrefixMatch;
        aCanHandle = PR_TRUE;
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
      aCanHandle = PR_TRUE;
      break;
    }
    case nsIAbBooleanConditionTypes::GreaterThan:
    {
      comparison = aNegate ? kABLessThanOrEqual : kABGreaterThan;
      aCanHandle = PR_TRUE;
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
  
  PRUint32 length = value.Length();
  
  PRUint32 i;
  for (i = 0; i < nsAbOSXUtils::kPropertyMapSize; ++i) {
    if (name.Equals(nsAbOSXUtils::kPropertyMap[i].mPropertyName)) {
      *aResult =
      [ABPerson searchElementForProperty:nsAbOSXUtils::kPropertyMap[i].mOSXProperty
                                   label:nsAbOSXUtils::kPropertyMap[i].mOSXLabel
                                     key:nsAbOSXUtils::kPropertyMap[i].mOSXKey
                                   value:[NSString stringWithCharacters:value.get() length:length]
                              comparison:comparison];
      
      return NS_OK;
    }
  }
  
  if (name.EqualsLiteral("DisplayName") && comparison == kABContainsSubString) {
    ABSearchElement *first =
    [ABPerson searchElementForProperty:kABFirstNameProperty
                                 label:nil
                                   key:nil
                                 value:[NSString stringWithCharacters:value.get() length:length]
                            comparison:comparison];
    ABSearchElement *second =
      [ABPerson searchElementForProperty:kABLastNameProperty
                                   label:nil
                                     key:nil
                                   value:[NSString stringWithCharacters:value.get() length:length]
                              comparison:comparison];
    ABSearchElement *third =
      [ABGroup searchElementForProperty:kABGroupNameProperty
                                  label:nil
                                    key:nil
                                  value:[NSString stringWithCharacters:value.get() length:length]
                             comparison:comparison];
    
    *aResult = [ABSearchElement searchElementForConjunction:kABSearchOr children:[NSArray arrayWithObjects:first, second, third, nil]];
    
    return NS_OK;
  }
  
  aCanHandle = PR_FALSE;
  
  return NS_OK;
}

static nsresult
BuildSearchElements(nsIAbBooleanExpression *aExpression,
                    PRBool &aCanHandle,
                    ABSearchElement **aResult)
{
  aCanHandle = PR_TRUE;
  
  nsCOMPtr<nsIArray> expressions;
  nsresult rv = aExpression->GetExpressions(getter_AddRefs(expressions));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsAbBooleanOperationType operation;
  rv = aExpression->GetOperation(&operation);
  NS_ENSURE_SUCCESS(rv, rv);
  
  PRUint32 count;
  rv = expressions->GetLength(&count);
  NS_ENSURE_SUCCESS(rv, rv);
  
  NS_ASSERTION(count > 1 && operation != nsIAbBooleanOperationTypes::NOT,
               "This doesn't make sense!");
  
  NSMutableArray *array = nsnull;
  if (count > 1)
    array = [[NSMutableArray alloc] init];
  
  PRUint32 i;
  nsCOMPtr<nsIAbBooleanConditionString> condition;
  nsCOMPtr<nsIAbBooleanExpression> subExpression;
  for (i = 0; i < count; ++i) {
    ABSearchElement *element = nsnull;
    
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

static PRBool
Search(nsIAbBooleanExpression *aExpression, NSArray **aResult)
{
  PRBool canHandle = PR_FALSE;
  ABSearchElement *searchElement;
  nsresult rv = BuildSearchElements(aExpression, canHandle, &searchElement);
  NS_ENSURE_SUCCESS(rv, PR_FALSE);
  
  if (canHandle)
    *aResult = [[ABAddressBook sharedAddressBook] recordsMatchingSearchElement:searchElement];
  
  return canHandle;
}

static PRUint32 sObserverCount = 0;
static ABChangedMonitor *sObserver = nsnull;

nsAbOSXDirectory::~nsAbOSXDirectory()
{
  if (--sObserverCount == 0) {
    [[NSNotificationCenter defaultCenter] removeObserver:sObserver];
    [sObserver release];
  }
}

NS_IMPL_ISUPPORTS_INHERITED3(nsAbOSXDirectory,
                             nsAbDirectoryRDFResource,
                             nsIAbDirectory,
                             nsIAbOSXDirectory,
                             nsIAbDirSearchListener)

NS_IMETHODIMP
nsAbOSXDirectory::Init(const char *aUri)
{
  ABAddressBook *addressBook = [ABAddressBook sharedAddressBook];
  if (sObserverCount == 0) {
    sObserver = [[ABChangedMonitor alloc] init];
    [[NSNotificationCenter defaultCenter] addObserver:(ABChangedMonitor*)sObserver
                                             selector:@selector(ABChanged:)
                                                 name:kABDatabaseChangedExternallyNotification
                                               object:nil];
  }
  ++sObserverCount;
  
  nsresult rv = nsAbDirectoryRDFResource::Init(aUri);
  NS_ENSURE_SUCCESS(rv, rv);
  
  NSArray *cards;
  nsCOMPtr<nsIMutableArray> cardList;
  if (mURINoQuery.Length() > sizeof(NS_ABOSXDIRECTORY_URI_PREFIX))
  {
    nsCAutoString uid(Substring(mURINoQuery, sizeof(NS_ABOSXDIRECTORY_URI_PREFIX) - 1));
    ABRecord *card = [addressBook recordForUniqueId:[NSString stringWithUTF8String:uid.get()]];
    NS_ASSERTION([card isKindOfClass:[ABGroup class]], "Huh.");
    
    m_IsMailList = PR_TRUE;
    AppendToString([card valueForProperty:kABGroupNameProperty], m_ListDirName);

    ABGroup *group = (ABGroup*)[addressBook recordForUniqueId:[NSString stringWithUTF8String:nsCAutoString(Substring(mURINoQuery, 21)).get()]];
    cards = [[group members] arrayByAddingObjectsFromArray:[group subgroups]];
    if (!m_AddressList)
      m_AddressList = do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
    else
      rv = m_AddressList->Clear();
    NS_ENSURE_SUCCESS(rv, rv);

    cardList = m_AddressList;
  }
  else
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

  unsigned int nbCards = [cards count];
  nsCOMPtr<nsIAbCard> card;
  for (unsigned int i = 0; i < nbCards; ++i)
  {
    rv = ConvertToCard(gRDFService, [cards objectAtIndex:i],
                       getter_AddRefs(card));
    NS_ENSURE_SUCCESS(rv, rv);

    cardList->AppendElement(card, PR_FALSE);
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
nsAbOSXDirectory::GetOperations(PRInt32 *aOperations)
{
  *aOperations = nsIAbDirectory::opRead |
  nsIAbDirectory::opSearch;
  
  return NS_OK;
}

static PRBool
CheckRedundantCards(nsIAbManager *aManager, nsIAbDirectory *aDirectory,
                    nsIAbCard *aCard, NSMutableArray *aCardList)
{
  nsCOMPtr<nsIRDFResource> resource(do_QueryInterface(aCard));
  if (!resource)
    return PR_FALSE;
  
  const char* uri;
  resource->GetValueConst(&uri);
  NSString *uid = [NSString stringWithUTF8String:(uri + 21)];
  
  unsigned int i, count = [aCardList count];
  for (i = 0; i < count; ++i) {
    if ([[[aCardList objectAtIndex:i] uniqueId] isEqualToString:uid]) {
      [aCardList removeObjectAtIndex:i];
      break;
    }
  }

  if (i == count) {
    aManager->NotifyDirectoryItemDeleted(aDirectory, aCard);
    return PR_TRUE;
  }
  
  return PR_FALSE;
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
    ABGroup *group = (ABGroup*)[addressBook recordForUniqueId:[NSString stringWithUTF8String:nsCAutoString(Substring(mURINoQuery, 21)).get()]];
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
  PRUint32 addressCount;
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
  while ((card = [enumerator nextObject])) {
    rv = ConvertToCard(gRDFService, card, getter_AddRefs(abCard));
    NS_ENSURE_SUCCESS(rv, rv);

    AssertCard(abManager, abCard);
  }
  
  card = (ABRecord*)[addressBook recordForUniqueId:[NSString stringWithUTF8String:nsCAutoString(Substring(mURINoQuery, 21)).get()]];
  NSString * stringValue = [card valueForProperty:kABGroupNameProperty];
  if (![stringValue isEqualToString:WrapString(m_ListDirName)]) {
    nsAutoString oldValue(m_ListDirName);
    AssignToString(stringValue, m_ListDirName);
    nsISupports *supports =
      NS_ISUPPORTS_CAST(nsAbDirectoryRDFResource*, this);
    abManager->NotifyItemPropertyChanged(supports, "DirName",
                                         oldValue.get(), m_ListDirName.get());
  }
  
  if (groups) {
    mutableArray = [NSMutableArray arrayWithArray:groups];
    nsCOMPtr<nsIAbDirectory> directory;
    // It is ok to use m_AddressList here as only top-level directories have
    // groups, and they will be in m_AddressList
    if (m_AddressList) {
      rv = m_AddressList->GetLength(&addressCount);
      NS_ENSURE_SUCCESS(rv, rv);

      while (addressCount--)
      {
        directory = do_QueryElementAt(m_AddressList, addressCount, &rv);
        if (NS_FAILED(rv))
          continue;

        nsCAutoString uri;
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
      rv = ConvertToGroupResource(gRDFService, [card uniqueId],
                                  getter_AddRefs(directory));
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
    rv = ConvertToGroupResource(gRDFService, [[groups objectAtIndex:i] uniqueId],
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
#if _DEBUG
  PRUint32 pos;
  NS_ASSERTION(!m_AddressList || 
      NS_FAILED(m_AddressList->IndexOf(0, aDirectory, &pos)), "Replacing?");
#endif
  
  nsresult rv;
  if (!m_AddressList) {
    m_AddressList = do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
  }
  
  rv = m_AddressList->AppendElement(aDirectory, PR_FALSE);
  NS_ENSURE_SUCCESS(rv, rv);

  return aManager->NotifyDirectoryItemAdded(this, aDirectory);
}

nsresult
nsAbOSXDirectory::AssertCard(nsIAbManager *aManager,
                             nsIAbCard *aCard)
{
  nsresult rv = m_IsMailList ? m_AddressList->AppendElement(aCard, PR_FALSE) :
                               mCardList->AppendElement(aCard, PR_FALSE);
  NS_ENSURE_SUCCESS(rv, rv);

  return aManager->NotifyDirectoryItemAdded(this, aCard);
}

nsresult
nsAbOSXDirectory::UnassertCard(nsIAbManager *aManager,
                               nsIAbCard *aCard,
                               nsIMutableArray *aCardList)
{
  nsresult rv;
  PRUint32 pos;
  
  if (NS_SUCCEEDED(aCardList->IndexOf(0, aCard, &pos)))
    rv = aCardList->RemoveElementAt(pos);

  return aManager->NotifyDirectoryItemDeleted(this, aCard);
}

nsresult
nsAbOSXDirectory::UnassertDirectory(nsIAbManager *aManager,
                                    nsIAbDirectory *aDirectory)
{
  NS_ENSURE_TRUE(m_AddressList, NS_ERROR_NULL_POINTER);

  PRUint32 pos;
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
    rv = nsAbQueryStringToExpression::Convert(mQueryString.get(),
                                              getter_AddRefs(expression));
    NS_ENSURE_SUCCESS(rv, rv);
    
    PRBool canHandle = !m_IsMailList && Search(expression, &cards);
    if (!canHandle)
      return FallbackSearch(expression, aCards);

    if (!mCardList)
      mCardList = do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
    else
      mCardList->Clear();
    NS_ENSURE_SUCCESS(rv, rv);
  
    // Fill the results array and update the card list
    unsigned int nbCards = [cards count];
  
    unsigned int i;
    nsCOMPtr<nsIAbCard> card;
    for (i = 0; i < nbCards; ++i)
    {
      rv = ConvertToCard(gRDFService, [cards objectAtIndex:i],
                         getter_AddRefs(card));
      NS_ENSURE_SUCCESS(rv, rv);

      mCardList->AppendElement(card, PR_FALSE);
    }

    return NS_NewArrayEnumerator(aCards, mCardList);
  }

  // Not a search, so just return the appropriate list of items.
  return m_IsMailList ? NS_NewArrayEnumerator(aCards, m_AddressList) :
         NS_NewArrayEnumerator(aCards, mCardList);
}

NS_IMETHODIMP
nsAbOSXDirectory::HasCard(nsIAbCard *aCard, PRBool *aHasCard)
{
  NS_ENSURE_ARG_POINTER(aCard);
  NS_ENSURE_ARG_POINTER(aHasCard);

  nsresult rv = NS_OK;
  PRUint32 index;
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
                               PRBool *aHasDirectory)
{
  NS_ENSURE_ARG_POINTER(aDirectory);
  NS_ENSURE_ARG_POINTER(aHasDirectory);
  
  *aHasDirectory = PR_FALSE;

  PRUint32 pos;
  if (m_AddressList && NS_SUCCEEDED(m_AddressList->IndexOf(0, aDirectory, &pos)))
    *aHasDirectory = PR_TRUE;

  return NS_OK;
}

NS_IMETHODIMP
nsAbOSXDirectory::OnSearchFinished(PRInt32 aResult, const nsAString &aErrorMsg)
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

  rv = m_AddressList->AppendElement(aCard, PR_FALSE);
  NS_ENSURE_SUCCESS(rv, rv);
  
  rv = mCardList->AppendElement(aCard, PR_FALSE);
  NS_ENSURE_SUCCESS(rv, rv);
  
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
  rv = arguments->SetQuerySubDirectories(PR_FALSE);
  NS_ENSURE_SUCCESS(rv, rv);
  
  // Get the directory without the query
  nsCOMPtr<nsIRDFResource> resource;
  rv = gRDFService->GetResource(mURINoQuery, getter_AddRefs(resource));
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<nsIAbDirectory> directory = do_QueryInterface(resource, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  
  // Initiate the proxy query with the no query directory
  nsCOMPtr<nsIAbDirectoryQueryProxy> queryProxy = 
    do_CreateInstance(NS_ABDIRECTORYQUERYPROXY_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  
  rv = queryProxy->Initiate();
  NS_ENSURE_SUCCESS(rv, rv);
  
  PRInt32 context = 0;
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
  PRUint32 addressCount;
  rv = m_AddressList->GetLength(&addressCount);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCAutoString uri(NS_ABOSXDIRECTORY_URI_PREFIX);
  uri.Append(aUid);

  // Iterate backwards in case we remove something
  while (addressCount--)
  {
    nsCOMPtr<nsIRDFResource> resource(do_QueryElementAt(m_AddressList,
                                                        addressCount, &rv));
    if (NS_SUCCEEDED(rv))
    {
      const char* dirUri;
      resource->GetValueConst(&dirUri);
      if (uri.Equals(dirUri))
      {
        nsCOMPtr<nsIAbDirectory> directory(do_QueryInterface(resource, &rv));
        if (NS_SUCCEEDED(rv))
          // Match found, do the necessary and get out of here.
          return UnassertDirectory(abManager, directory);
        else
        {
          nsCOMPtr<nsIAbCard> card(do_QueryInterface(resource, &rv));
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
    nsCOMPtr<nsIAbCard> card(do_QueryElementAt(mCardList, addressCount, &rv));
    if (NS_FAILED(rv))
      continue;

    nsCOMPtr<nsIRDFResource> resource(do_QueryInterface(card));
    if (!resource)
      continue;

    const char* cardUri;
    resource->GetValueConst(&cardUri);

    if (uri.Equals(cardUri))
      return UnassertCard(abManager, card, mCardList);
  }
  return NS_OK;
}
