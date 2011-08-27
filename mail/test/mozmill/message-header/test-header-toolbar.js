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
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Blake Winton <bwinton@latte.ca>
 *   Dan Mosedale <dmose@mozillamessaging.com>
 *   Joachim Herb <Joachim.Herb@gmx.de>
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
 * Test that we can add a tag to a message without messing up the header.
 */
var MODULE_NAME = 'test-header-toolbar';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers',
                       'address-book-helpers', 'mouse-event-helpers'];

var elib = {};
Cu.import('resource://mozmill/modules/elementslib.js', elib);
var controller = {};
Cu.import('resource://mozmill/modules/controller.js', controller);
Cu.import("resource://gre/modules/Services.jsm");

var folder;

const USE_SHEET_PREF = "toolbar.customization.usesheet";

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);
  let abh = collector.getModule('address-book-helpers');
  abh.installInto(module);
  let meh = collector.getModule('mouse-event-helpers');
  meh.installInto(module);

  folder = create_folder("HeaderToolbar");

  // create a message that has the interesting headers that commonly
  // show up in the message header pane for testing
  let msg = create_message({cc: msgGen.makeNamesAndAddresses(20),
                            subject: "This is a really, really, really, really, really, really, really, really, long subject.",
                            clobberHeaders: {
                              "Newsgroups": "alt.test",
                              "Reply-To": "J. Doe <j.doe@momo.invalid>",
                              "Content-Base": "http://example.com/",
                              "Bcc": "Richard Roe <richard.roe@momo.invalid>"
                            }});

  add_message_to_folder(folder, msg);

  // create a message that has boring headers to be able to switch to and
  // back from, to force the more button to collapse again.
  msg = create_message();
  add_message_to_folder(folder, msg);
}


/**
 *  Make sure that opening the header toolbar customization dialog
 *  does not break the get messages button in main toolbar
 */
function test_get_msg_button_customize_header_toolbar()
{
  select_message_in_folder(0);

  // It is necessary to open the Get Message button's menu to get the popup menu
  // populated
  mc.click(mc.aid("button-getmsg", {class: "toolbarbutton-menubutton-dropmarker"}));
  mc.ewait("button-getAllNewMsgSeparator");

  let getMailButtonPopup = mc.eid("button-getMsgPopup").node;
  let originalServerCount = getMailButtonPopup.childElementCount;

  // Open customization dialog, because it broke the Get Message Button popup menu
  // see https://bugzilla.mozilla.org/show_bug.cgi?id=565045
  let ctc = open_header_pane_toolbar_customization(mc);
  close_header_pane_toolbar_customization(ctc);

  // Press the Get Message Button to populate popup menu again
  mc.click(mc.aid("button-getmsg", {class: "toolbarbutton-menubutton-dropmarker"}));
  mc.ewait("button-getAllNewMsgSeparator");

  getMailButtonPopup = mc.eid("button-getMsgPopup").node;
  let finalServerCount = getMailButtonPopup.childElementCount;

  assert_equals(finalServerCount, originalServerCount,
                "number of entries in Get Message Button popup menu after " +
                "header toolbar customization not equal as before");
}

/**
 *  Test header pane toolbar customization: Check for default button sets
 */
function test_customize_header_toolbar_check_default()
{
  let curMessage = select_message_in_folder(0);

  let hdrToolbar = mc.eid("header-view-toolbar").node;
  let hdrBarDefaultSet = hdrToolbar.getAttribute("defaultset");
  assert_equals(hdrToolbar.currentSet, hdrBarDefaultSet);
  // In a fresh profile the currentset attribute does not
  // exist, i.e. it returns empty. So check for both valid
  // posiblities.
  assert_true((hdrToolbar.getAttribute("currentset") == "") ||
    (hdrToolbar.getAttribute("currentset") == hdrBarDefaultSet),
    "Header Toolbar currentset should be empty or contain default buttons "+
    "but contains: " + hdrToolbar.getAttribute("currentset"));
  // Now make sure, that also the attribute gets set:
  restore_and_check_default_buttons(mc);

  // Display message in new window and check that the default
  // buttons are shown there.
  let msgc = open_selected_message_in_new_window();
  assert_selected_and_displayed(msgc, curMessage);
  hdrToolbar = msgc.eid("header-view-toolbar").node;
  hdrBarDefaultSet = hdrToolbar.getAttribute("defaultset");
  assert_equals(hdrToolbar.currentSet, hdrBarDefaultSet);
  // In a fresh profile the currentset attribute does not
  // exist, i.e. it returns empty. So check for both valid
  // posiblities.
  assert_true((hdrToolbar.getAttribute("currentset") == "") ||
    (hdrToolbar.getAttribute("currentset") == hdrBarDefaultSet),
    "Header Toolbar currentset should be empty or contain default buttons "+
    "but contains: " + hdrToolbar.getAttribute("currentset"));
  // Now make sure, that also the attribute gets set:
  restore_and_check_default_buttons(msgc);

  close_window(msgc);
}

