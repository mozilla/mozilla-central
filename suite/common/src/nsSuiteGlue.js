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
 * The Original Code is the Browser Search Service.
 *
 * The Initial Developer of the Original Code is
 * Giorgio Maone.
 * Portions created by the Initial Developer are Copyright (C) 2005
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Giorgio Maone <g.maone@informaction.com>
 *   Seth Spitzer <sspitzer@mozilla.com>
 *   Asaf Romano <mano@mozilla.com>
 *   Robert Kaiser <kairo@kairo.at>
 *   Nils Maier <maierman@web.de>
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

const XULNS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://app/modules/Sanitizer.jsm");

// Constructor

function SuiteGlue() {
  this._init();
}

SuiteGlue.prototype = {
  _saveSession: false,

  _setPrefToSaveSession: function()
  {
    var prefBranch = Components.classes["@mozilla.org/preferences-service;1"].
                     getService(Components.interfaces.nsIPrefBranch);
    prefBranch.setBoolPref("browser.sessionstore.resume_session_once", true);
  },

  // nsIObserver implementation
  observe: function(subject, topic, data)
  {
    switch(topic) {
      case "xpcom-shutdown":
        this._dispose();
        break;
      case "final-ui-startup":
        this._onProfileStartup();
        this._checkForNewAddons();
        break;
      case "browser:purge-session-history":
        // reset the console service's error buffer
        const cs = Components.classes["@mozilla.org/consoleservice;1"]
                             .getService(Components.interfaces.nsIConsoleService);
        cs.logStringMessage(null); // clear the console (in case it's open)
        cs.reset();
        break;
      case "quit-application-requested":
        this._onQuitRequest(subject, data);
        break;
      case "quit-application-granted":
        this._onProfileShutdown();
        if (this._saveSession) {
          this._setPrefToSaveSession();
        }
        break;
      case "browser-lastwindow-close-requested":
        // The application is not actually quitting, but the last full browser
        // window is about to be closed.
        this._onQuitRequest(subject, "lastwindow");
        break;
      case "browser-lastwindow-close-granted":
        if (this._saveSession)
          this._setPrefToSaveSession();
        break;
      case "session-save":
        this._setPrefToSaveSession();
        subject.QueryInterface(Components.interfaces.nsISupportsPRBool);
        subject.data = true;
        break;
    }
  },

  // initialization (called on application startup)
  _init: function()
  {
    // observer registration
    const osvr = Components.classes["@mozilla.org/observer-service;1"]
                           .getService(Components.interfaces.nsIObserverService);
    osvr.addObserver(this, "xpcom-shutdown", false);
    osvr.addObserver(this, "final-ui-startup", false);
    osvr.addObserver(this, "browser:purge-session-history", false);
    osvr.addObserver(this, "quit-application-requested", false);
    osvr.addObserver(this, "quit-application-granted", false);
    osvr.addObserver(this, "browser-lastwindow-close-requested", false);
    osvr.addObserver(this, "browser-lastwindow-close-granted", false);
    osvr.addObserver(this, "session-save", false);
  },

  // cleanup (called on application shutdown)
  _dispose: function()
  {
    // observer removal
    const osvr = Components.classes["@mozilla.org/observer-service;1"]
                           .getService(Components.interfaces.nsIObserverService);
    osvr.removeObserver(this, "xpcom-shutdown");
    osvr.removeObserver(this, "final-ui-startup");
    osvr.removeObserver(this, "browser:purge-session-history");
    osvr.removeObserver(this, "quit-application-requested");
    osvr.removeObserver(this, "quit-application-granted");
    osvr.removeObserver(this, "browser-lastwindow-close-requested");
    osvr.removeObserver(this, "browser-lastwindow-close-granted");
    osvr.removeObserver(this, "session-save");
  },

  // profile startup handler (contains profile initialization routines)
  _onProfileStartup: function()
  {
    this._updatePrefs();

    Sanitizer.checkAndSanitize();

    const prefSvc = Components.classes["@mozilla.org/preferences-service;1"]
                              .getService(Components.interfaces.nsIPrefBranch2);
    if (prefSvc.prefHasUserValue("privacy.sanitize.didShutdownSanitize")) {
      prefSvc.clearUserPref("privacy.sanitize.didShutdownSanitize");
      // We need to persist this preference change, since we want to
      // check it at next app start even if the browser exits abruptly
      prefSvc.savePrefFile(null);
    }

    // once we support a safe mode popup, it should be called here
  },

  // profile shutdown handler (contains profile cleanup routines)
  _onProfileShutdown: function()
  {
    Sanitizer.checkAndSanitize();
  },

  // If new add-ons were installed during startup, open the add-ons manager.
  _checkForNewAddons: function()
  {
    const PREF_EM_NEW_ADDONS_LIST = "extensions.newAddons";

    const prefBranch = Components.classes["@mozilla.org/preferences-service;1"]
                                 .getService(Components.interfaces.nsIPrefBranch);
    if (!prefBranch.prefHasUserValue(PREF_EM_NEW_ADDONS_LIST))
      return;

    const args = Components.classes["@mozilla.org/array;1"]
                           .createInstance(Components.interfaces.nsIMutableArray);
    let str = Components.classes["@mozilla.org/supports-string;1"]
                        .createInstance(Components.interfaces.nsISupportsString);
    args.appendElement(str, false);
    str = Components.classes["@mozilla.org/supports-string;1"]
                    .createInstance(Components.interfaces.nsISupportsString);
    str.data = prefBranch.getCharPref(PREF_EM_NEW_ADDONS_LIST);
    args.appendElement(str, false);
    const EMURL = "chrome://mozapps/content/extensions/extensions.xul";
    // This window is the "first" to open.
    // 'alwaysRaised' makes sure it stays in the foreground (though unfocused)
    //   so it is noticed.
    const EMFEATURES = "all,dialog=no,alwaysRaised";
    const ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                         .getService(Components.interfaces.nsIWindowWatcher);
    ww.openWindow(null, EMURL, "_blank", EMFEATURES, args);

    prefBranch.clearUserPref(PREF_EM_NEW_ADDONS_LIST);
  },

  _onQuitRequest: function(aCancelQuit, aQuitType)
  {
    // If user has already dismissed quit request, then do nothing
    if ((aCancelQuit instanceof Components.interfaces.nsISupportsPRBool) && aCancelQuit.data)
      return;

    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].
             getService(Components.interfaces.nsIWindowMediator);
    var windowcount = 0;
    var pagecount = 0;
    var browserEnum = wm.getEnumerator("navigator:browser");
    while (browserEnum.hasMoreElements()) {
      windowcount++;

      var browser = browserEnum.getNext();
      var tabbrowser = browser.document.getElementById("content");
      if (tabbrowser)
        pagecount += tabbrowser.browsers.length;
    }

    this._saveSession = false;
    if (pagecount < 2)
      return;

    if (aQuitType != "restart")
      aQuitType = "quit";

    var prefBranch = Components.classes["@mozilla.org/preferences-service;1"].
                     getService(Components.interfaces.nsIPrefBranch);
    var showPrompt = true;
    try {
      // browser.warnOnQuit is a hidden global boolean to override all quit prompts
      // browser.warnOnRestart specifically covers app-initiated restarts where we restart the app
      // browser.tabs.warnOnClose is the global "warn when closing multiple tabs" pref
      if (prefBranch.getIntPref("browser.startup.page") == 3 ||
          prefBranch.getBoolPref("browser.sessionstore.resume_session_once") ||
          !prefBranch.getBoolPref("browser.warnOnQuit"))
        showPrompt = false;
      else if (aQuitType == "restart")
        showPrompt = prefBranch.getBoolPref("browser.warnOnRestart");
      else
        showPrompt = prefBranch.getBoolPref("browser.tabs.warnOnClose");
    } catch (ex) {}

    if (showPrompt) {
      var bundleService = Components.classes["@mozilla.org/intl/stringbundle;1"].
                          getService(Components.interfaces.nsIStringBundleService);
      var quitBundle = bundleService.createBundle("chrome://communicator/locale/quitDialog.properties");
      var brandBundle = bundleService.createBundle("chrome://branding/locale/brand.properties");

      var appName = brandBundle.GetStringFromName("brandShortName");
      var quitDialogTitle = quitBundle.formatStringFromName(aQuitType + "DialogTitle",
                                                              [appName], 1);

      var message;
      if (aQuitType == "restart")
        message = quitBundle.formatStringFromName("messageRestart",
                                                  [appName], 1);
      else if (windowcount == 1)
        message = quitBundle.formatStringFromName("messageNoWindows",
                                                  [appName], 1);
      else
        message = quitBundle.formatStringFromName("message",
                                                  [appName], 1);

      var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].
                          getService(Components.interfaces.nsIPromptService);

      var flags = promptService.BUTTON_TITLE_IS_STRING * promptService.BUTTON_POS_0 +
                  promptService.BUTTON_TITLE_IS_STRING * promptService.BUTTON_POS_1 +
                  promptService.BUTTON_POS_0_DEFAULT;

      var neverAsk = {value:false};
      var button0Title, button2Title;
      var button1Title = quitBundle.GetStringFromName("cancelTitle");
      var neverAskText = quitBundle.GetStringFromName("neverAsk");

      if (aQuitType == "restart")
        button0Title = quitBundle.GetStringFromName("restartTitle");
      else {
        flags += promptService.BUTTON_TITLE_IS_STRING * promptService.BUTTON_POS_2;
        button0Title = quitBundle.GetStringFromName("saveTitle");
        button2Title = quitBundle.GetStringFromName("quitTitle");
      }

      var mostRecentBrowserWindow = wm.getMostRecentWindow("navigator:browser");
      var buttonChoice = promptService.confirmEx(mostRecentBrowserWindow, quitDialogTitle, message,
                                       flags, button0Title, button1Title, button2Title,
                                       neverAskText, neverAsk);

      switch (buttonChoice) {
      case 2:
        if (neverAsk.value)
          prefBranch.setBoolPref("browser.tabs.warnOnClose", false);
        break;
      case 1:
        aCancelQuit.QueryInterface(Components.interfaces.nsISupportsPRBool);
        aCancelQuit.data = true;
        break;
      case 0:
        this._saveSession = true;
        if (neverAsk.value) {
          if (aQuitType == "restart")
            prefBranch.setBoolPref("browser.warnOnRestart", false);
          else {
            // always save state when shutting down
            prefBranch.setIntPref("browser.startup.page", 3);
          }
        }
        break;
      }
    }
  },

  _updatePrefs: function()
  {
    // Get the preferences service
    var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                          .getService(Components.interfaces.nsIPrefService)
                          .getBranch(null);
    const PREF_INVALID = Components.interfaces.nsIPrefBranch.PREF_INVALID;
    if (prefs.getPrefType("browser.download.dir") == PREF_INVALID ||
        prefs.getPrefType("browser.download.lastDir") != PREF_INVALID)
      return; //Do nothing if .dir does not exist, or if it exists and lastDir does not

    try {
      prefs.setComplexValue("browser.download.lastDir",
                            Components.interfaces.nsILocalFile,
                            prefs.getComplexValue("browser.download.dir",
                                                  Components.interfaces.nsILocalFile));
    } catch (ex) {
      // Ensure that even if we don't end up migrating to a lastDir that we
      // don't attempt another update. This will throw when QI'ed to
      // nsILocalFile, but it does fallback gracefully.
      prefs.setCharPref("browser.download.lastDir", "");
    }

    try {
      prefs.setBoolPref("browser.download.useDownloadDir",
                        prefs.getBoolPref("browser.download.autoDownload"));
    } catch (ex) {}

    try {
      prefs.setIntPref("browser.download.manager.behavior",
                       prefs.getIntPref("browser.downloadmanager.behavior"));
    } catch (ex) {}

    try {
      prefs.setBoolPref("browser.download.progress.closeWhenDone",
                        !prefs.getBoolPref("browser.download.progressDnldDialog.keepAlive"));
    } catch (e) {}
  },

  // ------------------------------
  // public nsISuiteGlue members
  // ------------------------------

  sanitize: function(aParentWindow)
  {
    // call the Sanitizer object's sanitize, which might return errors
    // but do not forward them anywhere, as we are defined as void here
    Sanitizer.sanitize(aParentWindow);
  },


  // for XPCOM
  classDescription: "SeaMonkey Suite Glue Service",
  classID:          Components.ID("{bbbbe845-5a1b-40ee-813c-f84b8faaa07c}"),
  contractID:       "@mozilla.org/suite/suiteglue;1",

  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIObserver,
                                         Components.interfaces.nsISupportsWeakReference,
                                         Components.interfaces.nsISuiteGlue]),

  // get this contractID registered for certain categories via XPCOMUtils
  _xpcom_categories: [
    // make SuiteGlue a startup observer
    { category: "app-startup", service: true }
  ]
}

