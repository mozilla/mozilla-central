/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/AddonManager.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

function restartApp() {
  var appStartup = Components.classes["@mozilla.org/toolkit/app-startup;1"]
                             .getService(Components.interfaces.nsIAppStartup);
  appStartup.quit(appStartup.eForceQuit | appStartup.eRestart);
}

function clearAllPrefs() {
  Services.prefs.resetUserPrefs();

  // Remove the pref-overrides dir, if it exists.
  try {
    var fileLocator = Components.classes["@mozilla.org/file/directory_service;1"]
                                .getService(Components.interfaces.nsIProperties);
    const NS_APP_PREFS_OVERRIDE_DIR = "PrefDOverride";
    var prefOverridesDir = fileLocator.get(NS_APP_PREFS_OVERRIDE_DIR,
                                           Components.interfaces.nsIFile);
    prefOverridesDir.remove(true);
  } catch (ex) {
    Components.utils.reportError(ex);
  }
}

function restoreDefaultBookmarks() {
  Services.prefs.setBoolPref("browser.bookmarks.restore_default_bookmarks", true);
}

function deleteLocalstore() {
  const nsIDirectoryServiceContractID = "@mozilla.org/file/directory_service;1";
  const nsIProperties = Components.interfaces.nsIProperties;
  var directoryService = Components.classes[nsIDirectoryServiceContractID]
                                   .getService(nsIProperties);
  var localstoreFile = directoryService.get("LStoreS", Components.interfaces.nsIFile);
  if (localstoreFile.exists())
    localstoreFile.remove(false);
}

function disableAddons() {
  AddonManager.getAllAddons(function(aAddons) {
    aAddons.forEach(function(aAddon) {
      if (aAddon.type == "theme") {
        // Setting userDisabled to false on the default theme activates it,
        // disables all other themes and deactivates the applied persona, if
        // any.
        const DEFAULT_THEME_ID = "{972ce4c6-7e08-4474-a285-3208198ce6fd}";
        if (aAddon.id == DEFAULT_THEME_ID)
          aAddon.userDisabled = false;
      }
      else {
        aAddon.userDisabled = true;
      }
    });

    restartApp();
  });
}

function restoreDefaultSearchEngines() {
  var searchService = Components.classes["@mozilla.org/browser/search-service;1"]
                                .getService(Components.interfaces.nsIBrowserSearchService);
  searchService.restoreDefaultEngines();
}

function onOK() {
  try {
    if (document.getElementById("resetUserPrefs").checked)
      clearAllPrefs();
    if (document.getElementById("deleteBookmarks").checked)
      restoreDefaultBookmarks();
    if (document.getElementById("resetToolbars").checked)
      deleteLocalstore();
    if (document.getElementById("restoreSearch").checked)
      restoreDefaultSearchEngines();
    if (document.getElementById("disableAddons").checked) {
      disableAddons();
      // disableAddons will asynchronously restart the application
      return false;
    }
  } catch(e) {
  }

  restartApp();
  return false;
}

function onCancel() {
  var appStartup = Components.classes["@mozilla.org/toolkit/app-startup;1"]
                             .getService(Components.interfaces.nsIAppStartup);
  appStartup.quit(appStartup.eForceQuit);
  return false;
}

function onLoad() {
  document.documentElement.getButton("extra1").focus();
}

function UpdateOKButtonState() {
  document.documentElement.getButton("accept").disabled =
    !document.getElementsByAttribute("checked", "true").item(0);
}
