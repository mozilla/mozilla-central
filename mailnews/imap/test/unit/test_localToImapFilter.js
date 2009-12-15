/*
 * This file tests copies of multiple messages using filters
 * from incoming POP3, with filter actions copying and moving
 * messages to IMAP folders. This test is adapted from
 * test_imapFolderCopy.js
 *
 * Original author: Kent James <kent@caspia.com>
 */

load("../../mailnews/resources/POP3pump.js");
Components.utils.import("resource://gre/modules/iteratorUtils.jsm");
Components.utils.import("resource://gre/modules/folderUtils.jsm");

var gIMAPDaemon, gServer, gIMAPIncomingServer;

const gIMAPService = Cc["@mozilla.org/messenger/messageservice;1?type=imap"]
                       .getService(Ci.nsIMsgMessageService);

// Globals
var gRootFolder;
var gIMAPInbox, gIMAPTrashFolder;
var gEmptyLocal1, gEmptyLocal2;
var gIMAPDaemon, gServer, gIMAPIncomingServer;
var gLastKey;
var gMessages = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
var gCopyService = Cc["@mozilla.org/messenger/messagecopyservice;1"]
                .getService(Ci.nsIMsgCopyService);
var gCurTestNum;
const gFiles = ["../../mailnews/data/bugmail1",
                "../../mailnews/data/draft1"];

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
  function getLocalMessages() {
    // setup copy then move mail filters on the inbox
    let filterList = gPOP3Pump.fakeServer.getFilterList(null);
    let filter = filterList.createFilter("copyThenMoveAll");
    let searchTerm = filter.createTerm();
    searchTerm.matchAll = true;
    filter.appendTerm(searchTerm);
    let copyAction = filter.createAction();
    copyAction.type = Ci.nsMsgFilterAction.CopyToFolder;
    copyAction.targetFolderUri = gIMAPInbox.getChildNamed("empty 1").URI;
    filter.appendAction(copyAction);
    let moveAction = filter.createAction();
    moveAction.type = Ci.nsMsgFilterAction.MoveToFolder;
    moveAction.targetFolderUri = gIMAPInbox.getChildNamed("empty 2").URI;
    filter.appendAction(moveAction);
    filter.enabled = true;
    filterList.insertFilterAt(0, filter);

    gPOP3Pump.files = gFiles;
    gPOP3Pump.onDone = "doTest();";
    ++gCurTestNum;
    gPOP3Pump.run();
  },
  function update1() {
    let folder1 = gIMAPInbox.getChildNamed("empty 1").QueryInterface(Ci.nsIMsgImapMailFolder);
    folder1.updateFolderWithListener(null, URLListener);
  },
  function update2() {
    let folder2 = gIMAPInbox.getChildNamed("empty 2").QueryInterface(Ci.nsIMsgImapMailFolder);
    folder2.updateFolderWithListener(null, URLListener);
  },
  function verifyFolders() {
    let folder1 = gIMAPInbox.getChildNamed("empty 1");
    listMessages(folder1);
    let folder2 = gIMAPInbox.getChildNamed("empty 2");
    listMessages(folder2);
    listMessages(gLocalInboxFolder);
    do_check_neq(folder1, null);
    do_check_neq(folder2, null);
    // folder 1 and 2 should each now have 2 messages in them.
    do_check_eq(folderCount(folder1), 2);
    do_check_eq(folderCount(folder2), 2);
    // the local inbox folder should now be empty, since the second
    // operation was a move
    do_check_eq(folderCount(gLocalInboxFolder), 0);
    doTest(++gCurTestNum);
  },

];

function folderCount(folder)
{
  let enumerator = folder.msgDatabase.EnumerateMessages();
  let count = 0;
  while (enumerator.hasMoreElements())
  {
    count++;
    let hdr = enumerator.getNext();
  }
  return count;
}

