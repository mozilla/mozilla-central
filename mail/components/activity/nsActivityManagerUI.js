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
  classDescription: "Used to show the Activity Manager's UI to the user",
  classID: Components.ID("5fa5974e-09cb-40cc-9696-643f8a8d9a06"),
  contractID: "@mozilla.org/activity-manager-ui;1",

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

    var ww = Cc["@mozilla.org/embedcomp/window-watcher;1"].
             getService(Ci.nsIWindowWatcher);
    ww.openWindow(parent,
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
    var wm = Cc["@mozilla.org/appshell/window-mediator;1"].
             getService(Ci.nsIWindowMediator);
    return wm.getMostRecentWindow("ActivityManager");
  },

  //////////////////////////////////////////////////////////////////////////////
  //// nsISupports

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIActivityManagerUI])
};

////////////////////////////////////////////////////////////////////////////////
//// Module

let components = [nsActivityManagerUI];

function NSGetModule(compMgr, fileSpec)
{
  return XPCOMUtils.generateModule(components);
}

