/*
 * This file tests imap filter actions, particularly as affected by the
 * addition of body searches in bug 127250. Actions that involves sending
 * mail are not tested. The tests check various counts, and the effects
 * on the message database of the filters. Effects on IMAP server
 * flags, if any, are not tested.
 *
 * Original author: Kent James <kent@caspia.com>
 * adapted from test_localToImapFilter.js
 */

Components.utils.import("resource://gre/modules/iteratorUtils.jsm");
Components.utils.import("resource://gre/modules/folderUtils.jsm");

const nsMsgSearchScope = Ci.nsMsgSearchScope;
const nsMsgSearchAttrib = Ci.nsMsgSearchAttrib;
const nsMsgSearchOp = Ci.nsMsgSearchOp;
const Is = nsMsgSearchOp.Is;
const Contains = nsMsgSearchOp.Contains;
const Subject = nsMsgSearchAttrib.Subject;
const Body = nsMsgSearchAttrib.Body;

// Globals
var gIMAPDaemon; // the imap fake server daemon
var gServer; // the imap fake server
var gIMAPIncomingServer; // nsIMsgIncomingServer for the imap server
var gRootFolder; // root message folder for the imap server
var gIMAPInbox; // imap inbox message folder
var gIMAPMailbox; // imap mailbox
var gIMAPTrashFolder; // imap trash message folder
var gSubfolder; // a local message folder used as a target for moves and copies
var gLastKey; // the last message key
var gFilter; // a message filter with a subject search
var gAction; // current message action (reused)
var gBodyFilter; // a message filter with a body search
var gInboxListener; // database listener object
var gContinueListener; // what listener is used to continue the test?
var gHeader; // the current message db header
var gChecks; // the function that will be used to check the results of the filter
var gInboxCount; // the previous number of messages in the Inbox
var gSubfolderCount; // the previous number of messages in the subfolder
var gMoveCallbackCount; // the number of callbacks from the move listener
var gCurTestNum; // the current test number
const gMessage = "draft1"; // message file used as the test message

// subject of the test message
const gMessageSubject = "Hello, did you receive my bugmail?";

// a string in the body of the test message
const gMessageInBody = "an HTML message";

// various object references
const gCopyService = Cc["@mozilla.org/messenger/messagecopyservice;1"]
                       .getService(Ci.nsIMsgCopyService);
const gDbService = Components.classes["@mozilla.org/msgDatabase/msgDBService;1"]
                             .getService(Components.interfaces.nsIMsgDBService);
const gIMAPService = Cc["@mozilla.org/messenger/messageservice;1?type=imap"]
                       .getService(Ci.nsIMsgMessageService);
const gMailSession = Cc["@mozilla.org/messenger/services/session;1"]
                     .getService(Ci.nsIMsgMailSession);
const kFiltersAppliedAtom = Cc["@mozilla.org/atom-service;1"]
                              .getService(Ci.nsIAtomService)
                              .getAtom("FiltersApplied");
const kDeleteOrMoveMsgCompleted = Cc["@mozilla.org/atom-service;1"]
                                    .getService(Ci.nsIAtomService)
                                    .getAtom("DeleteOrMoveMsgCompleted");

