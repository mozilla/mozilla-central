/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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

#include "nsAbAutoCompleteSession.h"
#include "nsRDFCID.h"
#include "nsIRDFService.h"
#include "nsUnicharUtils.h"
#include "prmem.h"
#include "nsNetCID.h"
#include "nsIIOService.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "nsIAbMDBDirectory.h"
#include "nsComponentManagerUtils.h"
#include "nsServiceManagerUtils.h"

NS_IMPL_ISUPPORTS1(nsAbAutoCompleteSession, nsIAutoCompleteSession)

nsAbAutoCompleteSession::nsAbAutoCompleteSession()
{
    mParser = do_GetService(NS_MAILNEWS_MIME_HEADER_PARSER_CONTRACTID);
}


nsAbAutoCompleteSession::~nsAbAutoCompleteSession()
{
}

PRBool nsAbAutoCompleteSession::ItsADuplicate(const nsString &fullAddress,
                                              PRInt32 aPopularityIndex,
                                              nsIAutoCompleteResults* results)
{
    nsresult rv;

    nsCOMPtr<nsISupportsArray> array;
    rv = results->GetItems(getter_AddRefs(array));
    if (NS_SUCCEEDED(rv))
    {
        nsCOMPtr<nsIEnumerator> enumerator;
        rv = array->Enumerate(getter_AddRefs(enumerator));
        if (NS_SUCCEEDED(rv))
        {
            nsCOMPtr<nsISupports> item;
            nsCOMPtr<nsIAutoCompleteItem> resultItem;
            nsAutoString valueStr;

            for (rv = enumerator->First(); NS_SUCCEEDED(rv); rv = enumerator->Next())
            {
                rv = enumerator->CurrentItem(getter_AddRefs(item));
                if (NS_SUCCEEDED(rv) && item)
                {
                    resultItem = do_QueryInterface(item, &rv);
                    if (NS_SUCCEEDED(rv))
                    {
                        rv = resultItem->GetValue(valueStr);
#ifdef MOZILLA_INTERNAL_API
                        if (NS_SUCCEEDED(rv) && !valueStr.IsEmpty() 
                            && fullAddress.Equals(valueStr, nsCaseInsensitiveStringComparator()))
#else
                        if (NS_SUCCEEDED(rv) && !valueStr.IsEmpty() 
                            && fullAddress.Equals(valueStr, CaseInsensitiveCompare))
#endif
                        {
                          // ok, we have a duplicate, but before we ignore the dupe, check the popularity index
                          // and use the card that is the most popular so it gets sorted correctly
                          nsCOMPtr<nsISupports> currentItemParams;
                          rv = resultItem->GetParam(getter_AddRefs(currentItemParams));
                          if (NS_SUCCEEDED(rv))
                          {
                            nsAbAutoCompleteParam *param = (nsAbAutoCompleteParam *)(void *)currentItemParams;
                            if (aPopularityIndex > param->mPopularityIndex)
                            {
                              // remove the current autocomplete result, and return false so our dupe
                              // gets added in its place.
                              array->RemoveElement(item);
                              break; 
                            }
                          }

                          // it's a dupe, ignore it.
                          return PR_TRUE;
                        }
                    }
                }
            }
        }
    }
    
    return PR_FALSE;
}

