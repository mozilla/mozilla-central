/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef CALPERIOD_H_
#define CALPERIOD_H_

#include "nsCOMPtr.h"

#include "calIPeriod.h"
#include "calDateTime.h"
#include "calIDuration.h"

extern "C" {
    #include "ical.h"
}

class calPeriod : public calIPeriod
{
public:
    calPeriod ();
    explicit calPeriod (const calPeriod& cpt);
    explicit calPeriod (struct icalperiodtype const* aPeriodPtr);

    // nsISupports interface
    NS_DECL_ISUPPORTS

    // calIPeriod interface
    NS_DECL_CALIPERIOD

protected:
    calPeriod const& operator=(calPeriod const&);

    bool mImmutable;

    //struct icaldurationtype mPeriod;
    nsCOMPtr<calIDateTime> mStart;
    nsCOMPtr<calIDateTime> mEnd;
    
    void FromIcalPeriod(struct icalperiodtype const* icalp);
};

#endif /* CALPERIOD_H_ */

