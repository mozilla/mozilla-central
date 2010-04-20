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
 * Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mark Banner <bugzilla@standard8.plus.com>
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

/**
 * The purpose of this test is to check that lightweight theme installation
 * works correctly.
 */

var MODULE_NAME = "test-lightweight-themes";

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['window-helpers'];

var controller = {};
Components.utils.import('resource://mozmill/modules/controller.js', controller);
var mozmill = {};
Components.utils.import('resource://mozmill/modules/mozmill.js', mozmill);
var elib = {};
Components.utils.import('resource://mozmill/modules/elementslib.js', elib);

var windowHelper;
var mc;

// RELATIVE_ROOT messes with the collector, so we have to bring the path back
// so we get the right path for the resources.
var url = collector.addHttpResource('../content-tabs/html', 'content');

var setupModule = function (module) {
  windowHelper = collector.getModule('window-helpers');
  mc = windowHelper.wait_for_existing_window("mail:3pane");
  windowHelper.installInto(module);
  windowHelper.augment_controller(mc);
};

const ALERT_TIMEOUT = 10000;

let AlertWatcher = {
  planForAlert: function(aController) {
    this.alerted = false;
    aController.window.document.addEventListener("AlertActive",
                                                 this.alertActive, false);
  },
  waitForAlert: function(aController) {
    if (!this.alerted)
      aController.waitForEval("subject.alerted", ALERT_TIMEOUT, 100, this);

    aController.window.document.removeEventListener("AlertActive",
                                                    this.alertActive, false);
  },
  alerted: false,
  alertActive: function() {
    AlertWatcher.alerted = true;
  }
};

function check_and_click_notification_box_action_in_current_tab(totalButtons,
                                                                selectButton) {
  let notificationBox =
    mc.tabmail.selectedTab.panel.getElementsByTagName("notificationbox")[0];

  // This is a crude check to see that we've got the number of buttons we expect
  // and hence this is the right notification that is being shown.
  let buttons = notificationBox.currentNotification.getElementsByTagName("button");
  if (buttons.length != totalButtons)
    throw new Error("Expected " + totalButtons + " alert had " + buttons.length + " buttons");

  mc.click(new elib.Elem(buttons[selectButton]));
}

function close_notification_box_in_current_tab() {
  mc.tabmail.selectedTab.panel
    .getElementsByTagName("notificationbox")[0]
    .currentNotification.close();
}

function currentLwTheme() {
  return mc.window.LightWeightThemeWebInstaller._manager.currentThemeForDisplay;
}

function install_theme(themeNo, previousThemeNo) {
  let notificationBox =
    mc.tabmail.selectedTab.panel.getElementsByTagName("notificationbox")[0];
  notificationBox.slideSteps = 1;

  // Clicking the button will bring up a notification box requesting to allow
  // installation of the theme
  AlertWatcher.planForAlert(mc);
  mc.click(new elib.Elem(mc.window.content.document
                           .getElementById("install" + themeNo)));
  AlertWatcher.waitForAlert(mc);

  // sleep so the one frame happens.
  mc.sleep(55);

  // We're going to acknowledge the theme installation being allowed, and
  // in doing so, the theme will be installed. However, we also will get a new
  // notification box displayed saying the installation is complete, so we'll
  // have to handle that here as well.
  AlertWatcher.planForAlert(mc);
  check_and_click_notification_box_action_in_current_tab(1, 0);
  AlertWatcher.waitForAlert(mc);

  // Before we do anything more, check what we've got installed.
  if (!currentLwTheme())
    throw new Error("No lightweight theme selected when there should have been.");

  if (currentLwTheme().id != ("test-0" + themeNo))
    throw new Error("Incorrect theme installed, expected: test-0" + themeNo +
                    " got " + currentLwTheme().id);

  // sleep so the one frame happens.
  mc.sleep(55);

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
  AlertWatcher.planForAlert(mc);
  mc.click(new elib.Elem(mc.window.content.document
                           .getElementById("install" + themeNo)));
  AlertWatcher.waitForAlert(mc);

  mc.sleep(55);

  // We're going to acknowledge the theme installation being allowed, and
  // in doing so, the theme will be installed. However, we also will get a new
  // notification box displayed saying the installation is complete, so we'll
  // have to handle that here as well.
  AlertWatcher.planForAlert(mc);
  check_and_click_notification_box_action_in_current_tab(1, 0);
  AlertWatcher.waitForAlert(mc);

  // Now just close the notification box
  close_notification_box_in_current_tab();

  // Wait one frame.
  mc.sleep(55);

  // And one final check for what we've got installed.
  if (!currentLwTheme())
    throw new Error("No lightweight theme selected when there should have been.");

  if (currentLwTheme().id != ("test-0" + themeNo))
    throw new Error("Incorrect theme installed, expected: test-0" + themeNo +
                    " got " + currentTheme.id);
}

function test_lightweight_themes() {
  // Before we run the test, check we've not got a theme already installed.
  if (currentLwTheme())
    throw new Error("Lightweight theme selected when there should not have been.");

  // To open a tab we're going to have to cheat and use tabmail so we can load
  // in the data of what we want.
  let preCount = mc.tabmail.tabContainer.childNodes.length;

  let newTab = mc.tabmail.openTab("contentTab", { contentPage: url + 'test-lwthemes.html' });

  mc.waitForEval("subject.busy == false", 5000, 100, newTab);

  if (mc.tabmail.tabContainer.childNodes.length != preCount + 1)
    throw new Error("The content tab didn't open");

  // Try installing the first theme, no previous theme.
  install_theme(1);

  // Now try the second one, checking that the first is selected when we undo.
  install_theme(2, 1);

  mc.tabmail.closeTab(newTab);

  if (mc.tabmail.tabContainer.childNodes.length != preCount)
    throw new Error("The content tab didn't close");
}
