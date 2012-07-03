/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Test things of a visual nature.
 * 
 * Note: this test requires a screen resolution of 1280 x 1024 which is standard on
 * the unit test machines (see also testing/machine-configuration.json).
 */

var MODULE_NAME = 'test-keyboard-interface';

const RELATIVE_ROOT = '../shared-modules';

var MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers',
                       'quick-filter-bar-helper'];

var folder;
var setUnstarred, setStarred;

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);
  let qfb = collector.getModule('quick-filter-bar-helper');
  qfb.installInto(module);

  folder = create_folder("QuickFilterBarDisplayIssues");
  be_in_folder(folder);
}

function wait_for_resize(width) {
  mc.waitFor(function () (mc.window.outerWidth == width),
             "Timeout waiting for resize (is the screen resolution 1280 x 1024?)", 1000, 50);
}

function resize_to(width, height) {
  mark_action("test", "resize_to", [width, "x", height]);
  mc.window.resizeTo(width, height);
  // Give the event loop a spin in order to let the reality of an asynchronously
  //  interacting window manager have its impact.  This still may not be
  //  sufficient.
  mc.sleep(0);
  wait_for_resize(width);
}

function collapse_folder_pane(shouldBeCollapsed) {
  mark_action("test", "collapse_folder_pane",
              [shouldBeCollapsed]);
  mc.e("folderpane_splitter").setAttribute("state",
                                           shouldBeCollapsed ? "collapsed"
                                                             : "open");
}

/**
 * When the window gets too narrow the collapsible button labels need to get
 *  gone.  Then they need to come back when we get large enough again.
 *
 * Because the mozmill window sizing is weird and confusing, we force our size
 *  in both cases but do save/restore around our test.
 */
function test_buttons_collapse_and_expand() {
  assert_quick_filter_bar_visible(true); // precondition

  let qfbCollapsy = mc.e("quick-filter-bar-collapsible-buttons");
  let qfbExemplarButton = mc.e("qfb-unread"); // (arbitrary labeled button)
  let qfbExemplarLabel = mc.window
                           .document.getAnonymousNodes(qfbExemplarButton)[1];

  function logState(aWhen) {
    mark_action("test", "log_window_state",
                [aWhen,
                 "location:", mc.window.screenX, mc.window.screenY,
                 "dims:", mc.window.outerWidth, mc.window.outerHeight,
                 "Collapsy bar width:", qfbCollapsy.clientWidth,
                 "shrunk?", qfbCollapsy.getAttribute("shrink")]);
  }

  function assertCollapsed(width) {
    // It's possible the window hasn't actually resized yet, so double-check and
    // spin if needed.
    wait_for_resize(width);

    // The bar should be shrunken and the button should be the same size as its
    // image!
    if (qfbCollapsy.getAttribute("shrink") != "true")
      throw new Error("The collapsy bar should be shrunk!");
    if (qfbExemplarLabel.clientWidth != 0)
      throw new Error("The exemplar label should be collapsed!");
  }
  function assertExpanded(width) {
    // It's possible the window hasn't actually resized yet, so double-check and
    // spin if needed.
    wait_for_resize(width);

    // The bar should not be shrunken and the button should be smaller than its
    // label!
    if (qfbCollapsy.hasAttribute("shrink"))
      throw new Error("The collapsy bar should not be shrunk!");
    if (qfbExemplarLabel.clientWidth == 0)
      throw new Error("The exemplar label should not be collapsed!");
  }

  logState("entry");

  // -- GIANT!
  resize_to(1200, 600);
  // Right, so resizeTo caps us at the display size limit, so we may end up
  // smaller than we want.  So let's turn off the folder pane too.
  collapse_folder_pane(true);
  // spin the event loop once
  mc.sleep(0);
  logState("giant");
  assertExpanded(1200);

  // -- tiny.
  collapse_folder_pane(false);
  resize_to(600, 600);
  // spin the event loop once
  mc.sleep(0);
  logState("tiny");
  assertCollapsed(600);

  // -- GIANT again!
  resize_to(1200, 600);
  collapse_folder_pane(true);
  // spin the event loop once
  mc.sleep(0);
  logState("giant again!");
  assertExpanded(1200);
}

function test_buttons_collapse_and_expand_on_spawn_in_vertical_mode() {
  // Assume we're in classic layout to start - since this is where we'll
  // reset to once we're done.
  assert_pane_layout(kClassicMailLayout);

  // Put us in vertical mode
  set_pane_layout(kVerticalMailLayout);

  // Make our window nice and wide.
  resize_to(1200, 600);
  wait_for_resize(1200);

  // Now expand the message pane to cause the QFB buttons to shrink
  let messagePaneWrapper = mc.e("messagepaneboxwrapper");
  messagePaneWrapper.width = 500;

  // Now spawn a new 3pane...
  let mc2 = open_folder_in_new_window(folder);
  let qfb = mc2.e("quick-filter-bar-collapsible-buttons");
  mc2.waitFor(function () (qfb.getAttribute("shrink") == "true"),
              "New 3pane should have had a collapsed QFB");
  close_window(mc2);

  set_pane_layout(kClassicMailLayout);
}

function teardownModule() {
  // restore window to nominal dimensions; saving was not working out
  //  See also: message-header/test-message-header.js if we change the
  //            default window size.
  resize_to(1024, 768);
  collapse_folder_pane(false);
}
