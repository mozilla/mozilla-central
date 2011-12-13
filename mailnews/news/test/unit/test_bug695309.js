/* Tests the connection mayhem found by bug 695309 */

// The full bug requires several things to fall into place:
// 1. Cause the connections to timeout, while keeping them in the cache.
// 2. Enqueue enough requests to cause things to be placed in the pending queue.
// 3. Commands try to run but die instead.
// 4. Enqueue more requests to open up new connections.
// 5. When loading, the connection ends up pulling somebody from the queue and
//    ends up treating the response for the prior command as the current
//    response.
// 6. This causes, in particular, GROUP to read the logon string as the response
//    (where sprintf clears everything to 0), and AUTHINFO to think credentials
//    are wrong. The bug's description is then caused by the next read seeing
//    a large number of (not really) new messages.
// For the purposes of this test, we read enough to see if the group command is
// being misread or not, as it is complicated enough.

load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");
load("../../../resources/alertTestUtils.js");

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

var daemon, localserver, server;
var killConnection = false;
var highWater = 0;

var tests = [
  test_newMsgs,
  trigger_bug,
  cleanUp
];

function test_newMsgs() {
  // Start by initializing the folder, and mark some messages as read.
  let folder = localserver.rootFolder.getChildNamed("test.filter");
  do_check_eq(folder.getTotalMessages(false), 0);
  folder.getNewMessages(null, asyncUrlListener);
  // Do another folder to use up both connections
  localserver.rootFolder.getChildNamed("test.subscribe.simple")
                        .getNewMessages(null, asyncUrlListener);
  // Two things to listen for -- yield twice
  yield false;
  yield false;
  folder.QueryInterface(Ci.nsIMsgNewsFolder)
        .setReadSetFromStr("1-3");
  do_check_eq(folder.getTotalMessages(false) - folder.getNumUnread(false), 3);
  highWater = folder.getTotalMessages(false);
  do_check_eq(folder.msgDatabase.dBFolderInfo.highWater, highWater);
}

function trigger_bug() {
  // Kill the connection and start it up again.
  dump("Stopping server!\n");
  server.stop();
  server = makeServer(NNTP_RFC2980_handler, daemon);
  server.start(NNTP_PORT);

  // Get new messages for all folders. Once we've seen one folder, trigger a
  // load of the folder in question. This second load should, if the bug is
  // present, be overwritten with one from the load queue that causes the
  // confusion. It then loads it again, and should (before the patch that fixes
  // this) read the 200 logon instead of the 211 group.
  let folder = localserver.rootFolder.getChildNamed("test.filter");
  localserver.performExpand(null);
  // We also need a callback to know that folders have been loaded.
  let folderListener = {
    OnItemEvent: function (item, event) {
      dump(event.toString() + " triggered for " + item.prettyName + "!\n\n\n");
      if (event.toString() == "FolderLoaded" &&
          item.prettyName == "test.subscribe.simple") {
        folder.getNewMessages(null, asyncUrlListener);
      } else if (event.toString() == "FolderLoaded" && item == folder) {
        async_driver();
      }
    },
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIFolderListener])
  };
  let mailSession = Cc["@mozilla.org/messenger/services/session;1"]
                      .getService(Ci.nsIMsgMailSession);
  mailSession.AddFolderListener(folderListener, Ci.nsIFolderListener.event);
  // Again, two things will need to be listened for
  yield false;
  yield false;
  do_check_eq(folder.msgDatabase.dBFolderInfo.highWater, highWater);
  yield true;
}
function cleanUp() {
  localserver.closeCachedConnections();
}
function run_test() {
  daemon = setupNNTPDaemon();
  localserver = setupLocalServer(NNTP_PORT);
  localserver.maximumConnectionsNumber = 2;
  server = makeServer(NNTP_RFC2980_handler, daemon);
  server.start(NNTP_PORT);

  async_run_tests(tests);
}

