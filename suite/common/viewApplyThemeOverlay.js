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
 * The Original Code is this file as it was released upon September 19, 2011.
 *
 * The Initial Developer of the Original Code is
 * Neil Rashbrook.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Neil Rashbrook <neil@parkwaycc.co.uk> (Original Author)
 *   Jens Hatlak <jh@junetz.de>
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
