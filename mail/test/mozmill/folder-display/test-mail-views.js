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
 * Mozilla Messaging, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Andrew Sutherland <asutherland@asutherland.org>
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

var MODULE_NAME = 'test-mail-views';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers'];

var baseFolder, savedFolder;
var setUntagged, setTagged;

Components.utils.import("resource://app/modules/mailViewManager.js");

var setupModule = function(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);

  // Create a folder with some messages that have no tags and some that are
  //  tagged Important ($label1).
  baseFolder = create_folder("MailViewA");
  [setUntagged, setTagged] = make_new_sets_in_folder(baseFolder,
                                                     [{}, {}]);
  setTagged.addTag("$label1"); // Important, by default
};

function test_put_view_picker_on_toolbar() {
  let toolbar = mc.e("mail-bar3");
  toolbar.insertItem("mailviews-container", null);
  mc.assertNode(mc.eid("mailviews-container"));
}

/**
 * https://bugzilla.mozilla.org/show_bug.cgi?id=474701#c97
 */
function test_save_view_as_folder() {
  // - enter the folder
  be_in_folder(baseFolder);

  // - apply the mail view
  // okay, mozmill is just not ready to click on the view picker...
  // just call the ViewChange global.  it's sad, but it has the same effects.
  // at least, it does once we've caused the popups to get refreshed.
  mc.window.RefreshAllViewPopups(mc.e("viewPickerPopup"));
  mc.window.ViewChange(":$label1");
  wait_for_all_messages_to_load();

  // - save it
  plan_for_modal_dialog("mailnews:virtualFolderProperties",
                        subtest_save_mail_view);
  // we have to use value here because the option mechanism is not sophisticated
  //  enough.
  mc.window.ViewChange(MailViewConstants.kViewItemVirtual);
  wait_for_modal_dialog("mailnews:virtualFolderProperties");
}

function subtest_save_mail_view(savc) {
  // - make sure the name is right
  savc.assertValue(savc.eid("name"), baseFolder.prettyName + "-Important");

  // - make sure the constraint is right
  savc.assertValue(savc.aid("searchVal0", {crazyDeck: 0}), "$label1");

  // - save it
  savc.window.onOK();
}

function test_verify_saved_mail_view() {
  // - make sure the folder got created
  savedFolder = baseFolder.findSubFolder(baseFolder.prettyName + "-Important");
  if (!savedFolder)
    throw new Error("MailViewA-Important was not created!");

  // - go in the folder and make sure the right messages are displayed
  be_in_folder(savedFolder);
  assert_messages_in_view(setTagged, mc);
}
