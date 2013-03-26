/**
 * Test DBViewWrapper against a single local folder.  Try and test all the
 *  features we can without having a fake newsgroup.  (Some features are
 *  newsgroup specific.)
 */

load("../../../../mailnews/resources/logHelper.js");
load("../../../../mailnews/resources/asyncTestUtils.js");

load("../../../../mailnews/resources/messageGenerator.js");
load("../../../../mailnews/resources/messageModifier.js");
load("../../../../mailnews/resources/messageInjection.js");

load("resources/viewWrapperTestUtils.js");
initViewWrapperTestUtils();

Components.utils.import("resource://gre/modules/Services.jsm");

/* ===== Real Folder, no features ===== */

/**
 * Open a pre-populated real folder, make sure all the messages show up.
 */
function test_real_folder_load() {
  let viewWrapper = make_view_wrapper();
  let [msgFolder, msgSet] = make_folder_with_sets(1);
  yield async_view_open(viewWrapper, msgFolder);
  verify_messages_in_view(msgSet, viewWrapper);
}

/**
 * Open a real folder, add some messages, make sure they show up, remove some
 *  messages, make sure they go away.
 */
function test_real_folder_update() {
  let viewWrapper = make_view_wrapper();

  // start with an empty folder
  let msgFolder = make_empty_folder();
  yield async_view_open(viewWrapper, msgFolder);
  verify_empty_view(viewWrapper);

  // add messages (none -> some)
  let [setOne] = make_new_sets_in_folder(msgFolder, 1);
  verify_messages_in_view(setOne, viewWrapper);

  // add more messages! (some -> more)
  let [setTwo] = make_new_sets_in_folder(msgFolder, 1);
  verify_messages_in_view([setOne, setTwo], viewWrapper);

  // remove the first set of messages (more -> some)
  yield async_trash_messages(setOne);
  verify_messages_in_view(setTwo, viewWrapper);

  // remove the second set of messages (some -> none)
  yield async_trash_messages(setTwo);
  verify_empty_view(viewWrapper);

}

/**
 * Open a real folder, verify, open another folder, verify.  We are testing
 *  ability to change folders without exploding.
 */
function test_real_folder_load_after_real_folder_load() {
  let viewWrapper = make_view_wrapper();

  let [folderOne, setOne] = make_folder_with_sets(1);
  yield async_view_open(viewWrapper, folderOne);
  verify_messages_in_view(setOne, viewWrapper);

  let [folderTwo, setTwo] = make_folder_with_sets(1);
  yield async_view_open(viewWrapper, folderTwo);
  verify_messages_in_view(setTwo, viewWrapper);
}

/* ===== Real Folder, Threading Modes ==== */
/*
 * The first three tests that verify setting the threading flags has the
 *  expected outcome do this by creating the view from scratch with the view
 *  flags applied.  The view threading persistence test handles making sure
 *  that changes in threading on-the-fly work from the perspective of the
 *  bits and what not.  None of these are tests of the view implementation's
 *  threading/grouping logic, just sanity checking that we are doing the right
 *  thing.
 */

function test_real_folder_threading_unthreaded() {
  let viewWrapper = make_view_wrapper();
  let folder = make_empty_folder();

  // create a single maximally nested thread.
  const count = 10;
  let messageSet =
    new SyntheticMessageSet(gMessageScenarioFactory.directReply(count));
  add_sets_to_folder(folder, [messageSet]);

  // verify that we are not threaded (or grouped)
  yield async_view_open(viewWrapper, folder);
  viewWrapper.beginViewUpdate();
  viewWrapper.showUnthreaded = true;
  // whitebox test view flags (we've gotten them wrong before...)
  assert_bit_not_set(viewWrapper._viewFlags,
                     Ci.nsMsgViewFlagsType.kThreadedDisplay,
                     "View threaded bit should not be set.");
  assert_bit_not_set(viewWrapper._viewFlags,
                     Ci.nsMsgViewFlagsType.kGroupBySort,
                     "View group-by-sort bit should not be set.");
  yield async_view_end_update(viewWrapper);
  verify_view_level_histogram({0: count}, viewWrapper);
}

