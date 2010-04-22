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
 * The Original Code is Thunderbird Mail Client.
 *
 * The Initial Developer of the Original Code is the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Andrew Sutherland <asutherland@asutherland.org>
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
 * Verify that we are constructing the filters that we expect and that they
 * are hooked up to the right buttons.
 */

var MODULE_NAME = 'test-filter-logic';

const RELATIVE_ROOT = '../shared-modules';

var MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers',
                       'quick-filter-bar-helper'];

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);
  let qfb = collector.getModule('quick-filter-bar-helper');
  qfb.installInto(module);
}

function test_filter_unread() {
  let folder = create_folder("QuickFilterBarFilterUnread");
  let [unread, read] = make_new_sets_in_folder(folder,
    [{count: 1}, {count: 1}]);
  read.setRead(true);

  be_in_folder(folder);
  toggle_boolean_constraints("unread");
  assert_messages_in_view(unread);
}

function test_filter_starred() {
  let folder = create_folder("QuickFilterBarFilterStarred");
  let [unstarred, starred] = make_new_sets_in_folder(folder,
    [{count: 1}, {count: 1}]);
  starred.setStarred(true);

  be_in_folder(folder);
  toggle_boolean_constraints("starred");
  assert_messages_in_view(starred);
}

function test_filter_simple_intersection_unread_and_starred() {
  let folder = create_folder("QuickFilterBarFilterUnreadAndStarred");
  let [unreadUnstarred, readUnstarred, unreadStarred, readStarred] =
    make_new_sets_in_folder(folder,
      [{count: 1}, {count: 1}, {count: 1}, {count: 1}]);
  readUnstarred.setRead(true);
  unreadStarred.setStarred(true);
  readStarred.setRead(true);
  readStarred.setStarred(true);

  be_in_folder(folder);
  toggle_boolean_constraints("unread", "starred");

  assert_messages_in_view(unreadStarred);
}

function test_filter_attachments() {
  let attachSetDef = {
    count: 1,
    attachments: [{filename: 'foo.png',
                   contentType: 'image/png',
                   encoding: 'base64', charset: null,
                   body: 'YWJj\n', format: null}],
  };
  let noAttachSetDef = {
    count: 1,
  };


  let folder = create_folder("QuickFilterBarFilterAttachments");
  let [setNoAttach, setAttach] = make_new_sets_in_folder(folder,
    [noAttachSetDef, attachSetDef]);

  be_in_folder(folder);
  toggle_boolean_constraints("attachments");

  assert_messages_in_view(setAttach);
}

/**
 * Create a card for the given e-mail address, adding it to the first address
 * book we can find.
 */
function add_email_to_address_book(aEmailAddr) {
  let card = Cc["@mozilla.org/addressbook/cardproperty;1"]
               .createInstance(Ci.nsIAbCard);
  card.primaryEmail = aEmailAddr;

  let enumerator = Cc["@mozilla.org/abmanager;1"]
                     .getService(Ci.nsIAbManager)
                     .directories;
  while (enumerator.hasMoreElements()) {
    let addrbook = enumerator.getNext();
    if (addrbook instanceof Components.interfaces.nsIAbMDBDirectory &&
        addrbook instanceof Components.interfaces.nsIAbDirectory) {
      addrbook.addCard(card);
      return;
    }
  }

  throw new Error("Unable to find any suitable address book.");
}

function test_filter_in_address_book() {
  let bookSetDef = {
    from: ["Qbert Q Qbington", "q@q.q"],
    count: 1
  };
  add_email_to_address_book(bookSetDef.from[1]);
  let folder = create_folder("MesssageFilterBarInAddressBook");
  let [setBook, setNoBook] = make_new_sets_in_folder(folder,
                               [bookSetDef, {count: 1}]);
  be_in_folder(folder);
  toggle_boolean_constraints("addrbook");
  assert_messages_in_view(setBook);
}

