/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * This file tests copies of multiple messages using filters
 * from incoming POP3, with filter actions copying and moving
 * messages to an IMAP folder, when the POP3 message uses
 * quarantining to help antivirus software. See bug 387361.
 *
 */

Components.utils.import("resource:///modules/mailServices.js");

Services.prefs.setCharPref("mail.serverDefaultStoreContractID",
                           "@mozilla.org/msgstore/berkeleystore;1");

load("../../../resources/POP3pump.js");

// async support
load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");

// IMAP pump

setupIMAPPump();

var gFinishedRunningURL = -1;
var gSubfolder;

// tests

const quarantineTests = [
  createSubfolder,
  getLocalMessages,
  updateSubfolderAndTest,
  get2Messages,
  updateSubfolderAndTest2,
  endTest
];

function createSubfolder()
{
  IMAPPump.incomingServer.rootFolder.createSubfolder("subfolder", null);
  dl('wait for folderAdded notification');
  yield false;
  gSubfolder = IMAPPump.incomingServer.rootFolder.getChildNamed("subfolder");
  do_check_true(gSubfolder instanceof Ci.nsIMsgImapMailFolder);
  gSubfolder.updateFolderWithListener(null, urlListener);
  dl('wait for OnStopRunningURL');
  yield false;
}

function getLocalMessages() {
  // setup copy then move mail filters on the inbox
  let filterList = gPOP3Pump.fakeServer.getFilterList(null);
  let filter = filterList.createFilter("copyThenMoveAll");
  let searchTerm = filter.createTerm();
  searchTerm.matchAll = true;
  filter.appendTerm(searchTerm);
  let copyAction = filter.createAction();
  copyAction.type = Ci.nsMsgFilterAction.CopyToFolder;
  copyAction.targetFolderUri = gSubfolder.URI;
  filter.appendAction(copyAction);
  filter.enabled = true;
  filterList.insertFilterAt(0, filter);

  gPOP3Pump.files = ["../../../data/bugmail1"];
  gPOP3Pump.onDone = function() {dump('POP3Pump done\n');async_driver();};
  gPOP3Pump.run();
  dl('waiting for POP3Pump done');
  yield false;
}

function checkResult() {
  if (gFinishedRunningURL == 1) {
    async_driver();
    gFinishedRunningURL = -1;
    return;
  }
  else if (gFinishedRunningURL == 0) {
    gSubfolder.updateFolderWithListener(null, urlListener);
    do_timeout(100, checkResult);
    return;
  }
  // Else just ignore it.
}

function updateSubfolderAndTest() {
  // The previous function does an append, which may take a bit of time to
  // complete. Unfortunately updateFolderWithListener succeeds successfully
  // if there is a url running, but doesn't tell us that is the case. So we
  // have to run updateFolderWithListener several times to actually find out
  // when we are done.
  gFinishedRunningURL = 0;
  gSubfolder.updateFolderWithListener(null, urlListener);
  dl('wait for OnStopRunningURL');
  do_timeout(100, checkResult);
  yield false;

  // kill some time
  do_timeout(200, async_driver);
  yield false;

  // test
  listMessages(gSubfolder);
  listMessages(localAccountUtils.inboxFolder);
  do_check_eq(folderCount(gSubfolder), 1);
  do_check_eq(folderCount(localAccountUtils.inboxFolder), 1);
}

function get2Messages()
{
  gPOP3Pump.files = ["../../../data/bugmail10",
                     "../../../data/draft1"];
  gPOP3Pump.onDone = function() {dump('POP3Pump done\n');async_driver();};
  gPOP3Pump.run();
  dl('waiting for POP3Pump done');
  yield false;
}

function updateSubfolderAndTest2() {
  // The previous function does an append, which may take a bit of time to
  // complete. Unfortunately updateFolderWithListener succeeds successfully
  // if there is a url running, but doesn't tell us that is the case. So we
  // have to run updateFolderWithListener several times to actually find out
  // when we are done.
  gFinishedRunningURL = 0;
  gSubfolder.updateFolderWithListener(null, urlListener);
  dl('wait for OnStopRunningURL');
  do_timeout(1000, checkResult);
  yield false;

  // kill some time
  do_timeout(1000, async_driver);
  yield false;

  //test
  listMessages(gSubfolder);
  listMessages(localAccountUtils.inboxFolder);
  do_check_eq(folderCount(gSubfolder), 3);
  do_check_eq(folderCount(localAccountUtils.inboxFolder), 3);
}

function endTest()
{
  // Cleanup, null out everything, close all cached connections and stop the
  // server
  dl("Exiting mail tests");
  gPOP3Pump = null;
  teardownIMAPPump();
}

// listeners

let mfnListener =
{
  folderAdded: function folderAdded(aFolder)
  {
    dl('folderAdded <' + aFolder.name + '>');
    // we are only using async yield on the Subfolder add
    if (aFolder.name == "subfolder")
      async_driver();
  },

  msgAdded: function msgAdded(aMsg)
  {
    dl('msgAdded to folder <' + aMsg.folder.name + '> subject <' + aMsg.subject + '>');
  },

};

var urlListener = {
  OnStartRunningUrl: function _OnStartRunningUrl(aUrl) {
    dl('OnStartRunningUrl');
  },
  OnStopRunningUrl: function _OnStopRunningUrl(aUrl, aExitCode) {
    dl('OnStopRunningUrl');
    gFinishedRunningURL = 1;
    checkResult();
  }
};

// main test startup

function run_test()
{
  // quarantine messages
  Services.prefs.setBoolPref("mailnews.downloadToTempFile", true);

  // Add folder listeners that will capture async events
  const nsIMFNService = Ci.nsIMsgFolderNotificationService;
  let flags =
        nsIMFNService.folderAdded |
        nsIMFNService.msgAdded;
  MailServices.mfn.addListener(mfnListener, flags);

  //start first test
  async_run_tests(quarantineTests);
}

// helper functions

// count of messages in a folder, using the database
function folderCount(folder)
{
  let enumerator = folder.msgDatabase.EnumerateMessages();
  let count = 0;
  while (enumerator.hasMoreElements())
  {
    count++;
    let hdr = enumerator.getNext();
  }
  return count;
}

// display of message subjects in a folder
function listMessages(folder) {
  let enumerator = folder.msgDatabase.EnumerateMessages();
  var msgCount = 0;
  dl("listing messages for " + folder.prettyName);
  while(enumerator.hasMoreElements())
  {
    msgCount++;
    let hdr = enumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr);
    dl(msgCount + ": " + hdr.subject);
  }
}

// shorthand output of a line of text
function dl(text) {
  dump(text + '\n');
}

