/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * The Original Code is mozilla.org Address Book code
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mark Banner <bugzilla@standard8.plus.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");


const ACR = Components.interfaces.nsIAutoCompleteResult;
const nsIAbAutoCompleteResult = Components.interfaces.nsIAbAutoCompleteResult;

function nsAbAutoCompleteResult(aSearchString) {
  // Can't create this in the prototype as we'd get the same array for
  // all instances
  this._searchResults = new Array();
  this.searchString = aSearchString;
}

nsAbAutoCompleteResult.prototype = {
  _searchResults: null,

  // nsIAutoCompleteResult

  searchString: null,
  searchResult: ACR.RESULT_NOMATCH,
  defaultIndex: -1,
  errorDescription: null,

  get matchCount() {
    return this._searchResults.length;
  },

  getValueAt: function getValueAt(aIndex) {
    return this._searchResults[aIndex].value;
  },

  getCommentAt: function getCommentAt(aIndex) {
    return this._searchResults[aIndex].comment;
  },

  getStyleAt: function getStyleAt(aIndex) {
    return "local-abook";
  },

  getImageAt: function getImageAt(aIndex) {
    return "";
  },

  removeValueAt: function removeValueAt(aRowIndex, aRemoveFromDB) {
  },

  // nsIAbAutoCompleteResult

  getCardAt: function getCardAt(aIndex) {
    return this._searchResults[aIndex].card;
  },

  // nsISupports

  QueryInterface: XPCOMUtils.generateQI([ACR, nsIAbAutoCompleteResult])
}

function nsAbAutoCompleteSearch() {}

