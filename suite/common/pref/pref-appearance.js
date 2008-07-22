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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * the mozilla.org SeaMonkey project.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Robert Kaiser <kairo@kairo.at>
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

  var langNames = document.getElementById("langNamesBundle");
  var regNames  = document.getElementById("regNamesBundle");

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
