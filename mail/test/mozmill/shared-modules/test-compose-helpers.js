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
 * Mozilla Messaging, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mark Banner <bugzilla@standard8.plus.com>
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

var Ci = Components.interfaces;
var Cc = Components.classes;
var Cu = Components.utils;

var elib = {};
Cu.import('resource://mozmill/modules/elementslib.js', elib);
var mozmill = {};
Cu.import('resource://mozmill/modules/mozmill.js', mozmill);

const MODULE_NAME = 'compose-helpers';

const RELATIVE_ROOT = '../shared-modules';

// we need this for the main controller
const MODULES_REQUIRES = ['folder-display-helpers', 'window-helpers'];

var folderDisplayHelper;
var mc;
var windowHelper;

function setupModule() {
  folderDisplayHelper = collector.getModule('folder-display-helpers');
  mc = folderDisplayHelper.mc;
  windowHelper = collector.getModule('window-helpers');
}

function installInto(module) {
  setupModule();

  // Now copy helper functions
  module.open_compose_new_mail = open_compose_new_mail;
  module.open_compose_with_reply = open_compose_with_reply;
  module.open_compose_with_forward = open_compose_with_forward;
}

/**
 * Opens the compose window by starting a new message
 *
 * @return The loaded window of type "msgcompose" wrapped in a MozmillController
 *         that is augmented using augment_controller.
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
 * Closes the requested compose window. This function currently just forwards to
 * windowHelper but means we don't have to include windowHelper elsewhere if we
 * don't want it.
 *
 * In future it could also be expanded to handle prompting on close.
 *
 * @param aController the controller whose window is to be closed.
 */
function close_compose_window(aController) {
  windowHelper.close_window(aController);
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

  let editor = replyWindow.window.document.getElementsByTagName("editor")[0];

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

    aController.waitForEval("subject.editorLoaded == true",
                            10000, 100, editorObserver);

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
