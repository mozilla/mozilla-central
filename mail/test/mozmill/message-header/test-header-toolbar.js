/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Test that we can add a tag to a message without messing up the header.
 */
var MODULE_NAME = 'test-header-toolbar';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers',
                       'address-book-helpers', 'mouse-event-helpers',
                       'customization-helpers'];

var elib = {};
Cu.import('resource://mozmill/modules/elementslib.js', elib);
Cu.import("resource://gre/modules/Services.jsm");

var folder;
var gCDHelper ;
var originalPaneLayout;
const kPaneLayout = "mail.pane_config.dynamic";

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);
  let abh = collector.getModule('address-book-helpers');
  abh.installInto(module);
  let meh = collector.getModule('mouse-event-helpers');
  meh.installInto(module);
  let cu = collector.getModule('customization-helpers');
  cu.installInto(module);
  gCDHelper = new CustomizeDialogHelper('header-view-toolbar',
    'CustomizeHeaderToolbar', "mailnews:customizeToolbar");

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

function setWideView() {
  originalPaneLayout = Services.prefs.getIntPref(kPaneLayout);
  Services.prefs.setIntPref(kPaneLayout, 1);
}

function restoreOriginalPaneLayout() {
  Services.prefs.setIntPref(kPaneLayout, originalPaneLayout);
}

function teardownModule(module) {
  restoreOriginalPaneLayout();
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

  let getMailButtonPopup = mc.e("button-getMsgPopup");
  let originalServerCount = getMailButtonPopup.childElementCount;

  // Open customization dialog, because it broke the Get Message Button popup menu
  // see https://bugzilla.mozilla.org/show_bug.cgi?id=565045
  let ctc = gCDHelper.open(mc);
  gCDHelper.close(ctc);

  // Press the Get Message Button to populate popup menu again
  mc.click(mc.aid("button-getmsg", {class: "toolbarbutton-menubutton-dropmarker"}));
  mc.ewait("button-getAllNewMsgSeparator");

  getMailButtonPopup = mc.e("button-getMsgPopup");
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

  let hdrToolbar = mc.e("header-view-toolbar");
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
  gCDHelper.restoreDefaultButtons(mc);

  // Display message in new window and check that the default
  // buttons are shown there.
  let msgc = open_selected_message_in_new_window();
  assert_selected_and_displayed(msgc, curMessage);
  hdrToolbar = msgc.e("header-view-toolbar");
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
  gCDHelper.restoreDefaultButtons(msgc);

  close_window(msgc);
}

/**
 *  Test header pane toolbar customization: Reorder buttons
 */
function test_customize_header_toolbar_reorder_buttons()
{
  // To avoid undrawn buttons on the toolbar, change pane layout to wide view.
  setWideView();

  let curMessage = select_message_in_folder(0);

  // Restore the default buttons to get defined starting conditions.
  gCDHelper.restoreDefaultButtons(mc);

  // Save the currentSet of the toolbar before opening the
  // customization dialog, to get out of the way of the
  // wrapper- prefix.
  let toolbar = mc.e("header-view-toolbar");
  let oldSet = toolbar.currentSet.split(",");

  let ctc = gCDHelper.open(mc);
  let currentSet = toolbar.currentSet.split(",");

  for (let i = 1; i < currentSet.length; i++) {
    let button1 = mc.e(currentSet[i]);
    let button2 = mc.e(currentSet[i - 1]);
    // Move each button to the left of the button which was placed left of it
    // at the beginning of the test starting with the second button. This
    // places the buttons in the reverse order as at the beginning of the test.
    drag_n_drop_element(button1, mc.window, button2, mc.window, 0.25, 0.0, toolbar);
  }
  gCDHelper.close(ctc);

  // Check, if the toolbar is really in reverse order of beginning.
  let reverseSet = oldSet.reverse().join(",");
  assert_equals(toolbar.currentSet, reverseSet);
  assert_equals(toolbar.getAttribute("currentset"), reverseSet);

  // Display message in new window and check that the default
  // buttons are shown there.
  let msgc = open_selected_message_in_new_window();
  assert_selected_and_displayed(msgc, curMessage);
  let hdrToolbar = msgc.e("header-view-toolbar");
  let hdrBarDefaultSet = hdrToolbar.getAttribute("defaultset");
  assert_equals(hdrToolbar.currentSet, hdrBarDefaultSet);
  assert_equals(hdrToolbar.getAttribute("currentset"), hdrBarDefaultSet);
  close_window(msgc);

  restoreOriginalPaneLayout();

  // Leave the toolbar in the default state.
  gCDHelper.restoreDefaultButtons(mc);
}

