/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
