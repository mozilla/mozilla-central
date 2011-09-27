EXPORTED_SYMBOLS = ["runAllTests"];
var Cu = Components.utils;
var Cc = Components.classes;
var Ci = Components.interfaces;
var testsRun = 0;
var testsPassed = 0;
Cu.import("resource://gre/modules/Services.jsm");

function output(txt) {
  // dump on desktop, Services.console on mobile
  Services.console.logStringMessage(txt);
}

// Utility functions for testing:

function cheapAssertEqual(a, b, errorMsg) {
  testsRun += 1;
  if (a == b) {
    output("UNIT TEST PASSED.\n");
    testsPassed += 1;
  } else {
    output("UNIT TEST FAILED: ");
    output(errorMsg + "\n");
    output(a + " does not equal " + b + "\n");
  }
}

function cheapAssertNotEqual(a, b, errorMsg) {
  testsRun += 1;
  if (a != b) {
    output("UNIT TEST PASSED.\n");
    testsPassed += 1;
  } else {
    output("UNIT TEST FAILED: ");
    output(errorMsg + "\n");
    output(a + " equals " + b + " when it shouldn't.\n");
  }
}

function cheapAssertStringContains(bigString, subString, errorMsg) {
  testsRun += 1;
  if (bigString.indexOf(subString) > -1) {
    output("UNIT TEST PASSED.\n");
    testsPassed += 1;
  } else {
    output("UNIT TEST FAILED: ");
    output(errorMsg + "\n");
    output(bigString + " does not contain " + subString + "\n");
  }
}

function cheapAssertEqualArrays(a, b, errorMsg) {
  testsRun += 1;
  let equal = true;
  if (a.length != b.length) {
    equal = false;
  } else {
    for (let i = 0; i < a.length; i++) {
      if (a[i] != b[i]) {
        equal = false;
      }
    }
  }
  if (equal) {
    output("UNIT TEST PASSED.\n");
    testsPassed += 1;
  } else {
    output("UNIT TEST FAILED: ");
    output(errorMsg + "\n");
    output(a + " does not equal " + b + "\n");
  }
}

function cheapAssertRange(lowerBound, value, upperBound, errorMsg) {
  testsRun += 1;
  if (lowerBound <= value && value <= upperBound) {
    output("UNIT TEST PASSED.\n");
    testsPassed += 1;
  } else {
    output("UNIT TEST FAILED: ");
    output(errorMsg + "\n");
    output(value + " is outside the range of " + lowerBound + " to "
         + upperBound + "\n");
  }
}

function cheapAssertFail(errorMsg) {
  testsRun += 1;
  output("UNIT TEST FAILED: ");
  output(errorMsg + "\n");
}

// Utility functions for cleanup:

function clearAllPrefsForStudy(studyId) {
  output("Looking for prefs to delete...\n");
  let prefService = Cc["@mozilla.org/preferences-service;1"]
                     .getService(Ci.nsIPrefService)
                     .QueryInterface(Ci.nsIPrefBranch2);
  let prefStem = "extensions.testpilot";
  let prefNames = prefService.getChildList(prefStem);
  for each (let prefName in prefNames) {
    if (prefName.indexOf(studyId) != -1) {
      output("Clearing pref " + prefName + "\n");
      prefService.clearUserPref(prefName);
    }
  }
}

function clearDbFile(filename) {
  let dirSvc = Cc["@mozilla.org/file/directory_service;1"]
                .getService(Ci.nsIProperties);
  let file = dirSvc.get("ProfD", Ci.nsIFile);
  file.append(filename);
  if (file.exists()) {
    file.remove(false);
  }
}

// Other utility functions

function waitABit(seconds, callback) {
 let timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
 timer.initWithCallback({ notify: function(timer) {
                            callback();
                          }}, seconds * 1000, Ci.nsITimer.TYPE_ONE_SHOT);
}


function base64decode(data) {
  // base64 encode/decode is built into window object, but we're in a module so we
  // need to fetch a window reference first:
  let wm = Cc["@mozilla.org/appshell/window-mediator;1"].
    getService(Ci.nsIWindowMediator);
  let window = wm.getMostRecentWindow("navigator:browser") ||
               wm.getMostRecentWindow("mail:3pane");
  return window.atob(data);
}

function ensureExperimentIsRunning(experiment) {
  if (!experiment.experimentIsRunning) {
    experiment.changeStatus(TaskConstants.STATUS_STARTING, true);
    experiment.checkDate(); // will call onExperimentStartup()
  }
}

// Beginning of tests


function testFirefoxVersionCheck() {
  Cu.import("resource://testpilot/modules/setup.js");
  cheapAssertEqual(true, TestPilotSetup._isNewerThanFirefox("4.0"));
  cheapAssertEqual(false, TestPilotSetup._isNewerThanFirefox("3.5"));
  cheapAssertEqual(false, TestPilotSetup._isNewerThanFirefox("3.6"));
}

