/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Tests sending a message in the background (checks auto-send works).
 */
var type = null;
var test = null;
var server;
var sentFolder;
var transaction;
var originalData;
var finished = false;
var identity = null;
var testFile = do_get_file("data/429891_testcase.eml");

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
  },
  onProgress: function (aCurrentMessage, aTotal) {
    // XXX Enable this function
  },
  onStopSending: function (aStatus, aMsg, aTotal, aSuccessful) {
    do_test_finished();
    print("msll onStopSending\n");
    try {
      do_check_eq(aStatus, 0);
      do_check_eq(aTotal, 1);
      do_check_eq(aSuccessful, 1);
      do_check_eq(this._initialTotal, 1);
      do_check_eq(gMsgSendLater.sendingMessages, false);

      do_check_transaction(transaction,
                           ["EHLO test",
                            "MAIL FROM:<" + kSender + "> SIZE=" + originalData.length,
                            "RCPT TO:<" + kTo + ">",
                            "DATA"]);

      // Compare data file to what the server received
      do_check_eq(originalData, server._handler.post);

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
  originalData = loadFileToString(testFile);

  // Check that the send later service thinks we don't have messages to send
  do_check_eq(gMsgSendLater.hasUnsentMessages(identity), false);

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

    // Send the unsent message in the background, because we have
    // mailnews.sendInBackground set, nsMsgSendLater should just send it for
    // us.
    msgSend.sendMessageFile(identity, "", compFields, testFile,
                            false, false, Ci.nsIMsgSend.nsMsgQueueForLater,
                            null, null, null, null);

    server.performTest();

    transaction = server.playTransaction();

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
