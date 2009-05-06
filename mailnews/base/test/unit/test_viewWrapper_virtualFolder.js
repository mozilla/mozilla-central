/**
 * Test DBViewWrapper against virtual folders.
 *
 * Things we do not test and our rationalizations:
 * - threading stuff.  This is not the view wrapper's problem.  That is the db
 *   view's problem!  (We test it in the real folder to make sure we are telling
 *   it to do things correctly.)
 * - view flags.  Again, it's a db view issue once we're sure we set the bits.
 * - special view with threads.  same deal.
 *
 * We could test all these things, but my patch is way behind schedule...
 */

load("../../mailnews/resources/messageGenerator.js");
load("../../mailnews/resources/messageModifier.js");
load("../../mailnews/resources/asyncTestUtils.js");

load("../../mailnews/resources/viewWrapperTestUtils.js");

/**
 * Make sure we open a virtual folder backed by a single underlying folder
 *  correctly; no constraints.
 */
function test_virtual_folder_single_load_no_pred() {
  let viewWrapper = make_view_wrapper();

  let [folderOne, setOne] = make_folder_with_sets(1);

  let virtFolder = make_virtual_folder([folderOne], {});
  yield async_view_open(viewWrapper, virtFolder);

  do_check_true(viewWrapper.isVirtual, true);

  assert_equals(gMockViewWrapperListener.allMessagesLoadedEventCount, 1,
                "Should only have received a single all messages loaded" +
                " notification!");

  verify_messages_in_view(setOne, viewWrapper);
}

/**
 * Make sure we open a virtual folder backed by a single underlying folder
 *  correctly; one constraint.
 */
function test_virtual_folder_single_load_simple_pred() {
  let viewWrapper = make_view_wrapper();

  let [folderOne, oneSubjFoo, oneNopers] = make_folder_with_sets([
    {subject: "foo"}, {}]);

  let virtFolder = make_virtual_folder([folderOne],
                                       {subject: "foo"});
  yield async_view_open(viewWrapper, virtFolder);

  verify_messages_in_view(oneSubjFoo, viewWrapper);
}

/**
 * Make sure we open a virtual folder backed by a single underlying folder
 *  correctly; two constraints ANDed together.
 */
function test_virtual_folder_single_load_complex_pred() {
  let viewWrapper = make_view_wrapper();

  let whoBar = make_person_with_word_in_name("bar");

  let [folderOne, oneSubjOnly, oneFromOnly, oneBoth, oneNone] =
    make_folder_with_sets([{subject: "foo"}, {from: whoBar},
                           {subject: "foo", from: whoBar}, {}]);

  let virtFolder = make_virtual_folder([folderOne],
                                       {subject: "foo", from: "bar"},
                                       /* and? */ true);
  yield async_view_open(viewWrapper, virtFolder);

  verify_messages_in_view(oneBoth, viewWrapper);
}

/**
 * Open a single-backed virtual folder, verify, open another single-backed
 *  virtual folder, verify.  We are testing our ability to change folders
 *  without exploding.
 */
function test_virtual_folder_single_load_after_load() {
  let viewWrapper = make_view_wrapper();

  let [folderOne, oneSubjFoo, oneNopers] = make_folder_with_sets([
    {subject: "foo"}, {}]);
  let virtOne = make_virtual_folder([folderOne],
                                    {subject: "foo"});
  yield async_view_open(viewWrapper, virtOne);
  verify_messages_in_view([oneSubjFoo], viewWrapper);

  // use "bar" instead of "foo" to make sure constraints are properly changing
  let [folderTwo, twoSubjBar, twoNopers] = make_folder_with_sets([
    {subject: "bar"}, {}]);
  let virtTwo = make_virtual_folder([folderTwo],
                                    {subject: "bar"});
  yield async_view_open(viewWrapper, virtTwo);
  verify_messages_in_view([twoSubjBar], viewWrapper);
}

/**
 * Make sure we open a virtual folder backed by multiple underlying folders
 *  correctly; no constraints.
 */
function test_virtual_folder_multi_load_no_pred() {
  let viewWrapper = make_view_wrapper();

  let [folderOne, setOne] = make_folder_with_sets(1);
  let [folderTwo, setTwo] = make_folder_with_sets(1);

  let virtFolder = make_virtual_folder([folderOne, folderTwo], {});
  yield async_view_open(viewWrapper, virtFolder);

  verify_messages_in_view([setOne, setTwo], viewWrapper);
}

