// Bug 403242 stems from invalid message ids

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

var daemon, localserver, server;

function run_test() {
  daemon = setupNNTPDaemon();
  daemon.addGroup("test1");
  daemon.addArticle(make_article(do_get_file("postings/bug403242.eml")));
  localserver = setupLocalServer(NNTP_PORT);
  localserver.subscribeToNewsgroup("test1");
  server = makeServer(NNTP_RFC2980_handler, daemon);
  server.start(NNTP_PORT);

  let folder = localserver.rootFolder.getChildNamed("test1");
  folder.getNewMessages(null, {
    OnStopRunningUrl: function () { localserver.closeCachedConnections(); }});
  server.performTest();

  // Fetch the message
  let uri = folder.generateMessageURI(1);
  var msgService = Cc['@mozilla.org/messenger/messageservice;1?type=news']
                     .getService(Ci.nsIMsgMessageService);

  // Does the URL lie to us?
  let outObj = { value: null };
  msgService.GetUrlForUri(uri, outObj, null);
  let neckoUrl = outObj.value.QueryInterface(Ci.nsINntpUrl);
  do_check_eq(neckoUrl.newsAction, Ci.nsINntpUrl.ActionFetchArticle);

  // Pretend to display the message
  msgService.DisplayMessage(uri, articleTextListener, null, null, null, {});
  // Get the server to run
  var thread = gThreadManager.currentThread;
  while (!articleTextListener.finished)
    thread.processNextEvent(true);
  localserver.closeCachedConnections();
  server.stop();

  // Correct text?
  do_check_eq(articleTextListener.data, daemon.getGroup("test1")[1].fullText);

  // No illegal commands?
  test = "bug 403242";
  let transaction = server.playTransaction();
  do_check_transaction(transaction[transaction.length - 1],
    ["MODE READER", "GROUP test1", "ARTICLE 1"]);

}
