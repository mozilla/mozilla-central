/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This file tests that a message saved as draft in an IMAP folder in offline
 * mode is not lost when going back online
 * See Bug 805626
 */

// async support
load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");

Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource://gre/modules/Services.jsm");

// IMAP pump
load("../../../resources/IMAPpump.js");

setupIMAPPump();

// Definition of tests

var tests = [
  createDraftsFolder,
  goOffline,
  saveDraft,
  goOnline,
  checkResult,
  endTest
];

let gDraftsFolder;

function createDraftsFolder()
{
  IMAPPump.incomingServer.rootFolder.createSubfolder("Drafts", null);
  yield false;
  gDraftsFolder = IMAPPump.incomingServer.rootFolder.getChildNamed("Drafts");
  do_check_true(gDraftsFolder instanceof Ci.nsIMsgImapMailFolder);
  gDraftsFolder.updateFolderWithListener(null, asyncUrlListener);
  yield false;
}
function goOffline()
{
  // Don't prompt about offline download when going offline
  Services.prefs.setIntPref("offline.download.download_messages", 2);

  IMAPPump.incomingServer.closeCachedConnections();
  let thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);

  do_timeout(2000, async_driver);
  yield false;

  IMAPPump.server.stop();
  Services.io.offline = true;
}

function saveDraft()
{
  let msgCompose = Cc["@mozilla.org/messengercompose/compose;1"]
                     .createInstance(Ci.nsIMsgCompose);
  let fields = Cc["@mozilla.org/messengercompose/composefields;1"]
                 .createInstance(Ci.nsIMsgCompFields);
  let params = Cc["@mozilla.org/messengercompose/composeparams;1"]
                 .createInstance(Ci.nsIMsgComposeParams);
  params.composeFields = fields;
  msgCompose.initialize(params);

  // Set up the identity
  let identity = MailServices.accounts.createIdentity();
  identity.draftFolder = gDraftsFolder.URI;

  let progress = Cc["@mozilla.org/messenger/progress;1"]
                   .createInstance(Ci.nsIMsgProgress);
  progress.registerListener(progressListener);
  msgCompose.SendMsg(Ci.nsIMsgSend.nsMsgSaveAsDraft, identity, "", null,
                     progress);
  yield false;
  // verify that message is not on the server yet
  do_check_eq(IMAPPump.daemon.getMailbox("Drafts")._messages.length, 0);
}

function goOnline()
{
  let offlineManager = Cc["@mozilla.org/messenger/offline-manager;1"]
                       .getService(Ci.nsIMsgOfflineManager);
  IMAPPump.daemon.closing = false;
  Services.io.offline = false;

  IMAPPump.server.start(IMAP_PORT);
  offlineManager.inProgress = true;
  offlineManager.goOnline(false, true, null);
  let waitForNotInProgress = function () {
    if (offlineManager.inProgress)
      do_timeout(250, waitForNotInProgress);
    else
      async_driver();
  }
  waitForNotInProgress();
  yield false;
}

function checkResult()
{
  // verify that message is now on the server
  do_check_eq(IMAPPump.daemon.getMailbox("Drafts")._messages.length, 1);
  yield true;
}

function endTest()
{
  teardownIMAPPump();
  yield true;
}

function run_test()
{
  Services.prefs.setBoolPref("mail.server.default.autosync_offline_stores", false);
  let server = IMAPPump.incomingServer;

  // Add folder listeners that will capture async events
  const nsIMFNService = Ci.nsIMsgFolderNotificationService;

  let flags =
        nsIMFNService.msgsMoveCopyCompleted |
        nsIMFNService.folderAdded |
        nsIMFNService.msgAdded;
  MailServices.mfn.addListener(mfnListener, flags);

  //start first test
  async_run_tests(tests);
}

var mfnListener =
{
  msgsMoveCopyCompleted: function (aMove, aSrcMsgs, aDestFolder, aDestMsgs)
  {
    dl('msgsMoveCopyCompleted to folder ' + aDestFolder.name);
  },

  folderAdded: function (aFolder)
  {
    dl('folderAdded <' + aFolder.name + '>');
    // we are only using async add on the Junk folder
    if (aFolder.name == "Drafts")
      async_driver();
  },

  msgAdded: function msgAdded(aMsg)
  {
    dl('msgAdded with subject <' + aMsg.subject + '>');
  }
};

var progressListener = {
  onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
    if (aStateFlags & Ci.nsIWebProgressListener.STATE_STOP){
      dl('onStateChange');
      async_driver();
    }
  },

  onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress,
                             aMaxSelfProgress, aCurTotalProgress,
                             aMaxTotalProgress) {},
  onLocationChange: function(aWebProgress, aRequest, aLocation, aFlags) {},
  onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage) {},
  onSecurityChange: function(aWebProgress, aRequest, state) {},

  QueryInterface : function(iid) {
    if (iid.equals(Ci.nsIWebProgressListener) ||
        iid.equals(Ci.nsISupportsWeakReference) ||
        iid.equals(Ci.nsISupports))
      return this;

    throw Components.results.NS_NOINTERFACE;
  }
};

/*
 * helper functions
 */

// quick shorthand for output of a line of text.
function dl(text) {
  dump(text + '\n');
}
