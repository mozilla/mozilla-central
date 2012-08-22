/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsAbView_H_
#define _nsAbView_H_

#include "nsISupports.h"
#include "nsStringGlue.h"
#include "nsIAbView.h"
#include "nsITreeView.h"
#include "nsITreeBoxObject.h"
#include "nsITreeSelection.h"
#include "nsVoidArray.h"
#include "nsIAbDirectory.h"
#include "nsIAtom.h"
#include "nsICollation.h"
#include "nsIAbListener.h"
#include "nsIObserver.h"
#include "nsServiceManagerUtils.h"
#include "nsComponentManagerUtils.h"
#include "nsMemory.h"
#include "nsIStringBundle.h"

typedef struct AbCard
{
  nsIAbCard *card;
  uint32_t primaryCollationKeyLen;
  uint32_t secondaryCollationKeyLen;
  uint8_t *primaryCollationKey;
  uint8_t *secondaryCollationKey;
} AbCard;


class nsAbView : public nsIAbView, public nsITreeView, public nsIAbListener, public nsIObserver
{
public:
  nsAbView();
  virtual ~nsAbView();

  NS_DECL_ISUPPORTS
  NS_DECL_NSIABVIEW
  NS_DECL_NSITREEVIEW
  NS_DECL_NSIABLISTENER
  NS_DECL_NSIOBSERVER
  
  int32_t CompareCollationKeys(uint8_t *key1, uint32_t len1, uint8_t *key2, uint32_t len2);

private:
  nsresult Initialize();
  int32_t FindIndexForInsert(AbCard *abcard);
  int32_t FindIndexForCard(nsIAbCard *card);
  nsresult GenerateCollationKeysForCard(const PRUnichar *colID, AbCard *abcard);
  nsresult InvalidateTree(int32_t row);
  nsresult RemoveCardAt(int32_t row);
  nsresult AddCard(AbCard *abcard, bool selectCardAfterAdding, int32_t *index);
  nsresult RemoveCardAndSelectNextCard(nsISupports *item);
  nsresult EnumerateCards();
  nsresult SetGeneratedNameFormatFromPrefs();
  nsresult GetSelectedCards(nsCOMPtr<nsIMutableArray> &aSelectedCards);
  nsresult ReselectCards(nsIArray *aCards, nsIAbCard *aIndexCard);
  nsresult GetCardValue(nsIAbCard *card, const PRUnichar *colID, nsAString &_retval);
  nsresult RefreshTree();

  nsCOMPtr<nsITreeBoxObject> mTree;
  nsCOMPtr<nsITreeSelection> mTreeSelection;
  nsCOMPtr <nsIAbDirectory> mDirectory;
  nsVoidArray mCards;
  nsCOMPtr<nsIAtom> mMailListAtom;
  nsString mSortColumn;
  nsString mSortDirection;
  nsCOMPtr<nsICollation> mCollationKeyGenerator;
  nsCOMPtr<nsIAbViewListener> mAbViewListener;
  nsCOMPtr<nsIStringBundle> mABBundle;

  bool mInitialized;
  bool mSuppressSelectionChange;
  bool mSuppressCountChange;
  int32_t mGeneratedNameFormat;
};

#endif /* _nsAbView_H_ */