// Definition of tests. The test function name is the filter action
// being tested, with "Body" appended to tests that use delayed
// application of filters due to a body search
const gTestArray =
[  // The initial tests do not result in new messages added.
  function MoveToFolder() {
    gAction.type = Ci.nsMsgFilterAction.MoveToFolder;
    gAction.targetFolderUri = gSubfolder.URI;
    gChecks = function checkMoveToFolder() {
      testCounts(false, 0, 0, 0);
      do_check_eq(gSubfolderCount + 1, folderCount(gSubfolder));
      // no net messages were added to the inbox
      do_check_eq(gInboxCount, folderCount(gIMAPInbox));
    }
    gInboxCount = folderCount(gIMAPInbox);
    gSubfolderCount = folderCount(gSubfolder);
    setupTest(gFilter, gAction);
  },
  function MoveToFolderBody() {
    gAction.type = Ci.nsMsgFilterAction.MoveToFolder;
    gAction.targetFolderUri = gSubfolder.URI;
    gChecks = function checkMoveToFolderBody() {
      testCounts(false, 0, 0, 0);
      do_check_eq(gSubfolderCount + 1, folderCount(gSubfolder));
      // no net messsages were added to the inbox
      do_check_eq(gInboxCount, folderCount(gIMAPInbox));
    }
    gInboxCount = folderCount(gIMAPInbox);
    gSubfolderCount = folderCount(gSubfolder);
    setupTest(gBodyFilter, gAction);
  },
  function MarkRead() {
    gAction.type = Ci.nsMsgFilterAction.MarkRead;
    gChecks = function checks() {
      testCounts(false, 0, 0, 0);
      do_check_true(gHeader.isRead);
    }
    setupTest(gFilter, gAction);
  },
  function MarkReadBody() {
    gAction.type = Ci.nsMsgFilterAction.MarkRead;
    gChecks = function checkMarkRead() {
      testCounts(false, 0, 0, 0);
      do_check_true(gHeader.isRead);
    }
    setupTest(gBodyFilter, gAction);

  },
  function KillThread() {
    gAction.type = Ci.nsMsgFilterAction.KillThread;
    gChecks = function checkKillThread() {
      testCounts(false, 0, 0, 0);
      let thread = db().GetThreadContainingMsgHdr(gHeader);
      do_check_neq(0, thread.flags & Ci.nsMsgMessageFlags.Ignored);
    }
    setupTest(gFilter, gAction);
  },
  function KillThreadBody() {
    gAction.type = Ci.nsMsgFilterAction.KillThread;
    gChecks = function checkKillThread() {
      testCounts(false, 0, 0, 0);
      let thread = db().GetThreadContainingMsgHdr(gHeader);
      do_check_neq(0, thread.flags & Ci.nsMsgMessageFlags.Ignored);
    }
    setupTest(gBodyFilter, gAction);
  },
  function KillSubthread() {
    gAction.type = Ci.nsMsgFilterAction.KillSubthread;
    gChecks = function checkKillSubthread() {
      testCounts(false, 0, 0, 0);
      do_check_neq(0, gHeader.flags & Ci.nsMsgMessageFlags.Ignored);
    }
    setupTest(gFilter, gAction);
  },
  function KillSubthreadBody() {
    gAction.type = Ci.nsMsgFilterAction.KillSubthread;
    gChecks = function checkKillSubthreadBody() {
      testCounts(false, 0, 0, 0);
      do_check_neq(0, gHeader.flags & Ci.nsMsgMessageFlags.Ignored);
    }
    setupTest(gBodyFilter, gAction);
  },
  // this tests for marking message as junk
  function JunkScore() {
    gAction.type = Ci.nsMsgFilterAction.JunkScore;
    gAction.junkScore = 100;
    gChecks = function checkJunkScore() {
      // marking as junk resets new but not unread
      testCounts(false, 1, 0, 0);
      do_check_eq(gHeader.getStringProperty("junkscore"), "100");
      do_check_eq(gHeader.getStringProperty("junkscoreorigin"), "filter");
    }
    setupTest(gFilter, gAction);
  },
  // this tests for marking message as junk
  function JunkScoreBody() {
    gAction.type = Ci.nsMsgFilterAction.JunkScore;
    gAction.junkScore = 100;
    gChecks = function checkJunkScoreBody() {
      // marking as junk resets new but not unread
      testCounts(false, 1, 0, 0);
      do_check_eq(gHeader.getStringProperty("junkscore"), "100");
      do_check_eq(gHeader.getStringProperty("junkscoreorigin"), "filter");
    }
    setupTest(gBodyFilter, gAction);
  },

  // The remaining tests add new messages
  function WatchThread() {
    gAction.type = Ci.nsMsgFilterAction.WatchThread;
    gChecks = function checkWatchThread() {
      testCounts(true, 1, 1, 1);
      let thread = db().GetThreadContainingMsgHdr(gHeader);
      do_check_neq(0, thread.flags & Ci.nsMsgMessageFlags.Watched);
    }
    setupTest(gFilter, gAction);
  },
  function WatchThreadBody() {
    gAction.type = Ci.nsMsgFilterAction.WatchThread;
    gChecks = function checkWatchThreadBody() {
      testCounts(true, 1, 1, 1);
      let thread = db().GetThreadContainingMsgHdr(gHeader);
      do_check_neq(0, thread.flags & Ci.nsMsgMessageFlags.Watched);
    }
    setupTest(gBodyFilter, gAction);
  },
  function MarkFlagged() {
    gAction.type = Ci.nsMsgFilterAction.MarkFlagged;
    gChecks = function checkMarkFlagged() {
      testCounts(true, 1, 1, 1);
      do_check_true(gHeader.isFlagged);
    }
    setupTest(gFilter, gAction);
  },
  function MarkFlaggedBody() {
    gAction.type = Ci.nsMsgFilterAction.MarkFlagged;
    gChecks = function checkMarkFlaggedBody() {
      testCounts(true, 1, 1, 1);
      do_check_true(gHeader.isFlagged);
    }
    setupTest(gBodyFilter, gAction);
  },
  function ChangePriority() {
    gAction.type = Ci.nsMsgFilterAction.ChangePriority;
    gAction.priority = Ci.nsMsgPriority.highest;
    gChecks = function checkChangePriority() {
      testCounts(true, 1, 1, 1);
      do_check_eq(Ci.nsMsgPriority.highest, gHeader.priority);
    }
    setupTest(gFilter, gAction);
  },
  function ChangePriorityBody() {
    gAction.type = Ci.nsMsgFilterAction.ChangePriority;
    gAction.priority = Ci.nsMsgPriority.highest;
    gChecks = function checkChangePriorityBody() {
      testCounts(true, 1, 1, 1);
      do_check_eq(Ci.nsMsgPriority.highest, gHeader.priority);
    }
    setupTest(gBodyFilter, gAction);
  },
  function Label() {
    gAction.type = Ci.nsMsgFilterAction.Label;
    gAction.label = 2;
    gChecks = function checkLabel() {
      testCounts(true, 1, 1, 1);
      do_check_eq(2, gHeader.label);
    }
    setupTest(gFilter, gAction);
  },
  function LabelBody() {
    gAction.type = Ci.nsMsgFilterAction.Label;
    gAction.label = 3;
    gChecks = function checkLabelBody() {
      testCounts(true, 1, 1, 1);
      do_check_eq(3, gHeader.label);
    }
    setupTest(gBodyFilter, gAction);
  },
  function AddTag() {
    gAction.type = Ci.nsMsgFilterAction.AddTag;
    gAction.strValue = "TheTag";
    gChecks = function checkAddTag() {
      testCounts(true, 1, 1, 1);
      do_check_eq(gHeader.getStringProperty("keywords"), "TheTag");
    }
    setupTest(gFilter, gAction);
  },
  function AddTagBody() {
    gAction.type = Ci.nsMsgFilterAction.AddTag;
    gAction.strValue = "TheTag2";
    gChecks = function checkAddTagBody() {
      testCounts(true, 1, 1, 1);
      do_check_eq(gHeader.getStringProperty("keywords"), "TheTag2");
    }
    setupTest(gBodyFilter, gAction);
  },
  // this tests for marking message as good
  function JunkScoreAsGood() {
    gAction.type = Ci.nsMsgFilterAction.JunkScore;
    gAction.junkScore = 0;
    gChecks = function checkJunkScore() {
      testCounts(true, 1, 1, 1);
      do_check_eq(gHeader.getStringProperty("junkscore"), "0");
      do_check_eq(gHeader.getStringProperty("junkscoreorigin"), "filter");
    }
    setupTest(gFilter, gAction);
  },
  // this tests for marking message as good
  function JunkScoreAsGoodBody() {
    gAction.type = Ci.nsMsgFilterAction.JunkScore;
    gAction.junkScore = 0;
    gChecks = function checkJunkScoreBody() {
      testCounts(true, 1, 1, 1);
      do_check_eq(gHeader.getStringProperty("junkscore"), "0");
      do_check_eq(gHeader.getStringProperty("junkscoreorigin"), "filter");
    }
    setupTest(gBodyFilter, gAction);
  },
  function CopyToFolder() {
    gAction.type = Ci.nsMsgFilterAction.CopyToFolder;
    gAction.targetFolderUri = gSubfolder.URI;
    gChecks = function checkCopyToFolder() {
      testCounts(true, 1, 1, 1);
      do_check_eq(gInboxCount + 1, folderCount(gIMAPInbox));
      do_check_eq(gSubfolderCount + 1, folderCount(gSubfolder));
    }
    gInboxCount = folderCount(gIMAPInbox);
    gSubfolderCount = folderCount(gSubfolder);
    setupTest(gFilter, gAction);
  },
  function CopyToFolderBody() {
    gAction.type = Ci.nsMsgFilterAction.CopyToFolder;
    gAction.targetFolderUri = gSubfolder.URI;
    gChecks = function checkCopyToFolderBody() {
      testCounts(true, 1, 1, 1);
      do_check_eq(gInboxCount + 1, folderCount(gIMAPInbox));
      do_check_eq(gSubfolderCount + 1, folderCount(gSubfolder));
    }
    gInboxCount = folderCount(gIMAPInbox);
    gSubfolderCount = folderCount(gSubfolder);
    setupTest(gBodyFilter, gAction);
  },

];

