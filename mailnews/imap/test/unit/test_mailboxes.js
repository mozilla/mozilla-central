// This file tests the mailbox handling of IMAP.

var gServer, gLocalServer;

function run_test() {
  var daemon = new imapDaemon();
  daemon.createMailbox("I18N box\u00E1", {subscribed : true});
  daemon.createMailbox("Unsubscribed box");
  gServer = makeServer(daemon, "");

  gLocalServer = createLocalIMAPServer();

  // Get the server list...
  gLocalServer.performExpand(null);
  gServer.performTest("SUBSCRIBE");

  var rootFolder = gLocalServer.rootFolder;
  // Check that we've subscribed to the boxes returned by LSUB. We also get
  // checking of proper i18n in mailboxes for free here.
  do_check_true(rootFolder.containsChildNamed("Inbox"));
  do_check_true(rootFolder.containsChildNamed("I18N box\u00E1"));
  // This is not a subscribed box, so we shouldn't be subscribing to it.
  do_check_false(rootFolder.containsChildNamed("Unsubscribed box"));

  // TODO: RFC 2342 says we should stick Trash in the personal namespace, but
  // we put it in the empty namespace. So we can't test namespace support in
  // this regard because we'd fail...

  do_test_pending();

  do_timeout(1000, "endTest();");
}

function endTest()
{
  // Clean up the server in preparation
  gServer.resetTest();
  gLocalServer.closeCachedConnections();
  gServer.performTest();
  gServer.stop();

  do_test_finished();
}
