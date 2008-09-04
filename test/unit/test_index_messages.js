/* This file tests our indexing prowess.  This includes both our ability to
 *  properly be triggered by events taking place in thunderbird as well as our
 *  ability to correctly extract/index the right data.
 * In general, if these tests pass, things are probably working quite well.
 */

/*
 * NOTE: This file currently has a bunch of helper logic that needs to be pushed
 *  into glodaTestHelper.js or someplace else nice.  (glodaTestHelper is also
 *  going to need some refactoring to be sane inside.)
 */

do_import_script("../mailnews/db/global/test/resources/messageGenerator.js");

do_import_script("../mailnews/test/resources/mailDirService.js");
do_import_script("../mailnews/test/resources/mailTestUtils.js");
do_import_script("../mailnews/db/global/test/resources/glodaTestHelper.js");

// Create a message generator
var msgGen = new MessageGenerator();
// Create a message scenario generator using that message generator
var scenarios = new MessageScenarioFactory(msgGen);

/* ===== Threading / Conversation Grouping ===== */

function allMessageInSameConversation(aSynthMessage, aGlodaMessage, aConvID) {
  if (aConvID === undefined)
    return aGlodaMessage.conversationID;
  do_check_eq(aConvID, aGlodaMessage.conversationID);
  return aConvID;
}

/**
 * Test our conversation/threading logic in the straight-forward direct
 *  reply case, the missing intermediary case, and the siblings with missing
 *  parent case.  We also test all permutations of receipt of those messages.
 * (Also tests that we index new messages.)
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

/* ===== Fundamental Attributes (per fundattr.js) ===== */

/**
 * Test that we extract the 'fundamental attributes' of a message properly
 *  'Fundamental' in this case is talking about the attributes defined/extracted
 *  by gloda's fundattr.js and perhaps the core message indexing logic itself
 *  (which show up as kSpecial* attributes in fundattr.js anyways.)
 */
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

/* ===== Explicit Attributes (per explattr.js) ===== */

function expl_attr_twiddle_star(aMsgHdr, aDesiredState) {
  aMsgHdr.markFlagged(aDesiredState);
}

function expl_attr_verify_star(smsg, gmsg, aExpectedState) {
  do_check_eq(gmsg.starred, aExpectedState);
}

function expl_attr_twiddle_read(aMsgHdr, aDesiredState) {
  aMsgHdr.markRead(!aMsgHdr.isRead);
}

function expl_attr_verify_read(smsg, gmsg, aExpectedState) {
  do_check_eq(gmsg.read, aExpectedState);
}

function expl_attr_twiddle_tags(aMsgHdr, aTagMods) {
  // TODO: twiddle tags
}

function expl_attr_verify_tags(smsg, gmsg, aExpectedTags) {
  // TODO: verify tags
}

var explicitAttributeTwiddlings = [
  // toggle starred
  [expl_attr_twiddle_star, expl_attr_verify_star, true],
  [expl_attr_twiddle_star, expl_attr_verify_star, false],
  // toggle read/unread
  [expl_attr_twiddle_read, expl_attr_verify_read, true],
  [expl_attr_twiddle_read, expl_attr_verify_read, false],
  // twiddle tags
  [expl_attr_twiddle_tags, expl_attr_verify_tags,
   [1, "funky"], ["funky"]],
  [expl_attr_twiddle_tags, expl_attr_verify_tags,
   [1, "town"], ["funky", "town"]],
  [expl_attr_twiddle_tags, expl_attr_verify_tags,
   [-1, "funky"], ["town"]],
  [expl_attr_twiddle_tags, expl_attr_verify_tags,
   [-1, "town"], []],
];


function test_attributes_explicit() {
  // create a synthetic message
  let smsg = msgGen.makeMessage();

  let iTwiddling = 0;
  function twiddle_next_attr(smsg, gmsg) {
    let curTwiddling = explicitAttributeTwiddlings[iTwiddling];
    let twiddleFunc = curTwiddling[0];
    let desiredState = curTwiddling[2];
    
    // the underlying nsIMsgDBHdr should exist at this point...
    do_check_neq(gmsg.folderMessage, null);
    // prepare 
    expectModifiedMessages([gmsg.folderMessage], verify_next_attr);
    // tell the function to perform its mutation to the desired state
    twiddleFunc(gmsg.folderMessage, desiredState);
  }
  function verify_next_attr(smsg, gmsg) {
    let curTwiddling = explicitAttributeTwiddlings[iTwiddling];
    let verifyFunc = curTwiddling[1];
    let expectedVal = curTwiddling[curTwiddling.length == 3 ? 2 : 3];
    verifyFunc(smsg, gmsg, expectedVal);
    
    iTwiddling++;
    if (iTwiddling < explicitAttributeTwiddlings.length)
      twiddle_next_attr();
    else
      next_test();
  }
  
  indexMessages([smsg], twiddle_next_attr);
}

/**
 * Test our full-text searching support for messages.
 */
function test_message_fulltext() {
  
}

var tests = [
  test_threading,
  test_attributes_fundamental,
  test_attributes_explicit,
];

function run_test() {
  glodaHelperRunTests(tests);
}