/**
 *  Test header pane toolbar customization: Change buttons in
 *  separate mail window
 */
function test_customize_header_toolbar_separate_window()
{
  let curMessage = select_message_in_folder(0);

  // Restore the default buttons to get defined starting conditions.
  gCDHelper.restoreDefaultButtons(mc);

  // Display message in new window and check that the default
  // buttons are shown there.
  let msgc = open_selected_message_in_new_window();
  assert_selected_and_displayed(msgc, curMessage);
  let hdrToolbar = msgc.e("header-view-toolbar");
  let hdrBarDefaultSet = hdrToolbar.getAttribute("defaultset");
  assert_equals(hdrToolbar.currentSet, hdrBarDefaultSet);
  assert_equals(hdrToolbar.getAttribute("currentset"), hdrBarDefaultSet);

  // Save the currentSet of the toolbar before opening the
  // customization dialog, to get out of the way of the
  // wrapper- prefix.
  let toolbar = msgc.e("header-view-toolbar");
  let oldSet = toolbar.currentSet.split(",");

  let ctc = gCDHelper.open(msgc);
  let currentSet = toolbar.currentSet.split(",");
  for (let i = 1; i < currentSet.length; i++) {
    let button1 = msgc.e(currentSet[i]);
    let button2 = msgc.e(currentSet[i - 1]);
    // Move each button to the left of the button which was placed left of it
    // at the beginning of the test starting with the second button. This
    // places the buttons in the reverse order as at the beginning of the test.
    drag_n_drop_element(button1, msgc.window, button2, msgc.window, 0.25, 0.0, toolbar);
  }
  gCDHelper.close(ctc);

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
  hdrToolbar = mc.e("header-view-toolbar");
  hdrBarDefaultSet = hdrToolbar.getAttribute("defaultset");
  assert_equals(hdrToolbar.currentSet, hdrBarDefaultSet);
  assert_equals(hdrToolbar.getAttribute("currentset"), hdrBarDefaultSet);

  // Open separate mail window again and check another time.
  msgc = open_selected_message_in_new_window();
  assert_selected_and_displayed(msgc, curMessage);
  toolbar = msgc.e("header-view-toolbar");
  assert_equals(toolbar.currentSet, reverseSet);
  assert_equals(toolbar.getAttribute("currentset"), reverseSet);

  // Leave the toolbar in the default state.
  gCDHelper.restoreDefaultButtons(msgc);
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
  gCDHelper.restoreDefaultButtons(mc);

  let ctc = gCDHelper.open(mc);
  let toolbar = mc.e("header-view-toolbar");
  lCurrentset = toolbar.currentSet.split(",");
  let target = ctc.e("palette-box");
  for (let i = 0; i < lCurrentset.length; i++) {
    let button = mc.e(lCurrentset[i]);
    drag_n_drop_element(button, mc.window, target, ctc.window, 0.5, 0.5, toolbar);
  }
  gCDHelper.close(ctc);

  // Check, if the toolbar is really empty.
  toolbar = mc.e("header-view-toolbar");
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
  let hdrToolbar = msgc.e("header-view-toolbar");
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

  toolbar = mc.e("header-view-toolbar");
  assert_equals(toolbar.currentSet, "__empty");
  assert_equals(toolbar.getAttribute("currentset"), "__empty");

  // Check that all removed buttons show up in the palette
  // and move it back in the toolbar.
  ctc = gCDHelper.open(mc);
  toolbar = mc.e("header-view-toolbar");
  let palette = ctc.e("palette-box");
  for (let i = 0; i < lCurrentset.length; i++) {
    let button = ctc.e(lCurrentset[i]);
    assert_true(button!=null, "Button " + lCurrentset[i] + " not in palette");
    // Drop each button to the right end of the toolbar, so we should get the
    // original order.
    drag_n_drop_element(button, ctc.window, toolbar, mc.window, 0.99, 0.5, palette);
  }
  gCDHelper.close(ctc);

  toolbar = mc.e("header-view-toolbar");
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
  gCDHelper.restoreDefaultButtons(mc);

  let ctc = gCDHelper.open(mc);

  // The full mode menulist entry is hidden, because in the header toolbar
  // this mode is disabled.
  let fullMode = ctc.window.document.getElementById("main-box").
    querySelector("[value*='full']");
  assert_equals(ctc.window.getComputedStyle(fullMode).getPropertyValue("display"), "none");
  // The text besides icon menulist entry is selected, because in the header toolbar
  // this is the default mode.
  let textIconMode = ctc.e("textbesideiconItem");
  assert_equals(textIconMode.getAttribute("selected"), "true");

  // The small icons checkbox is hidden, because in the header toolbar
  // this mode is the only possible (therefore, the checked attribute is true).
  let smallIcons = ctc.e("smallicons");
  assert_equals(smallIcons.getAttribute("checked"), "true");
  assert_equals(ctc.window.getComputedStyle(smallIcons).getPropertyValue("display"), "none");

  // The add new toolbar button is hidden, because in the header toolbar
  // this functionality is not available.
  let addNewToolbar = ctc.window.document.getElementById("main-box").
    querySelector("[oncommand*='addNewToolbar();']");
  assert_equals(ctc.window.getComputedStyle(addNewToolbar).getPropertyValue("display"), "none");

  gCDHelper.close(ctc);
}

