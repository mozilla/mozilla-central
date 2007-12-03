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
#include "nsServiceManagerUtils.h"
// #ifndef MOZILLA_1_8_BRANCH
// #include "nsIClassInfoImpl.h"
// #endif
#include "calBaseCID.h"
#include "calUtils.h"

extern "C" {
#include "ical.h"
}

namespace cal {

class UTF8StringEnumerator : public nsIUTF8StringEnumerator,
                             public XpcomBase
{
public:
    NS_DECL_ISUPPORTS
    NS_DECL_NSIUTF8STRINGENUMERATOR

    explicit UTF8StringEnumerator(nsAutoPtr<nsCStringArray> & takeOverArray)
        : mArray(takeOverArray), mPos(0) {}
private:
    nsAutoPtr<nsCStringArray> const mArray;
    PRInt32 mPos;
};

NS_IMPL_ISUPPORTS1(UTF8StringEnumerator, nsIUTF8StringEnumerator)

NS_IMETHODIMP UTF8StringEnumerator::HasMore(PRBool *_retval)
{
    NS_ENSURE_ARG_POINTER(_retval);
    *_retval = (mPos < mArray->Count());
    return NS_OK;
}

NS_IMETHODIMP UTF8StringEnumerator::GetNext(nsACString & _retval)
{
    if (mPos < mArray->Count()) {
        mArray->CStringAt(mPos, _retval);
        ++mPos;
        return NS_OK;
    } else {
        return NS_ERROR_UNEXPECTED;
    }
}

nsresult createUTF8StringEnumerator(nsAutoPtr<nsCStringArray> & takeOverArray,
                                    nsIUTF8StringEnumerator ** ppRet)
{
    NS_ENSURE_ARG_POINTER(takeOverArray.get());
    NS_ENSURE_ARG_POINTER(ppRet);
    *ppRet = new UTF8StringEnumerator(takeOverArray);
    CAL_ENSURE_MEMORY(*ppRet);
    NS_ADDREF(*ppRet);
    return NS_OK;
}

nsCOMPtr<calIICSService> const& getICSService() {
    static nsCOMPtr<calIICSService> sIcsService;
    if (!sIcsService) {
        sIcsService = do_GetService(CAL_ICSSERVICE_CONTRACTID);
        NS_ASSERTION(sIcsService, "Could not init ics service! Will crash now...");
    }
    return sIcsService;
}

nsCOMPtr<calITimezoneService> const& getTimezoneService() {
    static nsCOMPtr<calITimezoneService> sTzService;
    if (!sTzService) {
        sTzService = do_GetService(CAL_TIMEZONESERVICE_CONTRACTID);
        NS_ASSERTION(sTzService, "Could not init timezone service! Will crash now...");
    }
    return sTzService;
}

nsCOMPtr<calITimezone> const& floating() {
    static nsCOMPtr<calITimezone> sFloating;
    if (!sFloating) {
        getTimezoneService()->GetFloating(getter_AddRefs(sFloating));
    }
    return sFloating;
}

nsCOMPtr<calITimezone> const& UTC() {
    static nsCOMPtr<calITimezone> sUTC;
    if (!sUTC) {
        getTimezoneService()->GetUTC(getter_AddRefs(sUTC));
    }
    return sUTC;
}

nsCOMPtr<calITimezone> detectTimezone(icaltimetype const& icalt,
                                      calITimezoneProvider * tzProvider)
{
    if (!tzProvider) {
        tzProvider = getTimezoneService();
    }
    if (icalt.is_utc) {
        return UTC();
    }
    if (icalt.zone) {
        char const* const tzid = icaltimezone_get_tzid(const_cast<icaltimezone *>(icalt.zone));
        if (tzid) {
            nsCOMPtr<calITimezone> tz;
            tzProvider->GetTimezone(nsDependentCString(tzid), getter_AddRefs(tz));
            if (tz) {
                return tz;
            }
            NS_ASSERTION(tz, "no timezone found, falling back to floating!");
        }
    }
    return floating();
}

icaltimezone * getIcalTimezone(calITimezone * tz) {
    icaltimezone * icaltz = nsnull;
    PRBool b;
    tz->GetIsUTC(&b);
    if (b) {
        icaltz = icaltimezone_get_utc_timezone();
    } else {
        nsCOMPtr<calIIcalComponent> tzComp;
        tz->GetComponent(getter_AddRefs(tzComp));
        if (tzComp) {
            icaltz = tzComp->GetIcalTimezone();
        } // else floating
    }
    return icaltz;
}

XpcomBase::~XpcomBase() {
}

}
