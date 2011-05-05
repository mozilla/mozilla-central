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
  let msg = create_message({from: ["Ake", "ake@example.com"],
                            clobberHeaders: { "Disposition-Notification-To": "ake@example.com" }
                           });
  add_message_to_folder(folder, msg);

  // ... and one that doesn't request a return receipt.
  let msg2 = create_message();
  add_message_to_folder(folder, msg2);

  // Create a message that requests a return receipt to a different address
  let msg3 = create_message({from: ["Mimi", "me@example.org"],
                            clobberHeaders: { "Disposition-Notification-To": "other@example.com" }
                           });
  add_message_to_folder(folder, msg3);

  // Create a message that requests a return receipt to different addresses.
  let msg4 = create_message({from: ["Bobby", "bob@example.org"],
                            clobberHeaders: { "Disposition-Notification-To": "ex1@example.com, ex2@example.com" }
                           });
  add_message_to_folder(folder, msg4);
}
/**
 * Test that return receipts are shown when Disposition-Notification-To is set.
 */
function test_basic_mdn_shown_() {
  be_in_folder(folder);

  // Select the first message, which will display the notifiaction.
  // This message requests a return receipt.
  let curMessage = select_click_row(0);
  assert_selected_and_displayed(mc, curMessage);

  let msgNotBar = mc.e("msgNotificationBar");
  if (msgNotBar.collapsed)
    throw new Error("msgNotificationBar not shown although it should");
  if (msgNotBar.selectedIndex != 4) // it's not the mdnBar showing
    throw new Error("msgNotificationBar didn't show the mdnBar; " +
                    "msgNotBar.selectedIndex=" + msgNotBar.selectedIndex);

  let mdnBar = mc.e("mdnBar");
  let notificationText = mdnBar.textContent;
  if (notificationText.indexOf("ake@example.com") != -1)
    throw new Error("mdnBar said where to send even if from/disposition-to " +
                    "addresses were the same; notificationText=" + notificationText);
}

/**
 * Test that return receipts are not shown when Disposition-Notification-To
 * isn't set.
 */
function test_no_mdn_for_normal_msgs() {
  be_in_folder(folder);

  // Select the second message, which shouldn't display the notification.
  // This message doesn't request a return receipt.
  let curMessage = select_click_row(1);
  assert_selected_and_displayed(mc, curMessage);

  let msgNotBar = mc.e("msgNotificationBar");
  if (!msgNotBar.collapsed)
    throw new Error("mdnBar shown for message where return receipt isn't requested");
}

/**
 * Test that return receipts warns when the mdn address is different.
 */
function test_mdn_when_from_and_disposition_to_differs() {
  be_in_folder(folder);

  // Select the third message, which should display a notification with warning.
  let curMessage = select_click_row(2);
  assert_selected_and_displayed(mc, curMessage);

  let msgNotBar = mc.e("msgNotificationBar");
  if (msgNotBar.collapsed)
    throw new Error("msgNotificationBar not shown although it should");
  if (msgNotBar.selectedIndex != 4) // it's not the mdnBar showing
    throw new Error("msgNotificationBar didn't show the mdnBar; " +
                    "msgNotBar.selectedIndex=" + msgNotBar.selectedIndex);

  let mdnBar = mc.e("mdnBar");
  let notificationText = mdnBar.textContent;
  if (notificationText.indexOf("other@example.com") == -1)
    throw new Error("mdnBar didn't warn about where to send; notificationText=" +
                    notificationText);
}

/**
 * Test that return receipts warns when the mdn address consists of multiple
 * addresses.
 */
function test_mdn_when_disposition_to_multi() {
  be_in_folder(folder);

  // Select the fuorth message, which should display a notification with warning
  // listing all the addresses
  let curMessage = select_click_row(3);
  assert_selected_and_displayed(mc, curMessage);

  let msgNotBar = mc.e("msgNotificationBar");
  if (msgNotBar.collapsed)
    throw new Error("msgNotificationBar not shown although it should");
  if (msgNotBar.selectedIndex != 4) // it's not the mdnBar showing
    throw new Error("msgNotificationBar didn't show the mdnBar; " +
                    "msgNotBar.selectedIndex=" + msgNotBar.selectedIndex);

  let mdnBar = mc.e("mdnBar");
  let notificationText = mdnBar.textContent;
  if (notificationText.indexOf("ex1@example.com") == -1 ||
      notificationText.indexOf("ex2@example.com") == -1)
    throw new Error("mdnBar didn't warn about where to send; notificationText=" +
                    notificationText);
}
