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
};

function teardownModule(module) {
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
 * With only a POP3 account, no News related address types should be enabled.
 */
function check_mail_address_types() {
  check_address_types_state(["addr_to", "addr_cc", "addr_reply", "addr_bcc"]);
}

/**
 * With a NNTP account, all address types should be enabled.
 */
function check_nntp_address_types() {
  check_address_types_state(["addr_to", "addr_cc", "addr_reply", "addr_bcc",
                             "addr_newsgroups", "addr_followup"]);
}

function add_NNTP_account() {
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
}

function remove_NNTP_account() {
  // Remove our NNTP account to leave the profile clean.
  MailServices.accounts.removeAccount(accountNNTP);
  // There should be only the original accounts left.
  assert_equals(MailServices.accounts.allServers.length, originalAccountCount);
}

/**
 * Bug 399446 & bug 922614
 * Test that the allowed address types depend on the account type
 * we are sending from.
 */
function test_address_types() {
  // Be sure there is no NNTP account yet.
  for (let account in fixIterator(MailServices.accounts.accounts,
                                  Components.interfaces.nsIMsgAccount)) {
    assert_not_equals(account.incomingServer.type, "nntp",
                      "There is a NNTP account existing unexpectedly");
  }

  // Open compose window on the existing POP3 account.
  be_in_folder(accountPOP3.incomingServer.rootFolder);
  cwc = open_compose_new_mail();
  check_mail_address_types();
  close_compose_window(cwc);

  add_NNTP_account();

  // From now on, we should always get all possible address types offered,
  // regardless of which account is used of composing (bug 922614).
  be_in_folder(accountNNTP.incomingServer.rootFolder);
  cwc = open_compose_new_mail();
  check_nntp_address_types();
  close_compose_window(cwc);

  // Now try the same accounts but choosing them in the From dropdown
  // inside compose window.
  be_in_folder(accountPOP3.incomingServer.rootFolder);
  cwc = open_compose_new_mail();
  check_nntp_address_types();

  let NNTPidentity = accountNNTP.defaultIdentity.key;
  cwc.click_menus_in_sequence(cwc.e("msgIdentityPopup"), [ { value: NNTPidentity } ]);
  check_nntp_address_types();

  // In a News account, choose "Newsgroup:" as the address type.
  cwc.click_menus_in_sequence(cwc.e("addressCol1#1").menupopup,
                              [ { value: "addr_newsgroups" } ]);
  check_nntp_address_types();

  // And switch back to the POP3 account.
  let POP3identity = accountPOP3.defaultIdentity.key;
  cwc.click_menus_in_sequence(cwc.e("msgIdentityPopup"), [ { value: POP3identity } ]);
  check_nntp_address_types();

  close_compose_window(cwc);

  remove_NNTP_account();

  // Now the NNTP account is lost, so we should be back to mail only addressees.
  be_in_folder(accountPOP3.incomingServer.rootFolder);
  cwc = open_compose_new_mail();
  check_mail_address_types();
  close_compose_window(cwc);
}
