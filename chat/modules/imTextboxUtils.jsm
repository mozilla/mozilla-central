/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const EXPORTED_SYMBOLS = [
  "MessageFormat",
  "TextboxSize",
  "TextboxSpellChecker"
];

Components.utils.import("resource:///modules/imServices.jsm");
const Ci = Components.interfaces;

let MessageFormat = {
  _observedPrefs: [],

  getValues: function mf_getValues() {
    this.unregisterObservers();
    let langGroup =
      Services.prefs.getComplexValue("font.language.group",
                                     Ci.nsIPrefLocalizedString).data;
    let fontGroup = Services.prefs.getCharPref("font.default." + langGroup);
    let fontPref = "font.name." + fontGroup + "." + langGroup;
    let fontSizePref = "font.size.variable." + langGroup;
    this._values = {
      langGroup: langGroup,
      fontGroup: fontGroup,
      font: Services.prefs.getCharPref(fontPref),
      fontIsDefault: !Services.prefs.prefHasUserValue(fontPref),
      fontSize: Services.prefs.getIntPref(fontSizePref),
      fontSizeIsDefault: !Services.prefs.prefHasUserValue(fontSizePref),
      defaultFontSize:
        Services.prefs.getDefaultBranch(null).getIntPref(fontSizePref),
      foregroundColor:
        Services.prefs.getCharPref("browser.display.foreground_color"),
      foregroundColorIsDefault:
        !Services.prefs.prefHasUserValue("browser.display.foreground_color"),
      useSystemColor:
        Services.prefs.getBoolPref("browser.display.use_system_colors")
    };

    this._observedPrefs = [
      "font.language.group",
      "font.default." + langGroup,
      "font.name." + fontGroup + "." + langGroup,
      "font.size.variable." + langGroup,
      "browser.display.foreground_color",
      "browser.display.use_system_colors"
    ];
    for each (let name in this._observedPrefs)
      Services.prefs.addObserver(name, this, false);
  },
  unregisterObservers: function mf_unregisterObservers() {
    for each (let name in this._observedPrefs)
      Services.prefs.removeObserver(name, this);
    this._observedPrefs = [];
  },
  observe: function(aSubject, aTopic, aMsg) {
    this.getValues();
    for each (let textbox in this._textboxes)
      this.styleTextbox(textbox);
  },
  _getColor: function mf__getColor() {
    if (this._values.foregroundColorIsDefault || this._values.useSystemColor)
      return "";
    return this._values.foregroundColor;
  },
  styleTextbox: function mf_styleTextbox(aTextbox) {
    aTextbox.style.color = this._getColor();
    aTextbox.style.fontSize = this._values.fontSize + "px";
    aTextbox.style.fontFamily = this._values.font;
  },
  getMessageStyle: function mf_getMessageStyle() {
    let result = {};

    let color = this._getColor();
    if (color)
      result.color = color;

    if (!this._values.fontSizeIsDefault) {
      result.fontSize = this._values.fontSize;
      result.defaultFontSize = this._values.defaultFontSize;
    }

    if (!this._values.fontIsDefault)
      result.fontFamily = this._values.font;

    return result;
  },
  _textboxes: [],
  registerTextbox: function mf_registerTextbox(aTextbox) {
    if (this._textboxes.indexOf(aTextbox) == -1)
      this._textboxes.push(aTextbox);

    if (this._textboxes.length == 1)
      this.getValues();

    this.styleTextbox(aTextbox);
  },
  unregisterTextbox: function(aTextbox) {
    let index = this._textboxes.indexOf(aTextbox);
    if (index != -1)
      this._textboxes.splice(index, 1);

    if (!this._textboxes.length)
      this.unregisterObservers();
  }
};

let TextboxSize = {
  _textboxAutoResizePrefName: "messenger.conversations.textbox.autoResize",
  get autoResize() {
    delete this.autoResize;
    Services.prefs.addObserver(this._textboxAutoResizePrefName, this, false);
    return this.autoResize =
      Services.prefs.getBoolPref(this._textboxAutoResizePrefName);
  },
  observe: function(aSubject, aTopic, aMsg) {
    if (aTopic == "nsPref:changed" && aMsg == this._textboxAutoResizePrefName)
      this.autoResize = Services.prefs.getBoolPref(aMsg);
  }
};

let TextboxSpellChecker = {
#ifndef MOZ_THUNDERBIRD
  _spellCheckPrefName: "layout.spellcheckDefault",
#else
  _spellCheckPrefName: "mail.spellcheck.inline",
#endif
  _enabled: false,
 getValue: function tsc_getValue() {
#ifndef MOZ_THUNDERBIRD
    this._enabled = !!Services.prefs.getIntPref(this._spellCheckPrefName);
#else
    this._enabled = Services.prefs.getBoolPref(this._spellCheckPrefName);
#endif
  },
  applyValue: function tsc_applyValue(aTextbox) {
    if (this._enabled)
      aTextbox.setAttribute("spellcheck", "true");
    else
      aTextbox.removeAttribute("spellcheck");
  },

  _textboxes: [],
  registerTextbox: function tsc_registerTextbox(aTextbox) {
    if (this._textboxes.indexOf(aTextbox) == -1)
      this._textboxes.push(aTextbox);

    if (this._textboxes.length == 1) {
      Services.prefs.addObserver(this._spellCheckPrefName, this, false);
      this.getValue();
    }

    this.applyValue(aTextbox);
  },
  unregisterTextbox: function tsc_unregisterTextbox(aTextbox) {
    let index = this._textboxes.indexOf(aTextbox);
    if (index != -1)
      this._textboxes.splice(index, 1);

    if (!this._textboxes.length)
      Services.prefs.removeObserver(this._spellCheckPrefName, this);
  },
  observe: function tsc_observe(aSubject, aTopic, aMsg) {
    this.getValue();
    for each (let textbox in this._textboxes)
      this.applyValue(textbox);
  }
};
