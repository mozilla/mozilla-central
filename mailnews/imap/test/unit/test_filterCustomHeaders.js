/*
 * This file tests hdr parsing in the filter running context, specifically
 * filters on custom headers.
 * See https://bugzilla.mozilla.org/show_bug.cgi?id=655578
 * for more info.
 *
 * Original author: David Bienvenu <bienvenu@mozilla.com>
 */

Components.utils.import("resource://gre/modules/Services.jsm");
load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");

// IMAP pump

setupIMAPPump();

// Definition of tests

var tests = [
  setupTest,
  checkFilterResults,
  endTest
]

function run_test()
{

  // Create a test filter.
  let filterList = IMAPPump.incomingServer.getFilterList(null);
  let filter = filterList.createFilter("test list-id");
  let searchTerm = filter.createTerm();
  searchTerm.attrib = Ci.nsMsgSearchAttrib.OtherHeader + 1;
  searchTerm.op = Ci.nsMsgSearchOp.Contains;
  let value = searchTerm.value;
  value.attrib = Ci.nsMsgSearchAttrib.OtherHeader;
  value.str = "gnupg-users.gnupg.org";
  searchTerm.value = value;
  searchTerm.booleanAnd = false;
  searchTerm.arbitraryHeader = "List-Id";
  filter.appendTerm(searchTerm);
  filter.enabled = true;

  // create a mark read action
  let action = filter.createAction();
  action.type = Ci.nsMsgFilterAction.MarkRead;
  filter.appendAction(action);
  filterList.insertFilterAt(0, filter);

  async_run_tests(tests);
}

function setupTest() {
  Services.prefs.setBoolPref("mail.server.default.autosync_offline_stores", false);
  let file = do_get_file("../../../data/bugmail19");
  let msgfileuri = Services.io.newFileURI(file).QueryInterface(Ci.nsIFileURL);

  IMAPPump.mailbox.addMessage(new imapMessage(msgfileuri.spec,
                                          IMAPPump.mailbox.uidnext++, []));
  IMAPPump.inbox.updateFolderWithListener(null, asyncUrlListener);
  yield false;
}

function checkFilterResults() {
  let msgHdr = mailTestUtils.firstMsgHdr(IMAPPump.inbox);
  do_check_true(msgHdr.isRead);
  yield true;
}

// Cleanup
function endTest() {
  IMAPPump.server.performTest("UID STORE");
  teardownIMAPPump();
}
