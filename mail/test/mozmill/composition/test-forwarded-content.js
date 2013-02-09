/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests that forwarded content is ok.
 */

const MODULE_NAME = "test-forwarded-content";

const RELATIVE_ROOT = "../shared-modules";
const MODULE_REQUIRES = ["folder-display-helpers",
                         "window-helpers", "compose-helpers"];

var elib = {};
Components.utils.import("resource://mozmill/modules/elementslib.js", elib);

var folderHelper = null;
var windowindowHelperelper = null;
var composeHelper = null;

var folder = null;

var setupModule = function(module) {
  folderHelper = collector.getModule("folder-display-helpers");
  folderHelper.installInto(module);
  windowHelper = collector.getModule("window-helpers");
  windowHelper.installInto(module);
  composeHelper = collector.getModule("compose-helpers");
  composeHelper.installInto(module);

  folder = folderHelper.create_folder("Forward Content Testing");
  add_message_to_folder(folder, create_message({
    subject: "something like <foo@example>",
    body: {body: "Testing bug 397021!"},
  }));
}

/**
 * Test that the subject is set properly in the forwarded message content
 * when you hit forward.
 */
function test_forwarded_subj() {
  be_in_folder(folder);

  let msg = select_click_row(0);
  assert_selected_and_displayed(mc, msg);

  let fwdWin = open_compose_with_forward();

  let headerTableText  = fwdWin.e("content-frame").contentDocument
                          .querySelector("table").textContent;
  if (!headerTableText.contains(msg.mime2DecodedSubject)) {
    throw new Error("Subject not set correctly in header table: subject=" +
                    msg.mime2DecodedSubject + ", header table text=" +
                    headerTableText);
  }
  close_compose_window(fwdWin);
}

