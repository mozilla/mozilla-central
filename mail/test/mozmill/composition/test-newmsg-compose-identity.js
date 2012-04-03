/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests that compose new message chooses the correct initial identity when
 * called from the context of an open composer.
 */

const MODULE_NAME = "test-newmsg-compose-identity";

const RELATIVE_ROOT = "../shared-modules";
const MODULE_REQUIRES = ["folder-display-helpers",
                         "window-helpers", "compose-helpers"];

var account;

const identity1Email = "x@example.com";
const identity2Email = "y@example.com";

Components.utils.import("resource:///modules/mailServices.js");

function setupModule(module) {
  collector.getModule("folder-display-helpers").installInto(module);
  collector.getModule("window-helpers").installInto(module);
  collector.getModule("compose-helpers").installInto(module);

  // Now set up an account with some identities.
  let acctMgr = MailServices.accounts;
  account = acctMgr.createAccount();
  account.incomingServer = acctMgr.createIncomingServer(
    "nobody", "New Msg Compose Identity Testing", "pop3");

  let identity1 = acctMgr.createIdentity();
  identity1.email = identity1Email;
  account.addIdentity(identity1);

  let identity2 = acctMgr.createIdentity();
  identity2.email = identity2Email;
  account.addIdentity(identity2);
}

/**
 * Helper to check that a suitable From identity was set up in the given
 * composer window.
 */
function checkCompIdentity(composeWin, expectedFromEmail) {
  let identityList = composeWin.e("msgIdentity");
  assert_equals(identityList.selectedItem.label, " <" + expectedFromEmail + ">",
                "The From address is not correctly selected");
}

/**
 * Test that starting a new message from an open compose window gets the
 * expected initial identity.
 */
function test_compose_from_composer() {
  be_in_folder(account.incomingServer
                      .rootFolder
                      .getFolderWithFlags(Ci.nsMsgFolderFlags.Inbox));

  let mainCompWin = open_compose_new_mail();
  checkCompIdentity(mainCompWin, account.defaultIdentity.email);

  // Compose a new message from the compose window.
  plan_for_new_window("msgcompose");
  mainCompWin.keypress(null, "n", {shiftKey: false, accelKey: true});
  let newCompWin = wait_for_compose_window();
  checkCompIdentity(newCompWin, account.defaultIdentity.email);
  close_compose_window(newCompWin);

  // Switch to identity2 in the main compose window, new compose windows
  // starting from here should use the same identiy as it's "parent".
  let identityList = mainCompWin.e("msgIdentity");
  identityList.selectedIndex++;
  checkCompIdentity(mainCompWin, identity2Email);
  
  // Compose a second new message from the compose window.
  plan_for_new_window("msgcompose");
  mainCompWin.keypress(null, "n", {shiftKey: false, accelKey: true});
  let newCompWin2 = wait_for_compose_window();
  checkCompIdentity(newCompWin2, identity2Email);
  close_compose_window(newCompWin2);

  close_compose_window(mainCompWin);
}

