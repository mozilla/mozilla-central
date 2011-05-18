// Bug 37465 -- assertions with no accounts

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function run_test() {
  var daemon = setupNNTPDaemon();
  var server = makeServer(NNTP_RFC2980_handler, daemon);
  server.start(NNTP_PORT);

  // Correct URI?
  let ioSvc = Cc['@mozilla.org/network/io-service;1']
                    .getService(Ci.nsIIOService);
  let uri = ioSvc.newURI("news://localhost:1143/1@regular.invalid", null, null);
  let newsUri = uri.QueryInterface(Ci.nsINntpUrl)
                   .QueryInterface(Ci.nsIMsgMailNewsUrl);
  do_check_eq(uri.port, NNTP_PORT);
  do_check_eq(newsUri.server, null);
  do_check_eq(newsUri.messageID, "1@regular.invalid");
  do_check_eq(newsUri.folder, null);

  // Run the URI and make sure we get the message
  let channel = ioSvc.newChannelFromURI(uri);
  channel.asyncOpen(articleTextListener, null);

  // Run the server
  var thread = gThreadManager.currentThread;
  while (!articleTextListener.finished)
    thread.processNextEvent(true);

  do_check_eq(articleTextListener.data,
    daemon.getArticle("<1@regular.invalid>").fullText);

  // Shut down connections
  var acctMgr = Cc['@mozilla.org/messenger/account-manager;1']
                  .getService(Ci.nsIMsgAccountManager);
  acctMgr.closeCachedConnections();
  server.stop();
}
