/*
 * Test indexing support for local messages.
 */

load("base_index_messages.js");

/**
 * Make sure that if we have to reparse a local folder we do not hang or
 *  anything.  (We had a regression where we would hang.)
 */
function test_reparse_of_local_folder_works() {
  // index a folder
  let [folder, msgSet] = make_folder_with_sets([{count: 1}]);
  yield wait_for_message_injection();
  yield wait_for_gloda_indexer(msgSet);

  // force a db flush so we do not have any outstanding references to the
  //  folder or its headers.
  yield wait_for_gloda_db_flush();

  // mark the summary invalid
  folder.msgDatabase.summaryValid = false;
  // clear the database so next time we have to reparse
  folder.msgDatabase.ForceClosed();

  // force gloda to re-parse the folder again...
  GlodaMsgIndexer.indexFolder(folder);
  yield wait_for_gloda_indexer();
}
tests.unshift(test_reparse_of_local_folder_works);

/**
 * Ensure that fromJSON for a non-singular attribute properly filters out
 *  "undefined" return values, specifically as it relates to tags.  When the
 *  user removes them Gloda doesn't actually re-index the messages so the
 *  values will still be there when we next load the message.
 *
 * We directly monkey with the state of NounTag for no really good reason, but
 *  maybe it cuts down on disk I/O because we don't have to touch prefs.
 */
function test_fromjson_of_removed_tag() {
  // -- inject
  let [folder, msgSet] = make_folder_with_sets([{count: 1}]);
  yield wait_for_message_injection();
  yield wait_for_gloda_indexer(msgSet, {augment: true});
  let gmsg = msgSet.glodaMessages[0];

  // -- tag
  let tag = TagNoun.getTag("$label4");
  msgSet.addTag(tag.key);
  yield wait_for_gloda_indexer(msgSet);
  do_check_eq(gmsg.tags.length, 1);
  do_check_eq(gmsg.tags[0].key, tag.key);

  // -- forget about the tag, TagNoun!
  delete TagNoun._tagMap[tag.key];
  // this also means we have to replace the tag service with a liar.
  let realTagService = TagNoun._msgTagService;
  TagNoun._msgTagService = {
    isValidKey: function() {return false;} // lies!
  };

  // -- forget about the message, gloda!
  let glodaId = gmsg.id;
  nukeGlodaCachesAndCollections();

  // -- re-load the message
  let query = Gloda.newQuery(Gloda.NOUN_MESSAGE);
  query.id(glodaId);
  let coll = queryExpect(query, msgSet);
  yield false; // queryExpect is async

  // -- put the tag back in TagNoun before we check and possibly explode
  TagNoun._tagMap[tag.key] = tag;
  TagNoun._msgTagService = realTagService;

  // -- verify the message apparently has no tags (despite no reindex)
  gmsg = coll.items[0];
  do_check_eq(gmsg.tags.length, 0);
}
tests.unshift(test_fromjson_of_removed_tag);

/**
 * Test that we are using hasOwnProperty or a properly guarding dict for
 *  NounTag so that if someone created a tag called "watch" and then deleted
 *  it, we don't end up exposing the watch function as the tag.
 *
 * Strictly speaking, this does not really belong here, but it's a matched set
 *  with the previous test.
 */
function test_nountag_does_not_think_it_has_watch_tag_when_it_does_not() {
  do_check_eq(TagNoun.fromJSON("watch"), undefined);
}
tests.unshift(test_nountag_does_not_think_it_has_watch_tag_when_it_does_not);

function run_test() {
  configure_message_injection({mode: "local"});
  glodaHelperRunTests(tests);
}
