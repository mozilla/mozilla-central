/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "TestCommon.h"
#include "nsIServiceManager.h"
#include "nsICookieService.h"
#include "nsICookieManager.h"
#include "nsICookieManager2.h"
#include "nsICookie2.h"
#include <stdio.h>
#include "plstr.h"
#include "prprf.h"
#include "nsNetUtil.h"
#include "nsNetCID.h"
#include "nsStringAPI.h"
#include "nsIPrefBranch.h"
#include "nsIPrefService.h"

static NS_DEFINE_CID(kCookieServiceCID, NS_COOKIESERVICE_CID);
static NS_DEFINE_CID(kPrefServiceCID,   NS_PREFSERVICE_CID);

// various pref strings
static const char kCookiesPermissions[] = "network.cookie.cookieBehavior";
static const char kCookiesLifetimeEnabled[] = "network.cookie.lifetime.enabled";
static const char kCookiesLifetimeDays[] = "network.cookie.lifetime.days";
static const char kCookiesLifetimeCurrentSession[] = "network.cookie.lifetime.behavior";
static const char kCookiesP3PString[] = "network.cookie.p3p";
static const char kCookiesAskPermission[] = "network.cookie.warnAboutCookies";
static const char kCookiesMaxPerHost[] = "network.cookie.maxPerHost";

static char *sBuffer;

nsresult
SetACookie(nsICookieService *aCookieService, const char *aSpec1, const char *aSpec2, const char* aCookieString, const char *aServerTime)
{
    nsCOMPtr<nsIURI> uri1, uri2;
    NS_NewURI(getter_AddRefs(uri1), aSpec1);
    if (aSpec2)
        NS_NewURI(getter_AddRefs(uri2), aSpec2);

    sBuffer = PR_sprintf_append(sBuffer, "    for host \"%s\": SET ", aSpec1);
    nsresult rv = aCookieService->SetCookieStringFromHttp(uri1, uri2, nullptr, (char *)aCookieString, aServerTime, nullptr);
    // the following code is useless. the cookieservice blindly returns NS_OK
    // from SetCookieString. we have to call GetCookie to see if the cookie was
    // set correctly...
    if (NS_FAILED(rv)) {
        sBuffer = PR_sprintf_append(sBuffer, "nothing\n");
    } else {
        sBuffer = PR_sprintf_append(sBuffer, "\"%s\"\n", aCookieString);
    }
    return rv;
}

nsresult
SetACookieNoHttp(nsICookieService *aCookieService, const char *aSpec, const char* aCookieString)
{
    nsCOMPtr<nsIURI> uri;
    NS_NewURI(getter_AddRefs(uri), aSpec);

    sBuffer = PR_sprintf_append(sBuffer, "    for host \"%s\": SET ", aSpec);
    nsresult rv = aCookieService->SetCookieString(uri, nullptr, (char *)aCookieString, nullptr);
    // the following code is useless. the cookieservice blindly returns NS_OK
    // from SetCookieString. we have to call GetCookie to see if the cookie was
    // set correctly...
    if (NS_FAILED(rv)) {
        sBuffer = PR_sprintf_append(sBuffer, "nothing\n");
    } else {
        sBuffer = PR_sprintf_append(sBuffer, "\"%s\"\n", aCookieString);
    }
    return rv;
}

// returns true if cookie(s) for the given host were found; else false.
// the cookie string is returned via aCookie.
bool
GetACookie(nsICookieService *aCookieService, const char *aSpec1, const char *aSpec2, char **aCookie)
{
    nsCOMPtr<nsIURI> uri1, uri2;
    NS_NewURI(getter_AddRefs(uri1), aSpec1);
    if (aSpec2)
        NS_NewURI(getter_AddRefs(uri2), aSpec2);

    sBuffer = PR_sprintf_append(sBuffer, "             \"%s\": GOT ", aSpec1);
    nsresult rv = aCookieService->GetCookieStringFromHttp(uri1, uri2, nullptr, aCookie);
    if (NS_FAILED(rv)) {
      sBuffer = PR_sprintf_append(sBuffer, "XXX GetCookieString() failed!\n");
    }
    if (!*aCookie) {
        sBuffer = PR_sprintf_append(sBuffer, "nothing\n");
    } else {
        sBuffer = PR_sprintf_append(sBuffer, "\"%s\"\n", *aCookie);
    }
    return *aCookie != nullptr;
}

