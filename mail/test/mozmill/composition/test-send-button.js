/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests proper enabling of send buttons depending on addresses input.
 */

const MODULE_NAME = "test-send-button";

const RELATIVE_ROOT = "../shared-modules";
const MODULE_REQUIRES = ["folder-display-helpers", "compose-helpers",
                         "window-helpers", "address-book-helpers"];

let elib = {};
Components.utils.import("resource://mozmill/modules/elementslib.js", elib);

var account = null;

var setupModule = function (module) {
  collector.getModule("folder-display-helpers").installInto(module);
  collector.getModule("compose-helpers").installInto(module);
  collector.getModule("window-helpers").installInto(module);
  collector.getModule("address-book-helpers").installInto(module);

  // Ensure we're in the tinderbox account as that has the right identities set
  // up for this test.
  let server = MailServices.accounts.FindServer("tinderbox", "tinderbox", "pop3");
  account = MailServices.accounts.FindAccountForServer(server);
  let inbox = server.rootFolder.getChildNamed("Inbox");
  be_in_folder(inbox);
};

function setupComposeWin(aCwc, aAddr, aSubj, aBody) {
  aCwc.type(null, aAddr);
  aCwc.type(aCwc.eid("msgSubject"), aSubj);
  aCwc.type(aCwc.eid("content-frame"), aBody);
}

/**
 * Check if the send commands are in the wished state.
 *
 * @param aCwc      The compose window controller.
 * @param aEnabled  The expected state of the commands.
 */
function check_send_commands_state(aCwc, aEnabled) {
  assert_equals(aCwc.e("cmd_sendButton").hasAttribute("disabled"), !aEnabled);
  assert_equals(aCwc.e("cmd_sendNow").hasAttribute("disabled"), !aEnabled);
  assert_equals(aCwc.e("cmd_sendWithCheck").hasAttribute("disabled"), !aEnabled);
  assert_equals(aCwc.e("cmd_sendLater").hasAttribute("disabled"), !aEnabled);

  // The toolbar buttons and menuitems should be linked to these commands
  // thus inheriting the enabled state. Check that on the Send button
  // and Send Now menuitem.
  assert_equals(aCwc.e("button-send").getAttribute("command"), "cmd_sendButton");
  assert_equals(aCwc.e("menu-item-send-now").getAttribute("command"), "cmd_sendNow");
}

/**
 * Bug 431217
 * Test that the Send buttons are properly enabled if an addressee is input
 * by the user.
 */
function test_send_enabled_manual_address() {
  let cwc = open_compose_new_mail(); // compose controller
  // On an empty window, Send must be disabled.
  check_send_commands_state(cwc, false);

  // On any (even invalid) "To:" addressee input, Send must be enabled.
  setupComposeWin(cwc, "recipient", "", "");
  check_send_commands_state(cwc, true);

  // When the addressee is not in To, Cc, Bcc or Newsgroup, disable Send again.
  let addrType = cwc.e("addressCol1#1");
  cwc.click_menus_in_sequence(addrType.menupopup, [ {value: "addr_reply"} ]);
  check_send_commands_state(cwc, false);

  close_compose_window(cwc);
}

/**
 * Bug 431217
 * Test that the Send buttons are properly enabled if an addressee is prefilled
 * automatically via account prefs.
 */
function test_send_enabled_prefilled_address() {
  // Set the prefs to prefill a default CC address when Compose is opened.
  let identity = account.defaultIdentity;
  let identityBranch = Services.prefs.getBranch("mail.identity." + identity.key + ".");
  identityBranch.setBoolPref("doCc", true);
  identityBranch.setCharPref("doCcList", "Auto recipient");
  // In that case the recipient is input, enabled Send.
  let cwc = open_compose_new_mail(); // compose controller
  check_send_commands_state(cwc, true);

  // Press backspace to remove the recipient. No other valid one is there,
  // disable Send.
  cwc.e("addressCol2#1").select();
  cwc.keypress(null, "VK_BACK_SPACE", {});
  check_send_commands_state(cwc, false);

  close_compose_window(cwc);
  identityBranch.clearUserPref("doCc");
  identityBranch.clearUserPref("doCcList");
}

/**
 * Bug 863231
 * Test that the Send buttons are properly enabled if an addressee is populated
 * via the Contacts sidebar.
 */
function test_send_enabled_address_contacts_sidebar() {
  // Create some contact address book card in the Personal addressbook.
  let defaultAB = MailServices.ab.getDirectory("moz-abmdbdirectory://abook.mab");
  let contact = create_contact("test@example.com", "Sammy Jenkis", true);
  load_contacts_into_address_book(defaultAB, [contact]);

  let cwc = open_compose_new_mail(); // compose controller
  // On an empty window, Send must be disabled.
  check_send_commands_state(cwc, false);

  // Open Contacts sidebar and use our contact.
  cwc.window.toggleAddressPicker();

  let sidebar = cwc.e("sidebar");
  wait_for_frame_load(sidebar,
    "chrome://messenger/content/addressbook/abContactsPanel.xul");
  let abView = sidebar.contentDocument.getElementById("abResultsTree").treeBoxObject.view;
  abView.selection.select(0);
  sidebar.contentDocument.getElementById("ccButton").click();

  // The recipient is filled in, Send must be enabled.
  check_send_commands_state(cwc, true);

  close_compose_window(cwc);
}