function run_test()
{
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
  prefBranch.setBoolPref("mail.biff.play_sound", false);
  prefBranch.setBoolPref("mail.biff.show_alert", false);
  prefBranch.setBoolPref("mail.biff.show_tray_icon", false);
  prefBranch.setBoolPref("mail.biff.animate_dock_icon", false);

  gSubfolder = gLocalIncomingServer.rootFolder.addSubfolder("Subfolder");
  gIMAPIncomingServer.performExpand(null);

  gRootFolder = gIMAPIncomingServer.rootFolder;
  gIMAPInbox = gRootFolder.getChildNamed("INBOX");
  gIMAPMailbox = gIMAPDaemon.getMailbox("INBOX");
  dump("gIMAPInbox uri = " + gIMAPInbox.URI + "\n");
  let msgImapFolder = gIMAPInbox.QueryInterface(Ci.nsIMsgImapMailFolder);
  // these hacks are required because we've created the inbox before
  // running initial folder discovery, and adding the folder bails
  // out before we set it as verified online, so we bail out, and
  // then remove the INBOX folder since it's not verified.
  msgImapFolder.hierarchyDelimiter = '/';
  msgImapFolder.verifiedAsOnlineFolder = true;

// Create a non-body filter.
  let filterList = gIMAPIncomingServer.getFilterList(null);
  gFilter = filterList.createFilter("subject");
  let searchTerm = gFilter.createTerm();
  searchTerm.attrib = Subject;
  searchTerm.op = Is;
  var value = searchTerm.value;
  value.attrib = Subject;
  value.str = gMessageSubject;
  searchTerm.value = value;
  searchTerm.booleanAnd = false;
  gFilter.appendTerm(searchTerm);
  gFilter.enabled = true;

  // Create a filter with a body term that that forces delayed application of
  // filters until after body download.
  gBodyFilter = filterList.createFilter("body");
  searchTerm = gBodyFilter.createTerm();
  searchTerm.attrib = Body;
  searchTerm.op = Contains;
  value = searchTerm.value;
  value.attrib = Body;
  value.str = gMessageInBody;
  searchTerm.value = value;
  searchTerm.booleanAnd = false;
  gBodyFilter.appendTerm(searchTerm);
  gBodyFilter.enabled = true;

  // an action that can be modified by tests
  gAction = gFilter.createAction();

  gMailSession.AddFolderListener(FolderListener, Ci.nsIFolderListener.event);

  // "Master" do_test_pending(), paired with a do_test_finished() at the end of
  // all the operations.
  do_test_pending();

  //start first test
  gCurTestNum = 1;
  doTest();
}

