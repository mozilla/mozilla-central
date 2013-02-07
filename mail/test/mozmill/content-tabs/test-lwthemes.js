/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * The purpose of this test is to check that lightweight theme installation
 * works correctly.
 */

var MODULE_NAME = "test-lightweight-themes";

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'content-tab-helpers'];

var controller = {};
Components.utils.import('resource://mozmill/modules/controller.js', controller);
var mozmill = {};
Components.utils.import('resource://mozmill/modules/mozmill.js', mozmill);
var elib = {};
Components.utils.import('resource://mozmill/modules/elementslib.js', elib);

// RELATIVE_ROOT messes with the collector, so we have to bring the path back
// so we get the right path for the resources.
var url = collector.addHttpResource('../content-tabs/html', 'content');

var setupModule = function (module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let cth = collector.getModule('content-tab-helpers');
  cth.installInto(module);
};

const ALERT_TIMEOUT = 10000;

function check_and_click_notification_box_action_in_current_tab(totalButtons,
                                                                selectButton) {
  let notificationBox =
    mc.tabmail.selectedTab.panel.querySelector("notificationbox");

  // This is a crude check to see that we've got the number of buttons we expect
  // and hence this is the right notification that is being shown.
  let buttons = notificationBox.currentNotification.getElementsByTagName("button");
  if (buttons.length != totalButtons)
    throw new Error("Expected " + totalButtons + " alert had " + buttons.length + " buttons");

  mc.click(new elib.Elem(buttons[selectButton]));
}

function close_notification_box_in_current_tab() {
  mc.tabmail.selectedTab.panel
    .querySelector("notificationbox")
    .currentNotification.close();
}

function currentLwTheme() {
  return mc.window.LightWeightThemeWebInstaller._manager.currentThemeForDisplay;
}

function install_theme(themeNo, previousThemeNo) {
  let notificationBox =
    mc.tabmail.selectedTab.panel.querySelector("notificationbox");

  // Clicking the button will bring up a notification box requesting to allow
  // installation of the theme
  NotificationWatcher.planForNotification(mc);
  mc.click(new elib.Elem(mc.window.content.document
                           .getElementById("install" + themeNo)));
  NotificationWatcher.waitForNotification(mc);

  // We're going to acknowledge the theme installation being allowed, and
  // in doing so, the theme will be installed. However, we also will get a new
  // notification box displayed saying the installation is complete, so we'll
  // have to handle that here as well.
  NotificationWatcher.planForNotification(mc);
  check_and_click_notification_box_action_in_current_tab(1, 0);
  NotificationWatcher.waitForNotification(mc);

  // Before we do anything more, check what we've got installed.
  if (!currentLwTheme())
    throw new Error("No lightweight theme selected when there should have been.");

  if (currentLwTheme().id != ("test-0" + themeNo))
    throw new Error("Incorrect theme installed, expected: test-0" + themeNo +
                    " got " + currentLwTheme().id);

  // Now click the undo button, no new notification bar this time.
  check_and_click_notification_box_action_in_current_tab(2, 0);

  // Check there's no current theme installed.
  if (!previousThemeNo && currentLwTheme())
    throw new Error("Lightweight theme installation was not undone");
  else if (previousThemeNo) {
    if (!currentLwTheme())
      throw new Error("No lightweight theme installed after selecting undo");

    if (currentLwTheme().id != ("test-0" + previousThemeNo))
      throw new Error("After undo expected: test-0" + previousThemeNo +
                      " but got " + currentLwTheme().id);
  }

  // Now Click again to install, and this time, we'll leave it there.
  NotificationWatcher.planForNotification(mc);
  mc.click(new elib.Elem(mc.window.content.document
                           .getElementById("install" + themeNo)));
  NotificationWatcher.waitForNotification(mc);

  // We're going to acknowledge the theme installation being allowed, and
  // in doing so, the theme will be installed. However, we also will get a new
  // notification box displayed saying the installation is complete, so we'll
  // have to handle that here as well.
  NotificationWatcher.planForNotification(mc);
  check_and_click_notification_box_action_in_current_tab(1, 0);
  NotificationWatcher.waitForNotification(mc);

  // Now just close the notification box
  close_notification_box_in_current_tab();

  // And one final check for what we've got installed.
  if (!currentLwTheme())
    throw new Error("No lightweight theme selected when there should have been.");

  if (currentLwTheme().id != ("test-0" + themeNo))
    throw new Error("Incorrect theme installed, expected: test-0" + themeNo +
                    " got " + currentTheme.id);
}

function test_lightweight_themes_install() {
  // Before we run the test, check we've not got a theme already installed.
  if (currentLwTheme())
    throw new Error("Lightweight theme selected when there should not have been.");

  let newTab = open_content_tab_with_url(url + 'test-lwthemes.html');

  // Try installing the first theme, no previous theme.
  install_theme(1);
}

function test_lightweight_themes_install_and_undo() {
  // Now try the second one, checking that the first is selected when we undo.
  install_theme(2, 1);

  close_tab(newTab);
}
// XXX Bug 727571 - undo doesn't currently revert to the correct state.
test_lightweight_themes_install_and_undo.__force_skip__ = true;
