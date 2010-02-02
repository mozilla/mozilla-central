/**
 * Checks various remote content policy workings, including:
 *
 * - Images
 * - Video
 *
 * In:
 *
 * - Messages
 * - Reply email compose window
 * - Forward email compose window
 * - Content tab
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

var MODULE_NAME = 'test-general-content-policy';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'compose-helpers'];
var jumlib = {};
Components.utils.import("resource://mozmill/modules/jum.js", jumlib);
var elib = {};
Components.utils.import('resource://mozmill/modules/elementslib.js', elib);

var folder = null;
var composeHelper = null;
var gMsgNo = 0;

// RELATIVE_ROOT messes with the collector, so we have to bring the path back
// so we get the right path for the resources.
var url = collector.addHttpResource('../content-policy/html', 'content');

/**
 * The TESTS array is constructed from objects containing the following:
 *
 * type:            The type of the test being run.
 * body:            The html to be inserted into the body of the message under
 *                  test. Note: the element under test for content
 *                  allowed/disallowed should have id 'testelement'.
 * webPage:         The web page to load during the content tab part of the
 *                  test.
 * checkForAllowed: A function that is passed the element with id 'testelement'
 *                  to check for remote content being allowed/disallowed.
 *                  This function should return true if remote content was
 *                  allowed, false otherwise.
 */
const TESTS = [
  {
    type: "Image",
    body: '<img id="testelement" src="' + url + 'pass.png"/>\n',
    webPage: "remoteimage.html",
    checkForAllowed: function img_checkAllowed(element) {
      return element.QueryInterface(Ci.nsIImageLoadingContent)
                    .imageBlockingStatus == Ci.nsIContentPolicy.ACCEPT;
    }
  },
  {
    type: "Video",
    body: '<video id="testelement" src="' + url + 'video.ogv"/>\n',
    webPage: "remotevideo.html",
    checkForAllowed: function video_checkAllowed(element) {
      return element.networkState != Ci.nsIDOMHTMLMediaElement.NETWORK_NO_SOURCE;
    }
  }
];

// These two constants are used to build the message body.
const msgBodyStart = '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">\n' +
'<html>\n' +
'<head>\n' +
'\n' +
'<meta http-equiv="content-type" content="text/html; charset=ISO-8859-1">\n' +
'</head>\n' +
'<body bgcolor="#ffffff" text="#000000">\n';

const msgBodyEnd = '</body>\n</html>\n';

var setupModule = function (module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  composeHelper = collector.getModule('compose-helpers');
  composeHelper.installInto(module);

  folder = create_folder("generalContentPolicy");
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

function addMsgToFolderAndCheckNoRemoteContent(folder, test) {
  let msgDbHdr = addToFolder(test.type + " test message " + gMsgNo,
                             msgBodyStart + test.body + msgBodyEnd, folder);

  // select the newly created message
  let msgHdr = select_click_row(gMsgNo);

  if (msgDbHdr != msgHdr)
    throw new Error("Selected Message Header is not the same as generated header");

  assert_selected_and_displayed(gMsgNo);

  // Now check that the content hasn't been loaded
  if (test.checkForAllowed(mozmill.getMail3PaneController().window.content.document
           .getElementById("testelement")))
    throw new Error(test.type + " has not been blocked in message content as expected.");

  ++gMsgNo;
}

/**
 * Check remote content in a compose window.
 *
 * @param test        The test from TESTS that is being performed.
 * @param replyType   The type of the compose window, set to true for "reply",
 *                    false for "forward".
 * @param loadAllowed Whether or not the load is expected to be allowed.
 */
function checkComposeWindow(test, replyType, loadAllowed) {
  let replyWindow = replyType ? composeHelper.open_compose_with_reply() :
                                composeHelper.open_compose_with_forward();

  if (test.checkForAllowed(
        replyWindow.window.document.getElementById("content-frame")
          .contentDocument.getElementById("testelement")) != loadAllowed)
    throw new Error(test.type + " has not been " +
                    (loadAllowed ? "allowed" : "blocked") +
                    " in reply window as expected.");

  composeHelper.close_compose_window(replyWindow);
}

function allowRemoteContentAndCheck(test) {
  addMsgToFolderAndCheckNoRemoteContent(folder, test);

  plan_for_message_display(mc);

  // Click on the allow remote content button
  mc.click(new elib.ID(mozmill.getMail3PaneController().window.document, "remoteContentBarButton"));

  wait_for_message_display_completion(mc, true);

  if (!test.checkForAllowed(
        mozmill.getMail3PaneController().window.content.document
               .getElementById("testelement")))
    throw new Error(test.type + " has been unexpectedly blocked in message content");
}

function checkContentTab(test) {
  // To open a tab we're going to have to cheat and use tabmail so we can load
  // in the data of what we want.
  let preCount = mc.tabmail.tabContainer.childNodes.length;

  let newTab = mc.tabmail.openTab("contentTab", { contentPage: url + test.webPage });

  mc.waitForEval("subject.busy == false", 5000, 100, newTab);

  if (mc.tabmail.tabContainer.childNodes.length != preCount + 1)
    throw new Error("The content tab didn't open");

  if (!test.checkForAllowed(mc.window.content.document
                              .getElementById("testelement")))
    throw new Error(test.type + " has been unexpectedly blocked in content tab");

  mc.tabmail.closeTab(newTab);

  if (mc.tabmail.tabContainer.childNodes.length != preCount)
    throw new Error("The content tab didn't close");
}

function test_generalContentPolicy() {
  let folderTab = mc.tabmail.currentTabInfo;
  be_in_folder(folder);

  assert_nothing_selected();

  for (let i = 0; i < TESTS.length; ++i) {
    // Check for denied in mail
    addMsgToFolderAndCheckNoRemoteContent(folder, TESTS[i]);

    // Check denied in reply window
    checkComposeWindow(TESTS[i], true, false);

    // Check denied in forward window
    checkComposeWindow(TESTS[i], false, false);

    // Now allow the remote content and check result
    allowRemoteContentAndCheck(TESTS[i]);

    // Check allowed in reply window
    checkComposeWindow(TESTS[i], true, true);

    // Check allowed in forward window
    checkComposeWindow(TESTS[i], false, true);

    // Check allowed in content tab
    checkContentTab(TESTS[i]);
  }
}
