/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const MODULE_NAME = "address-book-helpers";

const RELATIVE_ROOT = "../shared-modules";
const MODULE_REQUIRES = ["folder-display-helpers", "window-helpers"];

Cu.import("resource:///modules/mailServices.js");
Cu.import("resource:///modules/Services.jsm");

const ABMDB_PREFIX = "moz-abmdbdirectory://";
const ABLDAP_PREFIX = "moz-abldapdirectory://";

var collectedAddresses;

var abController;

var folderDisplayHelper;
var mc;
var windowHelper;

function setupModule() {
  folderDisplayHelper = collector.getModule('folder-display-helpers');
  mc = folderDisplayHelper.mc;
  windowHelper = collector.getModule('window-helpers');
  // Ensure all the directories are initialised.
  MailServices.ab.directories;
  collectedAddresses = MailServices.ab
                       .getDirectory("moz-abmdbdirectory://history.mab");
}

function installInto(module) {
  setupModule();

  // Now copy helper functions
  module.ensure_card_exists = ensure_card_exists;
  module.ensure_no_card_exists = ensure_no_card_exists;
  module.open_address_book_window = open_address_book_window;
  module.close_address_book_window = close_address_book_window;
  module.create_mork_address_book = create_mork_address_book;
  module.create_ldap_address_book = create_ldap_address_book;
  module.create_contact = create_contact;
  module.create_mailing_list = create_mailing_list;
  module.get_mailing_list_from_address_book =
      get_mailing_list_from_address_book;
  module.load_contacts_into_address_book = load_contacts_into_address_book;
  module.load_contacts_into_mailing_list = load_contacts_into_mailing_list;
  module.get_cards_in_all_address_books_for_email =
      get_cards_in_all_address_books_for_email;
  module.get_address_book_tree_view_index = get_address_book_tree_view_index;
  module.set_address_books_collapsed = set_address_books_collapsed;
  module.set_address_books_expanded = set_address_books_expanded;
  // set_address_book_collapsed and set_address_book_expanded use
  // the same code as set_address_books_expanded/collapsed, so I just
  // alias them here.
  module.set_address_book_collapsed = set_address_books_collapsed;
  module.set_address_book_expanded = set_address_books_expanded;
  module.is_address_book_collapsed = is_address_book_collapsed;
  module.is_address_book_collapsible = is_address_book_collapsible;
  module.get_name_of_address_book_element_at = get_name_of_address_book_element_at;
  module.select_address_book = select_address_book;
  module.get_contact_ab_view_index = get_contact_ab_view_index;
  // select_contact is aliased for select_contacts, since they
  // share the same code.
  module.select_contact = select_contacts;
  module.select_contacts = select_contacts;
  module.edit_selected_contact = edit_selected_contact;
  module.accept_contact_changes = accept_contact_changes;
  module.delete_address_book = delete_address_book;
}

/**
 * Make sure that there is a card for this email address
 * @param emailAddress the address that should have a card
 * @param displayName the display name the card should have
 * @param preferDisplayName |true| if the card display name should override the
 *                          header display name
 */
function ensure_card_exists(emailAddress, displayName, preferDisplayName)
{
  ensure_no_card_exists(emailAddress);
  let card = create_contact(emailAddress, displayName, preferDisplayName);
  collectedAddresses.addCard(card);
}

/**
 * Make sure that there is no card for this email address
 * @param emailAddress the address that should have no cards
 */
function ensure_no_card_exists(emailAddress)
{
  var books = MailServices.ab.directories;

  while (books.hasMoreElements()) {
    var ab = books.getNext().QueryInterface(Ci.nsIAbDirectory);
    try {
      var card = ab.cardForEmailAddress(emailAddress);
      if (card) {
        let cardArray = Cc["@mozilla.org/array;1"]
                          .createInstance(Ci.nsIMutableArray);
        cardArray.appendElement(card, false);
        ab.deleteCards(cardArray);
      }
    }
    catch (ex) { }
  }
}

/**
 * Return all address book cards for a particular email address
 * @param aEmailAddress the address to search for
 */
function get_cards_in_all_address_books_for_email(aEmailAddress)
{
  var books = MailServices.ab.directories;
  var result = [];

  while (books.hasMoreElements()) {
    var ab = books.getNext().QueryInterface(Ci.nsIAbDirectory);
    var card = ab.cardForEmailAddress(aEmailAddress);
    if (card) {
      result.push(card);
    }
  }

  return result;
}

/**
 * Opens the address book interface
 * @returns a controller for the address book
 */
function open_address_book_window(aController)
{
  if (aController === undefined)
    aController = mc;

  windowHelper.plan_for_new_window("mail:addressbook");
  aController.keypress(null, "b", {shiftKey: true, accelKey: true});

  // XXX this should probably be changed to making callers pass in which address
  // book they want to work with, just like test-compose-helpers.
  abController = windowHelper.wait_for_new_window("mail:addressbook");
  windowHelper.augment_controller(abController);
  return abController;
}

/**
 * Closes the address book interface
 * @param abc the controller for the address book window to close
 * @return the result from wait_for_window_close
 */
