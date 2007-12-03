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
#ifndef MOZILLA_1_8_BRANCH
#include "nsIClassInfoImpl.h"
#endif
#include "calTimezoneService.h"
#include "calUtils.h"
#include "calIErrors.h"
#include "calAttributeHelpers.h"

NS_IMPL_ISUPPORTS1(calTimezone, calITimezone)

CAL_ISUPPORTS_ATTR_GETTER(calTimezone, calIIcalComponent, Component)
CAL_STRINGTYPE_ATTR_GETTER(calTimezone, nsACString, Tzid)
CAL_STRINGTYPE_ATTR_GETTER(calTimezone, nsACString, Latitude)
CAL_STRINGTYPE_ATTR_GETTER(calTimezone, nsACString, Longitude)
CAL_VALUETYPE_ATTR_GETTER(calTimezone, PRBool, IsFloating)
CAL_VALUETYPE_ATTR_GETTER(calTimezone, PRBool, IsUTC)

NS_IMETHODIMP
calTimezone::GetProvider(calITimezoneProvider ** _retval) {
    NS_ENSURE_ARG_POINTER(_retval);
    NS_ADDREF(*_retval = cal::getTimezoneService());
    return NS_OK;
}

NS_IMETHODIMP
calTimezone::ToString(nsACString & aResult) {
    // xxx todo remove: for some time, we want to know if a calITimezone object
    //                  is treated as a string...
    NS_WARNING("calTimezone::ToString called!");

    if (mIsUTC || mIsFloating) {
        aResult = mTzid;
        return NS_OK;
    }
    return mComponent->ToString(aResult);
}

calTimezoneService::calTimezoneService()
    : mUTC(new calTimezone(nsnull, NS_LITERAL_CSTRING("UTC"), PR_TRUE)),
      mFloating(new calTimezone(nsnull, NS_LITERAL_CSTRING("floating"), PR_FALSE, PR_TRUE))
{
    mTzHash.Init();
    mTzHash.Put(NS_LITERAL_CSTRING("UTC"), mUTC);
    mTzHash.Put(NS_LITERAL_CSTRING("utc"), mUTC);
    mTzHash.Put(NS_LITERAL_CSTRING("floating"), mFloating);
}

NS_IMPL_ISUPPORTS2_CI(calTimezoneService, calITimezoneProvider, calITimezoneService)

CAL_ISUPPORTS_ATTR_GETTER(calTimezoneService, calITimezone, UTC)
CAL_ISUPPORTS_ATTR_GETTER(calTimezoneService, calITimezone, Floating)

// include tzdata, to get ical_timezone_data_struct
#include "tzdata.c"

static nsDependentCString sTzIdPrefix(kTzIdPrefix);

NS_IMETHODIMP
calTimezoneService::GetTimezone(nsACString const& tzid_, calITimezone ** _retval)
{
    NS_ENSURE_ARG_POINTER(_retval);
    *_retval = nsnull;

    if (!mTzHash.Get(tzid_, _retval) || !*_retval) {
        nsCAutoString tzid;
        if (NS_SUCCEEDED(LatestTzId(tzid_, tzid)) && StringBeginsWith(tzid, sTzIdPrefix)) {
            // not found, look up in static tab:
            for (PRUint32 i = 0; ical_timezone_data[i].tzid; ++i) {
                if (tzid.Equals(ical_timezone_data[i].tzid)) {
                    ical_timezone_data_struct const& tzdata = ical_timezone_data[i];
                    nsCOMPtr<calIIcalComponent> icalComp, vtimezone;
                    if (NS_FAILED(cal::getICSService()->ParseICS(nsDependentCString(tzdata.icstimezone),
                                                                 nsnull,
                                                                 getter_AddRefs(icalComp))) ||
                        NS_FAILED(icalComp->GetFirstSubcomponent(NS_LITERAL_CSTRING("VTIMEZONE"),
                                                                 getter_AddRefs(vtimezone))) ||
                        !vtimezone) {
                        NS_WARNING(ical_timezone_data[i].tzid);
                        break;
                    }
                    nsCOMPtr<calITimezone> const tz(new calTimezone(vtimezone, tzid, PR_FALSE, PR_FALSE,
                                                                    nsDependentCString(tzdata.latitude),
                                                                    nsDependentCString(tzdata.longitude)));
                    if (!mTzHash.Put(tzid, tz)) {
                        return NS_ERROR_OUT_OF_MEMORY;
                    }
                    if (tzid_ != tzid) { // tzid has been updated by LatestTzId
                        if (!mTzHash.Put(tzid_, tz)) {
                            return NS_ERROR_OUT_OF_MEMORY;
                        }
                    }
                    NS_ADDREF(*_retval = tz);
                    break;
                }
            }
        }
    }
    NS_ASSERTION(*_retval, PromiseFlatCString(tzid_).get());
    return NS_OK;
}

