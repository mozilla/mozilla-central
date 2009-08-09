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
 *   Andrew Sutherland <asutherland@asutherland.org>
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

var Ci = Components.interfaces;
var Cc = Components.classes;
var Cu = Components.utils;

var elib = {};
Cu.import('resource://mozmill/modules/elementslib.js', elib);
var EventUtils = {};
Cu.import('resource://mozmill/modules/EventUtils.js', EventUtils);
var mozmill = {};
Cu.import('resource://mozmill/modules/mozmill.js', mozmill);
var controller = {};
Cu.import('resource://mozmill/modules/controller.js', controller);
var frame = {};
Cu.import('resource://mozmill/modules/frame.js', frame);
var os = {};
Cu.import('resource://mozmill/stdlib/os.js', os);

const MODULE_NAME = 'folder-display-helpers';

const RELATIVE_ROOT = '../shared-modules';
// we need window-helpers for augment_controller
const MODULES_REQUIRES = ['window-helpers'];

const nsMsgViewIndex_None = 0xffffffff;
Cu.import('resource://app/modules/MailConsts.js');

const DO_NOT_EXPORT = {
  // magic globals
  MODULE_NAME: true, DO_NOT_EXPORT: true,
  // imported modules
  elib: true, mozmill: true, controller: true, frame: true, os: true,
  // convenience constants
  Ci: true, Cc: true, Cu: true, Cr: true,
  // useful constants
  nsMsgViewIndex_None: true, MailConsts: true,
  // internal setup functions
  setupModule: true, setupAccountStuff: true,
  // internal setup flags
  initialized: false,
  // other libraries we use
  windowHelper: true
};

var mainController = null;
/** convenience shorthand for the mainController. */
var mc;
/** the index of the current 'other' tab */
var otherTab;

// These are pseudo-modules setup by setupModule:
var messageGenerator;
var messageModifier;
var viewWrapperTestUtils;
// (end pseudo-modules)

var msgGen;

var gLocalIncomingServer = null;
var gLocalInboxFolder = null;

var rootFolder = null;

// the windowHelper module
var windowHelper;

var initialized = false;
function setupModule() {
  if (initialized)
    return;
  initialized = true;

  // The xpcshell test resources assume they are loaded into a single global
  //  namespace, so we need to help them out to maintain their delusion.
  messageGenerator = load_via_src_path(
    'mailnews/test/resources/messageGenerator.js');
  messageModifier = load_via_src_path(
    'mailnews/test/resources/messageModifier.js');
  viewWrapperTestUtils = load_via_src_path(
    'mailnews/test/resources/viewWrapperTestUtils.js');
  // desired global types...
  viewWrapperTestUtils.SyntheticMessageSet =
    messageModifier.SyntheticMessageSet;
  viewWrapperTestUtils.do_throw = function(aMsg) {
    throw new Error(aMsg);
  };
  // viewWrapperTestUtils wants a gMessageGenerator (and so do we)
  msgGen = new messageGenerator.MessageGenerator();
  viewWrapperTestUtils.gMessageGenerator = msgGen;
  viewWrapperTestUtils.gMessageScenarioFactory =
    new messageGenerator.MessageScenarioFactory(msgGen);

  make_new_sets_in_folders = make_new_sets_in_folder =
    viewWrapperTestUtils.make_new_sets_in_folders;
  add_sets_to_folders = viewWrapperTestUtils.add_sets_to_folders;
  create_virtual_folder = viewWrapperTestUtils.make_virtual_folder;

  viewWrapperTestUtils.Ci = Ci;
  viewWrapperTestUtils.Cu = Cu;
  viewWrapperTestUtils.Cc = Cc;

  // use window-helper's augment_controller method to get our extra good stuff
  //  we need.
  windowHelper = collector.getModule('window-helpers');
  mc = mainController = windowHelper.wait_for_existing_window("mail:3pane");
  windowHelper.augment_controller(mc);

  setupAccountStuff();
  viewWrapperTestUtils.gLocalIncomingServer = gLocalIncomingServer;
}

/**
 * Install this module into the provided module.
 */
function installInto(module) {
  setupModule();

  // now copy everything into the module they provided to us...
  let us = collector.getModule('folder-display-helpers');
  for each (let [key, value] in Iterator(us)) {
    if (!(key in DO_NOT_EXPORT) &&
        key[0] != "_")
      module[key] = value;
  }
}

function setupAccountStuff() {
  // Create a local account to work with folders.
  // (Note this gives you an Outbox and Trash folder by default).
  let acctMgr = Components.classes["@mozilla.org/messenger/account-manager;1"]
                          .getService(Components.interfaces.nsIMsgAccountManager);
  //acctMgr.createLocalMailAccount();

  gLocalIncomingServer = acctMgr.localFoldersServer;

  rootFolder = gLocalIncomingServer.rootMsgFolder;
  // Note: Inbox is not created automatically when there is no deferred server,
  // so we need to create it.
  gLocalInboxFolder = rootFolder.addSubfolder("Inbox");
  // a local inbox should have a Mail flag!
  gLocalInboxFolder.setFlag(Ci.nsMsgFolderFlags.Mail);
  gLocalInboxFolder.setFlag(Ci.nsMsgFolderFlags.Inbox);

  // Force an initialization of the Inbox folder database.
  var folderName = gLocalInboxFolder.prettiestName;

  gLocalInboxFolder = rootFolder.getChildNamed("Inbox");
}

/*
 * Although we all agree that the use of generators when dealing with async
 *  operations is awesome, the mozmill idiom is for calls to be synchronous and
 *  just spin event loops when they need to wait for things to happen.  This
 *  does make the test code significantly less confusing, so we do it too.
 * All of our operations are synchronous and just spin until they are happy.
 */

const NORMAL_TIMEOUT = 6000;
const FAST_INTERVAL = 100;

/**
 * Create a folder and rebuild the folder tree view.
 */
function create_folder(aFolderName) {
  let folder = rootFolder.addSubfolder(aFolderName);
  mc.folderTreeView.mode = "all";
  return folder;
}

/**
 * Create a virtual folder by deferring to |make_virtual_folder| and making
 *  sure to rebuild the folder tree afterwards.
 */
function create_virtual_folder() {
  let folder = viewWrapperTestUtils.make_virtual_folder.apply(null, arguments);
  mc.folderTreeView.mode = "all";
  return folder;
}


/**
 * Create a thread with the specified number of messages in it.
 */
function create_thread(aCount) {
  return new viewWrapperTestUtils.SyntheticMessageSet(viewWrapperTestUtils.gMessageScenarioFactory.directReply(aCount));
}

/**
 * Make sure we are entering the folder from not having been in the folder.  We
 *  will leave the folder and come back if we have to.
 */
function enter_folder(aFolder) {
  // Drain the event queue prior to doing any work.  It's possible that there's
  //  a pending setTimeout(0) that needs to get fired.
  controller.sleep(0);
  // if we're already selected, go back to the root...
  if (mc.folderDisplay.displayedFolder == aFolder)
    enter_folder(aFolder.rootFolder);

  mc.folderTreeView.selectFolder(aFolder);
  // XXX betrayal at startup involving the inbox can happen, so force the folder
  //  to be shown in that case.
  if (mc.folderDisplay.displayedFolder != aFolder)
    mc.folderDisplay.show(aFolder);
  wait_for_all_messages_to_load();
  // and drain the event queue
  controller.sleep(0);
}

/**
 * Make sure we are in the given folder, entering it if we were not.
 *
 * @return The tab info of the current tab (a more persistent identifier for
 *     tabs than the index, which will change as tabs open/close).
 */
function be_in_folder(aFolder) {
  if (mc.folderDisplay.displayedFolder != aFolder)
    enter_folder(aFolder);
  return mc.tabmail.currentTabInfo;
}