function testStringSanitizer() {
  Cu.import("resource://testpilot/modules/string_sanitizer.js");
  var evilString = "I *have* (evil) ^characters^ [hahaha];";
  output("Sanitized evil string is " + sanitizeString(evilString) + "\n");
  cheapAssertEqual(sanitizeString(evilString),
                   "I ?have? ?evil? ?characters? ?hahaha??");
}

function testTheDataStore() {
  // Geez, async unit tests are a pain.
  Cu.import("resource://testpilot/modules/experiment_data_store.js");

  var columns =  [{property: "prop_a", type: TYPE_INT_32, displayName: "Length"},
                  {property: "prop_b", type: TYPE_INT_32, displayName: "Type",
                   displayValue: ["Spam", "Egg", "Sausage", "Baked Beans"]},
                  {property: "prop_c", type: TYPE_DOUBLE, displayName: "Depth"},
                  {property: "prop_s", type: TYPE_STRING, displayName: "Text"}
                  ];

  var fileName = "testpilot_storage_unit_test.sqlite";
  var tableName = "testpilot_storage_unit_test";
  var storedCount = 0;
  clearDbFile(fileName);
  var store = new ExperimentDataStore(fileName, tableName, columns);


  store.storeEvent({prop_a: 13, prop_b: 3, prop_c: 0.001, prop_s: "How"},
                   function(stored) {
                     storedCount++;
                     if (storedCount == 4) {
                       _testTheDataStore(store);
                     }
                   });
  store.storeEvent({prop_a: 26, prop_b: 2, prop_c: 0.002, prop_s: " do"},
                    function(stored) {
                     storedCount++;
                     if (storedCount == 4) {
                       _testTheDataStore(store);
                     }
                   });
  store.storeEvent({prop_a: 39, prop_b: 1, prop_c: 0.003, prop_s: " you"},
                    function(stored) {
                     storedCount++;
                     if (storedCount == 4) {
                       _testTheDataStore(store);
                     }
                   });
  store.storeEvent({prop_a: 52, prop_b: 0, prop_c: 0.004, prop_s: " do?"},
                    function(stored) {
                     storedCount++;
                     if (storedCount == 4) {
                       _testTheDataStore(store);
                     }
                   });


  function _testTheDataStore(store) {
    cheapAssertEqualArrays(store.getHumanReadableColumnNames(), ["Length", "Type", "Depth", "Text"],
                   "Human readable column names are not correct.");
    cheapAssertEqualArrays(store.getPropertyNames(), ["prop_a", "prop_b", "prop_c", "prop_s"],
                        "Property names are not correct.");
    store.getAllDataAsJSON(false, function(json) {
      var expectedJson = [{prop_a: 13, prop_b: 3, prop_c: 0.001, prop_s: "How"},
                      {prop_a: 26, prop_b: 2, prop_c: 0.002, prop_s: " do"},
                       {prop_a: 39, prop_b: 1, prop_c: 0.003, prop_s: " you"},
                      {prop_a: 52, prop_b: 0, prop_c: 0.004, prop_s: " do?"}];
      cheapAssertEqual(JSON.stringify(json),
                       JSON.stringify(expectedJson),
                       "Stringified JSON does not match expectations.");

      _testTheDataStore2(store);
    });
  }

  function _testTheDataStore2(store) {
    // Let's ask for the human-readable values now...
    store.getAllDataAsJSON(true, function(json) {
      var expectedJson = [{prop_a: 13, prop_b: "Baked Beans", prop_c: 0.001, prop_s: "How"},
                      {prop_a: 26, prop_b: "Sausage", prop_c: 0.002, prop_s: " do"},
                      {prop_a: 39, prop_b: "Egg", prop_c: 0.003, prop_s: " you"},
                      {prop_a: 52, prop_b: "Spam", prop_c: 0.004, prop_s: " do?"}];
      cheapAssertEqual(JSON.stringify(json),
                       JSON.stringify(expectedJson),
                       "JSON with human-radable values does not match expectations.");
      _testDataStoreWipe(store);
    });
  }

  function _testDataStoreWipe(store) {
    // Wipe all data and ensure that we get back blanks:
    store.wipeAllData(function(wiped) {
      store.getAllDataAsJSON(false, function(json) {
        var expectedJson = [];
        cheapAssertEqual(JSON.stringify(json),
                         JSON.stringify(expectedJson),
                        "JSON after wipe fails to be empty.");
        // end test by clearing file - TODO this should be in teardown
        clearDbFile(fileName);
      });
    });
  }
};


