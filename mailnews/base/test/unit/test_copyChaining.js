/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Test of chaining copies between the same folders

load("../../../resources/messageGenerator.js");

Components.utils.import("resource:///modules/mailServices.js");

var gCopySource;
var gCopyDest;
var gMsgEnumerator;
var gCurTestNum = 1;

// main test

var hdrs = [];

const gTestArray =
[
  function copyMsg1() {
    gMsgEnumerator = gCopySource.msgDatabase.EnumerateMessages();
    CopyNextMessage();
  },
  function copyMsg2() {
    CopyNextMessage();
  },
  function copyMsg3() {
    CopyNextMessage();
  },
  function copyMsg4() {
    CopyNextMessage();
  },
];

function CopyNextMessage()
{
  if (gMsgEnumerator.hasMoreElements()) {
    let msgHdr = gMsgEnumerator.getNext().QueryInterface(
      Components.interfaces.nsIMsgDBHdr);
    var messages = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
    messages.appendElement(msgHdr, false);
    MailServices.copy.CopyMessages(gCopySource, messages, gCopyDest, true,
                                   copyListener, null, false);
  }
  else
    do_throw ('TEST FAILED - out of messages');
}

function run_test()
{
  localAccountUtils.loadLocalMailAccount();
  let messageGenerator = new MessageGenerator();
  let scenarioFactory = new MessageScenarioFactory(messageGenerator);

  // "Master" do_test_pending(), paired with a do_test_finished() at the end of
  // all the operations.
  do_test_pending();

  gCopyDest = localAccountUtils.inboxFolder.createLocalSubfolder("copyDest");
  // build up a diverse list of messages
  let messages = [];
  messages = messages.concat(scenarioFactory.directReply(10));
  gCopySource = localAccountUtils.rootFolder.createLocalSubfolder("copySource");
  addMessagesToFolder(messages, gCopySource);

  mailTestUtils.updateFolderAndNotify(gCopySource, doTest);
  return true;
}

function doTest()
{
  var test = gCurTestNum;
  if (test <= gTestArray.length)
  {
    var testFn = gTestArray[test-1];
    dump("Doing test " + test + " " + testFn.name + "\n");

    try {
      testFn();
    } catch(ex) {
      do_throw ('TEST FAILED ' + ex);
    }
  }
  else
    endTest();
}

function endTest()
{
  // Cleanup, null out everything
  dump(" Exiting mail tests\n");
  gMsgEnumerator = null;
  do_test_finished(); // for the one in run_test()
}

// nsIMsgCopyServiceListener implementation
var copyListener = 
{
  OnStartCopy: function() {},
  OnProgress: function(aProgress, aProgressMax) {},
  SetMessageKey: function(aKey) {},
  SetMessageId: function(aMessageId) {},
  OnStopCopy: function(aStatus)
  {
    // Check: message successfully copied.
    do_check_eq(aStatus, 0);
    ++gCurTestNum;
    doTest();
  }
};

