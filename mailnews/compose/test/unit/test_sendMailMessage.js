/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Protocol tests for SMTP.
 *
 * This test currently consists of verifying the correct protocol sequence
 * between mailnews and SMTP server. It does not check the data of the message
 * either side of the link, it will be extended later to do that.
 */
var daemon = setup_daemon();

var type = null;
var test = null;

function do_check_transaction(real, expected) {
  // real.them may have an extra QUIT on the end, where the stream is only
  // closed after we have a chance to process it and not them. We therefore
  // excise this from the list
  if (real.them[real.them.length-1] == "QUIT")
    real.them.pop();

  do_check_eq(real.them.join(","), expected.join(","));
  dump("Passed test " + test + "\n");
}

const SMTP_PORT = 1024+120;
const kSender = "from@invalid.com";
const kTo = "to@invalid.com";

function test_RFC2822() {
  type = "RFC 2822";

  // Get the servers
  var acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                  .getService(Ci.nsIMsgAccountManager);

  var smtpService = Cc["@mozilla.org/messengercompose/smtp;1"]
                      .getService(Ci.nsISmtpService);

  // Test file
  var testFile = do_get_file("mailnews/compose/test/unit/data/message1.eml");

  // Setup the daemon and server
  var handler = new SMTP_RFC2822_handler(daemon);
  var server = new nsMailServer(handler);

  // Ensure we have at least one mail account
  loadLocalMailAccount();

  // Create an smtp server and fill in the details.
  var smtpServer = smtpService.createSmtpServer();

  smtpServer.hostname = "localhost";
  smtpServer.port = SMTP_PORT;
  // Set the authentication method to "none"
  smtpServer.authMethod = 0;

  // Override the default greeting so we get something predicitable
  var prefSvc = Components.classes["@mozilla.org/preferences-service;1"]
    .getService(Components.interfaces.nsIPrefBranch);

  prefSvc.setCharPref("mail.smtpserver.default.hello_argument", "test");

  // Set up the identity
  var identity = acctMgr.createIdentity();
  identity.email = kSender;
  identity.smtpServerKey = smtpServer.key;

  // Handle the server in a try/catch/finally loop so that we always will stop
  // the server if something fails.
  try {
    // Start the fake SMTP server
    server.start(SMTP_PORT);

    // Just a basic test to check we're sending mail correctly.
    test = "Basic sendMailMessage";

    smtpService.sendMailMessage(testFile, kTo, identity,
                                identity.password, null, null, null,
                                false, {}, {});

    server.performTest();

    var transaction = server.playTransaction();
    do_check_transaction(transaction, ["EHLO test",
                                       "MAIL FROM:<" + kSender + "> SIZE=80",
                                       "RCPT TO:<" + kTo + ">",
                                       "DATA"]);
  } catch (e) {
    do_throw(e);
  } finally {
    server.stop();
  
    var thread = gThreadManager.currentThread;
    while (thread.hasPendingEvents())
      thread.processNextEvent(true);
  }
}

function run_test() {
  test_RFC2822();
}
