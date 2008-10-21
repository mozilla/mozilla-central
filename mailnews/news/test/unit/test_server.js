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
  var handler = new NNTP_RFC977_handler(daemon);

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
    do_check_transaction(transaction, ["MODE READER", "LIST"]);

    // GROUP_WANTED fails without UI
    // Test - getting group headers
    /*test = "news:test.empty";
    server.resetTest();
    setupProtocolTest(NNTP_PORT, prefix+"test.empty");
    server.performTest();
    transaction = server.playTransaction();
    do_check_transaction(transaction, []);*/

    // Test - newsrc
    test = "news:";
    server.resetTest();
    setupProtocolTest(NNTP_PORT, prefix+"");
    server.performTest();
    transaction = server.playTransaction();
    do_check_transaction(transaction, ["MODE READER"].concat(
          groups.filter(function (group) { return group[1]; })
                .map(function (group) { return "GROUP "+group[0]; })));

    // Test - getting an article
    test = "news:MESSAGE_ID";
    server.resetTest();
    setupProtocolTest(NNTP_PORT, prefix+"TSS1@nntp.test");
    server.performTest();
    transaction = server.playTransaction();
    do_check_transaction(transaction, ["MODE READER",
        "ARTICLE <TSS1@nntp.test>"]);

    // Broken because of folder brokenness
    // Test - news expiration
    /*test = "news:GROUP/?list-ids";
    server.resetTest();
    setupProtocolTest(NNTP_PORT, prefix+"test.subscribe.empty/?list-ids");
    server.performTest();
    transaction = server.playTransaction();
    do_check_transaction(transaction, ["MODE READER",
        "LISTGROUP test.subscribe.empty"]);*/

    // Test - posting
    test = "news with post";
    server.resetTest();
    var url = create_post(prefix, "../mailnews/news/test/postings/post1.eml");
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

function run_test() {
  testRFC977();
}
