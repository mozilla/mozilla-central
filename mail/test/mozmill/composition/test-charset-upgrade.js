/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests that we do the right thing wrt. message encoding, especially when
 * all characters doesn't fit the selected charset.
 */

// make SOLO_TEST=composition/test-charset-upgrade.js mozmill-one

const MODULE_NAME = "test-charset-upgrade";

const RELATIVE_ROOT = "../shared-modules";
const MODULE_REQUIRES = ["folder-display-helpers", "window-helpers", "compose-helpers"];

var os = {};
Cu.import("resource://mozmill/stdlib/os.js", os);
Cu.import('resource://gre/modules/Services.jsm');
Cu.import("resource:///modules/mailServices.js");
var elib = {};
Cu.import("resource://mozmill/modules/elementslib.js", elib);

var draftsFolder;
var outboxFolder;

function setupModule(module) {
  for (let req of MODULE_REQUIRES) {
    collector.getModule(req).installInto(module);
  }
  if (!MailServices.accounts
                   .localFoldersServer
                   .rootFolder
                   .containsChildNamed("Drafts")) {
     create_folder("Drafts", [Ci.nsMsgFolderFlags.Drafts]);
  }
  draftsFolder = MailServices.accounts
                             .localFoldersServer
                             .rootFolder
                             .getChildNamed("Drafts");
  if (!draftsFolder)
    throw new Error("draftsFolder not found");

  if (!MailServices.accounts
                   .localFoldersServer
                   .rootFolder
                   .containsChildNamed("Outbox")) {
     create_folder("Outbox", [Ci.nsMsgFolderFlags.Outbox]);
  }
  outboxFolder = MailServices.accounts
                             .localFoldersServer
                             .rootFolder
                             .getChildNamed("Outbox");
  if (!outboxFolder)
    throw new Error("outboxFolder not found");
}

/**
 * Helper to get the full message content.
 *
 * @param aMsgHdr: nsIMsgDBHdr object whose text body will be read
 * @return string with full message source
 */
function getMsgSource(aMsgHdr) {
  let msgFolder = aMsgHdr.folder;
  let msgUri = msgFolder.getUriForMsg(aMsgHdr);

  let messenger = Cc["@mozilla.org/messenger;1"]
                    .createInstance(Ci.nsIMessenger);
  let streamListener = Cc["@mozilla.org/network/sync-stream-listener;1"]
                         .createInstance(Ci.nsISyncStreamListener);
  messenger.messageServiceFromURI(msgUri).streamMessage(msgUri,
                                                        streamListener,
                                                        null,
                                                        null,
                                                        false,
                                                        "",
                                                        false);
  let sis = Cc["@mozilla.org/scriptableinputstream;1"]
              .createInstance(Ci.nsIScriptableInputStream);
  sis.init(streamListener.inputStream);
  const MAX_MESSAGE_LENGTH = 65536;
  let content = sis.read(MAX_MESSAGE_LENGTH);

  return Cc["@mozilla.org/intl/utf8converterservice;1"]
           .getService(Ci.nsIUTF8ConverterService)
           .convertURISpecToUTF8(content, "UTF-8");
}

/**
 * Test that if all characters don't fit the current charset selection,
 * we upgrade properly to UTF-8. In HTML composition.
 */
