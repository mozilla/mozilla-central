/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * A server offers GSSAPI (Kerberos), but auth fails, due to client or server.
 *
 * This mainly tests whether we use the correct login mode.
 *
 * Whether it fails due to
 * - client not set up
 * - client ticket expired / not logged in
 * - server not being set up properly
 * makes no difference to Thunderbird, as that's all hidden in the gssapi-Library
 * from the OS. So, the server here just returning err is a good approximation
 * of reality of the above cases.
 *
 * Actually, we (more precisely the OS GSSAPI lib) fail out of band
 * in the Kerberos protocol, before the AUTH GSSAPI command is even issued.
 *
 * @author Ben Bucksch
 */

var server;
var daemon;
var handler;
var incomingServer;
var pop3Service;
var acctMgr;
var thisTest;
var test = null;

var tests = [
  { title: "GSSAPI auth, server with GSSAPI only",
    clientAuthMethod : Ci.nsMsgAuthMethod.GSSAPI,
    serverAuthMethods : [ "GSSAPI" ],
    expectSuccess : false,
    transaction: [ "AUTH", "CAPA" ] },
    // First GSSAPI step happens and fails out of band, thus no "AUTH GSSAPI"
  { title: "GSSAPI auth, server with GSSAPI and CRAM-MD5",
    clientAuthMethod : Ci.nsMsgAuthMethod.GSSAPI,
    serverAuthMethods : [ "GSSAPI", "CRAM-MD5" ],
    expectSuccess : false,
    transaction: [ "AUTH", "CAPA" ] },
  { title: "Any secure auth, server with GSSAPI only",
    clientAuthMethod : Ci.nsMsgAuthMethod.secure,
    serverAuthMethods : [ "GSSAPI" ],
    expectSuccess : false,
    transaction: [ "AUTH", "CAPA" ] },
  { title: "Any secure auth, server with GSSAPI and CRAM-MD5",
    clientAuthMethod : Ci.nsMsgAuthMethod.secure,
    serverAuthMethods : [ "GSSAPI", "CRAM-MD5" ],
    expectSuccess : true,
    transaction: [ "AUTH", "CAPA", "AUTH CRAM-MD5", "STAT" ] },
  { title: "Encrypted password, server with GSSAPI and CRAM-MD5",
    clientAuthMethod : Ci.nsMsgAuthMethod.passwordEncrypted,
    serverAuthMethods : [ "GSSAPI", "CRAM-MD5" ],
    expectSuccess : true,
    transaction: [ "AUTH", "CAPA", "AUTH CRAM-MD5", "STAT" ] },
];

var urlListener =
{
  OnStartRunningUrl: function (url) {
  },
  OnStopRunningUrl: function (url, result) {
    try {
      if (thisTest.expectSuccess)
        do_check_eq(result, 0);
      else
        do_check_neq(result, 0);

      var transaction = server.playTransaction();
      do_check_transaction(transaction, thisTest.transaction);

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
  if (tests.length == 0) {
    incomingServer.closeCachedConnections();

    // No more tests, let everything finish
    server.stop();

    var thread = gThreadManager.currentThread;
    while (thread.hasPendingEvents())
      thread.processNextEvent(true);

    do_test_finished();
    return;
  }

  // If the server hasn't quite finished, just delay a little longer.
  if (incomingServer.serverBusy ||
      (incomingServer instanceof Ci.nsIPop3IncomingServer &&
       incomingServer.runningProtocol)) {
    do_timeout(20, checkBusy);
    return;
  }

  testNext();
}

function testNext() {
  thisTest = tests.shift();

  // Handle the server in a try/catch/finally loop so that we always will stop
  // the server if something fails.
  try {
    server.resetTest();

    test = thisTest.title;
    dump("NEXT test is: " + thisTest.title + "\n");

    handler.kAuthSchemes = thisTest.serverAuthMethods;

    // Mailnews caches server capabilities, so try to reset it
    deletePop3Server();
    incomingServer = createPop3Server();

    let msgServer = incomingServer;
    msgServer.QueryInterface(Ci.nsIMsgIncomingServer);
    msgServer.authMethod = thisTest.clientAuthMethod;

    pop3Service.GetNewMail(null, urlListener, gLocalInboxFolder,
                           incomingServer);
    server.performTest();
  } catch (e) {
    server.stop();
    do_throw(e);
  }
}

// <copied from="head_maillocal.js::createPop3ServerAndLocalFolders()">
function createPop3Server()
{
  var incoming = acctMgr.createIncomingServer("fred", "localhost", "pop3");
  incoming.port = POP3_PORT;
  incoming.password = "wilma";
  return incoming;
}
//</copied>

function deletePop3Server()
{
  if (!incomingServer)
    return;
  acctMgr.removeIncomingServer(incomingServer, true);
  incomingServer = null;
}

function GSSAPIFail_handler(daemon)
{
  POP3_RFC5034_handler.call(this, daemon);
}
GSSAPIFail_handler.prototype = {
  __proto__ : POP3_RFC5034_handler.prototype, // inherit
  _needGSSAPI : false,
  // kAuthSchemes will be set by test

  AUTH: function(restLine)
  {
    var scheme = restLine.split(" ")[0];
    if (scheme == "GSSAPI")
    {
      this._multiline = true;
      this._needGSSAPI = true;
      return "+";
    }
    return POP3_RFC5034_handler.prototype.AUTH.call(this, restLine); // call parent
  },
  onMultiline: function(line) {
    if (this._needGSSAPI) {
      this._multiline = false;
      this._needGSSAPI = false;
      return "-ERR hm.... shall I allow you? hm... NO.";
    }

    if (POP3_RFC5034_handler.prototype.onMultiline)
      return POP3_RFC5034_handler.prototype.onMultiline.call(this, line); // call parent
    return undefined;
  }
}

function run_test() {
  var isOSX = ("nsILocalFileMac" in Components.interfaces);
  if (isOSX) {
    dump("INFO | test_punycodeURIs.js | Skipping test on mac, bug 604653")
      return;
  }

  // Disable new mail notifications
  var prefSvc = Components.classes["@mozilla.org/preferences-service;1"]
    .getService(Components.interfaces.nsIPrefBranch);

  prefSvc.setBoolPref("mail.biff.play_sound", false);
  prefSvc.setBoolPref("mail.biff.show_alert", false);
  prefSvc.setBoolPref("mail.biff.show_tray_icon", false);
  prefSvc.setBoolPref("mail.biff.animate_dock_icon", false);

  daemon = new pop3Daemon();
  handler = new GSSAPIFail_handler(daemon);
  server = new nsMailServer(handler);
  server.start(POP3_PORT);

  //incomingServer = createPop3ServerAndLocalFolders();
  loadLocalMailAccount();

  pop3Service = Cc["@mozilla.org/messenger/popservice;1"]
                      .getService(Ci.nsIPop3Service);
  acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                  .getService(Ci.nsIMsgAccountManager);

  do_test_pending();

  testNext();
}
