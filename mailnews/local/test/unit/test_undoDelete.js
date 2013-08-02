// This file tests undoing of an local folder message deleted to the trash.
//
// Original Author: David Bienvenu <dbienvenu@mozilla.com>

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/mailServices.js");

// Globals
var gMsg1;
var gMessages = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
var gMsgWindow;
var gCurTestNum;
var gMsgId1;
var gTestFolder;

load("../../../resources/asyncTestUtils.js");
Components.utils.import("resource:///modules/iteratorUtils.jsm");
load("../../../resources/messageModifier.js");
load("../../../resources/messageGenerator.js");
load("../../../resources/messageInjection.js");

const gTestArray =
[
  function deleteMessage() {
    let msgToDelete = mailTestUtils.firstMsgHdr(gTestFolder);
    gMsgId1 = msgToDelete.messageId;
    gMessages.appendElement(msgToDelete, false);
    gTestFolder.deleteMessages(gMessages, gMsgWindow, false, true, CopyListener,
                               true);
  },
  function undoDelete() {
    gMsgWindow.transactionManager.undoTransaction();
    // There's no listener for this, so we'll just have to wait a little.
    do_timeout(1500, function(){doTest(++gCurTestNum);});
  },
  function verifyFolders() {
    let msgRestored = gTestFolder.msgDatabase.getMsgHdrForMessageID(gMsgId1);
    let msg = mailTestUtils.loadMessageToString(gTestFolder, msgRestored);
    do_check_eq(msg, gMsg1.toMboxString());
    doTest(++gCurTestNum);
  },
];

function run_test()
{
  configure_message_injection({mode: "local"});

  gMsgWindow = Cc["@mozilla.org/messenger/msgwindow;1"]
                  .createInstance(Components.interfaces.nsIMsgWindow);

  var messageGenerator = new MessageGenerator();
  gMsg1 = messageGenerator.makeMessage();
  let msg2 = messageGenerator.makeMessage({inReplyTo: gMsg1});

  let messages = [];
  messages = messages.concat([gMsg1, msg2]);
  let msgSet = new SyntheticMessageSet(messages);
  gTestFolder = make_empty_folder();
  add_sets_to_folder(gTestFolder, [msgSet]);

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

    var testFn = gTestArray[test - 1];
    // Set a limit of ten seconds; if the notifications haven't arrived by then there's a problem.
    do_timeout(10000, function(){
        if (gCurTestNum == test)
          do_throw("Notifications not received in 10000 ms for operation " + testFn.name);
        }
      );
    try {
    testFn();
    } catch(ex) {
      do_throw ('TEST FAILED ' + ex);
    }
  }
  else
  {
    do_timeout(1000, endTest);
  }
}

// nsIMsgCopyServiceListener implementation - runs next test when copy
// is completed.
var CopyListener =
{
  OnStartCopy: function() {},
  OnProgress: function(aProgress, aProgressMax) {},
  SetMessageKey: function(aKey){},
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
    do_timeout(0, function(){doTest(++gCurTestNum);});
  }
};


// nsIURLListener implementation - runs next test
var URLListener =
{
  OnStartRunningUrl: function(aURL) {},
  OnStopRunningUrl: function(aURL, aStatus)
  {
    dump("in OnStopRunningURL " + gCurTestNum + "\n");
    do_check_eq(aStatus, 0);
    do_timeout(0, function(){doTest(++gCurTestNum);});
  }
}

function endTest()
{
  // Cleanup, null out everything
  gMessages.clear();
  gMsgWindow.closeWindow();
  gMsgWindow = null;
  localAccountUtils.inboxFolder = null;
  localAccountUtils.incomingServer = null;

  do_test_finished(); // for the one in run_test()
}
