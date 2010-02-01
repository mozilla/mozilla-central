/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test to ensure that changes made from a different profile/machine
 * are synced correctly. In particular, we're checking that emptying out
 * an imap folder on the server makes us delete all the headers from our db.
 */

var gIMAPDaemon, gServer, gIMAPIncomingServer;

const gIMAPService = Cc["@mozilla.org/messenger/messageservice;1?type=imap"]
                       .getService(Ci.nsIMsgMessageService);

load("../../mailnews/resources/messageGenerator.js");

var gIMAPInbox;
var gMessage;
var gTest;
var gSecondFolder;
var gSynthMessage;

const gTestArray =
[
  function switchAwayFromInbox() {
    let rootFolder = gIMAPIncomingServer.rootFolder;
    gSecondFolder =  rootFolder.getChildNamed("secondFolder")
                           .QueryInterface(Ci.nsIMsgImapMailFolder);

    // Selecting the second folder will close the cached connection
    // on the inbox because fake server only supports one connection at a time.
    //  Then, we can poke at the message on the imap server directly, which
    // simulates the user changing the message from a different machine,
    // and Thunderbird discovering the change when it does a flag sync 
    // upon reselecting the Inbox.
    gSecondFolder.updateFolderWithListener(null, UrlListener);
  },
  function simulateMailboxEmptied() {
    gMessage.setFlag("\\Deleted");
    gIMAPDaemon.getMailbox("INBOX").expunge();
    gIMAPInbox.updateFolderWithListener(null, UrlListener);
  },
  function checkMailboxEmpty() {
    let msgHdr = gIMAPInbox.msgDatabase.getMsgHdrForMessageID(gSynthMessage.messageId);
    do_check_eq(gIMAPInbox.getTotalMessages(false), 0);
    doTest(++gTest);
  },
];

function run_test()
{
  gTest = 0;
  loadLocalMailAccount();

  /*
   * Set up an IMAP server.
   */
  gIMAPDaemon = new imapDaemon();
  gServer = makeServer(gIMAPDaemon, "");
  gIMAPDaemon.createMailbox("secondFolder", {subscribed : true});
  gIMAPIncomingServer = createLocalIMAPServer();
  gIMAPIncomingServer.maximumConnectionsNumber = 1;

  // We need an identity so that updateFolder doesn't fail
  let acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
  .getService(Ci.nsIMsgAccountManager);
  let localAccount = acctMgr.createAccount();
  let identity = acctMgr.createIdentity();
  localAccount.addIdentity(identity);
  localAccount.defaultIdentity = identity;
  localAccount.incomingServer = gLocalIncomingServer;
  acctMgr.defaultAccount = localAccount;
  
  // Let's also have another account, using the same identity
  let imapAccount = acctMgr.createAccount();
  imapAccount.addIdentity(identity);
  imapAccount.defaultIdentity = identity;
  imapAccount.incomingServer = gIMAPIncomingServer;
  
  // pref tuning: one connection only, turn off notifications
  let prefBranch = Cc["@mozilla.org/preferences-service;1"]
                     .getService(Ci.nsIPrefBranch);
  prefBranch.setBoolPref("mail.biff.play_sound", false);
  prefBranch.setBoolPref("mail.biff.show_alert", false);
  prefBranch.setBoolPref("mail.biff.show_tray_icon", false);
  prefBranch.setBoolPref("mail.biff.animate_dock_icon", false);


  let messages = [];
  let gMessageGenerator = new MessageGenerator();
  messages = messages.concat(gMessageGenerator.makeMessage());
  gSynthMessage = messages[0];

  let ioService = Cc["@mozilla.org/network/io-service;1"]
                  .getService(Ci.nsIIOService);
  let msgURI =
    ioService.newURI("data:text/plain;base64," +
                     btoa(gSynthMessage.toMessageString()),
                     null, null);
  let imapInbox =  gIMAPDaemon.getMailbox("INBOX")
  gMessage = new imapMessage(msgURI.spec, imapInbox.uidnext++, []);
  imapInbox.addMessage(gMessage);
  do_test_pending();

  // Get the IMAP inbox...
  let rootFolder = gIMAPIncomingServer.rootFolder;
  gIMAPInbox = rootFolder.getFolderWithFlags(Ci.nsMsgFolderFlags.Inbox)
                         .QueryInterface(Ci.nsIMsgImapMailFolder);

  // update folder to download header.
  gIMAPInbox.updateFolderWithListener(null, UrlListener);
}

var UrlListener = 
{
  OnStartRunningUrl: function(url) { },
  OnStopRunningUrl: function(url, rc)
  {
    // Check for ok status.
    do_check_eq(rc, 0);
    doTest(++gTest);
  }
};

function doTest(test)
{
  if (test <= gTestArray.length)
  {
    dump("Doing test " + test + "\n");
    gTest = test;

    var testFn = gTestArray[test - 1];
    // Set a limit of ten seconds; if the notifications haven't arrived by then there's a problem.
    try {
      testFn();
    } catch(ex) {
      gServer.stop();
      do_throw ('TEST FAILED ' + ex);
    }
  }
  else
  {
    do_timeout_function(1000, endTest);
  }
}

function endTest()
{
  gIMAPIncomingServer.closeCachedConnections();
  gServer.stop();

  var thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);

  do_test_finished();
}