/**
 * Create a new tab displaying a folder, making that tab the current tab.
 *
 * @return The tab info of the current tab (a more persistent identifier for
 *     tabs than the index, which will change as tabs open/close).
 */
function open_folder_in_new_tab(aFolder) {
  // save the current tab as the 'other' tab
  otherTab = mc.tabmail.currentTabInfo;
  mc.tabmail.openTab("folder", {folder: aFolder});
  wait_for_all_messages_to_load();
  return mc.tabmail.currentTabInfo;
}

/**
 * Open the selected message(s) by pressing Enter. The mail.openMessageBehavior
 * pref is supposed to determine how the messages are opened.
 *
 * Since we don't know where this is going to trigger a message load, you're
 * going to have to wait for message display completion yourself.
 *
 * @param aController The controller in whose context to do this, defaults to
 *     |mc| if omitted.
 */
function open_selected_messages(aController) {
  if (aController === undefined)
    aController = mc;
  // Focus the thread tree
  aController.threadTree.focus();
  // Open whatever's selected
  press_enter(aController);
}

var open_selected_message = open_selected_messages;

/**
 * Create a new tab displaying the currently selected message, making that tab
 *  the current tab.  We block until the message finishes loading.
 *
 * @param aBackground [optional] If true, then the tab is opened in the
 *                    background. If false or not given, then the tab is opened
 *                    in the foreground.
 *
 * @return The tab info of the new tab (a more persistent identifier for tabs
 *     than the index, which will change as tabs open/close).
 */
function open_selected_message_in_new_tab(aBackground) {
  // get the current tab count so we can make sure the tab actually opened.
  let preCount = mc.tabmail.tabContainer.childNodes.length;

  // save the current tab as the 'other' tab
  otherTab = mc.tabmail.currentTabInfo;

  mc.tabmail.openTab("message", {msgHdr: mc.folderDisplay.selectedMessage,
      viewWrapperToClone: mc.folderDisplay.view,
      background: aBackground});
  // We won't trigger a new message load if we're in the background
  wait_for_message_display_completion(mc, !aBackground);

  // check that the tab count increased
  if (mc.tabmail.tabContainer.childNodes.length != preCount + 1)
    throw new Error("The tab never actually got opened!");

  // We append new tabs at the end, so return the last tab
  return mc.tabmail.tabInfo[mc.tabmail.tabContainer.childNodes.length - 1];
}

/**
 * Create a new window displaying the currently selected message.  We do not
 *  return until the message has finished loading.
 *
 * @return The MozmillController-wrapped new window.
 */
function open_selected_message_in_new_window() {
  windowHelper.plan_for_new_window("mail:messageWindow");
  mc.window.MsgOpenNewWindowForMessage();
  let msgc = windowHelper.wait_for_new_window("mail:messageWindow");
  wait_for_message_display_completion(msgc, true);
  return msgc;
}

/**
 * Switch to another tab.  If no tab is specified, we switch to the 'other' tab.
 *  That is the last tab we used, most likely the tab that was current when we
 *  created this tab.
 *
 * @param aNewTab Optional, index of the other tab to switch to.
 */
function switch_tab(aNewTab) {
  // If we're still loading a message at this point, wait for that to finish
  wait_for_message_display_completion();
  let targetTab = (aNewTab != null) ? aNewTab : otherTab;
  // now the current tab will be the 'other' tab after we switch
  otherTab = mc.tabmail.currentTabInfo;
  mc.tabmail.switchToTab(targetTab);
  // if there is something selected, wait for display completion
  if (mc.folderDisplay.selectedCount)
    wait_for_message_display_completion();
  // otherwise wait for the pane to end up blank
  else
    wait_for_blank_content_pane();
}

/**
 * Assert that the currently selected tab is the given one.
 *
 * @param aTab The tab that should currently be selected.
 */
function assert_selected_tab(aTab) {
  if (mc.tabmail.currentTabInfo != aTab)
    throw new Error("The currently selected tab should be at index " +
        mc.tabmail.tabInfo.indexOf(aTab) + ", but is actually at index " +
        mc.tabmail.tabInfo.indexOf(mc.tabmail.currentTabInfo));
}

/**
 * Assert that the given tab has the given mode name. Valid mode names include
 * "message" and "folder".
 *
 * @param aTab A Tab. The currently selected tab if null.
 * @param aModeName A string that should match the mode name of the tab.
 */
function assert_tab_mode_name(aTab, aModeName) {
  if (!aTab)
    aTab = mc.tabmail.currentTabInfo;

  if (aTab.mode.type != aModeName)
    throw new Error("Tab should be of type " + aModeName +
                    ", but is actually of type " + aTab.mode.type + ".");
}

/**
 * Assert that the number of tabs open matches the value given.
 *
 * @param aNumber The number of tabs that should be open.
 */
function assert_number_of_tabs_open(aNumber) {
  let actualNumber = mc.tabmail.tabContainer.childNodes.length;
  if (actualNumber != aNumber)
    throw new Error("There should be " + aNumber + " tabs open, but there " +
                    "are actually " + actualNumber + " tabs open.");
}

/**
 * Assert that the given tab's title is based on the provided folder or
 *  message.
 *
 * @param aTab A Tab.
 * @param aWhat Either an nsIMsgFolder or an nsIMsgDBHdr
 */
function assert_tab_titled_from(aTab, aWhat) {
  let text;
  if (aWhat instanceof Ci.nsIMsgFolder)
    text = aWhat.prettiestName;
  else if (aWhat instanceof Ci.nsIMsgDBHdr)
    text = aWhat.mime2DecodedSubject;

  if (aTab.title.indexOf(text) == -1)
    throw new Error("Tab title should include '" + text + "' but does not." +
                    " (Current title: '" + aTab.title + "'");
}

/**
 * Close a tab.  If no tab is specified, it is assumed you want to close the
 *  current tab.
 */
function close_tab(aTabToClose) {
  // get the current tab count so we can make sure the tab actually opened.
  let preCount = mc.tabmail.tabContainer.childNodes.length;

  mc.tabmail.closeTab(aTabToClose);

  // if there is a message visible in the tab, make sure we wait for the load
  if (mc.folderDisplay.selectedCount)
    wait_for_message_display_completion(
      mc, mc.messageDisplay.displayedMessage != null);
  // otherwise wait for the pane to end up blank
  else
    wait_for_blank_content_pane();

  // check that the tab count decreased
  if (mc.tabmail.tabContainer.childNodes.length != preCount - 1)
    throw new Error("The tab never actually got closed!");
}

/**
 * Close a standalone message window.
 *
 * @param aController The message window controller
 */
function close_message_window(aController) {
  windowHelper.plan_for_window_close(aController);
  aController.window.close();
  windowHelper.wait_for_window_close(aController);
}

/**
 * Close a standalone message window.
 *
 * @param aController The message window controller
 */
function close_message_window(aController) {
  windowHelper.plan_for_window_close(aController);
  aController.window.close();
  windowHelper.wait_for_window_close(aController);
}

/**
 * Clear the selection.  I'm not sure how we're pretending we did that.
 */
function select_none(aController) {
  if (aController === undefined)
    aController = mc;
  wait_for_message_display_completion();
  aController.dbView.selection.clearSelection();
  // Because the selection event may not be generated immediately, we need to
  //  spin until the message display thinks it is not displaying a message,
  //  which is the sign that the event actually happened.
  function noMessageChecker() {
    return aController.messageDisplay.displayedMessage == null;
  }
  controller.sleep('subject()',
                   NORMAL_TIMEOUT, FAST_INTERVAL, noMessageChecker);
}

/**
 * Normalize a view index to be an absolute index, handling slice-style negative
 *  references as well as piercing complex things like message headers and
 *  synthetic message sets.
 *
 * @param aViewIndex An absolute index (integer >= 0), slice-style index (< 0),
 *     or a SyntheticMessageSet (we only care about the first message in it).
 */
