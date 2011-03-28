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
 * The Original Code is the Thunderbird Feature Configurator.
 *
 * The Initial Developer of the Original Code is
 * The Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Blake Winton <bwinton@latte.ca>
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

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");
Cu.import("resource:///modules/errUtils.js");

var extensionConfigurator = {
  /**
   * Figure out what we want to display on the extension page.
   *
   * @param subpageData data we might need.
   */
  onLoad: function ex_onLoad() {
    this.subpageData = parent.gSubpageData;
    Services.obs.addObserver(this.onInstallFailed, "addon-install-failed",
                             false);

    try {
      if (this.shouldShowStrongMessage()) {
        // Show the more blatant warning.
        $("#weak").hide();
        $("#strong").show();
      }

      // Check if this addon is installed (or will be installed when
      // Thunderbird is restarted).
      let self = this;
      AddonManager.getAllAddons(function(extensions) {
        if (extensions.some(function(e) e.id == self.extensionId))
          self.onAlreadyInstalled();
      });
      AddonManager.getAllInstalls(function(extensions) {
        if (extensions.some(function(e) e.addon.id == self.extensionId))
          self.onAlreadyInstalled();
      });
    } catch (e) {
      logException(e);
    }
  },

  onUnload: function ex_onUnload() {
    Services.obs.removeObserver(this.onInstallFailed, "addon-install-failed");
  },

  /**
   * This addon has already been installed, so hide the install button.
   */
  onAlreadyInstalled: function ex_onAlreadyInstalled() {
    $("#addon-install-button").hide();
    $("#alreadyInstalled").show();
  },

  /**
   * Installation of the addon failed for some reason, so update the UI to
   * indicate this.
   */
  onInstallFailed: function ex_onInstallFailed() {
    $("#addon-install-button").hide();
    $("#spinner").hide();
    $("#downloading").hide();
    $("#installing").hide();
    $("#failure").show();
  },

  /**
   * Install an extension for our subclass.
   */
  install: function ex_install() {
    AddonManager.getInstallForURL(this.extensionUrl, function(aInstall) {
      aInstall.addListener({
        onDownloadStarted: function(aInstall) {
          $("#addon-install-button").hide();
          $("#spinner").fadeIn();
          $("#downloading").fadeIn();
        },
        onDownloadCancelled: function(aInstall) {
          $("#spinner").hide();
          $("#downloading").hide();
          $("#addon-install-button").show();
        },
        onInstallStarted: function(aInstall) {
          $("#downloading").hide();
          $("#installing").fadeIn();
        },
        onInstallEnded: function(aInstall, aAddon) {
          $("#spinner").hide();
          $("#installing").hide();
          $("#installed").show();
        },
      });

      AddonManager.installAddonsFromWebpage("application/x-xpinstall",
                                            window, null, [aInstall]);
    }, "application/x-xpinstall");

  },

};
