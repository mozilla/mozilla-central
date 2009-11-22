// Import the main scripts that mailnews tests need to set up and tear down
load("../../mailnews/resources/mailDirService.js");
load("../../mailnews/resources/mailTestUtils.js");

// Import the smtp server scripts
load("../../mailnews/fakeserver/maild.js")
load("../../mailnews/fakeserver/smtpd.js")

const SMTP_PORT = 1024+120;

// Setup the daemon and server
function setupServerDaemon(handler) {
  if (!handler)
    handler = new SMTP_RFC2822_handler(new smtpDaemon());
  var server = new nsMailServer(handler);
  return server;
}

function getBasicSmtpServer() {
  var smtpService = Cc["@mozilla.org/messengercompose/smtp;1"]
                      .getService(Ci.nsISmtpService);

  // Create an smtp server and fill in the details.
  var smtpServer = smtpService.createSmtpServer();

  smtpServer.hostname = "localhost";
  smtpServer.port = SMTP_PORT;
  // Set the authentication method to "none"
  smtpServer.authMethod = 0;

  // Override the default greeting so we get something predicitable
  // in the ELHO message
  var prefSvc = Components.classes["@mozilla.org/preferences-service;1"]
    .getService(Components.interfaces.nsIPrefBranch);

  prefSvc.setCharPref("mail.smtpserver.default.hello_argument", "test");

  return smtpServer;
}

function getSmtpIdentity(senderName, smtpServer) {
  // Get the servers
  var acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                  .getService(Ci.nsIMsgAccountManager);

  // Set up the identity
  var identity = acctMgr.createIdentity();
  identity.email = senderName;
  identity.smtpServerKey = smtpServer.key;

  return identity;
}

var test;

function do_check_transaction(real, expected) {
  // real.them may have an extra QUIT on the end, where the stream is only
  // closed after we have a chance to process it and not them. We therefore
  // excise this from the list
  if (real.them[real.them.length-1] == "QUIT")
    real.them.pop();

  do_check_eq(real.them.join(","), expected.join(","));
  dump("Passed test " + test + "\n");
}

// This listener is designed just to call OnStopCopy() when its OnStopCopy
// function is called - the rest of the functions are unneeded for a lot of
// tests (but we can't use asyncCopyListener because we need the
// nsIMsgSendListener interface as well).
var copyListener = {
  // nsIMsgSendListener
  onStartSending: function (aMsgID, aMsgSize) {},
  onProgress: function (aMsgID, aProgress, aProgressMax) {},
  onStatus: function (aMsgID, aMsg) {},
  onStopSending: function (aMsgID, aStatus, aMsg, aReturnFile) {},
  onGetDraftFolderURI: function (aFolderURI) {},
  onSendNotPerformed: function (aMsgID, aStatus) {},

  // nsIMsgCopyServiceListener
  OnStartCopy: function () {},
  OnProgress: function (aProgress, aProgressMax) {},
  SetMessageKey: function (aKey) {},
  GetMessageId: function (aMessageId) {},
  OnStopCopy: function (aStatus) {
    OnStopCopy(aStatus);
  },

  // QueryInterface
  QueryInterface: function (iid) {
    if (iid.equals(Ci.nsIMsgSendListener) ||
        iid.equals(Ci.nsIMsgCopyServiceListener) ||
        iid.equals(Ci.nsISupports))
      return this;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  }
};
