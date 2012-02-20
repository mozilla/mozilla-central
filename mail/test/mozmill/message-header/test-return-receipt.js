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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Magnus Melin <mkmelin+mozilla@iki.fi>
 * Portions created by the Initial Developer are Copyright (C) 2011
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

/*
 * Test return receipt (MDN) stuff.
 */

// make SOLO_TEST=message-header/test-return-receipt.js mozmill-one

const MODULE_NAME = "test-return-receipt";

const RELATIVE_ROOT = "../shared-modules";
const MODULE_REQUIRES = ["folder-display-helpers", "window-helpers"];

var folder;

function setupModule(module) {
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);
  let wh = collector.getModule("window-helpers");
  wh.installInto(module);

  folder = create_folder("ReturnReceiptTest");

  // Create a message that requests a return receipt.
  let msg0 = create_message(
    {from: ["Ake", "ake@example.com"],
      clobberHeaders: { "Disposition-Notification-To": "ake@example.com" }
    });
  add_message_to_folder(folder, msg0);

  // ... and one that doesn't request a return receipt.
  let msg1 = create_message();
  add_message_to_folder(folder, msg1);

  // Create a message that requests a return receipt to a different address.
  let msg2 = create_message(
    {from: ["Mimi", "me@example.org"],
      clobberHeaders: { "Disposition-Notification-To": "other@example.com" }
    });
  add_message_to_folder(folder, msg2);

  // Create a message that requests a return receipt to different addresses.
  let msg3 = create_message(
    {from: ["Bobby", "bob@example.org"],
      clobberHeaders: { "Disposition-Notification-To": "ex1@example.com, ex2@example.com" }
    });
  add_message_to_folder(folder, msg3);

  // Create a message that requests a return receipt using non-standard header.
  let msg4 = create_message(
    {from: ["Ake", "ake@example.com"],
     clobberHeaders: { "Return-Receipt-To": "ake@example.com" }
    });
  add_message_to_folder(folder, msg4);

  // Create a message that requests a return receipt to a different address
  // using non-standard header.
  let msg5 = create_message(
    {from: ["Mimi", "me@example.org"],
     clobberHeaders: { "Return-Receipt-To": "other@example.com" }
    });
  add_message_to_folder(folder, msg5);

  // Create a message that requests a return receipt to different addresses
  // using non-standard header.
  let msg6 = create_message(
   {from: ["Bobby", "bob@example.org"],
     clobberHeaders: { "Return-Receipt-To": "ex1@example.com, ex2@example.com" }
   });
  add_message_to_folder(folder, msg6);
}

/** Utility to select a message. */
function gotoMsg(row) {
  be_in_folder(folder);
  let curMessage = select_click_row(row);
  assert_selected_and_displayed(mc, curMessage);
}

/**
 * Utility to make sure the MDN bar is shown / not shown.
 */
function assert_mdn_shown(shouldShow) {
  let msgNotBar = mc.e("msgNotificationBar");
  if (shouldShow) {
    if (msgNotBar.collapsed)
      throw new Error("msgNotificationBar should show");
    if (msgNotBar.selectedIndex != 4) // it's not the mdnBar showing
      throw new Error("msgNotificationBar should show the mdnBar; " +
                      "msgNotBar.selectedIndex=" + msgNotBar.selectedIndex);
  }
  else {
    if (!msgNotBar.collapsed)
      throw new Error("mdnBar shouldn't show");
  }
}

/**
 * Utility function to make sure the notification contains a certain text.
 */
function assert_mdn_text_contains(text, shouldContain) {
  let mdnBar = mc.e("mdnBar");
  let notificationText = mdnBar.textContent;
  if (shouldContain && notificationText.indexOf(text) == -1)
    throw new Error("mdnBar should contain text=" + text +
                    "; notificationText=" + notificationText);
  if (!shouldContain && notificationText.indexOf(text) != -1)
    throw new Error("mdnBar shouldn't contain text=" + text +
                    "; notificationText=" + notificationText);
}

/**
 * Test that return receipts are not shown when Disposition-Notification-To
 * and Return-Receipt-To isn't set.
 */
function test_no_mdn_for_normal_msgs() {
  gotoMsg(1); // This message doesn't request a return receipt.
  assert_mdn_shown(false);
}

/**
 * Test that return receipts are shown when Disposition-Notification-To is set.
 */
function test_basic_mdn_shown() {
  gotoMsg(0); // This message requests a return receipt.
  assert_mdn_shown(true);
  assert_mdn_text_contains("ake@example.com", false); // only name should show
}

/**
 * Test that return receipts are shown when Return-Receipt-To is set.
 */
function test_basic_mdn_shown_nonrfc() {
  gotoMsg(4); // This message requests a return receipt.
  assert_mdn_shown(true);
  assert_mdn_text_contains("ake@example.com", false); // only name should show
}

/**
 * Test that return receipts warns when the mdn address is different.
 * The RFC compliant version.
 */
function test_mdn_when_from_and_disposition_to_differs() {
  gotoMsg(2); // Should display a notification with warning.
  assert_mdn_shown(true);
  assert_mdn_text_contains("other@example.com", true); // address should show
}

/**
 * Test that return receipts warns when the mdn address is different.
 * The RFC non-compliant version.
 */
function test_mdn_when_from_and_disposition_to_differs_nonrfc() {
  gotoMsg(5); // Should display a notification with warning.
  assert_mdn_shown(true);
  assert_mdn_text_contains("other@example.com", true); // address should show
}

/**
 * Test that return receipts warns when the mdn address consists of multiple
 * addresses.
 */
function test_mdn_when_disposition_to_multi() {
  gotoMsg(3); 
  // Should display a notification with warning listing all the addresses.
  assert_mdn_shown(true);
  assert_mdn_text_contains("ex1@example.com", true);
  assert_mdn_text_contains("ex2@example.com", true);
}

/**
 * Test that return receipts warns when the mdn address consists of multiple
 * addresses. Non-RFC compliant version.
 */
function test_mdn_when_disposition_to_multi_nonrfc() {
  gotoMsg(6);
  // Should display a notification with warning listing all the addresses.
  assert_mdn_shown(true);
  assert_mdn_text_contains("ex1@example.com", true);
  assert_mdn_text_contains("ex2@example.com", true);
}

