/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test to ensure that BCC gets added to message headers on IMAP download
 *
 * adapted from test_downloadOffline.js
 *
 * original author Kent James <kent@caspia.com>
 */

var gIMAPDaemon, gServer, gIMAPIncomingServer;

const gIMAPService = Cc["@mozilla.org/messenger/messageservice;1?type=imap"]
                       .getService(Ci.nsIMsgMessageService);

const gFileName = "draft1";
const gMsgFile = do_get_file("../../mailnews/data/" + gFileName);

var gDownloadedOnce = false;
var gIMAPInbox;

function run_test()
{
  loadLocalMailAccount();

  /*
   * Set up an IMAP server.
   */
  gIMAPDaemon = new imapDaemon();
  gServer = makeServer(gIMAPDaemon, "");
  gIMAPIncomingServer = createLocalIMAPServer();
  gIMAPIncomingServer.maximumConnectionsNumber = 1;

  // pref tuning: one connection only, turn off notifications
  let prefBranch = Cc["@mozilla.org/preferences-service;1"]
                     .getService(Ci.nsIPrefBranch);
  prefBranch.setBoolPref("mail.biff.play_sound", false);
  prefBranch.setBoolPref("mail.biff.show_alert", false);
  prefBranch.setBoolPref("mail.biff.show_tray_icon", false);
  prefBranch.setBoolPref("mail.biff.animate_dock_icon", false);

  let inbox = gIMAPDaemon.getMailbox("INBOX");

  /*
   * Ok, prelude done. Read the original message from disk
   * (through a file URI), and add it to the Inbox.
   */
  let msgfileuri = Cc["@mozilla.org/network/io-service;1"]
                     .getService(Ci.nsIIOService)
                     .newFileURI(gMsgFile).QueryInterface(Ci.nsIFileURL);

  inbox.addMessage(new imapMessage(msgfileuri.spec, inbox.uidnext++, []));

  do_test_pending();
  do_timeout(10000, "do_throw('downloadAllForOffline did not complete within 10 seconds. ABORTING.');");

  // Get the IMAP inbox...
  let rootFolder = gIMAPIncomingServer.rootFolder;
  gIMAPInbox = rootFolder.getFolderWithFlags(Ci.nsMsgFolderFlags.Inbox);

  // ...and download for offline use.
  gIMAPInbox.downloadAllForOffline(UrlListener, null);
}

var UrlListener = 
{
  OnStartRunningUrl: function(url) { },
  OnStopRunningUrl: function(url, rc)
  {
    // Check for ok status.
    do_check_eq(rc, 0);

    if (!gDownloadedOnce) {
      gDownloadedOnce = true;
      gIMAPInbox.downloadAllForOffline(UrlListener, null);
      return;
    }
    do_timeout(1000, "endTest();");
  }
};

function endTest()
{
  // locate the new message by enumerating through the database
  let enumerator = gIMAPInbox.msgDatabase.EnumerateMessages();
  while(enumerator.hasMoreElements())
  {
    let hdr = enumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr);
    do_check_true(hdr.bccList.indexOf("Another Person") >= 0);
    do_check_true(hdr.bccList.indexOf("<u1@example.com>") >= 0);
    do_check_false(hdr.bccList.indexOf("IDoNotExist") >=0);
  }

  gIMAPIncomingServer.closeCachedConnections();
  gServer.stop();

  var thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);

  do_test_finished();
}
