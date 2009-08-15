/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test autosync date constraints
 */

var gIMAPDaemon, gServer, gIMAPIncomingServer;

load("../../mailnews/resources/messageGenerator.js");
load("../../mailnews/resources/asyncTestUtils.js");

const gIMAPService = Cc["@mozilla.org/messenger/messageservice;1?type=imap"]
                       .getService(Ci.nsIMsgMessageService);

// Globals
var gRootFolder;
var gIMAPInbox, gIMAPTrashFolder, gMsgImapInboxFolder;
var gIMAPDaemon, gServer, gIMAPIncomingServer;
var gImapInboxOfflineStoreSize;

// Adds some messages directly to a mailbox (eg new mail)
function addMessagesToServer(messages, mailbox, localFolder)
{
  // Create the imapMessages and store them on the mailbox
  messages.forEach(function (message)
  {
    let dataUri = 'data:text/plain,' + message.toMessageString();
    mailbox.addMessage(new imapMessage(dataUri, mailbox.uidnext++, []));
  });
}

const gTestArray =
[
  function downloadForOffline() {
    // ...and download for offline use.
    // This downloads all messages, ignoring the autosync age constraints.
    gIMAPInbox.downloadAllForOffline(UrlListener, null);
  },
  function applyRetentionSettings() {
    gIMAPInbox.applyRetentionSettings();
    let enumerator = gIMAPInbox.msgDatabase.EnumerateMessages();
    if (enumerator) {
      let now = new Date();
      let dateInSeconds = now.getSeconds();
      let cutOffDateInSeconds = dateInSeconds - (5 * 60 * 24);
      while (enumerator.hasMoreElements()) {
        let header = enumerator.getNext();
        if (header instanceof Components.interfaces.nsIMsgDBHdr) {
          if (header.dateInSeconds < cutOffDateInSeconds)
            do_check_eq(header.getStringProperty("pendingRemoval"), "1");
          else
            do_check_eq(header.getStringProperty("pendingRemoval"), "");
        }
      }
    }
    doTest(++gCurTestNum);
  }
];

function run_test()
{
  // This is before any of the actual tests, so...
  gTest = 0;

  // Add a listener.
  gIMAPDaemon = new imapDaemon();
  gServer = makeServer(gIMAPDaemon, "");

  gIMAPIncomingServer = createLocalIMAPServer();

  loadLocalMailAccount();

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

  // The server doesn't support more than one connection
  let prefBranch = Cc["@mozilla.org/preferences-service;1"]
                     .getService(Ci.nsIPrefBranch);
  prefBranch.setIntPref("mail.server.server1.max_cached_connections", 1);
  // Make sure no biff notifications happen
  prefBranch.setBoolPref("mail.biff.play_sound", false);
  prefBranch.setBoolPref("mail.biff.show_alert", false);
  prefBranch.setBoolPref("mail.biff.show_tray_icon", false);
  prefBranch.setBoolPref("mail.biff.animate_dock_icon", false);
  // We aren't interested in downloading messages automatically
  prefBranch.setBoolPref("mail.server.server1.download_on_biff", false);
  prefBranch.setIntPref("mail.autosync.max_age_days", 4);

  // Get the server list...
  gIMAPIncomingServer.performExpand(null);

  gRootFolder = gIMAPIncomingServer.rootFolder;
  gIMAPInbox = gRootFolder.getChildNamed("INBOX");
  gMsgImapInboxFolder = gIMAPInbox.QueryInterface(Ci.nsIMsgImapMailFolder);
  // these hacks are required because we've created the inbox before
  // running initial folder discovery, and adding the folder bails
  // out before we set it as verified online, so we bail out, and
  // then remove the INBOX folder since it's not verified.
  gMsgImapInboxFolder.hierarchyDelimiter = '/';
  gMsgImapInboxFolder.verifiedAsOnlineFolder = true;


  // Add a couple of messages to the INBOX
  // this is synchronous, afaik
  gMessageGenerator = new MessageGenerator();
  gScenarioFactory = new MessageScenarioFactory(gMessageGenerator);

  // build up a diverse list of messages
  let messages = [];
  messages = messages.concat(gMessageGenerator.makeMessage({age: {days: 2, hours: 1}}));
  messages = messages.concat(gMessageGenerator.makeMessage({age: {days: 8, hours: 1}}));
  messages = messages.concat(gMessageGenerator.makeMessage({age: {days: 10, hours: 1}}));

  addMessagesToServer(messages,
                      gIMAPDaemon.getMailbox("INBOX"), gIMAPInbox);
  // "Master" do_test_pending(), paired with a do_test_finished() at the end of
  // all the operations.
  do_test_pending();
  //start first test
  doTest(1);
}

function doTest(test)
{
  if (test <= gTestArray.length)
  {
    dump("Doing test " + test + "\n");
    gCurTestNum = test;

    var testFn = gTestArray[test-1];
    // Set a limit of three seconds; if the notifications haven't arrived by then there's a problem.
    do_timeout(10000, "if (gCurTestNum == "+test+") \
      do_throw('Notifications not received in 10000 ms for operation "+testFn.name+", current status is '+gCurrStatus);");
    try {
    testFn();
    } catch(ex) {dump(ex);}
  }
  else
  {
    // Cleanup, null out everything, close all cached connections and stop the
    // server
    gRootFolder = null;
    gIMAPInbox = null;
    gMsgImapFolder = null;
    gIMAPTrashFolder = null;
    do_timeout_function(1000, endTest);
  }
}

function endTest()
{
  gServer.resetTest();
  gIMAPIncomingServer.closeCachedConnections();
  gServer.performTest();
  gServer.stop();
  let thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);

  do_test_finished(); // for the one in run_test()
}

var UrlListener = 
{
  OnStartRunningUrl: function(url) { },

  OnStopRunningUrl: function (aUrl, aExitCode) {
    // Check: message successfully copied.
    do_check_eq(aExitCode, 0);
    // Ugly hack: make sure we don't get stuck in a JS->C++->JS->C++... call stack
    // This can happen with a bunch of synchronous functions grouped together, and
    // can even cause tests to fail because they're still waiting for the listener
    // to return
    do_timeout(0, "doTest(++gCurTestNum)");
  }
};
