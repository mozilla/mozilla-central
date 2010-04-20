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

var extensionConfigurator = {
  /**
   * Figure out what we want to display on the extension page.
   *
   * @param subpageData data we might need.
   */
  onLoad: function ex_onLoad() {
    this.subpageData = parent.gSubpageData;
    try {
      if (this.shouldShowStrongMessage()) {
        // Show the more blatant warning.
        $("#weak").hide();
        $("#strong").show();
      }
      var Application = Cc["@mozilla.org/steel/application;1"]
                          .getService(Ci.steelIApplication);
      if (Application.extensions.has(this.extensionId)) {
        $("#addon-install-button").hide();
        $("#alreadyInstalled").show();
      }
    } catch (e) {
      logException(e);
    }
  },

  /**
   * Install an extension for our subclass.
   */
  install: function ex_install() {
    location.href = this.extensionUrl;
    $("#addon-install-button").hide();
    $("#installing").fadeIn();
    // XXX: possibly load the extension inside another iframe, and possibly
    //      hook into the extension manager to get to know when the
    //      extension's been installed.
  },

};
