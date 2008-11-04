/* This file tests our querying support, including full-text search.
 */

do_import_script("../mailnews/db/global/test/resources/messageGenerator.js");

//these are imported by glodaTestHelper's import of head_maillocal
// do_import_script("../mailnews/test/resources/mailDirService.js");
// do_import_script("../mailnews/test/resources/mailTestUtils.js");
do_import_script("../mailnews/db/global/test/resources/glodaTestHelper.js");

// Create a message generator
var msgGen = new MessageGenerator();
// Create a message scenario generator using that message generator
var scenarios = new MessageScenarioFactory(msgGen);

/* ===== Non-text queries ===== */

/* === messages === */

function test_query_messages_by_conversation() {
}

function test_query_messages_by_folder() {
}

function test_query_messages_by_identity() {
}

function test_query_messages_by_contact() {
}

function test_query_messages_by_date() {
}

/* === contacts === */
function test_query_contacts_by_popularity() {
}

/* === identities === */

/* ===== Text-based queries ===== */

/* === conversations === */

function test_query_conversations_by_subject_text() {
}

/* === messages === */

function test_query_messages_by_body_text() {
}

/* === contacts === */

function test_query_contacts_by_name() {
}

/* === identities === */

function test_query_identities_by_kind_and_value() {
}

/* ===== Driver ===== */

function run_test() {
}
