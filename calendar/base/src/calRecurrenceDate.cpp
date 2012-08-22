/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "calRecurrenceDate.h"

#include "calDateTime.h"
#include "calPeriod.h"
#include "calIItemBase.h"
#include "calIEvent.h"
#include "calIErrors.h"
#include "nsServiceManagerUtils.h"

#include "calICSService.h"

#include "nsIClassInfoImpl.h"

#include "calBaseCID.h"

extern "C" {
    #include "ical.h"
}

NS_IMPL_CLASSINFO(calRecurrenceDate, NULL, 0, CAL_RECURRENCEDATE_CID)
NS_IMPL_ISUPPORTS2_CI(calRecurrenceDate, calIRecurrenceItem, calIRecurrenceDate)

calRecurrenceDate::calRecurrenceDate()
    : mImmutable(false),
      mIsNegative(false)
{
}

NS_IMETHODIMP
calRecurrenceDate::GetIsMutable(bool *aResult)
{
    NS_ENSURE_ARG_POINTER(aResult);

    *aResult = !mImmutable;
    return NS_OK;
}

NS_IMETHODIMP
calRecurrenceDate::MakeImmutable()
{
    if (mImmutable)
        return NS_ERROR_FAILURE; // XXX another error code

    mImmutable = true;
    return NS_OK;
}

NS_IMETHODIMP
calRecurrenceDate::Clone(calIRecurrenceItem **_retval)
{
    calRecurrenceDate *crd = new calRecurrenceDate;
    if (!crd)
        return NS_ERROR_OUT_OF_MEMORY;

    crd->mIsNegative = mIsNegative;
    if (mDate)
        mDate->Clone(getter_AddRefs(crd->mDate));
    else
        crd->mDate = nullptr;

    NS_ADDREF(*_retval = crd);
    return NS_OK;
}

/* attribute boolean isNegative; */
NS_IMETHODIMP
calRecurrenceDate::GetIsNegative(bool *_retval)
{
    NS_ENSURE_ARG_POINTER(_retval);

    *_retval = mIsNegative;
    return NS_OK;
}

NS_IMETHODIMP
calRecurrenceDate::SetIsNegative(bool aIsNegative)
{
    if (mImmutable)
        return NS_ERROR_FAILURE; // XXX CAL_ERROR_ITEM_IS_IMMUTABLE

    mIsNegative = aIsNegative;
    return NS_OK;
}

/* readonly attribute boolean isFinite; */
NS_IMETHODIMP
calRecurrenceDate::GetIsFinite(bool *_retval)
{
    NS_ENSURE_ARG_POINTER(_retval);
    *_retval = true;
    return NS_OK;
}

NS_IMETHODIMP
calRecurrenceDate::GetDate(calIDateTime **aDate)
{
    NS_ENSURE_ARG_POINTER(aDate);

    NS_IF_ADDREF(*aDate = mDate);
    return NS_OK;
}

NS_IMETHODIMP
calRecurrenceDate::SetDate(calIDateTime *aDate)
{
    NS_ENSURE_ARG_POINTER(aDate);

    mDate = aDate;
    return NS_OK;
}

NS_IMETHODIMP
calRecurrenceDate::GetNextOccurrence(calIDateTime *aStartTime,
                                     calIDateTime *aOccurrenceTime,
                                     calIDateTime **_retval)
{
    NS_ENSURE_ARG_POINTER(aStartTime);
    NS_ENSURE_ARG_POINTER(aOccurrenceTime);
    NS_ENSURE_ARG_POINTER(_retval);

    if (mDate) {
        int32_t result;
        if (NS_SUCCEEDED(mDate->Compare(aStartTime, &result)) && result > 0) {
            NS_ADDREF (*_retval = mDate);
            return NS_OK;
        }
    }

    *_retval = nullptr;
    return NS_OK;
}

NS_IMETHODIMP
calRecurrenceDate::GetOccurrences(calIDateTime *aStartTime,
                                  calIDateTime *aRangeStart,
                                  calIDateTime *aRangeEnd,
                                  uint32_t aMaxCount,
                                  uint32_t *aCount, calIDateTime ***aDates)
{
    NS_ENSURE_ARG_POINTER(aStartTime);
    NS_ENSURE_ARG_POINTER(aRangeStart);

    int32_t r1, r2;

    if (mDate) {
        if (NS_SUCCEEDED(mDate->Compare(aRangeStart, &r1)) && r1 >= 0 &&
            (!aRangeEnd || (NS_SUCCEEDED(mDate->Compare(aRangeEnd, &r2)) && r2 < 0)))
        {
            calIDateTime **dates = (calIDateTime **) nsMemory::Alloc(sizeof(calIDateTime*));
            NS_ADDREF (dates[0] = mDate);
            *aDates = dates;
            *aCount = 1;
            return NS_OK;
        }
    }

    *aDates = nullptr;
    *aCount = 0;
    return NS_OK;
}

/**
 ** ical property getting/setting
 **/
NS_IMETHODIMP
calRecurrenceDate::GetIcalProperty(calIIcalProperty **aProp)
{
    NS_ENSURE_ARG_POINTER(aProp);
    if (!mDate)
        return NS_ERROR_FAILURE;

    nsresult rc = cal::getICSService()->CreateIcalProperty(
        (mIsNegative ? nsDependentCString("EXDATE") : nsDependentCString("RDATE")), aProp);
    if (NS_FAILED(rc))
        return rc;

    return (*aProp)->SetValueAsDatetime(mDate);
}

NS_IMETHODIMP
calRecurrenceDate::SetIcalProperty(calIIcalProperty *aProp)
{
    NS_ENSURE_ARG_POINTER(aProp);

    nsCAutoString name;
    nsresult rc = aProp->GetPropertyName(name);
    if (NS_FAILED(rc))
        return rc;
    if (name.EqualsLiteral("RDATE")) {
        mIsNegative = false;
        icalvalue * const value = icalproperty_get_value(aProp->GetIcalProperty());
        if (icalvalue_isa(value) == ICAL_PERIOD_VALUE) {
            icalperiodtype const period = icalvalue_get_period(value);
            // take only period's start date and skip end date, but continue parsing;
            // open bug 489747:
            mDate = new calDateTime(&period.start, nullptr /* detect timezone */);
            return NS_OK;
        }
    } else if (name.EqualsLiteral("EXDATE"))
        mIsNegative = true;
    else
        return NS_ERROR_INVALID_ARG;

    return aProp->GetValueAsDatetime(getter_AddRefs(mDate));
}
