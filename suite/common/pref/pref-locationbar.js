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
 * August 15, 2001.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corp.
 * Portions created by the Initial Developer are Copyright (C) 2001
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Diego Biurrun   <diego@biurrun.de>
 *   Ian Neal        <bugzilla@arlen.demon.co.uk>
 *   Stefan Hermes   <stefanh@inbox.com>
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

const kBehaviorURL = 16;

function Startup()
{
  // On systems that has the file view component, autoFill and showPopup will
  // return results from local browsing "history", even if autocomplete.enabled
  // is turned off, so we'll need to remove the dependent look in the ui.

  if ("@mozilla.org/autocomplete/search;1?name=file" in Components.classes)
  {
    // We indent the checkboxes with the class attribute set to "indent", so
    // just remove the attribute.
    document.getElementById("autoFill").removeAttribute("class");
    document.getElementById("showPopup").removeAttribute("class");
  }

  updateDependent(document.getElementById("browser.urlbar.autocomplete.enabled").value);
}

function updateDependent(aValue)
{
  // The match pref checkboxes always depend on autocomplete.enabled.
  updateMatchPrefs();

  // If autoFill has a class attribute, we don't have the file view component.
  // We then need to update autoFill and showPopup.
  if (document.getElementById("autoFill").hasAttribute("class"))
  {
    toggleCheckbox("autoFill", aValue);
    toggleCheckbox("showPopup", aValue);
  }
}

function toggleCheckbox(aCheckbox, aPrefValue)
{
  if (!document.getElementById("browser.urlbar." + aCheckbox).locked)
    document.getElementById(aCheckbox).disabled = !aPrefValue;
}

function updateMatchPrefs()
{
  // The various match prefs don't make sense if both autoFill and showPopup
  // prefs are false or if autocomplete is turned off.
  var autoCompletePref = document.getElementById("browser.urlbar.autocomplete.enabled");
  var autoFillPref = document.getElementById("browser.urlbar.autoFill");
  var showPopupPref = document.getElementById("browser.urlbar.showPopup");

  var matchDisabled = (!autoFillPref.value && !showPopupPref.value) ||
                      !autoCompletePref.value;

  if (!document.getElementById("browser.urlbar.matchOnlyTyped").locked)
    document.getElementById("matchOnlyTyped").disabled = matchDisabled;

  if (!document.getElementById("browser.urlbar.default.behavior").locked)
    document.getElementById("matchOnlyURLs").disabled = matchDisabled;

  if (!document.getElementById("browser.urlbar.matchBehavior").locked)
    document.getElementById("matchBehavior").disabled = matchDisabled;
}

function ReadDefaultBehavior(aField)
{
  var curval = document.getElementById("browser.urlbar.default.behavior").value;
  // Return the right bit
  return (curval & kBehaviorURL) != 0;
}

function WriteDefaultBehavior(aField)
{
  var curval = document.getElementById("browser.urlbar.default.behavior").value;
  // Only care about the bit we have to change
  if (aField.checked)
    return curval | kBehaviorURL;

  return curval & ~kBehaviorURL;
}
