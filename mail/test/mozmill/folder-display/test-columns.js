/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var elib = {};
Cu.import('resource://mozmill/modules/elementslib.js', elib);

// needed to zero inter-folder processing delay
Cu.import("resource:///modules/MailUtils.js");


/*
 * Test column default logic and persistence logic.  Persistence comes in both
 *  tab-switching (because of the multiplexed implementation) and
 *  folder-switching forms.
 */

var MODULE_NAME = 'test-columns';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers'];

var folderInbox, folderSent, folderVirtual, folderA, folderB;
// INBOX_DEFAULTS sans 'dateCol' but gains 'tagsCol'
var columnsB;

// these are for the reset/apply to other/apply to other+child tests.
var folderSource, folderParent, folderChild1, folderChild2;

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);
}

/**
 * Verify that the provided list of columns is visible in the given order,
 *  throwing an exception if it is not the case.
 *
 * @param aDesiredColumns A list of column ID strings for columns that should be
 *     visible in the order that they should be visisble.
 */
function assert_visible_columns(aDesiredColumns) {
  let cols = mc.e("threadTree").columns;
  let iDesired = 0;

  let visibleColumnIds = [];
  let failCol = null;
  for (let col = cols.getFirstColumn(); col != null; col = col.getNext()) {
    if (col.element.getAttribute("hidden") != "true") {
      visibleColumnIds.push(col.id);
      if (!failCol) {
        if (aDesiredColumns[iDesired] != col.id)
          failCol = col;
        else
          iDesired++;
      }
    }
  }
  if (failCol)
    throw new Error("Found visible column '" + failCol.id + "' but was " +
                    "expecting '" + aDesiredColumns[iDesired] + "'!" +
                    "\ndesired list: " + aDesiredColumns +
                    "\n actual list: " + visibleColumnIds);
}

/**
 * Show the column with the given id.
 *
 * @param aColumnId Id of the treecol element you want to show.
 */
function show_column(aColumnId) {
  mc.e(aColumnId).removeAttribute("hidden");
}

/**
 * Hide the column with the given id.
 *
 * @param aColumnId Id of the treecol element you want to hide.
 */
function hide_column(aColumnId) {
  mc.e(aColumnId).setAttribute("hidden", "true");
}

/**
 * Move a column before another column.
 *
 * @param aColumnId The id of the column you want to move.
 * @param aBeforeId The id of the column you want the moving column to end up
 *     before.
 */
function reorder_column(aColumnId, aBeforeId) {
  let col = mc.e(aColumnId);
  let before = mc.e(aBeforeId);
  mc.threadTree._reorderColumn(col, before, true);
}

var INBOX_DEFAULTS = [
  "threadCol",
  "flaggedCol",
  "attachmentCol",
  "subjectCol",
  "unreadButtonColHeader",
  "senderCol",
  "junkStatusCol",
  "dateCol"
];

/**
 * Make sure we set the proper defaults for an Inbox.
 */
function test_column_defaults_inbox() {
  // just use the inbox; comes from test-folder-display-helpers
  folderInbox = inboxFolder;
  enter_folder(folderInbox);
  assert_visible_columns(INBOX_DEFAULTS);
}

var SENT_DEFAULTS = [
  "threadCol",
  "flaggedCol",
  "attachmentCol",
  "subjectCol",
  "unreadButtonColHeader",
  "recipientCol",
  "junkStatusCol",
  "dateCol"
];

/**
 * Make sure we set the proper defaults for a Sent folder.
 */
function test_column_defaults_sent() {
  folderSent = create_folder("ColumnsSent");
  folderSent.setFlag(Ci.nsMsgFolderFlags.SentMail);

  be_in_folder(folderSent);
  assert_visible_columns(SENT_DEFAULTS);
}

var VIRTUAL_DEFAULTS = [
  "threadCol",
  "flaggedCol",
  "attachmentCol",
  "subjectCol",
  "unreadButtonColHeader",
  "senderCol",
  "junkStatusCol",
  "dateCol",
  "locationCol"
];

/**
 * Make sure we set the proper defaults for a multi-folder virtual folder.
 */
function test_column_defaults_cross_folder_virtual_folder() {
  folderVirtual = create_virtual_folder([folderInbox, folderSent], {},
                                        true, "ColumnsVirtual");

  be_in_folder(folderVirtual);
  assert_visible_columns(VIRTUAL_DEFAULTS);
}

/**
 * Make sure that we initialize our columns from the inbox and that they persist
 *  after that and don't follow the inbox.  This also does a good workout of the
 *  persistence logic.
 */
