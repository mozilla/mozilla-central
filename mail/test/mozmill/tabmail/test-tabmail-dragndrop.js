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
 *   Thomas Schmid <schmid-thomas@gmx.net>
 * Portions created by the Initial Developer are Copyright (C) 2011
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

var elib = {};
Cu.import('resource://mozmill/modules/elementslib.js', elib);

/*
 * Test rearanging tabs via drag'n'drop.
 */

var MODULE_NAME = "test-tabmail-dragndrop";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["folder-display-helpers", "window-helpers",
                       'mouse-event-helpers'];


var folder;
let msgHdrsInFolder = [];

// The number of messages in folder.
const NUM_MESSAGES_IN_FOLDER = 15;

function setupModule(module) {
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);
  let wh = collector.getModule("window-helpers");
  wh.installInto(module);
  let meh = collector.getModule('mouse-event-helpers');
  meh.installInto(module);

  folder = create_folder("MessageFolder");
  make_new_sets_in_folder(folder, [{count: NUM_MESSAGES_IN_FOLDER}]);
}

/**
 * Verifies our test environment is setup correctly and initializes
 * all global variables.
 */
function test_tab_reorder_setup_globals() {

  be_in_folder(folder);
  // Scroll to the top
  mc.folderDisplay.ensureRowIsVisible(0);
  let msgHdr = mc.dbView.getMsgHdrAt(1);

  display_message_in_folder_tab(msgHdr, false);

  // Check that the right message is displayed
  assert_number_of_tabs_open(1);
  assert_folder_selected_and_displayed(folder);
  assert_selected_and_displayed(msgHdr);

  assert_row_visible(1);

  //Initialize the globals we'll need for all our tests.

  // Stash messages into arrays for convenience. We do it this way so that the
  // order of messages in the arrays is the same as in the views.
  be_in_folder(folder);
  for (let i = 0; i < NUM_MESSAGES_IN_FOLDER; i++)
    msgHdrsInFolder.push(mc.dbView.getMsgHdrAt(i));

  // Mark all messages read
  folder.markAllMessagesRead(null);
}

/**
 * Tests reordering tabs by drag'n'drop within the tabbar
 *
 * It opens aditional movable and closable tabs. The picks the first
 * movable tab and drops it onto the third movable tab.
 */
function test_tab_reorder_tabbar(){

  // Ensure only one tab is open, otherwise our test most likey fail anyway.
  mc.tabmail.closeOtherTabs(0);
  assert_number_of_tabs_open(1);

  be_in_folder(folder);

  // Open four tabs
  for (let idx=0; idx < 4 ; idx++) {
    select_click_row(idx);
    open_selected_message_in_new_tab(true);
  }

  // Check if every thing is correctly initalized
  assert_number_of_tabs_open(5);

  assert_true(mc.tabmail.tabModes["message"].tabs[0] == mc.tabmail.tabInfo[1],
      " tabMode.tabs and tabInfo out of sync");

  assert_true(mc.tabmail.tabModes["message"].tabs[1] == mc.tabmail.tabInfo[2],
      " tabMode.tabs and tabInfo out of sync");

  assert_true(mc.tabmail.tabModes["message"].tabs[2] == mc.tabmail.tabInfo[3],
      " tabMode.tabs and tabInfo out of sync");

  // Start dragging the first tab
  switch_tab(1);
  assert_selected_and_displayed(msgHdrsInFolder[0]);

  let tab1 = mc.tabmail.tabContainer.childNodes[1];
  let tab3 = mc.tabmail.tabContainer.childNodes[3];

  let dt = synthesize_drag_start(mc.window, tab1, mc.tabmail);

  // Drop it onto the third tab ...
  synthesize_drag_over(mc.window, tab3, dt);

  synthesize_drop(mc.window, tab3, dt,
      { screenX : tab3.boxObject.screenX + (tab3.boxObject.width * 0.75),
        screenY : tab3.boxObject.screenY });

  wait_for_message_display_completion(mc);

  // if every thing went well...
  assert_number_of_tabs_open(5);

  // ... we should find tab1 at the third position...
  assert_true(tab1 == mc.tabmail.tabContainer.childNodes[3],
              "Moving tab1 failed");
  switch_tab(3);
  assert_selected_and_displayed(msgHdrsInFolder[0]);

  // ... while tab3 moves one up and gets second.
  assert_true(tab3 == mc.tabmail.tabContainer.childNodes[2],
              "Moving tab3 failed");
  switch_tab(2);
  assert_selected_and_displayed(msgHdrsInFolder[2]);

  // we have one "message" tab and three "folder" tabs, thus tabInfo[1-3] and
  // tabMode["message"].tabs[0-2] have to be same, otherwise something went
  // wrong while moving tabs around
  assert_true(mc.tabmail.tabModes["message"].tabs[0] == mc.tabmail.tabInfo[1],
      " tabMode.tabs and tabInfo out of sync");

  assert_true(mc.tabmail.tabModes["message"].tabs[1] == mc.tabmail.tabInfo[2],
      " tabMode.tabs and tabInfo out of sync");

  assert_true(mc.tabmail.tabModes["message"].tabs[2] == mc.tabmail.tabInfo[3],
      " tabMode.tabs and tabInfo out of sync");
}

