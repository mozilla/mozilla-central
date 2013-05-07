/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#if !defined(INCLUDED_CAL_TIMEZONE_H)
#define INCLUDED_CAL_TIMEZONE_H

#include "nsCOMPtr.h"
#include "calITimezone.h"
#include "calUtils.h"

class calTimezone : public calITimezone,
                    public cal::XpcomBase
{
public:
    calTimezone(nsCString const& tzid, calIIcalComponent * component)
        : mTzid(tzid),
          mIcalComponent(component) {}

    NS_DECL_ISUPPORTS
    NS_DECL_CALITIMEZONE

protected:
    nsCString const                   mTzid;
    nsCOMPtr<calIIcalComponent> const mIcalComponent;
};

#endif // INCLUDED_CAL_TIMEZONE_H
