/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test to ensure that downloadAllForOffline works correctly with imap folders
 * and returns success.
 */

var gIMAPDaemon, gServer, gIMAPIncomingServer;

const gIMAPService = Cc["@mozilla.org/messenger/messageservice;1?type=imap"]
                       .getService(Ci.nsIMsgMessageService);

load("../../mailnews/resources/messageGenerator.js");

const gFileName = "bug460636";
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

  let ioService = Cc["@mozilla.org/network/io-service;1"]
  .getService(Ci.nsIIOService);
 /*
   * Ok, prelude done. Read the original message from disk
   * (through a file URI), and add it to the Inbox.
   */
  let msgfileuri = ioService.newFileURI(gMsgFile).QueryInterface(Ci.nsIFileURL);

  inbox.addMessage(new imapMessage(msgfileuri.spec, inbox.uidnext++, []));

  let messages = [];
  let gMessageGenerator = new MessageGenerator();
  messages = messages.concat(gMessageGenerator.makeMessage());
  gSynthMessage = messages[0];
  let dataUri = ioService.newURI("data:text/plain;base64," +
                   btoa(messages[0].toMessageString()),
                   null, null);
  let imapMsg = new imapMessage(dataUri.spec, inbox.uidnext++, []);
  imapMsg.setSize(5000);
  inbox.addMessage(imapMsg);
  
  do_test_pending();
  do_timeout(10000, function(){
        do_throw('downloadAllForOffline did not complete within 10 seconds. ABORTING.');
      }
    );

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
    else {
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
      }
      endTest();
    }
    do_timeout(1000, endTest);
  }
};

function endTest()
{
  gIMAPIncomingServer.closeCachedConnections();
  gServer.stop();

  var thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);

  do_test_finished();
}
