/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Server which advertises CRAM-MD5, but fails when it's tried.
 * This reportedly happens for some misconfigured servers.
 */
Components.utils.import("resource:///modules/mailServices.js");

var server;
var daemon;
var incomingServer;
const test = "Server which advertises CRAM-MD5, but fails when it's tried";
const expectedTransaction = [ "AUTH", "CAPA", "AUTH CRAM-MD5", "AUTH PLAIN", "STAT" ];

var urlListener =
{
  OnStartRunningUrl: function (url) {
  },
  OnStopRunningUrl: function (url, result) {
    try {
      do_check_eq(result, 0);

      var transaction = server.playTransaction();
      do_check_transaction(transaction, expectedTransaction);

      do_timeout(0, checkBusy);
    } catch (e) {
      server.stop();
      var thread = gThreadManager.currentThread;
      while (thread.hasPendingEvents())
        thread.processNextEvent(true);

      do_throw(e);
    }
  }
};

function checkBusy() {
  // If the server hasn't quite finished, just delay a little longer.
  if (incomingServer.serverBusy ||
      (incomingServer instanceof Ci.nsIPop3IncomingServer &&
       incomingServer.runningProtocol)) {
    do_timeout(20, checkBusy);
    return;
  }

  endTest();
}

function endTest() {
  incomingServer.closeCachedConnections();

  // No more tests, let everything finish
  server.stop();

  var thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);

  do_test_finished();
}

function CRAMFail_handler(daemon)
{
  POP3_RFC5034_handler.call(this, daemon);

  this._kAuthSchemeStartFunction["CRAM-MD5"] = this.killConn;
}
CRAMFail_handler.prototype = {
  __proto__ : POP3_RFC5034_handler.prototype, // inherit

  killConn : function()
  {
    this._multiline = false;
    this._state = kStateAuthNeeded;
    return "-ERR I just pretended to implement CRAM-MD5";
  }
}

function run_test() {
  try {
    do_test_pending();

    // Disable new mail notifications
    Services.prefs.setBoolPref("mail.biff.play_sound", false);
    Services.prefs.setBoolPref("mail.biff.show_alert", false);
    Services.prefs.setBoolPref("mail.biff.show_tray_icon", false);
    Services.prefs.setBoolPref("mail.biff.animate_dock_icon", false);

    daemon = new pop3Daemon();
    function createHandler(d) {
      return new CRAMFail_handler(d);
    }
    server = new nsMailServer(createHandler, daemon);
    server.start(POP3_PORT);

    incomingServer = createPop3ServerAndLocalFolders();
    let msgServer = incomingServer;
    msgServer.QueryInterface(Ci.nsIMsgIncomingServer);
    // Need to allow any auth here, although that's not use in TB really,
    // because we need to fall back to something after CRAM-MD5 and
    // check that login works after we fell back.
    msgServer.authMethod = Ci.nsMsgAuthMethod.anything;

    MailServices.pop3.GetNewMail(null, urlListener, localAccountUtils.inboxFolder,
                                 incomingServer);
    server.performTest();
  } catch (e) {
    server.stop();

    do_throw(e);
  } finally {
    var thread = gThreadManager.currentThread;
    while (thread.hasPendingEvents())
      thread.processNextEvent(true);
  }
}
