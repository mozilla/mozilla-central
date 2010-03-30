/**
 * Test DBViewWrapper against a virtual folder with a custom search term.
 *
 *  This test uses an imap message to specifically test the issues from
 *   bug 549336. The code is derived from test_viewWrapper_virtualFolder.js
 *
 *  Original author: Kent James
 */

load("../../mailnews/resources/logHelper.js");
load("../../mailnews/resources/asyncTestUtils.js");

load("../../mailnews/resources/messageGenerator.js");
load("../../mailnews/resources/messageModifier.js");
load("../../mailnews/resources/messageInjection.js");

load("resources/viewWrapperTestUtils.js");

initViewWrapperTestUtils({mode: "imap", offline: false});

/**
 * A custom search term, that just does Subject Contains
 */
gCustomSearchTermSubject = {
  id: "mailnews@mozilla.org#test",
  name: "Test-mailbase Subject",
  getEnabled: function subject_getEnabled(scope, op) {
    return true;
  },
  getAvailable: function subject_getAvailable(scope, op) {
    return true;
  },
  getAvailableOperators: function subject_getAvailableOperators(scope, length) {
    length.value = 1;
    return [Components.interfaces.nsMsgSearchOp.Contains];
  },
  match: function subject_match(aMsgHdr, aSearchValue, aSearchOp) {
    return (aMsgHdr.subject.indexOf(aSearchValue) != -1);
  },
  needsBody: false,
};

let filterService = Cc["@mozilla.org/messenger/services/filters;1"]
                      .getService(Ci.nsIMsgFilterService);
filterService.addCustomTerm(gCustomSearchTermSubject);

/**
 * Make sure we open a virtual folder backed by a single underlying folder
 *  correctly, with a custom search term.
 */
function test_virtual_folder_single_load_custom_pred() {
  let viewWrapper = make_view_wrapper();

  let [folderOne, oneSubjFoo, oneNopers] = make_folder_with_sets([
    {subject: "foo"}, {}]);

  yield wait_for_message_injection();

  let virtFolder = make_virtual_folder(folderOne,
                                       {custom: "foo"});

  yield async_view_open(viewWrapper, virtFolder);

  verify_messages_in_view(oneSubjFoo, viewWrapper);
}

var tests = [
  test_virtual_folder_single_load_custom_pred,
];

function run_test() {
  async_run_tests(tests);
}
