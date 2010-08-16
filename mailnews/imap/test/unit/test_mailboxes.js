// This file tests the mailbox handling of IMAP.

var gServer, gLocalServer;
var gCurTestNum;
var rootFolder;

const gIMAPService = Cc["@mozilla.org/messenger/imapservice;1"]
                       .getService(Ci.nsIImapService);

function run_test() {
  var daemon = new imapDaemon();
  daemon.createMailbox("I18N box\u00E1", {subscribed : true});
  daemon.createMailbox("Unsubscribed box");
  gServer = makeServer(daemon, "");

  gLocalServer = createLocalIMAPServer();

  // The server doesn't support more than one connection
  let prefBranch = Cc["@mozilla.org/preferences-service;1"]
                     .getService(Ci.nsIPrefBranch);
  prefBranch.setIntPref("mail.server.server1.max_cached_connections", 1);
  // Make sure no biff notifications happen
  prefBranch.setBoolPref("mail.biff.play_sound", false);
  prefBranch.setBoolPref("mail.biff.show_alert", false);
  prefBranch.setBoolPref("mail.biff.show_tray_icon", false);
  prefBranch.setBoolPref("mail.biff.animate_dock_icon", false);
  // We aren't interested in downloading messages automatically
  prefBranch.setBoolPref("mail.server.server1.download_on_biff", false);

  // Get the server list...
  gLocalServer.performExpand(null);
  gServer.performTest("SUBSCRIBE");

  do_test_pending();

  doTest(1);
}

const gTestArray =
[
  function checkDiscovery() {
    rootFolder = gLocalServer.rootFolder;
    // Check that we've subscribed to the boxes returned by LSUB. We also get
    // checking of proper i18n in mailboxes for free here.
    do_check_true(rootFolder.containsChildNamed("Inbox"));
    do_check_true(rootFolder.containsChildNamed("I18N box\u00E1"));
    // This is not a subscribed box, so we shouldn't be subscribing to it.
    do_check_false(rootFolder.containsChildNamed("Unsubscribed box"));

    let i18nChild = rootFolder.getChildNamed("I18N box\u00E1");
    let uiThread =   Cc["@mozilla.org/thread-manager;1"]
                        .getService(Ci.nsIThreadManager).mainThread;

    gIMAPService.renameLeaf(uiThread, i18nChild, "test \u00E4", UrlListener, null);
  },
  function checkRename() {
    do_check_true(rootFolder.containsChildNamed("test \u00E4"));
    let newChild = rootFolder.getChildNamed("test \u00E4").
                   QueryInterface(Ci.nsIMsgImapMailFolder);
    newChild.updateFolderWithListener(null, UrlListener);
  },
  function checkEmptyFolder() {
    try {
    let serverSink = gLocalServer.QueryInterface(Ci.nsIImapServerSink);
      serverSink.possibleImapMailbox("/", '/', 0);
    }
    catch (ex) {
      // we expect this to fail, but not crash or assert.
    }
    do_timeout_function(0, function(){doTest(++gCurTestNum)});
  },
];

function endTest()
{
  // Clean up the server in preparation
  gServer.resetTest();
  gLocalServer.closeCachedConnections();
  gServer.performTest();
  gServer.stop();

  do_test_finished();
}
function doTest(test)
{
  if (test <= gTestArray.length)
  {
    dump("Doing test " + test + "\n");
    gCurTestNum = test;

    var testFn = gTestArray[test-1];
    // Set a limit of 10 seconds; if the notifications haven't arrived by then there's a problem.
    do_timeout_function(10000, function(){
        if (gCurTestNum == test)
          do_throw("Notifications not received in 10000 ms for operation " + testFn.name);
        }
      );
    try {
    testFn();
    } catch(ex) {do_throw(ex);}
  }
  else
  {
    // Cleanup, null out everything, close all cached connections and stop the
    // server
    gRootFolder = null;
    gIMAPInbox = null;
    gMsgImapInboxFolder = null;
    gIMAPTrashFolder = null;
    do_timeout_function(1000, endTest);
  }
}

var UrlListener =
{
  OnStartRunningUrl: function(url) { },

  OnStopRunningUrl: function (aUrl, aExitCode) {
    // Check: message successfully copied.
    do_check_eq(aExitCode, 0);
    // Ugly hack: make sure we don't get stuck in a JS->C++->JS->C++... call stack
    // This can happen with a bunch of synchronous functions grouped together, and
    // can even cause tests to fail because they're still waiting for the listener
    // to return
    do_timeout_function(0, function(){doTest(++gCurTestNum)});
  }
};
