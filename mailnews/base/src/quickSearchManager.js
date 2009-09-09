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
 * The Original Code is Mozilla Communicator client code, released
 * March 31, 1998.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998-1999
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Seth Spitzer <sspitzer@netscape.com>
 *   Scott MacGregor <mscott@mozilla.org>
 *   David Bienvenu <bienvenu@nventure.com>
 *   Andrew Sutherland <asutherland@asutherland.org>
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

/*
 * This file mimics mailViewManager.js.  It shares the same idiom of creating
 *  lists of search terms, and so is really quite similar.  Except the term
 *  Manager is all wrong; however, we keep it for parallel construction and
 *  ease of searching.
 */

EXPORTED_SYMBOLS = ['QuickSearchManager', 'QuickSearchConstants'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://app/modules/errUtils.js");

try {
  Cu.import("resource://app/modules/StringBundle.js");
} catch (e) {
  logException(e);
}

const nsMsgSearchScope = Ci.nsMsgSearchScope;
const nsMsgSearchAttrib = Ci.nsMsgSearchAttrib;
const nsMsgSearchOp = Ci.nsMsgSearchOp;

/**
 * Constants originally found in searchBar.js bundled together into a single
 *  name-space contribution.
 *
 * These constants are used by quick-search-menupopup.  The state of
 *  quick-search-menupopup is persisted to localstore.rdf, so new values need
 *  new constants.
 */
var QuickSearchConstants = {
  kQuickSearchSubject: 0,
  kQuickSearchFrom: 1,
  kQuickSearchFromOrSubject: 2,
  kQuickSearchRecipient: 3,
  kQuickSearchRecipientOrSubject: 4,
  kQuickSearchBody: 5
};
const kQuickSearchCount = 6;

var QuickSearchLabels = null; // populated dynamically from properties files

/**
 * All quick search logic that takes us from a search string (and search mode)
 *  to a set of search terms goes in here.  Check out FolderDisplayWidget for
 *  display concerns involving views, or DBViewWrapper and SearchSpec for the
 *  actual nsIMsgDBView-related logic.
 */
var QuickSearchManager = {

  _modeLabels: {},

  /**
   * Populate an associative array containing the labels from a properties file
   */
  loadLabels: function QuickSearchManager_loadLabels() {
    const quickSearchStrings =
      new StringBundle("chrome://messenger/locale/quickSearch.properties");
    this._modeLabels[QuickSearchConstants.kQuickSearchSubject] =
      quickSearchStrings.get("searchSubject.label");
    this._modeLabels[QuickSearchConstants.kQuickSearchFrom] =
      quickSearchStrings.get("searchFrom.label");
    this._modeLabels[QuickSearchConstants.kQuickSearchFromOrSubject] =
      quickSearchStrings.get("searchFromOrSubject.label");
    this._modeLabels[QuickSearchConstants.kQuickSearchRecipient] =
      quickSearchStrings.get("searchRecipient.label");
    this._modeLabels[QuickSearchConstants.kQuickSearchRecipientOrSubject] =
      quickSearchStrings.get("searchRecipientOrSubject.label");
    this._modeLabels[QuickSearchConstants.kQuickSearchBody] =
      quickSearchStrings.get("searchBody.label");
  },

  /**
   * Create the structure that the UI needs to fully describe a quick search
   * mode.
   *
   * @return a list of array objects mapping 'value' to the constant specified
   * in QuickSearchConstants, and 'label' to a localized string.
   */
  getSearchModes: function QuickSearchManager_getSearchModes() {
    let modes = [];
    for (let i = 0; i < kQuickSearchCount; i++)
      modes.push({'value': i, 'label': this._modeLabels[i]});
    return modes;
  },

  /**
   * Create the search terms for the given quick-search configuration.  This is
   *  intended to basically be directly used in the service of the UI without
   *  pre-processing.  If you want to add extra logic, probably add it in here
   *  (with appropriate refactoring.)
   * Callers should strongly consider using DBViewWrapper's search attribute
   *  (which is a SearchSpec)'s quickSearch method which in turn calls us.  The
   *  DBViewWrapper may in turn be embedded in a FolderDisplayWidget.  So an
   *  example usage might be:
   *
   * gFolderDisplay.view.search.quickSearch(
   *   QuickSearchConstants.kQuickSearchSubject, "foo|bar");
   *
   * @param aTermCreator A nsIMsgSearchSession or other interface with a
   *     createTerm method.
   * @param aSearchMode One of the QuickSearchConstants.kQuickSearch* search
   *     mode constants specifying what parts of the message to search on.
   * @param aSearchString The search string, consisting of sub-strings delimited
   *     by '|' to be OR-ed together.  Given the string "foo" we search for
   *     messages containing "foo".  Given the string "foo|bar", we search for
   *     messages containing "foo" or "bar".
   * @return a list of nsIMsgSearch term instances representing the search as
   *     defined by the arguments.
   */
  createSearchTerms: function QuickSearchManager_createSearchTerms(
      aTermCreator, aSearchMode, aSearchString) {
    let searchTerms = [];
    let termList = aSearchString.split("|");
    for (var i = 0; i < termList.length; i ++)
    {
      // if the term is empty, skip it
      if (termList[i] == "")
        continue;

      // create, fill, and append the subject term
      let term;
      let value;

      // if our search criteria is subject or subject|from then add a term for
      // the subject
      if (aSearchMode == QuickSearchConstants.kQuickSearchSubject ||
          aSearchMode == QuickSearchConstants.kQuickSearchFromOrSubject ||
          aSearchMode == QuickSearchConstants.kQuickSearchRecipientOrSubject)
      {
        term = aTermCreator.createTerm();
        value = term.value;
        value.str = termList[i];
        term.value = value;
        term.attrib = nsMsgSearchAttrib.Subject;
        term.op = nsMsgSearchOp.Contains;
        term.booleanAnd = false;
        searchTerms.push(term);
      }

      if (aSearchMode == QuickSearchConstants.kQuickSearchBody)
      {
        // what do we do for news and imap users that aren't configured for offline use?
        // in these cases the body search will never return any matches. Should we try to
        // see if body is a valid search scope in this particular case before doing the search?
        // should we switch back to a subject/from search behind the scenes?
        term = aTermCreator.createTerm();
        value = term.value;
        value.str = termList[i];
        term.value = value;
        term.attrib = nsMsgSearchAttrib.Body;
        term.op = nsMsgSearchOp.Contains;
        term.booleanAnd = false;
        searchTerms.push(term);
      }

      // create, fill, and append the from (or recipient) term
      if (aSearchMode == QuickSearchConstants.kQuickSearchFrom ||
          aSearchMode == QuickSearchConstants.kQuickSearchFromOrSubject)
      {
        term = aTermCreator.createTerm();
        value = term.value;
        value.str = termList[i];
        term.value = value;
        term.attrib = nsMsgSearchAttrib.Sender;
        term.op = nsMsgSearchOp.Contains;
        term.booleanAnd = false;
        searchTerms.push(term);
      }

      // create, fill, and append the recipient
      if (aSearchMode == QuickSearchConstants.kQuickSearchRecipient ||
          aSearchMode == QuickSearchConstants.kQuickSearchRecipientOrSubject)
      {
        term = aTermCreator.createTerm();
        value = term.value;
        value.str = termList[i];
        term.value = value;
        term.attrib = nsMsgSearchAttrib.ToOrCC;
        term.op = nsMsgSearchOp.Contains;
        term.booleanAnd = false;
        searchTerms.push(term);
      }
    }

    return searchTerms.length ? searchTerms : null;
  }
};

QuickSearchManager.loadLabels();
