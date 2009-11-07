/* ***** BEGIN LICENSE BLOCK *****
 *   Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Thunderbird Global Database.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Andrew Sutherland <asutherland@asutherland.org>
 *   Siddharth Agarwal <sid.bugzilla@gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/*
 * This file tests our indexing prowess.  This includes both our ability to
 *  properly be triggered by events taking place in thunderbird as well as our
 *  ability to correctly extract/index the right data.
 * In general, if these tests pass, things are probably working quite well.
 *
 * This test has local, IMAP online, IMAP offline, and IMAP online-become-offline
 *  variants.  See the text_index_messages_*.js files.
 *
 * Things we don't test that you think we might test:
 * - Full-text search.  Happens in query testing.
 */

load("resources/glodaTestHelper.js");

// Whether we can expect fulltext results
var expectFulltextResults = true;

/**
 * Should we force our folders offline after we have indexed them once.  We do
 * this in the online_to_offline test variant.
 */
var goOffline = false;

/* ===== Indexing Basics ===== */

/**
 * Index a message, wait for a commit, make sure the header gets the property
 *  set correctly.  Then modify the message, verify the dirty property shows
 *  up, flush again, and make sure the dirty property goes clean again.
 */
function test_pending_commit_tracker_flushes_correctly() {
  let [folder, msgSet] = make_folder_with_sets([{count: 1}]);
  yield wait_for_message_injection();
  yield wait_for_gloda_indexer(msgSet, {augment: true});

  // before the flush, there should be no gloda-id property
  let msgHdr = msgSet.getMsgHdr(0);
  // get it as a string to make sure it's empty rather than possessing a value
  do_check_eq(msgHdr.getStringProperty("gloda-id"), "");

  yield wait_for_gloda_db_flush();

  // after the flush there should be a gloda-id property and it should
  //  equal the gloda id
  let gmsg = msgSet.glodaMessages[0];
  do_check_eq(msgHdr.getUint32Property("gloda-id"), gmsg.id);

  // make sure no dirty property was written...
  do_check_eq(msgHdr.getStringProperty("gloda-dirty"), "");

  // modify the message
  msgSet.setRead(true);
  yield wait_for_gloda_indexer(msgSet);

  // now there should be a dirty property and it should be 1...
  do_check_eq(msgHdr.getUint32Property("gloda-dirty"),
              GlodaMsgIndexer.kMessageDirty);

  // flush
  yield wait_for_gloda_db_flush();

  // now dirty should be 0 and the gloda id should still be the same
  do_check_eq(msgHdr.getUint32Property("gloda-dirty"),
              GlodaMsgIndexer.kMessageClean);
  do_check_eq(msgHdr.getUint32Property("gloda-id"), gmsg.id);
}

/**
 * Make sure that PendingCommitTracker causes a msgdb commit to occur so that
 *  if the nsIMsgFolder's msgDatabase attribute has already been nulled
 *  (which is normally how we force a msgdb commit), that the changes to the
 *  header actually hit the disk.
 */
function test_pending_commit_causes_msgdb_commit() {
  // new message, index it
  let [folder, msgSet] = make_folder_with_sets([{count: 1}]);
  yield wait_for_message_injection();
  yield wait_for_gloda_indexer(msgSet, {augment: true});

  // force the msgDatabase closed; the sqlite commit will not yet have occurred
  get_real_injection_folder(folder).msgDatabase = null;
  // make the commit happen, this causes the header to get set.
  yield wait_for_gloda_db_flush();
  // Force a GC.  this will kill off the header and the database, losing data
  //  if we are not protecting it.
  Components.utils.forceGC();

  // now retrieve the header and make sure it has the gloda id set!
  let msgHdr = msgSet.getMsgHdr(0);
  do_check_eq(msgHdr.getUint32Property("gloda-id"), msgSet.glodaMessages[0].id);
}

/**
 * Give the indexing sweep a workout.
 *
 * This includes:
 * - Basic indexing sweep across never-before-indexed folders.
 * - Indexing sweep across folders with just some changes.
 * - Filthy pass.
 */