function test_column_defaults_inherit_from_inbox() {
  folderA = create_folder("ColumnsA");
  // - the folder should inherit from the inbox...
  be_in_folder(folderA);
  assert_visible_columns(INBOX_DEFAULTS);

  // - if we go back to the inbox and change things then the folder's settings
  //  should not change.
  be_in_folder(folderInbox);
  // show tags, hide date
  hide_column("dateCol");
  show_column("tagsCol");
  // (paranoia verify)
  columnsB = INBOX_DEFAULTS.slice(0, -1);
  columnsB.push("tagsCol");
  assert_visible_columns(columnsB);

  // make sure A did not change; it should still have dateCol.
  be_in_folder(folderA);
  assert_visible_columns(INBOX_DEFAULTS);

  // - but folder B should pick up on the modified set
  folderB = create_folder("ColumnsB");
  be_in_folder(folderB);
  assert_visible_columns(columnsB);

  // - and if we restore the inbox, folder B should stay modified too.
  be_in_folder(folderInbox);
  show_column("dateCol");
  hide_column("tagsCol");
  assert_visible_columns(INBOX_DEFAULTS);

  be_in_folder(folderB);
  assert_visible_columns(columnsB);
}

/**
 * Make sure that when we change tabs that things persist/restore correctly.
 */
function test_column_visibility_persists_through_tab_changes() {
  let tabA = be_in_folder(folderA);
  assert_visible_columns(INBOX_DEFAULTS);

  let tabB = open_folder_in_new_tab(folderB);
  assert_visible_columns(columnsB);

  // - switch back and forth among the loaded and verify
  switch_tab(tabA);
  assert_visible_columns(INBOX_DEFAULTS);

  switch_tab(tabB);
  assert_visible_columns(columnsB);

  // - change things and make sure the changes stick
  // B gain accountCol
  let bWithExtra = columnsB.concat(["accountCol"]);
  show_column("accountCol");
  assert_visible_columns(bWithExtra);

  switch_tab(tabA);
  assert_visible_columns(INBOX_DEFAULTS);

  // A loses junk
  let aSansJunk = INBOX_DEFAULTS.slice(0, -2); // nukes junk, date
  hide_column("junkStatusCol");
  aSansJunk.push("dateCol"); // put date back
  assert_visible_columns(aSansJunk);

  switch_tab(tabB);
  assert_visible_columns(bWithExtra);
  // B goes back to normal
  hide_column("accountCol");

  switch_tab(tabA);
  assert_visible_columns(aSansJunk);
  // A goes back to "normal"
  show_column("junkStatusCol");
  assert_visible_columns(INBOX_DEFAULTS);

  close_tab(tabB);
}

/**
 * Make sure that when we change folders that things persist/restore correctly.
 */
function test_column_visibility_persists_through_folder_changes() {
  be_in_folder(folderA);
  assert_visible_columns(INBOX_DEFAULTS);

  // more for A
  let aWithExtra = INBOX_DEFAULTS.concat(["sizeCol", "tagsCol"]);
  show_column("sizeCol");
  show_column("tagsCol");
  assert_visible_columns(aWithExtra);

  be_in_folder(folderB);
  assert_visible_columns(columnsB);

  // B gain accountCol
  let bWithExtra = columnsB.concat(["accountCol"]);
  show_column("accountCol");
  assert_visible_columns(bWithExtra);

  // check A
  be_in_folder(folderA);
  assert_visible_columns(aWithExtra);

  // check B
  be_in_folder(folderB);
  assert_visible_columns(bWithExtra);

  // restore B
  hide_column("accountCol");

  // restore A
  be_in_folder(folderA);
  hide_column("sizeCol");
  hide_column("tagsCol");

  // check B
  be_in_folder(folderB);
  assert_visible_columns(columnsB);

  // check A
  be_in_folder(folderA);
  assert_visible_columns(INBOX_DEFAULTS);
}

/**
 * Test that reordering persists through tab changes and folder changes.
 */
function test_column_reordering_persists() {
  let tabA = be_in_folder(folderA);
  let tabB = open_folder_in_new_tab(folderB);

  // put sender before subject
  reorder_column("senderCol", "subjectCol");
  let reorderdB = columnsB.concat();
  reorderdB.splice(5, 1);
  reorderdB.splice(3, 0, "senderCol");
  assert_visible_columns(reorderdB);

  switch_tab(tabA);
  assert_visible_columns(INBOX_DEFAULTS);

  switch_tab(tabB);
  assert_visible_columns(reorderdB);

  be_in_folder(folderInbox);
  assert_visible_columns(INBOX_DEFAULTS);

  be_in_folder(folderB);
  assert_visible_columns(reorderdB);

  close_tab(tabB);
}

