/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests that if a contact's address is updated, then the address is also
 * updated in mailing lists that that contact belongs to.
 */

var MODULE_NAME = 'test-update-mailing-list';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['address-book-helpers',
                       'folder-display-helpers',];

Cu.import("resource:///modules/mailServices.js");

function setupModule(module) {
  collector.getModule('folder-display-helpers').installInto(module);
  collector.getModule('address-book-helpers').installInto(module);
}

function test_contact_in_mailing_list_updated() {
  const kOldAddress = "before@example.com";
  const kNewAddress = "after@example.com";

  // Create some address book to work with...
  let ab = create_mork_address_book("Some Address Book");
  // And a contact...
  let contact = create_contact(kOldAddress, "Some Contact", true);
  // And our mailing list.
  let ml = create_mailing_list("Some Mailing List");

  // Add the mailing list to the address book, and then the card to the
  // address book, and finally, the card to the mailing list.
  ml.addressLists.appendElement(contact, false);
  ml = ab.addMailList(ml);

  contact = ml.addressLists.queryElementAt(0, Ci.nsIAbCard);

  // Open the address book, select our contact...
  let abw = open_address_book_window(mc);
  select_address_book(ab);
  select_contact(contact);

  // Change the primary email address of the contact...
  edit_selected_contact(abw, function(ecw) {
    ecw.e("PrimaryEmail").value = kNewAddress;
    accept_contact_changes(ecw);
  });

  // Because the current address book is kind of lame, in order
  // to see whether or not the mailing list contact was updated,
  // we have to get a fresh copy of the address book...
  ab = MailServices.ab.getDirectory(ab.URI);

  // Ensure that the primary email address for the contact changed
  // in the mailing list as well.
  assert_equals(1, ml.addressLists.length,
                "There should only be one contact in the mailing list");
  let mlContact = ml.addressLists.queryElementAt(0, Ci.nsIAbCard);
  assert_equals(kNewAddress, mlContact.primaryEmail);

  // Destroy the address book that we created.
  delete_address_book(ab);
}
