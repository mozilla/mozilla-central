/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Tests sending a message in the background (checks auto-send works).
 */
var type = null;
var test = null;
var server;
var sentFolder;
var originalData;
var finished = false;
var identity = null;
var testFile1 = do_get_file("data/429891_testcase.eml");
var testFile2 = do_get_file("data/message1.eml");

const kSender = "from@invalid.com";
const kTo = "to@invalid.com";

var gMsgSendLater;

// This listener handles the post-sending of the actual message and checks the
// sequence and ensures the data is correct.
function msll() {
}

msll.prototype = {
  _initialTotal: 0,

  // nsIMsgSendLaterListener
  onStartSending: function (aTotal) {
    this._initialTotal = 1;
    do_check_eq(gMsgSendLater.sendingMessages, true);
    do_check_eq(aTotal, 1);
  },
  onMessageStartSending: function (aCurrentMessage, aTotalMessageCount,
                                   aMessageHeader, aIdentity) {
  },
  onMessageSendProgress: function (aCurrentMessage, aTotalMessageCount,
                                   aMessageSendPercent, aMessageCopyPercent) {
  }, 
  onMessageSendError: function (aCurrentMessage, aMessageHeader, aStatus,
                                aMsg) {
    do_throw("onMessageSendError should not have been called, status: " + aStatus);
  },
  onStopSending: function (aStatus, aMsg, aTotalTried, aSuccessful) {
    do_test_finished();
    print("msll onStopSending\n");
    try {
      do_check_eq(aStatus, 0);
      do_check_eq(aTotalTried, 1);
      do_check_eq(aSuccessful, 1);
      do_check_eq(this._initialTotal, 1);
      do_check_eq(gMsgSendLater.sendingMessages, false);

      do_check_transaction(server.playTransaction(),
                           ["EHLO test",
                            "MAIL FROM:<" + kSender + "> SIZE=" + originalData.length,
                            "RCPT TO:<" + kTo + ">",
                            "DATA"]);

      // Compare data file to what the server received
      do_check_eq(originalData, server._handler.post);

      // check there's still one message left in the folder
      do_check_eq(gMsgSendLater.getUnsentMessagesFolder(null)
                               .getTotalMessages(false), 1);

      finished = true;
    } catch (e) {
      do_throw(e);
    } finally {
      server.stop();

      var thread = gThreadManager.currentThread;
      while (thread.hasPendingEvents())
        thread.processNextEvent(true);
    }
  }
};


function run_test() {
  var prefSvc = Components.classes["@mozilla.org/preferences-service;1"]
    .getService(Components.interfaces.nsIPrefBranch);

  // The point of this test - send in background.
  prefSvc.setBoolPref("mailnews.sendInBackground", true);

  // Ensure we have a local mail account, an normal account and appropriate
  // servers and identities.
  loadLocalMailAccount();

  // Now load (and internally initialize) the send later service
  gMsgSendLater = Cc["@mozilla.org/messengercompose/sendlater;1"]
                    .getService(Ci.nsIMsgSendLater);

  // Test file - for bug 429891
  originalData = loadFileToString(testFile1);

  // Check that the send later service thinks we don't have messages to send
  do_check_eq(gMsgSendLater.hasUnsentMessages(identity), false);

  var acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                  .getService(Ci.nsIMsgAccountManager);
  acctMgr.setSpecialFolders();

  var account = acctMgr.createAccount();
  var incomingServer = acctMgr.createIncomingServer("test", "localhost", "pop3");

  var smtpServer = getBasicSmtpServer();
  identity = getSmtpIdentity(kSender, smtpServer);

  account.addIdentity(identity);
  account.defaultIdentity = identity;
  account.incomingServer = incomingServer;

  sentFolder = gLocalIncomingServer.rootMsgFolder.addSubfolder("Sent");

  do_check_eq(identity.doFcc, true);

  // Now prepare to actually "send" the message later, i.e. dump it in the
  // unsent messages folder.

  var compFields = Cc["@mozilla.org/messengercompose/composefields;1"]
                     .createInstance(Ci.nsIMsgCompFields);

  compFields.from = identity.email;
  compFields.to = kTo;

  var msgSend = Cc["@mozilla.org/messengercompose/send;1"]
                  .createInstance(Ci.nsIMsgSend);

  // Set up the SMTP server.
  server = setupServerDaemon();

  type = "sendMessageLater";

  // Handle the server in a try/catch/finally loop so that we always will stop
  // the server if something fails.
  try {
    // Start the fake SMTP server
    server.start(SMTP_PORT);

    // A test to check that we are sending files correctly, including checking
    // what the server receives and what we output.
    test = "sendMessageLater";

    var messageListener = new msll();

    gMsgSendLater.addListener(messageListener);

    // Send this message later - it shouldn't get sent
    msgSend.sendMessageFile(identity, "", compFields, testFile2,
                            false, false, Ci.nsIMsgSend.nsMsgQueueForLater,
                            null, null, null, null);

    // Send the unsent message in the background, because we have
    // mailnews.sendInBackground set, nsMsgSendLater should just send it for
    // us.
    msgSend.sendMessageFile(identity, "", compFields, testFile1,
                            false, false, Ci.nsIMsgSend.nsMsgDeliverBackground,
                            null, null, null, null);

    server.performTest();

    do_timeout(10000, "if (!finished) do_throw('Notifications of message send/copy not received');");

    do_test_pending();

  } catch (e) {
    do_throw(e);
  } finally {
    server.stop();

    var thread = gThreadManager.currentThread;
    while (thread.hasPendingEvents())
      thread.processNextEvent(true);
  }
}
