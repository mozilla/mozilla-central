/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsAbMDBDirectory.h" 
#include "nsStringGlue.h"
#include "nsCOMPtr.h"
#include "nsAbBaseCID.h"
#include "nsAddrDatabase.h"
#include "nsIAbListener.h"
#include "nsIAbManager.h"
#include "nsIURL.h"
#include "nsNetCID.h"
#include "nsAbDirectoryQuery.h"
#include "nsIAbDirectoryQueryProxy.h"
#include "nsAbQueryStringToExpression.h"
#include "nsIMutableArray.h"
#include "nsArrayEnumerator.h"
#include "nsEnumeratorUtils.h"
#include "mdb.h"
#include "prprf.h"
#include "nsIPrefService.h"
#include "nsAppDirectoryServiceDefs.h"
#include "nsDirectoryServiceUtils.h"
#include "nsIFile.h"
#include "nsComponentManagerUtils.h"
#include "nsMemory.h"
#include "nsArrayUtils.h"
#include "nsUnicharUtils.h"

nsAbMDBDirectory::nsAbMDBDirectory(void):
     nsAbMDBDirProperty(),
     mPerformingQuery(false)
{
}

nsAbMDBDirectory::~nsAbMDBDirectory(void)
{
  if (mDatabase) {
    mDatabase->RemoveListener(this);
  }
}

NS_IMPL_ISUPPORTS_INHERITED3(nsAbMDBDirectory, nsAbMDBDirProperty,
                             nsIAbDirSearchListener,
                             nsIAbDirectorySearch,
                             nsIAddrDBListener)

