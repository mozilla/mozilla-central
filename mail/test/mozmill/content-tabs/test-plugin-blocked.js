/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mike Conley <mconley@mozilla.com>
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

var MODULE_NAME = 'test-plugin-blocked';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'content-tab-helpers'];

var controller = {};
Components.utils.import('resource://mozmill/modules/controller.js', controller);
var elib = {};
Components.utils.import('resource://mozmill/modules/elementslib.js', elib);

Components.utils.import('resource://gre/modules/Services.jsm');

var gOldStartUrl = null;
var gOldBlDetailsUrl = null;
var gOldPluginUpdateUrl = null;

const kPluginId = "test-plugin";
const kStartPagePref = "mailnews.start_page.override_url";
const kBlDetailsPagePref = "extensions.blocklist.detailsURL";
const kPluginsUpdatePref = "plugins.update.url";
// RELATIVE_ROOT messes with the collector, so we have to bring the path back
// so we get the right path for the resources.
const kUrl = collector.addHttpResource('../content-tabs/html', '');
const kPluginUrl = kUrl + "plugin.html";
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

function setupTest() {
  let plugin = get_test_plugin();
  plugin.disabled = false;
  plugin.blocklisted = true;
}

function teardownTest() {
  let plugin = get_test_plugin();
  plugin.disabled = false;
  plugin.blocklisted = false;
}

/* Tests that the notification bar appears for plugins that
 * are blocklisted.  Ensures that the notification bar gives
 * links to the human-readable blocklist, as well as the
 * plugin update page.
 */
function test_blocklisted_plugin_notification() {
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
}
