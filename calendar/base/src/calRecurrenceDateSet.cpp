/* -*- Mode: C++; tab-width: 20; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "calRecurrenceDateSet.h"

#include "calDateTime.h"
#include "calIItemBase.h"
#include "calIEvent.h"

#include "calICSService.h"

#include "nsIClassInfoImpl.h"

extern "C" {
    #include "ical.h"
}

NS_IMPL_CLASSINFO(calRecurrenceDateSet, NULL, 0, CAL_RECURRENCEDATESET_CID)
NS_IMPL_ISUPPORTS2_CI(calRecurrenceDateSet, calIRecurrenceItem, calIRecurrenceDateSet)

calRecurrenceDateSet::calRecurrenceDateSet()
    : mImmutable(false),
      mIsNegative(false),
      mSorted(false)
{
}

NS_IMETHODIMP
calRecurrenceDateSet::GetIsMutable(bool *aResult)
{
    NS_ENSURE_ARG_POINTER(aResult);

    *aResult = !mImmutable;
    return NS_OK;
}

NS_IMETHODIMP
calRecurrenceDateSet::MakeImmutable()
{
    if (mImmutable)
        return NS_ERROR_FAILURE; // XXX another error code

    mImmutable = true;
    return NS_OK;
}

NS_IMETHODIMP
calRecurrenceDateSet::Clone(calIRecurrenceItem **_retval)
{
    nsresult rv;

    calRecurrenceDateSet *crds = new calRecurrenceDateSet;
    if (!crds)
        return NS_ERROR_OUT_OF_MEMORY;

    crds->mIsNegative = mIsNegative;

    for (int i = 0; i < mDates.Count(); i++) {
        nsCOMPtr<calIDateTime> date;
        rv = mDates[i]->Clone(getter_AddRefs(date));
        NS_ENSURE_SUCCESS(rv, rv);

        crds->mDates.AppendObject(date);
    }

    crds->mSorted = mSorted;

    NS_ADDREF(*_retval = crds);
    return NS_OK;
}

/* attribute boolean isNegative; */
NS_IMETHODIMP
calRecurrenceDateSet::GetIsNegative(bool *_retval)
{
    NS_ENSURE_ARG_POINTER(_retval);

    *_retval = mIsNegative;
    return NS_OK;
}

NS_IMETHODIMP
calRecurrenceDateSet::SetIsNegative(bool aIsNegative)
{
    if (mImmutable)
        return NS_ERROR_FAILURE; // XXX CAL_ERROR_ITEM_IS_IMMUTABLE

    mIsNegative = aIsNegative;
    return NS_OK;
}

/* readonly attribute boolean isFinite; */
NS_IMETHODIMP
calRecurrenceDateSet::GetIsFinite(bool *_retval)
{
    NS_ENSURE_ARG_POINTER(_retval);
    *_retval = true;
    return NS_OK;
}

NS_IMETHODIMP
calRecurrenceDateSet::GetDates(PRUint32 *aCount, calIDateTime ***aDates)
{
    if (mDates.Count() == 0) {
        *aDates = nullptr;
        *aCount = 0;
        return NS_OK;
    }

    EnsureSorted();
        
    calIDateTime **dates = (calIDateTime **) nsMemory::Alloc(sizeof(calIDateTime*) * mDates.Count());
    if (!dates)
        return NS_ERROR_OUT_OF_MEMORY;

    for (int i = 0; i < mDates.Count(); i++) {
        NS_ADDREF(dates[i] = mDates[i]);
    }

    *aDates = dates;
    *aCount = mDates.Count();

    return NS_OK;
}

NS_IMETHODIMP
calRecurrenceDateSet::SetDates(PRUint32 aCount, calIDateTime **aDates)
{
    NS_ENSURE_ARG_POINTER(aDates);

    mDates.Clear();
    for (PRUint32 i = 0; i < aCount; i++) {
        mDates.AppendObject(aDates[i]);
    }

    mSorted = false;

    return NS_OK;
}

