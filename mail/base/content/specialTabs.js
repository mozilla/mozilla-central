/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * The Original Code is Mozilla Communicator client code, released
 * March 31, 1998.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998-1999
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

var specialTabs = {
  // This will open any special tabs if necessary on startup.
  openSpecialTabsOnStartup: function() {
    let tabmail = document.getElementById('tabmail');

    var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                          .getService(Components.interfaces.nsIPrefBranch);

    // Show the "what's new" tab to the user
    // if upgraded
    if (this.isApplicationUpgraded(prefs)) {
        tabmail.registerTabType(this.whatsnewTabType);
        tabmail.openTab("whatsNew");
    }
  },

  /**
   * Tests whether the application has been upgraded
   * or not. Updates the pref with the latest version,
   * returns true if upgraded, false otherwise.
   */
  isApplicationUpgraded: function(prefs) {
    let savedAppVersion = null;
    try {
      savedAppVersion = prefs.getCharPref("mailnews.start_page_override.mstone");
    } catch (ex) {}

    if (savedAppVersion != "ignore") {
      let currentApplicationVersion =
        Components.classes["@mozilla.org/xre/app-info;1"]
                  .getService(Components.interfaces.nsIXULAppInfo).version;

      prefs.setCharPref("mailnews.start_page_override.mstone",
                        currentApplicationVersion);

      // Only show if this is actually an upgraded version, not just a new
      // installation/profile.
      if (savedAppVersion && currentApplicationVersion != savedAppVersion)
        return true;
    }
    return false;
  },

  /**
   * A tab to show the "what's new" page to the user at the very first start of
   * an upgrade.
   */
  whatsnewTabType: {
    name: "whatsNew",
    perTabPanel: "iframe",
    modes: {
      whatsNew: {
        type: "whatsNew",
        maxTabs: 1
      }
    },
    openTab: function onTabOpened (aTab) {
      let startpage =
        Components.classes["@mozilla.org/toolkit/URLFormatterService;1"]
                  .getService(Components.interfaces.nsIURLFormatter)
                  .formatURLPref("mailnews.start_page.override_url");
      aTab.panel.setAttribute("src", startpage);

      let msgBundle = document.getElementById("bundle_messenger");
      aTab.title = msgBundle.getString("whatsNew");
    },
    closeTab: function onTabClosed (aTab) {
    },
    saveTabState: function onSaveTabState (aTab) {
    },
    showTab: function onShowTab (aTab) {
    }
  }
}
