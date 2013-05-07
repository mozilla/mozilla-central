/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/calUtils.jsm");

function run_test() {
    test_serialize();
    test_hashes();
    test_uriattach();
    test_binaryattach();
}

function test_hashes() {
    let attach = cal.createAttachment();

    attach.rawData = "hello";
    let hash1 = attach.hashId;

    attach.rawData = "world";
    do_check_neq(hash1, attach.hashId);

    attach.rawData = "hello";
    do_check_eq(hash1, attach.hashId);

    // Setting raw data should give us a BINARY attachment
    do_check_eq(attach.getParameter("VALUE"), "BINARY");

    attach.uri = makeURL("http://hello");

    // Setting an uri should delete the value parameter
    do_check_eq(attach.getParameter("VALUE"), null);
}

function test_uriattach() {
    let attach = cal.createAttachment();

    // Attempt to set a property and check its values
    let e = cal.createEvent();
    e.icalString = "BEGIN:VEVENT\r\n" +
                   "ATTACH;FMTTYPE=x-moz/test:http://hello\r\n" +
                   "END:VEVENT";
    let prop = e.icalComponent.getFirstProperty("ATTACH");
    attach.icalProperty = prop;

    do_check_neq(attach.getParameter("VALUE"), "BINARY");
    do_check_eq(attach.formatType, "x-moz/test");
    do_check_eq(attach.getParameter("FMTTYPE"), "x-moz/test");
    do_check_eq(attach.uri.spec, makeURL("http://hello").spec);
    do_check_eq(attach.rawData, "http://hello");
}

function test_binaryattach() {
    let attach = cal.createAttachment();
    let e = cal.createEvent();

    let attachString =
        "ATTACH;ENCODING=BASE64;FMTTYPE=x-moz/test2;VALUE=BINARY:aHR0cDovL2hlbGxvMg==\r\n";
    let foldedAttachString = ics_foldline(attachString);
    let icalString =
        "BEGIN:VEVENT\r\n" +
        attachString +
        "END:VEVENT";
    e.icalString = icalString;
    let prop = e.icalComponent.getFirstProperty("ATTACH");
    attach.icalProperty = prop;

    do_check_eq(attach.formatType, "x-moz/test2");
    do_check_eq(attach.getParameter("FMTTYPE"), "x-moz/test2");
    do_check_eq(attach.encoding, "BASE64");
    do_check_eq(attach.getParameter("ENCODING"), "BASE64");
    do_check_eq(attach.uri, null);
    do_check_eq(attach.rawData, "aHR0cDovL2hlbGxvMg==");
    do_check_eq(attach.getParameter("VALUE"), "BINARY");

    let propIcalString = attach.icalProperty.icalString;
    do_check_true(!!propIcalString.match(/ENCODING=BASE64/));
    do_check_true(!!propIcalString.match(/FMTTYPE=x-moz\/test2/));
    do_check_true(!!propIcalString.match(/VALUE=BINARY/));
    do_check_true(!!propIcalString.replace("\r\n ", "").match(/:aHR0cDovL2hlbGxvMg==/));

    propIcalString = attach.clone().icalProperty.icalString;

    do_check_true(!!propIcalString.match(/ENCODING=BASE64/));
    do_check_true(!!propIcalString.match(/FMTTYPE=x-moz\/test2/));
    do_check_true(!!propIcalString.match(/VALUE=BINARY/));
    do_check_true(!!propIcalString.replace("\r\n ", "").match(/:aHR0cDovL2hlbGxvMg==/));
}

function test_serialize() {
    let attach = cal.createAttachment();
    attach.formatType = "x-moz/test2";
    attach.uri = Services.io.newURI("data:text/plain,", null, null);
    do_check_eq(attach.icalString, "ATTACH;FMTTYPE=x-moz/test2:data:text/plain,\r\n");

    attach = cal.createAttachment();
    attach.encoding = "BASE64";
    attach.uri = Services.io.newURI("data:text/plain,", null, null);
    do_check_eq(attach.icalString, "ATTACH;ENCODING=BASE64:data:text/plain,\r\n");

    do_check_throws(function() {
        attach.icalString = "X-STICKER:smiley";
    }, Components.results.NS_ERROR_ILLEGAL_VALUE);

    attach = cal.createAttachment();
    attach.uri = Services.io.newURI("data:text/plain,", null, null);
    attach.setParameter("X-PROP", "VAL");
    do_check_eq(attach.icalString, "ATTACH;X-PROP=VAL:data:text/plain,\r\n");
    attach.setParameter("X-PROP", null);
    do_check_eq(attach.icalString, "ATTACH:data:text/plain,\r\n");
}
