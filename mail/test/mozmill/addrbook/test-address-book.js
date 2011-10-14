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
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mike Conley <mconley@mozillamessaging.com>
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
 * Tests for the address book.
 */

var MODULE_NAME = 'test-address-book';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['address-book-helpers', 'folder-display-helpers',
                       'compose-helpers', 'window-helpers'];

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource:///modules/Services.jsm");
Cu.import("resource:///modules/mailServices.js");

let abController = null;
var addrBook1, addrBook2, addrBook3, addrBook4;
var mListA, mListB, mListC, mListD, mListE;
var windowHelper;

var gMockPromptService = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIPromptService]),
  _will_return: null,
  _did_confirm: false,
  _confirm_msg: null,
  _originalFactory: null,
  _cid: null,
  _contractID: "@mozilla.org/embedcomp/prompt-service;1",

  confirm: function(aParent, aDialogTitle, aText) {
    this._did_confirm = true;
    this._confirm_msg = aText;
    return this._will_return;
  },

  _return: function(aReturn) {
    this._will_return = aReturn;
  },

  _reset: function() {
    this._will_return = null;
    this._did_confirm = false;
    this._confirm_msg = null;
  },

  register: function() {
    let Cm = Components.manager;
    let Cc = Components.classes;
    let Ci = Components.interfaces;

    this._originalFactory = Cm.getClassObject(Cc[this._contractID], Ci.nsIFactory);

    let registrar = Cm.QueryInterface(Ci.nsIComponentRegistrar);
    this._cid = registrar.contractIDToCID(this._contractID);

    registrar.unregisterFactory(this._cid,
                                this._originalFactory);

    registrar.registerFactory(this._cid,
                              "Mock Prompt Service",
                              this._contractID,
                              gMockPromptServiceFactory);
  },

  unregister: function() {
    let Cm = Components.manager;
    let Ci = Components.interfaces;

    let registrar = Cm.QueryInterface(Ci.nsIComponentRegistrar);

    registrar.unregisterFactory(this._cid,
                                gMockPromptServiceFactory);

    registrar.registerFactory(this._cid,
                              "Prompt Service",
                              this._contractID,
                              this._originalFactory);
  },

};

var gMockPromptServiceFactory = {
  createInstance: function(aOuter, aIID) {
    if (aOuter != null)
      throw Cr.NS_ERROR_NO_AGGREGATION;

    if (!aIID.equals(Ci.nsIPromptService))
      throw Cr.NS_ERROR_NO_INTERFACE;

    return gMockPromptService;
  }
};

function setupModule(module)
{
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);

  let abh = collector.getModule('address-book-helpers');
  abh.installInto(module);

  let ch = collector.getModule('compose-helpers');
  ch.installInto(module);

  windowHelper = collector.getModule('window-helpers');

  // Open the address book main window
  abController = open_address_book_window();

  // Let's add some new address books.  I'll add them
  // out of order to properly test the alphabetical
  // ordering of the address books.
  ldapBook = create_ldap_address_book("LDAP Book");
  addrBook3 = create_mork_address_book("AB 3");
  addrBook1 = create_mork_address_book("AB 1");
  addrBook4 = create_mork_address_book("AB 4");
  addrBook2 = create_mork_address_book("AB 2");

  mListA = create_mailing_list("ML A");
  addrBook1.addMailList(mListA);

  mListB = create_mailing_list("ML B");
  addrBook2.addMailList(mListB);

  mListC = create_mailing_list("ML C");
  addrBook3.addMailList(mListC);

  mListD = create_mailing_list("ML D");
  addrBook3.addMailList(mListD);

  // There are 7 address books (Personal, AB 1, AB 2, AB 3, AB 4, LDAP Book
  // and Collected Address Book.  So let's ensure that those address books
  // exist in the tree view before executing our tests.
  abController.waitFor(
    function () (abController.window.gDirectoryTreeView.rowCount == 7),
    "Timeout waiting for all 7 address books to show up in the tree view",
    1000, 10);
}

/* Test that the address book manager automatically sorts
 * address books.
 *
 * Currently, we sort address books as follows:
 * 1. Personal Address Book
 * 2. Mork Address Books
 * 3. LDAP / Other Address Books
 * 4. Collected Address Book
 *
 * With the Personal and Collapsed address books existing
 * automatically, our address books *should* be in this order:
 *
 * Personal Address Book
 * AB 1
 *    ML A
 * AB 2
 *    ML B
 * AB 3
 *    ML C
 *    ML D
 * AB 4
 * LDAP Book
 * Collected Address Book
 **/