function test_indexing_sweep() {
  // -- Never-before-indexed folders
  mark_sub_test_start("never before indexed folders");
  // turn off event-driven indexing
  configure_gloda_indexing({event: false});

  let [folderA, setA1, setA2] = make_folder_with_sets([{count: 3},
                                                       {count: 2}]);
  yield wait_for_message_injection();
  let [folderB, setB1, setB2] = make_folder_with_sets([{count: 3},
                                                       {count: 2}]);
  yield wait_for_message_injection();
  let [folderC, setC1, setC2] = make_folder_with_sets([{count: 3},
                                                       {count: 2}]);
  yield wait_for_message_injection();

  // Make sure that event-driven job gets nuked out of existence
  GlodaIndexer.purgeJobsUsingFilter(function() true);

  // turn on event-driven indexing again; this will trigger a sweep.
  configure_gloda_indexing({event: true});
  GlodaMsgIndexer.indexingSweepNeeded = true;
  yield wait_for_gloda_indexer([setA1, setA2, setB1, setB2, setC1, setC2]);


  // -- Folders with some changes, pending commits
  mark_sub_test_start("folders with some changes, pending commits");
  // indexing off
  configure_gloda_indexing({event: false});

  setA1.setRead(true);
  setB2.setRead(true);

  // indexing on, killing all outstanding jobs, trigger sweep
  GlodaIndexer.purgeJobsUsingFilter(function() true);
  configure_gloda_indexing({event: true});
  GlodaMsgIndexer.indexingSweepNeeded = true;

  yield wait_for_gloda_indexer([setA1, setB2]);


  // -- Folders with some changes, no pending commits
  mark_sub_test_start("folders with some changes, no pending commits");
  // force a commit to clear out our pending commits
  yield wait_for_gloda_db_flush();
  // indexing off
  configure_gloda_indexing({event: false});

  setA2.setRead(true);
  setB1.setRead(true);

  // indexing on, killing all outstanding jobs, trigger sweep
  GlodaIndexer.purgeJobsUsingFilter(function() true);
  configure_gloda_indexing({event: true});
  GlodaMsgIndexer.indexingSweepNeeded = true;

  yield wait_for_gloda_indexer([setA2, setB1]);


  // -- Filthy foldering indexing
  // Just mark the folder filthy and make sure that we reindex everyone.
  // IMPORTANT!  The trick of marking the folder filthy only works because
  //  we flushed/committed the database above; the PendingCommitTracker
  //  is not aware of bogus filthy-marking of folders.
  // We leave the verification of the implementation details to
  //  test_index_sweep_folder.js.
  mark_sub_test_start("filthy folder indexing");
  let glodaFolderC = Gloda.getFolderForFolder(
                       get_real_injection_folder(folderC));
  glodaFolderC.dirtyStatus = glodaFolderC.kFolderFilthy;
  mark_action("actual", "marked gloda folder dirty", [glodaFolderC]);
  GlodaMsgIndexer.indexingSweepNeeded = true;
  yield wait_for_gloda_indexer([setC1, setC2]);
}

/* ===== Threading / Conversation Grouping ===== */

var gSynMessages = [];
function allMessageInSameConversation(aSynthMessage, aGlodaMessage, aConvID) {
  if (aConvID === undefined)
    return aGlodaMessage.conversationID;
  do_check_eq(aConvID, aGlodaMessage.conversationID);
  // Cheat and stash the synthetic message (we need them for one of the IMAP
  // tests)
  gSynMessages.push(aSynthMessage);
  return aConvID;
}

/**
 * Test our conversation/threading logic in the straight-forward direct
 *  reply case, the missing intermediary case, and the siblings with missing
 *  parent case.  We also test all permutations of receipt of those messages.
 * (Also tests that we index new messages.)
 */
function test_threading() {
  mark_sub_test_start("direct reply");
  yield indexAndPermuteMessages(scenarios.directReply,
                                allMessageInSameConversation);
  mark_sub_test_start("missing intermediary");
  yield indexAndPermuteMessages(scenarios.missingIntermediary,
                                allMessageInSameConversation);
  mark_sub_test_start("siblings missing parent");
  yield indexAndPermuteMessages(scenarios.siblingsMissingParent,
                                allMessageInSameConversation);
}

/* ===== Fundamental Attributes (per fundattr.js) ===== */

/**
 * Save the synthetic message created in test_attributes_fundamental for the
 *  benefit of test_attributes_fundamental_from_disk.
 */
var fundamentalSyntheticMessage;
var fundamentalFolderHandle;
/**
 * Save the resulting gloda message id corresponding to the
 *  fundamentalSyntheticMessage.
 */
var fundamentalGlodaMessageId;

