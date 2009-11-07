load("../../mailnews/resources/logHelper.js");
load("../../mailnews/resources/asyncTestUtils.js");

load("../../mailnews/resources/messageGenerator.js");
load("../../mailnews/resources/messageModifier.js");
load("../../mailnews/resources/messageInjection.js");

load("resources/viewWrapperTestUtils.js");
initViewWrapperTestUtils();

/**
 * Verify that flipping between threading and grouped by sort settings properly
 *  clears the other flag.  (Because they're mutually exclusive, you see.)
 */
function test_threading_grouping_mutual_exclusion () {
  let viewWrapper = make_view_wrapper();
  let folder = make_empty_folder();

  yield async_view_open(viewWrapper, folder);
  // enter an update that will never conclude.  this is fine.
  viewWrapper.beginViewUpdate();
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
 * Verify that flipping between the "View... Threads..." menu cases supported by
 *  |showUnreadOnly| / |specialViewThreadsWithUnread| /
 *  |specialViewThreadsWithUnread| has them all be properly mutually exclusive.
 */
function test_threads_special_views_mutual_exclusion() {
  let viewWrapper = make_view_wrapper();
  let folder = make_empty_folder();

  yield async_view_open(viewWrapper, folder);
  // enter an update that will never conclude. this is fine.
  viewWrapper.beginViewUpdate();

  // turn on the special view, make sure we think it took
  viewWrapper.specialViewThreadsWithUnread = true;
  do_check_true(viewWrapper.specialViewThreadsWithUnread);
  do_check_false(viewWrapper.specialViewWatchedThreadsWithUnread);

  // hit showUnreadOnly which should already be false, so this makes sure that
  //  just writing to it forces the special view off.
  viewWrapper.showUnreadOnly = false;
  do_check_false(viewWrapper.showUnreadOnly);
  do_check_false(viewWrapper.specialViewThreadsWithUnread);
  do_check_false(viewWrapper.specialViewWatchedThreadsWithUnread);

  // turn on the other special view
  viewWrapper.specialViewWatchedThreadsWithUnread = true;
  do_check_false(viewWrapper.specialViewThreadsWithUnread);
  do_check_true(viewWrapper.specialViewWatchedThreadsWithUnread);

  // turn on show unread only mode, make sure special view is cleared
  viewWrapper.showUnreadOnly = true;
  do_check_true(viewWrapper.showUnreadOnly);
  do_check_false(viewWrapper.specialViewThreadsWithUnread);
  do_check_false(viewWrapper.specialViewWatchedThreadsWithUnread);

  // turn off show unread only mode just to make sure the transition happens
  viewWrapper.showUnreadOnly = false;
  do_check_false(viewWrapper.showUnreadOnly);
  do_check_false(viewWrapper.specialViewThreadsWithUnread);
  do_check_false(viewWrapper.specialViewWatchedThreadsWithUnread);
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
    yield async_view_refresh(viewWrapper);
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
    yield async_view_refresh(viewWrapper);
  }
}

/**
 * Test that group-by-sort does not explode even if we try and get it to use
 *  sorts that are illegal for group-by-sort mode.  It is important that we
 *  test both illegal primary sorts (fixed a while back) plus illegal
 *  secondary sorts (fixing now).
 *
 * Note: Sorting changes are synchronous, but toggling grouped by sort requries
 *  a view rebuild.
 */
function test_sort_group_by_sort() {
  let viewWrapper = make_view_wrapper();
  // we need to put messages in the folder or the sort logic doesn't actually
  //  save the sort state. (this is the C++ view's fault.)
  let [folder, msgSet] = make_folder_with_sets(1);
  yield async_view_open(viewWrapper, folder);

  // - start out by being in an illegal (for group-by-sort) sort mode and
  //  switch to group-by-sort.
  // (sorting changes are synchronous)
  viewWrapper.sort(Ci.nsMsgViewSortType.byId,
                   Ci.nsMsgViewSortType.descending);
  yield async_view_group_by_sort(viewWrapper, true);

  // there should have been no explosion, and we should have changed to date
  assert_equals(viewWrapper.primarySortType, Ci.nsMsgViewSortType.byDate,
                "sort should have reset to date");

  // - return to unthreaded, have an illegal secondary sort, go group-by-sort
  yield async_view_group_by_sort(viewWrapper, false);

  viewWrapper.sort(Ci.nsMsgViewSortType.byDate,
                   Ci.nsMsgViewSortType.descending,
                   Ci.nsMsgViewSortType.byId,
                   Ci.nsMsgViewSortType.descending);

  yield async_view_group_by_sort(viewWrapper, true);
  // we should now only have a single sort type and it should be date
  assert_equals(viewWrapper._sort.length, 1,
                "we should only have one sort type active");
  assert_equals(viewWrapper.primarySortType, Ci.nsMsgViewSortType.byDate,
                "remaining (primary) sort type should be date");

  // - try and make group-by-sort sort by something illegal
  // (we're still in group-by-sort mode)
  viewWrapper.magicSort(Ci.nsMsgViewSortType.byId,
                        Ci.nsMsgViewSortOrder.descending);
  assert_equals(viewWrapper.primarySortType, Ci.nsMsgViewSortType.byDate,
                "remaining (primary) sort type should be date");
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

/**
 * Make sure:
 * - View update depth increments / decrements as expected, and triggers a
 *    view rebuild when expected.
 * - View update depth can't go below zero resulting in odd happenings.
 * - That the view update depth is zeroed by a close so that we don't
 *    get into awkward states.
 *
 * @bug 498145
 */
function test_view_update_depth_logic() {
  let viewWrapper = make_view_wrapper();

  // create an instance-specific dummy method that counts calls t
  //  _applyViewChanges
  let applyViewCount = 0;
  viewWrapper._applyViewChanges = function() { applyViewCount++; };

  // - view update depth basics
  do_check_eq(viewWrapper._viewUpdateDepth, 0);
  viewWrapper.beginViewUpdate();
  do_check_eq(viewWrapper._viewUpdateDepth, 1);
  viewWrapper.beginViewUpdate();
  do_check_eq(viewWrapper._viewUpdateDepth, 2);
  viewWrapper.endViewUpdate();
  do_check_eq(applyViewCount, 0);
  do_check_eq(viewWrapper._viewUpdateDepth, 1);
  viewWrapper.endViewUpdate();
  do_check_eq(applyViewCount, 1);
  do_check_eq(viewWrapper._viewUpdateDepth, 0);

  // - don't go below zero! (and don't trigger.)
  applyViewCount = 0;
  viewWrapper.endViewUpdate();
  do_check_eq(applyViewCount, 0);
  do_check_eq(viewWrapper._viewUpdateDepth, 0);

  // - depth zeroed on clear
  viewWrapper.beginViewUpdate();
  viewWrapper.close(); // this does little else because there is nothing open
  do_check_eq(viewWrapper._viewUpdateDepth, 0);
}

var tests = [
  test_threading_grouping_mutual_exclusion,
  test_threads_special_views_mutual_exclusion,
  test_sort_primary,
  test_sort_secondary_explicit,
  test_sort_secondary_implicit,
  test_sort_group_by_sort,
  test_mailviews_persistence,
  test_view_update_depth_logic,
];

function run_test() {
  async_run_tests(tests);
}
