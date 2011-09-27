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
 * The Original Code is Test Pilot.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jono X <jono@mozilla.com>
 *   Dan Mills <thunder@mozilla.com>
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

EXPORTED_SYMBOLS = ["MetadataCollector"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://testpilot/modules/string_sanitizer.js");

const LOCALE_PREF = "general.useragent.locale";
const EXTENSION_ID = "tbtestpilot@labs.mozilla.com";
const PREFIX_NS_EM = "http://www.mozilla.org/2004/em-rdf#";
const PREFIX_ITEM_URI = "urn:mozilla:item:";
const UPDATE_CHANNEL_PREF = "app.update.channel";

/* The following preference, if present, stores answers to the basic panel
 * survey, which tell us user's general tech level, and so should be included
 * with any upload.*/
const SURVEY_ANS = "extensions.testpilot.surveyAnswers.basic_panel_survey_2";

// This function copied over from Weave:
function Weave_sha1(string) {
  let converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].
                  createInstance(Ci.nsIScriptableUnicodeConverter);
  converter.charset = "UTF-8";

  let hasher = Cc["@mozilla.org/security/hash;1"]
               .createInstance(Ci.nsICryptoHash);
  hasher.init(hasher.SHA1);

  let data = converter.convertToByteArray(string, {});
  hasher.update(data, data.length);
  let rawHash = hasher.finish(false);

  // return the two-digit hexadecimal code for a byte
  function toHexString(charCode) {
    return ("0" + charCode.toString(16)).slice(-2);
  }
  let hash = [toHexString(rawHash.charCodeAt(i)) for (i in rawHash)].join("");
  return hash;
}

let MetadataCollector = {

  __prefs: null,
  get _prefs() {
    this.__prefs = Cc["@mozilla.org/preferences-service;1"]
      .getService(Ci.nsIPrefBranch);
    return this.__prefs;
  },

  // Collects metadata such as what country you're in, what extensions you have installed, etc.
  getExtensions: function MetadataCollector_getExtensions(callback) {
    //http://lxr.mozilla.org/aviarybranch/source/toolkit/mozapps/extensions/public/nsIExtensionManager.idl
    //http://lxr.mozilla.org/aviarybranch/source/toolkit/mozapps/update/public/nsIUpdateService.idl#45
    //resource://gre/modules/AddonManager.jsm
    Cu.import("resource://gre/modules/AddonManager.jsm");
    let myExtensions = [];
    AddonManager.getAllAddons(function(extensions) {
      for each (let ex in extensions.all) {
        myExtensions.push({ id: Weave_sha1(ex.id), isEnabled: ex.enabled });
      }
      callback(myExtensions);
    });
  },

  getAccessibilities : function MetadataCollector_getAccessibilities() {
    let prefs =
      Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService);
    let branch = prefs.getBranch("accessibility.");
    let accessibilities = [];
    let children = branch.getChildList("", {});
    let length = children.length;
    let prefName;
    let prefValue;

    for (let i = 0; i < length; i++) {
      prefName = "accessibility." + children[i];
      let type = branch.getPrefType(children[i]);
      switch (type) {
      case branch.PREF_STRING:
        prefValue = branch.getCharPref(children[i]);
        break;
      case branch.PREF_INT:
        prefValue = branch.getIntPref(children[i]);
        break;
      case branch.PREF_BOOL:
        prefValue = branch.getBoolPref(children[i]);
        break;
      }
      accessibilities.push({ name: prefName, value: prefValue });
    }

    /* Detect accessibility instantiation
     * (David Bolter's code from bug 577694) */
    let enabled;
    try {
      enabled = Components.manager.QueryInterface(Ci.nsIServiceManager)
                  .isServiceInstantiatedByContractID(
                    "@mozilla.org/accessibilityService;1",
                    Ci.nsISupports);
    } catch (ex) {
      enabled = false;
    }
    accessibilities.push({name: "isInstantiated", value: enabled});

    return accessibilities;
  },

  getLocation: function MetadataCollector_getLocation() {
    // we don't want the lat/long, we just want the country
    // so use the Locale.
    return this._prefs.getCharPref(LOCALE_PREF);
  },

  getVersion: function MetadataCollector_getVersion() {
    return Cc["@mozilla.org/xre/app-info;1"]
      .getService(Ci.nsIXULAppInfo).version;
  },

  getOperatingSystem: function MetadataCollector_getOSVersion() {
    let oscpu = Cc["@mozilla.org/network/protocol;1?name=http"].getService(Ci.nsIHttpProtocolHandler).oscpu;
    let os = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS;
    return os + " " + oscpu;
  },

  getSurveyAnswers: function MetadataCollector_getSurveyAnswers() {
    if (this._prefs.prefHasUserValue(SURVEY_ANS)) {
      let answers = this._prefs.getCharPref(SURVEY_ANS);
      return sanitizeJSONStrings( JSON.parse(answers) );
    } else {
      return "";
    }
  },

  getTestPilotVersion: function MetadataCollector_getTPVersion(callback) {
    Cu.import("resource://gre/modules/AddonManager.jsm");
    AddonManager.getAddonByID(EXTENSION_ID, function(addon) {
      callback(addon.version);
    });
  },

  getUpdateChannel: function MetadataCollector_getUpdateChannel() {
    // TODO should be reading this from default branch
    return this._prefs.getCharPref(UPDATE_CHANNEL_PREF, "");
  },

  getMetadata: function MetadataCollector_getMetadata(callback) {
    let self = this;
    self.getTestPilotVersion(function(tpVersion) {
      self.getExtensions(function(extensions) {
        callback({ extensions: extensions,
                   accessibilities: self.getAccessibilities(),
	           location: self.getLocation(),
	           fxVersion: self.getVersion(),
                   operatingSystem: self.getOperatingSystem(),
                   tpVersion: tpVersion,
                   surveyAnswers: self.getSurveyAnswers(),
                   updateChannel: self.getUpdateChannel()}
                 );
      });
    });
  }
  // TODO if we make a GUID for the user, we keep it here.
};
