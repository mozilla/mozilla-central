/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test to ensure that code that writes to the imap offline store deals
 * with offline store locking correctly.
 */

var gIMAPDaemon, gServer, gIMAPIncomingServer;

const gIMAPService = Cc["@mozilla.org/messenger/messageservice;1?type=imap"]
                       .getService(Ci.nsIMsgMessageService);

const nsIIOService = Cc["@mozilla.org/network/io-service;1"]
                       .getService(Ci.nsIIOService);

load("../../../resources/messageGenerator.js");

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

load("../../../resources/alertTestUtils.js");

// Globals
var gRootFolder;
var gIMAPInbox, gIMAPTrashFolder, gMsgImapInboxFolder;
var gIMAPDaemon, gServer, gIMAPIncomingServer;
var gImapInboxOfflineStoreSize;
var gCurTestNum;
var gGotAlert = false;
var gMovedMsgId;

var dummyDocShell =
{
  getInterface: function (iid) {
    if (iid.equals(Ci.nsIAuthPrompt)) {
      return Cc["@mozilla.org/login-manager/prompter;1"]
               .getService(Ci.nsIAuthPrompt);
    }

    throw Components.results.NS_ERROR_FAILURE;
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIDocShell,
                                         Ci.nsIInterfaceRequestor])
}

// Dummy message window that ensures we get prompted for logins.
var dummyMsgWindow =
{
  rootDocShell: dummyDocShell,
  promptDialog: alertUtilsPrompts,

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIMsgWindow,
                                         Ci.nsISupportsWeakReference])
};

function alert(aDialogTitle, aText) {
//  do_check_eq(aText.indexOf("Connection to server Mail for  timed out."), 0);
  gGotAlert = true;
}

function addGeneratedMessagesToServer(messages, mailbox)
{
  let ioService = Cc["@mozilla.org/network/io-service;1"]
                    .getService(Ci.nsIIOService);
  // Create the imapMessages and store them on the mailbox
  messages.forEach(function (message)
  {
    let dataUri = ioService.newURI("data:text/plain;base64," +
                                    btoa(message.toMessageString()),
                                   null, null);
    mailbox.addMessage(new imapMessage(dataUri.spec, mailbox.uidnext++, []));
  });
}

var gStreamedHdr = null;

function checkOfflineStore(prevOfflineStoreSize) {
  dump("checking offline store\n");
  let offset = new Object;
  let size = new Object;
  let enumerator = gIMAPInbox.msgDatabase.EnumerateMessages();
  if (enumerator)
  {
    while (enumerator.hasMoreElements())
    {
      let header = enumerator.getNext();
      // this will verify that the message in the offline store
      // starts with "From " - otherwise, it returns an error.
      if (header instanceof Components.interfaces.nsIMsgDBHdr &&
         (header.flags & Ci.nsMsgMessageFlags.Offline))
        gIMAPInbox.getOfflineFileStream(header.messageKey, offset, size).close();
    }
  }
  // check that the offline store shrunk by at least 100 bytes.
  // (exact calculation might be fragile).
  do_check_true(prevOfflineStoreSize > gIMAPInbox.filePath.fileSize + 100);
}

