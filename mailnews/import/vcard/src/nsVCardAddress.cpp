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
 * The Original Code is mailnews vcard import.
 *
 * The Initial Developer of the Original Code is
 * Evan Stratford <evan.stratford@gmail.com>.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

#include "nsAbBaseCID.h"
#include "nsNativeCharsetUtils.h"
#include "nsNetUtil.h"
#include "nsVCardAddress.h"

#include "nsIAbCard.h"
#include "nsIAbManager.h"
#include "nsIAddrDatabase.h"
#include "nsIFile.h"
#include "nsIInputStream.h"
#include "nsILineInputStream.h"

#include "plstr.h"
#include "msgCore.h"

nsVCardAddress::nsVCardAddress()
{
}

nsVCardAddress::~nsVCardAddress()
{
}

nsresult nsVCardAddress::ImportAddresses(
    PRBool *pAbort,
    const PRUnichar *pName,
    nsIFile *pSrc,
    nsIAddrDatabase *pDb,
    nsString& errors,
    PRUint32 *pProgress)
{
  // Open the source file for reading, read each line and process it!
  nsCOMPtr<nsIInputStream> inputStream;
  nsresult rv = NS_NewLocalFileInputStream(getter_AddRefs(inputStream), pSrc);
  if (NS_FAILED(rv)) {
    IMPORT_LOG0("*** Error opening address file for reading\n");
    return rv;
  }

  // Open the source file for reading, read each line and process it!
  // Here we use this to work out the size of the file, so we can update
  // an integer as we go through the file which will update a progress
  // bar if required by the caller.
  PRUint32 bytesLeft = 0;
  rv = inputStream->Available(&bytesLeft);
  if (NS_FAILED(rv)) {
    IMPORT_LOG0("*** Error checking address file for size\n");
    inputStream->Close();
    return rv;
  }

  PRUint32 totalBytes = bytesLeft;
  nsCOMPtr<nsILineInputStream> lineStream(do_QueryInterface(inputStream, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  PRBool more = PR_TRUE;
  nsCString record;
  while (!(*pAbort) && more && NS_SUCCEEDED(rv)) {
    rv = ReadRecord(lineStream, record, &more);
    if (NS_SUCCEEDED(rv)) {
      // Parse the vCard and build an nsIAbCard from it
      nsCOMPtr<nsIAbManager> ab =
        do_GetService(NS_ABMANAGER_CONTRACTID, &rv);
      NS_ENSURE_SUCCESS(rv, rv);

      nsCOMPtr<nsIAbCard> cardFromVCard;
      rv = ab->EscapedVCardToAbCard(record.get(), getter_AddRefs(cardFromVCard));
      NS_ENSURE_SUCCESS(rv, rv);

      rv = pDb->CreateNewCardAndAddToDB(cardFromVCard, PR_FALSE, nsnull);
      NS_ENSURE_SUCCESS(rv, rv);

      if (NS_FAILED(rv)) {
        IMPORT_LOG0("*** Error processing vCard record.\n");
      }
    }
    if (NS_SUCCEEDED(rv) && pProgress) {
      // This won't be totally accurate, but its the best we can do
      // considering that lineStream won't give us how many bytes
      // are actually left.
      bytesLeft -= record.Length();
      *pProgress = totalBytes - bytesLeft;
    }
  }
  inputStream->Close();

  if (NS_FAILED(rv)) {
    IMPORT_LOG0("*** Error reading the address book - probably incorrect ending\n");
    return NS_ERROR_FAILURE;
  }

  return pDb->Commit(nsAddrDBCommitType::kLargeCommit);
}

nsresult nsVCardAddress::ReadRecord(
    nsILineInputStream *aLineStream, nsCString &aRecord, PRBool *aMore)
{
  PRBool more = PR_TRUE;
  nsresult rv;
  nsCString line;

  aRecord.Truncate();

  // read BEGIN:VCARD
  rv = aLineStream->ReadLine(line, &more);
  if (!line.Equals(NS_LITERAL_CSTRING("BEGIN:VCARD"),
                   nsCaseInsensitiveCStringComparator())) {
    IMPORT_LOG0("*** Expected case-insensitive BEGIN:VCARD at start of vCard\n");
    rv = NS_ERROR_FAILURE;
    *aMore = more;
    return rv;
  }
  aRecord.Append(line);

  // read until END:VCARD
  do {
    if (!more) {
      IMPORT_LOG0("*** Expected case-insensitive END:VCARD at start of vCard\n");
      rv = NS_ERROR_FAILURE;
      break;
    }
    rv = aLineStream->ReadLine(line, &more);
    aRecord.AppendLiteral(MSG_LINEBREAK);
    aRecord.Append(line);
  } while (!line.Equals(NS_LITERAL_CSTRING("END:VCARD"),
                        nsCaseInsensitiveCStringComparator()));

  *aMore = more;
  return rv;
}
