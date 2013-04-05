Cu.import("resource:///modules/Sanitizer.jsm", this);

var sanTests = {
  cache: {
    desc: "Cache",
    setup: function() {
      var entry = null;
      this.cs = Services.cache.createSession("SanitizerTest", Components.interfaces.nsICache.STORE_ANYWHERE, true);
      entry = yield promiseOpenCacheEntry("http://santizer.test", Components.interfaces.nsICache.ACCESS_READ_WRITE, this.cs);
      entry.setMetaDataElement("Foo", "Bar");
      entry.markValid();
      entry.close();
    },

    check: function(aShouldBeCleared) {
      let entry = null;
      entry = yield promiseOpenCacheEntry("http://santizer.test", Components.interfaces.nsICache.ACCESS_READ, this.cs);

      if (entry) {
        entry.close();
      }

      do_check_eq(!entry, aShouldBeCleared);
    }
  },

  offlineApps: {
    desc: "Offline app cache",
    setup: function() {
      //XXX test offline DOMStorage
      var entry = null;
      this.cs = Services.cache.createSession("SanitizerTest", Components.interfaces.nsICache.STORE_OFFLINE, true);
      entry = yield promiseOpenCacheEntry("http://santizer.test", Components.interfaces.nsICache.ACCESS_READ_WRITE, this.cs);
      entry.setMetaDataElement("Foo", "Bar");
      entry.markValid();
      entry.close();
    },

    check: function(aShouldBeCleared) {
      var entry = null;
      entry = yield promiseOpenCacheEntry("http://santizer.test", Components.interfaces.nsICache.ACCESS_READ, this.cs);
      if (entry) {
        entry.close();
      }

      do_check_eq(!entry, aShouldBeCleared);
    }
  },

  cookies: {
    desc: "Cookie",
    setup: function() {
      Services.prefs.setIntPref("network.cookie.cookieBehavior", 0);
      var ios = Components.classes["@mozilla.org/network/io-service;1"]
                          .getService(Components.interfaces.nsIIOService);
      this.uri = ios.newURI("http://sanitizer.test/", null, null);
      this.cs = Components.classes["@mozilla.org/cookieService;1"]
                          .getService(Components.interfaces.nsICookieService);
      this.cs.setCookieString(this.uri, null, "Sanitizer!", null);
    },

    check: function(aShouldBeCleared) {
      if (aShouldBeCleared)
        do_check_neq(this.cs.getCookieString(this.uri, null), "Sanitizer!");
      else
        do_check_eq(this.cs.getCookieString(this.uri, null), "Sanitizer!");
    }
  },

  history: {
    desc: "History",
    setup: function() {
      var ios = Components.classes["@mozilla.org/network/io-service;1"]
                          .getService(Components.interfaces.nsIIOService);
      var uri = ios.newURI("http://sanitizer.test/", null, null);
      yield promiseAddVisits({
        uri: uri,
        title: "Sanitizer!"
      });
    },

    check: function(aShouldBeCleared) {
      var rv = false;
      var history = Components.classes["@mozilla.org/browser/nav-history-service;1"]
                              .getService(Components.interfaces.nsINavHistoryService);
      var options = history.getNewQueryOptions();
      var query = history.getNewQuery();
      query.searchTerms = "Sanitizer!";
      var results = history.executeQuery(query, options).root;
      results.containerOpen = true;
      for (var i = 0; i < results.childCount; i++) {
        if (results.getChild(i).uri == "http://sanitizer.test/") {
          rv = true;
          break;
        }
      }

      // Close container after reading from it
      results.containerOpen = false;

      do_check_eq(rv, !aShouldBeCleared);
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
      Services.prefs.setComplexValue("general.open_location.last_url",
                                      Components.interfaces.nsISupportsString, supStr);
    },

    check: function(aShouldBeCleared) {
      let locData;
      try {
        locData = Services.prefs.getComplexValue("general.open_location.last_url", Components.interfaces.nsISupportsString).data;
      } catch(ex) {}

      do_check_eq(locData == "Sanitizer!", !aShouldBeCleared);

      var file = Components.classes["@mozilla.org/file/directory_service;1"]
                           .getService(Components.interfaces.nsIProperties)
                           .get("ProfD", Components.interfaces.nsIFile);
      file.append("urlbarhistory.sqlite");

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

      do_check_eq(urlbar, !aShouldBeCleared);
    }
  },

  formdata: {
    desc: "Form history",
    setup: function() {
      this.forms = Components.classes["@mozilla.org/satchel/form-history;1"]
                             .getService(Components.interfaces.nsIFormHistory2);
      this.forms.addEntry("Sanitizer", "Foo");
    },

    check: function(aShouldBeCleared) { 
      do_check_eq(this.forms.entryExists("Sanitizer", "Foo"), !aShouldBeCleared);
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
      file.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, parseInt("0666", 8));
      var dest = ios.newFileURI(file);

      this.dm = Components.classes["@mozilla.org/download-manager;1"]
                          .getService(Components.interfaces.nsIDownloadManager);

      const nsIWBP = Components.interfaces.nsIWebBrowserPersist;
      var persist = Components.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
                              .createInstance(nsIWBP);
      persist.persistFlags = nsIWBP.PERSIST_FLAGS_REPLACE_EXISTING_FILES |
                             nsIWBP.PERSIST_FLAGS_BYPASS_CACHE |
                             nsIWBP.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION;

      this.dl = this.dm.addDownload(this.dm.DOWNLOAD_CANCELED, uri, dest,
                                    "Sanitizer!", null,
                                    Math.round(Date.now() * 1000), null,
                                    persist, false);

      // Stupid DM...
      this.dm.cancelDownload(this.dl.id);
    },

    check: function(aShouldBeCleared) { 
      var dl = null;
      try {
        dl = this.dm.getDownload(this.dl.id);
      } catch(ex) {}

      if (aShouldBeCleared)
        do_check_eq(!dl, aShouldBeCleared)
      else
        do_check_eq(dl.displayName, "Sanitizer!");
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
    },

    check: function(aShouldBeCleared) {
      let rv = false;
      let logins = this.pm.findLogins({}, "http://sanitizer.test", null, "Rick Astley Fan Club");
      for (var i = 0; i < logins.length; i++) {
        if (logins[i].username == "dolske") {
          rv = true;
          break;
        }
      }

      do_check_eq(rv, !aShouldBeCleared);
    }
  },

  sessions: {
    desc: "HTTP auth session",
    setup: function() {
      this.authMgr = Components.classes["@mozilla.org/network/http-auth-manager;1"]
                               .getService(Components.interfaces.nsIHttpAuthManager);

      this.authMgr.setAuthIdentity("http", "sanitizer.test", 80, "basic", "Sanitizer",
                                   "", "Foo", "fooo", "foo12");
    },

    check: function(aShouldBeCleared) {
      var domain = {};
      var user = {};
      var password = {};

      try {
        this.authMgr.getAuthIdentity("http", "sanitizer.test", 80, "basic", "Sanitizer",
                                     "", domain, user, password);
      } catch(ex) {}

      do_check_eq(domain.value == "Foo", !aShouldBeCleared);
    }
  }
}

function fullSanitize() {
  do_print("Now doing a full sanitize run");
  var prefs = Services.prefs.getBranch("privacy.item.");

  Services.prefs.setBoolPref("privacy.sanitize.promptOnSanitize", false);

  for (var testName in sanTests) {
    var test = sanTests[testName];
    yield test.setup();
    prefs.setBoolPref(testName, true);
  }

  Sanitizer.sanitize();

  for (var testName in sanTests) {
    var test = sanTests[testName];
    yield test.check(true);
    do_print(test.desc + " data cleared by full sanitize");
    try {
      prefs.clearUserPref(testName);
    } catch (ex) {}
  }

  try {
    Services.prefs.clearUserPref("privacy.sanitize.promptOnSanitize");
  } catch(ex) {}
}

function run_test()
{
  run_next_test();
}

add_task(function test_browser_sanitizer()
{
  for (var testName in sanTests) {
    let test = sanTests[testName];
    dump("\nExecuting test: " + testName + "\n" + "*** " + test.desc + "\n");
    yield test.setup();
    yield test.check(false);

    do_check_true(Sanitizer.items[testName].canClear);
    Sanitizer.items[testName].clear();
    do_print(test.desc + " data cleared");

    yield test.check(true);
  }
});

add_task(fullSanitize);
