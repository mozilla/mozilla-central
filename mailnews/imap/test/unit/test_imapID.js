/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test to ensure that we handle the RFC2197 ID command.
 */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

var gIMAPDaemon, gServer, gIMAPIncomingServer;

const gIMAPService = Cc["@mozilla.org/messenger/messageservice;1?type=imap"]
                       .getService(Ci.nsIMsgMessageService);

const kIDResponse = "(\"name\" \"GImap\" \"vendor\" \"Google, Inc.\" \"support-url\" \"http://mail.google.com/support\")";
var gIMAPInbox;
var gTest;

const XULAPPINFO_CONTRACTID = "@mozilla.org/xre/app-info;1";
const XULAPPINFO_CID = Components.ID("{7e10a36e-1085-4302-9e3f-9571fc003ee0}");

var gAppInfo = null;

function createAppInfo(id, name, version, platformVersion) {
  gAppInfo = {
    // nsIXULAppInfo
    vendor: "Mozilla",
    name: name,
    ID: id,
    version: version,
    appBuildID: "2007010101",
    platformVersion: platformVersion,
    platformBuildID: "2007010101",

    QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIXULAppInfo,
                                           Components.interfaces.nsISupports])
  };

  var XULAppInfoFactory = {
    createInstance: function (outer, iid) {
      if (outer != null)
        throw Components.results.NS_ERROR_NO_AGGREGATION;
      return gAppInfo.QueryInterface(iid);
    }
  };
  var registrar = Components.manager.QueryInterface(Components.interfaces.nsIComponentRegistrar);
  registrar.registerFactory(XULAPPINFO_CID, "XULAppInfo",
                            XULAPPINFO_CONTRACTID, XULAppInfoFactory);

}

const gTestArray =
[
  function updateInbox() {
    let rootFolder = gIMAPIncomingServer.rootFolder;
    gIMAPInbox.updateFolderWithListener(null, UrlListener);
  },
  function checkIDHandling() {
    do_check_eq(gIMAPDaemon.clientID, "(\"name\" \"XPCShell\" \"version\" \"5\")");
    do_check_eq(gIMAPIncomingServer.serverIDPref, kIDResponse);
    doTest(++gTest);
  },
]

function run_test()
{
  createAppInfo("xpcshell@tests.mozilla.org", "XPCShell", "5", "2.0");
  gTest = 0;
  loadLocalMailAccount();

  /*
   * Set up an IMAP server.
   */
  gIMAPDaemon = new imapDaemon();
  gIMAPDaemon.idResponse = kIDResponse;

  gServer = makeServer(gIMAPDaemon, "GMail");
  gIMAPIncomingServer = createLocalIMAPServer();
  gIMAPIncomingServer.maximumConnectionsNumber = 1;

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
  imapAccount.incomingServer = gIMAPIncomingServer;
  
  // pref tuning: one connection only, turn off notifications
  let prefBranch = Cc["@mozilla.org/preferences-service;1"]
                     .getService(Ci.nsIPrefBranch);
  prefBranch.setBoolPref("mail.biff.play_sound", false);
  prefBranch.setBoolPref("mail.biff.show_alert", false);
  prefBranch.setBoolPref("mail.biff.show_tray_icon", false);
  prefBranch.setBoolPref("mail.biff.animate_dock_icon", false);

  do_test_pending();

  // Get the IMAP inbox...
  let rootFolder = gIMAPIncomingServer.rootFolder;
  gIMAPInbox = rootFolder.getFolderWithFlags(Ci.nsMsgFolderFlags.Inbox)
                         .QueryInterface(Ci.nsIMsgImapMailFolder);

  // update folder to kick start tests.
  gIMAPInbox.updateFolderWithListener(null, UrlListener);
}

var UrlListener = 
{
  OnStartRunningUrl: function(url) { },
  OnStopRunningUrl: function(url, rc)
  {
    // Check for ok status.
    do_check_eq(rc, 0);
    // chain tests with interval in between so we'll go idle.
    do_timeout_function(100, function(){doTest(++gTest)});
  }
};

function doTest(test)
{
  if (test <= gTestArray.length)
  {
    dump("Doing test " + test + "\n");
    gTest = test;

    var testFn = gTestArray[test - 1];
    // Set a limit of ten seconds; if the notifications haven't arrived by then there's a problem.
    try {
      testFn();
    } catch(ex) {
      gServer.stop();
      do_throw ('TEST FAILED ' + ex);
    }
  }
  else
  {
    do_timeout_function(1000, endTest);
  }
}

function endTest()
{
  gIMAPIncomingServer.closeCachedConnections();
  gServer.stop();

  var thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);

  do_test_finished();
}