function test_real_folder_threading_threaded() {
  let viewWrapper = make_view_wrapper();
  let folder = make_empty_folder();

  // create a single maximally nested thread.
  const count = 10;
  let messageSet =
    new SyntheticMessageSet(gMessageScenarioFactory.directReply(count));
  add_sets_to_folder(folder, [messageSet]);

  // verify that we are threaded (in such a way that we can't be grouped)
  yield async_view_open(viewWrapper, folder);
  viewWrapper.beginViewUpdate();
  viewWrapper.showThreaded = true;
  // whitebox test view flags (we've gotten them wrong before...)
  assert_bit_set(viewWrapper._viewFlags,
                 Ci.nsMsgViewFlagsType.kThreadedDisplay,
                 "View threaded bit should be set.");
  assert_bit_not_set(viewWrapper._viewFlags,
                     Ci.nsMsgViewFlagsType.kGroupBySort,
                     "View group-by-sort bit should not be set.");
  // expand everything so our logic below works.
  view_expand_all(viewWrapper);
  yield async_view_end_update(viewWrapper);
  // blackbox test view flags: make sure IsContainer is true for the root
  verify_view_row_at_index_is_container(viewWrapper, 0);
  // do the histogram test to verify threading...
  let expectedHisto = {};
  for (let i = 0; i < count; i++)
    expectedHisto[i] = 1;
  verify_view_level_histogram(expectedHisto, viewWrapper);
}

function test_real_folder_threading_grouped_by_sort() {
  let viewWrapper = make_view_wrapper();

  // create some messages that belong to the 'in this week' bucket when sorting
  //  by date and grouping by date.
  const count = 5;
  let [folder, messageSet] = make_folder_with_sets([
    {count: count, age: {days: 2}, age_incr: {mins: 1}}]);

  // group-by-sort sorted by date
  yield async_view_open(viewWrapper, folder);
  viewWrapper.beginViewUpdate();
  viewWrapper.showGroupedBySort = true;
  // whitebox test view flags (we've gotten them wrong before...)
  assert_bit_set(viewWrapper._viewFlags,
                 Ci.nsMsgViewFlagsType.kThreadedDisplay,
                 "View threaded bit should be set.");
  assert_bit_set(viewWrapper._viewFlags,
                 Ci.nsMsgViewFlagsType.kGroupBySort,
                 "View group-by-sort bit should be set.");
  viewWrapper.sort(Ci.nsMsgViewSortType.byDate,
                   Ci.nsMsgViewSortOrder.ascending);
  // expand everyone
  view_expand_all(viewWrapper);
  yield async_view_end_update(viewWrapper);

  // make sure the level depths are correct
  verify_view_level_histogram({0: 1, 1: count}, viewWrapper);
  // and make sure the first dude is a dummy
  verify_view_row_at_index_is_dummy(viewWrapper, 0);
}

/**
 * Verify that we the threading modes are persisted.  We are only checking
 *  flags here; we trust the previous tests to have done their job.
 */
