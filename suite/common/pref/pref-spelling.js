/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

var gDictCount = 0;
var gLastSelectedLang;

function Startup() {
  if ("@mozilla.org/spellchecker;1" in Components.classes)
    InitLanguageMenu();
  else
  {
    document.getElementById("generalSpelling").hidden = true;
    document.getElementById("mailSpelling").hidden = true;
    document.getElementById("noSpellCheckLabel").hidden = false;
  }
}

function InitLanguageMenu() {
  var spellChecker = Components.classes["@mozilla.org/spellchecker/engine;1"]
                               .getService(Components.interfaces.mozISpellCheckingEngine);

  var o1 = {};
  var o2 = {};

  // Get the list of dictionaries from the spellchecker.
  spellChecker.getDictionaryList(o1, o2);

  var dictList = o1.value;
  var count    = o2.value;

  // If dictionary count hasn't changed then no need to update the menu.
  if (gDictCount == count)
    return;

  // Store current dictionary count.
  gDictCount = count;

  // Load the string bundles that will help us map
  // RFC 1766 strings to UI strings.

  // Load the language string bundle.
  var languageBundle = document.getElementById("languageNamesBundle");
  var regionBundle = null;
  // If we have a language string bundle, load the region string bundle.
  if (languageBundle)
    regionBundle = document.getElementById("regionNamesBundle");
  
  var menuStr2;
  var isoStrArray;
  var langId;
  var langLabel;

  for (let i = 0; i < count; i++) {
    try {
      langId = dictList[i];
      isoStrArray = dictList[i].split(/[-_]/);

      if (languageBundle && isoStrArray[0])
        langLabel = languageBundle.getString(isoStrArray[0].toLowerCase());

      if (regionBundle && langLabel && isoStrArray.length > 1 && isoStrArray[1]) {
        menuStr2 = regionBundle.getString(isoStrArray[1].toLowerCase());
        if (menuStr2)
          langLabel += "/" + menuStr2;
      }

      if (langLabel && isoStrArray.length > 2 && isoStrArray[2])
        langLabel += " (" + isoStrArray[2] + ")";

      if (!langLabel)
        langLabel = langId;
    } catch (ex) {
      // getString throws an exception when a key is not found in the
      // bundle. In that case, just use the original dictList string.
      langLabel = langId;
    }
    dictList[i] = [langLabel, langId];
  }
  
  // sort by locale-aware collation
  dictList.sort(
    function compareFn(a, b) {
      return a[0].localeCompare(b[0]);
    }
  );

  var languageMenuList = document.getElementById("languageMenuList");
  // Remove any languages from the list.
  var languageMenuPopup = languageMenuList.firstChild;
  while (languageMenuPopup.firstChild.localName != "menuseparator")
    languageMenuPopup.removeChild(languageMenuPopup.firstChild);

  var curLang  = languageMenuList.value;
  var defaultItem = null;

  for (let i = 0; i < count; i++) {
    let item = languageMenuList.insertItemAt(i, dictList[i][0], dictList[i][1]);
    if (curLang && dictList[i][1] == curLang)
      defaultItem = item;
  }

  // Now make sure the correct item in the menu list is selected.
  if (defaultItem) {
    languageMenuList.selectedItem = defaultItem;
    gLastSelectedLang = defaultItem;
  }
}

function SelectLanguage(aTarget) {
  if (aTarget.value != "more-cmd")
    gLastSelectedLang = aTarget;
  else {
    openDictionaryList();
    if (gLastSelectedLang)
      document.getElementById("languageMenuList").selectedItem = gLastSelectedLang;
  }
}
