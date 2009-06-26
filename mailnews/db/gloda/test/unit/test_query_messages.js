/*
 * This file tests our querying support.  We build up a deterministic little
 *  'world' of messages spread across multiple conversations, multiple folders
 *  and multiple authors.  To verify expected negative results, in addition to
 *  the 'peoples' in our world clique, we also have 'outlier' contacts that do
 *  not communicate with the others (but are also spread across folders).
 *
 * This is broadly intended to test all of our query features and mechanisms
 *  (apart from our specialized search implementation, which is tested by
 *  test_search_messages.js), but is probably not the place to test specific
 *  edge-cases if they do not easily fit into the 'world' data set.
 *
 * I feel like having the 'world' mishmash as a data source may muddle things
 *  more than it should, but it is hard to deny the benefit of not having to
 *  define a bunch of message corpuses entirely specialized for each test.
 */

load("../../mailnews/resources/messageGenerator.js");
load("resources/glodaTestHelper.js");

// Create a message generator
var msgGen = new MessageGenerator();
// Create a message scenario generator using that message generator
var scenarios = new MessageScenarioFactory(msgGen);

/* ===== Populate ===== */
var world = {
  phase: 0,

  // a list of tuples of [name, email] of length NUM_AUTHORS
  peoples: null,
  NUM_AUTHORS: 5,
  // maps each author (as defined by their email address) to the list of
  //  (synthetic) messages they have 'authored'
  authorGroups: {},

  NUM_CONVERSATIONS: 3,
  // the last message (so far) in each conversation
  lastMessagesInConvos: [],
  // maps the message-id of the root message in a conversation to the list of
  //  synthetic messages in the conversation
  conversationGroups: {},
  // a list of lists of synthetic messages, organized by the conversation they
  //  belong to.
  conversationLists: [],
  // a list of gloda conversation id's, each corresponding to the entries in
  // converastionLists.
  glodaConversationIds: [],

  NUM_FOLDERS: 2,
  MESSAGES_PER_FOLDER: 11,
  // a list of lists of synthetic messages, one list per folder
  folderClumps: [],
  // a list of nsIMsgFolders, with each folder containing the messages in the
  //  corresponding list in folderClumps
  glodaFolders: [],

  outlierAuthor: null,
  outlierFriend: null,

  // messages authored by contacts in the "peoples" group
  peoplesMessages: [],
  // messages authored by outlierAuthor and outlierFriend
  outlierMessages: []
};

/**
 * Given a number, provide a unique term.  This is for the benefit of the search
 *  logic.  This entails using a unique prefix to avoid accidental collision
 *  with terms outside our control and then just generating unique character
 *  strings in a vaguely base-26 style.  To avoid the porter stemmer causing odd
 *  things to happen we actually double every numerically driven character.
 */
function uniqueTermGenerator(aNum) {
  let s = 'uniq';
  do {
    let l = String.fromCharCode(97 + (aNum % 26));
    s += l + l;
    aNum = Math.floor(aNum / 26);
  }
  while(aNum)
  return s;
}

const UNIQUE_OFFSET_CONV = 0;
const UNIQUE_OFFSET_AUTHOR = 26;
const UNIQUE_OFFSET_BODY = 0;
const UNIQUE_OFFSET_SUBJECT = 26 * 26;
const UNIQUE_OFFSET_ATTACHMENT = 26 * 26 * 26;

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
 *
 * Key message characteristics:
 * - Whenever a 'peoples' sends a message, they send it to all 'peoples',
 *   including themselves.
 */
