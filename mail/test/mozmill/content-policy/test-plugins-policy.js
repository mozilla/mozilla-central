/**
 * Checks if plugins are enabled in messages correctly or not.
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
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Dan Mosedale <dmose@mozilla.org>
 *   Joey Minta <jminta@gmail.com>
 *   Mark Banner <bugzilla@standard8.plus.com>
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

var MODULE_NAME = 'test-plugins-policy';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers', 'compose-helpers'];
var jumlib = {};
Components.utils.import("resource://mozmill/modules/jum.js", jumlib);
var elib = {};
Components.utils.import('resource://mozmill/modules/elementslib.js', elib);

Components.utils.import("resource://gre/modules/Services.jsm");

var folder = null;
var composeHelper = null;
var gMsgNo = 0;

// RELATIVE_ROOT messes with the collector, so we have to bring the path back
// so we get the right path for the resources.
var url = collector.addHttpResource('../content-policy/html', 'content');

// These two constants are used to build the message body.
const msgBody = '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">\n' +
'<html>\n' +
'<head>\n' +
'\n' +
'<meta http-equiv="content-type" content="text/html; charset=ISO-8859-1">\n' +
'</head>\n' +
'<body bgcolor="#ffffff" text="#000000">\n' +
'<embed id="testelement" type="application/x-test" width="400" height="400" border="1"></embed>\n' +
'</body>\n</html>\n';

var setupModule = function (module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);
  composeHelper = collector.getModule('compose-helpers');
  composeHelper.installInto(module);

  folder = create_folder("pluginPolicy");
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

function isPluginLoaded(contentDocument) {
  let element = contentDocument.getElementById("testelement").wrappedJSObject;

  try {
    // if setColor throws, then the plugin isn't running
    element.setColor("FFFF0000");
    return true;
  }
  catch (ex) {
    // Any errors and we'll just return false below - they may be expected.
  }
  return false;
}

function addMsgToFolderAndCheckContent(loadAllowed) {
  let msgDbHdr = addToFolder("Plugin test message " + gMsgNo, msgBody, folder);

  // select the newly created message
  let msgHdr = select_click_row(gMsgNo);

  if (msgDbHdr != msgHdr)
    throw new Error("Selected Message Header is not the same as generated header");

  assert_selected_and_displayed(gMsgNo);

  ++gMsgNo;

  // XXX It appears the assert_selected_and_displayed doesn't actually wait
  // long enough for plugin load. However, I also can't find a way to wait for
  // long enough in all situations, so this will have to do for now.
  mc.sleep(1000);

  // Now check that the content hasn't been loaded
  if (isPluginLoaded(mozmill.getMail3PaneController().window
                            .content.document) != loadAllowed)
    throw new Error(loadAllowed ?
                    "Plugin has been unexpectedly blocked in message content" :
                    "Plugin has not been blocked in message as expected");
}

function checkStandaloneMessageWindow(loadAllowed) {
  plan_for_new_window("mail:messageWindow");
  // Open it
  set_open_message_behavior("NEW_WINDOW");

  open_selected_message();
  let msgc = wait_for_new_window("mail:messageWindow");
  wait_for_message_display_completion(msgc, true);

  // XXX It appears the wait_for_message_display_completion doesn't actually
  // wait long enough for plugin load. However, I also can't find a way to wait
  // for long enough in all situations, so this will have to do for now.
  mc.sleep(1000);

  if (isPluginLoaded(msgc.window.content.document) != loadAllowed)
    throw new Error(loadAllowed ?
                    "Plugin has been unexpectedly blocked in standalone window" :
                    "Plugin has not been blocked in standalone window as expected");

  // Clean up, close the window
  close_message_window(msgc);
}

function test_3paneWindowDenied() {
  be_in_folder(folder);

  assert_nothing_selected();

  addMsgToFolderAndCheckContent(false);
}

function test_checkPluginsInNonMessageContent() {
  // Deselect everything so we can load our content
  select_none();

  // load something non-message-like in the message pane
  mozmill.getMail3PaneController().window.GetMessagePaneFrame().location.href =
    url + "plugin.html";

  wait_for_message_display_completion();

  if (!isPluginLoaded(mozmill.getMail3PaneController().window.content.document))
    throw new Error("Plugin is not turned on in content in message pane - it should be.");
}

function test_3paneWindowDeniedAgain() {
  select_click_row(0);

  assert_selected_and_displayed(0);

  // Now check that the content hasn't been loaded
  if (isPluginLoaded(mozmill.getMail3PaneController().window
                            .content.document) != false)
    throw new Error(loadAllowed ?
                    "Plugin has been unexpectedly blocked in message content" :
                    "Plugin has not been blocked in message as expected");

}

function test_checkStandaloneMessageWindowDenied() {
  checkStandaloneMessageWindow(false);
}

function test_checkContentTab() {
  // To open a tab we're going to have to cheat and use tabmail so we can load
  // in the data of what we want.
  let preCount = mc.tabmail.tabContainer.childNodes.length;

  let newTab = mc.tabmail.openTab("contentTab", { contentPage: url + "plugin.html" });

  mc.waitForEval("subject.busy == false", 5000, 100, newTab);

  if (mc.tabmail.tabContainer.childNodes.length != preCount + 1)
    throw new Error("The content tab didn't open");

  if (!isPluginLoaded(mc.tabmail.getBrowserForSelectedTab().contentDocument))
    throw new Error("Plugin has been unexpectedly blocked in content tab");

  mc.tabmail.closeTab(newTab);

  if (mc.tabmail.tabContainer.childNodes.length != preCount)
    throw new Error("The content tab didn't close");
}

function test_3paneWindowAllowed() {
  Services.prefs.setBoolPref("mailnews.message_display.allow_plugins", true);

  addMsgToFolderAndCheckContent(true);
}

function test_checkStandaloneMessageWindowAllowed() {
  checkStandaloneMessageWindow(true);
}