/**
 *  Test header pane toolbar customization: Reorder buttons
 */
function test_customize_header_toolbar_reorder_buttons()
{
  let curMessage = select_message_in_folder(0);

  // Restore the default buttons to get defined starting conditions.
  restore_and_check_default_buttons(mc);

  // Save the currentSet of the toolbar before opening the
  // customization dialog, to get out of the way of the
  // wrapper- prefix.
  let toolbar = mc.eid("header-view-toolbar").node;
  let oldSet = toolbar.currentSet.split(",");

  let ctc = open_header_pane_toolbar_customization(mc);
  let currentSet = toolbar.currentSet.split(",");

  for (let i = 1; i < currentSet.length; i++) {
    let button1 = mc.e(currentSet[i]);
    let button2 = mc.e(currentSet[i - 1]);
    // Move each button to the left of the button which was placed left of it
    // at the beginning of the test starting with the second button. This
    // places the buttons in the reverse order as at the beginning of the test.
    drag_n_drop_element(button1, mc.window, button2, mc.window, 0.25, 0.0, toolbar);
  }
  close_header_pane_toolbar_customization(ctc);

  // Check, if the toolbar is really in reverse order of beginning.
  let reverseSet = oldSet.reverse().join(",");
  assert_equals(toolbar.currentSet, reverseSet);
  assert_equals(toolbar.getAttribute("currentset"), reverseSet);

  // Display message in new window and check that the default
  // buttons are shown there.
  let msgc = open_selected_message_in_new_window();
  assert_selected_and_displayed(msgc, curMessage);
  let hdrToolbar = msgc.eid("header-view-toolbar").node;
  let hdrBarDefaultSet = hdrToolbar.getAttribute("defaultset");
  assert_equals(hdrToolbar.currentSet, hdrBarDefaultSet);
  assert_equals(hdrToolbar.getAttribute("currentset"), hdrBarDefaultSet);
  close_window(msgc);

  // Leave the toolbar in the default state.
  restore_and_check_default_buttons(mc);
}

/**
 *  Test header pane toolbar customization: Change buttons in
 *  separate mail window
 */
