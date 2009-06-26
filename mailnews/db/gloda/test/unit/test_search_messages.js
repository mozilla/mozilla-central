/*
 *
 */

load("../../mailnews/resources/messageGenerator.js");
load("resources/glodaTestHelper.js");

Components.utils.import("resource://app/modules/gloda/msg_search.js");

// Create a message generator
var msgGen = new MessageGenerator();
// Create a message scenario generator using that message generator
var scenarios = new MessageScenarioFactory(msgGen);

var synthMessagesByCategory = {};

var abFriends = null;

function makeCatSynMsg(aCategories, aSynArgs) {

}

/**
 *
 *
 *
 * Base requirements:
 * - Messages distributed over multiple folders.
 * - All messages must match our base query of "baz".
 *
 * Intended functionality corpus will be used to test:
 * - Subject as more important than body.
 * - Message attachment name as more important than body.
 * - Inclusion of all search terms not attributable to contacts is bonused.
 * - Involvement of self and contacts in the address book is tested.
 */
function setup_search_messages() {
  let meAddress = [Gloda.myContact.name, Gloda.myContact.identities[0].value];
  let abFriend1 = msgGen.makeNameAndAddress();
  let abFriend2 = msgGen.makeNameAndAddress();
  abFriends = [abFriend1, abFriend2];

  makeCatSynMsg(["from:me", "body"],
    {from: meAddress, subject: "blah", body: {body: "baz"}});
  makeCatSynMsg(["from:friend", "body"],
    {from: abFriend1, subject: "blah", body: {body: "baz"}});
  makeCatSynMsg(["from:me", "to:friend", "body"],
    {from: meAddress, to: [abFriend1], subject: "blah", body: {body: "baz"}});
  makeCatSynMsg(["from:friend", "to:friend", "body"],
    {from: abFriend1, to: [abFriend2], subject: "blah", body: {body: "baz"}});

  makeCatSynMsg(["subject"],
    {subject: "baz", body: {body: "blah"}});
  makeCatSynMsg(["subject", "body"],
    {subject: "baz", body: {body: "baz"}});
  makeCatSynMsg(["attachment"],
    {subject: "blah", body: {body: "blah"},
     attachments: [{filename: "baz.blah", body: "blah"}]});
}

var gSearcher;

function run_search() {
  gSearcher = new GlodaMsgSearcher();

}

/**
 * We have the following scoring heuristics for unfaceted search:
 * - Message Annotation Bonuses:
 *   - Starred Messages (Strong)
 *   - Tagged Messages (Weak; may be automated and represent boring things.)
 * - Message Interest Bonuses.  We don't track message interest yet.  Psych!
 * - Contact match bonus:
 *   - We found a limited set of cont
 *
 * Our general testing sequence is this:
 * - Create a bunch of messages and index them [setup_search_messages]
 * - Peform any desired mutations on those messages or the involved contacts
 *   (star/tag/etc.) [twiddle_search_messages]
 * - Issue our search query
 * - Re-score the results from the search query
 */
function verify_unfaceted_heuristics() {

}

function run_test() {
  
}