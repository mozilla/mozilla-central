/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
