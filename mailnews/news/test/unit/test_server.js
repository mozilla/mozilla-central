////////////////////////////////////////////////////////////////////////////////
// Protocol tests for NNTP. These actually aren't too important, but their main
// purpose is to make sure that maild is working properly and to provide
// examples for how using maild. They also help make sure that I coded nntpd.js
// right, both logically and for RFC compliance.
// TODO:
// * We need to hook up mochitest,
// * TLS negotiation.
////////////////////////////////////////////////////////////////////////////////

// The basic daemon to use for testing nntpd.js implementations
var daemon = setupNNTPDaemon();

// Define these up here for checking with the transaction
var type = null;
var test = null;

////////////////////////////////////////////////////////////////////////////////
//                             NNTP SERVER TESTS                              //
////////////////////////////////////////////////////////////////////////////////
// Functions in order as defined in nntpd.js. Each function tests the URLs    //
// that are located over the implementation of nsNNTPProtocol::LoadURL and    //
// added in bug 400331. Furthermore, they are tested in rough order as they   //
// would be expected to be used in a session. If more URL types are modified, //
// please add a corresponding type to the following tests.                    //
// When adding new servers, only test the commands that become different for  //
// each specified server, to keep down redudant tests.                        //
////////////////////////////////////////////////////////////////////////////////

function testRFC977() {
  type = "RFC 977";
  var server = makeServer(NNTP_RFC977_handler, daemon);
  server.start(NNTP_PORT);

  try {
    var prefix = "news://localhost:"+NNTP_PORT+"/";
    var transaction;

    // Test - group subscribe listing
    test = "news:*";
    setupProtocolTest(NNTP_PORT, prefix+"*");
    server.performTest();
    transaction = server.playTransaction();
    do_check_transaction(transaction, ["MODE READER", "LIST"]);

    // Test - getting group headers
    test = "news:test.subscribe.empty";
    server.resetTest();
    setupProtocolTest(NNTP_PORT, prefix+"test.subscribe.empty");
    server.performTest();
    transaction = server.playTransaction();
    do_check_transaction(transaction, ["MODE READER",
      "GROUP test.subscribe.empty"]);

    // Test - getting an article
    test = "news:MESSAGE_ID";
    server.resetTest();
    setupProtocolTest(NNTP_PORT, prefix+"TSS1@nntp.test");
    server.performTest();
    transaction = server.playTransaction();
    do_check_transaction(transaction, ["MODE READER",
        "ARTICLE <TSS1@nntp.test>"]);

    // Test - news expiration
    test = "news:GROUP?list-ids";
    server.resetTest();
    setupProtocolTest(NNTP_PORT, prefix+"test.filter?list-ids");
    server.performTest();
    transaction = server.playTransaction();
    do_check_transaction(transaction, ["MODE READER",
        "listgroup test.filter"]);

    // Test - posting
    test = "news with post";
    server.resetTest();
    var url = create_post(prefix, "postings/post1.eml");
    setupProtocolTest(NNTP_PORT, url);
    server.performTest();
    transaction = server.playTransaction();
    do_check_transaction(transaction, ["MODE READER", "POST"]);
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

function testConnectionLimit() {
  var server = makeServer(NNTP_RFC977_handler, daemon);
  server.start(NNTP_PORT);

  var prefix = "news://localhost:"+NNTP_PORT+"/";
  var transaction;

  // To test make connections limit, we run two URIs simultaneously.
  var url = URLCreator.newURI(prefix+"*", null, null);
  _server.loadNewsUrl(url, null, null);
  setupProtocolTest(NNTP_PORT, prefix+"TSS1@nntp.test");
  server.performTest();
  // We should have length one... which means this must be a transaction object,
  // containing only us and them
  do_check_true('us' in server.playTransaction());
  server.stop();

  var thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);
}

function testReentrantClose() {
  // What we are testing is that a CloseConnection that spins the event loop
  // does not cause a crash.
  var server = makeServer(NNTP_RFC977_handler, daemon);
  server.start(NNTP_PORT);

  var listener = {
    OnStartRunningUrl: function (url) {},
    OnStopRunningUrl: function (url, rv) {
      // Spin the event loop (entering nsNNTPProtocol::ProcessProtocolState)
      let thread = gThreadManager.currentThread;
      while (thread.hasPendingEvents())
        thread.processNextEvent(true);
    }
  };
  // Nice multi-step command--we can close while executing this URL if we are
  // careful.
  var url = URLCreator.newURI("news://localhost:" + NNTP_PORT +
    "/test.filter", null, null);
  url.QueryInterface(Ci.nsIMsgMailNewsUrl);
  url.RegisterListener(listener);

  _server.loadNewsUrl(url, null, null);
  server.performTest("GROUP");
  dump("Stopping server\n");
  gThreadManager.currentThread.dispatch(
    { run: function() { _server.closeCachedConnections(); } },
    Ci.nsIEventTarget.DISPATCH_NORMAL);
  server.performTest();
  server.stop();

  // Break refcnt loops
  listener = url = null;
}

function testManyConnections() {
  // Start up 2 connections at once and make sure that they don't conflict
  var server = makeServer(NNTP_RFC2980_handler, daemon);
  setupLocalServer(NNTP_PORT);
  server.start(NNTP_PORT);
  _server.maximumConnectionsNumber = 3;
  var listener = {
    ran: 0,
    OnStartRunningUrl: function (url) {},
    OnStopRunningUrl: function (url, rv) {
      if (--(this.ran) == 0)
        _server.closeCachedConnections();
    }
  };
  let groups = _server.rootFolder.subFolders;
  while (groups.hasMoreElements()) {
    groups.getNext().QueryInterface(Ci.nsIMsgFolder).getNewMessages(null,
      listener);
    listener.ran++;
  }
  server.performTest();
  // The last one that is processed is test.filter, so make sure that
  // test.subscribed.simple is not retrieving the data meant for test.filter
  let folder = _server.rootFolder.getChildNamed("test.subscribe.simple")
  do_check_eq(folder.getTotalMessages(false), 1);
}

function run_test() {
  testRFC977();
  testConnectionLimit();
  testReentrantClose();
  testManyConnections();
}