function test_real_folder_threading_persistence() {
  let viewWrapper = make_view_wrapper();
  let folder = make_empty_folder();

  // create a single maximally nested thread.
  const count = 10;
  let messageSet =
    new SyntheticMessageSet(gMessageScenarioFactory.directReply(count));
  add_sets_to_folder(folder, [messageSet]);

  // open the folder, set threaded mode, close it
  yield async_view_open(viewWrapper, folder);
  viewWrapper.showThreaded = true; // should be instantaneous
  verify_view_row_at_index_is_container(viewWrapper, 0);
  assert_bit_set(viewWrapper._viewFlags,
                 Ci.nsMsgViewFlagsType.kThreadedDisplay,
                 "View threaded bit should be set.");
  assert_bit_not_set(viewWrapper._viewFlags,
                     Ci.nsMsgViewFlagsType.kGroupBySort,
                     "View group-by-sort bit should not be set.");
  viewWrapper.close();

  // open it again, make sure we're threaded, go unthreaded, close
  yield async_view_open(viewWrapper, folder);
  assert_true(viewWrapper.showThreaded, "view should be threaded");
  assert_false(viewWrapper.showUnthreaded, "view is lying about threading");
  assert_false(viewWrapper.showGroupedBySort, "view is lying about threading");
  verify_view_row_at_index_is_container(viewWrapper, 0);
  assert_bit_set(viewWrapper._viewFlags,
                 Ci.nsMsgViewFlagsType.kThreadedDisplay,
                 "View threaded bit should be set.");
  assert_bit_not_set(viewWrapper._viewFlags,
                     Ci.nsMsgViewFlagsType.kGroupBySort,
                     "View group-by-sort bit should not be set.");

  viewWrapper.showUnthreaded = true;
  assert_bit_not_set(viewWrapper._viewFlags,
                     Ci.nsMsgViewFlagsType.kThreadedDisplay,
                     "View threaded bit should not be set.");
  assert_bit_not_set(viewWrapper._viewFlags,
                     Ci.nsMsgViewFlagsType.kGroupBySort,
                     "View group-by-sort bit should not be set.");
  viewWrapper.close();

  // open it again, make sure we're unthreaded, go grouped, close
  yield async_view_open(viewWrapper, folder);
  assert_true(viewWrapper.showUnthreaded, "view should be unthreaded");
  assert_false(viewWrapper.showThreaded, "view is lying about threading");
  assert_false(viewWrapper.showGroupedBySort, "view is lying about threading");
  assert_bit_not_set(viewWrapper._viewFlags,
                     Ci.nsMsgViewFlagsType.kThreadedDisplay,
                     "View threaded bit should not be set.");
  assert_bit_not_set(viewWrapper._viewFlags,
                     Ci.nsMsgViewFlagsType.kGroupBySort,
                     "View group-by-sort bit should not be set.");

  viewWrapper.showGroupedBySort = true;
  assert_bit_set(viewWrapper._viewFlags,
                 Ci.nsMsgViewFlagsType.kThreadedDisplay,
                 "View threaded bit should be set.");
  assert_bit_set(viewWrapper._viewFlags, Ci.nsMsgViewFlagsType.kGroupBySort,
                 "View group-by-sort bit should be set.");
  viewWrapper.close();

  // open it again, make sure we're grouped.
  yield async_view_open(viewWrapper, folder);
  assert_true(viewWrapper.showGroupedBySort, "view should be grouped");
  assert_false(viewWrapper.showThreaded, "view is lying about threading");
  assert_false(viewWrapper.showUnthreaded, "view is lying about threading");
  assert_bit_set(viewWrapper._viewFlags,
                 Ci.nsMsgViewFlagsType.kThreadedDisplay,
                 "View threaded bit should be set.");
  assert_bit_set(viewWrapper._viewFlags, Ci.nsMsgViewFlagsType.kGroupBySort,
                 "View group-by-sort bit should be set.");
}

/* ===== Real Folder, View Flags ===== */

/*
 * We cannot test the ignored flag for a local folder because we cannot ignore
 *  threads in a local folder.  Only newsgroups can do that and that's not
 *  easily testable at this time.
 */

/**
 * Test the kUnreadOnly flag usage.  This functionality is equivalent to the
 *  mailview kViewItemUnread case, so it uses roughly the same test as
 *  test_real_folder_mail_views_unread.
 */
function test_real_folder_flags_show_unread() {
  let viewWrapper = make_view_wrapper();

  let [folder, setOne, setTwo] = make_folder_with_sets(2);

  // everything is unread to start with! #1
  yield async_view_open(viewWrapper, folder);
  viewWrapper.beginViewUpdate();
  viewWrapper.showUnreadOnly = true;
  yield async_view_end_update(viewWrapper);
  verify_messages_in_view([setOne, setTwo], viewWrapper);

  // add some more things (unread!), make sure they appear. #2
  let [setThree] = make_new_sets_in_folder(folder, 1);
  verify_messages_in_view([setOne, setTwo, setThree], viewWrapper);

  // make some things read, make sure they disappear. #3 (after refresh)
  setTwo.setRead(true);
  yield async_view_refresh(viewWrapper); // refresh to get the messages to disappear
  verify_messages_in_view([setOne, setThree], viewWrapper);

  // make those things un-read again. #2
  setTwo.setRead(false);
  yield async_view_refresh(viewWrapper); // QUICKSEARCH-VIEW-LIMITATION-REMOVE or not?
  verify_messages_in_view([setOne, setTwo, setThree], viewWrapper);
}


