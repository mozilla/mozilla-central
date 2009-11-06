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

load("../../mailnews/resources/logHelper.js");
load("../../mailnews/resources/asyncTestUtils.js");

var test = "sendMessageLater";
var server = null;
var gSentFolder;
var originalData;
var identity = null;
var gMsgFile =
[
  do_get_file("data/message1.eml"),
  do_get_file("data/429891_testcase.eml")
];
var gMsgFileData = [];
var gMsgOrder = [];
var gCurTestNum = 0;
var gLastSentMessage = 0;

// gMessageSendStatus
// 0 = initial value
// 1 = send completed before exiting sendUnsentMessages
// 2 = sendUnsentMessages has exited.
var gMessageSendStatus = 0;

const kSender = "from@invalid.com";
const kTo = "to@invalid.com";

var msgSendLater = Cc["@mozilla.org/messengercompose/sendlater;1"]
                     .getService(Ci.nsIMsgSendLater);

// This listener handles the post-sending of the actual message and checks the
// sequence and ensures the data is correct.
function msll() {
}

msll.prototype = {
  checkMessageSend: function(aCurrentMessage) {
    do_check_transaction(server.playTransaction(),
                         ["EHLO test",
                          "MAIL FROM:<" + kSender + "> SIZE=" + gMsgFileData[gMsgOrder[aCurrentMessage - 1]].length,
                          "RCPT TO:<" + kTo + ">",
                          "DATA"]);

    // Compare data file to what the server received
    do_check_eq(gMsgFileData[gMsgOrder[aCurrentMessage - 1]], server._handler.post);
  },

  // nsIMsgSendLaterListener
  onStartSending: function (aTotalMessageCount) {
    do_check_eq(aTotal, gMsgOrder.length);
    do_check_eq(msgSendLater.sendingMessages, true);
  },
  onMessageStartSending: function (aCurrentMessage, aTotalMessageCount,
                                   aMessageHeader, aIdentity) {
    if (gLastSentMessage > 0)
      this.checkMessageSend(aCurrentMessage);
    do_check_eq(gLastSentMessage + 1, aCurrentMessage);
    gLastSentMessage = aCurrentMessage;
  },
  onMessageSendProgress: function (aCurrentMessage, aTotalMessageCount,
                                   aMessageSendPercent, aMessageCopyPercent) {
    do_check_eq(aTotalMessageCount, gMsgOrder.length);
    do_check_eq(gLastSentMessage, aCurrentMessage);
    do_check_eq(msgSendLater.sendingMessages, true);
  },
  onMessageSendError: function (aCurrentMessage, aMessageHeader, aStatus,
                                aMsg) {
    do_throw("onMessageSendError should not have been called, status: " + aStatus);
  },
  onStopSending: function (aStatus, aMsg, aTotalTried, aSuccessful) {
    try {
      do_check_eq(aStatus, 0);
      do_check_eq(aTotalTried, aSuccessful);
      do_check_eq(msgSendLater.sendingMessages, false);

      // Check that the send later service now thinks we don't have messages to
      // send.
      do_check_eq(msgSendLater.hasUnsentMessages(identity), false);

      this.checkMessageSend(gLastSentMessage);
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
    if (gMessageSendStatus == 0) {
      dump("gMessageSendStatus to 1\n");
      gMessageSendStatus = 1;
    }
    else if (gMessageSendStatus == 2) {
      dump("next driver\n");
      async_driver();
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
  async_driver();
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
  return false;
}

function resetCounts()
{
  gMsgOrder = [];
  gLastSentMessage = 0;
}

// This function does the actual send later
function sendUnsentMessages()
{
  gMessageSendStatus = 0;
  // Handle the server in a try/catch/finally loop so that we always will stop
  // the server if something fails.
  try {
    // Start the fake SMTP server
    server.start(SMTP_PORT);

    // Send the unsent message
    msgSendLater.sendUnsentMessages(identity);
    server.performTest();
  } catch (e) {
    do_throw(e);
  } finally {
    server.stop();

    var thread = gThreadManager.currentThread;
    while (thread.hasPendingEvents())
      thread.processNextEvent(true);
  }
  if (!gMessageSendStatus)
    gMessageSendStatus = 2;

  return gMessageSendStatus == 1;
}

function runServerTest()
{
  server.performTest();
}

function actually_run_test() {
  dump("in actually_run_test\n");

  dump("Copy Mesage from file to folder\n");
  yield async_run({func: sendMessageLater, args: [0]});

  dump("Send unsent message\n");
  yield async_run({func: sendUnsentMessages});

  // Check sent folder is now empty.
  do_check_eq(gSentFolder.getTotalMessages(false), 0);

  // and reset counts
  resetCounts();

  dump("Copy more messages\n");
  yield async_run({func: sendMessageLater, args: [1]});

  // XXX Only do one the second time round, as described at the start of the
  // file.
  // yield async_run({func: sendMessageLater, args: [0]});

  dump("Test send again\n");
  yield async_run({func: sendUnsentMessages});

  do_test_finished();
}

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
  async_run({func: actually_run_test});
}
