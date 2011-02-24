/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla Calendar code.
 *
 * The Initial Developer of the Original Code is
 *   Philipp Kewisch <mozilla@kewis.ch>
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

Components.utils.import("resource://calendar/modules/calUtils.jsm");

function run_test() {
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
        "ATTACH;VALUE=BINARY;ENCODING=BASE64;FMTTYPE=x-moz/test2:aHR0cDovL2hlbGxvMg\r\n" +
        " ==\r\n";
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

    do_check_eq(attach.icalProperty.icalString, attachString);
    do_check_eq(attach.clone().icalProperty.icalString, attachString);
}