/* ===== Real Folder, Mail Views ===== */

/*
 * For these tests, we are testing the filtering logic, not grouping or sorting
 *  logic.  The view tests are responsible for that stuff.  We test that:
 *
 * 1) The view is populated correctly on open.
 * 2) The view adds things that become relevant.
 * 3) The view removes things that are no longer relevant.  Because views like
 *    to be stable (read: messages don't disappear as you look at them), this
 *    requires refreshing the view (unless the message has been deleted).
 */

/**
 * Test the kViewItemUnread mail-view case.  This functionality is equivalent
 *  to the kUnreadOnly view flag case, so it uses roughly the same test as
 *  test_real_folder_flags_show_unread.
 */
function test_real_folder_mail_views_unread() {
  let viewWrapper = make_view_wrapper();

  let [folder, setOne, setTwo] = make_folder_with_sets(2);

  // everything is unread to start with! #1
  yield async_view_open(viewWrapper, folder);
  yield async_view_set_mail_view(viewWrapper, MailViewConstants.kViewItemUnread);
  verify_messages_in_view([setOne, setTwo], viewWrapper);

  // add some more things (unread!), make sure they appear. #2
  let [setThree] = make_new_sets_in_folder(folder, 1);
  verify_messages_in_view([setOne, setTwo, setThree], viewWrapper);

  // make some things read, make sure they disappear. #3 (after refresh)
  setTwo.setRead(true);
  yield async_view_refresh(viewWrapper); // refresh to get the messages to disappear
  verify_messages_in_view([setOne, setThree], viewWrapper);

  // make those things un-read again. #2
  setTwo.setRead(false);
  yield async_view_refresh(viewWrapper); // QUICKSEARCH-VIEW-LIMITATION-REMOVE
  verify_messages_in_view([setOne, setTwo, setThree], viewWrapper);
}

function test_real_folder_mail_views_tags() {
  let viewWrapper = make_view_wrapper();

  // setup the initial set with the tag
  let [folder, setOne, setTwo] = make_folder_with_sets(2);
  setOne.addTag('$label1');

  // open, apply mail view constraint, see those messages
  yield async_view_open(viewWrapper, folder);
  yield async_view_set_mail_view(viewWrapper, MailViewConstants.kViewItemTags, '$label1');
  verify_messages_in_view(setOne, viewWrapper);

  // add some more with the tag
  setTwo.addTag('$label1');

  // make sure they showed up
  yield async_view_refresh(viewWrapper); // QUICKSEARCH-VIEW-LIMITATION-REMOVE
  verify_messages_in_view([setOne, setTwo], viewWrapper);

  // remove them all
  setOne.removeTag('$label1');
  setTwo.removeTag('$label1');

  // make sure they all disappeared. #3
  yield async_view_refresh(viewWrapper);
  verify_empty_view(viewWrapper);
}

function test_real_folder_mail_views_not_deleted() {
  // not sure how to test this in the absence of an IMAP account with the IMAP
  //  deletion model...
  punt();
}

function test_real_folder_mail_views_custom_people_i_know() {
  // blurg. address book.
  punt();
}

