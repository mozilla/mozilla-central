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

/*
 * Tests:
 * - https://bugzilla.mozilla.org/show_bug.cgi?id=474701#c96 first para
 */
var MODULE_NAME = 'test-search-window';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers'];

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);
}

var folder, setFoo, setBar, setFooBar;

// Number of messages to open for multi-message tests
const NUM_MESSAGES_TO_OPEN = 5;

/**
 * Create some messages that our constraint below will satisfy
 */
function test_create_messages() {
  folder = create_folder("SearchWindowA");
  [setFoo, setBar, setFooBar] =
    make_new_sets_in_folder(folder, [{subject: "foo"}, {subject: "bar"},
                                     {subject: "foo bar"}]);
}

/**
 * The search window controller.
 */
var swc = null;

/**
 * Bring up the search window.
 */
function test_show_search_window() {
  // put us in the folder we care about so it defaults to that
  be_in_folder(folder);

  // push control-shift-F, wait for it to show
  plan_for_new_window("mailnews:search");
  mc.keypress(null, "f", {shiftKey: true, ctrlKey: true});
  swc = wait_for_new_window("mailnews:search");
}

/**
 * Set up the search.
 */
function test_enter_some_stuff() {
  // - turn off search subfolders
  // (we're not testing the UI, direct access is fine)
  swc.e("checkSearchSubFolders").removeAttribute("checked");

  // - put "foo" in the subject contains box
  // Each filter criterion is a listitem in the listbox with id=searchTermList.
  // Each filter criterion has id "searchRowN", and the textbox has id
  //  "searchValN" exposing the value on attribute "value".
  // XXX I am having real difficulty getting the click/type pair to actually
  //  get the text in there reliably.  I am just going to poke things directly
  //  into the text widget. (We used to use .aid instead of .a with swc.click
  //  and swc.type.)
  let searchVal0 = swc.a("searchVal0", {crazyDeck: 0});
  searchVal0.value = "foo";

  // - add another subject box
  let plusButton = swc.eid("searchRow0", {tagName: "button", label: "+"});
  swc.click(plusButton);

  // - put "bar" in it
  let searchVal1 = swc.a("searchVal1", {crazyDeck: 0});
  searchVal1.value = "bar";
}

/**
 * Trigger the search, make sure the right results show up.
 */
function test_go_search() {
  // - Trigger the search
  // The "Search" button has id "search-button"
  swc.click(swc.eid("search-button"));
  wait_for_all_messages_to_load(swc);

  // - Verify we got the right messages
  assert_messages_in_view(setFooBar, swc);

  // - Click the "Save as Search Folder" button, id "saveAsVFButton"
  // This will create a virtual folder properties dialog...
  // (label: "New Saved Search Folder", source: virtualFolderProperties.xul
  //  no windowtype, id: "virtualFolderPropertiesDialog")
  plan_for_modal_dialog("mailnews:virtualFolderProperties",
                        subtest_save_search);
  swc.click(swc.eid("saveAsVFButton"));
  wait_for_modal_dialog("mailnews:virtualFolderProperties");
}

/**
 * Test opening a single search result in a new tab.
 */
function test_open_single_search_result_in_tab() {
  swc.window.focus();
  set_open_message_behavior("NEW_TAB");
  let folderTab = mc.tabmail.currentTabInfo;
  let preCount = mc.tabmail.tabContainer.childNodes.length;

  // Select one message
  let msgHdr = select_click_row(1, swc);
  // Open the selected message
  open_selected_message(swc);
  // This is going to trigger a message display in the main 3pane window
  wait_for_message_display_completion(mc);
  // Check that the tab count has increased by 1
  assert_number_of_tabs_open(preCount + 1);
  // Check that the currently displayed tab is a message tab (i.e. our newly
  // opened tab is in the foreground)
  assert_tab_mode_name(null, "message");
  // Check that the message header displayed is the right one
  assert_selected_and_displayed(msgHdr);
  // Clean up, close the tab
  close_tab(mc.tabmail.currentTabInfo);
  switch_tab(folderTab);
  reset_open_message_behavior();
}

/**
 * Test opening multiple search results in new tabs.
 */
