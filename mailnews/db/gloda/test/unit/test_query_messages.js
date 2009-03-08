/* This file tests our querying support.
 */

do_import_script("../mailnews/db/gloda/test/resources/messageGenerator.js");
do_import_script("../mailnews/db/gloda/test/resources/glodaTestHelper.js");

// Create a message generator
var msgGen = new MessageGenerator();
// Create a message scenario generator using that message generator
var scenarios = new MessageScenarioFactory(msgGen);

/* ===== Populate ===== */
var world = {
  phase: 0,
    
  peoples: null,
  NUM_AUTHORS: 5,
  authorGroups: {},
  
  NUM_CONVERSATIONS: 3,
  lastMessagesInConvos: [],
  conversationGroups: {},
  conversationLists: [],
  glodaConversationIds: [],
  
  NUM_FOLDERS: 2,
  MESSAGES_PER_FOLDER: 11,
  folderClumps: [],
  folderGroups: {},
  glodaFolders: [],
  
  outlierAuthor: null,
  outlierFriend: null,
  outliers: [],
  
  peoplesMessages: [],
  outlierMessages: []
};

/**
 * Categorize a synthetic message by conversation/folder/people in the 'world'
 *  structure.  This is then used by the test code to generate and verify query
 *  data.
 *
 * @param aSynthMessage The synthetic message.
 */
function categorizeMessage(aSynthMessage) {
  // lump by author
  let author = aSynthMessage.fromAddress;
  if (!(author in world.authorGroups))
    world.authorGroups[author] = [];
  world.authorGroups[author].push(aSynthMessage);
  
  // lump by conversation, keying off of the originator's message id
  let originator = aSynthMessage;
  while (originator.parent) {
    originator = originator.parent;
  }
  if (!(originator.messageId in world.conversationGroups))
    world.conversationGroups[originator.messageId] = [];
  world.conversationGroups[originator.messageId].push(aSynthMessage);
  world.conversationLists[aSynthMessage.iConvo].push(aSynthMessage);
  
  // folder lumping happens in a big glob
}

/**
 * Generate messages in a single folder, categorizing them as we go.
 */
function generateFolderMessages() {
  let messages = [];
  
  let iAuthor = 0;
  for (let iMessage = 0; iMessage < world.MESSAGES_PER_FOLDER; iMessage++) {
    let iConvo = iMessage % world.NUM_CONVERSATIONS;
    let smsg = msgGen.makeMessage({
      inReplyTo: world.lastMessagesInConvos[iConvo]
    });
    // we need missing messages to create ghosts, so periodically add an extra
    //  unknown into the equation
    if ((iMessage % 3) == 0)
      smsg = msgGen.makeMessage({inReplyTo: smsg});
    
    // makeMessage is not exceedingly clever right now, we need to overwrite
    //  From and To...
    smsg.from = world.peoples[iAuthor];
    iAuthor = (iAuthor + iConvo + 1) % world.NUM_AUTHORS;
    // so, everyone is talking to everyone for this stuff
    smsg.to = world.peoples;
    world.lastMessagesInConvos[iConvo] = smsg;
    // simplify categorizeMessage and glodaInfoStasher's life
    smsg.iConvo = iConvo;
    
    categorizeMessage(smsg);
    messages.push(smsg);
    world.peoplesMessages.push(smsg);
  }
  
  smsg = msgGen.makeMessage();
  smsg.from = world.outlierAuthor;
  smsg.to = [world.outlierFriend];
  // do not lump it
  messages.push(smsg);
  world.outlierMessages.push(smsg);
  
  world.folderClumps.push(messages);
  
  return messages;
}

/** 
 * To save ourselves some lookup trouble, pretend to be a verification
 *  function so we get easy access to the gloda translations of the messages so
 *  we can cram this in various places. 
 */
function glodaInfoStasher(aSynthMessage, aGlodaMessage) {
  if (aSynthMessage.iConvo !== undefined)
    world.glodaConversationIds[aSynthMessage.iConvo] =
      aGlodaMessage.conversation.id;
  if (world.glodaFolders.length <= world.phase)
    world.glodaFolders.push(aGlodaMessage.folder);
}

// first, we must populate our message store with delicious messages.
function setup_populate() {
  world.glodaHolderCollection = Gloda.explicitCollection(Gloda.NOUN_MESSAGE,
    []);
  
  world.peoples = msgGen.makeNamesAndAddresses(world.NUM_AUTHORS);
  world.outlierAuthor = msgGen.makeNameAndAddress();
  world.outlierFriend = msgGen.makeNameAndAddress();
  for (let iConvo = 0; iConvo < world.NUM_CONVERSATIONS; iConvo++) {
    world.lastMessagesInConvos.push(null);
    world.conversationLists.push([]);
    world.glodaConversationIds.push(null);
  }
  
  indexMessages(generateFolderMessages(), glodaInfoStasher,
                setup_populate_phase_two);
}

