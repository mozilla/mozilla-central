/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


// A class that encapsulates data provider specific values.  The
// root of the provider pref tree is browser.safebrowsing.provider.
// followed by a number, followed by specific properties.  The properties
// that a data provider can supply are:
//
// name: The name of the provider
// lookupURL: The URL to send requests to in enhanced mode
// keyURL: Before we send URLs in enhanced mode, we need to encrypt them
// reportURL: When shown a warning bubble, we send back the user decision
//            (get me out of here/ignore warning) to this URL (strip cookies
//            first).  This is optional.
// reportGenericURL: HTML page for general user feedback
// reportPhishURL: HTML page for notifying the provider of a new phishing page
// reportErrorURL: HTML page for notifying the provider of a false positive

Components.utils.import("resource://gre/modules/Services.jsm");

const kDataProviderIdPref = 'browser.safebrowsing.dataProvider';
const kProviderBasePref = 'browser.safebrowsing.provider.';

const MOZ_PARAM_LOCALE = /\{moz:locale\}/g;
const MOZ_PARAM_CLIENT = /\{moz:client\}/g;
const MOZ_PARAM_BUILDID = /\{moz:buildid\}/g;
const MOZ_PARAM_VERSION = /\{moz:version\}/g;

/**
 * Information regarding the data provider.
 */
function PROT_DataProvider() {
  this.prefs_ = new G_Preferences();

  this.loadDataProviderPrefs_();
  
  // Watch for changes in the data provider and update accordingly.
  this.prefs_.addObserver(kDataProviderIdPref,
                          BindToObject(this.loadDataProviderPrefs_, this));

  // Watch for when anti-phishing is toggled on or off.
  this.prefs_.addObserver(kPhishWardenEnabledPref,
                          BindToObject(this.loadDataProviderPrefs_, this));
}

/**
 * Populate all the provider variables.  We also call this when whenever
 * the provider id changes.
 */
PROT_DataProvider.prototype.loadDataProviderPrefs_ = function() {
  // Currently, there's no UI for changing local list provider so we
  // hard code the value for provider 0.
  this.updateURL_ = this.getUrlPref_(
        'browser.safebrowsing.provider.0.updateURL');

  var id = this.prefs_.getPref(kDataProviderIdPref, null);

  // default to 0
  if (null == id)
    id = 0;
  
  var basePref = kProviderBasePref + id + '.';

  this.name_ = this.prefs_.getPref(basePref + "name", "");

  // Urls used to get data from a provider
  this.lookupURL_ = this.getUrlPref_(basePref + "lookupURL");
  this.keyURL_ = this.getUrlPref_(basePref + "keyURL");
  this.reportURL_ = this.getUrlPref_(basePref + "reportURL");

  // Urls to HTML report pages
  this.reportGenericURL_ = this.getUrlPref_(basePref + "reportGenericURL");
  this.reportErrorURL_ = this.getUrlPref_(basePref + "reportErrorURL");
  this.reportPhishURL_ = this.getUrlPref_(basePref + "reportPhishURL");

  // Propogate the changes to the list-manager.
  this.updateListManager_();
}

/**
 * The list manager needs urls to operate.  It needs a url to know where the
 * table updates are, and it needs a url for decrypting enchash style tables.
 */
PROT_DataProvider.prototype.updateListManager_ = function() {
  var listManager = Cc["@mozilla.org/url-classifier/listmanager;1"]
                      .getService(Ci.nsIUrlListManager);

  // If we add support for changing local data providers, we need to add a
  // pref observer that sets the update url accordingly.
  listManager.setUpdateUrl(this.getUpdateURL());

  // setKeyUrl has the side effect of fetching a key from the server.
  // This shouldn't happen if anti-phishing is disabled, so we need to
  // check for that.
  var isEnabled = this.prefs_.getPref(kPhishWardenEnabledPref, false);
  if (isEnabled) {
    listManager.setKeyUrl(this.getKeyURL());
  }
}

/**
 * Lookup the value of a URL from prefs file and do parameter substitution.
 */
PROT_DataProvider.prototype.getUrlPref_ = function(prefName) {
  var url = this.prefs_.getPref(prefName);

  // What value should we use here for Thunderbird??
  var mozClientStr = Services.appinfo.name;

  // Parameter substitution
  url = url.replace(MOZ_PARAM_LOCALE, this.getLocale_());
  url = url.replace(MOZ_PARAM_CLIENT, mozClientStr + Services.appinfo.version);
  url = url.replace(MOZ_PARAM_BUILDID, Services.appinfo.appBuildID);
  url = url.replace(MOZ_PARAM_VERSION, Services.appinfo.platformVersion);
  return url;
}

/**
 * @return String the user locale (similar code is in nsSearchService.js)
 */
PROT_DataProvider.prototype.getLocale_ = function() {
  const localePref = "general.useragent.locale";
  var locale = this.getLocalizedPref_(localePref);
  if (locale)
    return locale;

  // Not localized
  var prefs = new G_Preferences();
  return prefs.getPref(localePref, "");
}

/**
 * @return String name of the localized pref, null if none exists.
 */
PROT_DataProvider.prototype.getLocalizedPref_ = function(aPrefName) {
  // G_Preferences doesn't know about complex values, so we use the
  // xpcom object directly.
  try {
    return Services.prefs.getComplexValue(aPrefName, Ci.nsIPrefLocalizedString).data;
  } catch (ex) {
  }
  return "";
}

//////////////////////////////////////////////////////////////////////////////
// Getters for the remote provider pref values mentioned above.
PROT_DataProvider.prototype.getName = function() {
  return this.name_;
}

PROT_DataProvider.prototype.getUpdateURL = function() {
  return this.updateURL_;
}

PROT_DataProvider.prototype.getLookupURL = function() {
  return this.lookupURL_;
}
PROT_DataProvider.prototype.getKeyURL = function() {
  return this.keyURL_;
}
PROT_DataProvider.prototype.getReportURL = function() {
  return this.reportURL_;
}

PROT_DataProvider.prototype.getReportGenericURL = function() {
  return this.reportGenericURL_;
}
PROT_DataProvider.prototype.getReportErrorURL = function() {
  return this.reportErrorURL_;
}
PROT_DataProvider.prototype.getReportPhishURL = function() {
  return this.reportPhishURL_;
}
