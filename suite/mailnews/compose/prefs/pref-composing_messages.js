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
 * The Original Code is SeaMonkey project code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corp.
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Ian Neal <iann_bugzilla@blueyonder.co.uk>.
 *   Bruno Escherl <aqualon@aquachan.de>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

var gLastSelectedLang;
var gDictCount = 0;

function Startup() {
  if ("@mozilla.org/spellchecker;1" in Components.classes)
    InitLanguageMenu();
  else
    document.getElementById("spellingGroup").hidden = true;

  let value = document.getElementById("mail.compose.autosave").value;
  EnableElementById("autoSaveInterval", value, false);
}

function EnableMailComposeAutosaveInterval(aValue) {
  let focus = (document.getElementById("autoSave") == document.commandDispatcher.focusedElement);
  EnableElementById("autoSaveInterval", aValue, focus);
}

function PopulateFonts() {
  var fontsList = document.getElementById("fontSelect");
  try {
    var enumerator = Components.classes["@mozilla.org/gfx/fontenumerator;1"]
                               .getService(Components.interfaces.nsIFontEnumerator);
    var localFontCount = { value: 0 }
    var localFonts = enumerator.EnumerateAllFonts(localFontCount);
    for (var i = 0; i < localFonts.length; ++i) {
      if (localFonts[i] != "") {
        fontsList.appendItem(localFonts[i], localFonts[i]);
      }
    }
  } catch (ex) { }
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
  var languageBundle = document.getElementById("languageBundle");
  var regionBundle = null;
  // If we have a language string bundle, load the region string bundle.
  if (languageBundle)
    regionBundle = document.getElementById("regionBundle");
  
  var menuStr2;
  var isoStrArray;
  var langId;
  var langLabel;
  var i;

  for (i = 0; i < count; i++) {
    try {
      langId = dictList[i];
      isoStrArray = dictList[i].split("-");

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

  for (i = 0; i < count; i++) {
    var item = languageMenuList.insertItemAt(i, dictList[i][0], dictList[i][1]);
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
  try {
    if (aTarget.value != "more-cmd")
      gLastSelectedLang = aTarget;
    else {
      var formatter = Components.classes["@mozilla.org/toolkit/URLFormatterService;1"]
                      .getService(Components.interfaces.nsIURLFormatter);
      window.open(formatter.formatURLPref("spellchecker.dictionaries.download.url"));
      if (gLastSelectedLang)
        document.getElementById("languageMenuList").selectedItem = gLastSelectedLang;
    }
  } catch (ex) {
    dump(ex);
  }
}