/**
 * Tests drag'n'drop tab reordering between windows
 */
function test_tab_reorder_window(){

  // Ensure only one tab is open, otherwise our test most likey fail anyway.
  mc.tabmail.closeOtherTabs(0);
  assert_number_of_tabs_open(1);

  let mc2 = null;

  be_in_folder(folder);

  // Open a new tab...
  select_click_row(1);
  open_selected_message_in_new_tab(false);

  assert_number_of_tabs_open(2);

  switch_tab(1);
  assert_selected_and_displayed(msgHdrsInFolder[1]);

  // ...and then a new 3 pane as our drop target.
  plan_for_new_window("mail:3pane");

  let ww = Cc["@mozilla.org/embedcomp/window-watcher;1"]
                        .getService(Ci.nsIWindowWatcher);

  let args = {msgHdr: msgHdrsInFolder[3]};
  args.wrappedJSObject = args;

  let aWnd2 = ww.openWindow(null,
        "chrome://messenger/content/", "",
        "all,chrome,dialog=no,status,toolbar", args);

  mc2 = wait_for_new_window("mail:3pane");
  wait_for_message_display_completion(mc2,true);

  // Double check if we are listening to the right window.
  assert_true(aWnd2 == mc2.window, "Opening Window failed" );

  // Start dragging the first tab ...
  let tabA = mc.tabmail.tabContainer.childNodes[1];
  assert_true(tabA, "No movable Tab");

  // We drop onto the Folder Tab, it is guaranteed to exist.
  let tabB = mc2.tabmail.tabContainer.childNodes[0];
  assert_true(tabB, "No movable Tab");

  let dt = synthesize_drag_start(mc.window,tabA,mc.tabmail);

  synthesize_drag_over(mc2.window, tabB,dt);

  synthesize_drop(mc2.window,tabB, dt,
      { screenX : tabB.boxObject.screenX + (tabB.boxObject.width * 0.75),
        screenY : tabB.boxObject.screenY });

  wait_for_message_display_completion(mc2);

  assert_true( !! (mc.tabmail.tabContainer.childNodes.length == 1),
    "Moving tab to new window failed, tab still in old window");

  assert_true( !! (mc2.tabmail.tabContainer.childNodes.length == 2),
    "Moving tab to new window failed, no new tab in new window");

  assert_selected_and_displayed(mc2,msgHdrsInFolder[1]);
}

/**
 * Tests detaching tabs into windows via drag'n'drop
 */