NS_IMETHODIMP nsAbMDBDirectory::Init(const char *aUri)
{
  // We need to ensure  that the m_DirPrefId is initialized properly
  nsDependentCString uri(aUri);

  if (uri.Find("MailList") != -1)
    m_IsMailList = true;

  // Mailing lists don't have their own prefs.
  if (m_DirPrefId.IsEmpty() && !m_IsMailList)
  {
    // Find the first ? (of the search params) if there is one.
    // We know we can start at the end of the moz-abmdbdirectory:// because
    // that's the URI we should have been passed.
    int32_t searchCharLocation = uri.FindChar('?', kMDBDirectoryRootLen);

    nsAutoCString filename;

    // extract the filename from the uri.
    if (searchCharLocation == -1)
      filename = Substring(uri, kMDBDirectoryRootLen);
    else
      filename = Substring(uri, kMDBDirectoryRootLen, searchCharLocation - kMDBDirectoryRootLen);

    // Get the pref servers and the address book directory branch
    nsresult rv;
    nsCOMPtr<nsIPrefService> prefService(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIPrefBranch> prefBranch;
    rv = prefService->GetBranch(NS_LITERAL_CSTRING(PREF_LDAP_SERVER_TREE_NAME ".").get(),
                                getter_AddRefs(prefBranch));
    NS_ENSURE_SUCCESS(rv, rv);

    char** childArray;
    uint32_t childCount, i;
    int32_t dotOffset;
    nsCString childValue;
    nsDependentCString child;

    rv = prefBranch->GetChildList("", &childCount, &childArray);
    NS_ENSURE_SUCCESS(rv, rv);

    for (i = 0; i < childCount; ++i)
    {
      child.Assign(childArray[i]);

      if (StringEndsWith(child, NS_LITERAL_CSTRING(".filename")))
      {
        if (NS_SUCCEEDED(prefBranch->GetCharPref(child.get(),
                                                 getter_Copies(childValue))))
        {
          if (childValue == filename)
          {
            dotOffset = child.RFindChar('.');
            if (dotOffset != -1)
            {
              nsAutoCString prefName(StringHead(child, dotOffset));
              m_DirPrefId.AssignLiteral(PREF_LDAP_SERVER_TREE_NAME ".");
              m_DirPrefId.Append(prefName);
            }
          }
        }
      }
    }     
    NS_FREE_XPCOM_ALLOCATED_POINTER_ARRAY(childCount, childArray);

    NS_ASSERTION(!m_DirPrefId.IsEmpty(),
                 "Error, Could not set m_DirPrefId in nsAbMDBDirectory::Init");
  }

  return nsAbDirProperty::Init(aUri);
}

////////////////////////////////////////////////////////////////////////////////

nsresult nsAbMDBDirectory::RemoveCardFromAddressList(nsIAbCard* card)
{
  nsresult rv = NS_OK;
  uint32_t listTotal;
  int32_t i, j;

  // These checks ensure we don't run into null pointers
  // as we did when we caused bug 280463.
  if (!mDatabase)
  {
    rv = GetAbDatabase();
    NS_ENSURE_SUCCESS(rv, rv);
  }

  if (!m_AddressList)
  {
    rv = mDatabase->GetMailingListsFromDB(this);
    NS_ENSURE_SUCCESS(rv, rv);

    // If the previous call didn't gives us an m_AddressList (and succeeded)
    // then we haven't got any mailing lists to try and remove the card from.
    // So just return without doing anything
    if (!m_AddressList)
      return NS_OK;
  }

  rv = m_AddressList->GetLength(&listTotal);
  NS_ENSURE_SUCCESS(rv,rv);

  for (i = listTotal - 1; i >= 0; i--)
  {
    nsCOMPtr<nsIAbDirectory> listDir(do_QueryElementAt(m_AddressList, i, &rv));
    if (listDir)
    {
      // First remove the instance in the database
      mDatabase->DeleteCardFromMailList(listDir, card, false);

      // Now remove the instance in any lists we hold.
      nsCOMPtr<nsIMutableArray> pAddressLists;
      listDir->GetAddressLists(getter_AddRefs(pAddressLists));
      if (pAddressLists)
      {  
        uint32_t total;
        rv = pAddressLists->GetLength(&total);
        for (j = total - 1; j >= 0; j--)
        {
          nsCOMPtr<nsIAbCard> cardInList(do_QueryElementAt(pAddressLists, j, &rv));
          bool equals;
          rv = cardInList->Equals(card, &equals);  // should we checking email?
          if (NS_SUCCEEDED(rv) && equals)
            pAddressLists->RemoveElementAt(j);
        }
      }
    }
  }
  return NS_OK;
}

NS_IMETHODIMP nsAbMDBDirectory::DeleteDirectory(nsIAbDirectory *directory)
{
  NS_ENSURE_ARG_POINTER(directory);

  nsCOMPtr<nsIAddrDatabase> database;
  nsresult rv = GetDatabase(getter_AddRefs(database));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = database->DeleteMailList(directory, this);

  if (NS_SUCCEEDED(rv))
    database->Commit(nsAddrDBCommitType::kLargeCommit);

  uint32_t dirIndex;
  if (m_AddressList && NS_SUCCEEDED(m_AddressList->IndexOf(0, directory, &dirIndex)))
    m_AddressList->RemoveElementAt(dirIndex);
  // XXX Cast from bool to nsresult
  rv = static_cast<nsresult>(mSubDirectories.RemoveObject(directory));

  NotifyItemDeleted(directory);
  return rv;
}

nsresult nsAbMDBDirectory::NotifyItemChanged(nsISupports *item)
{
  nsresult rv;
  nsCOMPtr<nsIAbManager> abManager = do_GetService(NS_ABMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  rv = abManager->NotifyItemPropertyChanged(item, nullptr, nullptr, nullptr);
  NS_ENSURE_SUCCESS(rv,rv);
  return rv;
}

nsresult nsAbMDBDirectory::NotifyPropertyChanged(nsIAbDirectory *list, const char *property, const PRUnichar* oldValue, const PRUnichar* newValue)
{
  nsresult rv;
  nsCOMPtr<nsISupports> supports = do_QueryInterface(list, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  nsCOMPtr<nsIAbManager> abManager = do_GetService(NS_ABMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv,rv);

  rv = abManager->NotifyItemPropertyChanged(supports, property, oldValue, newValue);
  NS_ENSURE_SUCCESS(rv,rv);
  return rv;
}

nsresult nsAbMDBDirectory::NotifyItemAdded(nsISupports *item)
{
  nsresult rv = NS_OK;
  nsCOMPtr<nsIAbManager> abManager = do_GetService(NS_ABMANAGER_CONTRACTID, &rv);
  if(NS_SUCCEEDED(rv))
    abManager->NotifyDirectoryItemAdded(this, item);
  return NS_OK;
}

nsresult nsAbMDBDirectory::NotifyItemDeleted(nsISupports *item)
{
  nsresult rv = NS_OK;
  nsCOMPtr<nsIAbManager> abManager = do_GetService(NS_ABMANAGER_CONTRACTID, &rv);
  if(NS_SUCCEEDED(rv))
    abManager->NotifyDirectoryItemDeleted(this, item);

  return NS_OK;
}

// nsIAbMDBDirectory methods

NS_IMETHODIMP nsAbMDBDirectory::ClearDatabase()
{       
  if (mIsQueryURI)
    return NS_ERROR_NOT_IMPLEMENTED;

  if (mDatabase)
  {
    mDatabase->RemoveListener(this);
    mDatabase = nullptr; 
  }
  return NS_OK; 
}

NS_IMETHODIMP nsAbMDBDirectory::RemoveElementsFromAddressList()
{
  if (mIsQueryURI)
    return NS_ERROR_NOT_IMPLEMENTED;

  if (m_AddressList)
  {
    uint32_t count;
    nsresult rv;
    rv = m_AddressList->GetLength(&count);
    NS_ASSERTION(NS_SUCCEEDED(rv), "Count failed");
    int32_t i;
    for (i = count - 1; i >= 0; i--)
      m_AddressList->RemoveElementAt(i);
  }
  m_AddressList = nullptr;
  return NS_OK;
}

NS_IMETHODIMP nsAbMDBDirectory::RemoveEmailAddressAt(uint32_t aIndex)
{
  if (mIsQueryURI)
    return NS_ERROR_NOT_IMPLEMENTED;

  if (m_AddressList)
  {
    return m_AddressList->RemoveElementAt(aIndex);
  }
  else
    return NS_ERROR_FAILURE;
}

NS_IMETHODIMP nsAbMDBDirectory::AddDirectory(const char *uriName, nsIAbDirectory **childDir)
{
  if (mIsQueryURI)
    return NS_ERROR_NOT_IMPLEMENTED;

  if (!childDir || !uriName)
    return NS_ERROR_NULL_POINTER;

  if (mURI.IsEmpty())
    return NS_ERROR_NOT_INITIALIZED;

  nsresult rv = NS_OK;
  nsCOMPtr<nsIAbManager> abManager = do_GetService(NS_ABMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAbDirectory> directory;
  rv = abManager->GetDirectory(nsDependentCString(uriName), getter_AddRefs(directory));
  NS_ENSURE_SUCCESS(rv, rv);

  if (mSubDirectories.IndexOf(directory) == -1)
    mSubDirectories.AppendObject(directory);
  NS_IF_ADDREF(*childDir = directory);
  return rv;
}

NS_IMETHODIMP nsAbMDBDirectory::GetDatabaseFile(nsIFile **aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);

  nsCString fileName;
  nsresult rv = GetStringValue("filename", EmptyCString(), fileName);
  NS_ENSURE_SUCCESS(rv, rv);

  if (fileName.IsEmpty())
    return NS_ERROR_NOT_INITIALIZED;

  nsCOMPtr<nsIFile> dbFile;
  rv = NS_GetSpecialDirectory(NS_APP_USER_PROFILE_50_DIR,
                              getter_AddRefs(dbFile));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = dbFile->AppendNative(fileName);
  NS_ENSURE_SUCCESS(rv, rv);

  NS_ADDREF(*aResult = dbFile);

  return NS_OK;
}

NS_IMETHODIMP nsAbMDBDirectory::GetDatabase(nsIAddrDatabase **aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);

  nsresult rv;
  nsCOMPtr<nsIFile> databaseFile;
  rv = GetDatabaseFile(getter_AddRefs(databaseFile));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAddrDatabase> addrDBFactory =
    do_GetService(NS_ADDRDATABASE_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  return addrDBFactory->Open(databaseFile, false /* no create */, true,
                           aResult);
}

// nsIAbDirectory methods

NS_IMETHODIMP nsAbMDBDirectory::GetURI(nsACString &aURI)
{
  if (mURI.IsEmpty())
    return NS_ERROR_NOT_INITIALIZED;

  aURI = mURI;
  return NS_OK;
}

NS_IMETHODIMP nsAbMDBDirectory::GetChildNodes(nsISimpleEnumerator* *aResult)
{
  if (mIsQueryURI)
    return NS_NewEmptyEnumerator(aResult);

  return NS_NewArrayEnumerator(aResult, mSubDirectories);
}

static PLDHashOperator 
enumerateSearchCache(nsISupports *aKey, nsCOMPtr<nsIAbCard> &aData, void* aClosure)
{
  nsIMutableArray* array = static_cast<nsIMutableArray*>(aClosure);

  array->AppendElement(aData, false);
  return PL_DHASH_NEXT;
}

NS_IMETHODIMP nsAbMDBDirectory::GetChildCards(nsISimpleEnumerator* *result)
{
  nsresult rv;

  if (mIsQueryURI)
  {
    rv = StartSearch();
    NS_ENSURE_SUCCESS(rv, rv);

    // TODO
    // Search is synchronous so need to return
    // results after search is complete
    nsCOMPtr<nsIMutableArray> array(do_CreateInstance(NS_ARRAY_CONTRACTID));
    mSearchCache.Enumerate(enumerateSearchCache, (void*)array);
    return NS_NewArrayEnumerator(result, array);
  }

  rv = GetAbDatabase();

  if (NS_FAILED(rv) || !mDatabase)
    return rv;

  return m_IsMailList ? mDatabase->EnumerateListAddresses(this, result) :
                        mDatabase->EnumerateCards(this, result);
}

NS_IMETHODIMP nsAbMDBDirectory::GetIsQuery(bool *aResult)
{
  NS_ENSURE_ARG_POINTER(aResult);
  *aResult = mIsQueryURI;
  return NS_OK;
}

NS_IMETHODIMP nsAbMDBDirectory::DeleteCards(nsIArray *aCards)
{
  NS_ENSURE_ARG_POINTER(aCards);
  nsresult rv = NS_OK;

  if (mIsQueryURI) {
    // if this is a query, delete the cards from the directory (without the query)
    // before we do the delete, make this directory (which represents the search)
    // a listener on the database, so that it will get notified when the cards are deleted
    // after delete, remove this query as a listener.
    nsCOMPtr<nsIAddrDatabase> database;
    rv = GetDatabase(getter_AddRefs(database));
    NS_ENSURE_SUCCESS(rv,rv);

    rv = database->AddListener(this);
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIAbManager> abManager =
        do_GetService(NS_ABMANAGER_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIAbDirectory> directory;
    rv = abManager->GetDirectory(mURINoQuery, getter_AddRefs(directory));
    NS_ENSURE_SUCCESS(rv, rv);

    rv = directory->DeleteCards(aCards);
    NS_ENSURE_SUCCESS(rv, rv);

    rv = database->RemoveListener(this);
    NS_ENSURE_SUCCESS(rv, rv);
    return rv;
  }

  if (!mDatabase)
    rv = GetAbDatabase();

  if (NS_SUCCEEDED(rv) && mDatabase)
  {
    uint32_t cardCount;
    uint32_t i;
    rv = aCards->GetLength(&cardCount);
    NS_ENSURE_SUCCESS(rv, rv);
    for (i = 0; i < cardCount; i++)
    {
      nsCOMPtr<nsIAbCard> card(do_QueryElementAt(aCards, i, &rv));
      NS_ENSURE_SUCCESS(rv, rv);

      if (card)
      {
        uint32_t rowID;
        rv = card->GetPropertyAsUint32("DbRowID", &rowID);
        NS_ENSURE_SUCCESS(rv, rv);

        if (m_IsMailList)
        {
          mDatabase->DeleteCardFromMailList(this, card, true);

          uint32_t cardTotal = 0;
          int32_t i;
          if (m_AddressList)
            rv = m_AddressList->GetLength(&cardTotal);
          for (i = cardTotal - 1; i >= 0; i--)
          {            
            nsCOMPtr<nsIAbCard> arrayCard(do_QueryElementAt(m_AddressList, i, &rv));
            if (arrayCard)
            {
              // No card can have a row ID of 0
              uint32_t arrayRowID = 0;
              arrayCard->GetPropertyAsUint32("DbRowID", &arrayRowID);
              if (rowID == arrayRowID)
                m_AddressList->RemoveElementAt(i);
            }
          }
        }
        else
        {
          mDatabase->DeleteCard(card, true, this);
          bool bIsMailList = false;
          card->GetIsMailList(&bIsMailList);
          if (bIsMailList)
          {
            //to do, get mailing list dir side uri and notify nsIAbManager to remove it
            nsAutoCString listUri(mURI);
            listUri.AppendLiteral("/MailList");
            listUri.AppendInt(rowID);
            if (!listUri.IsEmpty())
            {
              nsresult rv = NS_OK;

              nsCOMPtr<nsIAbManager> abManager =
                  do_GetService(NS_ABMANAGER_CONTRACTID, &rv);
              NS_ENSURE_SUCCESS(rv, rv);

              nsCOMPtr<nsIAbDirectory> listDir;
              rv = abManager->GetDirectory(listUri, getter_AddRefs(listDir));
              NS_ENSURE_SUCCESS(rv, rv);

              uint32_t dirIndex;
              if (m_AddressList && NS_SUCCEEDED(m_AddressList->IndexOf(0, listDir, &dirIndex)))
                m_AddressList->RemoveElementAt(dirIndex);

              mSubDirectories.RemoveObject(listDir);

              if (listDir)
                NotifyItemDeleted(listDir);
            }
          }
          else
          { 
            rv = RemoveCardFromAddressList(card);
            NS_ENSURE_SUCCESS(rv,rv);
          }
        }
      }
    }
    mDatabase->Commit(nsAddrDBCommitType::kLargeCommit);
  }
  return rv;
}

NS_IMETHODIMP nsAbMDBDirectory::HasCard(nsIAbCard *cards, bool *hasCard)
{
  if(!hasCard)
    return NS_ERROR_NULL_POINTER;

  if (mIsQueryURI)
  {
    *hasCard = mSearchCache.Get(cards, nullptr);
    return NS_OK;
  }

  nsresult rv = NS_OK;
  if (!mDatabase)
    rv = GetAbDatabase();

  if(NS_SUCCEEDED(rv) && mDatabase)
  {
    if(NS_SUCCEEDED(rv))
      rv = mDatabase->ContainsCard(cards, hasCard);
  }
  return rv;
}

NS_IMETHODIMP nsAbMDBDirectory::HasDirectory(nsIAbDirectory *dir, bool *hasDir)
{
  if (!hasDir)
    return NS_ERROR_NULL_POINTER;

  nsresult rv;

  nsCOMPtr<nsIAbMDBDirectory> dbdir(do_QueryInterface(dir, &rv));
  NS_ENSURE_SUCCESS(rv, rv);
  
  bool bIsMailingList  = false;
  dir->GetIsMailList(&bIsMailingList);
  if (bIsMailingList)
  {
    nsCOMPtr<nsIAddrDatabase> database;
    rv = GetDatabase(getter_AddRefs(database));

    if (NS_SUCCEEDED(rv))
      rv = database->ContainsMailList(dir, hasDir);
  }

  return rv;
}

NS_IMETHODIMP nsAbMDBDirectory::AddMailList(nsIAbDirectory *list, nsIAbDirectory **addedList)
{
  NS_ENSURE_ARG_POINTER(addedList);

  if (mIsQueryURI)
    return NS_ERROR_NOT_IMPLEMENTED;

  nsresult rv = NS_OK;
  if (!mDatabase)
    rv = GetAbDatabase();

  if (NS_FAILED(rv) || !mDatabase)
    return NS_ERROR_FAILURE;

  nsCOMPtr<nsIAbMDBDirectory> dblist(do_QueryInterface(list, &rv));
  if (NS_FAILED(rv))
  {
    nsCOMPtr<nsIAbDirectory> newlist(new nsAbMDBDirProperty);
    if (!newlist)
      return NS_ERROR_OUT_OF_MEMORY;

    rv = newlist->CopyMailList(list);
    NS_ENSURE_SUCCESS(rv, rv);

    dblist = do_QueryInterface(newlist, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    
    mDatabase->CreateMailListAndAddToDB(newlist, true, this);
  }
  else
    mDatabase->CreateMailListAndAddToDB(list, true, this);

  mDatabase->Commit(nsAddrDBCommitType::kLargeCommit);

  uint32_t dbRowID;
  dblist->GetDbRowID(&dbRowID);

  nsAutoCString listUri(mURI);
  listUri.AppendLiteral("/MailList");
  listUri.AppendInt(dbRowID);

  nsCOMPtr<nsIAbDirectory> newList;
  rv = AddDirectory(listUri.get(), getter_AddRefs(newList));
  if (NS_SUCCEEDED(rv) && newList)
  {
    nsCOMPtr<nsIAbMDBDirectory> dbnewList(do_QueryInterface(newList, &rv));
    NS_ENSURE_SUCCESS(rv, rv);

    dbnewList->CopyDBMailList(dblist);
    AddMailListToDirectory(newList);
    NotifyItemAdded(newList);
  }

  NS_IF_ADDREF(*addedList = newList);
  return rv;
}

NS_IMETHODIMP nsAbMDBDirectory::AddCard(nsIAbCard* card, nsIAbCard **addedCard)
{
  if (mIsQueryURI)
    return NS_ERROR_NOT_IMPLEMENTED;

  nsresult rv = NS_OK;
  if (!mDatabase)
    rv = GetAbDatabase();

  if (NS_FAILED(rv) || !mDatabase)
    return NS_ERROR_FAILURE;

  if (m_IsMailList)
    rv = mDatabase->CreateNewListCardAndAddToDB(this, m_dbRowID, card, true /* notify */);
  else
    rv = mDatabase->CreateNewCardAndAddToDB(card, true, this);
  NS_ENSURE_SUCCESS(rv, rv);

  mDatabase->Commit(nsAddrDBCommitType::kLargeCommit);

  NS_IF_ADDREF(*addedCard = card);
  return NS_OK;
}

NS_IMETHODIMP nsAbMDBDirectory::ModifyCard(nsIAbCard *aModifiedCard)
{
  NS_ENSURE_ARG_POINTER(aModifiedCard);

  nsresult rv;
  if (!mDatabase)
  {
    rv = GetAbDatabase();
    NS_ENSURE_SUCCESS(rv, rv);
  }

  rv = mDatabase->EditCard(aModifiedCard, true, this);
  NS_ENSURE_SUCCESS(rv, rv);
  return mDatabase->Commit(nsAddrDBCommitType::kLargeCommit);
}

NS_IMETHODIMP nsAbMDBDirectory::DropCard(nsIAbCard* aCard, bool needToCopyCard)
{
  NS_ENSURE_ARG_POINTER(aCard);

  if (mIsQueryURI)
    return NS_ERROR_NOT_IMPLEMENTED;

  nsresult rv = NS_OK;

  if (!mDatabase)
    rv = GetAbDatabase();

  if (NS_FAILED(rv) || !mDatabase)
    return NS_ERROR_FAILURE;

  nsCOMPtr<nsIAbCard> newCard;

  if (needToCopyCard) {
    newCard = do_CreateInstance(NS_ABMDBCARD_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    rv = newCard->Copy(aCard);
    NS_ENSURE_SUCCESS(rv, rv);
  }
  else {
    newCard = aCard;
  }  

  if (m_IsMailList) {
    if (needToCopyCard) {
      nsCOMPtr <nsIMdbRow> cardRow;
      // if card doesn't exist in db, add the card to the directory that 
      // contains the mailing list.
      mDatabase->FindRowByCard(newCard, getter_AddRefs(cardRow));
      if (!cardRow)
        mDatabase->CreateNewCardAndAddToDB(newCard, true /* notify */, this);
      else
        mDatabase->InitCardFromRow(newCard, cardRow);
    }
    // since we didn't copy the card, we don't have to notify that it was inserted
    mDatabase->CreateNewListCardAndAddToDB(this, m_dbRowID, newCard, false /* notify */);
  }
  else {
    mDatabase->CreateNewCardAndAddToDB(newCard, true /* notify */, this);
  }
  mDatabase->Commit(nsAddrDBCommitType::kLargeCommit);
  return NS_OK;
}

NS_IMETHODIMP nsAbMDBDirectory::EditMailListToDatabase(nsIAbCard *listCard)
{
  if (mIsQueryURI)
    return NS_ERROR_NOT_IMPLEMENTED;

  if (!m_IsMailList)
    return NS_ERROR_UNEXPECTED;

  nsresult rv = GetAbDatabase();
  NS_ENSURE_SUCCESS(rv, rv);

  mDatabase->EditMailList(this, listCard, true);
  mDatabase->Commit(nsAddrDBCommitType::kLargeCommit);

  return NS_OK;
}

static bool ContainsDirectory(nsIAbDirectory *parent, nsIAbDirectory *directory)
{
  // If parent is a maillist, 'addressLists' contains AbCards.
  bool bIsMailList = false;
  nsresult rv = parent->GetIsMailList(&bIsMailList);
  NS_ENSURE_SUCCESS(rv, false);

  if (bIsMailList)
    return false;

  nsCOMPtr<nsIMutableArray> pAddressLists;
  parent->GetAddressLists(getter_AddRefs(pAddressLists));
  if (pAddressLists)
  {
    uint32_t total;
    rv = pAddressLists->GetLength(&total);
    for (uint32_t i = 0; i < total; ++i)
    {
      nsCOMPtr<nsIAbDirectory> pList(do_QueryElementAt(pAddressLists, i, &rv));

      if (directory == pList)
          return true;
    }
  }

  return false;
}

// nsIAddrDBListener methods

NS_IMETHODIMP nsAbMDBDirectory::OnCardAttribChange(uint32_t abCode)
{
  return NS_OK;
}

NS_IMETHODIMP nsAbMDBDirectory::OnCardEntryChange
(uint32_t aAbCode, nsIAbCard *aCard, nsIAbDirectory *aParent)
{
  // Don't notify AbManager unless we have the parent
  if (!aParent)
    return NS_OK;

  NS_ENSURE_ARG_POINTER(aCard);
  nsCOMPtr<nsISupports> cardSupports(do_QueryInterface(aCard));
  nsresult rv;

  // Notify when
  // - any operation is done to a card belonging to this
  //        => if <this> is <aParent>, or
  // - a card belonging to a directory which is parent of this is deleted
  //        => if aAbCode is AB_NotifyDeleted && <this> is child of <aParent>, or
  // - a card belonging to a directory which is child of this is added/modified
  //        => if aAbCode is !AB_NotifyDeleted && <this> is parent of <aParent>

  if (aParent != this)
  {
    bool isChild = false;
    if (aAbCode != AB_NotifyDeleted)
      isChild = ContainsDirectory(this, aParent);
    else
      isChild = ContainsDirectory(aParent, this);

    if (!isChild)
      return NS_OK;
  }

  switch (aAbCode) {
  case AB_NotifyInserted:
    rv = NotifyItemAdded(cardSupports);
    break;
  case AB_NotifyDeleted:
    rv = NotifyItemDeleted(cardSupports);
    break;
  case AB_NotifyPropertyChanged:
    rv = NotifyItemChanged(cardSupports);
    break;
  default:
    rv = NS_ERROR_UNEXPECTED;
    break;
  }
    
  NS_ENSURE_SUCCESS(rv, rv);
  return rv;
}

NS_IMETHODIMP nsAbMDBDirectory::OnListEntryChange
(uint32_t abCode, nsIAbDirectory *list)
{
  nsresult rv = NS_OK;
  
  if (abCode == AB_NotifyPropertyChanged && list)
  {
    bool bIsMailList = false;
    rv = list->GetIsMailList(&bIsMailList);
    NS_ENSURE_SUCCESS(rv,rv);
    
    nsCOMPtr<nsIAbMDBDirectory> dblist(do_QueryInterface(list, &rv));
    NS_ENSURE_SUCCESS(rv,rv);

    if (bIsMailList) {
      nsString listName;
      rv = list->GetDirName(listName);
      NS_ENSURE_SUCCESS(rv,rv);

      rv = NotifyPropertyChanged(list, "DirName", nullptr, listName.get());
      NS_ENSURE_SUCCESS(rv,rv);
    }
  }
  return rv;
}

NS_IMETHODIMP nsAbMDBDirectory::OnAnnouncerGoingAway()
{
  if (mDatabase)
      mDatabase->RemoveListener(this);
  return NS_OK;
}

// nsIAbDirectorySearch methods

NS_IMETHODIMP nsAbMDBDirectory::StartSearch()
{
  if (!mIsQueryURI)
    return NS_ERROR_FAILURE;

  nsresult rv;

  mPerformingQuery = true;
  mSearchCache.Clear();

  nsCOMPtr<nsIAbDirectoryQueryArguments> arguments = do_CreateInstance(NS_ABDIRECTORYQUERYARGUMENTS_CONTRACTID,&rv);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAbBooleanExpression> expression;
  rv = nsAbQueryStringToExpression::Convert(mQueryString,
    getter_AddRefs(expression));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = arguments->SetExpression(expression);
  NS_ENSURE_SUCCESS(rv, rv);

  // don't search the subdirectories 
  // if the current directory is a mailing list, it won't have any subdirectories
  // if the current directory is a addressbook, searching both it
  // and the subdirectories (the mailing lists), will yield duplicate results
  // because every entry in a mailing list will be an entry in the parent addressbook
  rv = arguments->SetQuerySubDirectories(false);
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAbManager> abManager =
      do_GetService(NS_ABMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  // Get the directory without the query
  nsCOMPtr<nsIAbDirectory> directory;
  rv = abManager->GetDirectory(mURINoQuery, getter_AddRefs(directory));
  NS_ENSURE_SUCCESS(rv, rv);

  // Bug 280232 - something was causing continuous loops in searching. Add a
  // check here for the directory to search not being a query uri as well in
  // the hopes that will at least break us out of the continuous loop even if
  // we don't know how we got into it.
  bool isQuery;
  rv = directory->GetIsQuery(&isQuery);
  NS_ENSURE_SUCCESS(rv, rv);

  if (isQuery)
  {
    NS_ERROR("Attempting to search a directory within a search");
    return NS_ERROR_FAILURE;
  }

  // Initiate the proxy query with the no query directory
  nsCOMPtr<nsIAbDirectoryQueryProxy> queryProxy = 
      do_CreateInstance(NS_ABDIRECTORYQUERYPROXY_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  rv = queryProxy->Initiate();
  NS_ENSURE_SUCCESS(rv, rv);

  rv = queryProxy->DoQuery(directory, arguments, this, -1, 0, &mContext);
  return NS_OK;
}

NS_IMETHODIMP nsAbMDBDirectory::StopSearch()
{
  if (!mIsQueryURI)
    return NS_ERROR_FAILURE;

  return NS_OK;
}


// nsAbDirSearchListenerContext methods

NS_IMETHODIMP nsAbMDBDirectory::OnSearchFinished(int32_t aResult,
                                                 const nsAString &aErrorMsg)
{
  mPerformingQuery = false;
  return NS_OK;
}

NS_IMETHODIMP nsAbMDBDirectory::OnSearchFoundCard(nsIAbCard* card)
{
  mSearchCache.Put(card, card);

  // TODO
  // Search is synchronous so asserting on the
  // datasource will not work since the getChildCards
  // method will not have returned with results.
  // NotifyItemAdded (card);
  return NS_OK;
}

nsresult nsAbMDBDirectory::GetAbDatabase()
{
  if (mURI.IsEmpty())
    return NS_ERROR_NOT_INITIALIZED;

  if (mDatabase)
    return NS_OK;

  nsresult rv;

  if (m_IsMailList)
  {
    // Get the database of the parent directory.
    nsAutoCString parentURI(mURINoQuery);

    int32_t pos = parentURI.RFindChar('/');

    // If we didn't find a / something really bad has happened
    if (pos == -1)
      return NS_ERROR_FAILURE;

    parentURI = StringHead(parentURI, pos);

    nsCOMPtr<nsIAbManager> abManager =
        do_GetService(NS_ABMANAGER_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIAbDirectory> directory;
    rv = abManager->GetDirectory(parentURI, getter_AddRefs(directory));
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr<nsIAbMDBDirectory> mdbDir(do_QueryInterface(directory, &rv));
    NS_ENSURE_SUCCESS(rv, rv);

    rv = mdbDir->GetDatabase(getter_AddRefs(mDatabase));
  }
  else
    rv = GetDatabase(getter_AddRefs(mDatabase));

  if (NS_SUCCEEDED(rv))
    rv = mDatabase->AddListener(this);

  return rv;
}

NS_IMETHODIMP nsAbMDBDirectory::CardForEmailAddress(const nsACString &aEmailAddress, nsIAbCard ** aAbCard)
{
  NS_ENSURE_ARG_POINTER(aAbCard);

  *aAbCard = NULL;

  // Ensure that if we've not been given an email address we never match
  // so that we don't fail out unnecessarily and we don't match a blank email
  // address against random cards that the user hasn't supplied an email for.
  if (aEmailAddress.IsEmpty())
    return NS_OK;

  nsresult rv = NS_OK;
  if (!mDatabase)
    rv = GetAbDatabase();
  if (rv == NS_ERROR_FILE_NOT_FOUND)
  {
    // If file wasn't found, the card cannot exist.
    return NS_OK;
  }
  NS_ENSURE_SUCCESS(rv, rv);

  // Convert Email to lower case in UTF-16 format. This correctly lower-cases
  // it and doing this change means that we can use a hash lookup in the
  // database rather than searching and comparing each line individually.
  NS_ConvertUTF8toUTF16 lowerEmail(aEmailAddress);
  ToLowerCase(lowerEmail);

  // If lower email is empty, something went wrong somewhere, e.g. the conversion.
  // Hence, don't go looking for a card with no email address. Something is wrong.
  if (lowerEmail.IsEmpty())
    return NS_ERROR_FAILURE;

  mDatabase->GetCardFromAttribute(this, kLowerPriEmailColumn, NS_ConvertUTF16toUTF8(lowerEmail),
                                  false, aAbCard);
  if (!*aAbCard)
    // We don't have a lower case second email column, so we have to search
    // case-sensitively here.
    mDatabase->GetCardFromAttribute(this, k2ndEmailProperty, aEmailAddress,
                                    true, aAbCard);

  return NS_OK;
}

NS_IMETHODIMP nsAbMDBDirectory::GetCardFromProperty(const char *aProperty,
                                                    const nsACString &aValue,
                                                    bool caseSensitive,
                                                    nsIAbCard **result)
{
  NS_ENSURE_ARG(aProperty);
  NS_ENSURE_ARG_POINTER(result);

  *result = nullptr;

  // If the value is empty, don't match.
  if (aValue.IsEmpty())
    return NS_OK;

  nsresult rv;
  if (!mDatabase)
  {
    rv = GetAbDatabase();
    // We can't find the database file, so we can't find the card at all.
    if (rv == NS_ERROR_FILE_NOT_FOUND)
      return NS_OK;
    NS_ENSURE_SUCCESS(rv, rv);
  }

  // nsIAddrDatabase has aCaseInsensitive as its parameter
  return mDatabase->GetCardFromAttribute(this, aProperty, aValue,
                                         !caseSensitive, result);
}

NS_IMETHODIMP nsAbMDBDirectory::GetCardsFromProperty(const char *aProperty,
                                                     const nsACString &aValue,
                                                     bool caseSensitive,
                                                     nsISimpleEnumerator **result)
{
  NS_ENSURE_ARG(aProperty);
  NS_ENSURE_ARG_POINTER(result);

  *result = nullptr;

  if (aValue.IsEmpty())
    return NS_OK;

  if (!mDatabase)
  {
    nsresult rv = GetAbDatabase();
    if (rv == NS_ERROR_FILE_NOT_FOUND)
      return NS_OK;
    NS_ENSURE_SUCCESS(rv, rv);
  }

  return mDatabase->GetCardsFromAttribute(this, aProperty, aValue,
                                          !caseSensitive, result);
}