function GeolocationPrompt() {}

GeolocationPrompt.prototype = {
  classDescription: "Geolocation Prompting Component",
  classID:          Components.ID("{450a13bd-0d07-4e5d-a9f0-448c201728b1}"),
  contractID:       "@mozilla.org/geolocation/prompt;1",

  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIGeolocationPrompt]),

  prompt: function(aRequest)
  {
    const nsIPermissionManager = Components.interfaces.nsIPermissionManager;
    var pm = Components.classes["@mozilla.org/permissionmanager;1"]
                       .getService(nsIPermissionManager);

    switch (pm.testExactPermission(aRequest.requestingURI, "geo")) {
      case nsIPermissionManager.ALLOW_ACTION:
        aRequest.allow();
        return;
      case nsIPermissionManager.DENY_ACTION:
        aRequest.cancel();
        return;
    }

    var notificationBox =
        aRequest.requestingWindow
                .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                .getInterface(Components.interfaces.nsIWebNavigation)
                .QueryInterface(Components.interfaces.nsIDocShell)
                .chromeEventHandler.parentNode.wrappedJSObject;

    var notification = notificationBox.getNotificationWithValue("geolocation");
    if (!notification) {
      var notificationBundle =
          Components.classes["@mozilla.org/intl/stringbundle;1"]
                    .getService(Components.interfaces.nsIStringBundleService)
                    .createBundle("chrome://communicator/locale/notification.properties");

      var buttons =
          [{
            label: notificationBundle.GetStringFromName("geolocation.shareLocation"),
            accessKey: notificationBundle.GetStringFromName("geolocation.shareLocation.accesskey"),
            callback: function(notification) {
              // in tests, click can be fast enough that our hack hasn't set up the checkbox yet
              if (notification.getElementsByClassName("rememberChoice")[0] &&
                  notification.getElementsByClassName("rememberChoice")[0].checked)
                pm.add(aRequest.requestingURI, "geo",
                       nsIPermissionManager.ALLOW_ACTION);
              aRequest.allow();
            },
          }, {
            label: notificationBundle.GetStringFromName("geolocation.dontShareLocation"),
            accessKey: notificationBundle.GetStringFromName("geolocation.dontShareLocation.accesskey"),
            callback: function(notification) {
              // in tests, click can be fast enough that our hack hasn't set up the checkbox yet
              if (notification.getElementsByClassName("rememberChoice")[0] &&
                  notification.getElementsByClassName("rememberChoice")[0].checked)
                pm.add(aRequest.requestingURI, "geo",
                       nsIPermissionManager.DENY_ACTION);
              aRequest.cancel();
            },
          }];

      var message =
          notificationBundle.formatStringFromName("geolocation.siteWantsToKnow",
                                                  [aRequest.requestingURI.spec], 1);
      var newBar = notificationBox.appendNotification(message,
                                                      "geolocation",
                                                      "chrome://communicator/skin/icons/geo.png",
                                                      notificationBox.PRIORITY_INFO_HIGH,
                                                      buttons);

      // For whatever reason, if we do this immediately
      // (eg, without the setTimeout), the "link"
      // element does not show up in the notification
      // bar.
      function geolocation_hacks_to_notification () {
        var checkbox = newBar.ownerDocument.createElementNS(XULNS, "checkbox");
        checkbox.className = "rememberChoice";
        checkbox.setAttribute("label", notificationBundle.GetStringFromName("geolocation.remember"));
        newBar.appendChild(checkbox);

        var link = newBar.ownerDocument.createElementNS(XULNS, "label");
        link.className = "text-link";
        link.setAttribute("value", notificationBundle.GetStringFromName("geolocation.learnMore"));

        var formatter = Components.classes["@mozilla.org/toolkit/URLFormatterService;1"]
                                  .getService(Components.interfaces.nsIURLFormatter);
        link.href = formatter.formatURLPref("browser.geolocation.warning.infoURL");

        var description = newBar.ownerDocument.getAnonymousElementByAttribute(newBar, "anonid", "messageText");
        description.appendChild(link);
      };

      notificationBox.ownerDocument.defaultView.setTimeout(geolocation_hacks_to_notification, 0);
    }
  },
};

//module initialization
function NSGetModule(aCompMgr, aFileSpec) {
  return XPCOMUtils.generateModule([SuiteGlue, GeolocationPrompt]);
}