/**
 * Test that we extract the 'fundamental attributes' of a message properly
 *  'Fundamental' in this case is talking about the attributes defined/extracted
 *  by gloda's fundattr.js and perhaps the core message indexing logic itself
 *  (which show up as kSpecial* attributes in fundattr.js anyways.)
 */
function test_attributes_fundamental() {
  // create a synthetic message with attachment
  let smsg = msgGen.makeMessage({
    attachments: [
      {filename: 'bob.txt', body: 'I like cheese!'}
    ],
  });
  // save it off for test_attributes_fundamental_from_disk
  fundamentalSyntheticMessage = smsg;
  let msgSet = new SyntheticMessageSet([smsg]);
  let folder = fundamentalFolderHandle = make_empty_folder();
  yield add_sets_to_folders(folder, [msgSet]);

  // if we need to go offline, let the indexing pass run, then force us offline
  if (goOffline) {
    yield wait_for_gloda_indexer(msgSet);
    yield make_folder_and_contents_offline(folder);
    // now the next indexer wait will wait for the next indexing pass...
  }

  yield wait_for_gloda_indexer(msgSet,
                               {verifier: verify_attributes_fundamental});
}

function verify_attributes_fundamental(smsg, gmsg) {
  // save off the message id for test_attributes_fundamental_from_disk
  fundamentalGlodaMessageId = gmsg.id;

  do_check_eq(gmsg.folderURI,
              get_real_injection_folder(fundamentalFolderHandle).URI);

  // -- subject
  do_check_eq(smsg.subject, gmsg.conversation.subject);
  do_check_eq(smsg.subject, gmsg.subject);

  // -- contact/identity information
  // - from
  // check the e-mail address
  do_check_eq(gmsg.from.kind, "email");
  do_check_eq(smsg.fromAddress, gmsg.from.value);
  // check the name
  do_check_eq(smsg.fromName, gmsg.from.contact.name);

  // - to
  do_check_eq(smsg.toAddress, gmsg.to[0].value);
  do_check_eq(smsg.toName, gmsg.to[0].contact.name);

  // date
  do_check_eq(smsg.date.valueOf(), gmsg.date.valueOf());

  // -- message ID
  do_check_eq(smsg.messageId, gmsg.headerMessageID);

  // -- attachments. We won't have these if we don't have fulltext results
  if (expectFulltextResults) {
    do_check_eq(gmsg.attachmentTypes.length, 1);
    do_check_eq(gmsg.attachmentTypes[0], "text/plain");
    do_check_eq(gmsg.attachmentNames.length, 1);
    do_check_eq(gmsg.attachmentNames[0], "bob.txt");
  }
  else {
    // Make sure we don't actually get attachments!
    do_check_eq(gmsg.attachmentTypes, null);
    do_check_eq(gmsg.attachmentNames, null);
  }
}

/**
 * We want to make sure that all of the fundamental properties also are there
 *  when we load them from disk.  Nuke our cache, query the message back up.
 *  We previously used getMessagesByMessageID to get the message back, but he
 *  does not perform a full load-out like a query does, so we need to use our
 *  query mechanism for this.
 */
function test_attributes_fundamental_from_disk() {
  nukeGlodaCachesAndCollections();

  let query = Gloda.newQuery(Gloda.NOUN_MESSAGE).id(fundamentalGlodaMessageId);
  queryExpect(query, [fundamentalSyntheticMessage],
              verify_attributes_fundamental_from_disk,
              function (smsg) { return smsg.messageId; } );
  return false;
}

/**
 * We are just a wrapper around verify_attributes_fundamental, adapting the
 *  return callback from getMessagesByMessageID.
 *
 * @param aGlodaMessageLists This should be [[theGlodaMessage]].
 */
function verify_attributes_fundamental_from_disk(aGlodaMessage) {
  // return the message id for test_attributes_fundamental_from_disk's benefit
  verify_attributes_fundamental(fundamentalSyntheticMessage,
                                aGlodaMessage);
  return aGlodaMessage.headerMessageID;
}

/* ===== Explicit Attributes (per explattr.js) ===== */

/**
 * Test the attributes defined by explattr.js.
 */
