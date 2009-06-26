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

EXPORTED_SYMBOLS = ["GlodaQueryClassFactory"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://app/modules/gloda/log4moz.js");

// GlodaDatastore has some constants we need, and oddly enough, there was no
//  load dependency preventing us from doing this.
Cu.import("resource://app/modules/gloda/datastore.js");

/**
 * @class Query class core; each noun gets its own sub-class where attributes
 *  have helper methods bound.
 *
 * @param aOptions A dictionary of options.  Current legal options are:
 *     - noMagic: Indicates that the noun's dbQueryJoinMagic should be ignored.
 *                Currently, this means that messages will not have their
 *                full-text indexed values re-attached.  This is planned to be
 *                offset by having queries/cache lookups that do not request
 *                noMagic to ensure that their data does get loaded.
 *     - explicitSQL: A hand-rolled alternate representation for the core
 *           SELECT portion of the SQL query.  The queryFromQuery logic still
 *           generates its normal query, we just ignore its result in favor of
 *           your provided value.  This means that the positional parameter
 *           list is still built and you should/must rely on those bound
 *           parameters (using '?').  The replacement occurs prior to the
 *           outerWrapColumns, ORDER BY, and LIMIT contributions to the query.
 *     - outerWrapColumns: If provided, wraps the query in a "SELECT *,blah
 *           FROM (actual query)" where blah is your list of outerWrapColumns
 *           made comma-delimited.  The idea is that this allows you to
 *           reference the result of expressions inside the query using their
 *           names rather than having to duplicate the logic.  In practice,
 *           this makes things more readable but is unlikely to improve
 *           performance.  (Namely, my use of 'offsets' for full-text stuff
 *           ends up in the EXPLAIN plan twice despite this.)
 *
 * @property _owner The query instance that holds the list of unions...
 * @property _constraints A list of (lists of OR constraints) that are ANDed
 *     together.  For example [[FROM bob, FROM jim], [DATE last week]] would
 *     be requesting us to find all the messages from either bob or jim, and
 *     sent in the last week.
 * @property _unions A list of other queries whose results are unioned with our
 *     own.  There is no concept of nesting or sub-queries apart from this
 *     mechanism.
 */
function GlodaQueryClass(aOptions) {
  this.options = (aOptions != null) ? aOptions : {};

  // if we are an 'or' clause, who is our parent whom other 'or' clauses should
  //  spawn from...
  this._owner = null;
  // our personal chain of and-ing.
  this._constraints = [];
  // the other instances we union with
  this._unions = [];

  this._order = [];
  this._limit = 0;
}

GlodaQueryClass.prototype = {
  WILDCARD: {},

  get constraintCount() {
    return this._constraints.length;
  },

  or: function gloda_query_or() {
    let owner = this._owner || this;
    let orQuery = new this._queryClass();
    orQuery._owner = owner;
    owner._unions.push(orQuery);
    return orQuery;
  },

  orderBy: function gloda_query_orderBy() {
    for (let iArg = 0; iArg < arguments.length; iArg++) {
      let arg = arguments[iArg];
      this._order.push(arg);
    }
    return this;
  },

  limit: function gloda_query_limit(aLimit) {
    this._limit = aLimit;
    return this;
  },

  /**
   * Return a collection asynchronously populated by this collection.  You must
   *  provide a listener to receive notifications from the collection as it
   *  receives updates.  The listener object should implement onItemsAdded,
   *  onItemsModified, and onItemsRemoved methods, all of which take a single
   *  argument which is the list of items which have been added, modified, or
   *  removed respectively.
   */
  getCollection: function gloda_query_getCollection(aListener, aData) {
    return this._nounDef.datastore.queryFromQuery(this, aListener, aData);
  },

  /**
   * Test whether the given first-class noun instance satisfies this query.
   *
   * @testpoint gloda.query.test
   */
  test: function gloda_query_test(aObj) {
    // when changing this method, be sure that GlodaDatastore's queryFromQuery
    //  method likewise has any required changes made.
    let unionQueries = [this].concat(this._unions);

    for (let iUnion = 0; iUnion < unionQueries.length; iUnion++) {
      let curQuery = unionQueries[iUnion];

      // assume success until a specific (or) constraint proves us wrong
      let querySatisfied = true;
      for (let iConstraint = 0; iConstraint < curQuery._constraints.length;
           iConstraint++) {
        let constraint = curQuery._constraints[iConstraint];
        let [constraintType, attrDef] = constraint;
        let constraintValues = constraint.slice(2);

        if (constraintType === GlodaDatastore.kConstraintIdIn) {
          if (constraintValues.indexOf(aObj.id) == -1) {
            querySatisfied = false;
            break;
          }
        }
        // @testpoint gloda.query.test.kConstraintIn
        else if ((constraintType === GlodaDatastore.kConstraintIn) ||
                 (constraintType === GlodaDatastore.kConstraintEquals)) {
          let objectNounDef = attrDef.objectNounDef;

          // if they provide an equals comparator, use that.
          // (note: the next case has better optimization possibilities than
          //  this mechanism, but of course has higher initialization costs or
          //  code complexity costs...)
          if (objectNounDef.equals) {
            let testValues;
            if (attrDef.singular)
              testValues = [aObj[attrDef.boundName]];
            else
              testValues = aObj[attrDef.boundName];

            let foundMatch = false;
            for each (let [,testValue] in Iterator(testValues)) {
              for each (let [,value] in Iterator(constraintValues)) {
                if (objectNounDef.equals(testValue, value)) {
                  foundMatch = true;
                  break;
                }
              }
              if (foundMatch)
                break;
            }
            if (!foundMatch) {
              querySatisfied = false;
              break;
            }
          }
          // otherwise, we need to convert everyone to their param/value form
          //  in order to test for equality
          else {
            // let's just do the simple, obvious thing for now.  which is
            //  what we did in the prior case but exploding values using
            //  toParamAndValue, and then comparing.
            let testValues;
            if (attrDef.singular)
              testValues = [aObj[attrDef.boundName]];
            else
              testValues = aObj[attrDef.boundName];

            let foundMatch = false;
            for each (let [,testValue] in Iterator(testValues)) {
              let [aParam, aValue] = objectNounDef.toParamAndValue(testValue);
              for each (let [,value] in Iterator(constraintValues)) {
                let [bParam, bValue] = objectNounDef.toParamAndValue(value);
                if (aParam == bParam && aValue == bValue) {
                  foundMatch = true;
                  break;
                }
              }
              if (foundMatch)
                break;
            }
            if (!foundMatch) {
              querySatisfied = false;
              break;
            }
          }
        }
        // @testpoint gloda.query.test.kConstraintRanges
        else if (constraintType === GlodaDatastore.kConstraintRanges) {
          let objectNounDef = attrDef.objectNounDef;

          let testValues;
          if (attrDef.singular)
            testValues = [aObj[attrDef.boundName]];
          else
            testValues = aObj[attrDef.boundName];

          let foundMatch = false;
          for each (let [,testValue] in Iterator(testValues)) {
            let [tParam, tValue] = objectNounDef.toParamAndValue(testValue);
            for each (let [,rangeTuple] in Iterator(constraintValues)) {
              let [lowerRValue, upperRValue] = rangeTuple;
              if (lowerRValue == null) {
                let [upperParam, upperValue] =
                  objectNounDef.toParamAndValue(upperRValue);
                if (tParam == upperParam && tValue <= upperValue) {
                  foundMatch = true;
                  break;
                }
              }
              else if (upperRValue == null) {
                let [lowerParam, lowerValue] =
                  objectNounDef.toParamAndValue(lowerRValue);
                if (tParam == lowerParam && tValue >= lowerValue) {
                  foundMatch = true;
                  break;
                }
              }
              else { // no one is null
                let [upperParam, upperValue] =
                  objectNounDef.toParamAndValue(upperRValue);
                let [lowerParam, lowerValue] =
                  objectNounDef.toParamAndValue(lowerRValue);
                if ((tParam == lowerParam) && (tValue >= lowerValue) &&
                    (tParam == upperParam) && (tValue <= upperValue)) {
                  foundMatch = true;
                  break;
                }
              }
            }
            if (foundMatch)
              break;
          }
          if (!foundMatch) {
            querySatisfied = false;
            break;
          }
        }
        // @testpoint gloda.query.test.kConstraintStringLike
        else if (constraintType === GlodaDatastore.kConstraintStringLike) {
          let curIndex = 0;
          let value = aObj[attrDef.boundName];
          // the attribute must be singular, we don't support arrays of strings.
          for each (let [iValuePart, valuePart] in Iterator(constraintValues)) {
            if (typeof valuePart == "string") {
              let index = value.indexOf(valuePart);
              // if curIndex is null, we just need any match
              // if it's not null, it must match the offset of our found match
              if (curIndex === null) {
                if (index == -1)
                  querySatisfied = false;
                else
                  curIndex = index + valuePart.length;
              }
              else {
                if (index != curIndex)
                  querySatisfied = false;
                else
                  curIndex = index + valuePart.length;
              }
              if (!querySatisfied)
                break;
            }
            else // wild!
              curIndex = null;
          }
          // curIndex must be null or equal to the length of the string
          if (querySatisfied && curIndex !== null && curIndex != value.length)
            querySatisfied = false;
        }
        // @testpoint gloda.query.test.kConstraintFulltext
        else if (constraintType === GlodaDatastore.kConstraintFulltext) {
          // this is beyond our powers. Even if we have the fulltext content in
          //  memory, which we may not, the tokenization and such to perform
          //  the testing gets very complicated in the face of i18n, etc.
          // so, let's fail if the item is not already in the collection, and
          //  let the testing continue if it is.  (some other constraint may no
          //  longer apply...)
          if (!(aObj.id in this.collection._idMap))
            querySatisfied = false;
        }

        if (!querySatisfied)
          break;
      }

      if (querySatisfied)
        return true;
    }
    return false;
  },
};

/**
 * @class A query that never matches anything.
 *
 * Collections corresponding to this query are intentionally frozen in time and
 *  do not want to be notified of any updates.  We need the collection to be
 *  registered with the collection manager so that the noun instances in the
 *  collection are always 'reachable' via the collection for as long as we might
 *  be handing out references to the instances.  (The other way to avoid updates
 *  would be to not register the collection, but then items might not be
 *  reachable.)
 * This is intended to be used in implementation details behind the gloda
 *  abstraction barrier.  For example, the message indexer likes to be able
 *  to represent 'ghost' and deleted messages, but these should never be exposed
 *  to the user.  For code simplicity, it wants to be able to use the query
 *  mechanism.  But it doesn't want updates that are effectively
 *  nonsensical.  For example, a ghost message that is reused by message
 *  indexing may already be present in a collection; when the collection manager
 *  receives an itemsAdded event, a GlodaExplicitQueryClass would result in
 *  an item added notification in that case, which would wildly not be desired.
 */
function GlodaNullQueryClass() {
}

GlodaNullQueryClass.prototype = {
  /**
   * No options; they are currently only needed for SQL query generation, which
   *  does not happen for null queries.
   */
  options: {},

  /**
   * Provide a duck-typing way of indicating to GlodaCollectionManager that our
   *  associated collection just doesn't want anything to change.  Our test
   *  function is able to convey most of it, but special-casing has to happen
   *  somewhere, so it happens here.
   */
  frozen: true,

  /**
   * Since our query never matches anything, it doesn't make sense to let
   *  someone attempt to construct a boolean OR involving us.
   *
   * @returns null
   */
  or: function() {
    return null;
  },

  /**
   * Return nothing (null) because it does not make sense to create a collection
   *  based on a null query.  This method is normally used (on a normal query)
   *  to return a collection populated by the constraints of the query.  We
   *  match nothing, so we should return nothing.  More importantly, you are
   *  currently doing something wrong if you try and do this, so null is
   *  appropriate.  It may turn out that it makes sense for us to return an
   *  empty collection in the future for sentinel value purposes, but we'll
   *  cross that bridge when we come to it.
   *
   * @returns null
   */
  getCollection: function() {
    return null;
  },

  /**
   * Never matches anything.
   *
   * @param aObj The object someone wants us to test for relevance to our
   *     associated collection.  But we don't care!  Not a fig!
   * @returns false
   */
  test: function gloda_query_null_test(aObj) {
    return false;
  }
};

/**
 * @class A query that only 'tests' for already belonging to the collection.
 *
 * This type of collection is useful for when you (or rather your listener)
 *  are interested in hearing about modifications to your collection or removals
 *  from your collection because of deletion, but do not want to be notified
 *  about newly indexed items matching your normal query constraints.
 *
 * @param aCollection The collection this query belongs to.  This needs to be
 *     passed-in here or the collection should set the attribute directly when
 *     the query is passed in to a collection's constructor.
 */
function GlodaExplicitQueryClass(aCollection) {
  this.collection = aCollection;
}

GlodaExplicitQueryClass.prototype = {
  /**
   * No options; they are currently only needed for SQL query generation, which
   *  does not happen for explicit queries.
   */
  options: {},

  /**
   * Since our query is intended to only match the contents of our collection,
   *  it doesn't make sense to let someone attempt to construct a boolean OR
   *  involving us.
   *
   * @returns null
   */
  or: function() {
    return null;
  },

  /**
   * Return nothing (null) because it does not make sense to create a collection
   *  based on an explicit query.  This method is normally used (on a normal
   *  query) to return a collection populated by the constraints of the query.
   *  In the case of an explicit query, we expect it will be associated with
   *  either a hand-created collection or the results of a normal query that is
   *  immediately converted into an explicit query.  In all likelihood, calling
   *  this method on an instance of this type is an error, so it is helpful to
   *  return null because people will error hard.
   *
   * @returns null
   */
  getCollection: function() {
    return null;
  },

  /**
   * Matches only items that are already in the collection associated with this
   *  query (by id).
   *
   * @param aObj The object/item to test for already being in the associated
   *     collection.
   * @returns true when the object is in the associated collection, otherwise
   *     false.
   */
  test: function gloda_query_explicit_test(aObj) {
    return (aObj.id in this.collection._idMap);
  }
};

/**
 * @class A query that 'tests' true for everything.  Intended for debugging purposes
 *  only.
 */
function GlodaWildcardQueryClass() {
}

GlodaWildcardQueryClass.prototype = {
  /**
   * No options; they are currently only needed for SQL query generation.
   */
  options: {},

  // don't let people try and mess with us
  or: function() { return null; },
  // don't let people try and query on us (until we have a real use case for
  //  that...)
  getCollection: function() { return null; },
  /**
   * Everybody wins!
   */
  test: function gloda_query_explicit_test(aObj) {
    return true;
  }
};

/**
 * Factory method to effectively create per-noun subclasses of GlodaQueryClass,
 *  GlodaNullQueryClass, GlodaExplicitQueryClass, and GlodaWildcardQueryClass.
 *  For GlodaQueryClass this allows us to add per-noun helpers.  For the others,
 *  this is merely a means of allowing us to attach the (per-noun) nounDef to
 *  the 'class'.
 */
function GlodaQueryClassFactory(aNounDef) {
  let newQueryClass = function(aOptions) {
    GlodaQueryClass.call(this, aOptions);
  };
  newQueryClass.prototype = new GlodaQueryClass();
  newQueryClass.prototype._queryClass = newQueryClass;
  newQueryClass.prototype._nounDef = aNounDef;

  let newNullClass = function(aCollection) {
    GlodaNullQueryClass.call(this);
    this.collection = aCollection;
  };
  newNullClass.prototype = new GlodaNullQueryClass();
  newNullClass.prototype._queryClass = newNullClass;
  newNullClass.prototype._nounDef = aNounDef;

  let newExplicitClass = function(aCollection) {
    GlodaExplicitQueryClass.call(this);
    this.collection = aCollection;
  };
  newExplicitClass.prototype = new GlodaExplicitQueryClass();
  newExplicitClass.prototype._queryClass = newExplicitClass;
  newExplicitClass.prototype._nounDef = aNounDef;

  let newWildcardClass = function(aCollection) {
    GlodaWildcardQueryClass.call(this);
    this.collection = aCollection;
  };
  newWildcardClass.prototype = new GlodaWildcardQueryClass();
  newWildcardClass.prototype._queryClass = newWildcardClass;
  newWildcardClass.prototype._nounDef = aNounDef;

  return [newQueryClass, newNullClass, newExplicitClass, newWildcardClass];
}
