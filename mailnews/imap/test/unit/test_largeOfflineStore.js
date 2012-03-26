/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test to ensure that downloadAllForOffline works correctly for large imap
 * stores, i.e., over 4 GiB.
 */

load("../../../resources/mailTestUtils.js");
load("../../../resources/messageGenerator.js");

Services.prefs.setCharPref("mail.serverDefaultStoreContractID",
                           "@mozilla.org/msgstore/berkeleystore;1");

var gDownloadedOnce = false;
var gIMAPDaemon;
var gIMAPInbox;
var gIMAPIncomingServer;
var gOfflineStoreSize;
var gServer;

function run_test()
{
  // Preference tuning: turn off notifications.
  Services.prefs.setBoolPref("mail.biff.play_sound", false);
  Services.prefs.setBoolPref("mail.biff.show_alert", false);
  Services.prefs.setBoolPref("mail.biff.show_tray_icon", false);
  Services.prefs.setBoolPref("mail.biff.animate_dock_icon", false);

  loadLocalMailAccount();

  // "Master" do_test_pending(), paired with a do_test_finished() at the end of
  // all the operations.
  do_test_pending();

  /*
   * Set up an IMAP server.
   */
  gIMAPDaemon = new imapDaemon();
  gServer = makeServer(gIMAPDaemon, "");
  gIMAPIncomingServer = createLocalIMAPServer();
  gIMAPIncomingServer.maximumConnectionsNumber = 1;

  // Figure out the name of the IMAP inbox
  let inboxFile = gIMAPIncomingServer.rootMsgFolder.filePath.clone();
  inboxFile.append("INBOX");
  if (!inboxFile.exists())
    inboxFile.create(Ci.nsIFile.NORMAL_FILE_TYPE, parseInt("0644", 8));

  // On Windows, check whether the drive is NTFS. If it is, mark the file as
  // sparse. If it isn't, then bail out now, because in all probability it is
  // FAT32, which doesn't support file sizes greater than 4 GB.
  if ("@mozilla.org/windows-registry-key;1" in Cc &&
      get_file_system(inboxFile) != "NTFS")
  {
    dump("On Windows, this test only works on NTFS volumes.\n");
    endTest();
    return;
  }
  let isFileSparse = mark_file_region_sparse(inboxFile, 0, 0x10000000f);
  if (!isFileSparse && inboxFile.diskSpaceAvailable < 0x200000000)
  {
    dump("On systems where files can't be marked sparse, this test needs 8 " +
         "GB of free disk space.\n");
    endTest();
    return;
  }

  let inbox = gIMAPDaemon.getMailbox("INBOX");

  let ioService = Cc["@mozilla.org/network/io-service;1"]
                    .getService(Ci.nsIIOService);

  // Create a couple test messages on the IMAP server.
  let messages = [];
  let messageGenerator = new MessageGenerator();
  let scenarioFactory = new MessageScenarioFactory(messageGenerator);

  messages = messages.concat(scenarioFactory.directReply(2));
  let dataUri = ioService.newURI("data:text/plain;base64," +
                                   btoa(messages[0].toMessageString()),
                                 null, null);
  let imapMsg = new imapMessage(dataUri.spec, inbox.uidnext++, []);
  inbox.addMessage(imapMsg);

  dataUri = ioService.newURI("data:text/plain;base64," +
                               btoa(messages[1].toMessageString()),
                             null, null);
  imapMsg = new imapMessage(dataUri.spec, inbox.uidnext++, []);
  inbox.addMessage(imapMsg);

  // Get local IMAP inbox.
  let rootFolder = gIMAPIncomingServer.rootFolder;
  gIMAPInbox = rootFolder.getFolderWithFlags(Ci.nsMsgFolderFlags.Inbox);

  // Extend local IMAP inbox to over 4 GiB.
  let outputStream = Cc["@mozilla.org/network/file-output-stream;1"]
                       .createInstance(Ci.nsIFileOutputStream)
                       .QueryInterface(Ci.nsISeekableStream);
  // Open in write-only mode, no truncate.
  outputStream.init(gIMAPInbox.filePath, 0x02, -1, 0);
  // seek to 15 bytes past 4GB.
  outputStream.seek(0, 0x10000000f);
  // Write an empty "from" line.
  outputStream.write("from\r\n", 6);
  outputStream.close();

  // Save initial file size.
  gOfflineStoreSize = gIMAPInbox.filePath.fileSize;

  // Download for offline use, to append created messages to local IMAP inbox.
  gIMAPInbox.downloadAllForOffline(UrlListener, null);
}

var UrlListener =
{
  OnStartRunningUrl: function(url) {},
  OnStopRunningUrl: function(url, rc)
  {
    // Check for ok status.
    do_check_eq(rc, 0);

    if (!gDownloadedOnce) {
      gDownloadedOnce = true;
      // Call downloadAllForOffline() a second time.
      gIMAPInbox.downloadAllForOffline(UrlListener, null);
      return;
    }

    // verify that the message headers have the offline flag set.
    let msgEnumerator = gIMAPInbox.msgDatabase.EnumerateMessages();
    let offset = new Object;
    let size = new Object;
    while (msgEnumerator.hasMoreElements())
    {
      let header = msgEnumerator.getNext();
      // Verify that each message has been downloaded and looks OK.
      if (header instanceof Components.interfaces.nsIMsgDBHdr &&
          (header.flags & Ci.nsMsgMessageFlags.Offline))
        gIMAPInbox.getOfflineFileStream(header.messageKey, offset, size).close();
      else
        do_throw("Message not downloaded for offline use");

      dump("msg hdr offset = " + offset.value + "\n");
    }
    let offlineStoreSize = gIMAPInbox.filePath.fileSize;
    dump("offline store size = " + offlineStoreSize + "\n");
    // Make sure offline store grew (i.e., we're not writing over data).
    do_check_true(offlineStoreSize > gOfflineStoreSize);

    try {
      do_timeout(1000, endTest);
    } catch(ex) {
      do_throw(ex);
    }
  }
};

function endTest()
{
  // free up disk space - if you want to look at the file after running
  // this test, comment out this line.
  if (gIMAPInbox)
    gIMAPInbox.filePath.remove(false);

  if (gIMAPIncomingServer)
    gIMAPIncomingServer.closeCachedConnections();
  if (gServer)
    gServer.stop();

  let thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);

  do_test_finished();
}
