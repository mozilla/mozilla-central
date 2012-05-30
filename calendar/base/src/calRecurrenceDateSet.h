/* -*- Mode: C++; tab-width: 20; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef CALRECURRENCEDATESET_H_
#define CALRECURRENCEDATESET_H_

#include "nsCOMPtr.h"
#include "nsCOMArray.h"

#include "calIDateTime.h"
#include "calIRecurrenceDateSet.h"

class calRecurrenceDateSet : public calIRecurrenceDateSet
{
public:
    calRecurrenceDateSet();

    NS_DECL_ISUPPORTS

    NS_DECL_CALIRECURRENCEITEM

    NS_DECL_CALIRECURRENCEDATESET
protected:
    bool mImmutable;
    bool mIsNegative;
    bool mSorted;

    void EnsureSorted();

    nsCOMArray<calIDateTime> mDates;
};

#endif /* CALRECURRENCEDATESET_H_ */
