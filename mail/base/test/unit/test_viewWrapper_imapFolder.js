/**
 * Test DBViewWrapper against a single imap folder.  Try and test all the
 *  features we can without having a fake newsgroup.  (Some features are
 *  newsgroup specific.)
 */

load("../../../../mailnews/resources/logHelper.js");
load("../../../../mailnews/resources/asyncTestUtils.js");

load("../../../../mailnews/resources/messageGenerator.js");
load("../../../../mailnews/resources/messageModifier.js");
load("../../../../mailnews/resources/messageInjection.js");

load("resources/viewWrapperTestUtils.js");
initViewWrapperTestUtils({mode: "imap", offline: false});

/**
 * Create an empty folder, inject messages into it without triggering an
 *  updateFolder, sanity check that we believe there are no messages in the
 *  folder, then enter, making sure we immediately enter and that the view
 *  properly updates to reflect there being the right set of messages.
 * (It will fail to update if the db change listener ended up detaching itself
 *  and not reattaching correctly when the updateFolder completes.)
 */
function test_enter_imap_folder_requiring_update_folder_immediately() {
  // - create the folder and wait for the IMAP op to complete
  let folderHandle = make_empty_folder();
  yield wait_for_async_promises();
  let msgFolder = get_real_injection_folder(folderHandle);

  // - add the messages
  let [msgSet] = make_new_sets_in_folder(folderHandle, [{count: 1}], true);
  yield wait_for_message_injection();

  let viewWrapper = make_view_wrapper();

  // - make sure we don't know about the message!
  do_check_eq(msgFolder.getTotalMessages(false), 0);

  // - sync open the folder, verify we claim we entered, and make sure it has
  //  nothing in it!
  viewWrapper.listener.pendingLoad = true;
  viewWrapper.open(msgFolder);
  do_check_true(viewWrapper._enteredFolder);
  verify_empty_view(viewWrapper);

  // - async wait for all the messages to load
  yield false;

  // - make sure the view sees the message though...
  verify_messages_in_view(msgSet, viewWrapper);
}

var tests = [
  test_enter_imap_folder_requiring_update_folder_immediately,
];

function run_test() {
  async_run_tests(tests);
}
