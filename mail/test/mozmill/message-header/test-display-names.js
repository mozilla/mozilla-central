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
 * The Mozilla Foundation
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jim Porter <jvporter@wisc.edu>
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
 * Test that we can open and close a standalone message display window from the
 *  folder pane.
 */
var MODULE_NAME = "test-display-names";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["folder-display-helpers", "address-book-helpers"];

var folder;
var decoyFolder;
var acctMgr;
var localAccount;
var secondIdentity;
var myEmail = "sender@nul.nul"; // Dictated by messagerInjector.js
var friendEmail = "carl@sagan.com";
var friendName = "Carl Sagan";
var headertoFieldYou;
var collectedAddresses;

function setupModule(module) {
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);
  let abh = collector.getModule("address-book-helpers");
  abh.installInto(module);

  acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
              .getService(Ci.nsIMsgAccountManager);
  localAccount = acctMgr.FindAccountForServer(acctMgr.localFoldersServer);

  // Delete all accounts except for Local Folders (so we only have 1 identity)
  for (let i=0; i<acctMgr.accounts.Count(); i++) {
    let account = acctMgr.accounts.QueryElementAt(i, Ci.nsIMsgAccount);
    if (account != localAccount)
      acctMgr.removeAccount(account);
  }

  folder = create_folder("MessageWindowB");
  decoyFolder = create_folder("MessageWindowC");

  add_message_to_folder(folder, create_message({to: [["", myEmail]] }));
  add_message_to_folder(folder, create_message({from: ["", friendEmail] }));
  add_message_to_folder(folder, create_message({from: [friendName, friendEmail] }));

  secondIdentity = acctMgr.createIdentity();
  secondIdentity.email = "nobody@nowhere.com";

  let abManager = Cc["@mozilla.org/abmanager;1"].getService(Ci.nsIAbManager);
  // Ensure all the directories are initialised.
  abManager.directories;
  collectedAddresses = abManager.getDirectory("moz-abmdbdirectory://history.mab");

  let bundle = Cc["@mozilla.org/intl/stringbundle;1"]
                 .getService(Ci.nsIStringBundleService).createBundle(
                   "chrome://messenger/locale/messenger.properties");
  headertoFieldYou = bundle.GetStringFromName("headertoFieldYou");
}

function ensure_single_identity() {
  if (localAccount.identities.Count() > 1)
    localAccount.removeIdentity(secondIdentity);
}

function ensure_multiple_identities() {
  if (localAccount.identities.Count() == 1) {
    localAccount.addIdentity(secondIdentity);
  }
}

function help_test_display_name(message, field, expectedValue) {
  // Switch to a decoy folder first to ensure that we refresh the message we're
  // looking at in order to update information changed in address book entries.
  be_in_folder(decoyFolder);
  be_in_folder(folder);
  let curMessage = select_click_row(message);

  let value = mc.window.document.getAnonymousElementByAttribute(
    mc.a("expanded"+field+"Box", {tagName: "mail-emailaddress"}),
    "class", "emaillabel").value;

  if (value != expectedValue)
    throw new Error("got '"+value+"' but expected '"+expectedValue+"'");
}

// XXX disabled due to failing on Windows.
/*
function test_single_identity() {
  ensure_no_card_exists(myEmail);
  ensure_single_identity();
  help_test_display_name(0, "to", headertoFieldYou);
}

function test_single_identity_in_abook() {
  ensure_card_exists(myEmail, "President Frankenstein", true);
  ensure_single_identity();
  help_test_display_name(0, "to", "President Frankenstein");
}

function test_single_identity_in_abook_no_pdn() {
  ensure_card_exists(myEmail, "President Frankenstein");
  ensure_single_identity();
  help_test_display_name(0, "to", headertoFieldYou);
}

*/

function test_multiple_identities() {
  ensure_no_card_exists(myEmail);
  ensure_multiple_identities();
  help_test_display_name(0, "to", headertoFieldYou+" <"+myEmail+">");
}

function test_multiple_identities_in_abook() {
  ensure_card_exists(myEmail, "President Frankenstein", true);
  ensure_multiple_identities();
  help_test_display_name(0, "to", "President Frankenstein");
}

function test_multiple_identities_in_abook_no_pdn() {
  ensure_card_exists(myEmail, "President Frankenstein");
  ensure_multiple_identities();
  help_test_display_name(0, "to", headertoFieldYou+" <"+myEmail+">");
}



function test_no_header_name() {
  ensure_no_card_exists(friendEmail);
  ensure_single_identity();
  help_test_display_name(1, "from", friendEmail);
}

function test_no_header_name_in_abook() {
  ensure_card_exists(friendEmail, "My Buddy", true);
  ensure_single_identity();
  help_test_display_name(1, "from", "My Buddy");
}

function test_no_header_name_in_abook_no_pdn() {
  ensure_card_exists(friendEmail, "My Buddy");
  ensure_single_identity();
  help_test_display_name(1, "from", "My Buddy");
}



function test_header_name() {
  ensure_no_card_exists(friendEmail);
  ensure_single_identity();
  help_test_display_name(2, "from", friendName+" <"+friendEmail+">");
}

function test_header_name_in_abook() {
  ensure_card_exists(friendEmail, "My Buddy", true);
  ensure_single_identity();
  help_test_display_name(2, "from", "My Buddy");
}

function test_header_name_in_abook_no_pdn() {
  ensure_card_exists(friendEmail, "My Buddy");
  ensure_single_identity();
  help_test_display_name(2, "from", "Carl Sagan");
}