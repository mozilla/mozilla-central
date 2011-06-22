/* ***** BEGIN LICENSE BLOCK *****
 *   Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * The Original Code is Thunderbird Mail Client.
 *
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jim Porter <squibblyflabbetydoo@gmail.com>
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
    clobberHeaders: {from: "Carter Burke <cburke@wyutani.com>"},
  }));
  add_message_to_folder(folder, create_message({
    clobberHeaders: {from: '"Ellen Ripley" <eripley@wyutani.com>'},
  }));
  add_message_to_folder(folder, create_message({
    clobberHeaders: {from: "'Dwayne Hicks' <dhicks@uscmc.mil>"},
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
