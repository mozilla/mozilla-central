/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests proper enabling of addressing widgets.
 */

const MODULE_NAME = "test-address-widgets";

const RELATIVE_ROOT = "../shared-modules";
const MODULE_REQUIRES = ["folder-display-helpers", "compose-helpers",
                         "window-helpers"];

var cwc = null; // compose window controller
var accountPOP3 = null;
var accountNNTP = null;

function setupModule(module) {
  for (let lib of MODULE_REQUIRES) {
    collector.getModule(lib).installInto(module);
  }

  // Ensure we're in the tinderbox account as that has the right identities set
  // up for this test.
  let server = MailServices.accounts.FindServer("tinderbox", "tinderbox", "pop3");
  accountPOP3 = MailServices.accounts.FindAccountForServer(server);

  // There may be pre-existing accounts from other tests.
  originalAccountCount = MailServices.accounts.allServers.length;

  // Create a NNTP server
  let nntpServer = MailServices.accounts
    .createIncomingServer(null, "example.nntp.invalid", "nntp")
    .QueryInterface(Components.interfaces.nsINntpIncomingServer);

  identity = MailServices.accounts.createIdentity();
  identity.email = "tinderbox2@example.invalid";

  accountNNTP = MailServices.accounts.createAccount();
  accountNNTP.incomingServer = nntpServer;
  accountNNTP.addIdentity(identity);
  // Now there should be 1 more account.
  assert_equals(MailServices.accounts.allServers.length, originalAccountCount + 1);
};

function teardownModule(module) {
  // Remove our test accounts to leave the profile clean.
  MailServices.accounts.removeAccount(accountNNTP);
  // There should be only the original accounts left.
  assert_equals(MailServices.accounts.allServers.length, originalAccountCount);
}

/**
 * Check if the address type items are in the wished state.
 *
 * @param aItemsEnabled  List of item values that should be enabled (uncollapsed).
 */
function check_address_types_state(aItemsEnabled) {
  let addr_types = cwc.e("addressingWidget").querySelectorAll("menuitem[value]");
  for (let item of addr_types)
    assert_true(item.collapsed == (aItemsEnabled.indexOf(item.getAttribute("value")) == -1));

  // Even if the currently selected type is collaped,
  // the containing menulist should never be collapsed.
  let addr_lists = cwc.e("addressingWidget").querySelectorAll("menulist");
  for (let list in addr_lists) {
    assert_false(list.collapsed);
    assert_false(list.disabled);
  }
}

/**
 * For a POP3 account, no News related address types should be enabled.
 */
function allowed_mail_types() {
  check_address_types_state(["addr_to", "addr_cc", "addr_reply", "addr_bcc"]);
}

/**
 * On a NNTP account, all address types should be enabled.
 */
function allowed_nntp_types() {
  check_address_types_state(["addr_to", "addr_cc", "addr_reply", "addr_bcc",
                             "addr_newsgroups", "addr_followup"]);
}

/**
 * Bug 399446
 * Test that the allowed address types depend on the account type
 * we are sending from.
 */
function test_address_types() {
  // Open compose window on each account individually.
  be_in_folder(accountPOP3.incomingServer.rootFolder);
  cwc = open_compose_new_mail();
  allowed_mail_types();
  close_compose_window(cwc);

  be_in_folder(accountNNTP.incomingServer.rootFolder);
  cwc = open_compose_new_mail();
  allowed_nntp_types();
  close_compose_window(cwc);

  // Now try the same accounts but choosing them in the From dropdown
  // inside compose window.
  be_in_folder(accountPOP3.incomingServer.rootFolder);
  cwc = open_compose_new_mail();
  allowed_mail_types();

  let NNTPidentity = accountNNTP.defaultIdentity.key;
  cwc.click_menus_in_sequence(cwc.e("msgIdentityPopup"), [ { value: NNTPidentity } ]);
  allowed_nntp_types();

  // In a News account, choose "Newsgroup:" as the address type.
  cwc.click_menus_in_sequence(cwc.e("addressCol1#1").menupopup,
                              [ { value: "addr_newsgroups" } ]);
  allowed_nntp_types();

  // And switch back to the POP3 account.
  let POP3identity = accountPOP3.defaultIdentity.key;
  cwc.click_menus_in_sequence(cwc.e("msgIdentityPopup"), [ { value: POP3identity } ]);
  allowed_mail_types();

  close_compose_window(cwc);
}
