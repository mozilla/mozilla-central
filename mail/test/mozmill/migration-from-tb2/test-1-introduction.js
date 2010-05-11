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
 * Test that the migration assistant's introduction page works properly.
 */

var MODULE_NAME = "test-introduction";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["folder-display-helpers", "migration-helpers",
                       "window-helpers"];

function setupModule(module) {
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);
  let mh = collector.getModule("migration-helpers");
  mh.installInto(module);
  let wh = collector.getModule("window-helpers");
  wh.installInto(module);
}

/**
 * Make sure the migration assistant, has opened automatically when we upgrade.
 */
function test_open_and_close_migration_assistant() {
  // Ensure that the migration assistant is opened on upgrade.
  let fc = wait_for_existing_window("mailnews:featureconfigurator");

  // The first page should be the introduction page.
  let content = fc.e("contentFrame");
  url = content.getAttribute("src");
  assert_true(url.indexOf("introduction") != -1,
              "The first page (" + url + ") isn't the introduction page!");
  check_introduction_page(fc);

  // Move to the next page, which should be the autosync page.
  fc.click(fc.eid("nextButton"));
  url = content.getAttribute("src");
  assert_true(url.indexOf("autosync") != -1,
              "The second page (" + url + ") isn't the autosync page!");
  check_autosync_page(fc);

  // Move to the next page, which should be the toolbar page.
  fc.click(fc.eid("nextButton"));
  url = content.getAttribute("src");
  assert_true(url.indexOf("toolbar") != -1,
              "The third page (" + url + ") isn't the toolbar page!");
  check_toolbar_page(fc);

  // Move to the next page, which should be the compactheader page.
  fc.click(fc.eid("nextButton"));
  url = content.getAttribute("src");
  assert_true(url.indexOf("compactheader") != -1,
              "The fourth page (" + url + ") isn't the compactheader page!");
  check_compactheader_page(fc);

  // Move to the next page, which should be the folderpanecolumns page.
  fc.click(fc.eid("nextButton"));
  url = content.getAttribute("src");
  assert_true(url.indexOf("folderpanecolumns") != -1,
              "The fifth page (" + url + ") isn't the folderpanecolumns page!");
  check_folderpanecolumns_page(fc);

  // And finally, close the migration assistant.
  close_migration_assistant(fc);
}

/**
 * Make sure that the introductory page works correctly.
 */
function check_introduction_page(fc) {
  // This should be the first page.
  let prevButton = fc.e("prevButton");
  assert_true(prevButton.disabled, "We can go back from the first page!");

  // And there's not much more else on this page, so let's continue.
}

/**
 * Make sure that the autosync page works correctly.
 */
function check_autosync_page(fc) {
  // There should only be one account, for "blaketestwinton@gmail.com".
  let as = get_subpage(fc);
  let accountList = as.e("account_list");
  assert_equals(accountList.childNodes.length, 1, "More than one account!");

  // Single account should be set to synchronize.
  let account = accountList.childNodes.item(0);
  assert_equals(account.textContent, "blaketestwinton@gmail.com");
  assert_equals(account.className, "button syncing");

  // And because it's the only account, the all-sync radio button should be
  // checked.
  as.assertChecked(as.eid("all-sync"));
  as.assertNotChecked(as.eid("none-sync"));
  as.assertNotChecked(as.eid("some-sync"));
}

/**
 * Make sure that the toolbar page works correctly.
 */
function check_toolbar_page(fc) {
  // Toolbar radio buttons should be set to "Message Buttons Toolbar".
  let tb = get_subpage(fc);
  tb.assertChecked(tb.eid("toolbar-new"));
  tb.assertNotChecked(tb.eid("toolbar-original"));
}

/**
 * Make sure that the compactheader page works correctly.
 */
function check_compactheader_page(fc) {
  // Compact header strong text should be shown.
  let ch = get_subpage(fc);
  assert_equals(get_display(ch, "weak"), "none",
              "The weak message should not be displayed.");
  assert_equals(get_display(ch, "strong"), "block",
              "The strong message should be displayed.");

  // Button to install should be shown.
  assert_equals(get_display(ch, "addon-install-button"), "inline",
              "The install button should be displayed.");
  assert_equals(get_display(ch, "installing"), "none",
              "The installing message should not be displayed.");
  assert_equals(get_display(ch, "installed"), "none",
              "The installed message should be displayed.");
  assert_equals(get_display(ch, "alreadyInstalled"), "none",
              "The already installed message should not be displayed.");
}

/**
 * Make sure that the folderpanecolumns page works correctly.
 */
function check_folderpanecolumns_page(fc) {
  // This should be the last page.
  let nextButton = fc.e("nextButton");
  assert_true(nextButton.disabled, "We can go forward from the last page!");

  // Folder Pane strong text should be shown.
  let fp = get_subpage(fc);
  assert_equals(get_display(fp, "weak"), "none",
              "The weak message should not be displayed.");
  assert_equals(get_display(fp, "strong"), "block",
              "The strong message should be displayed.");

  // Button to install should be shown.
  assert_equals(get_display(fp, "addon-install-button"), "inline",
              "The install button should be displayed.");
  assert_equals(get_display(fp, "installing"), "none",
              "The installing message should not be displayed.");
  assert_equals(get_display(fp, "installed"), "none",
              "The installed message should be displayed.");
  assert_equals(get_display(fp, "alreadyInstalled"), "none",
              "The already installed message should not be displayed.");
}


// Utility functions.

/**
 * Get the value of the display property for the passed in element.
 */
function get_display(c, id) {
  return c.window.getComputedStyle(c.e(id), null).getPropertyValue("display");
}
