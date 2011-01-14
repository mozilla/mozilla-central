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
 * Mozilla Messaging.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mark Banner <mark@standard8.plus.com>
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

var MODULE_NAME = 'test-install-xpi';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['window-helpers', 'folder-display-helpers',
                       'content-tab-helpers'];

var controller = {};
Components.utils.import('resource://mozmill/modules/controller.js', controller);
var elib = {};
Cu.import('resource://mozmill/modules/elementslib.js', elib);
var mozmill = {};
Components.utils.import('resource://mozmill/modules/mozmill.js', mozmill);
Components.utils.import("resource://gre/modules/Services.jsm");

// RELATIVE_ROOT messes with the collector, so we have to bring the path back
// so we get the right path for the resources.
var url = collector.addHttpResource('../content-tabs/html', 'content-tabs');
var siteRegExp = new RegExp("^" + url);

var gNewTab;
var gNotificationBox;

const ALERT_TIMEOUT = 10000;

let AlertWatcher = {
  planForAlert: function(aController) {
    this.alerted = false;
    aController.window.document.addEventListener("AlertActive",
                                                 this.alertActive, false);
  },
  waitForAlert: function(aController) {
    if (!this.alerted) {
      aController.waitForEval("subject.alerted", ALERT_TIMEOUT, 100, this);
    }
    aController.window.document.removeEventListener("AlertActive",
                                                    this.alertActive, false);
  },
  alerted: false,
  alertActive: function() {
    AlertWatcher.alerted = true;
  }
};

var setupModule = function (module) {
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let cth = collector.getModule('content-tab-helpers');
  cth.installInto(module);
};

function close_xpinstall_dialog(xpidlg) {
 xpidlg.window.document.documentElement.cancelDialog();
}

function accept_xpinstall_dialog(xpidlg) {
  // The install dialog has a count down that we must wait for before
  // proceeding.
  mc.sleep(5500);
  xpidlg.window.document.documentElement.getButton('accept').doCommand();
}

function click_notification_box_action_in_current_tab() {
  let actionButton = gNotificationBox.currentNotification.getElementsByTagName("button")[0];
  mc.click(new elib.Elem(actionButton));
}

function close_notification_box() {
  gNotificationBox.currentNotification.close();
}

function click_install_link_and_wait_for_alert(link) {
  // Clicking the link will bring up a notification box...
  AlertWatcher.planForAlert(mc);
  mc.click(new elib.Elem(mc.tabmail.getBrowserForSelectedTab().contentDocument
                           .getElementById(link)));
  AlertWatcher.waitForAlert(mc);

  // Just give other events time to clear
  mc.sleep(55);
}

function test_setup() {
  gNewTab =
    open_content_tab_with_url(url + "installxpi.html",
                              "specialTabs.siteClickHandler(event, siteRegExp);");

  // make the animation only take one frame
  gNotificationBox =
    mc.tabmail.selectedTab.panel.getElementsByTagName("notificationbox")[0];
  gNotificationBox.slideSteps = 1;
}

function test_install_corrupt_xpi() {
  // This install with give us a corrupt xpi warning.
  click_install_link_and_wait_for_alert("corruptlink");

  // Clicking the install button will close the current notification and open
  // the corrupt notification.
  AlertWatcher.planForAlert(mc);
  click_notification_box_action_in_current_tab();
  AlertWatcher.waitForAlert(mc);

  // Now check this matches, avoiding l10n issues for now.
  if (gNotificationBox.currentNotification.priority !=
      gNotificationBox.PRIORITY_CRITICAL_HIGH)
    throw new Error("Unexpected priority used for notification. Wrong Notification? Priority used was: " + gNotificationBox.currentNotification.priority);

  // We're done with this test, close the box.
  close_notification_box();
}

function test_install_xpi_offer() {
  click_install_link_and_wait_for_alert("installlink");

  // which we want to click on!
  plan_for_modal_dialog("Addons:Install", close_xpinstall_dialog);
  click_notification_box_action_in_current_tab();
  wait_for_modal_dialog("Addons:Install");

  // After closing the dialog we need to give just a little extra time
  // before we do things.
  mc.sleep(100);
}

function test_xpinstall_disabled() {
  Services.prefs.setBoolPref("xpinstall.enabled", false);

  // Try installation again - this time we'll get an install has been disabled
  // message.
  click_install_link_and_wait_for_alert("installlink");

  // tell it to enable installation!
  click_notification_box_action_in_current_tab();
}

function test_xpinstall_actually_install() {
  click_install_link_and_wait_for_alert("installlink");

  // which we want to click on!
  plan_for_modal_dialog("Addons:Install", accept_xpinstall_dialog);
  // and this time we get an alert as well.
  AlertWatcher.planForAlert(mc);
  click_notification_box_action_in_current_tab();
  wait_for_modal_dialog("Addons:Install");

  AlertWatcher.waitForAlert(mc);
  close_notification_box();
  close_tab(gNewTab);
}
