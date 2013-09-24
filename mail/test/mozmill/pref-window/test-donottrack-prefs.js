/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests the do-not-track toggle checkbox
 */

const DNT_PREF_NAME = 'privacy.donottrackheader.enabled';

const MODULE_NAME = 'test-donottrack-prefs';

const RELATIVE_ROOT = '../shared-modules';
const MODULE_REQUIRES = ['folder-display-helpers',
                         'pref-window-helpers'];

function setupModule(module) {
  collector.getModule('folder-display-helpers').installInto(module);
  collector.getModule('pref-window-helpers').installInto(module);
  collector.getModule('window-helpers').installInto(module);
}

/**
 * Test that selecting the checkbox for the do not track feature actually sets
 * the preference.
 */
function test_donottrack_checkbox() {
  open_pref_window("paneSecurity", function(w) {

    // select the "Web Content" panel
    w.e("securityPrefs").selectedIndex = 4;

    // tick the DNT box (and make sure it's ticked.
    w.click(w.eid("privacyDoNotTrackPref"));
    assert_true(w.e("privacyDoNotTrackPref").checked,
                "The DNT checkbox didn't get set");

    // close the window to accept the changes
    w.e("MailPreferences").acceptDialog();
    close_window(w);
  });

  open_pref_window("paneSecurity", function(w) {
    // Inspect the pref.
    assert_true(Services.prefs.getBoolPref(DNT_PREF_NAME),
                "The DNT pref did not get set");

    // Make sure the box stays ticked
    assert_true(w.e("privacyDoNotTrackPref").checked,
                "The DNT checkbox should be checked when the pref is set");

    // clear the DNT checkbox (and make sure it's not ticked);
    w.click(w.eid("privacyDoNotTrackPref"));
    assert_false(w.e("privacyDoNotTrackPref").checked,
                 "The DNT checkbox did not get unset");

    // close the window to accept the changes
    w.e("MailPreferences").acceptDialog();
    close_window(w);
  });

  open_pref_window("paneSecurity", function(w) {
    // make sure all is still reset.
    assert_false(w.e("privacyDoNotTrackPref").checked,
                 "The DNT checkbox should still be unset");
    assert_false(Services.prefs.getBoolPref(DNT_PREF_NAME),
                 "The DNT pref should be cleared.");

    w.e("MailPreferences").acceptDialog();
    close_window(w);
  });
}