// returns true if cookie(s) for the given host were found; else false.
// the cookie string is returned via aCookie.
bool
GetACookieNoHttp(nsICookieService *aCookieService, const char *aSpec, char **aCookie)
{
    nsCOMPtr<nsIURI> uri;
    NS_NewURI(getter_AddRefs(uri), aSpec);

    sBuffer = PR_sprintf_append(sBuffer, "             \"%s\": GOT ", aSpec);
    nsresult rv = aCookieService->GetCookieString(uri, nullptr, aCookie);
    if (NS_FAILED(rv)) {
      sBuffer = PR_sprintf_append(sBuffer, "XXX GetCookieString() failed!\n");
    }
    if (!*aCookie) {
        sBuffer = PR_sprintf_append(sBuffer, "nothing\n");
    } else {
        sBuffer = PR_sprintf_append(sBuffer, "\"%s\"\n", *aCookie);
    }
    return *aCookie != nullptr;
}

// some #defines for comparison rules
#define MUST_BE_NULL     0
#define MUST_EQUAL       1
#define MUST_CONTAIN     2
#define MUST_NOT_CONTAIN 3
#define MUST_NOT_EQUAL   4

// a simple helper function to improve readability:
// takes one of the #defined rules above, and performs the appropriate test.
// true means the test passed; false means the test failed.
static inline bool
CheckResult(const char *aLhs, uint32_t aRule, const char *aRhs = nullptr)
{
    switch (aRule) {
        case MUST_BE_NULL:
            return !aLhs || !*aLhs;

        case MUST_EQUAL:
            return !PL_strcmp(aLhs, aRhs);

        case MUST_NOT_EQUAL:
            return PL_strcmp(aLhs, aRhs);

        case MUST_CONTAIN:
            return PL_strstr(aLhs, aRhs) != nullptr;

        case MUST_NOT_CONTAIN:
            return PL_strstr(aLhs, aRhs) == nullptr;

        default:
            return false; // failure
    }
}

// helper function that ensures the first aSize elements of aResult are
// true (i.e. all tests succeeded). prints the result of the tests (if any
// tests failed, it prints the zero-based index of each failed test).
bool
PrintResult(const bool aResult[], uint32_t aSize)
{
    bool failed = false;
    sBuffer = PR_sprintf_append(sBuffer, "*** tests ");
    for (uint32_t i = 0; i < aSize; ++i) {
        if (!aResult[i]) {
            failed = true;
            sBuffer = PR_sprintf_append(sBuffer, "%d ", i);
        }
    }
    if (failed) {
        sBuffer = PR_sprintf_append(sBuffer, "FAILED!\a\n");
    } else {
        sBuffer = PR_sprintf_append(sBuffer, "passed.\n");
    }
    return !failed;
}

void
InitPrefs(nsIPrefBranch *aPrefBranch)
{
    // init some relevant prefs, so the tests don't go awry.
    // we use the most restrictive set of prefs we can;
    // however, we don't test third party blocking here.
    aPrefBranch->SetIntPref(kCookiesPermissions, 0); // accept all
    aPrefBranch->SetBoolPref(kCookiesLifetimeEnabled, true);
    aPrefBranch->SetIntPref(kCookiesLifetimeCurrentSession, 0);
    aPrefBranch->SetIntPref(kCookiesLifetimeDays, 1);
    aPrefBranch->SetBoolPref(kCookiesAskPermission, false);
    // Set the base domain limit to 50 so we have a known value.
    aPrefBranch->SetIntPref(kCookiesMaxPerHost, 50);
}

class ScopedXPCOM
{
public:
  ScopedXPCOM() : rv(NS_InitXPCOM2(nullptr, nullptr, nullptr)) { }
  ~ScopedXPCOM()
  {
    if (NS_SUCCEEDED(rv))
      NS_ShutdownXPCOM(nullptr);
  }

  nsresult rv;
};

