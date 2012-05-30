/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var MODULE_NAME = 'test-mail-views';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers'];

var baseFolder, savedFolder;
var setUntagged, setTagged;

Components.utils.import("resource:///modules/mailViewManager.js");

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
