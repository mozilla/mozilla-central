/* -*- Mode: C++; tab-width: 20; indent-tabs-mode: nil; c-basic-off: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef CALRECURRENCEDATE_H_
#define CALRECURRENCEDATE_H_

#include "nsCOMPtr.h"

#include "calIDateTime.h"
#include "calIRecurrenceDate.h"

class calRecurrenceDate : public calIRecurrenceDate
{
public:
    calRecurrenceDate();

    NS_DECL_ISUPPORTS

    NS_DECL_CALIRECURRENCEITEM

    NS_DECL_CALIRECURRENCEDATE
protected:
    virtual ~calRecurrenceDate() {};

    bool mImmutable;
    bool mIsNegative;

    nsCOMPtr<calIDateTime> mDate;
};

#endif /* CALRECURRENCEDATE_H_ */