function test_tab_reorder_detach(){

  // Ensure only one tab is open, otherwise our test most likey fail anyway.
  mc.tabmail.closeOtherTabs(0);
  assert_number_of_tabs_open(1);

  let mc2 = null;

  be_in_folder(folder);

  // Open a new tab...
  select_click_row(2);
  open_selected_message_in_new_tab(false);

  assert_number_of_tabs_open(2);

  // ... if every thing works we should expect a new window...
  plan_for_new_window("mail:3pane");

  // ... now start dragging

  mc.tabmail.switchToTab(1);

  let tab1 = mc.tabmail.tabContainer.childNodes[1];
  let dropContent = mc.e("tabpanelcontainer");
  let box = dropContent.boxObject;

  let dt = synthesize_drag_start(mc.window, tab1, mc.tabmail);

  synthesize_drag_over(mc.window, dropContent, dt);

  // notify tab1 drag has ended
  synthesize_drag_end(mc.window, dropContent, tab1, dt,
      { screenX : (box.screenX + box.width / 2 ),
        screenY : (box.screenY + box.height / 2 ) });

  // ... and wait for the new window
  mc2 = wait_for_new_window("mail:3pane");
  wait_for_message_display_completion(mc2, true);

  assert_true(mc.tabmail.tabContainer.childNodes.length == 1,
      "Moving tab to new window failed, tab still in old window");

  assert_true(mc2.tabmail.tabContainer.childNodes.length == 2,
      "Moving tab to new window failed, no new tab in new window");

  assert_selected_and_displayed(mc2, msgHdrsInFolder[2]);

}

/**
 * Test undo of recently closed tabs.
 */
function test_tab_undo() {
  // Ensure only one tab is open, otherwise our test most likey fail anyway.
  mc.tabmail.closeOtherTabs(0);
  assert_number_of_tabs_open(1);

  be_in_folder(folder);

  // Open five tabs...
  for (let idx = 0; idx < 5; idx++) {
    select_click_row(idx);
    open_selected_message_in_new_tab(true);
  }

  assert_number_of_tabs_open(6);

  switch_tab(2);
  assert_selected_and_displayed(msgHdrsInFolder[1]);

  mc.tabmail.closeTab(2);
  // This tab should not be added to recently closed tabs...
  // ... thus it can't be restored
  mc.tabmail.closeTab(2, true);
  mc.tabmail.closeTab(2);

  assert_number_of_tabs_open(3);
  assert_selected_and_displayed(mc, msgHdrsInFolder[4]);

  mc.tabmail.undoCloseTab();
  assert_number_of_tabs_open(4);
  assert_selected_and_displayed(mc, msgHdrsInFolder[3]);

  // msgHdrsInFolder[2] won't be restorend it was closed with disabled undo.

  mc.tabmail.undoCloseTab();
  assert_number_of_tabs_open(5);
  assert_selected_and_displayed(mc, msgHdrsInFolder[1]);
}

function _synthesizeRecentlyClosedMenu()
{                  
  mc.rightClick(new elib.Elem(mc.tabmail.tabContainer.childNodes[1]));
  
  wait_for_popup_to_open(
    mc.window.document.getAnonymousElementByAttribute(
      mc.tabmail,"anonid","tabContextMenu"));
      
  let menu = mc.window.document.getAnonymousElementByAttribute(
                   mc.tabmail,"anonid","recentlyClosedTabs");      

  EventUtils.synthesizeMouse(menu,5, 5, {},mc.window);
  wait_for_popup_to_open(menu.menupopup);
  
  return menu;
}

function _teardownRecentlyClosedMenu()
{  
  let menu = mc.window.document.getAnonymousElementByAttribute(
            mc.tabmail,"anonid","tabContextMenu")  
  close_popup(mc,new elib.Elem(menu));
}

/**
 * Tests the recently closed tabs menu. 
 */