function test_attributes_explicit() {
  let [folder, msgSet] = make_folder_with_sets([{count: 1}]);
  yield wait_for_message_injection();
  yield wait_for_gloda_indexer(msgSet, {augment: true});
  let gmsg = msgSet.glodaMessages[0];

  // -- Star
  mark_sub_test_start("Star");
  msgSet.setStarred(true);
  yield wait_for_gloda_indexer(msgSet);
  do_check_eq(gmsg.starred, true);

  msgSet.setStarred(false);
  yield wait_for_gloda_indexer(msgSet);
  do_check_eq(gmsg.starred, false);

  // -- Read / Unread
  mark_sub_test_start("Read/Unread");
  msgSet.setRead(true);
  yield wait_for_gloda_indexer(msgSet);
  do_check_eq(gmsg.read, true);

  msgSet.setRead(false);
  yield wait_for_gloda_indexer(msgSet);
  do_check_eq(gmsg.read, false);

  // -- Tags
  mark_sub_test_start("Tags");
  // note that the tag service does not guarantee stable nsIMsgTag references,
  //  nor does noun_tag go too far out of its way to provide stability.
  //  However, it is stable as long as we don't spook it by bringing new tags
  //  into the equation.
  let tagOne = TagNoun.getTag("$label1");
  let tagTwo = TagNoun.getTag("$label2");

  msgSet.addTag(tagOne.key);
  yield wait_for_gloda_indexer(msgSet);
  do_check_neq(gmsg.tags.indexOf(tagOne), -1);

  msgSet.addTag(tagTwo.key);
  yield wait_for_gloda_indexer(msgSet);
  do_check_neq(gmsg.tags.indexOf(tagOne), -1);
  do_check_neq(gmsg.tags.indexOf(tagTwo), -1);

  msgSet.removeTag(tagOne.key);
  yield wait_for_gloda_indexer(msgSet);
  do_check_eq(gmsg.tags.indexOf(tagOne), -1);
  do_check_neq(gmsg.tags.indexOf(tagTwo), -1);

  msgSet.removeTag(tagTwo.key);
  yield wait_for_gloda_indexer(msgSet);
  do_check_eq(gmsg.tags.indexOf(tagOne), -1);
  do_check_eq(gmsg.tags.indexOf(tagTwo), -1);

  // -- Replied To

  // -- Forwarded
}


/* ===== Message Deletion ===== */
/**
 * Test actually deleting a message on a per-message basis (not just nuking the
 *  folder like emptying the trash does.)
 *
 * Logic situations:
 * - Non-last message in a conversation, twin.
 * - Non-last message in a conversation, not a twin.
 * - Last message in a conversation
 */
