/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Server which advertises CRAM-MD5, but is impolite enough to just
 * disconnect (close the TCP connection) when we try it.
 *
 * This is a tough one, because we may lose state on which auth schemes
 * are allowed and which ones failed and may restart from scratch, and
 * retry, never skipping the failed scheme.
 * Dear server implementors, NEVER DO THAT! Be polite, give an error
 * with explanation and by all means keep the connection open.
 *
 * I don't know if real servers do that, but bienvenu says they exist.
 *
 * TODO:
 * This test shows that the current situation is not good.
 * Problems:
 * - We should reopen the connection, remember which auth scheme failed
 *    and start with the next in list, not trying the broken one again.
 *    We currently neither retry nor remember.
 * - OnStopRunningUrl() returns success although the server closed the connection
 *    and it's clearly not successful.
 * - incomingServer thinks it is still running/busy although the connection is
 *    clearly done and over.
 *
 * @author Ben Bucksch
 */

var server;
var daemon;
var handler;
var incomingServer;
var pop3Service;
const test = "Server which advertises CRAM-MD5, but closes the connection when it's tried";
// that's how it currently looks like (we fail to log in):
const expectedTransaction = [ "AUTH", "CAPA", "AUTH CRAM-MD5" ];
// TODO that's how it should look like (we start a new connection and try another scheme):
//const expectedTransaction = [ "AUTH", "CAPA", "AUTH CRAM-MD5", "CAPA", "AUTH PLAIN", "STAT" ];

var urlListener =
{
  OnStartRunningUrl: function (url) {
  },
  OnStopRunningUrl: function (url, result) {
    try {
      // TODO we should be getting an error here, if we couldn't log in, but we don't.
      do_check_eq(result, 0);

      var transaction = server.playTransaction();
      do_check_transaction(transaction, expectedTransaction);

      do_timeout(0, endTest);
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
     server._readers.forEach(function (reader) {
        //reader.closeSocket(); doesn't close right away
        reader._realCloseSocket();
    });
    return "-ERR I don't feel like it";
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
