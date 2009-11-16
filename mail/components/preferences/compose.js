# -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 4 -*-
# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is the Thunderbird Preferences System.
#
# The Initial Developer of the Original Code is
# Scott MacGregor.
# Portions created by the Initial Developer are Copyright (C) 2005
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#   Scott MacGregor <mscott@mozilla.org>
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK *****

var gComposePane = {
  mInitialized: false,
  mSpellChecker: null,
  mDictCount : 0,

  init: function ()
  {
    this.enableAutocomplete();

    this.initLanguageMenu();

    this.populateFonts();

    document.getElementById('downloadDictionaries').setAttribute('getDictionariesURL', this.getDictionaryURL());

    var preference = document.getElementById("mail.preferences.compose.selectedTabIndex");
    if (preference.value)
      document.getElementById("composePrefs").selectedIndex = preference.value;
    this.mInitialized = true;
  },

  getDictionaryURL: function()
  {
    var formatter = Components.classes["@mozilla.org/toolkit/URLFormatterService;1"]
                    .getService(Components.interfaces.nsIURLFormatter);

    return formatter.formatURLPref("spellchecker.dictionaries.download.url");
  },

  tabSelectionChanged: function ()
  {
    if (this.mInitialized)
    {
      var preference = document.getElementById("mail.preferences.compose.selectedTabIndex");
      preference.valueFromPreferences = document.getElementById("composePrefs").selectedIndex;
    }
  },

  sendOptionsDialog: function()
  {
    document.documentElement.openSubDialog("chrome://messenger/content/preferences/sendoptions.xul","", null);
  },

  attachmentReminderOptionsDialog: function()
  {
    document.documentElement.openSubDialog("chrome://messenger/content/preferences/attachmentReminder.xul", "", null);
  },

  htmlComposeDialog: function()
  {
    document.documentElement.openSubDialog("chrome://messenger/content/preferences/htmlcompose.xul","", null);
  },

  enableElement: function(aElement, aEnable)
  {
    var pref = document.getElementById(aElement.getAttribute("preference"));
    var enabled = aEnable && !pref.locked;

    aElement.disabled = !enabled;
  },

  enableAutocomplete: function()
  {
    var acLDAPPref = document.getElementById("ldap_2.autoComplete.useDirectory")
                             .value;

    this.enableElement(document.getElementById("directoriesList"), acLDAPPref);
    this.enableElement(document.getElementById("editButton"), acLDAPPref);
  },

  editDirectories: function()
  {
    window.openDialog("chrome://messenger/content/addressbook/pref-editdirectories.xul",
                      "editDirectories", "chrome,modal=yes,resizable=no", null);
  },

  initLanguageMenu: function ()
  {
    var languageMenuList = document.getElementById("languageMenuList");
    this.mSpellChecker = Components.classes['@mozilla.org/spellchecker/engine;1'].getService(Components.interfaces.mozISpellCheckingEngine);
    var o1 = {};
    var o2 = {};

    // Get the list of dictionaries from
    // the spellchecker.

    this.mSpellChecker.getDictionaryList(o1, o2);

    var dictList = o1.value;
    var count    = o2.value;

    // if we don't have any dictionaries installed, disable the menu list
    languageMenuList.disabled = !count;

    // If dictionary count hasn't changed then no need to update the menu.
    if (this.mDictCount == count)
      return;

    // Store current dictionary count.
    this.mDictCount = count;

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

    for (i = 0; i < count; i++)
    {
      try {
        langId = dictList[i];
        isoStrArray = dictList[i].split(/[-_]/);

        if (languageBundle && isoStrArray[0])
          langLabel = languageBundle.getString(isoStrArray[0].toLowerCase());

        if (regionBundle && langLabel && isoStrArray.length > 1 && isoStrArray[1])
        {
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
      function compareFn(a, b)
      {
        return a[0].localeCompare(b[0]);
      }
    );

    // Remove any languages from the list.
    var languageMenuPopup = languageMenuList.firstChild;
    while (languageMenuPopup.hasChildNodes())
      languageMenuPopup.removeChild(languageMenuPopup.firstChild);

    // append the dictionaries to the menu list...
    for (i = 0; i < count; i++)
      languageMenuList.appendItem(dictList[i][0], dictList[i][1]);

    languageMenuList.setInitialSelection();
  },

  populateFonts: function()
  {
    var fontsList = document.getElementById("FontSelect");
    try
    {
      var enumerator = Components.classes["@mozilla.org/gfx/fontenumerator;1"]
                                 .getService(Components.interfaces.nsIFontEnumerator);
      var localFontCount = { value: 0 }
      var localFonts = enumerator.EnumerateAllFonts(localFontCount);
      for (var i = 0; i < localFonts.length; ++i)
      {
        if (localFonts[i] != "")
          fontsList.appendItem(localFonts[i], localFonts[i]);
      }
    }
    catch(e) { }
    // Choose the item after the list is completely generated.
    var preference = document.getElementById(fontsList.getAttribute("preference"));
    fontsList.value = preference.value;
   },

   restoreHTMLDefaults: function()
   {
     // reset throws an exception if the pref value is already the default so
     // work around that with some try/catch exception handling
     try {
       document.getElementById('msgcompose.font_face').reset();
     } catch (ex) {}

     try {
       document.getElementById('msgcompose.font_size').reset();
     } catch (ex) {}

     try {
       document.getElementById('msgcompose.text_color').reset();
     } catch (ex) {}

     try {
       document.getElementById('msgcompose.background_color').reset();
     } catch (ex) {}
   }
};
