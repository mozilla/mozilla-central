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

Cu.import("resource://gloda/modules/log4moz.js");

/**
 * @class Query class core; each noun gets its own sub-class where attributes
 *  have helper methods bound.
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
function GlodaQueryClass() {
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
  },
  
  limit: function gloda_query_limit(aLimit) {
    this._limit = aLimit;
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
        
        if (constraintType === this.kConstraintIdIn) {
          if (constraintValues.indexOf(aObj.id) == -1) {
            querySatisfied = false;
            break;
          }
        }
        else if ((constraintType === this.kConstraintIn) ||
                 (constraintType === this.kConstraintEquals)) {
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
                if (aParam == bParam && aVAlue == bValue) {
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
        else if (constraintType === this.kConstraintRanges) {
          let testValues;
          if (attrDef.singular)
            testValues = [aObj[attrDef.boundName]];
          else
            testValues = aObj[attrDef.boundName];

          let foundMatch = false;
          for each (let [,testValue] in Iterator(testValues)) {
            let [tParam, tValue] = objectNounDef.toParamAndValue(testValue);
            for each (let [,rangeTuple] in Iterator(constraintValues)) {
              let [lowRValue, upperRValue] = rangeTuple;
              if (lowRValue == null) {
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
        else if (constraintType === this.kConstraintStringLike) {
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
        else if (constraintType === this.kConstraintFulltext) {
          // this is beyond our powers.  don't match.
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
 * @class A query that only 'tests' for already belonging to the collection.
 */
function GlodaExplicitQueryClass() {
}

GlodaExplicitQueryClass.prototype = {
  // don't let people try and mess with us
  or: function() { return null; },
  // don't let people try and query on us (until we have a real use case for
  //  that...)
  getCollection: function() { return null; },
  /**
   * Matches only items that are already in the collection (by id).
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
 *  GlodaExplicitQueryClas, and GlodaWildcardQueryClass.  For GlodaQueryClass
 *  this allows us to add per-noun helpers.  For the others, this is merely a
 *  means of allowing us to attach the (per-noun) nounDef to the 'class'.
 */
function GlodaQueryClassFactory(aNounDef) {
  let newQueryClass = function() {
    GlodaQueryClass.call(this);
  }; 
  
  newQueryClass.prototype = new GlodaQueryClass();
  newQueryClass.prototype._queryClass = newQueryClass;
  newQueryClass.prototype._nounDef = aNounDef;
  
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
  
  return [newQueryClass, newExplicitClass, newWildcardClass];
}
