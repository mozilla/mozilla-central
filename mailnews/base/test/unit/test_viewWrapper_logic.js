load("../../mailnews/resources/messageGenerator.js");
load("../../mailnews/resources/messageModifier.js");
load("../../mailnews/resources/asyncTestUtils.js");

load("../../mailnews/resources/viewWrapperTestUtils.js");

/**
 * Verify that flipping between threading and grouped by sort settings properly
 *  clears the other flag.  (Because they're mutually exclusive, you see.)
 */
function test_threading_grouping_mutual_exclusion () {
  let viewWrapper = make_view_wrapper();
  let folder = make_empty_folder();

  yield async_view_open(viewWrapper, folder);
  viewWrapper.showThreaded = true;
  assert_true(viewWrapper.showThreaded,
              "view should be threaded");
  assert_false(viewWrapper.showGroupedBySort,
               "view should not be grouped by sort");

  viewWrapper.showGroupedBySort = true;
  assert_false(viewWrapper.showThreaded,
               "view should not be threaded");
  assert_true(viewWrapper.showGroupedBySort,
              "view should be grouped by sort");
}

/**
 * Do a quick test of primary sorting to make sure we're actually changing the
 *  sort order.  (However, we are not responsible for verifying correctness of
 *  the sort.)
 */
function test_sort_primary() {
  let viewWrapper = make_view_wrapper();
  // we need to put messages in the folder or the sort logic doesn't actually
  //  save the sort state. (this is the C++ view's fault.)
  let [folder, msgSet] = make_folder_with_sets(1);

  yield async_view_open(viewWrapper, folder);
  viewWrapper.sort(Ci.nsMsgViewSortType.byDate,
                   Ci.nsMsgViewSortOrder.ascending);
  assert_equals(viewWrapper.dbView.sortType, Ci.nsMsgViewSortType.byDate,
                "sort should be by date", true);
  assert_equals(viewWrapper.dbView.sortOrder, Ci.nsMsgViewSortOrder.ascending,
                "sort order should be ascending", true);

  viewWrapper.sort(Ci.nsMsgViewSortType.byAuthor,
                   Ci.nsMsgViewSortOrder.descending);
  assert_equals(viewWrapper.dbView.sortType, Ci.nsMsgViewSortType.byAuthor,
                "sort should be by author", true);
  assert_equals(viewWrapper.dbView.sortOrder, Ci.nsMsgViewSortOrder.descending,
                "sort order should be descending", true);
}

/**
 * Verify that we handle explicit secondary sorts correctly.
 */
function test_sort_secondary_explicit() {
  let viewWrapper = make_view_wrapper();
  // we need to put messages in the folder or the sort logic doesn't actually
  //  save the sort state. (this is the C++ view's fault.)
  let [folder, msgSet] = make_folder_with_sets(1);

  yield async_view_open(viewWrapper, folder);
  viewWrapper.sort(Ci.nsMsgViewSortType.byAuthor,
                   Ci.nsMsgViewSortOrder.ascending,
                   Ci.nsMsgViewSortType.bySubject,
                   Ci.nsMsgViewSortOrder.descending
                   );
  // check once for what we just did, then again after refreshing to make
  //  sure the sort order 'stuck'
  for (let i = 0; i < 2; i++) {
    assert_equals(viewWrapper.dbView.sortType, Ci.nsMsgViewSortType.byAuthor,
                  "sort should be by author");
    assert_equals(viewWrapper.dbView.sortOrder, Ci.nsMsgViewSortOrder.ascending,
                  "sort order should be ascending");
    assert_equals(viewWrapper.dbView.secondarySortType,
                  Ci.nsMsgViewSortType.bySubject,
                  "secondary sort should be by subject");
    assert_equals(viewWrapper.dbView.secondarySortOrder,
                  Ci.nsMsgViewSortOrder.descending,
                  "secondary sort order should be descending");
    viewWrapper.refresh();
  }

}

/**
 * Verify that we handle implicit secondary sorts correctly.
 * An implicit secondary sort is when we sort by Y, then we sort by X, and it's
 *  okay to have the effective sort of [X, Y].  The UI has/wants this, so, uh,
 *  let's make sure we obey its assumptions unless we have gone and made the UI
 *  be explicit about these things.  We can't simply depend on the view to do
 *  this for us.  Why?  Because we re-create the view all the bloody time.
 */
function test_sort_secondary_implicit() {
  let viewWrapper = make_view_wrapper();
  // we need to put messages in the folder or the sort logic doesn't actually
  //  save the sort state. (this is the C++ view's fault.)
  let [folder, msgSet] = make_folder_with_sets(1);

  yield async_view_open(viewWrapper, folder);
  viewWrapper.magicSort(Ci.nsMsgViewSortType.bySubject,
                        Ci.nsMsgViewSortOrder.descending);
  viewWrapper.magicSort(Ci.nsMsgViewSortType.byAuthor,
                        Ci.nsMsgViewSortOrder.ascending);
  // check once for what we just did, then again after refreshing to make
  //  sure the sort order 'stuck'
  for (let i = 0; i < 2; i++) {
    assert_equals(viewWrapper.dbView.sortType, Ci.nsMsgViewSortType.byAuthor,
                  "sort should be by author");
    assert_equals(viewWrapper.dbView.sortOrder, Ci.nsMsgViewSortOrder.ascending,
                  "sort order should be ascending");
    assert_equals(viewWrapper.dbView.secondarySortType,
                  Ci.nsMsgViewSortType.bySubject,
                  "secondary sort should be by subject");
    assert_equals(viewWrapper.dbView.secondarySortOrder,
                  Ci.nsMsgViewSortOrder.descending,
                  "secondary sort order should be descending");
    viewWrapper.refresh();
  }
}

/**
 * Verify that mailview changes are properly persisted but that we only use them
 *  when the listener indicates we should use them (because the widget is
 *  presumably visible).
 */
function test_mailviews_persistence() {
  let viewWrapper = make_view_wrapper();
  let folder = make_empty_folder();

  // open the folder, ensure it is using the default mail view
  yield async_view_open(viewWrapper, folder);
  do_check_eq(viewWrapper.mailViewIndex, MailViewConstants.kViewItemAll);

  // set the view so as to be persisted
  viewWrapper.setMailView(MailViewConstants.kViewItemUnread);
  // ...but first make sure it took at all
  do_check_eq(viewWrapper.mailViewIndex, MailViewConstants.kViewItemUnread);

  // close, re-open and verify it took
  viewWrapper.close();
  yield async_view_open(viewWrapper, folder);
  do_check_eq(viewWrapper.mailViewIndex, MailViewConstants.kViewItemUnread);

  // close, turn off the mailview usage indication by the listener...
  viewWrapper.close();
  gMockViewWrapperListener.shouldUseMailViews = false;
  // ...open and verify that it did not take!
  yield async_view_open(viewWrapper, folder);
  do_check_eq(viewWrapper.mailViewIndex, MailViewConstants.kViewItemAll);

  // put the mailview setting back so other tests work
  gMockViewWrapperListener.shouldUseMailViews = true;
}

var tests = [
  test_threading_grouping_mutual_exclusion,
  test_sort_primary,
  test_sort_secondary_explicit,
  test_sort_secondary_implicit,
  test_mailviews_persistence,
];

function run_test() {
  loadLocalMailAccount();
  async_run_tests(tests);
}
