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
 * The Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Blake Winton <bwinton@latte.ca>
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
 * Test that the migration assistant's toolbar page works properly.
 */

var MODULE_NAME = "test-toolbar";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["folder-display-helpers", "migration-helpers"];

// Use the Windows/Linux settings as the default, but check out setupModule.
var DEFAULT_TB2_SET = "button-getmsg,button-newmsg,button-address,separator,button-reply,button-replyall,button-replylist,button-forward,separator,button-tag,button-delete,button-junk,button-print,separator,button-goback,button-goforward,spring,gloda-search";
var DEFAULT_TB3_SET = "button-getmsg,button-newmsg,button-address,separator,button-tag,spring,gloda-search"
var CUSTOM_TB3_SET = "button-getmsg,button-newmsg,button-address,spacer,button-tag,spring,folder-location-container,gloda-search,throbber-box";
var DEFAULT_TB3_ICONSIZE = "large";


function setupModule(module) {
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);
  let mh = collector.getModule("migration-helpers");
  mh.installInto(module);

  // The Mac has different settings for the toolbar, so adjust for that.
  if (Application.platformIsMac) {
    DEFAULT_TB2_SET = "button-getmsg,button-newmsg,button-address,spacer,button-reply,button-replyall,button-replylist,button-forward,spacer,button-tag,button-delete,button-junk,button-print,spacer,button-goback,button-goforward,spring,gloda-search,throbber-box";
    DEFAULT_TB3_SET = "button-getmsg,button-newmsg,button-address,spacer,button-tag,spring,gloda-search,throbber-box";
    DEFAULT_TB3_ICONSIZE = "small";
  }
}

/**
 * Assert that the settings correspond to the default TB2 settings.
 *
 * @param aNewBar the mail-bar3 to check.
 */
function assert_default_tb2_settings(aNewBar) {
  currentset = aNewBar.currentSet;
  labelalign = aNewBar.parentNode.getAttribute("labelalign");
  iconsize = aNewBar.getAttribute("iconsize");
  parentIconsize = aNewBar.parentNode.getAttribute("iconsize");
  assert_equals(currentset, DEFAULT_TB2_SET, "The currentset is incorrect.");
  assert_equals(labelalign, "bottom", "The parent's labelalign is incorrect.");
  assert_equals(iconsize, "large", "The iconsize is incorrect.");
  assert_equals(parentIconsize, "large", "The parent's iconsize is incorrect.");
}

/**
 * Assert that the settings correspond to the default TB3 settings.
 *
 * @param aNewBar the mail-bar3 to check.
 * @param aFirstRun whether this is the default-default TB3 settings, or
 *     the after-we-ran-the-migration-assistant-default TB3 settings.
 */
function assert_default_tb3_settings(aNewBar, aFirstRun) {
  currentset = aNewBar.currentSet;
  labelalign = aNewBar.parentNode.getAttribute("labelalign");
  iconsize = aNewBar.getAttribute("iconsize");
  parentIconsize = aNewBar.parentNode.getAttribute("iconsize");
  assert_equals(currentset, DEFAULT_TB3_SET, "The currentset is incorrect.");
  assert_equals(labelalign, "end", "The labelalign is incorrect.");
  // The Mac sets the icon size all the time, not just after the first run.
  if (aFirstRun && !Application.platformIsMac) {
    assert_equals(iconsize, "", "The iconsize is incorrect.");
    assert_equals(parentIconsize, "", "The parent's iconsize is incorrect.");
  }
  else {
    assert_equals(iconsize, DEFAULT_TB3_ICONSIZE, "The iconsize is incorrect.");
    assert_equals(parentIconsize, DEFAULT_TB3_ICONSIZE, "The parent's iconsize is incorrect.");
  }
}

/**
 * Assert that the settings correspond to the custom TB3 settings.
 *
 * @param aNewBar the mail-bar3 to check.
 */
