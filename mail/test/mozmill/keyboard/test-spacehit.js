/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests that the space bar only advances to the next unread message
 * when mail.advance_on_spacebar is true (default).
 */

var MODULE_NAME = 'test-spacehit';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers'];

// Get original preference value
Cu.import("resource://gre/modules/Services.jsm");
var prefName = "mail.advance_on_spacebar";
var prefValue = Services.prefs.getBoolPref(prefName);

function setupModule(module) {
  collector.getModule('folder-display-helpers').installInto(module);
  // Create four unread messages in a sample folder
  let folder = create_folder("Sample");
  make_new_sets_in_folder(folder, [{count: 4}]);
  be_in_folder(folder);
}

function teardownModule(module) {
  // Restore original preference value
  Services.prefs.setBoolPref(prefName, prefValue);
}

/**
 * The second of four simple messages is selected and [Shift-]Space is
 * pressed to determine if focus changes to a new message.
 *
 * @param aAdvance whether to advance
 * @param aShift whether to press Shift key
 */
function subtest_advance_on_spacebar(aAdvance, aShift) {
  // Set preference
  Services.prefs.setBoolPref(prefName, aAdvance);
  // Select the second message
  let oldmessage = select_click_row(1);
  wait_for_message_display_completion(mc);
  // Press [Shift-]Space
  mc.keypress(null, " ", {shiftKey: aShift});
  // Check that message focus changes iff aAdvance is true
  let newmessage = mc.folderDisplay.selectedMessage;
  aAdvance ? assert_not_equals(oldmessage, newmessage) : assert_equals(oldmessage, newmessage);
}

/**
 * Test that focus remains on current message when preference is false
 * and spacebar is pressed.
 */
function test_noadvance_on_space() {
  subtest_advance_on_spacebar(false, false);
}

/**
 * Test that focus remains on current message when preference is false
 * and shift-spacebar is pressed.
 */
function test_noadvance_on_shiftspace() {
  subtest_advance_on_spacebar(false, true);
}

/**
 * Test that focus advances to next message when preference is true
 * and spacebar is pressed.
 */
function test_advance_on_space() {
  subtest_advance_on_spacebar(true, false);
}

/**
 * Test that focus advances to previous message when preference is true
 * and shift-spacebar is pressed.
 */
function test_advance_on_shiftspace() {
  subtest_advance_on_spacebar(true, true);
}
