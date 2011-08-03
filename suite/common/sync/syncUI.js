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
 * The Original Code is Weave.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Dan Mills <thunder@mozilla.com>
 *   Chris Beard <cbeard@mozilla.com>
 *   Dan Mosedale <dmose@mozilla.org>
 *   Paul O’Shannessy <paul@oshannessy.com>
 *   Philipp von Weitershausen <philipp@weitershausen.de>
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

let gSyncUI = {
  _obs: ["weave:service:sync:start",
         "weave:service:sync:finish",
         "weave:service:sync:error",
         "weave:service:sync:delayed",
         "weave:service:quota:remaining",
         "weave:service:setup-complete",
         "weave:service:login:start",
         "weave:service:login:finish",
         "weave:service:login:error",
         "weave:service:logout:finish",
         "weave:service:start-over",
         "weave:notification:added"],

  _unloaded: false,

  init: function SUI_init() {
    // Update the Tools menu according to whether Sync is set up or not.
    let taskPopup = document.getElementById("taskPopup");
    if (taskPopup)
      taskPopup.addEventListener("popupshowing", this.updateUI.bind(this), false);

    // This will be the first notification fired during init.
    // We can set up everything else later.
    Services.obs.addObserver(this, "weave:service:ready", true);

    // The above notification is only sent once per session, i.e.
    // it only works for the window that triggered the init.
    if (Weave.Status.ready)
      this.initUI();

    // Remove the observer if the window is closed before the observer
    // was triggered.
    window.addEventListener("unload", function SUI_unload() {
      gSyncUI._unloaded = true;
      window.removeEventListener("unload", SUI_unload, false);
      Services.obs.removeObserver(gSyncUI, "weave:service:ready");

      if (Weave.Status.ready) {
        gSyncUI._obs.forEach(function(topic) {
          Services.obs.removeObserver(gSyncUI, topic);
        });
      }
    }, false);
  },

  initUI: function SUI_initUI() {
    this._obs.forEach(function(topic) {
      Services.obs.addObserver(this, topic, true);
    }, this);

    // Find the alltabs-popup
    let popup = document.getElementById("alltabs-popup");
    if (popup) {
      let self = this;
      popup.addEventListener("popupshowing", function() {
        self.alltabsPopupShowing();
      }, true);

      if (Weave.Notifications.notifications.length)
        this.initNotifications();
    }

    this.updateUI();
  },

  initNotifications: function SUI_initNotifications() {
    const XULNS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
    let notificationbox = document.createElementNS(XULNS, "notificationbox");
    notificationbox.id = "sync-notifications";

    let statusbar = document.getElementById("status-bar");
    statusbar.parentNode.insertBefore(notificationbox, statusbar);

    // Force a style flush to ensure that our binding is attached.
    notificationbox.clientTop;

    // notificationbox will listen to observers from now on.
    Services.obs.removeObserver(this, "weave:notification:added");
  },

  _wasDelayed: false,

  _needsSetup: function SUI__needsSetup() {
    let firstSync = "";
    try {
      firstSync = Services.prefs.getCharPref("services.sync.firstSync");
    } catch (e) { }
    return Weave.Status.checkSetup() == Weave.CLIENT_NOT_CONFIGURED ||
           firstSync == "notReady";
  },

  _isLoggedIn: function() {
    if (this._needsSetup())
      return false;
    return Weave.Service.isLoggedIn;
  },

  updateUI: function SUI_updateUI() {
    let needsSetup = this._needsSetup();
    document.getElementById("sync-setup-state").hidden = !needsSetup;
    document.getElementById("sync-syncnow-state").hidden = needsSetup;

    let syncButton = document.getElementById("sync-button");
    if (syncButton) {
      syncButton.removeAttribute("status");
      this._updateLastSyncTime();
      if (needsSetup)
        syncButton.removeAttribute("tooltiptext");
    }
  },

  alltabsPopupShowing: function(event) {
    // Should we show the menu item?
    if (!Weave.Service.isLoggedIn || !Weave.Engines.get("tabs").enabled)
      return;

    let label = this._stringBundle.GetStringFromName("tabs.fromOtherComputers.label");

    let popup = document.getElementById("alltabs-popup");
    let menuitem = document.createElement("menuitem");
    menuitem.setAttribute("id", "sync-tabs-menuitem");
    menuitem.setAttribute("label", label);
    menuitem.setAttribute("class", "alltabs-item");
    menuitem.setAttribute("oncommand", "BrowserOpenSyncTabs();");

    let sep = document.createElement("menuseparator");
    sep.setAttribute("id", "sync-tabs-sep");

    // Fake the tab object on the menu entries, so that we don't have to worry
    // about removing them ourselves. They will just get cleaned up by popup
    // binding. This also makes sure the statusbar updates with the URL.
    menuitem.tab = { "linkedBrowser": { "currentURI": { "spec": label } } };
    sep.tab = { "linkedBrowser": { "currentURI": { "spec": " " } } };

    popup.insertBefore(sep, popup.firstChild);
    popup.insertBefore(menuitem, sep);
  },

  // Functions called by observers
  onActivityStart: function SUI_onActivityStart() {
    let syncButton = null;
    if (syncButton = document.getElementById("sync-button"))
      syncButton.setAttribute("status", "active");
  },

  onSyncFinish: function SUI_onSyncFinish() {
    this._onSyncEnd(true);
  },

  onSyncError: function SUI_onSyncError() {
    this._onSyncEnd(false);
  },

  onSyncDelay: function SUI_onSyncDelay() {
    // basically, we want to just inform users that stuff is going to take a while
    let title = this._stringBundle.GetStringFromName("error.sync.no_node_found.title");
    let description = this._stringBundle.GetStringFromName("error.sync.no_node_found");
    let buttons = [new Weave.NotificationButton(
      this._stringBundle.GetStringFromName("error.sync.serverStatusButton.label"),
      this._stringBundle.GetStringFromName("error.sync.serverStatusButton.accesskey"),
      function() { gSyncUI.openServerStatus(); return true; }
    )];
    let notification = new Weave.Notification(
      title, description, null, Weave.Notifications.PRIORITY_INFO, buttons);
    Weave.Notifications.replaceTitle(notification);
    this._wasDelayed = true;
  },

  onLoginFinish: function SUI_onLoginFinish() {
    // Clear out any login failure notifications
    let title = this._stringBundle.GetStringFromName("error.login.title");
    Weave.Notifications.removeAll(title);

    this.updateUI();
    this._updateLastSyncTime();
  },

  onLoginError: function SUI_onLoginError() {
    // if login fails, any other notifications are essentially moot
    Weave.Notifications.removeAll();

    // if we haven't set up the client, don't show errors
    if (this._needsSetup()) {
      this.updateUI();
      return;
    }

    let title = this._stringBundle.GetStringFromName("error.login.title");
    let reason = Weave.Utils.getErrorString(Weave.Status.login);
    let description =
      this._stringBundle.formatStringFromName("error.login.description", [reason], 1);
    let buttons = [];
    buttons.push(new Weave.NotificationButton(
      this._stringBundle.GetStringFromName("error.login.prefs.label"),
      this._stringBundle.GetStringFromName("error.login.prefs.accesskey"),
      function() { gSyncUI.openPrefs(); return true; }
    ));

    let notification = new Weave.Notification(title, description, null,
                                              Weave.Notifications.PRIORITY_WARNING, buttons);
    Weave.Notifications.replaceTitle(notification);
    this.updateUI();
  },

  onLogout: function SUI_onLogout() {
    this.updateUI();
  },

  onStartOver: function SUI_onStartOver() {
    this.updateUI();
  },

  onQuotaNotice: function onQuotaNotice(subject, data) {
    let title = this._stringBundle.GetStringFromName("warning.sync.quota.label");
    let description = this._stringBundle.GetStringFromName("warning.sync.quota.description");
    let buttons = [];
    buttons.push(new Weave.NotificationButton(
      this._stringBundle.GetStringFromName("error.sync.viewQuotaButton.label"),
      this._stringBundle.GetStringFromName("error.sync.viewQuotaButton.accesskey"),
      function() { gSyncUI.openQuotaDialog(); return true; }
    ));

    let notification = new Weave.Notification(
      title, description, null, Weave.Notifications.PRIORITY_WARNING, buttons);
    Weave.Notifications.replaceTitle(notification);
  },

  openServerStatus: function () {
    let statusURL = Services.prefs.getCharPref("services.sync.statusURL");
    openUILinkIn(statusURL, "tab");
  },

  // Commands
  doSync: function SUI_doSync() {
    setTimeout(function() Weave.Service.sync(), 0);
  },

  handleToolbarButton: function SUI_handleToolbarButton() {
    if (this._needsSetup())
      this.openSetup();
    else
      this.doSync();
  },

  //XXXzpao should be part of syncCommon.js - which we might want to make a module...
  //        To be fixed in a followup (bug 583366)
  openSetup: function SUI_openSetup() {
    let win = Services.wm.getMostRecentWindow("Weave:AccountSetup");
    if (win)
      win.focus();
    else {
      window.openDialog("chrome://communicator/content/sync/syncSetup.xul",
                        "weaveSetup", "centerscreen,chrome,resizable=no");
    }
  },

  openQuotaDialog: function SUI_openQuotaDialog() {
    let win = Services.wm.getMostRecentWindow("Sync:ViewQuota");
    if (win)
      win.focus();
    else
      Services.ww.activeWindow.openDialog(
        "chrome://communicator/content/sync/syncQuota.xul", "",
        "centerscreen,chrome,dialog,modal");
  },

  openPrefs: function SUI_openPrefs() {
    goPreferences("sync_pane");
  },


  // Helpers
  _updateLastSyncTime: function SUI__updateLastSyncTime() {
    let syncButton = null;
    if (!(syncButton = document.getElementById("sync-button")))
      return;

    let lastSync;
    try {
      lastSync = Services.prefs.getCharPref("services.sync.lastSync");
    }
    catch (e) { };
    if (!lastSync || this._needsSetup()) {
      syncButton.removeAttribute("tooltiptext");
      return;
    }

    // Show the day-of-week and time (HH:MM) of last sync
    let lastSyncDate = new Date(lastSync).toLocaleFormat("%a %H:%M");
    let lastSyncLabel =
      this._stringBundle.formatStringFromName("lastSync2.label", [lastSyncDate], 1);
    syncButton.setAttribute("tooltiptext", lastSyncLabel);
  },

  _onSyncEnd: function SUI__onSyncEnd(success) {
    let title = this._stringBundle.GetStringFromName("error.sync.title");
    if (!success) {
      if (Weave.Status.login != Weave.LOGIN_SUCCEEDED) {
        this.onLoginError();
        return;
      }
      let error = Weave.Utils.getErrorString(Weave.Status.sync);
      let description =
        this._stringBundle.formatStringFromName("error.sync.description", [error], 1);

      let priority = Weave.Notifications.PRIORITY_WARNING;
      let buttons = [];

      // Check if the client is outdated in some way
      let outdated = Weave.Status.sync == Weave.VERSION_OUT_OF_DATE;
      for (let [engine, reason] in Iterator(Weave.Status.engines))
        outdated = outdated || reason == Weave.VERSION_OUT_OF_DATE;

      if (outdated) {
        description = this._stringBundle.GetStringFromName(
          "error.sync.needUpdate.description");
        buttons.push(new Weave.NotificationButton(
          this._stringBundle.GetStringFromName("error.sync.needUpdate.label"),
          this._stringBundle.GetStringFromName("error.sync.needUpdate.accesskey"),
          function() { window.openUILinkIn("https://services.mozilla.com/update/", "tab"); return true; }
        ));
      }
      else if (Weave.Status.sync == Weave.OVER_QUOTA) {
        description = this._stringBundle.GetStringFromName(
          "error.sync.quota.description");
        buttons.push(new Weave.NotificationButton(
          this._stringBundle.GetStringFromName(
            "error.sync.viewQuotaButton.label"),
          this._stringBundle.GetStringFromName(
            "error.sync.viewQuotaButton.accesskey"),
          function() { gSyncUI.openQuotaDialog(); return true; } )
        );
      }
      else if (Weave.Status.enforceBackoff) {
        priority = Weave.Notifications.PRIORITY_INFO;
        buttons.push(new Weave.NotificationButton(
          this._stringBundle.GetStringFromName("error.sync.serverStatusButton.label"),
          this._stringBundle.GetStringFromName("error.sync.serverStatusButton.accesskey"),
          function() { gSyncUI.openServerStatus(); return true; }
        ));
      }
      else {
        priority = Weave.Notifications.PRIORITY_INFO;
        buttons.push(new Weave.NotificationButton(
          this._stringBundle.GetStringFromName("error.sync.tryAgainButton.label"),
          this._stringBundle.GetStringFromName("error.sync.tryAgainButton.accesskey"),
          function() { gSyncUI.doSync(); return true; }
        ));
      }

      let notification =
        new Weave.Notification(title, description, null, priority, buttons);
      Weave.Notifications.replaceTitle(notification);
    }
    else {
      // Clear out sync failures on a successful sync
      Weave.Notifications.removeAll(title);
    }

    if (this._wasDelayed && Weave.Status.sync != Weave.NO_SYNC_NODE_FOUND) {
      title = this._stringBundle.GetStringFromName("error.sync.no_node_found.title");
      Weave.Notifications.removeAll(title);
      this._wasDelayed = false;
    }

    this.updateUI();
    this._updateLastSyncTime();
  },

  observe: function SUI_observe(subject, topic, data) {
    if (this._unloaded)
      throw "SyncUI observer called after unload: " + topic;

    switch (topic) {
      case "weave:service:sync:start":
        this.onActivityStart();
        break;
      case "weave:service:sync:finish":
        this.onSyncFinish();
        break;
      case "weave:service:sync:error":
        this.onSyncError();
        break;
      case "weave:service:sync:delayed":
        this.onSyncDelay();
        break;
      case "weave:service:quota:remaining":
        this.onQuotaNotice();
        break;
      case "weave:service:setup-complete":
        this.onLoginFinish();
        break;
      case "weave:service:login:start":
        this.onActivityStart();
        break;
      case "weave:service:login:finish":
        this.onLoginFinish();
        break;
      case "weave:service:login:error":
        this.onLoginError();
        break;
      case "weave:service:logout:finish":
        this.onLogout();
        break;
      case "weave:service:start-over":
        this.onStartOver();
        break;
      case "weave:service:ready":
        this.initUI();
        break;
      case "weave:notification:added":
        this.initNotifications();
        break;
    }
  },

  QueryInterface: XPCOMUtils.generateQI([
    Components.interfaces.nsIObserver,
    Components.interfaces.nsISupportsWeakReference
  ])
};

XPCOMUtils.defineLazyGetter(gSyncUI, "_stringBundle", function() {
  //XXXzpao these strings should probably be moved from /services to /browser... (bug 583381)
  //        but for now just make it work
  return Components.classes["@mozilla.org/intl/stringbundle;1"]
                   .getService(Components.interfaces.nsIStringBundleService)
                   .createBundle("chrome://weave/locale/services/sync.properties");
});