function test_message_deletion() {
  mark_sub_test_start("non-last message in conv, twin");
  // create and index two messages in a conversation
  let [folder, convSet] = make_folder_with_sets([{count: 2, msgsPerThread: 2}]);
  yield wait_for_message_injection();
  yield wait_for_gloda_indexer([convSet], {augment: true});

  // Twin the first message in a different folder owing to our reliance on
  //  message-id's in the SyntheticMessageSet logic.  (This is also why we broke
  //  up the indexing waits too.)
  let twinFolder = make_empty_folder();
  let twinSet = new SyntheticMessageSet([convSet.synMessages[0]]);
  yield add_sets_to_folder(twinFolder, [twinSet]);
  yield wait_for_gloda_indexer([twinSet], {augment: true});

  // Split the conv set into two helper sets...
  let firstSet = convSet.slice(0, 1); // the twinned first message in the thread
  let secondSet = convSet.slice(1, 2); // the un-twinned second thread message

  // make sure we can find the message (paranoia)
  let firstQuery = Gloda.newQuery(Gloda.NOUN_MESSAGE);
  firstQuery.id(firstSet.glodaMessages[0].id);
  let firstColl = queryExpect(firstQuery, firstSet);
  yield false; // queryExpect is async but returns a value...

  // delete it (not trash! delete!)
  yield async_delete_messages(firstSet);
  // which should result in an apparent deletion
  yield wait_for_gloda_indexer([], {deleted: firstSet});
  // and our collection from that query should now be empty
  do_check_eq(firstColl.items.length, 0);

  // make sure it no longer shows up in a standard query
  firstColl = queryExpect(firstQuery, []);
  yield false; // queryExpect is async

  // make sure it shows up in a privileged query
  let privQuery = Gloda.newQuery(Gloda.NOUN_MESSAGE, {
                      noDbQueryValidityConstraints: true,
                    });
  let firstGlodaId = firstSet.glodaMessages[0].id;
  privQuery.id(firstGlodaId);
  queryExpect(privQuery, firstSet);
  yield false; // queryExpect is async

  // force a deletion pass
  GlodaMsgIndexer.indexingSweepNeeded = true;
  yield wait_for_gloda_indexer([]);

  // Make sure it no longer shows up in a privileged query; since it has a twin
  //  we don't need to leave it as a ghost.
  queryExpect(privQuery, []);
  yield false; // queryExpect is async

  // make sure the messagesText entry got blown away
  yield sqlExpectCount(0, "SELECT COUNT(*) FROM messagesText WHERE docid = ?1",
                       firstGlodaId);

  // make sure the conversation still exists...
  let conv = twinSet.glodaMessages[0].conversation;
  let convQuery = Gloda.newQuery(Gloda.NOUN_CONVERSATION);
  convQuery.id(conv.id);
  let convColl = queryExpect(convQuery, [conv]);
  yield false; // queryExpect is async


  // -- non-last message, no longer a twin
  mark_sub_test_start("non-last message in conv, no longer a twin");

  // make sure nuking the twin didn't somehow kill them both
  let twinQuery = Gloda.newQuery(Gloda.NOUN_MESSAGE);
  // (let's search on the message-id now that there is no ambiguity.)
  twinQuery.headerMessageID(twinSet.synMessages[0].messageId);
  let twinColl = queryExpect(twinQuery, twinSet);
  yield false; // queryExpect is async

  // delete the twin
  yield async_delete_messages(twinSet);
  // which should result in an apparent deletion
  yield wait_for_gloda_indexer([], {deleted: twinSet});
  // it should disappear from the collection
  do_check_eq(twinColl.items.length, 0);

  // no longer show up in the standard query
  twinColl = queryExpect(twinQuery, []);
  yield false; // queryExpect is async

  // still show up in a privileged query
  privQuery = Gloda.newQuery(Gloda.NOUN_MESSAGE, {
                               noDbQueryValidityConstraints: true,
                             });
  privQuery.headerMessageID(twinSet.synMessages[0].messageId);
  queryExpect(privQuery, twinSet);
  yield false; // queryExpect is async

  // force a deletion pass
  GlodaMsgIndexer.indexingSweepNeeded = true;
  yield wait_for_gloda_indexer([]);

  // it still should show up in the privileged query; it's a ghost!
  let privColl = queryExpect(privQuery, twinSet);
  yield false; // queryExpect is async
  // make sure it looks like a ghost.
  let twinGhost = privColl.items[0];
  do_check_eq(twinGhost._folderID, null);
  do_check_eq(twinGhost._messageKey, null);

  // make sure the conversation still exists...
  queryExpect(convQuery, [conv]);
  yield false; // queryExpect is async


  // -- non-last message, not a twin
  // This should blow away the message, the ghosts, and the conversation.
  mark_sub_test_start("last message in conv");

  // second message should still be around
  let secondQuery = Gloda.newQuery(Gloda.NOUN_MESSAGE);
  secondQuery.headerMessageID(secondSet.synMessages[0].messageId);
  let secondColl = queryExpect(secondQuery, secondSet);
  yield false; // queryExpect is async

  // delete it and make sure it gets marked deleted appropriately
  yield async_delete_messages(secondSet);
  yield wait_for_gloda_indexer([], {deleted: secondSet});
  do_check_eq(secondColl.items.length, 0);

  // still show up in a privileged query
  privQuery = Gloda.newQuery(Gloda.NOUN_MESSAGE, {
                               noDbQueryValidityConstraints: true,
                             });
  privQuery.headerMessageID(secondSet.synMessages[0].messageId);
  queryExpect(privQuery, secondSet);
  yield false; // queryExpect is async

  // force a deletion pass
  GlodaMsgIndexer.indexingSweepNeeded = true;
  yield wait_for_gloda_indexer([]);

  // it should no longer show up in a privileged query; we killed the ghosts
  queryExpect(privQuery, []);
  yield false; // queryExpect is async

  // - the conversation should have disappeared too
  // (we have no listener to watch for it to have disappeared from convQuery but
  //  this is basically how glodaTestHelper does its thing anyways.)
  do_check_eq(convColl.items.length, 0);

  // make sure the query fails to find it too
  queryExpect(convQuery, []);
  yield false; // queryExpect is async


  // -- identity culling verification
  mark_sub_test_start("identity culling verification");
  // The identities associated with that message should no longer exist, nor
  //  should their contacts.

}