function test_customize_header_toolbar_separate_window()
{
  let curMessage = select_message_in_folder(0);

  // Restore the default buttons to get defined starting conditions.
  restore_and_check_default_buttons(mc);

  // Display message in new window and check that the default
  // buttons are shown there.
  let msgc = open_selected_message_in_new_window();
  assert_selected_and_displayed(msgc, curMessage);
  let hdrToolbar = msgc.eid("header-view-toolbar").node;
  let hdrBarDefaultSet = hdrToolbar.getAttribute("defaultset");
  assert_equals(hdrToolbar.currentSet, hdrBarDefaultSet);
  assert_equals(hdrToolbar.getAttribute("currentset"), hdrBarDefaultSet);

  // Save the currentSet of the toolbar before opening the
  // customization dialog, to get out of the way of the
  // wrapper- prefix.
  let toolbar = msgc.eid("header-view-toolbar").node;
  let oldSet = toolbar.currentSet.split(",");

  let ctc = open_header_pane_toolbar_customization(msgc);
  let currentSet = toolbar.currentSet.split(",");
  for (let i = 1; i < currentSet.length; i++) {
    let button1 = msgc.e(currentSet[i]);
    let button2 = msgc.e(currentSet[i - 1]);
    // Move each button to the left of the button which was placed left of it
    // at the beginning of the test starting with the second button. This
    // places the buttons in the reverse order as at the beginning of the test.
    drag_n_drop_element(button1, msgc.window, button2, msgc.window, 0.25, 0.0, toolbar);
  }
  close_header_pane_toolbar_customization(ctc);

  // Check, if the toolbar is really in reverse order of beginning.
  let reverseSet = oldSet.reverse().join(",");
  assert_equals(toolbar.currentSet, reverseSet);
  assert_equals(toolbar.getAttribute("currentset"), reverseSet);

  // Make sure we have a different window open, so that we don't start shutting
  // down just because the last window was closed
  let abwc = openAddressBook();
  // The 3pane window is closed and opened again.
  close_window(mc);
  close_window(msgc);

  mc = open3PaneWindow();
  abwc.window.close();
  select_message_in_folder(0);

  // Check, if the buttons in the mail3pane window are the correct ones.
  hdrToolbar = mc.eid("header-view-toolbar").node;
  hdrBarDefaultSet = hdrToolbar.getAttribute("defaultset");
  assert_equals(hdrToolbar.currentSet, hdrBarDefaultSet);
  assert_equals(hdrToolbar.getAttribute("currentset"), hdrBarDefaultSet);

  // Open separate mail window again and check another time.
  msgc = open_selected_message_in_new_window();
  assert_selected_and_displayed(msgc, curMessage);
  toolbar = msgc.eid("header-view-toolbar").node;
  assert_equals(toolbar.currentSet, reverseSet);
  assert_equals(toolbar.getAttribute("currentset"), reverseSet);

  // Leave the toolbar in the default state.
  restore_and_check_default_buttons(msgc);
  close_window(msgc);
}

/**
 *  Test header pane toolbar customization: Remove buttons
 */
function test_customize_header_toolbar_remove_buttons()
{
  // Save currentset of toolbar for adding the buttons back
  // at the end.
  let lCurrentset;

  select_message_in_folder(0);

  // Restore the default buttons to get defined starting conditions.
  restore_and_check_default_buttons(mc);

  let ctc = open_header_pane_toolbar_customization(mc);
  let toolbar = mc.eid("header-view-toolbar").node;
  lCurrentset = toolbar.currentSet.split(",");
  let target = ctc.e("palette-box");
  for (let i = 0; i < lCurrentset.length; i++) {
    let button = mc.e(lCurrentset[i]);
    drag_n_drop_element(button, mc.window, target, ctc.window, 0.5, 0.5, toolbar);
  }
  close_header_pane_toolbar_customization(ctc);

  // Check, if the toolbar is really empty.
  toolbar = mc.eid("header-view-toolbar").node;
  assert_equals(toolbar.currentSet, "__empty");
  assert_equals(toolbar.getAttribute("currentset"), "__empty");

  // Move to the next message and Check again.
  let curMessage = select_message_in_folder(1);
  assert_equals(toolbar.currentSet, "__empty");
  assert_equals(toolbar.getAttribute("currentset"), "__empty");

  // Display message in new window and check that the default
  // buttons are shown there.
  let msgc = open_selected_message_in_new_window();
  assert_selected_and_displayed(msgc, curMessage);
  let hdrToolbar = msgc.eid("header-view-toolbar").node;
  let hdrBarDefaultSet = hdrToolbar.getAttribute("defaultset");
  assert_equals(hdrToolbar.currentSet, hdrBarDefaultSet);
  assert_equals(hdrToolbar.getAttribute("currentset"), hdrBarDefaultSet);
  close_window(msgc);

  // Check button persistance

  // Make sure we have a different window open, so that we don't start shutting
  // down just because the last window was closed
  let abwc = openAddressBook();
  // The 3pane window is closed.
  close_window(mc);
  mc = open3PaneWindow();
  abwc.window.close();
  select_message_in_folder(0);

  toolbar = mc.eid("header-view-toolbar").node;
  assert_equals(toolbar.currentSet, "__empty");
  assert_equals(toolbar.getAttribute("currentset"), "__empty");

  // Check that all removed buttons show up in the palette
  // and move it back in the toolbar.
  ctc = open_header_pane_toolbar_customization(mc);
  toolbar = mc.eid("header-view-toolbar").node;
  let palette = ctc.e("palette-box");
  for (let i = 0; i < lCurrentset.length; i++) {
    let button = ctc.e(lCurrentset[i]);
    assert_true(button!=null, "Button " + lCurrentset[i] + " not in palette");
    // Drop each button to the right end of the toolbar, so we should get the
    // original order.
    drag_n_drop_element(button, ctc.window, toolbar, mc.window, 0.99, 0.5, palette);
  }
  close_header_pane_toolbar_customization(ctc);

  toolbar = mc.eid("header-view-toolbar").node;
  assert_equals(toolbar.currentSet, hdrBarDefaultSet);
  assert_equals(toolbar.getAttribute("currentset"), hdrBarDefaultSet);
}