const gTestArray =
[
  function downloadForOffline() {
    // ...and download for offline use.
    dump("Downloading for offline use\n");
    gIMAPInbox.downloadAllForOffline(UrlListener, null);
  },
  function deleteOneMsg() {
    let enumerator = gIMAPInbox.msgDatabase.EnumerateMessages();
    let msgHdr = enumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr);
    let array = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
    array.appendElement(msgHdr, false);
    gIMAPInbox.deleteMessages(array, null, false, true, CopyListener, false);
  },
  function compactOneFolder() {
    let enumerator = gIMAPInbox.msgDatabase.EnumerateMessages();
    let msgHdr = enumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr);
    gStreamedHdr = msgHdr;
    // mark the message as not being offline, and then we'll make sure that
    // streaming the message while we're compacting doesn't result in the
    // message being marked for offline use.
    // Luckily, compaction compacts the offline store first, so it should
    // lock the offline store.
    gIMAPInbox.msgDatabase.MarkOffline(msgHdr.messageKey, false, null);
    let msgURI = msgHdr.folder.getUriForMsg(msgHdr);
    let messenger = Cc["@mozilla.org/messenger;1"].createInstance(Ci.nsIMessenger);
    let msgServ = messenger.messageServiceFromURI(msgURI);
    // UrlListener will get called when both expunge and offline store
    // compaction are finished. dummyMsgWindow is required to make the backend
    // compact the offline store.
    gIMAPInbox.compact(UrlListener, dummyMsgWindow);
    // Stream the message w/o a stream listener in an attempt to get the url
    // started more quickly, while the compact is still going on.
    msgServ.streamMessage(msgURI, null, null, UrlListener2, false, "", false);
    // We can't know which will finish first (compact or streaming), so we'll
    // have a dummy test. There's a chance that the stream won't start until
    // after the compact is finished, because the stream will get queued after
    // the expunge, which will hide failures. However, that's not happening
    // here.
  },
  function dummyTest() {
  },
  function deleteAnOtherMsg() {
    let enumerator = gIMAPInbox.msgDatabase.EnumerateMessages();
    let msgHdr = enumerator.getNext();
    let array = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
    array.appendElement(msgHdr, false);
    gIMAPInbox.deleteMessages(array, null, false, true, CopyListener, false);
  },
  function updateTrash() {
    gIMAPTrashFolder = gIMAPIncomingServer.rootFolder.getChildNamed("Trash")
                         .QueryInterface(Ci.nsIMsgImapMailFolder);
    // hack to force uid validity to get initialized for trash.
    gIMAPTrashFolder.updateFolderWithListener(null, UrlListener);
  },
  function downloadTrashForOffline() {
    // ...and download for offline use.
    dump("Downloading for offline use\n");
    gIMAPTrashFolder.downloadAllForOffline(UrlListener, null);
  },
  function testOfflineBodyCopy() {
    // In order to check that offline copy of messages doesn't try to copy
    // the body if the offline store is locked, we're going to go offline.
    // Thunderbird itself does move/copies pseudo-offline, but that's too
    // hard to test because of the half-second delay.
    gServer.stop();
    nsIIOService.offline = true;
    let trashHdr;
    let enumerator = gIMAPTrashFolder.msgDatabase.EnumerateMessages();
    let msgHdr = enumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr);
    gMovedMsgId = msgHdr.messageId;
    let array = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
    array.appendElement(msgHdr, false);
    const gCopyService = Cc["@mozilla.org/messenger/messagecopyservice;1"]
                          .getService(Ci.nsIMsgCopyService);

    gIMAPInbox.compact(UrlListener, dummyMsgWindow);
    gCopyService.CopyMessages(gIMAPTrashFolder, array, gIMAPInbox, true,
                              CopyListener, null, true);
  },
  function verifyNoOfflineMsg() {
    try {
    let movedMsg = gIMAPInbox.msgDatabase.getMsgHdrForMessageID(gMovedMsgId);
    do_check_false(movedMsg.flags & Ci.nsMsgMessageFlags.Offline);
    do_timeout(0, function(){doTest(++gCurTestNum)});
    } catch (ex) {dump(ex);}
  }
];

function run_test()
{
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
  prefBranch.setBoolPref("mail.server.default.autosync_offline_stores", false);
  // We aren't interested in downloading messages automatically
  prefBranch.setBoolPref("mail.server.server1.download_on_biff", false);

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

  let messageGenerator = new MessageGenerator();
  let messages = [];
  let bodyString = "";
  for (i = 0; i < 100; i++)
    bodyString += "1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890\r\n";

  for (let i = 0; i < 50; i++)
    messages = messages.concat(messageGenerator.makeMessage({body: {body: bodyString, contentType: "text/plain"}}));

  addGeneratedMessagesToServer(messages, gIMAPDaemon.getMailbox("INBOX"));

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
    // Set a limit of 10 seconds; if the notifications haven't arrived by then there's a problem.
    do_timeout(10000, function(){
        if (gCurTestNum == test) 
          do_throw("Notifications not received in 10000 ms for operation " + testFn.name);
        }
      );
    try {
    testFn();
    } catch(ex) {do_throw(ex);}
  }
  else
  {
    dump("finishing tests\n");
    // Cleanup, null out everything, close all cached connections and stop the
    // server
    gRootFolder = null;
    gIMAPInbox = null;
    gMsgImapInboxFolder = null;
    gIMAPTrashFolder = null;
    do_timeout_function(1000, endTest);
  }
}

function endTest()
{
  dump("in end test\n");

  do_test_finished(); // for the one in run_test()
}

// nsIMsgCopyServiceListener implementation - runs next test when copy
// is completed.
var CopyListener = 
{
  OnStartCopy: function() {},
  OnProgress: function(aProgress, aProgressMax) {},
  SetMessageKey: function(aKey)
  {
    let hdr = gLocalInboxFolder.GetMessageHeader(aKey);
    gMsgHdrs.push({hdr: hdr, ID: hdr.messageId});
  },
  SetMessageId: function(aMessageId) {},
  OnStopCopy: function(aStatus)
  {
    // Check: message successfully copied.
    do_check_eq(aStatus, 0);
    // Ugly hack: make sure we don't get stuck in a JS->C++->JS->C++... call stack
    // This can happen with a bunch of synchronous functions grouped together, and
    // can even cause tests to fail because they're still waiting for the listener
    // to return
    do_timeout(0, function(){doTest(++gCurTestNum)});
  }
};

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
    do_timeout(0, function(){doTest(++gCurTestNum)});
  }
};

var UrlListener2 = 
{
  OnStartRunningUrl: function(url) { },

  OnStopRunningUrl: function (aUrl, aExitCode) {
    // Check: message successfully copied.
    do_check_eq(aExitCode, 0);
    // Because we're streaming the message while compaction is going on,
    // we should not have stored it for offline use.
    dump("finished streaming " + gStreamedHdr.messageKey + "\n");
    do_check_false(gStreamedHdr.flags & Ci.nsMsgMessageFlags.Offline);
    do_timeout(0, function(){doTest(++gCurTestNum)});
  }
};