function generateFolderMessages() {
  let messages = [], smsg;

  let iAuthor = 0;
  for (let iMessage = 0; iMessage < world.MESSAGES_PER_FOLDER; iMessage++) {
    let iConvo = iMessage % world.NUM_CONVERSATIONS;

    // we need missing messages to create ghosts, so periodically add an extra
    //  unknown into the equation.  we do this prior to the below step because
    //  then we don't hose up all the fancy body creation the next step does
    if ((iMessage % 3) == 1)
      smsg = msgGen.makeMessage({inReplyTo: smsg});

    let convUniqueSubject = uniqueTermGenerator(
      UNIQUE_OFFSET_SUBJECT + UNIQUE_OFFSET_CONV + iConvo);
    let convUniqueBody = uniqueTermGenerator(
      UNIQUE_OFFSET_BODY + UNIQUE_OFFSET_CONV + iConvo);
    let authorUniqueBody = uniqueTermGenerator(
      UNIQUE_OFFSET_BODY + UNIQUE_OFFSET_AUTHOR + iAuthor);
    let convUniqueAttachment = uniqueTermGenerator(
      UNIQUE_OFFSET_ATTACHMENT + UNIQUE_OFFSET_CONV + iConvo);
    smsg = msgGen.makeMessage({
      inReplyTo: world.lastMessagesInConvos[iConvo],
      // note that the reply-logic will ignore our subject, luckily that does
      //  not matter! (since it will just copy the subject)
      subject: convUniqueSubject,
      body: {
        body: convUniqueBody + " " + authorUniqueBody,
      },
      attachments: [
        {
          filename: convUniqueAttachment + '.conv',
          body: 'content does not matter. only life matters.',
          contentType: 'application/x-test',
        }
      ],
    });


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
  // set up the per-conversation values with blanks initially
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
/* preserved state for the non-match testing performed by
 *  test_query_messages_by_conversation_nonmatches.
 */
var ts_convQueries = [];
var ts_convCollections = [];
/**
 * Query conversations by gloda conversation-id, saving the queries and
 *  resulting collections in ts_convQueries and ts_convCollections for the
 *  use of test_query_messages_by_conversation_nonmatches who verifies the
 *  query.test() logic doesn't match on things it should not match on.
 *
 * @tests gloda.noun.message.attr.conversation
 * @tests gloda.datastore.sqlgen.kConstraintIn
 */
function test_query_messages_by_conversation() {
  let convNum = ts_convNum++;
  let query = Gloda.newQuery(Gloda.NOUN_MESSAGE);
  query.conversation(world.glodaConversationIds[convNum]);

  ts_convQueries.push(query);
  ts_convCollections.push(queryExpect(query, world.conversationLists[convNum]));
  // queryExpect calls next_test
}

/**
 * @tests gloda.query.test.kConstraintIn
 */
function test_query_messages_by_conversation_nonmatches() {
  verify_nonMatches(ts_convQueries, ts_convCollections);
  next_test();
}

var ts_folderNum = 0;
var ts_folderQueries = [];
var ts_folderCollections = [];
/**
 * @tests gloda.noun.message.attr.folder
 * @tests gloda.datastore.sqlgen.kConstraintIn
 */
function test_query_messages_by_folder() {
  let folderNum = ts_folderNum++;
  let query = Gloda.newQuery(Gloda.NOUN_MESSAGE);
  query.folder(world.glodaFolders[folderNum]);

  ts_folderQueries.push(query);
  ts_folderCollections.push(queryExpect(query, world.folderClumps[folderNum]));
  // queryExpect calls next_test
}

/**
 * @tests gloda.query.test.kConstraintIn
 */
function test_query_messages_by_folder_nonmatches() {
  verify_nonMatches(ts_folderQueries, ts_folderCollections);
  next_test();
}

/**
 * @tests Gloda.ns.getMessageCollectionForHeader()
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
 * @tests Gloda.ns.getMessageCollectionForHeaders()
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
/**
 * @tests gloda.noun.message.attr.involves
 * @tests gloda.datastore.sqlgen.kConstraintIn
 */
function test_query_messages_by_identity_peoples() {
  let query = Gloda.newQuery(Gloda.NOUN_MESSAGE);
  query.involves(peoplesIdentityCollection.items[0]);

  ts_messageIdentityQueries.push(query);
  ts_messageIdentityCollections.push(queryExpect(query, world.peoplesMessages));
  // queryExpect calls next_test
}

/**
 * @tests gloda.noun.message.attr.involves
 */
function test_query_messages_by_identity_outlier() {
  let query = Gloda.newQuery(Gloda.NOUN_MESSAGE);
  query.involves(outlierIdentityCollection.items[0]);
  // this also tests our ability to have two intersecting constraints! hooray!
  query.involves(outlierIdentityCollection.items[1]);

  ts_messageIdentityQueries.push(query);
  ts_messageIdentityCollections.push(queryExpect(query, world.outlierMessages));
  // queryExpect calls next_test
}

/**
 * @tests gloda.query.test.kConstraintIn
 */
function test_query_messages_by_identity_nonmatches() {
  verify_nonMatches(ts_messageIdentityQueries, ts_messageIdentityCollections);
  next_test();
}

function test_query_messages_by_contact() {
  // IOU
  next_test();
}

var ts_messagesDateQuery;
/**
 * @tests gloda.noun.message.attr.date
 * @tests gloda.datastore.sqlgen.kConstraintRanges
 */
function test_query_messages_by_date() {
  ts_messagesDateQuery = Gloda.newQuery(Gloda.NOUN_MESSAGE);
  // we are clearly relying on knowing the generation sequence here,
  //  fuggedaboutit
  ts_messagesDateQuery.dateRange([world.peoplesMessages[1].date,
                                  world.peoplesMessages[2].date]);
  queryExpect(ts_messagesDateQuery, world.peoplesMessages.slice(1, 3));
}

/**
 * @tests gloda.query.test.kConstraintRanges
 */
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
  next_test();
}

/* === messages === */

/**
 * Test subject searching using the conversation unique subject term.
 *
 * @tests gloda.noun.message.attr.subjectMatches
 * @tests gloda.datastore.sqlgen.kConstraintFulltext
 */
function test_query_messages_by_subject_text() {
  // we only need to use one conversation
  let convNum = 0;
dump("convNum: " + convNum + " blah: " + world.conversationLists[convNum] + "\n");
  let query = Gloda.newQuery(Gloda.NOUN_MESSAGE);
  let convSubjectTerm = uniqueTermGenerator(
    UNIQUE_OFFSET_SUBJECT + UNIQUE_OFFSET_CONV + convNum);
  query.subjectMatches(convSubjectTerm);
  queryExpect(query, world.conversationLists[convNum]); // calls next_test
}

/**
 * Test body searching using the conversation unique body term.
 *
 * @tests gloda.noun.message.attr.bodyMatches
 * @tests gloda.datastore.sqlgen.kConstraintFulltext
 */
function test_query_messages_by_body_text() {
  // we only need to use one conversation
  let convNum = 0;
  let query = Gloda.newQuery(Gloda.NOUN_MESSAGE);
  let convBodyTerm = uniqueTermGenerator(
    UNIQUE_OFFSET_BODY + UNIQUE_OFFSET_CONV + convNum);
  query.bodyMatches(convBodyTerm);
  queryExpect(query, world.conversationLists[convNum]); // calls next_test
}

/**
 * Test attachment name searching using the conversation unique attachment term.
 *
 * @tests gloda.noun.message.attr.attachmentNamesMatch
 * @tests gloda.datastore.sqlgen.kConstraintFulltext
 */
function test_query_messages_by_attachment_names() {
  let convNum = 0;
  let query = Gloda.newQuery(Gloda.NOUN_MESSAGE);
  let convUniqueAttachment = uniqueTermGenerator(
    UNIQUE_OFFSET_ATTACHMENT + UNIQUE_OFFSET_CONV + convNum);
  query.attachmentNamesMatch(convUniqueAttachment);
  queryExpect(query, world.conversationLists[convNum]); // calls next_test
}

/**
 * Test author name fulltext searching using an arbitrary author.
 *
 * @tests gloda.noun.message.attr.authorMatches
 * @tests gloda.datastore.sqlgen.kConstraintFulltext
 */
function test_query_messages_by_authorMatches_name() {
  let [authorName, authorMail] = world.peoples[0];
  let query = Gloda.newQuery(Gloda.NOUN_MESSAGE);
  query.authorMatches(authorName);
  queryExpect(query, world.authorGroups[authorMail]); // calls next_test
}

/**
 * Test author mail address fulltext searching using an arbitrary author.
 *
 * @tests gloda.noun.message.attr.authorMatches
 * @tests gloda.datastore.sqlgen.kConstraintFulltext
 */
function test_query_messages_by_authorMatches_email() {
  let [authorName, authorMail] = world.peoples[0];
  let query = Gloda.newQuery(Gloda.NOUN_MESSAGE);
  query.authorMatches(authorMail);
  queryExpect(query, world.authorGroups[authorMail]); // calls next_test
}

/**
 * Test recipient name fulltext searching using an arbitrary recipient. Since
 *  all 'peoples' messages are sent to all of them, any choice from peoples
 *  gets us all 'peoplesMessages'.
 *
 * @tests gloda.noun.message.attr.recipientsMatch
 * @tests gloda.datastore.sqlgen.kConstraintFulltext
 */
function test_query_messages_by_recipients_name() {
  let [name,] = world.peoples[0];
  let query = Gloda.newQuery(Gloda.NOUN_MESSAGE);
  query.recipientsMatch(name);
  queryExpect(query, world.peoplesMessages); // calls next_test
}

/**
 * Test recipient mail fulltext searching using an arbitrary recipient. Since
 *  all 'peoples' messages are sent to all of them, any choice from peoples
 *  gets us all 'peoplesMessages'.
 *
 * @tests gloda.noun.message.attr.recipientsMatch
 * @tests gloda.datastore.sqlgen.kConstraintFulltext
 */
function test_query_messages_by_recipients_email() {
  let [, mail] = world.peoples[0];
  let query = Gloda.newQuery(Gloda.NOUN_MESSAGE);
  query.recipientsMatch(mail);
  queryExpect(query, world.peoplesMessages); // calls next_test
}

/* === contacts === */

var contactLikeQuery;
/**
 * @tests gloda.noun.contact.attr.name
 * @tests gloda.datastore.sqlgen.kConstraintStringLike
 */
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

/**
 * @tests gloda.query.test.kConstraintStringLike
 */
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
  // fulltext
  test_query_messages_by_subject_text,
  test_query_messages_by_body_text,
  test_query_messages_by_attachment_names,
  test_query_messages_by_authorMatches_name,
  test_query_messages_by_authorMatches_email,
  test_query_messages_by_recipients_name,
  test_query_messages_by_recipients_email,
  // like
  test_query_contacts_by_name,
  test_query_contacts_by_name_nonmatch
];

function run_test() {
  // use mbox injection so we get multiple folders...
  injectMessagesUsing(INJECT_MBOX);
  glodaHelperRunTests(tests);
}
