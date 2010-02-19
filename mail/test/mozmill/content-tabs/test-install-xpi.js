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

var MODULE_NAME = 'test-content-tab';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['window-helpers'];

var controller = {};
Components.utils.import('resource://mozmill/modules/controller.js', controller);
var elib = {};
Cu.import('resource://mozmill/modules/elementslib.js', elib);
var mozmill = {};
Components.utils.import('resource://mozmill/modules/mozmill.js', mozmill);
var elementslib = {};
Components.utils.import('resource://mozmill/modules/elementslib.js', elementslib);

var windowHelper;
var mc;

// RELATIVE_ROOT messes with the collector, so we have to bring the path back
// so we get the right path for the resources.
var url = collector.addHttpResource('../content-tabs/html', 'content-tabs');
var siteRegExp = new RegExp("^" + url);
var installPageUrl = url + "installxpi.html";

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
  windowHelper = collector.getModule('window-helpers');
  mc = windowHelper.wait_for_existing_window("mail:3pane");
  windowHelper.installInto(module);
  windowHelper.augment_controller(mc);
};

function close_xpinstall_dialog(xpidlg) {
 xpidlg.window.document.documentElement.cancelDialog();
}

function click_notification_box_action_in_current_tab() {
  let notificationBox =
    mc.tabmail.selectedTab.panel.getElementsByTagName("notificationbox")[0];
  // click the stupid button
dump("@@\n@@\n@@\n@@\nnotification box: " + notificationBox + "\n");
  let actionButton = notificationBox.currentNotification.getElementsByTagName("button")[0];
  dump("@@\nactionbutton: " + actionButton + "\n");
//    mc.aid(notificationBox.currentNotification,
//                            {"tagName": "button"});
  mc.click(new elib.Elem(actionButton));
}

function install_xpi() {
  // make the animation only take one frame
  let notificationBox =
    mc.tabmail.selectedTab.panel.getElementsByTagName("notificationbox")[0];
  notificationBox.slideSteps = 1;

  // Clicking the link will bring up a notification box...
  AlertWatcher.planForAlert(mc);
  mc.click(new elib.Elem(mc.tabmail.getBrowserForSelectedTab().contentDocument
                           .getElementById("installlink")));
  AlertWatcher.waitForAlert(mc);

  // sleep so the one frame happens.
  mc.sleep(55);

  // which we want to click on!
  plan_for_modal_dialog("xpinstallConfirm", close_xpinstall_dialog);
  click_notification_box_action_in_current_tab();
  wait_for_modal_dialog("xpinstallConfirm");
}

function test_install_xpi_basic() {
  let preCount = mc.tabmail.tabContainer.childNodes.length;

  // We have to do this using the tabmail API as we need to pass the scope
  // for allowing browsing so that clicking on the link works.
  mc.tabmail.openTab("contentTab",
                     { contentPage: installPageUrl,
                       clickHandler: "specialTabs.siteClickHandler(event, siteRegExp);" });


  mc.waitForEval("subject.childNodes.length == " + (preCount + 1), 1000, 100,
                 mc.tabmail.tabContainer);

  if (mc.tabmail.tabContainer.childNodes.length != preCount + 1)
    throw new Error("The content tab didn't open");

  mc.waitForEval("subject.busy == false", 3000, 100,
                 mc.tabmail.selectedTab);

  // Check that window.content is set up correctly wrt content-primary and
  // content-targetable.
  if (mc.window.content.location != installPageUrl)
    throw new Error("window.content is not set to the url loaded, incorrect type=\"...\"?");

  install_xpi();
}

function test_xpinstall_disabled() {
  let prefBranch = Cc["@mozilla.org/preferences-service;1"]
                     .getService(Ci.nsIPrefBranch);

  prefBranch.setBoolPref("xpinstall.enabled", false);

  // Try installation again - this time we'll get an install has been disabled
  // message.
  AlertWatcher.planForAlert(mc);
  mc.click(new elib.Elem(mc.tabmail.getBrowserForSelectedTab().contentDocument
                           .getElementById("installlink")));
  AlertWatcher.waitForAlert(mc);

  // tell it to enable installation!
  click_notification_box_action_in_current_tab();

  // XXX can we check the element has gone away?

  install_xpi();
}
