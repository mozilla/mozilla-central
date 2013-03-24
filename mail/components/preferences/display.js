/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var gDisplayPane = {
  mInitialized: false,
  mTagListBox:  null,

  init: function ()
  {
    if (!(("arguments" in window) && window.arguments[1])) {
      // If no tab was specified, select the last used tab.
      let preference = document.getElementById("mail.preferences.display.selectedTabIndex");
      if (preference.value)
        document.getElementById("displayPrefs").selectedIndex = preference.value;
    }
    this._rebuildFonts();
    var menulist = document.getElementById("defaultFont");
    if (menulist.selectedIndex == -1) {
      menulist.insertItemAt(0, "", "", "");
      menulist.selectedIndex = 0;
    }

    this.mInitialized = true;

    this.mTagListBox = document.getElementById("tagList");
    this.buildTagList();
  },

  // FONTS

  /**
   * Populates the default font list in UI.
   */
  _rebuildFonts: function ()
  {
    var langGroupPref = document.getElementById("font.language.group");
    this._selectDefaultLanguageGroup(langGroupPref.value,
          this._readDefaultFontTypeForLanguage(langGroupPref.value) == "serif");
  },

  /**
   * Select the default language group.
   */
  _selectDefaultLanguageGroup: function (aLanguageGroup, aIsSerif)
  {
    const kFontNameFmtSerif         = "font.name.serif.%LANG%";
    const kFontNameFmtSansSerif     = "font.name.sans-serif.%LANG%";
    const kFontNameListFmtSerif     = "font.name-list.serif.%LANG%";
    const kFontNameListFmtSansSerif = "font.name-list.sans-serif.%LANG%";
    const kFontSizeFmtVariable      = "font.size.variable.%LANG%";

    // Make sure font.name-list is created before font.name so that it's
    // available at the time readFontSelection below is called.
    var prefs = [{format: aIsSerif ? kFontNameListFmtSerif : kFontNameListFmtSansSerif,
                  type: "unichar",
                  element: null,
                  fonttype: aIsSerif ? "serif" : "sans-serif" },
                 {format: aIsSerif ? kFontNameFmtSerif : kFontNameFmtSansSerif,
                  type: "fontname",
                  element: "defaultFont",
                  fonttype: aIsSerif ? "serif" : "sans-serif" },
                 {format: kFontSizeFmtVariable,
                  type: "int",
                  element: "defaultFontSize",
                  fonttype: null }];

    var preferences = document.getElementById("displayPreferences");
    for (var i = 0; i < prefs.length; ++i) {
      var preference = document.getElementById(prefs[i].format.replace(/%LANG%/,
                                                               aLanguageGroup));
      if (!preference) {
        preference = document.createElement("preference");
        var name = prefs[i].format.replace(/%LANG%/, aLanguageGroup);
        preference.id = name;
        preference.setAttribute("name", name);
        preference.setAttribute("type", prefs[i].type);
        preferences.appendChild(preference);
      }

      if (!prefs[i].element)
        continue;

      var element = document.getElementById(prefs[i].element);
      if (element) {
        // Make sure we have the font list ready for readFontSelection below to
        // work. readFontSelection gets called at onsyncfrompreference, but the
        // exact semantics of when it is called (whether during setAttribute or
        // during setElementValue) aren't obvious.
        if (prefs[i].fonttype)
          FontBuilder.buildFontList(aLanguageGroup, prefs[i].fonttype, element);

        element.setAttribute("preference", preference.id);

        preference.setElementValue(element);
      }
    }
  },

  /**
   * Returns the type of the current default font for the language denoted by
   * aLanguageGroup.
   */
  _readDefaultFontTypeForLanguage: function (aLanguageGroup)
  {
    const kDefaultFontType = "font.default.%LANG%";
    var defaultFontTypePref = kDefaultFontType.replace(/%LANG%/, aLanguageGroup);
    var preference = document.getElementById(defaultFontTypePref);
    if (!preference) {
      preference = document.createElement("preference");
      preference.id = defaultFontTypePref;
      preference.setAttribute("name", defaultFontTypePref);
      preference.setAttribute("type", "string");
      preference.setAttribute("onchange", "gDisplayPane._rebuildFonts();");
      document.getElementById("displayPreferences").appendChild(preference);
    }
    return preference.value;
  },

  /**
   * Determine the appropriate value to select for defaultFont, for the
   * following cases:
   * - there is no setting
   * - the font selected by the user is no longer present (e.g. deleted from
   *   fonts folder)
   */
  readFontSelection: function gDisplayPane_readFontSelection()
  {
    let element = document.getElementById("defaultFont");
    let preference = document.getElementById(element.getAttribute("preference"));
    if (preference.value) {
      let fontItem = element.querySelector('[value="' + preference.value + '"]');

      // There is a setting that actually is in the list. Respect it.
      if (fontItem)
        return undefined;
    }

    let defaultValue = element.firstChild.firstChild.getAttribute("value");
    let languagePref = document.getElementById("font.language.group");
    let defaultType = this._readDefaultFontTypeForLanguage(languagePref.value);
    let listPref = document.getElementById("font.name-list." + defaultType +
                                           "." + languagePref.value);
    if (!listPref)
      return defaultValue;

    let fontNames = listPref.value.split(",");

    for (let [, fontName] in Iterator(fontNames)) {
      let fontItem = element.querySelector('[value="' + fontName.trim() + '"]');
      if (fontItem)
        return fontItem.getAttribute("value");
    }
    return defaultValue;
  },

  tabSelectionChanged: function ()
  {
    if (this.mInitialized)
      document.getElementById("mail.preferences.display.selectedTabIndex")
              .valueFromPreferences = document.getElementById("displayPrefs").selectedIndex;
  },

  /**
   * Displays the fonts dialog, where web page font names and sizes can be
   * configured.
   */
  configureFonts: function ()
  {
    document.documentElement.openSubDialog("chrome://messenger/content/preferences/fonts.xul",
                                           "", null);
  },

  /**
   * Displays the colors dialog, where default web page/link/etc. colors can be
   * configured.
   */
  configureColors: function ()
  {
    document.documentElement.openSubDialog("chrome://messenger/content/preferences/colors.xul",
                                           "", null);
  },


  // appends the tag to the tag list box
  appendTagItem: function(aTagName, aKey, aColor)
  {
    let item = this.mTagListBox.appendItem(aTagName, aKey);
    item.style.color = aColor;
    return item;
  },

  buildTagList: function()
  {
    let tagArray = MailServices.tags.getAllTags({});
    for (let i = 0; i < tagArray.length; ++i)
    {
      let taginfo = tagArray[i];
      this.appendTagItem(taginfo.tag, taginfo.key, taginfo.color);
    }
  },

  removeTag: function()
  {
    var index = this.mTagListBox.selectedIndex;
    if (index >= 0)
    {
      var itemToRemove = this.mTagListBox.getItemAtIndex(index);
      MailServices.tags.deleteKey(itemToRemove.getAttribute("value"));
      this.mTagListBox.removeItemAt(index);
      var numItemsInListBox = this.mTagListBox.getRowCount();
      this.mTagListBox.selectedIndex = index < numItemsInListBox ? index : numItemsInListBox - 1;
    }
  },

  /**
   * Open the edit tag dialog
   */
  editTag: function()
  {
    var index = this.mTagListBox.selectedIndex;
    if (index >= 0)
    {
      var tagElToEdit = this.mTagListBox.getItemAtIndex(index);
      var args = {result: "", keyToEdit: tagElToEdit.getAttribute("value"), okCallback: editTagCallback};
      var dialog = window.openDialog(
                  "chrome://messenger/content/newTagDialog.xul",
                  "",
                  "chrome,titlebar,modal",
                  args);
    }
  },

  addTag: function()
  {
    var args = {result: "", okCallback: addTagCallback};
    var dialog = window.openDialog(
                 "chrome://messenger/content/newTagDialog.xul",
                 "",
                 "chrome,titlebar,modal",
                 args);
  }
};

function addTagCallback(aName, aColor)
{
  MailServices.tags.addTag(aName, aColor, "");

  var item = gDisplayPane.appendTagItem(aName, MailServices.tags.getKeyForTag(aName), aColor);
  var tagListBox = document.getElementById("tagList");
  tagListBox.ensureElementIsVisible(item);
  tagListBox.selectItem(item);
  tagListBox.focus();
}

function editTagCallback()
{
  // update the values of the selected item
  var tagListEl = document.getElementById("tagList");
  var index = tagListEl.selectedIndex;
  if (index >= 0)
  {
    var tagElToEdit = tagListEl.getItemAtIndex(index);
    var key = tagElToEdit.getAttribute("value");
    // update the color and label elements
    tagElToEdit.setAttribute("label", MailServices.tags.getTagForKey(key));
    tagElToEdit.style.color = MailServices.tags.getColorForKey(key);
  }
}
