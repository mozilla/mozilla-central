do_import_script("../mailnews/db/global/test/resources/messageGenerator.js");

do_import_script("../mailnews/test/resources/mailDirService.js");
do_import_script("../mailnews/test/resources/mailTestUtils.js");
do_import_script("../mailnews/db/global/test/resources/glodaTestHelper.js");

// Create a message generator
var msgGen = new MessageGenerator();
// Create a message scenario generator using that message generator
var scenarios = new MessageScenarioFactory(msgGen);

function allMessageInSameConversation(aSynthMessage, aGlodaMessage, aConvID) {
  if (aConvID === undefined)
    return aGlodaMessage.conversationID;
  do_check_eq(aConvID, aGlodaMessage.conversationID);
  return aConvID;
}

/**
 * Test our conversation/threading logic.
 */
function test_threading() {
  indexAndPermuteMessages(scenarios.directReply,
                          allMessageInSameConversation);
  indexAndPermuteMessages(scenarios.missingIntermediary,
                          allMessageInSameConversation);
  indexAndPermuteMessages(scenarios.siblingsMissingParent,
                          allMessageInSameConversation,
                          next_test);
}

function test_attributes_fundamental() {
  // create a synthetic message
  let smsg = msgGen.makeMessage();
  
  indexMessages([smsg], verify_attributes_fundamental, next_test);
}

function verify_attributes_fundamental(smsg, gmsg) {  
  // -- subject
  do_check_eq(smsg.subject, gmsg.conversation.subject);
  
  // -- contact/identity information
  // - from
  // check the e-mail address
  do_check_eq(smsg.fromAddress, gmsg.from.value);
  // check the name
  do_check_eq(smsg.fromName, gmsg.from.contact.name);
  
  // - to
  do_check_eq(smsg.toAddress, gmsg.to[0].value);
  do_check_eq(smsg.toName, gmsg.to[0].contact.name);
  
  // date
  do_check_eq(smsg.date.valueOf(), gmsg.date.valueOf());
}

function test_attributes_explicit() {
  // -- starred (flagged)
  // -- read/unread
  // -- tags (/label)
}

/**
 * Test our full-text searching support for messages.
 */
function test_message_fulltext() {
  
}

function test_iterator() {
  do_test_pending();

dump("calling test_threading\n");
  yield test_threading();
dump("back from test_threading yield\n");
  yield test_attributes_fundamental();
dump ("back from test_attributes_fundamental\n");
  
  killFakeServer();
  do_test_finished();
dump("!!!!!! TEST FINISHED!\n");
  
  // once the control flow hits the root after do_test_finished, we're done,
  //  so let's just yield something to avoid callers having to deal with an
  //  exception indicating completion.
  gTestIterator = null;
  yield null;
}

var gTestIterator = null;

function next_test() {
  gTestIterator.next();
}

function run_test() {
  gTestIterator = test_iterator();
  
  next_test();
}
