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
 * The Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Blake Winton <bwinton@latte.ca>
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
Cu.import("resource://mozmill/modules/elementslib.js", elib);

const MODULE_NAME = "migration-helpers";

var MODULE_REQUIRES = ["window-helpers"];

var controller = {};
Cu.import('resource://mozmill/modules/controller.js', controller);

var wh;

function setupModule() {
  wh = collector.getModule("window-helpers");
}

function installInto(module) {
  setupModule();

  // Now copy helper functions
  module.open_migration_assistant = open_migration_assistant;
  module.get_subpage = get_subpage;
  module.close_migration_assistant = close_migration_assistant;
}

/**
 * Call this to open the migration assistant, and navigate to a specific
 * pane.
 *
 * @param mc the mail:3pane window, wrapped in a MozmillController.
 * @param [aPane] the pane to navigate to.  This value should be one of the
 *     ones contained in the "subpages" array of
 *     mail/base/content/featureConfigurator.js.  If unspecified, we will
 *     stay on the first pane of the migration assistant.
 *
 * @return The loaded migration assistant window wrapped in a MozmillController
 *     with the contentFrame displaying the appropriate pane.
 */
function open_migration_assistant(mc, aPane) {
  // Open the migration assistant.
  wh.plan_for_new_window("mailnews:featureconfigurator");
  mc.click(new elib.Elem(mc.menus.helpMenu.featureConfigurator));
  let fc = wh.wait_for_new_window("mailnews:featureconfigurator");
  if (!aPane)
    return fc;

  // Navigate to the specified pane.
  let content = fc.e("contentFrame");
  let url = content.getAttribute("src");
  while (url.indexOf(aPane) == -1) {
    prevUrl = url;
    fc.click(fc.eid("nextButton"));
    url = content.getAttribute("src");

    // If we didn't change urls, then we've hit the end, and still haven't
    // found the correct pane, so throw an error.
    if (url == prevUrl) {
      close_migration_assistant(fc);
      throw new Error("Didn't find " + aPane + " in Migration Assistant!");
    }
  }
  return fc;
}

/**
 * Call this to close the migration assistant.
 *
 * @param fc the migration assistant window wrapped in a MozmillController.
 */
function close_migration_assistant(fc) {
  wh.plan_for_window_close(fc);
  fc.click(fc.eid("closeButton"));
  wh.wait_for_window_close();
}

/**
 * Call this to get a MozmillController-wrapped window for the subpage
 * (a.k.a. the contents of the iframe).
 *
 * @param fc the migration assistant window wrapped in a MozmillController.
 *
 * @return The subpage's window wrapped in a MozmillController with the
 *     contentFrame displaying the appropriate pane.
 */
function get_subpage(fc) {
  let contentWindow = fc.e("contentFrame").contentWindow;
  let aController = new controller.MozMillController(contentWindow);
  return wh.augment_controller(aController);
}
