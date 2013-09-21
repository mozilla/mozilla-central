/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "calDateTime.h"
#include "calBaseCID.h"

#include "nsServiceManagerUtils.h"
#include "nsIClassInfoImpl.h"

#include "calIErrors.h"
#include "calDuration.h"

#include "jsapi.h"
#include "jsfriendapi.h"
#include "jswrapper.h"
#include "prprf.h"

extern "C" {
#include "ical.h"
}

#define CAL_ATTR_SET_PRE NS_ENSURE_FALSE(mImmutable, NS_ERROR_OBJECT_IS_IMMUTABLE)
#define CAL_ATTR_SET_POST Normalize()
#include "calAttributeHelpers.h"

NS_IMPL_CLASSINFO(calDateTime, NULL, 0, CAL_DATETIME_CID)
NS_IMPL_ISUPPORTS1_CI(calDateTime, calIDateTime)

calDateTime::calDateTime()
    : mImmutable(false)
{
    Reset();
}

calDateTime::calDateTime(icaltimetype const* atimeptr, calITimezone *tz)
    : mImmutable(false)
{
    FromIcalTime(atimeptr, tz);
}

NS_IMETHODIMP
calDateTime::GetIsMutable(bool *aResult)
{
    NS_ENSURE_ARG_POINTER(aResult);
    *aResult = !mImmutable;
    return NS_OK;
}

NS_IMETHODIMP
calDateTime::MakeImmutable()
{
    mImmutable = true;
    return NS_OK;
}

NS_IMETHODIMP
calDateTime::Clone(calIDateTime **aResult)
{
    NS_ENSURE_ARG_POINTER(aResult);
    icaltimetype itt;
    ToIcalTime(&itt);
    calDateTime * const cdt = new calDateTime(&itt, mTimezone);
    CAL_ENSURE_MEMORY(cdt);
    NS_ADDREF(*aResult = cdt);
    return NS_OK;
}

NS_IMETHODIMP
calDateTime::ResetTo(int16_t year,
                     int16_t month,
                     int16_t day,
                     int16_t hour,
                     int16_t minute,
                     int16_t second,
                     calITimezone * tz)
{
    NS_ENSURE_FALSE(mImmutable, NS_ERROR_OBJECT_IS_IMMUTABLE);
    NS_ENSURE_ARG_POINTER(tz);
    mYear = year;
    mMonth = month;
    mDay = day;
    mHour = hour;
    mMinute = minute;
    mSecond = second;
    mIsDate = false;
    mTimezone = tz;
    Normalize();
    return NS_OK;
}

NS_IMETHODIMP
calDateTime::Reset()
{
    NS_ENSURE_FALSE(mImmutable, NS_ERROR_OBJECT_IS_IMMUTABLE);
    mYear = 1970;
    mMonth = 0;
    mDay = 1;
    mHour = 0;
    mMinute = 0;
    mSecond = 0;
    mWeekday = 4;
    mYearday = 1;
    mIsDate = false;
    mTimezone = nullptr;
    mNativeTime = 0;
    mIsValid = true;
    return NS_OK;
}

CAL_VALUETYPE_ATTR(calDateTime, int16_t, Year)
CAL_VALUETYPE_ATTR(calDateTime, int16_t, Month)
CAL_VALUETYPE_ATTR(calDateTime, int16_t, Day)
CAL_VALUETYPE_ATTR(calDateTime, int16_t, Hour)
CAL_VALUETYPE_ATTR(calDateTime, int16_t, Minute)
CAL_VALUETYPE_ATTR(calDateTime, int16_t, Second)
CAL_VALUETYPE_ATTR(calDateTime, bool, IsDate)
CAL_VALUETYPE_ATTR_GETTER(calDateTime, bool, IsValid)
CAL_VALUETYPE_ATTR_GETTER(calDateTime, PRTime, NativeTime)
CAL_VALUETYPE_ATTR_GETTER(calDateTime, int16_t, Weekday)
CAL_VALUETYPE_ATTR_GETTER(calDateTime, int16_t, Yearday)


NS_IMETHODIMP
calDateTime::GetTimezone(calITimezone **aResult)
{
    NS_ENSURE_ARG_POINTER(aResult);
    ensureTimezone();

    NS_IF_ADDREF(*aResult = mTimezone);
    return NS_OK;
}

