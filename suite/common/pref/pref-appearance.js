/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function Startup()
{
  SwitchLocales_Load();
}

/**
 * From locale switcher's switch.js:
 * Load available locales into selection menu
 */
function SwitchLocales_Load() {
  var menulist = document.getElementById("switchLocales");
  var pref = document.getElementById("general.useragent.locale");

  var cr = Components.classes["@mozilla.org/chrome/chrome-registry;1"]
                     .getService(Components.interfaces.nsIToolkitChromeRegistry);

  var langNames = document.getElementById("languageNamesBundle");
  var regNames  = document.getElementById("regionNamesBundle");

  var locales = cr.getLocalesForPackage("global");

  while (locales.hasMore()) {
    var locale = locales.getNext();

    var parts = locale.split(/-/);

    var displayName;
    try {
      displayName = langNames.getString(parts[0]);
      if (parts.length > 1) {
        try {
          displayName += " (" + regNames.getString(parts[1].toLowerCase()) + ")";
        }
        catch (e) {
          displayName += " (" + parts[1] + ")";
        }
      }
    }
    catch (e) {
      displayName = locale;
    }

    menulist.appendItem(displayName, locale);
  }
  pref.setElementValue(menulist);
}

/**
 * determine the appropriate value to select
 * go through element value, pref value and pref default value and use the first one available
 * else fall back to the first available selection
 */
function SelectLocale(aElement)
{
  var matchItems;
  var pref = document.getElementById(aElement.getAttribute("preference"));
  if (pref.value) {
    matchItems = aElement.getElementsByAttribute("value", pref.value);
    // If the pref matches an entry that actually is in the list, use it.
    if (matchItems.length)
      return pref.value;
  }

  if (pref.defaultValue) {
    matchItems = aElement.getElementsByAttribute("value", pref.defaultValue);
    // If the pref's default matches an entry that actually is in the list, use it.
    if (matchItems.length)
      return pref.defaultValue;
  }

  // If prefs can't point us to a valid value and something is set, leave that.
  if (aElement.value)
    return aElement.value;

  // If somehow we still have no value, return the first value in the list
  return aElement.firstChild.firstChild.getAttribute("value");
}
