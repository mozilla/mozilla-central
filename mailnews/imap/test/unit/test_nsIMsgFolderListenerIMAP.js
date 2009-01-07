/* -*- Mode: Javascript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 *
 * Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/licenses/publicdomain/
 *
 * ***** END LICENSE BLOCK ***** */

/*
* Test suite for nsIMsgFolderListener events due to IMAP operations
*
* Currently tested
* - Adding new folders
* - Copying messages from files to mailboxes
* - Adding new messages directly to mailboxes
*/

do_import_script("../mailnews/base/test/resources/msgFolderListenerSetup.js");

// Globals
var gRootFolder;
var gIMAPInbox, gIMAPFolder2, gIMAPFolder3, gIMAPTrashFolder;
var gIMAPDaemon, gServer, gIMAPIncomingServer;
const gMsgFile1 = do_get_file("../mailnews/test/data/bugmail10");
const gMsgFile2 = do_get_file("../mailnews/test/data/bugmail11");
const gMsgFile3 = do_get_file("../mailnews/test/data/draft1");
const gMsgFile4 = do_get_file("../mailnews/test/data/bugmail7");
const gMsgFile5 = do_get_file("../mailnews/test/data/bugmail6");

// Copied straight from the example files
const gMsgId1 = "200806061706.m56H6RWT004933@mrapp54.mozilla.org";
const gMsgId2 = "200804111417.m3BEHTk4030129@mrapp51.mozilla.org";
const gMsgId3 = "4849BF7B.2030800@example.com";
const gMsgId4 = "bugmail7.m47LtAEf007542@mrapp51.mozilla.org";
const gMsgId5 = "bugmail6.m47LtAEf007542@mrapp51.mozilla.org";

function addFolder(parent, folderName, storeIn)
{
  gServer.resetTest();
  gExpectedEvents = [[gMFNService.folderAdded, parent, folderName, storeIn]];
  // No copy listener notification for this
  gCurrStatus |= kStatus.onStopCopyDone;
  parent.createSubfolder(folderName, null);
  gCurrStatus |= kStatus.functionCallDone;
  gServer.performTest("LIST");
  if (gCurrStatus == kStatus.everythingDone)
    resetStatusAndProceed();
}

function copyFileMessage(file, messageId, destFolder)
{
  gServer.resetTest();
  copyListener.mFolderStoredIn = destFolder;

  // This *needs* to be a draft (fourth parameter), as for non-UIDPLUS servers,
  // nsImapProtocol::UploadMessageFromFile is hardcoded not to send a copy
  // listener notification. The same function also asks for the message id from
  // the copy listener, without which it will *not* send the notification.

  // ...but wait, nsImapProtocol.cpp requires SEARCH afterwards to retrieve the
  // message header, and fakeserver doesn't implement it yet. So get it to fail
  // earlier by *not* sending the message id.
  // copyListener.mMessageId = messageId;

  // Instead store the message id in gExpectedEvents, so we can match that up
  gExpectedEvents = [[gMFNService.msgAdded, {expectedMessageId: messageId}]];
  destFolder.updateFolder(null);
  gCopyService.CopyFileMessage(file, destFolder, null, true, 0, "", copyListener, null);
  gCurrStatus |= kStatus.functionCallDone;
  gServer.performTest("APPEND");
  // Allow some time for the append operation to complete, so update folder
  // every second
  gFolderBeingUpdated = destFolder;
  doUpdateFolder(gTest);
}

var gFolderBeingUpdated = null;
function doUpdateFolder(test)
{
  // In case we've moved on to the next test, exit
  if (gTest > test)
    return;

  gFolderBeingUpdated.updateFolder(null);

  if (gCurrStatus == kStatus.everythingDone)
    resetStatusAndProceed();
  else
    do_timeout(1000, "doUpdateFolder(" + test + ")");
}

// Adds some messages directly to a mailbox (eg new mail)
function addMessagesToServer(messages, mailbox, localFolder)
{
  let ioService = Cc["@mozilla.org/network/io-service;1"]
                    .getService(Ci.nsIIOService);

  // For every message we have, we need to convert it to a file:/// URI
  messages.forEach(function (message)
  {
    let URI = ioService.newFileURI(message.file).QueryInterface(Ci.nsIFileURL);
    message.spec = URI.spec;
    // We can't get the headers again, so just pass on the message id
    gExpectedEvents.push([gMFNService.msgAdded, {expectedMessageId: message.messageId}]);
  });

  // Create the imapMessages and store them on the mailbox
  messages.forEach(function (message)
  {
    mailbox.addMessage(new imapMessage(message.spec, mailbox.uidnext++, []));
  });

  // No copy listener notification for this
  gCurrStatus |= kStatus.functionCallDone | kStatus.onStopCopyDone;

  gFolderBeingUpdated = localFolder;
  doUpdateFolder(gTest);
}