function _normalize_view_index(aViewIndex, aController) {
  if (aController === undefined)
    aController = mc;
  // SyntheticMessageSet special-case
  if (typeof(aViewIndex) != "number") {
    let msgHdrIter = aViewIndex.msgHdrs;
    let msgHdr = msgHdrIter.next();
    msgHdrIter.close();
    // do not expand
    aViewIndex = aController.dbView.findIndexOfMsgHdr(msgHdr, false);
  }

  if (aViewIndex < 0)
    return aController.dbView.QueryInterface(Ci.nsITreeView).rowCount +
      aViewIndex;
  return aViewIndex;
}

/**
 * Pretend we are clicking on a row with our mouse.
 *
 * @param aViewIndex If >= 0, the view index provided, if < 0, a reference to
 *     a view index counting from the last row in the tree.  -1 indicates the
 *     last message in the tree, -2 the second to last, etc.
 * @param aController The controller in whose context to do this, defaults to
 *     |mc| if omitted.
 *
 * @return The message header selected.
 */
function select_click_row(aViewIndex, aController) {
  if (aController === undefined)
    aController = mc;
  let hasMessageDisplay = "messageDisplay" in aController;
  if (hasMessageDisplay)
    wait_for_message_display_completion(aController);
  aViewIndex = _normalize_view_index(aViewIndex, aController);

  // this should set the current index as well as setting the selection.
  aController.dbView.selection.select(aViewIndex);
  if (hasMessageDisplay)
    wait_for_message_display_completion(aController,
                                        aController.messageDisplay.visible);
  return aController.dbView.getMsgHdrAt(aViewIndex);
}

/**
 * Pretend we are toggling the thread specified by a row.
 *
 * @param aViewIndex If >= 0, the view index provided, if < 0, a reference to
 *     a view index counting from the last row in the tree.  -1 indicates the
 *     last message in the tree, -2 the second to last, etc.
 *
 */
function toggle_thread_row(aViewIndex) {
  wait_for_message_display_completion();
  aViewIndex = _normalize_view_index(aViewIndex);
  mc.dbView.toggleOpenState(aViewIndex);
  wait_for_message_display_completion(mc, mc.messageDisplay.visible);
}


/**
 * Pretend we are clicking on a row with our mouse with the control key pressed,
 *  resulting in the addition/removal of just that row to/from the selection.
 *
 * @param aViewIndex If >= 0, the view index provided, if < 0, a reference to
 *     a view index counting from the last row in the tree.  -1 indicates the
 *     last message in the tree, -2 the second to last, etc.
 *
 * @return The message header of the affected message.
 */
function select_control_click_row(aViewIndex) {
  wait_for_message_display_completion();
  aViewIndex = _normalize_view_index(aViewIndex);
  // Control-clicking augments the selection and moves the current index.  It
  //  also clears the shift pivot, but that's fine as it falls back to the
  //  current index if there is no shift pivot, which works for duplicating
  //  actual behavior.
  mc.dbView.selection.rangedSelect(aViewIndex, aViewIndex, true);
  mc.dbView.selection.currentIndex = aViewIndex;
  // give the event queue a chance to drain...
  controller.sleep(0);
  wait_for_message_display_completion();
  return mc.dbView.getMsgHdrAt(aViewIndex);
}

/**
 * Pretend we are clicking on a row with our mouse with the shift key pressed,
 *  adding all the messages between the shift pivot and the shift selected row.
 *
 * @param aViewIndex If >= 0, the view index provided, if < 0, a reference to
 *     a view index counting from the last row in the tree.  -1 indicates the
 *     last message in the tree, -2 the second to last, etc.
 * @param aController The controller in whose context to do this, defaults to
 *     |mc| if omitted.
 *
 * @return The message headers for all messages that are now selected.
 */
function select_shift_click_row(aViewIndex, aController) {
  if (aController === undefined)
    aController = mc;
  let hasMessageDisplay = "messageDisplay" in aController;
  if (hasMessageDisplay)
    wait_for_message_display_completion(aController);
  aViewIndex = _normalize_view_index(aViewIndex, aController);

  // Passing -1 as the start range checks the shift-pivot, which should be -1,
  //  so it should fall over to the current index, which is what we want.  It
  //  will then set the shift-pivot to the previously-current-index and update
  //  the current index to be what we shift-clicked on.  All matches user
  //  interaction.
  aController.dbView.selection.rangedSelect(-1, aViewIndex, false);
  // give the event queue a chance to drain...
  controller.sleep(0);
  if (hasMessageDisplay)
    wait_for_message_display_completion(aController);
  return aController.folderDisplay.selectedMessages;
}

/**
 * Helper function to click on a row with a given button.
 */
function _row_click_helper(aTree, aViewIndex, aButton) {
  let treeBox = aTree.treeBoxObject;
  // very important, gotta be able to see the row
  treeBox.ensureRowIsVisible(aViewIndex);
  // now figure out the coords
  let children = mc.e(aTree.id, {tagName: "treechildren"});
  let x = children.boxObject.x;
  let y = children.boxObject.y;
  let rowX = 10;
  let rowY = treeBox.rowHeight * (aViewIndex - treeBox.getFirstVisibleRow());
  if (treeBox.getRowAt(x + rowX, y + rowY) != aViewIndex) {
    throw new Error("Thought we would find row " + aViewIndex + " at " +
                    rowX + "," + rowY + " but we found " +
                    treeBox.getRowAt(rowX, rowY));
  }
  let tx = aTree.boxObject.x;
  let ty = aTree.boxObject.y;
  EventUtils.synthesizeMouse(aTree, x + rowX - tx, y + rowY - ty,
                             {type: "mousedown", button: aButton}, mc.window);
  if (aButton == 2)
    EventUtils.synthesizeMouse(aTree, x + rowX - tx, y + rowY - ty,
                               {type: "contextmenu", button: aButton},
                               mc.window);
  EventUtils.synthesizeMouse(aTree, x + rowX - tx, y + rowY - ty,
                             {type: "mouseup", button: aButton}, mc.window);
}

/**
 * Right-click on the tree-view in question.  With any luck, this will have
 *  the side-effect of opening up a pop-up which it is then on _your_ head
 *  to do something with or close.  However, we have helpful popup function
 *  helpers because I'm so nice.
 *
 * @return The message header that you clicked on.
 */
function right_click_on_row(aViewIndex) {
  let msgHdr = mc.dbView.getMsgHdrAt(aViewIndex);
  _row_click_helper(mc.threadTree, aViewIndex, 2);
  return msgHdr;
}

/**
 * Middle-click on the tree-view in question, presumably opening a new message
 *  tab.
 *
 * @return [The new tab, the message that you clicked on.]
 */
function middle_click_on_row(aViewIndex) {
  let msgHdr = mc.dbView.getMsgHdrAt(aViewIndex);
  _row_click_helper(mc.threadTree, aViewIndex, 1);
  // We append new tabs at the end, so return the last tab
  return [mc.tabmail.tabInfo[mc.tabmail.tabContainer.childNodes.length - 1],
          msgHdr];
}

/**
 * Clear the selection in the folder tree view.
 */
function select_no_folders() {
  wait_for_message_display_completion();
  mc.folderTreeView.selection.clearSelection();
  // give the event queue a chance to drain...
  controller.sleep(0);
}

/**
 * Pretend we are clicking on a folder with our mouse.
 *
 * @param aFolder The folder to click on. This needs to be present in the
 *     current folder tree view, of course.
 *
 * @returns the view index that you clicked on.
 */
function select_click_folder(aFolder) {
  wait_for_all_messages_to_load();

  // this should set the current index as well as setting the selection.
  let viewIndex = mc.folderTreeView.getIndexOfFolder(aFolder);
  mc.folderTreeView.selection.select(viewIndex);
  wait_for_all_messages_to_load();
  // drain the event queue
  controller.sleep(0);

  return viewIndex;
}