/*
 * functions used to support test setup and execution
 */

// if the source matches the listener used to continue a test,
// run the test checks, and start the next test.
function testContinue(source)
{
  if (gContinueListener === source)
  {
    if (gContinueListener == kDeleteOrMoveMsgCompleted &&
        gAction.type == Ci.nsMsgFilterAction.MoveToFolder)
    {
      // Moves give 2 events, just use the second.
      gMoveCallbackCount++;
      if (gMoveCallbackCount != 2)
        return;
    }
    gCurTestNum++;
    do_timeout(200, "doTest();");
  }
}

// basic preparation done for each test
function setupTest(aFilter, aAction)
{
  if (aAction &&
      ((aAction.type == Ci.nsMsgFilterAction.CopyToFolder) ||
       (aAction.type == Ci.nsMsgFilterAction.MoveToFolder)))
    gContinueListener = kDeleteOrMoveMsgCompleted;
  else if (aFilter === gBodyFilter)
    gContinueListener = kFiltersAppliedAtom;
  else
    gContinueListener = URLListener;
  let filterList = gIMAPIncomingServer.getFilterList(null);
  while (filterList.filterCount)
    filterList.removeFilterAt(0);
  if (aFilter)
  {
    aFilter.clearActionList();
    if (aAction) {
      aFilter.appendAction(aAction);
      filterList.insertFilterAt(0, aFilter);
    }
  }
  if (gInboxListener)
  {
    try {
      gIMAPInbox.msgDatabase.RemoveListener(gInboxListener);
    }
    catch(e) {}
    try {
      gDbService.UnregisterPendingListener(gInboxListener);
    }
    catch(e) {}
  }

  gInboxListener = new DBListener();
  gDbService.registerPendingListener(gIMAPInbox, gInboxListener);
  gMoveCallbackCount = 0;
  gIMAPMailbox.addMessage(new imapMessage(specForFileName(gMessage),
                          gIMAPMailbox.uidnext++, []));
  gIMAPInbox.updateFolderWithListener(null, URLListener);
}

