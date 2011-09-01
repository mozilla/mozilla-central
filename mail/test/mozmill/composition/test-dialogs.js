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
 *    The Mozilla Foundation
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jonathan Protzenko <jonathan.protzenko@gmail.com>
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

var Ci = Components.interfaces;
var Cc = Components.classes;
var Cu = Components.utils;

var elib = {};
Cu.import('resource://mozmill/modules/elementslib.js', elib);

var MODULE_NAME = 'test-dialogs';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'compose-helpers',
                       'window-helpers', 'keyboard-helpers'];

var fdh, ch, wh, kh;

function setupModule(module) {
  fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  ch = collector.getModule("compose-helpers");
  ch.installInto(module);
  wh = collector.getModule('window-helpers');
  wh.installInto(module);
  kh = collector.getModule('keyboard-helpers');
  kh.installInto(module);
}


function test_image_insertion_dialog_persist() {
  let cwc = open_compose_new_mail();

  // First focus on the editor element
  cwc.e("content-frame").focus();

  // Now open the image window
  wh.plan_for_modal_dialog("imageDlg", function insert_image(mwc) {
    // Insert the url of the image.
    let srcloc = mwc.window.document.getElementById("srcInput");
    srcloc.focus();

    input_value(mwc, "whateverItDoesntMatterAnyway.png");
    mwc.sleep(0);

    // Don't add alternate text
    mwc.click(mwc.eid("noAltTextRadio"));

    mwc.window.document.documentElement.acceptDialog();
  });
  cwc.click(cwc.eid("insertImage"));
  wh.wait_for_modal_dialog();
  wait_for_window_close();

  // Check that the radio option persists
  wh.plan_for_modal_dialog("imageDlg", function insert_image(mwc) {
    assert_true(mwc.window.document.getElementById("noAltTextRadio").selected,
      "We should persist the previously selected value");
    // We change to "use alt text"
    mwc.click(mwc.eid("altTextRadio"));
    mwc.window.document.documentElement.cancelDialog();
  });
  cwc.click(cwc.eid("insertImage"));
  wh.wait_for_modal_dialog();
  wait_for_window_close();

  // Check that the radio option still persists (be really sure)
  wh.plan_for_modal_dialog("imageDlg", function insert_image(mwc) {
    assert_true(mwc.window.document.getElementById("altTextRadio").selected,
      "We should persist the previously selected value");
    // Accept the dialog
    mwc.window.document.documentElement.cancelDialog();
  });
  cwc.click(cwc.eid("insertImage"));
  wh.wait_for_modal_dialog();
  wait_for_window_close();

  // Get the inserted image, double-click it, make sure we switch to "no alt
  // text", despite the persisted value being "use alt text"
  let img = cwc.e("content-frame").contentDocument.getElementsByTagName("img")[0];
  wh.plan_for_modal_dialog("imageDlg", function insert_image(mwc) {
    assert_true(mwc.window.document.getElementById("noAltTextRadio").selected,
      "We shouldn't use the persisted value because the insert image has no alt text");
    mwc.window.document.documentElement.cancelDialog();
  });
  cwc.doubleClick(new elib.Elem(img));
  wh.wait_for_modal_dialog();
  wait_for_window_close();

  // Now use some alt text for the edit image dialog
  wh.plan_for_modal_dialog("imageDlg", function insert_image(mwc) {
    assert_true(mwc.window.document.getElementById("noAltTextRadio").selected,
      "That value should persist still...");
    mwc.click(mwc.eid("altTextRadio"));

    let srcloc = mwc.window.document.getElementById("altTextInput");
    srcloc.focus();
    input_value(mwc, "some alt text");
    mwc.sleep(0);
    // Accept the dialog
    mwc.window.document.documentElement.acceptDialog();
  });
  cwc.doubleClick(new elib.Elem(img));
  wh.wait_for_modal_dialog();
  wait_for_window_close();

  // Make sure next time we edit it, we still have "use alt text" selected.
  let img = cwc.e("content-frame").contentDocument.getElementsByTagName("img")[0];
  wh.plan_for_modal_dialog("imageDlg", function insert_image(mwc) {
    assert_true(mwc.window.document.getElementById("altTextRadio").selected,
      "We edited the image to make it have alt text, we should keep it selected");
    // Accept the dialog
    mwc.window.document.documentElement.cancelDialog();
  });
  cwc.doubleClick(new elib.Elem(img));
  wh.wait_for_modal_dialog();
  wait_for_window_close();

  close_compose_window(cwc);
}
