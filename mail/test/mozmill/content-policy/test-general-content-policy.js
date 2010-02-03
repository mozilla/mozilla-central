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
    checkDenied: true,
    body: '<img id="testelement" src="' + url + 'pass.png"/>\n',
    webPage: "remoteimage.html",
    checkForAllowed: function img_checkAllowed(element) {
      return element.QueryInterface(Ci.nsIImageLoadingContent)
                    .imageBlockingStatus == Ci.nsIContentPolicy.ACCEPT;
    }
  },
  {
    type: "Video",
    checkDenied: true,
    body: '<video id="testelement" src="' + url + 'video.ogv"/>\n',
    webPage: "remotevideo.html",
    checkForAllowed: function video_checkAllowed(element) {
      return element.networkState != Ci.nsIDOMHTMLMediaElement.NETWORK_NO_SOURCE;
    }
  },
  {
    type: "Image-Data",
    checkDenied: false,
    body: '<img id="testelement" src="data:image/png,%89PNG%0D%0A%1A%0A%00%00%00%0DIHDR%00%00%002%00%00%00%14%08%02%00%00%00%40%A8%F9%CD%00%00%02%A3IDATH%C7%ED%96%3D%2C%2CQ%14%C7%FF3K%22H4%3Ev%13%1F%DDR%10QP%09BT%22%0A%C2F%23HhD%B2%09%A5NB%88%C4%2B%25%0A%0At%14%14%04%85%CFD%82H%14%3E%12%8A-h%84B%7Cd%AD%FD%BDb%5E%26c%F7%3D%3B%5E%A5pr%8A%B9%E7%FE%EE%B9%FF%DCs%EE%CC%18%80%BE%9F%99%FA%96%F6%23%EB%3Fd%15%A9%C8%90%E1%F4d%25g%2B%BBNu%EBZ%8FYs%AB%5B%8F%3C%86%8C%90B%F1%19%8Fu%1CP%20W%B9%C9JNRR%8Er*U%19T0%AC%B0%7B%C6%B0Z%BEHE%17%BA%18%D7%B8%24DD%91%7B%DD%1F%E8%60G%3B%A6%CC-mU%AA%D2N%3A%A9%C9%A0%82%92%C646%A8A%A7%A6%3D%ED%D5%AA%D6%23O%9B%DA%FC%F2G%14%09)t%A0%83S%9D%3E%EA1%5D%E9.%19%01%40!%85%E2%CF%B3%D3%26%98%10j%A5%D5%19%2C%A7%DC%83G%A8%8C%B2%18%BE%91F%A1%0D6b%E2W%5C%BD%F1%E6%9EI%20%EB%81%07%A1%12J%EC%C8%25%97B%DDt%7B%F1%0A%9Ds%EE%E4%8B)%16z%E5%95%7F%9B%1B%26A%CB%A7*U%92%E9%B8%19%F3%9A%97%14P%A0E-%92%16%B4%E0%E4%F3%95%2FiF3%9F%E4t%C3%248%AD%13N%9CE%8C%12%F5%E3%CF%24%F3%8D%B7m%B6%85%FC%F8%A3Dm~%8B-%AB%BE%0D4%2C%B1%F4%CCs%7CN7%CCg%B2%DEyo%A6Yh%99e%2Br%C8%A1P%0F%3D%D6%AC%0F%9F%D0%11G%CEUk%AC%15P%20%24%94FZ%3B%ED%FB%EC%C7dN%C8%7C%90u%C6%99%E5\'%9C%2C%B0PM%B5P%1F%7D%F6y%04%09%0A%AD%B3n%0D%FB%E9%17%1Ad0f%D70%E1%25%96%02%04%D2I%B7%F6%EE%A2%2BL%D8%3D%F3A%96%ED%26%A6%0F_%13M%2B%AC%D8%9A%22D%7C%F8%AC%0AZ%91%5Dv%85%F2%C8%7B%E7%FD%AF%9D%FB%C4%D34%D3%D6%E5%18a%C4%3D%93%A0%B7%9C%B6%C9%A6S%BA%D3w%D8%F9d%E1%11GB%15T%B8g%BE%F0%F1%99%D3%9C!cO%7Bg%3A%B3%7DHC%F1%F71%C6JT%22%E9U%AF_%60%5C%9E%D6%0B%2F%19d%D4P%13%13%BF%E1%C6%C4%CC%22%CB%AA%EC%2F~%5Dq%15%C3%AC%B0b%BD%EA%AC%A1%1B%C6%AD%ACE%16%85%A6%98%8A%9F%AA%A7%5Eh%95U%3BO)%A5%BD%F4%0E3%3C%CAh\'%9D)%A4d%91u%CD%B5s%AF%CF%19%B7%B2ZhI%22%E9%8E%BB%F8%A9Yf%85%3A%E8%006%D8%18%60%A0%8A*%2F%5E%0F%1E%133%9F%FC%5EzC%84l%DE%0Dc%FC%FC%9D~%C1~%03%97%96%03%F2QP%E0%18%00%00%00%00IEND%AEB%60%82"/>\n',
    webPage: "remoteimagedata.html",
    checkForAllowed: function img_checkAllowed(element) {
      return element.QueryInterface(Ci.nsIImageLoadingContent)
                    .imageBlockingStatus == Ci.nsIContentPolicy.ACCEPT;
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

function addMsgToFolderAndCheckContent(folder, test) {
  let msgDbHdr = addToFolder(test.type + " test message " + gMsgNo,
                             msgBodyStart + test.body + msgBodyEnd, folder);

  // select the newly created message
  let msgHdr = select_click_row(gMsgNo);

  if (msgDbHdr != msgHdr)
    throw new Error("Selected Message Header is not the same as generated header");

  assert_selected_and_displayed(gMsgNo);

  // Now check that the content hasn't been loaded
  if (test.checkDenied) {
    if (test.checkForAllowed(mozmill.getMail3PaneController()
            .window.content.document.getElementById("testelement")))
      throw new Error(test.type + " has not been blocked in message content as expected.");
  }
  else {
    if (!test.checkForAllowed(mozmill.getMail3PaneController()
             .window.content.document.getElementById("testelement")))
      throw new Error(test.type + " has been unexpectedly blocked in message content.");
  }

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
  addMsgToFolderAndCheckContent(folder, test);

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
    addMsgToFolderAndCheckContent(folder, TESTS[i]);

    if (TESTS[i].checkDenied) {
      // Check denied in reply window
      checkComposeWindow(TESTS[i], true, false);

      // Check denied in forward window
      checkComposeWindow(TESTS[i], false, false);

      // Now allow the remote content and check result
      allowRemoteContentAndCheck(TESTS[i]);
    }

    // Check allowed in reply window
    checkComposeWindow(TESTS[i], true, true);

    // Check allowed in forward window
    checkComposeWindow(TESTS[i], false, true);

    // Check allowed in content tab
    checkContentTab(TESTS[i]);
  }
}
