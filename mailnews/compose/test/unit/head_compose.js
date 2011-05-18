// Import the main scripts that mailnews tests need to set up and tear down
load("../../../resources/mailDirService.js");
load("../../../resources/mailTestUtils.js");

// Import the required setup scripts.
load("../../../resources/abSetup.js");

// Import the smtp server scripts
load("../../../fakeserver/maild.js")
load("../../../fakeserver/auth.js")
load("../../../fakeserver/smtpd.js")

const SMTP_PORT = 1024+120;

// Setup the daemon and server
function setupServerDaemon(handler) {
  if (!handler)
    handler = function (d) { return new SMTP_RFC2821_handler(d); }
  var server = new nsMailServer(handler, new smtpDaemon());
  return server;
}

function getBasicSmtpServer() {
  let server = create_outgoing_server(SMTP_PORT, "user", "password");

  // Override the default greeting so we get something predicitable
  // in the ELHO message
  Services.prefs.setCharPref("mail.smtpserver.default.hello_argument", "test");

  return server;
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
