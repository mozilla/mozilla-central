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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * The Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jim Porter <squibblyflabbetydoo@gmail.com>
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

var MODULE_NAME = "test-archive-options";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["folder-display-helpers", "window-helpers",
                       "account-manager-helpers"];

var mozmill = {};
Components.utils.import("resource://mozmill/modules/mozmill.js", mozmill);
var controller = {};
Components.utils.import("resource://mozmill/modules/controller.js", controller);
var elib = {};
Components.utils.import("resource://mozmill/modules/elementslib.js", elib);

var accountManager;
var defaultIdentity;

function setupModule(module) {
  let wh = collector.getModule("window-helpers");
  wh.installInto(module);
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);
  let amh = collector.getModule("account-manager-helpers");
  amh.installInto(module);

  accountManager = Components.classes["@mozilla.org/messenger/account-manager;1"]
                             .getService(Components.interfaces.nsIMsgAccountManager);

  defaultIdentity = accountManager.defaultAccount.defaultIdentity;
}

/**
 * Check that the archive options button is enabled or disabled appropriately.
 *
 * @param amc the account options controller
 * @param index the indext of the account to check
 * @param isEnabled true if the button should be enabled, false otherwise
 */
function subtest_check_archive_options_enabled(amc, index, isEnabled) {
  // XXX: This is pretty brittle, and assumes 1) that there are 8 items in each
  // account's tree, and 2) that the order of the accounts is as we expect.
  click_account_tree_row(amc, index*8 + 2);

  let iframe = amc.window.document.getElementById("contentFrame");
  let button = iframe.contentDocument.getElementById("archiveHierarchyButton");

  assert_equals(button.disabled, !isEnabled);
}

function test_archive_options_enabled() {
  // First, create an IMAP server
  let imapServer = accountManager
    .createIncomingServer("nobody", "example.com", "imap")
    .QueryInterface(Components.interfaces.nsIImapIncomingServer);

  let identity = accountManager.createIdentity();
  identity.email = "tinderbox@example.com";

  let account = accountManager.createAccount();
  account.incomingServer = imapServer;
  account.addIdentity(identity);

  // Then test that the archive options button is enabled/disabled appropriately

  // Let the default identity archive to our IMAP folder, to ensure that the
  // archive folder's server is used to determine the enabled/disabled state
  // of the "archive options" button, *not* the incoming server for that
  // identity.
  defaultIdentity.archiveFolder = imapServer.rootFolder.URI;

  imapServer.isGMailServer = false;
  open_advanced_settings(function(amc) {
    subtest_check_archive_options_enabled(amc, 1, true);
  });
  open_advanced_settings(function(amc) {
    subtest_check_archive_options_enabled(amc, 0, true);
  });

  imapServer.isGMailServer = true;
  open_advanced_settings(function(amc) {
    subtest_check_archive_options_enabled(amc, 1, false);
  });
  open_advanced_settings(function(amc) {
    subtest_check_archive_options_enabled(amc, 0, false);
  });
}

function subtest_initial_state(identity) {
  plan_for_modal_dialog("archive-options", function(ac) {
    assert_equals(ac.e("archiveGranularity").selectedIndex,
                  identity.archiveGranularity);
    assert_equals(ac.e("archiveKeepFolderStructure").checked,
                  identity.archiveKeepFolderStructure);
  });
  mc.window.openDialog("chrome://messenger/content/am-archiveoptions.xul",
                       "", "centerscreen,chrome,modal,titlebar,resizable=yes",
                       identity);
  wait_for_modal_dialog("archive-options");
}

function test_open_archive_options() {
  let accountManager = Components.classes["@mozilla.org/messenger/account-manager;1"]
                                 .getService(Components.interfaces.nsIMsgAccountManager);

  for (let granularity = 0; granularity < 3; granularity++) {
    defaultIdentity.archiveGranularity = granularity;
    for (let kfs = 0; kfs < 2; kfs++) {
      defaultIdentity.archiveKeepFolderStructure = kfs;
      subtest_initial_state(defaultIdentity);
    }
  }
}

function subtest_save_state(identity, granularity, kfs) {
  plan_for_modal_dialog("archive-options", function(ac) {
    ac.e("archiveGranularity").selectedIndex = granularity;
    ac.e("archiveKeepFolderStructure").checked = kfs;
    ac.keypress(null, "VK_RETURN", {});
  });
  mc.window.openDialog("chrome://messenger/content/am-archiveoptions.xul",
                       "", "centerscreen,chrome,modal,titlebar,resizable=yes",
                       identity);
  wait_for_modal_dialog("archive-options");
}

function test_save_archive_options() {
  defaultIdentity.archiveGranularity = 0;
  defaultIdentity.archiveKeepFolderStructure = false;
  subtest_save_state(defaultIdentity, 1, true);

  assert_equals(defaultIdentity.archiveGranularity, 1);
  assert_equals(defaultIdentity.archiveKeepFolderStructure, true);
}

function subtest_check_archive_enabled(amc, archiveEnabled) {
  defaultIdentity.archiveEnabled = archiveEnabled;

  click_account_tree_row(amc, 2);

  let iframe = amc.window.document.getElementById("contentFrame");
  let checkbox = iframe.contentDocument.getElementById("identity.archiveEnabled");

  assert_equals(checkbox.checked, archiveEnabled);
}

function test_archive_enabled() {
  open_advanced_settings(function(amc) {
    subtest_check_archive_enabled(amc, true);
  });

  open_advanced_settings(function(amc) {
    subtest_check_archive_enabled(amc, false);
  });
}

function subtest_disable_archive(amc) {
  defaultIdentity.archiveEnabled = true;
  click_account_tree_row(amc, 2);

  let iframe = amc.window.document.getElementById("contentFrame");
  let checkbox = iframe.contentDocument.getElementById("identity.archiveEnabled");

  amc.click(new elib.Elem(checkbox));
  amc.window.document.getElementById("accountManager").acceptDialog();

  assert_equals(defaultIdentity.archiveEnabled, false);
}

function test_disable_archive() {
  open_advanced_settings(subtest_disable_archive);
}
