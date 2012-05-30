/**
 * Test whether javascript in a local message works.
 *
 * @note This assumes an existing local account, and will cause the Trash
 * folder of that account to be emptied multiple times.
 */

//
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var MODULE_NAME = 'test-js-content-policy';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers'];

var folder = null;

var setupModule = function (module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);

  folder = create_folder("jsContentPolicy");
};

function addToFolder(aSubject, aBody, aFolder) {

  let msgId = Components.classes["@mozilla.org/uuid-generator;1"]
                          .getService(Components.interfaces.nsIUUIDGenerator)
                          .generateUUID() +"@mozillamessaging.invalid";

  let source = "From - Sat Nov  1 12:39:54 2008\n" +
               "X-Mozilla-Status: 0001\n" +
               "X-Mozilla-Status2: 00000000\n" +
               "Message-ID: <" + msgId + ">\n" +
               "Date: Wed, 11 Jun 2008 20:32:02 -0400\n" +
               "From: Tester <tests@mozillamessaging.invalid>\n" +
               "User-Agent: Thunderbird 3.0a2pre (Macintosh/2008052122)\n" +
               "MIME-Version: 1.0\n" +
               "To: recipient@mozillamessaging.invalid\n" +
               "Subject: " + aSubject + "\n" +
               "Content-Type: text/html; charset=ISO-8859-1\n" +
               "Content-Transfer-Encoding: 7bit\n" +
               "\n" + aBody + "\n";

  aFolder.QueryInterface(Components.interfaces.nsIMsgLocalMailFolder);
  aFolder.gettingNewMessages = true;

  aFolder.addMessage(source);
  aFolder.gettingNewMessages = false;

  return aFolder.msgDatabase.getMsgHdrForMessageID(msgId);
}

const jsMsgBody = '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">\n' +
'<html>\n' +
'<head>\n' +
'\n' +
'<meta http-equiv="content-type" content="text/html; charset=ISO-8859-1">\n' +
'</head>\n' +
'<body bgcolor="#ffffff" text="#000000">\n' +
'this is a test<big><big><big> stuff\n' +
'<br><br>\n' +
'</big></big></big>\n' +
'<script language="javascript"/>\n'+
'var jsIsTurnedOn = true;\n' +
'</script>\n' +
'\n' +
'</body>\n' +
'</html>\n';

let gMsgNo = 0;

function checkJsInMail() {
  let msgDbHdr = addToFolder("JS test message " + gMsgNo, jsMsgBody, folder);

  // select the newly created message
  let msgHdr = select_click_row(gMsgNo);

  if (msgDbHdr != msgHdr)
    throw new Error("Selected Message Header is not the same as generated header");

  assert_selected_and_displayed(gMsgNo);

  // This works because messagepane is type=content-primary in these tests.
  if (typeof mozmill.getMail3PaneController().window.content.wrappedJSObject.jsIsTurnedOn != 'undefined')
    throw new Error("JS is turned on in mail - it shouldn't be.");

  ++gMsgNo;
}

function checkJsInNonMessageContent() {
  // Deselect everything so we can load our content
  select_none();

  // load something non-message-like in the message pane
  mozmill.getMail3PaneController().window.GetMessagePaneFrame().location.href =
    "data:text/html;charset=utf-8,<script>var jsIsTurnedOn%3Dtrue%3B<%2Fscript>bar";

  wait_for_message_display_completion();

  if (!mozmill.getMail3PaneController().window.content.wrappedJSObject.jsIsTurnedOn)
    throw new Error("JS is not turned on in content - it should be.");
}

function test_jsContentPolicy() {
  let folderTab = mc.tabmail.currentTabInfo;
  be_in_folder(folder);

  assert_nothing_selected();

  // run each test twice to ensure that there aren't any weird side effects,
  // given that these loads all happen in the same docshell
  checkJsInMail();
  checkJsInNonMessageContent();

  checkJsInMail();
  checkJsInNonMessageContent();
}
