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
 *   The Mozilla Foundation
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 * Jonathan Protzenko <jonathan.protzenko@gmail.com>
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

/*
 * Tests that you can stream a message without the attachments. Tests the
 * MsgHdrToMimeMessage API that exposes this.
 */
Components.utils.import("resource://gre/modules/Services.jsm");
Services.prefs.setIntPref("mail.imap.mime_parts_on_demand_threshold", 1000);

load("../../../resources/logHelper.js");
load("../../../resources/mailTestUtils.js");
load("../../../resources/asyncTestUtils.js");
load("../../../resources/messageGenerator.js");

// javascript mime emitter functions
mimeMsg = {};
Components.utils.import("resource:///modules/gloda/mimemsg.js", mimeMsg);

var gEnumerator;
var gSecondMsg;

// IMAP pump
load("../../../resources/IMAPpump.js");

setupIMAPPump();

var tests = [
  setPrefs,
  loadImapMessage,
  startMime,
  testAllInlineMessage,
  updateCounts,
  testNotRead,
  endTest
]

// make sure we are in the optimal conditions!
function setPrefs() {
  Services.prefs.setIntPref("mail.imap.mime_parts_on_demand_threshold", 20);
  Services.prefs.setBoolPref("mail.imap.mime_parts_on_demand", true);
  Services.prefs.setBoolPref("mail.server.server1.autosync_offline_stores", false);
  Services.prefs.setBoolPref("mail.server.server1.offline_download", false);
  Services.prefs.setBoolPref("mail.server.server1.download_on_biff", false);
  Services.prefs.setIntPref("browser.cache.disk.capacity", 0);

  yield true;
}

// load and update a message in the imap fake server
function loadImapMessage()
{
  let gMessageGenerator = new MessageGenerator();

  let ioService = Cc["@mozilla.org/network/io-service;1"]
                  .getService(Ci.nsIIOService);
  let file = do_get_file("../../../data/bodystructuretest1");
  let msgURI = ioService.newFileURI(file).QueryInterface(Ci.nsIFileURL);

  let imapInbox =  gIMAPDaemon.getMailbox("INBOX")
  let message = new imapMessage(msgURI.spec, imapInbox.uidnext++, []);
  gIMAPMailbox.addMessage(message);
  // add a second message with no external parts. We want to make
  // sure that streaming this message doesn't mark it read, even
  // though we will fallback to fetching the whole message.
  file = do_get_file("../../../data/bodystructuretest3");
  msgURI = ioService.newFileURI(file).QueryInterface(Ci.nsIFileURL);
  message = new imapMessage(msgURI.spec, imapInbox.uidnext++, []);
  gIMAPMailbox.addMessage(message);
  gIMAPInbox.updateFolderWithListener(null, asyncUrlListener);
  yield false;

  do_check_eq(2, gIMAPInbox.getTotalMessages(false));
  let msgHdr = firstMsgHdr(gIMAPInbox);
  do_check_true(msgHdr instanceof Ci.nsIMsgDBHdr);
  yield true;
}

// process the message through mime
function startMime()
{
  let msgHdr = firstMsgHdr(gIMAPInbox);

  mimeMsg.MsgHdrToMimeMessage(msgHdr, this, function (aMsgHdr, aMimeMessage) {
    let url = aMimeMessage.allUserAttachments[0].url;
    // A URL containing this string indicates that the attachment will be
    // downloaded on demand.
    do_check_true(url.indexOf("/;section=") >= 0);
    async_driver();
  }, true /* allowDownload */, { partsOnDemand: true });
  yield false;
}

// test that we don't mark all inline messages as read.
function testAllInlineMessage()
{
  if (gEnumerator.hasMoreElements())
  {
    gSecondMsg = gEnumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr);
    mimeMsg.MsgHdrToMimeMessage(gSecondMsg, this, function (aMsgHdr, aMimeMessage) {
      async_driver();
    }, true /* allowDownload */, { partsOnDemand: true });
    yield false;
  }
  gEnumerator = null;
}

function updateCounts()
{
  // select the trash, then the inbox again, to force an update of the 
  // read state of messages.
  let trash = gIMAPIncomingServer.rootFolder.getChildNamed("Trash");
  do_check_true(trash instanceof Ci.nsIMsgImapMailFolder);
  trash.updateFolderWithListener(null, asyncUrlListener);
  yield false;
  gIMAPInbox.updateFolderWithListener(null, asyncUrlListener);
  yield false;
}

function testNotRead()
{
  do_check_eq(2, gIMAPInbox.getNumUnread(false));
  yield true;
}

// Cleanup
function endTest()
{
  teardownIMAPPump();
}

function run_test()
{
  async_run_tests(tests);
}

// get the first message header found in a folder
function firstMsgHdr(folder) {
  gEnumerator = folder.msgDatabase.EnumerateMessages();
  if (gEnumerator.hasMoreElements())
    return gEnumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr);
  return null;
}
