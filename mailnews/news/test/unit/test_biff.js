// This tests that we can execute biff properly, specifically that filters are
// run during biff, producing correct counts.

load("../../mailnews/resources/filterTestUtils.js");

function run_test() {
  // Set up the server and add in filters
  let daemon = setupNNTPDaemon();
  let localserver = setupLocalServer(NNTP_PORT);
  // Remove all but the test.filter folder
  let rootFolder = localserver.rootFolder;
  let enumerator = rootFolder.subFolders;
  while (enumerator.hasMoreElements()) {
    let folder = enumerator.getNext().QueryInterface(Ci.nsIMsgFolder);
    if (folder.name != "test.filter")
      rootFolder.propagateDelete(folder, true, null);
  }

  // Create a filter to mark one message read.
  let filters = localserver.getFilterList(null);
  filters.loggingEnabled = true;
  createFilter(filters, "subject", "Odd", "read");
  localserver.setFilterList(filters);

  let server = new nsMailServer(new NNTP_RFC2980_handler(daemon));
  server.start(NNTP_PORT);

  // This is a bit hackish, but we don't have any really functional callbacks
  // for biff. Instead, we use the notifier to look for all 7 messages to be
  // added and take that as our sign that the download is finished.
  let expectCount = 7, seen = 0;
  let notifier = Cc["@mozilla.org/messenger/msgnotificationservice;1"]
                   .getService(Ci.nsIMsgFolderNotificationService);
  let listener = { msgAdded: function() {
    if (++seen == expectCount)
      localserver.closeCachedConnections();
    }};
  notifier.addListener(listener, Ci.nsIMsgFolderNotificationService.msgAdded);
  localserver.performBiff(null);
  server.performTest();
  notifier.removeListener(listener);

  // We marked, via our filters, one of the messages read. So if we do not
  // have 1 read message, either we're not running the filters on biff, or the
  // filters aren't working. This is disambiguated by the test_filter.js test.
  let folder = localserver.rootFolder.getChildNamed("test.filter");
  do_check_eq(folder.getTotalMessages(false), folder.getNumUnread(false) + 1);
  server.stop();
}
