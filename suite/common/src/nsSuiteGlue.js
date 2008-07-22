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

//module initialization
function NSGetModule(aCompMgr, aFileSpec) {
  return XPCOMUtils.generateModule([SuiteGlue]);
}
