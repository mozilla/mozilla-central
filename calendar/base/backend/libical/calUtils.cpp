/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#include "nsComponentManagerUtils.h"

#include "calUtils.h"
#include "nsIScriptError.h"

extern "C" {
#include "ical.h"
}

namespace cal {

nsresult logError(const nsAString& msg) {
    nsresult rc;
    nsCOMPtr<nsIScriptError> const scriptError(do_CreateInstance("@mozilla.org/scripterror;1", &rc));
    NS_ENSURE_SUCCESS(rc, rc);
    rc = scriptError->Init(msg, EmptyString(), EmptyString(), 0, 0, nsIScriptError::errorFlag, "calendar");
    return getConsoleService()->LogMessage(scriptError);
}

nsresult logWarning(const nsAString& msg) {
    nsresult rc;
    nsCOMPtr<nsIScriptError> const scriptError(do_CreateInstance("@mozilla.org/scripterror;1", &rc));
    NS_ENSURE_SUCCESS(rc, rc);
    rc = scriptError->Init(msg, EmptyString(), EmptyString(), 0, 0, nsIScriptError::warningFlag, "calendar");
    return getConsoleService()->LogMessage(scriptError);
}

nsresult log(PRUnichar const* msg) {
    return getConsoleService()->LogStringMessage(msg);
}

nsCOMPtr<calITimezone> detectTimezone(icaltimetype const& icalt,
                                      calITimezoneProvider * tzProvider)
{
    if (icalt.is_utc) {
        return UTC();
    }
    if (icalt.zone) {
        char const* const tzid = icaltimezone_get_tzid(const_cast<icaltimezone *>(icalt.zone));
        if (tzid) {
            nsCOMPtr<calITimezone> tz;
            if (tzProvider) {
                tzProvider->GetTimezone(nsDependentCString(tzid), getter_AddRefs(tz));
            } else {
                getTimezoneService()->GetTimezone(nsDependentCString(tzid), getter_AddRefs(tz));
            }
            if (tz) {
                return tz;
            }
            NS_ASSERTION(tz, "no timezone found, falling back to floating!");
            logMissingTimezone(tzid);
        }
    }
    return floating();
}

void logMissingTimezone(char const* tzid) {
    // xxx todo: needs l10n
    nsString msg(NS_LITERAL_STRING("Timezone \""));
    msg += NS_ConvertUTF8toUTF16(tzid);
    msg += NS_LITERAL_STRING("\" not found, falling back to floating!");
    logError(msg);
}

icaltimezone * getIcalTimezone(calITimezone * tz) {
    icaltimezone * icaltz = nullptr;
    if (!tz) {
        NS_ASSERTION(false, "No Timezone passed to getIcalTimezone");
        return nullptr;
    }

    bool b;
    tz->GetIsUTC(&b);
    if (b) {
        icaltz = icaltimezone_get_utc_timezone();
    } else {
        nsCOMPtr<calIIcalComponent> tzComp;
        tz->GetIcalComponent(getter_AddRefs(tzComp));
        if (tzComp) {
            icaltz = tzComp->GetLibicalTimezone();
        } // else floating or phantom timezone
    }
    return icaltz;
}

XpcomBase::~XpcomBase() {
}

}