void 
nsAbAutoCompleteSession::AddToResult(const PRUnichar* pNickNameStr,
                                     const PRUnichar* pDisplayNameStr,
                                     const PRUnichar* pFirstNameStr,
                                     const PRUnichar* pLastNameStr,
                                     const PRUnichar* pEmailStr, 
                                     const PRUnichar* pNotesStr, 
                                     const PRUnichar* pDirName,
                                     PRUint32 aPopularityIndex,
                                     PRBool bIsMailList,
                                     nsIAutoCompleteResults* results)
{
  nsresult rv;
  nsString fullAddress;

  if (mParser)
  {
    nsString displayName(pDisplayNameStr);
    if (bIsMailList)
    {
      if (pNotesStr && *pNotesStr)
        mParser->MakeFullAddress(displayName, nsDependentString(pNotesStr),
                                 fullAddress);
      else if (pDisplayNameStr)
        mParser->MakeFullAddress(displayName, displayName, fullAddress);
    }
    else if (pEmailStr)
      mParser->MakeFullAddress(displayName, nsDependentString(pEmailStr),
                               fullAddress);
  }
  
  if (fullAddress.IsEmpty())
  {
    // oops, parser problem! I will try to do my best...
    const PRUnichar * pStr = nsnull;
    if (bIsMailList)
    {
      if (pNotesStr && *pNotesStr)
        pStr = pNotesStr;
      else
        pStr = pDisplayNameStr;
    }
    else
      pStr = pEmailStr;

    // check this so we do not get a bogus entry "someName <>"
    if (pStr && *pStr) {
      fullAddress = pDisplayNameStr;
      fullAddress.AppendLiteral(" <");
      fullAddress += pStr;
      fullAddress.AppendLiteral(">");
    }
  }
    
  if (!fullAddress.IsEmpty() &&
      !ItsADuplicate(fullAddress, aPopularityIndex, results))
  {    
    nsCOMPtr<nsIAutoCompleteItem> newItem = do_CreateInstance(NS_AUTOCOMPLETEITEM_CONTRACTID, &rv);
    if (NS_SUCCEEDED(rv))
    {
      nsAbAutoCompleteParam *param = new nsAbAutoCompleteParam(pNickNameStr, pDisplayNameStr, pFirstNameStr, pLastNameStr, pEmailStr, pNotesStr, pDirName, aPopularityIndex, bIsMailList);
      NS_IF_ADDREF(param);
      newItem->SetParam(param);
      NS_IF_RELEASE(param);

      // how to process the comment column, if at all.  this value
      // comes from "mail.autoComplete.commentColumn", or, if that
      // doesn't exist, defaults to 0
      //
      // 0 = none
      // 1 = name of addressbook this card came from
      // 2 = other per-addressbook format (currrently unused here)
      //
      if (mAutoCompleteCommentColumn == 1) {
        rv = newItem->SetComment(pDirName);
        if (NS_FAILED(rv)) {
          NS_WARNING("nsAbAutoCompleteSession::AddToResult():"
                     " newItem->SetComment() failed\n");
        }
      }

      rv = newItem->SetClassName("local-abook");
      if (NS_FAILED(rv)) {
        NS_WARNING("nsAbAutoCompleteSession::AddToResult():"
                   " newItem->SetClassName() failed\n");
      }

      newItem->SetValue(fullAddress);
      nsCOMPtr<nsISupportsArray> array;
      rv = results->GetItems(getter_AddRefs(array));
      if (NS_SUCCEEDED(rv))
      {
        PRUint32 nbrOfItems;      
        rv = array->Count(&nbrOfItems);

        PRInt32 insertPosition = 0;

        for (; insertPosition < nbrOfItems; insertPosition++)
        {
          nsCOMPtr<nsISupports> currentItemParams;
          nsCOMPtr<nsIAutoCompleteItem> resultItem;
          nsresult rv = array->QueryElementAt(insertPosition, NS_GET_IID(nsIAutoCompleteItem),
                                           getter_AddRefs(resultItem));
          if (NS_FAILED(rv))
            continue;
          rv = resultItem->GetParam(getter_AddRefs(currentItemParams));
          if (NS_FAILED(rv))
            continue;

          param = (nsAbAutoCompleteParam *)(void *)currentItemParams;
          if (aPopularityIndex > param->mPopularityIndex) // sort the search results by popularity index 
            break;
        }

        rv = array->InsertElementAt(newItem, insertPosition);
      }
    }
  }    
}

static PRBool CommonPrefix(const PRUnichar *aString, const PRUnichar *aSubstr, PRInt32 aSubstrLen)
{
  if (!aSubstrLen || (NS_strlen(aString) < static_cast<PRUint32>(aSubstrLen)))
    return PR_FALSE;

#ifdef MOZILLA_INTERNAL_API
  return (Substring(aString,
                    aString+aSubstrLen).Equals(Substring(aSubstr, aSubstr+aSubstrLen),
                                               nsCaseInsensitiveStringComparator()));
#else
  return (Substring(aString,
                    aString+aSubstrLen).Equals(Substring(aSubstr, aSubstr+aSubstrLen),
                                               CaseInsensitiveCompare));
#endif
}


