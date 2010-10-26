/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 *   Kent James <kent@caspia.com>
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/*
 * This file tests that a message saved as draft in an IMAP folder is correctly
 * marked as unread.
 */

// async support
load("../../../resources/logHelper.js");
load("../../../resources/mailTestUtils.js");
load("../../../resources/asyncTestUtils.js");

// IMAP pump
load("../../../resources/IMAPpump.js");

setupIMAPPump();

// Definition of tests

var tests = [
  createDraftsFolder,
  saveDraft,
  updateDrafts,
  checkResult,
  endTest
];

let gDraftsFolder;
function createDraftsFolder()
{
  gIMAPIncomingServer.rootFolder.createSubfolder("Drafts", null);
  dl('wait for folderAdded');
  yield false;
  gDraftsFolder = gIMAPIncomingServer.rootFolder.getChildNamed("Drafts");
  do_check_true(gDraftsFolder instanceof Ci.nsIMsgImapMailFolder);
  gDraftsFolder.updateFolderWithListener(null, urlListener);
  dl('wait for OnStopRunningURL');
  yield false;
}

function saveDraft()
{
  var msgCompose = Cc["@mozilla.org/messengercompose/compose;1"]
                     .createInstance(Ci.nsIMsgCompose);
  var fields = Cc["@mozilla.org/messengercompose/composefields;1"]
                 .createInstance(Ci.nsIMsgCompFields);
  var params = Cc["@mozilla.org/messengercompose/composeparams;1"]
                 .createInstance(Ci.nsIMsgComposeParams);
  params.composeFields = fields;
  msgCompose.initialize(params);

  var acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                  .getService(Ci.nsIMsgAccountManager);

  // Set up the identity
  var identity = acctMgr.createIdentity();
  identity.draftFolder = gDraftsFolder.URI;

  var progress = Cc["@mozilla.org/messenger/progress;1"]
                   .createInstance(Ci.nsIMsgProgress);
  progress.registerListener(progressListener);
  msgCompose.SendMsg(Ci.nsIMsgSend.nsMsgSaveAsDraft, identity, "", null,
                     progress);
  yield false;
}

function updateDrafts()
{
  gDraftsFolder.updateFolderWithListener(null, urlListener);
  yield false;
}

function checkResult()
{
  do_check_eq(gDraftsFolder.getTotalMessages(false), 1);
  do_check_eq(gDraftsFolder.getNumUnread(false), 1);
  yield true;
}

function endTest()
{
  teardownIMAPPump();
  yield true;
}

function run_test()
{
  let server = gIMAPIncomingServer;

  // Add folder listeners that will capture async events
  const nsIMFNService = Ci.nsIMsgFolderNotificationService;
  let MFNService = Cc["@mozilla.org/messenger/msgnotificationservice;1"]
                      .getService(nsIMFNService);

  let flags =
        nsIMFNService.msgsMoveCopyCompleted |
        nsIMFNService.folderAdded |
        nsIMFNService.msgAdded;
  MFNService.addListener(mfnListener, flags);

  //start first test
  async_run_tests(tests);
}

var urlListener = {
  OnStartRunningUrl: function _OnStartRunningUrl(aUrl) {
    // funny but this never seems to get called.
    dl('OnStartRunningUrl');
  },
  OnStopRunningUrl: function _OnStopRunningUrl(aUrl, aExitCode) {
    dl('OnStopRunningUrl');
    async_driver();
  }
};

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

  onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {},
  onLocationChange: function(aWebProgress, aRequest, aLocation) {},
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
