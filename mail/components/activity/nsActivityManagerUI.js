/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

////////////////////////////////////////////////////////////////////////////////
//// Constants

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;

const ACTIVITY_MANAGER_URL = "chrome://messenger/content/activity.xul";
const PREF_FLASH_COUNT = "messenger.activity.manager.flashCount";

////////////////////////////////////////////////////////////////////////////////
//// nsActivityManagerUI class

function nsActivityManagerUI()
{}

nsActivityManagerUI.prototype = {
  classID: Components.ID("5fa5974e-09cb-40cc-9696-643f8a8d9a06"),

  //////////////////////////////////////////////////////////////////////////////
  //// nsIActivityManagerUI

  show: function show(aWindowContext, aID) {
    // First we see if it is already visible
    let window = this.recentWindow;
    if (window) {
      window.focus();
      return;
    }

    let parent = null;
    try {
      if (aWindowContext)
        parent = aWindowContext.getInterface(Ci.nsIDOMWindow);
    } catch (e) { /* it's OK to not have a parent window */ }

    Services.ww.openWindow(parent,
                           ACTIVITY_MANAGER_URL,
                           "ActivityManager",
                           "chrome,dialog=no,resizable",
                           {});
  },

  get visible() {
    return (null != this.recentWindow);
  },

  //////////////////////////////////////////////////////////////////////////////
  //// nsActivityManagerUI

  get recentWindow() {
    return Services.wm.getMostRecentWindow("Activity:Manager");
  },

  //////////////////////////////////////////////////////////////////////////////
  //// nsISupports

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIActivityManagerUI])
};

////////////////////////////////////////////////////////////////////////////////
//// Module

let components = [nsActivityManagerUI];
const NSGetFactory = XPCOMUtils.generateNSGetFactory(components);
