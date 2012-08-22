/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#include <stdio.h>
#include "TestHarness.h"
#include "nsCOMPtr.h"
#include "nsMsgUtils.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "nsISupportsPrimitives.h"
#include "nsStringGlue.h"

#define STRING_SIZE 255
struct testInfo {
  char encodedInput[STRING_SIZE];
  char expectedOutput[STRING_SIZE];
  bool expectedDidModify;
};

int
testStripRe(const char *encodedInput, char *expectedOutput,
            bool expectedDidModify)
{
  // call NS_StripRE with the appropriate args
  char *modifiedSubject;
  bool didModify;
  const char *encodedInout = encodedInput;
  uint32_t length = strlen(encodedInout);
  didModify = NS_MsgStripRE(&encodedInout, &length, &modifiedSubject);
  
  // make sure we got the right results
  if (didModify != expectedDidModify)
    return 2;

  if (didModify) {
    if (strcmp(expectedOutput, modifiedSubject)) {
      return 3;
    }
  } else if (strcmp(expectedOutput, encodedInout)) {
      return 4;
  }

  // test passed
  return 0;
}

// General note about return values:
// return 1 for a setup or xpcom type failure, return 2 for a real test failure
int main(int argc, char** argv)
{

  ScopedXPCOM xpcom("TestMsgStripRE.cpp");
  if (xpcom.failed())
    return 1;

  nsresult rv;
  nsCOMPtr<nsIPrefBranch> prefBranch(do_GetService(NS_PREFSERVICE_CONTRACTID,
                                     &rv));
  NS_ENSURE_SUCCESS(rv, rv);

  // create an nsISupportsString and stuff our literal into it   
  nsCOMPtr<nsISupportsString> rePrefixes = 
    do_CreateInstance("@mozilla.org/supports-string;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  // portable C++ expression of "SV,ÆØÅ"
  static const unsigned char utf8Prefixes[] =
    {'S', 'V', ',', 0303, 0206, 0303, 0230, 0303, 0205, '\0'};

  rv = rePrefixes->SetData(NS_ConvertUTF8toUTF16(utf8Prefixes));
  NS_ENSURE_SUCCESS(rv, rv);

  // set localizedRe pref
  rv = prefBranch->SetComplexValue("mailnews.localizedRe", 
                                   NS_GET_IID(nsISupportsString), rePrefixes);
  NS_ENSURE_SUCCESS(rv, rv);

  // run our tests 
  struct testInfo testInfoStructs[] = {
    {"SV: =?ISO-8859-1?Q?=C6blegr=F8d?=", "=?ISO-8859-1?Q?=C6blegr=F8d?=",
     true},
    {"=?ISO-8859-1?Q?SV=3A=C6blegr=F8d?=", "=?ISO-8859-1?Q?=C6blegr=F8d?=",
     true},

     // Note that in the next two tests, the only ISO-8859-1 chars are in the
     // localizedRe piece, so once they've been stripped, the re-encoding process 
     // simply writes out ASCII rather than an ISO-8859-1 encoded string with
     // no actual ISO-8859-1 special characters, which seems reasonable.
    {"=?ISO-8859-1?Q?=C6=D8=C5=3A_Foo_bar?=", "Foo bar", true},
    {"=?ISO-8859-1?Q?=C6=D8=C5=3AFoo_bar?=", "Foo bar", true}
  };

  bool allTestsPassed = true;
  int result;
  for (unsigned int i = 0; i < NS_ARRAY_LENGTH(testInfoStructs); i++) {
    result = testStripRe(testInfoStructs[i].encodedInput,
                         testInfoStructs[i].expectedOutput,
                         testInfoStructs[i].expectedDidModify);
    if (result)
    {
      fail("%s, i=%d | result=%d\n", __FILE__, i, result);
      allTestsPassed = false;
    }
  }

  if (allTestsPassed) {
    passed("all tests passed\n");
  }
  
  return allTestsPassed ? 0 : 2;
}