function testTheCuddlefishPreferencesFilesystem() {

  // Put some sample code into various 'files' in the preferences filesystem
  // Get it out, make sure it's the same code.
  // Shut it down, start it up, make sure it's still got the same code in it.
  // Put in new code; make sure we get the new code, not the old code.
  var Cuddlefish = {};
  Cu.import("resource://testpilot/modules/lib/cuddlefish.js",
                          Cuddlefish);
  let cfl = new Cuddlefish.Loader({rootPaths: ["resource://testpilot/modules/",
                                               "resource://testpilot/modules/lib/"]});
  let remoteLoaderModule = cfl.require("remote-experiment-loader");
  let prefName = "extensions.testpilot.unittest.prefCodeStore";
  let pfs = new remoteLoaderModule.PreferencesStore(prefName);
  let contents1 = "function foo(x, y) { return x * y; }";
  let contents2 = "function bar(x, y) { return x / y; }";

  let earlyBoundDate = new Date();
  pfs.setFile("foo.js", contents1);
  pfs.setFile("bar.js", contents2);
  let lateBoundDate = new Date();

  let path = pfs.resolveModule("/", "foo.js");
  cheapAssertEqual(path, "foo.js", "resolveModule does not return expected path.");
  path = pfs.resolveModule("/", "bar.js");
  cheapAssertEqual(path, "bar.js", "resolveModule does not return expected path.");
  path = pfs.resolveModule("/", "baz.js");
  cheapAssertEqual(path, null, "Found a match for nonexistent file.");

  let file = pfs.getFile("foo.js");
  cheapAssertEqual(file.contents, contents1, "File contents do not match.");
  cheapAssertRange(earlyBoundDate, pfs.getFileModifiedDate("foo.js"), lateBoundDate,
                   "File modified date not correct.");

  file = pfs.getFile("bar.js");
  cheapAssertEqual(file.contents, contents2, "File contents do not match.");
  cheapAssertRange(earlyBoundDate, pfs.getFileModifiedDate("bar.js"), lateBoundDate,
                   "File modified date not correct.");

  delete pfs;
  let pfs2 = new remoteLoaderModule.PreferencesStore(prefName);

  file = pfs2.getFile("foo.js");
  cheapAssertEqual(file.contents, contents1, "File contents do not match after reloading.");
  file = pfs2.getFile("bar.js");
  cheapAssertEqual(file.contents, contents2, "File contents do not match after reloading.");

  let contents3 = "function foo(x, y) { return (x + y)/2; }";

  pfs2.setFile("foo.js", contents3);
  file = pfs2.getFile("foo.js");
  cheapAssertEqual(file.contents, contents3, "File contents do not newly set contents.");
}

function testRemoteLoader() {
  // this tests loading modules through cuddlefish from prefs store...
  // Need to make sure that a
  var Cuddlefish = {};
  Cu.import("resource://testpilot/modules/lib/cuddlefish.js",
                          Cuddlefish);
  let cfl = new Cuddlefish.Loader({rootPaths: ["resource://testpilot/modules/",
                                               "resource://testpilot/modules/lib/"]});
  let remoteLoaderModule = cfl.require("remote-experiment-loader");

  var indexJson = '{"experiments": [{"name": "Foo Study", '
                  + '"filename": "foo.js"}]}';

  var theRemoteFile = "exports.foo = function(x, y) { return x * y; }";

  let getFileFunc = function(url, callback) {
    if (url.indexOf("index.json") > -1) {
      if (indexJson != "") {
        callback(indexJson);
      } else {
        callback(null);
      }
    } else if (url.indexOf("foo.js") > -1) {
      callback(theRemoteFile);
    } else {
      callback(null);
    }
  };

  let remoteLoader = new remoteLoaderModule.RemoteExperimentLoader(stubLogger, getFileFunc);

  remoteLoader.checkForUpdates(function(success) {
    if (success) {
      let foo = remoteLoader.getExperiments()["foo.js"];
      cheapAssertEqual(foo.foo(6, 7), 42, "Foo doesn't work.");
    } else {
      cheapAssertFail("checkForUpdates returned failure.");
    }

    /* Now we change the remote code and call checkForUpdates again...
     * test that this results in the newly redefined version of function foo
     * being the one that is used.  (Note that this failed until I modified
     * remoteExperimentLoader to reinitialize its
     * Cuddlefish.loader during the call to checkForUpdates. */
    theRemoteFile = "exports.foo = function(x, y) { return x + y; }";
    remoteLoader.checkForUpdates( function(success) {
      if (success) {
         let foo = remoteLoader.getExperiments()["foo.js"];
        cheapAssertEqual(foo.foo(6, 7), 13, "2nd version of Foo doesn't work.");
      } else {
        cheapAssertFail("checkForUpdates 2nd time returned failure.");
      }
      /* For the third part of the test, make getFileFunc FAIL,
       * and make sure the cached version still gets used and still works! */
      indexJson = "";
      remoteLoader.checkForUpdates( function(success) {
        cheapAssertEqual(success, false, "3rd check for updates should have failed.");
        let foo = remoteLoader.getExperiments()["foo.js"];
        cheapAssertEqual(foo.foo(6, 7), 13, "Should still have the 2nd version of Foo.");
      });
    });
  });
}