/**
 * Make sure we open a virtual folder backed by multiple underlying folders
 *  correctly; one constraint.
 */
function test_virtual_folder_multi_load_simple_pred() {
  let viewWrapper = make_view_wrapper();

  let [folderOne, oneSubjFoo, oneNopers] = make_folder_with_sets([
    {subject: "foo"}, {}]);
  let [folderTwo, twoSubjFoo, twoNopers] = make_folder_with_sets([
    {subject: "foo"}, {}]);

  let virtFolder = make_virtual_folder([folderOne, folderTwo],
                                       {subject: "foo"});
  yield async_view_open(viewWrapper, virtFolder);

  verify_messages_in_view([oneSubjFoo, twoSubjFoo], viewWrapper);
}

/**
 * Make sure we open a virtual folder backed by multiple underlying folders
 *  correctly; two constraints ANDed together.
 */
function test_virtual_folder_multi_load_complex_pred() {
  let viewWrapper = make_view_wrapper();

  let whoBar = make_person_with_word_in_name("bar");

  let [folderOne, oneSubjOnly, oneFromOnly, oneBoth, oneNone] =
    make_folder_with_sets([{subject: "foo"}, {from: whoBar},
                           {subject: "foo", from: whoBar}, {}]);
  let [folderTwo, twoSubjOnly, twoFromOnly, twoBoth, twoNone] =
    make_folder_with_sets([{subject: "foo"}, {from: whoBar},
                           {subject: "foo", from: whoBar}, {}]);

  let virtFolder = make_virtual_folder([folderOne, folderTwo],
                                       {subject: "foo", from: "bar"},
                                       /* and? */ true);
  yield async_view_open(viewWrapper, virtFolder);

  verify_messages_in_view([oneBoth, twoBoth], viewWrapper);
}

function test_virtual_folder_multi_load_alotta_folders_no_pred() {
  let viewWrapper = make_view_wrapper();

  const folderCount = 4;
  const messageCount = 64;

  let [folders, setOne] = make_folders_with_sets(folderCount,
                                                 [{count: messageCount}]);

  let virtFolder = make_virtual_folder(folders, {});
  yield async_view_open(viewWrapper, virtFolder);

  verify_messages_in_view([setOne], viewWrapper);
}

function test_virtual_folder_multi_load_alotta_folders_simple_pred() {
  let viewWrapper = make_view_wrapper();

  const folderCount = 16;
  const messageCount = 256;

  let [folders, setOne] = make_folders_with_sets(folderCount,
    [{subject: "foo", count: messageCount}]);

  let virtFolder = make_virtual_folder(folders, {subject: "foo"});
  yield async_view_open(viewWrapper, virtFolder);

  verify_messages_in_view([setOne], viewWrapper);
}

/**
 * Make sure that opening a virtual folder backed by multiple real folders, then
 *  opening another virtual folder of the same variety works without explosions.
 */
function test_virtual_folder_multi_load_after_load() {
  let viewWrapper = make_view_wrapper();

  let [foldersOne, oneSubjFoo, oneNopers] = make_folders_with_sets(2, [
    {subject: "foo"}, {}]);
  let virtOne = make_virtual_folder(foldersOne, {subject: "foo"});
  yield async_view_open(viewWrapper, virtOne);
  verify_messages_in_view([oneSubjFoo], viewWrapper);

  // use "bar" instead of "foo" to make sure constraints are properly changing
  let [foldersTwo, twoSubjBar, twoNopers] = make_folders_with_sets(3, [
    {subject: "bar"}, {}]);
  let virtTwo = make_virtual_folder(foldersTwo,
                                    {subject: "bar"});
  yield async_view_open(viewWrapper, virtTwo);
  verify_messages_in_view([twoSubjBar], viewWrapper);

  yield async_view_open(viewWrapper, virtOne);
  verify_messages_in_view([oneSubjFoo], viewWrapper);
}

/**
 * Make sure that opening a virtual folder backed by a single real folder, then
 *  a multi-backed one, then the single-backed one again doesn't explode.
 *
 * This is just test_virtual_folder_multi_load_after_load with foldersOne told
 *  to create just a single folder.
 */
