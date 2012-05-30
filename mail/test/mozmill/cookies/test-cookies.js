/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Test file to check that cookies are correctly enabled in Thunderbird.
 *
 * XXX: Still need to check remote content in messages.
 */

var MODULE_NAME = 'test-cookies';

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ['window-helpers', 'content-tab-helpers', 'folder-display-helpers'];

var mozmill = {}; Components.utils.import('resource://mozmill/modules/mozmill.js', mozmill);
var elementslib = {}; Components.utils.import('resource://mozmill/modules/elementslib.js', elementslib);

// RELATIVE_ROOT messes with the collector, so we have to bring the path back
// so we get the right path for the resources.
var url = collector.addHttpResource('../cookies/html', 'cookies');

function setupModule(module) {
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);
  let cth = collector.getModule("content-tab-helpers");
  cth.installInto(module);
}

/**
 * Test deleting junk messages with no messages marked as junk.
 */
function test_load_cookie_page() {
  open_content_tab_with_url(url + "cookietest1.html");
}

function test_load_cookie_result_page() {
  open_content_tab_with_url(url + "cookietest2.html");

  if (mc.window.content.document.title != "Cookie Test 2")
    throw new Error("The cookie test 2 page is not the selected tab or not content-primary");

  let cookie = mc.window.content.wrappedJSObject.theCookie;

  dump("Cookie is: " + cookie + "\n");

  if (!cookie)
    throw new Error("Document has no cookie :-(");

  if (cookie != "name=CookieTest")
    throw new Error("Cookie set incorrectly, expected: name=CookieTest, got: " +cookie + "\n");
}
