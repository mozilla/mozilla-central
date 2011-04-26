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
 * Portions created by the Initial Developer are Copyright (C) 1998-2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mark Banner <bugzilla@standard8.plus.com>
 *   Edmund Wong <ewong@pw-wspx.org>
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

var gCanCheckForUpdates;

function Startup()
{
  var hasUpdater = "nsIApplicationUpdateService" in Components.interfaces;

  if (hasUpdater)
  {
    var aus = Components.classes["@mozilla.org/updates/update-service;1"]
                        .getService(Components.interfaces.nsIApplicationUpdateService);
    gCanCheckForUpdates = aus.canCheckForUpdates;

    UpdateAddonsItems();
    UpdateAppItems();
  }
  else
  {
    var appGroupBox = document.getElementById("appUpdatesGroupBox");
    appGroupBox.hidden = true;
  }
}

/*
 * Preferences:
 *
 * app.update.enabled
 * - boolean:
 * - true if updates to the application are enabled, false otherwise
 * extensions.update.enabled
 * - boolean:
 * - true if updates to extensions and themes are enabled, false otherwise
 * app.update.auto
 * - true if updates should be automatically downloaded and installed,
 *   possibly with a warning if incompatible extensions are installed (see
 *   app.update.mode); false if the user should be asked what he wants to do
 *   when an update is available
 */
function UpdateAddonsItems()
{
  var addOnsCheck = !document.getElementById("xpinstall.enabled").value;

  document.getElementById("addOnsUpdatesEnabled").disabled =
    addOnsCheck ||
    document.getElementById("extensions.update.enabled").locked;

  document.getElementById("addOnsUpdateFrequency").disabled =
    !document.getElementById("xpinstall.enabled").value ||
    !document.getElementById("extensions.update.enabled").value ||
    document.getElementById("extensions.update.interval").locked;

  document.getElementById("allowedSitesLink").disabled =
    addOnsCheck;

  document.getElementById("addOnsModeAutoEnabled").disabled =
    addOnsCheck ||
    !document.getElementById("extensions.update.enabled").value ||
    document.getElementById("extensions.update.enabled").locked;
}

function UpdateAppItems()
{
  var enabledPref = document.getElementById("app.update.enabled");

  document.getElementById("appUpdatesEnabled").disabled =
    !gCanCheckForUpdates || enabledPref.locked;

  document.getElementById("appUpdateFrequency").disabled =
    !enabledPref.value || !gCanCheckForUpdates ||
    document.getElementById("app.update.interval").locked;

  document.getElementById("appModeAutoEnabled").disabled =
    !enabledPref.value || !gCanCheckForUpdates ||
    document.getElementById("app.update.mode").locked;

  UpdateAutoItems();
}

/**
 * Enables/disables UI for "when updates are found" based on the values,
 * and "locked" states of associated preferences.
 */
function UpdateAutoItems()
{
  document.getElementById("appWarnIncompatible").disabled =
    !gCanCheckForUpdates ||
    !document.getElementById("app.update.enabled").value ||
    !document.getElementById("app.update.auto").value ||
    document.getElementById("app.update.mode").locked;
}

/**
 * Displays the history of installed updates.
 */
function ShowUpdateHistory()
{
  Components.classes["@mozilla.org/updates/update-prompt;1"]
            .createInstance(Components.interfaces.nsIUpdatePrompt)
            .showUpdateHistory(window);
}