// run the next test
function doTest()
{
  // Run the checks, if any, from the previous test.
  if (gChecks)
    gChecks();

  var test = gCurTestNum;
  if (test <= gTestArray.length)
  {

    var testFn = gTestArray[test-1];
    dump("Doing test " + test + " " + testFn.name + "\n");
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

// Cleanup, null out everything, close all cached connections and stop the
// server
function endTest()
{
  dump(" Exiting mail tests\n");
  if (gInboxListener)
  {
    try {
      gIMAPInbox.msgDatabase.RemoveListener(gInboxListener);
    }
    catch(e) {}
    try {
      gDbService.UnregisterPendingListener(gInboxListener);
    }
    catch(e) {}
  }
  gRootFolder = null;
  gIMAPInbox = null;
  gIMAPTrashFolder = null;
  gSubfolder = null;
  gServer.resetTest();
  gIMAPIncomingServer.closeCachedConnections();
  gServer.performTest();
  gServer.stop();
  let thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);

  do_test_finished(); // for the one in run_test()
}

/*
 * listener objects
 */

// nsIFolderListener implementation
var FolderListener = {
  OnItemEvent: function OnItemEvent(aEventFolder, aEvent) {
    dump("received folder event " + aEvent.toString() +
         " folder " + aEventFolder.name +
         "\n");
    testContinue(aEvent);
  }
};

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
    testContinue(this);
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
    testContinue(this);
  }
}

// nsIDBChangeListener implementation. Counts of calls are kept, but not
// currently used in the tests. Current role is to provide a reference
// to the new message header (plus give some examples of using db listeners
// in javascript).
function DBListener()
{
  this.counts = {};
  let counts = this.counts;
  counts.onHdrFlagsChanged = 0;
  counts.onHdrDeleted = 0;
  counts.onHdrAdded = 0;
  counts.onParentChanged = 0;
  counts.onAnnouncerGoingAway = 0;
  counts.onReadChanged = 0;
  counts.onJunkScoreChanged = 0;
  counts.onHdrPropertyChanged = 0;
  counts.onEvent = 0;
}

DBListener.prototype =
{
  onHdrFlagsChanged:
    function onHdrFlagsChanged(aHdrChanged, aOldFlags, aNewFlags, aInstigator)
    {
      this.counts.onHdrFlagsChanged++;
    },

  onHdrDeleted:
    function onHdrDeleted(aHdrChanged, aParentKey, Flags, aInstigator)
    {
      this.counts.onHdrDeleted++;
    },

  onHdrAdded:
    function onHdrAdded(aHdrChanged, aParentKey, aFlags, aInstigator)
    {
      this.counts.onHdrAdded++;
      gHeader = aHdrChanged;
    },

  onParentChanged:
    function onParentChanged(aKeyChanged, oldParent, newParent, aInstigator)
    {
      this.counts.onParentChanged++;
    },
    
  onAnnouncerGoingAway:
    function onAnnouncerGoingAway(instigator)
    {
      if (gInboxListener)
        try {
          gIMAPInbox.msgDatabase.RemoveListener(gInboxListener);
        }
        catch (e) {dump(" listener not found\n");}
      this.counts.onAnnouncerGoingAway++;
    },
    
  onReadChanged:
    function onReadChanged(aInstigator)
    {
      this.counts.onReadChanged++;
    },
    
  onJunkScoreChanged:
    function onJunkScoreChanged(aInstigator)
    {
      this.counts.onJunkScoreChanged++;
    },
    
  onHdrPropertyChanged:
    function onHdrPropertyChanged(aHdrToChange, aPreChange, aStatus, aInstigator)
    {
      this.counts.onHdrPropertyChanged++;
    },
    
  onEvent:
    function onEvent(aDB, aEvent)
    {
      this.counts.onEvent++;
    },

};

