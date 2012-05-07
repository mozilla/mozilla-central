/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests iteratorUtils with items pulled from content into chrome.
 */

const MODULE_NAME = 'test-cloudfile-attachment-item';

const RELATIVE_ROOT = '../shared-modules';
const MODULE_REQUIRES = ['folder-display-helpers',
                         'content-tab-helpers',]

let iteratorUtils = {};
Cu.import('resource:///modules/iteratorUtils.jsm', iteratorUtils);

const kWhatsNewPref = 'mailnews.start_page.override_url';

let gUrl = collector.addHttpResource('../utils/html', '');
let gCollectionsUrl = gUrl + "collections.html";
let gOriginalWhatsNew, gTab;

function setupModule(module) {
  collector.getModule('folder-display-helpers').installInto(module);
  collector.getModule('content-tab-helpers').installInto(module);

  gOriginalWhatsNew = Services.prefs.getCharPref(kWhatsNewPref);
  Services.prefs.setCharPref(kWhatsNewPref, gCollectionsUrl);
}

function teardownModule(module) {
  Services.prefs.setCharPref(kWhatsNewPref, gOriginalWhatsNew);
}

function setupTest() {
  gTab = open_content_tab_with_click(mc.menus.helpMenu.whatsNew,
                                     gCollectionsUrl);
}

function teardownTest() {
  close_tab(gTab);
}

/**
 * Tests that we can use iteratorUtils.toArray on an Iterator created
 * and pulled in from content.
 */
function test_toArray_builtin_content_iterator() {
  // kExpected matches our expectations for the contents of gIterator
  // defined collections.html.
  const kExpected = [1, 2, 3, 4, 5];

  // Yank the iterator out from content
  let iter = gTab.browser.contentWindow.wrappedJSObject.gIterator;
  let iterArray = iteratorUtils.toArray(iter);

  assert_equals(kExpected.length, iterArray.length);

  for (let [i, val] in Iterator(kExpected)) {
    assert_equals(i, iterArray[i][0]);
    assert_equals(val, iterArray[i][1]);
  }

}

/**
 * Tests that we can use iteratorUtils.toArray on a custom iterator created
 * and pulled in from content.
 */
function test_toArray_custom_content_iterator() {
  // kExpected matches our expectations for the contents of gCustomIterator
  // defined in collections.html.
  const kExpected = [6, 7, 8, 9];

  // Yank the iterator out from content
  let iter = gTab.browser.contentWindow.wrappedJSObject.gCustomIterator;
  let iterArray = iteratorUtils.toArray(iter);

  assert_equals(kExpected.length, iterArray.length);

  for (let [i, val] in Iterator(kExpected))
    assert_equals(val, iterArray[i]);
}
