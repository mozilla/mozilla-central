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
 * Shawn Wilsher <me@shawnwilsher.com>.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  David Ascher <dascher@mozillamessaging.com>
 *  Emre Birol <emrebirol@gmail.com>
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
Components.utils.import("resource://app/modules/gloda/log4moz.js");

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
  classDescription: "Used to manage the activities",
  classID: Components.ID("8aa5972e-19cb-41cc-9696-645f8a8d1a06"),
  contractID: "@mozilla.org/activity-manager;1",
  
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
    // make sure that the activity is not in-progress state
    let activity = this._activities[aID];
 
    if (!activity)
      throw Cr.NS_ERROR_NOT_AVAILABLE;
    
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
    for (i = 0; i < this._listeners.length; i++) {
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

function NSGetModule(compMgr, fileSpec)
{
  return XPCOMUtils.generateModule(components);
}

