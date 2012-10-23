/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://services-sync/main.js");

const PAGE_NO_ACCOUNT = 0;
const PAGE_HAS_ACCOUNT = 1;
const PAGE_NEEDS_UPDATE = 2;

let gSyncPane = {
  get page() {
    return document.getElementById("weavePrefsDeck").selectedIndex;
  },

  set page(val) {
    document.getElementById("weavePrefsDeck").selectedIndex = val;
  },

  get _usingCustomServer() {
    return Weave.Svc.Prefs.isSet("serverURL");
  },

  needsUpdate: function () {
    this.page = PAGE_NEEDS_UPDATE;
    let label = document.getElementById("loginError");
    label.value = Weave.Utils.getErrorString(Weave.Status.login);
    label.className = "error";
  },

  init: function () {
    let topics = [
      "weave:service:login:error",
      "weave:service:login:finish",
      "weave:service:start-over",
      "weave:service:setup-complete",
      "weave:service:logout:finish"];

    // Add the observers now and remove them on unload
    //XXXzpao This should use Services.obs.* but Weave's Obs does nice handling
    //        of `this`. Fix in a followup. (bug 583347)
    topics.forEach(function(topic) {
      Weave.Svc.Obs.add(topic, this.updateWeavePrefs, this);
    }, this);
    window.addEventListener("unload", function() {
      topics.forEach(function (topic) {
        Weave.Svc.Obs.remove(topic, this.updateWeavePrefs, this);
      }, gSyncPane);
    }, false);

    this.updateWeavePrefs();
  },

  updateWeavePrefs: function () {
    if (Weave.Status.service == Weave.CLIENT_NOT_CONFIGURED ||
        Weave.Svc.Prefs.get("firstSync", "") == "notReady") {
      this.page = PAGE_NO_ACCOUNT;
    } else if (Weave.Status.login == Weave.LOGIN_FAILED_INVALID_PASSPHRASE ||
               Weave.Status.login == Weave.LOGIN_FAILED_LOGIN_REJECTED) {
      this.needsUpdate();
    } else {
      this.page = PAGE_HAS_ACCOUNT;
      document.getElementById("accountName").value = Weave.Service.identity.account;
      document.getElementById("syncComputerName").value = Weave.Service.clientsEngine.localName;
      document.getElementById("tosPP").hidden = this._usingCustomServer;
    }
  },

  startOver: function (showDialog) {
    if (showDialog) {
      let flags = Services.prompt.BUTTON_POS_0 * Services.prompt.BUTTON_TITLE_IS_STRING +
                  Services.prompt.BUTTON_POS_1 * Services.prompt.BUTTON_TITLE_CANCEL;
      let prefutilitiesBundle = document.getElementById("bundle_prefutilities");
      let buttonChoice =
        Services.prompt.confirmEx(window,
                                  prefutilitiesBundle.getString("stopUsingAccount.title"),
                                  prefutilitiesBundle.getString("differentAccount.label"),
                                  flags,
                                  prefutilitiesBundle.getString("differentAccountConfirm.label"),
                                  null, null, null, {});

      // If the user selects cancel, just bail
      if (buttonChoice == 1)
        return;
    }

    Weave.Service.startOver();
    this.updateWeavePrefs();
  },

  updatePass: function () {
    if (Weave.Status.login == Weave.LOGIN_FAILED_LOGIN_REJECTED)
      gSyncUtils.changePassword();
    else
      gSyncUtils.updatePassphrase();
  },

  resetPass: function () {
    if (Weave.Status.login == Weave.LOGIN_FAILED_LOGIN_REJECTED)
      gSyncUtils.resetPassword();
    else
      gSyncUtils.resetPassphrase();
  },

  openSetup: function (resetSync) {
    var win = Services.wm.getMostRecentWindow("Weave:AccountSetup");
    if (win)
      win.focus();
    else {
      window.openDialog("chrome://communicator/content/sync/syncSetup.xul",
                        "weaveSetup", "centerscreen,chrome,resizable=no", resetSync);
    }
  },

  openQuotaDialog: function () {
    let win = Services.wm.getMostRecentWindow("Sync:ViewQuota");
    if (win)
      win.focus();
    else
      window.openDialog("chrome://communicator/content/sync/syncQuota.xul", "",
                        "centerscreen,chrome,dialog,modal");
  },

  openAddDevice: function () {
    if (!Weave.Utils.ensureMPUnlocked())
      return;
    let win = Services.wm.getMostRecentWindow("Sync:AddDevice");
    if (win)
      win.focus();
    else 
      window.openDialog("chrome://communicator/content/sync/syncAddDevice.xul",
                        "syncAddDevice", "centerscreen,chrome,resizable=no");
  },

  resetSync: function () {
    this.openSetup(true);
  }
};
