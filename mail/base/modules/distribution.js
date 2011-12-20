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
 * The Original Code is the Firefox Distribution Customizations.
 *
 * The Initial Developer of the Original Code is Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Dan Mills <thunder@mozilla.com>
 *   Marco Bonardo <mak77@bonardo.net>
 *   Donna Oberes <donna.oberes@gmail.com>
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

EXPORTED_SYMBOLS = ["TBDistCustomizer"];

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

const DISTRIBUTION_CUSTOMIZATION_COMPLETE_TOPIC =
  "distribution-customization-complete";

var TBDistCustomizer = {
  applyPrefDefaults: function TBDistCustomizer_applyPrefDefaults() {
    this._prefDefaultsApplied = true;
    if (!this._ini) {
      return;
    }
    // Grab the sections of the ini file
    let sections = enumToObject(this._ini.getSections());

    // The global section, and several of its fields, is required
    // Function exits if this section and its fields are not present
    if (!sections["Global"]) {
      return;
    }

    // Get the keys in the "Global" section  of the ini file
    let globalPrefs = enumToObject(this._ini.getKeys("Global"));
    if (!(globalPrefs["id"] && globalPrefs["version"] && globalPrefs["about"])) {
      return;
    }

    // Get the entire preferences tree (defaults is an instance of nsIPrefBranch)
    let defaults = Services.prefs.getDefaultBranch(null);

    // Set the following user prefs
    defaults.setCharPref("distribution.id", this._ini.getString("Global", "id"));
    defaults.setCharPref("distribution.version",
                         this._ini.getString("Global", "version"));
    let partnerAbout = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
    if (globalPrefs["about." + this._locale]) {
      partnerAbout.data = this._ini.getString("Global", "about." + this._locale);
    } else {
      partnerAbout.data = this._ini.getString("Global", "about");
    }
    defaults.setComplexValue("distribution.about",
                             Ci.nsISupportsString, partnerAbout);

    if (sections["Preferences"]) {
      let keys = this._ini.getKeys("Preferences");
      while (keys.hasMore()) {
        let key = keys.getNext();
        try {
          // Get the string value of the key 
          let value = eval(this._ini.getString("Preferences", key));
          // After determining what type it is, set the pref
          switch (typeof value) {
          case "boolean":
            defaults.setBoolPref(key, value);
            break;
          case "number":
            defaults.setIntPref(key, value);
            break;
          case "string":
            defaults.setCharPref(key, value);
            break;
          case "undefined": 
            // In case of custom pref created by partner
            defaults.setCharPref(key, value);
            break;
          }
        } catch (e) {
          Cu.reportError(e);
        }
      }
    }

    // Set the prefs in the other sections 

    // We eval() the localizable prefs as well (even though they'll
    // always get set as a string) to keep the INI format consistent:
    // string prefs always need to be in quotes

    let localizedStr = Cc["@mozilla.org/pref-localizedstring;1"]
                         .createInstance(Ci.nsIPrefLocalizedString);
    
    if (sections["LocalizablePreferences"]) {
      let keys = this._ini.getKeys("LocalizablePreferences");
      while (keys.hasMore()) {
        let key = keys.getNext();
        try {
          let value = eval(this._ini.getString("LocalizablePreferences", key));
          value = value.replace("%LOCALE%", this._locale, "g");
          localizedStr.data = "data:text/plain," + key + "=" + value;
          defaults.setComplexValue(key, Ci.nsIPrefLocalizedString, localizedStr);
        } catch (e) {
          Cu.reportError(e);
        }
      }
    }

    if (sections["LocalizablePreferences-" + this._locale]) {
      let keys = this._ini.getKeys("LocalizablePreferences-" + this._locale);
      while (keys.hasMore()) {
        let key = keys.getNext();
        try {
          let value = eval(this._ini.getString("LocalizablePreferences-" + this._locale, key));
          localizedStr.data = "data:text/plain," + key + "=" + value;
          defaults.setComplexValue(key, Ci.nsIPrefLocalizedString, localizedStr);
        } catch (e) {
          Cu.reportError(e);
        }
      }
    }
    return true;
  }
};

XPCOMUtils.defineLazyGetter(TBDistCustomizer, "_ini",
  function TBDistCustomizer_get__ini() {
    let ini = null;
    let iniFile = Services.dirsvc.get("XCurProcD", Ci.nsIFile);
    iniFile.append("distribution");
    iniFile.append("distribution.ini");
    if (iniFile.exists()) {
      ini = Cc["@mozilla.org/xpcom/ini-parser-factory;1"]
              .getService(Ci.nsIINIParserFactory)
              .createINIParser(iniFile);
    }
    return ini;
});

XPCOMUtils.defineLazyGetter(TBDistCustomizer, "_locale",
  function TBDistCustomizer_get__locale() {
    let locale;
    try {
      locale = Services.prefs.getCharPref("general.useragent.locale");
    } 
    catch (e) {
      locale = "en-US";
    }
    return locale;
});

function enumToObject(UTF8Enumerator) {
  let ret = {};
  while (UTF8Enumerator.hasMore()) {
    ret[UTF8Enumerator.getNext()] = 1
  }
  return ret;
}
