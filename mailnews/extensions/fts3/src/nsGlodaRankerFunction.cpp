/* ***** BEGIN LICENSE BLOCK *****
 *   Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * The Original Code is Thunderbird Global Database.
 *
 * The Initial Developer of the Original Code is the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Andrew Sutherland <asutherland@asutherland.org>
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

#include "nsGlodaRankerFunction.h"
#include "mozIStorageValueArray.h"

#include "sqlite3.h"

#include "nsCOMPtr.h"
#include "nsIVariant.h"
#include "nsComponentManagerUtils.h"

#ifndef SQLITE_VERSION_NUMBER
#error "We need SQLITE_VERSION_NUMBER defined!"
#endif

NS_IMPL_ISUPPORTS1(nsGlodaRankerFunction, mozIStorageFunction)

nsGlodaRankerFunction::nsGlodaRankerFunction()
{
}

nsGlodaRankerFunction::~nsGlodaRankerFunction()
{
}

static PRInt32 COLUMN_SATURATION[] = {1, 10, 1, 1, 1};

/**
 * Our ranking function basically just multiplies the weight of the column
 * against the number of (saturating) matches.
 *
 * The original code is a SQLite example ranking function, although somewhat
 * rather modified at this point.  All SQLite code is public domain, so we are
 * subsuming it to MPL1.1/LGPL2/GPL2.
 */
NS_IMETHODIMP
nsGlodaRankerFunction::OnFunctionCall(mozIStorageValueArray *aArguments,
                                      nsIVariant **_result)
{
  // all argument names are maintained from the original SQLite code.
  PRUint32 nVal;
  nsresult rv = aArguments->GetNumEntries(&nVal);
  NS_ENSURE_SUCCESS(rv, rv);

  /* Check that the number of arguments passed to this function is correct.
  ** If not, jump to wrong_number_args. Set aMatchinfo to point to the array
  ** of unsigned integer values returned by FTS3 function matchinfo. Set
  ** nPhrase to contain the number of reportable phrases in the users full-text
  ** query, and nCol to the number of columns in the table.
  */
  if (nVal < 1)
    return NS_ERROR_INVALID_ARG;

  PRUint32 lenMatchInfo;
  PRInt32 *aMatchinfo = (PRInt32 *)aArguments->AsSharedBlob(0, &lenMatchInfo);
  
  PRInt32 nPhrase = aMatchinfo[0];
  PRInt32 nCol = aMatchinfo[1];
  if (nVal != (1 + nCol))
    return NS_ERROR_INVALID_ARG;

  double score = 0.0;

  // SQLite 3.6.22 has a different matchinfo layout than SQLite 3.6.23+
#if SQLITE_VERSION_NUMBER <= 3006022

  /* Iterate through each phrase in the users query. */
  for (PRUint32 iPhrase = 0; iPhrase < nPhrase; iPhrase++) {
    // in SQ
    for (PRUint32 iCol = 0; iCol < nCol; iCol++) {
      PRInt32 nHitCount = aMatchinfo[2 + (iPhrase+1)*nCol + iCol];
      PRInt32 nGlobalHitCount = aMatchinfo[2 + iCol];
      double weight = aArguments->AsDouble(iCol+1);
      if (nHitCount > 0) {
        score += (nHitCount > COLUMN_SATURATION[iCol]) ?
          (COLUMN_SATURATION[iCol] * weight) :
          (nHitCount * weight);
      }
    }
  }

#else

  /* Iterate through each phrase in the users query. */
  for (PRUint32 iPhrase = 0; iPhrase < nPhrase; iPhrase++) {
    /* Now iterate through each column in the users query. For each column,
    ** increment the relevancy score by:
    **
    **   (<hit count> / <global hit count>) * <column weight>
    **
    ** aPhraseinfo[] points to the start of the data for phrase iPhrase. So
    ** the hit count and global hit counts for each column are found in 
    ** aPhraseinfo[iCol*3] and aPhraseinfo[iCol*3+1], respectively.
    */
    PRInt32 *aPhraseinfo = &aMatchinfo[2 + iPhrase*nCol*3];
    for (PRUint32 iCol = 0; iCol < nCol; iCol++) {
      PRInt32 nHitCount = aPhraseinfo[3 * iCol];
      PRInt32 nGlobalHitCount = aPhraseinfo[3 * iCol + 1];
      double weight = aArguments->AsDouble(iCol+1);
      if (nHitCount > 0) {
        score += (nHitCount > COLUMN_SATURATION[iCol]) ?
          (COLUMN_SATURATION[iCol] * weight) :
          (nHitCount * weight);
      }
    }
  }

#endif

  nsCOMPtr<nsIWritableVariant> result =
    do_CreateInstance("@mozilla.org/variant;1");
  NS_ENSURE_TRUE(result, NS_ERROR_OUT_OF_MEMORY);
   
  rv = result->SetAsDouble(score);
  NS_ENSURE_SUCCESS(rv, rv);

  NS_ADDREF(*_result = result);
  return NS_OK;
}
