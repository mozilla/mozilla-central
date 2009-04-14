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
  _kAboutRightsVersion: 1,

  // This will open any special tabs if necessary on startup.
  openSpecialTabsOnStartup: function() {
    let tabmail = document.getElementById('tabmail');

    var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                          .getService(Components.interfaces.nsIPrefBranch);

    tabmail.registerTabType(this.contentTabType);

    // Show the "what's new" tab to the user, if we have upgraded.
    if (this.isApplicationUpgraded(prefs))
      this.showWhatsNewPage();

    // Show the about rights notification if we need to.
    if (this.shouldShowAboutRightsNotification(prefs))
      this.showAboutRightsNotification(prefs);
  },

  /**
   * A tab to show content pages.
   */
  contentTabType: {
    name: "contentTab",
    perTabPanel: "vbox",
    modes: {
      contentTab: {
        type: "contentTab",
        maxTabs: 10
      }
    },
    // XXX it would be nice to have an onload listener and set the title
    // after the load, however tabmail doesn't support that at the moment.
    openTab: function onTabOpened(aTab, aContentPage, aTitle) {
      // You can't dynamically change an iframe from a non-content to a content
      // type, therefore we dynamically create the element instead.
      let iframe = document.createElement("iframe");
      iframe.setAttribute("type", "content");
      iframe.setAttribute("flex", "1");

      aTab.panel.appendChild(iframe);

      iframe.setAttribute("src", aContentPage);

      aTab.title = aTitle;
    },
    closeTab: function onTabClosed(aTab) {
    },
    saveTabState: function onSaveTabState(aTab) {
    },
    showTab: function onShowTab(aTab) {
    },
    onTitleChanged: function onTitleChanged(aTab) {
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
   * Shows the what's new page in a content tab.
   */
  showWhatsNewPage: function onShowWhatsNewPage() {
    let startpage =
        Components.classes["@mozilla.org/toolkit/URLFormatterService;1"]
                  .getService(Components.interfaces.nsIURLFormatter)
                  .formatURLPref("mailnews.start_page.override_url");

    let msgBundle = document.getElementById("bundle_messenger");

    document.getElementById('tabmail').openTab("contentTab", startpage,
                                               msgBundle.getString("whatsNew"));
  },

  /**
   * Looks at the existing prefs and determines if we should show about:rights
   * or not.
   *
   * This is controlled by two prefs:
   *
   *   mail.rights.override
   *     If this pref is set to false, always show the about:rights
   *     notification.
   *     If this pref is set to true, never show the about:rights notification.
   *     If the pref doesn't exist, then we fallback to checking
   *     mail.rights.version.
   *
   *   mail.rights.version
   *     If this pref isn't set or the value is less than the current version
   *     then we show the about:rights notification.
   */
  shouldShowAboutRightsNotification: function(prefs) {
    try {
      return !prefs.getBoolPref("mail.rights.override");
    } catch (e) { }

    return prefs.getIntPref("mail.rights.version") < this._kAboutRightsVersion;
  },

  showAboutRightsNotification: function(prefs) {
    var notifyBox = document.getElementById("mail-notification-box");

    var stringBundle =
      Components.classes["@mozilla.org/intl/stringbundle;1"]
                .getService(Components.interfaces.nsIStringBundleService)
    var brandBundle =
      stringBundle.createBundle("chrome://branding/locale/brand.properties");
    var rightsBundle =
      stringBundle.createBundle("chrome://messenger/locale/aboutRights.properties");

    var productName = brandBundle.GetStringFromName("brandFullName");
    var notifyRightsText = rightsBundle.formatStringFromName("notifyRightsText",
                                                             [productName], 1);
    var rightsTitle = rightsBundle.GetStringFromName("aboutRightsTitle");

    var buttons = [
      {
        label: rightsBundle.GetStringFromName("buttonLabel"),
        accessKey: rightsBundle.GetStringFromName("buttonAccessKey"),
        popup: null,
        callback: function(aNotificationBar, aButton) {
          // Show the about:rights tab
          document.getElementById('tabmail').openTab("contentTab",
                                                     "about:rights",
                                                     rightsTitle);
        }
      }
    ];

    var box = notifyBox.appendNotification(notifyRightsText, "about-rights",
                                           null, notifyBox.PRIORITY_INFO_LOW,
                                           buttons);
    // arbitrary number, just so bar sticks around for a bit
    box.persistence = 3;

    // Set the pref to say we've displayed the notification.
    prefs.setIntPref("mail.rights.version", this._kAboutRightsVersion);
  }
}
