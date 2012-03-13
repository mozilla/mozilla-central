/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests the manager for attachment storage services
 */

let Cu = Components.utils;
let Cc = Components.classes;
let Ci = Components.interfaces;

let MODULE_NAME = 'test-attachments-pane';

let RELATIVE_ROOT = '../shared-modules';
let MODULE_REQUIRES = ['folder-display-helpers',
                       'pref-window-helpers',
                       'window-helpers'];

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);

  let pwh = collector.getModule('pref-window-helpers');
  pwh.installInto(module);

  let wh = collector.getModule('window-helpers');
  wh.installInto(module);
};

/**
 * Test that if we come back to the Attachment pane, then
 * we'll automatically be viewing the same tab we were viewing
 * last time.
 */
function test_persist_tabs() {
  open_pref_window("paneApplications", function(w) {
    let tabbox = w.e("attachmentPrefs");

    // We should default to be viewing the "Outgoing" tab, which is the
    // second tab, with index 1.
    assert_equals(1, tabbox.selectedIndex,
                  "The second tab should have been selected");
    // Switch to the first tab
    tabbox.selectedIndex = 0;
    close_window(w);
  });

  open_pref_window("paneApplications", function(w) {
    let tabbox = w.e("attachmentPrefs");

    // We should default to be viewing the first tab
    // now
    assert_equals(0, tabbox.selectedIndex,
                  "The first tab selection should have been "
                  + "persisted");
    // Switch back to the second tab
    tabbox.selectedIndex = 1;
    close_window(w);
  });

  open_pref_window("paneApplications", function(w) {
    let tabbox = w.e("attachmentPrefs");

    // We should default to be viewing the second tab
    assert_equals(1, tabbox.selectedIndex,
                  "The second tab selection should have been "
                  + "persisted");
    close_window(w);
  });

}
