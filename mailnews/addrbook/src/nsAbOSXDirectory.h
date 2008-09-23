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

#ifndef nsAbOSXDirectory_h___
#define nsAbOSXDirectory_h___

#include "nsAbBaseCID.h"
#include "nsAbDirectoryRDFResource.h"
#include "nsAbDirProperty.h"
#include "nsIAbDirectoryQuery.h"
#include "nsIAbDirectorySearch.h"
#include "nsIAbDirSearchListener.h"
#include "nsIMutableArray.h"

class nsIAbManager;
class nsIAbBooleanExpression;

#define NS_ABOSXDIRECTORY_URI_PREFIX NS_ABOSXDIRECTORY_PREFIX "://"

#define NS_IABOSXDIRECTORY_IID \
{ 0x87ee4bd9, 0x8552, 0x498f, \
  { 0x80, 0x85, 0x34, 0xf0, 0x2a, 0xbb, 0x56, 0x16 } }

class nsIAbOSXDirectory : public nsISupports
{
public:
  NS_DECLARE_STATIC_IID_ACCESSOR(NS_IABOSXDIRECTORY_IID)
  
  virtual nsresult AssertChildNodes() = 0;
  virtual nsresult Update() = 0;
  virtual nsresult AssertDirectory(nsIAbManager *aManager,
                                   nsIAbDirectory *aDirectory) = 0;
  virtual nsresult AssertCard(nsIAbManager *aManager,
                              nsIAbCard *aCard) = 0;
  virtual nsresult UnassertCard(nsIAbManager *aManager,
                                nsIAbCard *aCard,
                                nsIMutableArray *aCardList) = 0;
  virtual nsresult UnassertDirectory(nsIAbManager *aManager,
                                     nsIAbDirectory *aDirectory) = 0;
  virtual nsresult DeleteUid(const nsACString &aUid) = 0;
};

NS_DEFINE_STATIC_IID_ACCESSOR(nsIAbOSXDirectory, NS_IABOSXDIRECTORY_IID)

class nsAbOSXDirectory : public nsAbDirectoryRDFResource,
public nsAbDirProperty,
public nsIAbDirSearchListener,
public nsIAbOSXDirectory
{
public:
  ~nsAbOSXDirectory();
  
  NS_DECL_ISUPPORTS_INHERITED
  NS_DECL_NSIABDIRSEARCHLISTENER
    
    // nsAbDirectoryRDFResource method
    NS_IMETHOD Init(const char *aUri);
  
  // nsAbDirProperty methods
  NS_IMETHOD GetReadOnly(PRBool *aReadOnly);
  NS_IMETHOD GetChildCards(nsISimpleEnumerator **aCards);
  NS_IMETHOD GetChildNodes(nsISimpleEnumerator **aNodes);
  NS_IMETHOD HasCard(nsIAbCard *aCard, PRBool *aHasCard);
  NS_IMETHOD HasDirectory(nsIAbDirectory *aDirectory, PRBool *aHasDirectory);
  NS_IMETHOD GetURI(nsACString &aURI);
  NS_IMETHOD CardForEmailAddress(const nsACString &aEmailAddress,
                                 nsIAbCard **aResult);

  // nsIAbOSXDirectory
  nsresult AssertChildNodes();
  nsresult AssertDirectory(nsIAbManager *aManager,
                           nsIAbDirectory *aDirectory);
  nsresult AssertCard(nsIAbManager *aManager,
                      nsIAbCard *aCard);
  nsresult UnassertCard(nsIAbManager *aManager,
                        nsIAbCard *aCard,
                        nsIMutableArray *aCardList);
  nsresult UnassertDirectory(nsIAbManager *aManager,
                             nsIAbDirectory *aDirectory);
  
  nsresult Update();

  nsresult DeleteUid(const nsACString &aUid);
private:
  nsresult FallbackSearch(nsIAbBooleanExpression *aExpression,
                          nsISimpleEnumerator **aCards);

  // This is a list of nsIAbCards, kept separate from m_AddressList because:
  // - nsIAbDirectory items that are mailing lists, must keep a list of
  //   nsIAbCards in m_AddressList, however
  // - nsIAbDirectory items that are address books, must keep a list of
  //   nsIAbDirectory (i.e. mailing lists) in m_AddressList, AND no nsIAbCards.
  //
  // This wasn't too bad for mork, as that just gets a list from its database,
  // but because we store our own copy of the list, we must store a separate
  // list of nsIAbCards here. nsIMutableArray is used, because then it is
  // interchangable with m_AddressList.
  nsCOMPtr<nsIMutableArray> mCardList;
};

#endif // nsAbOSXDirectory_h___
