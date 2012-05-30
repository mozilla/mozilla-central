/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const kBehaviorBit = {
  matchOnlyURLs: 16,
  matchOnlyTyped: 32
};

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

  if (!document.getElementById("browser.urlbar.default.behavior").locked) {
    document.getElementById("matchOnlyTyped").disabled = matchDisabled;
    document.getElementById("matchOnlyURLs").disabled = matchDisabled;
  }

  if (!document.getElementById("browser.urlbar.matchBehavior").locked)
    document.getElementById("matchBehavior").disabled = matchDisabled;
}

function ReadDefaultBehavior(aField)
{
  var curval = document.getElementById("browser.urlbar.default.behavior").value;
  // Return the right bit based on the id of "aField"
  return (curval & kBehaviorBit[aField.id]) != 0;
}

function WriteDefaultBehavior(aField)
{
  var curval = document.getElementById("browser.urlbar.default.behavior").value;
  // Only care about the bit we have to change
  if (aField.checked)
    return curval | kBehaviorBit[aField.id];

  return curval & ~kBehaviorBit[aField.id];
}
