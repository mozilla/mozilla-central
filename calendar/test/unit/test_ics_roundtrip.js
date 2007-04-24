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
 * The Original Code is mozilla calendar tests code.
 *
 * The Initial Developer of the Original Code is
 *   Dan Mosedale <dmose@mozilla.org>
 * Portions created by the Initial Developer are Copyright (C) 2004
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Michiel van Leeuwen <mvl@exedo.nl>
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

function run_test() {
    var eventClass = Cc["@mozilla.org/calendar/event;1"];
    var eventIID = Ci.calIEvent;

    // Create event
    var event = eventClass.createInstance(eventIID);

    var ics_xmas =
        "BEGIN:VCALENDAR\n" +
        "PRODID:-//ORACLE//NONSGML CSDK 9.0.5 - CalDAVServlet 9.0.5//EN\n" +
        "VERSION:2.0\n" +
        "BEGIN:VEVENT\n" +
        "UID:20041119T052239Z-1000472-1-5c0746bb-Oracle\n" +
        "ORGANIZER;X-ORACLE-GUID=E9359406791C763EE0305794071A39A4;CN=Simon Vaillan\n" +
        "court:mailto:simon.vaillancourt@oracle.com\n" +
        "SEQUENCE:0\n" +
        "DTSTAMP:20041124T010028Z\n" +
        "CREATED:20041119T052239Z\n" +
        "X-ORACLE-EVENTINSTANCE-GUID:I1+16778354+1+1+438153759\n" +
        "X-ORACLE-EVENT-GUID:E1+16778354+1+438153759\n" +
        "X-ORACLE-EVENTTYPE:DAY EVENT\n" +
        "TRANSP:TRANSPARENT\n" +
        "SUMMARY:Christmas\n" +
        "STATUS:CONFIRMED\n" +
        "PRIORITY:0\n" +
        "DTSTART;VALUE=DATE:20041125\n" +
        "DTEND;VALUE=DATE:20041125\n" +
        "CLASS:PUBLIC\n" +
        "ATTENDEE;X-ORACLE-GUID=E92F51FB4A48E91CE0305794071A149C;CUTYPE=INDIVIDUAL\n" +
        " ;RSVP=TRUE;CN=James Stevens;PARTSTAT=NEEDS-ACTION:mailto:james.stevens@o\n" +
        " racle.com\n" +
        "ATTENDEE;X-ORACLE-GUID=E9359406791C763EE0305794071A39A4;CUTYPE=INDIVIDUAL\n" +
        " ;RSVP=FALSE;CN=Simon Vaillancourt;PARTSTAT=ACCEPTED:mailto:simon.vaillan\n" +
        " court@oracle.com\n" +
        "ATTENDEE;X-ORACLE-GUID=E9359406791D763EE0305794071A39A4;CUTYPE=INDIVIDUAL\n" +
        " ;RSVP=TRUE;CN=Bernard Desruisseaux;PARTSTAT=NEEDS-ACTION:mailto:bernard.\n" +
        " desruisseaux@oracle.com\n" +
        "ATTENDEE;X-ORACLE-GUID=E9359406791E763EE0305794071A39A4;CUTYPE=INDIVIDUAL\n" +
        " ;RSVP=TRUE;CN=Mario Bonin;PARTSTAT=NEEDS-ACTION:mailto:mario.bonin@oracl\n" +
        " e.com\n" +
        "ATTENDEE;X-ORACLE-GUID=E9359406791F763EE0305794071A39A4;CUTYPE=INDIVIDUAL\n" +
        " ;RSVP=TRUE;CN=Jeremy Chone;PARTSTAT=NEEDS-ACTION:mailto:jeremy.chone@ora\n" +
        " cle.com\n" +
        "ATTENDEE;X-ORACLE-PERSONAL-COMMENT-ISDIRTY=TRUE;X-ORACLE-GUID=E9359406792\n" +
        " 0763EE0305794071A39A4;CUTYPE=INDIVIDUAL;RSVP=TRUE;CN=Mike Shaver;PARTSTA\n" +
        " T=NEEDS-ACTION:mailto:mike.x.shaver@oracle.com\n" +
        "ATTENDEE;X-ORACLE-GUID=E93594067921763EE0305794071A39A4;CUTYPE=INDIVIDUAL\n" +
        " ;RSVP=TRUE;CN=David Ball;PARTSTAT=NEEDS-ACTION:mailto:david.ball@oracle.\n" +
        " com\n" +
        "ATTENDEE;X-ORACLE-GUID=E93594067922763EE0305794071A39A4;CUTYPE=INDIVIDUAL\n" +
        " ;RSVP=TRUE;CN=Marten Haring;PARTSTAT=NEEDS-ACTION:mailto:marten.den.hari\n" +
        " ng@oracle.com\n" +
        "ATTENDEE;X-ORACLE-GUID=E93594067923763EE0305794071A39A4;CUTYPE=INDIVIDUAL\n" +
        " ;RSVP=TRUE;CN=Peter Egyed;PARTSTAT=NEEDS-ACTION:mailto:peter.egyed@oracl\n" +
        " e.com\n" +
        "ATTENDEE;X-ORACLE-GUID=E93594067924763EE0305794071A39A4;CUTYPE=INDIVIDUAL\n" +
        " ;RSVP=TRUE;CN=Francois Perrault;PARTSTAT=NEEDS-ACTION:mailto:francois.pe\n" +
        " rrault@oracle.com\n" +
        "ATTENDEE;X-ORACLE-GUID=E93594067925763EE0305794071A39A4;CUTYPE=INDIVIDUAL\n" +
        " ;RSVP=TRUE;CN=Vladimir Vukicevic;PARTSTAT=NEEDS-ACTION:mailto:vladimir.v\n" +
        " ukicevic@oracle.com\n" +
        "ATTENDEE;X-ORACLE-GUID=E93594067926763EE0305794071A39A4;CUTYPE=INDIVIDUAL\n" +
        " ;RSVP=TRUE;CN=Cyrus Daboo;PARTSTAT=NEEDS-ACTION:mailto:daboo@isamet.com\n" +
        "ATTENDEE;X-ORACLE-GUID=E93594067927763EE0305794071A39A4;CUTYPE=INDIVIDUAL\n" +
        " ;RSVP=TRUE;CN=Lisa Dusseault;PARTSTAT=NEEDS-ACTION:mailto:lisa@osafounda\n" +
        " tion.org\n" +
        "ATTENDEE;X-ORACLE-GUID=E93594067928763EE0305794071A39A4;CUTYPE=INDIVIDUAL\n" +
        " ;RSVP=TRUE;CN=Dan Mosedale;PARTSTAT=NEEDS-ACTION:mailto:dan.mosedale@ora\n" +
        " cle.com\n" +
        "ATTENDEE;X-ORACLE-GUID=E93594067929763EE0305794071A39A4;CUTYPE=INDIVIDUAL\n" +
        " ;RSVP=TRUE;CN=Stuart Parmenter;PARTSTAT=NEEDS-ACTION:mailto:stuart.parme\n" +
        " nter@oracle.com\n" +
        "END:VEVENT\n" +
        "END:VCALENDAR\n\n";

    // Setting ical string (xmas)
    event.icalString = ics_xmas;

    var expectedProps = {
        title: "Christmas",
        id: "20041119T052239Z-1000472-1-5c0746bb-Oracle",
        priority: 0,
        status: "CONFIRMED"
    };
    checkProps(expectedProps, event);
    checkRoundtrip(expectedProps, event);

    // Checking start date
    expectedProps = {
        month: 10,
        day: 25,
        year: 2004,
        isDate: true
    };

    checkProps(expectedProps, event.startDate);
    checkProps(expectedProps, event.endDate);

    // Test for roundtrip of x-properties
    event = eventClass.createInstance(eventIID);
    event.icalString = "BEGIN:VEVENT\n" +
                       "UID:1\n" +
                       "X-MAGIC:mymagicstring\n" +
                       "END:VEVENT";
    expectedProps = {
        "x-magic": "mymagicstring"
    };
    checkRoundtrip(expectedProps, event);
}

function checkProps(expectedProps, obj) {
    for (var key in expectedProps) {
        do_check_eq(obj[key], expectedProps[key]);
    }
}

function checkRoundtrip(expectedProps, obj) {
    for (var key in expectedProps) {
        // Need translation
        var icskey = key;
        switch (key) {
            case "id":
                icskey = "uid";
                break;
            case "title":
                icskey = "summary";
                break;
        }
        do_check_true(obj.icalString.indexOf(icskey.toUpperCase()) > 0);
        do_check_true(obj.icalString.indexOf(expectedProps[key]) > 0);
    }
}