function setup_populate_phase_two() {
  world.phase++;
  indexMessages(generateFolderMessages(), glodaInfoStasher, next_test);
}

/* ===== Non-text queries ===== */

/* === messages === */

/**
 * Takes a list of mutually exclusive queries and a list of the resulting
 *  collections and ensures that the collections from one query do not pass the
 *  query.test() method of one of the other queries.  To restate, the queries
 *  must not have any overlapping results, or we will get angry without
 *  justification. 
 */
function verify_nonMatches(aQueries, aCollections) {
  for (let i = 0; i < aCollections.length; i++) {
    let testQuery = aQueries[i];
    let nonmatches =
      aCollections[(i+1) % aCollections.length].items;
    
    for each (let [, item] in Iterator(nonmatches)) {
      if (testQuery.test(item)) {
        ddumpObject(item, "item", 0);
        ddumpObject(testQuery._constraints, "constraints", 2);
        do_throw("Something should not match query.test(), but it does: " +
                 item);
      }
    }
  }
}

var ts_convNum = 0;
var ts_convQueries = [];
var ts_convCollections = [];
function test_query_messages_by_conversation() {
  let convNum = ts_convNum++;
  let query = Gloda.newQuery(Gloda.NOUN_MESSAGE);
  query.conversation(world.glodaConversationIds[convNum]);
  
  ts_convQueries.push(query);
  ts_convCollections.push(queryExpect(query, world.conversationLists[convNum]));
  // queryExpect calls next_test
}

function test_query_messages_by_conversation_nonmatches() {
  verify_nonMatches(ts_convQueries, ts_convCollections);
  next_test();
}

var ts_folderNum = 0;
var ts_folderQueries = [];
var ts_folderCollections = [];
function test_query_messages_by_folder() {
  let folderNum = ts_folderNum++;
  let query = Gloda.newQuery(Gloda.NOUN_MESSAGE);
  query.folder(world.glodaFolders[folderNum]);
  
  ts_folderQueries.push(query);
  ts_folderCollections.push(queryExpect(query, world.folderClumps[folderNum]));
  // queryExpect calls next_test
}

function test_query_messages_by_folder_nonmatches() {
  verify_nonMatches(ts_folderQueries, ts_folderCollections);
  next_test();
}

/**
 * @tests Gloda.getMessageCollectionForHeader
 */
function test_get_message_for_header() {
  // pick an arbitrary message
  let glodaMessage = ts_convCollections[1].items[0];
  // find the synthetic message that matches (ordering must not be assumed)
  let synthMessage = [sm for each (sm in world.conversationLists[1])
                      if (sm.messageId == glodaMessage.headerMessageID)][0];
  queryExpect({queryFunc: Gloda.getMessageCollectionForHeader,
               queryThis: Gloda,
               args: [glodaMessage.folderMessage], nounId: Gloda.NOUN_MESSAGE},
              [synthMessage]);
  // queryExpect calls next_test
}

/**
 * @tests Gloda.getMessageCollectionForHeaders
 */
function test_get_messages_for_headers() {
  let messageCollection = ts_convCollections[0];
  let headers = [m.folderMessage for each (m in messageCollection.items)];
  queryExpect({queryFunc: Gloda.getMessageCollectionForHeaders,
               queryThis: Gloda,
               args: [headers], nounId: Gloda.NOUN_MESSAGE},
              world.conversationLists[0]);
  // queryExpect calls next_test
}

// at this point we go run the identity and contact tests for side-effects

var ts_messageIdentityQueries = [];
var ts_messageIdentityCollections = [];
function test_query_messages_by_identity_peoples() {
  let query = Gloda.newQuery(Gloda.NOUN_MESSAGE);
  query.involves(peoplesIdentityCollection.items[0]);
  
  ts_messageIdentityQueries.push(query);
  ts_messageIdentityCollections.push(queryExpect(query, world.peoplesMessages));
  // queryExpect calls next_test
}

function test_query_messages_by_identity_outlier() {
  let query = Gloda.newQuery(Gloda.NOUN_MESSAGE);
  query.involves(outlierIdentityCollection.items[0]);
  // this also tests our ability to have two intersecting constraints! hooray!
  query.involves(outlierIdentityCollection.items[1]);
  
  ts_messageIdentityQueries.push(query);
  ts_messageIdentityCollections.push(queryExpect(query, world.outlierMessages));
  // queryExpect calls next_test
}