NS_IMETHODIMP
calDateTime::SetTimezone(calITimezone *aValue)
{
    NS_ENSURE_FALSE(mImmutable, NS_ERROR_OBJECT_IS_IMMUTABLE);
    NS_ENSURE_ARG_POINTER(aValue);
    mTimezone = aValue;
    CAL_ATTR_SET_POST;
    return NS_OK;
}

NS_IMETHODIMP
calDateTime::GetTimezoneOffset(int32_t *aResult)
{
    NS_ENSURE_ARG_POINTER(aResult);
    icaltimetype icalt;
    ToIcalTime(&icalt);
    int dst;
    *aResult = icaltimezone_get_utc_offset(const_cast<icaltimezone *>(icalt.zone), &icalt, &dst);
    return NS_OK;
}

NS_IMETHODIMP
calDateTime::SetNativeTime(PRTime aNativeTime)
{
    icaltimetype icalt;
    PRTimeToIcaltime(aNativeTime, false, icaltimezone_get_utc_timezone(), &icalt);
    FromIcalTime(&icalt, cal::UTC());
    return NS_OK;
}

NS_IMETHODIMP
calDateTime::AddDuration(calIDuration *aDuration)
{
    NS_ENSURE_FALSE(mImmutable, NS_ERROR_OBJECT_IS_IMMUTABLE);
    NS_ENSURE_ARG_POINTER(aDuration);
    ensureTimezone();

    icaldurationtype idt;
    aDuration->ToIcalDuration(&idt);

    icaltimetype itt;
    ToIcalTime(&itt);

    icaltimetype const newitt = icaltime_add(itt, idt);
    FromIcalTime(&newitt, mTimezone);

    return NS_OK;
}

NS_IMETHODIMP
calDateTime::SubtractDate(calIDateTime *aDate, calIDuration **aDuration)
{
    NS_ENSURE_ARG_POINTER(aDate);
    NS_ENSURE_ARG_POINTER(aDuration);

    // same as icaltime_subtract(), but minding timezones:
    PRTime t2t;
    aDate->GetNativeTime(&t2t);
    // for a duration, need to convert the difference in microseconds (prtime)
    // to seconds (libical), so divide by one million.
    icaldurationtype const idt = icaldurationtype_from_int(
        static_cast<int>((mNativeTime - t2t) / int64_t(PR_USEC_PER_SEC)));

    calDuration * const dur = new calDuration(&idt);
    CAL_ENSURE_MEMORY(dur);
    NS_ADDREF(*aDuration = dur);
    return NS_OK;
}

NS_IMETHODIMP
calDateTime::ToString(nsACString & aResult)
{
    nsAutoCString tzid;
    char buffer[256];

    ensureTimezone();
    mTimezone->GetTzid(tzid);

    uint32_t const length = PR_snprintf(
        buffer, sizeof(buffer), "%04hd/%02hd/%02hd %02hd:%02hd:%02hd %s isDate=%01hd nativeTime=%lld",
        mYear, mMonth + 1, mDay, mHour, mMinute, mSecond,
        tzid.get(), static_cast<int16_t>(mIsDate), mNativeTime);
    if (length != static_cast<uint32_t>(-1))
        aResult.Assign(buffer, length);
    return NS_OK;
}

NS_IMETHODIMP
calDateTime::GetInTimezone(calITimezone * aTimezone, calIDateTime ** aResult)
{
    NS_ENSURE_ARG_POINTER(aTimezone);
    NS_ENSURE_ARG_POINTER(aResult);

    if (mIsDate) {
        // if it's a date, we really just want to make a copy of this
        // and set the timezone.
        nsresult rv = Clone(aResult);
        if (NS_SUCCEEDED(rv)) {
            rv = (*aResult)->SetTimezone(aTimezone);
        }
        return rv;
    } else {
        icaltimetype icalt;
        ToIcalTime(&icalt);

        icaltimezone * tz = cal::getIcalTimezone(aTimezone);
        if (icalt.zone == tz) {
            return Clone(aResult);
        }

        /* If there's a zone, we need to convert; otherwise, we just
         * assign, since this item is floating */
        if (icalt.zone && tz) {
            icaltimezone_convert_time(&icalt, const_cast<icaltimezone *>(icalt.zone), tz);
        }
        icalt.zone = tz;
        icalt.is_utc = (tz && tz == icaltimezone_get_utc_timezone());

        calDateTime * cdt = new calDateTime(&icalt, aTimezone);
        CAL_ENSURE_MEMORY(cdt);
        NS_ADDREF (*aResult = cdt);
        return NS_OK;
    }
}

