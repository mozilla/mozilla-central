/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Protocol tests for SMTP.
 *
 * For trying to send a message later with no server connected, this test
 * verifies:
 *   - A correct status response.
 *   - A correct state at the end of attempting to send.
 */
var type = null;
var test = null;
var server;
var sentFolder;
var transaction;
var originalData;
var finished = false;
var identity = null;
var testFile = do_get_file("../mailnews/compose/test/unit/data/429891_testcase.eml");

const kSender = "from@invalid.com";
const kTo = "to@invalid.com";

var msgSendLater = Cc["@mozilla.org/messengercompose/sendlater;1"]
  .getService(Ci.nsIMsgSendLater);

// This allows the send code to attempt to display errors to the user without
// failing.
var prompts = {
  alert: function(aDialogTitle, aText) {
    dump("Hiding Alert {\n" + aText + "\n} End Alert\n");
  },
  
  alertCheck: function(aDialogTitle, aText, aCheckMsg, aCheckState) {},
  
  confirm: function(aDialogTitle, aText) {},
  
  confirmCheck: function(aDialogTitle, aText, aCheckMsg, aCheckState) {},
  
  confirmEx: function(aDialogTitle, aText, aButtonFlags, aButton0Title,
		      aButton1Title, aButton2Title, aCheckMsg, aCheckState) {},
  
  prompt: function(aDialogTitle, aText, aValue, aCheckMsg, aCheckState) {},
  
  promptUsernameAndPassword: function(aDialogTitle, aText, aUsername,
				      aPassword, aCheckMsg, aCheckState) {},

  promptPassword: function(aDialogTitle, aText, aPassword, aCheckMsg,
			   aCheckState) {},
  
  select: function(aDialogTitle, aText, aCount, aSelectList,
		   aOutSelection) {},
  
  QueryInterface: function(iid) {
    if (iid.equals(Components.interfaces.nsIPrompt)
     || iid.equals(Components.interfaces.nsISupports))
      return this;
  
    throw Components.results.NS_ERROR_NO_INTERFACE;
  }
};

var WindowWatcher = {
  getNewPrompter: function(aParent) {
    return prompts;
  },

  getNewAuthPrompter: function(aParent) {
    return prompts;
  },

  QueryInterface: function(iid) {
    if (iid.equals(Ci.nsIWindowWatcher) || iid.equals(Ci.nsISupports)) {
      return this;
    }

    throw Cr.NS_ERROR_NO_INTERFACE;
  }
};

var WindowWatcherFactory = {
  createInstance: function createInstance(outer, iid) {
    if (outer != null)
      throw Components.results.NS_ERROR_NO_AGGREGATION;
    return WindowWatcher.QueryInterface(iid);
  }
};

Components.manager.QueryInterface(Components.interfaces.nsIComponentRegistrar)
          .registerFactory(Components.ID("{1dfeb90a-2193-45d5-9cb8-864928b2af55}"),
			   "Fake Window Watcher",
			   "@mozilla.org/embedcomp/window-watcher;1",
			   WindowWatcherFactory);

// This listener handles the post-sending of the actual message and checks the
// sequence and ensures the data is correct.
function msll() {
}

msll.prototype = {
  _initialTotal: 0,

  // nsIMsgSendLaterListener
  onStartSending: function (aTotal) {
    this._initialTotal = 1;
    do_check_eq(msgSendLater.sendingMessages, true);
  },
  onProgress: function (aCurrentMessage, aTotal) {
  },
  onStatus: function (aMsg) {
  },
  onStopSending: function (aStatus, aMsg, aTotal, aSuccessful) {
    print("msll onStopSending\n");

    // NS_ERROR_SMTP_SEND_FAILED_REFUSED is 2153066798
    do_check_eq(aStatus, 2153066798);
    do_check_eq(aTotal, 1);
    do_check_eq(aSuccessful, 0);
    do_check_eq(this._initialTotal, 1);
    do_check_eq(msgSendLater.sendingMessages, false);

    do_test_finished();
  }
};

function OnStopCopy(aStatus) {
  do_check_eq(aStatus, 0);

  // Check this is false before we start sending
  do_check_eq(msgSendLater.sendingMessages, false);

  let folder = msgSendLater.getUnsentMessagesFolder(identity);

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
  // Test file - for bug 429891
  originalData = loadFileToString(testFile);

  // Ensure we have a local mail account, an normal account and appropriate
  // servers and identities.
  loadLocalMailAccount();

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