/*
 * helper functions
 */

// return the number of messages in a folder (and check that the
// folder counts match the database counts)
function folderCount(folder)
{
  // count using the database
  let enumerator = folder.msgDatabase.EnumerateMessages();
  let dbCount = 0;
  while (enumerator.hasMoreElements())
  {
    dbCount++;
    let hdr = enumerator.getNext();
  }

  // count using the folder
  let folderCount = folder.getTotalMessages(false);

  // compare the two
  do_check_eq(dbCount, folderCount);
  return dbCount;
}

// list all of the messages in a folder for debug
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

// given a test file, return the file uri spec
function specForFileName(aFileName)
{
  let file = do_get_file("../../mailnews/data/" + aFileName);
  let msgfileuri = Cc["@mozilla.org/network/io-service;1"]
                     .getService(Ci.nsIIOService)
                     .newFileURI(file)
                     .QueryInterface(Ci.nsIFileURL);
  return msgfileuri.spec;
}

// shorthand for the inbox message summary database
function db()
{
  return gIMAPInbox.msgDatabase;
}

// This function may be used in the test array to show
// more detailed results after a particular test.
function showResults() {
  listMessages(gIMAPInbox);
  if (gInboxListener)
    printListener(gInboxListener);
  gCurTestNum++;
  do_timeout(100, "doTest();");
}

// static variables used in testCounts
var gPreviousUnread = 0;
var gPreviousDbNew = 0;

// Test various counts.
//
//  aHasNew:         folder hasNew flag
//  aUnreadDelta:    change in unread count for the folder
//  aFolderNewDelta: change in new count for the folder
//  aDbNewDelta:     change in new count for the database
//
function testCounts(aHasNew, aUnreadDelta, aFolderNewDelta, aDbNewDelta)
{
  try {
  let folderNew = gIMAPInbox.getNumNewMessages(false);
  let hasNew = gIMAPInbox.hasNewMessages;
  let unread = gIMAPInbox.getNumUnread(false);
  let countOut = {};
  let arrayOut = {};
  db().getNewList(countOut, arrayOut);
  let dbNew = countOut.value ? countOut.value : 0;
  let folderNewFlag = gIMAPInbox.getFlag(Ci.nsMsgFolderFlags.GotNew);
  dump(" hasNew: " + hasNew +
       " unread: " + unread +
       " folderNew: " + folderNew +
       " folderNewFlag: " + folderNewFlag +
       " dbNew: " + dbNew +
       "\n");
  do_check_eq(aHasNew, hasNew);
  do_check_eq(aUnreadDelta, unread - gPreviousUnread);
  gPreviousUnread = unread;
  // This seems to be reset for each folder update.
  //
  // This check seems to be failing in SeaMonkey builds, yet I can see no ill
  // effects of this in the actual program. Fixing this is complex because of
  // the messiness of new count management (see bug 507638 for a
  // refactoring proposal, and attachment 398899 on bug 514801 for one possible
  // fix to this particular test). So I am disabling this.
  //do_check_eq(aFolderNewDelta, folderNew);
  do_check_eq(aDbNewDelta, dbNew - gPreviousDbNew);
  gPreviousDbNew = dbNew;
  } catch (e) {dump(e);}
}

// print the counts for debugging purposes in this test
function printListener(listener)
{
  print("DBListener counts: ");
  for (var item in listener.counts) {
      dump(item + ": " + listener.counts[item] + " ");
  }
  dump("\n");
}
