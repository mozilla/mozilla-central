/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/mailServices.js");

window.addEventListener("load", function () {
  /**
   * Arguments passed to openDialog() will appear here as follows:
   *
   * @param window.arguments[0]  ID of prefpane to select
   * @param window.arguments[1]  ID of tab to select on the prefpane
   * @param window.arguments[2]  other prefpane specific arguments
   */
  let paneID = null;
  let tabID = null;
  if ("arguments" in window) {
    paneID = window.arguments[0];
    tabID = window.arguments[1];
  }

  let prefWindow = document.getElementById("MailPreferences");
  if (!Services.prefs.getBoolPref("mail.chat.enabled")) {
    let radio =
      document.getAnonymousElementByAttribute(prefWindow, "pane", "paneChat");
    if (radio.selected)
      prefWindow.showPane(document.getElementById("paneGeneral"));
    radio.hidden = true;
  }

  selectPaneAndTab(prefWindow, paneID, tabID);
});

/**
 * Selects the specified preferences pane
 *
 * @param prefWindow  the prefwindow element to operate on
 * @param aPaneID     ID of prefpane to select
 * @param aTabID      ID of tab to select on the prefpane
 */
function selectPaneAndTab(prefWindow, aPaneID, aTabID) {
  if (aPaneID) {
    let prefPane = document.getElementById(aPaneID);
    let tabOnEvent = false;
    // The prefwindow element selects the pane specified in window.arguments[0]
    // automatically. But let's check it and if the prefs window was already
    // open, the current prefpane may not be the wanted one.
    if (prefWindow.currentPane.id != prefPane.id) {
      if (aTabID && !prefPane.loaded) {
        prefPane.addEventListener("paneload", function() {
          prefPane.removeEventListener("paneload", arguments.callee);
          showTab(prefPane, aTabID);
        });
        tabOnEvent = true;
      }
      prefWindow.showPane(prefPane);
    }
    if (aTabID && !tabOnEvent)
      showTab(prefPane, aTabID);
  }
}

/**
 * Select the specified tab
 *
 * @param aPane   prefpane to operate on
 * @param aTabID  ID of tab to select on the prefpane
 */
function showTab(aPane, aTabID) {
    aPane.querySelector("tabbox").selectedTab = document.getElementById(aTabID);
}
