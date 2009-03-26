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
      case "quit-application":
        this._onProfileShutdown();
        break;
      case "final-ui-startup":
        this._onProfileStartup();
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
        if (this._saveSession) {
          this._setPrefToSaveSession();
        }
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
    osvr.addObserver(this, "quit-application", false);
    osvr.addObserver(this, "final-ui-startup", false);
    osvr.addObserver(this, "browser:purge-session-history", false);
    osvr.addObserver(this, "quit-application-requested", false);
    osvr.addObserver(this, "quit-application-granted", false);
    osvr.addObserver(this, "session-save", false);
  },

  // cleanup (called on application shutdown)
  _dispose: function()
  {
    // observer removal
    const osvr = Components.classes["@mozilla.org/observer-service;1"]
                           .getService(Components.interfaces.nsIObserverService);
    osvr.removeObserver(this, "xpcom-shutdown");
    osvr.removeObserver(this, "quit-application");
    osvr.removeObserver(this, "final-ui-startup");
    osvr.removeObserver(this, "browser:purge-session-history");
    osvr.removeObserver(this, "quit-application-requested");
    osvr.removeObserver(this, "quit-application-granted");
    osvr.removeObserver(this, "session-save");
 },

  // profile startup handler (contains profile initialization routines)
  _onProfileStartup: function()
  {
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
      if (prefBranch.getBoolPref("browser.warnOnQuit") == false)
        showPrompt = false;
      else if (aQuitType == "restart")
        showPrompt = prefBranch.getBoolPref("browser.warnOnRestart");
      else
        showPrompt = prefBranch.getBoolPref("browser.tabs.warnOnClose");
    } catch (ex) {}

    var buttonChoice = 0;
    if (showPrompt) {
      var bundleService = Components.classes["@mozilla.org/intl/stringbundle;1"].
                          getService(Components.interfaces.nsIStringBundleService);
      var quitBundle = bundleService.createBundle("chrome://browser/locale/quitDialog.properties");
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

      buttonChoice = promptService.confirmEx(null, quitDialogTitle, message,
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
            // don't prompt in the future
            prefBranch.setBoolPref("browser.tabs.warnOnClose", false);
            // always save state when shutting down
            prefBranch.setIntPref("browser.startup.page", 3);
          }
        }
        break;
      }
    }
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
          label: notificationBundle.GetStringFromName("geolocation.tellThem"),
          accessKey: notificationBundle.GetStringFromName("geolocation.tellThemKey"),
          callback: function() { aRequest.allow() },
        }, {
          label: notificationBundle.GetStringFromName("geolocation.dontTellThem"),
          accessKey: notificationBundle.GetStringFromName("geolocation.dontTellThemKey"),
          callback: function() { aRequest.cancel() },
        }];

      var message =
          notificationBundle.formatStringFromName("geolocation.siteWantsToKnow",
                                                  [aRequest.requestingURI.spec], 1);
      notificationBox.appendNotification(message,
                                         "geolocation",
                                         "chrome://global/skin/information-16.png",
                                         notificationBox.PRIORITY_INFO_HIGH,
                                         buttons);

    }
  },
};

//module initialization
function NSGetModule(aCompMgr, aFileSpec) {
  return XPCOMUtils.generateModule([SuiteGlue, GeolocationPrompt]);
}
