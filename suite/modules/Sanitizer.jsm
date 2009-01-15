/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * The Original Code is the Firefox Sanitizer.
 *
 * The Initial Developer of the Original Code is
 * Ben Goodger.
 * Portions created by the Initial Developer are Copyright (C) 2005
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Ben Goodger <ben@mozilla.org>
 *   Giorgio Maone <g.maone@informaction.com>
 *   Ryan Flint <rflint@dslr.net>
 *   Robert Kaiser <kairo@kairo.at>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

var EXPORTED_SYMBOLS = ["Sanitizer"];

var Sanitizer = {
  get _prefs() {
    delete this._prefs;
    return this._prefs = Components.classes["@mozilla.org/preferences-service;1"]
                                   .getService(Components.interfaces.nsIPrefService)
                                   .getBranch("privacy.sanitize.");
  },

  /**
   * Deletes privacy sensitive data in a batch, optionally showing the 
   * sanitize UI, according to user preferences
   *
   * @returns  null if everything's fine (no error or displayed UI,  which
   *           should handle errors);
   *           an object in the form { itemName: error, ... } on (partial) failure
   */
  sanitize: function(aParentWindow) {
    if (this._prefs.getBoolPref("promptOnSanitize")) {
      var ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                         .getService(Components.interfaces.nsIWindowWatcher);
#ifdef XP_MACOSX
      ww.openWindow(null, // make this an app-modal window on Mac
#else
      ww.openWindow(aParentWindow,
#endif
                    "chrome://communicator/content/sanitize.xul", "Sanitize",
                    "chrome,titlebar,centerscreen,dialog,modal", null);
      return null;
    }

    // do the actual sanitizing
    var itemPrefs = Components.classes["@mozilla.org/preferences-service;1"]
                              .getService(Components.interfaces.nsIPrefService)
                              .getBranch("privacy.item.");
    var errors = null;
    for (var itemName in this.items) {
      var item = this.items[itemName];
      if ("clear" in item && item.canClear && itemPrefs.getBoolPref(itemName)) {
        // Some of these clear() may raise exceptions (see bug #265028)
        // to sanitize as much as possible, we catch and store them,
        // rather than fail fast.
        // Callers should check returned errors and give user feedback
        // about items that could not be sanitized
        try {
          item.clear();
        } catch(ex) {
          if (!errors)
            errors = {};
          errors[itemName] = ex;
          dump("Error sanitizing " + itemName + ": " + ex + "\n");
        }
      }
    }
    return errors;
  },

  // warning to the caller: this one may raise an exception (e.g. bug #265028)
  clearItem: function(aItemName) {
    if (this.items[aItemName].canClear)
      this.items[aItemName].clear();
  },

  canClearItem: function(aItemName) this.items[aItemName].canClear,

  getNameFromPreference: function(aName) aName.substr("privacy.item.".length),

  // this is called on startup and shutdown, to perform pending sanitizations
  checkAndSanitize: function() {
    if (this._prefs.getBoolPref("sanitizeOnShutdown") &&
        !this._prefs.prefHasUserValue("didShutdownSanitize")) {
      // this is a shutdown or a startup after an unclean exit
      if (!this.sanitize(null))
        this._prefs.setBoolPref("didShutdownSanitize", true);
    }
  },

  items: {
    cache: {
      clear: function() {
        var cacheService = Components.classes["@mozilla.org/network/cache-service;1"]
                                     .getService(Components.interfaces.nsICacheService);
        cacheService.evictEntries(Components.interfaces.nsICache.STORE_ANYWHERE);
      },

      canClear: true
    },

    offlineApps: {
      clear: function() {
        // use try/catch for everything but the last task so we clear as much as possible
        try {
          var cacheService = Components.classes["@mozilla.org/network/cache-service;1"]
                                       .getService(Components.interfaces.nsICacheService);
          cacheService.evictEntries(Components.interfaces.nsICache.STORE_OFFLINE);
        } catch(ex) {}

        var storageMgr = Components.classes["@mozilla.org/dom/storagemanager;1"]
                                   .getService(Components.interfaces.nsIDOMStorageManager);
        storageMgr.clearOfflineApps();
      },

      canClear: true
    },

    cookies: {
      clear: function() {
        var cookieMgr = Components.classes["@mozilla.org/cookiemanager;1"]
                                  .getService(Components.interfaces.nsICookieManager);
        cookieMgr.removeAll();
      },

      canClear: true
    },

    history: {
      clear: function() {
        // use try/catch for everything but the last task so we clear as much as possible
        try {
          var globalHistory = Components.classes["@mozilla.org/browser/global-history;2"]
                                        .getService(Components.interfaces.nsIBrowserHistory);
          globalHistory.removeAllPages();
        } catch(ex) {}

        try {
          var os = Components.classes["@mozilla.org/observer-service;1"]
                             .getService(Components.interfaces.nsIObserverService);
          os.notifyObservers(null, "browser:purge-session-history", "");
        } catch(ex) {}

        // Clear last URL of the Open Web Location dialog
        var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                              .getService(Components.interfaces.nsIPrefBranch2);
        try {
          prefs.clearUserPref("general.open_location.last_url");
        } catch(ex) {}

        // Clear URLbar history (see also pref-history.js)
        var file = Components.classes["@mozilla.org/file/directory_service;1"]
                             .getService(Components.interfaces.nsIProperties)
                             .get("ProfD", Components.interfaces.nsIFile);
        file.append("urlbarhistory.sqlite");
        if (file.exists())
          file.remove(false);
      },

        // bug 347231: Always allow clearing history due to dependencies on
        // the browser:purge-session-history notification. (like error console)
      canClear: true
    },

    formdata: {
      clear: function() {
        var formHistory = Components.classes["@mozilla.org/satchel/form-history;1"]
                                    .getService(Components.interfaces.nsIFormHistory2);
        formHistory.removeAllEntries();
      },

      get canClear() {
        var formHistory = Components.classes["@mozilla.org/satchel/form-history;1"]
                                    .getService(Components.interfaces.nsIFormHistory2);
        return formHistory.hasEntries;
      }
    },

    downloads: {
      clear: function() {
        /* XXX: commented out as long as we aren't using toolkit's download manager
        var dlMgr = Components.classes["@mozilla.org/download-manager;1"]
                              .getService(Components.interfaces.nsIDownloadManager);
        dlMgr.cleanUp();
        */
      },

      canClear: false
      /* XXX: use code below (instead of above line) once we are using toolkit's download manager
      get canClear() {
        var dlMgr = Components.classes["@mozilla.org/download-manager;1"]
                              .getService(Components.interfaces.nsIDownloadManager);
        return dlMgr.canCleanUp;
      }
      */
    },

    passwords: {
      clear: function() {
        var pwmgr = Components.classes["@mozilla.org/login-manager;1"]
                              .getService(Components.interfaces.nsILoginManager);
        pwmgr.removeAllLogins();
      },

      get canClear() {
        var pwmgr = Components.classes["@mozilla.org/login-manager;1"]
                              .getService(Components.interfaces.nsILoginManager);
        var count = pwmgr.countLogins("", "", ""); // count all logins
        return (count > 0);
      }
    },

    sessions: {
      clear: function() {
        // clear all auth tokens
        var sdr = Components.classes["@mozilla.org/security/sdr;1"]
                            .getService(Components.interfaces.nsISecretDecoderRing);
        sdr.logoutAndTeardown();

        // clear plain HTTP auth sessions
        var authMgr = Components.classes["@mozilla.org/network/http-auth-manager;1"]
                                .getService(Components.interfaces.nsIHttpAuthManager);
        authMgr.clearAll();
      },

      canClear: true
    }
  }
};