function test_virtual_folder_combo_load_after_load() {
  let viewWrapper = make_view_wrapper();

  let [foldersOne, oneSubjFoo, oneNopers] = make_folders_with_sets(1, [
    {subject: "foo"}, {}]);
  let virtOne = make_virtual_folder(foldersOne, {subject: "foo"});
  yield async_view_open(viewWrapper, virtOne);
  verify_messages_in_view([oneSubjFoo], viewWrapper);

  // use "bar" instead of "foo" to make sure constraints are properly changing
  let [foldersTwo, twoSubjBar, twoNopers] = make_folders_with_sets(3, [
    {subject: "bar"}, {}]);
  let virtTwo = make_virtual_folder(foldersTwo,
                                    {subject: "bar"});
  yield async_view_open(viewWrapper, virtTwo);
  verify_messages_in_view([twoSubjBar], viewWrapper);

  yield async_view_open(viewWrapper, virtOne);
  verify_messages_in_view([oneSubjFoo], viewWrapper);
}

/**
 * Verify that if one of the folders backing our virtual folder is deleted that
 *  we do not explode.  Then verify that if we remove the rest of them that the
 *  view wrapper closes itself.
 */
function test_virtual_folder_underlying_folder_deleted() {
  let viewWrapper = make_view_wrapper();

  let [folderOne, oneSubjFoo, oneNopers] = make_folder_with_sets([
    {subject: "foo"}, {}]);
  let [folderTwo, twoSubjFoo, twoNopers] = make_folder_with_sets([
    {subject: "foo"}, {}]);

  let virtFolder = make_virtual_folder([folderOne, folderTwo],
                                       {subject: "foo"});
  yield async_view_open(viewWrapper, virtFolder);

  // this triggers the search (under the view's hood), so it's async
  yield async_delete_folder(folderOne, viewWrapper);

  // only messages from the surviving folder should be present
  verify_messages_in_view([twoSubjFoo], viewWrapper);

  // this one is not async though, because we are expecting to close the wrapper
  //  and ignore the view entirely, so do not yield.
  delete_folder(folderTwo);

  // now the view wrapper should have closed itself.
  do_check_eq(null, viewWrapper.displayedFolder);
}

/* ===== Virtual Folder, Mail Views ===== */

/*
 * We do not need to test all of the mail view permutations, realFolder
 *  already did that.  We just need to make sure it works at all.
 */

function test_virtual_folder_mail_views_unread(aNumFolders) {
  let viewWrapper = make_view_wrapper();

  let [folders, fooOne, fooTwo, nopeOne, nopeTwo] = make_folders_with_sets(
    aNumFolders, [{subject: "foo 1"}, {subject: "foo 2"}, {}, {}]);
  let virtFolder = make_virtual_folder(folders, {subject: "foo"});

  // everything is unread to start with!
  yield async_view_open(viewWrapper, virtFolder);
  yield async_view_set_mail_view(viewWrapper, MailViewConstants.kViewItemUnread);
  verify_messages_in_view([fooOne, fooTwo], viewWrapper);

  // add some more things (unread!), make sure they appear.
  let [fooThree, nopeThree] = make_new_sets_in_folders(folders,
    [{subject: "foo 3"}, {}]);
  verify_messages_in_view([fooOne, fooTwo, fooThree], viewWrapper);

  // make some things read, make sure they disappear. (after a refresh)
  fooTwo.setRead(true);
  yield async_view_refresh(viewWrapper);
  verify_messages_in_view([fooOne, fooThree], viewWrapper);

  // make those things un-read again.
  fooTwo.setRead(false);
  // I thought this was a quick search limitation, but XFVF needs it to, at
  //  least for the unread case.
  yield async_view_refresh(viewWrapper);
  verify_messages_in_view([fooOne, fooTwo, fooThree], viewWrapper);
}


/* ===== Virtual Folder, Quick Search  ===== */

/*
 * We do not need to test all of the quick search permutations, realFolder
 *  already did that.  We just need to make sure that quick search works
 *  with single-folder and multi-folder virtual folders.  Additionally, we
 *  need to make sure that it works for simple and complex virtual folders.
 * We handle the single and multi folder cases with the same test code, just
 *  parameterized over the number of folders.  We use 4 folders for the multi
 *  folder case to encourage the time slicing logic to split itself up.
 */

