// This file tests the folder copying with IMAP. In particular, we're
// going to test copying local folders to imap servers, but other tests
// could be added.

var gIMAPDaemon, gServer, gIMAPIncomingServer;

const gIMAPService = Cc["@mozilla.org/messenger/messageservice;1?type=imap"]
                       .getService(Ci.nsIMsgMessageService);

// Globals
var gRootFolder;
var gIMAPInbox, gIMAPTrashFolder;
var gEmptyLocal1, gEmptyLocal2, gEmptyLocal3;
var gIMAPDaemon, gServer, gIMAPIncomingServer;
var gCopyService = Cc["@mozilla.org/messenger/messagecopyservice;1"]
                .getService(Ci.nsIMsgCopyService);

Components.utils.import("resource://gre/modules/iteratorUtils.jsm");
Components.utils.import("resource://gre/modules/folderUtils.jsm");

const gTestArray =
[
  function copyFolder1() {
    dump("gEmpty1 " + gEmptyLocal1.URI + "\n");
    let folders = new Array;
    folders.push(gEmptyLocal1.QueryInterface(Ci.nsIMsgFolder));
    let array = toXPCOMArray(folders, Ci.nsIMutableArray);
    gCopyService.CopyFolders(array, gIMAPInbox, false, CopyListener, null);
  },
  function copyFolder2() {
    dump("gEmpty2 " + gEmptyLocal2.URI + "\n");
    let folders = new Array;
    folders.push(gEmptyLocal2);
    let array = toXPCOMArray(folders, Ci.nsIMutableArray);
    gCopyService.CopyFolders(array, gIMAPInbox, false, CopyListener, null);
  },
  function copyFolder3() {
    dump("gEmpty3 " + gEmptyLocal3.URI + "\n");
    let folders = new Array;
    folders.push(gEmptyLocal3);
    let array = toXPCOMArray(folders, Ci.nsIMutableArray);
    gCopyService.CopyFolders(array, gIMAPInbox, false, CopyListener, null);
  },
  function verifyFolders() {
    let folder1 = gIMAPInbox.getChildNamed("empty 1");
    dump("found folder1\n");
    let folder2 = gIMAPInbox.getChildNamed("empty 2");
    dump("found folder2\n");
    let folder3 = gIMAPInbox.getChildNamed("empty 3");
    dump("found folder3\n");
    do_check_neq(folder1, null);
    do_check_neq(folder2, null);
    do_check_neq(folder3, null);
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

  gEmptyLocal1 = gLocalIncomingServer.rootFolder.addSubfolder("empty 1");
  gEmptyLocal2 = gLocalIncomingServer.rootFolder.addSubfolder("empty 2");
  gEmptyLocal3 = gLocalIncomingServer.rootFolder.addSubfolder("empty 3");
  // Get the server list...
  gIMAPIncomingServer.performExpand(null);

  gRootFolder = gIMAPIncomingServer.rootFolder;
  gIMAPInbox = gRootFolder.getChildNamed("INBOX");
  dump("gIMAPInbox uri = " + gIMAPInbox.URI + "\n");
  msgImapFolder = gIMAPInbox.QueryInterface(Ci.nsIMsgImapMailFolder);
  // these hacks are required because we've created the inbox before
  // running initial folder discovery, and adding the folder bails
  // out before we set it as verified online, so we bail out, and
  // then remove the INBOX folder since it's not verified.
  msgImapFolder.hierarchyDelimiter = '/';
  msgImapFolder.verifiedAsOnlineFolder = true;

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
    } catch(ex) {
      gServer.stop();
      do_throw ('TEST FAILED ' + e);
    }
  }
  else
  {
    do_timeout(1000, "endTest();");
  }
}

// nsIMsgCopyServiceListener implementation - runs next test when copy
// is completed.
var CopyListener = 
{
  OnStartCopy: function() {},
  OnProgress: function(aProgress, aProgressMax) {},
  SetMessageKey: function(aKey)
  {
  },
  SetMessageId: function(aMessageId) {},
  OnStopCopy: function(aStatus)
  {
    dump("in OnStopCopy " + gCurTestNum + "\n");
    // Check: message successfully copied.
    do_check_eq(aStatus, 0);
    // Ugly hack: make sure we don't get stuck in a JS->C++->JS->C++... call stack
    // This can happen with a bunch of synchronous functions grouped together, and
    // can even cause tests to fail because they're still waiting for the listener
    // to return
    do_timeout(0, "doTest(++gCurTestNum)");
  }
};

function endTest()
{
  // Cleanup, null out everything, close all cached connections and stop the
  // server
  gRootFolder = null;
  gIMAPInbox = null;
  gIMAPTrashFolder = null;
  gServer.resetTest();
  gIMAPIncomingServer.closeCachedConnections();
  gServer.performTest();
  gServer.stop();
  let thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);

  do_test_finished(); // for the one in run_test()
}
