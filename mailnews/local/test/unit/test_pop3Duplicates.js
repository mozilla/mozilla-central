/**
 * The intent of this file is to test duplicate handling options
 * in the pop3 download code.
 */
load("../../../resources/POP3pump.js");
Components.utils.import("resource://gre/modules/Services.jsm");

var testSubjects = ["[Bug 397009] A filter will let me tag, but not untag",
                    "Hello, did you receive my bugmail?"];

function run_test()
{
  // Set duplicate action to be delete duplicates.
  Services.prefs.setIntPref("mail.server.default.dup_action",
                            Ci.nsIMsgIncomingServer.deleteDups);
  // add 3 messages, 2 of which are duplicates.
  gPOP3Pump.files = ["../../../data/bugmail1",
                     "../../../data/draft1",
                     "../../../data/bugmail1"];
  gPOP3Pump.onDone = continueTest;
  do_test_pending();
  gPOP3Pump.run();
}

function continueTest()
{
  // get message headers for the inbox folder
  let enumerator = localAccountUtils.inboxFolder.msgDatabase.EnumerateMessages();
  var msgCount = 0;
  while (enumerator.hasMoreElements())
  {
    let hdr = enumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr);
    do_check_eq(hdr.subject, testSubjects[msgCount++]);
  }
  do_check_eq(msgCount, 2);
  gPOP3Pump = null;
  do_test_finished();
}
