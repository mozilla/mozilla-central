/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const MODULE_NAME = "compose-helpers";

const RELATIVE_ROOT = "../shared-modules";
// we need this for the main controller
const MODULE_REQUIRES = ["folder-display-helpers",
                         "window-helpers",
                         "dom-helpers"];

var elib = {};
Cu.import('resource://mozmill/modules/elementslib.js', elib);
var mozmill = {};
Cu.import('resource://mozmill/modules/mozmill.js', mozmill);
var utils = {};
Cu.import('resource://mozmill/modules/utils.js', utils);

const kTextNodeType = 3;

var folderDisplayHelper;
var mc;
var windowHelper, domHelper;

function setupModule() {
  folderDisplayHelper = collector.getModule('folder-display-helpers');
  mc = folderDisplayHelper.mc;
  windowHelper = collector.getModule('window-helpers');
  domHelper = collector.getModule('dom-helpers');
}

function installInto(module) {
  setupModule();

  // Now copy helper functions
  module.open_compose_new_mail = open_compose_new_mail;
  module.open_compose_with_reply = open_compose_with_reply;
  module.open_compose_with_reply_to_all = open_compose_with_reply_to_all;
  module.open_compose_with_reply_to_list = open_compose_with_reply_to_list;
  module.open_compose_with_forward = open_compose_with_forward;
  module.open_compose_with_forward_as_attachments = open_compose_with_forward_as_attachments;
  module.open_compose_with_element_click = open_compose_with_element_click;
  module.close_compose_window = close_compose_window;
  module.wait_for_compose_window = wait_for_compose_window;
  module.create_msg_attachment = create_msg_attachment;
  module.add_attachments = add_attachments;
  module.add_attachment = add_attachments;
  module.delete_attachment = delete_attachment;
  module.get_compose_body = get_compose_body;
  module.type_in_composer = type_in_composer;
  module.assert_previous_text = assert_previous_text;
  module.assert_notification_displayed = assert_notification_displayed;
  module.close_notification = close_notification;
  module.wait_for_notification_to_stop = wait_for_notification_to_stop;
  module.wait_for_notification_to_show = wait_for_notification_to_show;
}

/**
 * Opens the compose window by starting a new message
 *
 * @param aController the controller for the mail:3pane from which to spawn
 *                    the compose window.  If left blank, defaults to mc.
 *
 * @return The loaded window of type "msgcompose" wrapped in a MozmillController
 *         that is augmented using augment_controller.
 *
 */
function open_compose_new_mail(aController) {
  if (aController === undefined)
    aController = mc;

  windowHelper.plan_for_new_window("msgcompose");
  aController.keypress(null, "n", {shiftKey: false, accelKey: true});

  return wait_for_compose_window();
}

/**
 * Opens the compose window by replying to a selected message and waits for it
 * to load.
 *
 * @return The loaded window of type "msgcompose" wrapped in a MozmillController
 *         that is augmented using augment_controller.
 */
function open_compose_with_reply(aController) {
  if (aController === undefined)
    aController = mc;

  windowHelper.plan_for_new_window("msgcompose");
  aController.keypress(null, "r", {shiftKey: false, accelKey: true});

  return wait_for_compose_window();
}

/**
 * Opens the compose window by replying to all for a selected message and waits
 * for it to load.
 *
 * @return The loaded window of type "msgcompose" wrapped in a MozmillController
 *         that is augmented using augment_controller.
 */
function open_compose_with_reply_to_all(aController) {
  if (aController === undefined)
    aController = mc;

  windowHelper.plan_for_new_window("msgcompose");
  aController.keypress(null, "R", {shiftKey: true, accelKey: true});

  return wait_for_compose_window();
}

/**
 * Opens the compose window by replying to list for a selected message and waits for it
 * to load.
 *
 * @return The loaded window of type "msgcompose" wrapped in a MozmillController
 *         that is augmented using augment_controller.
 */
function open_compose_with_reply_to_list(aController) {
  if (aController === undefined)
    aController = mc;

  windowHelper.plan_for_new_window("msgcompose");
  aController.keypress(null, "l", {shiftKey: true, accelKey: true});

  return wait_for_compose_window();
}

/**
 * Opens the compose window by forwarding the selected messages as attachments
 * and waits for it to load.
 *
 * @return The loaded window of type "msgcompose" wrapped in a MozmillController
 *         that is augmented using augment_controller.
 */
function open_compose_with_forward_as_attachments(aController) {
  if (aController === undefined)
    aController = mc;

  windowHelper.plan_for_new_window("msgcompose");
  aController.click(aController.eid("menu_forwardAsAttachment"));

  return wait_for_compose_window();
}

