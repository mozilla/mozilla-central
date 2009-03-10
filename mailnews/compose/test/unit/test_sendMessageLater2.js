/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Complex test for the send message later function - including sending multiple
 * times in the same session.
 *
 * XXX: This test is intended to additionally test sending of multiple messages
 * from one send later instance, however due to the fact we use one connection
 * per message sent, it is very difficult to consistently get the fake server
 * reconected in time for the next connection. Thus, sending of multiple
 * messages is currently disabled (but commented out for local testing if
 * required), when we fix bug 136871 we should be able to enable the multiple
 * messages option. 
 */
var test = "sendMessageLater";
var server = null;
var gSentFolder;
var transaction;
var originalData;
var identity = null;
var gMsgFile =
[
  do_get_file("../mailnews/compose/test/unit/data/message1.eml"),
  do_get_file("../mailnews/compose/test/unit/data/429891_testcase.eml")
];
var gMsgFileData = [];
var gMsgOrder = [];
var gCurTestNum = 0;
var gLastSentMessage = 0;

const kSender = "from@invalid.com";
const kTo = "to@invalid.com";

var msgSendLater = Cc["@mozilla.org/messengercompose/sendlater;1"]
                     .getService(Ci.nsIMsgSendLater);

// This listener handles the post-sending of the actual message and checks the
// sequence and ensures the data is correct.
function msll() {
}

msll.prototype = {
  // nsIMsgSendLaterListener
  onStartSending: function (aTotal) {
    do_check_eq(aTotal, gMsgOrder.length);
    do_check_eq(msgSendLater.sendingMessages, true);
  },
  onProgress: function (aCurrentMessage, aTotal) {
    try {
      do_check_eq(aTotal, gMsgOrder.length);
      do_check_eq(gLastSentMessage + 1, aCurrentMessage);
      gLastSentMessage = aCurrentMessage;
      do_check_eq(msgSendLater.sendingMessages, true);

      do_check_transaction(transaction,
                           ["EHLO test",
                            "MAIL FROM:<" + kSender + "> SIZE=" + gMsgFileData[gMsgOrder[aCurrentMessage - 1]].length,
                            "RCPT TO:<" + kTo + ">",
                            "DATA"]);
      transaction = null;

      // Compare data file to what the server received
      do_check_eq(gMsgFileData[gMsgOrder[aCurrentMessage - 1]], server._handler.post);

      // XXX We've got more messages to receive so restart the server for the
      // new connection, at least until bug 136871 is fixed - we reset and stop
      // the server on exit, the next test runs the server for the next message.
      do_timeout(0, "doTest(++gCurTestNum)");
    } catch (e) {
      do_throw(e);
    } finally {
      // Reset
      server.resetTest();

      // XXX This is the way we currently try and restart the server which
      // doesn't always work, once we fix bug 136871 just calling resetTest and
      // ensuring we play the transaction should be enough.
      server.stop();
      
      var thread = gThreadManager.currentThread;
      while (thread.hasPendingEvents())
        thread.processNextEvent(true);
      server.start(SMTP_PORT);

      var thread = gThreadManager.currentThread;
      while (thread.hasPendingEvents())
        thread.processNextEvent(true);
    }
  },
  onStopSending: function (aStatus, aMsg, aTotal, aSuccessful) {
    try {
      do_check_eq(aStatus, 0);
      do_check_eq(aTotal, aSuccessful);
      do_check_eq(msgSendLater.sendingMessages, false);

      // Check that the send later service now thinks we don't have messages to
      // send.
      do_check_eq(msgSendLater.hasUnsentMessages(identity), false);

      // XXX This is another send multiple messages hack
      if (!transaction) {
        server.performTest();
        transaction = server.playTransaction();
      }

      do_check_transaction(transaction,
                           ["EHLO test",
                            "MAIL FROM:<" + kSender + "> SIZE=" + gMsgFileData[gMsgOrder[aTotal - 1]].length,
                            "RCPT TO:<" + kTo + ">",
                            "DATA"]);
      transaction = null;

      // Compare data file to what the server received
      do_check_eq(gMsgFileData[gMsgOrder[aTotal - 1]], server._handler.post);

      do_timeout(0, "doTest(++gCurTestNum)");
    } catch (e) {
      dump(e);
      do_throw(e);
    } finally {
      server.resetTest();
      server.stop();

      var thread = gThreadManager.currentThread;
      while (thread.hasPendingEvents())
        thread.processNextEvent(true);
    }
  }
};

// This function is used to find out when the copying of the message to the
// unsent message folder is completed, and hence can fire off the actual
// sending of the message.
function OnStopCopy(aStatus)
{
  do_check_eq(aStatus, 0);

  // Check this is false before we start sending
  do_check_eq(msgSendLater.sendingMessages, false);

  // Check that the send later service thinks we have messages to send.
  do_check_eq(msgSendLater.hasUnsentMessages(identity), true);

  // Check we have a message in the unsent message folder
  do_check_eq(gSentFolder.getTotalMessages(false), gMsgOrder.length);

  // Start the next step after a brief time so that functions can finish
  // properly
  do_timeout(0, "doTest(++gCurTestNum);");
}

