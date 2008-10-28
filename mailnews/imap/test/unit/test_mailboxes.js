// This file tests the mailbox handling of IMAP.

function run_test() {
  var daemon = new imapDaemon();
  daemon.createMailbox("I18N box\u00E1", {subscribed : true});
  daemon.createMailbox("Unsubscribed box");
  var server = makeServer(daemon, "");

  var localserver = createLocalServer();

  // Get the server list...
  localserver.performExpand(null);
  server.performTest("SUBSCRIBE");

  var rootFolder = localserver.rootFolder;
  // Check that we've subscribed to the boxes returned by LSUB. We also get
  // checking of proper i18n in mailboxes for free here.
  do_check_true(rootFolder.containsChildNamed("Inbox"));
  do_check_true(rootFolder.containsChildNamed("I18N box\u00E1"));
  // This is not a subscribed box, so we shouldn't be subscribing to it.
  do_check_false(rootFolder.containsChildNamed("Unsubscribed box"));

  // Clean up the server in preparation
  server.resetTest();
  localserver.closeCachedConnections();
  server.performTest();
  server.stop();

  // TODO: RFC 2342 says we should stick Trash in the personal namespace, but
  // we put it in the empty namespace. So we can't test namespace support in
  // this regard because we'd fail...
}