/**
 * Opens the compose window by forwarding the selected message and waits for it
 * to load.
 *
 * @return The loaded window of type "msgcompose" wrapped in a MozmillController
 *         that is augmented using augment_controller.
 */
function open_compose_with_forward(aController) {
  if (aController === undefined)
    aController = mc;

  windowHelper.plan_for_new_window("msgcompose");
  aController.keypress(null, "l", {shiftKey: false, accelKey: true});

  return wait_for_compose_window();
}

/**
 * Opens the compose window by clicking the specified element and waits for
 * the compose window to load.
 *
 * @param aElement    the name of the element that should be clicked.
 * @param aController the controller whose window is to be closed.
 *
 * @return The loaded window of type "msgcompose" wrapped in a MozmillController
 *         that is augmented using augment_controller.
 */
function open_compose_with_element_click(aElement, aController) {
  if (aController === undefined)
    aController = mc;

  windowHelper.plan_for_new_window("msgcompose");
  aController.click(new elib.ID(mc.window.document, aElement));

  return wait_for_compose_window();
}

/**
 * Closes the requested compose window.
 *
 * @param aController the controller whose window is to be closed.
 * @param aShouldPrompt (optional) true: check that the prompt to save appears
 *                                 false: check there's no prompt to save
 */
function close_compose_window(aController, aShouldPrompt) {
  if (aShouldPrompt === undefined) { // caller doesn't care if we get a prompt
    windowHelper.close_window(aController);
    return;
  }

  windowHelper.plan_for_window_close(aController);
  if (aShouldPrompt) {
    windowHelper.plan_for_modal_dialog("commonDialog", function clickDontSave(controller) {
       controller.window.document.documentElement.getButton("extra1").doCommand();
    });
    // Try to close, we should get a prompt to save.
    aController.window.goDoCommand("cmd_close");
    windowHelper.wait_for_modal_dialog();
  }
  else {
    aController.window.goDoCommand("cmd_close");
  }
  windowHelper.wait_for_window_close();
}

/**
 * Waits for a new compose window to open. This assumes you have already called
 * "windowHelper.plan_for_new_window("msgcompose");" and the command to open
 * the compose window itself.
 *
 * @return The loaded window of type "msgcompose" wrapped in a MozmillController
 *         that is augmented using augment_controller.
 */
function wait_for_compose_window(aController) {
  if (aController === undefined)
    aController = mc;

  let replyWindow = windowHelper.wait_for_new_window("msgcompose");

  let editor = replyWindow.window.document.querySelector("editor");

  if (editor.webNavigation.busyFlags != Ci.nsIDocShell.BUSY_FLAGS_NONE) {
    let editorObserver = {
      editorLoaded: false,

      observe: function eO_observe(aSubject, aTopic, aData) {
        if (aTopic == "obs_documentCreated") {
          this.editorLoaded = true;
        }
      }
    };

    editor.commandManager.addCommandObserver(editorObserver,
                                             "obs_documentCreated");

    utils.waitFor(function () editorObserver.editorLoaded,
                  "Timeout waiting for compose window editor to load",
                  10000, 100);

    // Let the event queue clear.
    aController.sleep(0);

    editor.commandManager.removeCommandObserver(editorObserver,
                                                "obs_documentCreated");
  }

  // Although the above is reasonable, testing has shown that the some elements
  // need to have a little longer to try and load the initial data.
  // As I can't see a simpler way at the moment, we'll just have to make it a
  // sleep :-(

  aController.sleep(1000);

  return replyWindow;
}

/**
 * Create and return an nsIMsgAttachment for the passed URL.
 * @param aUrl the URL for this attachment (either a file URL or a web URL)
 * @param aSize (optional) the file size of this attachment, in bytes
 */
function create_msg_attachment(aUrl, aSize) {
  let attachment = Cc["@mozilla.org/messengercompose/attachment;1"]
                     .createInstance(Ci.nsIMsgAttachment);

  attachment.url = aUrl;
  if(aSize)
    attachment.size = aSize;

  return attachment;
}

/**
 * Add an attachment to the compose window
 * @param aComposeWindow the composition window in question
 * @param aUrl the URL for this attachment (either a file URL or a web URL)
 * @param aSize (optional) the file size of this attachment, in bytes
 */
function add_attachments(aComposeWindow, aUrls, aSizes) {
  if (!Array.isArray(aUrls))
    aUrls = [aUrls];

  if (!Array.isArray(aSizes))
    aSizes = [aSizes];

  let attachments = [];

  for (let [i, url] in Iterator(aUrls)) {
    attachments.push(create_msg_attachment(url, aSizes[i]));
  }

  aComposeWindow.window.AddAttachments(attachments);
}

/**
 * Delete an attachment from the compose window
 * @param aComposeWindow the composition window in question
 * @param aIndex the index of the attachment in the attachment pane
 */