/**
 *  Test header pane toolbar customization dialog for button style changes
 */
function test_customize_header_toolbar_change_button_style()
{
  select_message_in_folder(0);

  // Restore the default buttons to get defined starting conditions.
  gCDHelper.restoreDefaultButtons(mc);
  // The default mode is label and icon visible.
  subtest_buttons_style("-moz-box", "-moz-box");

  // Change the button style to icon (only) mode
  let ctc = gCDHelper.open(mc);
  let iconMode = ctc.window.document.getElementById("main-box").
    querySelector("[value*='icons']");
  ctc.click(new elib.Elem(iconMode));
  gCDHelper.close(ctc);

  subtest_buttons_style("-moz-box", "none");

  // Change the button style to text (only) mode
  ctc = gCDHelper.open(mc);
  let textMode = ctc.window.document.getElementById("main-box").
    querySelector("[value*='text']");
  ctc.click(new elib.Elem(textMode));
  gCDHelper.close(ctc);

  subtest_buttons_style("none", "-moz-box");

  // The default mode is label and icon visible.
  gCDHelper.restoreDefaultButtons(mc);
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
  let toolbar = mc.e("header-view-toolbar");
  let currentSet = toolbar.currentSet.split(",");

  for (let i = 0; i < currentSet.length; i++) {
    // XXX For the moment only consider normal toolbar buttons.
    // XXX Handling of toolbaritem buttons has to be added later,
    // XXX especially the smart reply button!
    if (mc.e(currentSet[i]).tagName == "toolbarbutton") {
      let icon = mc.a(currentSet[i], {class: "toolbarbutton-icon"});
      let label = mc.a(currentSet[i], {class: "toolbarbutton-text"});
      assert_equals(mc.window.getComputedStyle(icon).getPropertyValue("display"), aIconVisibility);
      assert_equals(mc.window.getComputedStyle(label).getPropertyValue("display"), aLabelVisibility);
    }
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
