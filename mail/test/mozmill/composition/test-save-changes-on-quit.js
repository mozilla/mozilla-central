/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests that we prompt the user if they'd like to save their message when they
 * try to quit/close with an open compose window with unsaved changes, and
 * that we don't prompt if there are no changes.
 */

// make SOLO_TEST=composition/test-save-changes-on-quit.js mozmill-one

const MODULE_NAME = "test-save-changes-on-close";

const RELATIVE_ROOT = "../shared-modules";
const MODULE_REQUIRES = ["folder-display-helpers", "compose-helpers",
                         "prompt-helpers", "window-helpers"];
const SAVE = 0
const CANCEL = 1
const DONT_SAVE = 2;

var jumlib = {};
Components.utils.import("resource://mozmill/modules/jum.js", jumlib);
var elib = {};
Components.utils.import("resource://mozmill/modules/elementslib.js", elib);
Components.utils.import("resource://gre/modules/Services.jsm");

var cwc = null; // compose window controller
var folder = null;

var setupModule = function (module) {
  collector.getModule("folder-display-helpers").installInto(module);
  collector.getModule("compose-helpers").installInto(module);
  collector.getModule("prompt-helpers").installInto(module);
  collector.getModule("window-helpers").installInto(module);

  folder = create_folder("PromptToSaveTest");

  add_message_to_folder(folder, create_message()); // row 0
  let localFolder = folder.QueryInterface(Ci.nsIMsgLocalMailFolder);
  localFolder.addMessage(msgSource("content type: text", "text")); // row 1
  localFolder.addMessage(msgSource("content type missing", null)); // row 2
};

function msgSource(aSubject, aContentType) {
  let msgId = Components.classes["@mozilla.org/uuid-generator;1"]
                        .getService(Components.interfaces.nsIUUIDGenerator)
                        .generateUUID() + "@invalid";

  return "From - Sun Apr 07 22:47:11 2013\r\n" +
         "X-Mozilla-Status: 0001\r\n" +
         "X-Mozilla-Status2: 00000000\r\n" +
         "Message-ID: <" + msgId + ">\r\n" +
         "Date: Sun, 07 Apr 2013 22:47:11 +0300\r\n" +
         "From: Someone <some.one@invalid>\r\n" +
         "To: someone.else@invalid\r\n" +
         "Subject: " + aSubject + "\r\n" +
         "MIME-Version: 1.0\r\n" +
         (aContentType ? "Content-Type: " + aContentType + "\r\n" : "") +
         "Content-Transfer-Encoding: 7bit\r\n\r\n" +
         "A msg with contentType " + aContentType + "\r\n";
}

/**
 * Test that when a compose window is open with changes, and
 * a Quit is requested (for example, from File > Quit from the
 * 3pane), that the user gets a confirmation dialog to discard
 * the changes. This also tests that the user can cancel the
 * quit request.
 */
function test_can_cancel_quit_on_changes() {
  // Register the Mock Prompt Service
  gMockPromptService.register();

  // opening a new compose window
  cwc = open_compose_new_mail(mc);

  // Make some changes
  cwc.type(cwc.eid("content-frame"), "Hey check out this megalol link");

  let cancelQuit = Cc["@mozilla.org/supports-PRBool;1"]
                   .createInstance(Components.interfaces.nsISupportsPRBool);

  // Set the Mock Prompt Service to return false, so that we
  // cancel the quit.
  gMockPromptService.returnValue = CANCEL;
  // Trigger the quit-application-request notification


  Services.obs.notifyObservers(cancelQuit, "quit-application-requested",
                               null);

  let promptState = gMockPromptService.promptState;
  assert_not_equals(null, promptState, "Expected a confirmEx prompt");

  assert_equals("confirmEx", promptState.method);
  // Since we returned false on the confirmation dialog,
  // we should be cancelling the quit - so cancelQuit.data
  // should now be true
  assert_true(cancelQuit.data, "Didn't cancel the quit");

  close_compose_window(cwc);

  // Unregister the Mock Prompt Service
  gMockPromptService.unregister();
}

/**
 * Test that when a compose window is open with changes, and
 * a Quit is requested (for example, from File > Quit from the
 * 3pane), that the user gets a confirmation dialog to discard
 * the changes. This also tests that the user can let the quit
 * occur.
 */
function test_can_quit_on_changes() {
  // Register the Mock Prompt Service
  gMockPromptService.register();

  // opening a new compose window
  cwc = open_compose_new_mail(mc);

  // Make some changes
  cwc.type(cwc.eid("content-frame"), "Hey check out this megalol link");

  let cancelQuit = Cc["@mozilla.org/supports-PRBool;1"]
                   .createInstance(Components.interfaces.nsISupportsPRBool);

  // Set the Mock Prompt Service to return true, so that we're
  // allowing the quit to occur.
  gMockPromptService.returnValue = DONT_SAVE;

  // Trigger the quit-application-request notification
  Services.obs.notifyObservers(cancelQuit, "quit-application-requested",
                               null);

  promptState = gMockPromptService.promptState;
  assert_not_equals(null, promptState, "Expected a confirmEx prompt");

  assert_equals("confirmEx", promptState.method);
  // Since we returned true on the confirmation dialog,
  // we should be quitting - so cancelQuit.data should now be
  // false
  assert_false(cancelQuit.data, "The quit request was cancelled");

  close_compose_window(cwc);

  // Unregister the Mock Prompt Service
  gMockPromptService.unregister();
}

