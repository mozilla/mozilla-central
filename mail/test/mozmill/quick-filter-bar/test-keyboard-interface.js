/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests keyboard stuff that doesn't fall under some other test's heading.
 * Namely, control-shift-k toggling the bar into existence happens in
 * test-toggle-bar.js, but we test that repeatedly hitting control-shift-k
 * selects the text entered in the quick filter bar.
 */

var MODULE_NAME = 'test-keyboard-interface';

const RELATIVE_ROOT = '../shared-modules';

var MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers',
                       'quick-filter-bar-helper'];

var folder;

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);
  let qfb = collector.getModule('quick-filter-bar-helper');
  qfb.installInto(module);

  folder = create_folder("QuickFilterBarKeyboardInterface");
  // we need a message so we can select it so we can find in message
  make_new_sets_in_folder(folder, [{count: 1}]);
  be_in_folder(folder);
}

/**
 * The rules for pressing escape:
 * - If there are any applied constraints:
 *   - If there is a 'most recent' constraint, it is relaxed and the 'most
 *     recent' field gets cleared, so that if escape gets hit again...
 *   - If there is no 'most recent' constraint, all constraints are cleared.
 * - If there are no applied constraints, we close the filter bar.
 *
 * We test these rules two ways:
 * 1) With the focus in the thread pane.
 * 2) With our focus in our text-box.
 */
function test_escape_rules() {
  assert_quick_filter_bar_visible(true); // (precondition)

  // the common logic for each bit...
  function legwork() {
    // apply two...
    toggle_boolean_constraints("unread", "starred", "addrbook");
    assert_constraints_expressed({unread: true, starred: true, addrbook: true});
    assert_quick_filter_bar_visible(true);

    // hit escape, should clear addrbook
    mc.keypress(null, "VK_ESCAPE", {});
    assert_quick_filter_bar_visible(true);
    assert_constraints_expressed({unread: true, starred: true});

    // hit escape, should clear both remaining ones
    mc.keypress(null, "VK_ESCAPE", {});
    assert_quick_filter_bar_visible(true);
    assert_constraints_expressed({});

    // hit escape, bar should disappear
    mc.keypress(null, "VK_ESCAPE", {});
    assert_quick_filter_bar_visible(false);

    // bring the bar back for the next dude
    toggle_quick_filter_bar();
  }

  // 1) focus in the thread pane
  mc.e("threadTree").focus();
  legwork();

  // 2) focus in the text box
  mc.e("qfb-qs-textbox").focus();
  legwork();

  // 3) focus in the text box and pretend to type stuff...
  mc.e("qfb-qs-textbox").focus();
  set_filter_text("qxqxqxqx");

  // Escape should clear the text constraint but the bar should still be
  //  visible.  The trick here is that escape is clearing the text widget
  //  and is not falling through to the cmd_popQuickFilterBarStack case so we
  //  end up with a situation where the _lastFilterAttr is the textbox but the
  //  textbox does not actually have any active filter.
  mc.keypress(null, "VK_ESCAPE", {});
  assert_quick_filter_bar_visible(true);
  assert_constraints_expressed({});
  assert_filter_text("");

  // Next escape should close the box
  mc.keypress(null, "VK_ESCAPE", {});
  assert_quick_filter_bar_visible(false);
}

/**
 * It's fairly important that the gloda search widget eats escape when people
 * press escape in there.  Because gloda is disabled by default, we need to
 * viciously uncollapse it ourselves and then cleanup afterwards...
 */
function test_escape_does_not_reach_us_from_gloda_search() {
  let glodaSearchWidget = mc.e("searchInput");
  try {
    // uncollapse and focus the gloda search widget
    glodaSearchWidget.collapsed = false;
    glodaSearchWidget.focus();

    mc.keypress(null, "VK_ESCAPE", {});

    assert_quick_filter_bar_visible(true);
  }
  finally {
    glodaSearchWidget.collapsed = true;
  }
}

/**
 * Control-shift-k expands the quick filter bar when it's collapsed. When
 * already expanded, it focuses the text box and selects its text.
 */
function test_control_shift_k_shows_quick_filter_bar() {
  let dispatcha = mc.window.document.commandDispatcher;
  let qfbTextbox = mc.e("qfb-qs-textbox");

  // focus explicitly on the thread pane so we know where the focus is.
  mc.e("threadTree").focus();
  // select a message so we can find in message
  select_click_row(0);

  // hit control-shift-k to get in the quick filter box
  mc.keypress(null, "k", {accelKey: true, shiftKey: true});
  if (dispatcha.focusedElement != qfbTextbox.inputField)
    throw new Error("control-shift-k did not focus quick filter textbox");

  set_filter_text("search string");

  // hit control-shift-k to select the text in the quick filter box
  mc.keypress(null, "k", {accelKey: true, shiftKey: true});
  if (dispatcha.focusedElement != qfbTextbox.inputField)
    throw new Error("second control-shift-k did not keep focus on filter " +
                    "textbox");
  if (qfbTextbox.selectionStart != 0 ||
      qfbTextbox.selectionEnd != qfbTextbox.textLength)
    throw new Error("second control-shift-k did not select text in filter " +
                    "textbox");

  // hit escape and make sure the text is cleared, but the quick filter bar is
  // still open.
  mc.keypress(null, "VK_ESCAPE", {});
  assert_quick_filter_bar_visible(true);
  assert_filter_text("");

  // hit escape one more time and make sure we finally collapsed the quick
  // filter bar.
  mc.keypress(null, "VK_ESCAPE", {});
  assert_quick_filter_bar_visible(false);
}