function testRemotelyLoadTabsExperiment() {

  // TODO: Stub out the function downloadFile in remote-experiment-loader with
  // something that will give us the files from the local repo on the disk.
  // (~/testpilot/website/testcases/tab-open-close/tabs_experiment.js)
}

let stubLogger = {
  getLogger: function() { return {trace: function(str) {output("Trace: " + str +"\n");},
                                  warn: function(str) {output("Warn: " + str +"\n");},
                                  info: function(str) {output("Info: " + str +"\n");},
                                  debug: function(str) {output("Debug: " + str +"\n");}};}
};


function testRemoteLoaderIndexCache() {
  var Cuddlefish = {};
  Cu.import("resource://testpilot/modules/lib/cuddlefish.js",
                          Cuddlefish);
  let cfl = new Cuddlefish.Loader({rootPaths: ["resource://testpilot/modules/",
                                               "resource://testpilot/modules/lib/"]});
  let remoteLoaderModule = cfl.require("remote-experiment-loader");

  let getFileFunc = function(url, callback) {
    callback(null);
  };

  let remoteLoader = new remoteLoaderModule.RemoteExperimentLoader(stubLogger, getFileFunc);
  let data = "Foo bar baz quux";
  remoteLoader._cacheIndexFile(data);
  cheapAssertEqual(remoteLoader._loadCachedIndexFile(), data);

  // Clean up by killing the file so we don't break Test Pilot so bad
  output("Killing the mungled index file.\n");
  let indexFile = remoteLoader.cachedIndexNsiFile;
  if (indexFile.exists()) {
    indexFile.remove(false);
  }
}


function StubDataStore(fileName, tableName, columns) {
}
StubDataStore.prototype = {
  storeEvent: function(uiEvent, callback) {
    callback(true);
  },
  getJSONRows: function(callback) {
    callback([]);
  },
  getAllDataAsJSON: function(useDisplayValues, callback) {
    callback([]);
  },
  wipeAllData: function(callback) {
    callback(true);
  },
  nukeTable: function() {
  },
  haveData: function(callback) {
    callback(true);
  },
  getHumanReadableColumnNames: function() {
  },
  getPropertyNames: function() {
  }
};

function StubWebContent() {
}
StubWebContent.prototype = {
  inProgressHtml: "",
  completedHtml: "",
  upcomingHtml: "",
  canceledHtml: "",
  remainDataHtml: "",
  dataExpiredHtml: "",
  deletedRemainDataHtml: "",
  inProgressDataPrivacyHtml: "",
  completedDataPrivacyHtml: "",
  canceledDataPrivacyHtml: "",
  dataExpiredDataPrivacyHtml: "",
  remainDataPrivacyHtml: "",
  deletedRemainDataPrivacyHtml: "",
  onPageLoad: function(experiment, document, graphUtils) {
  }
};

function StubHandlers() {
}
StubHandlers.prototype = {
  onNewWindow: function(window) {
  },
  onWindowClosed: function(window) {
  },
  onAppStartup: function() {
  },
  onAppShutdown: function() {
  },
  onExperimentStartup: function(store) {
  },
  onExperimentShutdown: function() {
  },
  onEnterPrivateBrowsing: function() {
  },
  onExitPrivateBrowsing: function() {
  },
  uninstallAll: function() {
  }
};