PRBool
nsAbAutoCompleteSession::CheckEntry(nsAbAutoCompleteSearchString* searchStr,
                                    const PRUnichar* nickName,
                                    const PRUnichar* displayName,
                                    const PRUnichar* firstName,
                                    const PRUnichar* lastName,
                                    const PRUnichar* emailAddress)
{
  const PRUnichar * fullString;
  PRUint32 fullStringLen;
  PRBool isAMatch = PR_FALSE;
  
  if (searchStr->mFirstPartLen > 0 && searchStr->mSecondPartLen == 0)
  {
    fullString = searchStr->mFirstPart;
    fullStringLen = searchStr->mFirstPartLen;
  }
  else
  {
    fullString = searchStr->mFullString;
    fullStringLen = searchStr->mFullStringLen;
  }

  nsDependentString fullStringStr(fullString, fullStringLen);
  
  // Compare various properties looking for a match (exact or partial)
#ifdef MOZILLA_INTERNAL_API
  if ( (nickName &&
        fullStringStr.Equals(nsDependentString(nickName), nsCaseInsensitiveStringComparator())) || 
       (displayName &&
        fullStringStr.Equals(nsDependentString(displayName), nsCaseInsensitiveStringComparator())) ||
       (firstName &&
        fullStringStr.Equals(nsDependentString(firstName), nsCaseInsensitiveStringComparator())) ||
       (lastName &&
        fullStringStr.Equals(nsDependentString(lastName), nsCaseInsensitiveStringComparator())) || 
       (emailAddress &&
        fullStringStr.Equals(nsDependentString(emailAddress), nsCaseInsensitiveStringComparator())) ||
       (nickName && CommonPrefix(nickName, fullString, fullStringLen)) ||
       (displayName && CommonPrefix(displayName, fullString, fullStringLen)) || 
       (firstName && CommonPrefix(firstName, fullString, fullStringLen)) ||
       (lastName && CommonPrefix(lastName, fullString, fullStringLen)) ||
       (emailAddress && CommonPrefix(emailAddress, fullString, fullStringLen)) )
#else
  if ( (nickName &&
        fullStringStr.Equals(nsDependentString(nickName), CaseInsensitiveCompare)) || 
       (displayName &&
        fullStringStr.Equals(nsDependentString(displayName), CaseInsensitiveCompare)) ||
       (firstName &&
        fullStringStr.Equals(nsDependentString(firstName), CaseInsensitiveCompare)) ||
       (lastName &&
        fullStringStr.Equals(nsDependentString(lastName), CaseInsensitiveCompare)) || 
       (emailAddress &&
        fullStringStr.Equals(nsDependentString(emailAddress), CaseInsensitiveCompare)) ||
       (nickName && CommonPrefix(nickName, fullString, fullStringLen)) ||
       (displayName && CommonPrefix(displayName, fullString, fullStringLen)) || 
       (firstName && CommonPrefix(firstName, fullString, fullStringLen)) ||
       (lastName && CommonPrefix(lastName, fullString, fullStringLen)) ||
       (emailAddress && CommonPrefix(emailAddress, fullString, fullStringLen)) )
#endif

    isAMatch = PR_TRUE;
  //If we have a muti-part search string, look for a partial match with first name and last name or reverse
  else if (searchStr->mFirstPartLen && searchStr->mSecondPartLen)
  {
    if (((firstName && CommonPrefix(firstName, searchStr->mFirstPart, searchStr->mFirstPartLen)) &&
        (lastName && CommonPrefix(lastName, searchStr->mSecondPart, searchStr->mSecondPartLen))) ||
        ((lastName && CommonPrefix(lastName, searchStr->mFirstPart, searchStr->mFirstPartLen)) &&
        (firstName && CommonPrefix(firstName, searchStr->mSecondPart, searchStr->mSecondPartLen))))
      isAMatch = PR_TRUE;
  }

  return isAMatch;
}

