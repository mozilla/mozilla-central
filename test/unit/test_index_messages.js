do_import_script("../mailnews/base/test/resources/messageGenerator.js");

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
                          allMessageInSameConversation);
}

function test_attributes_fundamental() {
  // create a synthetic message
  let smsg = msgGen.newMessage();
  
  indexMessages([smsg], verify_attributes_fundamental);
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
  do_check_eq(smsg.toAddress, gmsg.to.value);
  do_check_eq(smsg.toName, gmsg.to.contact.name);
  
  // date
  do_check_eq(smsg.date, gmsg.date);
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

  yield test_threading();
  yield test_attributes_fundamental();
  
  do_test_finished();
  // once the control flow hits the root after do_test_finished, we're done,
  //  so let's just yield something to avoid callers having to deal with an
  //  exception indicating completion.
  yield null;
}

var gTestIterator = null;

function next_test() {
  gTestIterator.next();
}

function run_test() {
  gTestIterator = test_iterator();
  
  do_test_pending();
  next_test();
}