function test_order_of_address_books()
{
  const EXPECTED_AB_ORDER = ["Personal Address Book", "AB 1", "AB 2",
                             "AB 3", "AB 4", "LDAP Book",
                             "Collected Addresses"];

  for (let i = 0; i < EXPECTED_AB_ORDER.length; i++)
  {
    let abName = get_name_of_address_book_element_at(i);
    assert_equals(abName, EXPECTED_AB_ORDER[i],
                  "The address books are out of order.");
  }
}

/* Test that the expanded and collapsed states of address books
 * in the tree persist state when closing and re-opening the
 * address book manager
 */
function test_persist_collapsed_and_expanded_states()
{
  // Set the state of address books 1 and 3 to expanded
  set_address_books_expanded([addrBook1, addrBook3]);

  // Set address book 2 to be collapsed
  set_address_book_collapsed(addrBook2);

  // Now close and re-open the address book
  abController.window.close();
  abController = open_address_book_window();

  assert_true(is_address_book_collapsed(addrBook2));
  assert_true(!is_address_book_collapsed(addrBook1));
  assert_true(!is_address_book_collapsed(addrBook3));

  // Now set the state of address books 1 and 3 to collapsed
  // and make sure 2 is expanded
  set_address_books_collapsed([addrBook1, addrBook3]);
  set_address_book_expanded(addrBook2);

  // Now close and re-open the address book
  abController.window.close();
  abController = open_address_book_window();

  assert_true(!is_address_book_collapsed(addrBook2));
  assert_true(is_address_book_collapsed(addrBook1));
  assert_true(is_address_book_collapsed(addrBook3));
}

/* Test that if we try to delete a contact, that we are given
 * a confirm prompt.
 */
function test_deleting_contact_causes_confirm_prompt()
{
  // Register the Mock Prompt Service
  gMockPromptService.register();

  // Create a contact that we'll try to delete
  let contact1 = create_contact("test@nobody.com", "Sammy Jenkis", true);
  let toDelete = [contact1];

  let bundle = Services.strings
                       .createBundle("chrome://messenger/locale/addressbook/addressBook.properties")
  let confirmSingle = bundle.GetStringFromName("confirmDeleteContact");
  // Add some contacts to the address book
  load_contacts_into_address_book(addrBook1, toDelete);
  select_address_book(addrBook1);

  let totalEntries = abController.window.gAbView.rowCount;

  // Set the mock prompt to return false, so that the
  // contact should not be deleted.
  gMockPromptService._return(false);

  // Now attempt to delete the contact
  select_contact(toDelete);
  abController.keypress(null, "VK_DELETE", {});

  // Was a confirm displayed?
  assert_true(gMockPromptService._did_confirm);
  // Was the right message displayed?
  assert_equals(gMockPromptService._confirm_msg, confirmSingle);
  // The contact should not have been deleted.
  assert_equals(abController.window.gAbView.rowCount, totalEntries);

  gMockPromptService._reset();

  // Now we'll return true on confirm so that
  // the contact is deleted.
  gMockPromptService._return(true);
  select_contact(toDelete);
  abController.keypress(null, "VK_DELETE", {});

  // Was a confirm displayed?
  assert_true(gMockPromptService._did_confirm);
  // Was the right message displayed?
  assert_equals(gMockPromptService._confirm_msg, confirmSingle);
  // The contact should have been deleted.
  assert_equals(abController.window.gAbView.rowCount,
                totalEntries - toDelete.length);

  gMockPromptService.unregister();
}

/* Test that if we try to delete multiple contacts, that we are give
 * a confirm prompt.
 */