nsresult nsAbAutoCompleteSession::SearchCards(nsIAbDirectory* directory, nsAbAutoCompleteSearchString* searchStr, nsIAutoCompleteResults* results)
{
  nsresult rv;    
  nsCOMPtr<nsISimpleEnumerator> cardsEnumerator;
  nsCOMPtr<nsIAbCard> card;
  PRInt32 i;
  
  rv = directory->GetChildCards(getter_AddRefs(cardsEnumerator));
  if (NS_SUCCEEDED(rv) && cardsEnumerator)
  {
    nsCOMPtr<nsISupports> item;
    PRBool more;
    while (NS_SUCCEEDED(cardsEnumerator->HasMoreElements(&more)) && more)
    {
      rv = cardsEnumerator->GetNext(getter_AddRefs(item));
      if (NS_SUCCEEDED(rv))
      {
        card = do_QueryInterface(item, &rv);
        if (NS_SUCCEEDED(rv))
        {
          nsString pEmailStr[MAX_NUMBER_OF_EMAIL_ADDRESSES]; //[0]=primary email, [1]=secondary email (no available with mailing list)
          nsString pDisplayNameStr;
          nsString pFirstNameStr;
          nsString pLastNameStr;
          nsString pNickNameStr;
          nsString pNotesStr;
          PRUint32 popularityIndex = 0;
          PRBool bIsMailList;

          rv = card->GetIsMailList(&bIsMailList);
          if (NS_FAILED(rv))
            continue;
          if (bIsMailList)
          {
            rv = card->GetPropertyAsAString(kNotesProperty, pNotesStr);
            if (NS_FAILED(rv))
              continue;
          }
          else
          {
            for (i = 0 ; i < MAX_NUMBER_OF_EMAIL_ADDRESSES; i ++)
            {
              switch (i)
              {
                case 0:
                  rv = card->GetPrimaryEmail(pEmailStr[i]);
                  break;
                case 1:
                  rv = card->GetPropertyAsAString(k2ndEmailProperty, pEmailStr[i]);
                  break;
                default:
                  return NS_ERROR_FAILURE;
              }
              if (NS_FAILED(rv))
                continue;

              // Don't bother with card without an email address
              if (pEmailStr[i].IsEmpty())
                continue;

              //...and does it looks like a valid address?
              if (pEmailStr[i].FindChar('@') <= 0)
                pEmailStr[i].Truncate();
            }
            if (pEmailStr[0].IsEmpty() && pEmailStr[1].IsEmpty())
              continue;
          }

          // Now, retrieve the user name and nickname
          (void)card->GetDisplayName(pDisplayNameStr);
          (void)card->GetFirstName(pFirstNameStr);
          (void)card->GetLastName(pLastNameStr);

          (void)card->GetPropertyAsAString(kNicknameProperty, pNickNameStr);

          (void)card->GetPropertyAsUint32(kPopularityIndexProperty,
                                          &popularityIndex);

          // In the address book a mailing list does not have an email address
          // field. However, we do "fix up" mailing lists in the UI sometimes to
          // look like "My List <My List>." If we are looking up an address, and
          // we are comparing it to a mailing list to see if it is a match,
          // instead of just looking for an exact match on "My List", hijack the
          // unused email address field and use that to test against
          // "My List <My List>"
          if (bIsMailList)
            mParser->MakeFullAddress(pDisplayNameStr, pDisplayNameStr, pEmailStr[0]);

          for (i = 0 ; i < MAX_NUMBER_OF_EMAIL_ADDRESSES; i ++)
          {
            if (!bIsMailList && pEmailStr[i].IsEmpty())
              continue;

            if (CheckEntry(searchStr, pNickNameStr.get(), 
                                      pDisplayNameStr.get(), 
                                      pFirstNameStr.get(), 
                                      pLastNameStr.get(), pEmailStr[i].get()))
            {
              nsString dirName;
              if (mAutoCompleteCommentColumn == 1)
              {
                rv = directory->GetDirName(dirName);
                if (NS_FAILED(rv))
                  continue;
              }

              AddToResult(pNickNameStr.get(), pDisplayNameStr.get(), 
                          pFirstNameStr.get(), pLastNameStr.get(), 
                          pEmailStr[i].get(), pNotesStr.get(), 
                          dirName.get(), popularityIndex, bIsMailList, results);
            }
          }
        }
      }
    }
  }

  return NS_OK;
}