// recent mail = less than 1 day
function test_real_folder_mail_views_custom_recent_mail() {
  let viewWrapper = make_view_wrapper();

  // create a set that meets the threshold and a set that does not
  let [folder, setRecent, setOld] = make_folder_with_sets([
    {age: {mins: 0}},
    {age: {days: 2}, age_incr: {mins: 1}},
  ]);

  // open the folder, ensure only the recent guys show. #1
  yield async_view_open(viewWrapper, folder);
  yield async_view_set_mail_view(viewWrapper, "Recent Mail");
  verify_messages_in_view(setRecent, viewWrapper);

  // add two more sets, one that meets, and one that doesn't. #2
  let [setMoreRecent, setMoreOld] = make_new_sets_in_folder(folder, [
    {age: {mins: 0}},
    {age: {days: 2, hours: 1}, age_incr: {mins: 1}},
  ]);
  // make sure that all we see is our previous recent set and our new recent set
  verify_messages_in_view([setRecent, setMoreRecent], viewWrapper);

  // we aren't going to mess with the system clock, so no #3.
  // (we are assuming that the underlying code handles message deletion.  also,
  //  we are taking the position that message timestamps should not change.)
}

function test_real_folder_mail_views_custom_last_5_days() {
  let viewWrapper = make_view_wrapper();

  // create a set that meets the threshold and a set that does not
  let [folder, setRecent, setOld] = make_folder_with_sets([
    {age: {days: 2}, age_incr: {mins: 1}},
    {age: {days: 6}, age_incr: {mins: 1}},
  ]);

  // open the folder, ensure only the recent guys show. #1
  yield async_view_open(viewWrapper, folder);
  yield async_view_set_mail_view(viewWrapper, "Last 5 Days");
  verify_messages_in_view(setRecent, viewWrapper);

  // add two more sets, one that meets, and one that doesn't. #2
  let [setMoreRecent, setMoreOld] = make_new_sets_in_folder(folder, [
    {age: {mins: 0}},
    {age: {days: 5, hours: 1}, age_incr: {mins: 1}},
  ]);
  // make sure that all we see is our previous recent set and our new recent set
  verify_messages_in_view([setRecent, setMoreRecent], viewWrapper);

  // we aren't going to mess with the system clock, so no #3.
  // (we are assuming that the underlying code handles message deletion.  also,
  //  we are taking the position that message timestamps should not change.)
}

function test_real_folder_mail_views_custom_not_junk() {
  let viewWrapper = make_view_wrapper();

  let [folder, setJunk, setNotJunk] = make_folder_with_sets(2);
  setJunk.setJunk(true);
  setNotJunk.setJunk(false);

  // open, see non-junk messages. #1
  yield async_view_open(viewWrapper, folder);
  yield async_view_set_mail_view(viewWrapper, "Not Junk");
  verify_messages_in_view(setNotJunk, viewWrapper);

  // add some more messages, have them be non-junk for now. #2
  let [setFlippy] = make_new_sets_in_folder(folder, 1);
  setFlippy.setJunk(false);
  yield async_view_refresh(viewWrapper); // QUICKSEARCH-VIEW-LIMITATION-REMOVE
  verify_messages_in_view([setNotJunk, setFlippy], viewWrapper);

  // oops! they should be junk! #3
  setFlippy.setJunk(true);
  yield async_view_refresh(viewWrapper);
  verify_messages_in_view(setNotJunk, viewWrapper);
}

function test_real_folder_mail_views_custom_has_attachments() {
  let viewWrapper = make_view_wrapper();

  let attachSetDef = {attachments: [{filename: 'foo.png',
                                     contentType: 'image/png',
                                     encoding: 'base64', charset: null,
                                     body: 'YWJj\n', format: null}]};
  let noAttachSetDef = {};

  let [folder, setNoAttach, setAttach] =
    make_folder_with_sets([noAttachSetDef, attachSetDef]);
  yield async_view_open(viewWrapper, folder);
  yield async_view_set_mail_view(viewWrapper, "Has Attachments");
  verify_messages_in_view(setAttach, viewWrapper);

  let [setMoreAttach, setMoreNoAttach] =
    make_new_sets_in_folder(folder, [attachSetDef, noAttachSetDef]);
  verify_messages_in_view([setAttach, setMoreAttach], viewWrapper);
}

/* ===== Real Folder, Special Views ===== */

