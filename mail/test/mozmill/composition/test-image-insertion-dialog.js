/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests the image insertion dialog functionality.
 */

var Ci = Components.interfaces;
var Cc = Components.classes;
var Cu = Components.utils;

var elib = {};
Cu.import('resource://mozmill/modules/elementslib.js', elib);

var MODULE_NAME = 'test-dialogs';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'compose-helpers',
                       'window-helpers', 'keyboard-helpers'];

var fdh, ch, wh, kh;

function setupModule(module) {
  fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  ch = collector.getModule("compose-helpers");
  ch.installInto(module);
  wh = collector.getModule('window-helpers');
  wh.installInto(module);
  kh = collector.getModule('keyboard-helpers');
  kh.installInto(module);
}

function test_image_insertion_dialog_persist() {
  let cwc = open_compose_new_mail();

  // First focus on the editor element
  cwc.e("content-frame").focus();

  // Now open the image window
  wh.plan_for_modal_dialog("imageDlg", function insert_image(mwc) {
    // Insert the url of the image.
    let srcloc = mwc.window.document.getElementById("srcInput");
    srcloc.focus();

    input_value(mwc, "whateverItDoesntMatterAnyway.png");
    mwc.sleep(0);

    // Don't add alternate text
    mwc.click(mwc.eid("noAltTextRadio"));

    mwc.window.document.documentElement.acceptDialog();
  });
  cwc.click(cwc.eid("insertImage"));
  wh.wait_for_modal_dialog();
  wait_for_window_close();

  // Check that the radio option persists
  wh.plan_for_modal_dialog("imageDlg", function insert_image(mwc) {
    assert_true(mwc.window.document.getElementById("noAltTextRadio").selected,
      "We should persist the previously selected value");
    // We change to "use alt text"
    mwc.click(mwc.eid("altTextRadio"));
    mwc.window.document.documentElement.cancelDialog();
  });
  cwc.click(cwc.eid("insertImage"));
  wh.wait_for_modal_dialog();
  wait_for_window_close();

  // Check that the radio option still persists (be really sure)
  wh.plan_for_modal_dialog("imageDlg", function insert_image(mwc) {
    assert_true(mwc.window.document.getElementById("altTextRadio").selected,
      "We should persist the previously selected value");
    // Accept the dialog
    mwc.window.document.documentElement.cancelDialog();
  });
  cwc.click(cwc.eid("insertImage"));
  wh.wait_for_modal_dialog();
  wait_for_window_close();

  // Get the inserted image, double-click it, make sure we switch to "no alt
  // text", despite the persisted value being "use alt text"
  let img = cwc.e("content-frame").contentDocument.querySelector("img");
  wh.plan_for_modal_dialog("imageDlg", function insert_image(mwc) {
    assert_true(mwc.window.document.getElementById("noAltTextRadio").selected,
      "We shouldn't use the persisted value because the insert image has no alt text");
    mwc.window.document.documentElement.cancelDialog();
  });
  cwc.doubleClick(new elib.Elem(img));
  wh.wait_for_modal_dialog();
  wait_for_window_close();

  // Now use some alt text for the edit image dialog
  wh.plan_for_modal_dialog("imageDlg", function insert_image(mwc) {
    assert_true(mwc.window.document.getElementById("noAltTextRadio").selected,
      "That value should persist still...");
    mwc.click(mwc.eid("altTextRadio"));

    let srcloc = mwc.window.document.getElementById("altTextInput");
    srcloc.focus();
    input_value(mwc, "some alt text");
    mwc.sleep(0);
    // Accept the dialog
    mwc.window.document.documentElement.acceptDialog();
  });
  cwc.doubleClick(new elib.Elem(img));
  wh.wait_for_modal_dialog();
  wait_for_window_close();

  // Make sure next time we edit it, we still have "use alt text" selected.
  let img = cwc.e("content-frame").contentDocument.querySelector("img");
  wh.plan_for_modal_dialog("imageDlg", function insert_image(mwc) {
    assert_true(mwc.window.document.getElementById("altTextRadio").selected,
      "We edited the image to make it have alt text, we should keep it selected");
    // Accept the dialog
    mwc.window.document.documentElement.cancelDialog();
  });
  cwc.doubleClick(new elib.Elem(img));
  wh.wait_for_modal_dialog();
  wait_for_window_close();

  close_compose_window(cwc);
}
