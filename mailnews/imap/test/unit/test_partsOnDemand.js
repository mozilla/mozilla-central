/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Tests that you can stream a message without the attachments. Tests the
 * MsgHdrToMimeMessage API that exposes this.
 */
Components.utils.import("resource://gre/modules/Services.jsm");
Services.prefs.setIntPref("mail.imap.mime_parts_on_demand_threshold", 1000);

load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");
load("../../../resources/messageGenerator.js");

// javascript mime emitter functions
var mimeMsg = {};
Components.utils.import("resource:///modules/gloda/mimemsg.js", mimeMsg);

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

  let file = do_get_file("../../../data/bodystructuretest1");
  let msgURI = Services.io.newFileURI(file).QueryInterface(Ci.nsIFileURL);

  let imapInbox = gIMAPDaemon.getMailbox("INBOX");
  let message = new imapMessage(msgURI.spec, imapInbox.uidnext++, []);
  gIMAPMailbox.addMessage(message);
  // add a second message with no external parts. We want to make
  // sure that streaming this message doesn't mark it read, even
  // though we will fallback to fetching the whole message.
  file = do_get_file("../../../data/bodystructuretest3");
  msgURI = Services.io.newFileURI(file).QueryInterface(Ci.nsIFileURL);
  message = new imapMessage(msgURI.spec, imapInbox.uidnext++, []);
  gIMAPMailbox.addMessage(message);
  gIMAPInbox.updateFolderWithListener(null, asyncUrlListener);
  yield false;

  do_check_eq(2, gIMAPInbox.getTotalMessages(false));
  let msgHdr = mailTestUtils.firstMsgHdr(gIMAPInbox);
  do_check_true(msgHdr instanceof Ci.nsIMsgDBHdr);
  yield true;
}

// process the message through mime
function startMime()
{
  let msgHdr = mailTestUtils.firstMsgHdr(gIMAPInbox);

  mimeMsg.MsgHdrToMimeMessage(msgHdr, this, function (aMsgHdr, aMimeMessage) {
    let url = aMimeMessage.allUserAttachments[0].url;
    // A URL containing this string indicates that the attachment will be
    // downloaded on demand.
    do_check_true(url.contains("/;section="));
    async_driver();
  }, true /* allowDownload */, { partsOnDemand: true });
  yield false;
}

// test that we don't mark all inline messages as read.
function testAllInlineMessage()
{
  let enumerator = gIMAPInbox.msgDatabase.EnumerateMessages();

  if (enumerator.hasMoreElements())
  {
    gSecondMsg = enumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr);
    mimeMsg.MsgHdrToMimeMessage(gSecondMsg, this, function (aMsgHdr, aMimeMessage) {
      async_driver();
    }, true /* allowDownload */, { partsOnDemand: true });
    yield false;
  }
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
