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
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Dan Mosedale <dmose@mozillamessaging.com>
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
#include "nsMsgUtils.h"
#include "nsIPrefService.h"
#include "nsIPrefBranch.h"
#include "nsISupportsPrimitives.h"
#include "nsStringGlue.h"

#define STRING_SIZE 255
struct testInfo {
  char encodedInput[STRING_SIZE];
  char expectedOutput[STRING_SIZE];
  PRBool expectedDidModify;
};

int
testStripRe(const char *encodedInput, char *expectedOutput,
            PRBool expectedDidModify)
{
  // call NS_StripRE with the appropriate args
  char *modifiedSubject;
  PRBool didModify;
  const char *encodedInout = encodedInput;
  PRUint32 length = strlen(encodedInout);
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
  static const char utf8Prefixes[] = 
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
     PR_TRUE},
    {"=?ISO-8859-1?Q?SV=3A=C6blegr=F8d?=", "=?ISO-8859-1?Q?=C6blegr=F8d?=",
     PR_TRUE},

     // Note that in the next two tests, the only ISO-8859-1 chars are in the
     // localizedRe piece, so once they've been stripped, the re-encoding process 
     // simply writes out ASCII rather than an ISO-8859-1 encoded string with
     // no actual ISO-8859-1 special characters, which seems reasonable.
    {"=?ISO-8859-1?Q?=C6=D8=C5=3A_Foo_bar?=", "Foo bar", PR_TRUE},
    {"=?ISO-8859-1?Q?=C6=D8=C5=3AFoo_bar?=", "Foo bar", PR_TRUE}
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
