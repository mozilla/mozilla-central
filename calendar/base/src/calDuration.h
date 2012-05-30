/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef CALDURATION_H_
#define CALDURATION_H_

#include "calIDuration.h"

extern "C" {
    #include "ical.h"
}

class calDuration : public calIDuration
{
public:
    calDuration ();
    calDuration (const calDuration& cdt);
    calDuration (const struct icaldurationtype * const aDurationPtr);

    // nsISupports interface
    NS_DECL_ISUPPORTS

    // calIDateTime interface
    NS_DECL_CALIDURATION

protected:
    bool mImmutable;

    struct icaldurationtype mDuration;

    void FromIcalDuration(const struct icaldurationtype * const icald);
};

#endif /* CALDURATION_H_ */