/**
 * Pretend we are clicking on a folder with our mouse with the shift key pressed.
 *
 * @param aFolder The folder to shift-click on. This needs to be present in the
 *     current folder tree view, of course.
 *
 * @return An array containing all the folders that are now selected.
 */
function select_shift_click_folder(aFolder) {
  wait_for_all_messages_to_load();

  let viewIndex = mc.folderTreeView.getIndexOfFolder(aFolder);
  // Passing -1 as the start range checks the shift-pivot, which should be -1,
  //  so it should fall over to the current index, which is what we want.  It
  //  will then set the shift-pivot to the previously-current-index and update
  //  the current index to be what we shift-clicked on.  All matches user
  //  interaction.
  mc.folderTreeView.selection.rangedSelect(-1, viewIndex, false);
  wait_for_all_messages_to_load();
  // give the event queue a chance to drain...
  controller.sleep(0);

  return mc.folderTreeView.getSelectedFolders();
}

/**
 * Right click on the folder tree view. With any luck, this will have the
 * side-effect of opening up a pop-up which it is then on _your_ head to do
 * something with or close.  However, we have helpful popup function helpers
 * helpers because asuth's so nice.
 *
 * @note The argument is a folder here, unlike in the message case, so beware.
 *
 * @return The view index that you clicked on.
 */
function right_click_on_folder(aFolder) {
  // Figure out the view index
  let viewIndex = mc.folderTreeView.getIndexOfFolder(aFolder);
  _row_click_helper(mc.folderTree, viewIndex, 2);
  return viewIndex;
}

/**
 * Middle-click on the folder tree view, presumably opening a new folder tab.
 *
 * @note The argument is a folder here, unlike in the message case, so beware.
 *
 * @return [The new tab, the view index that you clicked on.]
 */
function middle_click_on_folder(aFolder) {
  // Figure out the view index
  let viewIndex = mc.folderTreeView.getIndexOfFolder(aFolder);
  _row_click_helper(mc.folderTree, viewIndex, 1);
  // We append new tabs at the end, so return the last tab
  return [mc.tabmail.tabInfo[mc.tabmail.tabContainer.childNodes.length - 1],
          viewIndex];
}

/**
 * Assuming the context popup is popped-up (via right_click_on_row), select
 *  the deletion option.  If the popup is not popped up, you are out of luck.
 */
function delete_via_popup() {
  plan_to_wait_for_folder_events("DeleteOrMoveMsgCompleted",
                                 "DeleteOrMoveMsgFailed");
  mc.click(mc.eid("mailContext-delete"));
  // for reasons unknown, the pop-up does not close itself?
  close_popup();
  wait_for_folder_events();
}

/**
 * Close the open pop-up.
 */
function close_popup(aController) {
  if (aController === undefined)
    aController = mc;
  aController.keypress(aController.eid("mailContext"), "VK_ESCAPE", {});
  // drain event queue
  aController.sleep(0);
}

/**
 * Pretend we are pressing the delete key, triggering message deletion of the
 *  selected messages.
 *
 * @param aController The controller in whose context to do this, defaults to
 *     |mc| if omitted.
 */
function press_delete(aController) {
  if (aController === undefined)
    aController = mc;
  // if something is loading, make sure it finishes loading...
  wait_for_message_display_completion(aController);
  plan_to_wait_for_folder_events("DeleteOrMoveMsgCompleted",
                                 "DeleteOrMoveMsgFailed");
  aController.keypress(aController == mc ? mc.eThreadTree : null,
                       "VK_DELETE", {});
  wait_for_folder_events();
}

/**
 * Pretend we are pressing the Enter key, triggering opening selected messages.
 * Note that since we don't know where this is going to trigger a message load,
 * you're going to have to wait for message display completion yourself.
 *
 * @param aController The controller in whose context to do this, defaults to
 *     |mc| if omitted.
 */
function press_enter(aController) {
  if (aController === undefined)
    aController = mc;
  // if something is loading, make sure it finishes loading...
  if ("messageDisplay" in aController)
    wait_for_message_display_completion(aController);
  aController.keypress(aController == mc ? mc.eThreadTree : null,
                       "VK_RETURN", {});
  // The caller's going to have to wait for message display completion
}

/**
 * Wait for the |folderDisplay| on aController (defaults to mc if omitted) to
 *  finish loading.  This generally only matters for folders that have an active
 *  search.
 * This method is generally called automatically most of the time, and you
 *  should not need to call it yourself unless you are operating outside the
 *  helper methods in this file.
 */
function wait_for_all_messages_to_load(aController) {
  if (aController === undefined)
    aController = mc;
  if(!controller.waitForEval('subject.allMessagesLoaded', NORMAL_TIMEOUT,
                              FAST_INTERVAL, aController.folderDisplay))
    throw new Error("Messages never finished loading.  Timed Out.");
  // the above may return immediately, meaning the event queue might not get a
  //  chance.  give it a chance now.
  aController.sleep(0);
}

/**
 * If  a message is in the process of loading, let it finish.  Otherwise we get
 *  horrible assertions like so:
 * ###!!! ASSERTION: Overwriting an existing document channel!
 *
 * @param aController optional controller, defaulting to |mc|.
 * @param aLoadDemanded optional indication that we expect and demand that a
 *     message be loaded.  If you call us before the message loading is
 *     initiated, you will need to pass true for this so that we don't see
 *     that a load hasn't started and assume none is required.  Defaults to
 *     false.  This relies on aController.messageDisplay.messageLoaded to
 *     be reliable; make sure it is false when entering this function.
 */
function wait_for_message_display_completion(aController, aLoadDemanded) {
  if (aController === undefined)
    aController = mc;
  let contentPane = aController.contentPane;
  let oldHref = null;

  // There are a couple possible states the universe can be in:
  // 1) No message load happened or is going to happen.
  // 2) The only message load that is going to happened has happened.
  // 3) A message load is happening right now.
  // 4) A message load should happen in the near future.
  //
  // We have nothing that needs to be done in cases 1 and 2.  Case 3 is pretty
  //  easy for us.  The question is differentiating between case 4 and (1, 2).
  //  We rely on MessageDisplayWidget.messageLoaded to differentiate this case
  //  for us.
  let isLoadedChecker = function() {
    // If a load is demanded, first require that MessageDisplayWidget think
    //  that the message is loaded.  Because the notification is imperfect,
    //  this will strictly happen before the URL finishes running.
    if (aLoadDemanded && !aController.messageDisplay.messageLoaded)
      return false;

    let docShell = contentPane.docShell;
    if (!docShell)
      return false;
    let uri = docShell.currentURI;
    // the URL will tell us if it is running, saves us from potential error
    if (uri && (uri instanceof Components.interfaces.nsIMsgMailNewsUrl)) {
      let urlRunningObj = {};
      uri.GetUrlState(urlRunningObj);
      // GetUrlState returns true if the url is still running
      return !urlRunningObj.value;
    }
    // not a mailnews URL, just check the busy flags...
    return !docShell.busyFlags;
  };
  controller.waitForEval('subject()',
                         NORMAL_TIMEOUT,
                         FAST_INTERVAL, isLoadedChecker);
  // the above may return immediately, meaning the event queue might not get a
  //  chance.  give it a chance now.
  aController.sleep(0);
}

/**
 * Wait for the content pane to be blank because no message is to be displayed.
 * You would not want to call this once folder summaries land and if they are
 *  enabled.
 *
 * @param aController optional controller, defaulting to |mc|.
 */