function testRecurringStudyStateChange() {

  Cu.import("resource://testpilot/modules/tasks.js");

  let expInfo = {
    startDate: null,
    duration: 7,
    testName: "Unit Test Recurring Study",
    testId: "unit_test_recur_study",
    testInfoUrl: "https://testpilot.mozillalabs.com/",
    summary: "Be sure to wipe all prefs and the store in the setup/teardown",
    thumbnail: "",
    optInRequired: false,
    recursAutomatically: true,
    recurrenceInterval: 30,
    versionNumber: 1
  };

  clearAllPrefsForStudy("unit_test_recur_study");

  const START_DATE = 1292629441000;
  let stubDate = START_DATE;

  let stubDateFunction = function() {
    return stubDate;
  };

  let advanceDate = function(days) {
    stubDate += days * 24 * 60 * 60 * 1000;
  };

  let dataStore = new StubDataStore();
  let handlers = new StubHandlers();
  let webContent = new StubWebContent();
  let task = new TestPilotExperiment(expInfo, dataStore, handlers, webContent,
                                    stubDateFunction);

  // for this test, show popup on new study is set to true...
  prefService.setBoolPref("extensions.testpilot.popup.showOnNewStudy", true);
  // TODO another test with this turned off.

  cheapAssertEqual(task.id, "unit_test_recur_study", "id should be id");
  cheapAssertEqual(task.version, 1, "version should be version");
  cheapAssertEqual(task.title, "Unit Test Recurring Study", "title should be title");
  cheapAssertEqual(task.taskType, TaskConstants.TYPE_EXPERIMENT, "Should be experiment");
  // Ensure that end date is 7 days past the start date
  cheapAssertEqual(task.startDate, START_DATE, "Start date is wrong");
  cheapAssertEqual(task.endDate, START_DATE + 7 * 24 * 60 * 60 * 1000, "End date is wrong");

  cheapAssertEqual(task.status, TaskConstants.STATUS_NEW, "Status should be new");
  // advance time a little and check date... b/c showOnNewStudy is true, it won't start:
  advanceDate(1);
  task.checkDate();
  cheapAssertEqual(task.status, TaskConstants.STATUS_NEW, "Status should still be new");
  // Now we fake the user action needed to advance it from NEW to STARTING:
  task.changeStatus(TaskConstants.STATUS_STARTING);
  cheapAssertEqual(task.status, TaskConstants.STATUS_STARTING, "Status should now be starting");
  // when we check date again, it should advance from starting to in-progress:
  task.checkDate();
  cheapAssertEqual(task.status, TaskConstants.STATUS_IN_PROGRESS, "Status should be in progress");

  // Go 7 days into the future
  advanceDate(7);
  task.checkDate();
  cheapAssertEqual(task.status, TaskConstants.STATUS_FINISHED, "Status should be finished");

  /* So how is the buggy bug happening?  It seems like:
   *
   * - Data is posted successfully
   * - Task status set to 6
   * - (Reschedule is happening somewhere silently in here, which is screwing things
   *    up maybe?)
   * - Reload everything
   * - It's past its end date, so the task status gets switched to Finished.
   */

  // TODO ideally figure out how to fake an upload - until then, just set status to 6.
  task.changeStatus(TaskConstants.STATUS_SUBMITTED);
  cheapAssertEqual(task.status, TaskConstants.STATUS_SUBMITTED, "Should be submitted.");

  // Delete and recreate task, make sure it recovers its status and start/end
  // dates correctly
  task = null;
  let task2 = new TestPilotExperiment(expInfo, dataStore, handlers, webContent,
                                      stubDateFunction);
  cheapAssertEqual(task2.status, TaskConstants.STATUS_SUBMITTED, "Status should be submitted!");
  // It should remain submitted; it should have rescheduled itself to 30 days ahead.
  cheapAssertEqual(task2.startDate, START_DATE + 30 * 24 * 60 * 60 * 1000,
                   "Start date is wrong");
  cheapAssertEqual(task2.endDate, START_DATE + 37 * 24 * 60 * 60 * 1000,
                   "End date is wrong");



  // test task._reschedule()?
  // basically test everything that can happen in checkDate:
  /* - reset of automatically recurring test (with NEVER_SUBMIT on and with it off) when
   *    we pass the (new) start date.
  * - test that we jumped ahead to STARTING if optInRequired is false... and that
  *    we don't jump ahead to starting if it's true!  And the popup.showOnNewStudy pref
  *    should have the same effect!!
  *
  * - When a test finishes (status is less than finished and current date passes end date)
  *     then it should switch to finish.  If it recurs automatically, it should then
  *     reschedule; if study-specific recur pref is ALWAYS_SUBMIT (OR if global
  *      extensions.testpilot.alwaysSubmitData is true) it should then submit, but if it's
  *      NEVER_SUBMIT it should then cancel and wipe data.  If none of these are true
  *      it should just reschedule but remain on status = finished.
  *
  *    If it ends and doesn't recur automatically, then it should autosubmit if
  *      extensions.testpilot.alwaysSubmitData is true.
  *
  *    At this point, a data deletion date and an expiration date for data submission
  *     should be set (unless dat was already wiped as a result of NEVER_SUBMIT).
  *
  *
  * - Data expiration (this clause looks maybe wrong in the code - why is there another
  *                        autosubmit command here?)
  *     If study is finished but not submitted and we pass expiration date for data
  *      submission, cancel and wipe data.  (Expired should really be a status code!!)
  *    If study is submitted and we pass the date for data deletion, then wipe the data.
  *
  * */
  // Trying to upload when status is already submitted or greater should be a no-op.
  // Successful submit should advance us to SUBMITTED and generate/store a time for
  // data deletion.

  /* getWebContent and getDataPrivacyContent should give us back the right strings
   * based on all the state. */

}


