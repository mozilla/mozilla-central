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
var MODULE_REQUIRES = ['address-book-helpers', 'folder-display-helpers'];

let abController = null;

var addrBook1, addrBook2, addrBook3, addrBook4;
var mListA, mListB, mListC, mListD, mListE;

function setupModule(module)
{
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);

  let abh = collector.getModule('address-book-helpers');
  abh.installInto(module);

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

