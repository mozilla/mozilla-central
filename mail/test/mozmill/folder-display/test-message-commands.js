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
 * the Mozilla Foundation.
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
var MODULE_REQUIRES = ['folder-display-helpers', 'content-tab-helpers'];

Components.utils.import("resource:///modules/MailUtils.js");

var unreadFolder;
var archiveSrcFolder = null;
var archiveURI;

var acctMgr;
var tagArray;

var setupModule = function(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let cth = collector.getModule('content-tab-helpers');
  cth.installInto(module);


  unreadFolder = create_folder("UnreadFolder");
  archiveSrcFolder = create_folder("ArchiveSrc");

  make_new_sets_in_folder(unreadFolder, [{count: 2}]);

  // Create messages from 20 different months, which will mean 2 different
  // years as well.
  make_new_sets_in_folder(archiveSrcFolder, [{count: 20, age_incr: {weeks: 5}}]);

  let tagService = Components.classes["@mozilla.org/messenger/tagservice;1"]
                             .getService(Components.interfaces.nsIMsgTagService);
  tagArray = tagService.getAllTags({});
};

/**
 * Ensures that all messages have a particular read status
 * @param messages an array of nsIMsgDBHdrs to check
 * @param read true if the messages should be marked read, false otherwise
 */
function check_read_status(messages, read) {
  function read_str(read) {
    return read ? "read" : "unread";
  }

  for (let i = 0; i < messages.length; i++)
    assert_true(messages[i].isRead == read,
                "Message marked as " + read_str(messages[i].isRead) +
                ", expected " + read_str(read));
}

/**
 * Ensures that the mark read/unread menu items are enabled/disabled properly
 * @param index the row in the thread pane of the message to query
 * @param canMarkRead true if the mark read item should be enabled
 * @param canMarkUnread true if the mark unread item should be enabled
 */
function check_read_menuitems(index, canMarkRead, canMarkUnread) {
  right_click_on_row(index);
  wait_for_popup_to_open(mc.e("mailContext"));
  mc.click_menus_in_sequence(mc.e("mailContext"), [{id: "mailContext-mark"}]);

  let readEnabled = !mc.e("mailContext-markRead").disabled;
  let unreadEnabled = !mc.e("mailContext-markUnread").disabled;

  assert_true(readEnabled == canMarkRead,
              "Mark read menu item " + (canMarkRead ? "dis" : "en") +
              "abled when it shouldn't be!");

  assert_true(unreadEnabled == canMarkUnread,
              "Mark unread menu item " + (canMarkUnread ? "dis" : "en") +
              "abled when it shouldn't be!");
}

function enable_archiving(enabled) {
  Cc["@mozilla.org/preferences-service;1"]
   .getService(Ci.nsIPrefService).getBranch(null)
   .setBoolPref("mail.identity.default.archive_enabled", enabled);
}

/**
 * Mark a message read or unread via the context menu
 * @param index the row in the thread pane of the message to mark read/unread
 * @param read true the message should be marked read, false otherwise
 */
function mark_read_via_menu(index, read) {
  let menuItem = read ? "mailContext-markRead" : "mailContext-markUnread";
  right_click_on_row(index);
  wait_for_popup_to_open(mc.e("mailContext"));
  mc.click_menus_in_sequence(mc.e("mailContext"), [{id: "mailContext-mark"},
                                                   {id: menuItem}]);
  close_popup(mc, mc.eid("mailContext"));
}

function test_mark_one_read() {
  be_in_folder(unreadFolder);
  let curMessage = select_click_row(0);

  curMessage.markRead(false);
  mark_read_via_menu(0, true);
  check_read_status([curMessage], true);
}

function test_mark_one_unread() {
  be_in_folder(unreadFolder);
  let curMessage = select_click_row(0);

  curMessage.markRead(true);
  mark_read_via_menu(0, false);
  check_read_status([curMessage], false);
}

function test_mark_n_read() {
  be_in_folder(unreadFolder);
  select_click_row(0);
  let curMessages = select_shift_click_row(1);

  for (let i = 0; i < curMessages.length; i++)
    curMessages[i].markRead(false);
  mark_read_via_menu(0, true);
  check_read_status(curMessages, true);
}

