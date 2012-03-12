/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Test migration logic by artificially inducing or simulating the problem, then
 *  trigger the migration logic, then verify things ended up correct, including
 *  the schema version so a second pass of the logic doesn't happen.  (As
 *  opposed to checking in an example of a broken database and running against
 *  that.)
 **/

load("resources/glodaTestHelper.js");

/**
 * Fix the fallout from bug 732372 (with this patch for bug 734507) which left
 *  identities whose e-mails were in the address book without contacts and then
 *  broke messages involving them.
 */
function test_fix_missing_contacts_and_fallout() {
  // -- setup

  // - Create 4 e-mail addresses, 2 of which are in the address book.  (We want
  //    to make sure we have to iterate, hence >1).
  let abPeeps = gMessageGenerator.makeNamesAndAddresses(2),
      nonAbPeeps = gMessageGenerator.makeNamesAndAddresses(2);
  makeABCardForAddressPair(abPeeps[0]);
  makeABCardForAddressPair(abPeeps[1]);

  // - Create messages of the genres [from, to]: [inAB, inAB], [inAB, !inAB],
  //    [!inAB, inAB], [!inAB, !inAB].  The permutations are black box overkill.
  // smear the messages over multiple folders for realism
  let [synFolders, yesyesMsgSet, yesnoMsgSet, noyesMsgSet, nonoMsgSet] =
    make_folders_with_sets(3, [
      { count: 2, from: abPeeps[0], to: [abPeeps[1]] },
      { count: 2, from: abPeeps[1], to: nonAbPeeps },
      { count: 2, from: nonAbPeeps[0], to: abPeeps },
      { count: 2, from: nonAbPeeps[1], to: [nonAbPeeps[0]] },
      ]);

  yield wait_for_message_injection();
  // union the yeses together; we don't care about their composition
  let yesMsgSet = yesyesMsgSet.union(yesnoMsgSet).union(noyesMsgSet),
      noMsgSet = nonoMsgSet;

  // - Let gloda index the messages so the identities get created.
  yield wait_for_gloda_indexer([yesMsgSet, noMsgSet], { augment: true });
  // the messages are now indexed and the contacts created

  // - Compel an indexing sweep so the folder's dirty statuses get cleared
  GlodaMsgIndexer.initialSweep();
  yield wait_for_gloda_indexer(); // (no new messages to index)

  // - Force a DB commit so the pending commit tracker gets emptied out
  // (otherwise we need to worry about its state overriding our clobbering)
  yield wait_for_gloda_db_flush();

  // - delete the contact records for the people in the address book.
  yield sqlRun("DELETE FROM contacts WHERE id IN (" +
               yesMsgSet.glodaMessages[0].from.contact.id + ", " +
               yesMsgSet.glodaMessages[0].to[0].contact.id + ")");

  // - Nuke the gloda caches so we totally forget those contact records.
  nukeGlodaCachesAndCollections();

  // - Manually mark the messages involving the inAB people with the _old_ bad
  //    id marker so that our scan will see them.
  for each (let msgHdr in yesMsgSet.msgHdrs) {
    msgHdr.setUint32Property("gloda-id", GLODA_OLD_BAD_MESSAGE_ID);
  }

  // - mark the db schema version to the version with the bug (26)
  // sanity check that gloda actually populates the value with the current
  //  version correctly...
  do_check_eq(GlodaDatastore._actualSchemaVersion,
              GlodaDatastore._schemaVersion);
  GlodaDatastore._actualSchemaVersion = 26;
  yield sqlRun("PRAGMA user_version = 26");
  // make sure that took, since we check it below as a success indicator.
  let verRows = yield sqlRun("PRAGMA user_version");
  do_check_eq(verRows[0].getInt64(0), 26);


  // -- test
  // - trigger the migration logic and request an indexing sweep
  GlodaMsgIndexer.disable();
  GlodaMsgIndexer.enable();
  GlodaMsgIndexer.initialSweep();

  // - wait for the indexer to complete, expecting that the messages that we
  //    marked bad will get indexed but not the good messages.
  yield wait_for_gloda_indexer(yesMsgSet, { augment: true });

  // - verify that the identities have contacts again
  // must have the contact object
  do_check_neq(yesMsgSet.glodaMessages[0].from.contact, undefined);
  // the contact's name should come from the address book card
  do_check_eq(yesMsgSet.glodaMessages[0].from.contact.name, abPeeps[0][0]);

  // - verify that the schema version changed from gloda's perspective and from
  //    the db's perspective
  verRows = yield sqlRun("PRAGMA user_version");
  do_check_eq(verRows[0].getInt64(0), GlodaDatastore._schemaVersion);
  do_check_eq(GlodaDatastore._actualSchemaVersion,
              GlodaDatastore._schemaVersion);
}

var tests = [
  test_fix_missing_contacts_and_fallout,
];

function run_test() {
  configure_message_injection({mode: "local"});
  glodaHelperRunTests(tests);
}
