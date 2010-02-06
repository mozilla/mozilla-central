/*
 * Test that junk actions work even when the bayes filtering of incoming
 *  messages is disabled, as fixed in bug 487610. Test developed by Kent
 *  James using test_nsMsgDBView.js as a base.
 */

load("../../mailnews/resources/logHelper.js");
load("../../mailnews/resources/asyncTestUtils.js");

load("../../mailnews/resources/messageGenerator.js");
load("../../mailnews/resources/messageModifier.js");
load("../../mailnews/resources/messageInjection.js");

Components.utils.import("resource://app/modules/jsTreeSelection.js");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const nsIMFNService = Ci.nsIMsgFolderNotificationService;
var gMFNService = Cc["@mozilla.org/messenger/msgnotificationservice;1"]
                    .getService(nsIMFNService);

// fake objects needed to get nsMsgDBView to operate on selected messages.
// Warning: these are partial implementations. If someone adds additional
// calls to these objects in nsMsgDBView and friends, it will also
// be necessary to add fake versions of those calls here.

var gFakeView = {
  rowCount: 1,
  selectionChanged: function() {
  },
  QueryInterface: XPCOMUtils.generateQI([Ci.nsITreeView]),
};

var gFakeBox = {
  view: gFakeView,
  invalidate: function() {},
  invalidateRow: function() {},
  beginUpdateBatch: function() {},
  endUpdateBatch: function() {},
  invalidateRange: function(startIndex, endIndex) {},
  rowCountChanged: function (index, count) {},

  QueryInterface: XPCOMUtils.generateQI([Ci.nsITreeBoxObject]),
};

var gFakeSelection = new JSTreeSelection(gFakeBox);

// Items used to add messages to the folder

var gMessageGenerator = new MessageGenerator();
var gScenarioFactory = new MessageScenarioFactory(gMessageGenerator);

var gLocalInboxFolder;

function setup_globals(aNextFunc) {
  // build up a message
  let messages = [];
  let msg1 = gMessageGenerator.makeMessage();
  messages = messages.concat([msg1]);
  let msgSet = new SyntheticMessageSet(messages);

  return add_sets_to_folders(gLocalInboxFolder, [msgSet]);
}

var gCommandUpdater = {
  updateCommandStatus : function()
  {
    // the back end is smart and is only telling us to update command status
    // when the # of items in the selection has actually changed.
  },

  displayMessageChanged : function(aFolder, aSubject, aKeywords)
  {
  },

  updateNextMessageAfterDelete : function()
  {
  },
  summarizeSelection : function() {return false;}
};

var gDBView;
var gTreeView;

var SortType = Components.interfaces.nsMsgViewSortType;
var SortOrder = Components.interfaces.nsMsgViewSortOrder;
var ViewFlags = Components.interfaces.nsMsgViewFlagsType;

function setup_view(aViewType, aViewFlags) {
  let dbviewContractId = "@mozilla.org/messenger/msgdbview;1?type=" + aViewType;

  // always start out fully expanded
  aViewFlags |= ViewFlags.kExpandAll;

  gDBView = Components.classes[dbviewContractId]
                      .createInstance(Components.interfaces.nsIMsgDBView);
  gDBView.init(null, null, gCommandUpdater);
  var outCount = {};
  gDBView.open(gLocalInboxFolder, SortType.byDate, SortOrder.ascending, aViewFlags, outCount);
  dump("  View Out Count: " + outCount.value + "\n");

  gTreeView = gDBView.QueryInterface(Components.interfaces.nsITreeView);
  gTreeView.setTree(gFakeBox);
  gTreeView.selection = gFakeSelection;
}

var tests_for_all_views = [
  // In the proposed fix for bug 487610, the first call to junk messages
  //  only creates the junk folder, it does not actually successfully move
  //  messages. So we junk messages twice so we can really see a move. But
  //  if that gets fixed and the messages actually move on the first call,
  //  I want this test to succeed as well. So I don't actually count how
  //  many messages get moved, just that some do on the second move.
  junkMessages,
  addMessages,
  junkMessages
];

function addMessages() {
  // add another message in case the first one moved
  let messages = [];
  let msg1 = gMessageGenerator.makeMessage();
  messages = messages.concat([msg1]);
  let msgSet = new SyntheticMessageSet(messages);
  return add_sets_to_folders(gLocalInboxFolder, [msgSet]);
}

function junkMessages() {

  // select and junk all messages
  gDBView.doCommand(Ci.nsMsgViewCommandType.selectAll);
  gDBView.doCommand(Ci.nsMsgViewCommandType.junk);
  yield false;
}

// Our listener, which captures events and does the real tests.
function gMFListener() {}
gMFListener.prototype =
{

  msgsMoveCopyCompleted: function (aMove, aSrcMsgs, aDestFolder, aDestMsgs)
  {
    do_check_true(aDestFolder.getFlag(Ci.nsMsgFolderFlags.Junk));
    // I tried to test this by counting messages in the folder, didn't work.
    //  Maybe all updates are not completed yet. Anyway I do it by just
    //  making sure there is something in the destination array.
    do_check_true(aDestMsgs.length > 0);
    async_driver();
  },

  folderAdded: function (aFolder)
  {
    // this should be a junk folder
    do_check_true(aFolder.getFlag(Ci.nsMsgFolderFlags.Junk));
    async_driver();
  },

};

function run_test() {
  gLocalInboxFolder = configure_message_injection({mode: "local"});

  // Set option so that when messages are marked as junk, they move to the junk folder
  let prefSvc = Cc["@mozilla.org/preferences-service;1"]
                  .getService(Ci.nsIPrefBranch);
  prefSvc.setBoolPref("mail.spam.manualMark", true);
  prefSvc.setIntPref("mail.spam.manualMarkMode", 0); // 0 == "move to junk folder", 1 == "delete"

  // Disable bayes filtering on the local account. That's the whole point of this test,
  //  to make sure that the junk move happens anyway.
  gLocalInboxFolder.server.spamSettings.level = 0;

  // Spam settings needs to know the server to create the junk folder, and move to it
  gLocalInboxFolder.server.spamSettings.actionTargetAccount = gLocalInboxFolder.server.serverURI;

  do_test_pending();

  // Add folder listeners that will capture async events
  let flags =
        nsIMFNService.msgsMoveCopyCompleted |
        nsIMFNService.folderAdded;
  let listener = new gMFListener();
  gMFNService.addListener(listener, flags);

  async_run({func: actually_run_test});
}

var view_types = [
  ["threaded", ViewFlags.kThreadedDisplay],
];

function actually_run_test() {
  yield async_run({func: setup_globals});
  dump("Num Messages: " + gLocalInboxFolder.msgDatabase.dBFolderInfo.numMessages + "\n");

  // for each view type...
  for (let [, view_type_and_flags] in Iterator(view_types)) {
    let [view_type, view_flags] = view_type_and_flags;

    // ... run each test
    setup_view(view_type, view_flags);

    for (let [, testFunc] in Iterator(tests_for_all_views)) {
      dump("=== Running generic test: " + testFunc.name + "\n");
      yield async_run({func: testFunc});
    }
  }

  do_test_finished();
}
