/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const EXPORTED_SYMBOLS = ['appIdleManager'];

Components.utils.import("resource://gre/modules/Services.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;

// This module provides a mechanism to turn window focus and blur events
// into app idle notifications. If we get a blur notification that is not
// followed by a focus notification in less than some small number of seconds,
// then we send a begin app idle notification.
// If we get a focus event, and we're app idle, then we send an end app idle 
// notification.
// The notification topic is "mail:appIdle", the values are "idle", and "back"

var appIdleManager =
{
  _appIdle: false,
  _timerInterval: 5000, // 5 seconds ought to be plenty
  get _timer()
  {
    delete this._timer;
    return this._timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
  },

  _timerCallback: function()
  {
    appIdleManager._appIdle = true;
    Services.obs.notifyObservers(null, "mail:appIdle", "idle");
    
  },
  
  onBlur: function()
  {
    appIdleManager._timer.initWithCallback(appIdleManager._timerCallback,
                                 appIdleManager._timerInterval,
                                 Ci.nsITimer.TYPE_ONE_SHOT);
   },
  
  onFocus: function()
  {
    appIdleManager._timer.cancel();
    if (appIdleManager._appIdle)
    {
      appIdleManager._appIdle = false;
      Services.obs.notifyObservers(null, "mail:appIdle", "back");
    }
  }
};

