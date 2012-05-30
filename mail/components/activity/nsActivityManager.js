/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource:///modules/gloda/log4moz.js");

////////////////////////////////////////////////////////////////////////////////
//// Constants

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;


////////////////////////////////////////////////////////////////////////////////
//// nsActivityManager class

function nsActivityManager()
{}

nsActivityManager.prototype = {
  classID: Components.ID("8aa5972e-19cb-41cc-9696-645f8a8d1a06"),

  //////////////////////////////////////////////////////////////////////////////
  //// nsIActivityManager
  log: Log4Moz.getConfiguredLogger("nsActivityManager"),
  _listeners: [],
  _processCount: 0,
  _db: null,
  _idCounter: 1,
  _activities: {},
  
  get processCount() {
    let count = 0;
    for each(let [, value] in Iterator(this._activities)) {
      if (value instanceof Ci.nsIActivityProcess)
        count++;
    }
    
    return count;
  },
  
  getProcessesByContext: function(aContextType, aContextObj, aCount) {
    let list = [];
    for each (let [, activity] in Iterator(this._activities)) {
      if (activity instanceof Ci.nsIActivityProcess &&
          activity.contextType == aContextType &&
          activity.contextObj == aContextObj) {
        list.push(activity);
      }
    }
    
    aCount.value = list.length;
    return list;
  },
  
  get db() {
    return null;
  },
  
  get nextId() {
    return this._idCounter++;
  },
    
  addActivity: function (aActivity) {
    try {
      this.log.info("adding Activity");
      // get the next valid id for this activity
      let id = this.nextId;
      aActivity.id = id;
      
      // add activity into the activities table
      this._activities[id] = aActivity;
      // notify all the listeners
      for each (let [, value] in Iterator(this._listeners)) {
        try {
          value.onAddedActivity(id, aActivity);
        }
        catch(e) {
          this.log.error("Exception calling onAddedActivity" + e)
        }
      }
      return id;
    } catch (e) {
      // for some reason exceptions don't end up on the console if we don't
      // explicitly log them.
      this.log.error("Exception: " + e);
      throw(e);
    }
  },
  
  removeActivity: function (aID) {
    let activity = this._activities[aID];
 
    if (!activity)
      throw Cr.NS_ERROR_NOT_AVAILABLE;
    
    // make sure that the activity is not in-progress state
    if (activity instanceof Ci.nsIActivityProcess &&
        activity.state == Ci.nsIActivityProcess.STATE_INPROGRESS)
      throw Cr.NS_ERROR_FAILURE;
    
    // remove the activity
    delete this._activities[aID];
    
    // notify all the listeners
    for each (let [, value] in Iterator(this._listeners)) {
      try {
        value.onRemovedActivity(aID);
      }
      catch(e) {
        // ignore the exception
      }
    }
  },

  cleanUp: function () {
    // Get the list of aIDs.
    this.log.info("cleanUp\n");
    for (var id in this._activities) {
      let activity = this._activities[id];
      if (activity instanceof Ci.nsIActivityProcess) {
        // Note: The .state property will return undefined if you aren't in
        //       this if-instanceof block.
        let state = activity.state;
        if (state != Ci.nsIActivityProcess.STATE_INPROGRESS &&
            state != Ci.nsIActivityProcess.STATE_PAUSED &&
            state != Ci.nsIActivityProcess.STATE_WAITINGFORINPUT &&
            state != Ci.nsIActivityProcess.STATE_WAITINGFORRETRY)
          this.removeActivity(id);
      }
      else
        this.removeActivity(id);
    }
  },

  getActivity: function(aID) {
    if (!this._activities[aID])
      throw Cr.NS_ERROR_NOT_AVAILABLE;
    return this._activities[aID];
  },

  containsActivity: function (aID) {
    return !!this._activities[aID];
  },

  getActivities: function(aCount) {
    let list = [];
    for each (let [, value] in Iterator(this._activities))
      list.push(value);
    
    aCount.value = list.length;
    return list;
  },

  addListener: function(aListener) {
    this.log.info("addListener\n");
    this._listeners.push(aListener);
  },

  removeListener: function(aListener) {
    this.log.info("removeListener\n");
    for (let i = 0; i < this._listeners.length; i++) {
      if (this._listeners[i] == aListener)
        this._listeners.splice(i, 1);
    }
  },
  
  //////////////////////////////////////////////////////////////////////////////
  //// nsISupports

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIActivityManager])
};

////////////////////////////////////////////////////////////////////////////////
//// Module

let components = [nsActivityManager];
const NSGetFactory = XPCOMUtils.generateNSGetFactory(components);