function test_real_folder_special_views_threads_with_unread() {
  let viewWrapper = make_view_wrapper();
  let folder = make_empty_folder();

  // create two maximally nested threads and add them to the folder.
  const count = 10;
  let setThreadOne =
    new SyntheticMessageSet(gMessageScenarioFactory.directReply(count));
  let setThreadTwo =
    new SyntheticMessageSet(gMessageScenarioFactory.directReply(count));
  add_sets_to_folder(folder, [setThreadOne, setThreadTwo]);

  // open the view, set it to this special view
  yield async_view_open(viewWrapper, folder);
  viewWrapper.beginViewUpdate();
  viewWrapper.specialViewThreadsWithUnread = true;
  view_expand_all(viewWrapper);
  yield async_view_end_update(viewWrapper);

  // no one is read at this point, make sure both threads show up.
  verify_messages_in_view([setThreadOne, setThreadTwo], viewWrapper);

  // mark both threads read, make sure they disappear (after a refresh)
  setThreadOne.setRead(true);
  setThreadTwo.setRead(true);
  yield async_view_refresh(viewWrapper);
  verify_empty_view(viewWrapper);

  // make the first thread visible by marking his last message unread
  setThreadOne.slice(-1).setRead(false);

  view_expand_all(viewWrapper);
  yield async_view_refresh(viewWrapper);
  verify_messages_in_view(setThreadOne, viewWrapper);

  // make the second thread visible by marking some message in the middle
  setThreadTwo.slice(5, 6).setRead(false);
  view_expand_all(viewWrapper);
  yield async_view_refresh(viewWrapper);
  verify_messages_in_view([setThreadOne, setThreadTwo], viewWrapper);
}

/**
 * Make sure that we restore special views from their persisted state when
 *  opening the view.
 */
function test_real_folder_special_views_persist() {
  let viewWrapper = make_view_wrapper();
  let folder = make_empty_folder();

  yield async_view_open(viewWrapper, folder);
  viewWrapper.beginViewUpdate();
  viewWrapper.specialViewThreadsWithUnread = true;
  yield async_view_end_update(viewWrapper);
  viewWrapper.close();

  yield async_view_open(viewWrapper, folder);
  assert_true(viewWrapper.specialViewThreadsWithUnread,
              "We should be in threads-with-unread special view mode.");
}

function test_real_folder_mark_read_on_exit() {
  // set a pref so that the local folders account will think we should
  // mark messages read when leaving the folder.
  Services.prefs.setBoolPref("mailnews.mark_message_read.none", true);

  let viewWrapper = make_view_wrapper();
  let folder = make_empty_folder();
  yield async_view_open(viewWrapper, folder);

  // add some unread messages.
  let [setOne] = make_new_sets_in_folder(folder, 1);
  setOne.setRead(false);
  // verify that we have unread messages.
  assert_equals(folder.getNumUnread(false), setOne.synMessages.length,
                "all messages should have been added as unread");
  viewWrapper.close(false);
  // verify that closing the view does the expected marking of the messages
  // as read.
  assert_equals(folder.getNumUnread(false), 0,
                "messages should have been marked read on view close");
  Services.prefs.clearUserPref("mailnews.mark_message_read.none");
}

var tests = [
  test_real_folder_load,
  test_real_folder_update,
  test_real_folder_load_after_real_folder_load,
  // - threading modes
  test_real_folder_threading_unthreaded,
  test_real_folder_threading_threaded,
  test_real_folder_threading_grouped_by_sort,
  test_real_folder_threading_persistence,
  // - view flags
  // (we cannot test ignored flags in local folders)
  test_real_folder_flags_show_unread,
  // - mail views: test the actual views
  test_real_folder_mail_views_unread,
  test_real_folder_mail_views_tags,
  test_real_folder_mail_views_not_deleted,
  // - mail views: test the custom views
  test_real_folder_mail_views_custom_people_i_know,
  test_real_folder_mail_views_custom_recent_mail,
  test_real_folder_mail_views_custom_last_5_days,
  test_real_folder_mail_views_custom_not_junk,
  test_real_folder_mail_views_custom_has_attachments,
  // - special views
  test_real_folder_special_views_threads_with_unread,
  test_real_folder_special_views_persist,
  // (we cannot test the watched threads with unread case in local folders)
  test_real_folder_mark_read_on_exit,
];

function run_test() {
  async_run_tests(tests);
}