function test_deleting_contacts_causes_confirm_prompt()
{
  // Register the Mock Prompt Service
  gMockPromptService.register();

  // Create some contacts that we'll try to delete.
  let contact2 = create_contact("test2@nobody.com", "Leonard Shelby", true);
  let contact3 = create_contact("test3@nobody.com", "John Edward Gammell", true);
  let contact4 = create_contact("test4@nobody.com", "Natalie", true);

  let toDelete = [contact2, contact3, contact4];

  let bundle = Services.strings
                       .createBundle("chrome://messenger/locale/addressbook/addressBook.properties")
  let confirmMultiple = bundle.GetStringFromName("confirmDeleteContacts");

  // Add some contacts to the address book
  load_contacts_into_address_book(addrBook1, toDelete);
  select_address_book(addrBook1);

  let totalEntries = abController.window.gAbView.rowCount;

  // Set the mock prompt to return false, so that the
  // contact should not be deleted.
  gMockPromptService._return(false);

  // Now attempt to delete the contact
  select_contacts(toDelete);
  abController.keypress(null, "VK_DELETE", {});

  // Was a confirm displayed?
  assert_true(gMockPromptService._did_confirm);
  // Was the right message displayed?
  assert_equals(gMockPromptService._confirm_msg, confirmMultiple);
  // The contact should not have been deleted.
  assert_equals(abController.window.gAbView.rowCount, totalEntries);

  gMockPromptService._reset();

  // Now we'll return true on confirm so that
  // the contact is deleted.
  gMockPromptService._return(true);
  select_contacts(toDelete);
  abController.keypress(null, "VK_DELETE", {});

  // Was a confirm displayed?
  assert_true(gMockPromptService._did_confirm);
  // Was the right message displayed?
  assert_equals(gMockPromptService._confirm_msg, confirmMultiple);
  // The contact should have been deleted.
  assert_equals(abController.window.gAbView.rowCount,
                totalEntries - toDelete.length);

  gMockPromptService.unregister();
}

/* Tests that attempting to delete a mailing list causes a
 * confirmation dialog to be brought up, and that deletion
 * actually works if the user clicks "OK".
 */
function test_deleting_mailing_lists() {
  // Register our Mock Prompt Service
  gMockPromptService.register();

  // Create a new mailing list, and add it to one of our
  // address books
  let newList = create_mailing_list("Delete Me!");
  let addedList = addrBook1.addMailList(newList);
  let mlURI = addedList.URI;

  // Make sure it got added.
  assert_true(addrBook1.hasDirectory(addedList));

  // Let's click "cancel" on the confirm dialog box
  // first.
  gMockPromptService._return(false);

  abController.window.AbDeleteDirectory(addedList.URI);

  // Test that the confirmation dialog was brought up.
  assert_true(gMockPromptService._did_confirm);

  // Ensure that the mailing list was not removed.
  assert_true(addrBook1.hasDirectory(addedList));

  // This time, let's click "OK" on the confirm dialog box
  gMockPromptService._return(true);

  abController.window.AbDeleteDirectory(addedList.URI);

  // Test that the confirmation dialog was brought up.
  assert_true(gMockPromptService._did_confirm);

  // Ensure that the mailing list was removed.
  assert_false(addrBook1.hasDirectory(addedList));

  gMockPromptService.unregister();
}


/* Tests that we can send mail to a mailing list by selecting the
 * mailing list in the tree, and clicking "Write"
 */
function test_writing_to_mailing_list() {

  // Create a new mailing list, and add it to one of our
  // address books
  let newList = create_mailing_list("Some Mailing List");
  let addedList = addrBook1.addMailList(newList);
  let mlURI = addedList.URI;

  // Create some contacts that we'll try to contact
  let contacts = [create_contact("test2@nobody.com", "Leonard Shelby", true),
                  create_contact("test3@nobody.com", "John Edward Gammell",
                                 true),
                  create_contact("test4@nobody.com", "Natalie", true),];

  load_contacts_into_mailing_list(addedList, contacts);

  // Ensure that addrBook1 is expanded
  set_address_book_expanded(addrBook1);

  // Now select the mailing list in the tree...
  select_address_book(addedList);

  // Focus it...
  abController.window.gDirTree.focus();

  // Assuming we've made it this far, now we just plan for the compose
  // window...
  windowHelper.plan_for_new_window("msgcompose");
  // ... and click the "Write" button
  abController.click(abController.eid("button-newmessage"));
  let composeWin = wait_for_compose_window(abController);
  let to = composeWin.window.gMsgCompose.compFields.to;

  // Make sure we're writing to all contacts in the mailing list.
  for each (contact in contacts) {
    assert_not_equals(-1, to.indexOf(contact.primaryEmail));
    assert_not_equals(-1, to.indexOf(contact.displayName));
  }
}
