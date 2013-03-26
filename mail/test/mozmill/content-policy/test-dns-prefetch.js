/**
 * The purpose of this test is to ensure that dns prefetch is turned off in
 * the message pane and compose windows. It also checks that dns prefetch is
 * currently turned off in content tabs, although when bug 545407 is fixed, it
 * should be turned back on again.
 */

//
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var MODULE_NAME = 'test-exposed-in-content-tabs';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'compose-helpers',
                       'content-tab-helpers'];
var jumlib = {};
Components.utils.import("resource://mozmill/modules/jum.js", jumlib);
var elib = {};
Components.utils.import('resource://mozmill/modules/elementslib.js', elib);

Components.utils.import("resource://gre/modules/Services.jsm");

var folder = null;
var composeHelper = null;
var gMsgNo = 0;
var gMsgHdr = null;

// These two constants are used to build the message body.
const msgBody = '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">\n' +
'<html>\n' +
'<head>\n' +
'\n' +
'<meta http-equiv="content-type" content="text/html; charset=ISO-8859-1">\n' +
'</head>\n' +
'<body bgcolor="#ffffff" text="#000000">\n' +
'dns prefetch test message\n' +
'</body>\n</html>\n';

var setupModule = function (module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  composeHelper = collector.getModule('compose-helpers');
  composeHelper.installInto(module);
  let cth = collector.getModule('content-tab-helpers');
  cth.installInto(module);

  folder = create_folder("dnsPrefetch");
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

function addMsgToFolder(folder) {
  let msgDbHdr = addToFolder("exposed test message " + gMsgNo,
                             msgBody, folder);

  // select the newly created message
  gMsgHdr = select_click_row(gMsgNo);

  if (msgDbHdr != gMsgHdr)
    throw new Error("Selected Message Header is not the same as generated header");

  assert_selected_and_displayed(gMsgNo);

  ++gMsgNo;
}

/**
 * Check remote content in a compose window.
 *
 * @param test        The test from TESTS that is being performed.
 * @param replyType   The type of the compose window, 0 = normal compose,
 *                    1 = reply, 2 = forward.
 * @param loadAllowed Whether or not the load is expected to be allowed.
 */
function checkComposeWindow(replyType) {
  let errMsg = "";
  let replyWindow = null;
  switch (replyType) {
  case 0:
    replyWindow = composeHelper.open_compose_new_mail();
    errMsg = "new mail";
    break;
  case 1:
    replyWindow = composeHelper.open_compose_with_reply();
    errMsg = "reply";
    break;
  case 2:
    replyWindow = composeHelper.open_compose_with_forward();
    errMsg = "forward";
    break;
  }

  // Check the prefetch in the compose window.
  if (replyWindow.e("content-frame").docShell.allowDNSPrefetch)
    throw new Error("DNS Prefetch on compose window is not disabled (" +
                    errMsg + ")");

  composeHelper.close_compose_window(replyWindow);
}

function test_dnsPrefetch_message() {
  // Now we have started up, simply check that DNS prefetch is disabled
  if (mc.e("messagepane").docShell.allowDNSPrefetch)
    throw new Error("DNS Prefetch on messagepane is not disabled at startup");

  be_in_folder(folder);

  assert_nothing_selected();

  addMsgToFolder(folder);

  // Now we've got a message selected, check again.
  if (mc.e("messagepane").docShell.allowDNSPrefetch)
    throw new Error("DNS Prefetch on messagepane is not disabled after selecting message");
}

function test_dnsPrefetch_standaloneMessage() {
  let msgc = open_selected_message_in_new_window();
  assert_selected_and_displayed(msgc, gMsgHdr);

  // Check the docshell.
  if (mc.e("messagepane").docShell.allowDNSPrefetch)
    throw new Error("DNS Prefetch on messagepane is not disabled in standalone message window.");

  close_message_window(msgc);
}

function test_dnsPrefetch_compose() {
  checkComposeWindow(0);
  checkComposeWindow(1);
  checkComposeWindow(2);
}

function test_dnsPrefetch_contentTab() {
  // To open a tab we're going to have to cheat and use tabmail so we can load
  // in the data of what we want.
  let preCount = mc.tabmail.tabContainer.childNodes.length;

  let dataurl = 'data:text/html,<html><head><title>test dns prefetch</title>' +
    '</head><body>test dns prefetch</body></html>';

  let newTab = open_content_tab_with_url(dataurl);

  if (!mc.tabmail.getBrowserForSelectedTab().docShell.allowDNSPrefetch)
    throw new Error("DNS prefetch unexpectedly disabled in content tabs");

  mc.tabmail.closeTab(newTab);

  if (mc.tabmail.tabContainer.childNodes.length != preCount)
    throw new Error("The content tab didn't close");
}
