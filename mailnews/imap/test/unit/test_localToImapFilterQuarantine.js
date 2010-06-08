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
 * This file tests copies of multiple messages using filters
 * from incoming POP3, with filter actions copying and moving
 * messages to an IMAP folder, when the POP3 message uses
 * quarantining to help antivirus software. See bug 387361.
 *
 */

load("../../mailnews/resources/POP3pump.js");

// async support 
load("../../mailnews/resources/logHelper.js");
load("../../mailnews/resources/mailTestUtils.js");
load("../../mailnews/resources/asyncTestUtils.js");

// IMAP pump
load("../../mailnews/resources/IMAPpump.js");

setupIMAPPump();

// tests

const gTests = [
  createSubfolder,
  getLocalMessages,
  updateSubfolderAndTest,
  get2Messages,
  updateSubfolderAndTest2,
  endTest
]

function createSubfolder()
{
  gIMAPIncomingServer.rootFolder.createSubfolder("subfolder", null);
  dl('wait for folderAdded notification');
  yield false; 
  gSubfolder = gIMAPIncomingServer.rootFolder.getChildNamed("subfolder");
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

  gPOP3Pump.files = ["../../mailnews/data/bugmail1"];
  gPOP3Pump.onDone = function() {dump('POP3Pump done\n');async_driver();};
  gPOP3Pump.run();
  dl('waiting for POP3Pump done');
  yield false;
}

function updateSubfolderAndTest() {
  gSubfolder.updateFolderWithListener(null, urlListener);
  dl('wait for OnStopRunningURL');
  yield false;

  // kill some time
  do_timeout(200, async_driver);
  yield false;

  // test
  listMessages(gSubfolder);
  listMessages(gLocalInboxFolder);
  do_check_eq(folderCount(gSubfolder), 1);
  do_check_eq(folderCount(gLocalInboxFolder), 1);
}

function get2Messages()
{
  gPOP3Pump.files = ["../../mailnews/data/bugmail10",
                     "../../mailnews/data/draft1"]
  gPOP3Pump.onDone = function() {dump('POP3Pump done\n');async_driver();};
  gPOP3Pump.run();
  dl('waiting for POP3Pump done');
  yield false;
}

function updateSubfolderAndTest2() {
  gSubfolder.updateFolderWithListener(null, urlListener);
  dl('wait for OnStopRunningURL');
  yield false;

  // kill some time
  do_timeout(200, async_driver);
  yield false;

  //test
  listMessages(gSubfolder);
  listMessages(gLocalInboxFolder);
  do_check_eq(folderCount(gSubfolder), 3);
  do_check_eq(folderCount(gLocalInboxFolder), 3);
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

mfnListener =
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
    dl('msgAdded to folder <' + aMsg.folder.name + '> subject <' + aMsg.subject + '>')
  },

};

var urlListener = {
  OnStartRunningUrl: function _OnStartRunningUrl(aUrl) {
    dl('OnStartRunningUrl');
  },
  OnStopRunningUrl: function _OnStopRunningUrl(aUrl, aExitCode) {
    dl('OnStopRunningUrl');
    async_driver();
  }
};

// main test startup

function run_test()
{
  // quarantine messages
  let prefs = Cc["@mozilla.org/preferences-service;1"]
                .getService(Ci.nsIPrefBranch);
  prefs.setBoolPref("mailnews.downloadToTempFile", true);

  // Add folder listeners that will capture async events
  const nsIMFNService = Ci.nsIMsgFolderNotificationService;
  var MFNService = Cc["@mozilla.org/messenger/msgnotificationservice;1"]
                      .getService(nsIMFNService);
  let flags =
        nsIMFNService.folderAdded |
        nsIMFNService.msgAdded;
  MFNService.addListener(mfnListener, flags);

  //start first test
  async_run_tests(gTests);
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

