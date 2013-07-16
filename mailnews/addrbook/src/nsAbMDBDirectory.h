/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/********************************************************************************************************
 
   Interface for representing Address Book Directory
 
*********************************************************************************************************/

#ifndef nsAbMDBDirectory_h__
#define nsAbMDBDirectory_h__

#include "mozilla/Attributes.h"
#include "nsAbMDBDirProperty.h"  
#include "nsIAbCard.h"
#include "nsCOMArray.h"
#include "nsCOMPtr.h"
#include "nsDirPrefs.h"
#include "nsIAbDirectorySearch.h"
#include "nsIAbDirSearchListener.h"
#include "nsInterfaceHashtable.h"
#include "nsIAddrDBListener.h"

/* 
 * Address Book Directory
 */ 

class nsAbMDBDirectory:
  public nsAbMDBDirProperty,	// nsIAbDirectory, nsIAbMDBDirectory
  public nsIAbDirSearchListener,
  public nsIAddrDBListener, 
  public nsIAbDirectorySearch
{
public: 
  nsAbMDBDirectory(void);
  virtual ~nsAbMDBDirectory(void);

  NS_DECL_ISUPPORTS_INHERITED
  NS_DECL_NSIADDRDBLISTENER

  // Override nsAbMDBDirProperty::Init
  NS_IMETHOD Init(const char *aUri) MOZ_OVERRIDE;

  // nsIAbMDBDirectory methods
  NS_IMETHOD GetURI(nsACString &aURI) MOZ_OVERRIDE;
  NS_IMETHOD ClearDatabase() MOZ_OVERRIDE;
  NS_IMETHOD NotifyDirItemAdded(nsISupports *item) MOZ_OVERRIDE { return NotifyItemAdded(item);}
  NS_IMETHOD RemoveElementsFromAddressList() MOZ_OVERRIDE;
  NS_IMETHOD RemoveEmailAddressAt(uint32_t aIndex) MOZ_OVERRIDE;
  NS_IMETHOD AddDirectory(const char *uriName, nsIAbDirectory **childDir) MOZ_OVERRIDE;
  NS_IMETHOD GetDatabaseFile(nsIFile **aResult) MOZ_OVERRIDE;
  NS_IMETHOD GetDatabase(nsIAddrDatabase **aResult) MOZ_OVERRIDE;

  // nsIAbDirectory methods:
  NS_IMETHOD GetChildNodes(nsISimpleEnumerator* *result) MOZ_OVERRIDE;
  NS_IMETHOD GetChildCards(nsISimpleEnumerator* *result) MOZ_OVERRIDE;
  NS_IMETHOD GetIsQuery(bool *aResult) MOZ_OVERRIDE;
  NS_IMETHOD DeleteDirectory(nsIAbDirectory *directory) MOZ_OVERRIDE;
  NS_IMETHOD DeleteCards(nsIArray *cards) MOZ_OVERRIDE;
  NS_IMETHOD HasCard(nsIAbCard *cards, bool *hasCard) MOZ_OVERRIDE;
  NS_IMETHOD HasDirectory(nsIAbDirectory *dir, bool *hasDir) MOZ_OVERRIDE;
  NS_IMETHOD AddMailList(nsIAbDirectory *list, nsIAbDirectory **addedList) MOZ_OVERRIDE;
  NS_IMETHOD AddCard(nsIAbCard *card, nsIAbCard **addedCard) MOZ_OVERRIDE;
  NS_IMETHOD ModifyCard(nsIAbCard *aModifiedCard) MOZ_OVERRIDE;
  NS_IMETHOD DropCard(nsIAbCard *card, bool needToCopyCard) MOZ_OVERRIDE;
  NS_IMETHOD EditMailListToDatabase(nsIAbCard *listCard) MOZ_OVERRIDE;
  NS_IMETHOD CardForEmailAddress(const nsACString &aEmailAddress,
                                 nsIAbCard ** aAbCard) MOZ_OVERRIDE;
  NS_IMETHOD GetCardFromProperty(const char *aProperty,
                                 const nsACString &aValue,
                                 bool caseSensitive, nsIAbCard **result) MOZ_OVERRIDE;
  NS_IMETHOD GetCardsFromProperty(const char *aProperty,
                                  const nsACString &aValue,
                                  bool caseSensitive,
                                  nsISimpleEnumerator **result) MOZ_OVERRIDE;

  // nsIAbDirectorySearch methods
  NS_DECL_NSIABDIRECTORYSEARCH

  // nsIAbDirSearchListener methods
  NS_DECL_NSIABDIRSEARCHLISTENER

protected:
  nsresult NotifyPropertyChanged(nsIAbDirectory *list, const char *property, const PRUnichar* oldValue, const PRUnichar* newValue);
  nsresult NotifyItemAdded(nsISupports *item);
  nsresult NotifyItemDeleted(nsISupports *item);
  nsresult NotifyItemChanged(nsISupports *item);
  nsresult RemoveCardFromAddressList(nsIAbCard* card);

  nsresult GetAbDatabase();
  nsCOMPtr<nsIAddrDatabase> mDatabase;  

  nsCOMArray<nsIAbDirectory> mSubDirectories;

  int32_t mContext;
  bool mPerformingQuery;

  nsInterfaceHashtable<nsISupportsHashKey, nsIAbCard> mSearchCache;
};

#endif
