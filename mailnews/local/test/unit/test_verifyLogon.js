/**
 * This test checks to see if the pop3 verify logon handles password failure correctly.
 * The steps are:
 *   - Set an invalid password on the server object.
 *   - Check that verifyLogon fails
 */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource:///modules/mailServices.js");

load("../../../resources/alertTestUtils.js");

var test = null;
var server;
var daemon;
var incomingServer;
var pop3Service;
var attempt = 0;

const kUserName = "testpop3";
const kInvalidPassword = "pop3test";
const kValidPassword = "testpop3";

function verifyPop3Logon(validPassword) {
  incomingServer.password = (validPassword) ? kValidPassword : kInvalidPassword;
  urlListener.expectSuccess = validPassword;
  let uri = incomingServer.verifyLogon(urlListener, gDummyMsgWindow);
  // clear msgWindow so url won't prompt for passwords.
  uri.QueryInterface(Ci.nsIMsgMailNewsUrl).msgWindow = null;

  server.performTest();
  return false;
}

var urlListener =
{
  expectSucess : false,
  OnStartRunningUrl: function (url) {
  },
  OnStopRunningUrl: function (url, aResult) {
    do_check_eq(Components.isSuccessCode(aResult), this.expectSuccess);
  }
};

function actually_run_test() {
  server.start(POP3_PORT);
  daemon.setMessages(["message1.eml"]);

  // check that verifyLogon fails with bad password
  verifyPop3Logon(false);

  dump("\nverify logon false 1\n");
  do_timeout(1000, verifyGoodLogon);
}

function verifyGoodLogon() {
  server.resetTest();

  // check that verifyLogon succeeds with good password
  verifyPop3Logon(true);

  dump("\nverify logon true 1\n");
  do_test_finished();
}

function run_test()
{
  // Disable new mail notifications
  Services.prefs.setBoolPref("mail.biff.play_sound", false);
  Services.prefs.setBoolPref("mail.biff.show_alert", false);
  Services.prefs.setBoolPref("mail.biff.show_tray_icon", false);
  Services.prefs.setBoolPref("mail.biff.animate_dock_icon", false);
  // Set up the Server
  daemon = new pop3Daemon();
  function createHandler(d) {
    var handler = new POP3_RFC1939_handler(d);
    // Set the server expected username & password to what we have in signons.txt
    handler.kUsername = kUserName;
    handler.kPassword = kValidPassword;
    handler.dropOnAuthFailure = true;
    return handler;
  }
  server = new nsMailServer(createHandler, daemon);

  // Set up the basic accounts and folders.
  // We would use createPop3ServerAndLocalFolders() however we want to have
  // a different username and NO password for this test (as we expect to load
  // it from signons.txt).
  localAccountUtils.loadLocalMailAccount();


  incomingServer = MailServices.accounts
                    .createIncomingServer(kUserName,"localhost", "pop3");

  incomingServer.port = POP3_PORT;

  do_test_pending();

  actually_run_test();
}
