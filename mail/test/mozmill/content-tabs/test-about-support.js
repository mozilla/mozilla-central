/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var MODULE_NAME = 'test-about-support';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'content-tab-helpers',
                       'compose-helpers', 'window-helpers'];

Components.utils.import("resource://gre/modules/Services.jsm");

function setupModule(module) {
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);
  let cth = collector.getModule("content-tab-helpers");
  cth.installInto(module);
  let ch = collector.getModule("compose-helpers");
  ch.installInto(module);
  let wh = collector.getModule("window-helpers");
  wh.installInto(module);
}

// After every test we want to close the about:support tab so that failures
// don't cascade.
function teardownTest(module) {
  mc.tabmail.closeOtherTabs(mc.tabmail.tabInfo[0]);
}

/**
 * Strings found in the about:support HTML or text that should clearly mark the
 * data as being from about:support.
 */
const ABOUT_SUPPORT_STRINGS = ["Application Basics", "Mail and News Accounts",
                               "Extensions", "Modified Preferences", "Graphics",
                               "JavaScript", "Accessibility", "Library Versions"];

/**
 * Strings that if found in the about:support text or HTML usually indicate an
 * error.
 */
const ABOUT_SUPPORT_ERROR_STRINGS = ["undefined", "null"];


/*
 * Helpers
 */

/**
 * Opens about:support and waits for it to load.
 *
 * @returns the about:support tab.
 */
function open_about_support() {
  let tab = open_content_tab_with_click(mc.menus.helpMenu.aboutsupport_open,
                                        "about:support");
  // We have one variable that's asynchronously populated -- wait for it to be
  // populated.
  mc.waitFor(function () tab.browser.contentWindow.gExtensions !== undefined,
             "Timeout waiting for about:support's gExtensions to populate.");
  return tab;
}

/**
 * Opens a compose window containing the troubleshooting information.
 *
 * @param aTab The about:support tab.
 */
function open_send_via_email(aTab) {
  let button = content_tab_eid(aTab, "button-send-via-email");
  plan_for_new_window("msgcompose");
  mc.click(button);
  let cwc = wait_for_compose_window();
  return cwc;
}


/*
 * Tests
 */

/**
 * Test displaying the about:support page. Also perform a couple of basic tests
 * to check that no major errors have occurred. The basic tests are by no means
 * comprehensive.
 */
function test_display_about_support() {
  let tab = open_about_support();
  // Check that the document has a few strings that indicate that we've loaded
  // the right page.
  for (let [, str] in Iterator(ABOUT_SUPPORT_STRINGS)) {
    assert_content_tab_text_present(tab, str);
  }

  // Check that error strings aren't present anywhere
  for (let [, str] in Iterator(ABOUT_SUPPORT_ERROR_STRINGS)) {
    assert_content_tab_text_absent(tab, str);
  }
  close_tab(tab);
}

/**
 * Test that our accounts are displayed in order.
 */
function test_accounts_in_order() {
  let tab = open_about_support();
  // This is a really simple test and by no means comprehensive -- test that
  // "account1" appears before "account2" in the HTML content.
  assert_content_tab_text_present(tab, "account1");
  assert_content_tab_text_present(tab, "account2");
  let html = tab.browser.contentDocument.documentElement.innerHTML;
  if (html.indexOf("account1") > html.indexOf("account2")) {
    mark_failure(["account1 found after account2 in the HTML page"]);
  }
  close_tab(tab);
}

const UNIQUE_ID = "3a9e1694-7115-4237-8b1e-1cabe6e35073";

/**
 * Test that a modified preference on the whitelist but not on the blacklist
 * shows up.
 */
function test_modified_pref_on_whitelist() {
  const PREFIX = "accessibility.";
  let prefName = PREFIX + UNIQUE_ID;
  Services.prefs.setBoolPref(prefName, true);
  let tab = open_about_support();
  // Check that the prefix is actually in the whitelist.
  if (tab.browser.contentWindow.PREFS_WHITELIST.indexOf(PREFIX) == -1)
    mark_failure(["The prefs whitelist doesn't contain " + PREFIX]);

  assert_content_tab_text_present(tab, prefName);
  close_tab(tab);
  Services.prefs.clearUserPref(prefName);
}