function test_query_messages_by_identity_nonmatches() {
  verify_nonMatches(ts_messageIdentityQueries, ts_messageIdentityCollections);
  next_test();
}

function test_query_messages_by_contact() {
  // IOU
  next_test();
}

var ts_messagesDateQuery;
function test_query_messages_by_date() {
  ts_messagesDateQuery = Gloda.newQuery(Gloda.NOUN_MESSAGE);
  // we are clearly relying on knowing the generation sequence here,
  //  fuggedaboutit
  ts_messagesDateQuery.dateRange([world.peoplesMessages[1].date,
                                  world.peoplesMessages[2].date]);
  queryExpect(ts_messagesDateQuery, world.peoplesMessages.slice(1, 3));
}

function test_query_messages_by_date_nonmatches() {
  if (ts_messagesDateQuery.test(world.peoplesMessages[0]) ||
      ts_messagesDateQuery.test(world.peoplesMessages[3])) {
    do_throw("The date testing mechanism is busted.");
  }
  next_test();
}


/* === contacts === */
function test_query_contacts_by_popularity() {
  // IOU
  next_test();
}

/* === identities === */

/* ===== Text-based queries ===== */

/* === conversations === */

function test_query_conversations_by_subject_text() {
  // IOU
  next_test();
}

/* === messages === */

function test_query_messages_by_body_text() {
  // IOU
  next_test();
}

/* === contacts === */

var contactLikeQuery;
function test_query_contacts_by_name() {
  // let's use like... we need to test that...
  contactLikeQuery = Gloda.newQuery(Gloda.NOUN_CONTACT);
  let personName = world.peoples[0][0];
  // chop off the first and last letter...  this isn't the most edge-case
  //  handling way to roll, but LOOK OVER THERE? IS THAT ELVIS?
  let personNameSubstring = personName.substring(1, personName.length-1);
  contactLikeQuery.nameLike(contactLikeQuery.WILD, personNameSubstring,
                            contactLikeQuery.WILD);
  
  queryExpect(contactLikeQuery, [personName]);
}

function test_query_contacts_by_name_nonmatch() {
  let otherContact = outlierIdentityCollection.items[0].contact;
  if (contactLikeQuery.test(otherContact)) {
    do_throw("The string LIKE mechanism as applied to contacts does not work.");
  }
  next_test();
}

/* === identities === */

var peoplesIdentityQuery;
var peoplesIdentityCollection;
function test_query_identities_for_peoples() {
  peoplesIdentityQuery = Gloda.newQuery(Gloda.NOUN_IDENTITY);
  peoplesIdentityQuery.kind("email");
  let peopleAddrs = [nameAndAddr[1] for each (nameAndAddr in world.peoples)];
  peoplesIdentityQuery.value.apply(peoplesIdentityQuery, peopleAddrs);
  peoplesIdentityCollection = queryExpect(peoplesIdentityQuery, peopleAddrs);
}

var outlierIdentityQuery;
var outlierIdentityCollection;
function test_query_identities_for_outliers() {
  outlierIdentityQuery = Gloda.newQuery(Gloda.NOUN_IDENTITY);
  outlierIdentityQuery.kind("email");
  let outlierAddrs = [world.outlierAuthor[1], world.outlierFriend[1]];
  outlierIdentityQuery.value.apply(outlierIdentityQuery, outlierAddrs);
  outlierIdentityCollection = queryExpect(outlierIdentityQuery, outlierAddrs);
}

function test_query_identities_by_kind_and_value_nonmatches() {
  verify_nonMatches([peoplesIdentityQuery, outlierIdentityQuery],
                    [peoplesIdentityCollection, outlierIdentityCollection]);
  next_test();
}


/* ===== Driver ===== */

var tests = [
  setup_populate,
  test_query_messages_by_conversation,
  test_query_messages_by_conversation,
  test_query_messages_by_conversation_nonmatches,
  test_query_messages_by_folder,
  test_query_messages_by_folder,
  test_query_messages_by_folder_nonmatches,
  test_get_message_for_header,
  test_get_messages_for_headers,
  // need to do the identity and contact lookups so we can have their results
  //  for the other message-related queries
  test_query_identities_for_peoples,
  test_query_identities_for_outliers,
  test_query_identities_by_kind_and_value_nonmatches,
  // back to messages!
  test_query_messages_by_identity_peoples,
  test_query_messages_by_identity_outlier,
  test_query_messages_by_identity_nonmatches,
  test_query_messages_by_date,
  test_query_messages_by_date_nonmatches,
  test_query_contacts_by_name,
  test_query_contacts_by_name_nonmatch
];

function run_test() {
  // use mbox injection so we get multiple folders...
  injectMessagesUsing(INJECT_MBOX);
  glodaHelperRunTests(tests);
}