NS_IMETHODIMP
calTimezoneService::GetTimezoneIds(nsIUTF8StringEnumerator ** aTzids)
{
    NS_ENSURE_ARG_POINTER(aTzids);
    PRUint32 const arlen = sizeof(ical_timezone_data) / sizeof(ical_timezone_data[0]);
    nsAutoPtr<nsCStringArray> pArray(new nsCStringArray(mTzHash.Count() + arlen));
    CAL_ENSURE_MEMORY(pArray);
    pArray->AppendCString(NS_LITERAL_CSTRING("UTC"));
    for (PRUint32 i = 0; ical_timezone_data[i].tzid; ++i) {
        pArray->AppendCString(nsDependentCString(ical_timezone_data[i].tzid));
    }
    pArray->Sort();
    return cal::createUTF8StringEnumerator(pArray, aTzids);
}

NS_IMETHODIMP
calTimezoneService::GetTzidPrefix(nsACString & _retval)
{
    _retval = sTzIdPrefix;
    return NS_OK;
}

/**
 * LatestTzId
 * Gets updated timezone ID (tzId) for a given tzId.
 * - If this isn't a mozilla.org tzId:
 *      return nothing
 * - If the tzId name was changed or the tzId was deleted:
 *      return updated tzId
 * - If the tzId's dtstamp is different from our current dtstamp:
 *      return updated tzId
 * - Otherwise, don't change the tzId.
 */
nsresult calTimezoneService::LatestTzId(const nsACString& tzid, nsACString& _retval) {
    // Ensure _retval is both initialized and empty.
    _retval.Truncate();

    // If it doesn't start with "/mozilla.org/" then it isn't ours.
    if (!StringBeginsWith(tzid, NS_LITERAL_CSTRING("/mozilla.org/"))) {
        return NS_ERROR_INVALID_ARG;
    }

    // We know that our tzids look like "/mozilla.org/<dtstamp>/continent/..."
    // The ending of the mozilla prefix is the index of that slash before the
    // continent. Therefore, we start looking for the prefix-ending slash
    // after position 13.
    PRInt32 prefixEnd = tzid.FindChar('/', 13);
    PRInt32 continentEnd = tzid.FindChar('/', prefixEnd + 1);

    // Go through our list of deletions and changes in Olsen, and update
    // these to entirely new zones.
    nsCAutoString continent(Substring(tzid, prefixEnd + 1,
                                      continentEnd - (prefixEnd + 1)));

    // XXX We want to make this table-driven at some point in the future.
// xxx todo => tz db generation code!
    
    if (continent.EqualsLiteral("Africa")) {
        if (tzid.EqualsLiteral("/mozilla.org/20050126_1/Africa/Asmera")) {
            _retval.AssignLiteral("/mozilla.org/20070129_1/Africa/Asmara");
        } else if (tzid.EqualsLiteral("/mozilla.org/20050126_1/Africa/Timbuktu")) {
            _retval.AssignLiteral("/mozilla.org/20070129_1/Africa/Bamako");
        }
    } else if (continent.EqualsLiteral("Atlantic")) {
        if (tzid.EqualsLiteral("/mozilla.org/20050126_1/Atlantic/Faeroe")) {
            _retval.AssignLiteral("/mozilla.org/20070129_1/Atlantic/Faroe");
        }
    } else if (continent.EqualsLiteral("America")) {
        if (tzid.EqualsLiteral("/mozilla.org/20050126_1/America/Argentina/ComodRivadavia")) {
            _retval.AssignLiteral("/mozilla.org/20070129_1/America/Argentina/Catamarca");
        } else if (tzid.EqualsLiteral("/mozilla.org/20050126_1/America/Louisville")) {
            _retval.AssignLiteral("/mozilla.org/20070129_1/America/Kentucky/Louisville");
        }
    } else if (continent.EqualsLiteral("Europe")) {
        if (tzid.EqualsLiteral("/mozilla.org/20050126_1/Europe/Belfast")) {
            _retval.AssignLiteral("/mozilla.org/20070129_1/Europe/London");
        }
    } else if (continent.EqualsLiteral("Pacific")) {
        if (tzid.EqualsLiteral("/mozilla.org/20050126_1/Pacific/Yap")) {
            _retval.AssignLiteral("/mozilla.org/20070129_1/Pacific/Truk");
        }
    }

    if (_retval.IsEmpty()) {
        if (sTzIdPrefix != Substring(tzid, 0, prefixEnd + 1)) {
            // TODO: This assumes that new zones will always be later. If we are
            // ever going to support mixing our TZID headers, then this needs to
            // be a date comparison.
            _retval = sTzIdPrefix;
            _retval += Substring(tzid, prefixEnd + 1, tzid.Length() - (prefixEnd + 1));
        } else {
            _retval = tzid;
        }
    }
    return NS_OK;
}
