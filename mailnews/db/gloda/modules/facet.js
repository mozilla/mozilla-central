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
 * This file provides faceting logic.
 */

let EXPORTED_SYMBOLS = ["FacetDriver", "FacetUtils"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://app/modules/gloda/public.js");

/**
 * Decides the appropriate faceters for the noun type and drives the faceting
 *  process.  This class and the faceters are intended to be reusable so that
 *  you only need one instance per faceting session.  (Although each faceting
 *  pass is accordingly destructive to previous results.)
 *
 * Our strategy for faceting is to process one attribute at a time across all
 *  the items in the provided set.  The alternative would be to iterate over
 *  the items and then iterate over the attributes on each item.  While both
 *  approaches have caching downsides
 */
function FacetDriver(aNounDef, aWindow) {
  this.nounDef = aNounDef;
  this._window = aWindow;

  this._makeFaceters();
}
FacetDriver.prototype = {
  /**
   * Populate |this.faceters| with a set of faceters appropriate to the noun
   *  definition associated with this instance.
   */
  _makeFaceters: function() {
    let faceters = this.faceters = [];

    function makeFaceter(aAttrDef, aFacetDef) {
      let facetType = aFacetDef.type;

      if (aAttrDef.singular) {
        if (facetType == "date")
          faceters.push(new DateFaceter(aAttrDef, aFacetDef));
        else
          faceters.push(new DiscreteFaceter(aAttrDef, aFacetDef));
      }
      else {
        if (facetType == "nonempty?")
          faceters.push(new NonEmptySetFaceter(aAttrDef, aFacetDef));
        else
          faceters.push(new DiscreteSetFaceter(aAttrDef, aFacetDef));
      }
    }

    for each (let [, attrDef] in Iterator(this.nounDef.attribsByBoundName)) {
      // ignore attributes that do not want to be faceted
      if (!attrDef.facet)
        continue;

      makeFaceter(attrDef, attrDef.facet);

      if ("extraFacets" in attrDef) {
        for each (let [, facetDef] in Iterator(attrDef.extraFacets)) {
          makeFaceter(attrDef, facetDef);
        }
      }
    }
  },
  /**
   * Asynchronously facet the provided items, calling the provided callback when
   *  completed.
   */
  go: function FacetDriver_go(aItems, aCallback, aCallbackThis) {
    this.items = aItems;
    this.callback = aCallback;
    this.callbackThis = aCallbackThis;

    this._nextFaceter = 0;
    this._drive();
  },

  _MAX_FACETING_TIMESLICE_MS: 100,
  _FACETING_YIELD_DURATION_MS: 0,
  _driveWrapper: function(aThis) {
    aThis._drive();
  },
  _drive: function() {
    let start = Date.now();

    while (this._nextFaceter < this.faceters.length) {
      let faceter = this.faceters[this._nextFaceter++];
      // for now we facet in one go, but the long-term plan allows for them to
      //  be generators.
      faceter.facetItems(this.items);

      let delta = Date.now() - start;
      if (delta > this._MAX_FACETING_TIMESLICE_MS) {
        this._window.setTimeout(this._driveWrapper,
                                this._FACETING_YIELD_DURATION_MS,
                                this);
        return;
      }
    }

    // we only get here once we are done with the faceters
    this.callback.call(this.callbackThis);
  }
};

var FacetUtils = {
  _groupSizeComparator: function(a, b) {
    return b[1].length - a[1].length;
  },

  /**
   * Given a list where each entry is a tuple of [group object, list of items
   *  belonging to that group], produce a new list of the top grouped items.  We
   *  used to also produce an "other" aggregation, but that turned out to be
   *  conceptually difficult to deal with, so that's gone, leaving this method
   *  with much less to do.
   *
   * @param aAttrDef The attribute for the facet we are working with.
   * @param aGroups The list of groups built for the facet.
   * @param aMaxCount The number of result rows you want back.
   */
  makeTopGroups: function FacetUtils_makeTopGroups(aAttrDef, aGroups,
                                                   aMaxCount) {
    let nounDef = aAttrDef.objectNounDef;
    let realGroupsToUse = aMaxCount;

    let orderedBySize = aGroups.concat();
    orderedBySize.sort(this._groupSizeComparator);

    // - get the real groups to use and order them by the attribute comparator
    let outGroups = orderedBySize.slice(0, realGroupsToUse);
    let comparator = nounDef.comparator;
    function comparatorHelper(a, b) {
      return comparator(a[0], b[0]);
    }
    outGroups.sort(comparatorHelper);

    return outGroups;
  }
};

/**
 * Facet discrete things like message authors, boolean values, etc.  Only
 *  appropriate for use on singular values.  Use |DiscreteSetFaceter| for
 *  non-singular values.
 */
function DiscreteFaceter(aAttrDef, aFacetDef) {
  this.attrDef = aAttrDef;
  this.facetDef = aFacetDef;
}
DiscreteFaceter.prototype = {
  type: "discrete",
  /**
   * Facet the given set of items, deferring to the appropriate helper method
   */
  facetItems: function(aItems) {
    if (this.attrDef.objectNounDef.isPrimitive)
      return this.facetPrimitiveItems(aItems);
    else
      return this.facetComplexItems(aItems);
  },
  /**
   * Facet an attribute whose value is primitive, meaning that it is a raw
   *  numeric value or string, rather than a complex object.
   */
  facetPrimitiveItems: function(aItems) {
    let attrKey = this.attrDef.boundName;
    let nounDef = this.attrDef.objectNounDef;
    let filter = this.facetDef.filter;

    let valStrToVal = {};
    let groups = this.groups = {};
    this.groupCount = 0;

    for each (let [, item] in Iterator(aItems)) {
      let val = (attrKey in item) ? item[attrKey] : null;

      // skip items the filter tells us to ignore
      if (filter && !filter(val))
        continue;

      if (val in groups)
        groups[val].push(item);
      else {
        groups[val] = [item];
        valStrToVal[val] = val;
        this.groupCount++;
      }
    }

    let orderedGroups = [[valStrToVal[key], items] for each
                         ([key, items] in Iterator(groups))];
    let comparator = this.facetDef.groupComparator;
    function comparatorHelper(a, b) {
      return comparator(a[0], b[0]);
    }
    orderedGroups.sort(comparatorHelper);
    this.orderedGroups = orderedGroups;
  },
  /**
   * Facet an attribute whose value is a complex object that can be identified
   *  by its 'id' attribute.  This is the case where the value is itself a noun
   *  instance.
   */
  facetComplexItems: function(aItems) {
    let attrKey = this.attrDef.boundName;
    let nounDef = this.attrDef.objectNounDef;
    let filter = this.facetDef.filter;
    let idAttr = this.facetDef.groupIdAttr;

    let groups = this.groups = {};
    let groupMap = this.groupMap = {};
    this.groupCount = 0;

    for each (let [, item] in Iterator(aItems)) {
      let val = (attrKey in item) ? item[attrKey] : null;

      // skip items the filter tells us to ignore
      if (filter && !filter(val))
        continue;

      let valId = (val == null) ? null : val[idAttr];
      if (valId in groupMap) {
        groups[valId].push(item);
      }
      else {
        groupMap[valId] = val;
        groups[valId] = [item];
        this.groupCount++;
      }
    }

    let orderedGroups = [[groupMap[key], items] for each
                         ([key, items] in Iterator(groups))];
    let comparator = this.facetDef.groupComparator;
    function comparatorHelper(a, b) {
      return comparator(a[0], b[0]);
    }
    orderedGroups.sort(comparatorHelper);
    this.orderedGroups = orderedGroups;
  },
};

/**
 * Facet sets of discrete items.  For example, tags applied to messages.
 *
 * The main differences between us and |DiscreteFaceter| are:
 * - The empty set is notable.
 * - Specific set configurations could be interesting, but are not low-hanging
 *    fruit.
 */
function DiscreteSetFaceter(aAttrDef, aFacetDef) {
  this.attrDef = aAttrDef;
  this.facetDef = aFacetDef;
}
DiscreteSetFaceter.prototype = {
  type: "discrete",
  /**
   * Facet the given set of items, deferring to the appropriate helper method
   */
  facetItems: function(aItems) {
    if (this.attrDef.objectNounDef.isPrimitive)
      return this.facetPrimitiveItems(aItems);
    else
      return this.facetComplexItems(aItems);
  },
  /**
   * Facet an attribute whose value is primitive, meaning that it is a raw
   *  numeric value or string, rather than a complex object.
   */
  facetPrimitiveItems: function(aItems) {
    let attrKey = this.attrDef.boundName;
    let nounDef = this.attrDef.objectNounDef;
    let filter = this.facetDef.filter;

    let groups = this.groups = {};
    let valStrToVal = {};
    this.groupCount = 0;

    for each (let [, item] in Iterator(aItems)) {
      let vals = (attrKey in item) ? item[attrKey] : null;
      if (vals == null || vals.length == 0) {
        vals = [null];
      }
      for each (let [, val] in Iterator(vals)) {
        // skip items the filter tells us to ignore
        if (filter && !filter(val))
          continue;

        if (val in groups)
          groups[val].push(item);
        else {
          groups[val] = [item];
          valStrToVal[val] = val;
          this.groupCount++;
        }
      }
    }

    let orderedGroups = [[valStrToVal[key], items] for each
                         ([key, items] in Iterator(groups))];
    let comparator = this.facetDef.groupComparator;
    function comparatorHelper(a, b) {
      return comparator(a[0], b[0]);
    }
    orderedGroups.sort(comparatorHelper);
    this.orderedGroups = orderedGroups;
  },
  /**
   * Facet an attribute whose value is a complex object that can be identified
   *  by its 'id' attribute.  This is the case where the value is itself a noun
   *  instance.
   */
  facetComplexItems: function(aItems) {
    let attrKey = this.attrDef.boundName;
    let nounDef = this.attrDef.objectNounDef;
    let filter = this.facetDef.filter;
    let idAttr = this.facetDef.groupIdAttr;

    let groups = this.groups = {};
    let groupMap = this.groupMap = {};
    this.groupCount = 0;

    for each (let [, item] in Iterator(aItems)) {
      let vals = (attrKey in item) ? item[attrKey] : null;
      if (vals == null || vals.length == 0) {
        vals = [null];
      }
      for each (let [, val] in Iterator(vals)) {
        // skip items the filter tells us to ignore
        if (filter && !filter(val))
          continue;

        let valId = (val == null) ? null : val[idAttr];
        if (valId in groupMap) {
          groups[valId].push(item);
        }
        else {
          groupMap[valId] = val;
          groups[valId] = [item];
          this.groupCount++;
        }
      }
    }

    let orderedGroups = [[groupMap[key], items] for each
                         ([key, items] in Iterator(groups))];
    let comparator = this.facetDef.groupComparator;
    function comparatorHelper(a, b) {
      return comparator(a[0], b[0]);
    }
    orderedGroups.sort(comparatorHelper);
    this.orderedGroups = orderedGroups;
  },
};

/**
 * Given a non-singular attribute, facet it as if it were a boolean based on
 *  whether there is anything in the list (set).
 */
function NonEmptySetFaceter(aAttrDef, aFacetDef) {
  this.attrDef = aAttrDef;
  this.facetDef = aFacetDef;
}
NonEmptySetFaceter.prototype = {
  type: "boolean",
  /**
   * Facet the given set of items, deferring to the appropriate helper method
   */
  facetItems: function(aItems) {
    let attrKey = this.attrDef.boundName;
    let nounDef = this.attrDef.objectNounDef;

    let trueValues = [];
    let falseValues = [];

    let groups = this.groups = {};
    this.groupCount = 0;

    for each (let [, item] in Iterator(aItems)) {
      let vals = (attrKey in item) ? item[attrKey] : null;
      if (vals == null || vals.length == 0)
        falseValues.push(item);
      else
        trueValues.push(item);
    }

    this.orderedGroups = [];
    if (trueValues.length)
      this.orderedGroups.push([true, trueValues]);
    if (falseValues.length)
      this.orderedGroups.push([false, falseValues]);
    this.groupCount = this.orderedGroups.length;
  },
  makeQuery: function(aGroupValues, aInclusive) {
    let query = this.query = Gloda.newQuery(Gloda.NOUN_MESSAGE);

    let constraintFunc = query[this.attrDef.boundName];
    constraintFunc.call(query);

    // Our query is always for non-empty lists (at this time), so we want to
    //  invert if they're excluding 'true' or including 'false', which means !=.
    let invert = aGroupValues[0] != aInclusive;

    return [query, invert];
  }
};


/**
 * Facet dates.  We build a hierarchical nested structure of year, month, and
 *  day nesting levels.  This decision was made speculatively in the hopes that
 *  it would allow us to do clustered analysis and that there might be a benefit
 *  for that.  For example, if you search for "Christmas", we might notice
 *  clusters of messages around December of each year.  We could then present
 *  these in a list as likely candidates, rather than a graphical timeline.
 *  Alternately, it could be used to inform a non-linear visualization.  As it
 *  stands (as of this writing), it's just a complicating factor.
 */
function DateFaceter(aAttrDef, aFacetDef) {
  this.attrDef = aAttrDef;
  this.facetDef = aFacetDef;
}
DateFaceter.prototype = {
  type: "date",
  /**
   *
   */
  facetItems: function(aItems) {
    let attrKey = this.attrDef.boundName;
    let nounDef = this.attrDef.objectNounDef;

    let years = this.years = {_subCount: 0};
    // generally track the time range
    let oldest = null, newest = null;

    let validItems = this.validItems = [];

    // just cheat and put us at the front...
    this.groupCount = aItems.length ? 1000 : 0;
    this.orderedGroups = null;

    /** The number of items with a null/missing attribute. */
    this.missing = 0;

    /**
     * The number of items with a date that is unreasonably far in the past or
     *  in the future.  Old-wise, we are concerned about incorrectly formatted
     *  messages (spam) that end up placed around the UNIX epoch.  New-wise,
     *  we are concerned about messages that can't be explained by users who
     *  don't know how to set their clocks (both the current user and people
     *  sending them mail), mainly meaning spam.
     * We want to avoid having our clever time-scale logic being made useless by
     *  these unreasonable messages.
     */
    this.unreasonable = 0;
    // feb 1, 1970
    let tooOld = new Date(1970, 1, 1);
    // 3 days from now
    let tooNew = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    for each (let [, item] in Iterator(aItems)) {
      let val = (attrKey in item) ? item[attrKey] : null;
      // -- missing
      if (val == null) {
        this.missing++;
        continue;
      }

      // -- unreasonable
      if (val < tooOld || val > tooNew) {
        this.unreasonable++;
        continue;
      }

      this.validItems.push(item);

      // -- time range
      if (oldest == null)
        oldest = newest = val;
      else if (val < oldest)
        oldest = val;
      else if (val > newest)
        newest = val;

      // -- bucket
      // - year
      let year, valYear = val.getYear();
      if (valYear in years) {
        year = years[valYear];
        year._dateCount++;
      }
      else {
        year = years[valYear] = {
          _dateCount: 1,
          _subCount: 0
        };
        years._subCount++;
      }

      // - month
      let month, valMonth = val.getMonth();
      if (valMonth in year) {
        month = year[valMonth];
        month._dateCount++;
      }
      else {
        month = year[valMonth] = {
          _dateCount: 1,
          _subCount: 0
        };
        year._subCount++;
      }

      // - day
      let valDate = val.getDate();
      if (valDate in month) {
        month[valDate].push(item);
      }
      else {
        month[valDate] = [item];
      }
    }

    this.oldest = oldest;
    this.newest = newest;
  },

  _unionMonth: function(aMonthObj) {
    let dayItemLists = [];
    for each (let [key, dayItemList] in Iterator(aMonthObj)) {
      if (typeof(key) == "string" && key[0] == '_')
        continue;
      dayItemLists.push(dayItemList);
    }
    return Array.concat.apply([], dayItemLists);
  },

  _unionYear: function(aYearObj) {
    let monthItemLists = [];
    for each (let [key, monthObj] in Iterator(aYearObj)) {
      if (typeof(key) == "string" && key[0] == '_')
        continue;
      monthItemLists.push(this._unionMonth(monthObj));
    }
    return Array.concat.apply([], monthItemLists);
  }
};