NS_IMETHODIMP
calRecurrenceDateSet::AddDate(calIDateTime *aDate)
{
    NS_ENSURE_ARG_POINTER(aDate);

    mDates.AppendObject(aDate);

    mSorted = false;

    return NS_OK;
}

static int
calDateTimeComparator (calIDateTime *aElement1,
                       calIDateTime *aElement2,
                       void *aData)
{
    PRInt32 result;
    aElement1->Compare(aElement2, &result);
    return result;
}

void
calRecurrenceDateSet::EnsureSorted()
{
    if (!mSorted) {
        mDates.Sort(calDateTimeComparator, nullptr);
        mSorted = true;
    }
}

NS_IMETHODIMP
calRecurrenceDateSet::GetNextOccurrence(calIDateTime *aStartTime,
                                        calIDateTime *aOccurrenceTime,
                                        calIDateTime **_retval)
{
    NS_ENSURE_ARG_POINTER(aStartTime);
    NS_ENSURE_ARG_POINTER(aOccurrenceTime);
    NS_ENSURE_ARG_POINTER(_retval);

    EnsureSorted();

    PRInt32 i;
    PRInt32 result;

    // we ignore aStartTime
    for (i = 0; i < mDates.Count(); i++) {
        if (NS_SUCCEEDED(mDates[i]->Compare(aOccurrenceTime, &result)) && result > 0) {
            NS_ADDREF (*_retval = mDates[i]);
            return NS_OK;
        }
    }

    *_retval = nullptr;
    return NS_OK;
}

NS_IMETHODIMP
calRecurrenceDateSet::GetOccurrences(calIDateTime *aStartTime,
                                     calIDateTime *aRangeStart,
                                     calIDateTime *aRangeEnd,
                                     PRUint32 aMaxCount,
                                     PRUint32 *aCount, calIDateTime ***aDates)
{
    NS_ENSURE_ARG_POINTER(aStartTime);
    NS_ENSURE_ARG_POINTER(aRangeStart);

    nsCOMArray<calIDateTime> dates;

    PRInt32 i;
    PRInt32 result;
    nsresult rv;

    for (i = 0; i < mDates.Count(); i++) {
        rv = mDates[i]->Compare(aRangeStart, &result);
        NS_ENSURE_SUCCESS(rv, rv);

        // if the date is less than aRangeStart, continue
        if (result < 0)
            continue;

        // if the date is greater than aRangeEnd, break
        if (aRangeEnd) {
            rv = mDates[i]->Compare(aRangeEnd, &result);
            NS_ENSURE_SUCCESS(rv, rv);
            if (result >= 0)
                break;
        }

        // append the date.
        dates.AppendObject(mDates[i]);

        // if we alrady have as many as we need, break.
        if (aMaxCount && dates.Count() == (int) aMaxCount)
            break;
    }

    PRInt32 count = dates.Count();
    if (count) {
        calIDateTime **dateArray = (calIDateTime **) nsMemory::Alloc(sizeof(calIDateTime*) * count);
        for (int i = 0; i < count; i++) {
            NS_ADDREF(dateArray[i] = dates[i]);
        }
        *aDates = dateArray;
    } else {
        *aDates = nullptr;
    }
    *aCount = count;

    return NS_OK;
}

/**
 ** ical property getting/setting
 **/
NS_IMETHODIMP
calRecurrenceDateSet::GetIcalProperty(calIIcalProperty **aProp)
{
    icalproperty *dateset = nullptr;

    for (int i = 0; i < mDates.Count(); i++) {
        if (mIsNegative)
            dateset = icalproperty_new(ICAL_EXDATE_PROPERTY);
        else
            dateset = icalproperty_new(ICAL_RDATE_PROPERTY);

        struct icaltimetype icalt;
        mDates[i]->ToIcalTime(&icalt);

        icalvalue *v;

        if (icalt.is_date)
            v = icalvalue_new_date(icalt);
        else
            v = icalvalue_new_datetime(icalt);

        icalproperty_set_value(dateset, v);
    }
    
    return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
calRecurrenceDateSet::SetIcalProperty(calIIcalProperty *aProp)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}
