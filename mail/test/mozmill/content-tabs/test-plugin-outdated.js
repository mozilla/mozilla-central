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

var MODULE_NAME = 'test-plugin-outdated';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'content-tab-helpers'];

var controller = {};
Components.utils.import('resource://mozmill/modules/controller.js', controller);
var elib = {};
Components.utils.import('resource://mozmill/modules/elementslib.js', elib);

Components.utils.import('resource://gre/modules/Services.jsm');

var gOldStartUrl = null;
var gOldPluginUpdateUrl = null;
var gHadBlocklist = false;

const kPluginId = "test-plugin";
const kStartPagePref = "mailnews.start_page.override_url";
const kPluginsUpdatePref = "plugins.update.url";
const kBlEnabledPref = "extensions.blocklist.enabled";
// RELATIVE_ROOT messes with the collector, so we have to bring the path back
// so we get the right path for the resources.
const kUrl = collector.addHttpResource('../content-tabs/html', '');
const kPluginUrl = kUrl + "plugin.html";
const kPluginUpdateUrl = kUrl + "plugin_update.html";
const kBlocklist = "blocklist.xml";
const kBlocklistOld = "blocklist-old.xml";
const kNewBlocklistPath = "./html/" + kBlocklist;

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

  // See if there's a local blocklist.xml in the profile directory.
  // If so, rename it.
  let profD = Services.dirsvc.get("ProfD", Components.interfaces.nsIFile);
  let blFile = profD.clone();
  blFile.append(kBlocklist);

  if (blFile.exists()) {
    gHadBlocklist = true;
    blFile.moveTo(profD, kBlocklistOld);
  }

  // Now copy the blocklist from the test to the profile directory
  let path = os.getFileForPath(__file__);
  let newBlFile = os.getFileForPath(os.abspath(kNewBlocklistPath, path));
  newBlFile.copyTo(profD, kBlocklist);

  // Cause a reload of blocklist.xml
  Services.prefs.setBoolPref(kBlEnabledPref, false);
  Services.prefs.setBoolPref(kBlEnabledPref, true);
}

function teardownModule(module) {
  Services.prefs.setCharPref(kStartPagePref, gOldStartUrl);
  Services.prefs.setCharPref(kPluginsUpdatePref, gOldPluginUpdateUrl);

  // Remove the blocklist.xml we put into the profile directory.
  let profD = Services.dirsvc.get("ProfD", Components.interfaces.nsIFile);
  newBlFile = profD.clone();
  newBlFile.append("blocklist.xml");
  newBlFile.remove(false);

  // If there was a blocklist there originally, put it back.
  if (gHadBlocklist) {
    let blOldFile = profD.clone();
    blOldFile.append("blocklist-old.xml");
    blOldFile.moveTo(profD, "blocklist.xml");
  }

  // Cause a reload of blocklist.xml
  Services.prefs.setBoolPref(kBlEnabledPref, false);
  Services.prefs.setBoolPref(kBlEnabledPref, true);
}

function test_outdated_plugin_notification() {
  // Prepare to capture the notification bar
  NotificationWatcher.planForNotification(mc);
  let pluginTab = open_content_tab_with_click(mc.menus.helpMenu.whatsNew,
                                              kPluginUrl);
  NotificationWatcher.waitForNotification(mc);

  let notificationBar = get_notification_bar_for_tab(mc.tabmail.selectedTab);
  assert_not_equals(null, notificationBar, "Could not get notification bar");
  let notifValue = notificationBar.getNotificationWithValue("outdated-plugins");
  assert_not_equals(null, notifValue, "Notification value was not correct");

  // buttons[0] should be the "update my plugins" button.
  let buttons = notificationBar.getElementsByTagName("button");

  // Let's make sure that the "update my plugins" button opens up
  // a tab and takes us to the right place.
  let updateTab = open_content_tab_with_click(buttons[0], kPluginUpdateUrl);
  assert_tab_has_title(updateTab, "Plugin Update Page");
  mc.tabmail.closeTab(updateTab);

  mc.tabmail.closeTab(pluginTab);
}
