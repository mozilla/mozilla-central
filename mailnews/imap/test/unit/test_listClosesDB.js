// This file tests that listing folders on startup because we're not using
// subscription doesn't leave db's open.

var gServer, gImapServer;
var gIMAPInbox;
var gSub3;

function run_test() {
  loadLocalMailAccount();

  var daemon = new imapDaemon();
  daemon.createMailbox("folder1", {subscribed : true});
  daemon.createMailbox("folder1/sub1", "", {subscribed : true});
  daemon.createMailbox("folder1/sub1/sub2", "", {subscribed : true});
  daemon.createMailbox("folder1/sub1/sub2/sub3", "", {subscribed : true});
  gServer = makeServer(daemon, "");

  gImapServer = createLocalIMAPServer();
  gImapServer.maximumConnectionsNumber = 1;
  gImapServer.usingSubscription = false;

  // We need an identity so that updateFolder doesn't fail
  let acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                .getService(Ci.nsIMsgAccountManager);
  let localAccount = acctMgr.createAccount();
  let identity = acctMgr.createIdentity();
  localAccount.addIdentity(identity);
  localAccount.defaultIdentity = identity;
  localAccount.incomingServer = gLocalIncomingServer;
  acctMgr.defaultAccount = localAccount;

  // Let's also have another account, using the same identity
  let imapAccount = acctMgr.createAccount();
  imapAccount.addIdentity(identity);
  imapAccount.defaultIdentity = identity;
  imapAccount.incomingServer = gImapServer;

  // pref tuning: one connection only, turn off notifications
  let prefBranch = Cc["@mozilla.org/preferences-service;1"]
                     .getService(Ci.nsIPrefBranch);
  // Make sure no biff notifications happen
  prefBranch.setBoolPref("mail.biff.play_sound", false);
  prefBranch.setBoolPref("mail.biff.show_alert", false);
  prefBranch.setBoolPref("mail.biff.show_tray_icon", false);
  prefBranch.setBoolPref("mail.biff.animate_dock_icon", false);

  let rootFolder = gImapServer.rootFolder.QueryInterface(Ci.nsIMsgImapMailFolder);
  gIMAPInbox = rootFolder.getFolderWithFlags(Ci.nsMsgFolderFlags.Inbox)
                         .QueryInterface(Ci.nsIMsgImapMailFolder);
  rootFolder.hierarchyDelimiter = '/';
  gIMAPInbox.hierarchyDelimiter = '/';
  rootFolder.addSubfolder("folder1");
  rootFolder.addSubfolder("folder1/sub1");
  rootFolder.addSubfolder("folder1/sub1/sub2");
  gSub3 = rootFolder.addSubfolder("folder1/sub1/sub2/sub3");
  gImapServer.performExpand(null);
  gServer.performTest("LIST");

  do_test_pending();
  do_timeout_function(1000, updateInbox);
}

function updateInbox()
{
  gIMAPInbox.updateFolderWithListener(null, UrlListener);
}

var UrlListener =
{
  OnStartRunningUrl: function(url) { },
  OnStopRunningUrl: function(url, rc)
  {
    // Check for ok status.
    do_check_eq(rc, 0);
    try {
      const gDbService = Cc["@mozilla.org/msgDatabase/msgDBService;1"]
                           .getService(Ci.nsIMsgDBService);
      do_check_eq(gDbService.cachedDBForFolder(gSub3), null);
      do_timeout_function(1000, endTest);
    } catch (ex) {dump (ex);}
  }
};

function endTest()
{
  gImapServer.closeCachedConnections();
  gServer.performTest();
  gServer.stop();
  do_test_finished();
}
