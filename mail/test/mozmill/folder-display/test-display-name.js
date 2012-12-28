/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Test that the quotes around display names in email addresses are correctly
 * stripped in the thread pane.
 */
var MODULE_NAME = "test-display-name";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["folder-display-helpers"];

var folder;

function setupModule(module) {
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);

  folder = create_folder("DisplayNameA");

  add_message_to_folder(folder, create_message({
    clobberHeaders: {from: "Carter Burke <cburke@wyutani.invalid>"},
  }));
  add_message_to_folder(folder, create_message({
    clobberHeaders: {from: '"Ellen Ripley" <eripley@wyutani.invalid>'},
  }));
  add_message_to_folder(folder, create_message({
    clobberHeaders: {from: "'Dwayne Hicks' <dhicks@uscmc.invalid>"},
  }));
}

function check_display_name(index, expectedName) {
  be_in_folder(folder);

  // Select the nth message
  let curMessage = select_click_row(index);
  // Look at the size column's data
  let tree = mc.folderDisplay.tree;
  let fromCol = tree.columns[5];
  let fromStr = tree.view.getCellText(index, fromCol);

  assert_equals(fromStr, expectedName, fromStr);
}

function test_display_name_unquoted() {
  check_display_name(0, "Carter Burke");
}

function test_display_name_double_quoted() {
  check_display_name(1, "Ellen Ripley");
}

function test_display_name_single_quoted() {
  check_display_name(2, "Dwayne Hicks");
}
