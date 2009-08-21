/**
 * Test whether javascript in a local message works.
 *
 * @note This assumes an existing local account, and will cause the Trash
 * folder of that account to be emptied multiple times.
 */

//
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
 * Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2001
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Dan Mosedale <dmose@mozilla.org>
 *   Joey Minta <jminta@gmail.com>
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
