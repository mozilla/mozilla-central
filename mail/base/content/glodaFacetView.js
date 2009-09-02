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
 * Portions created by the Initial Developer are Copyright (C) 2009
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
 * This file provides the global context for the faceting environment.  In the
 *  Model View Controller (paradigm), we are the view and the XBL widgets are
 *  the the view and controller.
 *
 * Because much of the work related to faceting is not UI-specific, we try and
 *  push as much of it into mailnews/db/gloda/facet.js.  In some cases we may
 *  get it wrong and it may eventually want to migrate.
 */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://app/modules/gloda/log4moz.js");
Cu.import("resource://app/modules/StringBundle.js");
Cu.import("resource://app/modules/PluralForm.jsm");
Cu.import("resource://app/modules/errUtils.js");
Cu.import("resource://app/modules/templateUtils.js");

Cu.import("resource://app/modules/gloda/public.js");
Cu.import("resource://app/modules/gloda/facet.js");

const glodaFacetStrings =
  new StringBundle("chrome://messenger/locale/glodaFacetView.properties");

/**
 *
 */
function ActiveConstraint(aFaceter, aAttrDef, aInclusive, aGroupValues,
                          aRanged) {
  this.faceter = aFaceter;
  this.attrDef = aAttrDef;
  this.inclusive = aInclusive;
  this.ranged = Boolean(aRanged);
  this.groupValues = aGroupValues;

  this._makeQuery();
}
ActiveConstraint.prototype = {
  _makeQuery: function() {
    // have the faceter make the query and the invert decision for us if it
    //  implements the makeQuery method.
    if ("makeQuery" in this.faceter) {
      [this.query, this.invertQuery] = this.faceter.makeQuery(this.groupValues,
                                                              this.inclusive);
      return;
    }

    let query = this.query = Gloda.newQuery(Gloda.NOUN_MESSAGE);
    let constraintFunc;
    // If the facet definition references a queryHelper defined by the noun
    //  type, use that instead of the standard constraint function.
    if ("queryHelper" in this.attrDef.facet)
      constraintFunc = query[this.attrDef.boundName +
                             this.attrDef.facet.queryHelper];
    else
      constraintFunc = query[this.ranged ? (this.attrDef.boundName + "Range")
                                         : this.attrDef.boundName];
    constraintFunc.apply(query, this.groupValues);

    this.invertQuery = !this.inclusive;
  },
  /**
   * Adjust the constraint given the incoming faceting constraint desired.
   *  Mainly, if the inclusive flag is the same as what we already have, we
   *  just append the new values to the existing set of values.  If it is not
   *  the same, we replace them.
   */
  adjust: function(aInclusive, aGroupValues) {
    if (aInclusive == this.inclusive) {
      this.groupValues = this.groupValues.concat(aGroupValues);
      this._makeQuery();
      return;
    }

    this.inclusive = aInclusive;
    this.groupValues = aGroupValues;
    this._makeQuery();
  },
  /**
   * Replace the existing constraints with the new constraint.
   */
  replace: function(aInclusive, aGroupValues) {
    this.inclusive = aInclusive;
    this.groupValues = aGroupValues;
    this._makeQuery();
  },
  /**
   * Filter the items against our constraint.
   */
  sieve: function(aItems) {
    let query = this.query;
    let expectedResult = !this.invertQuery;
    let outItems = [];
    for each (let [, item] in Iterator(aItems)) {
      if (query.test(item) == expectedResult)
        outItems.push(item);
    }
    return outItems;
  }
};