nsresult nsAbAutoCompleteSession::SearchDirectory(const nsACString& aURI,
                                                  nsAbAutoCompleteSearchString* searchStr,
                                                  PRBool searchSubDirectory,
                                                  PRBool &didSearch,
                                                  nsIAutoCompleteResults* results)
{
    nsresult rv = NS_OK;
    nsCOMPtr<nsIRDFService> rdfService(do_GetService("@mozilla.org/rdf/rdf-service;1", &rv));
    NS_ENSURE_SUCCESS(rv, rv);

    nsCOMPtr <nsIRDFResource> resource;
    rv = rdfService->GetResource(aURI, getter_AddRefs(resource));
    NS_ENSURE_SUCCESS(rv, rv);

    // query interface 
    nsCOMPtr<nsIAbDirectory> directory(do_QueryInterface(resource, &rv));
    NS_ENSURE_SUCCESS(rv, rv);

    // when autocompleteing against directories, 
    // we only want to match against certain directories
    // we ask the directory if it wants to be used
    // for local autocompleting.
    PRBool useForAutocomplete;
    rv = directory->UseForAutocomplete(EmptyCString(), &useForAutocomplete);
    NS_ENSURE_SUCCESS(rv, rv);

    if (!useForAutocomplete)
      return NS_OK;

    if (!aURI.EqualsLiteral(kAllDirectoryRoot))
    {
        rv = SearchCards(directory, searchStr, results);
        didSearch = PR_TRUE;
    }
    
    if (!searchSubDirectory)
        return rv;
  
    nsCOMPtr<nsISimpleEnumerator> subDirectories;
    if (NS_SUCCEEDED(directory->GetChildNodes(getter_AddRefs(subDirectories))) && subDirectories)
    {
        nsCOMPtr<nsISupports> item;
        PRBool hasMore;
        while (NS_SUCCEEDED(rv = subDirectories->HasMoreElements(&hasMore)) && hasMore)
        {
            if (NS_SUCCEEDED(subDirectories->GetNext(getter_AddRefs(item))))
            {
              directory = do_QueryInterface(item, &rv);
              if (NS_SUCCEEDED(rv))
              {
                nsCOMPtr<nsIRDFResource> subResource(do_QueryInterface(item, &rv));
                if (NS_SUCCEEDED(rv))
                {
                    nsCString URI;
                    subResource->GetValue(getter_Copies(URI));
                    rv = SearchDirectory(URI, searchStr, PR_TRUE, didSearch,
                                         results);
                }
              }
            }
        }
    }
    return rv;
}

nsresult nsAbAutoCompleteSession::SearchPreviousResults(nsAbAutoCompleteSearchString *searchStr, nsIAutoCompleteResults *previousSearchResult, nsIAutoCompleteResults* results)
{
    if (!previousSearchResult)
        return NS_ERROR_NULL_POINTER;
        
    nsString prevSearchString;
    nsresult rv;

    rv = previousSearchResult->GetSearchString(getter_Copies(prevSearchString));
    NS_ENSURE_SUCCESS(rv, rv);
    
    if (prevSearchString.IsEmpty())
        return NS_ERROR_FAILURE;
    
    PRUint32 prevSearchStrLen = prevSearchString.Length();
    if (searchStr->mFullStringLen < prevSearchStrLen ||
        CommonPrefix(searchStr->mFullString, prevSearchString.get(), prevSearchStrLen))
        return NS_ERROR_ABORT;

    nsCOMPtr<nsISupportsArray> array;
    rv = previousSearchResult->GetItems(getter_AddRefs(array));
    if (NS_SUCCEEDED(rv))
    {
        PRUint32 nbrOfItems;
        PRUint32 i;
        PRUint32 pos;
        
        rv = array->Count(&nbrOfItems);
        if (NS_FAILED(rv) || nbrOfItems <= 0)
            return NS_ERROR_FAILURE;
        
        nsCOMPtr<nsISupports> item;
        nsCOMPtr<nsIAutoCompleteItem> resultItem;
        nsAbAutoCompleteParam *param;

        for (i = 0, pos = 0; i < nbrOfItems; i ++, pos ++)
        {
            rv = array->QueryElementAt(pos, NS_GET_IID(nsIAutoCompleteItem),
                                           getter_AddRefs(resultItem));
            NS_ENSURE_SUCCESS(rv, rv);
              
            rv = resultItem->GetParam(getter_AddRefs(item));
            NS_ENSURE_SUCCESS(rv, rv);
            if (!item)
                return NS_ERROR_FAILURE;

            param = (nsAbAutoCompleteParam *)(void *)item;
            
            if (CheckEntry(searchStr, param->mNickName, param->mDisplayName,  param->mFirstName,  param->mLastName, param->mEmailAddress))
                AddToResult(param->mNickName, param->mDisplayName, 
                            param->mFirstName, param->mLastName, 
                            param->mEmailAddress, param->mNotes, 
                            param->mDirName, param->mPopularityIndex, param->mIsMailList,
                            results);
        }
        return NS_OK;
    }

    return NS_ERROR_ABORT;
}