function test_mark_n_unread() {
  be_in_folder(unreadFolder);
  select_click_row(0);
  let curMessages = select_shift_click_row(1);

  for (let i = 0; i < curMessages.length; i++)
    curMessages[i].markRead(true);
  mark_read_via_menu(0, false);
  check_read_status(curMessages, false);
}

function test_mark_n_read_mixed() {
  be_in_folder(unreadFolder);
  select_click_row(0);
  let curMessages = select_shift_click_row(1);

  curMessages[0].markRead(true);
  curMessages[1].markRead(false);
  mark_read_via_menu(0, true);
  check_read_status(curMessages, true);

  curMessages[0].markRead(false);
  curMessages[1].markRead(true);
  mark_read_via_menu(0, true);
  check_read_status(curMessages, true);

}

function test_mark_n_unread_mixed() {
  be_in_folder(unreadFolder);
  select_click_row(0);
  let curMessages = select_shift_click_row(1);

  curMessages[0].markRead(false);
  curMessages[1].markRead(true);
  mark_read_via_menu(0, false);
  check_read_status(curMessages, false);

  curMessages[0].markRead(true);
  curMessages[1].markRead(false);
  mark_read_via_menu(0, false);
  check_read_status(curMessages, false);
}

function test_toggle_read() {
  be_in_folder(unreadFolder);
  let curMessage = select_click_row(0);

  curMessage.markRead(false);
  mc.keypress(null, "m", {});
  check_read_status([curMessage], true);
}

function test_toggle_unread() {
  be_in_folder(unreadFolder);
  let curMessage = select_click_row(0);

  curMessage.markRead(true);
  mc.keypress(null, "m", {});
  check_read_status([curMessage], false);
}

function test_toggle_mixed() {
  be_in_folder(unreadFolder);
  select_click_row(0);
  let curMessages = select_shift_click_row(1);

  curMessages[0].markRead(false);
  curMessages[1].markRead(true);
  mc.keypress(null, "m", {});
  check_read_status(curMessages, true);

  curMessages[0].markRead(true);
  curMessages[1].markRead(false);
  mc.keypress(null, "m", {});
  check_read_status(curMessages, false);
}

function test_mark_menu_read() {
  be_in_folder(unreadFolder);
  let curMessage = select_click_row(0);

  curMessage.markRead(false);
  check_read_menuitems(0, true, false);
}

function test_mark_menu_unread() {
  be_in_folder(unreadFolder);
  let curMessage = select_click_row(0);

  curMessage.markRead(true);
  check_read_menuitems(0, false, true);
}

function test_mark_menu_mixed() {
  be_in_folder(unreadFolder);
  select_click_row(0);
  let curMessages = select_shift_click_row(1);

  curMessages[0].markRead(false);
  curMessages[1].markRead(true);

  check_read_menuitems(0, true, true);
}

function test_mark_all_read() {
  be_in_folder(unreadFolder);
  let curMessage = select_click_row(0);
  curMessage.markRead(false);

  // Make sure we can mark all read with >0 messages unread.
  right_click_on_row(0);
  wait_for_popup_to_open(mc.e("mailContext"));
  mc.click_menus_in_sequence(mc.e("mailContext"), [{id: "mailContext-mark"},
                                                   {id: "mailContext-markAllRead"}]);
  close_popup(mc, mc.eid("mailContext"));

  assert_true(curMessage.isRead, "Message should have been marked read!");

  // Make sure we can't mark all read, now that all messages are already read.
  right_click_on_row(0);
  wait_for_popup_to_open(mc.e("mailContext"));
  mc.click_menus_in_sequence(mc.e("mailContext"), [{id: "mailContext-mark"}]);

  let allReadDisabled = mc.e("mailContext-markAllRead").disabled;
  assert_true(allReadDisabled, "Mark All Read menu item should be disabled!");
}

function test_yearly_archive() {
  yearly_archive(false);
}

