/**
 * Test whether the video content policy works or not.
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

var MODULE_NAME = 'test-video-content-policy';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers'];

var elib = {};
Components.utils.import('resource://mozmill/modules/elementslib.js', elib);

var folder = null;
var windowHelper = null;
var gMsgNo = 0;

// RELATIVE_ROOT messes with the collector, so we have to bring the path back
// so we get the right path for the resources.
var url = collector.addHttpResource('../content-policy/html', 'content');

var setupModule = function (module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  windowHelper = collector.getModule('window-helpers');
  windowHelper.installInto(module);

  folder = create_folder("videoContentPolicy");
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

const videoMsgBody = '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">\n' +
'<html>\n' +
'<head>\n' +
'\n' +
'<meta http-equiv="content-type" content="text/html; charset=ISO-8859-1">\n' +
'</head>\n' +
'<body bgcolor="#ffffff" text="#000000">\n' +
'<video id=\"video1\" src=\"' + url + 'video.ogv\"/>\n' +
'</body>\n' +
'</html>\n';

function addMsgToFolderAndCheckNoRemoteVideo(folder) {
  let msgDbHdr = addToFolder("Image test message " + gMsgNo, videoMsgBody,
                             folder);

  // select the newly created message
  let msgHdr = select_click_row(gMsgNo);

  if (msgDbHdr != msgHdr)
    throw new Error("Selected Message Header is not the same as generated header");

  assert_selected_and_displayed(gMsgNo);

  // Now check that the video hasn't been loaded
  if (mozmill.getMail3PaneController().window.content.document
             .getElementById("video1").networkState !=
      Components.interfaces.nsIDOMHTMLMediaElement.NETWORK_NO_SOURCE)
    throw new Error("Video has not been blocked in message content as expected.");

  ++gMsgNo;
}

function openComposeWithReply() {
  windowHelper.plan_for_new_window("msgcompose");
  mc.keypress(null, "r", {shiftKey: false, accelKey: true});
  let replyWindow = windowHelper.wait_for_new_window("msgcompose");

  let editor = replyWindow.window.document.getElementsByTagName("editor")[0];

  if (editor.webNavigation.busyFlags != Ci.nsIDocShell.BUSY_FLAGS_NONE) {
    let editorObserver = {
      editorLoaded: false,

      observe: function eO_observe(aSubject, aTopic, aData) {
        if (aTopic == "obs_documentCreated") {
          this.editorLoaded = true;
        }
      }
    };

    editor.commandManager.addCommandObserver(editorObserver,
                                             "obs_documentCreated");

    mc.waitForEval("subject.editorLoaded == true", 10000, 100, editorObserver);

    // Let the event queue clear.
    mc.sleep(0);

    editor.commandManager.removeCommandObserver(editorObserver,
                                                "obs_documentCreated");
  }

  // Although the above is reasonable, testing has shown that the video elements
  // need to have a little longer to try and load the initial video data.
  // As I can't see a simpler way at the moment, we'll just have to make it a
  // sleep :-(

  mc.sleep(1000);

  return replyWindow;
}


function test_videoContentPolicy() {
  let folderTab = mc.tabmail.currentTabInfo;
  be_in_folder(folder);

  assert_nothing_selected();
}

function test_videoDeniedInMail() {
  addMsgToFolderAndCheckNoRemoteVideo(folder);
}

function test_videoDeniedInReplyWindow()
{
  let replyWindow = openComposeWithReply();

  if (replyWindow.window.document
                 .getElementById("content-frame").contentDocument.getElementById("video1").networkState !=
      Components.interfaces.nsIDOMHTMLMediaElement.NETWORK_NO_SOURCE)
    throw new Error("Video has not been blocked in reply window as expected.");

  windowHelper.close_window(replyWindow);
}

function test_videoAllowedInMail() {
  addMsgToFolderAndCheckNoRemoteVideo(folder);

  // Click on the allow remote content button
  mc.click(new elib.ID(mozmill.getMail3PaneController().window.document, "remoteContentBarButton"));

  wait_for_message_display_completion();

  if (mozmill.getMail3PaneController().window.content.document
             .getElementById("video1").networkState ==
      Components.interfaces.nsIDOMHTMLMediaElement.NETWORK_NO_SOURCE) {

    // This is altered debug for bug 539908 (random failure of the above check)
    // and isn't the normal execution path.
    // throw new Error("Video has been unexpectedly blocked.");

    // Try waiting a bit longer and then checking, just in case
    // wait_for_message_display_completion should have waited a bit longer
    mc.sleep(3000);
    // Although this may not be an error now, we still want to treat it as one
    // so we can track down the cause of this random failure.
    throw new Error("Video was unexpectedly blocked. Network State was: " +
                    Components.interfaces.nsIDOMHTMLMediaElement.NETWORK_NO_SOURCE +
                    "After a 3 second sleep, the network state is now: " +
                    mozmill.getMail3PaneController().window.content.document
                           .getElementById("video1").networkState);
  }
  ++gMsgNo;
}

function test_videoAllowedInReplyWindow()
{
  let replyWindow = openComposeWithReply();

  if (replyWindow.window.document
                 .getElementById("content-frame").contentDocument.getElementById("video1").networkState ==
      Components.interfaces.nsIDOMHTMLMediaElement.NETWORK_NO_SOURCE)
    throw new Error("Video has been unexpectedly blocked.");

  windowHelper.close_window(replyWindow);
}
