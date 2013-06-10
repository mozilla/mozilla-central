/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Tests customization features of the tabs toolbar.
 */

var MODULE_NAME = "test-tabmail-customize";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ['folder-display-helpers', 'mouse-event-helpers',
                       'window-helpers', 'customization-helpers'];

var gCDHelper ;

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let meh = collector.getModule('mouse-event-helpers');
  meh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);
  let cu = collector.getModule('customization-helpers');
  cu.installInto(module);
  gCDHelper = new CustomizeDialogHelper('mail-toolbar-menubar2',
    'CustomizeMailToolbar', "mailnews:customizeToolbar");
}

function teardownModule(module) {
  // Let's reset any and all of our changes to the toolbar
  gCDHelper.restoreDefaultButtons(mc);
}

/**
 * Test that we can access the customize context menu by right
 * clicking on the tabs toolbar.
 */
function test_open_context_menu() {
  // First, ensure that the context menu is closed.
  let contextPopup = mc.e('toolbar-context-menu');
  assert_not_equals(contextPopup.state, "open");

  // Right click on the tab bar
  mc.rightClick(mc.eid("tabcontainer"));

  // Ensure that the popup opened
  wait_for_popup_to_open(contextPopup);
}

/**
 * Test that, when customizing the toolbars, if the user drags an item onto
 * the tab bar, they're redirected to the toolbar directly to the right of
 * the tab bar.
 */
function test_redirects_toolbarbutton_drops() {
  // Restore the default buttons to get defined starting conditions.
  gCDHelper.restoreDefaultButtons(mc);

  let tabbar = mc.e("tabcontainer");
  let toolbar = mc.e("tabbar-toolbar");

  // First, let's open up the customize toolbar window.
  let ctw = gCDHelper.open(mc);

  // Let's grab some items from the customize window, and try dropping
  // them on the tab bar
  ["wrapper-button-replyall",
   "wrapper-button-replylist",
   "wrapper-button-forward",
   "wrapper-button-archive",
  ].forEach(function(aButtonId) {
    let button = ctw.e(aButtonId);

    drag_n_drop_element(button, ctw.window, tabbar, mc.window, 0.5, 0.5, ctw.window);

    // Now let's check to make sure that this button is now the first
    // item in the tab bar toolbar.
    assert_equals(toolbar.firstChild.id, aButtonId,
                  "Button was not added as first child!");
  });

  // Ok, now let's try to grab some toolbar buttons from mail-bar3, and
  // make sure we can drop those on the tab bar too.
  ["button-getmsg",
   "button-newmsg",
   "button-address",
   "button-tag",
  ].forEach(function(aButtonId) {
    let button = mc.e(aButtonId);

    drag_n_drop_element(button, mc.window, tabbar, mc.window, 0.5, 0.5, mc.window);

    // Now let's check to make sure that this button is now the first
    // item in the tab bar toolbar.
    assert_equals(toolbar.firstChild.id, "wrapper-" + aButtonId,
                  "Button was not added as first child!");
  });

  gCDHelper.close(ctw);
}
