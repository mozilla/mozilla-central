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

/**
 * This file tests the initialization of the 'me' logic as implemented on
 *  Gloda._initMyIdentities.  Although we don't need a lot of what
 *  glodaTestHelper gets up to, it saves us a lot of test setup legwork, so we
 *  use it and do a bunch of destructive clobbering to reset the database state
 *  prior to running our tests.
 *
 * Keep in mind that we will always have a good/valid identity around because
 *  glodaTestHelper is using messageInjection which creates a valid identity for
 *  us.
 *
 * Everything in this file is concerned with bug 596424 which was where we
 *  realized the 'me' identity logic was not properly handling e-mail addresses
 *  that were not already lower case.
 **/

load("resources/glodaTestHelper.js");

var gInbox;

var gLocalAccount = null;
var gAddedIdentities = [];

/**
 * (Temporarily) add an identity to the account manager so it will be visible
 *  to Gloda.
 */
function addTestAccountIdentity(displayName, emailAddress) {
  let acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                  .getService(Ci.nsIMsgAccountManager);
  gLocalAccount = acctMgr.FindAccountForServer(acctMgr.localFoldersServer);

  let identity = acctMgr.createIdentity();
  identity.fullName = displayName;
  identity.email = emailAddress;
  gLocalAccount.addIdentity(identity);

  gAddedIdentities.push(identity);
}

/**
 * Remove all identities previously added by addTestAccountIdentity.  This will
 *  not remove identities added elsewhere, such as the one added by
 *  messageInjection.js.
 */
function removeTestAccountIdentities() {
  for (var i = 0; i < gAddedIdentities.length; i++) {
    gLocalAccount.removeIdentity(gAddedIdentities[i]);
  }
  gAddedIdentities = [];
}

/**
 * Establish the baseline for the message injection contact/identity.  This
 *  got added after gloda started up, so we need to reset things here.
 */
function rerun_myContact_for_messageInjection() {
  resetGlodaMyIdentities();
  Gloda._initMyIdentities();
}

/**
 * Prior to calling the me-init logic, have an account with a mixed-case email
 *  with a corresponding 'me' contact and associated mixed-case identity in
 *  addition to the standard valid identity we have lying around.  This includes
 *  making sure we have a correctly-cased variant of the identity (and a
 *  contact) from sending an e-mail from the 'me' identity.
 * Re-run the 'me' init logic.  Make sure the mixed case identity went away and
 *  that only one of the three possible contacts (bad contact we dubiously
 *  inserted, 'me' contact relating to the previous 'me' contact from gloda
 *  startup, 'good' contact for the "from" 'me' case) survived.
 * Make sure that the reparenting of identities hits the disk.
 *
 * We do not need to deal with permutations of whether all identities were mixed
 *  case (and therefore potentially 'losing' the original 'me' contact) because
 *  the _initMyIdentities logic explicitly keeps track of the contacts
 *  associated with the bogus mixed-case identities.
 *
 * We also want to verify that we attempt to propagate popularity.
 */
function test_mixed_case_me_email_migration() {
  var MIXED_EMAIL_ADDRESS = "Joe.Bob@Joe.Bobia.com";
  var DISPLAY_NAME = "Joe Bob";

  // -- create the bad mixed-case setup.
  // create a synthetic message using a mixed-case identity to get the identity
  //  in the database with its own contact and some popularity.
  let [msgSet] = make_new_sets_in_folder(gInbox, [
                   {count: 1, from: [DISPLAY_NAME, MIXED_EMAIL_ADDRESS]}]);
  yield wait_for_message_injection();
  yield wait_for_gloda_indexer(msgSet, {augment: true});
  let goodIdentity = msgSet.glodaMessages[0].from;
  let goodContact = goodIdentity.contact;

  // force the creation of the illegal identity and its owning contact.
  let badContact = GlodaDatastore.createContact(null, null, DISPLAY_NAME, 0, 0);
  let badIdentity = GlodaDatastore.createIdentity(
                      badContact.id, badContact, "email", MIXED_EMAIL_ADDRESS,
                      "", false);
  GlodaDatastore.insertContact(badContact);

  let preMeContact = Gloda.myContact;

  // figure out the expected resulting popularity.
  let expectedPopularity = goodContact.popularity + badContact.popularity +
                           preMeContact.popularity;

  // -- add the new mixed case Identity to Thunderbird proper
  addTestAccountIdentity(DISPLAY_NAME, MIXED_EMAIL_ADDRESS);

  // -- reset everything (clearing caches)
  resetGlodaMyIdentities();

  // -- invoke me-init
  Gloda._initMyIdentities();

  // -- verify me-init fixed up the bad setup
  // bad identity needs to be gone
  do_check_eq(GlodaDatastore.getIdentity("email", MIXED_EMAIL_ADDRESS), null);

  // There should only be one 'me' contact left, and it should have a popularity
  //  that is the sum of all three popularities.
  // (We do not require a specific contact to be chosen, just that only one is
  //  chosen.)
  let postMeContact = Gloda.myContact;
  if (postMeContact.id === preMeContact.id) {
    do_check_eq(GlodaDatastore.getContactByID(goodContact.id), null);
    do_check_eq(GlodaDatastore.getContactByID(badContact.id), null);
  }
  else if (postMeContact.id === goodContact.id) {
    do_check_eq(GlodaDatastore.getContactByID(preMeContact.id), null);
    do_check_eq(GlodaDatastore.getContactByID(badContact.id), null);
  }
  else if (postMeContact.id === badContact.id) {
    do_check_eq(GlodaDatastore.getContactByID(goodContact.id), null);
    do_check_eq(GlodaDatastore.getContactByID(preMeContact.id), null);
  }
  else {
    do_throw("New Gloda.myContact is not one of the pre-existing contacts.");
  }
  do_check_eq(postMeContact.popularity, expectedPopularity);

  // the contact should own two identities that are not the same...
  do_check_eq(postMeContact._identities.length, 2);
  do_check_neq(postMeContact._identities[0].id,
               postMeContact._identities[1].id);

  // -- make sure the identity re-parenting hit the disk
  resetGlodaMyIdentities(); // (need to avoid cache hits)

  for (var i = 0; i < postMeContact._identities.length; i++) {
    do_check_eq(
      GlodaDatastore.getIdentity("email",
                                 postMeContact._identities[i].value).contactID,
      postMeContact.id);
  }

  // -- cleanup
  removeTestAccountIdentities();
}

/**
 * Have an account with mixed-case email prior to 'me' init.  Post 'me' init
 *  ensure that we only have an identity with the lowercased e-mail address and
 *  no mixed-cased identity.
 */
function test_mixed_case_me_email_initial_case() {
  removeTestAccountIdentities();

  var MIXED_EMAIL_ADDRESS = "Let@It.Run";
  var DISPLAY_NAME = "Like Like";

  addTestAccountIdentity(DISPLAY_NAME, MIXED_EMAIL_ADDRESS);

  resetGlodaMyIdentities();
  Gloda._initMyIdentities();

  do_check_eq(GlodaDatastore.getIdentity("email", MIXED_EMAIL_ADDRESS), null);
  do_check_neq(
    GlodaDatastore.getIdentity("email", MIXED_EMAIL_ADDRESS.toLowerCase()),
    null);

  removeTestAccountIdentities();
}


let tests = [
  rerun_myContact_for_messageInjection,
  test_mixed_case_me_email_migration,
  test_mixed_case_me_email_initial_case,
];

function run_test() {
  gInbox = configure_message_injection({mode: "local"});
  glodaHelperRunTests(tests);
}
