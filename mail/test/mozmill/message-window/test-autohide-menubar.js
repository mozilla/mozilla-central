/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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

  // Make the menubar not autohide by default.
  let menubar = mc.e("mail-toolbar-menubar2");
  menubar.setAttribute("autohide", false);
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
