/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests that the attachment reminder works properly.
 */

// make SOLO_TEST=composition/test-attachment-reminder.js mozmill-one

const MODULE_NAME = "test-attachment-reminder";

const RELATIVE_ROOT = "../shared-modules";
const MODULE_REQUIRES = ["folder-display-helpers", "compose-helpers", "window-helpers"];
var jumlib = {};
Components.utils.import("resource://mozmill/modules/jum.js", jumlib);
var elib = {};
Components.utils.import("resource://mozmill/modules/elementslib.js", elib);

var composeHelper = null;
var cwc = null; // compose window controller

var setupModule = function (module) {
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);
  composeHelper = collector.getModule("compose-helpers");
  composeHelper.installInto(module);

  let wh = collector.getModule("window-helpers");
  wh.installInto(module);
};

function setupComposeWin(toAddr, subj, body) {
  cwc.type(cwc.a("addressingWidget", {class: "addressingWidgetCell", crazyDeck: 1}), toAddr);
  cwc.type(cwc.eid("msgSubject"), subj)
  cwc.type(cwc.eid("content-frame"), body);
}

/** Test that the attachment works, in general. */
function testAttachmentReminderPopsUpWhenItShould() {
  // Disabled due to random timeouts, see bug 550843
  return;

  cwc = composeHelper.open_compose_new_mail();

  setupComposeWin("test@example.org",
                  "testing attachment reminder!",
                  "Hjello! ");

  // Give the notification time to appear. It shouldn't.
  cwc.sleep(1100);
  if (cwc.e("attachmentNotificationBox").currentNotification)
    throw new Error("Attachment notification shown when it shouldn't.");

  cwc.type(cwc.eid("content-frame"), "Seen this cool attachment?");

  // Give the notification time to appear. It should now.
  cwc.sleep(1100);

  // Click ok to be notified on send if no attachments are attached.
  cwc.click(cwc.eid("attachmentNotificationBox",
            {tagName: "button", label: "Remind Me Later"}));

  // Now try to send, make sure we get the alert.
  plan_for_modal_dialog("commonDialog", clickOhIDid);
  cwc.click(cwc.eid("button-send"));
  wait_for_modal_dialog("commonDialog");

  composeHelper.close_compose_window(cwc);
}

/** Test that the alert appears normally, but now after closing the notification. */
function testAttachmentReminderDismissal() {
  // Disabled due to random timeouts, see bug 550843
  return;

  cwc = composeHelper.open_compose_new_mail();

  setupComposeWin("test@example.org",
                  "popping up, eh?",
                  "Hi there, remember the attachment!");

  // Give the notification time to appear.
  cwc.sleep(1100);
  if (!cwc.e("attachmentNotificationBox").currentNotification)
    throw new Error("Attachment reminder now shown yet.");

  // We didn't click the "Remind Me Later" - the alert should pop up on send anyway.
  plan_for_modal_dialog("commonDialog", clickOhIDid);
  cwc.click(cwc.eid("button-send"));
  wait_for_modal_dialog("commonDialog");

  if (!cwc.e("attachmentNotificationBox").currentNotification)
    throw new Error("No attachment notification shown going back to compose.");

  // Close the notification - after this the alert shouldn't appear on send
  // anymore.
  cwc.e("attachmentNotificationBox").currentNotification.close();

  clickSendAndHandleSendError(cwc);
}

/** Test that the mail.compose.attachment_reminder_aggressive pref works. */
function testAttachmentReminderAggressivePref() {
  // Disabled due to random timeouts, see bug 550843
  return;

  const PREF = "mail.compose.attachment_reminder_aggressive";
  let prefBranch = Cc["@mozilla.org/preferences-service;1"]
                      .getService(Ci.nsIPrefService).getBranch(null);
  prefBranch.setBoolPref(PREF, false);

  cwc = composeHelper.open_compose_new_mail();

  setupComposeWin("test@example.org",
                  "aggressive?",
                  "Check this attachment!");

  // Give the notification time to appear.
  cwc.sleep(1100);
  if (!cwc.e("attachmentNotificationBox").currentNotification)
    throw new Error("No attachment notification shown with aggressive pref.");

  clickSendAndHandleSendError(cwc);

  // Now reset the pref back to original value.
  if (prefBranch.prefHasUserValue(PREF))
    prefBranch.clearUserPref(PREF);
}

/** Test that clicking "No, Send Now" in the attachment reminder alert works. */
function testNoSendNowSends() {
  // Disabled due to random timeouts, see bug 550843
  return;

  cwc = composeHelper.open_compose_new_mail();

  setupComposeWin("test@example.org",
                  "will the 'No, Send Now' button work?",
                  "Hello, i got your attachment!");

  // Give the notification time to appear.
  cwc.sleep(1100);

  // Click the send button again, this time choose "No, Send Now".
  plan_for_modal_dialog("commonDialog", clickNoSendNow);
  cwc.click(cwc.eid("button-send"));
  wait_for_modal_dialog("commonDialog");

  clickSendAndHandleSendError(cwc);
}

/** Click the send button and handle the send error dialog popping up. */
function clickSendAndHandleSendError(controller) {
  // XXX - we'll get a send error dialog:(
  // Close it, the compose window will close too.
  plan_for_modal_dialog("commonDialog", clickOkOnSendError);
  controller.click(controller.eid("button-send"));
  wait_for_modal_dialog("commonDialog");
}

/** Click the "Oh, I Did!" button. */
function clickOhIDid(controller) {
  controller.window.document.documentElement.getButton('extra1').doCommand();
}

/** Click the "No, Send Now" button */
function clickNoSendNow(controller) {
  controller.window.document.documentElement.getButton('accept').doCommand();
}

/** Click Ok in the Send Message Error dialog. */
function clickOkOnSendError(controller) {
  if (controller.window.document.title != "Send Message Error")
    throw new Error("Not a send error dialog; title=" + controller.window.document.title);
  controller.window.document.documentElement.getButton('accept').doCommand();
}