/**
 * Test that a modified preference not on the whitelist doesn't show up.
 */
function test_modified_pref_not_on_whitelist() {
  Services.prefs.setBoolPref(UNIQUE_ID, true);
  let tab = open_about_support();
  assert_content_tab_text_absent(tab, UNIQUE_ID);
  close_tab(tab);
  Services.prefs.clearUserPref(UNIQUE_ID);
}

/**
 * Test that a modified preference on the blacklist doesn't show up.
 */
function test_modified_pref_on_blacklist() {
  const PREFIX = "network.proxy.";
  let prefName = PREFIX + UNIQUE_ID;
  Services.prefs.setBoolPref(prefName, true);
  let tab = open_about_support();
  // Check that the prefix is in the blacklist.
  if (!tab.browser.contentWindow.PREFS_BLACKLIST.some(
        function(regex) regex.test(PREFIX))) {
    mark_failure(["The prefs blacklist doesn't include " + PREFIX]);
  }
  assert_content_tab_text_absent(tab, prefName);
  close_tab(tab);
  Services.prefs.clearUserPref(prefName);
}

/**
 * Test that private data isn't displayed by default, and that when it is
 * displayed, it actually shows up.
 */
function test_private_data() {
  let tab = open_about_support();
  let checkbox = content_tab_e(tab, "check-show-private-data");
  // We use the profile button's div as an example of a public-only element, and
  // the profile directory display as an example of a private-only element.
  let privateElem = content_tab_e(tab, "profile-dir-box");
  let publicElem = content_tab_e(tab, "profile-dir-button-box");
  assert_true(!checkbox.checked,
              "Private data checkbox shouldn't be checked by default");
  assert_content_tab_element_visible(tab, publicElem);
  assert_content_tab_element_hidden(tab, privateElem);

  // Now check the checkbox and see what happens
  checkbox.click();
  wait_for_content_tab_element_display_value(tab, publicElem, "none");
  wait_for_content_tab_element_display_value(tab, privateElem, "inline");
  close_tab(tab);
}

/**
 * Test (well, sort of) the copy to clipboard function with public data.
 */
function test_copy_to_clipboard_public() {
  let tab = open_about_support();
  // To avoid destroying the current contents of the clipboard, instead of
  // actually copying to it, we just retrieve what would have been copied to it
  let transferable = tab.browser.contentWindow.getClipboardTransferable();
  for (let [, flavor] in Iterator(["text/html", "text/unicode"])) {
    let data = {};
    transferable.getTransferData(flavor, data, {});
    let text = data.value.QueryInterface(Ci.nsISupportsString).data;

    for (let [, str] in Iterator(ABOUT_SUPPORT_STRINGS)) {
      if (!text.contains(str))
        mark_failure(["Unable to find \"" + str + "\" in flavor \"" + flavor + "\""]);
    }

    for (let [, str] in Iterator(ABOUT_SUPPORT_ERROR_STRINGS)) {
      if (text.contains(str))
        mark_failure(["Found \"" + str + "\" in flavor \"" + flavor + "\""]);
    }

    // Check that private data (profile directory) isn't in the output.
    let profD = Services.dirsvc.get("ProfD", Ci.nsIFile).path;
    if (text.contains(profD))
      mark_failure(["Found profile directory in flavor \"" + flavor + "\""]);
  }
  close_tab(tab);
}

/**
 * Test (well, sort of) the copy to clipboard function with private data.
 */
