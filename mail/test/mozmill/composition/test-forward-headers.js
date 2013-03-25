/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests that headers like References and X-Forwarded-Message-Id are
 * set properly when forwarding messages.
 */

const MODULE_NAME = "test-forward-headers";

const RELATIVE_ROOT = "../shared-modules";
const MODULE_REQUIRES = ["folder-display-helpers", "compose-helpers", "window-helpers",
                         "message-helpers"];
var jumlib = {};
Components.utils.import("resource://mozmill/modules/jum.js", jumlib);
var elib = {};
Components.utils.import("resource://mozmill/modules/elementslib.js", elib);

var composeHelper = null;
var cwc = null; // compose window controller
var folder;

var setupModule = function (module) {
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);
  composeHelper = collector.getModule("compose-helpers");
  composeHelper.installInto(module);
  let wh = collector.getModule("window-helpers");
  wh.installInto(module);
  let mh = collector.getModule("message-helpers");
  mh.installInto(module);

  folder = create_folder("Test");
  thread1 = create_thread(10);
  add_sets_to_folders([folder], [thread1]);
};

function forward_selected_messages_and_go_to_drafts_folder(f) {
  const kText = "Hey check out this megalol link";
  // opening a new compose window
  cwc = f(mc);
  cwc.type(cwc.eid("content-frame"), kText);

  let mailBody = get_compose_body(cwc);
  assert_previous_text(mailBody.firstChild, [kText]);

  plan_for_window_close(cwc);
  // mwc is modal window controller
  plan_for_modal_dialog("commonDialog", function click_save (mwc) {
      //accept saving
      mwc.window.document.documentElement.getButton('accept').doCommand();
    });

  // quit -> do you want to save ?
  cwc.window.goDoCommand('cmd_close');
  // wait for the modal dialog to return
  wait_for_modal_dialog();
  // actually quite the window
  wait_for_window_close();

  let draftsFolder = MailServices.accounts.localFoldersServer.rootFolder.getChildNamed("Drafts");
  be_in_folder(draftsFolder);
}

function test_forward_inline () {
  be_in_folder(folder);
  // original message header
  let oMsgHdr = select_click_row(0);

  forward_selected_messages_and_go_to_drafts_folder(open_compose_with_forward);

  // forwarded message header
  let fMsgHdr = select_click_row(0);

  assert_true(fMsgHdr.numReferences > 0, "No References Header in forwarded msg.");
  assert_equals(fMsgHdr.getStringReference(0), oMsgHdr.messageId,
    "The forwarded message should have References: = Message-Id: of the original msg");

  // test for x-forwarded-message id and exercise the js mime representation as
  // well
  to_mime_message(fMsgHdr, null, function(aMsgHdr, aMimeMsg) {
    assert_equals(aMimeMsg.headers["x-forwarded-message-id"],
      "<"+oMsgHdr.messageId+">");
    assert_equals(aMimeMsg.headers["references"],
      "<"+oMsgHdr.messageId+">");
  });
  press_delete(mc);
}

function test_forward_as_attachments () {
  be_in_folder(folder);
  // original message header
  let oMsgHdr0 = select_click_row(0);
  let oMsgHdr1 = select_click_row(1);
  select_shift_click_row(0);

  forward_selected_messages_and_go_to_drafts_folder(open_compose_with_forward_as_attachments);

  // forwarded message header
  let fMsgHdr = select_click_row(0);

  assert_true(fMsgHdr.numReferences > 0, "No References Header in forwarded msg.");
  assert_true(fMsgHdr.numReferences > 1, "Only one References Header in forwarded msg.");
  assert_equals(fMsgHdr.getStringReference(1), oMsgHdr1.messageId,
    "The forwarded message should have References: = Message-Id: of the original msg#1");
  assert_equals(fMsgHdr.getStringReference(0), oMsgHdr0.messageId,
    "The forwarded message should have References: = Message-Id: of the original msg#0");

  // test for x-forwarded-message id and exercise the js mime representation as
  // well
  to_mime_message(fMsgHdr, null, function(aMsgHdr, aMimeMsg) {
    assert_equals(aMimeMsg.headers["x-forwarded-message-id"],
      "<"+oMsgHdr0.messageId+"> <"+oMsgHdr1.messageId+">");
    assert_equals(aMimeMsg.headers["references"],
      "<"+oMsgHdr0.messageId+"> <"+oMsgHdr1.messageId+">");
  });

  press_delete(mc);
}
