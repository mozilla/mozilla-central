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

/**
 * Tests the get an account workflow.
 */

var Cu = Components.utils;
var Cc = Components.classes;
var Ci = Components.interfaces;

var MODULE_NAME = 'test-newmailaccount';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'content-tab-helpers'];

var controller = {};
var mozmill = {};
var elib = {};
Cu.import('resource://mozmill/modules/controller.js', controller);
Cu.import('resource://mozmill/modules/mozmill.js', mozmill);
Cu.import('resource://mozmill/modules/elementslib.js', elib);
Cu.import('resource://gre/modules/Services.jsm');
Cu.import("resource:///modules/mailServices.js");

// RELATIVE_ROOT messes with the collector, so we have to bring the path back
// so we get the right path for the resources.
var url = collector.addHttpResource('../newmailaccount/html', '');
Services.prefs.setCharPref("mail.provider.providerList", url + "providerList");
Services.prefs.setCharPref("mail.provider.suggestFromName", url + "suggestFromName");

const kProvisionerUrl = "chrome://messenger/content/newmailaccount/accountProvisioner.xhtml";
const kProvisionerEnabledPref = "mail.provider.enabled";

// Record what the original value of the mail.provider.enabled pref is so
// that we can put it back once the tests are done.
var gProvisionerEnabled = Services.prefs.getBoolPref(kProvisionerEnabledPref);

var setupModule = function(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let cth = collector.getModule('content-tab-helpers');
  cth.installInto(module);
  let dh = collector.getModule('dom-helpers');
  dh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);

  // Make sure we enable the Account Provisioner.
  Services.prefs.setBoolPref(kProvisionerEnabledPref, true);
};

function teardownModule(module) {
  // Put the mail.provider.enabled pref back the way it was.
  Services.prefs.setBoolPref(kProvisionerEnabledPref, gProvisionerEnabled);
}

// We can't use plan_for_new_window because it expects a window type and I have
// no idea what on earth is the windowtype of an HTML window.
function get_provisioner_window() {
  let wm = Services.wm;
  let windows = [w for each (w in fixIterator(wm.getEnumerator("")))];
  windows = windows.filter(function (window) window.document.location.href == kProvisionerUrl);
  return windows.length == 1 ? windows[0] : null;
}

function wait_for_provisioner_window() {
  let w = null;
  mc.waitFor(function () (w = get_provisioner_window(), w != null));
  mc.waitFor(function () {
    let docShell = w.QueryInterface(Ci.nsIInterfaceRequestor)
        .getInterface(Ci.nsIWebNavigation)
        .QueryInterface(Ci.nsIDocShell);
    return docShell.busyFlags == Ci.nsIDocShell.BUSY_FLAGS_NONE;
  });
  return w;
}

function open_provisioner_window() {
  mc.click(new elib.Elem(mc.menus.menu_File.menu_New.newCreateEmailAccountMenuItem));
}

function test_get_an_account() {
  open_provisioner_window();
  // This just finds the window
  let w = wait_for_provisioner_window();

  // Fill in some data
  let $ = w.$;
  $("#name").val("Green Llama");
  $(".search").click();
  mc.waitFor(function () $("#results").children().length > 0);

  // Click on the first address. The reveals the button with the price.
  $(".address:first").click();
  mc.waitFor(function () $("button.create:visible").length > 0);

  // Pick the first email address.
  plan_for_content_tab_load();
  $("button.create:first").click();

  // First, make sure the page is loaded.
  wait_for_content_tab_load(undefined, function (aURL) {
    return aURL.host == "localhost";
  });
  let tab = mc.tabmail.currentTabInfo;
  let nAccounts = function ()
    [x for each (x in fixIterator(MailServices.accounts.accounts))].length;
  let i = nAccounts();
  // Click the button
  let btn = tab.browser.contentWindow.document.querySelector("input[value=Send]");
  mc.click(new elib.Elem(btn));

  // Re-get the new window
  w = wait_for_provisioner_window();
  $ = w.$;
  assert_equals(nAccounts(), i + 1);
}
