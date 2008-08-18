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

const LOG = Log4Moz.Service.getLogger("gloda.collection");

/**
 * The collection manager is a singleton that has the following tasks:
 * - Let views of objects (nouns) know when their objects have changed.  For
 *   example, an attribute has changed due to user action.
 * - Let views of objects based on queries know when new objects match their
 *   query, or when their existing objects no longer match due to changes.
 * - Caching/object-identity maintenance.  It is ideal if we only ever have
 *   one instance of an object at a time.  (More specifically, only one instance
 *   per database row 'id'.)  The collection mechanism lets us find existing
 *   instances to this end.  Caching can be directly integrated by being treated
 *   as a special collection.
 */
function GlodaCollectionManager() {
  this._collectionsByNoun = {};
  this._cachesByNoun = {};
}

GlodaCollectionManager.prototype = {
  /**
   * Registers the existence of a collection with the collection manager.  This
   *  is done using a weak reference so that the collection can go away if it
   *  wants to.
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
  
  getCollectionsForNounID: function gloda_colm_getCollectionsForNounID(aNounID){
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
  
  defineCache: function gloda_colm_defineCache(aNounMeta, aCacheSize) {
    this._cachesByNoun[aNounMeta.id] = new GlodaLRUCacheCollection(aNounMeta,
                                                                   aCacheSize);
  },
  
  /**
   * Attempt to locate an instance of the object of the given noun type with the
   *  given id.  Counts as a cache hit if found.  (And if it was't in a cache,
   *  but rather a collection, it is added to the cache.)
   */
  cacheLookupOne: function gloda_colm_cacheLookupOne(aNounID, aID) {
    let cache = this._cachesByNoun[aNounID];
    
    if (cache) {
      if (aID in cache._idMap) {
        let item = cache._idMap[aID];
        return cache.hit(item);
      }
    }
  
    for each (let collection in this.getCollectionsForNounID(aNounID)) {
      if (aID in collection._idMap) {
        let item = collection._idMap[aID];
        if (cache)
          cache.add([item]);
        return item;
      }
    }
    
    return null;
  },
  
  /**
   * Checks whether the provided item with the given id is actually a duplicate
   *  of an instance that already exists in the cache/a collection.  If it is,
   *  the pre-existing instance is returned and counts as a cache hit.  If it
   *  is not, the passed-in instance is added to the cache and returned.
   */
  cacheLoadUnifyOne: function gloda_colm_cacheLoadUnifyOne(aItem) {
    let items = [aItem];
    this.cacheLoadUnify(aItem.NOUN_ID, items);
    return items[0];
  },

  /**
   * Given a list of items, check if any of them already have duplicate,
   *  canonical, instances in the cache or collections.  Items with pre-existing
   *  instances are replaced by those instances in the provided list, and each
   *  counts as a cache hit.  Items without pre-existing instances are added
   *  to the cache and left intact.
   */
  cacheLoadUnify: function gloda_colm_cacheLoadUnify(aNounID, aItems) {
    let cache = this._cachesByNoun[aNounID];
    
    // track the items we haven't yet found in a cache/collection (value) and
    //  their index in aItems (key).  We're somewhat abusing the dictionary
    //  metaphor with the intent of storing tuples here.  We also do it because
    //  it allows random-access deletion theoretically without cost.  (Since
    //  we delete during iteration, that may be wrong, but it sounds like the
    //  semantics still work?)
    let unresolvedIndexToItem = {};
    let numUnresolved = 0;
    
    if (cache) {
      for (let iItem=0; iItem < aItems.length; iItem++) {
        let item = aItems[iItem];
        
        if (item.id in cache._idMap) {
          let realItem = cache._idMap[item.id];
          // update the caller's array with the reference to the 'real' item
          aItems[iItem] = realItem;
          cache.hit(realItem);
        }
        else {
          unresolvedIndexToItem[iItem] = item;
          numUnresolved++;
        }
      }
      
      // we're done if everyone was a hit.
      if (numUnresolved == 0)
        return;
    }
    else {
      for (let iItem=0; iItem < aItems.length; iItem++) {
        unresolvedIndexToItem[iItem] = aItems[iItem];
      }
      numUnresolved = aItems.length;
    }
  
    let needToCache = [];
    // next, let's fall back to our collections
    for each (let collection in this.getCollectionsForNounID(aNounID)) {
      for (let [iItem, item] in Iterator(unresolvedIndexToItem)) {
        if (item.id in collection._idMap) {
          let realItem = collection._idMap[item.id];
          // update the caller's array to now have the 'real' object
          aItems[iItem] = realItem;
          // flag that we need to cache this guy (we use an inclusive cache)
          needToCache.push(realItem);
          // we no longer need to resolve this item...
          delete unresolvedIndexToItem[iItem];
          // stop checking collections if we got everybody
          if (--numUnresolved == 0)
            break;
        }
      }
    }
    
    // anything left in unresolvedIndexToItem should be added to the cache...
    // plus, we already have 'needToCache'
    if (cache) {
      cache.add(needToCache.concat([val for each
                                    (val in unresolvedIndexToItem)]));
    }
    
    return aItems;
  },
  
  cacheCommitDirty: function glod_colm_cacheCommitDirty() {
    for each (let cache in this._cachesByNoun) {
      cache.commitDirty();
    }
  },

  /**
   * Notifies the collection manager that an item has been loaded and should
   *  be cached, assuming caching is active.
   */    
  itemLoaded: function gloda_colm_itemsLoaded(aItem) {
    let cache = this._cachesByNoun[aItem.NOUN_ID];
    if (cache) {
      cache.add([aItem]);
    }
  },

  /**
   * Notifies the collection manager that multiple items has been loaded and
   *  should be cached, assuming caching is active.
   */  
  itemsLoaded: function gloda_colm_itemsLoaded(aNounID, aItems) {
    let cache = this._cachesByNoun[aNounID];
    if (cache) {
      cache.add(aItems);
    }
  },
  
  /**
   * This should be called when items are added to the global database.  This
   *  should generally mean during indexing by indexers or an attribute
   *  provider.
   * We walk all existing collections for the given noun type and add the items
   *  to the collection if the item meets the query that defines the collection.
   */
  itemsAdded: function gloda_colm_itemsAdded(aNounID, aItems) {
    let cache = this._cachesByNoun[aNounID];
    if (cache) {
      cache.add(aItems);
    }

    for each (let collection in this.getCollectionsForNounID(aNounID)) {
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
  itemsModified: function gloda_colm_itemsModified(aNounID, aItems) {
    for each (collection in this.getCollectionsForNounID(aNounID)) {
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
  itemsDeleted: function gloda_colm_itemsDeleted(aNounID, aItems) {
    // cache
    let cache = this._cachesByNoun[aNounID];
    if (cache) {
      for each (let item in aItem) {
        if (item.id in cache._idMap)
          cache.delete(item);
      }
    }

    // collections
    for each (let collection in this.getCollectionsForNounID(aNounID)) {
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

/**
 * A LRU-discard cache.  We use a doubly linked-list for the eviction
 *  tracking.  Since we require that there is at most one LRU-discard cache per
 *  noun class, we simplify our lives by adding our own attributes to the
 *  cached objects.
 */
function GlodaLRUCacheCollection(aNounMeta, aCacheSize) {
  GlodaCollection.call(this, null, null, null);
  
  this._nounMeta = aNounMeta;
  
  this._head = null; // aka oldest!
  this._tail = null; // aka newest!
  this._size = 0;
  // let's keep things sane, and simplify our logic a little...
  if (aCacheSize < 32)
    aCacheSize = 32;
  this._maxCacheSize = aCacheSize;
}

GlodaLRUCacheCollection.prototype = new GlodaCollection;
GlodaLRUCacheCollection.prototype.add = function cache_add(aItems) {
  for each (let item in aItems) {
    this._idMap[item.id] = item;
    
    item._lruPrev = this._tail;
    // we do have to make sure that we will set _head the first time we insert
    //  something
    if (this._tail !== null)
      this._tail._lruNext = item;
    else
      this._head = item;
    item._lruNext = null;
    this._tail = item;
    
    this._size++;
  }
  
  while (this._size > this._maxCacheSize) {
    let item = this._head;
    
    // we never have to deal with the possibility of needing to make _head/_tail
    //  null.
    this._head = item._lruNext;
    this._head._lruPrev = null;
    // (because we are nice, we will delete the properties...)
    delete item._lruNext;
    delete item._lruPrev;
    
    // nuke from our id map
    delete this._idMap[item.id];
    
    // flush dirty items to disk (they may not have this attribute, in which
    //  case, this returns false, which is fine.)
    if (item.dirty) {
      this._nounMeta.objUpdate.call(this._nounMeta.datastore, item);
      delete item.dirty;
    }
    
    this._size--;
  }
};

GlodaLRUCacheCollection.prototype.hit = function cache_hit(aItem) {
  // don't do anything in the 0 or 1 items case, or if we're already
  //  the last item
  if ((this._head === this._tail) || (this._tail === aItem))
    return;

  // unlink the item  
  if (aItem._lruPrev !== null)
    aItem._lruPrev._lruNext = aItem._lruNext;
  else
    this._head = aItem._lruNext;
  // _lruNext cannot be null
  aItem._lruNext._lruPrev = aItem._lruPrev;
  // link it in to the end
  this._tail._lruNext = aItem; 
  aItem._lruPrev = this._tail;
  aItem._lruNext = null;
  // update tail tracking
  this._tail = aItem;
  
  return aItem;
};

GlodaLRUCacheCollection.prototype.deleted = function cache_deleted(aItem) {
  // unlink the item  
  if (aItem._lruPrev !== null)
    aItem._lruPrev._lruNext = aItem._lruNext;
  else
    this._head = aItem._lruNext;
  if (aItem._lruNext !== null)
    aItem._lruNext._lruPrev = aItem._lruPrev;
  else
    this._tail = aItem._lruPrev;

  // (because we are nice, we will delete the properties...)
  delete aItem._lruNext;
  delete aItem._lruPrev;
    
  // nuke from our id map
  delete this._idMap[aItem.id];
  
  this._size--;
}

/**
 * If any of the cached items are dirty, commit them, and make them no longer
 *  dirty.
 */
GlodaLRUCacheCollection.prototype.commitDirty = function cache_commitDirty() {
  // we can only do this if there is an update method available...
  if (!this._nounMeta.objUpdate)
    return;

  for each (let item in this._idMap) {
    if (item.dirty) {
      LOG.debug("flushing dirty: " + item);
      this._nounMeta.objUpdate.call(this._nounMeta.datastore, item);
      delete item.dirty;
    }
  }
}