/**
 * Bug 698077 - test that when quitting with two compose windows open, if
 * one chooses "Don't Save", and the other chooses "Cancel", that the first
 * window's state is such that subsequent quit requests still cause the
 * Don't Save / Cancel / Save dialog to come up.
 */
function test_window_quit_state_reset_on_aborted_quit() {
  // Register the Mock Prompt Service
  gMockPromptService.register();

  // open two new compose windows
  let cwc1 = open_compose_new_mail(mc);
  let cwc2 = open_compose_new_mail(mc);

  // Type something in each window.
  cwc1.type(cwc1.eid("content-frame"), "Marco!");
  cwc2.type(cwc2.eid("content-frame"), "Polo!");

  let cancelQuit = Cc["@mozilla.org/supports-PRBool;1"]
                   .createInstance(Components.interfaces.nsISupportsPRBool);

  // This is a hacky method for making sure that the second window
  // receives a CANCEL click in the popup dialog.
  var numOfPrompts = 0;
  gMockPromptService.onPromptCallback = function() {
    numOfPrompts++;

    if (numOfPrompts > 1)
      gMockPromptService.returnValue = CANCEL;
  }

  gMockPromptService.returnValue = DONT_SAVE;

  // Trigger the quit-application-request notification
  Services.obs.notifyObservers(cancelQuit, "quit-application-requested",
                               null);

  // We should have cancelled the quit appropraitely.
  assert_true(cancelQuit.data);

  // The quit behaviour is that the second window to spawn is the first
  // one that prompts for Save / Don't Save, etc.
  gMockPromptService.reset();

  // The first window should still prompt when attempting to close the
  // window.
  gMockPromptService.returnValue = DONT_SAVE;
  cwc2.click(cwc2.eid("menu_close"));

  let promptState = gMockPromptService.promptState;
  assert_not_equals(null, promptState, "Expected a confirmEx prompt");

  gMockPromptService.unregister();
}

/**
 * Tests that we don't get a prompt to save if there has been no user input
 * into the message yet, when trying to close.
 */
function test_no_prompt_on_close_for_unmodified() {
  be_in_folder(folder);
  let msg = select_click_row(0);
  assert_selected_and_displayed(mc, msg);

  let nwc = open_compose_new_mail();
  close_compose_window(nwc, false);

  let rwc = open_compose_with_reply();
  close_compose_window(rwc, false);

  let fwc = open_compose_with_forward();
  close_compose_window(fwc, false);
}

/**
 * Tests that we get a prompt to save if the user made changes to the message
 * before trying to close it.
 */
function test_prompt_on_close_for_modified() {
  be_in_folder(folder);
  let msg = select_click_row(0);
  assert_selected_and_displayed(mc, msg);

  let nwc = open_compose_new_mail();
  nwc.type(nwc.eid("content-frame"), "Hey hey hey!");
  close_compose_window(nwc, true);

  let rwc = open_compose_with_reply();
  rwc.type(rwc.eid("content-frame"), "Howdy!");
  close_compose_window(rwc, true);

  let fwc = open_compose_with_forward();
  fwc.type(fwc.eid("content-frame"), "Greetings!");
  close_compose_window(fwc, true);
}

/**
 * Test there's no prompt on close when no changes was made in reply/forward
 * windows - for the case the original msg had content type "text".
 */
function test_no_prompt_on_close_for_unmodified_content_type_text() {
  be_in_folder(folder);
  let msg = select_click_row(1); // row 1 is the one with content type text
  assert_selected_and_displayed(mc, msg);

  let rwc = open_compose_with_reply();
  close_compose_window(rwc, false);

  let fwc = open_compose_with_forward();
  assert_equals(fwc.e("attachmentBucket").getRowCount(), 0,
                "forwarding msg created attachment");
  close_compose_window(fwc, false);
}

/**
 * Test there's no prompt on close when no changes was made in reply/forward
 * windows - for the case the original msg had no content type.
 */
function test_no_prompt_on_close_for_unmodified_no_content_type() {
  be_in_folder(folder);
  let msg = select_click_row(2); // row 2 is the one with no content type
  assert_selected_and_displayed(mc, msg);

  let rwc = open_compose_with_reply();
  close_compose_window(rwc, false);

  let fwc = open_compose_with_forward();
  assert_equals(fwc.e("attachmentBucket").getRowCount(), 0,
                "forwarding msg created attachment");
  close_compose_window(fwc, false);
}

