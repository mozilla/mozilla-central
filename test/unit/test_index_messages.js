
/**
 * Given a function that generates a set of synthetic messages, feed those
 *  messages to gloda to be indexed, verifying the resulting indexed messages
 *  have the desired properties by calling the provided verification function.
 * This process is executed once for each possible permutation of observation
 *  of the synthetic messages.
 */
function indexAndVerify() {
  
}

function allMessageInSameConversation() {
  
}

/**
 * Test our conversation/threading logic.
 */
function test_threading() {
  indexAndVerify(scenarios.directReply, allMessageInSameConversation);
  indexAndVerify(scenarios.missingIntermediary, allMessageInSameConversation);
  indexAndVerify(scenarios.siblingsMissingParent, allMessageInSameConversation);
}

function test_attributes_fundamental() {
  // create a synthetic message
  let smsg = msgGen.newMessage(); // synthetic message
  let gmsg = index(sm); // gloda message
  
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

function run_test() {
  loadLocalMailAccount();
  
  test_threading();
  test_attributes_fundamental();
}
