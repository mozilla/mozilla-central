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
 * Magnus Melin <mkmelin+mozilla@iki.fi>
 * Portions created by the Initial Developer are Copyright (C) 2012
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
 * Tests that actions such as replying to an .eml works properly.
 */

// make SOLO_TEST=composition/test-eml-actions.js mozmill-one

const MODULE_NAME = "test-reply-to-eml";

const RELATIVE_ROOT = "../shared-modules";
const MODULE_REQUIRES = ["folder-display-helpers", "window-helpers", "compose-helpers"];

Cu.import("resource:///modules/mailServices.js");
var elib = {};
Cu.import("resource://mozmill/modules/elementslib.js", elib);

var composeHelper;

var setupModule = function(module) {
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);
  let wh = collector.getModule("window-helpers");
  wh.installInto(module);
  composeHelper = collector.getModule("compose-helpers");
  composeHelper.installInto(module);
}

/**
 * Test that replying to an opened .eml message works, and that the reply can
 * be saved as a draft.
 */
function test_reply_to_eml_save_as_draft() {
  // Open an .eml file.
  let file = os.getFileForPath(os.abspath("./testmsg.eml", os.getFileForPath(__file__)));
  let msgc = open_message_from_file(file);

  let replyWin = composeHelper.open_compose_with_reply(msgc);

  // Ctrl+S saves as draft.
  replyWin.keypress(null, "s", {shiftKey: false, accelKey: true});

  let acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                  .getService(Ci.nsIMsgAccountManager);
  let draftsFolder = acctMgr.localFoldersServer.rootFolder.getChildNamed("Drafts");

  be_in_folder(draftsFolder);
  let draftMsg = select_click_row(0);
  if (!draftMsg)
    throw new Error("No draft saved!");
  press_delete(); // Delete the draft.

  close_compose_window(replyWin); // close compose window
  close_window(msgc); // close base .eml message
}

/**
 * Test that forwarding an opened .eml message works, and that the forward can
 * be saved as a draft.
 */
function test_forward_eml_save_as_draft() {
  // Open an .eml file.
  let file = os.getFileForPath(os.abspath("./testmsg.eml", os.getFileForPath(__file__)));
  let msgc = open_message_from_file(file);

  let replyWin = composeHelper.open_compose_with_forward(msgc);

  // Ctrl+S saves as draft.
  replyWin.keypress(null, "s", {shiftKey: false, accelKey: true});

  let acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                  .getService(Ci.nsIMsgAccountManager);
  let draftsFolder = acctMgr.localFoldersServer.rootFolder.getChildNamed("Drafts");

  be_in_folder(draftsFolder);
  let draftMsg = select_click_row(0);
  if (!draftMsg)
    throw new Error("No draft saved!");
  press_delete(); // Delete the draft.

  close_compose_window(replyWin); // close compose window
  close_window(msgc); // close base .eml message
}

/**
 * Test that MIME encoded subject is decoded when replying to an opened .eml.
 */
function test_reply_eml_subject() {
  // Open an .eml file.
  let file = os.getFileForPath(os.abspath("./mime-encoded-subject.eml", os.getFileForPath(__file__)));
  let msgc = open_message_from_file(file);

  let replyWin = composeHelper.open_compose_with_reply(msgc);

  assert_equals(replyWin.e("msgSubject").value, "Re: \u2200a\u220aA");
  close_compose_window(replyWin); // close compose window
  close_window(msgc); // close base .eml message
}