function test_virtual_folder_param_quick_search_simple(aNumFolders) {
  let viewWrapper = make_view_wrapper();

  // venn it up.  virtual folder search on "foo", actual search will be on "bar"
  let [folders, subjFooBar, subjFoo, subjBar, nopers] =
    make_folders_with_sets(aNumFolders,
      [{subject: "foo bar"}, {subject: "foo"}, {subject: "bar"}, {}]);
  let virt = make_virtual_folder(folders, {subject: "foo"});
  yield async_view_open(viewWrapper, virt);
  verify_messages_in_view([subjFooBar, subjFoo], viewWrapper);

  yield async_view_quick_search(viewWrapper,
                                QuickSearchConstants.kQuickSearchSubject,
                                "bar");
  verify_messages_in_view([subjFooBar], viewWrapper);
}

function test_virtual_folder_param_quick_search_complex(aNumFolders) {
  let viewWrapper = make_view_wrapper();

  let whoBaz = make_person_with_word_in_address("baz");

  // virtual folder is on "foo" and "baz"
  // quick search is on "bar"
  let [folders, fooBarBaz, fooBar, fooBaz, foo, barBaz, bar, baz, nopers] =
    make_folders_with_sets(aNumFolders,
      [{subject: "foo bar", from: whoBaz}, {subject: "foo bar"},
       {subject: "foo", from: whoBaz}, {subject: "foo"},
       {subject: "bar", from: whoBaz}, {subject: "bar"},
       {from: whoBaz}, {}]);
  let virt = make_virtual_folder(folders, {subject: "foo", from: "baz"}, true);
  yield async_view_open(viewWrapper, virt);
  verify_messages_in_view([fooBarBaz, fooBaz], viewWrapper);

  yield async_view_quick_search(viewWrapper,
                                QuickSearchConstants.kQuickSearchSubject,
                                "bar");
  verify_messages_in_view([fooBarBaz], viewWrapper);
}

/* ===== Virtual Folder, Mail View and Quick Search ===== */

function test_virtual_folder_param_mail_view_and_quick_search(aNumFolders) {
  let viewWrapper = make_view_wrapper();

  // virtual folder search on "foo"
  // quick search on "bar"
  let [folders, fooBarOne, fooBarTwo, foo, bar, nopers] =
    make_folders_with_sets(aNumFolders,
      [{subject: "foo bar 1"}, {subject: "foo bar 2"}, {subject: "foo"},
       {subject: "bar"}, {}]);
  let virt = make_virtual_folder(folders, {subject: "foo"});
  yield async_view_open(viewWrapper, virt);
  yield async_view_set_mail_view(viewWrapper, MailViewConstants.kViewItemUnread);
  yield async_view_quick_search(viewWrapper,
                                QuickSearchConstants.kQuickSearchSubject,
                                "bar");
  verify_messages_in_view([fooBarOne, fooBarTwo], viewWrapper);

  fooBarTwo.setRead(true);
  yield async_view_refresh(viewWrapper);
  verify_messages_in_view(fooBarOne, viewWrapper);
}

var tests = [
  // -- single-folder backed virtual folder
  //test_virtual_folder_single_load_no_pred, // this virtual folder makes little sense and upsets OS X.
  test_virtual_folder_single_load_simple_pred,
  test_virtual_folder_single_load_complex_pred,
  test_virtual_folder_single_load_after_load,
  // -- multi-folder backed virtual folder
  test_virtual_folder_multi_load_no_pred,
  test_virtual_folder_multi_load_simple_pred,
  test_virtual_folder_multi_load_complex_pred,
  test_virtual_folder_multi_load_alotta_folders_no_pred,
  test_virtual_folder_multi_load_alotta_folders_simple_pred,
  test_virtual_folder_multi_load_after_load,
  // -- mixture of single-backed and multi-backed
  test_virtual_folder_combo_load_after_load,
  // -- rare/edge cases!
  test_virtual_folder_underlying_folder_deleted,
  // -- mail views (parameterized)
  parameterizeTest(test_virtual_folder_mail_views_unread, [1, 4]),
  // -- quick search (parameterized for single and multi folder cases)
  parameterizeTest(test_virtual_folder_param_quick_search_simple, [1, 4]),
  parameterizeTest(test_virtual_folder_param_quick_search_complex, [1, 4]),
  // -- mail view with quick search
  parameterizeTest(test_virtual_folder_param_mail_view_and_quick_search,[1, 4]),
];

function run_test() {
  loadLocalMailAccount();
  async_run_tests(tests);
}