function run_test()
{
  // XXX Disabled due to intermittent failures, bug 502928 will fix.
  return 0;

  // Add a listener.
  gIMAPDaemon = new imapDaemon();
  gServer = makeServer(gIMAPDaemon, "");

  gIMAPIncomingServer = createLocalIMAPServer();

  if (!gLocalInboxFolder)
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
  prefBranch.setIntPref("mail.server.default.max_cached_connections", 1);
  // We aren't interested in downloading messages automatically
  prefBranch.setBoolPref("mail.server.default.download_on_biff", false);

  gEmptyLocal1 = gLocalIncomingServer.rootFolder.addSubfolder("empty 1");
  gEmptyLocal2 = gLocalIncomingServer.rootFolder.addSubfolder("empty 2");
  gIMAPIncomingServer.performExpand(null);

  gRootFolder = gIMAPIncomingServer.rootFolder;
  gIMAPInbox = gRootFolder.getChildNamed("INBOX");
  dump("gIMAPInbox uri = " + gIMAPInbox.URI + "\n");
  let msgImapFolder = gIMAPInbox.QueryInterface(Ci.nsIMsgImapMailFolder);
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
  gCurTestNum = 1;
  doTest();
}

function doTest()
{
  var test = gCurTestNum;
  if (test <= gTestArray.length)
  {
    dump("Doing test " + test + "\n");

    var testFn = gTestArray[test-1];
    // Set a limit of ten seconds; if the notifications haven't arrived by then there's a problem.
    do_timeout(10000, "if (gCurTestNum == "+test+") \
      do_throw('Notifications not received in 10000 ms for operation "+testFn.name+", current status is '+gCurrStatus);");
    try {
    testFn();
    } catch(ex) {
      gServer.stop();
      do_throw ('TEST FAILED ' + ex);
    }
  }
  else
    do_timeout(1000, "endTest();");
}

// nsIMsgCopyServiceListener implementation - runs next test when copy
// is completed.
var CopyListener =
{
  OnStartCopy: function OnStartCopy() {},
  OnProgress: function OnProgress(aProgress, aProgressMax) {},
  SetMessageKey: function SetMessageKey(aKey)
  {
    gLastKey = aKey;
  },
  SetMessageId: function SetMessageId(aMessageId) {},
  OnStopCopy: function OnStopCopy(aStatus)
  {
    dump("in OnStopCopy " + gCurTestNum + "\n");
    // Check: message successfully copied.
    do_check_eq(aStatus, 0);
    // Ugly hack: make sure we don't get stuck in a JS->C++->JS->C++... call stack
    // This can happen with a bunch of synchronous functions grouped together, and
    // can even cause tests to fail because they're still waiting for the listener
    // to return
    ++gCurTestNum;
    do_timeout(0, "doTest()");
  }
};

// nsIURLListener implementation - runs next test
var URLListener =
{
  OnStartRunningUrl: function OnStartRunningUrl(aURL) {},
  OnStopRunningUrl: function OnStopRunningUrl(aURL, aStatus)
  {
    dump("in OnStopRunningURL " + gCurTestNum + "\n");
    do_check_eq(aStatus, 0);
    gCurTestNum++;
    do_timeout(0, "doTest();");
  }
}

function endTest()
{
  // Cleanup, null out everything, close all cached connections and stop the
  // server
  dump(" Exiting mail tests\n");
  gMessages.clear();
  gRootFolder = null;
  gIMAPInbox = null;
  gIMAPTrashFolder = null;
  gEmptyLocal1 = null;
  gEmptyLocal2 = null;
  gServer.resetTest();
  gIMAPIncomingServer.closeCachedConnections();
  gServer.performTest();
  gServer.stop();
  let thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);
  gPOP3Pump = null;

  do_test_finished(); // for the one in run_test()
}

function listMessages(folder) {
  let enumerator = folder.msgDatabase.EnumerateMessages();
  var msgCount = 0;
  dump("listing messages for " + folder.prettyName + "\n");
  while(enumerator.hasMoreElements())
  {
    msgCount++;
    let hdr = enumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr);
    dump(msgCount + ": " + hdr.subject + "\n");
  }
}

