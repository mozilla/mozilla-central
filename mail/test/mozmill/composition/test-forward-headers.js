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
 * The Original Code is Thunderbird Mail Client code.
 *
 * The Initial Developer of the Original Code is
 * Jonathan Protzenko <jonathan.protzenko@gmail.com>
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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
 * Tests that the attachment reminder works properly.
 */

const MODULE_NAME = "test-forward-headers";

const RELATIVE_ROOT = "../shared-modules";
const MODULE_REQUIRES = ["folder-display-helpers", "compose-helpers", "window-helpers"];
var jumlib = {};
Components.utils.import("resource://mozmill/modules/jum.js", jumlib);
var elib = {};
Components.utils.import("resource://mozmill/modules/elementslib.js", elib);

var composeHelper = null;
var windowHelper;
var cwc = null; // compose window controller
var folder;

var setupModule = function (module) {
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);
  composeHelper = collector.getModule("compose-helpers");
  composeHelper.installInto(module);

  windowHelper = collector.getModule('window-helpers');

  let wh = collector.getModule("window-helpers");
  wh.installInto(module);

  folder = create_folder("Test");
  thread1 = create_thread(10);
  add_sets_to_folders([folder], [thread1]);
};

function forward_selected_messages_and_go_to_drafts_folder(f) {
  // opening a new compose window
  cwc = f(mc);
  cwc.type(cwc.eid("content-frame"), "Hey check out this megalol link");

  plan_for_window_close(cwc);
  // mwc is modal window controller
  windowHelper.plan_for_modal_dialog("commonDialog", function click_save (mwc) {
      //accept saving
      mwc.window.document.documentElement.getButton('accept').doCommand();
    });

  // quit -> do you want to save ?
  cwc.keypress(null, "w", {shiftKey: false, accelKey: true});
  // wait for the modal dialog to return
  windowHelper.wait_for_modal_dialog();
  // actually quite the window
  wait_for_window_close();

  let acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                  .getService(Ci.nsIMsgAccountManager);
  let draftsFolder = acctMgr.localFoldersServer.rootFolder.getChildNamed("Drafts");
  be_in_folder(draftsFolder);
}

function test_forward_inline () {
  be_in_folder(folder);
  // original message header
  let oMsgHdr = select_click_row(0);

  forward_selected_messages_and_go_to_drafts_folder(open_compose_with_forward);

  // forwarded message header
  let fMsgHdr = select_click_row(0);

  assert_equals(fMsgHdr.getStringReference(0), oMsgHdr.messageId,
    "The forwarded message should have References: = Message-Id: of the original msg");

  // test for x-forwarded-message id and exercise the js mime representation as
  // well
  let done = {};
  mc.window.MsgHdrToMimeMessage(fMsgHdr, function(aMsgHdr, aMimeMsg) {
    assert_equals(aMimeMsg.headers["x-forwarded-message-id"],
      "<"+oMsgHdr.messageId+">");
    assert_equals(aMimeMsg.headers["references"],
      "<"+oMsgHdr.messageId+">");
    done.value = true;
  });
  mc.waitForEval("subject.value==true", 30000, 100, done);

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

  assert_equals(fMsgHdr.getStringReference(1), oMsgHdr1.messageId,
    "The forwarded message should have References: = Message-Id: of the original msg#1");
  assert_equals(fMsgHdr.getStringReference(0), oMsgHdr0.messageId,
    "The forwarded message should have References: = Message-Id: of the original msg#0");

  // test for x-forwarded-message id and exercise the js mime representation as
  // well
  let done = {};
  mc.window.MsgHdrToMimeMessage(fMsgHdr, function(aMsgHdr, aMimeMsg) {
    assert_equals(aMimeMsg.headers["x-forwarded-message-id"],
      "<"+oMsgHdr0.messageId+"> <"+oMsgHdr1.messageId+">");
    assert_equals(aMimeMsg.headers["references"],
      "<"+oMsgHdr0.messageId+"> <"+oMsgHdr1.messageId+">");
    done.value = true;
  });
  mc.waitForEval("subject.value==true", 30000, 100, done);

  press_delete(mc);
}