var FacetContext = {
  facetDriver: new FacetDriver(Gloda.lookupNounDef("message"),
                               window),

  /**
   * The root collection which our active set is a subset of.  We hold onto this
   *  for garbage collection reasons, although the tab that owns us should also
   *  be holding on.
   */
  _collection: null,
  set collection(aCollection) {
    this._collection = aCollection;
  },
  get collection() {
    return this._collection;
  },

  /**
   * List of the current working set
   */
  _activeSet: null,
  get activeSet() {
    return this._activeSet;
  },

  initialBuild: function() {
    let queryExplanation = document.getElementById("query-explanation");
    if (this.searcher)
      queryExplanation.setFulltext(this.searcher);
    else
      queryExplanation.setQuery(this.collection.query);
    // we like to sort them so should clone the list
    this.faceters = this.facetDriver.faceters.concat();

    this.everFaceted = false;

    this.build(this._collection.items);
  },

  build: function(aNewSet) {
    this._activeSet = aNewSet;
    this.facetDriver.go(this._activeSet, this.facetingCompleted, this);
  },

  /**
   * Attempt to figure out a reasonable number of rows to limit each facet to
   *  display.  While the number will ordinarily be dominated by the maximum
   *  number of rows we believe the user can easily scan, this may also be
   *  impacted by layout concerns (since we want to avoid scrolling).
   */
  planLayout: function() {
    // XXX arbitrary!
    this.maxDisplayRows = 8;
    this.maxMessagesToShow = 8;
  },

  _groupCountComparator: function(a, b) {
    return b.groupCount - a.groupCount;
  },
  /**
   * Tells the UI about all the facets when notified by the |facetDriver| when
   *  it is done faceting everything.
   */
  facetingCompleted: function() {
    this.planLayout();

    let uiFacets = document.getElementById("facets");

    if (!this.everFaceted) {
      this.everFaceted = true;
      this.faceters.sort(this._groupCountComparator);
      for each (let [, faceter] in Iterator(this.faceters)) {
        let attrName = faceter.attrDef.attributeName;
        let explicitBinding = document.getElementById("facet-" + attrName);

        if (explicitBinding) {
          explicitBinding.faceter = faceter;
          explicitBinding.attrDef = faceter.attrDef;
          explicitBinding.nounDef = faceter.attrDef.objectNounDef;
          explicitBinding.orderedGroups = faceter.orderedGroups;
          // explicit booleans should always be displayed for consistency
          if (faceter.groupCount >= 1 ||
              faceter.type == "boolean") {
            explicitBinding.build(true);
            explicitBinding.removeAttribute("uninitialized");
          }
          faceter.xblNode = explicitBinding;
          continue;
        }

        // ignore facets that do not vary!
        if (faceter.groupCount <= 1) {
          faceter.xblNode = null;
          continue;
        }

        faceter.xblNode = uiFacets.addFacet(faceter.type, faceter.attrDef, {
          faceter: faceter,
          orderedGroups: faceter.orderedGroups,
          maxDisplayRows: this.maxDisplayRows,
        });
      }
    }
    else {
      for each (let [, faceter] in Iterator(this.faceters)) {
        // Do not bother with un-displayed facets, or that are locked by a
        //  constraint.  But do bother if the widget can be updated without
        //  losing important data.
        if (!faceter.xblNode ||
            (faceter.constraint && !faceter.xblNode.canUpdate))
          continue;

        // hide things that have 0/1 groups now and are not constrained and not
        //  boolean
        if (faceter.groupCount <= 1 && !faceter.constraint &&
            (faceter.type != "boolean"))
          $(faceter.xblNode).hide();
        // otherwise, update
        else {
          faceter.xblNode.orderedGroups = faceter.orderedGroups;
          faceter.xblNode.build(false);
          $(faceter.xblNode).show();
        }
      }
    }

    let results = document.getElementById("results");
    let numMessageToShow = Math.min(this.maxMessagesToShow,
                                    this._activeSet.length);
    results.setMessages(this._activeSet.slice(0, numMessageToShow));
  },

  _HOVER_STABILITY_DURATION_MS: 100,
  _brushedFacet: null,
  _brushedGroup: null,
  _brushedItems: null,
  _brushTimeout: null,
  hoverFacet: function(aFaceter, aAttrDef, aGroupValue, aGroupItems) {
    // bail if we are already brushing this item
    if (this._brushedFacet == aFaceter && this._brushedGroup == aGroupValue)
      return;

    this._brushedFacet = aFaceter;
    this._brushedGroup = aGroupValue;
    this._brushedItems = aGroupItems;

    if (this._brushTimeout != null)
      clearTimeout(this._brushTimeout);
    this._brushTimeout = setTimeout(this._timeoutHoverWrapper,
                                    this._HOVER_STABILITY_DURATION_MS, this);

  },
  _timeoutHover: function() {
    this._brushTimeout = null;
    for each (let [, faceter] in Iterator(this.faceters)) {
      if (faceter == this._brushedFacet || !faceter.xblNode)
        continue;

      if (this._brushedItems != null)
        faceter.xblNode.brushItems(this._brushedItems);
      else
        faceter.xblNode.clearBrushedItems();
    }
  },
  _timeoutHoverWrapper: function(aThis) {
    aThis._timeoutHover();
  },
  unhoverFacet: function(aFaceter, aAttrDef, aGroupValue, aGroupItems) {
    // have we already brushed from some other source already?  ignore then.
    if (this._brushedFacet != aFaceter || this._brushedGroup != aGroupValue)
      return;

    // reuse hover facet to null everyone out
    this.hoverFacet(null, null, null, null);
  },

  /**
   * Maps attribute names to their corresponding |ActiveConstraint|, if they
   *  have one.
   */
  _activeConstraints: {},
  /**
   * Called by facets when the user does some clicking and wants to impose a new
   *  constraint.
   *
   * @param aFaceter
   * @param aAttrDef
   * @param {Boolean} aInclusive
   * @param aGroupValues
   * @param aRanged Is it a ranged constraint?  (Currently only for dates)
   * @param aNukeExisting Do we need to replace the existing constraint and
   *     re-sieve everything?  This currently only happens for dates, where
   *     our display allows a click to actually make our range more generic
   *     than it currently is.  (But this only matters if we already have
   *     a date constraint applied.)
   */
  addFacetConstraint: function(aFaceter, aAttrDef, aInclusive, aGroupValues,
                               aRanged, aNukeExisting) {
    let attrName = aAttrDef.attributeName;

    let constraint;
    let needToSieveAll = false;
    if (attrName in this._activeConstraints) {
      constraint = this._activeConstraints[attrName];

      needToSieveAll = true;
      if (aNukeExisting)
        constraint.replace(aInclusive, aGroupValues);
      else
        constraint.adjust(aInclusive, aGroupValues);
    }
    else {
      constraint = this._activeConstraints[attrName] =
        new ActiveConstraint(aFaceter, aAttrDef, aInclusive, aGroupValues,
                             aRanged);
    }
    aFaceter.constraint = constraint;

    // Given our current implementation, we can only be further constraining our
    //  active set, so we can just sieve the existing active set with the
    //  (potentially updated) constraint.  In some cases, it would be much
    //  cheaper to use the facet's knowledge about the items in the groups, but
    //  for now let's keep a single code-path for how we refine the active set.
    this.build(needToSieveAll ? this._sieveAll()
                              : constraint.sieve(this.activeSet));
  },

  removeFacetConstraint: function(aFaceter) {
    let attrName = aFaceter.attrDef.attributeName;
    delete this._activeConstraints[attrName];
    aFaceter.constraint = null;

    // we definitely need to re-sieve everybody in this case...
    this.build(this._sieveAll());
  },

  /**
   * Sieve the items from the underlying collection against all constraints,
   *  returning the value.
   */
  _sieveAll: function() {
    let items = this.collection.items;

    for each (let [, constraint] in Iterator(this._activeConstraints)) {
      items = constraint.sieve(items);
    }

    return items;
  },

  toggleFulltextCriteria: function() {
    this.tab.searcher.andTerms = !this.tab.searcher.andTerms;
    this.collection = this.tab.searcher.getCollection(this);
  },

  /**
   * Show the active message set in a glodaList tab, closing the current tab.
   */
  showActiveSetInTab: function() {
    let tabmail = this.rootWin.document.getElementById("tabmail");
    tabmail.openTab("glodaList", {
      collection: Gloda.explicitCollection(Gloda.NOUN_MESSAGE, this.activeSet),
      title: this.tab.title
    });
    tabmail.closeTab(this.tab);
  },

  /**
   * Show the conversation in a new glodaList tab.
   *
   * @param {GlodaConversation} aConversation The conversation to show.
   * @param {Boolean} [aBackground] Whether it should be in the background.
   */
  showConversationInTab: function(aMessage, aBackground) {
    let tabmail = this.rootWin.document.getElementById("tabmail");
    tabmail.openTab("glodaList", {
      conversation: aMessage.conversation,
      message: aMessage,
      title: aMessage.conversation.subject,
      background: aBackground
    });
  },

  /**
   * Show the message in a new tab.
   *
   * @param {GlodaMessage} aMessage The message to show.
   * @param {Boolean} [aBackground] Whether it should be in the background.
   */
  showMessageInTab: function(aMessage, aBackground) {
    let tabmail = this.rootWin.document.getElementById("tabmail");
    let msgHdr = aMessage.folderMessage;
    if (!msgHdr)
      throw new Error("Unable to translate gloda message to message header.");
    tabmail.openTab("message", {
      msgHdr: msgHdr,
      background: aBackground
    });
  },

  onItemsAdded: function(aItems, aCollection) {
  },
  onItemsModified: function(aItems, aCollection) {
  },
  onItemsRemoved: function(aItems, aCollection) {
  },
  onQueryCompleted: function(aCollection) {
    this.initialBuild();
  }
};