function wait_for_blank_content_pane(aController) {
  if (aController === undefined)
    aController = mc;

  let isBlankChecker = function() {
    return aController.window.content.location.href == "about:blank";
  };
  controller.waitForEval('subject()',
                         NORMAL_TIMEOUT,
                         FAST_INTERVAL, isBlankChecker);
  // the above may return immediately, meaning the event queue might not get a
  //  chance.  give it a chance now.
  aController.sleep(0);
}


var FolderListener = {
  _inited: false,
  ensureInited: function() {
    if (this._inited)
      return;

    let mailSession =
      Cc["@mozilla.org/messenger/services/session;1"]
        .getService(Ci.nsIMsgMailSession);
    mailSession.AddFolderListener(this,
                                  Ci.nsIFolderListener.event);

    this._inited = true;
  },

  sawEvents: false,
  watchingFor: null,
  planToWaitFor: function FolderListener_planToWaitFor() {
    this.sawEvents = false;
    this.watchingFor = [];
    for (let i = 0; i < arguments.length; i++)
      this.watchingFor[i] = arguments[i];
  },
  waitForEvents: function FolderListener_waitForEvents() {
    if (this.sawEvents)
      return;
    controller.waitForEval('subject.sawEvents', NORMAL_TIMEOUT,
                           FAST_INTERVAL, this);
  },

  OnItemEvent: function FolderNotificationHelper_OnItemEvent(
      aFolder, aEvent) {
    if (!this.watchingFor)
      return;
    if (this.watchingFor.indexOf(aEvent.toString()) != -1) {
      this.watchingFor = null;
      this.sawEvents = true;
    }
  },
};

/**
 * Plan to wait for an nsIFolderListener.OnItemEvent matching one of the
 *  provided strings.  Call this before you do the thing that triggers the
 *  event, then call |wait_for_folder_events| after the event.  This ensures
 *  that we see the event, because it might be too late after you initiate
 *  the thing that would generate the event.
 * For example, plan_to_wait_for_folder_events("DeleteOrMoveMsgCompleted",
 *  "DeleteOrMoveMsgFailed") waits for a deletion completion notification
 *  when you call |wait_for_folder_events|.
 * The waiting is currently un-scoped, so the event happening on any folder
 *  triggers us.  It is expected that you won't try and have multiple events
 *  in-flight or will augment us when the time comes to have to deal with that.
 */
function plan_to_wait_for_folder_events() {
  FolderListener.ensureInited();
  FolderListener.planToWaitFor.apply(FolderListener, arguments);
}
function wait_for_folder_events() {
  FolderListener.waitForEvents();
}

/**
 * Assert that the given synthetic message sets are present in the folder
 *  display.
 *
 * @param aSynSets Either a single SyntheticMessageSet or a list of them.
 * @param aController Optional controller, which we get the folderDisplay
 *     property from.  If omitted, we use the mc (mainController).
 */
function assert_messages_in_view(aSynSets, aController) {
  if (aController === undefined)
    aController = mc;
  viewWrapperTestUtils.verify_messages_in_view(aSynSets,
                                               aController.folderDisplay.view);
}

/**
 * Assert the the given message/messages are not present in the view.
 * @param aMessages Either a single nsIMsgDBHdr or a list of them.
 */
function assert_messages_not_in_view(aMessages, aController) {
  if (aController === undefined)
    aController = mc;
  if (aMessages instanceof Ci.nsIMsgDBHdr)
    aMessages = [aMessages];
  for each (let [, msgHdr] in Iterator(aMessages)) {
    if (mc.dbView.findIndexOfMsgHdr(msgHdr, true) != nsMsgViewIndex_None)
      throw new Error("Message header is present in view but should not be: " +
                       msgHdr.mime2DecodedSubject + " index: " +
                       mc.dbView.findIndexOfMsgHdr(msgHdr, true));
  }
}
var assert_message_not_in_view = assert_messages_not_in_view;

/**
 * Helper function for use by assert_selected / assert_selected_and_displayed /
 *  assert_displayed.
 *
 * @return A list of two elements: [MozmillController, [list of view indices]].
 */
function _process_row_message_arguments() {
  let troller = mc;
  // - normalize into desired selected view indices
  let desiredIndices = [];
  for (let iArg = 0; iArg < arguments.length; iArg++) {
    let arg = arguments[iArg];
    // An integer identifying a view index
    if (typeof(arg) == "number") {
      desiredIndices.push(_normalize_view_index(arg));
    }
    // A message header
    else if (arg instanceof Ci.nsIMsgDBHdr) {
      // do not expand; the thing should already be selected, eg expanded!
      let viewIndex = troller.dbView.findIndexOfMsgHdr(arg, false);
      if (viewIndex == nsMsgViewIndex_None)
        throw_and_dump_view_state(
          "Message not present in view that should be there. " +
            "(" + arg.messageKey + ": " + arg.mime2DecodedSubject + ")");
      desiredIndices.push(viewIndex);
    }
    // A list containing two integers, indicating a range of view indices.
    else if (arg.length == 2 && typeof(arg[0]) == "number") {
      let lowIndex = _normalize_view_index(arg[0]);
      let highIndex = _normalize_view_index(arg[1]);
      for (let viewIndex = lowIndex; viewIndex <= highIndex; viewIndex++)
        desiredIndices.push(viewIndex);
    }
    // a List of message headers
    else if (arg.length !== undefined) {
      for (let iMsg = 0; iMsg < arg.length; iMsg++) {
        let msgHdr = arg[iMsg].QueryInterface(Ci.nsIMsgDBHdr);
        if (!msgHdr)
          throw new Error(arg[iMsg] + " is not a message header!");
        // false means do not expand, it should already be selected
        let viewIndex = troller.dbView.findIndexOfMsgHdr(msgHdr, false);
        if (viewIndex == nsMsgViewIndex_None)
          throw_and_dump_view_state(
            "Message not present in view that should be there. " +
             "(" + msgHdr.messageKey + ": " + msgHdr.mime2DecodedSubject + ")");
        desiredIndices.push(viewIndex);
      }
    }
    // SyntheticMessageSet
    else if (arg.synMessages) {
      for each (let msgHdr in arg.msgHdrs) {
        let viewIndex = troller.dbView.findIndexOfMsgHdr(msgHdr, false);
        if (viewIndex == nsMsgViewIndex_None)
          throw_and_dump_view_state(
            "Message not present in view that should be there. " +
             "(" + msgHdr.messageKey + ": " + msgHdr.mime2DecodedSubject + ")");
        desiredIndices.push(viewIndex);
      }
    }
    // it's a MozmillController
    else if (arg.window) {
      troller = arg;
    }
    else {
      throw new Error("Illegal argument: " + arg);
    }
  }
  // sort by integer value
  desiredIndices.sort(function (a, b) { return a - b;} );

  return [troller, desiredIndices];
}

/**
 * Asserts that the given set of messages are selected.  Unless you are dealing
 *  with transient selections resulting from right-clicks, you want to be using
 *  assert_selected_and_displayed because it makes sure that the display is
 *  correct too.
 *
 * The arguments consist of one or more of the following:
 * - A MozmillController, indicating we should use that controller instead of
 *   the default, "mc" (corresponding to the 3pane.)  Pass this first!
 * - An integer identifying a view index.
 * - A list containing two integers, indicating a range of view indices.
 * - A message header.
 * - A list of message headers.
 * - A synthetic message set.
 */
function assert_selected() {
  let [troller, desiredIndices] =
    _process_row_message_arguments.apply(this, arguments);

  // - get the actual selection (already sorted by integer value)
  let selectedIndices = troller.folderDisplay.selectedIndices;
  // - test selection equivalence
  // which is the same as string equivalence in this case. muah hah hah.
  if (desiredIndices.toString() != selectedIndices.toString())
    throw new Error("Desired selection is: " + desiredIndices + " but actual " +
                    "selection is: " + selectedIndices);

  return [troller, desiredIndices];
}