function test_filter_tags() {
  let folder = create_folder("QuickFilterBarTags");
  const tagA = "$label1", tagB = "$label2", tagC = "$label3";
  let [setNoTag, setTagA, setTagB, setTagAB, setTagC] = make_new_sets_in_folder(
    folder,
    [{count: 1}, {count: 1}, {count: 1}, {count: 1}, {count: 1}]);
  setTagA.addTag(tagA);
  setTagB.addTag(tagB);
  setTagAB.addTag(tagA);
  setTagAB.addTag(tagB);
  setTagC.addTag(tagC);

  be_in_folder(folder);
  toggle_boolean_constraints("tags"); // must have a tag
  assert_messages_in_view([setTagA, setTagB, setTagAB, setTagC]);

  toggle_tag_constraints(tagA); // must have tag A
  assert_messages_in_view([setTagA, setTagAB]);

  toggle_tag_constraints(tagB); // must have tag A OR tag B
  assert_messages_in_view([setTagA, setTagB, setTagAB]);

  toggle_tag_constraints(tagA); // must have tag B
  assert_messages_in_view([setTagB, setTagAB]);

  toggle_tag_constraints(tagB); // have have a tag
  assert_messages_in_view([setTagA, setTagB, setTagAB, setTagC]);

  toggle_boolean_constraints("tags"); // no constraints
  assert_messages_in_view([setNoTag, setTagA, setTagB, setTagAB, setTagC]);

  // If we have filtered to a specific tag and we disable the tag filter
  // entirely, make sure that when we turn it back on we are just back to "any
  // tag".
  toggle_boolean_constraints("tags");
  toggle_tag_constraints(tagC);
  assert_messages_in_view(setTagC);

  toggle_boolean_constraints("tags"); // no constraints
  toggle_boolean_constraints("tags"); // should be any tag (not tagC!)
  assert_messages_in_view([setTagA, setTagB, setTagAB, setTagC]);
}

function test_filter_text_single_word_and_predicates() {
  let folder = create_folder("QuickFilterBarTextSingleWord");
  let whoFoo = ["zabba", "foo@madeup.nul"];
  let [setInert, setSenderFoo, setRecipientsFoo, setSubjectFoo, setBodyFoo] =
    make_new_sets_in_folder(folder, [
      {count: 1}, {count:1, from: whoFoo}, {count: 1, to: [whoFoo]},
      {count: 1, subject: "foo"}, {count: 1, body: {body: "foo"}}]);
  be_in_folder(folder);

  // by default, sender/recipients/subject are selected
  assert_text_constraints_checked("sender", "recipients", "subject");

  // con defaults, por favor
  set_filter_text("foo");
  assert_messages_in_view([setSenderFoo, setRecipientsFoo, setSubjectFoo]);
  // note: we sequence the changes in the list so there is always at least one
  //  dude selected.  selecting down to nothing has potential UI implications
  //  we don't want this test to get affected by.
  // sender only
  toggle_text_constraints("recipients", "subject");
  assert_messages_in_view(setSenderFoo);
  // recipients only
  toggle_text_constraints("recipients", "sender");
  assert_messages_in_view(setRecipientsFoo);
  // subject only
  toggle_text_constraints("subject", "recipients");
  assert_messages_in_view(setSubjectFoo);
  // body only
  toggle_text_constraints("body", "subject");
  assert_messages_in_view(setBodyFoo);
  // everybody
  toggle_text_constraints("sender", "recipients", "subject");
  assert_messages_in_view([setSenderFoo, setRecipientsFoo, setSubjectFoo,
                          setBodyFoo]);

  // sanity check non-matching
  set_filter_text("notgonnamatchevercauseisayso");
  assert_messages_in_view([]);
  // disable body, still should get nothing
  toggle_text_constraints("body");
  assert_messages_in_view([]);

  // (we are leaving with the defaults once again active)
  assert_text_constraints_checked("sender", "recipients", "subject");
}

