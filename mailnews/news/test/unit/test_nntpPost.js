/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
// Tests that the news can correctly post messages

function run_test() {
  var daemon = setupNNTPDaemon();
  var localserver = setupLocalServer(NNTP_PORT);
  var listener = { OnStopRunningUrl: function () {
    localserver.closeCachedConnections();
  }};

  // Tests bug 484656.
  localserver.realHostName = localserver.hostName;
  localserver.hostName = "news.example.com";

  var server = new nsMailServer(new NNTP_RFC977_handler(daemon));
  server.start(NNTP_PORT);

  try {
    var nntpService = Cc["@mozilla.org/messenger/nntpservice;1"]
                        .getService(Ci.nsINntpService);
    nntpService.postMessage(do_get_file("postings/post1.eml"), "test.empty",
      localserver.key, listener, null);
    server.performTest();
    server.stop();

    var thread = gThreadManager.currentThread;
    while (thread.hasPendingEvents())
      thread.processNextEvent(true);
  } catch (e) {
    server.stop();
    do_throw(e);
  }
}
