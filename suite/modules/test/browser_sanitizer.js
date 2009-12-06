Components.utils.import("resource://gre/modules/Sanitizer.jsm");
ok(typeof Sanitizer != "undefined", "Sanitizer module imported")

function getWindows(aType, aSingle) {
  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                     .getService(Components.interfaces.nsIWindowMediator);
  var window = null;
  if (aSingle)
    window = wm.getMostRecentWindow(aType);
  else
    window = wm.getEnumerator(aType);
  return window;
}

var sanTests = {
  cache: {
    desc: "Cache",
    setup: function() {
      var entry = null;
      var cacheService = Components.classes["@mozilla.org/network/cache-service;1"]
                                   .getService(Components.interfaces.nsICacheService);
      try {
        this.cs = cacheService.createSession("SanitizerTest", Components.interfaces.nsICache.STORE_ANYWHERE, true);
        entry = this.cs.openCacheEntry("http://santizer.test", Components.interfaces.nsICache.ACCESS_READ_WRITE, true);
        entry.setMetaDataElement("Foo", "Bar");
        entry.markValid();
        entry.close();
      } catch(ex) {}

      return this.check();
    },

    check: function() {
      var entry = null;
      try {
        entry = this.cs.openCacheEntry("http://santizer.test", Components.interfaces.nsICache.ACCESS_READ, true);
      } catch(ex) {}

      if (entry) {
        entry.close();
        return true;
      }
      return false;
    }
  },

  offlineApps: {
    desc: "Offline app cache",
    setup: function() {
      //XXX test offline DOMStorage
      var entry = null;
      var cacheService = Components.classes["@mozilla.org/network/cache-service;1"]
                                   .getService(Components.interfaces.nsICacheService);
      try {
        this.cs = cacheService.createSession("SanitizerTest", Components.interfaces.nsICache.STORE_OFFLINE, true);
        entry = this.cs.openCacheEntry("http://santizer.test", Components.interfaces.nsICache.ACCESS_READ_WRITE, true);
        entry.setMetaDataElement("Foo", "Bar");
        entry.markValid();
        entry.close();
      } catch(ex) {}

      return this.check();
    },

    check: function() {
      var entry = null;
      try {
        entry = this.cs.openCacheEntry("http://santizer.test", Components.interfaces.nsICache.ACCESS_READ, true);
      } catch(ex) {}

      if (entry) {
        entry.close();
        return true;
      }
      return false;
    }
  },

  cookies: {
    desc: "Cookie",
    setup: function() {
      var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                            .getService(Components.interfaces.nsIPrefBranch);
      prefs.setIntPref("network.cookie.cookieBehavior", 0);
      var ios = Components.classes["@mozilla.org/network/io-service;1"]
                          .getService(Components.interfaces.nsIIOService);
      this.uri = ios.newURI("http://sanitizer.test/", null, null);
      this.cs = Components.classes["@mozilla.org/cookieService;1"]
                          .getService(Components.interfaces.nsICookieService);
      this.cs.setCookieString(this.uri, null, "Sanitizer!", null);
      return this.check();
    },

    check: function() {
      return (this.cs.getCookieString(this.uri, null) == "Sanitizer!");
    }
  },

  history: {
    desc: "History",
    setup: function() {
      var ios = Components.classes["@mozilla.org/network/io-service;1"]
                          .getService(Components.interfaces.nsIIOService);
      var uri = ios.newURI("http://sanitizer.test/", null, null);

      var history = Components.classes["@mozilla.org/browser/global-history;2"]
                              .getService(Components.interfaces.nsIBrowserHistory);
      history.addPageWithDetails(uri, "Sanitizer!", Date.now());

      return this.check();
    },

    check: function() {
      var history = Components.classes["@mozilla.org/browser/nav-history-service;1"]
                              .getService(Components.interfaces.nsINavHistoryService);
      var options = history.getNewQueryOptions();
      var query = history.getNewQuery();
      query.searchTerms = "Sanitizer!";
      var results = history.executeQuery(query, options).root;
      results.containerOpen = true;
      for (var i = 0; i < results.childCount; i++) {
        if (results.getChild(i).uri == "http://sanitizer.test/")
          return true;
      }
      return false;
    }
  },

  urlbar: {
    desc: "Location bar history",
    setup: function() {
      // Create urlbarhistory file first otherwise tests will fail.
      var file = Components.classes["@mozilla.org/file/directory_service;1"]
                           .getService(Components.interfaces.nsIProperties)
                           .get("ProfD", Components.interfaces.nsIFile);
      file.append("urlbarhistory.sqlite");
      if (!file.exists()) {
        var connection = Components.classes["@mozilla.org/storage/service;1"]
                                   .getService(Components.interfaces.mozIStorageService)
                                   .openDatabase(file);
        connection.createTable("urlbarhistory", "url TEXT");
        connection.executeSimpleSQL(
          "INSERT INTO urlbarhistory (url) VALUES ('Sanitizer')");
        connection.close();
      }

      // Open location dialog.
      var supStr = Components.classes["@mozilla.org/supports-string;1"]
                             .createInstance(Components.interfaces.nsISupportsString);
      supStr.data = "Sanitizer!";
      this.prefs = Components.classes["@mozilla.org/preferences-service;1"]
                             .getService(Components.interfaces.nsIPrefBranch);
      this.prefs.setComplexValue("general.open_location.last_url",
                                 Components.interfaces.nsISupportsString, supStr);

      return this.check(true);
    },

    check: function(aCheckAll) {
      var locDialog = false;
      try {
        locDialog = (this.prefs.getComplexValue("general.open_location.last_url",
                                                Components.interfaces.nsISupportsString).data == "Sanitizer!");
      } catch(ex) {}

      if (locDialog == !aCheckAll)
        return locDialog;

      var file = Components.classes["@mozilla.org/file/directory_service;1"]
                           .getService(Components.interfaces.nsIProperties)
                           .get("ProfD", Components.interfaces.nsIFile);
      file.append("urlbarhistory.sqlite");
      if (!file.exists())
        return false;

      if (!aCheckAll)
        return true;

      var connection = Components.classes["@mozilla.org/storage/service;1"]
                                 .getService(Components.interfaces.mozIStorageService)
                                 .openDatabase(file);
      var urlbar = connection.tableExists("urlbarhistory");
      if (urlbar) {
        var handle = connection.createStatement(
          "SELECT url FROM urlbarhistory");
        if (handle.executeStep())
          urlbar = (handle.getString(0) == "Sanitizer");
        handle.reset();
        handle.finalize();
      }
      connection.close();

      return urlbar;
    }
  },

  formdata: {
    desc: "Form history",
    setup: function() {
      this.forms = Components.classes["@mozilla.org/satchel/form-history;1"]
                             .getService(Components.interfaces.nsIFormHistory2);
      this.forms.addEntry("Sanitizer", "Foo");
      return this.check();
    },

    check: function() {
      return this.forms.entryExists("Sanitizer", "Foo");
    }
  },

  downloads: {
    desc: "Download",
    setup: function() {
      var ios = Components.classes["@mozilla.org/network/io-service;1"]
                          .getService(Components.interfaces.nsIIOService);
      var uri = ios.newURI("http://sanitizer.test/", null, null);
      var file = Components.classes["@mozilla.org/file/directory_service;1"]
                           .getService(Components.interfaces.nsIProperties)
                           .get("TmpD", Components.interfaces.nsIFile);
      file.append("sanitizer.file");
      file.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0666);
      var dest = ios.newFileURI(file);

      this.dm = Components.classes["@mozilla.org/download-manager;1"]
                          .createInstance(Components.interfaces.nsIDownloadManager);
      this.dl = this.dm.addDownload(Components.interfaces.nsIDownloadManager.DOWNLOAD_CANCELED, uri,
                                    dest, "Sanitizer!", null, Math.round(Date.now() * 1000), null, {});
      // Stupid DM...
      this.dm.cancelDownload(this.dl.id);
      return this.check();
    },

    check: function() {
      var dl = null;
      try {
        dl = this.dm.getDownload(this.dl.id);
      } catch(ex) {}

      return (dl && dl.displayName == "Sanitizer!");
    }
  },

  passwords: {
    desc: "Login manager",
    setup: function() {
      this.pm = Components.classes["@mozilla.org/login-manager;1"]
                          .getService(Components.interfaces.nsILoginManager);
      var info = Components.Constructor("@mozilla.org/login-manager/loginInfo;1",
                                        Components.interfaces.nsILoginInfo, "init");
      var login = new info("http://sanitizer.test", null, "Rick Astley Fan Club",
                           "dolske", "iliketurtles1", "", "");
      this.pm.addLogin(login);

      return this.check();
    },

    check: function() {
      var logins = this.pm.findLogins({}, "http://sanitizer.test", null, "Rick Astley Fan Club");
      for (var i = 0; i < logins.length; i++) {
        if (logins[i].username == "dolske")
          return true;
      }
      return false;
    }
  },

  sessions: {
    desc: "HTTP auth session",
    setup: function() {
      this.authMgr = Components.classes["@mozilla.org/network/http-auth-manager;1"]
                               .getService(Components.interfaces.nsIHttpAuthManager);

      this.authMgr.setAuthIdentity("http", "sanitizer.test", 80, "basic", "Sanitizer",
                                   "", "Foo", "fooo", "foo12");
      return this.check();
    },

    check: function() {
      var domain = {};
      var user = {};
      var password = {};

      try {
        this.authMgr.getAuthIdentity("http", "sanitizer.test", 80, "basic", "Sanitizer",
                                     "", domain, user, password);
      } catch(ex) {}

      return (domain.value == "Foo");
    }
  }
};