function assert_custom_tb3_settings(aNewBar) {
  currentset = aNewBar.currentSet;
  labelalign = aNewBar.parentNode.getAttribute("labelalign");
  iconsize = aNewBar.getAttribute("iconsize");
  parentIconsize = aNewBar.parentNode.getAttribute("iconsize");
  assert_equals(currentset, CUSTOM_TB3_SET, "The currentset is incorrect.");
  assert_equals(labelalign, "end", "The labelalign is incorrect.");
  assert_equals(iconsize, "small", "The iconsize is incorrect.");
  assert_equals(parentIconsize, "small", "The parent's iconsize is incorrect.");
}

/**
 * Assert that the correct radio button is checked.
 *
 * @param aNew the new radio button.
 * @param aOrig the original radio button.
 * @param aIsNew Whether the new button should be checked.
 */
function assert_checked_and_unchecked(aChecked, aUnchecked) {
  let checked = aChecked.getAttribute("checked");
  let unchecked = aUnchecked.getAttribute("checked");
  assert_equals(checked, "true",
                "The " + aChecked.id + " checkbox should be checked.");
  assert_equals(unchecked, null,
                "The " + aUnchecked.id + " checkbox should be unchecked.");
}

/**
 * Make sure we can open the migration assistant, navigate to the
 * toolbar page, and close the migration assistant.
 */
function test_open_and_close_toolbar() {
  // Open the migration assistant, and navigate to the toolbar page.
  let fc = open_migration_assistant(mc, "toolbar");
  close_migration_assistant(fc);
}

/**
 * Test the new toolbar with the default TB3 buttons.
 */
function test_new_toolbar_with_default_tb3() {
  // Open the migration assistant, and navigate to the toolbar page.
  let fc = open_migration_assistant(mc, "toolbar");
  let ch = get_subpage(fc);
  let tbNew = ch.e("toolbar-new");
  let tbOrig = ch.e("toolbar-original");

  assert_checked_and_unchecked(tbNew, tbOrig);

  // Make sure that the original buttons are what we think they should be.
  let newbar = mc.e("mail-bar3");
  assert_default_tb3_settings(newbar, true);

  // Make sure the buttons in the 3pane are all big and blocky after we
  // click the "Original Toolbar" radiobox.
  tbOrig.click();
  assert_default_tb2_settings(newbar);

  // And make sure they all revert to normal when we click the "New
  // Toolbar" radiobox.
  tbNew.click();
  assert_default_tb3_settings(newbar, false);

  close_migration_assistant(fc);
}

/**
 * Test the new toolbar with custom TB3 buttons.
 */
function test_new_toolbar_with_custom_tb3() {
  // Set up the custom buttons.
  let newbar = mc.e("mail-bar3");
  newbar.currentSet = CUSTOM_TB3_SET;
  newbar.setAttribute("currentset", CUSTOM_TB3_SET);
  newbar.parentNode.setAttribute("labelalign", "end");
  newbar.setAttribute("iconsize", "small");
  newbar.parentNode.setAttribute("iconsize", "small");

  // Open the migration assistant, and navigate to the toolbar page.
  let fc = open_migration_assistant(mc, "toolbar");
  let ch = get_subpage(fc);
  let tbNew = ch.e("toolbar-new");
  let tbOrig = ch.e("toolbar-original");

  assert_checked_and_unchecked(tbOrig, tbNew);

  // Make sure that the custom buttons are what we think they should be.
  assert_custom_tb3_settings(newbar);

  // Make sure the buttons in the 3pane are all big and blocky after we
  // click the "Original Toolbar" radiobox.
  tbNew.click();
  assert_default_tb3_settings(newbar, false);

  // And make sure they all revert to normal when we click the "New
  // Toolbar" radiobox.
  tbOrig.click();
  assert_custom_tb3_settings(newbar);

  close_migration_assistant(fc);
}

// at the very least I'd like to see a test for Tb3, and two simulating an
// upgrade from Tb2 (one with default buttons and one with customized
// buttons)