/**
 *  Test header pane toolbar customization dialog layout
 */
function test_customize_header_toolbar_dialog_style()
{
  select_message_in_folder(0);

  // Restore the default buttons to get defined starting conditions.
  restore_and_check_default_buttons(mc);

  let ctc = open_header_pane_toolbar_customization(mc);

  // The full mode menulist entry is hidden, because in the header toolbar
  // this mode is disabled.
  let fullMode = ctc.window.document.getElementById("main-box").
    querySelector("[value*='full']");
  assert_equals(ctc.window.getComputedStyle(fullMode).getPropertyValue("display"), "none");
  // The text besides icon menulist entry is selected, because in the header toolbar
  // this is the default mode.
  let textIconMode = ctc.eid("textbesideiconItem").node;
  assert_equals(textIconMode.getAttribute("selected"), "true");

  // The small icons checkbox is hidden, because in the header toolbar
  // this mode is the only possible (therefore, the checked attribute is true).
  let smallIcons = ctc.eid("smallicons").node;
  assert_equals(smallIcons.getAttribute("checked"), "true");
  assert_equals(ctc.window.getComputedStyle(smallIcons).getPropertyValue("display"), "none");

  // The add new toolbar button is hidden, because in the header toolbar
  // this functionality is not available.
  let addNewToolbar = ctc.window.document.getElementById("main-box").
    querySelector("[oncommand*='addNewToolbar();']");
  assert_equals(ctc.window.getComputedStyle(addNewToolbar).getPropertyValue("display"), "none");

  close_header_pane_toolbar_customization(ctc);
}

/**
 *  Test header pane toolbar customization dialog for button style changes
 */
function test_customize_header_toolbar_change_button_style()
{
  select_message_in_folder(0);

  // Restore the default buttons to get defined starting conditions.
  restore_and_check_default_buttons(mc);
  // The default mode is label and icon visible.
  subtest_buttons_style("-moz-box", "-moz-box");

  // Change the button style to icon (only) mode
  let ctc = open_header_pane_toolbar_customization(mc);
  let iconMode = ctc.window.document.getElementById("main-box").
    querySelector("[value*='icons']");
  ctc.click(new elib.Elem(iconMode));
  close_header_pane_toolbar_customization(ctc);

  subtest_buttons_style("-moz-box", "none");

  // Change the button style to text (only) mode
  ctc = open_header_pane_toolbar_customization(mc);
  let textMode = ctc.window.document.getElementById("main-box").
    querySelector("[value*='text']");
  ctc.click(new elib.Elem(textMode));
  close_header_pane_toolbar_customization(ctc);

  subtest_buttons_style("none", "-moz-box");

  // The default mode is label and icon visible.
  restore_and_check_default_buttons(mc);
  subtest_buttons_style("-moz-box", "-moz-box");
}

/**
 * Select message in current (global) folder.
 */
function select_message_in_folder(aMessageNum)
{
  be_in_folder(folder);

  // select and open the first message
  let curMessage = select_click_row(aMessageNum);

  // make sure it loads
  wait_for_message_display_completion(mc);
  assert_selected_and_displayed(mc, curMessage);

  return curMessage;
}

/**
 *  Check all buttons in the toolbar for the correct style
 *  of text and icon.
 */
