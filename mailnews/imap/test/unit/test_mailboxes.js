/**
 * Tests basic mailbox handling of IMAP, like discovery, rename and empty folder.
 */

load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");
load("../../../resources/messageGenerator.js");

function setup() {
  setupIMAPPump();

  IMAPPump.daemon.createMailbox("I18N box\u00E1", {subscribed : true});
  IMAPPump.daemon.createMailbox("Unsubscribed box");
  // Create an all upper case trash folder name to make sure
  // we handle special folder names case-insensitively.
  IMAPPump.daemon.createMailbox("TRASH", {subscribed : true});

  // Get the server list...
  IMAPPump.server.performTest("LIST");

  IMAPPump.inbox.updateFolderWithListener(null, asyncUrlListener);
  yield false;
}

var tests = [
  setup,
  function checkDiscovery() {
    dump("in check discovery\n");
    let rootFolder = IMAPPump.incomingServer.rootFolder;
    // Check that we've subscribed to the boxes returned by LSUB. We also get
    // checking of proper i18n in mailboxes for free here.
    do_check_true(rootFolder.containsChildNamed("Inbox"));
    do_check_true(rootFolder.containsChildNamed("TRASH"));
    // Make sure we haven't created an extra "Trash" folder.
    let trashes = rootFolder.getFoldersWithFlags(Ci.nsMsgFolderFlags.Trash);
    do_check_eq(trashes.length, 1);
    do_check_eq(rootFolder.numSubFolders, 3);
    do_check_true(rootFolder.containsChildNamed("I18N box\u00E1"));
    // This is not a subscribed box, so we shouldn't be subscribing to it.
    do_check_false(rootFolder.containsChildNamed("Unsubscribed box"));

    let i18nChild = rootFolder.getChildNamed("I18N box\u00E1");

    MailServices.imap.renameLeaf(i18nChild,
                                 "test \u00E4",
                                 asyncUrlListener,
                                 null);
    yield false;
  },
  function checkRename() {
    let rootFolder = IMAPPump.incomingServer.rootFolder;
    do_check_true(rootFolder.containsChildNamed("test \u00E4"));
    let newChild = rootFolder.getChildNamed("test \u00E4").
                   QueryInterface(Ci.nsIMsgImapMailFolder);
    newChild.updateFolderWithListener(null, asyncUrlListener);
    yield false;
  },
  function checkEmptyFolder() {
    try {
    let serverSink = IMAPPump.server.QueryInterface(Ci.nsIImapServerSink);
      serverSink.possibleImapMailbox("/", '/', 0);
    }
    catch (ex) {
      // we expect this to fail, but not crash or assert.
    }
  },
  teardown
];

function teardown() {
  teardownIMAPPump();
}

function run_test() {
  async_run_tests(tests);
}
