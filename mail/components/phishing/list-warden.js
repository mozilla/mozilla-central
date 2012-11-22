/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// A warden that knows how to register lists with a listmanager and keep them
// updated if necessary.  The ListWarden also provides a simple interface to
// check if a URL is evil or not.  Specialized wardens like the PhishingWarden
// inherit from it.
//
// Classes that inherit from ListWarden are responsible for calling
// enableTableUpdates or disableTableUpdates.  This usually entails
// registering prefObservers and calling enable or disable in the base
// class as appropriate.
//

Components.utils.import("resource://gre/modules/Services.jsm");

/**
 * Abtracts the checking of user/browser actions for signs of
 * phishing. 
 *
 * @constructor
 */
function PROT_ListWarden() {
  this.debugZone = "listwarden";
  var listManager = Cc["@mozilla.org/url-classifier/listmanager;1"]
                      .getService(Ci.nsIUrlListManager);
  this.listManager_ = listManager;

  // Once we register tables, their respective names will be listed here.
  this.blackTables_ = [];
  this.whiteTables_ = [];
}

PROT_ListWarden.IN_BLACKLIST = 0
PROT_ListWarden.IN_WHITELIST = 1
PROT_ListWarden.NOT_FOUND = 2

/**
 * Tell the ListManger to keep all of our tables updated
 */

PROT_ListWarden.prototype.enableBlacklistTableUpdates = function() {
  for (var i = 0; i < this.blackTables_.length; ++i) {
    this.listManager_.enableUpdate(this.blackTables_[i]);
  }
}

/**
 * Tell the ListManager to stop updating our tables
 */

PROT_ListWarden.prototype.disableBlacklistTableUpdates = function() {
  for (var i = 0; i < this.blackTables_.length; ++i) {
    this.listManager_.disableUpdate(this.blackTables_[i]);
  }
}

/**
 * Tell the ListManager to update whitelist tables.  They may be enabled even
 * when other updates aren't, for performance reasons.
 */
PROT_ListWarden.prototype.enableWhitelistTableUpdates = function() {
  for (var i = 0; i < this.whiteTables_.length; ++i) {
    this.listManager_.enableUpdate(this.whiteTables_[i]);
  }
}

/**
 * Tell the ListManager to stop updating whitelist tables.
 */
PROT_ListWarden.prototype.disableWhitelistTableUpdates = function() {
  for (var i = 0; i < this.whiteTables_.length; ++i) {
    this.listManager_.disableUpdate(this.whiteTables_[i]);
  }
}

/**
 * Register a new black list table with the list manager
 * @param tableName - name of the table to register
 * @returns true if the table could be registered, false otherwise
 */

PROT_ListWarden.prototype.registerBlackTable = function(tableName) {
  var result = this.listManager_.registerTable(tableName, false);
  if (result) {
    this.blackTables_.push(tableName);
  }
  return result;
}

/**
 * Register a new white list table with the list manager
 * @param tableName - name of the table to register
 * @returns true if the table could be registered, false otherwise
 */

PROT_ListWarden.prototype.registerWhiteTable = function(tableName) {
  var result = this.listManager_.registerTable(tableName, false);
  if (result) {
    this.whiteTables_.push(tableName);
  }
  return result;
}

/**
 * Method that looks up a url on the whitelist.
 *
 * @param url The URL to check
 * @param callback Function with a single param:
 *       PROT_ListWarden.IN_BLACKLIST, PROT_ListWarden.IN_WHITELIST,
 *       or PROT_ListWarden.NOT_FOUND
 */
PROT_ListWarden.prototype.isWhiteURL = function(url, callback) {
  (new MultiTableQuerier(url,
                         this.whiteTables_,
                         [] /* no blacklists */,
                         callback)).run();
}

/**
 * Method that looks up a url in both the white and black lists.
 *
 * If there is conflict, the white list has precedence over the black list.
 *
 * This is tricky because all database queries are asynchronous.  So we need
 * to chain together our checks against white and black tables.  We use
 * MultiTableQuerier (see below) to manage this.
 *
 * @param msgURI uri corresponding to the message the url came from
 * @param aFailsStaticTests boolean result for whether the url failed our static tests
 * @param url URL to look up
 * @param callback Function with a single param:
 *       PROT_ListWarden.IN_BLACKLIST, PROT_ListWarden.IN_WHITELIST,
 *       or PROT_ListWarden.NOT_FOUND
 */
PROT_ListWarden.prototype.isEvilURL = function(msgURI, aFailsStaticTests, url, callback) {
  var evilCallback = BindToObject(callback,
                                  null,
                                  msgURI,
                                  aFailsStaticTests,
                                  url);

  (new MultiTableQuerier(url,
                         this.whiteTables_,
                         this.blackTables_,
                         evilCallback)).run();
}

/**
 * This class helps us query multiple tables even though each table check
 * is asynchronous.  It provides callbacks for each listManager lookup
 * and decides whether we need to continue querying or not.  After
 * instantiating the method, use run() to invoke.
 *
 * @param url String The url to check
 * @param whiteTables Array of strings with each white table name
 * @param blackTables Array of strings with each black table name
 * @param callback Function to call with result 
 *       PROT_ListWarden.IN_BLACKLIST, PROT_ListWarden.IN_WHITELIST,
 *       or PROT_ListWarden.NOT_FOUND
 */
function MultiTableQuerier(url, whiteTables, blackTables, callback) {
  this.debugZone = "multitablequerier";

  let uri = Services.io.newURI(url, null, null);
  this.principal_ = Services.scriptSecurityManager
                            .getNoAppCodebasePrincipal(uri);

  this.whiteTables_ = {};
  for (var i = 0; i < whiteTables.length; i++) {
    this.whiteTables_[whiteTables[i]] = true;
  }

  this.blackTables_ = {};
  for (var i = 0; i < blackTables.length; i++) {
    this.blackTables_[blackTables[i]] = true;
  }

  this.callback_ = callback;
  this.listManager_ = Cc["@mozilla.org/url-classifier/listmanager;1"]
                      .getService(Ci.nsIUrlListManager);
}

MultiTableQuerier.prototype.run = function() {
  /* ask the dbservice for all the tables to which this URL belongs */
  this.listManager_.safeLookup(this.principal_,
                               BindToObject(this.lookupCallback_, this));
}

MultiTableQuerier.prototype.lookupCallback_ = function(result) {
  if (result == "") {
    this.callback_(PROT_ListWarden.NOT_FOUND);
    return;
  }

  var tableNames = result.split(",");

  /* Check the whitelists */
  for (var i = 0; i < tableNames.length; i++) {
    if (tableNames[i] && this.whiteTables_[tableNames[i]]) {
      this.callback_(PROT_ListWarden.IN_WHITELIST);
      return;
    }
  }

  /* Check the blacklists */
  for (var i = 0; i < tableNames.length; i++) {
    if (tableNames[i] && this.blackTables_[tableNames[i]]) {
      this.callback_(PROT_ListWarden.IN_BLACKLIST);
      return;
    }
  }

  /* Not in any lists we know about */
  this.callback_(PROT_ListWarden.NOT_FOUND);
}
