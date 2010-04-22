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
 * The Initial Developer of the Original Code is the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
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

/*
 * Tests keyboard stuff that doesn't fall under some other test's heading.
 * Namely, control-f toggling the bar into existence happens in
 * test-toggle-bar.js, but we test that repeatedly hitting control-f toggles
 * between our search text box and the find-in-message text box.
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
 * Control-f jumps to the quickfilter text box when not in it.  when in it, it
 * allows the normal find-in-message command to execute, which should jump it
 * to the find-in-message textbox thing.
 */
function test_control_f_toggles_between_textboxes() {
  let dispatcha = mc.window.document.commandDispatcher;

  // focus explicitly on the thread pane so we know where the focus is.
  mc.e("threadTree").focus();
  // select a message so we can find in message
  select_click_row(0);

  // hit control-f to get in the quick filter box
  mc.keypress(null, "f", {accelKey: true});
  if (dispatcha.focusedElement != mc.e("qfb-qs-textbox").inputField)
    throw new Error("control-f did not focus quick filter textbox");

  // hit control-f to get in the find-in-message box
  mc.keypress(null, "f", {accelKey: true});
  if (dispatcha.focusedElement != mc.e("FindToolbar")._findField.inputField)
    throw new Error("control-f did not focus toolbar textbox. focused elem: " +
                    dispatcha.focusedElement + " expected elem: " +
                    mc.e("FindToolbar")._findField.inputField + " last dude: " +
                    mc.e("qfb-qs-textbox").inputField);

  // secret bonus test!  hit escape and make sure it only closes the
  //  find-in-message bar.
  mc.keypress(null, "VK_ESCAPE", {});
  assert_quick_filter_bar_visible(true);
}