function copyMessages(messages, isMove, srcFolder, destFolder)
{
  let array = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
  messages.forEach(function (message)
  {
    array.appendElement(message, false);
  });
  gExpectedEvents = [[gMFNService.msgsMoveCopyCompleted, isMove, messages, destFolder]];
  // We'll also get the msgAdded events when we go and update the destination
  // folder
  messages.forEach(function (message)
  {
    // We can't use the headers directly, because the notifications we'll
    // receive are for message headers in the destination folder
    gExpectedEvents.push([gMFNService.msgAdded, {expectedMessageId: message.messageId}]);
  });
  gCopyService.CopyMessages(srcFolder, array, destFolder, isMove, copyListener, null, true);
  gCurrStatus |= kStatus.functionCallDone;

  gServer.performTest("COPY");

  gFolderBeingUpdated = destFolder;
  doUpdateFolder(gTest);
  if (gCurrStatus == kStatus.everythingDone)
    resetStatusAndProceed();
}

const gTestArray =
[
  // Adding folders
  // Create another folder to move and copy messages around, and force initialization.
  function testAddFolder1() { addFolder(gRootFolder, "folder2", "gIMAPFolder2") },
  function testAddFolder2() { addFolder(gRootFolder, "folder3", "gIMAPFolder3") },

  // Adding messages to folders
  function testCopyFileMessage1()
  {
    // Make sure the offline flag is not set for any of the folders
    [gIMAPInbox, gIMAPFolder2, gIMAPFolder3].forEach(function (folder)
    {
      folder.flags &= ~Ci.nsMsgFolderFlags.Offline;
    });
    copyFileMessage(gMsgFile1, gMsgId1, gIMAPInbox)
  },
  function testCopyFileMessage2() { copyFileMessage(gMsgFile2, gMsgId2, gIMAPInbox) },

  // Add message straight to the server, so that we get a message added
  // notification on the next folder update
  function testNewMessageArrival1() {
    addMessagesToServer([{file: gMsgFile3, messageId: gMsgId3}],
                        gIMAPDaemon.getMailbox("INBOX"), gIMAPInbox)
  },

  // Add another couple of messages, this time to another folder on the server
  function testNewMessageArrival2() {
    addMessagesToServer([{file: gMsgFile4, messageId: gMsgId4},
                         {file: gMsgFile5, messageId: gMsgId5}],
                        gIMAPDaemon.getMailbox("INBOX"), gIMAPInbox);
  },

  // Moving/copying messages (this doesn't work right now)
  /* function testCopyMessages1() { copyMessages([gMsgHdrs[0].hdr, gMsgHdrs[1].hdr], false, gIMAPInbox, gIMAPFolder3) } */
];

function run_test()
{
  // This is before any of the actual tests, so...
  gTest = 0;

  // Add a listener.
  gMFNService.addListener(gMFListener, gMFNService.all);
  gIMAPDaemon = new imapDaemon();
  gServer = makeServer(gIMAPDaemon, "");

  gIMAPIncomingServer = createLocalIMAPServer();

  // Also make sure a local folders server is created, as that's what is used
  // for sent items
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

  // Get the server list...
  gIMAPIncomingServer.performExpand(null);

  // We get these notifications on initial discovery
  gRootFolder = gIMAPIncomingServer.rootFolder;
  gIMAPInbox = gRootFolder.getChildNamed("Inbox");
  gExpectedEvents = [[gMFNService.folderAdded, gRootFolder, "Trash", "gIMAPTrashFolder"],
                     [gMFNService.folderDeleted, [gIMAPInbox]]];
  gCurrStatus |= kStatus.onStopCopyDone | kStatus.functionCallDone;

  gServer.performTest("SUBSCRIBE");

  // "Master" do_test_pending(), paired with a do_test_finished() at the end of
  // all the operations.
  do_test_pending();
}

function doTest(test)
{
  dump("Doing test " + test + "\n");
  if (test <= gTestArray.length)
  {
    let testFn = gTestArray[test-1];

    // Set a limit of ten seconds; if the notifications haven't arrived by then there's a problem.
    do_timeout(10000, "if (gTest == "+test+") \
      do_throw('Notifications not received in 10000 ms for operation "+testFn.name+", current status is '+gCurrStatus);");
    testFn();
  }
  else
  {
    gMFNService.removeListener(gMFListener);
    // Cleanup, null out everything, close all cached connections and stop the
    // server
    gRootFolder = null;
    gIMAPInbox = null;
    gIMAPFolder2 = null;
    gIMAPFolder3 = null;
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
}