function fullSanitize() {
  var psvc = Components.classes["@mozilla.org/preferences-service;1"]
                       .getService(Components.interfaces.nsIPrefService);
  var prefs = psvc.getBranch("privacy.item.");

  var poppref = psvc.getBranch("privacy.sanitize.");
  poppref.setBoolPref("promptOnSanitize", false);

  for (var testName in sanTests) {
    var test = sanTests[testName];
    ok(test.setup(), test.desc + " test setup successfully for full sanitize");
    prefs.setBoolPref(testName, true);
  }

  Sanitizer.sanitize();

  for (var testName in sanTests) {
    var test = sanTests[testName];
    ok(!test.check(), test.desc + " data cleared by full sanitize");
    try {
      prefs.clearUserPref(testName);
    } catch (ex) {}
  }

  try {
    poppref.clearUserPref("promptOnSanitize");
  } catch(ex) {}
}

function test() {
  waitForExplicitFinish();

  // Sanitize one item at a time.
  for (var testName in sanTests) {
    var test = sanTests[testName];

    ok(test.setup(), test.desc + " test setup successfully");

    ok(Sanitizer.items[testName].canClear, test.desc + " can be cleared");
    Sanitizer.items[testName].clear();
    ok(!test.check(), test.desc + " data cleared");
  }

  // Sanitize all items at once.
  fullSanitize();

  // executeSoon() prevents (in the "pass" case only) leaking Console messages (...) to the next test.
  executeSoon(finish);
}