/**
 * Assert that the given set of messages is displayed, but not necessarily
 *  selected.  Unless you are dealing with transient selection issues or some
 *  other situation where the FolderDisplay should not be correlated with the
 *  MessageDisplay, you really should be using assert_selected_and_displayed.
 *
 * The arguments consist of one or more of the following:
 * - A MozmillController, indicating we should use that controller instead of
 *   the default, "mc" (corresponding to the 3pane.)  Pass this first!
 * - An integer identifying a view index.
 * - A list containing two integers, indicating a range of view indices.
 * - A message header.
 * - A list of message headers.
 */
function assert_displayed() {
  let [troller, desiredIndices] =
    _process_row_message_arguments.apply(this, arguments);
  _internal_assert_displayed(false, troller, desiredIndices);
}

/**
 * Assert-that-the-display-is-right logic.  We need an internal version so that
 *  we can know whether we can trust/assert that folderDisplay.selectedMessage
 *  agrees with messageDisplay, and also so that we don't have to re-compute
 *  troller and desiredIndices.
 */
function _internal_assert_displayed(trustSelection, troller, desiredIndices) {
  // - verify that the right thing is being displayed.
  // no selection means folder summary.
  if (desiredIndices.length == 0) {
    // folder summary is not landed yet, just verify there is no message.
    if (troller.messageDisplay.displayedMessage != null)
      throw new Error("Message display should not think it is displaying a " +
                      "message.");
    // make sure the content pane is pointed at about:blank
    if (troller.window.content.location.href != "about:blank") {
      throw new Error("the content pane should be blank, but is showing: '" +
                      troller.window.content.location.href + "'");
    }
  }
  // 1 means the message should be displayed
  else if (desiredIndices.length == 1) {
    // make sure message display thinks we are in single message display mode
    if (!troller.messageDisplay.singleMessageDisplay)
      throw new Error("Message display is not in single message display mode.");
    // now make sure that we actually are in single message display mode
    let singleMessagePane = troller.e("singlemessage");
    let multiMessagePane = troller.e("multimessage");
    if (singleMessagePane && singleMessagePane.hidden)
      throw new Error("Single message pane is hidden but it should not be.");
    if (multiMessagePane && !multiMessagePane.hidden)
      throw new Error("Multiple message pane is visible but it should not be.");

    if (trustSelection) {
      if (troller.folderDisplay.selectedMessage !=
          troller.messageDisplay.displayedMessage)
        throw new Error("folderDisplay.selectedMessage != " +
                        "messageDisplay.displayedMessage! (fd: " +
                        troller.folderDisplay.selectedMessage + " vs md: " +
                        troller.messageDisplay.displayedMessage + ")");
    }

    let msgHdr = troller.messageDisplay.displayedMessage;
    let msgUri = msgHdr.folder.getUriForMsg(msgHdr);
    // wait for the document to load so that we don't try and replace it later
    //  and get that stupid assertion
    wait_for_message_display_completion();
    // make sure the content pane is pointed at the right thing

    let msgService =
      troller.folderDisplay.messenger.messageServiceFromURI(msgUri);
    let msgUrlObj = {};
    msgService.GetUrlForUri(msgUri, msgUrlObj, troller.folderDisplay.msgWindow);
    let msgUrl = msgUrlObj.value;
    if (troller.window.content.location.href != msgUrl.spec)
      throw new Error("The content pane is not displaying the right message! " +
                      "Should be: " + msgUrl.spec + " but it's: " +
                      troller.window.content.location.href);
  }
  // multiple means some form of multi-message summary
  else {
    // XXX deal with the summarization threshold bail case.

    // make sure the message display thinks we are in multi-message mode
    if (troller.messageDisplay.singleMessageDisplay)
      throw new Error("Message display should not be in single message display"+
                      "mode!  Selected indices: " + selectedIndices);

    // now make sure that we actually are in nultiple message display mode
    let singleMessagePane = troller.e("singlemessage");
    let multiMessagePane = troller.e("multimessage");
    if (singleMessagePane && !singleMessagePane.hidden)
      throw new Error("Single message pane is visible but it should not be.");
    if (multiMessagePane && multiMessagePane.hidden)
      throw new Error("Multiple message pane is hidden but it should not be.");

    // and _now_ make sure that we actually summarized what we wanted to
    //  summarize.
    let desiredMessages = [mc.dbView.getMsgHdrAt(vi) for each
                            ([, vi] in Iterator(desiredIndices))];
    assert_messages_summarized(troller, desiredMessages);
  }
}

/**
 * Assert that the messages corresponding to the one or more message spec
 *  arguments are selected and displayed.  If you specify multiple messages,
 *  we verify that the multi-message selection mode is in effect and that they
 *  are doing the desired thing.  (Verifying the summarization may seem
 *  overkill, but it helps make the tests simpler and allows you to be more
 *  confident if you're just running one test that everything in the test is
 *  performing in a sane fashion.  Refactoring could be in order, of course.)
 *
 * The arguments consist of one or more of the following:
 * - A MozmillController, indicating we should use that controller instead of
 *   the default, "mc" (corresponding to the 3pane.)  Pass this first!
 * - An integer identifying a view index.
 * - A list containing two integers, indicating a range of view indices.
 * - A message header.
 * - A list of message headers.
 */
function assert_selected_and_displayed() {
  // make sure the selection is right first.
  let [troller, desiredIndices] = assert_selected.apply(this, arguments);
  // now make sure the display is right
  _internal_assert_displayed(true, troller, desiredIndices);
}

/**
 * @return true if |aSetOne| is equivalent to |aSetTwo| where the sets are
 *     really just lists of nsIMsgDBHdrs with cool names.
 */
function _verify_message_sets_equivalent(aSetOne, aSetTwo) {
  let uniqy1 = [msgHdr.folder.URI + msgHdr.messageKey for each
                 ([, msgHdr] in Iterator(aSetOne))];
  uniqy1.sort();
  let uniqy2 = [msgHdr.folder.URI + msgHdr.messageKey for each
                 ([, msgHdr] in Iterator(aSetTwo))];
  uniqy2.sort();
  // stringified versions should now be equal...
  return uniqy1.toString() == uniqy2.toString();
}

/**
 * Asserts that the messages the controller's folder display widget thinks are
 *  summarized are in fact summarized.  This is automatically called by
 *  assert_selected_and_displayed, so you do not need to call this directly
 *  unless you are testing the summarization logic.
 *
 * @param aController The controller who has the summarized display going on.
 * @param [aMessages] Optional set of messages to verify.  If not provided, this
 *     is extracted via the folderDisplay.  If a SyntheticMessageSet is provided
 *     we will automatically retrieve what we need from it.
 */
function assert_messages_summarized(aController, aSelectedMessages) {
  // - Compensate for selection stabilization code.
  // Although test-window-helpers sets the stabilization interval to 0, we
  //  still need to make sure we have drained the event queue so that it has
  //  actually gotten a chance to run.
  controller.sleep(0);

  // - Verify summary object knows about right messages
  if (aSelectedMessages == null)
    aSelectedMessages = aController.folderDisplay.selectedMessages;
  // if it's a synthetic message set, we want the headers...
  if (aSelectedMessages.synMessages)
    aSelectedMessages = [msgHdr for each (msgHdr in aSelectedMessages.msgHdrs)];

  let summary = aController.window.gSummary;
  if (aSelectedMessages.length != summary._msgHdrs.length) {
    let elaboration = "Summary contains " + summary._msgHdrs.length +
                      " messages, expected " + aSelectedMessages.length + ".";
    throw new Error("Summary does not contain the right set of messages. " +
                    elaboration);
  }
  if (!_verify_message_sets_equivalent(summary._msgHdrs, aSelectedMessages)) {
    let elaboration = "Summary: " + summary._msgHdrs + "  Selected: " +
                      aSelectedMessages + ".";
    throw new Error("Summary does not contain the right set of messages. " +
                    elaboration);
  }
}