NS_IMETHODIMP
calDateTime::GetStartOfWeek(calIDateTime ** aResult)
{
    NS_ENSURE_ARG_POINTER(aResult);
    ensureTimezone();

    icaltimetype icalt;
    ToIcalTime(&icalt);
    int day_of_week = icaltime_day_of_week(icalt);
    if (day_of_week > 1)
        icaltime_adjust(&icalt, - (day_of_week - 1), 0, 0, 0);
    icalt.is_date = 1;

    calDateTime * const cdt = new calDateTime(&icalt, mTimezone);
    CAL_ENSURE_MEMORY(cdt);
    NS_ADDREF(*aResult = cdt);
    return NS_OK;
}

NS_IMETHODIMP
calDateTime::GetEndOfWeek(calIDateTime ** aResult)
{
    NS_ENSURE_ARG_POINTER(aResult);
    ensureTimezone();

    icaltimetype icalt;
    ToIcalTime(&icalt);
    int day_of_week = icaltime_day_of_week(icalt);
    if (day_of_week < 7)
        icaltime_adjust(&icalt, 7 - day_of_week, 0, 0, 0);
    icalt.is_date = 1;

    calDateTime * const cdt = new calDateTime(&icalt, mTimezone);
    CAL_ENSURE_MEMORY(cdt);
    NS_ADDREF(*aResult = cdt);
    return NS_OK;
}

NS_IMETHODIMP
calDateTime::GetStartOfMonth(calIDateTime ** aResult)
{
    NS_ENSURE_ARG_POINTER(aResult);
    ensureTimezone();

    icaltimetype icalt;
    ToIcalTime(&icalt);
    icalt.day = 1;
    icalt.is_date = 1;

    calDateTime * const cdt = new calDateTime(&icalt, mTimezone);
    CAL_ENSURE_MEMORY(cdt);
    NS_ADDREF(*aResult = cdt);
    return NS_OK;
}

NS_IMETHODIMP
calDateTime::GetEndOfMonth(calIDateTime ** aResult)
{
    NS_ENSURE_ARG_POINTER(aResult);
    ensureTimezone();

    icaltimetype icalt;
    ToIcalTime(&icalt);
    icalt.day = icaltime_days_in_month(icalt.month, icalt.year);
    icalt.is_date = 1;

    calDateTime * const cdt = new calDateTime(&icalt, mTimezone);
    CAL_ENSURE_MEMORY(cdt);
    NS_ADDREF(*aResult = cdt);
    return NS_OK;
}

NS_IMETHODIMP
calDateTime::GetStartOfYear(calIDateTime ** aResult)
{
    NS_ENSURE_ARG_POINTER(aResult);
    ensureTimezone();

    icaltimetype icalt;
    ToIcalTime(&icalt);
    icalt.month = 1;
    icalt.day = 1;
    icalt.is_date = 1;

    calDateTime * const cdt = new calDateTime(&icalt, mTimezone);
    CAL_ENSURE_MEMORY(cdt);
    NS_ADDREF(*aResult = cdt);
    return NS_OK;
}

NS_IMETHODIMP
calDateTime::GetEndOfYear(calIDateTime ** aResult)
{
    NS_ENSURE_ARG_POINTER(aResult);
    ensureTimezone();

    icaltimetype icalt;
    ToIcalTime(&icalt);
    icalt.month = 12;
    icalt.day = 31;
    icalt.is_date = 1;

    calDateTime * const cdt = new calDateTime(&icalt, mTimezone);
    CAL_ENSURE_MEMORY(cdt);
    NS_ADDREF(*aResult = cdt);
    return NS_OK;
}

NS_IMETHODIMP
calDateTime::GetIcalString(nsACString& aResult)
{
    icaltimetype t;
    ToIcalTime(&t);

    // note that ics is owned by libical, so we don't need to free
    char const * const ics = icaltime_as_ical_string(t);
    CAL_ENSURE_MEMORY(ics);
    aResult.Assign(ics);
    return NS_OK;
}

