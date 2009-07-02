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
 *   Siddharth Agarwal <sid.bugzilla@gmail.com>
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

const MODULE_NAME = 'junk-helpers';

const RELATIVE_ROOT = '../shared-modules';

// we need this for the main controller
const MODULES_REQUIRES = ['folder-display-helpers'];

var folderDisplayHelper;
var mc;

function setupModule() {
  folderDisplayHelper = collector.getModule('folder-display-helpers');
  mc = folderDisplayHelper.mc;
}

function installInto(module) {
  setupModule();

  // Now copy helper functions
  module.mark_selected_messages_as_junk = mark_selected_messages_as_junk;
  module.delete_mail_marked_as_junk = delete_mail_marked_as_junk;
}

/**
 * Mark the selected messages as junk. This is done by pressing the J key.
 *
 * @param aController The controller in whose context to do this, defaults to
 *     |mc| if omitted.
 */
function mark_selected_messages_as_junk(aController) {
  if (aController === undefined)
    aController = mc;
  aController.keypress(aController == mc ? mc.eThreadTree : null,
                       "j", {});
}

/**
 * Delete all mail marked as junk in the selected folder. This is done by
 * activating the menu option from the Tools menu.
 *
 * @param aController The controller in whose context to do this, defaults to
 *     |mc| if omitted.
 */
function delete_mail_marked_as_junk(aController) {
  if (aController === undefined)
    aController = mc;
  // if something is loading, make sure it finishes loading...
  folderDisplayHelper.wait_for_message_display_completion(aController);
  folderDisplayHelper.plan_to_wait_for_folder_events(
      "DeleteOrMoveMsgCompleted", "DeleteOrMoveMsgFailed");
  aController.click(new elib.Elem(aController.menus.tasksMenu.deleteJunk));
  folderDisplayHelper.wait_for_folder_events();
}
