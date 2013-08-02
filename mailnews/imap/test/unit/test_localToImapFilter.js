/*
 * This file tests copies of multiple messages using filters
 * from incoming POP3, with filter actions copying and moving
 * messages to IMAP folders. This test is adapted from
 * test_imapFolderCopy.js
 *
 * Original author: Kent James <kent@caspia.com>
 */

load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");
load("../../../resources/POP3pump.js");
Components.utils.import("resource:///modules/folderUtils.jsm");
Components.utils.import("resource:///modules/iteratorUtils.jsm");
Components.utils.import("resource:///modules/mailServices.js");

var gIMAPTrashFolder;
var gEmptyLocal1, gEmptyLocal2;
var gLastKey;
var gMessages = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
const gFiles = ["../../../data/bugmail1",
                "../../../data/draft1"];

var tests = [
  setup,
  function copyFolder1() {
    dump("gEmpty1 " + gEmptyLocal1.URI + "\n");
    let folders = new Array;
    folders.push(gEmptyLocal1.QueryInterface(Ci.nsIMsgFolder));
    let array = toXPCOMArray(folders, Ci.nsIMutableArray);
    MailServices.copy.CopyFolders(array, IMAPPump.inbox, false, CopyListener, null);
    yield false;
  },
  function copyFolder2() {
    dump("gEmpty2 " + gEmptyLocal2.URI + "\n");
    let folders = new Array;
    folders.push(gEmptyLocal2);
    let array = toXPCOMArray(folders, Ci.nsIMutableArray);
    MailServices.copy.CopyFolders(array, IMAPPump.inbox, false, CopyListener, null);
    yield false;
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
    copyAction.targetFolderUri = IMAPPump.inbox.getChildNamed("empty 1").URI;
    filter.appendAction(copyAction);
    let moveAction = filter.createAction();
    moveAction.type = Ci.nsMsgFilterAction.MoveToFolder;
    moveAction.targetFolderUri = IMAPPump.inbox.getChildNamed("empty 2").URI;
    filter.appendAction(moveAction);
    filter.enabled = true;
    filterList.insertFilterAt(0, filter);

    gPOP3Pump.files = gFiles;
    gPOP3Pump.onDone = async_driver;
    gPOP3Pump.run();
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
    listMessages(folder1);
    let folder2 = IMAPPump.inbox.getChildNamed("empty 2");
    listMessages(folder2);
    listMessages(localAccountUtils.inboxFolder);
    do_check_neq(folder1, null);
    do_check_neq(folder2, null);
    // folder 1 and 2 should each now have 2 messages in them.
    do_check_eq(folderCount(folder1), 2);
    do_check_eq(folderCount(folder2), 2);
    // the local inbox folder should now be empty, since the second
    // operation was a move
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
  setupIMAPPump(); 
  gEmptyLocal1 = localAccountUtils.incomingServer
                                  .rootFolder.createLocalSubfolder("empty 1");
  gEmptyLocal2 = localAccountUtils.incomingServer
                                  .rootFolder.createLocalSubfolder("empty 2");

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
  OnStartCopy: function OnStartCopy() {},
  OnProgress: function OnProgress(aProgress, aProgressMax) {},
  SetMessageKey: function SetMessageKey(aKey)
  {
    gLastKey = aKey;
  },
  SetMessageId: function SetMessageId(aMessageId) {},
  OnStopCopy: function OnStopCopy(aStatus)
  {
    // Check: message successfully copied.
    do_check_eq(aStatus, 0);
    async_driver();
  }
};

asyncUrlListener.callback = function(aUrl, aExitCode) {
  do_check_eq(aExitCode, 0);
};

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

function teardown() {
  gMessages.clear();
  gIMAPTrashFolder = null;
  gEmptyLocal1 = null;
  gEmptyLocal2 = null;
  gPOP3Pump = null;
  teardownIMAPPump();
}

function run_test() {
  async_run_tests(tests);
}
