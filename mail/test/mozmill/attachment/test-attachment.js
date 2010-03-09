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
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jie Zhang <jzhang918@gmail.com>
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
 * Checks various attachments display correctly
 */

var MODULE_NAME = 'test-attachment';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'compose-helpers'];
var jumlib = {};
Components.utils.import("resource://mozmill/modules/jum.js", jumlib);
var elib = {};
Components.utils.import('resource://mozmill/modules/elementslib.js', elib);

var folder = null;
var composeHelper = null;
var gMsgNo = 0;

/**
 * The TESTS array is constructed from objects containing the following:
 *
 * type:            The type of the test being run.
 * attachment:      The attachment to be inserted into the body of the message
 *                  under test.
 */
const TESTS = [
  {
    type: "txt",
    attachment: 'Content-Type: text/plain; name="test.txt"\n' +
'Content-Disposition: attachment; filename="test.txt"\n' +
'Content-Transfer-Encoding: base64\n' +
'\n' +
'VGhpcyBpcyBhY3R1YWxseSBwbGFpbiB0ZXh0LgoK\n',
  },
  {
    type: "unknown",
    attachment: 'Content-Type: application/octet-stream; name="test.xxyyzz"\n' +
'Content-Disposition: attachment; filename="test.xxyyzz"\n' +
'Content-Transfer-Encoding: base64\n' +
'X-Attachment-Id: f_g6gfk9os0\n' +
'\n' +
'VGhpcyBpcyBhY3R1YWxseSBwbGFpbiB0ZXh0LgoK\n',
  }
];

var setupModule = function (module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  composeHelper = collector.getModule('compose-helpers');
  composeHelper.installInto(module);

  folder = create_folder("generalContentPolicy");
};

function addToFolder(aSubject, aAttachment, aFolder) {

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
               "Content-Type: multipart/mixed; boundary=0015174be8a60dc5b10481218b29\n" +
               "\n--0015174be8a60dc5b10481218b29\n" +
               "Content-Type: text/plain; charset=ISO-8859-1\n" +
               "\n" +
               "\n" +
               "\n" +
               "--0015174be8a60dc5b10481218b29\n" +
               aAttachment +
               "--0015174be8a60dc5b10481218b29--"

  aFolder.QueryInterface(Components.interfaces.nsIMsgLocalMailFolder);
  aFolder.gettingNewMessages = true;

  aFolder.addMessage(source);
  aFolder.gettingNewMessages = false;

  return aFolder.msgDatabase.getMsgHdrForMessageID(msgId);
}

function addMsgToFolderAndCheckAttachment(folder, test) {
  let msgDbHdr = addToFolder(test.type + "attachment test message " + gMsgNo,
                             test.attachment, folder);

  // select the newly created message
  let msgHdr = select_click_row(gMsgNo);

  if (msgDbHdr != msgHdr)
    throw new Error("Selected Message Header is not the same as generated header");

  assert_selected_and_displayed(gMsgNo);
  if (mc.eid("attachmentView").node.collapsed)
    throw new Error("attachment with `" + test.type + "' extension file name has no attachment");

  ++gMsgNo;
}

function test_attachment() {
  let folderTab = mc.tabmail.currentTabInfo;
  be_in_folder(folder);

  assert_nothing_selected();

  for (let i = 0; i < TESTS.length; ++i) {
    // Check for attachment in mail
    addMsgToFolderAndCheckAttachment(folder, TESTS[i]);
  }
}
