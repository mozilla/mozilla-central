/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


// The warden checks URLs to see if they are phishing URLs. It
// does so by querying our locally stored blacklists (privacy
// mode).
//
// Note: There is a single warden for the whole application.

const kPhishWardenEnabledPref = "browser.safebrowsing.enabled";

// We have hardcoded URLs that let people navigate to in order to 
// check out the warning.
const kTestUrls = {
  "http://www.google.com/tools/firefox/safebrowsing/phish-o-rama.html": true,
  "http://www.mozilla.org/projects/bonecho/anti-phishing/its-a-trap.html": true,
  "http://www.mozilla.com/firefox/its-a-trap.html": true,
}

/**
 * Abtracts the checking of user/browser actions for signs of
 * phishing. 
 *
 * @param progressListener nsIDocNavStartProgressListener
 * @constructor
 */
function PROT_PhishingWarden(progressListener) {
  PROT_ListWarden.call(this);

  this.debugZone = "phishwarden";
  this.testing_ = false;

  // Use this to query preferences
  this.prefs_ = new G_Preferences();
  
  // Global preference to enable the phishing warden
  this.phishWardenEnabled_ = this.prefs_.getPref(kPhishWardenEnabledPref, null);

  // Get notifications when the phishing warden enabled pref changes
  var phishWardenPrefObserver = 
    BindToObject(this.onPhishWardenEnabledPrefChanged, this);
  this.prefs_.addObserver(kPhishWardenEnabledPref, phishWardenPrefObserver);
  
  // Get notifications when the data provider pref changes
  var dataProviderPrefObserver =
    BindToObject(this.onDataProviderPrefChanged, this);
  this.prefs_.addObserver(kDataProviderIdPref, dataProviderPrefObserver);

  G_Debug(this, "phishWarden initialized");
}

PROT_PhishingWarden.inherits(PROT_ListWarden);

/**
 * We implement nsIWebProgressListener
 */
PROT_PhishingWarden.prototype.QueryInterface = function(iid) {
  if (iid.equals(Ci.nsISupports) || 
      iid.equals(Ci.nsISupportsWeakReference))
    return this;
  throw Components.results.NS_ERROR_NO_INTERFACE;
}

/**
 * Cleanup on shutdown.
 */
PROT_PhishingWarden.prototype.shutdown = function() {
  this.prefs_.removeAllObservers();
}

/**
 * When a preference (either advanced features or the phishwarden
 * enabled) changes, we might have to start or stop asking for updates. 
 * 
 * This is a little tricky; we start or stop management only when we
 * have complete information we can use to determine whether we
 * should.  It could be the case that one pref or the other isn't set
 * yet (e.g., they haven't opted in/out of advanced features). So do
 * nothing unless we have both pref values -- we get notifications for
 * both, so eventually we will start correctly.
 */ 
PROT_PhishingWarden.prototype.maybeToggleUpdateChecking = function() {
  if (this.testing_)
    return;

  var phishWardenEnabled = this.prefs_.getPref(kPhishWardenEnabledPref, null);

  // Do nothing unless the phishing warden pref is set.  It can be null (unset), true, or
  // false.
  if (phishWardenEnabled === null)
    return;

  // We update and save to disk all tables if we don't have remote checking
  // enabled.
  if (phishWardenEnabled === true) {
    // If anti-phishing is enabled, we always download the local files to
    // use in case remote lookups fail.
    this.enableBlacklistTableUpdates();
    this.enableWhitelistTableUpdates();
  } else {
    // Anti-phishing is off, disable table updates
    this.disableBlacklistTableUpdates();
    this.disableWhitelistTableUpdates();
  }
}

/**
 * Deal with a user changing the pref that says whether we should 
 * enable the phishing warden (i.e., that SafeBrowsing is active)
 *
 * @param prefName Name of the pref holding the value indicating whether
 *                 we should enable the phishing warden
 */
PROT_PhishingWarden.prototype.onPhishWardenEnabledPrefChanged = function(
                                                                    prefName) {
  this.phishWardenEnabled_ = this.prefs_.getPref(prefName, this.phishWardenEnabled_);
  this.maybeToggleUpdateChecking();
}

/**
 * Event fired when the user changes data providers.
 */
PROT_PhishingWarden.prototype.onDataProviderPrefChanged = function(prefName) {
}

/**
 * Indicates if this URL is one of the possible blacklist test URLs.
 * These test URLs should always be considered as phishy.
 *
 * @param url URL to check 
 * @return A boolean indicating whether this is one of our blacklist
 *         test URLs
 */
PROT_PhishingWarden.prototype.isBlacklistTestURL = function(url) {
  // Explicitly check for URL so we don't get JS warnings in strict mode.
  if (kTestUrls[url])
    return true;
  return false;
}

/**
 * Callback for found local blacklist match.  First we report that we have
 * a blacklist hit, then we bring up the warning dialog.
 * @param status Number enum from callback (PROT_ListWarden.IN_BLACKLIST,
 *    PROT_ListWarden.IN_WHITELIST, PROT_ListWarden.NOT_FOUND)
 */
PROT_PhishingWarden.prototype.localListMatch_ = function(url, request, status) {
  if (PROT_ListWarden.IN_BLACKLIST != status)
    return;
}
