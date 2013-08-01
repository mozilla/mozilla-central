// This file tests that listing folders on startup because we're not using
// subscription doesn't leave db's open.

load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");
load("../../../resources/messageGenerator.js");
load("../../../resources/IMAPpump.js");

var gSub3;

var tests = [
  setup,
  updateInbox,
  checkCachedDBForFolder,
  teardown
];

function setup() {
  setupIMAPPump();

  gIMAPDaemon.createMailbox("folder1", {subscribed : true});
  gIMAPDaemon.createMailbox("folder1/sub1", "", {subscribed : true});
  gIMAPDaemon.createMailbox("folder1/sub1/sub2", "", {subscribed : true});
  gIMAPDaemon.createMailbox("folder1/sub1/sub2/sub3", "", {subscribed : true});

  gIMAPIncomingServer.usingSubscription = false;

  let rootFolder = gIMAPIncomingServer.rootFolder.QueryInterface(Ci.nsIMsgImapMailFolder);
  rootFolder.hierarchyDelimiter = '/';
  gIMAPInbox.hierarchyDelimiter = '/';
  rootFolder.addSubfolder("folder1");
  rootFolder.addSubfolder("folder1/sub1");
  rootFolder.addSubfolder("folder1/sub1/sub2");
  gSub3 = rootFolder.addSubfolder("folder1/sub1/sub2/sub3");
  gIMAPServer.performTest("LIST");

  do_timeout(1000, async_driver);
  yield false;
}

function updateInbox() {
  gIMAPInbox.updateFolderWithListener(null, asyncUrlListener);
  yield false;
}

function checkCachedDBForFolder() {
  const gDbService = Cc["@mozilla.org/msgDatabase/msgDBService;1"]
                       .getService(Ci.nsIMsgDBService);
  do_check_eq(gDbService.cachedDBForFolder(gSub3), null);
}

function teardown() {
  teardownIMAPPump();
}

function run_test() {
  async_run_tests(tests);
}
