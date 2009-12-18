/**
 * The intent of this file is to demonstrate a minimal
 * POP3 unit test using the testing file POP3Pump.js
 */
load("../../mailnews/resources/POP3pump.js");

var testSubjects = ["[Bug 397009] A filter will let me tag, but not untag",
                    "Hello, did you receive my bugmail?"];

function run_test()
{
  // demonstration of access to the local inbox folder
  dump("local inbox folder " + gLocalInboxFolder.URI + " is loaded\n");
  // demonstration of access to the fake server
  dump("Server " + gPOP3Pump.fakeServer.prettyName + " is loaded\n");

  gPOP3Pump.files = ["../../mailnews/data/bugmail1",
                      "../../mailnews/data/draft1"];
  gPOP3Pump.onDone = continueTest;
  do_test_pending();
  gPOP3Pump.run();
}

function continueTest()
{
  // get message headers for the inbox folder
  let enumerator = gLocalInboxFolder.msgDatabase.EnumerateMessages();
  var msgCount = 0;
  while(enumerator.hasMoreElements())
  {
    msgCount++;
    let hdr = enumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr);
    do_check_eq(hdr.subject, testSubjects[msgCount - 1]);
  }
  do_check_eq(msgCount, 2);
  gPOP3Pump = null;
  do_test_finished();
}
