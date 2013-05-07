/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
#if !defined(INCLUDED_CAL_RECURRENCERULE_H)
#define INCLUDED_CAL_RECURRENCERULE_H

#include "calIRecurrenceRule.h"
#include "calUtils.h"

extern "C" {
#include "ical.h"
}

class calRecurrenceRule : public calIRecurrenceRule,
                          public cal::XpcomBase
{
public:
    calRecurrenceRule();

    NS_DECL_ISUPPORTS
    NS_DECL_CALIRECURRENCEITEM
    NS_DECL_CALIRECURRENCERULE
protected:
    icalrecurrencetype mIcalRecur;

    bool mImmutable;
    bool mIsNegative;
    bool mIsByCount;
};

#endif // INCLUDED_CAL_RECURRENCERULE_H