function test_tab_recentlyClosed() {

  // Ensure only one tab is open, otherwise our test most likey fail anyway.
  mc.tabmail.closeOtherTabs(0);
  assert_number_of_tabs_open(1);
  
  // We start with a clean tab history.
  mc.tabmail.recentlyClosedTabs = [];
        
  // The history is cleaned so let's open 15 tabs...
  be_in_folder(folder);    
                   
  for (let idx = 0; idx < 15; idx++) {
    select_click_row(idx);
    open_selected_message_in_new_tab(true);
  }

  assert_number_of_tabs_open(16);
    
  switch_tab(2);
  assert_selected_and_displayed(msgHdrsInFolder[1]);

  // ... and store the tab titles, to ensure they match with the menu items.
  let tabTitles = []
  for (let idx = 0; idx < 16; idx++)
    tabTitles.unshift(mc.tabmail.tabInfo[idx].title);

  // Start the test by closing all tabs except the first two tabs...
  for (let idx = 0; idx < 14; idx++)
    mc.tabmail.closeTab(2);
    
  assert_number_of_tabs_open(2);
    
  // ...then open the context menu.
  let menu = _synthesizeRecentlyClosedMenu();

  // Check if the context menu was populated correctly...
  assert_true(menu.itemCount == 12, "Failed to populate context menu");
  for (let idx=0; idx < 10; idx++)
    assert_true(tabTitles[idx] == menu.getItemAtIndex(idx).label, 
        "Tab Title does not match Menu item");
    
  // Restore the most recently closed tab
  EventUtils.synthesizeMouse(menu.getItemAtIndex(0),5, 5, {},mc.window);
  _teardownRecentlyClosedMenu();
  
  wait_for_message_display_completion(mc);
  assert_number_of_tabs_open(3);
  assert_selected_and_displayed(msgHdrsInFolder[14]);  

  // The context menu should now contain one item less.
  _synthesizeRecentlyClosedMenu();
      

  assert_true(menu.itemCount == 11, "Failed to populate context menu");
  for (let idx=0; idx < 9; idx++)
    assert_true(tabTitles[idx+1] == menu.getItemAtIndex(idx).label, 
        "Tab Title does not match Menu item");
        
  // Now we restore an "random" tab.  
  EventUtils.synthesizeMouse(menu.getItemAtIndex(5),5, 5, {},mc.window);
  _teardownRecentlyClosedMenu();
   
  wait_for_message_display_completion(mc);
  assert_number_of_tabs_open(4);    
  assert_selected_and_displayed(msgHdrsInFolder[8]);
        
  // finally restore all tabs 
  _synthesizeRecentlyClosedMenu();
  
  assert_true(menu.itemCount == 10, 
      "Failed to populate context menu");
  assert_true(tabTitles[1] == menu.getItemAtIndex(0).label,
      "Tab Title does not match Menu item");
  assert_true(tabTitles[7] == menu.getItemAtIndex(5).label,
      "Tab Title does not match Menu item");
    
  EventUtils.synthesizeMouse(menu.getItemAtIndex(menu.itemCount-1),5, 5, {},mc.window);
  _teardownRecentlyClosedMenu();
  
  wait_for_message_display_completion(mc);
    
  // out of the 16 tab, we closed all except two. As the history can store 
  // only 10 items we have to endup with exactly 10 + 2 tabs.
  assert_number_of_tabs_open(12);    
}

function teardownTest(test)
{
  
  switch(test)
  {    
    case test_tab_reorder_detach :
    case test_tab_reorder_window :
      // Some test cases open new windows, thus we need to ensure all 
      // opened windows get closed.

      let en = Cc["@mozilla.org/appshell/window-mediator;1"]
                 .getService(Ci.nsIWindowMediator)
                 .getEnumerator("mail:3pane");
       
       while(en.hasMoreElements()) {
        
         var win = en.getNext();
         
         if(win != mc.window)
           close_window(new mozmill.controller.MozMillController(win));
       }
       
       // fall through!

    case test_tab_reorder_tabbar :
        
    case test_tab_recentlyClosed :
    case test_tab_undo :
    
      // clean up the tabbbar 
      mc.tabmail.closeOtherTabs(0);
      assert_number_of_tabs_open(1);
  }

}
