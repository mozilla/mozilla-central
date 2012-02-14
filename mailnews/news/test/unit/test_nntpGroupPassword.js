/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Authentication tests for NNTP (based on RFC4643).
 */

// The basic daemon to use for testing nntpd.js implementations
var daemon = setupNNTPDaemon();

// Define these up here for checking with the transaction
var type = null;
var test = null;

function run_test() {
  type = "RFC 4643";

  daemon.groupCredentials = {
    "test.subscribe.empty": ["group1", "pass1"],
    "test.filter": ["group2", "pass2"]
  };

  var server = makeServer(NNTP_RFC4643_extension, daemon);
  server.start(NNTP_PORT);
  var localserver = setupLocalServer(NNTP_PORT);
  localserver.singleSignon = false;

  // Add passwords to the manager
  var serverURI = "news://localhost/";
  var loginMgr = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);
  var loginInfo1 = Cc["@mozilla.org/login-manager/loginInfo;1"]
                     .createInstance(Ci.nsILoginInfo);
  loginInfo1.init(serverURI + "test.subscribe.empty", null,
    serverURI + "test.subscribe.empty", "group1", "pass1", "", "");
  loginMgr.addLogin(loginInfo1);
  var loginInfo2 = Cc["@mozilla.org/login-manager/loginInfo;1"]
                     .createInstance(Ci.nsILoginInfo);
  loginInfo2.init(serverURI + "test.filter", null,
    serverURI + "test.filter", "group2", "pass2", "", "");
  loginMgr.addLogin(loginInfo2);
  try {
    var prefix = "news://localhost:"+NNTP_PORT+"/";
    var transaction;

    test = "per-group password part 1";
    setupProtocolTest(NNTP_PORT, prefix+"test.subscribe.empty", localserver);
    server.performTest();
    transaction = server.playTransaction();
    do_check_transaction(transaction, ["MODE READER",
                                       "GROUP test.subscribe.empty",
                                       "AUTHINFO user group1",
                                       "AUTHINFO pass pass1",
                                       "GROUP test.subscribe.empty"]);

    test = "per-group password part 2";
    server.resetTest();
    setupProtocolTest(NNTP_PORT, prefix+"test.filter", localserver);
    server.performTest();
    transaction = server.playTransaction();
    do_check_transaction(transaction, ["MODE READER", "GROUP test.filter",
                                       "AUTHINFO user group2",
                                       "AUTHINFO pass pass2",
                                       "GROUP test.filter",
                                       "XOVER 1-8"]);

  } catch (e) {
    dump("NNTP Protocol test "+test+" failed for type RFC 977:\n");
    try {
      var trans = server.playTransaction();
     if (trans)
        dump("Commands called: "+uneval(trans)+"\n");
    } catch (exp) {}
    do_throw(e);
  }
  server.stop();

  var thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);
}
