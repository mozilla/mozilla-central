// This file extends test_imapFolderCopy.js to test message
// moves from a local folder to an IMAP folder.
//
// Original Author: Kent James <kent@caspia.com>


load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");
load("../../../resources/messageGenerator.js");

Components.utils.import("resource:///modules/mailServices.js");

var gEmptyLocal1, gEmptyLocal2;
var gLastKey;
var gMessages = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
var gCopyService = MailServices.copy;

Components.utils.import("resource:///modules/folderUtils.jsm");
Components.utils.import("resource:///modules/iteratorUtils.jsm");

var tests = [
  setup,
  function copyFolder1() {
    dump("gEmpty1 " + gEmptyLocal1.URI + "\n");
    let folders = new Array;
    folders.push(gEmptyLocal1.QueryInterface(Ci.nsIMsgFolder));
    let array = toXPCOMArray(folders, Ci.nsIMutableArray);
    gCopyService.CopyFolders(array, IMAPPump.inbox, false, CopyListener, null);
    yield false;
  },
  function copyFolder2() {
    dump("gEmpty2 " + gEmptyLocal2.URI + "\n");
    let folders = new Array;
    folders.push(gEmptyLocal2);
    let array = toXPCOMArray(folders, Ci.nsIMutableArray);
    gCopyService.CopyFolders(array, IMAPPump.inbox, false, CopyListener, null);
    yield false;
  },
  function getLocalMessage1() {
    dump("getLocalMessage\n");
    var file = do_get_file("../../../data/bugmail1");
    gCopyService.CopyFileMessage(file, localAccountUtils.inboxFolder, null, false, 0,
                                "", CopyListener, null);
    yield false;
  },
  function getLocalMessage2() {
    gMessages.appendElement(localAccountUtils.inboxFolder.GetMessageHeader(gLastKey),
                            false);
    dump("getLocalMessage\n");
    var file = do_get_file("../../../data/draft1");
    gCopyService.CopyFileMessage(file, localAccountUtils.inboxFolder, null, false, 0,
                                "", CopyListener, null);
    yield false;
  },
  function copyMessages() {
    gMessages.appendElement(localAccountUtils.inboxFolder.GetMessageHeader(gLastKey),
                            false);
    let folder1 = IMAPPump.inbox.getChildNamed("empty 1");
    gCopyService.CopyMessages(localAccountUtils.inboxFolder, gMessages, folder1, false,
                              CopyListener, null, false);
    yield false;
  },
  function moveMessages() {
    let folder2 = IMAPPump.inbox.getChildNamed("empty 2");
      gCopyService.CopyMessages(localAccountUtils.inboxFolder, gMessages, folder2, true,
                                CopyListener, null, false);
    yield false;
  },
  function update1() {
    let folder1 = IMAPPump.inbox.getChildNamed("empty 1").QueryInterface(Ci.nsIMsgImapMailFolder);
    folder1.updateFolderWithListener(null, asyncUrlListener);
    yield false;
  },
  function update2() {
    let folder2 = IMAPPump.inbox.getChildNamed("empty 2").QueryInterface(Ci.nsIMsgImapMailFolder);
    folder2.updateFolderWithListener(null, asyncUrlListener);
    yield false;
  },
  function verifyFolders() {
    let folder1 = IMAPPump.inbox.getChildNamed("empty 1");
    do_check_eq(folderCount(folder1), 2);
    let folder2 = IMAPPump.inbox.getChildNamed("empty 2");
    do_check_neq(folder2, null);
    // folder 1 and 2 should each now have two messages in them.
    do_check_neq(folder1, null);
    do_check_eq(folderCount(folder2), 2);
    // The local inbox folder should now be empty, since the second
    // operation was a move.
    do_check_eq(folderCount(localAccountUtils.inboxFolder), 0);
  },
  teardown
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

function setup() {
  // Turn off autosync_offline_stores because
  // fetching messages is invoked after copying the messages.
  // (i.e. The fetching process will be invoked after OnStopCopy)
  // It will cause crash with an assertion
  // (ASSERTION: tried to add duplicate listener: 'index == -1') on teardown.
  Services.prefs.setBoolPref("mail.server.default.autosync_offline_stores", false);

  setupIMAPPump();

  gEmptyLocal1 = localAccountUtils.rootFolder.createLocalSubfolder("empty 1");
  gEmptyLocal2 = localAccountUtils.rootFolder.createLocalSubfolder("empty 2");

  // these hacks are required because we've created the inbox before
  // running initial folder discovery, and adding the folder bails
  // out before we set it as verified online, so we bail out, and
  // then remove the INBOX folder since it's not verified.
  IMAPPump.inbox.hierarchyDelimiter = '/';
  IMAPPump.inbox.verifiedAsOnlineFolder = true;
}

// nsIMsgCopyServiceListener implementation - runs next test when copy
// is completed.
var CopyListener =
{
  OnStartCopy: function() {},
  OnProgress: function(aProgress, aProgressMax) {},
  SetMessageKey: function(aKey)
  {
    gLastKey = aKey;
  },
  SetMessageId: function(aMessageId) {},
  OnStopCopy: function(aStatus)
  {
    // Check: message successfully copied.
    do_check_eq(aStatus, 0);
    async_driver();
  }
};

asyncUrlListener.callback = function(aUrl, aExitCode) {
  do_check_eq(aExitCode, 0);
};

function teardown() {
  gMessages.clear();
  teardownIMAPPump();
}

function run_test() {
  async_run_tests(tests);
}