NS_IMETHODIMP nsAbAutoCompleteSession::OnStartLookup(const PRUnichar *uSearchString, nsIAutoCompleteResults *previousSearchResult, nsIAutoCompleteListener *listener)
{
    nsresult rv = NS_OK;
    
    if (!listener)
        return NS_ERROR_NULL_POINTER;
    
    nsCOMPtr<nsIPrefBranch> prefs(do_GetService(NS_PREFSERVICE_CONTRACTID, &rv));
    NS_ENSURE_SUCCESS(rv, rv);

    if (uSearchString[0] == 0)
    {
        listener->OnAutoComplete(nsnull, nsIAutoCompleteStatus::ignored);
        return NS_OK;
    }

    // figure out what we're supposed to do about the comment column, and 
    // remember it for when the results start coming back
    //
    rv = prefs->GetIntPref("mail.autoComplete.commentColumn", 
                           &mAutoCompleteCommentColumn);
    if (NS_FAILED(rv)) {
      mAutoCompleteCommentColumn = 0;
    }


    // strings with commas (commas denote multiple names) should be ignored for 
    // autocomplete purposes
    PRInt32 i;
    for (i = NS_strlen(uSearchString) - 1; i >= 0; i --)
        if (uSearchString[i] == ',')
        {
            listener->OnAutoComplete(nsnull, nsIAutoCompleteStatus::ignored);
            return NS_OK;
        }
        
    nsAbAutoCompleteSearchString searchStrings(uSearchString);
    
    nsCOMPtr<nsIAutoCompleteResults> results = do_CreateInstance(NS_AUTOCOMPLETERESULTS_CONTRACTID, &rv);
    if (NS_SUCCEEDED(rv))
      if (NS_FAILED(SearchPreviousResults(&searchStrings, previousSearchResult, results)))
      {
        PRBool didSearch = PR_FALSE;
        rv = SearchDirectory(NS_LITERAL_CSTRING(kAllDirectoryRoot), &searchStrings,
                             PR_TRUE, didSearch, results);
        NS_ASSERTION(NS_SUCCEEDED(rv), "searching local directories failed");

        // if we didn't search any directories, just return ignored
        if (!didSearch)
        {
          listener->OnAutoComplete(nsnull, nsIAutoCompleteStatus::ignored);
          return NS_OK;
        }
    }
                
    AutoCompleteStatus status = nsIAutoCompleteStatus::failed;
    if (NS_SUCCEEDED(rv) && results)
    {
        results->SetSearchString(uSearchString);
        results->SetDefaultItemIndex(-1);

        nsCOMPtr<nsISupportsArray> array;
        rv = results->GetItems(getter_AddRefs(array));
        if (NS_SUCCEEDED(rv))
        {
          //If we have more than a match (without counting the default item), we don't
          //want to auto complete the user input therefore set the default item index to -1

          PRUint32 nbrOfItems;
          rv = array->Count(&nbrOfItems);
          if (NS_SUCCEEDED(rv))
            if (nbrOfItems == 0)
              status = nsIAutoCompleteStatus::noMatch;
            else
            {
              status = nsIAutoCompleteStatus::matchFound;
              results->SetDefaultItemIndex(0);  
            }
        }
    }
    listener->OnAutoComplete(results, status);
    
    return NS_OK;
}

NS_IMETHODIMP nsAbAutoCompleteSession::OnStopLookup()
{
    return NS_OK;
}

NS_IMETHODIMP nsAbAutoCompleteSession::OnAutoComplete(const PRUnichar *searchString, nsIAutoCompleteResults *previousSearchResult, nsIAutoCompleteListener *listener)
{
    return OnStartLookup(searchString, previousSearchResult, listener);
}

NS_IMPL_ISUPPORTS1(nsAbAutoCompleteParam, nsISupports)

nsAbAutoCompleteSearchString::nsAbAutoCompleteSearchString(const PRUnichar *uSearchString)
{
  mFullString = NS_strdup(uSearchString);
  mFullStringLen = NS_strlen(mFullString);
  
  PRUint32 i;
  PRUnichar * aPtr;
  for (i = 0, aPtr = (PRUnichar*)mFullString; i < mFullStringLen; i ++, aPtr ++)
  {
    if (*aPtr == ' ')
    {
      mFirstPart = NS_strndup(mFullString, i);
      mFirstPartLen = i;
      mSecondPart = NS_strdup(++aPtr);
      mSecondPartLen = mFullStringLen - i - 1;
      return;
    }
  }
  
  /* If we did not find a space in the search string, initialize the first and second part as null */
  mFirstPart = nsnull;
  mFirstPartLen = 0;
  mSecondPart = nsnull;
  mSecondPartLen = 0;
}

nsAbAutoCompleteSearchString::~nsAbAutoCompleteSearchString()
{
  if (mFullString)
     NS_Free((PRUnichar*)mFullString);
  if (mFirstPart)
     NS_Free((PRUnichar*)mFirstPart);
  if (mSecondPart)
     NS_Free((PRUnichar*)mSecondPart);
}
