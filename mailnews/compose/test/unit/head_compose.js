// Import the main scripts that mailnews tests need to set up and tear down
do_import_script("../mailnews/test/resources/mailDirService.js");
do_import_script("../mailnews/test/resources/mailTestUtils.js");

// Import the smtp server scripts
do_import_script("../mailnews/test/fakeserver/maild.js")
do_import_script("../mailnews/test/fakeserver/smtpd.js")

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

function do_check_transaction(real, expected) {
  // real.them may have an extra QUIT on the end, where the stream is only
  // closed after we have a chance to process it and not them. We therefore
  // excise this from the list
  if (real.them[real.them.length-1] == "QUIT")
    real.them.pop();

  do_check_eq(real.them.join(","), expected.join(","));
  dump("Passed test " + test + "\n");
}