function test_moving_to_trash_marks_deletion() {
  // create and index two messages in a conversation
  let [folder, msgSet] = make_folder_with_sets([{count: 2, msgsPerThread: 2}]);
  yield wait_for_message_injection();
  yield wait_for_gloda_indexer([msgSet], {augment: true});

  let convId = msgSet.glodaMessages[0].conversation.id;
  let firstGlodaId = msgSet.glodaMessages[0].id;
  let secondGlodaId = msgSet.glodaMessages[1].id;

  // move them to the trash.
  yield async_trash_messages(msgSet);

  // we do not index the trash folder so this should actually make them appear
  //  deleted to an unprivileged query.
  let msgQuery = Gloda.newQuery(Gloda.NOUN_MESSAGE);
  msgQuery.id(firstGlodaId, secondGlodaId);
  queryExpect(msgQuery, []);
  yield false; // queryExpect is async

  // they will appear deleted after the events
  yield wait_for_gloda_indexer([], {deleted: msgSet});

  // force a sweep
  GlodaMsgIndexer.indexingSweepNeeded = true;
  // there should be no apparent change as the result of this pass
  // (well, the conversation will die, but we can't see that.)
  yield wait_for_gloda_indexer([]);

  // the conversation should be gone
  let convQuery = Gloda.newQuery(Gloda.NOUN_CONVERSATION);
  convQuery.id(convId);
  queryExpect(convQuery, []);
  yield false; // queryExpect is async

  // the messages should be entirely gone
  let msgPrivQuery = Gloda.newQuery(Gloda.NOUN_MESSAGE, {
                                      noDbQueryValidityConstraints: true,
                                    });
  msgPrivQuery.id(firstGlodaId, secondGlodaId);
  queryExpect(msgPrivQuery, []);
  yield false; // queryExpect is async
}

/**
 * Deletion that occurs because a folder got deleted.
 *  There is no hand-holding involving the headers that were in the folder.
 */
function test_folder_nuking_message_deletion() {
  // create and index two messages in a conversation
  let [folder, msgSet] = make_folder_with_sets([{count: 2, msgsPerThread: 2}]);
  yield wait_for_message_injection();
  yield wait_for_gloda_indexer([msgSet], {augment: true});

  let convId = msgSet.glodaMessages[0].conversation.id;
  let firstGlodaId = msgSet.glodaMessages[0].id;
  let secondGlodaId = msgSet.glodaMessages[1].id;

  // Delete the folder
  yield async_delete_folder(folder);
  // That does generate the deletion events if the messages were in-memory,
  //  which these are.
  yield wait_for_gloda_indexer([], {deleted: msgSet});

  // this should have caused us to mark all the messages as deleted; the
  //  messages should no longer show up in an unprivileged query
  let msgQuery = Gloda.newQuery(Gloda.NOUN_MESSAGE);
  msgQuery.id(firstGlodaId, secondGlodaId);
  queryExpect(msgQuery, []);
  yield false; // queryExpect is async

  // force a sweep
  GlodaMsgIndexer.indexingSweepNeeded = true;
  // there should be no apparent change as the result of this pass
  // (well, the conversation will die, but we can't see that.)
  yield wait_for_gloda_indexer([]);

  // the conversation should be gone
  let convQuery = Gloda.newQuery(Gloda.NOUN_CONVERSATION);
  convQuery.id(convId);
  queryExpect(convQuery, []);
  yield false; // queryExpect is async

  // the messages should be entirely gone
  let msgPrivQuery = Gloda.newQuery(Gloda.NOUN_MESSAGE, {
                                      noDbQueryValidityConstraints: true,
                                    });
  msgPrivQuery.id(firstGlodaId, secondGlodaId);
  queryExpect(msgPrivQuery, []);
  yield false; // queryExpect is async
}

/* ===== Folder Move/Rename/Copy (Single and Nested) ===== */

function test_folder_deletion_single() {

}

function test_folder_deletion_nested() {

}



/* ===== Message Moving ===== */

/**
 * Moving a message between folders should result in us knowing that the message
 *  is in the target location.  In the case of local moves, this happens
 *  automatically.  In the case of IMAP moves, we need to force the target folder
 *  to be updated.
 *
 * @todo Implication of UIDPLUS on IMAP are not understood / tested.
 */
