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
 * The Original Code is the SeaMonkey internet suite code.
 *
 * The Initial Developer of the Original Code is
 * the SeaMonkey project at mozilla.org.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Justin Wood <Callek@gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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
const TOOLKIT_MANAGER_URL = "chrome://mozapps/content/downloads/downloads.xul";
const DOWNLOAD_MANAGER_URL = "chrome://communicator/content/downloads/downloadmanager.xul";
const PREF_FLASH_COUNT = "browser.download.manager.flashCount";
const PREF_DM_BEHAVIOR = "browser.download.manager.behavior";
const PREF_FORCE_TOOLKIT_UI = "browser.download.manager.useToolkitUI";

////////////////////////////////////////////////////////////////////////////////
//// nsDownloadManagerUI class

function nsDownloadManagerUI() {}

nsDownloadManagerUI.prototype = {
  classDescription: "Used to show the Download Manager's UI to the user",
  classID: Components.ID("08bbb4af-7bff-4b16-8ff7-d62f3ec5aa0c"),
  contractID: "@mozilla.org/download-manager-ui;1",

  //////////////////////////////////////////////////////////////////////////////
  //// nsIDownloadManagerUI

  show: function show(aWindowContext, aID, aReason)
  {
    var behavior = 0;
    if (aReason != Ci.nsIDownloadManagerUI.REASON_USER_INTERACTED) {
      try {
        var prefs = Cc["@mozilla.org/preferences-service;1"].
                    getService(Ci.nsIPrefBranch);
        behavior = prefs.getIntPref(PREF_DM_BEHAVIOR);
        if (prefs.getBoolPref(PREF_FORCE_TOOLKIT_UI))
          behavior = 0; //We are forcing toolkit UI, force manager behavior
      } catch (e) { }
    }

    switch (behavior) {
      case 0:
        this.showManager(aWindowContext, aID, aReason);
        break;
      case 1:
        this.showProgress(aWindowContext, aID, aReason);
    }

    return; // No UI for behavior >= 2
  },

  get visible() {
    return this.recentWindow != null;
  },

  getAttention: function getAttention()
  {
    if (!this.visible)
      throw Cr.NS_ERROR_UNEXPECTED;

    var prefs = Cc["@mozilla.org/preferences-service;1"].
                getService(Ci.nsIPrefBranch);
    // This preference may not be set, so defaulting to two.
    var flashCount = 2;
    try {
      flashCount = prefs.getIntPref(PREF_FLASH_COUNT);
    } catch (e) { }

    this.recentWindow.getAttentionWithCycleCount(flashCount);
  },

  //////////////////////////////////////////////////////////////////////////////
  //// nsDownloadManagerUI

  get recentWindow() {
    var wm = Cc["@mozilla.org/appshell/window-mediator;1"].
             getService(Ci.nsIWindowMediator);
    return wm.getMostRecentWindow("Download:Manager");
  },

  //////////////////////////////////////////////////////////////////////////////
  //// nsISuiteDownloadManagerUI
  showManager: function showManager(aWindowContext, aID, aReason)
  {
    // First we see if it is already visible
    let window = this.recentWindow;
    if (window) {
      window.focus();

      // If we are being asked to show again, with a user interaction reason,
      // set the appropriate variable.
      if (aReason == Ci.nsIDownloadManagerUI.REASON_USER_INTERACTED)
        window.gUserInteracted = true;
      return;
    }

    let parent = null;
    // We try to get a window to use as the parent here.  If we don't have one,
    // the download manager will close immediately after opening if the pref
    // browser.download.manager.closeWhenDone is set to true.
    try {
      if (aWindowContext)
        parent = aWindowContext.getInterface(Ci.nsIDOMWindow);
    } catch (e) { /* it's OK to not have a parent window */ }

    // We pass the download manager and the nsIDownload we want selected (if any)
    var params = Cc["@mozilla.org/array;1"].
                 createInstance(Ci.nsIMutableArray);

    // Don't fail if our passed in ID is invalid
    var download = null;
    try {
      let dm = Cc["@mozilla.org/download-manager;1"].
               getService(Ci.nsIDownloadManager);
      download = dm.getDownload(aID);
    } catch (ex) {}
    params.appendElement(download, false);

    // Pass in the reason as well
    let reason = Cc["@mozilla.org/supports-PRInt16;1"].
                 createInstance(Ci.nsISupportsPRInt16);
    reason.data = aReason;
    params.appendElement(reason, false);

    var manager = DOWNLOAD_MANAGER_URL;
    try {
      let prefs = Cc["@mozilla.org/preferences-service;1"].
                  getService(Ci.nsIPrefBranch);
      if (prefs.getBoolPref(PREF_FORCE_TOOLKIT_UI))
        manager = TOOLKIT_MANAGER_URL;
    } catch(ex) {}

    var ww = Cc["@mozilla.org/embedcomp/window-watcher;1"].
             getService(Ci.nsIWindowWatcher);
    ww.openWindow(parent,
                  manager,
                  null,
                  "all,dialog=no",
                  params);
  },

  showProgress: function showProgress(aWindowContext, aID, aReason)
  {
    var params = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);

    // Don't fail if our passed in ID is invalid
    var download = null;
    try {
      let dm = Cc["@mozilla.org/download-manager;1"].
               getService(Ci.nsIDownloadManager);
      download = dm.getDownload(aID);
    } catch (ex) {}
    params.appendElement(download, false);

    // Pass in the reason as well
    let reason = Cc["@mozilla.org/supports-PRInt16;1"].
                 createInstance(Ci.nsISupportsPRInt16);
    reason.data = aReason;
    params.appendElement(reason, false);

    var ww = Cc["@mozilla.org/embedcomp/window-watcher;1"].
             getService(Ci.nsIWindowWatcher);
    ww.openWindow(null,
                  "chrome://communicator/content/downloads/progressDialog.xul",
                  null,
                  "chrome,titlebar,centerscreen,minimizable=yes,dialog=no",
                  params);
  },
  //////////////////////////////////////////////////////////////////////////////
  //// nsISupports

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIDownloadManagerUI,
                                         Ci.nsISuiteDownloadManagerUI])
};

////////////////////////////////////////////////////////////////////////////////
//// Module

let components = [nsDownloadManagerUI];

function NSGetModule(compMgr, fileSpec)
{
  return XPCOMUtils.generateModule(components);
}
