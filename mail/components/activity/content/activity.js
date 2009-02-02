/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * ***** BEGIN LICENSE BLOCK *****
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
 * The Original Code is Mozilla.org Code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2001
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Blake Ross <blakeross@telocity.com> (Original Author of download mgr)
 *   Ben Goodger <ben@bengoodger.com> (v2.0)
 *   Dan Mosedale <dmose@mozilla.org>
 *   Fredrik Holmqvist <thesuckiestemail@yahoo.se>
 *   Josh Aas <josh@mozilla.com>
 *   Shawn Wilsher <me@shawnwilsher.com> (v3.0)
 *   Edward Lee <edward.lee@engineering.uiuc.edu>
 *   David Ascher <dascher@mozillamessaging.com> (activity manager version)
 *   Emre Birol <emrebirol@gmail.com>
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

////////////////////////////////////////////////////////////////////////////////
//// Globals

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/PluralForm.jsm");
Components.utils.import("resource://app/modules/gloda/log4moz.js");

let gActivityMgrListener = null;
let gActivitiesView = null;
let gActivityLogger = Log4Moz.getConfiguredLogger("activitymgr");

const nsActProcess = Components.Constructor("@mozilla.org/activity-process;1",
                                            "nsIActivityProcess", "init");
const nsActEvent = Components.Constructor("@mozilla.org/activity-event;1",
                                          "nsIActivityEvent", "init");
const nsActWarning = Components.Constructor("@mozilla.org/activity-warning;1",
                                            "nsIActivityWarning", "init");

////////////////////////////////////////////////////////////////////////////////
//// An object to monitor nsActivityManager operations. This class acts as
//// binding layer between nsActivityManager and nsActivityManagerUI objects.

function ActivityMgrListener()
{}

ActivityMgrListener.prototype = {

  onAddedActivity: function(aID, aActivity) {
    gActivityLogger.info("added activity: " + aID + " " + aActivity)
    addActivityBinding(aID, aActivity);
  },
  
  onRemovedActivity: function(aID) {
    removeActivityBinding(aID);
  }
};

////////////////////////////////////////////////////////////////////////////////
//// Utility Functions for Activity binding management

/**
 * Creates the proper binding for the given activity
 */
function createActivityBinding(aActivity)
{
  let bindingName = aActivity.bindingName;
  let binding = document.createElement(bindingName);
  
  if (binding)
    binding.setAttribute('actID', aActivity.id);
    
  return binding;
}

/**
 * Returns the activity group binding that matches the context_type
 * and context of the given activity, if any.
 */
function getActivityGroupBindingByContext(aContextType, aContextObj)
{
  for (let i = 0; i < gActivitiesView.itemCount; i++) {
    let item = gActivitiesView.getItemAtIndex(i)
    if (item.isGroup &&
        item.contextType == aContextType &&
        item.contextObj == aContextObj) {
      return item;
    }
  }
  return null;
}

/**
 * Inserts the given binding into the correct position on the
 * activity manager window.
 */
function placeActivityBinding(aBinding)
{
  if (aBinding.isGroup || aBinding.isProcess)
    gActivitiesView.insertBefore(aBinding, gActivitiesView.firstChild);
  else {
    let next = gActivitiesView.firstChild;
    while (next && (next.isWarning || next.isProcess || next.isGroup))
      next = next.nextSibling;
    if (next)
      gActivitiesView.insertBefore(aBinding, next);
    else
      gActivitiesView.appendChild(aBinding);
  }
}

/**
 * Adds a new binding to activity manager window for the
 * given activity. It is called by ActivityMgrListener when
 * a new activity is added into the activity manager's internal
 * list.
 */
function addActivityBinding(aID, aActivity)
{
  try {
    gActivityLogger.info("Adding ActivityBinding: " + aID + ", " + aActivity)
    // get |groupingStyle| of the activity. Grouping style determines whether we
    // show the activity standalone or grouped by context in the activity manager
    // window.
    let isGroupByContext = (aActivity.groupingStyle ==
                            Components.interfaces.nsIActivity.GROUPING_STYLE_BYCONTEXT);
  
    // find out if an activity group has already been created for this context
    let group = null;
    if (isGroupByContext) {
      group = getActivityGroupBindingByContext(aActivity.contextType,
                                               aActivity.contextObj);
      // create a group if it's not already created.
      if (!group) {
        group = document.createElement("activity-group");
        gActivityLogger.info("created group element")
        // Set the context type and object of the newly created group
        group.contextType = aActivity.contextType;
        group.contextObj = aActivity.contextObj;
        group.contextDisplayText = aActivity.contextDisplayText;
      
        // add group into the list
        placeActivityBinding(group);
      }
    }
     
    // create the appropriate binding for the activity
    let actBinding = createActivityBinding(aActivity);
    gActivityLogger.info("created activity binding")
  
    if (group) {
      // get the inner list element of the group
      let groupView = document.getAnonymousElementByAttribute(group, "anonid",
                                                             "activityGroupView");
      groupView.appendChild(actBinding);
    }
    else {
      placeActivityBinding(actBinding);
    }
  } catch (e) {
    log.error("addActivityBinding: " + e);
    throw(e);
  }
}

