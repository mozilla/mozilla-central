/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test to ensure that downloadAllForOffline works correctly for large imap
 * stores, i.e., over 4 GiB.
 */

load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");
load("../../../resources/messageGenerator.js");

Services.prefs.setCharPref("mail.serverDefaultStoreContractID",
                           "@mozilla.org/msgstore/berkeleystore;1");

var gOfflineStoreSize;

var tests = [
  setup,
  check_result,
  teardown
];

function run_test() {
  setupIMAPPump();

  // Figure out the name of the IMAP inbox
  let inboxFile = IMAPPump.incomingServer.rootMsgFolder.filePath;
  inboxFile.append("INBOX");
  if (!inboxFile.exists())
    inboxFile.create(Ci.nsIFile.NORMAL_FILE_TYPE, parseInt("0644", 8));

  let neededFreeSpace = 0x200000000;
  // On Windows, check whether the drive is NTFS. If it is, mark the file as
  // sparse. If it isn't, then bail out now, because in all probability it is
  // FAT32, which doesn't support file sizes greater than 4 GB.
  if ("@mozilla.org/windows-registry-key;1" in Cc &&
      mailTestUtils.get_file_system(inboxFile) != "NTFS")
  {
    dump("On Windows, this test only works on NTFS volumes.\n");
    teardown();
    return;
  }

  let isFileSparse = mailTestUtils.mark_file_region_sparse(inboxFile, 0, 0x10000000f);
  let freeDiskSpace = inboxFile.diskSpaceAvailable;
  do_print("Free disk space = " + mailTestUtils.toMiBString(freeDiskSpace));
  if (!isFileSparse && freeDiskSpace < neededFreeSpace) {
    do_print("This test needs " + mailTestUtils.toMiBString(neededFreeSpace) +
             " free space to run. Aborting.");
    todo_check_true(false);

    teardown();
    return;
  }

  async_run_tests(tests);
}

function setup() {
  // Create a couple test messages on the IMAP server.
  let messages = [];
  let messageGenerator = new MessageGenerator();
  let scenarioFactory = new MessageScenarioFactory(messageGenerator);

  messages = messages.concat(scenarioFactory.directReply(2));
  let dataUri = Services.io.newURI("data:text/plain;base64," +
                                   btoa(messages[0].toMessageString()),
                                   null, null);
  let imapMsg = new imapMessage(dataUri.spec, IMAPPump.mailbox.uidnext++, []);
  IMAPPump.mailbox.addMessage(imapMsg);

  dataUri = Services.io.newURI("data:text/plain;base64," +
                               btoa(messages[1].toMessageString()),
                               null, null);
  imapMsg = new imapMessage(dataUri.spec, IMAPPump.mailbox.uidnext++, []);
  IMAPPump.mailbox.addMessage(imapMsg);

  // Extend local IMAP inbox to over 4 GiB.
  let outputStream = Cc["@mozilla.org/network/file-output-stream;1"]
                       .createInstance(Ci.nsIFileOutputStream)
                       .QueryInterface(Ci.nsISeekableStream);
  // Open in write-only mode, no truncate.
  outputStream.init(IMAPPump.inbox.filePath, 0x02, -1, 0);
  // seek to 15 bytes past 4GB.
  outputStream.seek(0, 0x10000000f);
  // Write an empty "from" line.
  outputStream.write("from\r\n", 6);
  outputStream.close();

  // Save initial file size.
  gOfflineStoreSize = IMAPPump.inbox.filePath.fileSize;
  do_print("Offline store size (before 1st downloadAllForOffline()) = " +
           gOfflineStoreSize);

  // Download for offline use, to append created messages to local IMAP inbox.
  IMAPPump.inbox.downloadAllForOffline(asyncUrlListener, null);
  yield false;
}

function check_result() {
  // Call downloadAllForOffline() a second time.
  IMAPPump.inbox.downloadAllForOffline(asyncUrlListener, null);
  yield false;

  // Make sure offline store grew (i.e., we were not writing over data).
  let offlineStoreSize = IMAPPump.inbox.filePath.fileSize;
  do_print("Offline store size (after 2nd downloadAllForOffline()) = " +
           offlineStoreSize + ". (Msg hdr offsets should be close to it.)");
  do_check_true(offlineStoreSize > gOfflineStoreSize);

  // Verify that the message headers have the offline flag set.
  let msgEnumerator = IMAPPump.inbox.msgDatabase.EnumerateMessages();
  let offset = {};
  let size = {};
  while (msgEnumerator.hasMoreElements()) {
    let header = msgEnumerator.getNext();
    // Verify that each message has been downloaded and looks OK.
    if (!(header instanceof Components.interfaces.nsIMsgDBHdr &&
          (header.flags & Ci.nsMsgMessageFlags.Offline)))
      do_throw("Message not downloaded for offline use");

    IMAPPump.inbox.getOfflineFileStream(header.messageKey, offset, size).close();
    do_print("Msg hdr offset = " + offset.value);
  }
};

function teardown() {
  // Free up disk space - if you want to look at the file after running
  // this test, comment out this line.
  if (IMAPPump.inbox)
    IMAPPump.inbox.filePath.remove(false);

  teardownIMAPPump();
}
