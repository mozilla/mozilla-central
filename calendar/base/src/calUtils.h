/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#if !defined(INCLUDED_CAL_UTILS_H)
#define INCLUDED_CAL_UTILS_H

#if defined(MOZILLA_INTERNAL_API)
#include "nsCRT.h"
#include "nsString.h"
#else
#include "nsMemory.h"
#include "nsCRTGlue.h"
#include "nsStringAPI.h"
#endif

#include "nsAutoPtr.h"
#include "nsIStringEnumerator.h"

#include "calITimezone.h"
#include "calITimezoneProvider.h"
#include "calIICSService.h"
#include "nsIConsoleService.h"
#include "nsServiceManagerUtils.h"
#include "nsIClassInfoImpl.h"
#include "nsIProgrammingLanguage.h"
#include "nsCOMPtr.h"

#include "calBaseCID.h"

#define CAL_STRLEN_ARGS(x) x, sizeof(x)-1
#define CAL_ENSURE_MEMORY(p) NS_ENSURE_TRUE(p, NS_ERROR_OUT_OF_MEMORY)

typedef struct _icaltimezone icaltimezone;
typedef struct icaltimetype icaltimetype;

namespace cal {

/**
 * Gets the global console service.
 */
inline nsCOMPtr<nsIConsoleService> getConsoleService() {
    return do_GetService("@mozilla.org/consoleservice;1");
}

/**
 * Gets the global ICS service.
 */
inline nsCOMPtr<calIICSService> getICSService() {
    return do_GetService(CAL_ICSSERVICE_CONTRACTID);
}

/**
 * Gets the global timezone service.
 */
inline nsCOMPtr<calITimezoneService> getTimezoneService() {
    nsresult rv;
    nsCOMPtr<calITimezoneService> tzs;

    tzs = do_GetService(CAL_TIMEZONESERVICE_CONTRACTID, &rv);
    if (NS_FAILED(rv)) {
        NS_RUNTIMEABORT("Could not load timezone service, brace yourself and prepare for crash");
    }
    return tzs;
}

/**
 * Logs an error.
 */
nsresult logError(const nsAString& msg);
inline nsresult logError(char const* msg) {
    return logError(NS_ConvertASCIItoUTF16(msg));
}
inline nsresult logError(nsACString const& msg) {
    return logError(NS_ConvertASCIItoUTF16(msg));
}

/**
 * Logs a warning.
 */
nsresult logWarning(const nsAString& msg);
inline nsresult logWarning(char const* msg) {
    return logWarning(NS_ConvertASCIItoUTF16(msg));
}
inline nsresult logWarning(nsACString const& msg) {
    return logWarning(NS_ConvertASCIItoUTF16(msg));
}

/**
 * Just logs.
 */
nsresult log(PRUnichar const* msg);
inline nsresult log(char const* msg) {
    return log(NS_ConvertASCIItoUTF16(msg).get());
}
inline nsresult log(nsACString const& msg) {
    return log(NS_ConvertASCIItoUTF16(msg).get());
}

// some timezone helpers

/**
 * Gets the "UTC" timezone.
 */
inline nsCOMPtr<calITimezone> UTC() {
    nsresult rv;
    nsCOMPtr<calITimezone> tz;

    rv = getTimezoneService()->GetUTC(getter_AddRefs(tz));
    if (NS_FAILED(rv)) {
        NS_RUNTIMEABORT("Could not load UTC timezone, brace yourself and prepare for crash");
    }

    return tz;
}

/**
 * Gets the "floating" timezone
 */
inline nsCOMPtr<calITimezone> floating() {
    nsresult rv;
    nsCOMPtr<calITimezone> tz;

    rv = getTimezoneService()->GetFloating(getter_AddRefs(tz));
    if (NS_FAILED(rv)) {
        NS_RUNTIMEABORT("Could not load floating timezone, brace yourself and prepare for crash");
    }

    return tz;
}

/**
 * Returns the libical VTIMEZONE component, null if floating.
 * 
 * @attention
 * Every timezone provider needs to use calICSService for
 * creating its timezone components since we need to stick to the
 * same libical.
 */    
icaltimezone * getIcalTimezone(calITimezone * tz);

/**
 * Detects the timezone icalt refers to, either using the
 * passed timezone provider or the global timezone service.
 *
 * @param icalt      an icaltime
 * @param tzProvider timezone provider or null which
 *                   defaults to the timezone service
 */
nsCOMPtr<calITimezone> detectTimezone(icaltimetype const& icalt,
                                      calITimezoneProvider * tzProvider);

/**
 * Logs a missing timezone into the js console.
 */
void logMissingTimezone(char const* tzid);

/**
 * Common base class for XPCOM object implementations:
 * - disallows public deletion (virtual protected dtor)
 * - disallows copy semantics (no assignment, no copy ctor)
 */
class XpcomBase {
protected:
    XpcomBase() {}
    virtual ~XpcomBase();
private:
    XpcomBase(XpcomBase const&); // left unimplemented
    XpcomBase const& operator=(XpcomBase const&); // left unimplemented
};

} // namespace cal

#endif // !defined(INCLUDED_CAL_UTILS_H)
