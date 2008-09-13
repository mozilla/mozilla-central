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

// XXX from Gloda.js.  duplicated here for dependency reasons.  bad!
const kSpecialColumn = 1;
const kSpecialString = 2;
const kSpecialFulltext = 3;

/**
 * This callback handles processing the asynchronous query results of
 *  GlodaDatastore.getMessagesByMessageID.  Because that method is only
 *  called as part of the indexing process, we are guaranteed that there will
 *  be no real caching ramifications.  Accordingly, we can also defer our cache
 *  processing (via GlodaCollectionManager) until the query completes.
 *
 * @param aMsgIDToIndex Map from message-id to the desired   
 */
function MessagesByMessageIdCallback(aStatement, aMsgIDToIndex, aResults,
                                     aCallback, aCallbackThis, aCallbackArgs) {
  this.statement = aStatement;
  this.msgIDToIndex = aMsgIDToIndex;
  this.results = aResults;
  this.callback = aCallback;
  this.callbackThis = aCallbackThis;
  this.callbackArgs = aCallbackArgs;
}

MessagesByMessageIdCallback.prototype = {
  handleResult: function gloda_ds_mbmi_handleResult(aResultSet) {
    let row;
    while (row = aResultSet.getNextRow()) {
      let message = GlodaDatastore._messageFromRow(row);
      this.results[this.msgIDToIndex[message.headerMessageID]].push(message);
    }
  },
  
  handleError: function gloda_ds_mbmi_handleError(aError) {
    GlodaDatastore._log.error("Async getMessagesByMessageId error: " +
      aError.result + ": " + aError.message);
  },
  
  handleCompletion: function gloda_ds_mbmi_handleCompletion(aReason) {
    for (let iResult=0; iResult < this.results.length; iResult++) {
      if (this.results[iResult].length)
        GlodaCollectionManager.cacheLoadUnify(GlodaMessage.prototype.NOUN_ID,
                                              this.results[iResult]);
    }

    let args = [this.results].concat(this.callbackArgs);

    this.statement.finalize();
    this.statement = null;

    this.callback.apply(this.callbackThis, args);
  }
};

function QueryFromQueryCallback(aStatement, aNounMeta, aCollection) {
  this.statement = aStatement;
  this.nounMeta = aNounMeta;
  this.collection = aCollection;
}

