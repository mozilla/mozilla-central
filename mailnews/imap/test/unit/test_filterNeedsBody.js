/*
 * This file tests the needsBody attribute added to a
 *  custom filter action in bug 555051.
 *
 * Original author: Kent James <kent@caspia.com>
 * adapted from test_imapFilterActions.js
 */

// Globals
var gIMAPDaemon; // the imap fake server daemon
var gServer; // the imap fake server
var gIMAPIncomingServer; // nsIMsgIncomingServer for the imap server
var gIMAPInbox; // imap inbox message folder
var gIMAPMailbox; // imap mailbox
var gFilter; // a message filter with a subject search
var gAction; // current message action (reused)
var gCurTestNum; // the current test number
const gMessage = "draft1"; // message file used as the test message

// Definition of tests

const gTestArray =
[
  function NeedsBodyTrue() {
    gAction.type = Ci.nsMsgFilterAction.Custom;
    gAction.customId = 'mailnews@mozilla.org#testOffline';
    actionTestOffline.needsBody = true;
    gAction.strValue = 'true';
    setupTest(gFilter, gAction);
  },
  function NeedsBodyFalse() {
    gAction.type = Ci.nsMsgFilterAction.Custom;
    gAction.customId = 'mailnews@mozilla.org#testOffline';
    actionTestOffline.needsBody = false;
    gAction.strValue = 'false';
    setupTest(gFilter, gAction);
  },
];

function run_test()
{
  // Add a listener.
  gIMAPDaemon = new imapDaemon();
  gServer = makeServer(gIMAPDaemon, "");

  gIMAPIncomingServer = createLocalIMAPServer();

  if (!gLocalInboxFolder)
    loadLocalMailAccount();

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

  // The server doesn't support more than one connection
  let prefBranch = Cc["@mozilla.org/preferences-service;1"]
                     .getService(Ci.nsIPrefBranch);
  prefBranch.setIntPref("mail.server.default.max_cached_connections", 1);
  // We aren't interested in downloading messages automatically
  prefBranch.setBoolPref("mail.server.default.download_on_biff", false);
  prefBranch.setBoolPref("mail.biff.play_sound", false);
  prefBranch.setBoolPref("mail.biff.show_alert", false);
  prefBranch.setBoolPref("mail.biff.show_tray_icon", false);
  prefBranch.setBoolPref("mail.biff.animate_dock_icon", false);

  gIMAPIncomingServer.performExpand(null);

  gIMAPInbox = gIMAPIncomingServer.rootFolder.getChildNamed("INBOX");
  gIMAPMailbox = gIMAPDaemon.getMailbox("INBOX");
  dump("gIMAPInbox uri = " + gIMAPInbox.URI + "\n");
  gIMAPInbox instanceof Ci.nsIMsgImapMailFolder;

// Create a test filter.
  let filterList = gIMAPIncomingServer.getFilterList(null);
  gFilter = filterList.createFilter("test offline");
  let searchTerm = gFilter.createTerm();
  searchTerm.matchAll = true;

  gFilter.appendTerm(searchTerm);
  gFilter.enabled = true;

  // an action that can be modified by tests
  gAction = gFilter.createAction();

  // add the custom actions
  var filterService = Cc["@mozilla.org/messenger/services/filters;1"]
                        .getService(Ci.nsIMsgFilterService);
  filterService.addCustomAction(actionTestOffline);
  // "Master" do_test_pending(), paired with a do_test_finished() at the end of
  // all the operations.
  do_test_pending();

  //start first test
  gCurTestNum = 1;
  doTest();
}

/*
 * functions used to support test setup and execution
 */

// if the source matches the listener used to continue a test,
// run the test checks, and start the next test.
function testContinue(source)
{
  gCurTestNum++;
  do_timeout(200, doTest);
}

// basic preparation done for each test
function setupTest(aFilter, aAction)
{
  let filterList = gIMAPIncomingServer.getFilterList(null);
  while (filterList.filterCount)
    filterList.removeFilterAt(0);
  if (aFilter)
  {
    aFilter.clearActionList();
    if (aAction) {
      aFilter.appendAction(aAction);
      filterList.insertFilterAt(0, aFilter);
    }
  }
  gIMAPMailbox.addMessage(new imapMessage(specForFileName(gMessage),
                          gIMAPMailbox.uidnext++, []));
  gIMAPInbox.updateFolderWithListener(null, URLListener);
}

// run the next test
function doTest()
{
  var test = gCurTestNum;
  if (test <= gTestArray.length)
  {
    var testFn = gTestArray[test-1];
    dump("Doing test " + test + " " + testFn.name + "\n");
    // Set a limit of ten seconds; if the notifications haven't arrived by then there's a problem.
    do_timeout(10000, function()
        {
          if (gCurTestNum == test)
            do_throw("Notifications not received in 10000 ms for operation " + testFn.name +
              ", current status is " + gCurrStatus);
        }
      );
    try {
    testFn();
    } catch(ex) {
      gServer.stop();
      do_throw ('TEST FAILED ' + ex);
    }
  }
  else
    do_timeout(1000, endTest);
}

// Cleanup, null out everything, close all cached connections and stop the
// server
function endTest()
{
  dump(" Exiting mail tests\n");
  gIMAPInbox = null;
  gServer.resetTest();
  gIMAPIncomingServer.closeCachedConnections();
  gServer.performTest();
  gServer.stop();
  let thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);

  do_test_finished(); // for the one in run_test()
}

// nsIURLListener implementation - runs next test
var URLListener =
{
  OnStartRunningUrl: function OnStartRunningUrl(aURL) {},
  OnStopRunningUrl: function OnStopRunningUrl(aURL, aStatus)
  {
    dump("in OnStopRunningURL " + gCurTestNum + "\n");
    do_check_eq(aStatus, 0);
    testContinue(this);
  }
}

// custom action to test offline status
actionTestOffline =
{
  id: "mailnews@mozilla.org#testOffline",
  name: "test if offline",
  apply: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow)
  {
    for (var i = 0; i < aMsgHdrs.length; i++)
    {
      var msgHdr = aMsgHdrs.queryElementAt(i, Ci.nsIMsgDBHdr);
      let isOffline = msgHdr.flags & Ci.nsMsgMessageFlags.Offline ? true : false;
      do_check_eq(isOffline, aActionValue == 'true' ? true : false);
    }
  },
  isValidForType: function(type, scope) {return true;},

  validateActionValue: function(value, folder, type) { return null;},

  allowDuplicates: false,

  needsBody: false // set during test setup
};

/*
 * helper functions
 */

// given a test file, return the file uri spec
function specForFileName(aFileName)
{
  let file = do_get_file("../../mailnews/data/" + aFileName);
  let msgfileuri = Cc["@mozilla.org/network/io-service;1"]
                     .getService(Ci.nsIIOService)
                     .newFileURI(file)
                     .QueryInterface(Ci.nsIFileURL);
  return msgfileuri.spec;
}
