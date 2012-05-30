/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// We instantiate this variable when we create the application.
var gDataProvider = null;

// An instance of our application is a PROT_Application object. It
// basically just populates a few globals and instantiates wardens and
// the listmanager.

/**
 * An instance of our application. There should be exactly one of these.
 * 
 * Note: This object should instantiated only at profile-after-change
 * or later because the listmanager and the cryptokeymanager need to
 * read and write data files. Additionally, NSS isn't loaded until
 * some time around then (Moz bug #321024).
 *
 * @constructor
 */
function PROT_Application() {
  this.debugZone= "application";
  
  this.PROT_PhishingWarden = PROT_PhishingWarden;

  // Load data provider pref values
  gDataProvider = new PROT_DataProvider();

  // expose the object
  this.wrappedJSObject = this;
}

/**
 * @return String the report phishing URL (localized).
 */
PROT_Application.prototype.getReportPhishingURL = function() {
  return gDataProvider.getReportPhishURL();
}

/**
 * @return String the report error URL (localized).
 */
PROT_Application.prototype.getReportErrorURL = function() {
  return gDataProvider.getReportErrorURL();
}