function close_address_book_window(abc)
{
  windowHelper.plan_for_window_close(abc);
  abc.window.close();
  return windowHelper.wait_for_window_close(abc);
}

/**
 * Creates and returns a Mork-backed address book.
 * @param aName the name for the address book
 * @returns the nsIAbDirectory address book
 */
function create_mork_address_book(aName)
{
  let abPrefString = MailServices.ab.newAddressBook(aName, "", 2);
  let abURI = Services.prefs.getCharPref(abPrefString + ".filename");
  return MailServices.ab.getDirectory(ABMDB_PREFIX + abURI);
}

/**
 * Creates and returns an LDAP-backed address book.
 * This function will automatically fill in a dummy
 * LDAP URI if no URI is supplied.
 * @param aName the name for the address book
 * @param aURI an optional URI for the address book
 * @returns the nsIAbDirectory address book
 */
function create_ldap_address_book(aName, aURI)
{
  if (!aURI)
    aURI = "ldap://dummyldap/??sub?(objectclass=*)";
  let abPrefString = MailServices.ab.newAddressBook(aName, aURI, 0);
  return MailServices.ab.getDirectory(ABLDAP_PREFIX + abPrefString);
}

/**
 * Creates and returns an address book contact
 * @param aEmailAddress the e-mail address for this contact
 * @param aDisplayName the display name for the contact
 * @param aPreferDisplayName set to true if the card display name should
 *                           override the header display name
 */
function create_contact(aEmailAddress, aDisplayName, aPreferDisplayName)
{
  let card = Cc["@mozilla.org/addressbook/cardproperty;1"]
               .createInstance(Ci.nsIAbCard);
  card.primaryEmail = aEmailAddress;
  card.displayName = aDisplayName;
  card.setProperty("PreferDisplayName", aPreferDisplayName ? true : false);
  return card;
}

/* Creates and returns a mailing list
 * @param aMailingListName the display name for the new mailing list
 */
function create_mailing_list(aMailingListName)
{
  var mailList = Cc["@mozilla.org/addressbook/directoryproperty;1"]
                   .createInstance(Ci.nsIAbDirectory);
  mailList.isMailList = true;
  mailList.dirName = aMailingListName;
  return mailList;
}

/* Finds and returns a mailing list with a given dirName within a
 * given address book.
 * @param aAddressBook the address book to search
 * @param aDirName the dirName of the mailing list
 */
function get_mailing_list_from_address_book(aAddressBook, aDirName)
{
  let mailingLists = aAddressBook.childNodes;
  while (mailingLists.hasMoreElements())
  {
    let item = mailingLists.getNext();
    let list = item.QueryInterface(Ci.nsIAbDirectory);
    if (list && list.dirName == aDirName)
      return list;
  }
  throw Error("Could not find a mailing list with dirName " + aDirName);
}

/* Given some address book, adds a collection of contacts to that
 * address book.
 * @param aAddressBook an address book to add the contacts to
 * @param aContacts a collection of nsIAbCards, or contacts,
 *                  where each contact has members "email"
 *                  and "displayName"
 *
 *                  Example:
 *                  [{email: 'test@example.com', displayName: 'Sammy Jenkis'}]
 */
function load_contacts_into_address_book(aAddressBook, aContacts)
{
  for each (contact in aContacts) {

    if (!(contact instanceof Ci.nsIAbCard))
      contact = create_contact(contact.email,
                               contact.displayName, true);

    aAddressBook.addCard(contact);
  }
}

/* Given some mailing list, adds a collection of contacts to that
 * mailing list.
 * @param aMailingList a mailing list to add the contacts to
 * @param aContacts a collection of contacts, where each contact is either
 *                  an nsIAbCard, or an object with members "email" and
 *                  "displayName"
 *
 *                  Example:
 *                  [{email: 'test@example.com', displayName: 'Sammy Jenkis'}]
 */
function load_contacts_into_mailing_list(aMailingList, aContacts)
{
  // Surprise! A mailing list is just a super special type of address
  // book.
  load_contacts_into_address_book(aMailingList, aContacts);
}

/* Given some address book, return the row index for that address book
 * in the tree view.  Throws an error if it cannot find the address book.
 * @param aAddrBook an address book to search for
 * @return the row index for that address book
 */
function get_address_book_tree_view_index(aAddrBook)
{
  let addrbooks = abController.window.gDirectoryTreeView._rowMap;
  for (let i = 0; i < addrbooks.length; i++) {
    if (addrbooks[i]._directory == aAddrBook) {
      return i;
    }
  }
  throw Error("Could not find the index for the address book named "
              + aAddrBook.dirName);
}

/* Given some contact, return the row index for that contact in the
 * address book view.  Assumes that the address book that the contact
 * belongs to is currently selected.  Throws an error if it cannot
 * find the contact.
 * @param aContact a contact to search for
 * @return the row index for that contact
 */
