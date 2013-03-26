/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests that actions such as replying choses the most suitable identity.
 */

const MODULE_NAME = "test-reply-identity";

const RELATIVE_ROOT = "../shared-modules";
const MODULE_REQUIRES = ["folder-display-helpers",
                         "window-helpers", "compose-helpers"];

var folderHelper = null;
var windowindowHelperelper = null;
var composeHelper = null;

var testFolder = null;

const identity1Email = "carl@example.com";
const identity2Email = "lenny@springfield.invalid";

var setupModule = function (module) {

  folderHelper = collector.getModule("folder-display-helpers");
  folderHelper.installInto(module);
  windowHelper = collector.getModule("window-helpers");
  windowHelper.installInto(module);
  composeHelper = collector.getModule("compose-helpers");
  composeHelper.installInto(module);

  addIdentitiesAndFolder();
  add_message_to_folder(testFolder, create_message({
    from: "Homer <homer@example.com>",
    to: "workers@springfield.invalid",
    subject: "no matching identity, like bcc/list",
    body: {body: "Alcohol is a way of life, alcohol is my way of life, and I aim to keep it."},
    clobberHeaders: {
    }
  }));
  add_message_to_folder(testFolder, create_message({
    from: "Homer <homer@example.com>",
    to: "powerplant-workers@springfield.invalid",
    subject: "only delivered-to header matching identity",
    body: {body: "Just because I don't care doesn't mean I don't understand."},
    clobberHeaders: {
      "Delivered-To" : "<" + identity2Email + ">"
    }
  }));
  add_message_to_folder(testFolder, create_message({
    from: "Homer <homer@example.com>",
    to: "powerplant-workers@springfield.invalid, Apu <apu@test.invalid>",
    cc: "other." + identity2Email,
    subject: "subpart of cc address matching identity",
    body: {body: "Blame the guy who doesn't speak Engish."},
    clobberHeaders: {
    }
  }));
  add_message_to_folder(testFolder, create_message({
    from: "Homer <homer@example.com>",
    to: "Lenny <" + identity2Email + ">",
    subject: "normal to:address match, with full name",
    body: {body: "Remember as far as anyone knows, we're a nice normal family."}
  }));
  add_message_to_folder(testFolder, create_message({
    from: ["Homer", "homer@example.com"],
    to: "powerplant-workers@springfield.invalid",
    subject: "delivered-to header matching only subpart of identity email",
    body: {body: "Mmmm...Forbidden donut"},
    clobberHeaders: {
      "Delivered-To" : "<other." + identity2Email + ">"
    }
  }));
}


var addIdentitiesAndFolder = function() {
  let server = MailServices.accounts.createIncomingServer("nobody",
                                                          "Reply Identity Testing", "pop3");
  testFolder = server.rootFolder.QueryInterface(Ci.nsIMsgLocalMailFolder)
                     .createLocalSubfolder("Replies");

  let identity = MailServices.accounts.createIdentity();
  identity.email = identity1Email;

  let identity2 = MailServices.accounts.createIdentity();
  identity2.email = identity2Email;

  let account = MailServices.accounts.createAccount();
  account.incomingServer = server;
  account.addIdentity(identity);
  account.addIdentity(identity2);
}

var checkReply = function (replyWin, expectedFromEmail) {
  let identityList = replyWin.e("msgIdentity");
  if (!identityList.selectedItem.label.contains(expectedFromEmail))
    throw new Error("The From address is not correctly selected! Expected: " +
                    expectedFromEmail + "; Actual: "  +
                    identityList.selectedItem.label);
}

function test_reply_no_matching_identity() {
  be_in_folder(testFolder);

  let msg = select_click_row(0);
  assert_selected_and_displayed(mc, msg);

  let replyWin = composeHelper.open_compose_with_reply();
  // Should have selected the default identity.
  checkReply(replyWin, identity1Email);
  close_compose_window(replyWin);
}

function test_reply_matching_only_deliveredto() {
  be_in_folder(testFolder);

  let msg = select_click_row(1);
  assert_selected_and_displayed(mc, msg);

  let replyWin = composeHelper.open_compose_with_reply();
  // Should have selected the second id, which is listed in Delivered-To:.
  checkReply(replyWin, identity2Email);
  close_compose_window(replyWin);
}

function test_reply_matching_subaddress() {
  be_in_folder(testFolder);

  let msg = select_click_row(2);
  assert_selected_and_displayed(mc, msg);

  let replyWin = composeHelper.open_compose_with_reply();
  // Should have selected the first id, the email doesn't fully match.
  // other.lenny != "our" lenny
  checkReply(replyWin, identity1Email);
  close_compose_window(replyWin);
}

function test_reply_to_matching_second_id() {
  be_in_folder(testFolder);

  let msg = select_click_row(3);
  assert_selected_and_displayed(mc, msg);

  let replyWin = composeHelper.open_compose_with_reply();
  // Should have selected the second id, which was in To;.
  checkReply(replyWin, identity2Email);
  close_compose_window(replyWin);
}

function test_deliveredto_to_matching_only_parlty() {
  be_in_folder(testFolder);

  let msg = select_click_row(4);
  assert_selected_and_displayed(mc, msg);

  let replyWin = composeHelper.open_compose_with_reply();
  // Should have selected the (default) first id.
  checkReply(replyWin, identity1Email);
  close_compose_window(replyWin);
}