function test_message_moving() {
  // - inject and insert
  // source folder with the message we care about
  let [srcFolder, msgSet] = make_folder_with_sets([{count: 1}]);
  yield wait_for_message_injection();
  // dest folder with some messages in it to test some wacky local folder moving
  //  logic.  (Local moves try and update the correspondence immediately.)
  let [destFolder, ignoreSet] = make_folder_with_sets([{count: 2}]);
  yield wait_for_message_injection();


  // (we want the gloda message mapping...)
  yield wait_for_gloda_indexer([msgSet, ignoreSet], {augment: true});
  let gmsg = msgSet.glodaMessages[0];

  // - move it to a new folder
  mark_sub_test_start("initial move");
  yield async_move_messages(msgSet, destFolder);

  // - make sure gloda sees it in the new folder
  // (In the local case, tThe move generates an itemsModified notification, so
  //  we see it as indexing traffic even if the indexer never goes active.)
  // (In the IMAP case, the message actually gets reindexed in the target
  //  folder.)
  yield wait_for_gloda_indexer(msgSet);

  do_check_eq(gmsg.folderURI,
              get_real_injection_folder(destFolder).URI);

  // - move it back to its origin folder
  mark_sub_test_start("move it back");
  yield async_move_messages(msgSet, srcFolder);
  yield wait_for_gloda_indexer(msgSet);
  do_check_eq(gmsg.folderURI,
              get_real_injection_folder(srcFolder).URI);
}

/**
 * Moving a gloda-indexed message out of a filthy folder should result in the
 *  destination message not having a gloda-id.
 */

/* ===== Message Copying ===== */


/* ===== Sweep Complications ==== */

/**
 * Make sure that a message indexed by event-driven indexing does not
 *  get reindexed by sweep indexing that follows.
 */
function test_sweep_indexing_does_not_reindex_event_indexed() {
  let [folder, msgSet] = make_folder_with_sets([{count: 1}]);
  yield wait_for_message_injection();

  // wait for the event sweep to complete
  yield wait_for_gloda_indexer([msgSet]);

  // force a sweep of the folder
  GlodaMsgIndexer.indexFolder(get_real_injection_folder(folder));
  yield wait_for_gloda_indexer([]);
}

/**
 * Verify that moving apparently gloda-indexed messages from a filthy folder or
 *  one that simply should not be gloda indexed does not result in the target
 *  messages having the gloda-id property on them.  To avoid messing with too
 *  many invariants we do the 'folder should not be gloda indexed' case.
 * Uh, and of course, the message should still get indexed once we clear the
 *  filthy gloda-id off of it given that it is moving from a folder that is not
 *  indexed to one that is indexed.
 */
function test_filthy_moves_slash_move_from_unindexed_to_indexed() {
  // - inject
  // the source folder needs a flag so we don't index it
  let srcFolder = make_empty_folder(null, [Ci.nsMsgFolderFlags.Junk]);
  // the destination folder has to be something we want to index though;
  let destFolder = make_empty_folder();
  let [msgSet] = make_new_sets_in_folder(srcFolder, [{count: 1}]);
  yield wait_for_message_injection();

  // - mark with a bogus gloda-id
  msgSet.getMsgHdr(0).setUint32Property("gloda-id", 9999);

  // - disable event driven indexing so we don't get interference from indexing
  configure_gloda_indexing({event: false});

  // - move
  yield async_move_messages(msgSet, destFolder);

  // - verify the target has no gloda-id!
  mark_action("actual", "checking", [msgSet.getMsgHdr(0)]);
  do_check_eq(msgSet.getMsgHdr(0).getUint32Property("gloda-id"), 0);

  // - re-enable indexing and let the indexer run
  // (we don't want to affect other tests)
  configure_gloda_indexing({});
  yield wait_for_gloda_indexer([msgSet]);
}

var tests = [
  test_pending_commit_tracker_flushes_correctly,
  test_pending_commit_causes_msgdb_commit,
  test_indexing_sweep,

  test_threading,
  test_attributes_fundamental,
  test_attributes_fundamental_from_disk,
  test_attributes_explicit,

  test_message_moving,

  test_message_deletion,
  test_moving_to_trash_marks_deletion,
  test_folder_nuking_message_deletion,

  test_sweep_indexing_does_not_reindex_event_indexed,

  test_filthy_moves_slash_move_from_unindexed_to_indexed,
];