/**
 * Assert that there is nothing selected and, assuming we are in a folder, that
 *  the folder summary is displayed.
 */
let assert_nothing_selected = assert_selected_and_displayed;

/**
 * Assert that the given view index or message is visible in the thread pane.
 */
function assert_visible(aViewIndexOrMessage) {
  let viewIndex;
  if (typeof(aViewIndexOrMessage) == "number")
    viewIndex = _normalize_view_index(aViewIndexOrMessage);
  else
    viewIndex = mc.dbView.findIndexOfMsgHdr(aViewIndexOrMessage);
  let treeBox = mc.threadTree.boxObject.QueryInterface(Ci.nsITreeBoxObject);
  if (viewIndex < treeBox.getFirstVisibleRow() ||
      viewIndex > treeBox.getLastVisibleRow())
    throw new Error("View index " + viewIndex + " is not visible! (" +
                    treeBox.getFirstVisibleRow() + "-" +
                    treeBox.getLastVisibleRow() + " are visible)");
}

/**
 * @param aShouldBeElided Should the messages at the view indices be elided?
 * @param aArgs Arguments of the form processed by
 *     |_process_row_message_arguments|.
 */
function _assert_elided_helper(aShouldBeElided, aArgs) {
  let [troller, viewIndices] =
    _process_row_message_arguments.apply(this, aArgs);

  let dbView = troller.dbView;
  for each (let [, viewIndex] in Iterator(viewIndices)) {
    let flags = dbView.getFlagsAt(viewIndex);
    if (Boolean(flags & Ci.nsMsgMessageFlags.Elided) != aShouldBeElided)
      throw new Error("Message at view index " + viewIndex +
                      (aShouldBeElided ? " should be elided but is not!"
                                       : " should not be elided but is!"));
  }
}

/**
 * Assert that all of the messages at the given view indices are collapsed.
 * Arguments should be of the type accepted by |assert_selected_and_displayed|.
 */
function assert_collapsed() {
  _assert_elided_helper(true, arguments);
}

/**
 * Assert that all of the messages at the given view indices are expanded.
 * Arguments should be of the type accepted by |assert_selected_and_displayed|.
 */
function assert_expanded() {
  _assert_elided_helper(false, arguments);
}

var RECOGNIZED_WINDOWS = ["messagepane", "multimessage"];
var RECOGNIZED_ELEMENTS = ["folderTree", "threadTree"];

/**
 * Focus an element.
 */
function _focus_element(aElement) {
  // We're assuming that all elements we'd like to focus are in the main window
  mc.window.focus();
  mc.e(aElement).focus();
}

/**
 * Focus a window.
 */
function _focus_window(aWindow) {
  mc.e(aWindow).contentWindow.focus();
}

/**
 * Focus the folder tree.
 */
function focus_folder_tree() {
  _focus_element("folderTree");
}

/**
 * Focus the thread tree.
 */
function focus_thread_tree() {
  _focus_element("threadTree");
}

/**
 * Focus the (single) message pane.
 */
function focus_message_pane() {
  _focus_window("messagepane");
}

/**
 * Focus the multimessage pane.
 */
function focus_multimessage_pane() {
  _focus_window("multimessage");
}

/**
 * Returns a string indicating whatever's currently focused. This will return
 * either one of the strings in RECOGNIZED_WINDOWS/RECOGNIZED_ELEMENTS or null.
 */
function _get_currently_focused_thing() {
  // If the message pane or multimessage is focused, return that
  let focusedWindow = mc.window.document.commandDispatcher.focusedWindow;
  if (focusedWindow) {
    for each (let [, windowId] in Iterator(RECOGNIZED_WINDOWS)) {
      let elem = mc.e(windowId);
      if (elem && focusedWindow == elem.contentWindow)
        return windowId;
    }
  }

  // Focused window not recognized, let's try the focused element.
  // If an element is focused, it is necessary for the main window to be
  // focused.
  if (focusedWindow != mc.window)
    return null;

  let focusedElement = mc.window.document.commandDispatcher.focusedElement;
  let elementsToMatch = [mc.e(elem)
                         for each ([, elem] in Iterator(RECOGNIZED_ELEMENTS))];
  while (focusedElement && elementsToMatch.indexOf(focusedElement) == -1)
    focusedElement = focusedElement.parentNode;

  return focusedElement ? focusedElement.id : null;
}

function _assert_thing_focused(aThing) {
  let focusedThing = _get_currently_focused_thing();
  if (focusedThing != aThing)
    throw new Error("The currently focused thing should be " + aThing +
                    ", but is actually " + focusedThing);
}

/**
 * Assert that the folder tree is focused.
 */
function assert_folder_tree_focused() {
  _assert_thing_focused("folderTree");
}

/**
 * Assert that the thread tree is focused.
 */
function assert_thread_tree_focused() {
  _assert_thing_focused("threadTree");
}

/**
 * Assert that the (single) message pane is focused.
 */
function assert_message_pane_focused() {
  _assert_thing_focused("messagepane");
}

/**
 * Assert that the multimessage pane is focused.
 */
function assert_multimessage_pane_focused() {
  _assert_thing_focused("multimessage");
}


function _normalize_folder_view_index(aViewIndex, aController) {
  if (aController === undefined)
    aController = mc;
  if (aViewIndex < 0)
    return aController.folderTreeView.QueryInterface(Ci.nsITreeView).rowCount +
      aViewIndex;
  return aViewIndex;
}

/**
 * Helper function for use by assert_folders_selected /
 * assert_folders_selected_and_displayed / assert_folder_displayed.
 */
function _process_row_folder_arguments() {
  let troller = mc;
  // - normalize into desired selected view indices
  let desiredFolders = [];
  for (let iArg = 0; iArg < arguments.length; iArg++) {
    let arg = arguments[iArg];
    // An integer identifying a view index
    if (typeof(arg) == "number") {
      let folder = troller.folderTreeView.getFolderForIndex(
                       _normalize_folder_view_index(arg));
      if (!folder)
        throw new Error("Folder index not present in folder view: " + arg);
      desiredFolders.push(folder);
    }
    // A folder
    else if (arg instanceof Ci.nsIMsgFolder) {
      desiredFolders.push(arg);
    }
    // A list containing two integers, indicating a range of view indices.
    else if (arg.length == 2 && typeof(arg[0]) == "number") {
      let lowIndex = _normalize_folder_view_index(arg[0]);
      let highIndex = _normalize_folder_view_index(arg[1]);
      for (let viewIndex = lowIndex; viewIndex <= highIndex; viewIndex++)
        desiredFolders.push(troller.folderTreeView.getFolderForIndex(viewIndex));
    }
    // a List of folders
    else if (arg.length !== undefined) {
      for (let iFolder = 0; iFolder < arg.length; iFolder++) {
        let folder = arg[iFolder].QueryInterface(Ci.nsIMsgFolder);
        if (!folder)
          throw new Error(arg[iFolder] + " is not a folder!");
        desiredFolders.push(folder);
      }
    }
    // it's a MozmillController
    else if (arg.window) {
      troller = arg;
    }
    else {
      throw new Error("Illegal argument: " + arg);
    }
  }
  // we can't really sort, so you'll have to grin and bear it
  return [troller, desiredFolders];
}

/**
 * Asserts that the given set of folders is selected.  Unless you are dealing
 *  with transient selections resulting from right-clicks, you want to be using
 *  assert_folders_selected_and_displayed because it makes sure that the
 *  display is correct too.
 *
 * The arguments consist of one or more of the following:
 * - A MozmillController, indicating we should use that controller instead of
 *   the default, "mc" (corresponding to the 3pane.)  Pass this first!
 * - An integer identifying a view index.
 * - A list containing two integers, indicating a range of view indices.
 * - An nsIMsgFolder.
 * - A list of nsIMsgFolders.
 */
