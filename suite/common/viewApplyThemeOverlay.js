/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-

 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/AddonManager.jsm");

var gThemes = [];
var gApplyThemeBundle;

function reloadThemes()
{
  AddonManager.getAddonsByTypes(["theme"], function(themes) {
    gThemes = themes.sort(function(a, b) {
      return a.name.localeCompare(b.name);
    });
  });
}

const gAddonListener = {
  onEnabling: function(val) {},
  onEnabled: function(val) {},
  onDisabling: function(val) {},
  onDisabled: function(val) {},
  onInstalling: function(val) {},
  onInstalled: reloadThemes,
  onUninstalling: function(val) {},
  onUninstalled: reloadThemes,
  onOperationCancelled: reloadThemes
};

function getNewThemes()
{
  // get URL for more themes from prefs
  try {
    openTopWin(Services.urlFormatter.formatURLPref("extensions.getMoreThemesURL"));
  }
  catch (e) {
    dump(e);
  }
}

function getPersonas()
{
  // get URL for more themes from prefs
  try {
    openTopWin(Services.urlFormatter.formatURLPref("extensions.getPersonasURL"));
  }
  catch (e) {
    dump(e);
  }
}

function checkTheme(popup)
{
  while (popup.lastChild.localName != 'menuseparator')
    popup.removeChild(popup.lastChild);
  gThemes.forEach(function(theme) {
    var menuitem = document.createElement('menuitem');
    menuitem.setAttribute("label", theme.name);
    menuitem.setAttribute("type", "radio");
    menuitem.setAttribute("name", "themeGroup");
    if (!theme.userDisabled)
      menuitem.setAttribute("checked", "true");
    else if (!(theme.permissions & AddonManager.PERM_CAN_ENABLE))
      menuitem.setAttribute("disabled", "true");
    menuitem.theme = theme;
    popup.appendChild(menuitem);
  });
}

function restartApp()
{
  // Notify all windows that an application quit has been requested.
  var cancelQuit = Components.classes["@mozilla.org/supports-PRBool;1"]
                             .createInstance(Components.interfaces.nsISupportsPRBool);

  Services.obs.notifyObservers(cancelQuit, "quit-application-requested", "restart");

  // Something aborted the quit process.
  if (cancelQuit.data)
    return;

  Services.prefs.setBoolPref("browser.sessionstore.resume_session_once", true);
  const nsIAppStartup = Components.interfaces.nsIAppStartup;
  Components.classes["@mozilla.org/toolkit/app-startup;1"]
            .getService(nsIAppStartup)
            .quit(nsIAppStartup.eRestart | nsIAppStartup.eAttemptQuit);
}

function applyTheme(menuitem)
{
  if (!menuitem.theme)
    return;

  menuitem.theme.userDisabled = false;
  if (!menuitem.theme.isActive) {
    var promptTitle = gApplyThemeBundle.getString("switchskinstitle");
    // gBrandBundle: bundle_brand stringbundle from overlayed XUL file
    var brandName = gBrandBundle.getString("brandShortName");
    var promptMsg = gApplyThemeBundle.getFormattedString("switchskins", [brandName]);
    var promptNow = gApplyThemeBundle.getString("switchskinsnow");
    var promptLater = gApplyThemeBundle.getString("switchskinslater");
    var check = {value: false};
    var flags = Services.prompt.BUTTON_POS_0 * Services.prompt.BUTTON_TITLE_IS_STRING +
                Services.prompt.BUTTON_POS_1 * Services.prompt.BUTTON_TITLE_IS_STRING;
    var pressedVal = Services.prompt.confirmEx(window, promptTitle, promptMsg,
                                               flags, promptNow, promptLater,
                                               null, null, check);
    if (pressedVal == 0)
      restartApp();
  }
}

function applyThemeOnLoad()
{
  // init globals
  gApplyThemeBundle = document.getElementById("bundle_viewApplyTheme");
  AddonManager.addAddonListener(gAddonListener);
  reloadThemes();

  addEventListener("unload", applyThemeOnUnload, false);
}

function applyThemeOnUnload()
{
  AddonManager.removeAddonListener(gAddonListener);
}

addEventListener("load", applyThemeOnLoad, false);