//exports.runAllTests = runAllTests;


// Test that observers get installed on any windows that are already open.

// Test that every observer that is installed gets uninstalled.

// Test that the observer is writing to the data store correctly.

function testKillSwitch() {
  var Cuddlefish = {};
  Cu.import("resource://testpilot/modules/lib/cuddlefish.js",
                          Cuddlefish);
  let cfl = new Cuddlefish.Loader({rootPaths: ["resource://testpilot/modules/",
                                               "resource://testpilot/modules/lib/"]});
  let remoteLoaderModule = cfl.require("remote-experiment-loader");

  var indexJson1 = '{"new_experiments": [{"default": {"name": "Foo Study", '
                    + '"jarfile": "foo.jar", "studyfile": "foo.js",'
                    + '"hash": "19f32c805f93697e1b180a782bc7a8c7575f32138008d2617e9843a9bde14b38"}}]}';

  var indexJson2 = '{"new_experiments": [], "maintain_experiments": ["foo.js"]}';
  var indexJson3 = '{"new_experiments": []}';

  var indexJson = indexJson1;

  var theRemoteFile = "exports.foo = function(x, y) { return x * y; }";

  let getFileFunc = function(url, callback) {
    if (url.indexOf("index.json") > -1 || url.indexOf("index-dev.json") > -1) {
      if (indexJson != "") {
        callback(indexJson);
      } else {
        callback(null);
      }
    } else if (url.indexOf("foo.jar") > -1) {
      // Binary file (got this by base64encoding foo.jar):
      callback(base64decode(
        'UEsDBBQACAAIAFd2Pj4AAAAAAAAAAAAAAAAJAAQATUVUQS1JTkYv/soAAAMAUEsHCAAAAAACAAAAAAAA' +
	'AFBLAwQUAAgACABXdj4+AAAAAAAAAAAAAAAAFAAAAE1FVEEtSU5GL01BTklGRVNULk1G803My0xLLS7R' +
	'DUstKs7Mz7NSMNQz4OVyLkpNLElN0XWqBAmY6RnEGxkpaDgWFOSkKnjmJetp8nLxcgEAUEsHCPlAfs88' +
	'AAAAPAAAAFBLAwQUAAgACAA1dj4+AAAAAAAAAAAAAAAABgAAAGZvby5qc0utKMgvKinWS8vPV7BVSCvN' +
	'Sy7JzM/TqNBRqNRUqFYoSi0pLcpTqFDQUqi0Vqi1BgBQSwcIGwhXqzEAAAAvAAAAUEsBAhQAFAAIAAgA' +
	'V3Y+PgAAAAACAAAAAAAAAAkABAAAAAAAAAAAAAAAAAAAAE1FVEEtSU5GL/7KAABQSwECFAAUAAgACABX' +
	'dj4++UB+zzwAAAA8AAAAFAAAAAAAAAAAAAAAAAA9AAAATUVUQS1JTkYvTUFOSUZFU1QuTUZQSwECFAAU' +
	'AAgACAA1dj4+GwhXqzEAAAAvAAAABgAAAAAAAAAAAAAAAAC7AAAAZm9vLmpzUEsFBgAAAAADAAMAsQAA' +
	'ACABAAAAAA=='));
    } else {
      callback(null);
    }
  };

  let remoteLoader = new remoteLoaderModule.RemoteExperimentLoader(stubLogger, getFileFunc);

  function clearIndexFileCache() {
    // TODO this needs to go in a teardown
    output("Killing the mungled index file.\n");
    let indexFile = remoteLoader.cachedIndexNsiFile;
    if (indexFile.exists()) {
      indexFile.remove(false);
    }
  }

  output("Preparing To Test Kill Switch!!!\n");
  remoteLoader.checkForUpdates(function(hasChanges) {
    if (hasChanges) {
      output("Testing that foo study is loaded.\n");
      let exp = remoteLoader.getExperiments();
      let count = 0;
      for (let i in exp) {
        count += 1;
      }
      cheapAssertEqual(count, 1, "Supposed to find one file.");
      let fooModule = exp["foo.js"];
      cheapAssertEqual(fooModule.foo(3, 4), 12, "Supposed to load the foo module.\n");
    } else {
      cheapAssertFail("checkForUpdates is supposed to find changes.");
    }

    /* Now we change the index file and call checkForUpdates again... test that:
     * a. with indexJson2, the Foo Study continues to run.
     * b. with indexJson3, the Foo Study stops immediately.
     * */
    clearIndexFileCache();
    indexJson = indexJson2;
    output("Preparing to check for updates 2nd time.\n");
    remoteLoader.checkForUpdates( function(hasChanges) {
      output("in the callback for check for updates 2nd time.\n");
      if (hasChanges) {
        output("checkforUpdates 2nd time - has changes.\n");
      } else {
        output("checkforUpdates 2nd time - does not have changes.\n");
      }

      output("Testing that foo study is loaded. (2nd time)\n");
      let exp = remoteLoader.getExperiments();
      let count = 0;
      for (let i in exp) {
        count += 1;
      }
      cheapAssertEqual(count, 1, "Supposed to find one file (2nd time).");
      let fooModule = exp["foo.js"];
      cheapAssertEqual(fooModule.foo(3, 4), 12, "Supposed to load the foo module (2).\n");


      clearIndexFileCache();
      indexJson = indexJson3;
      remoteLoader.checkForUpdates( function(hasChanges) {
        if (hasChanges) {
          output("checkForUpdates 3rd time - has changes.\n");
        } else {
          output("checkForUpdates 3rd time - has no changes.\n");
        }

        output("Testing that foo study is NOT loaded. (3rd time)\n");
        let exp = remoteLoader.getExperiments();
        let count = 0;
        for (let i in exp) {
          count += 1;
        }
        cheapAssertEqual(count, 0, "File should be killed!\n");

        clearIndexFileCache();
      });
    });
  });
}

