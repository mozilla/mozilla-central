/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var MODULE_NAME = 'test-plugin-blocked';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'content-tab-helpers'];

Components.utils.import('resource://gre/modules/Services.jsm');

var gOldStartUrl = null;
var gOldBlDetailsUrl = null;
var gOldPluginUpdateUrl = null;

var testDone = false;

const kPluginId = "test-plugin";
const kStartPagePref = "mailnews.start_page.override_url";
const kBlDetailsPagePref = "extensions.blocklist.detailsURL";
const kPluginsUpdatePref = "plugins.update.url";
// RELATIVE_ROOT messes with the collector, so we have to bring the path back
// so we get the right path for the resources.
const kUrl = collector.addHttpResource('../content-tabs/html', '');
const kPluginUrl = kUrl + "plugin.html";
const kPluginBlocklistUrl = kUrl + "blocklistHard.xml";
const kBlDetailsUrl = kUrl + "blocklist_details.html";
const kPluginUpdateUrl = kUrl + "plugin_update.html";

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let cth = collector.getModule('content-tab-helpers');
  cth.installInto(module);

  // Set the pref so that what's new opens a local url - we'll save the old
  // url and put it back in the module teardown.
  gOldStartUrl = Services.prefs.getCharPref(kStartPagePref);
  gOldBlDetailsUrl = Services.prefs.getCharPref(kBlDetailsPagePref);
  gOldPluginUpdateUrl = Services.prefs.getCharPref(kPluginsUpdatePref);

  Services.prefs.setCharPref(kStartPagePref, kPluginUrl);
  Services.prefs.setCharPref(kBlDetailsPagePref, kBlDetailsUrl);
  Services.prefs.setCharPref(kPluginsUpdatePref, kPluginUpdateUrl);
};

function teardownModule(module) {
  Services.prefs.setCharPref(kStartPagePref, gOldStartUrl);
  Services.prefs.setCharPref(kBlDetailsPagePref, gOldBlDetailsUrl);
  Services.prefs.setCharPref(kPluginsUpdatePref, gOldPluginUpdateUrl);
}

/* Tests that the notification bar appears for plugins that
 * are blocklisted.  Ensures that the notification bar gives
 * links to the human-readable blocklist, as well as the
 * plugin update page.
 */
function test_blocklisted_plugin_notification() {
  let plugin = get_test_plugin();
  let pluginState = plugin.enabledState;
  plugin.enabledState = plugin.STATE_ENABLED;
  assert_not_equals(plugin, null, "Test plugin not found");
  assert_false(plugin.blocklisted, "Test plugin was unexpectedly blocklisted");
  assert_false(plugin.disabled, "Test plugin not enabled");

  Services.prefs.setBoolPref("extensions.blocklist.suppressUI", true);

  setAndUpdateBlocklist(mc, kPluginBlocklistUrl, function() {
    assert_true(plugin.blocklisted, "Test plugin was not properly blocklisted");
    subtest_blocklisted_plugin_notification();
  });

  mc.waitFor(function () { return testDone; }, "Plugin test taking too long",
             100000, 1000);

  let finishedReset = false;

  resetBlocklist(mc, function() { finishedReset = true; });

  mc.waitFor(function () finishedReset, "Reset blocklist took too long");

  plugin.enabledState = pluginState;

  Services.prefs.clearUserPref("extensions.blocklist.suppressUI");
}

function subtest_blocklisted_plugin_notification() {
  // Prepare to capture the notification bar
  NotificationWatcher.planForNotification(mc);
  let pluginTab = open_content_tab_with_click(mc.menus.helpMenu.whatsNew,
                                              kPluginUrl);
  NotificationWatcher.waitForNotification(mc);

  // If we got here, then the notification bar appeared.  Now
  // let's make sure it displayed the right message.
  let notificationBar = get_notification_bar_for_tab(mc.tabmail.selectedTab);
  assert_not_equals(null, notificationBar, "Could not get notification bar");
  let blNotification = notificationBar.getNotificationWithValue("blocked-plugins");
  assert_not_equals(null, blNotification, "Notification value was not correct");

  // buttons[0] should be the "more info" button, and buttons[1]
  // should be the "update my plugins" button.
  let buttons = notificationBar.getElementsByTagName("button");

  // Let's make sure that the "more info" button opens up a tab
  // and takes us to the right place.
  let detailsTab = open_content_tab_with_click(buttons[0], kBlDetailsUrl);
  assert_tab_has_title(detailsTab, "Plugin Blocklist Details");
  mc.tabmail.closeTab(detailsTab);

  // Let's make sure that the "update my plugins" button opens up
  // a tab and takes us to the right place.
  let updateTab = open_content_tab_with_click(buttons[1], kPluginUpdateUrl);
  assert_tab_has_title(updateTab, "Plugin Update Page");
  mc.tabmail.closeTab(updateTab);

  // Close the tab to finish up.
  mc.tabmail.closeTab(pluginTab);
  testDone = true;
}
