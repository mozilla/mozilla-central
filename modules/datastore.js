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

/* This file looks to Myk Melez <myk@mozilla.org>'s Mozilla Labs snowl
 * project's (http://hg.mozilla.org/labs/snowl/) modules/datastore.js
 * for inspiration and idioms (and also a name :).
 */

EXPORTED_SYMBOLS = ["GlodaDatastore"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gloda/modules/log4moz.js");

Cu.import("resource://gloda/modules/datamodel.js");
Cu.import("resource://gloda/modules/databind.js");
Cu.import("resource://gloda/modules/collection.js");

let MBM_LOG = Log4Moz.Service.getLogger("gloda.ds.mbm");

/**
 * @class This callback handles processing the asynchronous query results of
 *  GlodaDatastore.getMessagesByMessageID.  Because that method is only
 *  called as part of the indexing process, we are guaranteed that there will
 *  be no real caching ramifications.  Accordingly, we can also defer our cache
 *  processing (via GlodaCollectionManager) until the query completes.
 *
 * @param aMsgIDToIndex Map from message-id to the desired
 *
 * @constructor
 */
function MessagesByMessageIdCallback(aMsgIDToIndex, aResults,
                                     aCallback, aCallbackThis) {
  this.msgIDToIndex = aMsgIDToIndex;
  this.results = aResults;
  this.callback = aCallback;
  this.callbackThis = aCallbackThis;
}

MessagesByMessageIdCallback.prototype = {
  onItemsAdded: function gloda_ds_mbmi_onItemsAdded(aItems, aCollection) {
    MBM_LOG.debug("getting results...");
    for each (let [, message] in Iterator(aItems)) {
      this.results[this.msgIDToIndex[message.headerMessageID]].push(message);
    }
  },
  onItemsModified: function () {},
  onItemsRemoved: function () {},
  onQueryCompleted: function gloda_ds_mbmi_onQueryCompleted(aCollection) {
    MBM_LOG.debug("query completed, notifying... " + this.results);
    // we no longer need to unify; it is done for us.

    this.callback.call(this.callbackThis, this.results);
  }
};

let PCH_LOG = Log4Moz.Service.getLogger("gloda.ds.pch");

function PostCommitHandler(aCallbacks) {
  this.callbacks = aCallbacks;
}

PostCommitHandler.prototype = {
  handleResult: function gloda_ds_pch_handleResult(aResultSet) {
  },
  
  handleError: function gloda_ds_pch_handleError(aError) {
    PCH_LOG.error("database error:" + aError)
  },
  
  handleCompletion: function gloda_ds_pch_handleCompletion(aReason) {
    if (aReason == Ci.mozIStorageStatementCallback.REASON_FINISHED) {
      for each (let [iCallback, callback] in Iterator(this.callbacks)) {
        try {
          callback();
        }
        catch (ex) {
          dump("PostCommitHandler callback (" + ex.fileName + ":" +
               ex.lineNumber + ") threw: " + ex);
        }
      }
    }
    GlodaDatastore._asyncCompleted();
  }
};

let QFQ_LOG = Log4Moz.Service.getLogger("gloda.ds.qfq");

let QueryFromQueryResolver = {
  onItemsAdded: function(aIgnoredItems, aCollection, aFake) {
    let originColl = aCollection.data;

    if (!aFake) {
      originColl.deferredCount--;
      originColl.resolvedCount++;
    }
    
    // bail if we are still pending on some other load completion
    if (originColl.deferredCount > 0) {
      QFQ_LOG.debug("QFQR: bailing " + originColl._nounDef.name);
      return;
    }
    
    let referencesByNounID = originColl.masterCollection.referencesByNounID;
    let inverseReferencesByNounID = 
      originColl.masterCollection.inverseReferencesByNounID;

    if (originColl.pendingItems) {
      for (let [, item] in Iterator(originColl.pendingItems)) {
        //QFQ_LOG.debug("QFQR: loading deferred " + item.NOUN_ID + ":" + item.id);
        GlodaDatastore.loadNounDeferredDeps(item, referencesByNounID,
            inverseReferencesByNounID);
      }
      
      // we need to consider the possibility that we are racing a collection very
      //  much like our own.  as such, this means we need to perform cache
      //  unification as our last step.
      GlodaCollectionManager.cacheLoadUnify(originColl._nounDef.id,
        originColl.pendingItems, false);
  
      // just directly tell the collection about the items.  we know the query
      //  matches (at least until we introduce predicates that we cannot express
      //  in SQL.)
      QFQ_LOG.debug(" QFQR: about to trigger listener: " + originColl._listener +
          "with collection: " + originColl._nounDef.name);
      originColl._onItemsAdded(originColl.pendingItems);
      delete originColl.pendingItems;
    }
  },
  onItemsModified: function() {
  },
  onItemsRemoved: function() {
  },
  onQueryCompleted: function(aCollection) {
    let originColl = aCollection.data;
    if (originColl.deferredCount <= 0) {
      originColl._onQueryCompleted();
    }
  },
};

/**
 * @class Handles the results from a GlodaDatastore.queryFromQuery call.
 * @constructor
 */
function QueryFromQueryCallback(aStatement, aNounDef, aCollection) {
  this.statement = aStatement;
  this.nounDef = aNounDef;
  this.collection = aCollection;
  
  QFQ_LOG.debug("Creating QFQCallback for noun: " + aNounDef.name);
  
  // the master collection holds the referencesByNounID
  this.referencesByNounID = {};
  this.masterReferencesByNounID =
    this.collection.masterCollection.referencesByNounID;
  this.inverseReferencesByNounID = {};
  this.masterInverseReferencesByNounID =
    this.collection.masterCollection.inverseReferencesByNounID;
  // we need to contribute our references as we load things; we need this 
  //  because of the potential for circular dependencies and our inability to
  //  put things into the caching layer (or collection's _idMap) until we have
  //  fully resolved things.
  if (this.nounDef.id in this.masterReferencesByNounID)
    this.selfReferences = this.masterReferencesByNounID[this.nounDef.id];
  else
    this.selfReferences = this.masterReferencesByNounID[this.nounDef.id] = {};
  if (this.nounDef.parentColumnAttr) {
    if (this.nounDef.id in this.masterInverseReferencesByNounID)
      this.selfInverseReferences =
        this.masterInverseReferencesByNounID[this.nounDef.id];
    else
      this.selfInverseReferences =
        this.masterInverseReferencesByNounID[this.nounDef.id] = {};
  }
  
  this.needsLoads = false;
  
  GlodaDatastore._pendingAsyncStatements++;
}

QueryFromQueryCallback.prototype = {
  handleResult: function gloda_ds_qfq_handleResult(aResultSet) {
    let pendingItems = this.collection.pendingItems;
    let row;
    let nounDef = this.nounDef;
    let nounID = nounDef.id;
    while (row = aResultSet.getNextRow()) {
      let item = nounDef.objFromRow.call(nounDef.datastore, row);
      // try and replace the item with one from the cache, if we can
      let cachedItem = GlodaCollectionManager.cacheLookupOne(nounID, item.id,
                                                             false);
      //QFQ_LOG.debug("loading item " + nounDef.id + ":" + item.id + " existing: " +
      //    this.selfReferences[item.id] + " cached: " + cachedItem);
      if (cachedItem)
        item = cachedItem;
      // we may already have been loaded by this process
      else if (this.selfReferences[item.id] != null)
        item = this.selfReferences[item.id];
      // perform loading logic which may produce reference dependencies
      else
        this.needsLoads = 
          GlodaDatastore.loadNounItem(item, this.referencesByNounID,
                                      this.inverseReferencesByNounID) ||
          this.needsLoads;
      
      // add ourself to the references by our id
//QFQ_LOG.debug("saving item " + nounDef.id + ":" + item.id + " to self-refs");
      this.selfReferences[item.id] = item;
      
      // if we're tracking it, add ourselves to our parent's list of children
      //  too
      if (this.selfInverseReferences) {
        let parentID = item[nounDef.parentColumnAttr.idStorageAttributeName];
        let childrenList = this.selfInverseReferences[parentID];
        if (childrenList === undefined)
          childrenList = this.selfInverseReferences[parentID] = [];
        childrenList.push(item);
      }
      
      pendingItems.push(item);
    }
  },

  handleError: function gloda_ds_qfq_handleError(aError) {
    GlodaDatastore._log.error("Async queryFromQuery error: " +
      aError.result + ": " + aError.message);
  },

  handleCompletion: function gloda_ds_qfq_handleCompletion(aReason) {
    this.statement.finalize();
    this.statement = null;
    
    QFQ_LOG.debug("handleCompletion: " + this.collection._nounDef.name);
    
    if (this.needsLoads) {
      for each (let [nounID, references] in Iterator(this.referencesByNounID)) {
        if (nounID == this.nounDef.id)
          continue;
        let nounDef = GlodaDatastore._nounIDToDef[nounID];
        QFQ_LOG.debug("  have references for noun: " + nounDef.name);
        // try and load them out of the cache/existing collections.  items in the
        //  cache will be fully formed, which is nice for us.
        // XXX this mechanism will get dubious when we have multiple paths to a
        //  single noun-type.  For example, a -> b -> c, a-> c; two paths to c
        //  and we're looking at issuing two requests to c, the latter of which
        //  will be a superset of the first one.  This does not currently pose
        //  a problem because we only have a -> b -> c -> b, and sequential
        //  processing means no alarms and no surprises.
        let masterReferences = this.masterReferencesByNounID[nounID];
        if (masterReferences === undefined)
          masterReferences = this.masterReferencesByNounID[nounID] = {};
        let outReferences;
        if (nounDef.parentColumnAttr)
          outReferences = {};
        else
          outReferences = masterReferences;
        let [foundCount, notFoundCount, notFound] =
          GlodaCollectionManager.cacheLookupMany(nounDef.id, references,
              outReferences);

        if (nounDef.parentColumnAttr) {
          let inverseReferences;
          if (nounDef.id in this.masterInverseReferencesByNounID)
            inverseReferences =
              this.masterInverseReferencesByNounID[nounDef.id];
          else
            inverseReferences =
              this.masterInverseReferencesByNounID[nounDef.id] = {};
          
          for each (let item in outReferences) {
            masterReferences[item.id] = item;
            let parentID = item[nounDef.parentColumnAttr.idStorageAttributeName];
            let childrenList = inverseReferences[parentID];
            if (childrenList === undefined)
              childrenList = inverseReferences[parentID] = [];
            childrenList.push(item);
          }
        }
        
        QFQ_LOG.debug("  found: " + foundCount + " not found: " + notFoundCount);
        if (notFoundCount === 0) {
          this.collection.resolvedCount++;
        }
        else {
          this.collection.deferredCount++;
          let query = new nounDef.queryClass();
          query.id.apply(query, [id for (id in notFound)]);
          
          this.collection.masterCollection.subCollections[nounDef.id] = 
            GlodaDatastore.queryFromQuery(query, QueryFromQueryResolver, 
              this.collection,
              // we fully expect/allow for there being no such subcollection yet.
              this.collection.masterCollection.subCollections[nounDef.id],
              this.collection.masterCollection);
        }
      }
      
      for each (let [nounID, inverseReferences] in
          Iterator(this.inverseReferencesByNounID)) {
        this.collection.deferredCount++;
        let nounDef = GlodaDatastore._nounIDToDef[nounID];
        
        QFQ_LOG.debug("Want to load inverse via " + nounDef.parentColumnAttr.boundName);
  
        let query = new nounDef.queryClass();
        // we want to constrain using the parent column
        let queryConstrainer = query[nounDef.parentColumnAttr.boundName];
        queryConstrainer.apply(query, [pid for (pid in inverseReferences)]);
        this.collection.masterCollection.subCollections[nounDef.id] = 
          GlodaDatastore.queryFromQuery(query, QueryFromQueryResolver,
            this.collection,
            // we fully expect/allow for there being no such subcollection yet.
            this.collection.masterCollection.subCollections[nounDef.id],
            this.collection.masterCollection);
      }
    }
    else {
      this.collection.deferredCount--;
      this.collection.resolvedCount++;
    }
    
    QFQ_LOG.debug("  defer: " + this.collection.deferredCount +
                  " resolved: " + this.collection.resolvedCount);
    
    // process immediately and kick-up to the master collection...
    try {
      if (this.collection.deferredCount <= 0) {
        // this guy will resolve everyone using referencesByNounID and issue the
        //  call to this.collection._onItemsAdded to propagate things to the
        //  next concerned subCollection or the actual listener if this is the
        //  master collection.  (Also, call _onQueryCompleted).
        QueryFromQueryResolver.onItemsAdded(null, {data: this.collection}, true);
        QueryFromQueryResolver.onQueryCompleted({data: this.collection});
      }
    }
    finally {
      GlodaDatastore._asyncCompleted();
    }
  }
};


/**
 * Database abstraction layer.  Contains explicit SQL schemas for our
 *  fundamental representations (core 'nouns', if you will) as well as
 *  specialized functions for then dealing with each type of object.  At the
 *  same time, we are beginning to support extension-provided tables, which
 *  call into question whether we really need our hand-rolled code, or could
 *  simply improve the extension-provided table case to work for most of our
 *  hand-rolled cases.
 * For now, the argument can probably be made that our explicit schemas and code
 *  is readable/intuitive (not magic) and efficient (although generic stuff
 *  could also be made efficient, if slightly evil through use of eval or some
 *  other code generation mechanism.)
 *
 * === Data Model Interaction / Dependencies
 *
 * Dependent on and assumes limited knowledge of the datamodel.js
 *  implementations.  datamodel.js actually has an implicit dependency on
 *  our implementation, reaching back into the datastore via the _datastore
 *  attribute which we pass into every instance we create.
 * We pass a reference to ourself as we create the datamodel.js instances (and
 *  they store it as _datastore) because of a half-implemented attempt to make
 *  it possible to live in a world where we have multiple datastores.  This
 *  would be desirable in the cases where we are dealing with multiple SQLite
 *  databases.  This could be because of per-account global databases or
 *  some other segmentation.  This was abandoned when the importance of
 *  per-account databases was diminished following public discussion, at least
 *  for the short-term, but no attempted was made to excise the feature or
 *  preclude it.  (Merely a recognition that it's too much to try and implement
 *  correct right now, especially because our solution might just be another
 *  (aggregating) layer on top of things, rather than complicating the lower
 *  levels.)
 *
 * === Object Identity / Caching
 *
 * The issue of object identity is handled by integration with the collection.js
 *  provided GlodaCollectionManager.  By "Object Identity", I mean that we only
 *  should ever have one object instance alive at a time that corresponds to
 *  an underlying database row in the database.  Where possible we avoid
 *  performing database look-ups when we can check if the object is already
 *  present in memory; in practice, this means when we are asking for an object
 *  by ID.  When we cannot avoid a database query, we attempt to make sure that
 *  we do not return a duplicate object instance, instead replacing it with the
 *  'live' copy of the object.  (Ideally, we would avoid any redundant
 *  construction costs, but that is not currently the case.)
 * Although you should consult the GlodaCollectionManager for details, the
 *  general idea is that we have 'collections' which represent views of the
 *  database (based on a query) which use a single mechanism for double duty.
 *  The collections are registered with the collection manager via weak
 *  reference.  The first 'duty' is that since the collections may be desired
 *  to be 'live views' of the data, we want them to update as changes occur.
 *  The weak reference allows the collection manager to track the 'live'
 *  collections and update them.  The second 'duty' is the caching/object
 *  identity duty.  In theory, every live item should be referenced by at least
 *  one collection, making it reachable for object identity/caching purposes.
 * There is also an explicit (inclusive) caching layer present to both try and
 *  avoid poor performance from some of the costs of this strategy, as well as
 *  to try and keep track of objects that are being worked with that are not
 *  (yet) tracked by a collection.  Using a size-bounded cache is clearly not
 *  a guarantee of correctness for this, but is suspected will work quite well.
 *  (Well enough to be dangerous because the inevitable failure case will not be
 *  expected.)
 *
 * The current strategy may not be the optimal one, feel free to propose and/or
 *  implement better ones, especially if you have numbers.
 * The current strategy is not fully implemented in this file, but the common
 *  cases are believed to be covered.  (Namely, we fail to purge items from the
 *  cache as they are purged from the database.)
 *
 * === Things That May Not Be Obvious (Gotchas)
 *
 * Although the schema includes "triggers", they are currently not used
 *  and were added when thinking about implementing the feature.  We will
 *  probably implement this feature at some point, which is why they are still
 *  in there.
 *
 * We, and the layers above us, are not sufficiently thorough at cleaning out
 *  data from the database, and may potentially orphan it _as new functionality
 *  is added in the future at layers above us_.  That is, currently we should
 *  not be leaking database rows, but we may in the future.  This is because
 *  we/the layers above us lack a mechanism to track dependencies based on
 *  attributes.  Say a plugin exists that extracts recipes from messages and
 *  relates them via an attribute.  To do so, it must create new recipe rows
 *  in its own table as new recipes are discovered.  No automatic mechanism
 *  will purge recipes as their source messages are purged, nor does any
 *  event-driven mechanism explicitly inform the plugin.  (It could infer
 *  such an event from the indexing/attribute-providing process, or poll the
 *  states of attributes to accomplish this, but that is not desirable.)  This
 *  needs to be addressed, and may be best addressed at layers above
 *  datastore.js.
 * @namespace
 */
var GlodaDatastore = {
  _log: null,

  /* see Gloda's documentation for these constants */
  kSpecialNotAtAll: 0,
  kSpecialColumn: 16,
  kSpecialColumnChildren: 16|1,
  kSpecialColumnParent: 16|2,
  kSpecialString: 32,
  kSpecialFulltext: 64,
  
  kConstraintIdIn: 0,
  kConstraintIn: 1,
  kConstraintRanges: 2,
  kConstraintEquals: 3,
  kConstraintStringLike: 4,
  kConstraintFulltext: 5,

  /* ******************* SCHEMA ******************* */

  _schemaVersion: 10,
  _schema: {
    tables: {

      // ----- Messages
      folderLocations: {
        columns: [
          "id INTEGER PRIMARY KEY",
          "folderURI TEXT NOT NULL",
          "dirtyStatus INTEGER NOT NULL",
          "name TEXT NOT NULL",
        ],

        triggers: {
          delete: "DELETE from messages WHERE folderID = OLD.id",
        },
      },

      conversations: {
        columns: [
          "id INTEGER PRIMARY KEY",
          "subject TEXT NOT NULL",
          "oldestMessageDate INTEGER",
          "newestMessageDate INTEGER",
        ],

        indices: {
          subject: ['subject'],
          oldestMessageDate: ['oldestMessageDate'],
          newestMessageDate: ['newestMessageDate'],
        },

        fulltextColumns: [
          "subject TEXT",
        ],

        triggers: {
          delete: "DELETE from messages WHERE conversationID = OLD.id",
        },
      },

      /**
       * A message record correspond to an actual message stored in a folder
       *  somewhere, or is a ghost record indicating a message that we know
       *  should exist, but which we have not seen (and which we may never see).
       *  We represent these ghost messages by storing NULL values in the
       *  folderID and messageKey fields; this may need to change to other
       *  sentinel values if this somehow impacts performance.
       */
      messages: {
        columns: [
          "id INTEGER PRIMARY KEY",
          "folderID INTEGER REFERENCES folderLocations(id)",
          "messageKey INTEGER",
          "conversationID INTEGER NOT NULL REFERENCES conversations(id)",
          "date INTEGER",
          // we used to have the parentID, but because of the very real
          //  possibility of multiple copies of a message with a given
          //  message-id, the parentID concept is unreliable.
          "headerMessageID TEXT",
          "deleted INTEGER NOT NULL default 0",
          "jsonAttributes TEXT",
        ],

        indices: {
          messageLocation: ['folderID', 'messageKey'],
          headerMessageID: ['headerMessageID'],
          conversationID: ['conversationID'],
          date: ['date'],
          deleted: ['deleted'],
        },

        fulltextColumns: [
          "subject TEXT",
          "body TEXT",
          "attachmentNames TEXT",
        ],

        triggers: {
          delete: "DELETE FROM messageAttributes WHERE messageID = OLD.id",
        },
      },

      // ----- Attributes
      attributeDefinitions: {
        columns: [
          "id INTEGER PRIMARY KEY",
          "attributeType INTEGER NOT NULL",
          "extensionName TEXT NOT NULL",
          "name TEXT NOT NULL",
          "parameter BLOB",
        ],

        triggers: {
          delete: "DELETE FROM messageAttributes WHERE attributeID = OLD.id",
        },
      },

      messageAttributes: {
        columns: [
          "conversationID INTEGER NOT NULL REFERENCES conversations(id)",
          "messageID INTEGER NOT NULL REFERENCES messages(id)",
          "attributeID INTEGER NOT NULL REFERENCES attributeDefinitions(id)",
          "value NUMERIC",
        ],

        indices: {
          attribQuery: [
            "attributeID", "value",
            /* covering: */ "conversationID", "messageID"],
        },
      },

      // ----- Contacts / Identities

      /**
       * Corresponds to a human being and roughly to an address book entry.
       *  Constrast with an identity, which is a specific e-mail address, IRC
       *  nick, etc.  Identities belong to contacts, and this relationship is
       *  expressed on the identityAttributes table.
       */
      contacts: {
        columns: [
          "id INTEGER PRIMARY KEY",
          "directoryUUID TEXT",
          "contactUUID TEXT",
          "popularity INTEGER",
          "frecency INTEGER",
          "name TEXT",
          "jsonAttributes TEXT",
        ],
        indices: {
          popularity: ["popularity"],
          frecency: ["frecency"],
        },
      },

      contactAttributes: {
        columns: [
          "contactID INTEGER NOT NULL REFERENCES contacts(id)",
          "attributeID INTEGER NOT NULL REFERENCES attributeDefinitions(id)",
          "value NUMERIC"
        ],
        indices: {
          contactAttribQuery: [
            "attributeID", "value",
            /* covering: */ "contactID"],
        }
      },

      /**
       * Identities correspond to specific e-mail addresses, IRC nicks, etc.
       */
      identities: {
        columns: [
          "id INTEGER PRIMARY KEY",
          "contactID INTEGER NOT NULL REFERENCES contacts(id)",
          "kind TEXT NOT NULL", // ex: email, irc, etc.
          "value TEXT NOT NULL", // ex: e-mail address, irc nick/handle, etc.
          "description NOT NULL", // what makes this identity different from the
          // others? (ex: home, work, etc.)
          "relay INTEGER NOT NULL", // is the identity just a relay mechanism?
          // (ex: mailing list, twitter 'bouncer', IRC gateway, etc.)
        ],

        indices: {
          contactQuery: ["contactID"],
          valueQuery: ["kind", "value"]
        }
      },

      //identityAttributes: {
      //},

    },
  },


  /* ******************* LOGIC ******************* */
  /**
   * Our synchronous connection, primarily intended for read-only use, so as to
   *  avoid stepping on the toes of our asynchronous connection that will do
   *  most/all of our updating.
   */
  syncConnection: null,
  /**
   * Our connection reused for asynchronous usage, intended for database write
   *  purposes.
   */
  asyncConnection: null,

  /**
   * Initialize logging, create the database if it doesn't exist, "upgrade" it
   *  if it does and it's not up-to-date, fill our authoritative folder uri/id
   *  mapping.
   */
  _init: function gloda_ds_init(aNsJSON, aNounIDToDef) {
    this._log = Log4Moz.Service.getLogger("gloda.datastore");
    this._log.debug("Beginning datastore initialization.");
    
    this._json = aNsJSON;
    this._nounIDToDef = aNounIDToDef;

    // Get the path to our global database
    var dirService = Cc["@mozilla.org/file/directory_service;1"].
                     getService(Ci.nsIProperties);
    var dbFile = dirService.get("ProfD", Ci.nsIFile);
    dbFile.append("global-messages-db.sqlite");

    // Get the storage (sqlite) service
    var dbService = Cc["@mozilla.org/storage/service;1"].
                    getService(Ci.mozIStorageService);

    var dbConnection;

    // Create the file if it does not exist
    if (!dbFile.exists()) {
      this._log.debug("Creating database because it does't exist.");
      dbConnection = this._createDB(dbService, dbFile);
    }
    // It does exist, but we (someday) might need to upgrade the schema
    else {
      // (Exceptions may be thrown if the database is corrupt)
      { // try {
        dbConnection = dbService.openUnsharedDatabase(dbFile);

        if (dbConnection.schemaVersion != this._schemaVersion) {
          this._log.debug("Need to migrate database.  (DB version: " +
            dbConnection.schemaVersion + " desired version: " +
            this._schemaVersion);
          dbConnection = this._migrate(dbService, dbFile,
                                       dbConnection,
                                       dbConnection.schemaVersion,
                                       this._schemaVersion);
          this._log.debug("Migration completed.");
        }
      }
      // Handle corrupt databases, other oddities
      // ... in the future. for now, let us die
    }

    this.syncConnection = dbConnection;
    this.asyncConnection = dbService.openUnsharedDatabase(dbFile);

    this._log.debug("Initializing folder mappings.");
    this._getAllFolderMappings();
    // we need to figure out the next id's for all of the tables where we
    //  manage that.
    this._log.debug("Populating managed id counters.");
    this._populateAttributeDefManagedId();
    this._populateConversationManagedId();
    this._populateMessageManagedId();
    this._populateContactManagedId();
    this._populateIdentityManagedId();
    
    this._log.debug("Completed datastore initialization.");
  },

  /**
   * Initiate database shutdown; because this might requiring waiting for
   *  outstanding synchronous events to drain, we allow the caller to pass in
   *  a callback to invoke if we are unable to complete shutdown within this
   *  call.
   * @return true if we were able to shutdown fully, false if we were not.  The
   *   callback, if provided, will be notified if we return false.  It will
   *   not be called if we return true.
   */
  shutdown: function gloda_ds_shutdown(aCallback, aCallbackThis) {
    // clear out any transaction
    while (this._transactionDepth) {
      this._log.info("Closing pending transaction out for shutdown.");
      // just schedule this function to be run again once the transaction has
      //  been closed out.
      this._commitTransaction();
    }

    let datastore = this;

    function finish_cleanup() {
      datastore._cleanupAsyncStatements();
      datastore._log.info("Closing async connection");
      datastore.asyncConnection.close();
      datastore.asyncConnection = null;

      datastore._cleanupSyncStatements();
      datastore._log.info("Closing sync connection");
      datastore.syncConnection.close();
      datastore.syncConnection = null;

      if (aCallback) {
        aCallback.call(aCallbackThis);
      }
    }

    if (this._pendingAsyncStatements) {
      this._pendingAsyncCompletedListener = finish_cleanup;
      return false;
    }
    else {
      aCallback = null;
      finish_cleanup();
      return true;
    }
  },

  /**
   * Create our database; basically a wrapper around _createSchema.
   */
  _createDB: function gloda_ds_createDB(aDBService, aDBFile) {
    var dbConnection = aDBService.openUnsharedDatabase(aDBFile);

    dbConnection.beginTransaction();
    try {
      this._createSchema(dbConnection);
      dbConnection.commitTransaction();
    }
    catch(ex) {
      dbConnection.rollbackTransaction();
      throw ex;
    }

    return dbConnection;
  },

  _createTableSchema: function gloda_ds_createTableSchema(aDBConnection,
      aTableName) {
    let table = this._schema.tables[aTableName];

    // - Create the table
    aDBConnection.createTable(aTableName, table.columns.join(", "));

    // - Create the fulltext table if applicable
    if ("fulltextColumns" in table) {
      let createFulltextSQL = "CREATE VIRTUAL TABLE " + aTableName + "Text" +
        " USING fts3(tokenize porter, " + table.fulltextColumns.join(", ") +
        ")";
      this._log.info("Create fulltext: " + createFulltextSQL);
      aDBConnection.executeSimpleSQL(createFulltextSQL);
    }

    // - Create its indices
    for (let indexName in table.indices) {
      let indexColumns = table.indices[indexName];

      aDBConnection.executeSimpleSQL(
        "CREATE INDEX " + indexName + " ON " + aTableName +
        "(" + indexColumns.join(", ") + ")");
    }
  },

  /**
   * Create our database schema assuming a newly created database.  This
   *  comes down to creating normal tables, their full-text variants (if
   *  applicable), and their indices.
   */
  _createSchema: function gloda_ds_createSchema(aDBConnection) {
    // -- For each table...
    for (let tableName in this._schema.tables) {
      this._createTableSchema(aDBConnection, tableName);
    }

    aDBConnection.schemaVersion = this._schemaVersion;
  },

  /**
   * Our table definition used here is slightly different from that used
   *  internally, because we are potentially creating a sort of crappy ORM and
   *  we don't want to have to parse the column names out.
   */
  createTableIfNotExists: function gloda_ds_createTableIfNotExists(aTableDef) {
    aTableDef._realName = "ext_" + aTableDef.name;

    // first, check if the table exists
    if (!this.asyncConnection.tableExists(aTableDef._realName)) {
      try {
        this.asyncConnection.createTable(aTableDef._realName,
          [coldef.join(" ") for each
           ([i, coldef] in Iterator(aTableDef.columns))].join(", "));
      }
      catch (ex) {
         this._log.error("Problem creating table " + aTableDef.name + " " +
           "because: " + ex + " at " + ex.fileName + ":" + ex.lineNumber);
         return null;
      }

      for (let indexName in aTableDef.indices) {
        let indexColumns = aTableDef.indices[indexName];

        try {
          let indexSql = "CREATE INDEX " + indexName + " ON " +
            aTableDef._realName + " (" + indexColumns.join(", ") + ")";
          this.asyncConnection.executeSimpleSQL(indexSql);
        }
        catch (ex) {
          this._log.error("Problem creating index " + indexName + " for " +
            "table " + aTableDef.name + " because " + ex + " at " +
            ex.fileName + ":" + ex.lineNumber);
        }
      }
    }

    return new GlodaDatabind(aTableDef, this);
  },

  _migrate: function gloda_ds_migrate(aDBService, aDBFile, aDBConnection,
                                      aCurVersion, aNewVersion) {
    // we purged our way up to version 8, so we can/must purge prior to 8.
    if (aCurVersion < 8) {
      aDBConnection.close();
      aDBFile.remove(false);
      this._log.warn("Global database has been purged due to schema change.");
      return this._createDB(aDBService, aDBFile);
    }
    // version 9 just adds the contactAttributes table
    if (aCurVersion < 9) {
      this._createTableSchema(aDBConnection, "contactAttributes");
    }
    // version 10:
    // we have so many changes here, not to mention semantic changes, that
    //  purging is the right answer.
    // - adds dirtyStatus, name to folderLocations
    // - removes messageAttribFetch index from messageAttributes
    // - removes conversationAttribFetch index from messageAttributes
    // - removes contactAttribFetch index from contactAttributes
    // - adds jsonAttributes column to messages table
    // - adds jsonAttributes column to contacts table
    if (aCurVersion < 10) {
      aDBConnection.close();
      aDBFile.remove(false);
      this._log.warn("Global database has been purged due to schema change.");
      return this._createDB(aDBService, aDBFile);
    }
    
    aDBConnection.schemaVersion = aNewVersion;
    
    return aDBConnection;
  },

  _outstandingAsyncStatements: [],

  _createAsyncStatement: function gloda_ds_createAsyncStatement(aSQLString,
                                                                aWillFinalize) {
    let statement = null;
    try {
      statement = this.asyncConnection.createStatement(aSQLString);
    }
    catch(ex) {
       throw("error creating async statement " + aSQLString + " - " +
             this.asyncConnection.lastError + ": " +
             this.asyncConnection.lastErrorString + " - " + ex);
    }

    if (!aWillFinalize)
      this._outstandingAsyncStatements.push(statement);

    return statement;
  },

  _cleanupAsyncStatements: function gloda_ds_cleanupAsyncStatements() {
    [stmt.finalize() for each
     ([i, stmt] in Iterator(this._outstandingAsyncStatements))];
  },

  _outstandingSyncStatements: [],

  _createSyncStatement: function gloda_ds_createSyncStatement(aSQLString,
                                                              aWillFinalize) {
    let statement = null;
    try {
      statement = this.syncConnection.createStatement(aSQLString);
    }
    catch(ex) {
       throw("error creating sync statement " + aSQLString + " - " +
             this.syncConnection.lastError + ": " +
             this.syncConnection.lastErrorString + " - " + ex);
    }

    if (!aWillFinalize)
      this._outstandingSyncStatements.push(statement);

    return statement;
  },

  _cleanupSyncStatements: function gloda_ds_cleanupSyncStatements() {
    [stmt.finalize() for each
     ([i, stmt] in Iterator(this._outstandingSyncStatements))];
  },

  /**
   * Perform a synchronous executeStep on the statement, handling any
   *  SQLITE_BUSY fallout that could conceivably happen from a collision on our
   *  read with the async writes.
   * Basically we keep trying until we succeed or run out of tries.
   * We believe this to be a reasonable course of action because we don't
   *  expect this to happen much.
   */
  _syncStep: function gloda_ds_syncStep(aStatement) {
    let tries = 0;
    while (tries < 32000) {
      try {
        return aStatement.executeStep();
      }
      // SQLITE_BUSY becomes NS_ERROR_FAILURE
      catch (e if e.result == 0x80004005) {
        tries++;
        // we really need to delay here, somehow.  unfortunately, we can't
        //  allow event processing to happen, and most of the things we could
        //  do to delay ourselves result in event processing happening.  (Use
        //  of a timer, a synchronous dispatch, etc.)
        // in theory, nsIThreadEventFilter could allow us to stop other events
        //  that aren't our timer from happening, but it seems slightly
        //  dangerous and 'notxpcom' suggests it ain't happening anyways...
        // so, let's just be dumb and hope that the underlying file I/O going
        //  on makes us more likely to yield to the other thread so it can
        //  finish what it is doing...
      }
    }
    this._log.error("Synchronous step gave up after " + tries + " tries.");
  },

  /**
   * Helper to bind based on the actual type of the javascript value.  Note
   *  that we always use int64 because under the hood sqlite just promotes the
   *  normal 'int' call to 'int64' anyways.
   */
  _bindVariant: function gloda_ds_bindBlob(aStatement, aIndex, aVariant) {
    if (aVariant == null) // catch both null and undefined
      aStatement.bindNullParameter(aIndex);
    else if (typeof aVariant == "string")
      aStatement.bindStringParameter(aIndex, aVariant);
    else if (typeof aVariant == "number") {
      // we differentiate for storage representation reasons only.
      if (Math.floor(aVariant) === aVariant)
        aStatement.bindInt64Parameter(aIndex, aVariant);
      else
        aStatement.bindDoubleParameter(aIndex, aVariant);
    }
    else
      throw("Attempt to bind variant with unsupported type: " +
            (typeof aVariant));
  },

  _getVariant: function gloda_ds_getBlob(aRow, aIndex) {
    let typeOfIndex = aRow.getTypeOfIndex(aIndex);
    if (typeOfIndex == Ci.mozIStorageValueArray.VALUE_TYPE_NULL)
      return null;
    // XPConnect would just end up going through an intermediary double stage
    //  for the int64 case anyways...
    else if (typeOfIndex == Ci.mozIStorageValueArray.VALUE_TYPE_INTEGER ||
             typeOfIndex == Ci.mozIStorageValueArray.VALUE_TYPE_DOUBLE)
      return aRow.getDouble(aIndex);
    else // typeOfIndex == Ci.mozIStorageValueArray.VALUE_TYPE_TEXT
      return aRow.getString(aIndex);
  },

  /** Simple nested transaction support as a performance optimization. */
  _transactionDepth: 0,
  _transactionGood: false,

  get _beginTransactionStatement() {
    let statement = this._createAsyncStatement("BEGIN TRANSACTION");
    this.__defineGetter__("_beginTransactionStatement", function() statement);
    return this._beginTransactionStatement;
  },

  get _commitTransactionStatement() {
    let statement = this._createAsyncStatement("COMMIT");
    this.__defineGetter__("_commitTransactionStatement", function() statement);
    return this._commitTransactionStatement;
  },

  get _rollbackTransactionStatement() {
    let statement = this._createAsyncStatement("ROLLBACK");
    this.__defineGetter__("_rollbackTransactionStatement", function() statement);
    return this._rollbackTransactionStatement;
  },

  _pendingPostCommitCallbacks: null,
  /**
   * Register a callback to be invoked when the current transaction's commit
   *  completes.
   */
  runPostCommit: function gloda_ds_runPostCommit(aCallback) {
    this._pendingPostCommitCallbacks.push(aCallback);
  },

  /**
   * Begin a potentially nested transaction; only the outermost transaction gets
   *  to be an actual transaction, and the failure of any nested transaction
   *  results in a rollback of the entire outer transaction.  If you really
   *  need an atomic transaction
   */
  _beginTransaction: function gloda_ds_beginTransaction() {
    if (this._transactionDepth == 0) {
      this._pendingPostCommitCallbacks = [];
      this._beginTransactionStatement.executeAsync(this.trackAsync());
      this._transactionGood = true;
    }
    this._transactionDepth++;
  },
  /**
   * Commit a potentially nested transaction; if we are the outer-most
   *  transaction and no sub-transaction issues a rollback
   *  (via _rollbackTransaction) then we commit, otherwise we rollback.
   */
  _commitTransaction: function gloda_ds_commitTransaction() {
    this._transactionDepth--;
    if (this._transactionDepth == 0) {
      try {
        if (this._transactionGood)
          this._commitTransactionStatement.executeAsync(
            new PostCommitHandler(this._pendingPostCommitCallbacks));
        else
          this._rollbackTransactionStatement.executeAsync(this.trackAsync());
      }
      catch (ex) {
        this._log.error("Commit problem: " + ex);
      }
      this._pendingPostCommitCallbacks = [];
    }
  },
  /**
   * Abort the commit of the potentially nested transaction.  If we are not the
   *  outermost transaction, we set a flag that tells the outermost transaction
   *  that it must roll back.
   */
  _rollbackTransaction: function gloda_ds_rollbackTransaction() {
    this._transactionDepth--;
    this._transactionGood = false;
    if (this._transactionDepth == 0) {
      try {
        this._rollbackTransactionStatement.executeAsync(this.trackAsync());
      }
      catch (ex) {
        this._log.error("Rollback problem: " + ex);
      }
    }
  },

  _pendingAsyncStatements: 0,
  /**
   * The function to call, if any, when we hit 0 pending async statements.
   */
  _pendingAsyncCompletedListener: null,
  _asyncCompleted: function () {
    if (--this._pendingAsyncStatements == 0) {
      if (this._pendingAsyncCompletedListener !== null) {
        this._pendingAsyncCompletedListener();
        this._pendingAsyncCompletedListener = null;
      }
    }
  },
  _asyncTrackerListener: {
    handleResult: function () {},
    handleError: function() {},
    handleCompletion: function () {
      // the helper method exists because the other classes need to call it too
      GlodaDatastore._asyncCompleted();
    }
  },
  /**
   * Increments _pendingAsyncStatements and returns a listener that will
   *  decrement the value when the statement completes.
   */
  trackAsync: function() {
    this._pendingAsyncStatements++;
    return this._asyncTrackerListener;
  },

  /* ********** Attribute Definitions ********** */
  /** Maps (attribute def) compound names to the GlodaAttributeDBDef objects. */
  _attributeDBDefs: {},
  /** Map attribute ID to the definition and parameter value that produce it. */
  _attributeIDToDBDefAndParam: {},
  /**
   * We maintain the attributeDefinitions next id counter mainly because we can.
   *  Since we mediate the access, there's no real risk to doing so, and it
   *  allows us to keep the writes on the async connection without having to
   *  wait for a completion notification.
   */
  _nextAttributeId: 1,

  _populateAttributeDefManagedId: function () {
    let stmt = this._createSyncStatement(
      "SELECT MAX(id) FROM attributeDefinitions", true);
    if (stmt.executeStep()) { // no chance of this SQLITE_BUSY on this call
      this._nextAttributeId = stmt.getInt64(0) + 1;
    }
    stmt.finalize();
  },

  get _insertAttributeDefStatement() {
    let statement = this._createAsyncStatement(
      "INSERT INTO attributeDefinitions (id, attributeType, extensionName, \
                                  name, parameter) \
              VALUES (?1, ?2, ?3, ?4, ?5)");
    this.__defineGetter__("_insertAttributeDefStatement", function() statement);
    return this._insertAttributeDefStatement;
  },

  /**
   * Create an attribute definition and return the row ID.  Special/atypical
   *  in that it doesn't directly return a GlodaAttributeDBDef; we leave that up
   *  to the caller since they know much more than actually needs to go in the
   *  database.
   *
   * @return The attribute id allocated to this attribute.
   */
  _createAttributeDef: function gloda_ds_createAttributeDef(aAttrType,
                                    aExtensionName, aAttrName, aParameter) {
    let attributeId = this._nextAttributeId++;

    let iads = this._insertAttributeDefStatement;
    iads.bindInt64Parameter(0, attributeId);
    iads.bindInt64Parameter(1, aAttrType);
    iads.bindStringParameter(2, aExtensionName);
    iads.bindStringParameter(3, aAttrName);
    this._bindVariant(iads, 4, aParameter);

    iads.executeAsync(this.trackAsync());

    return attributeId;
  },

  /**
   * Sync-ly look-up all the attribute definitions, populating our authoritative
   *  _attributeDBDefss and _attributeIDToDBDefAndParam maps.  (In other words,
   *  once this method is called, those maps should always be in sync with the
   *  underlying database.)
   */
  getAllAttributes: function gloda_ds_getAllAttributes() {
    let stmt = this._createSyncStatement(
      "SELECT id, attributeType, extensionName, name, parameter \
         FROM attributeDefinitions", true);

    // map compound name to the attribute
    let attribs = {};
    // map the attribute id to [attribute, parameter] where parameter is null
    //  in cases where parameter is unused.
    let idToAttribAndParam = {}

    this._log.info("loading all attribute defs");

    while (stmt.executeStep()) {  // no chance of this SQLITE_BUSY on this call
      let rowId = stmt.getInt64(0);
      let rowAttributeType = stmt.getInt64(1);
      let rowExtensionName = stmt.getString(2);
      let rowName = stmt.getString(3);
      let rowParameter = this._getVariant(stmt, 4);

      let compoundName = rowExtensionName + ":" + rowName;

      let attrib;
      if (compoundName in attribs) {
        attrib = attribs[compoundName];
      } else {
        attrib = new GlodaAttributeDBDef(this, /* aID */ null,
          compoundName, rowAttributeType, rowExtensionName, rowName);
        attribs[compoundName] = attrib;
      }
      // if the parameter is null, the id goes on the attribute def, otherwise
      //  it is a parameter binding and goes in the binding map.
      if (rowParameter == null) {
        attrib._id = rowId;
        idToAttribAndParam[rowId] = [attrib, null];
      } else {
        attrib._parameterBindings[rowParameter] = rowId;
        idToAttribAndParam[rowId] = [attrib, rowParameter];
      }
    }
    stmt.finalize();

    this._log.info("done loading all attribute defs");

    this._attributeDBDefs = attribs;
    this._attributeIDToDBDefAndParam = idToAttribAndParam;
  },

  /**
   * Helper method for GlodaAttributeDBDef to tell us when their bindParameter
   *  method is called and they have created a new binding (using
   *  GlodaDatastore._createAttributeDef).  In theory, that method could take
   *  an additional argument and obviate the need for this method.
   */
  reportBinding: function gloda_ds_reportBinding(aID, aAttrDef, aParamValue) {
    this._attributeIDToDBDefAndParam[aID] = [aAttrDef, aParamValue];
  },

  /* ********** Folders ********** */
  /** next folder (row) id to issue, populated by _getAllFolderMappings. */
  _nextFolderId: 1,

  get _insertFolderLocationStatement() {
    let statement = this._createAsyncStatement(
      "INSERT INTO folderLocations (id, folderURI, dirtyStatus, name) VALUES \
        (?1, ?2, ?3, ?4)");
    this.__defineGetter__("_insertFolderLocationStatement",
      function() statement);
    return this._insertFolderLocationStatement;
  },

  /**
   * Authoritative map from folder URI to folder ID.  (Authoritative in the
   *  sense that this map exactly represents the state of the underlying
   *  database.  If it does not, it's a bug in updating the database.)
   */
  _folderByURI: {},
  /** Authoritative map from folder ID to folder URI */
  _folderByID: {},

  /** Intialize our _folderByURI/_folderByID mappings, called by _init(). */
  _getAllFolderMappings: function gloda_ds_getAllFolderMappings() {
    let stmt = this._createSyncStatement(
      "SELECT id, folderURI, dirtyStatus, name FROM folderLocations", true);

    while (stmt.executeStep()) {  // no chance of this SQLITE_BUSY on this call
      let folderID = stmt.getInt64(0);
      let folderURI = stmt.getString(1);
      let dirtyStatus = stmt.getInt32(2);
      let folderName = stmt.getString(3);
      
      let folder = new GlodaFolder(this, folderID, folderURI, dirtyStatus,
                                   folderName);
      
      this._folderByURI[folderURI] = folder;
      this._folderByID[folderID] = folder;

      if (folderID >= this._nextFolderId)
        this._nextFolderId = folderID + 1;
    }
    stmt.finalize();
  },

  _folderKnown: function gloda_ds_folderKnown(aFolder) {
    let folderURI = aFolder.URI;
    return folderURI in this._folderByURI;
  },

  /**
   * Map a folder URI to a folder ID, creating the mapping if it does not yet
   *  exist.
   */
  _mapFolder: function gloda_ds_mapFolderURI(aFolder) {
    let folderURI = aFolder.URI;
    if (folderURI in this._folderByURI) {
      return this._folderByURI[folderURI];
    }

    let folderID = this._nextFolderId++;
    
    let folder = new GlodaFolder(this, folderID, folderURI,
      GlodaFolder.prototype.kFolderFilthy, aFolder.prettiestName);
    
    this._insertFolderLocationStatement.bindInt64Parameter(0, folder.id)
    this._insertFolderLocationStatement.bindStringParameter(1, folder.uri);
    this._insertFolderLocationStatement.bindInt64Parameter(2,
                                                           folder.dirtyStatus);
    this._insertFolderLocationStatement.bindStringParameter(3, folder.name);
    this._insertFolderLocationStatement.executeAsync(this.trackAsync());

    this._folderByURI[folderURI] = folder;
    this._folderByID[folderID] = folder;
    this._log.debug("!! mapped " + folder.id + " from " + folderURI);
    return folder;
  },

  _mapFolderID: function gloda_ds_mapFolderID(aFolderID) {
    if (aFolderID === null)
      return null;
    if (aFolderID in this._folderByID)
      return this._folderByID[aFolderID];
    throw "Got impossible folder ID: " + aFolderID;
  },

  get _updateFolderDirtyStatusStatement() {
    let statement = this._createAsyncStatement(
      "UPDATE folderLocations SET dirtyStatus = ?1 \
              WHERE id = ?2");
    this.__defineGetter__("_updateFolderDirtyStatusStatement",
      function() statement);
    return this._updateFolderDirtyStatusStatement;
  },

  updateFolderDirtyStatus: function gloda_ds_updateFolderDirtyStatus(aFolder) {
    let ufds = this._updateFolderDirtyStatusStatement;
    ufds.bindInt64Parameter(1, aFolder.id);
    ufds.bindInt64Parameter(0, aFolder.dirtyStatus);
    ufds.executeAsync(this.trackAsync());
  },

  get _updateFolderLocationStatement() {
    let statement = this._createAsyncStatement(
      "UPDATE folderLocations SET folderURI = ?1 \
              WHERE id = ?2");
    this.__defineGetter__("_updateFolderLocationStatement",
      function() statement);
    return this._updateFolderLocationStatement;
  },

  /**
   * Non-recursive asynchronous folder renaming based on the URI.
   *
   * @TODO provide a mechanism for recursive folder renames or have a higher
   *     layer deal with it and remove this note.
   */
  renameFolder: function gloda_ds_renameFolder(aOldFolder, aNewURI) {
    let folder = this._mapFolder(aOldFolder); // ensure the folder is mapped
    let oldURI = folder.uri; 
    this._folderByURI[aNewURI] = folder;
    folder._uri = aNewURI;
    this._log.info("renaming folder URI " + oldURI + " to " + aNewURI);
    this._updateFolderLocationStatement.bindStringParameter(1, folder.id);
    this._updateFolderLocationStatement.bindStringParameter(0, aNewURI);
    this._updateFolderLocationStatement.executeAsync(this.trackAsync());
    
    delete this._folderByURI[oldURI];
  },

  get _deleteFolderByIDStatement() {
    let statement = this._createAsyncStatement(
      "DELETE FROM folderLocations WHERE id = ?1");
    this.__defineGetter__("_deleteFolderByIDStatement",
      function() statement);
    return this._deleteFolderByIDStatement;
  },

  deleteFolderByID: function gloda_ds_deleteFolder(aFolderID) {
    let dfbis = this._deleteFolderByIDStatement;
    dfbis.bindInt64Parameter(0, aFolderID);
    dfbis.executeAsync(this.trackAsync());
  },

  /* ********** Conversation ********** */
  /** The next conversation id to allocate.  Initialize at startup. */
  _nextConversationId: 1,

  _populateConversationManagedId: function () {
    let stmt = this._createSyncStatement(
      "SELECT MAX(id) FROM conversations", true);
    if (stmt.executeStep()) { // no chance of this SQLITE_BUSY on this call
      this._nextConversationId = stmt.getInt64(0) + 1;
    }
    stmt.finalize();
  },

  get _insertConversationStatement() {
    let statement = this._createAsyncStatement(
      "INSERT INTO conversations (id, subject, oldestMessageDate, \
                                  newestMessageDate) \
              VALUES (?1, ?2, ?3, ?4)");
    this.__defineGetter__("_insertConversationStatement", function() statement);
    return this._insertConversationStatement;
  },

  get _insertConversationTextStatement() {
    let statement = this._createAsyncStatement(
      "INSERT INTO conversationsText (docid, subject) \
              VALUES (?1, ?2)");
    this.__defineGetter__("_insertConversationTextStatement",
      function() statement);
    return this._insertConversationTextStatement;
  },

  /**
   * Asynchronously create a conversation.
   */
  createConversation: function gloda_ds_createConversation(aSubject,
        aOldestMessageDate, aNewestMessageDate) {

    // create the data row
    let conversationID = this._nextConversationId++;
    let ics = this._insertConversationStatement;
    ics.bindInt64Parameter(0, conversationID);
    ics.bindStringParameter(1, aSubject);
    if (aOldestMessageDate == null)
      ics.bindNullParameter(2);
    else
      ics.bindInt64Parameter(2, aOldestMessageDate);
    if (aNewestMessageDate == null)
      ics.bindNullParameter(3);
    else
      ics.bindInt64Parameter(3, aNewestMessageDate);
    ics.executeAsync(this.trackAsync());

    // create the fulltext row, using the same rowid/docid
    let icts = this._insertConversationTextStatement;
    icts.bindInt64Parameter(0, conversationID);
    icts.bindStringParameter(1, aSubject);
    icts.executeAsync(this.trackAsync());

    // create it
    let conversation = new GlodaConversation(this, conversationID,
                                 aSubject, aOldestMessageDate,
                                 aNewestMessageDate);
    // it's new! let the collection manager know about it.
    GlodaCollectionManager.itemsAdded(conversation.NOUN_ID, [conversation]);
    // return it
    return conversation;
  },

  get _deleteConversationByIDStatement() {
    let statement = this._createAsyncStatement(
      "DELETE FROM conversations WHERE id = ?1");
    this.__defineGetter__("_deleteConversationByIDStatement",
                          function() statement);
    return this._deleteConversationByIDStatement;
  },

  /**
   * Asynchronously delete a conversation given its ID.
   */
  deleteConversationByID: function gloda_ds_deleteConversationByID(
                                      aConversationID) {
    let dcbids = this._deleteConversationByIDStatement;
    dcbids.bindInt64Parameter(0, aConversationID);
    dcbids.executeAsync(this.trackAsync());

    // TODO: collection manager implications
    //GlodaCollectionManager.removeByID()
  },

  get _selectConversationByIDStatement() {
    let statement = this._createSyncStatement(
      "SELECT id, subject, oldestMessageDate, newestMessageDate \
         FROM conversations WHERE id = ?1");
    this.__defineGetter__("_selectConversationByIDStatement",
      function() statement);
    return this._selectConversationByIDStatement;
  },

  _conversationFromRow: function gloda_ds_conversationFromRow(aStmt) {
      let oldestMessageDate, newestMessageDate;
      if (aStmt.getTypeOfIndex(2) == Ci.mozIStorageValueArray.VALUE_TYPE_NULL)
        oldestMessageDate = null;
      else
        oldestMessageDate = aStmt.getInt64(2);
      if (aStmt.getTypeOfIndex(3) == Ci.mozIStorageValueArray.VALUE_TYPE_NULL)
        newestMessageDate = null;
      else
        newestMessageDate = aStmt.getInt64(3);
      return new GlodaConversation(this, aStmt.getInt64(0),
        aStmt.getString(1), oldestMessageDate, newestMessageDate);
  },

  /**
   * Synchronously look up a conversation given its ID.
   */
  getConversationByID: function gloda_ds_getConversationByID(aConversationID) {
    let conversation = GlodaCollectionManager.cacheLookupOne(
      GlodaConversation.prototype.NOUN_ID, aConversationID);

    if (conversation === null) {
      let scbids = this._selectConversationByIDStatement;

      scbids.bindInt64Parameter(0, aConversationID);
      if (this._syncStep(scbids)) {
        conversation = this._conversationFromRow(scbids);
        GlodaCollectionManager.itemLoaded(conversation);
      }
      scbids.reset();
    }

    return conversation;
  },

  /* ********** Message ********** */
  /**
   * Next message id, managed because of our use of asynchronous inserts.
   * Initialized by _populateMessageManagedId called by _init.
   */
  _nextMessageId: 1,

  _populateMessageManagedId: function () {
    let stmt = this._createSyncStatement(
      "SELECT MAX(id) FROM messages", true);
    if (stmt.executeStep()) { // no chance of this SQLITE_BUSY on this call
      this._nextMessageId = stmt.getInt64(0) + 1;
    }
    stmt.finalize();
  },

  get _insertMessageStatement() {
    let statement = this._createAsyncStatement(
      "INSERT INTO messages (id, folderID, messageKey, conversationID, date, \
                             headerMessageID, jsonAttributes) \
              VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)");
    this.__defineGetter__("_insertMessageStatement", function() statement);
    return this._insertMessageStatement;
  },

  get _insertMessageTextStatement() {
    let statement = this._createAsyncStatement(
      "INSERT INTO messagesText (docid, subject, body, attachmentNames) \
              VALUES (?1, ?2, ?3, ?4)");
    this.__defineGetter__("_insertMessageTextStatement", function() statement);
    return this._insertMessageTextStatement;
  },

  /**
   * Create a GlodaMessage with the given properties.  Because this is only half
   *  of the process of creating a message (the attributes still need to be
   *  completed), it's on the caller's head to call GlodaCollectionManager's
   *  itemAdded method once the message is fully created.
   *
   * This method uses the async connection, any downstream logic that depends on
   *  this message actually existing in the database must be done using an
   *  async query.
   */
  createMessage: function gloda_ds_createMessage(aFolder, aMessageKey,
                              aConversationID, aDatePRTime, aHeaderMessageID) {
    let folderID;
    if (aFolder != null) {
      folderID = this._mapFolder(aFolder).id;
    }
    else {
      folderID = null;
    }

    let messageID = this._nextMessageId++;

    let message = new GlodaMessage(this, messageID, folderID,
                            aMessageKey, aConversationID, null,
                            aDatePRTime ? new Date(aDatePRTime / 1000) : null,
                            aHeaderMessageID);

    this._log.debug("CreateMessage: " + folderID + ", " + aMessageKey + ", " +
                    aConversationID + ", " + aDatePRTime + ", " +
                    aHeaderMessageID);

    // We would love to notify the collection manager about the message at this
    //  point (at least if it's not a ghost), but we can't yet.  We need to wait
    //  until the attributes have been indexed, which means it's out of our
    //  hands.  (Gloda.processMessage does it.)

    return message;
  },
  
  insertMessage: function gloda_ds_insertMessage(aMessage) {
    let ims = this._insertMessageStatement;
    ims.bindInt64Parameter(0, aMessage.id);
    if (aMessage.folderID == null)
      ims.bindNullParameter(1);
    else
      ims.bindInt64Parameter(1, aMessage.folderID);
    if (aMessage.messageKey == null)
      ims.bindNullParameter(2);
    else
      ims.bindInt64Parameter(2, aMessage.messageKey);
    ims.bindInt64Parameter(3, aMessage.conversationID);
    if (aMessage.date == null)
      ims.bindNullParameter(4);
    else
      ims.bindInt64Parameter(4, aMessage.date * 1000);
    ims.bindStringParameter(5, aMessage.headerMessageID);
    if (aMessage._jsonText)
      ims.bindStringParameter(6, aMessage._jsonText);
    else
      ims.bindNullParameter(6);

    try {
       ims.executeAsync(this.trackAsync());
    }
    catch(ex) {
       throw("error executing statement... " +
             this.asyncConnection.lastError + ": " +
             this.asyncConnection.lastErrorString + " - " + ex);
    }

    // we only create the full-text row if the body is non-null.
    // so, even though body might be null, we still want to create the
    //  full-text search row
    if (aMessage._body) {
      let imts = this._insertMessageTextStatement;
      imts.bindInt64Parameter(0, aMessage.id);
      imts.bindStringParameter(1, aMessage._subject);
      imts.bindStringParameter(2, aMessage._body);
      if (aMessage._attachmentNames === null)
        imts.bindNullParameter(3);
      else
        imts.bindStringParameter(3, aMessage._attachmentNames);
      
      delete aMessage._subject;
      delete aMessage._body;
      delete aMessage._attachmentNames;

      try {
         imts.executeAsync(this.trackAsync());
      }
      catch(ex) {
         throw("error executing fulltext statement... " +
               this.asyncConnection.lastError + ": " +
               this.asyncConnection.lastErrorString + " - " + ex);
      }
    }
  },

  get _updateMessageStatement() {
    let statement = this._createAsyncStatement(
      "UPDATE messages SET folderID = ?1, \
                           messageKey = ?2, \
                           conversationID = ?3, \
                           date = ?4, \
                           headerMessageID = ?5, \
                           jsonAttributes = ?6 \
              WHERE id = ?7");
    this.__defineGetter__("_updateMessageStatement", function() statement);
    return this._updateMessageStatement;
  },

  /**
   * Update the database row associated with the message.  If aBody is supplied,
   *  the associated full-text row is created; it is assumed that it did not
   *  previously exist.
   */
  updateMessage: function gloda_ds_updateMessage(aMessage) {
    let ums = this._updateMessageStatement;
    ums.bindInt64Parameter(6, aMessage.id);
    if (aMessage.folderID === null)
      ums.bindNullParameter(0);
    else
      ums.bindInt64Parameter(0, aMessage.folderID);
    if (aMessage.messageKey === null)
      ums.bindNullParameter(1);
    else
      ums.bindInt64Parameter(1, aMessage.messageKey);
    ums.bindInt64Parameter(2, aMessage.conversationID);
    if (aMessage.date === null)
      ums.bindNullParameter(3);
    else
      ums.bindInt64Parameter(3, aMessage.date * 1000);
    ums.bindStringParameter(4, aMessage.headerMessageID);
    if (aMessage._jsonText)
      ums.bindStringParameter(5, aMessage._jsonText);
    else
      ums.bindNullParameter(5);

    ums.executeAsync(this.trackAsync());

    if (aMessage._body) {
      let imts = this._insertMessageTextStatement;
      imts.bindInt64Parameter(0, aMessage.id);
      imts.bindStringParameter(1, aMessage._subject);
      imts.bindStringParameter(2, aMessage._body);
      if (aMessage._attachmentNames === null)
        imts.bindNullParameter(3);
      else
        imts.bindStringParameter(3, aMessage._attachmentNames);
      
      delete aMessage._subject;
      delete aMessage._body;
      delete aMessage._attachmentNames;
      
      try {
         imts.executeAsync(this.trackAsync());
      }
      catch(ex) {
         throw("error executing fulltext statement... " +
               this.asyncConnection.lastError + ": " +
               this.asyncConnection.lastErrorString + " - " + ex);
      }
    }

    // In completely abstract theory, this is where we would call
    //  GlodaCollectionManager.itemsModified, except that the attributes may
    //  also have changed, so it's out of our hands.  (Gloda.processMessage
    //  handles it.)
  },

  get _updateMessageLocationStatement() {
    let statement = this._createAsyncStatement(
      "UPDATE messages SET folderID = ?1, messageKey = ?2 WHERE id = ?3");
    this.__defineGetter__("_updateMessageLocationStatement",
                          function() statement);
    return this._updateMessageLocationStatement;
  },

  /**
   * Given a list of gloda message ids, and a list of their new message keys in
   *  the given new folder location, asynchronously update the message's
   *  database locations.  Also, update the in-memory representations.
   */
  updateMessageLocations: function gloda_ds_updateMessageLocations(aMessageIds,
      aNewMessageKeys, aDestFolder) {
    let statement = this._updateMessageLocationStatement;
    let destFolderID = this._mapFolder(aDestFolder).id;

    let modifiedItems = [];

    for (let iMsg = 0; iMsg < aMessageIds.length; iMsg++) {
      let id = aMessageIds[iMsg]
      statement.bindInt64Parameter(0, destFolderID);
      statement.bindInt64Parameter(1, aNewMessageKeys[iMsg]);
      statement.bindInt64Parameter(2, id);
      statement.executeAsync(this.trackAsync());

      // so, if the message is currently loaded, we also need to change it up...
      let message = GlodaCollectionManager.cacheLookupOne(
        GlodaMessage.prototype.NOUN_ID, id);
      if (message) {
        message._folderID = destFolderID;
        modifiedItems.push(message);
      }
    }

    // if we're talking about a lot of messages, it's worth committing after
    //  this to ensure that we don't spill to disk and cause contention with
    //  synchronous reads off (this) the main thread.
    if ((aMessageIds.length > 200) && this._transactionDepth) {
      this._commitTransaction();
      this._beginTransaction();
    }

    // tell the collection manager about the modified messages so it can update
    //  any existing views...
    if (modifiedItems.length) {
      GlodaCollectionManager.itemsModified(GlodaMessage.prototype.NOUN,
                                           modifiedItems);
    }
  },

  /**
   * Asynchronously mutate message folder id/message keys for the given
   *  messages, indicating that we are moving them to the target folder, but
   *  don't yet know their target message keys.
   */
  updateMessageFoldersByKeyPurging:
      function gloda_ds_updateMessageFoldersByKeyPurging(aSrcFolder,
        aMessageKeys, aDestFolder) {
    let srcFolderID = this._mapFolder(aSrcFolder).id;
    let destFolderID = this._mapFolder(aDestFolder).id;

    let sqlStr = "UPDATE messages SET folderID = ?1, \
                                      messageKey = ?2 \
                   WHERE folderID = ?3 \
                     AND messageKey IN (" + aMessageKeys.join(", ") + ")";
    let statement = this._createAsyncStatement(sqlStr, true);
    statement.bindInt64Parameter(2, srcFolderID);
    statement.bindInt64Parameter(0, destFolderID);
    statement.bindNullParameter(1);
    statement.executeAsync(this.trackAsync());
    statement.finalize();

    // if we're talking about a lot of messages, it's worth committing after
    //  this to ensure that we don't spill to disk and cause contention with
    //  synchronous reads off (this) the main thread.
    if ((aMessageKeys.length > 200) && this._transactionDepth) {
      this._commitTransaction();
      this._beginTransaction();
    }
  },

  _messageFromRow: function gloda_ds_messageFromRow(aRow) {
    let folderId, messageKey, date, jsonText;
    if (aRow.getTypeOfIndex(1) == Ci.mozIStorageValueArray.VALUE_TYPE_NULL)
      folderId = null;
    else
      folderId = aRow.getInt64(1);
    if (aRow.getTypeOfIndex(2) == Ci.mozIStorageValueArray.VALUE_TYPE_NULL)
      messageKey = null;
    else
      messageKey = aRow.getInt64(2);
    if (aRow.getTypeOfIndex(4) == Ci.mozIStorageValueArray.VALUE_TYPE_NULL)
      date = null;
    else
      date = new Date(aRow.getInt64(4) / 1000);
    if (aRow.getTypeOfIndex(7) == Ci.mozIStorageValueArray.VALUE_TYPE_NULL)
      jsonText = undefined;
    else
      jsonText = aRow.getString(7);
    return new GlodaMessage(this, aRow.getInt64(0), folderId, messageKey,
                            aRow.getInt64(3), null, date, aRow.getString(5),
                            aRow.getInt64(6), jsonText);
  },

  get _selectMessageByIDStatement() {
    let statement = this._createSyncStatement(
      "SELECT id, folderID, messageKey, conversationID, date, headerMessageID, \
           deleted FROM messages WHERE id = ?1");
    this.__defineGetter__("_selectMessageByIDStatement",
      function() statement);
    return this._selectMessageByIDStatement;
  },

  /**
   * Synchronously retrieve the given message given its gloda message id.
   */
  getMessageByID: function gloda_ds_getMessageByID(aID) {
    let message = GlodaCollectionManager.cacheLookupOne(
      GlodaMessage.prototype.NOUN_ID, aID);

    if (message === null) {
      let smbis = this._selectMessageByIDStatement;

      smbis.bindInt64Parameter(0, aID);
      if (this._syncStep(smbis)) {
        message = this._messageFromRow(smbis);
        GlodaCollectionManager.itemLoaded(message);
      }
      smbis.reset();
    }

    return message;
  },

  get _selectMessageByLocationStatement() {
    let statement = this._createSyncStatement(
      "SELECT * FROM messages WHERE folderID = ?1 AND messageKey = ?2");
    this.__defineGetter__("_selectMessageByLocationStatement",
      function() statement);
    return this._selectMessageByLocationStatement;
  },

  /**
   * Synchronously retrieve the message that we believe to correspond to the
   *  given message key in the given folder.
   * @return null on failure to locate the message, the message on success.
   *
   * @XXX on failure, attempt to resolve the problem through re-indexing, etc.
   */
  getMessageFromLocation: function gloda_ds_getMessageFromLocation(aFolder,
                                                                 aMessageKey) {
    this._selectMessageByLocationStatement.bindInt64Parameter(0,
      this._mapFolder(aFolder).id);
    this._selectMessageByLocationStatement.bindInt64Parameter(1, aMessageKey);

    let message = null;
    if (this._syncStep(this._selectMessageByLocationStatement))
      message = this._messageFromRow(this._selectMessageByLocationStatement);
    this._selectMessageByLocationStatement.reset();

    if (message === null)
      this._log.info("Error locating message with key=" + aMessageKey +
                     " and URI " + aFolder.URI);

    return message && GlodaCollectionManager.cacheLoadUnifyOne(message);
  },

  get _selectMessageIDsByFolderStatement() {
    let statement = this._createSyncStatement(
      "SELECT id FROM messages WHERE folderID = ?1");
    this.__defineGetter__("_selectMessageIDsByFolderStatement",
      function() statement);
    return this._selectMessageIDsByFolderStatement;
  },

  getMessageIDsByFolderID:
      function gloda_ds_getMessageIDsFromFolderID(aFolderID) {
    let messageIDs = [];

    let smidbfs = this._selectMessageIDsByFolderStatement;
    smidbfs.bindInt64Parameter(0, aFolderID);

    while (this._syncStep(smidbfs)) {
      messageIDs.push(smidbfs.getInt64(0));
    }
    smidbfs.reset();

    return messageIDs;
  },

  /**
   * Given a list of Message-ID's, return a matching list of lists of messages
   *  matching those Message-ID's.  So if you pass an array with three
   *  Message-ID's ["a", "b", "c"], you would get back an array containing
   *  3 lists, where the first list contains all the messages with a message-id
   *  of "a", and so forth.  The reason a list is returned rather than null/a
   *  message is that we accept the reality that we have multiple copies of
   *  messages with the same ID.
   * This call is asynchronous because it depends on previously created messages
   *  to be reflected in our results, which requires us to execute on the async
   *  thread where all our writes happen.  This also turns out to be a
   *  reasonable thing because we could imagine pathological cases where there
   *  could be a lot of message-id's and/or a lot of messages with those
   *  message-id's.
   */
  getMessagesByMessageID: function gloda_ds_getMessagesByMessageID(aMessageIDs,
      aCallback, aCallbackThis) {
    let msgIDToIndex = {};
    let results = [];
    for (let iID = 0; iID < aMessageIDs.length; ++iID) {
      let msgID = aMessageIDs[iID];
      results.push([]);
      msgIDToIndex[msgID] = iID;
    }

    // Unfortunately, IN doesn't work with statement binding mechanisms, and
    //  a chain of ORed tests really can't be bound unless we create one per
    //  value of N (seems silly).
    let quotedIDs = ["'" + msgID.replace("'", "''", "g") + "'" for each
                     ([i, msgID] in Iterator(aMessageIDs))]
    let sqlString = "SELECT * FROM messages WHERE headerMessageID IN (" +
                    quotedIDs + ")";
    
    let nounDef = GlodaMessage.prototype.NOUN_DEF;
    let listener = new MessagesByMessageIdCallback(msgIDToIndex, results,
        aCallback, aCallbackThis);
    let query = new nounDef.explicitQueryClass();
    return this._queryFromSQLString(sqlString, [], nounDef,
        query, listener);
  },

  get _updateMessagesMarkDeletedByFolderID() {
    let statement = this._createAsyncStatement(
      "UPDATE messages SET folderID = NULL, messageKey = NULL, \
              deleted = 1 WHERE folderID = ?1");
    this.__defineGetter__("_updateMessagesMarkDeletedByFolderID",
      function() statement);
    return this._updateMessagesMarkDeletedByFolderID;
  },

  markMessagesDeletedByFolderID:
      function gloda_ds_markMessagesDeletedByFolderID(aFolderID) {
    let statement = this._updateMessagesMarkDeletedByFolderID;
    statement.bindInt64Parameter(0, aFolderID);
    statement.executeAsync(this.trackAsync());
    statement.finalize();
  },

  markMessagesDeletedByIDs: function gloda_ds_markMessagesDeletedByIDs(
      aMessageIDs) {
    let sqlString = "UPDATE messages SET deleted = 1 WHERE id IN (" +
      aMessageIDs.join(",") + ")";

    let statement = this._createAsyncStatement(sqlString, true);
    statement.executeAsync(this.trackAsync());
    statement.finalize();

    // some people are inclined to deleting ridiculous numbers of messages at
    //  a time.  if we are in a transaction, this has the potential to cause us
    //  to spill the transaction to disk prior to disk, resulting in a lock
    //  escalation and making any synchronous reads from the main thread need
    //  to become blocking.  We don't want that, so:
    // If we are in a transaction and there are a "lot" of messages being
    //  marked as deleted, issue a commit and then re-open the transaction.
    if ((aMessageIDs.length > 200) && this._transactionDepth) {
      this._commitTransaction();
      this._beginTransaction();
    }
  },

  get _deleteMessageByIDStatement() {
    let statement = this._createAsyncStatement(
      "DELETE FROM messages WHERE id = ?1");
    this.__defineGetter__("_deleteMessageByIDStatement",
                          function() statement);
    return this._deleteMessageByIDStatement;
  },

  deleteMessageByID: function gloda_ds_deleteMessageByID(aMessageID) {
    // TODO: collection manager implications
    let dmbids = this._deleteMessageByIDStatement;
    dmbids.bindInt64Parameter(0, aMessageID);
    dmbids.executeAsync(this.trackAsync());
  },

  get _deleteMessagesByConversationIDStatement() {
    let statement = this._createAsyncStatement(
      "DELETE FROM messages WHERE conversationID = ?1");
    this.__defineGetter__("_deleteMessagesByConversationIDStatement",
                          function() statement);
    return this._deleteMessagesByConversationIDStatement;
  },

  /**
   * Delete messages by conversation ID.  For use by the indexer's deletion
   *  logic, NOT you.
   */
  deleteMessagesByConversationID:
    // TODO: collection manager implications
      function gloda_ds_deleteMessagesByConversationID(aConversationID) {
    let dmbcids = this._deleteMessagesByConversationIDStatement;
    dmbcids.bindInt64Parameter(0, aConversationID);
    dmbcids.executeAsync(this.trackAsync());
  },

  get _selectMessagesByConversationIDStatement() {
    let statement = this._createSyncStatement(
      "SELECT * FROM messages WHERE conversationID = ?1");
    this.__defineGetter__("_selectMessagesByConversationIDStatement",
      function() statement);
    return this._selectMessagesByConversationIDStatement;
  },

  get _selectMessagesByConversationIDNoGhostsStatement() {
    let statement = this._createSyncStatement(
      "SELECT * FROM messages WHERE conversationID = ?1 AND \
                                    folderID IS NOT NULL");
    this.__defineGetter__("_selectMessagesByConversationIDNoGhostsStatement",
      function() statement);
    return this._selectMessagesByConversationIDNoGhostsStatement;
  },

  /**
   * Retrieve all the messages belonging to the given conversation.  This
   *  method is used by the indexer and the GlodaConversation class and is not
   *  intended to be used by any other code.  (Most other code should probably
   *  use the GlodaConversation.messages attribute or the general purpose query
   *  mechanism.)
   *
   * @param aConversationID The ID of the conversation for which you want all
   *     the messages.
   * @param aIncludeGhosts Boolean indicating whether you want 'ghost' messages
   *     (true) or not (false).  'Ghost' messages are messages that exist in the
   *     database purely for conversation tracking/threading purposes.  They
   *     are markers for messages we have not yet seen yet assume must exist
   *     based on references/in-reply-to headers from non-ghost messages in our
   *     database.
   */
  getMessagesByConversationID: function gloda_ds_getMessagesByConversationID(
        aConversationID, aIncludeGhosts) {
    let statement;
    if (aIncludeGhosts)
      statement = this._selectMessagesByConversationIDStatement;
    else
      statement = this._selectMessagesByConversationIDNoGhostsStatement;
    statement.bindInt64Parameter(0, aConversationID);

    let messages = [];
    while (this._syncStep(statement)) {
      messages.push(this._messageFromRow(statement));
    }
    statement.reset();

    if (messages.length)
      GlodaCollectionManager.cacheLoadUnify(GlodaMessage.prototype.NOUN_ID,
                                            messages);

    return messages;
  },

  /* ********** Message Attributes ********** */
  get _insertMessageAttributeStatement() {
    let statement = this._createAsyncStatement(
      "INSERT INTO messageAttributes (conversationID, messageID, attributeID, \
                             value) \
              VALUES (?1, ?2, ?3, ?4)");
    this.__defineGetter__("_insertMessageAttributeStatement",
      function() statement);
    return this._insertMessageAttributeStatement;
  },

  get _deleteMessageAttributeStatement() {
    let statement = this._createAsyncStatement(
      "DELETE FROM messageAttributes WHERE attributeID = ?1 AND value = ?2 \
         AND conversationID = ?3 AND messageID = ?4");
    this.__defineGetter__("_deleteMessageAttributeStatement",
      function() statement);
    return this._deleteMessageAttributeStatement;
  },

  /**
   * Insert and remove attributes relating to a GlodaMessage.  This is performed
   *  inside a pseudo-transaction (we create one if we aren't in one, using
   *  our _beginTransaction wrapper, but if we are in one, no additional
   *  meaningful semantics are added).
   * No attempt is made to verify uniqueness of inserted attributes, either
   *  against the current database or within the provided list of attributes.
   *  The caller is responsible for ensuring that unwanted duplicates are
   *  avoided.
   *
   * @param aMessage The GlodaMessage the attributes belong to.  This is used
   *     to provide the message id and conversation id.
   * @param aAddDBAttributes A list of attribute tuples to add, where each tuple
   *     contains an attribute ID and a value.  Lest you forget, an attribute ID
   *     corresponds to a row in the attribute definition table.  The attribute
   *     definition table stores the 'parameter' for the attribute, if any.
   *     (Which is to say, our frequent Attribute-Parameter-Value triple has
   *     the Attribute-Parameter part distilled to a single attribute id.)
   * @param aRemoveDBAttributes A list of attribute tuples to remove.
   */
  adjustMessageAttributes: function gloda_ds_adjustMessageAttributes(aMessage,
                                        aAddDBAttributes, aRemoveDBAttributes) {
    let imas = this._insertMessageAttributeStatement;
    let dmas = this._deleteMessageAttributeStatement;
    this._beginTransaction();
    try {
      for (let iAttrib = 0; iAttrib < aAddDBAttributes.length; iAttrib++) {
        let attribValueTuple = aAddDBAttributes[iAttrib];

        imas.bindInt64Parameter(0, aMessage.conversationID);
        imas.bindInt64Parameter(1, aMessage.id);
        imas.bindInt64Parameter(2, attribValueTuple[0]);
        // use 0 instead of null, otherwise the db gets upset.  (and we don't
        //  really care anyways.)
        if (attribValueTuple[1] == null)
          imas.bindInt64Parameter(3, 0);
        else if (Math.floor(attribValueTuple[1]) == attribValueTuple[1])
          imas.bindInt64Parameter(3, attribValueTuple[1]);
        else
          imas.bindDoubleParameter(3, attribValueTuple[1]);
        imas.executeAsync(this.trackAsync());
      }

      for (let iAttrib = 0; iAttrib < aRemoveDBAttributes.length; iAttrib++) {
        let attribValueTuple = aRemoveDBAttributes[iAttrib];

        dmas.bindInt64Parameter(0, attribValueTuple[0]);
        // use 0 instead of null, otherwise the db gets upset.  (and we don't
        //  really care anyways.)
        if (attribValueTuple[1] == null)
          dmas.bindInt64Parameter(1, 0);
        else if (Math.floor(attribValueTuple[1]) == attribValueTuple[1])
          dmas.bindInt64Parameter(1, attribValueTuple[1]);
        else
          dmas.bindDoubleParameter(1, attribValueTuple[1]);
        dmas.bindInt64Parameter(2, aMessage.conversationID);
        dmas.bindInt64Parameter(3, aMessage.id);
        dmas.executeAsync(this.trackAsync());
      }

      this._commitTransaction();
    }
    catch (ex) {
      this._rollbackTransaction();
      throw ex;
    }
  },

  get _deleteMessageAttributesByMessageIDStatement() {
    let statement = this._createAsyncStatement(
      "DELETE FROM messageAttributes WHERE messageID = ?1");
    this.__defineGetter__("_deleteMessageAttributesByMessageIDStatement",
      function() statement);
    return this._deleteMessageAttributesByMessageIDStatement;
  },

  /**
   * Clear all the message attributes for a given GlodaMessage.  No changes
   *  are made to the in-memory representation of the message; it is up to the
   *  caller to ensure that it handles things correctly.
   *
   * @param aMessage The GlodaMessage whose database attributes should be
   *     purged.
   */
  clearMessageAttributes: function gloda_ds_clearMessageAttributes(aMessage) {
    if (aMessage.id != null) {
      this._deleteMessageAttributesByMessageIDStatement.bindInt64Parameter(0,
        aMessage.id);
      this._deleteMessageAttributesByMessageIDStatement.executeAsync(
        this.trackAsync());
    }
  },

  get _selectMessageAttributesByMessageIDStatement() {
    let statement = this._createSyncStatement(
      "SELECT attributeID, value FROM messageAttributes \
         WHERE messageID = ?1");
    this.__defineGetter__("_selectMessageAttributesByMessageIDStatement",
      function() statement);
    return this._selectMessageAttributesByMessageIDStatement;
  },

  /**
   * Look-up the attributes associated with the given GlodaMessage instance,
   *  returning them in APV form (a tuple of Attribute definition object,
   *  attribute Parameter, and attribute Value).
   *
   * @param aMessage The GlodaMessage whose attributes you want retrieved.
   * @return An APV list of the attributes.
   */
  getMessageAttributes: function gloda_ds_getMessageAttributes(aMessage) {
    // A list of [attribute def object, (attr) parameter value, attribute value]
    let attribParamVals = []

    let smas = this._selectMessageAttributesByMessageIDStatement;

    smas.bindInt64Parameter(0, aMessage.id);
    while (this._syncStep(smas)) {
      let attributeID = smas.getInt64(0);
      if (!(attributeID in this._attributeIDToDBDefAndParam)) {
        this._log.error("Attribute ID " + attributeID + " not in our map!");
      }
      let attribAndParam = this._attributeIDToDBDefAndParam[attributeID];
      let val = smas.getDouble(1);
      attribParamVals.push([attribAndParam[0], attribAndParam[1], val]);
    }
    smas.reset();

    return attribParamVals;
  },

  _stringSQLQuoter: function(aString) {
    return "'" + aString.replace("'", "''", "g") + "'";
  },
  _numberQuoter: function(aNum) {
    return aNum;
  },

  /* ===== Generic Attribute Support ===== */
  adjustAttributes: function gloda_ds_adjustAttributes(aItem, aAddDBAttributes,
      aRemoveDBAttributes) {
    let nounDef = aItem.NOUN_DEF;
    let dbMeta = nounDef._dbMeta;
    if (dbMeta.insertAttrStatement === undefined) {
      dbMeta.insertAttrStatement = this._createAsyncStatement(
        "INSERT INTO " + nounDef.attrTableName +
        " (" + nounDef.attrIDColumnName + ", attributeID, value) " +
        " VALUES (?1, ?2, ?3)");
      // we always create this at the same time (right here), no need to check
      dbMeta.deleteAttrStatement = this._createAsyncStatement(
        "DELETE FROM " + nounDef.attrTableName + " WHERE " +
        " attributeID = ?1 AND value = ?2 AND " +
        nounDef.attrIDColumnName + " = ?3");
    }

    let ias = dbMeta.insertAttrStatement;
    let das = dbMeta.deleteAttrStatement;
    this._beginTransaction();
    try {
      for (let iAttr = 0; iAttr < aAddDBAttributes.length; iAttr++) {
        let attribValueTuple = aAddDBAttributes[iAttr];

        ias.bindInt64Parameter(0, aItem.id);
        ias.bindInt64Parameter(1, attribValueTuple[0]);
        // use 0 instead of null, otherwise the db gets upset.  (and we don't
        //  really care anyways.)
        if (attribValueTuple[1] == null)
          ias.bindInt64Parameter(2, 0);
        else if (Math.floor(attribValueTuple[1]) == attribValueTuple[1])
          ias.bindInt64Parameter(2, attribValueTuple[1]);
        else
          ias.bindDoubleParameter(2, attribValueTuple[1]);
        ias.executeAsync(this.trackAsync());
      }

      for (let iAttr = 0; iAttr < aRemoveDBAttributes.length; iAttr++) {
        let attribValueTuple = aRemoveDBAttributes[iAttr];

        das.bindInt64Parameter(0, attribValueTuple[0]);
        // use 0 instead of null, otherwise the db gets upset.  (and we don't
        //  really care anyways.)
        if (attribValueTuple[1] == null)
          das.bindInt64Parameter(1, 0);
        else if (Math.floor(attribValueTuple[1]) == attribValueTuple[1])
          das.bindInt64Parameter(1, attribValueTuple[1]);
        else
          das.bindDoubleParameter(1, attribValueTuple[1]);
        das.bindInt64Parameter(2, aItem.id);
        das.executeAsync(this.trackAsync());
      }

      this._commitTransaction();
    }
    catch (ex) {
      this._rollbackTransaction();
      throw ex;
    }
  },

  clearAttributes: function gloda_ds_clearAttributes(aItem) {
    let nounDef = aItem.NOUN_DEF;
    let dbMeta = nounMeta._dbMeta;
    if (dbMeta.clearAttrStatement === undefined) {
      dbMeta.clearAttrStatement = this._createAsyncStatement(
        "DELETE FROM " + nounDef.attrTableName + " WHERE " +
        nounDef.attrIDColumnName + " = ?1");
    }
  
    if (aItem.id != null) {
      dbMeta.clearAttrStatement.bindInt64Parameter(0, aItem.id);
      dbMeta.clearAttrStatement.executeAsync(this.trackAsync());
    }
  },

  /**
   * escapeStringForLIKE is only available on statements, and sometimes we want
   *  to use it before we create our statement, so we create a statement just
   *  for this reason.
   */
  get _escapeLikeStatement() {
    let statement = this._createAsyncStatement("SELECT 0");
    this.__defineGetter__("_escapeLikeStatement", function() statement);
    return this._escapeLikeStatement;
  },

  _convertToDBValuesAndGroupByAttributeID:
    function gloda_ds__convertToDBValuesAndGroupByAttributeID(aAttrDef,
                                                              aValues) {
    let objectNounDef = aAttrDef.objectNounDef;
    if (!aAttrDef.usesParameter) {
      let dbValues = [];
      for (let iValue = 0; iValue < aValues.length; iValue++) {
        dbValues.push(objectNounDef.toParamAndValue(aValues[iValue])[1]);
      }
      yield [aAttrDef.special ? undefined : aAttrDef.id, dbValues];
      return;
    }
    
    let curParam, attrID, dbValues;
    let attrDBDef = aAttrDef.dbDef;
    for (let iValue = 0; iValue < aValues.length; iValue++) {
      let [dbParam, dbValue] = objectNounDef.toParamAndValue(aValues[iValue]);
      if (curParam === undefined) {
        curParam = dbParam;
        attrID = attrDBDef.bindParameter(curParam);
        dbValues = [dbValue];
      }
      else if (curParam == dbParam) {
        dbValues.push(dbValue);
      }
      else {
        yield [attrID, dbValues];
        curParam = dbParam;
        attrID = attrDBDef.bindParameter(curParam);
        dbValues = [dbValue];
      }
    }
    if (dbValues !== undefined)
      yield [attrID, dbValues];
  },

  _convertRangesToDBStringsAndGroupByAttributeID:
    function gloda_ds__convertRangesToDBStringsAndGroupByAttributeID(aAttrDef,
      aValues, aValueColumnName) {
    let objectNounDef = aAttrDef.objectNounDef;
    if (!aAttrDef.usesParameter) {
      let dbStrings = [];
      for (let iValue = 0; iValue < aValues.length; iValue++) {
        let [lowerVal, upperVal] = aValues[iValue];
        // they both can't be null.  that is the law.
        if (lowerVal == null)
          dbStrings.push(aValueColumnName + " <= " +
                         objectNounDef.toParamAndValue(upperVal)[1]);
        else if (upperVal == null)
          dbStrings.push(aValueColumnName + " >= " +
                         objectNounDef.toParamAndValue(lowerVal)[1]);
        else // no one is null!
          dbStrings.push(aValueColumnName + " BETWEEN " +
                         objectNounDef.toParamAndValue(lowerVal)[1] + " AND " +
                         objectNounDef.toParamAndValue(upperVal)[1]);
      }
      yield [aAttrDef.special ? undefined : aAttrDef.id, dbStrings];
      return;
    }
    
    let curParam, attrID, dbStrings;
    let attrDBDef = aAttrDef.dbDef;
    for (let iValue = 0; iValue < aValues.length; iValue++) {
      let [lowerVal, upperVal] = aValues[iValue];

      let dbString, dbParam, lowerDBVal, upperDBVal;
      // they both can't be null.  that is the law.
      if (lowerVal == null) {
        [dbParam, upperDBVal] = objectNounDef.toParamAndValue(upperVal);
        dbString = aValueColumnName + " <= " + upperDBVal;
      }
      else if (upperVal == null) {
        [dbParam, lowerDBVal] = objectNounDef.toParamAndValue(lowerVal);
        dbString = aValueColumnName + " >= " + lowerDBVal; 
      }
      else { // no one is null!
        [dbParam, lowerDBVal] = objectNounDef.toParamAndValue(lowerVal);
        dbString = aValueColumnName + " BETWEEN " + lowerDBVal + " AND " +
                   objectNounDef.toParamAndValue(upperVal)[1];
      }

      if (curParam === undefined) {
        curParam = dbParam;
        attrID = attrDBDef.bindParameter(curParam);
        dbStrings = [dbString];
      }
      else if (curParam === dbParam) {
        dbStrings.push(dbString);
      }
      else {
        yield [attrID, dbStrings];
        curParam = dbParam;
        attrID = attrDBDef.bindParameter(curParam);
        dbStrings = [dbString];
      }
    }
    if (dbStrings !== undefined)
      yield [attrID, dbStrings];
  },

  /**
   * Perform a database query given a GlodaQueryClass instance that specifies
   *  a set of constraints relating to the noun type associated with the query.
   *  A GlodaCollection is returned containing the results of the look-up.
   *  By default the collection is "live", and will mutate (generating events to
   *  its listener) as the state of the database changes.
   * This functionality is made user/extension visible by the Query's
   *  getCollection (asynchronous).
   */
  queryFromQuery: function gloda_ds_queryFromQuery(aQuery, aListener,
      aListenerData, aExistingCollection, aMasterCollection) {
    // when changing this method, be sure that GlodaQuery's testMatch function
    //  likewise has its changes made.
    let nounDef = aQuery._nounDef;

    let whereClauses = [];
    let unionQueries = [aQuery].concat(aQuery._unions);
    let boundArgs = [];

    for (let iUnion = 0; iUnion < unionQueries.length; iUnion++) {
      let curQuery = unionQueries[iUnion];
      let selects = [];
      
      let lastConstraintWasSpecial = false;
      let curConstraintIsSpecial;

      for (let iConstraint = 0; iConstraint < curQuery._constraints.length;
           iConstraint++) {
        let constraint = curQuery._constraints[iConstraint];
        let [constraintType, attrDef] = constraint;
        let constraintValues = constraint.slice(2);
        
        let idColumnName, tableColumnName;
        if (constraintType == this.kConstraintIdIn) {
          // we don't need any of the next cases' setup code, and we especially
          //  would prefer that attrDef isn't accessed since it's null for us.
        }
        else if (attrDef.special) {
          tableName = nounDef.tableName;
          idColumnName = "id"; // canonical id for a table is "id".
          valueColumnName = attrDef.specialColumnName;
          curConstraintIsSpecial = true;
        }
        else {
          tableName = nounDef.attrTableName;
          idColumnName = nounDef.attrIDColumnName;
          valueColumnName = "value";
          curConstraintIsSpecial = false;
        }
        
        let select = null, test = null, bindArgs = null;
        if (constraintType === this.kConstraintIdIn) {
          // this is somewhat of a trick.  this does mean that this can be the
          //  only constraint.  Namely, our idiom is:
          // SELECT * FROM blah WHERE id IN (a INTERSECT b INTERSECT c)
          //  but if we only have 'a', then that becomes "...IN (a)", and if
          //  'a' is not a select but a list of id's... tricky, no?  
          select = constraintValues.join(",");
        }
        else if (constraintType === this.kConstraintIn) {
          let clauses = [];
          for each ([attrID, values] in
              this._convertToDBValuesAndGroupByAttributeID(attrDef,
                                                           constraintValues)) {
            if (attrID !== undefined)
              clauses.push("(attributeID = " + attrID +
                  " AND " + valueColumnName + " IN (" +
                  values.join(",") + "))");
            else
              clauses.push("(" + valueColumnName + " IN (" +
                  values.join(",") + "))");
          }
          test = clauses.join(" OR ");
        }
        else if (constraintType === this.kConstraintRanges) {
          let clauses = [];
          for each ([attrID, dbStrings] in
              this._convertRangesToDBStringsAndGroupByAttributeID(attrDef,
                              constraintValues, valueColumnName)) {
            if (attrID !== undefined)
              clauses.push("(attributeID = " + attrID +
                           " AND (" + dbStrings.join(" OR ") + "))");
            else
              clauses.push("(" + dbStrings.join(" OR ") + ")");
          }
          test = clauses.join(" OR ");
        }
        else if (constraintType === this.kConstraintEquals) {
          let clauses = [];
          for each ([attrID, values] in
              this._convertToDBValuesAndGroupByAttributeID(attrDef,
                                                           constraintValues)) {
            if (attrID !== undefined)
              clauses.push("(attributeID = " + attrID +
                  " AND (" + [valueColumnName + " = ?" for each
                  (value in values)].join(" OR ") + "))");
            else
              clauses.push("(" + [valueColumnName + " = ?" for each
                  (value in values)].join(" OR ") + ")");
            boundArgs.push.apply(boundArgs, values);
          }
          test = clauses.join(" OR ");
        }
        else if (constraintType === this.kConstraintStringLike) {
          likePayload = '';
          for each (let [iValuePart, valuePart] in Iterator(constraintValues)) {
            if (typeof valuePart == "string")
              likePayload += this._escapeLikeStatement.escapeStringForLIKE(
                valuePart, "/");
            else
              likePayload += "%";
          }
          test = valueColumnName + " LIKE ? ESCAPE '/'";
          boundArgs.push(likePayload);
        }
        else if (constraintType === this.kConstraintFulltext) {
          let matchStr = constraintValues[0];
          select = "SELECT docid FROM " + nounDef.tableName + "Text" +
            " WHERE " + attrDef.specialColumnName + " MATCH ?";
          boundArgs.push(matchStr);
        }
        
        if (curConstraintIsSpecial && lastConstraintWasSpecial) {
          selects[selects.length-1] += " AND " + test;
        }
        else if (select)
          selects.push(select)
        else if (test) {
          select = "SELECT " + idColumnName + " FROM " + tableName + " WHERE " +
              test;
          selects.push(select);
        }
        else
          this._log.warning("Unable to translate constraint of type " + 
            constraintType + " on attribute bound as " + aAttrDef.boundName);

        lastConstraintWasSpecial = curConstraintIsSpecial;
      }

      if (selects.length)
        whereClauses.push("id IN (" + selects.join(" INTERSECT ") + ")");
    }

    let sqlString = "SELECT * FROM " + nounDef.tableName;
    if (whereClauses.length)
      sqlString += " WHERE " + whereClauses.join(" OR ");
    
    if (aQuery._order.length) {
      let orderClauses = [];
      for (let [, colName] in Iterator(aQuery._order)) {
         if (colName[0] == "-")
           orderClauses.push(colName.substring(1) + " DESC");
         else
           orderClauses.push(colName + " ASC");
      }
      sqlString += " ORDER BY " + orderClauses.join(", ");
    }
    
    if (aQuery._limit) {
      sqlString += " LIMIT ?";
      boundArgs.push(aQuery._limit); 
    }

    this._log.debug("QUERY FROM QUERY: " + sqlString + " ARGS: " + boundArgs);
    
    return this._queryFromSQLString(sqlString, boundArgs, nounDef, aQuery,
        aListener, aListenerData, aExistingCollection, aMasterCollection);
  },
  
  _queryFromSQLString: function gloda_ds__queryFromSQLString(aSqlString,
      aBoundArgs, aNounDef, aQuery, aListener, aListenerData,
      aExistingCollection, aMasterCollection) {
    let statement = this._createAsyncStatement(aSqlString, true);
    for (let [iBinding, bindingValue] in Iterator(aBoundArgs)) {
      this._bindVariant(statement, iBinding, bindingValue);
    }

    let collection;
    if (aExistingCollection)
      collection = aExistingCollection;
    else {
      collection = new GlodaCollection(aNounDef, [], aQuery, aListener,
                                       aMasterCollection);
      GlodaCollectionManager.registerCollection(collection);
      // we don't want to overwrite the existing listener or its data, but this
      //  does raise the question about what should happen if we get passed in
      //  a different listener and/or data.
      if (aListenerData !== undefined)
        collection.data = aListenerData;
    }

    statement.executeAsync(new QueryFromQueryCallback(statement, aNounDef,
      collection));
    statement.finalize();
    return collection;
  },

  /**
   * 
   * 
   */
  loadNounItem: function gloda_ds_loadNounItem(aItem, aReferencesByNounID,
      aInverseReferencesByNounID) {
    let attribIDToDBDefAndParam = this._attributeIDToDBDefAndParam;
    
    let hadDeps = aItem._deps != null;
    let deps = aItem._deps || {};
    let hasDeps = false;
    
    //this._log.debug("  hadDeps: " + hadDeps + " deps: " + 
    //    Log4Moz.enumerateProperties(deps).join(","));
    
    for each (let [, attrib] in Iterator(aItem.NOUN_DEF.specialLoadAttribs)) {
      let objectNounDef = attrib.objectNounDef;
      
      if (attrib.special === this.kSpecialColumnChildren) {
        let invReferences = aInverseReferencesByNounID[objectNounDef.id];
        if (invReferences === undefined)
          invReferences = aInverseReferencesByNounID[objectNounDef.id] = {};
        // only contribute if it's not already pending or there
        if (!(attrib.id in deps) && aItem[attrib.storageAttributeName] == null){
          //this._log.debug("   Adding inv ref for: " + aItem.id);
          if (!(aItem.id in invReferences))
            invReferences[aItem.id] = null;
          deps[attrib.id] = null;
          hasDeps = true;
        }
      }
      else if (attrib.special === this.kSpecialColumnParent) {
        let references = aReferencesByNounID[objectNounDef.id];
        if (references === undefined)
          references = aReferencesByNounID[objectNounDef.id] = {};
        // nothing to contribute if it's already there
        if (!(attrib.id in deps) && 
            aItem[attrib.valueStorageAttributeName] == null) {
          let parentID = aItem[attrib.idStorageAttributeName];
          if (!(parentID in references))
            references[parentID] = null;
          //this._log.debug("   Adding parent ref for: " +
          //  aItem[attrib.idStorageAttributeName]);
          deps[attrib.id] = null;
          hasDeps = true;
        }
        else {
          this._log.debug("  paranoia value storage: " + aItem[attrib.valueStorageAttributeName]);
        }
      }
    }
    
    // bail here if arbitrary values are not allowed, there just is no
    //  encoded json, or we already had dependencies for this guy, implying
    //  the json pass has already been performed
    if (!aItem.NOUN_DEF.allowsArbitraryAttrs || !aItem._jsonText || hadDeps) {
      if (hasDeps)
        aItem._deps = deps;
      return hasDeps;
    }

    this._log.debug(" load json: " + aItem._jsonText);
    let jsonDict = this._json.decode(aItem._jsonText);
    delete aItem._jsonText;
    
    // Iterate over the attributes on the item
    for each (let [attribId, jsonValue] in Iterator(jsonDict)) {
      // find the attribute definition that corresponds to this key
      let dbAttrib = attribIDToDBDefAndParam[attribId][0];
      // the attribute should only fail to exist if an extension was removed
      if (dbAttrib === undefined)
        continue;
      
      let attrib = dbAttrib.attrDef;
      let objectNounDef = attrib.objectNounDef;
      
      // if it has a tableName member, then it's a persistent object that needs
      //  to be loaded, which also means we need to hold it in a collection
      //  owned by our collection.
      if (objectNounDef.tableName) {
        let references = aReferencesByNounID[objectNounDef.id];
        if (references === undefined)
          references = aReferencesByNounID[objectNounDef.id] = {};
          
        if (attrib.singular) {
          if (!(jsonValue in references))
            references[jsonValue] = null;
        }
        else {
          for each (let [, anID] in Iterator(jsonValue)) {
            if (!(anID in references))
            references[anID] = null;
          }
        }
        
        deps[attribId] = jsonValue;
        hasDeps = true;
      }
      /* if it has custom contribution logic, use it */
      else if (objectNounDef.contributeObjDependencies) {
        if (objectNounDef.contributeObjDependencies(jsonValue,
                             aReferencesByNounID, aInverseReferencesByNounID)) {
          deps[attribId] = jsonValue;
          hasDeps = true;
        }
        else // just propagate the value, it's some form of simple sentinel
          aItem[attrib.boundName] = jsonValue;
      }
      // otherwise, the value just needs to be de-persisted, or not
      else if (objectNounDef.fromJSON) {
        if (attrib.singular)
          aItem[attrib.boundName] = objectNounDef.fromJSON(jsonValue);
        else
          aItem[attrib.boundName] = [objectNounDef.fromJSON(val) for each
            ([, val] in Iterator(jsonValue))];
      }
      // it's fine as is
      else
        aItem[attrib.boundName] = jsonValue;
    }
    
    if (hasDeps)
      aItem._deps = deps;
    return hasDeps;
  },
  
  loadNounDeferredDeps: function gloda_ds_loadNounDeferredDeps(aItem,
      aReferencesByNounID, aInverseReferencesByNounID) {
    if (aItem._deps === undefined)
      return;
    
    let attribIDToDBDefAndParam = this._attributeIDToDBDefAndParam;

    for (let [attribId, jsonValue] in Iterator(aItem._deps)) {
      let dbAttrib = attribIDToDBDefAndParam[attribId][0];
      let attrib = dbAttrib.attrDef;
      
      let objectNounDef = attrib.objectNounDef;
      let references = aReferencesByNounID[objectNounDef.id];
      if (attrib.special) {
        if (attrib.special === this.kSpecialColumnChildren) {
          let inverseReferences = aInverseReferencesByNounID[objectNounDef.id];
          //this._log.info("inverse assignment: " + objectNounDef.id +
          //    " of " + aItem.id)
          aItem[attrib.storageAttributeName] = inverseReferences[aItem.id];
        }
        else if (attrib.special === this.kSpecialColumnParent) {
          //this._log.info("parent column load: " + objectNounDef.id +
          //    " storage value: " + aItem[attrib.idStorageAttributeName]);
          aItem[attrib.valueStorageAttributeName] =
            references[aItem[attrib.idStorageAttributeName]];
        }
      }
      else if (objectNounDef.tableName) {
        //this._log.info("trying to load: " + objectNounDef.id + " refs: " +
        //    jsonValue + ": " + Log4Moz.enumerateProperties(jsonValue).join(","));
        if (attrib.singular)
          aItem[attrib.boundName] = references[jsonValue];
        else
          aItem[attrib.boundName] = [references[val] for each
                                     ([, val] in Iterator(jsonValue))];
      }
      else if (objectNounDef.contributeObjDependencies) {
        aItem[attrib.boundName] =
          objectNounDef.resolveObjDependencies(jsonValue, aReferencesByNounID,
            aInverseReferencesByNounID);
      }
      // there is no other case
    }
    
    delete aItem._deps;
  },

  /* ********** Contact ********** */
  _nextContactId: 1,

  _populateContactManagedId: function () {
    let stmt = this._createSyncStatement("SELECT MAX(id) FROM contacts", true);
    if (stmt.executeStep()) {  // no chance of this SQLITE_BUSY on this call
      this._nextContactId = stmt.getInt64(0) + 1;
    }
    stmt.finalize();
  },

  get _insertContactStatement() {
    let statement = this._createAsyncStatement(
      "INSERT INTO contacts (id, directoryUUID, contactUUID, name, popularity,\
                             frecency, jsonAttributes) \
              VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)");
    this.__defineGetter__("_insertContactStatement", function() statement);
    return this._insertContactStatement;
  },

  createContact: function gloda_ds_createContact(aDirectoryUUID, aContactUUID,
      aName, aPopularity, aFrecency) {
    let contactID = this._nextContactId++;
    this._log.debug("createContact: " + contactID + ": " + aName);
    let contact = new GlodaContact(this, contactID,
                                   aDirectoryUUID, aContactUUID, aName,
                                   aPopularity, aFrecency);
    return contact;
  },
  
  insertContact: function gloda_ds_insertContact(aContact) {
    let ics = this._insertContactStatement;
    ics.bindInt64Parameter(0, aContact.id);
    if (aContact.directoryUUID == null)
      ics.bindNullParameter(1);
    else
      ics.bindStringParameter(1, aContact.directoryUUID);
    if (aContact.contactUUID == null)
      ics.bindNullParameter(2);
    else
      ics.bindStringParameter(2, aContact.contactUUID);
    ics.bindStringParameter(3, aContact.name);
    ics.bindInt64Parameter(4, aContact.popularity);
    ics.bindInt64Parameter(5, aContact.frecency);
    if (aContact._jsonText)
      ics.bindStringParameter(6, aContact._jsonText);
    else
      ics.bindNullParameter(6);

    ics.executeAsync(this.trackAsync());
    this._log.debug("insertContact: " + aContact.id + ":" + aContact.name);

    // XXX caching-notifications-post-refactoring
    GlodaCollectionManager.itemsAdded(aContact.NOUN_ID, [aContact]);
    return aContact;
  },

  get _updateContactStatement() {
    let statement = this._createAsyncStatement(
      "UPDATE contacts SET directoryUUID = ?1, \
                           contactUUID = ?2, \
                           name = ?3, \
                           popularity = ?4, \
                           frecency = ?5, \
                           jsonAttributes = ?6 \
                       WHERE id = ?7");
    this.__defineGetter__("_updateContactStatement", function() statement);
    return this._updateContactStatement;
  },

  updateContact: function gloda_ds_updateContact(aContact) {
    let ucs = this._updateContactStatement;
    ucs.bindInt64Parameter(6, aContact.id);
    ucs.bindStringParameter(0, aContact.directoryUUID);
    ucs.bindStringParameter(1, aContact.contactUUID);
    ucs.bindStringParameter(2, aContact.name);
    ucs.bindInt64Parameter(3, aContact.popularity);
    ucs.bindInt64Parameter(4, aContact.frecency);
    if (aContact._jsonText)
      ucs.bindStringParameter(5, aContact._jsonText);
    else
      ucs.bindNullParameter(5);

    ucs.executeAsync(this.trackAsync());
  },

  _contactFromRow: function gloda_ds_contactFromRow(aRow) {
    let directoryUUID, contactUUID, jsonText;
    if (aRow.getTypeOfIndex(1) == Ci.mozIStorageValueArray.VALUE_TYPE_NULL)
      directoryUUID = null;
    else
      directoryUUID = aRow.getString(1);
    if (aRow.getTypeOfIndex(2) == Ci.mozIStorageValueArray.VALUE_TYPE_NULL)
      contactUUID = null;
    else
      contactUUID = aRow.getString(2);
    if (aRow.getTypeOfIndex(6) == Ci.mozIStorageValueArray.VALUE_TYPE_NULL)
      jsonText = undefined;
    else
      jsonText = aRow.getString(6);

    return new GlodaContact(this, aRow.getInt64(0), directoryUUID,
                            contactUUID, aRow.getString(5),
                            aRow.getInt64(3), aRow.getInt64(4), jsonText);
  },

  get _selectContactByIDStatement() {
    let statement = this._createSyncStatement(
      "SELECT * FROM contacts WHERE id = ?1");
    this.__defineGetter__("_selectContactByIDStatement",
      function() statement);
    return this._selectContactByIDStatement;
  },

  getContactByID: function gloda_ds_getContactByID(aContactID) {
    let contact = GlodaCollectionManager.cacheLookupOne(
      GlodaContact.prototype.NOUN_ID, aContactID);

    if (contact === null) {
      let scbi = this._selectContactByIDStatement;
      scbi.bindInt64Parameter(0, aContactID);
      if (this._syncStep(scbi)) {
        contact = this._contactFromRow(scbi);
        GlodaCollectionManager.itemLoaded(contact);
      }
      scbi.reset();
    }

    return contact;
  },

  /* ********** Identity ********** */
  /** next identity id, managed for async use reasons. */
  _nextIdentityId: 1,
  _populateIdentityManagedId: function () {
    let stmt = this._createSyncStatement(
      "SELECT MAX(id) FROM identities", true);
    if (stmt.executeStep()) { // no chance of this SQLITE_BUSY on this call
      this._nextIdentityId = stmt.getInt64(0) + 1;
    }
    stmt.finalize();
  },

  get _insertIdentityStatement() {
    let statement = this._createAsyncStatement(
      "INSERT INTO identities (id, contactID, kind, value, description, relay) \
              VALUES (?1, ?2, ?3, ?4, ?5, ?6)");
    this.__defineGetter__("_insertIdentityStatement", function() statement);
    return this._insertIdentityStatement;
  },

  createIdentity: function gloda_ds_createIdentity(aContactID, aContact, aKind,
                                                   aValue, aDescription,
                                                   aIsRelay) {
    let identityID = this._nextIdentityId++;
    let iis = this._insertIdentityStatement;
    iis.bindInt64Parameter(0, identityID);
    iis.bindInt64Parameter(1, aContactID);
    iis.bindStringParameter(2, aKind);
    iis.bindStringParameter(3, aValue);
    iis.bindStringParameter(4, aDescription);
    iis.bindInt64Parameter(5, aIsRelay ? 1 : 0);
    iis.executeAsync(this.trackAsync());

    let identity = new GlodaIdentity(this, identityID,
                                     aContactID, aContact, aKind, aValue,
                                     aDescription, aIsRelay);
    GlodaCollectionManager.itemsAdded(identity.NOUN_ID, [identity]);
    return identity;
  },

  _identityFromRow: function gloda_ds_identityFromRow(aRow) {
    return new GlodaIdentity(this, aRow.getInt64(0), aRow.getInt64(1), null,
                             aRow.getString(2), aRow.getString(3),
                             aRow.getString(4),
                             aRow.getInt32(5) ? true : false);
  },

  get _selectIdentityByKindValueStatement() {
    let statement = this._createSyncStatement(
      "SELECT * FROM identities WHERE kind = ?1 AND value = ?2");
    this.__defineGetter__("_selectIdentityByKindValueStatement",
      function() statement);
    return this._selectIdentityByKindValueStatement;
  },

  /** Lookup an identity by kind and value.  Ex: (email, foo@bar.com) */
  getIdentity: function gloda_ds_getIdentity(aKind, aValue) {
    let identity = GlodaCollectionManager.cacheLookupOneByUniqueValue(
      GlodaIdentity.prototype.NOUN_ID, aKind + "@" + aValue);

    let ibkv = this._selectIdentityByKindValueStatement;
    ibkv.bindStringParameter(0, aKind);
    ibkv.bindStringParameter(1, aValue);
    if (this._syncStep(ibkv)) {
      identity = this._identityFromRow(ibkv);
      GlodaCollectionManager.itemLoaded(identity);
    }
    ibkv.reset();

    return identity;
  },

  get _selectIdentityByIDStatement() {
    let statement = this._createSyncStatement(
      "SELECT * FROM identities WHERE id = ?1");
    this.__defineGetter__("_selectIdentityByIDStatement",
      function() statement);
    return this._selectIdentityByIDStatement;
  },

  getIdentityByID: function gloda_ds_getIdentityByID(aID) {
    let identity = GlodaCollectionManager.cacheLookupOne(
      GlodaIdentity.prototype.NOUN_ID, aID);

    if (identity === null) {
      let sibis = this._selectIdentityByIDStatement;
      sibis.bindInt64Parameter(0, aID);
      if (this._syncStep(sibis)) {
        identity = this._identityFromRow(sibis);
        GlodaCollectionManager.itemLoaded(identity);
      }
      sibis.reset();
    }

    return identity;
  },

  get _selectIdentityByContactIDStatement() {
    let statement = this._createSyncStatement(
      "SELECT * FROM identities WHERE contactID = ?1");
    this.__defineGetter__("_selectIdentityByContactIDStatement",
      function() statement);
    return this._selectIdentityByContactIDStatement;
  },

  getIdentitiesByContactID: function gloda_ds_getIdentitiesByContactID(
      aContactID) {
    let sibcs = this._selectIdentityByContactIDStatement;

    sibcs.bindInt64Parameter(0, aContactID);

    let identities = [];
    while (this._syncStep(sibcs)) {
      identities.push(this._identityFromRow(sibcs));
    }
    sibcs.reset();

    if (identities.length)
      GlodaCollectionManager.cacheLoadUnify(GlodaIdentity.prototype.NOUN_ID,
                                            identities);
    return identities;
  },
};
