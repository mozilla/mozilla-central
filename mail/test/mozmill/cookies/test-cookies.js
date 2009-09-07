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
 * The Original Code is Thunderbird Mail Client.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mark Banner <bugzilla@standard8.pus.com>
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

/**
 * Test file to check that cookies are correctly enabled in Thunderbird.
 *
 * XXX: Still need to check remote content in messages.
 * XXX: Swap cookie checks when bug 501925 lands.
 */

var MODULE_NAME = 'test-cookies';

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ['window-helpers'];

var controller = {};
Components.utils.import('resource://mozmill/modules/controller.js', controller);
var mozmill = {}; Components.utils.import('resource://mozmill/modules/mozmill.js', mozmill);
var elementslib = {}; Components.utils.import('resource://mozmill/modules/elementslib.js', elementslib);

// The main controller and an easy alias.
var mainController = null;
var mc;

// The windowHelper module.
var windowHelper;

var newTab = null;

// RELATIVE_ROOT messes with the collector, so we have to bring the path back
// so we get the right path for the resources.
var url = collector.addHttpResource('../cookies/html', 'cookies');

function setupModule(module) {
  windowHelper = collector.getModule('window-helpers');
  mc = mainController = windowHelper.wait_for_existing_window("mail:3pane");
  windowHelper.augment_controller(mc);
}

/**
 * Test deleting junk messages with no messages marked as junk.
 */
function test_load_cookie_page() {
  newTab = mc.tabmail.openTab("contentTab",
                              {contentPage: url + "cookietest1.html"});

  if (!newTab)
    throw new Error("Expected new tab info to be returned from openTab");

  // XXX When bug 508999 is fixed, remove the sleep and use the waitForEval
  // instead.
  // controller.waitForEval("subject.busy == false", 1000, 100, newTab);
  controller.sleep(1000);
}

function test_load_cookie_result_page() {
  newTab = mc.tabmail.openTab("contentTab",
                              {contentPage: url + "cookietest2.html"});

  if (!newTab)
    throw new Error("Expected new tab info to be returned from openTab");

  // XXX When bug 508999 is fixed, remove the sleep and use the waitForEval
  // instead.
  // controller.waitForEval("subject.busy == false", 1000, 100, newTab);
  controller.sleep(1000);

  if (mc.window.content.document.title != "Cookie Test 2")
    throw new Error("The cookie test 2 page is not the selected tab or not content-primary");

  let cookie = mc.window.content.wrappedJSObject.theCookie;

  dump("Cookie is: " + cookie + "\n");

  if (!cookie)
    throw new Error("Document has no cookie :-(");

  if (cookie != "name=CookieTest")
    throw new Error("Cookie set incorrectly, expected: name=CookieTest, got: " +cookie + "\n");
}
