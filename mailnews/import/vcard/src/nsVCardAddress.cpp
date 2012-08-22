/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
#include "nsMsgUtils.h"

nsVCardAddress::nsVCardAddress()
{
}

nsVCardAddress::~nsVCardAddress()
{
}

nsresult nsVCardAddress::ImportAddresses(
    bool *pAbort,
    const PRUnichar *pName,
    nsIFile *pSrc,
    nsIAddrDatabase *pDb,
    nsString& errors,
    uint32_t *pProgress)
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
  uint64_t bytesLeft = 0;
  rv = inputStream->Available(&bytesLeft);
  if (NS_FAILED(rv)) {
    IMPORT_LOG0("*** Error checking address file for size\n");
    inputStream->Close();
    return rv;
  }

  uint64_t totalBytes = bytesLeft;
  nsCOMPtr<nsILineInputStream> lineStream(do_QueryInterface(inputStream, &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  nsCOMPtr<nsIAbManager> ab = do_GetService(NS_ABMANAGER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  bool more = true;
  nsCString record;
  while (!(*pAbort) && more && NS_SUCCEEDED(rv)) {
    rv = ReadRecord(lineStream, record, &more);
    if (NS_SUCCEEDED(rv) && !record.IsEmpty()) {
      // Parse the vCard and build an nsIAbCard from it
      nsCOMPtr<nsIAbCard> cardFromVCard;
      rv = ab->EscapedVCardToAbCard(record.get(), getter_AddRefs(cardFromVCard));
      NS_ENSURE_SUCCESS(rv, rv);

      rv = pDb->CreateNewCardAndAddToDB(cardFromVCard, false, nullptr);
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
    nsILineInputStream *aLineStream, nsCString &aRecord, bool *aMore)
{
  bool more = true;
  nsresult rv;
  nsCString line;

  aRecord.Truncate();

  // remove the empty lines.
  do {
    rv = aLineStream->ReadLine(line, aMore);
  }
  while (line.IsEmpty() && *aMore);
  if (!*aMore)
    return rv;

  // read BEGIN:VCARD
  if (!line.LowerCaseEqualsLiteral("begin:vcard")) {
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
  } while (!line.LowerCaseEqualsLiteral("end:vcard"));

  *aMore = more;
  return rv;
}
