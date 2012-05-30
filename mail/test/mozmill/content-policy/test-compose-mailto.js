/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var MODULE_NAME = 'test-compose-mailto';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'compose-helpers',
                       'window-helpers', 'keyboard-helpers',
                       'content-tab-helpers'];
var jumlib = {};
Components.utils.import("resource://mozmill/modules/jum.js", jumlib);
var elib = {};
Components.utils.import('resource://mozmill/modules/elementslib.js', elib);

var folder = null;
var composeHelper = null;
var windowHelper = null;
var gMsgNo = 0;
var gComposeWin;
var gNewTab;
var gPreCount;

// RELATIVE_ROOT messes with the collector, so we have to bring the path back
// so we get the right path for the resources.
var url = collector.addHttpResource('../content-policy/html', 'content');

var setupModule = function (module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let kh = collector.getModule('keyboard-helpers');
  kh.installInto(module);
  composeHelper = collector.getModule('compose-helpers');
  composeHelper.installInto(module);
  windowHelper = collector.getModule('window-helpers');
  windowHelper.installInto(module);
  let cth = collector.getModule("content-tab-helpers");
  cth.installInto(module);
};

function test_openComposeFromMailToLink() {
  // Open a content tab with the mailto link in it.
    // To open a tab we're going to have to cheat and use tabmail so we can load
  // in the data of what we want.
  gPreCount = mc.tabmail.tabContainer.childNodes.length;
  gNewTab = open_content_tab_with_url(url + "mailtolink.html");
  gComposeWin = composeHelper.open_compose_with_element_click("mailtolink");
}

function test_checkInsertImage() {
  // First focus on the editor element
  gComposeWin.e("content-frame").focus();

  // Now open the image window
  windowHelper.plan_for_modal_dialog("imageDlg",
  function insert_image(mwc) {
    // Insert the url of the image.
    let srcloc = mwc.window.document.getElementById("srcInput");
    srcloc.focus();

    input_value(mwc, url + "pass.png");
    mwc.sleep(0);

    // Don't add alternate text
    mwc.click(mwc.eid("noAltTextRadio"));

    // Accept the dialog
    mwc.window.document.getElementById("imageDlg").acceptDialog();
    });
  gComposeWin.click(gComposeWin.eid("insertImage"));

  windowHelper.wait_for_modal_dialog();
  wait_for_window_close();

//  gComposeWin.sleep(500);

  // Test that the image load has not been denied
  let childImages = gComposeWin.e("content-frame").contentDocument.getElementsByTagName("img");

  if (childImages.length != 1)
    throw new Error("Expecting one image in document, actually have " + childImages.length);

  // Should be the only image, so just check the first.
  if (childImages[0].QueryInterface(Ci.nsIImageLoadingContent)
                    .imageBlockingStatus != Ci.nsIContentPolicy.ACCEPT)
    throw new Error("Loading of image has been unexpectedly blocked in a mailto compose window");
}

function test_closeComposeWindowAndTab() {
  composeHelper.close_compose_window(gComposeWin);

  mc.tabmail.closeTab(gNewTab);

  if (mc.tabmail.tabContainer.childNodes.length != gPreCount)
    throw new Error("The content tab didn't close");
}

