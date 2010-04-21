/* ***** BEGIN LICENSE BLOCK *****
 *   Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * The Original Code is Thunderbird Mail Client.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   David Bienvenu <bienvenu@nventure.com>
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

/**
 * This tests various commands on messages. This is primarily for commands
 * that can't be tested with xpcshell tests because they're handling in the
 * front end - which is why Archive is the only command currently tested.
 */
var MODULE_NAME = 'test-message-commands';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers'];

Components.utils.import("resource:///modules/MailUtils.js");

var archiveSrcFolder = null;
var archiveURI;

var setupModule = function(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);

  archiveSrcFolder = create_folder("ArchiveSrc");
  // Create messages from 20 different months, which will mean 2 different
  // years as well.
  make_new_sets_in_folder(archiveSrcFolder, [{count: 20, age_incr: {weeks: 5}}]);
};

function test_yearly_archive() {
  yearly_archive(false);
}

function yearly_archive(keep_structure) {
  be_in_folder(archiveSrcFolder);
  make_display_unthreaded();
  mc.folderDisplay.view.sort(Ci.nsMsgViewSortType.byDate, Ci.nsMsgViewSortOrder.ascending);

  let server = mc.folderDisplay.view.dbView.getMsgHdrAt(0).folder.server;
  server.archiveGranularity = Ci.nsIMsgIncomingServer.perYearArchiveFolders;
  // We need to get all the info about the messages before we do the archive,
  // because deleting the headers could make extracting values from them fail.
  let firstMsgHdr = mc.folderDisplay.view.dbView.getMsgHdrAt(0);
  let lastMsgHdr = mc.folderDisplay.view.dbView.getMsgHdrAt(12);
  let firstMsgHdrMsgId = firstMsgHdr.messageId;
  let lastMsgHdrMsgId = lastMsgHdr.messageId;
  let firstMsgDate = new Date(firstMsgHdr.date / 1000);
  let firstMsgYear = firstMsgDate.getFullYear().toString();
  let lastMsgDate = new Date(lastMsgHdr.date / 1000);
  let lastMsgYear = lastMsgDate.getFullYear().toString();

  select_click_row(0);
  select_control_click_row(12);

  // Press the archive key. The results should go into two separate years.
  archive_selected_messages();

  // Figure out where the messages should have gone.
  let archiveRoot = "mailbox://nobody@Local%20Folders/Archives";
  let firstArchiveUri = archiveRoot + "/" + firstMsgYear;
  let lastArchiveUri = archiveRoot + "/" + lastMsgYear;
  if (keep_structure) {
    firstArchiveUri += "/ArchiveSrc";
    lastArchiveUri += "/ArchiveSrc";
  }
  let firstArchiveFolder =  MailUtils.getFolderForURI(firstArchiveUri);
  let lastArchiveFolder = MailUtils.getFolderForURI(lastArchiveUri);
  be_in_folder(firstArchiveFolder);
  assert_true(mc.dbView.getMsgHdrAt(0).messageId == firstMsgHdrMsgId,
              "Message should have been archived to " + firstArchiveUri + ", but it isn't present there");
  be_in_folder(lastArchiveFolder);

  assert_true(mc.dbView.getMsgHdrAt(0).messageId == lastMsgHdrMsgId,
              "Message should have been archived to " + lastArchiveUri + ", but it isn't present there");
}

function test_monthly_archive() {
  monthly_archive(false);
}

function monthly_archive(keep_structure) {
  be_in_folder(archiveSrcFolder);
  let server = mc.folderDisplay.view.dbView.getMsgHdrAt(0).folder.server;
  server.archiveGranularity = Ci.nsIMsgIncomingServer.perMonthArchiveFolders;
  select_click_row(0);
  select_control_click_row(1);

  let firstMsgHdr = mc.folderDisplay.view.dbView.getMsgHdrAt(0);
  let lastMsgHdr = mc.folderDisplay.view.dbView.getMsgHdrAt(1);
  let firstMsgHdrMsgId = firstMsgHdr.messageId;
  let lastMsgHdrMsgId = lastMsgHdr.messageId;
  let firstMsgDate = new Date(firstMsgHdr.date / 1000);
  let firstMsgYear = firstMsgDate.getFullYear().toString();
  let firstMonthFolderName = firstMsgDate.toLocaleFormat("%Y-%m")
  let lastMsgDate = new Date(lastMsgHdr.date / 1000);
  let lastMsgYear = lastMsgDate.getFullYear().toString();
  let lastMonthFolderName = lastMsgDate.toLocaleFormat("%Y-%m")

  // Press the archive key. The results should go into two separate months.
  archive_selected_messages();

  // Figure out where the messages should have gone.
  let archiveRoot = "mailbox://nobody@Local%20Folders/Archives";
  let firstArchiveUri = archiveRoot + "/" + firstMsgYear +
                        "/" + firstMonthFolderName;
  let lastArchiveUri = archiveRoot + "/" + lastMsgYear +
                        "/" + lastMonthFolderName;
  if (keep_structure) {
    firstArchiveUri += "/ArchiveSrc";
    lastArchiveUri += "/ArchiveSrc";
  }
  let firstArchiveFolder =  MailUtils.getFolderForURI(firstArchiveUri);
  let lastArchiveFolder = MailUtils.getFolderForURI(lastArchiveUri);
  be_in_folder(firstArchiveFolder);
  assert_true(mc.dbView.getMsgHdrAt(0).messageId == firstMsgHdrMsgId,
              "Message should have been archived to Local Folders/" + 
              firstMsgYear + "/" + firstMonthFolderName + "/Archives, but it isn't present there");
  be_in_folder(lastArchiveFolder);
  assert_true(mc.dbView.getMsgHdrAt(0).messageId == lastMsgHdrMsgId,
              "Message should have been archived to Local Folders/" + 
              lastMsgYear + "/" + lastMonthFolderName + "/Archives, but it isn't present there");
}

function test_folder_structure_archiving() {
  Cc["@mozilla.org/preferences-service;1"]
   .getService(Ci.nsIPrefService).getBranch(null)
   .setBoolPref("mail.server.default.archive_keep_folder_structure", true);
  monthly_archive(true);
  yearly_archive(true);
}