function assert_folders_selected() {
  let [troller, desiredFolders] =
    _process_row_folder_arguments.apply(this, arguments);

  // - get the actual selection (already sorted by integer value)
  let selectedFolders = troller.folderTreeView.getSelectedFolders();
  // - test selection equivalence
  // no shortcuts here. check if each folder in either array is present in the
  // other array
  if (desiredFolders.some(
      function (folder) _non_strict_index_of(selectedFolders, folder) == -1) ||
      selectedFolders.some(
      function (folder) _non_strict_index_of(desiredFolders, folder) == -1))
    throw new Error("Desired selection is: " +
                    _prettify_folder_array(desiredFolders) + " but actual " +
                    "selection is: " + _prettify_folder_array(selectedFolders));

  return [troller, desiredFolders];
}

let assert_folder_selected = assert_folders_selected;

/**
 * Assert that the given folder is displayed, but not necessarily selected.
 * Unless you are dealing with transient selection issues, you really should
 * be using assert_folders_selected_and_displayed.
 *
 * The arguments consist of one or more of the following:
 * - A MozmillController, indicating we should use that controller instead of
 *   the default, "mc" (corresponding to the 3pane.)  Pass this first!
 * - An integer identifying a view index.
 * - A list containing two integers, indicating a range of view indices.
 * - An nsIMsgFolder.
 * - A list of nsIMsgFolders.
 *
 * In each case, since we can only have one folder displayed, we only look at
 * the first folder you pass in.
 */
function assert_folder_displayed() {
  let [troller, desiredFolders] =
    _process_row_folder_arguments.apply(this, arguments);
  if (troller.folderDisplay.displayedFolder != desiredFolders[0])
    throw new Error("The displayed folder should be " +
        desiredFolders[0].prettiestName + ", but is actually " +
        troller.folderDisplay.displayedFolder.prettiestName);
}

/**
 * Asserts that the folders corresponding to the one or more folder spec
 * arguments are selected and displayed. If you specify multiple folders,
 * we verify that all of them are selected and that the first folder you pass
 * in is the one displayed. (If you don't pass in any folders, we can't assume
 * anything, so we don't test that case.)
 *
 * The arguments consist of one or more of the following:
 * - A MozmillController, indicating we should use that controller instead of
 *   the default, "mc" (corresponding to the 3pane.)  Pass this first!
 * - An integer identifying a view index.
 * - A list containing two integers, indicating a range of view indices.
 * - An nsIMsgFolder.
 * - A list of nsIMsgFolders.
 */
function assert_folders_selected_and_displayed() {
  let [troller, desiredFolders] = assert_folders_selected.apply(this,
                                                                arguments);
  if (desiredFolders.length > 0) {
      if (troller.folderDisplay.displayedFolder != desiredFolders[0])
        throw new Error("The displayed folder should be " +
            desiredFolders[0].prettiestName + ", but is actually " +
            troller.folderDisplay.displayedFolder.prettiestName);
  }
}

let assert_no_folders_selected = assert_folders_selected_and_displayed;
let assert_folder_selected_and_displayed =
    assert_folders_selected_and_displayed;

/**
 * Since indexOf does strict equality checking, we need this.
 */
function _non_strict_index_of(aArray, aSearchElement) {
  for ([i, item] in Iterator(aArray)) {
    if (item == aSearchElement)
      return i;
  }
  return -1;
}

function _prettify_folder_array(aArray) {
  return aArray.map(function (folder) folder.prettiestName).join(", ");
}

/**
 * Put the view in unthreaded mode.
 */
function make_display_unthreaded() {
  wait_for_message_display_completion();
  mc.folderDisplay.view.showUnthreaded = true;
  // drain event queue
  mc.sleep(0);
}

/**
 * Put the view in threaded mode.
 */
function make_display_threaded() {
  wait_for_message_display_completion();
  mc.folderDisplay.view.showThreaded = true;
  // drain event queue
  mc.sleep(0);
}

/**
 * Put the view in group-by-sort mode.
 */
function make_display_grouped() {
  wait_for_message_display_completion();
  mc.folderDisplay.view.showGroupedBySort = true;
  // drain event queue
  mc.sleep(0);
}

/**
 * Collapse all threads in the current view.
 */
function collapse_all_threads() {
  wait_for_message_display_completion();
  mc.folderDisplay.doCommand(Ci.nsMsgViewCommandType.collapseAll);
  // drain event queue
  mc.sleep(0);
}

/**
 * Expand all threads in the current view.
 */
function expand_all_threads() {
  wait_for_message_display_completion();
  mc.folderDisplay.doCommand(Ci.nsMsgViewCommandType.expandAll);
  // drain event queue
  mc.sleep(0);
}

/**
 * Set the mail.openMessageBehavior pref.
 *
 * @param aPref One of "NEW_WINDOW", "EXISTING_WINDOW" or "NEW_TAB"
 */
function set_open_message_behavior(aPref) {
  let prefBranch = Cc["@mozilla.org/preferences-service;1"]
                     .getService(Ci.nsIPrefService).getBranch(null);
  prefBranch.setIntPref("mail.openMessageBehavior",
                        MailConsts.OpenMessageBehavior[aPref]);
}

/**
 * Reset the mail.openMessageBehavior pref.
 */
function reset_open_message_behavior() {
  let prefBranch = Cc["@mozilla.org/preferences-service;1"]
                     .getService(Ci.nsIPrefService).getBranch(null);
  if (prefBranch.prefHasUserValue("mail.openMessageBehavior"))
    prefBranch.clearUserPref("mail.openMessageBehavior");
}

/**
 * Set the mail.tabs.loadInBackground pref.
 *
 * @param aPref true/false.
 */
function set_context_menu_background_tabs(aPref) {
  let prefBranch = Cc["@mozilla.org/preferences-service;1"]
                     .getService(Ci.nsIPrefService).getBranch(null);
  prefBranch.setBoolPref("mail.tabs.loadInBackground", aPref);
}

/**
 * Reset the mail.tabs.loadInBackground pref.
 */
function reset_context_menu_background_tabs() {
  let prefBranch = Cc["@mozilla.org/preferences-service;1"]
                     .getService(Ci.nsIPrefService).getBranch(null);
  if (prefBranch.prefHasUserValue("mail.tabs.loadInBackground"))
    prefBranch.clearUserPref("mail.tabs.loadInBackground");
}

/**
 * assert that the multimessage/thread summary view contains
 * the specified number of elements of the specified class.
 *
 * @param aClassName: the class to use to select
 * @param aNumElts: the number of expected elements that have that class
 */

function assert_summary_contains_N_divs(aClassName, aNumElts) {
  let htmlframe = mc.e('multimessage');
  let matches = htmlframe.contentDocument.getElementsByClassName(aClassName);
  if (matches.length != aNumElts)
    throw new Error("Expected to find " + aNumElts + " elements with class " +
                    aClassName + ", found: " + matches.length);
}


function throw_and_dump_view_state(aMessage, aController) {
  if (aController == null)
    aController = mc;

  dump("******** " + aMessage + "\n");
  viewWrapperTestUtils.dump_view_state(aController.folderDisplay.view);
  throw new Error(aMessage);
}

/** exported from viewWrapperTestUtils */
var make_new_sets_in_folders;
var make_new_sets_in_folder;
var add_sets_to_folders;

/**
 * Load a file in its own 'module'.
 *
 * @param aPath A path relative to the comm-central source path.
 *
 * @return An object that serves as the global scope for the loaded file.
 */
function load_via_src_path(aPath) {
  let srcPath = os.abspath("../../../..",os.getFileForPath( __file__));
  let fullPath = os.abspath(aPath, os.getFileForPath(srcPath));
  return frame.loadFile(fullPath, undefined);
}