function delete_attachment(aComposeWindow, aIndex) {
  let bucket = aComposeWindow.e('attachmentBucket');
  let node = bucket.getElementsByTagName('attachmentitem')[aIndex];

  aComposeWindow.click(new elib.Elem(node));
  aComposeWindow.window.RemoveSelectedAttachment();
}

/**
 * A helper function for determining whether or not a notification with
 * a particular value is being displayed in the composer window.
 *
 * @param aController the controller of the compose window to check
 * @param aValue the value of the notification to look for.
 * @param aDisplayed true if the notification should be displayed, false
 *                   otherwise.
 * @returns the notification if we're asserting that the notification is
 *          displayed, and it actually shows up. Returns null otherwise.
 */
function assert_notification_displayed(aController, aValue, aDisplayed) {
  let nb = aController.window
                      .document
                      .getElementById("attachmentNotificationBox");
  let hasNotification = false;
  let notification = nb.getNotificationWithValue(aValue);
  let hasNotification = (notification != null)

  if (hasNotification != aDisplayed)
    throw new Error("Expected the notification with value " + aValue +
                    " to be " + (aDisplayed ? "shown" : "not shown"));

  return notification;
}

/**
 * A helper function for closing a notification in the compose window if
 * one is currently displayed.
 *
 * @param aController the controller for the compose window with
 *                    the notification.
 * @param aValue the value of the notification to close.
 */
function close_notification(aController, aValue) {
  let nb = aController.window
                      .document
                      .getElementById("attachmentNotificationBox");
  let notification = nb.getNotificationWithValue(aValue);

  if (notification)
    notification.close();
}

/**
 * A helper function that waits for a notification with value aValue
 * to stop displaying in the compose window.
 *
 * @param aController the controller for the compose window with the
 *                    notification.
 * @param aValue the value of the notification to wait to stop.
 */
function wait_for_notification_to_stop(aController, aValue) {
  let nb = aController.window
                      .document
                      .getElementById("attachmentNotificationBox");

  aController.waitFor(function() !nb.getNotificationWithValue(aValue),
                      "Timed out waiting for notification with value " +
                      aValue + " to stop.");
}

/**
 * A helper function that waits for a notification with value aValue
 * to show in the compose window.
 *
 * @param aController the controller for the compose window that we want
 *                    the notification to appear in.
 * @param aValue the value of the notification to wait for.
 */
function wait_for_notification_to_show(aController, aValue) {
  let nb = aController.window
                      .document
                      .getElementById("attachmentNotificationBox");

  aController.waitFor(function() nb.getNotificationWithValue(aValue) != null,
                      "Timed out waiting for notification with value " +
                      aValue + " to show.");
}

/**
 * Helper function returns the message body element of a composer window.
 *
 * @param aController the controller for a compose window.
 */
function get_compose_body(aController) {
  let mailDoc = aController.e("content-frame").contentDocument;
  return mailDoc.querySelector("body");
}

/**
 * Given some compose window controller, type some text into that composer,
 * pressing enter after each line except for the last.
 *
 * @param aController a compose window controller.
 * @param aText an array of strings to type.
 */
function type_in_composer(aController, aText) {
  // If we have any typing to do, let's do it.
  let frame = aController.eid("content-frame");
  for each (let [i, aLine] in Iterator(aText)) {
    aController.type(frame, aLine);
    if (i < aText.length - 1)
      aController.keypress(frame, "VK_RETURN", {});
  }
}

/**
 * Given some starting node aStart, ensure that aStart is a text node which
 * has a value matching the last value of the aText string array, and has
 * a br node immediately preceding it. Repeated for each subsequent string
 * of the aText array (working from end to start).
 *
 * @param aStart the first node to check
 * @param aText an array of strings that should be checked for in reverse
 *              order (so the last element of the array should be the first
 *              text node encountered, the second last element of the array
 *              should be the next text node encountered, etc).
 */
function assert_previous_text(aStart, aText) {
  let textNode = aStart;
  for (let i = aText.length - 1; i >= 0; --i) {
    if (textNode.nodeType != kTextNodeType)
      throw new Error("Expected a text node! Node type was: " + textNode.nodeType);

    if (textNode.nodeValue != aText[i])
      throw new Error("Unexpected inequality - " + textNode.nodeValue + " != " +
                      + aText[i]);

    // We expect a BR preceding each text node automatically, except
    // for the last one that we reach.
    if (i > 0) {
      let br = textNode.previousSibling;

      if (br.localName != "br")
        throw new Error("Expected a BR node - got a " + br.localName +
                        "instead.");

      textNode = br.previousSibling;
    }
  }
  return textNode;
}
