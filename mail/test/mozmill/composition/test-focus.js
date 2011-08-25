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
 * Test that cycling through the focus of the 3pane's panes works correctly.
 */
var MODULE_NAME = "test-focus";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["compose-helpers", "folder-display-helpers",
                       "window-helpers"];


function setupModule(module) {
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);
  let ch = collector.getModule("compose-helpers");
  ch.installInto(module);
  let wh = collector.getModule("window-helpers");
  wh.installInto(module);
}

/**
 * Check that it's possible to cycle through the compose window's important
 * elements forward and backward.
 *
 * @param controller the compose window controller
 * @param attachmentsExpanded true if the attachment pane is expanded
 * @param ctrlTab true if we should use Ctrl+Tab to cycle, false if we should
 *                use F6
 */
function check_element_cycling(controller, attachmentsExpanded, ctrlTab) {
  let addressingElement = controller.e("addressingWidget");
  let subjectElement    = controller.e("msgSubject");
  let attachmentElement = controller.e("attachmentBucket");
  let contentElement    = controller.window.content;
  let identityElement   = controller.e("msgIdentity");

  let key = ctrlTab ? "VK_TAB" : "VK_F6";

  // We start on the addressing widget and go from there...

  controller.keypress(null, key, {ctrlKey: ctrlTab});
  assert_equals(subjectElement, controller.window.WhichElementHasFocus());
  if (attachmentsExpanded) {
    controller.keypress(null, key, {ctrlKey: ctrlTab});
    assert_equals(attachmentElement, controller.window.WhichElementHasFocus());
  }
  controller.keypress(null, key, {ctrlKey: ctrlTab});
  assert_equals(contentElement, controller.window.WhichElementHasFocus());
  controller.keypress(null, key, {ctrlKey: ctrlTab});
  assert_equals(identityElement, controller.window.WhichElementHasFocus());
  controller.keypress(null, key, {ctrlKey: ctrlTab});
  mc.sleep(0); // Focusing the addressing element happens in a timeout...
  assert_equals(addressingElement, controller.window.WhichElementHasFocus());

  controller.keypress(null, key, {ctrlKey: ctrlTab, shiftKey: true});
  assert_equals(identityElement, controller.window.WhichElementHasFocus());
  controller.keypress(null, key, {ctrlKey: ctrlTab, shiftKey: true});
  assert_equals(contentElement, controller.window.WhichElementHasFocus());
  if (attachmentsExpanded) {
    controller.keypress(null, key, {ctrlKey: ctrlTab, shiftKey: true});
    assert_equals(attachmentElement, controller.window.WhichElementHasFocus());
  }
  controller.keypress(null, key, {ctrlKey: ctrlTab, shiftKey: true});
  assert_equals(subjectElement, controller.window.WhichElementHasFocus());
  controller.keypress(null, key, {ctrlKey: ctrlTab, shiftKey: true});
  mc.sleep(0); // Focusing the addressing element happens in a timeout...
  assert_equals(addressingElement, controller.window.WhichElementHasFocus());
}

function test_f6_no_attachment() {
  let cwc = open_compose_new_mail();
  check_element_cycling(cwc, false, false);
  close_compose_window(cwc);
}

function test_f6_attachment() {
  let cwc = open_compose_new_mail();
  add_attachment(cwc, "http://www.mozillamessaging.com/");
  check_element_cycling(cwc, true, false);
  close_compose_window(cwc);
}

function test_ctrl_tab_no_attachment() {
  let cwc = open_compose_new_mail();
  check_element_cycling(cwc, false, true);
  close_compose_window(cwc);
}

function test_ctrl_tab_attachment() {
  let cwc = open_compose_new_mail();
  add_attachment(cwc, "http://www.mozillamessaging.com/");
  check_element_cycling(cwc, true, true);
  close_compose_window(cwc);
}
