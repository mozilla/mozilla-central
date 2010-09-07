load("../../../../mailnews/resources/logHelper.js");
load("../../../../mailnews/resources/asyncTestUtils.js");

load("../../../../mailnews/resources/messageGenerator.js");
load("../../../../mailnews/resources/messageModifier.js");
load("../../../../mailnews/resources/messageInjection.js");

load("resources/viewWrapperTestUtils.js");
initViewWrapperTestUtils({mode: "imap", offline: false});

function test_real_folder_load_and_move_to_trash() {
  let viewWrapper = make_view_wrapper();
  let [msgFolder, msgSet] = make_folder_with_sets([{count: 1}]);

  yield wait_for_message_injection();
  yield async_view_open(viewWrapper, get_real_injection_folder(msgFolder));
  verify_messages_in_view(msgSet, viewWrapper);

  yield async_trash_messages(msgSet);
  verify_empty_view(viewWrapper);
}

function test_empty_trash() {
  let viewWrapper = make_view_wrapper();
  let trashHandle = get_trash_folder();

  yield wait_for_async_promises();
  let trashFolder = get_real_injection_folder(trashHandle);

  yield async_view_open(viewWrapper, trashFolder);

  yield async_empty_trash();
  verify_empty_view(viewWrapper);

  do_check_neq(null, viewWrapper.displayedFolder);

  let [msgSet] = make_new_sets_in_folders([trashHandle], [{count: 1}]);
  yield wait_for_message_injection();
  verify_messages_in_view(msgSet, viewWrapper);
}

var tests = [
  test_real_folder_load_and_move_to_trash,
  test_empty_trash
];

function run_test() {
  async_run_tests(tests);
}
