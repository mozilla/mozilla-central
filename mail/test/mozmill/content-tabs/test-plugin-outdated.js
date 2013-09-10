/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var MODULE_NAME = 'test-plugin-outdated';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'content-tab-helpers'];

Components.utils.import('resource://gre/modules/Services.jsm');

var gOldStartUrl = null;
var gOldPluginUpdateUrl = null;

const kStartPagePref = "mailnews.start_page.override_url";
const kPluginsUpdatePref = "plugins.update.url";
// RELATIVE_ROOT messes with the collector, so we have to bring the path back
// so we get the right path for the resources.
const kUrl = collector.addHttpResource('../content-tabs/html', '');
const kPluginUrl = kUrl + "plugin.html";
const kPluginUpdateUrl = kUrl + "plugin_update.html";
const kPluginBlocklistUrl = kUrl + "blocklist.xml";

var testDone = false;

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let cth = collector.getModule('content-tab-helpers');
  cth.installInto(module);

  // Set the pref so that what's new opens a local url - we'll save the old
  // url and put it back in the module teardown.
  gOldStartUrl = Services.prefs.getCharPref(kStartPagePref);

  // Stash the old plugin update URL so we can put it back on module
  // teardown
  gOldPluginUpdateUrl = Services.prefs.getCharPref(kPluginsUpdatePref);

  Services.prefs.setCharPref(kStartPagePref, kPluginUrl);
  Services.prefs.setCharPref(kPluginsUpdatePref, kPluginUpdateUrl);

  let plugin = get_test_plugin();
  plugin.enabledState = Components.interfaces.nsIPluginTag.STATE_ENABLED;
}

function teardownModule(module) {
  Services.prefs.setCharPref(kStartPagePref, gOldStartUrl);
  Services.prefs.setCharPref(kPluginsUpdatePref, gOldPluginUpdateUrl);
}

function test_outdated_plugin_notification() {
  let plugin = get_test_plugin();
  assert_not_equals(plugin, null, "Test plugin not found");

  Services.prefs.setBoolPref("extensions.blocklist.suppressUI", true);

  setAndUpdateBlocklist(mc, kPluginBlocklistUrl, function() {
    subtest_outdated_plugin_notification();
  });

  mc.waitFor(function () { return testDone; }, "Plugin test taking too long",
             100000, 1000);

  let finishedReset = false;

  resetBlocklist(mc, function() { finishedReset = true; });

  mc.waitFor(function () finishedReset, "Reset blocklist took too long");

  Services.prefs.clearUserPref("extensions.blocklist.suppressUI");
}

function subtest_outdated_plugin_notification() {
  // Prepare to capture the notification bar
  NotificationWatcher.planForNotification(mc);
  let pluginTab = open_content_tab_with_click(mc.menus.helpMenu.whatsNew,
                                              kPluginUrl);
  NotificationWatcher.waitForNotification(mc);

  let notificationBar = get_notification_bar_for_tab(mc.tabmail.selectedTab);
  assert_not_equals(null, notificationBar, "Could not get notification bar");
  let notifValue = notificationBar.getNotificationWithValue("outdated-plugins");
  assert_not_equals(null, notifValue, "Notification value was not correct");

  // aButton should be the "update my plugins" button.
  let aButton = notificationBar.querySelector("button");

  // Let's make sure that the "update my plugins" button opens up
  // a tab and takes us to the right place.
  let updateTab = open_content_tab_with_click(aButton, kPluginUpdateUrl);
  assert_tab_has_title(updateTab, "Plugin Update Page");
  mc.tabmail.closeTab(updateTab);

  mc.tabmail.closeTab(pluginTab);
  testDone = true;
}
