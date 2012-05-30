/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Sticky logic only needs to test the general sticky logic plus any filters
 *  with custom propagateState implementations (currently: tags, text filter.)
 */

var MODULE_NAME = 'test-filter-logic';

const RELATIVE_ROOT = '../shared-modules';

var MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers',
                       'quick-filter-bar-helper'];

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);
  let qfb = collector.getModule('quick-filter-bar-helper');
  qfb.installInto(module);
}

/**
 * Persist the current settings through folder change and inherit into a new tab.
 */
function test_sticky_basics() {
  let folderOne = create_folder("QuickFilterBarStickyBasics1");
  let [unreadOne, readOne] = make_new_sets_in_folder(folderOne,
    [{count: 1}, {count: 1}]);
  readOne.setRead(true);

  let folderTwo = create_folder("QuickFilterBarStickyBasics2");
  let [unreadTwo, readTwo] = make_new_sets_in_folder(folderTwo,
    [{count: 1}, {count: 1}]);
  readTwo.setRead(true);

  // -- setup
  let tabA = be_in_folder(folderOne);
  toggle_boolean_constraints("sticky", "unread");
  assert_messages_in_view(unreadOne);

  // -- change folders
  be_in_folder(folderTwo);
  assert_constraints_expressed({sticky: true, unread: true});
  assert_messages_in_view(unreadTwo);

  // -- inherit into a new folder
  let tabB = open_folder_in_new_tab(folderOne);
  assert_constraints_expressed({sticky: true, unread: true});
  assert_messages_in_view(unreadOne);

  close_tab(tabB);
}

/**
 * The semantics of sticky tags are not obvious; there were decisions involved:
 * - If the user has the tag facet enabled but not explicitly filtered on
 *   specific tags then we propagate just "true" to cause the faceting to
 *   run in the new folder.  In other words, the list of displayed tags should
 *   change.
 * - If the user has filtered on specific tags, then we do and must propagate
 *   the list of tags.
 *
 * We only need to do folder changes from here on out since the logic is
 *  identical (and tested to be identical in |test_sticky_basics|).
 */
function test_sticky_tags() {
  let folderOne = create_folder("QuickFilterBarStickyTags1");
  let folderTwo = create_folder("QuickFilterBarStickyTags2");
  const tagA = "$label1", tagB = "$label2", tagC = "$label3";
  let [setNoTag1, setTagA1, setTagB1] = make_new_sets_in_folder(
    folderOne, [{count: 1}, {count: 1}, {count: 1}]);
  let [setNoTag2, setTagA2, setTagC2] = make_new_sets_in_folder(
    folderTwo, [{count: 1}, {count: 1}, {count: 1}]);
  setTagA1.addTag(tagA);
  setTagB1.addTag(tagB);
  setTagA2.addTag(tagA);
  setTagC2.addTag(tagC);

  be_in_folder(folderOne);
  toggle_boolean_constraints("sticky", "tags");
  assert_tag_constraints_visible(tagA, tagB);
  assert_messages_in_view([setTagA1, setTagB1]);

  // -- re-facet when we change folders since constraint was just true
  be_in_folder(folderTwo);
  assert_tag_constraints_visible(tagA, tagC);
  assert_messages_in_view([setTagA2, setTagC2]);

  // -- do not re-facet since tag A was selected
  toggle_tag_constraints(tagA);
  be_in_folder(folderOne);
  assert_tag_constraints_visible(tagA, tagC);
  assert_messages_in_view([setTagA1]);

  // -- if we turn off sticky, make sure that things clear when we change
  //     folders.  (we had a bug with this before.)
  toggle_boolean_constraints("sticky");
  be_in_folder(folderTwo);
  assert_constraints_expressed({});
}

/**
 * All we are testing propagating is the text value; the text states are always
 *  propagated and that is tested in test-filter-logic.js by
 *  |test_filter_text_constraints_propagate|.
 */
function test_sticky_text() {
  let folderOne = create_folder("QuickFilterBarStickyText1");
  let folderTwo = create_folder("QuickFilterBarStickyText2");

  be_in_folder(folderOne);
  toggle_boolean_constraints("sticky");
  set_filter_text("foo");

  be_in_folder(folderTwo);
  assert_filter_text("foo");
}