function get_contact_ab_view_index(aContact)
{
  let contacts = abController.window.gAbView;
  for (let i = 0; i < contacts.rowCount; i++) {
    let contact = contacts.getCardFromRow(i);
    if (contact.localId == aContact.localId &&
        !contact.isMailList)
      return i;
  }
  throw Error("Could not find the index for the contact named "
              + aContact.displayName);
}

/* Determines whether or not an address book is collapsed in
 * the tree view.
 * @param aAddrBook the address book to check
 * @return true if the address book is collapsed, otherwise false
 */
function is_address_book_collapsed(aAddrbook)
{
  let aIndex = get_address_book_tree_view_index(aAddrbook);
  return !abController.window.gDirectoryTreeView.isContainerOpen(aIndex);
}

/* Determines whether or not an address book is collapsible in
 * the tree view.
 * @param aAddrBook the address book to check
 * @return true if the address book is collapsible, otherwise false
 */
function is_address_book_collapsible(aAddrbook)
{
  let aIndex = get_address_book_tree_view_index(aAddrbook);
  return !abController.window.gDirectoryTreeView.isContainerEmpty(aIndex);
}

/* Sets one or more address books to the expanded state in the
 * tree view.  If any of the address books cannot be expanded,
 * an error is thrown.
 * @param aAddrBooks either a lone address book, or an array of
 *        address books
 */
function set_address_books_expanded(aAddrBooks)
{
  if (!Array.isArray(aAddrBooks))
    aAddrBooks = [aAddrBooks];

  for (let i = 0; i < aAddrBooks.length; i++)
  {
    let addrBook = aAddrBooks[i];
    if (!is_address_book_collapsible(addrBook))
      throw Error("Address book called " + addrBook.dirName
                  + " cannot be expanded.");
    if (is_address_book_collapsed(addrBook)) {
      let aIndex = get_address_book_tree_view_index(addrBook);
      abController.window.gDirectoryTreeView.toggleOpenState(aIndex);
    }
  }
}

/* Sets one or more address books to the collapsed state in the
 * tree view.  If any of the address books cannot be collapsed,
 * an error is thrown.
 * @param aAddrBooks either a lone address book, or an array of
 *        address books
 */
function set_address_books_collapsed(aAddrBooks)
{
  if (!Array.isArray(aAddrBooks))
    aAddrBooks = [aAddrBooks];

  for (let i = 0; i < aAddrBooks.length; i++)
  {
    let addrBook = aAddrBooks[i]
    if (!is_address_book_collapsible(addrBook))
      throw Error("Address book called " + addrBook.dirName
                  + " cannot be collapsed.");
    if (!is_address_book_collapsed(addrBook)) {
      let aIndex = get_address_book_tree_view_index(addrBook);
      abController.window.gDirectoryTreeView.toggleOpenState(aIndex);
    }
  }
}

/* Returns the displayed name of an address book in the tree view
 * at a particular row index.
 * @param aIndex the row index of the target address book
 * @return the displayed name of the address book
 */
function get_name_of_address_book_element_at(aIndex)
{
  return abController.window.gDirectoryTreeView.getCellText(aIndex, 0);
}

/* Selects a given address book in the tree view.  Assumes that
 * the parent of aAddrBook in the treeView is not collapsed.
 * Since mailing lists are technically address books, this will
 * work for mailing lists too.
 * @param aAddrBook an address book to select
 */
function select_address_book(aAddrBook)
{
  let aIndex = get_address_book_tree_view_index(aAddrBook);
  abController.window.gDirectoryTreeView.selection.select(aIndex);
}

/* Selects one or more contacts in an address book, assuming that
 * the address book is already selected.  Pass a single nsIAbCard
 * to select one contact, or an array of nsIAbCards to select
 * multiple.
 */
function select_contacts(aContacts)
{
  if (!Array.isArray(aContacts))
    aContacts = [aContacts];

  abController.window.gAbView.selection.clearSelection();
  for (let i = 0; i < aContacts.length; i++) {
    let aIndex = get_contact_ab_view_index(aContacts[i]);
    abController.window.gAbView.selection.toggleSelect(aIndex);
  }
}

/**
 * Opens the contact editing dialog for the selected contact. Callers
 * are responsible for closing the dialog.
 *
 * @param aController the address book window controller to use.
 * @param aFunction the function to execute when the editing dialog
 *                  is opened (since it's a modal dialog).  The function
 *                  should take a single parameter, which will be the
 *                  augmented controller for the editing dialog.
 */
function edit_selected_contact(aController, aFunction)
{
  windowHelper.plan_for_modal_dialog("abcardWindow", aFunction);
  aController.click(aController.eid("button-editcard"));
  windowHelper.wait_for_modal_dialog("abcardWindow");
}

/**
 * Accepts the changes entered into the contact editing dialog, and closes
 * the dialog.
 *
 * @param aController the contact editing dialog controller to use.
 */
function accept_contact_changes(aController)
{
  if (!aController.window.document.documentElement.acceptDialog())
    throw new Error("Could not close the contact editing dialog!");
}

/**
 * Deletes an address book.
 */
function delete_address_book(aAddrBook)
{
  MailServices.ab.deleteAddressBook(aAddrBook.URI);
}
