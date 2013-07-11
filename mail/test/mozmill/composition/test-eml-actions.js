/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests that actions such as replying to an .eml works properly.
 */

// make SOLO_TEST=composition/test-eml-actions.js mozmill-one

const MODULE_NAME = "test-eml-actions";

const RELATIVE_ROOT = "../shared-modules";
const MODULE_REQUIRES = ["folder-display-helpers", "window-helpers", "compose-helpers"];

var os = {};
Cu.import('resource://mozmill/stdlib/os.js', os);
Cu.import("resource:///modules/mailServices.js");
var elib = {};
Cu.import("resource://mozmill/modules/elementslib.js", elib);

var setupModule = function(module) {
  collector.getModule("folder-display-helpers").installInto(module);
  collector.getModule("window-helpers").installInto(module);
  collector.getModule("compose-helpers").installInto(module);
}

/**
 * Test that replying to an opened .eml message works, and that the reply can
 * be saved as a draft.
 */
function test_reply_to_eml_save_as_draft() {
  // Open an .eml file.
  let file = os.getFileForPath(
    os.abspath("./testmsg.eml", os.getFileForPath(__file__)));
  let msgc = open_message_from_file(file);

  let replyWin = open_compose_with_reply(msgc);

  // Ctrl+S saves as draft.
  replyWin.keypress(null, "s", {shiftKey: false, accelKey: true});

  let draftsFolder = MailServices.accounts.localFoldersServer.rootFolder
                                 .getChildNamed("Drafts");

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
  let file = os.getFileForPath(
    os.abspath("./testmsg.eml", os.getFileForPath(__file__)));
  let msgc = open_message_from_file(file);

  let replyWin = open_compose_with_forward(msgc);

  // Ctrl+S saves as draft.
  replyWin.keypress(null, "s", {shiftKey: false, accelKey: true});

  let draftsFolder = MailServices.accounts.localFoldersServer.rootFolder
                                 .getChildNamed("Drafts");

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
  // Open an .eml file whose subject is encoded.
  let file = os.getFileForPath(
    os.abspath("./mime-encoded-subject.eml", os.getFileForPath(__file__)));
  let msgc = open_message_from_file(file);

  let replyWin = open_compose_with_reply(msgc);

  assert_equals(replyWin.e("msgSubject").value, "Re: \u2200a\u220aA");
  close_compose_window(replyWin); // close compose window
  close_window(msgc); // close base .eml message
}

/**
 * Test that replying to a base64 encoded .eml works.
 */
function test_reply_to_base64_eml() {
  // Open an .eml file.
  let file = os.getFileForPath(
    os.abspath("./base64-encoded-msg.eml", os.getFileForPath(__file__)));
  let msgc = open_message_from_file(file);

  let compWin = open_compose_with_reply(msgc);

  let bodyText = compWin.e("content-frame").contentDocument
                        .querySelector("body").textContent;

  const message = "You have decoded this text from base64.";
  if (!bodyText.contains(message))
    throw new Error("body text didn't contain the decoded text; message=" +
                    message + ", bodyText=" + bodyText);

  close_compose_window(compWin);
  close_window(msgc);
}

/**
 * Test that forwarding a base64 encoded .eml works.
 */
function test_forward_base64_eml() {
  // Open an .eml file.
  let file = os.getFileForPath(
    os.abspath("./base64-encoded-msg.eml", os.getFileForPath(__file__)));
  let msgc = open_message_from_file(file);

  let compWin = open_compose_with_forward(msgc);

  let bodyText = compWin.e("content-frame").contentDocument
                        .querySelector("body").textContent;

  const message = "You have decoded this text from base64.";
  if (!bodyText.contains(message))
    throw new Error("body text didn't contain the decoded text; message=" +
                    message + ", bodyText=" + bodyText);

  close_compose_window(compWin);
  close_window(msgc);
}
