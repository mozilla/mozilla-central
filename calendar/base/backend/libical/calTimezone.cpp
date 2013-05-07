/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#include "calTimezone.h"
#include "calUtils.h"
#include "calAttributeHelpers.h"

NS_IMPL_ISUPPORTS1(calTimezone, calITimezone)

CAL_ISUPPORTS_ATTR_GETTER(calTimezone, calIIcalComponent, IcalComponent)
CAL_STRINGTYPE_ATTR_GETTER(calTimezone, nsACString, Tzid)

NS_IMETHODIMP
calTimezone::GetIsFloating(bool * _retval) {
    NS_ENSURE_ARG_POINTER(_retval);
    *_retval = false;
    return NS_OK;
}

NS_IMETHODIMP
calTimezone::GetIsUTC(bool * _retval) {
    NS_ENSURE_ARG_POINTER(_retval);
    *_retval = false;
    return NS_OK;
}

NS_IMETHODIMP
calTimezone::GetDisplayName(nsAString & _retval) {
    _retval = NS_ConvertUTF8toUTF16(mTzid);
    return NS_OK;
}

NS_IMETHODIMP
calTimezone::GetLatitude(nsACString & _retval) {
    _retval.SetIsVoid(true);
    return NS_OK;
}

NS_IMETHODIMP
calTimezone::GetLongitude(nsACString & _retval) {
    _retval.SetIsVoid(true);
    return NS_OK;
}

NS_IMETHODIMP
calTimezone::GetProvider(calITimezoneProvider ** _retval) {
    NS_ENSURE_ARG_POINTER(_retval);
    *_retval = nullptr;
    return NS_OK;
}

NS_IMETHODIMP
calTimezone::ToString(nsACString & aResult) {
    if (mIcalComponent) {
        return mIcalComponent->ToString(aResult);
    } else {
        return GetTzid(aResult);
    }
}

