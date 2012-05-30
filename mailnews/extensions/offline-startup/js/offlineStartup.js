/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const kDebug              = false;
const kOfflineStartupPref = "offline.startup_state";
const kRememberLastState  = 0;
const kAskForOnlineState  = 1;
const kAlwaysOnline       = 2;
const kAlwaysOffline      = 3;
var   gStartingUp         = true;
var   gOfflineStartupMode; //0 = remember last state, 1 = ask me, 2 == online, 3 == offline, 4 = automatic


////////////////////////////////////////////////////////////////////////
//
//   nsOfflineStartup : nsIObserver
//
//   Check if the user has set the pref to be prompted for
//   online/offline startup mode. If so, prompt the user. Also,
//   check if the user wants to remember their offline state
//   the next time they start up.
//   If the user shutdown offline, and is now starting up in online
//   mode, we will set the boolean pref "mailnews.playback_offline" to true.
//
////////////////////////////////////////////////////////////////////////

var nsOfflineStartup =
{
  onProfileStartup: function()
  {
    debug("onProfileStartup");

    if (gStartingUp)
    {
      gStartingUp = false;
      // if checked, the "work offline" checkbox overrides
      if (Services.io.offline && !Services.io.manageOfflineStatus)
      {
        debug("already offline!");
        return;
      }
    }

    var manageOfflineStatus = Services.prefs.getBoolPref("offline.autoDetect");
    gOfflineStartupMode = Services.prefs.getIntPref(kOfflineStartupPref);
    let wasOffline = !Services.prefs.getBoolPref("network.online");

    if (gOfflineStartupMode == kAlwaysOffline)
    {
      Services.io.manageOfflineStatus = false;
      Services.io.offline = true;
    }
    else if (gOfflineStartupMode == kAlwaysOnline)
    {
      Services.io.manageOfflineStatus = manageOfflineStatus;
      if (wasOffline)
        Services.prefs.setBoolPref("mailnews.playback_offline", true);
      // If we're managing the offline status, don't force online here... it may
      // be the network really is offline.
      if (!manageOfflineStatus)
        Services.io.offline = false;
    }
    else if (gOfflineStartupMode == kRememberLastState)
    {
      Services.io.manageOfflineStatus = manageOfflineStatus && !wasOffline;
      // If we are meant to be online, and managing the offline status
      // then don't force it - it may be the network really is offline.
      if (!manageOfflineStatus || wasOffline)
        Services.io.offline = wasOffline;
    }
    else if (gOfflineStartupMode == kAskForOnlineState)
    {
      var bundle = Services.strings.createBundle("chrome://messenger/locale/offlineStartup.properties");
      var title = bundle.GetStringFromName("title");
      var desc = bundle.GetStringFromName("desc");
      var button0Text = bundle.GetStringFromName("workOnline");
      var button1Text = bundle.GetStringFromName("workOffline");
      var checkVal = {value:0};

      var result = Services.prompt.confirmEx(null, title, desc,
        (Services.prompt.BUTTON_POS_0 * Services.prompt.BUTTON_TITLE_IS_STRING) +
        (Services.prompt.BUTTON_POS_1 * Services.prompt.BUTTON_TITLE_IS_STRING),
        button0Text, button1Text, null, null, checkVal);
      debug ("result = " + result + "\n");
      Services.io.manageOfflineStatus = manageOfflineStatus && result != 1;
      Services.io.offline = result == 1;
      if (result != 1 && wasOffline)
        Services.prefs.setBoolPref("mailnews.playback_offline", true);
    }
  },

  observe: function(aSubject, aTopic, aData)
  {
    debug("observe: " + aTopic);

    if (aTopic == "profile-change-net-teardown")
    {
      debug("remembering offline state");
      Services.prefs.setBoolPref("network.online", !Services.io.offline);
    }
    else if (aTopic == "app-startup")
    {
      Services.obs.addObserver(this, "profile-after-change", false);
      Services.obs.addObserver(this, "profile-change-net-teardown", false);
    }
    else if (aTopic == "profile-after-change")
    {
      this.onProfileStartup();
    }
  },


  QueryInterface: function(aIID)
  {
    if (aIID.equals(Components.interfaces.nsIObserver) ||
        aIID.equals(Components.interfaces.nsISupports))
      return this;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  }
}

function nsOfflineStartupModule()
{
}

nsOfflineStartupModule.prototype =
{
  classID: Components.ID("3028a3c8-2165-42a4-b878-398da5d32736"),
  _xpcom_factory:
  {
    createInstance: function(aOuter, aIID)
    {
      if (aOuter != null)
        throw Components.results.NS_ERROR_NO_AGGREGATION;

      // return the singleton
      return nsOfflineStartup.QueryInterface(aIID);
    },

    lockFactory: function(aLock)
    {
      // quieten warnings
    }
  }
};

////////////////////////////////////////////////////////////////////////
//
//   Debug helper
//
////////////////////////////////////////////////////////////////////////
if (!kDebug)
  debug = function(m) {};
else
  debug = function(m) {dump("\t *** nsOfflineStartup: " + m + "\n");};

var components = [nsOfflineStartupModule];
const NSGetFactory = XPCOMUtils.generateNSGetFactory(components);
