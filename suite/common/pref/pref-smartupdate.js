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
  var aus = Components.classes["@mozilla.org/updates/update-service;1"]
                      .getService(Components.interfaces.nsIApplicationUpdateService);
  gCanCheckForUpdates = aus.canCheckForUpdates;

  UpdateAddonsItems();
  UpdateAppItems();
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
 * app.update.mode
 * - an integer:
 *   mode:  Minor Releases:                       Major Releases:
 *   0      download and install, never prompt    always prompt
 *
 *   1,2    download and install,                 always prompt
 *          no prompt if no incompatible add-ons
 *
 * The app.update.mode preference is converted into a true/false value for
 * use in determining whether the "Warn me if this will disable extensions
 * or themes" checkbox is checked. Unlike other toolkit applications we
 * don't care about supporting legacy mode 2.
 *
 * app.update.mode    Checkbox State    Meaning
 * 0                  Unchecked         Warn if the update is major
 * 1,2                Checked           Warn if there are incompatibilities
 *                                      or the update is major
 */
function UpdateAddonsItems()
{
  document.getElementById("extensionsUpdatesEnabled").disabled =
    !document.getElementById("xpinstall.enabled").value ||
    document.getElementById("extensions.update.enabled").locked;

  document.getElementById("extensionsUpdateFrequency").disabled =
    !document.getElementById("xpinstall.enabled").value ||
    !document.getElementById("extensions.update.enabled").value ||
    document.getElementById("extensions.update.interval").locked;
}

function UpdateAppItems()
{
  var enabledPref = document.getElementById("app.update.enabled");

  document.getElementById("appUpdatesEnabled").disabled =
    !gCanCheckForUpdates || enabledPref.locked;

  document.getElementById("appUpdateFrequency").disabled =
    !enabledPref.value || !gCanCheckForUpdates ||
    document.getElementById("app.update.interval").locked;
  UpdateAutoItems();
}

/**
 * Enables/disables UI for "when updates are found" based on the values,
 * and "locked" states of associated preferences.
 */
function UpdateAutoItems()
{
  var disabled = !gCanCheckForUpdates||
                 !document.getElementById("app.update.enabled").value ||
                 document.getElementById("app.update.auto").locked;
  document.getElementById("updateModeLabel").disabled = disabled;
  document.getElementById("updateMode").disabled = disabled;
  UpdateModeItems();
}

/**
 * Enables/disables the "warn if incompatible extensions/themes exist" UI
 * based on the values and "locked" states of various preferences.
 */
function UpdateModeItems()
{
  document.getElementById("warnIncompatible").disabled =
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
