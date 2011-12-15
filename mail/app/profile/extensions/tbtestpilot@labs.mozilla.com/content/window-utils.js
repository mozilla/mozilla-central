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
 * The Original Code is Test Pilot.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jono X <jono@mozilla.com>
 *   Jorge jorge@mozilla.com
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

var TestPilotWindowUtils;

(function() {
  const ALL_STUDIES_WINDOW_NAME = "TestPilotAllStudiesWindow";
  const ALL_STUDIES_WINDOW_TYPE = "extensions:testpilot:all_studies_window";
  const FENNEC_APP_ID = "{a23983c0-fd0e-11dc-95ff-0800200c9a66}";
  const THUNDERBIRD_APP_ID = "{3550f703-e582-4d05-9a08-453d09bdfdc6}";

  TestPilotWindowUtils = {
    openAllStudiesWindow: function() {
      // If the window is not already open, open it; but if it is open,
      // focus it instead.
      let wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].
                 getService(Components.interfaces.nsIWindowMediator);
      let allStudiesWindow = wm.getMostRecentWindow(ALL_STUDIES_WINDOW_TYPE);

      if (allStudiesWindow) {
        allStudiesWindow.focus();
      } else {
        allStudiesWindow = window.openDialog(
          "chrome://testpilot/content/all-studies-window.xul",
          ALL_STUDIES_WINDOW_NAME,
          "chrome,titlebar,centerscreen,dialog=no");
      }
    },

    openAllStudies: function() {
      Components.utils.import("resource://testpilot/modules/setup.js");
      if (TestPilotSetup._appID == FENNEC_APP_ID) { // Fennec only
        // BrowserUI.newTab will focus on the content area of the new tab
        BrowserUI.newTab("chrome://testpilot/content/all-studies.html", Browser.selectedTab);
      }
    },

    openInTab: function(url) {
      Components.utils.import("resource://testpilot/modules/setup.js");
      if (TestPilotSetup._appID == FENNEC_APP_ID) {
        // see if url already open in a tab:
        let browserList = Browser.browsers;
        for (let i = 0; i < browserList.length; i++) {
          if (url == browserList[i].currentURI.spec) {
            Browser.selectedTab = browserList[i];
            return;
          }
        }

        // if not, open it:
        Browser.addTab(url, true); // true means bring it to front
      }
      else if (TestPilotSetup._appID == THUNDERBIRD_APP_ID) {
        openContentTab(url);
      }
      else {
        // Desktop implementation:
        let wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                   .getService(Components.interfaces.nsIWindowMediator);
        let enumerator = wm.getEnumerator("navigator:browser");

        while(enumerator.hasMoreElements()) {
          let win = enumerator.getNext();
          let tabbrowser = win.getBrowser();

          // Check each tab of this browser instance
          let numTabs = tabbrowser.browsers.length;
          for (let i = 0; i < numTabs; i++) {
            let currentBrowser = tabbrowser.getBrowserAtIndex(i);
            if (url == currentBrowser.currentURI.spec) {
              tabbrowser.selectedTab = tabbrowser.tabContainer.childNodes[i];
              win.focus();
              return;
            }
          }
        }

        let win = wm.getMostRecentWindow("navigator:browser");
        if (win) {
          let browser = win.getBrowser();
          let tab = browser.addTab(url);
          browser.selectedTab = tab;
          win.focus();
        } else {
          window.open(url);
        }
      }
    },

    getCurrentTabUrl: function() {
      Components.utils.import("resource://testpilot/modules/setup.js");
      if (TestPilotSetup._appID == THUNDERBIRD_APP_ID) {
        return null; // TODO: not sure what to do here
      }
      else {
        let wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                   .getService(Components.interfaces.nsIWindowMediator);
        let win = wm.getMostRecentWindow("navigator:browser");
        let tabbrowser = win.getBrowser();
        let currentBrowser = tabbrowser.selectedBrowser;
        return currentBrowser.currentURI.spec;
      }
    },

    openHomepage: function() {
      let prefs = Components.classes["@mozilla.org/preferences-service;1"]
        .getService(Components.interfaces.nsIPrefBranch);
      let url = prefs.getCharPref("extensions.testpilot.homepageURL");
      this.openInTab(url);
    },

    openFeedbackPage: function(menuItemChosen) {
      Components.utils.import("resource://testpilot/modules/feedback.js");
      FeedbackManager.setCurrUrl(this.getCurrentTabUrl());
      this.openInTab(FeedbackManager.getFeedbackUrl(menuItemChosen));
    },

    openChromeless: function(url) {
      /* Make the window smaller and dialog-boxier
       * Links to discussion group, twitter, etc should open in new
       * tab in main browser window, if we have these links here at all!!
       * Maybe just one link to the main Test Pilot website. */

      // TODO this window opening triggers studies' window-open code.
      // Is that what we want or not?

      let screenWidth = window.screen.availWidth;
      let screenHeight = window.screen.availHeight;
      let width = screenWidth >= 1200 ? 1000 : screenWidth - 200;
      let height = screenHeight >= 1000 ? 800 : screenHeight - 200;

      let win = window.open(url, "TestPilotStudyDetailWindow",
                           "chrome,centerscreen,resizable=yes,scrollbars=yes," +
                           "status=no,width=" + width + ",height=" + height);
      win.focus();
    }
  };
}());
