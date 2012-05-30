/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var MODULE_NAME = 'test-plugin-unknown';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers',
                       'content-tab-helpers',
                       'window-helpers'];

var controller = {};
Components.utils.import('resource://mozmill/modules/controller.js', controller);
Components.utils.import('resource://gre/modules/Services.jsm');
var elib = {};
Components.utils.import('resource://mozmill/modules/elementslib.js', elib);

var gTabmail = null;
var gContentWindow = null;
var gJSObject = null;
var gTabDoc = null;
var gOldStartPage = null;

const kPluginId = "test-plugin";
const kStartPagePref = "mailnews.start_page.override_url";
// RELATIVE_ROOT messes with the collector, so we have to bring the path back
// so we get the right path for the resources.
const kUrl = collector.addHttpResource('../content-tabs/html', '');
const kPluginUrl = kUrl + "unknown-plugin.html";

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let cth = collector.getModule('content-tab-helpers');
  cth.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);

  // Set the pref so that what's new opens a local url - we'll save the old
  // url and put it back in the module teardown.
  gOldStartPage = Services.prefs.getCharPref(kStartPagePref);
  Services.prefs.setCharPref(kStartPagePref, kPluginUrl);

  gTabmail = mc.tabmail;
};

function teardownModule(module) {
  Services.prefs.setCharPref(kStartPagePref, gOldStartPage);
}

function openPluginTab() {
  let tab = open_content_tab_with_click(mc.menus.helpMenu.whatsNew, kPluginUrl);
  assert_tab_has_title(tab, "Unknown Plugin Test");
  assert_content_tab_has_url(tab, kPluginUrl);

  gContentWindow = gTabmail.selectedTab.browser.contentWindow;
  gJSObject = gContentWindow.wrappedJSObject;

  // Strangely, in order to manipulate the embedded plugin,
  // we have to use getElementById within the context of the
  // wrappedJSObject of the content tab browser.
  gTabDoc = gJSObject.window.document;
}

function closeCurrentTab() {
  let tab = gTabmail.selectedTab;
  gTabmail.closeTab(tab);
}

function test_unknown_plugin_notification_inline() {
  openPluginTab();
  let plugin = gTabDoc.getElementById(kPluginId);

  function getStatusDiv() {
    let submitDiv = gContentWindow
                    .document
                    .getAnonymousElementByAttribute(plugin,
                                                    "class",
                                                    "installStatus");

    if (!submitDiv)
      return null;

    return submitDiv;
  }

  mc.waitFor(function() (getStatusDiv() != null),
             "Timed out waiting for plugin status div to appear");

  let submitDiv = getStatusDiv();
  assert_equals("ready", submitDiv.getAttribute("status"),
                "The plugin install status should have been ready");
  closeCurrentTab();
}

function test_unknown_plugin_notification_bar() {
  // We need to prepare for the notification before the
  // tab is actually loaded, so we'll close the tab that's
  // been auto-loaded, and re-open.
  NotificationWatcher.planForNotification(mc);
  openPluginTab();
  NotificationWatcher.waitForNotification(mc);
  closeCurrentTab();
}
