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
 * Mozilla Messaging, Inc.
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

var Ci = Components.interfaces;
var Cc = Components.classes;
var Cu = Components.utils;

const MODULE_NAME = "address-book-helpers";
const RELATIVE_ROOT = "../shared-modules";

var collectedAddresses;

function setupModule() {
  let abManager = Cc["@mozilla.org/abmanager;1"].getService(Ci.nsIAbManager);
  // Ensure all the directories are initialised.
  abManager.directories;
  collectedAddresses = abManager.getDirectory("moz-abmdbdirectory://history.mab");
}

function installInto(module) {
  setupModule();

  // Now copy helper functions
  module.ensure_card_exists = ensure_card_exists;
  module.ensure_no_card_exists = ensure_no_card_exists;
}

/**
 * Make sure that there is a card for this email address
 * @param emailAddress the address that should have a card
 * @param displayName the display name the card should have
 * @param preferDisplayName |true| if the card display name should override the
 *                          header display name
 */
function ensure_card_exists(emailAddress, displayName, preferDisplayName) {
  ensure_no_card_exists(emailAddress);
  let card = Cc["@mozilla.org/addressbook/cardproperty;1"]
               .createInstance(Ci.nsIAbCard);

  card.primaryEmail = emailAddress;
  card.displayName = displayName;
  card.setProperty("PreferDisplayName", preferDisplayName ? true : false);
  collectedAddresses.addCard(card);
}

/**
 * Make sure that there is no card for this email address
 * @param emailAddress the address that should have no cards
 */
function ensure_no_card_exists(emailAddress)
{
  var books = Cc["@mozilla.org/abmanager;1"].getService(Ci.nsIAbManager)
                .directories;

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

