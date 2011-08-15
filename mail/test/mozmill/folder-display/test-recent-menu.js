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

/**
 * This tests the move/copy to recent folder menus to make sure
 * that they get updated when messages are moved to folders, and
 * don't get updated when we archive.
 */
Cu.import("resource:///modules/MailUtils.js");
Cu.import("resource:///modules/mailServices.js");

var MODULE_NAME = 'test-recent-menu';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers'];

var folder1, folder2, folder3;
var msgHdr;
var gInitRecentMenuCount;

var setupModule = function(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);
  // Try to make these folders first in alphabetic order
  folder1 = create_folder("aaafolder1");
  folder2 = create_folder("aaafolder2");

  make_new_sets_in_folder(folder1, [{count: 3}]);
}

function test_move_message() {
  be_in_folder(folder1);
  msgHdr = select_click_row(0);
  right_click_on_row(0);
  // this will cause the initial build of the move recent context menu,
  // which should be empty. Not localizable, but recent doesn't have an
  // id we can use.
  mc.click_menus_in_sequence(mc.e("mailContext"), [{id: "mailContext-moveMenu"}, {label: "Recent"}]);
  let recentMenu = mc.eid("mailContext-moveMenu").node.firstChild.firstChild;
  gInitRecentMenuCount = recentMenu.firstChild.children.length;
  close_popup(mc, mc.eid("mailContext"));
  let array = Cc["@mozilla.org/array;1"]
                .createInstance(Ci.nsIMutableArray);
  array.appendElement(msgHdr, false);
  let copyListener = {
    copyDone: false,
    OnStartCopy: function() {},
    OnProgress: function(aProgress, aProgressMax) {},
    SetMessageKey: function(aKey) { },
    SetMessageId: function(aMessageId) {},
    OnStopCopy: function(aStatus) {
      this.copyDone = true;
    }
  };
  MailServices.copy.CopyMessages(folder1, array, folder2, true,
                                 copyListener, mc.window.msgWindow, true);
  mc.waitFor(function () copyListener.copyDone,
             "Timeout waiting for copy to complete", 10000, 100);
  // We've moved a message to aaafolder2 - it should appear in recent list now.
  mc.click_menus_in_sequence(mc.e("mailContext"), [{id: "mailContext-moveMenu"},
                                                   {label: "Recent"}]);
  // firstChild is move menu popup, its child is Recent, its child is menuPopup,
  // and menuPopup's children are what we want.
  let recentChildren = mc.eid("mailContext-moveMenu")
                       .node.firstChild.firstChild.firstChild.children;
  assert_equals(recentChildren.length, gInitRecentMenuCount + 1,
                "recent menu should have one more child after move");
  assert_equals(recentChildren[0].label, "aaafolder2",
                "recent menu child should be aaafolder2 after move");
  close_popup(mc, mc.eid("mailContext"));
}

function test_delete_message() {
  press_delete(mc);
  // We've deleted a message - we should still just have folder2 in the menu.
  mc.click_menus_in_sequence(mc.e("mailContext"), [{id: "mailContext-moveMenu"},
                                                   {label: "Recent"}]);
  let recentChildren = mc.eid("mailContext-moveMenu")
                        .node.firstChild.firstChild.firstChild.children;
  assert_equals(recentChildren.length, gInitRecentMenuCount + 1,
                "delete shouldn't add anything to recent menu");
  assert_equals(recentChildren[0].label, "aaafolder2", 
                "recent menu should still be aaafolder2 after delete");
  close_popup(mc, mc.eid("mailContext"));
}

function test_archive_message() {
  archive_selected_messages();
  // We've archived a message - we should still just have folder2 in the menu.
  mc.click_menus_in_sequence(mc.e("mailContext"), [{id: "mailContext-moveMenu"},
                                                   {label: "Recent"}]);
  let recentChildren = mc.eid("mailContext-moveMenu")
                        .node.firstChild.firstChild.firstChild.children;
  assert_equals(recentChildren.length, gInitRecentMenuCount + 1,
                "archive shouldn't add anything to recent menu");
  assert_equals(recentChildren[0].label, "aaafolder2",
                "recent menu should still be aaafolder2 after archive");
  close_popup(mc, mc.eid("mailContext"));
}