function test_copy_to_clipboard_private() {
  let bundle = Services.strings.createBundle(
    "chrome://messenger/locale/aboutSupportMail.properties");
  let warningText = bundle.GetStringFromName("warningText");

  let tab = open_about_support();

  // Display private data.
  let privateElem = content_tab_e(tab, "profile-dir-box");
  content_tab_e(tab, "check-show-private-data").click();
  wait_for_content_tab_element_display_value(tab, privateElem, "inline");

  // To avoid destroying the current contents of the clipboard, instead of
  // actually copying to it, we just retrieve what would have been copied to it
  let transferable = tab.browser.contentWindow.getClipboardTransferable();
  for (let [, flavor] in Iterator(["text/html", "text/unicode"])) {
    let data = {};
    transferable.getTransferData(flavor, data, {});
    let text = data.value.QueryInterface(Ci.nsISupportsString).data;

    for (let [, str] in Iterator(ABOUT_SUPPORT_STRINGS)) {
      if (!text.contains(str))
        mark_failure(["Unable to find \"" + str + "\" in flavor \"" + flavor + "\""]);
    }

    for (let [, str] in Iterator(ABOUT_SUPPORT_ERROR_STRINGS)) {
      if (text.contains(str))
        mark_failure(["Found \"" + str + "\" in flavor \"" + flavor + "\""]);
    }

    // Check that private data (profile directory) is in the output.
    let profD = Services.dirsvc.get("ProfD", Ci.nsIFile).path;
    if (!text.contains(profD))
      mark_failure(["Unable to find profile directory in flavor \"" + flavor + "\""]);

    // Check that the warning text is in the output.
    if (!text.contains(warningText))
      mark_failure(["Unable to find warning text in flavor \"" + flavor + "\""]);
  }
  close_tab(tab);
}

/**
 * Test opening the compose window with public data.
 */
function test_send_via_email_public() {
  let tab = open_about_support();
  let cwc = open_send_via_email(tab);

  let contentFrame = cwc.e("content-frame");
  let text = contentFrame.contentDocument.body.innerHTML;

  for (let [, str] in Iterator(ABOUT_SUPPORT_STRINGS)) {
    if (!text.contains(str))
      mark_failure(["Unable to find \"" + str + "\" in compose window"]);
  }

  for (let [, str] in Iterator(ABOUT_SUPPORT_ERROR_STRINGS)) {
    if (text.contains(str))
      mark_failure(["Found \"" + str + "\" in compose window"]);
  }

  // Check that private data (profile directory) isn't in the output.
  let profD = Services.dirsvc.get("ProfD", Ci.nsIFile).path;
  if (text.contains(profD))
    mark_failure(["Found profile directory in compose window"]);

  close_compose_window(cwc);
  close_tab(tab);
}

/**
 * Test opening the compose window with private data.
 */
function test_send_via_email_private() {
  let bundle = Services.strings.createBundle(
    "chrome://messenger/locale/aboutSupportMail.properties");
  let warningText = bundle.GetStringFromName("warningText");

  let tab = open_about_support();

  // Display private data.
  let privateElem = content_tab_e(tab, "profile-dir-box");
  content_tab_e(tab, "check-show-private-data").click();
  wait_for_content_tab_element_display_value(tab, privateElem, "inline");

  let cwc = open_send_via_email(tab);

  let contentFrame = cwc.e("content-frame");
  let text = contentFrame.contentDocument.body.innerHTML;

  for (let [, str] in Iterator(ABOUT_SUPPORT_STRINGS)) {
    if (!text.contains(str))
      mark_failure(["Unable to find \"" + str + "\" in compose window"]);
  }

  for (let [, str] in Iterator(ABOUT_SUPPORT_ERROR_STRINGS)) {
    if (text.contains(str))
      mark_failure(["Found \"" + str + "\" in compose window"]);
  }

  // Check that private data (profile directory) is in the output.
  let profD = Services.dirsvc.get("ProfD", Ci.nsIFile).path;
  if (!text.contains(profD))
    mark_failure(["Unable to find profile directory in compose window"]);

  // Check that the warning text is in the output.
  if (!text.contains(warningText))
    mark_failure(["Unable to find warning text in compose window"]);

  close_compose_window(cwc);
  close_tab(tab);
}