// To test:  The random subsample deployment... deployment when fx version or test pilot version
// is or is not sufficient for study... deployment with arbitrary runOrNot func returning true
// or false.

function testSameGUIDs() {

  // make a study and survey that knows the study as 'related study'.

  // start and submit study first, start and submit survey second: ensure that both have same
  // submission GUID.
  Cu.import("resource://testpilot/modules/tasks.js");

  let expInfo = {
    startDate: null,
    duration: 7,
    testName: "Study w Survey n Guid",
    testId: "unit_test_guid_study",
    testInfoUrl: "https://testpilot.mozillalabs.com/",
    summary: "Be sure to wipe all prefs and the store in the setup/teardown",
    thumbnail: "",
    optInRequired: false,
    recursAutomatically: false,
    recurrenceInterval: 0,
    versionNumber: 1
  };

  let surveyInfo = { surveyId: "unit_test_guid_survey",
      surveyName: "Survey with associated study",
      surveyUrl: "",
      summary: "",
      thumbnail: "",
      uploadWithExperiment: expInfo.testId,
      versionNumber: 1,
      surveyQuestions: {},
      surveyExplanation: ""
  };

  clearAllPrefsForStudy("unit_test_guid_study");
  clearAllPrefsForStudy("unit_test_guid_survey");

  let dataStore = new StubDataStore();
  let handlers = new StubHandlers();
  let webContent = new StubWebContent();
  let experiment = new TestPilotExperiment(expInfo, dataStore, handlers, webContent);
  let survey = new TestPilotBuiltinSurvey(surveyInfo);

  // Start the study so it will generate a GUID
  ensureExperimentIsRunning(experiment);

  // Get GUIDs from study and from survey, compare:
  experiment._prependMetadataToJSON(function(jsonString) {
    let expGuid = JSON.parse(jsonString).metadata.task_guid;
    survey._prependMetadataToJSON(function(jsonString) {
      let surveyGuid = JSON.parse(jsonString).metadata.task_guid;
      output("expGuid is " + expGuid + ", surveyGuid is " + surveyGuid + "\n");
      cheapAssertEqual(expGuid, surveyGuid, "guids should match");
      cheapAssertEqual((expGuid != ""), true, "guid should be non-empty");

      // Clear everything for next part of test:
      clearAllPrefsForStudy("unit_test_guid_study");
      clearAllPrefsForStudy("unit_test_guid_survey");

      let experiment2 = new TestPilotExperiment(expInfo, dataStore, handlers, webContent);
      let survey2 = new TestPilotBuiltinSurvey(surveyInfo);

      // this time we query the survey for the GUID first, without starting the study:
      survey2._prependMetadataToJSON(function(jsonString) {
        let survey2Guid = JSON.parse(jsonString).metadata.task_guid;
        // after that, start the study:
        experiment2.changeStatus(TaskConstants.STATUS_STARTING, true);
        experiment2.checkDate();
        // experiment and survey should have same GUID again:
        experiment2._prependMetadataToJSON(function(jsonString) {
          let exp2Guid = JSON.parse(jsonString).metadata.task_guid;
          output("exp2Guid is " + exp2Guid + ", survey2Guid is " + survey2Guid + "\n");
          cheapAssertEqual(exp2Guid, survey2Guid, "guids should match");
          cheapAssertNotEqual(exp2Guid, "", "guid should be non-empty");
        });
      });
    });
  });
}

// TODO test for continuity of GUID with recurring study (longitudinal) - i don't think this
// has actually been working so far because a new GUID is generted every time the study starts up...

