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
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mike Conley <mconley@mozilla.com>
 *   Jonathan Protzenko <jonathan.protzenko@gmail.com>
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

const MODULE_NAME = "newmailaccount-helpers";
const RELATIVE_ROOT = "../shared-modules";
const MODULE_REQUIRES = ['folder-display-helpers'];

var elib = {};
var mc, fdh;

Cu.import('resource://mozmill/modules/elementslib.js', elib);
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource:///modules/mailServices.js');
Cu.import('resource://gre/modules/XPCOMUtils.jsm');

function setupModule(module) {
  fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);

  mc = fdh.mc;
}

function installInto(module) {
  setupModule(module);

  module.wait_for_provider_list_loaded = wait_for_provider_list_loaded;
  module.wait_for_search_ready = wait_for_search_ready;
  module.wait_for_element_visible = wait_for_element_visible;
  module.wait_for_element_invisible = wait_for_element_invisible;
  module.open_provisioner_window = open_provisioner_window;
  module.wait_for_the_wizard_to_be_closed = wait_for_the_wizard_to_be_closed;
  module.assert_links_shown = assert_links_shown;
  module.assert_links_not_shown = assert_links_not_shown;
  module.wait_for_search_results = wait_for_search_results;
  module.gConsoleListener = gConsoleListener;
  module.wait_to_be_offline = wait_to_be_offline;
  module.wait_for_element_enabled = wait_for_element_enabled;
  module.wait_for_element_disabled = wait_for_element_disabled;
}

/* Wait until the list of providers is loaded and displayed.
 */
function wait_for_provider_list_loaded(aController) {
  mc.waitFor(function() {
    return aController.window.EmailAccountProvisioner.loadedProviders;
  },
            "Timed out waiting for the provider list to be loaded");
}

/* Wait until the search fields are enabled, and we're ready to
 * do a search.
 */
function wait_for_search_ready(aController) {
  mc.waitFor(function() {
    mc.sleep(0);
    return aController.window.$("#searchSubmit").is(":enabled");
  },
            "Timed out waiting for the search fields to be enabled");
}

/* Wait for a particular element to become fully visible.  Assumes that
 * jQuery is available in the controller's window.
 */
function wait_for_element_visible(aController, aId) {
  mc.waitFor(function() {
    return aController.window.$("#" + aId).is(":visible");
  },
             "Timed out waiting for element with ID=" + aId
             + " to be enabled");
}

/* Wait for a particular element to become fully invisible.  Assumes that
 * jQuery is available in the controller's window.
 */
function wait_for_element_invisible(aController, aId) {
  mc.waitFor(function() {
    return !aController.window.$("#" + aId).is(":visible");
  },
             "Timed out waiting for element with ID=" + aId
             + " to become invisible");
}

/* Opens the account provisioner by selecting it from the File/Edit menu.
 */
function open_provisioner_window() {
  mc.click(new elib.Elem(mc.menus.menu_File.menu_New.newCreateEmailAccountMenuItem));
}

/* Used by wait_for_the_wizard_to_be_closed to check if the wizard is still
 * open.
 */
function poll_for_wizard_window(aController) {
  return Services.wm.getMostRecentWindow("mail:autoconfig");
}

/* Waits until the existing email account setup wizard is closed.
 */
function wait_for_the_wizard_to_be_closed(aController) {
  aController.waitFor(function () {
    let w = poll_for_wizard_window(aController);
    return w == null
  });
}

/* Asserts that a series of links are currently visible. aLinks can either
 * be a single link, or an Array of links.
 */
function assert_links_shown(aController, aLinks) {
  if (!Array.isArray(aLinks))
    aLinks = [aLinks];

  let $ = aController.window.$;

  aLinks.forEach(function(aLink) {
    let anchor = $('a[href="' + aLink + '"]');
    fdh.assert_true(anchor.length > 0);
    fdh.assert_true(anchor.is(":visible"));
  });
}

/* Asserts that a series of links are currently invisible. aLinks can either
 * be a single link, or an Array of links.
 */
function assert_links_not_shown(aController, aLinks) {
  if (!Array.isArray(aLinks))
    aLinks = [aLinks];

  let $ = aController.window.$;

  aLinks.forEach(function(aLink) {
    let anchor = $('a[href="' + aLink + '"]');
    fdh.assert_true(anchor.length == 0);
  });
}

/* Waits for account provisioner search results to come in.
 */
function wait_for_search_results(w) {
  w.waitFor(function() w.window.$("#results").children().length > 0,
            "Timed out waiting for search results to arrive.");
}

/* Waits for the account provisioner to be displaying the offline
 * message.
 */
function wait_to_be_offline(w) {
  mc.waitFor(function() {
    return w.window.$("#cannotConnectMessage").is(":visible");
  }, "Timed out waiting for the account provisioner to be in "
    + "offline mode.");
}

/* Waits for an input element with id aId to be enabled.
 */
function wait_for_element_enabled(w, aId) {
  mc.waitFor(function() {
    return w.window.$("#" + aId).is(":enabled");
  }, "Timed out waiting for element with id=" + aId + " to be enabled");
}

/* Waits for an input element with id aId to be disabled.
 */
function wait_for_element_disabled(w, aId) {
  mc.waitFor(function() {
    return w.window.$("#" + aId).is(":disabled");
  }, "Timed out waiting_for_element with id=" + aId + " to be disabled");
}

/* A listener for the Error Console, which allows us to ensure that certain
 * messages appear in the console.
 */
var gConsoleListener = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIConsoleListener]),
  _msg: null,
  _sawMsg: false,

  observe: function(aMsg) {
    if (!this._msg)
      return;

    this._sawMsg = (aMsg.message.indexOf(this._msg) != -1);
  },

  listenFor: function(aMsg) {
    this._msg = aMsg;
  },

  reset: function() {
    this._msg = null;
    this._sawMsg = false;
  },

  get sawMsg() {
    return this._sawMsg;
  },

  wait: function() {
    self = this;
    mc.waitFor(function() {
      return self.sawMsg;
    },
    "Timed out waiting for console message: " + this._msg);
  },
}