NS_IMETHODIMP
calDateTime::SetIcalString(nsACString const& aIcalString)
{
    NS_ENSURE_FALSE(mImmutable, NS_ERROR_OBJECT_IS_IMMUTABLE);
    icaltimetype icalt;
    icalt = icaltime_from_string(PromiseFlatCString(aIcalString).get());
    if (icaltime_is_null_time(icalt)) {
        return static_cast<nsresult>(calIErrors::ICS_ERROR_BASE + icalerrno);
    }
    FromIcalTime(&icalt, nullptr);
    return NS_OK;
}

/**
 ** utility/protected methods
 **/

// internal Normalize():
void calDateTime::Normalize()
{
    icaltimetype icalt;

    ensureTimezone();
    ToIcalTime(&icalt);
    FromIcalTime(&icalt, mTimezone);
}

void
calDateTime::ensureTimezone()
{
    if (mTimezone == nullptr) {
        mTimezone = cal::UTC();
    }
}

NS_IMETHODIMP_(void)
calDateTime::ToIcalTime(struct icaltimetype * icalt)
{
    ensureTimezone();

    icalt->year = mYear;
    icalt->month = mMonth + 1;
    icalt->day = mDay;
    icalt->hour = mHour;
    icalt->minute = mMinute;
    icalt->second = mSecond;

    icalt->is_date = mIsDate ? 1 : 0;
    icalt->is_daylight = 0;

    icaltimezone * tz = cal::getIcalTimezone(mTimezone);
    icalt->zone = tz;
    icalt->is_utc = (tz && tz == icaltimezone_get_utc_timezone());
    icalt->is_daylight = 0;
    // xxx todo: discuss/investigate is_daylight
//     if (tz) {
//         icaltimezone_get_utc_offset(tz, icalt, &icalt->is_daylight);
//     }
}

void calDateTime::FromIcalTime(icaltimetype const* icalt, calITimezone * tz)
{
    icaltimetype t = *icalt;
    mIsValid = (icaltime_is_null_time(t) ||
                icaltime_is_valid_time(t) ? true : false);

    mIsDate = t.is_date ? true : false;
    if (mIsDate) {
        t.hour = 0;
        t.minute = 0;
        t.second = 0;
    }

    if (mIsValid) {
        t = icaltime_normalize(t);
    }

    mYear = static_cast<int16_t>(t.year);
    mMonth = static_cast<int16_t>(t.month - 1);
    mDay = static_cast<int16_t>(t.day);
    mHour = static_cast<int16_t>(t.hour);
    mMinute = static_cast<int16_t>(t.minute);
    mSecond = static_cast<int16_t>(t.second);

    if (tz) {
        mTimezone = tz;
    } else {
        mTimezone = cal::detectTimezone(t, nullptr);
    }
#if defined(DEBUG)
    if (mTimezone) {
        if (t.is_utc) {
            NS_ASSERTION(SameCOMIdentity(mTimezone, cal::UTC()), "UTC mismatch!");
        } else if (!t.zone) {
            nsAutoCString tzid;
            mTimezone->GetTzid(tzid);
            if (tzid.EqualsLiteral("floating")) {
                NS_ASSERTION(SameCOMIdentity(mTimezone, cal::floating()), "floating mismatch!");
            }
        } else {
            nsAutoCString tzid;
            mTimezone->GetTzid(tzid);
            NS_ASSERTION(tzid.Equals(icaltimezone_get_tzid(const_cast<icaltimezone *>(t.zone))),
                         "tzid mismatch!");
        }
    }
#endif

    mWeekday = static_cast<int16_t>(icaltime_day_of_week(t) - 1);
    mYearday = static_cast<int16_t>(icaltime_day_of_year(t));

    // mNativeTime: not moving the existing date to UTC,
    // but merely representing it a UTC-based way.
    t.is_date = 0;
    mNativeTime = IcaltimeToPRTime(&t, icaltimezone_get_utc_timezone());
}

