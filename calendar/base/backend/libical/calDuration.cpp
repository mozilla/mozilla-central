/* -*- Mode: C++; tab-width: 20; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "calDuration.h"
#include "calBaseCID.h"

#include "nsComponentManagerUtils.h"
#include "nsServiceManagerUtils.h"

#include "nsIClassInfoImpl.h"

#include "calUtils.h"

#define SECONDS_PER_WEEK   604800
#define SECONDS_PER_DAY     86400
#define SECONDS_PER_HOUR     3600
#define SECONDS_PER_MINUTE     60

NS_IMPL_CLASSINFO(calDuration, NULL, 0, CAL_DURATION_CID)
NS_IMPL_ISUPPORTS1_CI(calDuration, calIDuration)

calDuration::calDuration()
    : mImmutable(false)
{
    Reset();
}

calDuration::calDuration(const calDuration& cdt)
{
    mDuration.is_neg = cdt.mDuration.is_neg;
    mDuration.weeks = cdt.mDuration.weeks;
    mDuration.days = cdt.mDuration.days;
    mDuration.hours = cdt.mDuration.hours;
    mDuration.minutes = cdt.mDuration.minutes;
    mDuration.seconds = cdt.mDuration.seconds;

    // copies are always mutable
    mImmutable = false;
}

calDuration::calDuration(const struct icaldurationtype * const aDurationPtr)
    : mImmutable(false)
{
    FromIcalDuration(aDurationPtr);
}

NS_IMETHODIMP
calDuration::GetIcalDuration(JS::Value*)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
calDuration::SetIcalDuration(JS::Value const&)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
calDuration::GetIsMutable(bool *aResult)
{
    NS_ENSURE_ARG_POINTER(aResult);

    *aResult = !mImmutable;
    return NS_OK;
}

NS_IMETHODIMP
calDuration::MakeImmutable()
{
    mImmutable = true;
    return NS_OK;
}

NS_IMETHODIMP
calDuration::Clone(calIDuration **aResult)
{
    calDuration *cdt = new calDuration(*this);
    if (!cdt)
        return NS_ERROR_OUT_OF_MEMORY;

    NS_ADDREF(*aResult = cdt);
    return NS_OK;
}

NS_IMETHODIMP
calDuration::Reset()
{
    if (mImmutable)
        return NS_ERROR_FAILURE;

    mDuration.is_neg = 0;
    mDuration.weeks = 0;
    mDuration.days = 0;
    mDuration.hours = 0;
    mDuration.minutes = 0;
    mDuration.seconds = 0;

    return NS_OK;
}

NS_IMETHODIMP calDuration::GetIsNegative(bool *_retval)
{
    *_retval = mDuration.is_neg;
    return NS_OK;
}
NS_IMETHODIMP calDuration::SetIsNegative(bool aValue)
{
    if (mImmutable) return NS_ERROR_CALENDAR_IMMUTABLE;
    mDuration.is_neg = aValue;
    return NS_OK;
}

NS_IMETHODIMP calDuration::GetWeeks(int16_t *_retval)
{
    *_retval = (int16_t)mDuration.weeks;
    return NS_OK;
}
NS_IMETHODIMP calDuration::SetWeeks(int16_t aValue)
{
    if (mImmutable) return NS_ERROR_CALENDAR_IMMUTABLE;
    mDuration.weeks = aValue;
    return NS_OK;
}

NS_IMETHODIMP calDuration::GetDays(int16_t *_retval)
{
    *_retval = (int16_t)mDuration.days;
    return NS_OK;
}
NS_IMETHODIMP calDuration::SetDays(int16_t aValue)
{
    if (mImmutable) return NS_ERROR_CALENDAR_IMMUTABLE;
    mDuration.days = aValue;
    return NS_OK;
}

NS_IMETHODIMP calDuration::GetHours(int16_t *_retval)
{
    *_retval = (int16_t)mDuration.hours;
    return NS_OK;
}
NS_IMETHODIMP calDuration::SetHours(int16_t aValue)
{
    if (mImmutable) return NS_ERROR_CALENDAR_IMMUTABLE;
    mDuration.hours = aValue;
    return NS_OK;
}

NS_IMETHODIMP calDuration::GetMinutes(int16_t *_retval)
{
    *_retval = (int16_t)mDuration.minutes;
    return NS_OK;
}
NS_IMETHODIMP calDuration::SetMinutes(int16_t aValue)
{
    if (mImmutable) return NS_ERROR_CALENDAR_IMMUTABLE;
    mDuration.minutes = aValue;
    return NS_OK;
}

NS_IMETHODIMP calDuration::GetSeconds(int16_t *_retval)
{
    *_retval = (int16_t)mDuration.seconds;
    return NS_OK;
}
NS_IMETHODIMP calDuration::SetSeconds(int16_t aValue)
{
    if (mImmutable) return NS_ERROR_CALENDAR_IMMUTABLE;
    mDuration.seconds = aValue;
    return NS_OK;
}


NS_IMETHODIMP calDuration::GetInSeconds(int32_t *_retval)
{
	int32_t retval =
        (((int32_t)((int16_t)mDuration.weeks   * SECONDS_PER_WEEK)) + 
         ((int32_t)((int16_t)mDuration.days    * SECONDS_PER_DAY)) +
         ((int32_t)((int16_t)mDuration.hours   * SECONDS_PER_HOUR)) +
         ((int32_t)((int16_t)mDuration.minutes * SECONDS_PER_MINUTE)) +
         ((int32_t)((int16_t)mDuration.seconds)));
    if (mDuration.is_neg)
		retval=-retval;
    *_retval = retval;

    return NS_OK;
}
NS_IMETHODIMP calDuration::SetInSeconds(int32_t aValue)
{
    if (mImmutable) return NS_ERROR_CALENDAR_IMMUTABLE;

    mDuration.is_neg = (aValue < 0);
    if (mDuration.is_neg)
        aValue = -aValue;

    // set weeks exOR days/hours/...
    mDuration.weeks = ((aValue % SECONDS_PER_WEEK) == 0 ? aValue / SECONDS_PER_WEEK : 0);
    aValue -= (mDuration.weeks * SECONDS_PER_WEEK);

    mDuration.days = aValue / SECONDS_PER_DAY;
    aValue -= (mDuration.days * SECONDS_PER_DAY);

    mDuration.hours = aValue / SECONDS_PER_HOUR;
    aValue -= (mDuration.hours * SECONDS_PER_HOUR);

    mDuration.minutes = aValue / SECONDS_PER_MINUTE;
    aValue -= (mDuration.minutes * SECONDS_PER_MINUTE);

    mDuration.seconds = aValue;

    return NS_OK;
}

NS_IMETHODIMP calDuration::AddDuration(calIDuration *aDuration)
{
    if (mImmutable)
        return NS_ERROR_CALENDAR_IMMUTABLE;

    struct icaldurationtype idt;
    aDuration->ToIcalDuration(&idt);

    // Calculate the new absolute value of the duration
    // For two negative durations, the abs. value will increase,
    // so use + in that case.
    // Of course, also use + when both durations are positive.
    if (idt.is_neg == mDuration.is_neg) {
        mDuration.weeks   += idt.weeks;
        mDuration.days    += idt.days;
        mDuration.hours   += idt.hours;
        mDuration.minutes += idt.minutes;
        mDuration.seconds += idt.seconds;
    } else {
        mDuration.weeks   -= idt.weeks;
        mDuration.days    -= idt.days;
        mDuration.hours   -= idt.hours;
        mDuration.minutes -= idt.minutes;
        mDuration.seconds -= idt.seconds;
    }

    Normalize();

    return NS_OK;
}

NS_IMETHODIMP
calDuration::Normalize()
{
    if (mImmutable)
        return NS_ERROR_CALENDAR_IMMUTABLE;

    int32_t totalInSeconds;
    GetInSeconds(&totalInSeconds);
    SetInSeconds(totalInSeconds);

    return NS_OK;
}

NS_IMETHODIMP
calDuration::ToString(nsACString& aResult)
{
    return GetIcalString(aResult);
}

NS_IMETHODIMP_(void)
calDuration::ToIcalDuration(struct icaldurationtype *icald)
{
    icald->is_neg  = mDuration.is_neg;
    icald->weeks   = mDuration.weeks;
    icald->days    = mDuration.days;
    icald->hours   = mDuration.hours;
    icald->minutes = mDuration.minutes;
    icald->seconds = mDuration.seconds;
    return;
}

void
calDuration::FromIcalDuration(const struct icaldurationtype * const icald)
{
    mDuration.is_neg  = icald->is_neg;
    mDuration.weeks   = icald->weeks;
    mDuration.days    = icald->days;
    mDuration.hours   = icald->hours;
    mDuration.minutes = icald->minutes;
    mDuration.seconds = icald->seconds;
    return;
}

NS_IMETHODIMP
calDuration::GetIcalString(nsACString& aResult)
{
    // note that ics is owned by libical, so we don't need to free
    const char *ics = icaldurationtype_as_ical_string(mDuration);
    
    if (ics) {
        aResult.Assign(ics);
        return NS_OK;
    }

    return NS_ERROR_OUT_OF_MEMORY;
}

NS_IMETHODIMP
calDuration::SetIcalString(const nsACString& aIcalString)
{
    mDuration = icaldurationtype_from_string(PromiseFlatCString(aIcalString).get());
    return NS_OK;
}

NS_IMETHODIMP
calDuration::Compare(calIDuration *aOther, int32_t *aResult)
{
    int32_t thisInSeconds, otherInSeconds;

    // cast to void because these calls can't fail
    (void)GetInSeconds(&thisInSeconds);
    (void)aOther->GetInSeconds(&otherInSeconds);

    if ( thisInSeconds < otherInSeconds ) {
      *aResult = -1;
    } else if ( thisInSeconds > otherInSeconds ) {
      *aResult = 1;
    } else {
      *aResult = 0;
    }

    return NS_OK;
}
