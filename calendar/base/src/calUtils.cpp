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
#include "nsComponentManagerUtils.h"
#include "nsIScriptError.h"

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

nsresult logError(PRUnichar const* msg) {
    nsresult rc;
    nsCOMPtr<nsIScriptError> const scriptError(do_CreateInstance("@mozilla.org/scripterror;1", &rc));
    NS_ENSURE_SUCCESS(rc, rc);
    rc = scriptError->Init(msg, nsnull, nsnull, 0, 0, nsIScriptError::errorFlag, "calendar");
    return getConsoleService()->LogMessage(scriptError);
}

nsresult logWarning(PRUnichar const* msg) {
    nsresult rc;
    nsCOMPtr<nsIScriptError> const scriptError(do_CreateInstance("@mozilla.org/scripterror;1", &rc));
    NS_ENSURE_SUCCESS(rc, rc);
    rc = scriptError->Init(msg, nsnull, nsnull, 0, 0, nsIScriptError::warningFlag, "calendar");
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
    logError(msg.get());
}

icaltimezone * getIcalTimezone(calITimezone * tz) {
    icaltimezone * icaltz = nsnull;
    if (!tz) {
        NS_ASSERTION(false, "No Timezone passed to getIcalTimezone");
        return nsnull;
    }

    PRBool b;
    tz->GetIsUTC(&b);
    if (b) {
        icaltz = icaltimezone_get_utc_timezone();
    } else {
        nsCOMPtr<calIIcalComponent> tzComp;
        tz->GetIcalComponent(getter_AddRefs(tzComp));
        if (tzComp) {
            icaltz = tzComp->GetIcalTimezone();
        } // else floating or phantom timezone
    }
    return icaltz;
}

XpcomBase::~XpcomBase() {
}

}
