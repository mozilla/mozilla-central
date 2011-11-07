/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * The Original Code is Thunderbird Mail Client code.
 *
 * The Initial Developer of the Original Code is the Mozilla Foundation
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mike Conley <mconley@mozilla.com>
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

/**
 * Tests that the attachment reminder works properly.
 */

const MODULE_NAME = "test-save-changes-on-close";

const RELATIVE_ROOT = "../shared-modules";
const MODULE_REQUIRES = ["folder-display-helpers", "compose-helpers",
                         "prompt-helpers"];
const SAVE = 0
const CANCEL = 1
const DONT_SAVE = 2;

var jumlib = {};
Components.utils.import("resource://mozmill/modules/jum.js", jumlib);
var elib = {};
Components.utils.import("resource://mozmill/modules/elementslib.js", elib);
Components.utils.import("resource://gre/modules/Services.jsm");

var composeHelper = null;
var cwc = null; // compose window controller

var setupModule = function (module) {
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);

  let composeHelper = collector.getModule("compose-helpers");
  composeHelper.installInto(module);

  let ph = collector.getModule("prompt-helpers");
  ph.installInto(module);
};

/* Test that when a compose window is open with changes, and
 * a Quit is requested (for example, from File > Quit from the
 * 3pane), that the user gets a confirmation dialog to discard
 * the changes.  This also tests that the user can cancel the
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

/* Test that when a compose window is open with changes, and
 * a Quit is requested (for example, from File > Quit from the
 * 3pane), that the user gets a confirmation dialog to discard
 * the changes.  This also tests that the user can let the quit
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

/* Bug 698077 - test that when quitting with two compose windows open, if
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
