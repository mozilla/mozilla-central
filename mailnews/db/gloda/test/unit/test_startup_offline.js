/* ***** BEGIN LICENSE BLOCK *****
 *   Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * The Original Code is Thunderbird Global Database.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Foundation
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mark Banner <bugzilla@standard8.plus.com>
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


/*
 * Test gloda starts up with indexing suppressed when offline at startup.
 */

// We must do this before the first load otherwise gloda is started without
// picking up the necessary initialisation.
var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                          .getService(Components.interfaces.nsIIOService2);
ioService.manageOfflineStatus = false;
ioService.offline = true;

load("resources/glodaTestHelper.js");

/**
 * Make sure that if we have to reparse a local folder we do not hang or
 *  anything.  (We had a regression where we would hang.)
 */
function test_gloda_offline_startup() {
  // Set up a folder for indexing and check the message doesn't get indexed.
  let [folder, msgSet] = make_folder_with_sets([{count: 1}]);
  yield wait_for_message_injection();
  yield wait_for_gloda_indexer();

  // Now go online...
  Components.classes["@mozilla.org/network/io-service;1"]
          .getService(Components.interfaces.nsIIOService)
          .offline = false;

  // ...and check we have done the indexing and indexed the message.
  yield wait_for_gloda_indexer(msgSet);
}

let tests = [
  test_gloda_offline_startup,
];

function run_test() {
  configure_message_injection({mode: "local"});
  glodaHelperRunTests(tests);
}