function subtest_buttons_style(aIconVisibility, aLabelVisibility)
{
  let toolbar = mc.eid("header-view-toolbar").node;
  let currentSet = toolbar.currentSet.split(",");

  for (let i = 0; i < currentSet.length; i++) {
    // XXX For the moment only consider normal toolbar buttons.
    // XXX Handling of toolbaritem buttons has to be added later,
    // XXX especially the smart reply button!
    if (mc.eid(currentSet[i]).node.tagName == "toolbarbutton") {
      let icon = mc.aid(currentSet[i], {class: "toolbarbutton-icon"}).node;
      let label = mc.aid(currentSet[i], {class: "toolbarbutton-text"}).node;
      assert_equals(mc.window.getComputedStyle(icon).getPropertyValue("display"), aIconVisibility);
      assert_equals(mc.window.getComputedStyle(label).getPropertyValue("display"), aLabelVisibility);
    }
  }
}

/**
 *  Restore the default buttons in the header pane toolbar
 *  by clicking the corresponding button in the palette dialog
 *  and check if it worked.
 */
function restore_and_check_default_buttons(aController)
{
  let ctc = open_header_pane_toolbar_customization(aController);
  let restoreButton = ctc.window.document.getElementById("main-box").
    querySelector("[oncommand*='overlayRestoreDefaultSet();']");
  ctc.click(new elib.Elem(restoreButton));
  close_header_pane_toolbar_customization(ctc);

  let hdrToolbar = aController.eid("header-view-toolbar").node;
  let hdrBarDefaultSet = hdrToolbar.getAttribute("defaultset");

  assert_equals(hdrToolbar.currentSet, hdrBarDefaultSet);
  assert_equals(hdrToolbar.getAttribute("currentset"), hdrBarDefaultSet);
}

/*
 * Open the header pane toolbar customization dialog.
 */
function open_header_pane_toolbar_customization(aController)
{
  let ctc;
  aController.click(aController.eid("CustomizeHeaderToolbar"));
  // Depending on preferences the customization dialog is
  // either a normal window or embedded into a sheet.
  if (Services.prefs.getBoolPref(USE_SHEET_PREF, true)) {
    // XXX Sleep so the dialog has a chance to load. It seems that
    // ewait("donebutton") does not work after the update to mozmill 1.5.4b4.
    controller.sleep(1000);
    let contentWindow = aController.eid("customizeToolbarSheetIFrame").node.contentWindow;
    // This is taken from test-migration-helpers.js#128:
    // XXX this is not my fault, but I'm not going to fix it. Just make it less
    // broken:
    // Lie to mozmill to convince it to not explode because these frames never
    // get a mozmillDocumentLoaded attribute.
    contentWindow.mozmillDocumentLoaded = true;
    ctc = augment_controller(new controller.MozMillController(contentWindow));
  }
  else {
    ctc = wait_for_existing_window("CustomizeToolbarWindow");
  }
  return ctc;
}

/*
 * Close the header pane toolbar customization dialog.
 */
function close_header_pane_toolbar_customization(aCtc)
{
  aCtc.click(aCtc.eid("donebutton"));
  // XXX There should be an equivalent for testing the closure of
  // XXX the dialog embedded in a sheet, but I do not know how.
  if (!Services.prefs.getBoolPref(USE_SHEET_PREF, true)) {
    assert_true(aCtc.window.closed, "The customization dialog is not closed.");
  }
}

/**
 *  Helper functions to open an extra window, so that the 3pane
 *  window can be closed and opend again for persistancy checks.
 *  They are copied from the test-session-store.js.
 */
function open3PaneWindow()
{
  plan_for_new_window("mail:3pane");
  Services.ww.openWindow(null,
                         "chrome://messenger/content/messenger.xul", "",
                         "all,chrome,dialog=no,status,toolbar",
                         null);
  return wait_for_new_window("mail:3pane");
}

function openAddressBook()
{
  plan_for_new_window("mail:addressbook");
  Services.ww.openWindow(null,
                         "chrome://messenger/content/addressbook/addressbook.xul",
                         "", "all,chrome,dialog=no,status,toolbar",
                         null);
  return wait_for_new_window("mail:addressbook");
}
