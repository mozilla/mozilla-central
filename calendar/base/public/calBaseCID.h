/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef CALBASECID_H_
#define CALBASECID_H_

/* C++ */
#define CAL_DATETIME_CID \
    { 0x85475b45, 0x110a, 0x443c, { 0xaf, 0x3f, 0xb6, 0x63, 0x98, 0xa5, 0xa7, 0xcd } }
#define CAL_DATETIME_CONTRACTID \
    "@mozilla.org/calendar/datetime;1"

#define CAL_DURATION_CID \
    { 0x63513139, 0x51cb, 0x4f5b, { 0x9a, 0x52, 0x49, 0xac, 0xcc, 0x5c, 0xae, 0x17 } }
#define CAL_DURATION_CONTRACTID \
    "@mozilla.org/calendar/duration;1"

#define CAL_PERIOD_CID \
    { 0x12fdd72b, 0xc5b6, 0x4720, { 0x81, 0x66, 0x2d, 0xec, 0xa1, 0x33, 0x82, 0xf5 } }
#define CAL_PERIOD_CONTRACTID \
    "@mozilla.org/calendar/period;1"

#define CAL_ICSSERVICE_CID \
    { 0xae4ca6c3, 0x981b, 0x4f66, { 0xa0, 0xce, 0x2f, 0x2c, 0x21, 0x8a, 0xd9, 0xe3 } }
#define CAL_ICSSERVICE_CONTRACTID \
    "@mozilla.org/calendar/ics-service;1"

#define CAL_ICALPROPERTY_CID \
    { 0x17349a10, 0x5d80, 0x47fa, { 0x9b, 0xea, 0xf2, 0x29, 0x57, 0x35, 0x76, 0x75 } }
#define CAL_ICALCOMPONENT_CID \
    { 0xc4637c40, 0x3c4c, 0x4ecd, { 0xb8, 0x02, 0x8b, 0x5b, 0x46, 0xbd, 0xf5, 0xa4 } }

#define CAL_TIMEZONESERVICE_CID \
    { 0x1a23ace4, 0xa0dd, 0x43b4, { 0x96, 0xa8, 0xb3, 0xcd, 0x41, 0x9a, 0x14, 0xa5 } }
#define CAL_TIMEZONESERVICE_CONTRACTID \
    "@mozilla.org/calendar/timezone-service;1"

#define CAL_RECURRENCERULE_CID \
    { 0xd9560bf9, 0x3065, 0x404a, { 0x90, 0x4c, 0xc8, 0x82, 0xfc, 0x9c, 0x9b, 0x74 } }
#define CAL_RECURRENCERULE_CONTRACTID \
    "@mozilla.org/calendar/recurrence-rule;1"

/* JS -- Update these from calItemModule.js */
#define CAL_EVENT_CID \
    { 0x974339d5, 0xab86, 0x4491, { 0xaa, 0xaf, 0x2b, 0x2c, 0xa1, 0x77, 0xc1, 0x2b } }
#define CAL_EVENT_CONTRACTID \
    "@mozilla.org/calendar/event;1"

#define CAL_TODO_CID \
    { 0x7af51168, 0x6abe, 0x4a31, { 0x98, 0x4d, 0x6f, 0x8a, 0x39, 0x89, 0x21, 0x2d } }
#define CAL_TODO_CONTRACTID \
    "@mozilla.org/calendar/todo;1"

#define CAL_ATTENDEE_CID \
    { 0x5c8dcaa3, 0x170c, 0x4a73, { 0x81, 0x42, 0xd5, 0x31, 0x15, 0x6f, 0x66, 0x4d } }
#define CAL_ATTENDEE_CONTRACTID \
    "@mozilla.org/calendar/attendee;1"

#define CAL_RECURRENCEINFO_CID \
    { 0x04027036, 0x5884, 0x4a30, { 0xb4, 0xaf, 0xf2, 0xca, 0xd7, 0x9f, 0x6e, 0xdf } }
#define CAL_RECURRENCEINFO_CONTRACTID \
    "@mozilla.org/calendar/recurrence-info;1"

#define NS_ERROR_CALENDAR_WRONG_COMPONENT_TYPE		NS_ERROR_GENERATE_FAILURE(NS_ERROR_MODULE_CALENDAR, 1)
// Until extensible xpconnect error mapping works
// #define NS_ERROR_CALENDAR_IMMUTABLE                 NS_ERROR_GENERATE_FAILURE(NS_ERROR_MODULE_CALENDAR, 2)
#define NS_ERROR_CALENDAR_IMMUTABLE NS_ERROR_OBJECT_IS_IMMUTABLE

#endif /* CALBASECID_H_ */
