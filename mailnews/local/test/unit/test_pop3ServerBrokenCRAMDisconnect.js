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
 * - incomingServer thinks it is still running/busy although the connection is
 *    clearly done and over.
 *
 * @author Ben Bucksch
 */

Components.utils.import("resource:///modules/mailServices.js");

var server;
var daemon;
var incomingServer;
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
      // We should be getting an error here, because we couldn't log in.
      do_check_eq(result, Cr.NS_ERROR_FAILURE);

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

function endTest() {
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
    this.closing = true;
    return "-ERR I don't feel like it";
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
