/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Protocol tests for SMTP.
 *
 * For trying to send a message later with no server connected, this test
 * verifies:
 *   - A correct status response.
 *   - A correct state at the end of attempting to send.
 */

load("../../mailnews/resources/alertTestUtils.js");

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

var msgSendLater = Cc["@mozilla.org/messengercompose/sendlater;1"]
  .getService(Ci.nsIMsgSendLater);

function alert(aDialogTitle, aText) {
  dump("Hiding Alert {\n" + aText + "\n} End Alert\n");
}

// This listener handles the post-sending of the actual message and checks the
// sequence and ensures the data is correct.
function msll() {
}

msll.prototype = {
  _initialTotal: 0,
  _errorRaised: false,

  // nsIMsgSendLaterListener
  onStartSending: function (aTotal) {
    this._initialTotal = 1;
    do_check_eq(msgSendLater.sendingMessages, true);
  },
  onMessageStartSending: function (aCurrentMessage, aTotalMessageCount,
                                   aMessageHeader, aIdentity) {
  },
  onMessageSendProgress: function (aCurrentMessage, aTotalMessageCount,
                                   aMessageSendPercent, aMessageCopyPercent) {
  },
  onMessageSendError: function (aCurrentMessage, aMessageHeader, aStatus,
                                aMsg) {
    this._errorRaised = true;
  },
  onStopSending: function (aStatus, aMsg, aTotal, aSuccessful) {
    print("msll onStopSending\n");

    // NS_ERROR_SMTP_SEND_FAILED_REFUSED is 2153066798
    do_check_eq(aStatus, 2153066798);
    do_check_eq(aTotal, 1);
    do_check_eq(aSuccessful, 0);
    do_check_eq(this._initialTotal, 1);
    do_check_eq(this._errorRaised, true);
    do_check_eq(msgSendLater.sendingMessages, false);
    // Check that the send later service still thinks we have messages to send.
    do_check_eq(msgSendLater.hasUnsentMessages(identity), true);

    do_test_finished();
  }
};

function OnStopCopy(aStatus) {
  do_check_eq(aStatus, 0);

  // Check this is false before we start sending
  do_check_eq(msgSendLater.sendingMessages, false);

  let folder = msgSendLater.getUnsentMessagesFolder(identity);

  // Check that the send later service thinks we have messages to send.
  do_check_eq(msgSendLater.hasUnsentMessages(identity), true);

  // Check we have a message in the unsent message folder
  do_check_eq(folder.getTotalMessages(false), 1);

  // Now do a comparison of what is in the unsent mail folder
  var fileData = loadFileToString(folder.filePath);

  // Skip the headers etc that mailnews adds
  var pos = fileData.indexOf("From:");
  do_check_neq(pos, -1);

  fileData = fileData.substr(pos);

  // Check the data is matching.
  do_check_eq(originalData, fileData);

  do_timeout(sendMessageLater(), 0);
}

// This function does the actual send later
function sendMessageLater()
{
  // No server for this test, just attempt to send unsent and wait.
  var messageListener = new msll();

  msgSendLater.addListener(messageListener);

  // Send the unsent message
  msgSendLater.sendUnsentMessages(identity);
}

function run_test() {
  registerAlertTestUtils();

  // Test file - for bug 429891
  originalData = loadFileToString(testFile);

  // Ensure we have a local mail account, an normal account and appropriate
  // servers and identities.
  loadLocalMailAccount();

  // Check that the send later service thinks we don't have messages to send.
  do_check_eq(msgSendLater.hasUnsentMessages(identity), false);

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

  identity.doFcc = false;

  // Now prepare to actually "send" the message later, i.e. dump it in the
  // unsent messages folder.

  var compFields = Cc["@mozilla.org/messengercompose/composefields;1"]
                     .createInstance(Ci.nsIMsgCompFields);

  compFields.from = identity.email;
  compFields.to = kTo;

  var msgSend = Cc["@mozilla.org/messengercompose/send;1"]
                  .createInstance(Ci.nsIMsgSend);

  msgSend.sendMessageFile(identity, "", compFields, testFile,
                          false, false, Ci.nsIMsgSend.nsMsgQueueForLater,
                          null, copyListener, null, null);

  // Now we wait till we get copy notification of completion.
  do_test_pending();
}
