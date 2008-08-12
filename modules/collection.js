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

EXPORTED_SYMBOLS = ['GlodaCollection', 'GlodaCollectionManager'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gloda/modules/log4moz.js");

function GlodaCollectionManager() {
  this._collectionsByNoun = {};
}

GlodaCollectionManager.prototype = {
  /**
   *
   */
  registerCollection: function gloda_colm_registerCollection(aCollection) {
    let collections;
    let nounID = aCollection.query._nounMeta.id;
    if (!(nounID in this._collectionsByNoun))
      collections = this._collectionsByNoun[nounID] = [];
    else {
      // purge dead weak references while we're at it
      collections = this._collectionsByNoun[nounID].filter(function (aRef) {
        return aRef.get(); });
      this._collectionsByNoun[nounID] = collections;
    }
    collections.push(Cu.getWeakReference(aCollection));
  },
  
  getCollectionsForNounID: function(aNounID) {
    if (!(aNounID in this._collectionsByNoun))
      return [];
    
    // generator would be nice, but I suspect get() is too expensive to use
    //  twice (guard/predicate and value)
    let weakCollections = this._collectionsByNoun[aNounID];
    let collections = [];
    for (let iColl=0; iColl < weakCollections.length; iColl++) {
      let collection = weakCollections[iColl].get();
      if (collection)
        collections.push(collection);
    }
    return collections;
  },
  
  /**
   * This should be called when items are added to the global database.  This
   *  should generally mean during indexing by indexers or an attribute
   *  provider.
   * We walk all existing collections for the given noun type and add the items
   *  to the collection if the item meets the query that defines the collection.
   */
  itemsAdded: function gloda_colm_itemsAdded(aItems) {
    for each (let collection in this.getCollectionsForNounID()) {
      let addItems = [item for each (item in aItems)
                      if (collection.query.test(item))];
      if (addItems.length)
        collection._onItemsAdded(addItems);
    }
  },
  /**
   * This should be called when items in the global database are modified.  For
   *  example, as a result of indexing.  This should generally only be called
   *  by indexers or by attribute providers.
   * We walk all existing collections for the given noun type.  For items
   *  currently included in each collection but should no longer be (per the
   *  collection's defining query) we generate onItemsRemoved events.  For items
   *  not currently included in the collection but should now be, we generate
   *  onItemsAdded events.  For items included that still match the query, we
   *  generate onItemsModified events.
   */
  itemsModified: function gloda_colm_itemsModified(aItems) {
    for each (collection in this.getCollectionsForNounID()) {
      let added = [], modified = [], removed = [];
      for each (let item in aItems) {
        if (item.id in collection._idMap) {
          // currently in... but should it still be there?
          if (collection.query.test(item))
            modified.push(item); // yes, keep it
          else
            removed.push(item); // no, bin it
        }
        else if (collection.query.test(item)) // not in, should it be?
          added.push(item); // yep, add it
      }
      if (added.length)
        collection._onItemsAdded(added);
      if (modified.length)
        collection._onItemsModified(modified);
      if (removed.length)
        collection._onItemsRemoved(removed);
    }
  },
  /**
   * This should be called when items in the global database are permanently
   *  deleted.  (This is distinct from concepts like message deletion which may
   *  involved trash folders or other modified forms of existence.  Deleted
   *  means the data is gone and if it were to come back, it would come back
   *  with a brand new unique id and we would get an itemsAdded event.)
   * We walk all existing collections for the given noun type.  For items
   *  currently in the collection, we generate onItemsRemoved events.
   */
  itemsDeleted: function gloda_colm_itemsDeleted(aItems) {
    for each (let collection in this.getCollectionsForNounID()) {
      let removeItems = [item for each (item in aItems)
                         if (item.id in collection._idMap)];
      if (removeItems.length)
        collection._onItemsRemoved(removeItems);
    }
  },
}
// singleton
GlodaCollectionManager = new GlodaCollectionManager();

/**
 * A GlodaCollection is intended to be a current view of the set of first-class
 *  nouns meeting a given query.  Assuming a listener is present, events are
 *  generated when new objects meet the query, existing objects no longer meet
 *  the query, or existing objects have experienced a change in attributes that
 *  does not affect their ability to be present (but the listener may care about
 *  because it is exposing those attributes). 
 */
function GlodaCollection(aItems, aQuery, aListener) {
  this.items = aItems || [];
  this._idMap = {};
  for each (let item in this.items) {
    this._idMap[item.id] = item;
  }
  
  this.query = aQuery || null;
  this._listener = aListener || null;
}
 
GlodaCollection.prototype = {
  get listener() { return this._listener; },
  set listener(aListener) { this._listener = aListener; },

  _onItemsAdded: function(aItems) {
    this.items.push.apply(this.items, aItems);
    for each (item in aItems) {
      this._idMap[item.id] = item;
    }
    if (this._listener)
      this._listener.onItemsAdded(aItems);
  },
  
  _onItemsModified: function(aItems) {
    if (this._listener)
      this._listener.onItemsModified(aItems);
  },
  
  _onItemsRemoved: function(aItems) {
    // we want to avoid the O(n^2) deletion performance case, and deletion
    //  should be rare enough that the extra cost of building the deletion map
    //  should never be a real problem.
    let deleteMap = {};
    for each (let item in aItems) {
      deleteMap[item.id] = true;
    }
    let items = this.items;
    // in-place filter.  probably needless optimization.
    let iWrite=0;
    for (let iRead=0; iRead < items.length; iRead++) {
      let item = items[iRead];
      if (!(item.id in deleteMap))
        items[iWrite++] = item;
    }
    items.slice(iWrite);
    
    if (this._listener)
      this._listener.onItemsRemoved(aItems);
  },
};