function test_encoding_upgrade_html_compose() {
  let compWin = open_compose_new_mail();

  compWin.type(null, "someone@example.com");
  compWin.type(compWin.eid("msgSubject"), "encoding upgrade test - html mode")
  compWin.type(compWin.eid("content-frame"), "so far, this is latin1\n");

  // Ctrl+S = save as draft.
  compWin.keypress(null, "s", {shiftKey: false, accelKey: true});

  be_in_folder(draftsFolder);
  let draftMsg = select_click_row(0);

  // Charset should still be the default.
  assert_equals(draftMsg.Charset, "ISO-8859-1");

  let draftMsgContent = getMsgSource(draftMsg);
  if (!draftMsgContent.contains('content="text/html; charset=ISO-8859-1"'))
    throw new Error("Expected content type not in msg; draftMsgContent=" +
                    draftMsgContent);

  const CHINESE = "漢皇重色思傾國漢皇重色思傾國";
  compWin.type(compWin.eid("content-frame"),
    "but now, we enter some chinese: " + CHINESE +"\n");

  // Ctrl+U = Underline (so we can check multipart/alternative gets right,
  // without it html->plaintext conversion will it as send plain text only)
  compWin.keypress(null, "U", {shiftKey: false, accelKey: true});

  compWin.type(compWin.eid("content-frame"),
    "content need to be upgraded to utf-8 now.");

  // Ctrl+S = save as draft.
  compWin.keypress(null, "s", {shiftKey: false, accelKey: true});

  be_in_folder(draftsFolder);
  let draftMsg2 = select_click_row(0);
  // Charset should have be upgraded to UTF-8.
  assert_equals(draftMsg2.Charset, "UTF-8");

  let draftMsg2Content = getMsgSource(draftMsg2);
  if (!draftMsg2Content.contains('content="text/html; charset=UTF-8"'))
    throw new Error("Expected content type not in msg; draftMsg2Content=" +
                    draftMsg2Content);

  if (!draftMsg2Content.contains(CHINESE))
    throw new Error("Chinese text not in msg; CHINESE=" + CHINESE +
                    ", draftMsg2Content=" + draftMsg2Content);

  // Ctrl+Shift+Return = Send Later
  compWin.keypress(null, "VK_RETURN", {shiftKey: true, accelKey: true});

  be_in_folder(outboxFolder);
  let outMsg = select_click_row(0);
  let outMsgContent = getMsgSource(outMsg);

  // This message should be multipart/alternative.
  if (!outMsgContent.contains("Content-Type: multipart/alternative"))
    throw new Error("Expected multipart/alternative; content=" + outMsgContent);

  let chinesePlainIdx = outMsgContent.indexOf(CHINESE);
  assert_true(chinesePlainIdx > 0, "chinesePlainIdx=" + chinesePlainIdx +
                                   ", outMsgContent=" + outMsgContent);

  let chineseHTMLIdx = outMsgContent.indexOf(CHINESE, chinesePlainIdx);
  assert_true(chineseHTMLIdx > 0, "chineseHTMLIdx=" + chineseHTMLIdx +
                                  ", outMsgContent=" + outMsgContent);

  // Make sure the actual html also got the content type set correctly.
  if (!outMsgContent.contains('content="text/html; charset=UTF-8"'))
    throw new Error("Expected content type not in html; outMsgContent=" +
                    outMsgContent);

  press_delete(); // Delete the msg from Outbox.
}

/**
 * Test that if all characters don't fit the current charset selection,
 * we upgrade properly to UTF-8. In plaintext composition.
 */
function test_encoding_upgrade_plaintext_compose() {
  Services.prefs.setBoolPref("mail.identity.default.compose_html", false);
  let compWin = open_compose_new_mail();
  Services.prefs.setBoolPref("mail.identity.default.compose_html", true);

  compWin.type(null, "someone-else@example.com");
  compWin.type(compWin.eid("msgSubject"), "encoding upgrade test - plaintext");
  compWin.type(compWin.eid("content-frame"), "this is plaintext latin1\n");

  // Ctrl+S = Save as Draft.
  compWin.keypress(null, "s", {shiftKey: false, accelKey: true});

  be_in_folder(draftsFolder);
  let draftMsg = select_click_row(0);

  // Charset should still be the default.
  assert_equals(draftMsg.Charset, "ISO-8859-1");

  const CHINESE = "漢皇重色思傾國漢皇重色思傾國";
  compWin.type(compWin.eid("content-frame"),
    "enter some plain text chinese: " + CHINESE +"\n");

  compWin.type(compWin.eid("content-frame"),
    "content need to be upgraded to utf-8 now.");

  // Ctrl+S = Save as Draft.
  compWin.keypress(null, "s", {shiftKey: false, accelKey: true});

  be_in_folder(draftsFolder);
  let draftMsg2 = select_click_row(0);
  // Charset should have be upgraded to UTF-8.
  assert_equals(draftMsg2.Charset, "UTF-8");

  let draftMsg2Content = getMsgSource(draftMsg2);
  if (draftMsg2Content.contains("<html>"))
    throw new Error("Plaintext draft contained <html>; "+
                    "draftMsg2Content=" + draftMsg2Content);

  if (!draftMsg2Content.contains(CHINESE))
    throw new Error("Chinese text not in msg; CHINESE=" + CHINESE +
                    ", draftMsg2Content=" + draftMsg2Content);

  // Ctrl+Shift+Return = Send Later.
  compWin.keypress(null, "VK_RETURN", {shiftKey: true, accelKey: true});

  be_in_folder(outboxFolder);
  let outMsg = select_click_row(0);
  let outMsgContent = getMsgSource(outMsg);

  // This message should be text/plain;
  if (!outMsgContent.contains("Content-Type: text/plain"))
    throw new Error("Expected text/plain; content=" + outMsgContent);

  if (!outMsgContent.contains(CHINESE))
    throw new Error("Chinese text not in msg; CHINESE=" + CHINESE +
                    ", outMsgContent=" + outMsgContent);

  press_delete(); // Delete the msg from Outbox.
}