function testExceptionLogging() {

  Cu.import("resource://testpilot/modules/experiment_data_store.js");
  Cu.import("resource://testpilot/modules/tasks.js");

  var columns =  [{property: "prop_a", type: TYPE_INT_32, displayName: "Length"} ];

  var fileName = "testpilot_exception_unit_test.sqlite";
  var tableName = "testpilot_exception_unit_test";
  clearDbFile(fileName);
  clearAllPrefsForStudy("unit_test_exception_study");
  var store = new ExperimentDataStore(fileName, tableName, columns);

  let buggyHandlers = {
    onNewWindow: function(window) {
      throw (new Error("new window FAIL"));
    },
    onWindowClosed: function(window) {
      throw (new Error("close window FAIL"));
    },
    onAppStartup: function() {
      throw (new Error("app startup FAIL"));
    },
    onAppShutdown: function() {
      throw (new Error("app shutdown FAIL"));
    },
    onExperimentStartup: function() {
      throw (new Error("experiment startup FAIL"));
    },
    onExperimentShutdown: function() {
      throw (new Error("experiment shutdown FAIL"));
    },
    doExperimentCleanup: function() {
      throw (new Error("experiment cleanup FAIL"));
    },
    onEnterPrivateBrowsing: function() {
      throw (new Error("enter private browsing FAIL"));
    },
    onExitPrivateBrowsing: function() {
      throw (new Error("exit private browsing FAIL"));
    }
  };

  let expInfo = {
    startDate: null,
    duration: 7,
    testName: "Unit Test Exception Reporting",
    testId: "unit_test_exception_study",
    testInfoUrl: "https://testpilot.mozillalabs.com/",
    summary: "Be sure to wipe all prefs and the store in the setup/teardown",
    thumbnail: "",
    optInRequired: false,
    recursAutomatically: false,
    recurrenceInterval: 30,
    versionNumber: 1
  };

  let webContent = new StubWebContent();
  let experiment = new TestPilotExperiment(expInfo, store, buggyHandlers, webContent);
  ensureExperimentIsRunning(experiment);

  // Wait for the wipeAllData and the onExperimentStartup to finish
  waitABit(4, function() {
  experiment.onNewWindow();
  experiment.onWindowClosed();
  experiment.onAppStartup();
  experiment.onAppShutdown();
  experiment.onExperimentShutdown();
  experiment.doExperimentCleanup();
  experiment.onEnterPrivateBrowsing();
  experiment.onExitPrivateBrowsing();

  // TODO weird problem:
  //  If you try to re-run tests, logException fails with a disk I/O error the 2nd time!!

  // Pause here for 4 secs to give the database writes a chance to finish.
  waitABit(4, function() {
    experiment._prependMetadataToJSON(function(jsonString) {
      let exceptions = JSON.parse(jsonString).exceptions;
      cheapAssertEqual(exceptions.length, 9, "Should have 9 exceptions");
      cheapAssertStringContains(exceptions[0].exception, "experiment startup FAIL", "should have failed");
      cheapAssertStringContains(exceptions[1].exception, "new window FAIL", "should have failed");
      cheapAssertStringContains(exceptions[2].exception, "close window FAIL", "should have failed");
      cheapAssertStringContains(exceptions[3].exception, "app startup FAIL", "should have failed");
      cheapAssertStringContains(exceptions[4].exception, "app shutdown FAIL", "should have failed");
      cheapAssertStringContains(exceptions[5].exception, "experiment shutdown FAIL", "should have failed");
      cheapAssertStringContains(exceptions[6].exception, "experiment cleanup FAIL", "should have failed");
      cheapAssertStringContains(exceptions[7].exception, "enter private browsing FAIL", "should have failed");
      cheapAssertStringContains(exceptions[8].exception, "exit private browsing FAIL", "should have failed");

      // Now do a wipe and verify that it clears all exceptions.
      store.wipeAllData(function() {
        experiment._prependMetadataToJSON(function(jsonString) {
          let exceptions = JSON.parse(jsonString).exceptions;
          cheapAssertEqual(exceptions.length, 0, "Exceptions should be wiped!");
          // TODO this should be a teardown:
          clearDbFile(fileName);
        });
      });
    });
  });
});
}


function runAllTests() {
  testsRun = 0;
  testsPassed = 0;

  testTheDataStore();
  //testFirefoxVersionCheck();
  //testStringSanitizer();
  //testTheCuddlefishPreferencesFilesystem();
  //testRemoteLoader();
  //testRemoteLoaderIndexCache();
  //testRecurringStudyStateChange();
  //testKillSwitch();
  //testSameGUIDs();
  //testExceptionLogging();
  output("TESTING COMPLETE.  " + testsPassed + " out of " + testsRun +
       " tests passed.");
}