function yearly_archive(keep_structure) {
  be_in_folder(archiveSrcFolder);
  make_display_unthreaded();
  mc.folderDisplay.view.sort(Ci.nsMsgViewSortType.byDate, Ci.nsMsgViewSortOrder.ascending);

  acctMgr = Components.classes["@mozilla.org/messenger/account-manager;1"]
              .getService(Ci.nsIMsgAccountManager);

  let identity = acctMgr.getFirstIdentityForServer(mc.folderDisplay.view.dbView
                                                   .getMsgHdrAt(0).folder.server);
  identity.archiveGranularity = Ci.nsIMsgIdentity.perYearArchiveFolders;
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
  enable_archiving(true);
  monthly_archive(false);
}

function monthly_archive(keep_structure) {
  be_in_folder(archiveSrcFolder);
  let identity = acctMgr.getFirstIdentityForServer(mc.folderDisplay.view.dbView
                                                   .getMsgHdrAt(0).folder.server);
  identity.archiveGranularity = Ci.nsIMsgIdentity.perMonthArchiveFolders;
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
  enable_archiving(true);
  Cc["@mozilla.org/preferences-service;1"]
   .getService(Ci.nsIPrefService).getBranch(null)
   .setBoolPref("mail.identity.default.archive_keep_folder_structure", true);
  monthly_archive(true);
  yearly_archive(true);
}

function test_selection_after_archive() {
  enable_archiving(true);
  be_in_folder(archiveSrcFolder);
  let identity = acctMgr.getFirstIdentityForServer(mc.folderDisplay.view.dbView
                                                   .getMsgHdrAt(0).folder.server);
  identity.archiveGranularity = Ci.nsIMsgIdentity.perMonthArchiveFolders;
  // We had a bug where we would always select the 0th message after an
  // archive, so test that we'll actually select the next remaining message
  // by archiving rows 1 & 2 and verifying that the 3rd message gets selected.
  let hdrToSelect = select_click_row(3);
  select_click_row(1);
  select_control_click_row(2);
  archive_selected_messages();
  assert_selected_and_displayed(hdrToSelect);
}

function test_disabled_archive() {
  enable_archiving(false);
  be_in_folder(archiveSrcFolder);

  // test single message
  let current = select_click_row(0);
  mc.keypress(null, "a", {});
  assert_selected_and_displayed(current);

  assert_true(mc.e("hdrArchiveButton").disabled,
              "Archive button should be disabled when archiving is disabled!");

  // test message summaries
  select_click_row(0);
  current = select_shift_click_row(2);
  mc.keypress(null, "a", {});
  assert_selected_and_displayed(current);

  let htmlframe = mc.e("multimessage");
  let archiveBtn = htmlframe.contentDocument.getElementById("hdrArchiveButton");
  assert_true(archiveBtn.collapsed,
              "Multi-message archive button should be disabled when " +
              "archiving is disabled!");
}

function check_tag_in_message(message, tag, isSet) {
  let tagSet = message.getStringProperty("keywords").split(" ")
                      .indexOf(tag.key) != -1;
  if (isSet)
    assert_true(tagSet, "Tag '" + tag.name + "' expected on message!");
  else
    assert_false(tagSet, "Tag '" + tag.name + "' not expected on message!");
}

function test_tag_keys() {
  be_in_folder(unreadFolder);
  let curMessage = select_click_row(0);

  mc.keypress(null, "1", {});
  check_tag_in_message(curMessage, tagArray[0], true);

  mc.keypress(null, "2", {});
  check_tag_in_message(curMessage, tagArray[0], true);
  check_tag_in_message(curMessage, tagArray[1], true);

  mc.keypress(null, "0", {});
  check_tag_in_message(curMessage, tagArray[0], false);
  check_tag_in_message(curMessage, tagArray[1], false);
}

function test_tag_keys_disabled_in_content_tab() {
  be_in_folder(unreadFolder);
  let curMessage = select_click_row(0);

  mc.window.openAddonsMgr('addons://list/theme');
  mc.sleep(0);

  let tab = mc.tabmail.currentTabInfo;
  wait_for_content_tab_load(tab, 'about:addons');

  // Make sure pressing the "1" key in a content tab doesn't tag a message
  check_tag_in_message(curMessage, tagArray[0], false);
  mc.keypress(null, "1", {});
  check_tag_in_message(curMessage, tagArray[0], false);
}

function teardownModule() {
  // Make sure archiving is enabled at the end
  enable_archiving(true);
}
