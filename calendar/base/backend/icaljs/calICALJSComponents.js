/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/calUtils.jsm");

const scriptLoadOrder = [
    "calTimezone.js",
    "calDateTime.js",
    "calDuration.js",
    "calICSService.js",
    "calPeriod.js",
    "calRecurrenceRule.js",
];

function getComponents() {
    return [
        calDateTime,
        calDuration,
        calIcalComponent,
        calIcalProperty,
        calICSService,
        calPeriod,
        calRecurrenceRule,
    ];
}

var NSGetFactory = cal.loadingNSGetFactory(scriptLoadOrder, getComponents, this);
