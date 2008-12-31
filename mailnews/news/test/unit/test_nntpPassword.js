/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Authentication tests for NNTP (based on RFC4643).
 *
 * Note: Logins for newsgroup servers for 1.8 were stored with either the
 * default port or the SSL default port. Nothing else!
 */

// The basic daemon to use for testing nntpd.js implementations
var daemon = setupNNTPDaemon();

// Define these up here for checking with the transaction
var type = null;
var test = null;

function run_test() {
  type = "RFC 4643";

  // Passwords File (generated from Mozilla 1.8 branch).
  var signons = do_get_file("../mailnews/test/data/signons-mailnews1.8.txt");

  // Copy the file to the profile directory for a PAB
  signons.copyTo(gProfileDir, "signons.txt");

  var handler = new NNTP_RFC4643_extension(daemon);

  var server = new nsMailServer(handler);
  server.start(NNTP_PORT);

  try {
    var prefix = "news://localhost:"+NNTP_PORT+"/";
    var transaction;

    // Test - group subscribe listing
    test = "news:*";
    setupProtocolTest(NNTP_PORT, prefix+"*");
    server.performTest();
    transaction = server.playTransaction();
    do_check_transaction(transaction, ["MODE READER", "LIST",
                                       "AUTHINFO user testnews",
                                       "AUTHINFO pass newstest", "LIST"]);

  } catch (e) {
    dump("NNTP Protocol test "+test+" failed for type RFC 977:\n");
    try {
      var trans = server.playTransaction();
     if (trans)
        dump("Commands called: "+trans.them+"\n");
    } catch (exp) {}
    do_throw(e);
  }
  server.stop();

  var thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);
}
