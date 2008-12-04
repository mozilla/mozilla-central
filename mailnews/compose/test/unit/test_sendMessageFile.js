/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Protocol tests for SMTP.
 *
 * This test verifies:
 * - Sending a message to an SMTP server (which is also covered elsewhere).
 * - Correct reception of the message by the SMTP server.
 * - Correct saving of the message to the sent folder.
 *
 * Originally written to test bug 429891 where saving to the sent folder was
 * mangling the message.
 */
var type = null;
var test = null;
var server;
var sentFolder;
var transaction;
var originalData;
var finished = false;

const kSender = "from@invalid.com";
const kTo = "to@invalid.com";

function msl() {}

msl.prototype = {
  // nsIMsgSendListener
  onStartSending: function (aMsgID, aMsgSize) {
  },
  onProgress: function (aMsgID, aProgress, aProgressMax) {
  },
  onStatus: function (aMsgID, aMsg) {
  },
  onStopSending: function (aMsgID, aStatus, aMsg, aReturnFile) {
    do_test_finished();

    try {
      do_check_eq(aStatus, 0);

      do_check_transaction(transaction,
                           ["EHLO test",
                            "MAIL FROM:<" + kSender + "> SIZE=" + originalData.length,
                            "RCPT TO:<" + kTo + ">",
                            "DATA"]);

      // Compare data file to what the server received
      do_check_eq(originalData, server._handler.post);

      // Now wait till the copy is finished for the sent message
      do_test_pending();
    } catch (e) {
      do_throw(e);
    } finally {
      server.stop();

      var thread = gThreadManager.currentThread;
      while (thread.hasPendingEvents())
        thread.processNextEvent(true);
    }
  },
  onGetDraftFolderURI: function (aFolderURI) {
  },
  onSendNotPerformed: function (aMsgID, aStatus) {
  },

  // nsIMsgCopyServiceListener
  OnStartCopy: function () {
  },
  OnProgress: function (aProgress, aProgressMax) {
  },
  SetMessageKey: function (aKey) {
  },
  GetMessageId: function (aMessageId) {
  },
  OnStopCopy: function (aStatus) {
    do_test_finished();
    do_check_eq(aStatus, 0);
    try {
      // Now do a comparison of what is in the sent mail folder
      var fileData = loadFileToString(sentFolder.filePath);

      // Skip the headers etc that mailnews adds
      var pos = fileData.indexOf("From:");
      do_check_neq(pos, -1);

      fileData = fileData.substr(pos);

      do_check_eq(originalData, fileData);

      server.resetTest();
    } catch (e) {
      do_throw(e);
    } finally {
      server.stop();

      var thread = gThreadManager.currentThread;
      while (thread.hasPendingEvents())
        thread.processNextEvent(true);

      finished = true;
    }
  },

  // QueryInterface
  QueryInterface: function (iid) {
    if (iid.equals(Ci.nsIMsgSendListener) ||
        iid.equals(Ci.nsIMsgCopyServiceListener) ||
        iid.equals(Ci.nsISupports))
      return this;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  }
}

function run_test() {
  server = setupServerDaemon();

  type = "sendMessageFile";

  // Test file - for bug 429891
  var testFile = do_get_file("../mailnews/compose/test/unit/data/429891_testcase.eml");
  originalData = loadFileToString(testFile);

  // Ensure we have at least one mail account
  loadLocalMailAccount();

  var acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                  .getService(Ci.nsIMsgAccountManager);
  acctMgr.setSpecialFolders();

  var smtpServer = getBasicSmtpServer();
  var identity = getSmtpIdentity(kSender, smtpServer);

  sentFolder = gLocalIncomingServer.rootMsgFolder.addSubfolder("Sent");

  do_check_eq(identity.doFcc, true);

  var msgSend = Cc["@mozilla.org/messengercompose/send;1"]
                  .createInstance(Ci.nsIMsgSend);

  // Handle the server in a try/catch/finally loop so that we always will stop
  // the server if something fails.
  try {
    // Start the fake SMTP server
    server.start(SMTP_PORT);

    // A test to check that we are sending files correctly, including checking
    // what the server receives and what we output.
    test = "sendMessageFile";

    // Msg Comp Fields

    var compFields = Cc["@mozilla.org/messengercompose/composefields;1"]
                       .createInstance(Ci.nsIMsgCompFields);

    compFields.from = identity.email;
    compFields.to = kTo;

    var messageListener = new msl();

    msgSend.sendMessageFile(identity, "", compFields, testFile,
                            false, false, Ci.nsIMsgSend.nsMsgDeliverNow,
                            null, messageListener, null, null);

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
