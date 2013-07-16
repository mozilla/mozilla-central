/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsAbLDAPDirectory_h__
#define nsAbLDAPDirectory_h__

#include "mozilla/Attributes.h"
#include "nsAbDirProperty.h"
#include "nsAbLDAPDirectoryModify.h"
#include "nsIAbDirectoryQuery.h"
#include "nsIAbDirectorySearch.h"
#include "nsIAbDirSearchListener.h"
#include "nsIAbLDAPDirectory.h"
#include "nsIMutableArray.h"
#include "nsInterfaceHashtable.h"
#include "mozilla/Mutex.h"

class nsAbLDAPDirectory :
  public nsAbDirProperty,             // nsIAbDirectory
  public nsAbLDAPDirectoryModify,
  public nsIAbDirectorySearch,
  public nsIAbLDAPDirectory,
  public nsIAbDirSearchListener
{
public:
  NS_DECL_ISUPPORTS_INHERITED

  nsAbLDAPDirectory();
  virtual ~nsAbLDAPDirectory();

  NS_IMETHOD Init(const char *aUri) MOZ_OVERRIDE;

  // nsIAbDirectory methods
  NS_IMETHOD GetPropertiesChromeURI(nsACString &aResult) MOZ_OVERRIDE;
  NS_IMETHOD GetURI(nsACString &aURI) MOZ_OVERRIDE;
  NS_IMETHOD GetChildNodes(nsISimpleEnumerator* *result) MOZ_OVERRIDE;
  NS_IMETHOD GetChildCards(nsISimpleEnumerator* *result) MOZ_OVERRIDE;
  NS_IMETHOD GetIsQuery(bool *aResult) MOZ_OVERRIDE;
  NS_IMETHOD HasCard(nsIAbCard *cards, bool *hasCard) MOZ_OVERRIDE;
  NS_IMETHOD GetSupportsMailingLists(bool *aSupportsMailingsLists) MOZ_OVERRIDE;
  NS_IMETHOD GetReadOnly(bool *aReadOnly) MOZ_OVERRIDE;
  NS_IMETHOD GetIsRemote(bool *aIsRemote) MOZ_OVERRIDE;
  NS_IMETHOD GetIsSecure(bool *aIsRemote) MOZ_OVERRIDE;
  NS_IMETHOD UseForAutocomplete(const nsACString &aIdentityKey, bool *aResult) MOZ_OVERRIDE;
  NS_IMETHOD AddCard(nsIAbCard *aChildCard, nsIAbCard **aAddedCard) MOZ_OVERRIDE;
  NS_IMETHOD ModifyCard(nsIAbCard *aModifiedCard) MOZ_OVERRIDE;
  NS_IMETHOD DeleteCards(nsIArray *aCards) MOZ_OVERRIDE;

  // nsIAbDirectorySearch methods
  NS_DECL_NSIABDIRECTORYSEARCH
  NS_DECL_NSIABLDAPDIRECTORY
  NS_DECL_NSIABDIRSEARCHLISTENER

protected:
  nsresult Initiate();

  nsresult SplitStringList(const nsACString& aString,
                           uint32_t *aCount,
                           char ***aValues);

  bool mPerformingQuery;
  int32_t mContext;
  int32_t mMaxHits;

  nsInterfaceHashtable<nsISupportsHashKey, nsIAbCard> mCache;

  mozilla::Mutex mLock;
  nsCOMPtr<nsIAbDirectoryQuery> mDirectoryQuery;
  nsCOMPtr<nsIMutableArray> mSearchServerControls;
  nsCOMPtr<nsIMutableArray> mSearchClientControls;
};

#endif