/**
 * addEventListener betrayals compel us to establish our link with the
 *  outside world from inside.  NeilAway suggests the problem might have
 *  been the registration of the listener prior to initiating the load.  Which
 *  is odd considering it works for the XUL case, but I could see how that might
 *  differ.  Anywho, this works for now and is a delightful reference to boot.
 */
function reachOutAndTouchFrame() {
  let us = window.QueryInterface(Ci.nsIInterfaceRequestor)
                 .getInterface(Ci.nsIWebNavigation)
                 .QueryInterface(Ci.nsIDocShellTreeItem);

  FacetContext.rootWin = us.rootTreeItem
                    .QueryInterface(Ci.nsIInterfaceRequestor)
                    .getInterface(Ci.nsIDOMWindow);

  let parentWin = us.parent
                    .QueryInterface(Ci.nsIInterfaceRequestor)
                    .getInterface(Ci.nsIDOMWindow);
  let aTab = FacetContext.tab = parentWin.tab;
  parentWin.tab = null;

  // we need to hook the context up as a listener in all cases since
  //  removal notifications are required.
  if ("searcher" in aTab) {
    FacetContext.searcher = aTab.searcher;
    aTab.searcher.listener = FacetContext;
  }
  else {
    FacetContext.searcher = null;
    aTab.collection.listener = FacetContext;
  }
  FacetContext.collection = aTab.collection;

  // if it has already completed, we need to prod things
  if (aTab.query.completed)
    FacetContext.initialBuild();
}
