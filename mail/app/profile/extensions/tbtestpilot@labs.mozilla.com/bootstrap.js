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
 *   Jono X <jono@mozilla.com>
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

const APP_STARTUP = 1; //The application is starting up.
const APP_SHUTDOWN = 2; //The application is shutting down.
const ADDON_ENABLE = 3;	//The add-on is being enabled.
const ADDON_DISABLE = 4; //The add-on is being disabled.
const ADDON_INSTALL = 5; //The add-on is being installed.
const ADDON_UNINSTALL = 6; //The add-on is being uninstalled.
const ADDON_UPGRADE = 7; //The add-on is being upgraded.
const ADDON_DOWNGRADE = 8; //The add-on is being downgraded.


function startup(data, reason) {
   // called when the extension needs to start itself up -
   // data tells us extension id, version, and installPath.
   // reason is one of APP_STARTUP, ADDON_ENABLE, ADDON_INSTALL,
   // ADDON_UPGRADE, or ADDON_DOWNGRADE.

  /* TODO this will need to register a listener for new window opens,
   * so tht it can apply the TestPilotWindowHandlers.onWindowLoad()
   * currently defined in browser.js.  (Without an overlay, we have no
   * other way of ensuring that the window load handler gets called for
   * each window.)
   *
   * This will also need to manually insert CSS styles (which are otherwise
   * included by the overlay.)   Look at the document.loadOverlay function.
   * https://developer.mozilla.org/En/DOM/Document.loadOverlay
   */
}

function shutdown(data, reason) {
   // reason is one of APP_SHUTDOWN, ADDON_DISABLE, ADDON_UNINSTALL, ADDON_UPGRADE, or ADDON_DOWNGRADE.
}

function install(data, reason) {
  // Optional.  Called before first call to startup() when
  // extension first installed.
}

function uninstall(data, reason) {
  // Optional.  Called after last call to shutdown() when uninstalled.
}
