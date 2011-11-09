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
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   David Bienvenu <bienvenu@nventure.com>
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

var MODULE_NAME = "test-commands";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["folder-display-helpers", "window-helpers"];

Cu.import("resource:///modules/mailServices.js");
var elib = {};
Cu.import('resource://mozmill/modules/elementslib.js', elib);

var folder1, folder2;

var setupModule = function(module) {
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);
  let wh = collector.getModule("window-helpers");
  wh.installInto(module);

  folder1 = create_folder("CopyFromFolder");
  folder2 = create_folder("CopyToFolder");
  make_new_sets_in_folder(folder1, [{count: 1}]);
}

function test_copy_eml_message() {
  // First, copy an email to a folder and delete it immediately just so it shows
  // up in the recent folders list. This simplifies navigation of the copy
  // context menu.
  be_in_folder(folder1);
  let message = select_click_row(0);
  let array = Cc["@mozilla.org/array;1"]
                .createInstance(Ci.nsIMutableArray);
  array.appendElement(message, false);
  MailServices.copy.CopyMessages(folder1, array, folder2, true,
                                 null, mc.window.msgWindow, true);
  be_in_folder(folder2);
  select_click_row(0);
  press_delete(mc);

  // Now, open a .eml file and copy it to our folder.
  let thisFilePath = os.getFileForPath(__file__);
  let file = os.getFileForPath(os.abspath("./evil.eml", thisFilePath));
  let msgc = open_message_from_file(file);

  let documentChild = msgc.e("messagepane").contentDocument.firstChild;
  msgc.rightClick(new elib.Elem(documentChild));
  msgc.click_menus_in_sequence(msgc.e("mailContext"), [
    {id: "mailContext-copyMenu"},
    {label: "Recent"},
    {label: "CopyToFolder"},
  ]);
  close_window(msgc);

  // Make sure the copy worked.
  let copiedMessage = select_click_row(0);
  assert_equals(copiedMessage.mime2DecodedSubject, "An email");
}
