/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var Ci = Components.interfaces;
var Cc = Components.classes;
var Cu = Components.utils;

const MODULE_NAME = "newmailaccount-helpers";
const RELATIVE_ROOT = "../shared-modules";
const MODULE_REQUIRES = ['folder-display-helpers'];

var elib = {};
var mc, fdh, kbh;

Cu.import('resource://mozmill/modules/elementslib.js', elib);
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource:///modules/iteratorUtils.jsm');
Cu.import('resource:///modules/mailServices.js');
Cu.import('resource://gre/modules/XPCOMUtils.jsm');

function setupModule(module) {
  fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  kbh = collector.getModule('keyboard-helpers');
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
  module.remove_email_account = remove_email_account;
  module.type_in_search_name = type_in_search_name;
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
    return aController.window.$("#name").is(":enabled");
  },
            "Timed out waiting for the search input field to be enabled");
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

/**
 * Remove an account with address aAddress from the current profile.
 *
 * @param aAddress the email address to try to remove.
 */
function remove_email_account(aAddress) {
  for each (let account in fixIterator(MailServices.accounts.accounts,
                                       Ci.nsIMsgAccount)) {
    if (account.defaultIdentity && account.defaultIdentity.email == aAddress) {
      MailServices.accounts.removeAccount(account);
      break;
    }
  }
}

/**
 * Helper function that finds the search input, clears it of any content,
 * and then manually types aName into the field.
 *
 * @param aController the controller for the Account Provisioner dialog.
 * @param aName the name to type in.
 */
function type_in_search_name(aController, aName) {
  aController.e("name").focus();
  aController.keypress(null, 'a', {accelKey: true});
  aController.keypress(null, 'VK_BACK_SPACE', {});

  kbh.input_value(aController, aName);
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

    this._sawMsg |= (aMsg.message.contains(this._msg));
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