PRTime calDateTime::IcaltimeToPRTime(icaltimetype const* icalt, icaltimezone const* tz)
{
    icaltimetype tt;
    PRExplodedTime et;

    /* If the time is the special null time, return 0. */
    if (icaltime_is_null_time(*icalt)) {
        return 0;
    }

    if (tz) {
        // use libical for timezone conversion, as it can handle all ics
        // timezones. having nspr do it is much harder.
        tt = icaltime_convert_to_zone(*icalt, const_cast<icaltimezone *>(tz));
    } else {
        tt = *icalt;
    }

    /* Empty the destination */
    memset(&et, 0, sizeof(struct PRExplodedTime));

    /* Fill the fields */
    if (icaltime_is_date(tt)) {
        et.tm_sec = et.tm_min = et.tm_hour = 0;
    } else {
        et.tm_sec = tt.second;
        et.tm_min = tt.minute;
        et.tm_hour = tt.hour;
    }
    et.tm_mday = static_cast<int16_t>(tt.day);
    et.tm_month = static_cast<int16_t>(tt.month-1);
    et.tm_year = static_cast<int16_t>(tt.year);

    return PR_ImplodeTime(&et);
}

void calDateTime::PRTimeToIcaltime(PRTime time, bool isdate,
                                   icaltimezone const* tz,
                                   icaltimetype * icalt)
{
    PRExplodedTime et;
    PR_ExplodeTime(time, PR_GMTParameters, &et);

    icalt->year   = et.tm_year;
    icalt->month  = et.tm_month + 1;
    icalt->day    = et.tm_mday;

    if (isdate) {
        icalt->hour    = 0;
        icalt->minute  = 0;
        icalt->second  = 0;
        icalt->is_date = 1;
    } else {
        icalt->hour   = et.tm_hour;
        icalt->minute = et.tm_min;
        icalt->second = et.tm_sec;
        icalt->is_date = 0;
    }

    icalt->zone = tz;
    icalt->is_utc = ((tz && tz == icaltimezone_get_utc_timezone()) ? 1 : 0);
    icalt->is_daylight = 0;
    // xxx todo: discuss/investigate is_daylight
//     if (tz) {
//         icaltimezone_get_utc_offset(tz, icalt, &icalt->is_daylight);
//     }
}

NS_IMETHODIMP
calDateTime::Compare(calIDateTime * aOther, int32_t * aResult)
{
    NS_ENSURE_ARG_POINTER(aOther);
    NS_ENSURE_ARG_POINTER(aResult);

    bool otherIsDate = false;
    aOther->GetIsDate(&otherIsDate);

    icaltimetype a, b;
    ToIcalTime(&a);
    aOther->ToIcalTime(&b);

    // If either this or aOther is floating, both objects are treated
    // as floating for the comparison.
    if (!a.zone || !b.zone) {
        a.zone = NULL;
        a.is_utc = 0;
        b.zone = NULL;
        b.is_utc = 0;
    }

    if (mIsDate || otherIsDate) {
        *aResult = icaltime_compare_date_only_tz(a, b, cal::getIcalTimezone(mTimezone));
    } else {
        *aResult = icaltime_compare(a, b);
    }

    return NS_OK;
}

NS_IMETHODIMP
calDateTime::GetJsDate(JSContext* aCx, JS::Value* aResult)
{
    double msec = double(mNativeTime / 1000);
    ensureTimezone();

    JSObject* obj;
    bool b;
    if (NS_SUCCEEDED(mTimezone->GetIsFloating(&b)) && b) {
        obj = JS_NewDateObject(aCx, mYear, mMonth, mDay, mHour, mMinute, mSecond);
    } else {
        obj = JS_NewDateObjectMsec(aCx, msec);
    }

    *aResult = JS::ObjectOrNullValue(obj);
    return NS_OK;
}

NS_IMETHODIMP
calDateTime::SetJsDate(JSContext* aCx, const JS::Value& aDate)
{
    if (!aDate.isObject()) {
        mIsValid = false;
        return NS_OK;
    }

    JS::Rooted<JSObject*> dobj(aCx, &aDate.toObject());
    dobj = js::CheckedUnwrap(dobj);
    if (!dobj) {
        mIsValid = false;
        return NS_OK;
    }
    JSAutoCompartment ac(aCx, dobj);

    if (!JS_ObjectIsDate(aCx, dobj) || !js_DateIsValid(dobj)) {
        mIsValid = false;
        return NS_OK;
    }

    PRTime utcTime = PRTime(js_DateGetMsecSinceEpoch(dobj)) * 1000;
    mIsValid = NS_SUCCEEDED(SetNativeTime(utcTime));
    return NS_OK;
}
