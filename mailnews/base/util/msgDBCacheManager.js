/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Message DB Cache manager
 */

/* :::::::: Constants and Helpers ::::::::::::::: */

const EXPORTED_SYMBOLS = ["msgDBCacheManager"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource:///modules/mailServices.js");
Cu.import("resource://gre/modules/Services.jsm");

/**
 */
const DBCACHE_INTERVAL_DEFAULT_MS = 60000; // 1 minute

/* :::::::: The Module ::::::::::::::: */

var msgDBCacheManager =
{
  _initialized: false,

  _msgDBCacheTimer: null,

  _msgDBCacheTimerIntervalMS: DBCACHE_INTERVAL_DEFAULT_MS,

  /**
   * This is called on startup
   */
  init: function dbcachemgr_init()
  {
    if (this._initialized)
      return;

    // we listen for "quit-application-granted" instead of
    // "quit-application-requested" because other observers of the
    // latter can cancel the shutdown.
    Services.obs.addObserver(this, "quit-application-granted", false);

    this.startPeriodicCheck();

    this._initialized = true;
  },

/* ........ Timer Callback ................*/

  _dbCacheCheckTimerCallback: function dbCache_CheckTimerCallback()
  {
    msgDBCacheManager.checkCachedDBs();
  },

/* ........ Observer Notification Handler ................*/

  observe: function dbCache_observe(aSubject, aTopic, aData) {
    switch (aTopic) {
    // This is observed before any windows start unloading if something other
    // than the last 3pane window closing requested the application be
    // shutdown. For example, when the user quits via the file menu.
    case "quit-application-granted":
      Services.obs.removeObserver(this, "quit-application-granted");
      this.stopPeriodicCheck();
      break;
    }
  },

/* ........ Public API ................*/

  /**
   * Stops db cache check
   */
  stopPeriodicCheck: function dbcache_stopPeriodicCheck()
  {
    if (this._dbCacheCheckTimer) {
      this._dbCacheCheckTimer.cancel();

      delete this._dbCacheCheckTimer;
      this._dbCacheCheckTimer = null;
    }
  },

  /**
   * Starts periodic db cache check
   */
  startPeriodicCheck: function dbcache_startPeriodicCheck()
  {
    if (!this._dbCacheCheckTimer) {
      this._dbCacheCheckTimer = Cc["@mozilla.org/timer;1"]
                                   .createInstance(Ci.nsITimer);

      this._dbCacheCheckTimer.initWithCallback(
                                   this._dbCacheCheckTimerCallback,
                                   this._msgDBCacheTimerIntervalMS,
                                   Ci.nsITimer.TYPE_REPEATING_SLACK);
    }
  },
  checkCachedDBs : function ()
  {
    const gDbService = Cc["@mozilla.org/msgDatabase/msgDBService;1"]
                         .getService(Ci.nsIMsgDBService);

    let idleLimit = Services.prefs.getIntPref("mail.db.idle_limit");
    let maxOpenDBs = Services.prefs.getIntPref("mail.db.max_open");

    let closeThreshold = Date.now() - idleLimit;
    const nsMsgFolderFlags = Ci.nsMsgFolderFlags;
    let cachedDBs = gDbService.openDBs;
    let numOpenDBs = 0;
    for (let i = 0; i < cachedDBs.length; i++) {
      db = cachedDBs.queryElementAt(i, Ci.nsIMsgDatabase);
      if (MailServices.mailSession.IsFolderOpenInWindow(db.folder)) {
        numOpenDBs++;
        continue;
      }
      let lruTime = db.lastUseTime / 1000;
      if (lruTime < closeThreshold)
        db.folder.msgDatabase = null;
      numOpenDBs++;
    }
    let openDBs = gDbService.openDBs;
    if (numOpenDBs > maxOpenDBs) {
      let dbs = [];
      for (let i = 0; i < openDBs.length; i++)
        dbs.push(openDBs.queryElementAt(i, Ci.nsIMsgDatabase));
      function sortByLastUse(a, b) {
        return a.lastUseTime > b.lastUseTime;
      }
      dbs.sort(sortByLastUse);
      let dbsToClose = maxOpenDBs - dbs.length;
      for each (let [, db] in Iterator(dbs)) {
        if (MailServices.mailSession.IsFolderOpenInWindow(db.folder))
          continue;
        db.folder.msgDatabase = null;
        if (--dbsToClose == 0)
          break;
      }
    }
  },
};