/**
 * Removes the activity binding from the activity manager window.
 * It is called by ActivityMgrListener when the activity in question
 * is removed from the activity manager's internal list.
 */
function removeActivityBinding(aID)
{
  // Note: document.getAnonymousNodes(gActivitiesView); didn't work
  gActivityLogger.info("removing Activity ID: " + aID);
  for (let i = 0; i < gActivitiesView.itemCount; i++) {
    let item = gActivitiesView.getItemAtIndex(i);
    if (!item) {
      gActivityLogger.debug("returning as empty")
      return;
    }

    if (!item.isGroup) {
      gActivityLogger.debug("is not a group, ")
      if (item.getAttribute('actID') == aID) {
        // since XBL dtors are not working properly when we remove the element,
        // we have to explicitly remove the binding from activities' listeners
        // list. See bug 230086 for details.
        item.detachFromActivity();
        gActivitiesView.removeChild(item);
        break;
      }
    }
    else {
      let actbinding = document.getAnonymousElementByAttribute(item, 'actID',
                                                               aID);
      if (actbinding) {
        let groupView = document.getAnonymousElementByAttribute(item, "anonid",
                                                           "activityGroupView");
        // since XBL dtors are not working properly when we remove the element,
        // we have to explicitly remove the binding from activities' listeners
        // list. See bug 230086 for details.
        actbinding.detachFromActivity();
        groupView.removeChild(actbinding);
                
        // if the group becomes empty after the removal,
        // get rid of the group as well
        if (groupView.getRowCount() == 0)
          gActivitiesView.removeChild(item);
        
        break;
      }
    }
  }
}

////////////////////////////////////////////////////////////////////////////////
//// Startup, Shutdown

function Startup()
{
  try {
    gActivitiesView = document.getElementById("activityView");

    let activityManager = Components.classes["@mozilla.org/activity-manager;1"]
      .getService(Components.interfaces.nsIActivityManager);
    let activities = activityManager.getActivities({});
    for each (let [, activity] in Iterator(activities)) {
      addActivityBinding(activity.id, activity);
    }

    // start listening changes in the activity manager's
    // internal list
    gActivityMgrListener = new ActivityMgrListener();
    activityManager.addListener(gActivityMgrListener);

  } catch (e) {
    gActivityLogger.error("Exception: " + e )
  }
}

function Shutdown()
{
  let activityManager = Components.classes["@mozilla.org/activity-manager;1"]
    .getService(Components.interfaces.nsIActivityManager);
  activityManager.removeListener(gActivityMgrListener);
}

////////////////////////////////////////////////////////////////////////////////
//// Utility Functions

/**
 * Helper function to replace a placeholder string with a real string
 *
 * @param aText
 *        Source text containing placeholder (e.g., #1)
 * @param aIndex
 *        Index number of placeholder to replace
 * @param aValue
 *        New string to put in place of placeholder
 * @return The string with placeholder replaced with the new string
 */
function replaceInsert(aText, aIndex, aValue)
{
  return aText.replace("#" + aIndex, aValue);
}

/**
 * Remove all activities not in-progress from the activity list.
 */
function clearActivityList()
{
  gActivityLogger.debug("clearActivityList");
  // Remove each activity starting from the end until we hit a activity
  // that is in progress or the end.
  let item;
  for (let i = gActivitiesView.itemCount-1; i >= 0; i--) {
    let child = gActivitiesView.getItemAtIndex(i);
    if (child.inProgress)
      continue;

    if (!child)
      break;
    removeActivityBinding(child.getAttribute('actID'));
  }

  gActivitiesView.focus();
}

function processKeyEvent(event)
{
  switch (event.keyCode) {
    case event.DOM_VK_RIGHT:
      if (event.target.tagName == 'richlistbox') {
        let richlistbox = event.target.selectedItem.processes;
        if (richlistbox.tagName == 'xul:richlistbox') {
          richlistbox.focus();
          richlistbox.selectItem(richlistbox.getItemAtIndex(0));
        }
      }
      break;
    case event.DOM_VK_LEFT:
      if (event.target.tagName == 'activity-group') {
        var parent = event.target.parentNode;
        if (parent.tagName == 'richlistbox') {
          event.target.processes.clearSelection();
          parent.selectItem(event.target);
          parent.focus();
        }
      }
      break;
  }
}