function sendMessageLater(aTestFileIndex)
{
  gMsgOrder.push(aTestFileIndex);

  // Prepare to actually "send" the message later, i.e. dump it in the
  // unsent messages folder.

  var compFields = Cc["@mozilla.org/messengercompose/composefields;1"]
                     .createInstance(Ci.nsIMsgCompFields);

  compFields.from = identity.email;
  compFields.to = kTo;

  var msgSend = Cc["@mozilla.org/messengercompose/send;1"]
                  .createInstance(Ci.nsIMsgSend);

  msgSend.sendMessageFile(identity, "", compFields, gMsgFile[aTestFileIndex],
                          false, false, Ci.nsIMsgSend.nsMsgQueueForLater,
                          null, copyListener, null, null);
}

function resetCounts()
{
  gMsgOrder = [];
  gLastSentMessage = 0;
  do_timeout(0, "doTest(++gCurTestNum);");
}

// This function does the actual send later
function sendUnsentMessages()
{
  // Handle the server in a try/catch/finally loop so that we always will stop
  // the server if something fails.
  try {
    // Start the fake SMTP server
    server.start(SMTP_PORT);

    // Send the unsent message
    msgSendLater.sendUnsentMessages(identity);

    server.performTest();

    transaction = server.playTransaction();
  } catch (e) {
    do_throw(e);
  } finally {
    server.stop();

    var thread = gThreadManager.currentThread;
    while (thread.hasPendingEvents())
      thread.processNextEvent(true);
  }
}

function runServerTest()
{
  server.performTest();

  transaction = server.playTransaction();
}

// Beware before commenting out a test
// -- later tests might just depend on earlier ones
const gTestArray =
[
  // Copying message from file to folder.
  function testSendLater1() { sendMessageLater(0); },

  // Now send unsent message
  function testSendUnsentMessages1() { sendUnsentMessages(); },

  function testSentEmpty() {
    do_check_eq(gSentFolder.getTotalMessages(false), 0);
    doTest(++gCurTestNum);
  },

  // This function just resets a few counts where necessary.
  function testResetCounts() { resetCounts(); },

  // Now copy more messages...
  function testCopyFileMessage2() {
    sendMessageLater(1);
    // XXX Only do one the second time round, as described at the start of the
    // file.
    //    sendMessageLater(0);
  },
  // ...and send again
  function testSendUnsentMessages2() { sendUnsentMessages(); },

  // XXX This may be needed if sending more than one message in the second
  // stage.
  //  function testRunServer() { runServerTest(); }
];

function run_test() {
  // Load in the test files so we have a record of length and their data.
  for (var i = 0; i < gMsgFile.length; ++i) {
    gMsgFileData[i] = loadFileToString(gMsgFile[i]);
  }

  // Ensure we have a local mail account, an normal account and appropriate
  // servers and identities.
  loadLocalMailAccount();

  // Check that the send later service thinks we don't have messages to send.
  do_check_eq(msgSendLater.hasUnsentMessages(identity), false);

  var acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                  .getService(Ci.nsIMsgAccountManager);
  acctMgr.setSpecialFolders();

  var account = acctMgr.createAccount();
  incomingServer = acctMgr.createIncomingServer("test", "localhost", "pop3");

  var smtpServer = getBasicSmtpServer();
  identity = getSmtpIdentity(kSender, smtpServer);

  account.addIdentity(identity);
  account.defaultIdentity = identity;
  account.incomingServer = incomingServer;

  gLocalIncomingServer.rootMsgFolder.addSubfolder("Sent");

  gSentFolder = msgSendLater.getUnsentMessagesFolder(identity);

  // Don't copy messages to sent folder for this test
  identity.doFcc = false;

  // Create and add a listener
  var messageListener = new msll();

  msgSendLater.addListener(messageListener);

  // Set up the server
  server = setupServerDaemon();
  server.setDebugLevel(fsDebugRecv);

  // "Master" do_test_pending(), paired with a do_test_finished() at the end of
  // all the operations.
  do_test_pending();

  // Do the test
  doTest(1);
}

function doTest(test)
{
  dump("doTest " + test + "\n");
  if (test <= gTestArray.length) {
    gCurTestNum = test;

    var testFn = gTestArray[test-1];

    // Set a limit in case the notifications haven't arrived (i.e. a problem)
    do_timeout(10000, "if (gCurTestNum == "+test+")               \
               do_throw('Notifications not received in 10000 ms for operation "+testFn.name+", current status is '+gCurrStatus);");
    try {
      testFn();
    } catch(ex) {
      dump(ex);
      do_throw(ex);
    }
  }
  else {
    do_test_finished(); // for the one in run_test()
  }
}
