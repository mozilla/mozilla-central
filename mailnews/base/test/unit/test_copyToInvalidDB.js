/*
 * Simple tests for copying local messages to a folder whose db is missing
 * or invalid
 */

load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");

load("../../../resources/messageGenerator.js");
load("../../../resources/messageModifier.js");
load("../../../resources/messageInjection.js");

Components.utils.import("resource:///modules/mailServices.js");

var gMsg1;
var gMessages = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
var gCurTestNum;
var gMsgId1;

var gTestFolder, gTestFolder2;

function setup_globals(aNextFunc) {
  var messageGenerator = new MessageGenerator();
  gMsg1 = messageGenerator.makeMessage();
  let msg2 = messageGenerator.makeMessage({inReplyTo: gMsg1});

  let messages = [];
  messages = messages.concat([gMsg1, msg2]);
  let msgSet = new SyntheticMessageSet(messages);

  gTestFolder = make_empty_folder();
  gTestFolder2 = make_empty_folder();
  yield add_sets_to_folders(gTestFolder, [msgSet]);
  let msg3 = messageGenerator.makeMessage();
  messages = [msg3];
  msgSet = new SyntheticMessageSet(messages);
  yield add_sets_to_folders(gTestFolder2, [msgSet]);
}

function run_test() {
  configure_message_injection({mode: "local"});
  do_test_pending();
  async_run({func: actually_run_test});
}

function actually_run_test() {
  yield async_run({func: setup_globals});
  gTestFolder2.msgDatabase.summaryValid = false;
  gTestFolder2.msgDatabase = null;
  gTestFolder2.ForceDBClosed();
  let dbPath = gTestFolder2.filePath;
  dbPath.leafName = dbPath.leafName + ".msf";
  dbPath.remove(false);
  gTestFolder2.msgDatabase = null;

  let msgHdr = mailTestUtils.firstMsgHdr(gTestFolder);
  let messages = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
  gMsgId1 = msgHdr.messageId;
  messages.appendElement(msgHdr, false);
  MailServices.copy.CopyMessages(gTestFolder, messages, gTestFolder2, true,
                           asyncCopyListener, null, false);
  yield false;
  try {
    gTestFolder2.getDatabaseWithReparse(asyncUrlListener, null);
  } catch (ex) {
    do_check_true(ex.result == Cr.NS_ERROR_NOT_INITIALIZED);
  }
  yield false;
  let msgRestored = gTestFolder2.msgDatabase.getMsgHdrForMessageID(gMsgId1);
  let msg = mailTestUtils.loadMessageToString(gTestFolder2, msgRestored);
  do_check_eq(msg, gMsg1.toMboxString());
  do_test_finished();
}
