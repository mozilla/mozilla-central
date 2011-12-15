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
 *   Atul Varma <atul@mozilla.com>
 *   Jono X <jono@mozilla.com>
 *   Raymond Lee <raymond@appcoast.com>
 *   Jorge Villalobos <jorge@mozilla.com>
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

EXPORTED_SYMBOLS = ["TestPilotSetup", "POPUP_SHOW_ON_NEW",
                    "POPUP_SHOW_ON_FINISH", "POPUP_SHOW_ON_RESULTS",
                    "ALWAYS_SUBMIT_DATA", "RUN_AT_ALL_PREF"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

const EXTENSION_ID = "tbtestpilot@labs.mozilla.com";
const VERSION_PREF ="extensions.testpilot.lastversion";
const FIRST_RUN_PREF ="extensions.testpilot.firstRunUrl";
const RUN_AT_ALL_PREF = "extensions.testpilot.runStudies";
const POPUP_SHOW_ON_NEW = "extensions.testpilot.popup.showOnNewStudy";
const POPUP_SHOW_ON_FINISH = "extensions.testpilot.popup.showOnStudyFinished";
const POPUP_SHOW_ON_RESULTS = "extensions.testpilot.popup.showOnNewResults";
const POPUP_CHECK_INTERVAL = "extensions.testpilot.popup.delayAfterStartup";
const POPUP_REMINDER_INTERVAL = "extensions.testpilot.popup.timeBetweenChecks";
const ALWAYS_SUBMIT_DATA = "extensions.testpilot.alwaysSubmitData";
const UPDATE_CHANNEL_PREF = "app.update.channel";
const LOG_FILE_NAME = "TestPilotErrorLog.log";
const RANDOM_DEPLOY_PREFIX = "extensions.testpilot.deploymentRandomizer";

const THUNDERBIRD_APP_ID = "{3550f703-e582-4d05-9a08-453d09bdfdc6}";

Cu.import("resource://testpilot/modules/interface.js");

let TestPilotSetup = {
  didReminderAfterStartup: false,
  startupComplete: false,
  _shortTimer: null,
  _longTimer: null,
  _remoteExperimentLoader: null, // TODO make this a lazy initializer too?
  taskList: [],
  version: "",

  // Lazy initializers:
  __prefs: null,
  get _prefs() {
    if (this.__prefs == null) {
      this.__prefs = Cc["@mozilla.org/preferences-service;1"]
        .getService(Ci.nsIPrefBranch);
    }
    return this.__prefs;
  },

  __loader: null,
  get _loader() {
    if (this.__loader == null) {
      let Cuddlefish = {};
      Components.utils.import("resource://testpilot/modules/lib/cuddlefish.js",
                        Cuddlefish);
      let repo = this._logRepo;
      this.__loader = new Cuddlefish.Loader(
          {rootPaths: ["resource://testpilot/modules/",
                     "resource://testpilot/modules/lib/"],
           console: repo.getLogger("TestPilot.Loader")
      });
    }
    return this.__loader;
  },

  __feedbackManager: null,
  get _feedbackManager() {
    if (this.__feedbackManager == null) {
      let FeedbackModule = {};
      Cu.import("resource://testpilot/modules/feedback.js", FeedbackModule);
      this.__feedbackManager = FeedbackModule.FeedbackManager;
    }
    return this.__feedbackManager;
  },

  __dataStoreModule: null,
  get _dataStoreModule() {
    if (this.__dataStoreModule == null) {
      this.__dataStoreModule = {};
      Cu.import("resource://testpilot/modules/experiment_data_store.js",
                  this._dataStoreModule);
    }
    return this.__dataStoreModule;
  },

  __logRepo: null,
  get _logRepo() {
    // Note: This hits the disk so it's an expensive operation; don't call it
    // on startup.
    if (this.__logRepo == null) {
      let Log4MozModule = {};
      Cu.import("resource://testpilot/modules/log4moz.js", Log4MozModule);
      let props = Cc["@mozilla.org/file/directory_service;1"].
                    getService(Ci.nsIProperties);
      let logFile = props.get("ProfD", Components.interfaces.nsIFile);
      logFile.append(LOG_FILE_NAME);
      let formatter = new Log4MozModule.Log4Moz.BasicFormatter;
      let root = Log4MozModule.Log4Moz.repository.rootLogger;
      root.level = Log4MozModule.Log4Moz.Level["All"];
      let appender = new Log4MozModule.Log4Moz.RotatingFileAppender(logFile, formatter);
      root.addAppender(appender);
      this.__logRepo = Log4MozModule.Log4Moz.repository;
    }
    return this.__logRepo;
  },

  __logger: null,
  get _logger() {
    if (this.__logger == null) {
      this.__logger = this._logRepo.getLogger("TestPilot.Setup");
    }
    return this.__logger;
  },

  __taskModule: null,
  get _taskModule() {
    if (this.__taskModule == null) {
      this.__taskModule = {};
      Cu.import("resource://testpilot/modules/tasks.js", this.__taskModule);
    }
    return this.__taskModule;
  },

  __stringBundle: null,
  get _stringBundle() {
    if (this.__stringBundle == null) {
      this.__stringBundle =
      Cc["@mozilla.org/intl/stringbundle;1"].
        getService(Ci.nsIStringBundleService).
          createBundle("chrome://testpilot/locale/main.properties");
    }
    return this.__stringBundle;
  },

  __obs: null,
  get _obs() {
    if (this.__obs == null) {
      this.__obs = this._loader.require("observer-service");
    }
    return this.__obs;
  },

  __notifier: null,
  get _notifier() {
    if (this.__notifier == null) {
      this.__notifier = TestPilotUIBuilder.getNotificationManager();
    }
    return this.__notifier;
  },

  get _appID() {
    delete this._appID;
    return this._appID = Components.classes["@mozilla.org/xre/app-info;1"]
        .getService(Components.interfaces.nsIXULAppInfo).ID;
  },

  globalStartup: function TPS__doGlobalSetup() {
    // Only ever run this stuff ONCE, on the first window restore.
    // Should get called by the Test Pilot component.
    let logger = this._logger;
    logger.trace("TestPilotSetup.globalStartup was called.");

    try {
    if (!this._prefs.getBoolPref(RUN_AT_ALL_PREF)) {
      logger.trace("Test Pilot globally disabled: Not starting up.");
      return;
    }

    // Set up observation for task state changes
    var self = this;
    this._obs.add("testpilot:task:changed", this.onTaskStatusChanged, self);
    this._obs.add(
      "testpilot:task:dataAutoSubmitted", this._onTaskDataAutoSubmitted, self);
    // Set up observation for application shutdown.
    this._obs.add("quit-application", this.globalShutdown, self);
    // Set up observation for enter/exit private browsing:
    this._obs.add("private-browsing", this.onPrivateBrowsingMode, self);

    // Set up timers to remind user x minutes after startup
    // and once per day thereafter.  Use nsITimer so it doesn't belong to
    // any one window.
    logger.trace("Setting interval for showing reminders...");

    this._shortTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    this._shortTimer.initWithCallback(
      { notify: function(timer) { self._doHousekeeping();} },
      this._prefs.getIntPref(POPUP_CHECK_INTERVAL),
      Ci.nsITimer.TYPE_REPEATING_SLACK
    );
    this._longTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    this._longTimer.initWithCallback(
      { notify: function(timer) {
          self.reloadRemoteExperiments(function() {
            self._notifyUserOfTasks();
	  });
      }}, this._prefs.getIntPref(POPUP_REMINDER_INTERVAL),
      Ci.nsITimer.TYPE_REPEATING_SLACK);

      this.getVersion(function() {
        /* Show first run page (in front window) only the first time after install;
         * Don't show first run page in Feedback UI version. */
        if (!self._prefs.prefHasUserValue(VERSION_PREF) &&
            (!TestPilotUIBuilder.channelUsesFeedback())
            && self._shouldOpenTabs()) {
            self._prefs.setCharPref(VERSION_PREF, self.version);
            let browser = self._getFrontBrowserWindow().getBrowser();
            let url = self._prefs.getCharPref(FIRST_RUN_PREF);
            self._openInTab(url);
        }

        // Install tasks. (This requires knowing the version, so it is
        // inside the callback from getVersion.)
        self.checkForTasks(function() {
          /* Callback to complete startup after we finish
           * checking for tasks. */
         self.startupComplete = true;
         logger.trace("I'm in the callback from checkForTasks.");
         // Send startup message to each task:
         for (let i = 0; i < self.taskList.length; i++) {
           self.taskList[i].onAppStartup();
         }
         self._obs.notify("testpilot:startup:complete", "", null);
         /* onWindowLoad gets called once for each window,
          * but only after we fire this notification. */
         logger.trace("Testpilot startup complete.");
      });
    });
    } catch(e) {
      logger.error("Error in testPilot startup: " + e);
    }
  },

  globalShutdown: function TPS_globalShutdown() {
    let logger = this._logger;
    logger.trace("Global shutdown.  Unregistering everything.");
    let self = this;
    for (let i = 0; i < self.taskList.length; i++) {
      self.taskList[i].onAppShutdown();
      self.taskList[i].onExperimentShutdown();
    }
    this.taskList = [];
    this._loader.unload();
    this._obs.remove("testpilot:task:changed", this.onTaskStatusChanged, self);
    this._obs.remove(
      "testpilot:task:dataAutoSubmitted", this._onTaskDataAutoSubmitted, self);
    this._obs.remove("quit-application", this.globalShutdown, self);
    this._obs.remove("private-browsing", this.onPrivateBrowsingMode, self);
    this._loader.unload();
    this._shortTimer.cancel();
    this._longTimer.cancel();
    logger.trace("Done unregistering everything.");
  },

  _getFrontBrowserWindow: function TPS__getFrontWindow() {
    let wm = Cc["@mozilla.org/appshell/window-mediator;1"].
               getService(Ci.nsIWindowMediator);
    // TODO Is "most recent" the same as "front"?
    return wm.getMostRecentWindow("navigator:browser") ||
           wm.getMostRecentWindow("mail:3pane");
  },

  onPrivateBrowsingMode: function TPS_onPrivateBrowsingMode(topic, data) {
    for (let i = 0; i < this.taskList.length; i++) {
      if (data == "enter") {
        this.taskList[i].onEnterPrivateBrowsing();
      } else if (data == "exit") {
        this.taskList[i].onExitPrivateBrowsing();
      }
    }
  },

  onWindowUnload: function TPS__onWindowRegistered(window) {
    this._logger.trace("Called TestPilotSetup.onWindow unload!");
    for (let i = 0; i < this.taskList.length; i++) {
      this.taskList[i].onWindowClosed(window);
    }
  },

  onWindowLoad: function TPS_onWindowLoad(window) {
    this._logger.trace("Called TestPilotSetup.onWindowLoad!");
    // Run this stuff once per window...
    let self = this;

    // Register listener for URL loads, that will notify all tasks about
    // new page:
    let appcontent = window.document.getElementById("appcontent");
    if (appcontent) {
      appcontent.addEventListener("DOMContentLoaded", function(event) {
        let newUrl =  event.originalTarget.URL;
        self._feedbackManager.fillInFeedbackPage(newUrl, window);
        for (let i = 0; i < self.taskList.length; i++) {
          self.taskList[i].onUrlLoad(newUrl, event);
        }
      }, true);
    }

    // Let each task know about the new window.
    for (let i = 0; i < this.taskList.length; i++) {
      this.taskList[i].onNewWindow(window);
    }
  },

  addTask: function TPS_addTask(testPilotTask) {
    // TODO raise some kind of exception if a task with the same ID already
    // exists.  No excuse to ever be running two copies of the same task.
    this.taskList.push(testPilotTask);
  },

  _openChromeless: function TPS__openChromeless(url) {
    let window = this._getFrontBrowserWindow();
    window.TestPilotWindowUtils.openChromeless(url);
  },

  _openInTab: function TPS__openInTab(url) {
    let window = this._getFrontBrowserWindow();
    window.TestPilotWindowUtils.openInTab(url);
  },

  _showSubmitNotification: function(task) {
    let win = this._getFrontBrowserWindow();
    let self = this;
    this._notifier.showNotification(win, {
      text: self._stringBundle.formatStringFromName(
        "testpilot.notification.readyToSubmit.message", [task.title], 1),
      title: self._stringBundle.GetStringFromName("testpilot.notification.readyToSubmit"),
      iconClass: "study-finished",
      moreInfoLabel: self._stringBundle.GetStringFromName("testpilot.notification.seeYourData"),
      moreInfoCallback: function() { task.loadPage(); },
      submitLabel: self._stringBundle.GetStringFromName("testpilot.submit"),
      submitCallback: function() {
        task.upload( function(success) {
          if (success) {
            self._notifier.showNotification(win, {
              text: self._stringBundle.GetStringFromName(
                  "testpilot.notification.thankYouForUploadingData.message"),
              title: self._stringBundle.GetStringFromName(
                  "testpilot.notification.thankYouForUploadingData"),
              iconClass:"study-submitted",
              linkText: self._stringBundle.GetStringFromName("testpilot.notification.seeYourData"),
              linkCallback: function() {task.loadPage(); },
              fragile: true
            });
          } else {
              // TODO any point in showing an error message here?
          } }
        );
      },
      cancelLabel: self._stringBundle.GetStringFromName("testpilot.notification.cancelLabel"),
      cancelCallback: function() {
        task.optOut(null, null);
      },
      seeAllStudiesLabel: self._stringBundle.GetStringFromName("testpilot.notification.seeAllStudiesLabel"),
      seeAllStudiesCallback: function() {
        self._getFrontBrowserWindow().TestPilotWindowUtils.openAllStudiesWindow();
      },
      alwaysSubmitLabel: self._stringBundle.GetStringFromName("testpilot.notification.alwaysSubmitLabel"),
      alwaysSubmitCallback: function() {
        self._prefs.setBoolPref(ALWAYS_SUBMIT_DATA, true);
      }
    });
  },

  _notifyUserOfTasks: function TPS__notifyUser() {
    // Check whether there are tasks needing attention, and if any are
    // found, show the popup door-hanger thingy.
    let i, task;
    let self = this;
    let TaskConstants = this._taskModule.TaskConstants;
    let win = this._getFrontBrowserWindow();

    // Highest priority is if there is a finished test (needs a decision)
    if (this._prefs.getBoolPref(POPUP_SHOW_ON_FINISH)) {
      for (i = 0; i < this.taskList.length; i++) {
        task = this.taskList[i];
        if (task.status == TaskConstants.STATUS_FINISHED) {
          if (!this._prefs.getBoolPref(ALWAYS_SUBMIT_DATA)) {
            this._showSubmitNotification(task);
            return;
          }
        }
      }
    }

    // If there's no finished test, next highest priority is new tests that
    // are starting...
    if (this._prefs.getBoolPref(POPUP_SHOW_ON_NEW)) {
      for (i = 0; i < this.taskList.length; i++) {
        task = this.taskList[i];
        if (task.status == TaskConstants.STATUS_PENDING ||
            task.status == TaskConstants.STATUS_NEW) {
          if (task.taskType == TaskConstants.TYPE_EXPERIMENT) {
            this._notifier.showNotification(win, {
	      text: self._stringBundle.formatStringFromName(
		"testpilot.notification.newTestPilotStudy.pre.message",
		[task.title], 1),
	      title: self._stringBundle.GetStringFromName(
		"testpilot.notification.newTestPilotStudy"),
	      iconClass: "new-study",
	      moreInfoLabel: self._stringBundle.GetStringFromName("testpilot.moreInfo"),
              moreInfoCallback: function() { task.loadPage(); },
              cancelLabel: self._stringBundle.GetStringFromName("testpilot.notification.cancelLabel"),
              cancelCallback: function() {
                task.optOut(null, null);
              },
              seeAllStudiesLabel: self._stringBundle.GetStringFromName("testpilot.notification.seeAllStudiesLabel"),
              seeAllStudiesCallback: function() {
                win.TestPilotWindowUtils.openAllStudiesWindow();
              },
              alwaysSubmitLabel: self._stringBundle.GetStringFromName("testpilot.notification.dontShowNewLabel"),
              alwaysSubmitCallback: function() {
                self._prefs.setBoolPref(POPUP_SHOW_ON_NEW, false);
              },
              closeCallback: function() {
                /* on close callback (Bug 575767) -- when the "new study
                 * starting" popup is dismissed, then the study can start. */
                // closeCallback gets called after cancelCallback, so make sure study isn't already
                // canceled.
                if (task.status < TaskConstants.STATUS_STARTING) {
                  task.changeStatus(TaskConstants.STATUS_STARTING, true);
                  TestPilotSetup.reloadRemoteExperiments();
                }
              }});
            return;
          } else if (task.taskType == TaskConstants.TYPE_SURVEY) {
            this._notifier.showNotification(win, {
	      text: self._stringBundle.formatStringFromName(
		"testpilot.notification.newTestPilotSurvey.message",
		[task.title], 1),
              title: self._stringBundle.GetStringFromName(
		"testpilot.notification.newTestPilotSurvey"),
	      iconClass: "new-study",
	      moreInfoLabel: self._stringBundle.GetStringFromName("testpilot.takeSurvey"),
	      moreInfoCallback: function() { task.loadPage(); }
            });
            task.changeStatus(TaskConstants.STATUS_IN_PROGRESS, true);
            return;
          }
        }
      }
    }

    // And finally, new experiment results:
    if (this._prefs.getBoolPref(POPUP_SHOW_ON_RESULTS)) {
      for (i = 0; i < this.taskList.length; i++) {
        task = this.taskList[i];
        if (task.taskType == TaskConstants.TYPE_RESULTS &&
            task.status == TaskConstants.STATUS_NEW) {
              self._notifier.showNotification( win, {
	        text: self._stringBundle.formatStringFromName(
	          "testpilot.notification.newTestPilotResults.message",
	          [task.title], 1),
                title: self._stringBundle.GetStringFromName(
	          "testpilot.notification.newTestPilotResults"),
	        iconClass: "new-results",
	        moreInfoLabel: self._stringBundle.GetStringFromName("testpilot.moreInfo"),
                moreInfoCallback: function() { task.loadPage(); }
              });
                // TODO have a "don't tell me about these anymore" option?
              /* Having shown the notification, advance the status of the
               * results, so that this notification won't be shown again */
              task.changeStatus(TaskConstants.STATUS_ARCHIVED, true);
              return;
        }
      }
    }
  },

  _doHousekeeping: function TPS__doHousekeeping() {
    // check date on all tasks:
    for (let i = 0; i < this.taskList.length; i++) {
      let task = this.taskList[i];
      task.checkDate();
    }
    // Do a full reminder -- but at most once per browser session
    if (!this.didReminderAfterStartup) {
      this._logger.trace("Doing reminder after startup...");
      this.didReminderAfterStartup = true;
      this._notifyUserOfTasks();
    }
  },

  onTaskStatusChanged: function TPS_onTaskStatusChanged() {
    this._notifyUserOfTasks();
  },

  _onTaskDataAutoSubmitted: function(subject, data) {
    let task = subject;
    this._notifier.showNotification( win, {
      text: self._stringBundle.formatStringFromName(
	"testpilot.notification.autoUploadedData.message",
	[subject.title], 1),
      title: self._stringBundle.GetStringFromName(
	"testpilot.notification.autoUploadedData"),
      iconClass: "study-submitted",
      moreInfoText: self._stringBundle.GetStringFromName("testpilot.notification.seeYourData"),
      moreInfoCallback: function() { task.loadPage(); }
    });
  },

  getVersion: function TPS_getVersion(callback) {
    // Application.extensions undefined in Firefox 4; will use the new
    // asynchrounous API, store string in this.version, and call the
    // callback when done.
    let self = this;
    if (self.version != "") {
      if (callback) {
        callback();
      }
    } else {
      Cu.import("resource://gre/modules/AddonManager.jsm");
      AddonManager.getAddonByID(EXTENSION_ID, function(addon) {
        self.version = addon.version;
        if (callback) {
          callback();
        }
      });
    }
  },

  _isNewerThanMe: function TPS__isNewerThanMe(versionString) {
    let result = Cc["@mozilla.org/xpcom/version-comparator;1"]
                   .getService(Ci.nsIVersionComparator)
                   .compare(this.version, versionString);
    if (result < 0) {
      return true; // versionString is newer than my version
    } else {
      return false; // versionString is the same as or older than my version
    }
  },

  _isNewerThanFirefox: function TPS__isNewerThanFirefox(versionString) {
    let appVersion = Cc["@mozilla.org/xre/app-info;1"]
                       .getService(Ci.nsIXULAppInfo).version;
    let result = Cc["@mozilla.org/xpcom/version-comparator;1"]
                   .getService(Ci.nsIVersionComparator)
                   .compare(appVersion, versionString);
    if (result < 0) {
      return true; // versionString is newer than Firefox
    } else {
      return false; // versionString is the same as or older than Firefox
    }
  },

  _experimentRequirementsAreMet: function TPS__requirementsMet(experiment) {
    /* Returns true if we we meet the requirements to run this experiment
     * (e.g. meet the minimum Test Pilot version and Firefox version)
     * false if not.
     * Default is always to run the study - return true UNLESS the study
     * specifies a requirement that we don't meet. */
    let logger = this._logger;
    try {
      let minTpVer, minFxVer, expName, runOrNotFunc, randomDeployment;
      /* Could be an experiment, which specifies experimentInfo, or survey,
       * which specifies surveyInfo. */
      let info = experiment.experimentInfo ?
                   experiment.experimentInfo :
                   experiment.surveyInfo;
      if (!info) {
        // If neither one is supplied, study lacks metadata required to run
        logger.warn("Study lacks minimum metadata to run.");
        return false;
      }
      minTpVer = info.minTPVersion;
      minFxVer = info.minFXVersion;
      expName =  info.testName;
      runOrNotFunc = info.runOrNotFunc;
      randomDeployment = info.randomDeployment;

      // Minimum test pilot version:
      if (minTpVer && this._isNewerThanMe(minTpVer)) {
        logger.warn("Not loading " + expName);
        logger.warn("Because it requires Test Pilot version " + minTpVer);
        return false;
      }

      // Minimum firefox version:
      if (minFxVer && this._isNewerThanFirefox(minFxVer)) {
        logger.warn("Not loading " + expName);
        logger.warn("Because it requires Firefox version " + minFxVer);
        return false;
      }

      // Random deployment (used to give study to random subsample of users)
      if (randomDeployment) {
        /* Roll a hundred-sided die. Remember what we roll for later reference.  A study
         * using random subsample deployment will provide a range (say, 0 ~ 30) which means
         * only users who roll within that range will run the study. */
        let prefName = RANDOM_DEPLOY_PREFIX + "." + randomDeployment.rolloutCode;
        if (!this._prefs.prefHasUserValue(prefName)) {
          let myRoll = Math.floor(Math.random()*100);
          this._prefs.setIntPref(prefName, myRoll);
        } else {
          let myRoll = this._prefs.getIntPref(prefName);
          if (myRoll < randomDeployment.minRoll) {
            return false;
          }
          if (myRoll > randomDeployment.maxRoll) {
            return false;
          }
        }
      }

      /* The all-purpose, arbitrary code "Should this study run?" function - if
       * provided, use its return value. */
      if (runOrNotFunc) {
        return runOrNotFunc();
      }
    } catch (e) {
      logger.warn("Error in requirements check " +  e);
    }
    return true;
  },

  _shouldOpenTabs: function TPS__shouldOpenTabs() {
    // For Thunderbird, we don't want the Test Pilot tab spawning, since
    // we're bundling Test Pilot in the release.
    return !(this._appID == THUNDERBIRD_APP_ID);
  },

  checkForTasks: function TPS_checkForTasks(callback) {
    let logger = this._logger;
    if (! this._remoteExperimentLoader ) {
      logger.trace("Now requiring remote experiment loader:");
      let remoteLoaderModule = this._loader.require("remote-experiment-loader");
      logger.trace("Now instantiating remoteExperimentLoader:");
      let rel = new remoteLoaderModule.RemoteExperimentLoader(this._logRepo);
      this._remoteExperimentLoader = rel;
    }

    let self = this;
    this._remoteExperimentLoader.checkForUpdates(
      function(success) {
        logger.info("Getting updated experiments... Success? " + success);
        // Actually, we do exactly the same thing whether we succeeded in
        // downloading new contents or not...
        let experiments = self._remoteExperimentLoader.getExperiments();

        for (let filename in experiments) {
          if (!self._experimentRequirementsAreMet(experiments[filename])) {
            continue;
          }
          try {
            // The try-catch ensures that if something goes wrong in loading one
            // experiment, the other experiments after that one still get loaded.
            logger.trace("Attempting to load experiment " + filename);

            let task;
            // Could be a survey: check if surveyInfo is exported:
            if (experiments[filename].surveyInfo != undefined) {
              let sInfo = experiments[filename].surveyInfo;
              // If it supplies questions, it's a built-in survey.
              // If not, it's a web-based survey.
              if (!sInfo.surveyQuestions) {
                task = new self._taskModule.TestPilotWebSurvey(sInfo);
              } else {
                task = new self._taskModule.TestPilotBuiltinSurvey(sInfo);
              }
            } else {
              // This one must be an experiment.
              let expInfo = experiments[filename].experimentInfo;
              let dsInfo = experiments[filename].dataStoreInfo;
              let dataStore = new self._dataStoreModule.ExperimentDataStore(
                dsInfo.fileName, dsInfo.tableName, dsInfo.columns );
              let webContent = experiments[filename].webContent;
              task = new self._taskModule.TestPilotExperiment(expInfo,
                                                              dataStore,
                                                              experiments[filename].handlers,
                                                              webContent);
            }
            self.addTask(task);
            logger.info("Loaded task " + filename);
          } catch (e) {
            logger.warn("Failed to load task " + filename + ": " + e);
          }
        } // end for filename in experiments

        // Handling new results is much simpler:
        let results = self._remoteExperimentLoader.getStudyResults();
        for (let r in results) {
          let studyResult = new self._taskModule.TestPilotStudyResults(results[r]);
          self.addTask(studyResult);
        }

        /* Legacy studies = stuff we no longer have the code for, but
         * if the user participated in it we want to keep that metadata. */
        let legacyStudies = self._remoteExperimentLoader.getLegacyStudies();
        for (let l in legacyStudies) {
          let legacyStudy = new self._taskModule.TestPilotLegacyStudy(legacyStudies[l]);
          self.addTask(legacyStudy);
        }

        if (callback) {
          callback();
        }
      }
    );
  },

  reloadRemoteExperiments: function TPS_reloadRemoteExperiments(callback) {
    for (let i = 0; i < this.taskList.length; i++) {
      this.taskList[i].onExperimentShutdown();
    }

    this.taskList = [];
    this._loader.unload();

    this.checkForTasks(callback);
  },

  getTaskById: function TPS_getTaskById(id) {
    for (let i = 0; i < this.taskList.length; i++) {
      let task = this.taskList[i];
      if (task.id == id) {
	return task;
      }
    }
    return null;
  },

  getAllTasks: function TPS_getAllTasks() {
    return this.taskList;
  }
};