function test_open_multiple_search_results_in_new_tabs() {
  swc.window.focus();
  set_open_message_behavior("NEW_TAB");
  let folderTab = mc.tabmail.currentTabInfo;
  let preCount = mc.tabmail.tabContainer.childNodes.length;

  // Select a bunch of messages
  select_click_row(1, swc);
  let selectedMessages = select_shift_click_row(NUM_MESSAGES_TO_OPEN, swc);
  // Open them
  open_selected_messages(swc);
  // This is going to trigger a message display in the main 3pane window
  wait_for_message_display_completion(mc);
  // Check that the tab count has increased by the correct number
  assert_number_of_tabs_open(preCount + NUM_MESSAGES_TO_OPEN);
  // Check that the currently displayed tab is a message tab (i.e. one of our
  // newly opened tabs is in the foreground)
  assert_tab_mode_name(null, "message");

  // Now check whether each of the NUM_MESSAGES_TO_OPEN tabs has the correct
  // title
  for (let i = 0; i < NUM_MESSAGES_TO_OPEN; i++)
    assert_tab_titled_from(mc.tabmail.tabInfo[preCount + i],
                           selectedMessages[i]);

  // Check whether each tab has the correct message, then close it to load the
  // previous tab.
  for (let i = 0; i < NUM_MESSAGES_TO_OPEN; i++) {
    assert_selected_and_displayed(selectedMessages.pop());
    close_tab(mc.tabmail.currentTabInfo);
  }
  switch_tab(folderTab);
  reset_open_message_behavior();
}

/**
 * Test opening a search result in a new window.
 */
function test_open_search_result_in_new_window() {
  swc.window.focus();
  set_open_message_behavior("NEW_WINDOW");

  // Select a message
  let msgHdr = select_click_row(1, swc);

  plan_for_new_window("mail:messageWindow");
  // Open it
  open_selected_message(swc);
  let msgc = wait_for_new_window("mail:messageWindow");
  wait_for_message_display_completion(msgc, true);

  assert_selected_and_displayed(msgc, msgHdr);
  // Clean up, close the window
  close_message_window(msgc);
  reset_open_message_behavior();
}

/**
 * Test reusing an existing window to open another search result.
 */
function test_open_search_result_in_existing_window() {
  swc.window.focus();
  set_open_message_behavior("EXISTING_WINDOW");

  // Open up a window
  select_click_row(1, swc);
  plan_for_new_window("mail:messageWindow");
  open_selected_message(swc);
  let msgc = wait_for_new_window("mail:messageWindow");
  wait_for_message_display_completion(msgc, true);

  // Select another message and open it
  let msgHdr = select_click_row(2, swc);
  open_selected_message(swc);
  // We don't need to pass true here, as open_selected_message should have
  // started off the load before returning.
  wait_for_message_display_completion(msgc);

  // Check if our old window displays the message
  assert_selected_and_displayed(msgc, msgHdr);
  // Clean up, close the window
  close_message_window(msgc);
  reset_open_message_behavior();
}

/**
 * Save the search, making sure the constraints propagated.
 */
function subtest_save_search(savc) {
  // - make sure our constraint propagated
  // The query constraints are displayed using the same widgets (and code) that
  //  we used to enter them, so it's very similar to check.
  let searchVal0 = savc.aid("searchVal0", {crazyDeck: 0});
  savc.assertNode(searchVal0);
  savc.assertValue(searchVal0, "foo");
  let searchVal1 = savc.aid("searchVal1", {crazyDeck: 0});
  savc.assertNode(searchVal1);
  savc.assertValue(searchVal1, "bar");

  // - name the search
  // I am having no luck with click/type on XUL things. workaround it.
  savc.e("name").value = "SearchSaved";
  savc.window.doEnabling();

  // - save it!
  // this will close the dialog, which wait_for_modal_dialog is making sure
  //  happens.
  savc.window.onOK();
}

function test_close_search_window() {
  swc.window.focus();
  // now close the search window
  plan_for_window_close(swc);
  swc.keypress(null, "VK_ESCAPE", {});
  wait_for_window_close(swc);
  swc = null;
}

/**
 * Make sure the folder showed up with the right name, and that displaying it
 *  has the right contents.
 */
function test_verify_saved_search() {
  let savedFolder = folder.findSubFolder("SearchSaved");
  if (savedFolder == null)
    throw new Error("Saved folder did not show up.");

  be_in_folder(savedFolder);
  assert_messages_in_view(setFooBar);
}
