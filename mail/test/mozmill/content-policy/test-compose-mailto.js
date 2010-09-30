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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Foundation.
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

var MODULE_NAME = 'test-compose-mailto';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'compose-helpers',
                       'window-helpers', 'keyboard-helpers'];
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
};

function test_openComposeFromMailToLink() {
  // Open a content tab with the mailto link in it.
    // To open a tab we're going to have to cheat and use tabmail so we can load
  // in the data of what we want.
  gPreCount = mc.tabmail.tabContainer.childNodes.length;

  gNewTab = mc.tabmail.openTab("contentTab", { contentPage: url + "mailtolink.html" });

  mc.waitForEval("subject.busy == false", 5000, 100, gNewTab);

  if (mc.tabmail.tabContainer.childNodes.length != gPreCount + 1)
    throw new Error("The content tab didn't open");

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