QueryFromQueryCallback.prototype = {
  handleResult: function gloda_ds_qfq_handleResult(aResultSet) {
    let newItems = [];
    let row;
    let nounMeta = this.nounMeta;
    while (row = aResultSet.getNextRow()) {
      let item = nounMeta.objFromRow.call(nounMeta.datastore, row);
      newItems.push(item);
    }
    // have the collection manager attempt to replace the instances we just
    //  created with pre-existing instances.  there is some waste here...
    // XXX consider having collection manager take row objects with the
    //  knowledge of what index is the 'id' index and knowing what objFromRow
    //  method to call if it needs to realize the row.
    // queries have the potential to easily exceed the size of our cache, and
    //  will cause needless churn if so.  as such, indicate that we never want
    //  to have our items added to the cache.  after all, as long as our
    //  collection is alive, they can just be found there anyways.  (and when
    //  found there, they may be promoted to the cache anyways.)
    GlodaCollectionManager.cacheLoadUnify(nounMeta.id, newItems, false);
    
    // just directly tell the collection about the items.  we know the query
    //  matches (at least until we introduce predicates that we cannot express
    //  in SQL.)
    this.collection._onItemsAdded(newItems);
  },
  
  handleError: function gloda_ds_qfq_handleError(aError) {
    GlodaDatastore._log.error("Async queryFromQuery error: " +
      aError.result + ": " + aError.message);
  },
  
  handleCompletion: function gloda_ds_qfq_handleCompletion(aReason) {
    this.statement.finalize();
    this.statement = null;
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
 */
let GlodaDatastore = {
  _log: null,

  /* ******************* SCHEMA ******************* */

  _schemaVersion: 5,
  _schema: {
    tables: {
      
      // ----- Messages
      folderLocations: {
        columns: [
          "id INTEGER PRIMARY KEY",
          "folderURI TEXT NOT NULL",
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
        ],
        
        indices: {
          messageLocation: ['folderID', 'messageKey'],
          headerMessageID: ['headerMessageID'],
          conversationID: ['conversationID'],
          date: ['date'],
        },
        
        fulltextColumns: [
          "body TEXT",
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
          messageAttribFetch: [
            "messageID",
            /* covering required: */ "attributeID", "value"],
          conversationAttribFetch: [
            "conversationID",
            /* covering: */ "messageID", "attributeID", "value"],
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
          "name TEXT"
        ],
        indices: {
          popularity: ["popularity"],
          frecency: ["frecency"],
        },
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
  _init: function gloda_ds_init() {
    this._log = Log4Moz.Service.getLogger("gloda.datastore");
  
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
      dbConnection = this._createDB(dbService, dbFile);
    }
    // It does exist, but we (someday) might need to upgrade the schema
    else {
      // (Exceptions may be thrown if the database is corrupt)
      { // try {
        dbConnection = dbService.openUnsharedDatabase(dbFile);
      
        if (dbConnection.schemaVersion != this._schemaVersion) {
          dbConnection = this._migrate(dbService, dbFile,
                                       dbConnection,
                                       dbConnection.schemaVersion,
                                       this._schemaVersion);
        }
      }
      // Handle corrupt databases, other oddities
      // ... in the future. for now, let us die
    }
    
    this.syncConnection = dbConnection;
    this.asyncConnection = dbService.openUnsharedDatabase(dbFile);
    
    this._getAllFolderMappings();
    // we need to figure out the next id's for all of the tables where we
    //  manage that.
    this._populateAttributeDefManagedId();
    this._populateConversationManagedId();
    this._populateMessageManagedId();
    this._populateContactManagedId();
    this._populateIdentityManagedId();
  },
  
  shutdown: function gloda_ds_shutdown() {
    this._cleanupAsyncStatements();
    this._cleanupSyncStatements();
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
  
  /**
   * Create our database schema assuming a newly created database.  This
   *  comes down to creating normal tables, their full-text variants (if
   *  applicable), and their indices.
   */
  _createSchema: function gloda_ds_createSchema(aDBConnection) {
    // -- For each table...
    for (let tableName in this._schema.tables) {
      let table = this._schema.tables[tableName];
      
      // - Create the table
      aDBConnection.createTable(tableName, table.columns.join(", "));
      
      // - Create the fulltext table if applicable
      if ("fulltextColumns" in table) {
        let createFulltextSQL = "CREATE VIRTUAL TABLE " + tableName + "Text" +
          " USING fts3(tokenize porter, " + table.fulltextColumns.join(", ") +
          ")";
        this._log.info("Create fulltext: " + createFulltextSQL);
        aDBConnection.executeSimpleSQL(createFulltextSQL);
      }
      
      // - Create its indices
      for (let indexName in table.indices) {
        let indexColumns = table.indices[indexName];
        
        aDBConnection.executeSimpleSQL(
          "CREATE INDEX " + indexName + " ON " + tableName +
          "(" + indexColumns.join(", ") + ")"); 
      }
    }
    
    aDBConnection.schemaVersion = this._schemaVersion;  
  },
  
  /**
   * Our table definition used here is slightly different from that used
   *  internally, because we are potentially creating a sort of crappy ORM and
   *  we don't want to have to parse the column names out.
   */
  createTableIfNotExists: function gloda_ds_createTableIfNotExists(aTableDef) {
    aTableDef._realName = "plugin_" + aTableDef.name;
    
    // first, check if the table exists
    if (!this.syncConnection.tableExists(aTableDef._realName)) {
      try {
        this.syncConnection.createTable(aTableDef._realName,
                                        [coldef.join(" ") for each
                                     (coldef in aTableDef.columns)].join(", "));
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
          this.syncConnection.executeSimpleSQL(indexSql);
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
    // the 4-to-5 migration is the only possible case right now, and is so
    //  significant that we want everything purged anyways.
    // generalize me in the future.
    aDBConnection.close();
    aDBFile.remove(false);
    this._log.warn("Global database has been purged due to schema change.");
    
    return this._createDB(aDBService, aDBFile);
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
    [stmt.finalize() for each (stmt in this._outstandingAsyncStatements)];
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
    [stmt.finalize() for each (stmt in this._outstandingSyncStatements)];
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
  /**
   * Begin a potentially nested transaction; only the outermost transaction gets
   *  to be an actual transaction, and the failure of any nested transaction
   *  results in a rollback of the entire outer transaction.  If you really
   *  need an atomic transaction 
   */
  _beginTransaction: function gloda_ds_beginTransaction() {
    if (this._transactionDepth == 0) {
// no transactions for async for now
//      this.dbConnection.beginTransaction();
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
/* no transactions for async for now      
        if (this._transactionGood)
          this.dbConnection.commitTransaction();
        else
          this.dbConnection.rollbackTransaction();
*/
      }
      catch (ex) {
        this._log.error("Commit problem: " + ex);
      }
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
// no transactions for async for now
//        this.dbConnection.rollbackTransaction();
      }
      catch (ex) {
        this._log.error("Rollback problem: " + ex);
      }
    }
  },
  
  /* ********** Attribute Definitions ********** */
  /** Maps (attribute def) compound names to the GlodaAttributeDef objects. */
  _attributes: {},
  /** Map attribute ID to the definition and parameter value that produce it. */
  _attributeIDToDef: {},
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
    if (stmt.executeStep()) {
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
   *  in that it doesn't directly return a GlodaAttributeDef; we leave that up
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
    
    iads.executeAsync();
    
    return attributeId;
  },
  
  /**
   * Sync-ly look-up all the attribute definitions, populating our authoritative 
   *  _attributes and _attributeIDToDef maps.  (In other words, once this method
   *  is called, those maps should always be in sync with the underlying
   *  database.)
   */
  getAllAttributes: function gloda_ds_getAllAttributes() {
    let statement = this._createSyncStatement(
      "SELECT id, attributeType, extensionName, name, parameter \
         FROM attributeDefinitions", true);
    this.__defineGetter__("_selectAttributeDefinitionsStatement",
      function() statement);
    return this._selectAttributeDefinitionsStatement;

    // map compound name to the attribute
    let attribs = {};
    // map the attribute id to [attribute, parameter] where parameter is null
    //  in cases where parameter is unused.
    let idToAttribAndParam = {}

    this._log.info("loading all attribute defs");
    
    while (stmt.executeStep()) {
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
        attrib = new GlodaAttributeDef(this, null,
                                       compoundName, null, rowAttributeType,
                                       rowExtensionName, rowName,
                                       null, null, null, null);
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
    
    this._attributes = attribs;
    this._attributeIDToDef = idToAttribAndParam;
  },
  
  /**
   * Helper method for GlodaAttributeDef to tell us when their bindParameter
   *  method is called and they have created a new binding (using
   *  GlodaDatastore._createAttributeDef).  In theory, that method could take
   *  an additional argument and obviate the need for this method.
   */
  reportBinding: function gloda_ds_reportBinding(aID, aAttrDef, aParamValue) {
    this._attributeIDToDef[aID] = [aAttrDef, aParamValue];
  },
  
  /* ********** Folders ********** */
  /** next folder (row) id to issue, populated by _getAllFolderMappings. */
  _nextFolderId: 1,
  
  get _insertFolderLocationStatement() {
    let statement = this._createAsyncStatement(
      "INSERT INTO folderLocations (id, folderURI) VALUES (?1, ?2)");
    this.__defineGetter__("_insertFolderLocationStatement",
      function() statement);
    return this._insertFolderLocationStatement;
  },
  
  /**
   * Authoritative map from folder URI to folder ID.  (Authoritative in the
   *  sense that this map exactly represents the state of the underlying
   *  database.  If it does not, it's a bug in updating the database.)
   */
  _folderURIs: {},
  /** Authoritative map from folder ID to folder URI */
  _folderIDs: {},
  
  /** Intialize our _folderURIs/_folderIDs mappings, called by _init(). */
  _getAllFolderMappings: function gloda_ds_getAllFolderMappings() {
    let stmt = this._createSyncStatement(
      "SELECT id, folderURI FROM folderLocations", true);

    while (stmt.executeStep()) {
      let folderID = stmt.getInt64(0);
      let folderURI = stmt.getString(1);
      this._folderURIs[folderURI] = folderID;
      this._folderIDs[folderID] = folderURI;
      
      if (folderID + 1 > this._nextFolderId)
        this._nextFolderId = folderID + 1;
    }
    stmt.finalize();
  },
  
  /**
   * Map a folder URI to a folder ID, creating the mapping if it does not yet
   *  exist.
   */
  _mapFolderURI: function gloda_ds_mapFolderURI(aFolderURI) {
    if (aFolderURI in this._folderURIs) {
      return this._folderURIs[aFolderURI];
    }
    
    let folderID = this._nextFolderId++;
    this._insertFolderLocationStatement.bindInt64Parameter(0, folderID)
    this._insertFolderLocationStatement.bindStringParameter(1, aFolderURI);
    this._insertFolderLocationStatement.executeAsync();

    this._folderURIs[aFolderURI] = folderID;
    this._folderIDs[folderID] = aFolderURI;
    this._log.info("mapping URI " + aFolderURI + " to " + folderID);
    return folderID;
  },
  
  _mapFolderID: function gloda_ds_mapFolderID(aFolderID) {
    if (aFolderID === null)
      return null;
    if (aFolderID in this._folderIDs)
      return this._folderIDs[aFolderID];
    throw "Got impossible folder ID: " + aFolderID;
  },

  get _updateFolderLocationStatement() {
    let statement = this._createAsyncStatement(
      "UPDATE folderLocations SET folderURI = ?1 \
              WHERE folderURI = ?2");
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
  renameFolder: function gloda_ds_renameFolder(aOldURI, aNewURI) {
    let folderID = this._mapFolderURI(aOldURI); // ensure the URI is mapped...
    this._folderURIs[aNewURI] = folderID;
    this._folderIDs[folderID] = aNewURI;
    this._log.info("renaming folder URI " + aOldURI + " to " + aNewURI);
    this._updateFolderLocationStatement.bindStringParameter(1, aOldURI);
    this._updateFolderLocationStatement.bindStringParameter(0, aNewURI);
    this._updateFolderLocationStatement.executeAsync();
    delete this._folderURIs[aOldURI];
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
    dfbis.executeAsync();
  },
  
  /* ********** Conversation ********** */
  /** The next conversation id to allocate.  Initialize at startup. */
  _nextConversationId: 1,
  
  _populateConversationManagedId: function () {
    let stmt = this._createSyncStatement(
      "SELECT MAX(id) FROM conversations", true);
    if (stmt.executeStep()) {
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
    ics.executeAsync();
    
    // create the fulltext row, using the same rowid/docid
    let icts = this._insertConversationTextStatement;
    icts.bindInt64Parameter(0, conversationID);
    icts.bindStringParameter(1, aSubject);
    icts.executeAsync();
    
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
    dcbids.executeAsync();
    
    // TODO: collection manager implications
    GlodaCollectionManager.removeByID()
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
      if (scbids.executeStep()) {
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
    if (stmt.executeStep()) {
      this._nextMessageId = stmt.getInt64(0) + 1;
    }
    stmt.finalize();
  },
  
  get _insertMessageStatement() {
    let statement = this._createAsyncStatement(
      "INSERT INTO messages (id, folderID, messageKey, conversationID, date, \
                             headerMessageID) \
              VALUES (?1, ?2, ?3, ?4, ?5, ?6)");
    this.__defineGetter__("_insertMessageStatement", function() statement);
    return this._insertMessageStatement; 
  }, 

  get _insertMessageTextStatement() {
    let statement = this._createAsyncStatement(
      "INSERT INTO messagesText (docid, body) \
              VALUES (?1, ?2)");
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
  createMessage: function gloda_ds_createMessage(aFolderURI, aMessageKey,
                              aConversationID, aDatePRTime, aHeaderMessageID,
                              aBody) {
    let folderID;
    if (aFolderURI != null) {
      folderID = this._mapFolderURI(aFolderURI);
    }
    else {
      folderID = null;
    }

    let messageID = this._nextMessageId++;
    
    let ims = this._insertMessageStatement;
    ims.bindInt64Parameter(0, messageID);
    if (folderID === null)
      ims.bindNullParameter(1);
    else
      ims.bindInt64Parameter(1, folderID);
    if (aMessageKey === null)
      ims.bindNullParameter(2);
    else
      ims.bindInt64Parameter(2, aMessageKey);
    ims.bindInt64Parameter(3, aConversationID);
    if (aDatePRTime === null)
      ims.bindNullParameter(4);
    else
      ims.bindInt64Parameter(4, aDatePRTime);
    ims.bindStringParameter(5, aHeaderMessageID);

    try {
       ims.executeAsync();
    }
    catch(ex) {
       throw("error executing statement... " +
             this.asyncConnection.lastError + ": " +
             this.asyncConnection.lastErrorString + " - " + ex);
    }

    this._log.debug("CreateMessage: " + folderID + ", " + aMessageKey + ", " +
                    aConversationID + ", " + aDatePRTime + ", " +
                    aHeaderMessageID); 
    
    // we only create the full-text row if the body is non-null.
    // so, even though body might be null, we still want to create the
    //  full-text search row
    if (aBody) {
      let imts = this._insertMessageTextStatement;
      imts.bindInt64Parameter(0, messageID);
      imts.bindStringParameter(1, aBody);
      
      try {
         imts.executeAsync();
      }
      catch(ex) {
         throw("error executing fulltext statement... " +
               this.asyncConnection.lastError + ": " +
               this.asyncConnection.lastErrorString + " - " + ex);
      }
    }
    
    let message = new GlodaMessage(this, messageID, folderID,
                            aMessageKey, aConversationID, null,
                            aDatePRTime ? new Date(aDatePRTime / 1000) : null,
                            aHeaderMessageID);
    
    // We would love to notify the collection manager about the message at this
    //  point (at least if it's not a ghost), but we can't yet.  We need to wait
    //  until the attributes have been indexed, which means it's out of our
    //  hands.  (Gloda.processMessage does it.)
    
    return message;
  },
  
  get _updateMessageStatement() {
    let statement = this._createAsyncStatement(
      "UPDATE messages SET folderID = ?1, \
                           messageKey = ?2, \
                           conversationID = ?3, \
                           date = ?4, \
                           headerMessageID = ?5 \
              WHERE id = ?6");
    this.__defineGetter__("_updateMessageStatement", function() statement);
    return this._updateMessageStatement;
  }, 
  
  /**
   * Update the database row associated with the message.  If aBody is supplied,
   *  the associated full-text row is created; it is assumed that it did not
   *  previously exist.
   */
  updateMessage: function gloda_ds_updateMessage(aMessage, aBody) {
    let ums = this._updateMessageStatement;
    ums.bindInt64Parameter(5, aMessage.id);
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
    
    ums.executeAsync();
    
    if (aBody) {
      let imts = this._insertMessageTextStatement;
      imts.bindInt64Parameter(0, aMessage.id);
      imts.bindStringParameter(1, aBody);
      
      imts.executeAsync();
    }
    
    // In completely abstract theory, this is where we would call
    //  GlodaCollectionManager.itemsModified, except that the attributes may
    //  also have changed, so it's out of our hands.  (Gloda.processMessage
    //  handles it.)
  },

  /**
   * Asynchronously mutate message folder id/message keys for the given
   *  messages, indicating that we are moving them to the target folder, but
   *  don't yet know their target message keys.
   */
  updateMessageFoldersByKeyPurging:
      function gloda_ds_updateMessageFoldersByKeyPurging(aSrcFolderURI,
        aMessageKeys, aDestFolderURI) {
    let srcFolderID = this._mapFolderURI(aSrcFolderURI);
    let destFolderID = this._mapFolderURI(aDestFolderURI);
    
    let sqlStr = "UPDATE messages SET folderID = ?1, \
                                      messageKey = ?2 \
                   WHERE folderID = ?3 \
                     AND messageKey IN (" + aMessageKeys.join(", ") + ")";
    let statement = this._createAsyncStatement(sqlStr);
    statement.bindInt64Parameter(2, srcFolderID);
    statement.bindInt64Parameter(0, destFolderID);
    statement.bindNullParameter(1);
    statement.executeAsync();
  },
  
  _messageFromRow: function gloda_ds_messageFromRow(aRow) {
    let folderId, messageKey, date;
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
    return new GlodaMessage(this, aRow.getInt64(0), folderId, messageKey,
                            aRow.getInt64(3), null, date, aRow.getString(5));
  },

  get _selectMessageByIDStatement() {
    let statement = this._createSyncStatement(
      "SELECT id, folderID, messageKey, conversationID, date, headerMessageID \
         FROM messages WHERE id = ?1");
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
      if (smbis.executeStep()) {
        message = this._messageFromRow(smbis);
        GlodaCollectionManager.itemLoaded(message);
      }
      smbis.reset();
    }
    
    return message;
  },

  get _selectMessageByLocationStatement() {
    let statement = this._createSyncStatement(
      "SELECT id, folderID, messageKey, conversationID, date, headerMessageId \
       FROM messages WHERE folderID = ?1 AND messageKey = ?2");
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
  getMessageFromLocation: function gloda_ds_getMessageFromLocation(aFolderURI,
                                                                 aMessageKey) {
    this._selectMessageByLocationStatement.bindInt64Parameter(0,
      this._mapFolderURI(aFolderURI));
    this._selectMessageByLocationStatement.bindInt64Parameter(1, aMessageKey);
    
    let message = null;
    if (this._selectMessageByLocationStatement.executeStep())
      message = this._messageFromRow(this._selectMessageByLocationStatement);
    this._selectMessageByLocationStatement.reset();
    
    if (message === null)
      this._log.info("Error locating message with key=" + aMessageKey +
                     " and URI " + aFolderURI);
    
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
    
    while (smidbfs.executeStep()) {
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
      aCallback, aCallbackThis, aCallbackArgs) {
    let msgIDToIndex = {};
    let results = [];
    for (let iID=0; iID < aMessageIDs.length; ++iID) {
      let msgID = aMessageIDs[iID];
      results.push([]);
      msgIDToIndex[msgID] = iID;
    } 

    // Unfortunately, IN doesn't work with statement binding mechanisms, and
    //  a chain of ORed tests really can't be bound unless we create one per
    //  value of N (seems silly).
    let quotedIDs = ["'" + msgID.replace("'", "''", "g") + "'" for each
                     (msgID in aMessageIDs)]
    let sqlString = "SELECT * FROM messages WHERE headerMessageID IN (" +
                    quotedIDs + ")";
    let statement = this._createAsyncStatement(sqlString, true);
    
    statement.executeAsync(new MessagesByMessageIdCallback(statement,
      msgIDToIndex, results, aCallback, aCallbackThis, aCallbackArgs));
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
    dmbids.executeAsync();
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
    dmbcids.executeAsync();
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
    while (statement.executeStep()) {
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
  
  /**
   * Insert a bunch of attributes relating to a GlodaMessage.  This is performed
   *  inside a pseudo-transaction (we create one if we aren't in one, using
   *  our _beginTransaction wrapper, but if we are in one, no additional
   *  meaningful semantics are added).
   * No attempt is made to verify uniqueness of inserted attributes, either
   *  against the current database or within the provided list of attributes.
   *  The caller is responsible for ensuring that unwanted duplicates are
   *  avoided.
   * Currently, it is expected that this method will be used following a call to
   *  clearMessageAttributes to wipe out the existing attributes in the
   *  database.  We will probably try and move to a delta-mechanism in the
   *  future, avoiding needless database churn for small changes in state.
   *
   * @param aMessage The GlodaMessage the attributes belong to.  This is used
   *     to provide the message id and conversation id.
   * @param aAttributes A list of attribute tuples, where each tuple contains
   *     an attribute ID and a value.  Lest you forget, an attribute ID
   *     corresponds to a row in the attribute definition table.  The attribute
   *     definition table stores the 'parameter' for the attribute, if any.
   *     (Which is to say, our frequent Attribute-Parameter-Value triple has
   *     the Attribute-Parameter part distilled to a single attribute id.)
   */
  insertMessageAttributes: function gloda_ds_insertMessageAttributes(aMessage,
                                        aAttributes) {
    let imas = this._insertMessageAttributeStatement;
    this._beginTransaction();
    try {
      for (let iAttribute=0; iAttribute < aAttributes.length; iAttribute++) {
        let attribValueTuple = aAttributes[iAttribute];

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
        imas.executeAsync();
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
      this._deleteMessageAttributesByMessageIDStatement.executeAsync();
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
    while (smas.executeStep()) {
      let attributeID = smas.getInt64(1);
      if (!(attributeID in this._attributeIDToDef)) {
        this._log.error("Attribute ID " + attributeID + " not in our map!");
      } 
      let attribAndParam = this._attributeIDToDef[attributeID];
      let val = smas.getDouble(2);
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
  
  /**
   * Perform a database query given a GlodaQueryClass instance that specifies
   *  a set of constraints relating to the noun type associated with the query.
   *  A GlodaCollection is returned containing the results of the look-up.
   *  By default the collection is "live", and will mutate (generating events to
   *  its listener) as the state of the database changes.
   * This functionality is made user/extension visible by the Query's
   *  getCollection (asynchronous) and getAllSync (synchronous).
   */
  queryFromQuery: function gloda_ds_queryFromQuery(aQuery, aListener, bSynchronous) {
    // when changing this method, be sure that GlodaQuery's testMatch function
    //  likewise has its changes made.
    let nounMeta = aQuery._nounMeta;
    
    let whereClauses = [];
    let unionQueries = [aQuery].concat(aQuery._unions);
    
    for (let iUnion=0; iUnion < unionQueries.length; iUnion++) {
      let curQuery = unionQueries[iUnion];
      let selects = [];
      
      for (let iConstraint=0; iConstraint < curQuery._constraints.length; 
           iConstraint++) {
        let attr_ors = curQuery._constraints[iConstraint];
        
        let lastAttributeID = null;
        let attrValueTests = [];
        let valueTests = null;
        
        // our implementation requires that everyone in attr_ors has the same
        //  attribute.
        let presumedAttr = attr_ors[0][0];
        
        // -- handle full-text specially here, it's different than the other
        //  cases...
        if (presumedAttr.special == kSpecialFulltext) {
          let matchStr = [APV[2] for each (APV in attr_ors)].join(" OR ");
          matchStr.replace("'", "''");
        
          // for example, the match 
          let ftSelect = "SELECT docid FROM " + nounMeta.tableName + "Text" +
            " WHERE " + presumedAttr.specialColumnName + " MATCH '" +
            matchStr + "'";
          selects.push(ftSelect);
        
          // bypass the logic used by the other cases
          continue;
        }
        
        let tableName, idColumnName, valueColumnName, valueQuoter;
        if (presumedAttr.special == kSpecialColumn ||
            presumedAttr.special == kSpecialString) {
          tableName = nounMeta.tableName;
          idColumnName = "id"; // canonical id for a table is "id".
          valueColumnName = presumedAttr.specialColumnName;
          if (presumedAttr.special == kSpecialString)
            valueQuoter = this._stringSQLQuoter;
          else
            valueQuoter = this._numberQuoter;
        }
        else {
          tableName = nounMeta.attrTableName;
          idColumnName = nounMeta.attrIDColumnName;
          valueColumnName = "value";
          valueQuoter = this._numberQuoter;
        }
        
        // we want a net 'or' for everyone in here, where 'everyone' is presumed
        //  to have been generated from a single attribute.  Since a single
        //  attribute can actually map to multiple attribute id's because of the
        //  parameters, we actually need to make this slightly more complicated
        //  than it could be.  We want to OR together the clauses for testing
        //  each attributeID, where within each clause we OR the value.
        // ex: (attributeID=1 AND (value=1 OR value=2)) OR (attributeID=2 AND
        //      (value=7))
        // note that we don't consolidate things into an IN clause (although
        //  we could) and it's okay because the optimizer makes all such things
        //  equal.
        for (let iOrIndex=0; iOrIndex < attr_ors.length; iOrIndex++) {
          let APV = attr_ors[iOrIndex];
        
          let attributeID;
          if (APV[1] != null)
            attributeID = APV[0].bindParameter(APV[1]);
          else
            attributeID = APV[0].id;
          if (attributeID != lastAttributeID) {
            valueTests = [];
            if (APV[0].special == kSpecialColumn ||
                APV[0].special == kSpecialString)
              attrValueTests.push(["", valueTests]);
            else
              attrValueTests.push(["attributeID = " + attributeID + " AND ",
                                   valueTests]);
            lastAttributeID = attributeID;
          }
          
          // straight value match?
          if (APV.length == 3) {
            if (APV[2] != null)
              valueTests.push(valueColumnName + " = " + valueQuoter(APV[2]));
          }
          // (quoting is not required for ranges because we only support ranges
          //  for numbers.  as such, no use of valueQuoter in here.)
          else { // APV.length == 4, so range match
            // - numeric case (no quoting in here)
            if (presumedAttr.special != kSpecialString) {
              if (APV[2] === null) // so just <=
                valueTests.push(valueColumnName + " <= " + APV[3]);
              else if (APV[3] === null) // so just >=
              // BETWEEN is optimized to >= and <=, or we could just do that
              //  ourself (in other words, this shouldn't hurt our use of indices)
                valueTests.push(valueColumnName + " >= " + APV[2]);
              else
                valueTests.push(valueColumnName + " BETWEEN " + APV[2] +
                                  " AND " + APV[3]);
            }
            // - string case (LIKE)
            else {
              // this will result in a warning in debug builds.  as we move to
              //  supporting async operation, we should also move to binding all
              //  arguments for dynamic queries too. 
              valueTests.push(valueColumnName + " LIKE " + valueQuoter(APV[2]));
            }
          }
        }
        let select = "SELECT " + idColumnName + " FROM " + tableName + 
                     " WHERE " +
                     [("(" + avt[0] + "(" + avt[1].join(" OR ") + "))")
                      for each (avt in attrValueTests)].join(" OR ");
        selects.push(select);
      }
      
      if (selects.length)
        whereClauses.push("id IN (" + selects.join(" INTERSECT ") + " )");
    }
    
    let sqlString = "SELECT * FROM " + nounMeta.tableName;
    if (whereClauses.length)
      sqlString += " WHERE " + whereClauses.join(" OR ");
    
    this._log.debug("QUERY FROM QUERY: " + sqlString);
    
    let collection;
    if (bSynchronous) {
      let statement = this._createSyncStatement(sqlString, true);
    
      let items = [];
      while (statement.executeStep()) {
        items.push(nounMeta.objFromRow.call(nounMeta.datastore, statement));
      }
      statement.finalize();
      
      // have the collection manager attempt to replace the instances we just
      //  created with pre-existing instances.  if the instance didn't exist,
      //  cache the newly observed ones.  We are trading off wastes here; we don't
      //  want to have to ask the collection manager about every row, and we don't
      //  want to invent some alternate row storage.
      GlodaCollectionManager.cacheLoadUnify(nounMeta.id, items);
      collection = new GlodaCollection(items, aQuery, aListener);
      
      GlodaCollectionManager.registerCollection(collection);
    }
    else { // async!
      let statement = this._createAsyncStatement(sqlString, true);
      let collection = new GlodaCollection([], aQuery, aListener);    
      GlodaCollectionManager.registerCollection(collection);

      statement.executeAsync(new QueryFromQueryCallback(statement, nounMeta,
        collection));
    }
    return collection;
  },
  
  /**
   * Deprecated, but still in existence for the benefit of expmess code that
   *  needs to go away anyways and can take this with it.
   */
  queryMessagesAPV: function gloda_ds_queryMessagesAPV(aAPVs) {
    let selects = [];
    
    for (let iAPV=0; iAPV < aAPVs.length; iAPV++) {
      let APV = aAPVs[iAPV];
      
      let attributeID;
      if (APV[1] != null)
        attributeID = APV[0].bindParameter(APV[1]);
      else
        attributeID = APV[0].id;
      let select = "SELECT messageID FROM messageAttributes WHERE attributeID" +
                   " = " + attributeID;
      // straight value match?
      if (APV.length == 3) {
        if (APV[2] != null)
          select += " AND value = " + APV[2];
      }
      else { // APV.length == 4, so range match
        // BETWEEN is optimized to >= and <=, or we could just do that ourself.
        //  (in other words, this shouldn't hurt our use of indices)
        select += " AND value BETWEEN " + APV[2] + " AND " + APV[3];
      }
      selects.push(select);
    }
    
    let sqlString = "SELECT * FROM messages WHERE id IN (" +
                    selects.join(" INTERSECT ") + " )";
    let statement = this._createSyncStatement(sqlString, true);
    
    let messages = [];
    while (statement.executeStep()) {
      messages.push(this._messageFromRow(statement));
    }
    statement.finalize();
    
    if (messages.length)
      GlodaCollectionManager.cacheLoadUnify(GlodaMessage.prototype.NOUN_ID,
                                            messages);
     
    return messages;
  },
  
  /* ********** Contact ********** */
  _nextContactId: 1,

  _populateContactManagedId: function () {
    let stmt = this._createSyncStatement("SELECT MAX(id) FROM contacts", true);
    if (stmt.executeStep()) {
      this._nextContactId = stmt.getInt64(0) + 1;
    }
    stmt.finalize();
  },
  
  get _insertContactStatement() {
    let statement = this._createAsyncStatement(
      "INSERT INTO contacts (id, directoryUUID, contactUUID, name, popularity,\
                             frecency) \
              VALUES (?1, ?2, ?3, ?4, ?5, ?6)");
    this.__defineGetter__("_insertContactStatement", function() statement);
    return this._insertContactStatement; 
  },
  
  createContact: function gloda_ds_createContact(aDirectoryUUID, aContactUUID,
      aName, aPopularity, aFrecency) {
    let contactID = this._nextContactId++;
    let ics = this._insertContactStatement;
    ics.bindInt64Parameter(0, contactID);
    if (aDirectoryUUID == null)
      ics.bindNullParameter(1);
    else
      ics.bindStringParameter(1, aDirectoryUUID);
    if (aContactUUID == null)
      ics.bindNullParameter(2);
    else
      ics.bindStringParameter(2, aContactUUID);
    ics.bindStringParameter(3, aName);
    ics.bindInt64Parameter(4, aPopularity);
    ics.bindInt64Parameter(5, aFrecency);
    
    ics.executeAsync();
    
    let contact = new GlodaContact(this, contactID,
                                   aDirectoryUUID, aContactUUID, aName,
                                   aPopularity, aFrecency);
    GlodaCollectionManager.itemsAdded(contact.NOUN_ID, [contact]);
    return contact;
  },

  get _updateContactStatement() {
    let statement = this._createAsyncStatement(
      "UPDATE contacts SET directoryUUID = ?1, \
                           contactUUID = ?2, \
                           name = ?3, \
                           popularity = ?4, \
                           frecency = ?5 \
                       WHERE id = ?6");
    this.__defineGetter__("_updateContactStatement", function() statement);
    return this._updateContactStatement; 
  },

  updateContact: function gloda_ds_updateContact(aContact) {
    let ucs = this._updateContactStatement;
    ucs.bindInt64Parameter(5, aContact.id);
    ucs.bindStringParameter(0, aContact.directoryUUID);
    ucs.bindStringParameter(1, aContact.contactUUID);
    ucs.bindStringParameter(2, aContact.name);
    ucs.bindInt64Parameter(3, aContact.popularity);
    ucs.bindInt64Parameter(4, aContact.frecency);
    
    ucs.executeAsync();
  },
  
  _contactFromRow: function gloda_ds_contactFromRow(aRow) {
    let directoryUUID, contactUUID;
    if (aRow.getTypeOfIndex(1) == Ci.mozIStorageValueArray.VALUE_TYPE_NULL)
      directoryUUID = null;
    else
      directoryUUID = aRow.getString(1);
    if (aRow.getTypeOfIndex(2) == Ci.mozIStorageValueArray.VALUE_TYPE_NULL)
      contactUUID = null;
    else
      contactUUID = aRow.getString(2);
      
    return new GlodaContact(this, aRow.getInt64(0), directoryUUID,
                            contactUUID, aRow.getString(5),
                            aRow.getInt64(3), aRow.getInt64(4));
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
      if (scbi.executeStep()) {
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
    if (stmt.executeStep()) {
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
    iis.executeAsync();
  
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
    let identity = null;
    
    let ibkv = this._selectIdentityByKindValueStatement;
    ibkv.bindStringParameter(0, aKind);
    ibkv.bindStringParameter(1, aValue);
    if (ibkv.executeStep()) {
      identity = this._identityFromRow(ibkv);
    }
    ibkv.reset();
    
    return identity && GlodaCollectionManager.cacheLoadUnifyOne(identity);
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
      if (sibis.executeStep()) {
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
    while (sibcs.executeStep()) {
      identities.push(this._identityFromRow(sibcs));
    }
    sibcs.reset();

    if (identities.length)
      GlodaCollectionManager.cacheLoadUnify(GlodaIdentity.prototype.NOUN_ID,
                                            identities);
    return identities;
  },
};
