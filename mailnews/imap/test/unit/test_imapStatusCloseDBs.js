// This file tests that checking folders for new mail with STATUS
// doesn't leave db's open.

load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");

var gFolder1, gFolder2;

var tests = [
  setup,
  check,
  teardown
];

function setup() {
  Services.prefs.setBoolPref("mail.check_all_imap_folders_for_new", true);

  setupIMAPPump();

  IMAPPump.daemon.createMailbox("folder 1", {subscribed : true});
  IMAPPump.daemon.createMailbox("folder 2", {subscribed : true});

  IMAPPump.server.performTest("SUBSCRIBE");

  let rootFolder = IMAPPump.incomingServer.rootFolder;
  gFolder1 = rootFolder.getChildNamed("folder 1");
  gFolder2 = rootFolder.getChildNamed("folder 2");

  IMAPPump.inbox.getNewMessages(null, null);
  IMAPPump.server.performTest("STATUS");
  // don't know if this will work, but we'll try. Wait for
  // second status response
  IMAPPump.server.performTest("STATUS");
  mailTestUtils.do_timeout_function(1000, async_driver);
  yield false;
}

function check() {
  const gDbService = Cc["@mozilla.org/msgDatabase/msgDBService;1"]
                       .getService(Ci.nsIMsgDBService);
  do_check_neq(gDbService.cachedDBForFolder(IMAPPump.inbox), null);
  do_check_eq(gDbService.cachedDBForFolder(gFolder1), null);
  do_check_eq(gDbService.cachedDBForFolder(gFolder2), null);
}

function teardown() {
  teardownIMAPPump();
}

function run_test() {
  async_run_tests(tests);
}
