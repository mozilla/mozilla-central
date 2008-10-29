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
 * The Original Code is Sun Microsystems code.
 *
 * The Initial Developer of the Original Code is
 * Sun Microsystems, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Daniel Boelzle <daniel.boelzle@sun.com>
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
#include "nsVoidArray.h"
#include "nsIStringEnumerator.h"

#include "calITimezone.h"
#include "calITimezoneProvider.h"
#include "calIICSService.h"
#include "nsIConsoleService.h"
#include "nsServiceManagerUtils.h"
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
    return do_GetService(CAL_TIMEZONESERVICE_CONTRACTID);
}

/**
 * Creates a UTF8 string enumerator.
 *
 * @param takeOverArray      a nsCStringArray that is taken over by the resulting
 *                           string enumerator object (nsAutoPtr passes over ownership)
 * @param ppRet              returned enumerator object
 */
nsresult createUTF8StringEnumerator(nsAutoPtr<nsCStringArray> & takeOverArray,
                                    nsIUTF8StringEnumerator ** ppRet);

/**
 * Logs an error.
 */
nsresult logError(PRUnichar const* msg);
inline nsresult logError(char const* msg) {
    return logError(NS_ConvertASCIItoUTF16(msg).get());
}
inline nsresult logError(nsACString const& msg) {
    return logError(NS_ConvertASCIItoUTF16(msg).get());
}

/**
 * Logs a warning.
 */
nsresult logWarning(PRUnichar const* msg);
inline nsresult logWarning(char const* msg) {
    return logWarning(NS_ConvertASCIItoUTF16(msg).get());
}
inline nsresult logWarning(nsACString const& msg) {
    return logWarning(NS_ConvertASCIItoUTF16(msg).get());
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
    nsCOMPtr<calITimezone> tz;
    getTimezoneService()->GetUTC(getter_AddRefs(tz));
    return tz;
}

/**
 * Gets the "floating" timezone
 */
inline nsCOMPtr<calITimezone> floating() {
    nsCOMPtr<calITimezone> tz;
    getTimezoneService()->GetFloating(getter_AddRefs(tz));
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
