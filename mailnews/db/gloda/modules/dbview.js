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
 * The Initial Developer of the Original Code is
 * Mozilla Messaging, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2008
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
 * This file is charged with providing you a way to have a pretty gloda-backed
 *  nsIMsgDBView.
 */

EXPORTED_SYMBOLS = ["GlodaSyntheticSearchView", "GlodaViewFactory"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://app/modules/gloda/log4moz.js");

Cu.import("resource://app/modules/gloda/public.js");
Cu.import("resource://app/modules/gloda/msg_search.js");

function GlodaScoreColumn(aSearcher) {
  this.searcher = aSearcher;
}
GlodaScoreColumn.prototype = {
  id: "glodaScoreCol",
  bindToView: function (aDBView) {
    this.dbView = aDBView;
  },

  getCellText: function(row, col) {
    let folder = this.dbView.getFolderForViewIndex(row);
    let key = this.dbView.getKeyAt(row);
    return "" + this.searcher.scoresByUriAndKey[folder.URI + "-" + key];
  },
  getSortLongForRow:   function(hdr) {
    return this.searcher.scoresByUriAndKey[
      hdr.folder.URI + "-" + hdr.messageKey] || 0;
  },
  isString: function() {
    return false;
  },

  getCellProperties:   function(row, col, props){},
  getRowProperties:    function(row, props){},
  getImageSrc:         function(row, col) {return null;},
  getSortStringForRow: function(hdr) {
    return null;
  },
};

function GlodaWhyColumn(aSearcher) {
  this.searcher = aSearcher;
}
GlodaWhyColumn.prototype = {
  id: "glodaWhyCol",
  bindToView: function (aDBView) {
    this.dbView = aDBView;
  },

  getCellText: function(row, col) {
    let folder = this.dbView.getFolderForViewIndex(row);
    let key = this.dbView.getKeyAt(row);
    return this.searcher.whysByUriAndKey[folder.URI + "-" + key] || "";
  },
  getSortStringForRow: function(hdr) {
    return this.searcher.whysByUriAndKey[hdr.folder.URI + "-" + hdr.messageKey]
      || "";
  },
  isString: function() {
    return true;
  },

  getCellProperties:   function(row, col, props){},
  getRowProperties:    function(row, props){},
  getImageSrc:         function(row, col) {return null;},
  getSortLongForRow:   function(hdr) {return 0;}
};

function GlodaSyntheticSearchView(aSearchString, aFacetString, aLocation) {
  this.searcher = new GlodaMsgSearcher(this, aSearchString.split(" "));

  this._whyColumn = new GlodaWhyColumn(this.searcher);
  this._scoreColumn = new GlodaScoreColumn(this.searcher);

  this.customColumns = [this._whyColumn, this._scoreColumn];

  this.collection = null;
  this._whyMap = {};
  this._scoreMap = {};

  this.searchString = aSearchString;
  this.facetString = aFacetString;
  this.location = aLocation;
}
GlodaSyntheticSearchView.prototype = {
  defaultSort: [["glodaScoreCol", Ci.nsMsgViewSortOrder.descending]],

  /**
   * Request the search be performed and notification provided to
   *  aSearchListener.  If results are already available, they should
   *  be provided to aSearchListener without re-performing the search.
   */
  search: function(aSearchListener, aCompletionCallback) {
    this.searchListener = aSearchListener;
    this.completionCallback = aCompletionCallback;

    this.searchListener.onNewSearch();
    if (this.collection) {
      this.reportResults(this.collection.items);
      // we're not really aborting, but it closes things out nicely
      this.abortSearch();
      return;
    }

    this.collection = this.searcher.go();
  },

  abortSearch: function() {
    if (this.searchListener)
      this.searchListener.onSearchDone(Cr.NS_OK);
    if (this.completionCallback)
      this.completionCallback();
    this.searchListener = null;
    this.completionCallback = null;
  },

  reportResults: function(aItems) {
    for each (let [, item] in Iterator(aItems)) {
      let hdr = item.folderMessage;
      this.searchListener.onSearchHit(hdr, hdr.folder);
    }
  },

  // --- collection listener
  onItemsAdded: function(aItems, aCollection) {
    if (this.searchListener)
      this.reportResults(aItems);
  },
  onItemsModified: function(aItems, aCollection) {
  },
  onItemsRemoved: function(aItems, aCollection) {
  },
  onQueryCompleted: function(aCollection) {
    this.searchListener.onSearchDone(Cr.NS_OK);
    if (this.completionCallback)
      this.completionCallback();
  },
};

var GlodaViewFactory = {
  kFacetEverything: "everything",
  kFacetSubject: "subject",
  kFacetBody: "body",
  kFacetAttachments: "attachments",
  kFacetInvolves: "involves",
  kFacetTo: "to",
  kFacetFrom: "from",
};