function invoke_column_picker_option(aActions) {
  // The treecolpicker element itself doesn't have an id, so we have to walk
  // down from the parent to find it.
  //  treadCols
  //   |- hbox                item 0
  //   |- treecolpicker   <-- item 1 this is the one we want
  let threadCols = mc.window.document.getElementById("threadCols");
  let colPicker = mc.window.document.getAnonymousNodes(threadCols).item(1);
  let colPickerPopup = mc.window.document.getAnonymousElementByAttribute(
                         colPicker, "anonid", "popup");

  mc.click(new elib.Elem(colPicker));
  wait_for_popup_to_open(colPickerPopup);
  mc.click_menus_in_sequence(colPickerPopup, aActions);
  close_popup(mc, new elib.Elem(colPickerPopup));
}


/**
 * The column picker's "reset columns to default" option should set our state
 *  back to inbox state.
 */
function test_reset_to_inbox() {
  // create the source
  folderSource = create_folder("ColumnsApplySource");
  // it better have INBOX defaults
  assert_visible_columns(INBOX_DEFAULTS);

  // permute them
  let conExtra = INBOX_DEFAULTS.concat(["sizeCol"]);
  show_column("sizeCol");
  assert_visible_columns(conExtra);

  // reset!
  invoke_column_picker_option([{anonid: "reset"}]);
}

function subtest_say_yes(cwc) {
  cwc.window.document.documentElement.getButton('accept').doCommand();
}

function _apply_to_folder_common(aChildrenToo) {
  if (aChildrenToo)
    plan_for_observable_event("msg-folder-columns-propagated");
  plan_for_modal_dialog("commonDialog", subtest_say_yes);
  invoke_column_picker_option([{anonid: "applyTo-menu"},
                               {anonid: aChildrenToo ?
                                  "applyToFolderAndChildren-menu" :
                                  "applyToFolder-menu"},
                               {label: "Local Folders"},
                               {label: "ColumnsApplyParent"},
                               {label: "ColumnsApplyParent"}]);
  wait_for_modal_dialog("commonDialog");
  if (aChildrenToo)
    wait_for_observable_event("msg-folder-columns-propagated");
}

/**
 * Change settings in a folder, apply them to another folder that also has
 *  children.  Make sure the folder changes but the children do not.
 */
function test_apply_to_folder_no_children() {
  folderParent = create_folder("ColumnsApplyParent");
  folderParent.createSubfolder("Child1", null);
  folderChild1 = folderParent.getChildNamed("Child1");
  folderParent.createSubfolder("Child2", null);
  folderChild2 = folderParent.getChildNamed("Child2");

  be_in_folder(folderSource);

  // reset!
  invoke_column_picker_option([{anonid: "reset"}]);

  // permute!
  let conExtra = INBOX_DEFAULTS.concat(["sizeCol"]);
  show_column("sizeCol");
  assert_visible_columns(conExtra);

  // apply to the one dude
  _apply_to_folder_common(false);

  // make sure it copied to the parent
  be_in_folder(folderParent);
  assert_visible_columns(conExtra);

  // but not the children
  be_in_folder(folderChild1);
  assert_visible_columns(INBOX_DEFAULTS);
  be_in_folder(folderChild2);
  assert_visible_columns(INBOX_DEFAULTS);
}

/**
 * Change settings in a folder, apply them to another folder and its children.
 *  Make sure the folder and its children change.
 */
function test_apply_to_folder_and_children() {
  // no need to throttle ourselves during testing.
  MailUtils.INTER_FOLDER_PROCESSING_DELAY_MS = 0;

  be_in_folder(folderSource);

  // reset!
  invoke_column_picker_option([{anonid: "reset"}]);

  // permute!
  let conExtra = INBOX_DEFAULTS.concat(["tagsCol"]);
  show_column("tagsCol");
  assert_visible_columns(conExtra);

  // apply to the dude and his offspring
  _apply_to_folder_common(true);

  // make sure it copied to the parent and his children
  be_in_folder(folderParent);
  assert_visible_columns(conExtra);
  be_in_folder(folderChild1);
  assert_visible_columns(conExtra);
  be_in_folder(folderChild2);
  assert_visible_columns(conExtra);
}
test_apply_to_folder_and_children.EXCLUDED_PLATFORMS = ["linux"];
