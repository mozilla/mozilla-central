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
 * Test things of a visual nature.
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

/**
 * When the window gets too narrow the collapsible button labels need to get
 *  gone.  Then they need to come back when we get large enough again.
 *
 * Because the mozmill window sizing is weird and confusing, we force our size
 *  in both cases but do save/restore around our test.
 */
function test_buttons_collapse_and_expand() {
  assert_quick_filter_bar_visible(true); // precondition

  try {
    let qfbCollapsy = mc.e("quick-filter-bar-collapsible-buttons");
    let qfbExemplarButton = mc.e("qfb-unread"); // (arbitrary labeled button)
    let qfbExemplarLabel = mc.window
                             .document.getAnonymousNodes(qfbExemplarButton)[1];

    function assertCollapsed() {
      // The bar should be shrunken and the button should be the same size as its
      // image!
      if (qfbCollapsy.getAttribute("shrink") != "true")
        throw new Error("The collapsy bar should be shrunk!");
      if (qfbExemplarLabel.clientWidth != 0)
        throw new Error("The exemplar label should be collapsed!");
    }
    function assertExpanded() {
      // The bar should not be shrunken and the button should be smaller than its
      // label!
      if (qfbCollapsy.hasAttribute("shrink"))
        throw new Error("The collapsy bar should not be shrunk!");
      if (qfbExemplarLabel.clientWidth == 0)
        throw new Error("The exemplar label should not be collapsed!");
    }

    // -- GIANT!
    mc.window.resizeTo(1200, 600);
    // Right, so resizeTo caps us at the display size limit, so we may end up
    // smaller than we want.  So let's turn off the folder pane too.
    mc.e("folderpane_splitter").collapsed = true;
    // spin the event loop once
    mc.sleep(0);
    assertExpanded();

    // -- tiny.
    mc.e("folderpane_splitter").collapsed = false;
    mc.window.resizeTo(600, 600);
    // spin the event loop once
    mc.sleep(0);
    assertCollapsed();

    // -- GIANT again!
    mc.window.resizeTo(1200, 600);
    mc.e("folderpane_splitter").collapsed = true;
    // spin the event loop once
    mc.sleep(0);
    assertExpanded();
  }
  finally {
    // restore window to nominal dimensions; saving was not working out
    mc.window.resizeTo(1024, 768);
    mc.e("folderpane_splitter").collapsed = false;
  }
}
