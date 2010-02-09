// This file tests that checking folders for new mail with STATUS
// doesn't leave db's open.

var gServer, gImapServer;
var gIMAPInbox, gIMAPFolder1, gIMAPFolder2;

function run_test() {
  var daemon = new imapDaemon();
  daemon.createMailbox("folder 1", {subscribed : true});
  daemon.createMailbox("folder 2", {subscribed : true});
  gServer = makeServer(daemon, "");

  gImapServer = createLocalIMAPServer();
  gImapServer.maximumConnectionsNumber = 1;

  // Get the folder list...
  gImapServer.performExpand(null);
  gServer.performTest("SUBSCRIBE");

  // pref tuning: one connection only, turn off notifications
  let prefBranch = Cc["@mozilla.org/preferences-service;1"]
                     .getService(Ci.nsIPrefBranch);
  prefBranch.setBoolPref("mail.check_all_imap_folders_for_new", true);
  // Make sure no biff notifications happen
  prefBranch.setBoolPref("mail.biff.play_sound", false);
  prefBranch.setBoolPref("mail.biff.show_alert", false);
  prefBranch.setBoolPref("mail.biff.show_tray_icon", false);
  prefBranch.setBoolPref("mail.biff.animate_dock_icon", false);

  let rootFolder = gImapServer.rootFolder;
  gIMAPInbox = rootFolder.getFolderWithFlags(Ci.nsMsgFolderFlags.Inbox);
  gFolder1 = rootFolder.getChildNamed("folder 1");
  gFolder2 = rootFolder.getChildNamed("folder 2");
  do_test_pending();
  gIMAPInbox.getNewMessages(null, null);
  gServer.performTest("STATUS");
  // don't know if this will work, but we'll try. Wait for
  // second status response
  gServer.performTest("STATUS");
  do_timeout_function(1000, endTest);
}

function endTest()
{
  const gDbService = Cc["@mozilla.org/msgDatabase/msgDBService;1"]
                       .getService(Ci.nsIMsgDBService);
  do_check_neq(gDbService.cachedDBForFolder(gIMAPInbox), null);
  do_check_eq(gDbService.cachedDBForFolder(gFolder1), null);
  do_check_eq(gDbService.cachedDBForFolder(gFolder2), null);

  // Clean up the server in preparation
  gServer.resetTest();
  gImapServer.closeCachedConnections();
  gServer.performTest();
  gServer.stop();

  do_test_finished();
}
