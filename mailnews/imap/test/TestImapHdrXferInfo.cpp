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
 * Mozilla Messaging
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mark Banner <bugzilla@standard8.plus.com>
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
  PRInt32 numHdrs = -1;

  // Check the number of headers initially is zero
  if (NS_FAILED(hdrInfo->GetNumHeaders(&numHdrs)))
    return 1;

  if (numHdrs != 0)
    return 2;

  // Get a header that doesn't exist
  if (hdrInfo->GetHeader(1, getter_AddRefs(hdr)) != NS_ERROR_NULL_POINTER)
    return 3;

  PRInt32 i;
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
  nsIImapHeaderInfo* hdrArray[kNumHdrsToXfer] = { nsnull };

  int result = MainChecks(hdrInfo, hdrArray, eAddNoCheck);
  if (result)
    return result;

  // Now reset all
  hdrInfo->ResetAll();

  // and repeat
  result = MainChecks(hdrInfo, hdrArray, eCheckSame);
  return result ? result + 100 : 0;
}
