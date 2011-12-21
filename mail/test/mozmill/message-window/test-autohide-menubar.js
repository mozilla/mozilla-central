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
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jim Porter <squibblyflabbetydoo@gmail.com>
 *   Siddharth Agarwal <sagarwal@mozilla.com>
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

/* Test that the menubar can be set to "autohide". This should only have an
   effect on Windows. */

var MODULE_NAME = "test-autohide-menubar";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["folder-display-helpers", "address-book-helpers",
                       "compose-helpers"];

var elib = {};
Cu.import('resource://mozmill/modules/elementslib.js', elib);

var menuFolder;

function setupModule(module) {
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);
  let abh = collector.getModule("address-book-helpers");
  abh.installInto(module);
  let ch = collector.getModule("compose-helpers");
  ch.installInto(module);

  menuFolder = create_folder("menuFolder");
  make_new_sets_in_folder(menuFolder, [{count: 1}]);
}

/**
 * Set the autohide attribute of the menubar.
 *
 * @param controller the mozmill controller for the window
 * @param elem the element to click on (usually the menubar)
 * @param hide true to hide, false otherwise
 */
function set_autohide_menubar(controller, elem, hide) {
  let contextMenu = controller.getMenu("#toolbar-context-menu");
  contextMenu.open(new elib.Elem(elem));
  let menuitem = contextMenu.getItem('menuitem[toolbarid="' + elem.id + '"]');
  if (menuitem.getNode().hasAttribute("checked") == hide) {
    // XXX Hack around the fact that calling click doesn't toggle the checked
    // state (bug 670829, bug 670830).
    controller.mouseEvent(menuitem, undefined, undefined, {});
  }
}

/**
 * Ensure that the autohide attribute of the menubar can be set properly.
 *
 * @param controller the mozmill controller for the window
 * @param menubar the menubar to test
 */
function help_test_autohide(controller, menubar) {
  function hiddenChecker(aHidden) {
    // The XUL hidden attribute isn't what is set, so it's useless here -- use
    // information from the box model instead.
    return function () ((menubar.getBoundingClientRect().height != 0) != aHidden);
  }
  set_autohide_menubar(controller, menubar, true);
  controller.waitFor(hiddenChecker(true), "Menubar should be hidden!");

  controller.keypress(new elib.Elem(menubar), "VK_ALT", {});
  controller.waitFor(hiddenChecker(false),
                     "Menubar should be shown after pressing alt!");

  set_autohide_menubar(controller, menubar, false);
  controller.waitFor(hiddenChecker(false),
                     "Menubar should be shown!");
}

function test_autohidden_menubar_3pane() {
  let menubar = mc.e("mail-toolbar-menubar2");
  help_test_autohide(mc, menubar);
}
test_autohidden_menubar_3pane.EXCLUDED_PLATFORMS = ["darwin", "linux"];

function test_autohidden_menubar_message_window() {
  be_in_folder(menuFolder);
  select_click_row(0);
  let msgc = open_selected_message_in_new_window();
  msgc.window.focus();
  let menubar = msgc.e("mail-toolbar-menubar2");

  help_test_autohide(msgc, menubar);
  close_message_window(msgc);
}
test_autohidden_menubar_message_window.EXCLUDED_PLATFORMS = ["darwin", "linux"];

function test_autohidden_menubar_compose_window() {
  let cwc = open_compose_new_mail();
  let menubar = cwc.e("compose-toolbar-menubar2");

  help_test_autohide(cwc, menubar);
  close_compose_window(cwc);
}
test_autohidden_menubar_compose_window.EXCLUDED_PLATFORMS = ["darwin", "linux"];

function test_autohidden_menubar_address_book() {
  let abc = open_address_book_window();
  let menubar = abc.e("addrbook-toolbar-menubar2");

  help_test_autohide(abc, menubar);
}
test_autohidden_menubar_address_book.EXCLUDED_PLATFORMS = ["darwin", "linux"];
