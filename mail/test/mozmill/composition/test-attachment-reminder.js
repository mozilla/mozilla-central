/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests that the attachment reminder works properly.
 */

const MODULE_NAME = "test-attachment-reminder";

const RELATIVE_ROOT = "../shared-modules";
const MODULE_REQUIRES = ["folder-display-helpers",
                         "compose-helpers",
                         "window-helpers"];

Cu.import("resource://gre/modules/Services.jsm");

// I'm not sure why this is the ID. But it is. :/
const kNotificationID = "1";

function setupModule(module) {
  collector.getModule("folder-display-helpers").installInto(module);
  collector.getModule("compose-helpers").installInto(module);
  collector.getModule("window-helpers").installInto(module);
};

function setupComposeWin(aCwc, toAddr, subj, body) {
  aCwc.type(null, toAddr);
  aCwc.type(aCwc.eid("msgSubject"), subj)
  aCwc.type(aCwc.eid("content-frame"), body);
}

/**
 * Test that the attachment works, in general.
 */
function test_attachment_reminder_appears_properly() {
  let cwc = open_compose_new_mail();
  let notificationBox = cwc.e("attachmentNotificationBox");

  // There should be no notification yet.
  assert_notification_displayed(cwc, kNotificationID, false);

  setupComposeWin(cwc, "test@example.org", "testing attachment reminder!",
                  "Hjello! ");

  // Give the notification time to appear. It shouldn't.
  cwc.sleep(1100);
  if (notificationBox.getNotificationWithValue(kNotificationID))
    throw new Error("Attachment notification shown when it shouldn't.");

  cwc.type(cwc.eid("content-frame"), "Seen this cool attachment?");

    // Give the notification time to appear. It should now.
  wait_for_notification_to_show(cwc, kNotificationID);

  // Click ok to be notified on send if no attachments are attached.
  cwc.click(cwc.eid("attachmentNotificationBox",
            {tagName: "button", label: "Remind Me Later"}));

  // Now try to send, make sure we get the alert.
  plan_for_modal_dialog("commonDialog", click_oh_i_did);
  cwc.click(cwc.eid("button-send"));
  wait_for_modal_dialog("commonDialog");

  close_compose_window(cwc);
}

/**
 * Test that the alert appears normally, but not after closing the
 * notification.
 */
function test_attachment_reminder_dismissal() {
  let cwc = open_compose_new_mail();

  // There should be no notification yet.
  assert_notification_displayed(cwc, kNotificationID, false);

  setupComposeWin(cwc, "test@example.org", "popping up, eh?",
                  "Hi there, remember the attachment!");

  // Give the notification time to appear.
  wait_for_notification_to_show(cwc, kNotificationID);

  // We didn't click the "Remind Me Later" - the alert should pop up
  // on send anyway.
  plan_for_modal_dialog("commonDialog", click_oh_i_did);
  cwc.click(cwc.eid("button-send"));
  wait_for_modal_dialog("commonDialog");

  let notification = assert_notification_displayed(cwc, kNotificationID,
                                                   true);
  notification.close();
  click_send_and_handle_send_error(cwc);
}
// Disabling this test on Windows due to random timeouts on our Mozmill
// testers.
test_attachment_reminder_dismissal.EXCLUDED_PLATFORMS = ['winnt'];

/**
 * Test that the mail.compose.attachment_reminder_aggressive pref works.
 */
function test_attachment_reminder_aggressive_pref() {
  const kPref = "mail.compose.attachment_reminder_aggressive";
  Services.prefs.setBoolPref(kPref, false);

  let cwc = open_compose_new_mail();

  // There should be no notification yet.
  assert_notification_displayed(cwc, kNotificationID, false);

  setupComposeWin(cwc, "test@example.org", "aggressive?",
                  "Check this attachment!");

  wait_for_notification_to_show(cwc, kNotificationID);
  click_send_and_handle_send_error(cwc);

  // Now reset the pref back to original value.
  if (Services.prefs.prefHasUserValue(kPref))
    Services.prefs.clearUserPref(kPref);
}
// Disabling this test on Windows due to random timeouts on our Mozmill
// testers.
test_attachment_reminder_aggressive_pref.EXCLUDED_PLATFORMS = ['winnt'];

/**
 * Test that clicking "No, Send Now" in the attachment reminder alert
 * works.
 */
function test_no_send_now_sends() {
  let cwc = open_compose_new_mail();

  setupComposeWin(cwc, "test@example.org",
                  "will the 'No, Send Now' button work?",
                  "Hello, i got your attachment!");

  wait_for_notification_to_show(cwc, kNotificationID);

  // Click the send button again, this time choose "No, Send Now".
  plan_for_modal_dialog("commonDialog", click_no_send_now);
  cwc.click(cwc.eid("button-send"));
  wait_for_modal_dialog("commonDialog");

  click_send_and_handle_send_error(cwc);
}
// Disabling this test on Windows due to random timeouts on our Mozmill
// testers.
test_no_send_now_sends.EXCLUDED_PLATFORMS = ['winnt'];

/**
 * Click the send button and handle the send error dialog popping up.
 */
function click_send_and_handle_send_error(controller) {
  // XXX - we'll get a send error dialog:(
  // Close it, the compose window will close too.
  plan_for_modal_dialog("commonDialog", click_ok_on_send_error);
  controller.click(controller.eid("button-send"));
  wait_for_modal_dialog("commonDialog");
}

/**
 * Click the "Oh, I Did!" button in the attachment reminder dialog.
 */
function click_oh_i_did(controller) {
  controller.window.document.documentElement.getButton('extra1').doCommand();
}

/**
 * Click the "No, Send Now" button in the attachment reminder dialog.
 */
function click_no_send_now(controller) {
  controller.window.document.documentElement.getButton('accept').doCommand();
}

/**
 * Click Ok in the Send Message Error dialog.
 */
function click_ok_on_send_error(controller) {
  if (controller.window.document.title != "Send Message Error")
    throw new Error("Not a send error dialog; title=" +
                    controller.window.document.title);
  controller.window.document.documentElement.getButton('accept').doCommand();
}

