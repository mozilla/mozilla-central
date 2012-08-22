/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#include <stdio.h>
#include "TestHarness.h"
#include "nsCOMPtr.h"
#include "msgCore.h"
#include "nsImapProtocol.h"
#include "nsMsgMessageFlags.h"

// What to check
enum EHdrArrayCheck
{
  eAddNoCheck,
  eCheckSame
};

int MainChecks(nsMsgImapHdrXferInfo* hdrInfo, nsIImapHeaderInfo **hdrArray,
               EHdrArrayCheck hdrArrayCheck)
{
  nsCOMPtr<nsIImapHeaderInfo> hdr;
  int32_t numHdrs = -1;

  // Check the number of headers initially is zero
  if (NS_FAILED(hdrInfo->GetNumHeaders(&numHdrs)))
    return 1;

  if (numHdrs != 0)
    return 2;

  // Get a header that doesn't exist
  if (hdrInfo->GetHeader(1, getter_AddRefs(hdr)) != NS_ERROR_NULL_POINTER)
    return 3;

  int32_t i;
  for (i = 0; i < kNumHdrsToXfer; ++i)
  {
    // Now kick off a new one.
    hdr = hdrInfo->StartNewHdr();
    if (!hdr)
      return 4;

    // Check pointers are different or not depending on which cycle we are in
    switch (hdrArrayCheck)
    {
    case eAddNoCheck:
      hdrArray[i] = hdr;
      break;
    case eCheckSame:
      if (hdrArray[i] != hdr)
        return 5;
      break;
    default:
      return 1;
    }

    if (NS_FAILED(hdrInfo->GetNumHeaders(&numHdrs)))
      return 1;

    if (numHdrs != i + 1)
      return 7;
  }

  // Now try and get one more (this should return null)
  if (hdrInfo->StartNewHdr())
    return 8;

  // Now check the number of headers
  if (NS_FAILED(hdrInfo->GetNumHeaders(&numHdrs)))
    return 1;

  if (numHdrs != kNumHdrsToXfer)
    return 9;

  // Now check our pointers align with those from GetHeader
  if (hdrArrayCheck != 2)
  {
    for (i = 0; i < kNumHdrsToXfer; ++i)
    {
      if (NS_FAILED(hdrInfo->GetHeader(i, getter_AddRefs(hdr))))
        return 1;

      if (hdr != hdrArray[i])
        return 10;
    }
  }
  return 0;
}

// General note about return values:
// return 1 for a setup or xpcom type failure, return 2 for a real test failure
int main(int argc, char** argv)
{
  ScopedXPCOM xpcom("TestImapHdrXferInfo.cpp");
  if (xpcom.failed())
    return 1;

  nsRefPtr<nsMsgImapHdrXferInfo> hdrInfo = new nsMsgImapHdrXferInfo();
  // Purposely not reference counted to ensure we get the same pointers the
  // second time round MainChecks.
  nsIImapHeaderInfo* hdrArray[kNumHdrsToXfer] = { nullptr };

  int result = MainChecks(hdrInfo, hdrArray, eAddNoCheck);
  if (result)
  {
    printf("TEST-UNEXPECTED-FAIL | %s | %d\n", __FILE__, result);
    return result;
  }

  // Now reset all
  hdrInfo->ResetAll();

  // and repeat
  result = MainChecks(hdrInfo, hdrArray, eCheckSame);
  if (result)
  {
    // add 100 to differentiate results
    result += 100;
    printf("TEST-UNEXPECTED-FAIL | %s | %d\n", __FILE__, result);
    return result;
  }

  printf("TEST-PASS | %s | all tests passed\n", __FILE__);
  return result;
}
