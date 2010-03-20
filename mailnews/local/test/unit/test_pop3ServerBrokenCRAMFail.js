/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Server which advertises CRAM-MD5, but fails when it's tried.
 * This reportedly happens for some misconfigured servers.
 */
var server;
var daemon;
var handler;
var incomingServer;
var pop3Service;
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
    var prefSvc = Components.classes["@mozilla.org/preferences-service;1"]
      .getService(Components.interfaces.nsIPrefBranch);

    prefSvc.setBoolPref("mail.biff.play_sound", false);
    prefSvc.setBoolPref("mail.biff.show_alert", false);
    prefSvc.setBoolPref("mail.biff.show_tray_icon", false);
    prefSvc.setBoolPref("mail.biff.animate_dock_icon", false);

    daemon = new pop3Daemon();
    handler = new CRAMFail_handler(daemon);
    server = new nsMailServer(handler);
    server.start(POP3_PORT);

    incomingServer = createPop3ServerAndLocalFolders();
    let msgServer = incomingServer;
    msgServer.QueryInterface(Ci.nsIMsgIncomingServer);
    // Need to allow any auth here, although that's not use in TB really,
    // because we need to fall back to something after CRAM-MD5 and
    // check that login works after we fell back.
    msgServer.authMethod = Ci.nsMsgAuthMethod.anything;

    pop3Service = Cc["@mozilla.org/messenger/popservice;1"]
                        .getService(Ci.nsIPop3Service);
    pop3Service.GetNewMail(null, urlListener, gLocalInboxFolder,
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