nsAbAutoCompleteSearch.prototype = {
  // For component registration
  classDescription: "Address Book Autocomplete",
  classID: Components.ID("2f946df9-114c-41fe-8899-81f10daf4f0c"),
  contractID: "@mozilla.org/autocomplete/search;1?name=addrbook",

  // This is set from a preference,
  // 0 = no comment column, 1 = name of address book this card came from
  // Other numbers currently unused (hence default to zero)
  _commentColumn: 0,
  _parser: Components.classes["@mozilla.org/messenger/headerparser;1"]
                     .getService(Components.interfaces.nsIMsgHeaderParser),

  // Private methods
  _searchCards: function _searchCards(fullString, firstWord, rest, directory,
                                      result) {
    var childCards = directory.childCards;

    // Cache this values to save going through xpconnect each time
    var commentColumn = this._commentColumn == 1 ? directory.dirName : "";

    // Now iterate through all the cards.
    while (childCards.hasMoreElements()) {
      var card = childCards.getNext();

      if (card instanceof Components.interfaces.nsIAbCard &&
          this._checkEntry(card, fullString, firstWord, rest))
        this._addToResult(commentColumn, card, result);
    }
  },

  // fullString is the full search string.
  // firstWord is the first word of the search string.
  // rest is anything after the first word.
  _checkEntry: function _checkEntry(card, fullString, firstWord, rest) {
    var i;
    if (card.isMailList) {
      return card.displayName.toLocaleLowerCase().lastIndexOf(fullString, 0) == 0 ||
        card.getProperty("Notes", "").toLocaleLowerCase().lastIndexOf(fullString, 0) == 0 ||
        card.getProperty("NickName", "").toLocaleLowerCase().lastIndexOf(fullString, 0) == 0;
    }

    var firstName = card.firstName.toLocaleLowerCase();
    var lastName = card.lastName.toLocaleLowerCase();
    if (card.displayName.toLocaleLowerCase().lastIndexOf(fullString, 0) == 0 ||
        firstName.lastIndexOf(fullString, 0) == 0 ||
        lastName.lastIndexOf(fullString, 0) == 0 ||
        card.primaryEmail.toLocaleLowerCase().lastIndexOf(fullString, 0) == 0)
      return true;

    if (firstWord && rest &&
        ((firstName.lastIndexOf(firstWord, 0) == 0 &&
          lastName.lastIndexOf(rest, 0) == 0) ||
         (firstName.lastIndexOf(rest, 0) == 0 &&
          lastName.lastIndexOf(firstWord, 0) == 0)))
      return true;

    if (card.getProperty("NickName", "").toLocaleLowerCase().lastIndexOf(fullString, 0) == 0)
      return true;

    return false;
  },

  _checkDuplicate: function _checkDuplicate(card, emailAddress, currentResults) {
    var lcEmailAddress = emailAddress.toLocaleLowerCase();

    var popIndex = parseInt(card.getProperty("PopularityIndex", "0"));
    for (var i = 0; i < currentResults._searchResults.length; ++i) {
      if (currentResults._searchResults[i].value.toLocaleLowerCase() ==
          lcEmailAddress)
      {
        // It's a duplicate, is the new one is more popular?
        if (popIndex > currentResults._searchResults[i].popularity) {
          // Yes it is, so delete this element, return false and allow
          // _addToResult to sort the new element into the correct place.
          currentResults._searchResults.splice(i, 1);
          return false;
        }
        // Not more popular, but still a duplicate. Return true and _addToResult
        // will just forget about it.
        return true;
      }
    }
    return false;
  },

  _addToResult: function _addToResult(commentColumn, card, result) {
    var emailAddress =
      this._parser.makeFullAddress(card.displayName,
                                   card.isMailList ?
                                   card.getProperty("Notes", "") || card.displayName :
                                   card.primaryEmail);

    // The old code used to try it manually. I think if the parser can't work
    // out the address from what we've supplied, then its busted and we're not
    // going to do any better doing it manually.
    if (!emailAddress)
      return;

    // If it is a duplicate, then just return and don't add it. The
    // _checkDuplicate function deals with it all for us.
    if (this._checkDuplicate(card, emailAddress, result))
      return;

    // Find out where to insert the card.
    var insertPosition = 0;
    // Hack - mork adds in as a string, but we want to get as an integer...
    var cardPopularityIndex = parseInt(card.getProperty("PopularityIndex", "0"));

    while (insertPosition < result._searchResults.length &&
           cardPopularityIndex <
           result._searchResults[insertPosition].popularity)
      ++insertPosition;

    // Next sort on full address
    while (insertPosition < result._searchResults.length &&
           cardPopularityIndex ==
           result._searchResults[insertPosition].popularity &&
           emailAddress > result._searchResults[insertPosition].value)
      ++insertPosition;

    result._searchResults.splice(insertPosition, 0, {
      value: emailAddress,
      comment: commentColumn,
      card: card,
      popularity: cardPopularityIndex
    });
  },

  // nsIAutoCompleteSearch
  startSearch: function startSearch(aSearchString, aSearchParam,
                                    aPreviousResult, aListener) {
    var result = new nsAbAutoCompleteResult(aSearchString);

    // If the search string isn't value, or contains a comma, or the user
    // hasn't enabled autocomplete, then just return no matches / or the
    // result ignored.
    // The comma check is so that we don't autocomplete against the user
    // entering multiple addresses.
    if (!aSearchString || /,/.test(aSearchString)) {
      result.searchResult = ACR.RESULT_IGNORED;
      aListener.onSearchResult(this, result);
      return;
    }

    var prefSvc = Components.classes["@mozilla.org/preferences-service;1"]
                            .getService(Components.interfaces.nsIPrefBranch);

    // Find out about the comment column
    try {
      this._commentColumn = prefSvc.getIntPref("mail.autoComplete.commentColumn");
    } catch(e) { }

    // Craft this by hand - we want the first item to contain the full string,
    // the second item with just the first word, and the third item with
    // anything after the first word.
    var fullString = aSearchString.toLocaleLowerCase();
    var firstWord = "";
    var rest = "";
    var pos = fullString.indexOf(" ");

    if (pos != -1) {
      firstWord = fullString.substr(0, pos);
      rest = fullString.substr(pos + 1, fullString.length - pos - 1);
    }

    if (aPreviousResult instanceof nsIAbAutoCompleteResult &&
        aSearchString.lastIndexOf(aPreviousResult.searchString, 0) == 0 &&
        aPreviousResult.searchResult == ACR.RESULT_SUCCESS) {
      // We have successful previous matches, therefore iterate through the
      // list and reduce as appropriate
      for (var i = 0; i < aPreviousResult.matchCount; ++i) {
        if (this._checkEntry(aPreviousResult.getCardAt(i), fullString,
                             firstWord, rest))
          // If it matches, just add it straight onto the array, these will
          // already be in order because the previous search returned them
          // in the correct order.
          result._searchResults.push({
            value: aPreviousResult.getValueAt(i),
            comment: aPreviousResult.getCommentAt(i),
            card: aPreviousResult.getCardAt(i),
            popularity: parseInt(aPreviousResult.getCardAt(i).getProperty("PopularityIndex", "0"))
          });
      }
    }
    else
    {
      // Now do the searching
      var allABs = Components.classes["@mozilla.org/abmanager;1"]
                             .getService(Components.interfaces.nsIAbManager)
                             .directories;

      // We're not going to bother searching sub-directories, currently the
      // architecture forces all cards that are in mailing lists to be in ABs as
      // well, therefore by searching sub-directories (aka mailing lists) we're
      // just going to find duplicates.
      while (allABs.hasMoreElements()) {
        var dir = allABs.getNext();

        if (dir instanceof Components.interfaces.nsIAbDirectory &&
            dir.useForAutocomplete(aSearchParam)) {
          this._searchCards(fullString, firstWord, rest, dir, result);
        }
      }
    }

    if (result.matchCount) {
      result.searchResult = ACR.RESULT_SUCCESS;
      result.defaultIndex = 0;
    }

    aListener.onSearchResult(this, result);
  },

  stopSearch: function stopSearch() {
  },

  // nsISupports

  QueryInterface: XPCOMUtils.generateQI([Components.interfaces
                                                   .nsIAutoCompleteSearch])
};

// Module

let components = [nsAbAutoCompleteSearch];

function NSGetModule(compMgr, fileSpec)
{
  return XPCOMUtils.generateModule(components);
}
