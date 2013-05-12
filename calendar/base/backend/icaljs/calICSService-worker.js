/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * ChromeWorker for parseICSAsync method in calICSService.js
 */

const NS_OK = 0;
const NS_ERROR_FAILURE = 2147500037;
const ICS_ERROR_BASE = 2152333568;

importScripts("resource://calendar/modules/ical.js");

onmessage = function onmessage(event) {
    try {
        let comp = ICAL.parse(event.data);
        postMessage({ rc: NS_OK, data: comp });
    } catch (e) {
        postMessage({ rc: NS_ERROR_FAILURE, data: "Exception occurred: " + e});
    }
    close();
}
