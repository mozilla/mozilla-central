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
 * The Original Code is autoconfig test code.
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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource:///modules/activity/alertHook.js");
alertHook.init();

// Replace the alerts service with our own. This will let us check if we're
// prompting or not.
var gAlertShown = false;

var mockAlertsService = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIAlertsService]),

  showAlertNotification: function(imageUrl, title, text, textClickable, cookie,
                                  alertListener, name) {
    gAlertShown = true;
  }
};

var mockAlertsServiceFactory = {
  createInstance: function(aOuter, aIID) {
    if (aOuter != null)
      throw Cr.NS_ERROR_NO_AGGREGATION;

    if (!aIID.equals(Ci.nsIAlertsService))
      throw Cr.NS_ERROR_NO_INTERFACE;

    return mockAlertsService;
  }
};

var gMsgWindow = {};

var mailnewsURL = {
  get msgWindow() {
    if (gMsgWindow)
      return gMsgWindow;

    throw Cr.NS_ERROR_INVALID_POINTER;
  }
};

function run_test() {
  // First register the mock alerts service
  Components.manager.QueryInterface(Ci.nsIComponentRegistrar)
    .registerFactory(Components.ID("{1bda6c33-b089-43df-a8fd-111907d6385a}"),
                     "Mock Alerts Service", "@mozilla.org/alerts-service;1",
                     mockAlertsServiceFactory);

  let msgMailSession = Cc["@mozilla.org/messenger/services/session;1"]
                         .getService(Ci.nsIMsgMailSession);

  // Just text, no url or window => expect no error shown to user
  gAlertShown = false;
  msgMailSession.alertUser("test error");
  do_check_false(gAlertShown);

  // Text, url and window => expect error shown to user
  gAlertShown = false;
  msgMailSession.alertUser("test error 2", mailnewsURL);
  do_check_true(gAlertShown);

  // Text, url and no window => export no error shown to user
  gAlertShown = false;
  gMsgWindow = null;
  msgMailSession.alertUser("test error 2", mailnewsURL);
  do_check_false(gAlertShown);

  // XXX There appears to be a shutdown leak within the activity manager when
  // unless it is cleaned up, however as it is only shutdown, it doesn't really
  // matter, so we'll just ignore it here.
  Cc["@mozilla.org/activity-manager;1"]
    .getService(Ci.nsIActivityManager)
    .cleanUp();
}
