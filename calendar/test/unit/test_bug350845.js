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
 * Portions created by the Initial Developer are Copyright (C) 2009
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

function run_test() {
    let event = createEventFromIcalString(
        "BEGIN:VEVENT\n" +
        "UID:182d2719-fe2a-44c1-9210-0286b16c0538\n" +
        "X-FOO;X-BAR=BAZ:QUUX\n" +
        "END:VEVENT");

    // Test getters for imported event
    do_check_eq(event.getProperty("X-FOO"), "QUUX");
    do_check_true(event.hasProperty("X-FOO"));
    do_check_eq(event.getPropertyParameter("X-FOO", "X-BAR"), "BAZ");
    do_check_true(event.hasPropertyParameter("X-FOO", "X-BAR"));

    // Test setters
    let (passed = false) {
        try {
            event.setPropertyParameter("X-UNKNOWN", "UNKNOWN", "VALUE");
        } catch (e) {
            passed = true;
        }
        if (!passed) {
            do_throw("Setting parameter on unset property unexpectedly succeeded");
        }
    }

    // More setters
    event.setPropertyParameter("X-FOO", "X-BAR", "FNORD");
    do_check_eq(event.getPropertyParameter("X-FOO", "X-BAR"), "FNORD");
    do_check_neq(event.icalString.match(/^X-FOO;X-BAR=FNORD:QUUX$/m), null);

    // Enumerator
    let (passed = false) {
        try {
            event.getParameterEnumerator("X-UNKNOWN");
        } catch (e) {
            passed = true;
        }
        if (!passed) {
            do_throw("Getting parameter enumerator on unset property unexpectedly succeeded");
        }
    }

    // More enumerator
    let enum = event.getParameterEnumerator("X-FOO");
    do_check_true(enum.hasMoreElements());
    let xbar = enum.getNext().QueryInterface(Components.interfaces.nsIProperty);
    do_check_eq(xbar.name, "X-BAR");
    do_check_eq(xbar.value, "FNORD");
    do_check_false(enum.hasMoreElements());

    // Deletion of parameters when deleting properties
    event.deleteProperty("X-FOO");
    do_check_false(event.hasProperty("X-FOO"));
    event.setProperty("X-FOO", "SNORK");
    do_check_eq(event.getProperty("X-FOO"), "SNORK");
    do_check_eq(event.getPropertyParameter("X-FOO", "X-BAR"), null);
}
