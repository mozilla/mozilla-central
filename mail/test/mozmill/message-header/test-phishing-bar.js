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
 * The Original Code is Thunderbird Mail Client.
 *
 * The Initial Developer of the Original Code is
 * The Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jim Porter <squibblyflabbetydoo@gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in windowHelperich case the provisions of the GPL or the LGPL are applicable instead
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
 *  Test for the most suitable identity in From address for reply-to-list
 */

var MODULE_NAME = "test-phishing-bar";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["folder-display-helpers",
                       "window-helpers"];

var elib = {};
Components.utils.import("resource://mozmill/modules/elementslib.js", elib);
var os = {};
Components.utils.import('resource://mozmill/stdlib/os.js', os);

var folder;

function setupModule(module) {
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);
  let wh = collector.getModule("window-helpers");
  wh.installInto(module);

  folder = create_folder("PhishingBarA");
  add_message_to_folder(folder, create_message({body: {
    body: '<a href="http://www.evil.com/google/">http://www.google.com</a>',
    contentType: "text/html"
  }}));
}

/**
 * Make sure that the phishing bar gets hidden when the ignore button is
 * clicked.
 *
 * @param msgc the Mozmill controller for the message window
 */
function help_test_hide_phishing_bar(msgc) {
  let phishingButton = msgc.e("phishingBar").getElementsByTagName("button")[0];
  assert_true(!msgc.e("msgNotificationBar").collapsed);

  msgc.click(new elib.Elem(phishingButton));
  wait_for_message_display_completion(msgc, true);
  assert_true(msgc.e("msgNotificationBar").collapsed);
}

function test_hide_phishing_bar_from_message() {
  be_in_folder(folder);
  select_click_row(0);

  // XXX Disabled due very frequent random failures.
  // help_test_hide_phishing_bar(mc);
}

function test_hide_phishing_bar_from_eml() {
  // XXX Disabled due very frequent random failures.
  /*
  let thisFilePath = os.getFileForPath(__file__);
  let file = os.getFileForPath(os.abspath("./evil.eml", thisFilePath));

  let msgc = open_message_from_file(file);
  help_test_hide_phishing_bar(msgc);
  */
}