/**
 * Verify that the multi-word logic is actually splitting the words into
 *  different terms and that the terms can match in different predicates.
 *  This means that given "foo bar" we should be able to match "bar foo" in
 *  a subject and "foo" in the sender and "bar" in the recipient.  And that
 *  constitutes sufficient positive coverage, although we also want to make
 *  sure that just a single term match is insufficient.
 */
function test_filter_text_multi_word() {
  let folder = create_folder("QuickFilterBarTextMultiWord");

  let whoFoo = ["foo", "zabba@madeup.nul"];
  let whoBar = ["zabba", "bar@madeup.nul"];
  let [setInert, setPeepMatch, setSubjReverse, setSubjectJustFoo] =
    make_new_sets_in_folder(folder, [
      {count: 1}, {count:1, from: whoFoo, to: [whoBar]},
      {count: 1, subject: "bar foo"}, {count: 1, from: whoFoo}]);
  be_in_folder(folder);

  // (precondition)
  assert_text_constraints_checked("sender", "recipients", "subject");

  set_filter_text("foo bar");
  assert_messages_in_view([setPeepMatch, setSubjReverse]);
}

/**
 * Make sure that when dropping all constraints on toggle off or changing
 *  folders that we persist/propagate the state of the
 *  sender/recipients/subject/body toggle buttons.
 */
function test_filter_text_constraints_propagate() {
  let whoFoo = ["foo", "zabba@madeup.nul"];
  let whoBar = ["zabba", "bar@madeup.nul"];

  let folderOne = create_folder("QuickFilterBarTextPropagate1");
  let [setSubjFoo, setWhoFoo] = make_new_sets_in_folder(folderOne,
    [{count: 1, subject: "foo"}, {count: 1, from: whoFoo}]);
  let folderTwo = create_folder("QuickFilterBarTextPropagate2");
  let [setSubjBar, setWhoBar] = make_new_sets_in_folder(folderTwo,
    [{count: 1, subject: "bar"}, {count: 1, from: whoBar}]);

  be_in_folder(folderOne);
  set_filter_text("foo");
  // (precondition)
  assert_text_constraints_checked("sender", "recipients", "subject");
  assert_messages_in_view([setSubjFoo, setWhoFoo]);

  // -- drop subject, close bar to reset, make sure it sticks
  toggle_text_constraints("subject");
  assert_messages_in_view([setWhoFoo]);

  toggle_quick_filter_bar();
  toggle_quick_filter_bar();

  set_filter_text("foo");
  assert_messages_in_view([setWhoFoo]);
  assert_text_constraints_checked("sender", "recipients");

  // -- now change folders and make sure the settings stick
  be_in_folder(folderTwo);
  set_filter_text("bar");
  assert_messages_in_view([setWhoBar]);
  assert_text_constraints_checked("sender", "recipients");
}

/**
 * Here is what the results label does:
 * - No filter active: results label is not visible.
 * - Filter active, messages: it says the number of messages.
 * - Filter active, no messages: it says there are no messages.
 *
 * Additional nuances:
 * - The count needs to update as the user deletes messages or what not.
 */
function test_results_label() {
  let folder = create_folder("QuickFilterBarResultsLabel");
  let [setImmortal, setMortal, setGoldfish] = make_new_sets_in_folder(folder,
    [{count: 1}, {count: 1}, {count: 1}]);

  be_in_folder(folder);

  // no filter, the label should not be visible
  if (mc.e("qfb-results-label").visible)
    throw new Error("results label should not be visible, yo! mad impropah!");

  toggle_boolean_constraints("unread");
  assert_messages_in_view([setImmortal, setMortal, setGoldfish]);
  assert_results_label_count(3);

  delete_message_set(setGoldfish);
  assert_results_label_count(2);

  delete_message_set(setMortal);
  assert_results_label_count(1);

  delete_message_set(setImmortal);
  assert_results_label_count(0);
}