int
main(int32_t argc, char *argv[])
{
    if (test_common_init(&argc, &argv) != 0)
        return -1;

    bool allTestsPassed = true;

    ScopedXPCOM xpcom;
    if (NS_FAILED(xpcom.rv))
      return -1;

    {
      nsresult rv0;

      nsCOMPtr<nsICookieService> cookieService =
        do_GetService(kCookieServiceCID, &rv0);
      if (NS_FAILED(rv0)) return -1;

      nsCOMPtr<nsIPrefBranch> prefBranch =
        do_GetService(kPrefServiceCID, &rv0);
      if (NS_FAILED(rv0)) return -1;

      InitPrefs(prefBranch);

      bool rv[20];
      nsCString cookie;

      /* The basic idea behind these tests is the following:
       *
       * we set() some cookie, then try to get() it in various ways. we have
       * several possible tests we perform on the cookie string returned from
       * get():
       *
       * a) check whether the returned string is null (i.e. we got no cookies
       *    back). this is used e.g. to ensure a given cookie was deleted
       *    correctly, or to ensure a certain cookie wasn't returned to a given
       *    host.
       * b) check whether the returned string exactly matches a given string.
       *    this is used where we want to make sure our cookie service adheres to
       *    some strict spec (e.g. ordering of multiple cookies), or where we
       *    just know exactly what the returned string should be.
       * c) check whether the returned string contains/does not contain a given
       *    string. this is used where we don't know/don't care about the
       *    ordering of multiple cookies - we just want to make sure the cookie
       *    string contains them all, in some order.
       *
       * the results of each individual testing operation from CheckResult() is
       * stored in an array of bools, which is then checked against the expected
       * outcomes (all successes), by PrintResult(). the overall result of all
       * tests to date is kept in |allTestsPassed|, for convenient display at the
       * end.
       *
       * Interpreting the output:
       * each setting/getting operation will print output saying exactly what
       * it's doing and the outcome, respectively. this information is only
       * useful for debugging purposes; the actual result of the tests is
       * printed at the end of each block of tests. this will either be "all
       * tests passed" or "tests X Y Z failed", where X, Y, Z are the indexes
       * of rv (i.e. zero-based). at the conclusion of all tests, the overall
       * passed/failed result is printed.
       *
       * NOTE: this testsuite is not yet comprehensive or complete, and is
       * somewhat contrived - still under development, and needs improving!
       */

      // *** mailnews tests
      sBuffer = PR_sprintf_append(sBuffer, "*** Beginning mailnews tests...\n");

      // test some mailnews cookies to ensure blockage.
      // we use null firstURI's deliberately, since we have hacks to deal with
      // this situation...
      SetACookie(cookieService, "mailbox://mail.co.uk/", nullptr, "test=mailnews", nullptr);
      GetACookie(cookieService, "mailbox://mail.co.uk/", nullptr, getter_Copies(cookie));
      rv[0] = CheckResult(cookie.get(), MUST_BE_NULL);
      GetACookie(cookieService, "http://mail.co.uk/", nullptr, getter_Copies(cookie));
      rv[1] = CheckResult(cookie.get(), MUST_BE_NULL);
      SetACookie(cookieService, "http://mail.co.uk/", nullptr, "test=mailnews", nullptr);
      GetACookie(cookieService, "mailbox://mail.co.uk/", nullptr, getter_Copies(cookie));
      rv[2] = CheckResult(cookie.get(), MUST_BE_NULL);
      GetACookie(cookieService, "http://mail.co.uk/", nullptr, getter_Copies(cookie));
      rv[3] = CheckResult(cookie.get(), MUST_EQUAL, "test=mailnews");
      SetACookie(cookieService, "http://mail.co.uk/", nullptr, "test=mailnews; max-age=0", nullptr);
      GetACookie(cookieService, "http://mail.co.uk/", nullptr, getter_Copies(cookie));
      rv[4] = CheckResult(cookie.get(), MUST_BE_NULL);

      allTestsPassed = PrintResult(rv, 5) && allTestsPassed;

      sBuffer = PR_sprintf_append(sBuffer, "\n*** Result: %s!\n\n", allTestsPassed ? "all tests passed" : "TEST(S) FAILED");
    }

    if (allTestsPassed)
      printf("All Mail Cookie Tests passed\n");
    else
    {
      // print the entire log
      printf("%s", sBuffer);
      return 1;
    }

    PR_smprintf_free(sBuffer);
    sBuffer = nullptr;

    return 0;
}
