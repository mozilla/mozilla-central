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
          "folderURI TEXT",
        ],
        
        triggers: {
          delete: "DELETE from messages WHERE folderID = OLD.id",
        },
      },
      
      conversations: {
        columns: [
          "id INTEGER PRIMARY KEY",
          "subject TEXT",
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
          "attributeType INTEGER",
          "extensionName TEXT",
          "name TEXT",
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
            /* covering: */ "conversationID", "messageID", "value"],
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
          "kind TEXT", // ex: email, irc, etc.
          "value TEXT", // ex: e-mail address, irc nick/handle, etc.
          "description TEXT", // what makes this identity different from the
          // others? (ex: home, work, etc.) 
          "relay INTEGER", // is the identity just a relay mechanism?
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
    
    this.dbConnection = dbConnection;
    
    this._getAllFolderMappings();
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
    let testTableSql = "SELECT * FROM sqlite_master WHERE type='table' AND " +
                       "name = '" + aTableDef._realName + "'";
    let testTableStmt = this._createStatement(testTableSql);
    if (!testTableStmt.step()) {
      try {
        this.dbConnection.createTable(aTableDef._realName,
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
          this.dbConnection.executeSimpleSQL(indexSql);
        }
        catch (ex) {
          this._log.error("Problem creating index " + indexName + " for " +
            "table " + aTableDef.name + " because " + ex + " at " +
            ex.fileName + ":" + ex.lineNumber);
        }
      }
    }
    testTableStmt.reset();
    
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
  
  // cribbed from snowl
  _createStatement: function gloda_ds_createStatement(aSQLString) {
    let statement = null;
    try {
      statement = this.dbConnection.createStatement(aSQLString);
    }
    catch(ex) {
       throw("error creating statement " + aSQLString + " - " +
             this.dbConnection.lastError + ": " +
             this.dbConnection.lastErrorString + " - " + ex);
    }
    
    let wrappedStatement = Cc["@mozilla.org/storage/statement-wrapper;1"].
                           createInstance(Ci.mozIStorageStatementWrapper);
    wrappedStatement.initialize(statement);
    return wrappedStatement;
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
      this.dbConnection.beginTransaction();
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
          this.dbConnection.commitTransaction();
        else
          this.dbConnection.rollbackTransaction();
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
        this.dbConnection.rollbackTransaction();
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
  
  get _insertAttributeDefStatement() {
    let statement = this._createStatement(
      "INSERT INTO attributeDefinitions (attributeType, extensionName, name, \
                                  parameter) \
              VALUES (:attributeType, :extensionName, :name, :parameter)");
    this.__defineGetter__("_insertAttributeDefStatement", function() statement);
    return this._insertAttributeDefStatement; 
  },

  /**
   * Create an attribute definition and return the row ID.  Special/atypical
   *  in that it doesn't directly return a GlodaAttributeDef; we leave that up
   *  to the caller since they know much more than actually needs to go in the
   *  database.
   */
  _createAttributeDef: function gloda_ds_createAttributeDef(aAttrType,
                                    aExtensionName, aAttrName, aParameter) {
    let iads = this._insertAttributeDefStatement;
    iads.params.attributeType = aAttrType;
    iads.params.extensionName = aExtensionName;
    iads.params.name = aAttrName;
    iads.params.parameter = aParameter;
    
    iads.execute();
    
    return this.dbConnection.lastInsertRowID;
  },
  
  get _selectAttributeDefinitionsStatement() {
    let statement = this._createStatement(
      "SELECT * FROM attributeDefinitions");
    this.__defineGetter__("_selectAttributeDefinitionsStatement",
      function() statement);
    return this._selectAttributeDefinitionsStatement;
  },
  
  /**
   * Look-up all the attribute definitions, populating our authoritative 
   *  _attributes and _attributeIDToDef maps.  (In other words, once this method
   *  is called, those maps should always be in sync with the underlying
   *  database.)
   */
  getAllAttributes: function gloda_ds_getAllAttributes() {
    // map compound name to the attribute
    let attribs = {};
    // map the attribute id to [attribute, parameter] where parameter is null
    //  in cases where parameter is unused.
    let idToAttribAndParam = {}

    this._log.info("loading all attribute defs");
    
    while (this._selectAttributeDefinitionsStatement.step()) {
      let row = this._selectAttributeDefinitionsStatement.row;
      
      let compoundName = row["extensionName"] + ":" + row["name"];
      
      let attrib;
      if (compoundName in attribs) {
        attrib = attribs[compoundName];
      } else {
        attrib = new GlodaAttributeDef(this, null,
                                       compoundName, null, row["attributeType"],
                                       row["extensionName"], row["name"],
                                       null, null, null, null);
        attribs[compoundName] = attrib;
      }
      // if the parameter is null, the id goes on the attribute def, otherwise
      //  it is a parameter binding and goes in the binding map.
      if (row["parameter"] == null) {
        attrib._id = row["id"];
        idToAttribAndParam[row["id"]] = [attrib, null];
      } else {
        attrib._parameterBindings[row["parameter"]] = row["id"];
        idToAttribAndParam[row["id"]] = [attrib, row["parameter"]];
      }
    }
    this._selectAttributeDefinitionsStatement.reset();

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
  
  get _insertFolderLocationStatement() {
    let statement = this._createStatement(
      "INSERT INTO folderLocations (folderURI) VALUES (:folderURI)");
    this.__defineGetter__("_insertFolderLocationStatement",
      function() statement);
    return this._insertFolderLocationStatement;
  },
  
  // memoizing this is arguably overkill... fix along with _mapFolderID idiom.
  get _selectAllFolderLocations() {
    let statement = this._createStatement(
      "SELECT id, folderURI FROM folderLocations");
    this.__defineGetter__("_selectAllFolderLocations",
      function() statement);
    return this._selectAllFolderLocations;
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
    while (this._selectAllFolderLocations.step()) {
      let folderID = this._selectAllFolderLocations.row["id"];
      let folderURI = this._selectAllFolderLocations.row["folderURI"];
      this._folderURIs[folderURI] = folderID;
      this._folderIDs[folderID] = folderURI;
    }
    this._selectAllFolderLocations.reset();
  },
  
  /**
   * Map a folder URI to a folder ID, creating the mapping if it does not yet
   *  exist.
   */
  _mapFolderURI: function gloda_ds_mapFolderURI(aFolderURI) {
    if (aFolderURI in this._folderURIs) {
      return this._folderURIs[aFolderURI];
    }
    
    this._insertFolderLocationStatement.params.folderURI = aFolderURI;
    this._insertFolderLocationStatement.execute();
    let folderID = this.dbConnection.lastInsertRowID;

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
    let statement = this._createStatement(
      "UPDATE folderLocations SET folderURI = :newFolderURI \
              WHERE folderURI = :oldFolderURI");
    this.__defineGetter__("_updateFolderLocationStatement",
      function() statement);
    return this._updateFolderLocationStatement;
  },
  
  /**
   * Non-recursive folder renaming based on the URI.
   *
   * @TODO provide a mechanism for recursive folder renames or have a higher
   *     layer deal with it and remove this note.
   */
  renameFolder: function gloda_ds_renameFolder(aOldURI, aNewURI) {
    let folderID = this._mapFolderURI(aOldURI); // ensure the URI is mapped...
    this._folderURIs[aNewURI] = folderID;
    this._folderIDs[folderID] = aNewURI;
    this._log.info("renaming folder URI " + aOldURI + " to " + aNewURI);
    this._updateFolderLocationStatement.params.oldFolderURI = aOldURI;
    this._updateFolderLocationStatement.params.newFolderURI = aNewURI;
    this._updateFolderLocationStatement.execute();
    delete this._folderURIs[aOldURI];
  },
  
  deleteFolderByID: function gloda_ds_deleteFolder(aFolderID) {
    let statement = this._createStatement(
      "DELETE FROM folderLocations WHERE id = :id");
    statement.params.id = aFolderID;
    statement.execute();
  },
  
  /* ********** Conversation ********** */
  get _insertConversationStatement() {
    let statement = this._createStatement(
      "INSERT INTO conversations (subject, oldestMessageDate, \
                                  newestMessageDate) \
              VALUES (:subject, :oldestMessageDate, :newestMessageDate)");
    this.__defineGetter__("_insertConversationStatement", function() statement);
    return this._insertConversationStatement; 
  }, 

  get _insertConversationTextStatement() {
    let statement = this._createStatement(
      "INSERT INTO conversationsText (docid, subject) \
              VALUES (:docid, :subject)");
    this.__defineGetter__("_insertConversationTextStatement",
      function() statement);
    return this._insertConversationTextStatement; 
  }, 

  
  /**
   * Create a conversation.
   */
  createConversation: function gloda_ds_createConversation(aSubject,
        aOldestMessageDate, aNewestMessageDate) {

    // create the data row    
    let ics = this._insertConversationStatement;
    ics.params.subject = aSubject;
    ics.params.oldestMessageDate = aOldestMessageDate;
    ics.params.newestMessageDate = aNewestMessageDate;
    ics.execute();
    
    let conversationID = this.dbConnection.lastInsertRowID; 
    
    // create the fulltext row, using the same rowid/docid
    let icts = this._insertConversationTextStatement;
    icts.params.docid = conversationID;
    icts.params.subject = aSubject;
    icts.execute();
    
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
    let statement = this._createStatement(
      "DELETE FROM conversations WHERE id = :conversationID");
    this.__defineGetter__("_deleteConversationByIDStatement",
                          function() statement);
    return this._deleteConversationByIDStatement; 
  },

  deleteConversationByID: function gloda_ds_deleteConversationByID(
                                      aConversationID) {
    let dcbids = this._deleteConversationByIDStatement;
    dcbids.params.conversationID = aConversationID;
    dcbids.execute();
    
    // TODO: collection manager implications
    GlodaCollectionManager.removeByID()
  },

  get _selectConversationByIDStatement() {
    let statement = this._createStatement(
      "SELECT * FROM conversations WHERE id = :conversationID");
    this.__defineGetter__("_selectConversationByIDStatement",
      function() statement);
    return this._selectConversationByIDStatement;
  }, 

  _conversationFromRow: function gloda_ds_conversationFromRow(aRow) {
      return new GlodaConversation(this, aRow["id"],
        aRow["subject"], aRow["oldestMessageDate"], aRow["newestMessageDate"]);  
  },

  getConversationByID: function gloda_ds_getConversationByID(aConversationID) {
    let conversation = GlodaCollectionManager.cacheLookupOne(
      GlodaConversation.prototype.NOUN_ID, aConversationID);

    if (conversation === null) {
      let scbids = this._selectConversationByIDStatement;
      
      scbids.params.conversationID = aConversationID;
      if (scbids.step()) {
        conversation = this._conversationFromRow(scbids.row);
        GlodaCollectionManager.itemLoaded(conversation);
      }
      scbids.reset();
    }
    
    return conversation;
  },
  
  /* ********** Message ********** */
  get _insertMessageStatement() {
    let statement = this._createStatement(
      "INSERT INTO messages (folderID, messageKey, conversationID, date, \
                             headerMessageID) \
              VALUES (:folderID, :messageKey, :conversationID, :date, \
                      :headerMessageID)");
    this.__defineGetter__("_insertMessageStatement", function() statement);
    return this._insertMessageStatement; 
  }, 

  get _insertMessageTextStatement() {
    let statement = this._createStatement(
      "INSERT INTO messagesText (docid, body) \
              VALUES (:docid, :body)");
    this.__defineGetter__("_insertMessageTextStatement", function() statement);
    return this._insertMessageTextStatement; 
  },
  
  /**
   *
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
    
    let ims = this._insertMessageStatement;
    ims.params.folderID = folderID;
    ims.params.messageKey = aMessageKey;
    ims.params.conversationID = aConversationID;
    ims.params.date = aDatePRTime;
    ims.params.headerMessageID = aHeaderMessageID;

    try {
       ims.execute();
    }
    catch(ex) {
       throw("error executing statement... " +
             this.dbConnection.lastError + ": " +
             this.dbConnection.lastErrorString + " - " + ex);
    }
    
    let messageID = this.dbConnection.lastInsertRowID;
    
    // we only create the full-text row if the body is non-null.
    // so, even though body might be null, we still want to create the
    //  full-text search row
    if (aBody) {
      let imts = this._insertMessageTextStatement;
      imts.params.docid = messageID;
      imts.params.body = aBody;
      
      try {
         imts.execute();
      }
      catch(ex) {
         throw("error executing fulltext statement... " +
               this.dbConnection.lastError + ": " +
               this.dbConnection.lastErrorString + " - " + ex);
      }
    }
    
    let message = new GlodaMessage(this, messageID, folderID,
                            aMessageKey, aConversationID, null,
                            aDatePRTime ? new Date(aDatePRTime / 1000) : null,
                            aHeaderMessageID);
    GlodaCollectionManager.itemsAdded(message.NOUN_ID, [message]);
    return message;
  },
  
  get _updateMessageStatement() {
    let statement = this._createStatement(
      "UPDATE messages SET folderID = :folderID, \
                           messageKey = :messageKey, \
                           conversationID = :conversationID, \
                           date = :date, \
                           headerMessageID = :headerMessageID \
              WHERE id = :id");
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
    ums.params.id = aMessage.id;
    ums.params.folderID = aMessage.folderID;
    ums.params.messageKey = aMessage.messageKey;
    ums.params.conversationID = aMessage.conversationID;
    ums.params.date = aMessage.date * 1000;
    ums.params.headerMessageID = aMessage.headerMessageID;
    
    ums.execute();
    
    if (aBody) {
      let imts = this._insertMessageTextStatement;
      imts.params.docid = aMessage.id;
      imts.params.body = aBody;
      
      imts.execute();
    }
  },

  updateMessageFoldersByKeyPurging:
      function gloda_ds_updateMessageFoldersByKeyPurging(aSrcFolderURI,
        aMessageKeys, aDestFolderURI) {
    let srcFolderID = this._mapFolderURI(aSrcFolderURI);
    let destFolderID = this._mapFolderURI(aDestFolderURI);
    
    let sqlStr = "UPDATE messages SET folderID = :newFolderID, \
                                      messageKey = :nullMsgKey \
                   WHERE folderID = :id \
                     AND messageKey IN (" + aMessageKeys.join(", ") + ")";
    let statement = this._createStatement(sqlStr);
    statement.params.id = srcFolderID;
    statement.params.newFolderID = destFolderID;
    statement.params.nullMsgKey = null;
    statement.execute();
  },
  
  _messageFromRow: function gloda_ds_messageFromRow(aRow) {
    let datePRTime = aRow["date"];
    return new GlodaMessage(this, aRow["id"], aRow["folderID"],
                            aRow["messageKey"],
                            aRow["conversationID"], null,
                            datePRTime ? new Date(datePRTime / 1000) : null,
                            aRow["headerMessageID"]);
  },

  get _selectMessageByIDStatement() {
    let statement = this._createStatement(
      "SELECT * FROM messages WHERE id = :id");
    this.__defineGetter__("_selectMessageByIDStatement",
      function() statement);
    return this._selectMessageByIDStatement;
  },

  getMessageByID: function gloda_ds_getMessageByID(aID) {
    let message = GlodaCollectionManager.cacheLookupOne(
      GlodaMessage.prototype.NOUN_ID, aID);
  
    if (message === null) {
      let smbis = this._selectMessageByIDStatement;
      
      smbis.params.id = aID;
      if (smbis.step()) {
        message = this._messageFromRow(smbis.row);
        GlodaCollectionManager.itemLoaded(message);
      }
      smbis.reset();
    }
    
    return message;
  },

  get _selectMessageByLocationStatement() {
    let statement = this._createStatement(
      "SELECT * FROM messages WHERE folderID = :folderID AND \
                                    messageKey = :messageKey");
    this.__defineGetter__("_selectMessageByLocationStatement",
      function() statement);
    return this._selectMessageByLocationStatement;
  },

  /**
   * Retrieve the message that we believe to correspond to the given message
   *  key in the given folder.
   * @return null on failure to locate the message, the message on success.
   *
   * @XXX on failure, attempt to resolve the problem through re-indexing, etc.
   */
  getMessageFromLocation: function gloda_ds_getMessageFromLocation(aFolderURI,
                                                                 aMessageKey) {
    this._selectMessageByLocationStatement.params.folderID =
      this._mapFolderURI(aFolderURI);
    this._selectMessageByLocationStatement.params.messageKey = aMessageKey;
    
    let message = null;
    if (this._selectMessageByLocationStatement.step())
      message = this._messageFromRow(this._selectMessageByLocationStatement.row);
    this._selectMessageByLocationStatement.reset();
    
    if (message === null)
      this._log.info("Error locating message with key=" + aMessageKey +
                     " and URI " + aFolderURI);
    
    return message && GlodaCollectionManager.cacheLoadUnifyOne(message);
  },

  get _selectMessageIDsByFolderStatement() {
    let statement = this._createStatement(
      "SELECT id FROM messages WHERE folderID = :folderID");
    this.__defineGetter__("_selectMessageIDsByFolderStatement",
      function() statement);
    return this._selectMessageIDsByFolderStatement;
  },
  
  getMessageIDsByFolderID:
      function gloda_ds_getMessageIDsFromFolderID(aFolderID) {
    let messageIDs = [];
    
    let smidbfs = this._selectMessageIDsByFolderStatement;
    smidbfs.params.folderID = aFolderID;
    
    while (smidbfs.step()) {
      messageIDs.push(smidbfs.row["id"]);
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
   */
  getMessagesByMessageID: function gloda_ds_getMessagesByMessageID(aMessageIDs) {
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
    let statement = this._createStatement(sqlString);
    
    while (statement.step()) {
      results[msgIDToIndex[statement.row["headerMessageID"]]].push(
        this._messageFromRow(statement.row));
    }
    statement.reset();
    
    for (let iResult=0; iResult < results.length; iResult++) {
      if (results[iResult].length)
        GlodaCollectionManager.cacheLoadUnify(GlodaMessage.prototype.NOUN_ID,
                                              results[iResult]);
    }
    
    return results;
  },

  get _deleteMessageByIDStatement() {
    let statement = this._createStatement(
      "DELETE FROM messages WHERE id = :id");
    this.__defineGetter__("_deleteMessageByIDStatement",
                          function() statement);
    return this._deleteMessageByIDStatement; 
  },
  
  deleteMessageByID: function gloda_ds_deleteMessageByID(aMessageID) {
    // TODO: collection manager implications
    let dmbids = this._deleteMessageByIDStatement;
    dmbids.params.id = aMessageID;
    dmbids.execute();
  },

  get _deleteMessagesByConversationIDStatement() {
    let statement = this._createStatement(
      "DELETE FROM messages WHERE conversationID = :conversationID");
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
    dmbcids.params.conversationID = aConversationID;
    dmbcids.execute();
  },
  
  /**
   * Get the first message found in the database with the given header
   *  Message-ID, or null if none exists.  Because of the good chance of there
   *  being more than one message with a Message-ID, you probably want a
   *  different method than this one.  At the very least, a method that takes
   *  a hint about what folder to look in...
   */
  getMessageByMessageID: function gloda_ds_getMessageByMessageID(aMessageID) {
    let ids = [aMessageID];
    // getMessagesByMessageID handles the collection manager cache resolution
    let messagesWithID = this.getMessagesByMessageID(ids)[0];
    // Just return the first one; we are a failure 
    if (messagesWithID.length > 0)
      return messagesWithID[0];
    else
      return null;
  },

  get _selectMessagesByConversationIDStatement() {
    let statement = this._createStatement(
      "SELECT * FROM messages WHERE conversationID = :conversationID");
    this.__defineGetter__("_selectMessagesByConversationIDStatement",
      function() statement);
    return this._selectMessagesByConversationIDStatement;
  },

  get _selectMessagesByConversationIDNoGhostsStatement() {
    let statement = this._createStatement(
      "SELECT * FROM messages WHERE conversationID = :conversationID AND \
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
    statement.params.conversationID = aConversationID; 
    
    let messages = [];
    while (statement.step()) {
      messages.push(this._messageFromRow(statement.row));
    }
    statement.reset();

    if (messages.length)
      GlodaCollectionManager.cacheLoadUnify(GlodaMessage.prototype.NOUN_ID,
                                            messages);
    
    return messages;
  },
  
  /* ********** Message Attributes ********** */
  get _insertMessageAttributeStatement() {
    let statement = this._createStatement(
      "INSERT INTO messageAttributes (conversationID, messageID, attributeID, \
                             value) \
              VALUES (:conversationID, :messageID, :attributeID, :value)");
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

        this._log.debug("inserting conv:" + aMessage.conversationID +
                        " message:" + aMessage.id + 
                        " attributeID:" + attribValueTuple[0] +
                        " value:" + attribValueTuple[1]);
        
        imas.params.conversationID = aMessage.conversationID;
        imas.params.messageID = aMessage.id;
        imas.params.attributeID = attribValueTuple[0];
        // use 0 instead of null, otherwise the db gets upset.  (and we don't
        //  really care anyways.)
        if (attribValueTuple[1] == null)
          imas.params.value = 0;
        else
          imas.params.value = attribValueTuple[1];
        imas.execute();
      }
      
      this._commitTransaction();
    }
    catch (ex) {
      this._rollbackTransaction();
      throw ex;
    }
  },
  
  get _deleteMessageAttributesByMessageIDStatement() {
    let statement = this._createStatement(
      "DELETE FROM messageAttributes WHERE messageID = :messageID");
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
      this._deleteMessageAttributesByMessageIDStatement.params.messageID =
        aMessage.id;
      this._deleteMessageAttributesByMessageIDStatement.execute();
    }
  },
  
  get _selectMessageAttributesByMessageIDStatement() {
    let statement = this._createStatement(
      "SELECT * FROM messageAttributes WHERE messageID = :messageID");
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
    
    smas.params.messageID = aMessage.id;
    while (smas.step()) {
      let attributeID = smas.row["attributeID"];
      if (!(attributeID in this._attributeIDToDef)) {
        this._log.error("Attribute ID " + attributeID + " not in our map!");
      } 
      let attribAndParam = this._attributeIDToDef[attributeID];
      let val = smas.row["value"];
      //this._log.debug("Loading attribute: " + attribAndParam[0].id + " param: "+
      //                attribAndParam[1] + " val: " + val);
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
   * Currently, this operation is fully synchronous, but needs to also provide
   *  an asynchronous means of operation as well.
   * This functionality is made user/extension visible by the Query's getAllSync
   *  method.
   *
   * @TODO Create an asynchronous query-from-query mechanism
   */
  queryFromQuery: function gloda_ds_queryFromQuery(aQuery) {
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
    
    let statement = this._createStatement(sqlString);
    
    let items = [];
    while (statement.step()) {
      items.push(nounMeta.objFromRow.call(nounMeta.datastore, statement.row));
    }
    statement.reset();
    // have the collection manager attempt to replace the instances we just
    //  created with pre-existing instances.  if the instance didn't exist,
    //  cache the newly observed ones.  We are trading off wastes here; we don't
    //  want to have to ask the collection manager about every row, and we don't
    //  want to invent some alternate row storage.
    GlodaCollectionManager.cacheLoadUnify(nounMeta.id, items);
    
    let collection = new GlodaCollection(items, aQuery);
    GlodaCollectionManager.registerCollection(collection);
    return collection;
  },
  
  /**
   * Deprecated.  Use queries (which in turn use queryFromQuery).  This was a
   *  means of querying for messages based on (normalized) attributes by
   *  specifying an APV style query.  This method does not track changes in the
   *  APV representation idiom for queries and may possess other shortcomings.
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
    let statement = this._createStatement(sqlString);
    
    let messages = [];
    while (statement.step()) {
      messages.push(this._messageFromRow(statement.row));
    }
    statement.reset();
    
    if (messages.length)
      GlodaCollectionManager.cacheLoadUnify(GlodaMessage.prototype.NOUN_ID,
                                            messages);
     
    return messages;
  },
  
  /* ********** Contact ********** */
  get _insertContactStatement() {
    let statement = this._createStatement(
      "INSERT INTO contacts (directoryUUID, contactUUID, name, popularity,\
                             frecency) \
              VALUES (:directoryUUID, :contactUUID, :name, :popularity,\
                      :frecency)");
    this.__defineGetter__("_insertContactStatement", function() statement);
    return this._insertContactStatement; 
  },
  
  createContact: function gloda_ds_createContact(aDirectoryUUID, aContactUUID,
      aName, aPopularity, aFrecency) {
    let ics = this._insertContactStatement;
    ics.params.directoryUUID = aDirectoryUUID;
    ics.params.contactUUID = aContactUUID;
    ics.params.name = aName;
    ics.params.popularity = aPopularity;
    ics.params.frecency = aFrecency;
    
    ics.execute();
    
    let contact = new GlodaContact(this, this.dbConnection.lastInsertRowID,
                                   aDirectoryUUID, aContactUUID, aName,
                                   aPopularity, aFrecency);
    GlodaCollectionManager.itemsAdded(contact.NOUN_ID, [contact]);
    return contact;
  },

  get _updateContactStatement() {
    let statement = this._createStatement(
      "UPDATE contacts SET directoryUUID = :directoryUUID, \
                           contactUUID = :contactUUID, \
                           name = :name, \
                           popularity = :popularity, \
                           frecency = :frecency \
                       WHERE id = :id");
    this.__defineGetter__("_updateContactStatement", function() statement);
    return this._updateContactStatement; 
  },

  updateContact: function gloda_ds_updateContact(aContact) {
    let ucs = this._updateContactStatement;
    ucs.params.id = aContact.id;
    ucs.params.directoryUUID = aContact.directoryUUID;
    ucs.params.contactUUID = aContact.contactUUID;
    ucs.params.name = aContact.name;
    ucs.params.popularity = aContact.popularity;
    ucs.params.frecency = aContact.frecency;
    
    ucs.execute();
  },
  
  _contactFromRow: function gloda_ds_contactFromRow(aRow) {
    return new GlodaContact(this, aRow["id"], aRow["directoryUUID"],
                            aRow["contactUUID"], aRow["name"],
                            aRow["popularity"], aRow["frecency"]);
  },
  
  get _selectContactByIDStatement() {
    let statement = this._createStatement(
      "SELECT * FROM contacts WHERE id = :id");
    this.__defineGetter__("_selectContactByIDStatement",
      function() statement);
    return this._selectContactByIDStatement;
  },

  getContactByID: function gloda_ds_getContactByID(aContactID) {
    let contact = GlodaCollectionManager.cacheLookupOne(
      GlodaContact.prototype.NOUN_ID, aContactID);
    
    if (contact === null) {
      let scbi = this._selectContactByIDStatement;
      scbi.params.id = aContactID;
      if (scbi.step()) {
        contact = this._contactFromRow(scbi.row);
        GlodaCollectionManager.itemLoaded(contact);
      }
      scbi.reset();
    }
    
    return contact;
  },
  
  /* ********** Identity ********** */
  get _insertIdentityStatement() {
    let statement = this._createStatement(
      "INSERT INTO identities (contactID, kind, value, description, relay) \
              VALUES (:contactID, :kind, :value, :description, :relay)");
    this.__defineGetter__("_insertIdentityStatement", function() statement);
    return this._insertIdentityStatement; 
  },
  
  createIdentity: function gloda_ds_createIdentity(aContactID, aContact, aKind,
                                                   aValue, aDescription,
                                                   aIsRelay) {
    let iis = this._insertIdentityStatement;
    iis.params.contactID = aContactID;
    iis.params.kind = aKind;
    iis.params.value = aValue;
    iis.params.description = aDescription;
    iis.params.relay = aIsRelay ? 1 : 0;
    iis.execute();
  
    let identity = new GlodaIdentity(this, this.dbConnection.lastInsertRowID,
                                     aContactID, aContact, aKind, aValue,
                                     aDescription, aIsRelay);
    GlodaCollectionManager.itemsAdded(identity.NOUN_ID, [identity]);
    return identity;
  },
  
  _identityFromRow: function gloda_ds_identityFromRow(aRow) {
    return new GlodaIdentity(this, aRow["id"], aRow["contactID"], null,
                             aRow["kind"], aRow["value"], aRow["description"],
                             aRow["relay"] ? true : false);
  },
  
  get _selectIdentityByKindValueStatement() {
    let statement = this._createStatement(
      "SELECT * FROM identities WHERE kind = :kind AND value = :value");
    this.__defineGetter__("_selectIdentityByKindValueStatement",
      function() statement);
    return this._selectIdentityByKindValueStatement;
  },

  /** Lookup an identity by kind and value.  Ex: (email, foo@bar.com) */
  getIdentity: function gloda_ds_getIdentity(aKind, aValue) {
    let identity = null;
    
    let ibkv = this._selectIdentityByKindValueStatement;
    ibkv.params.kind = aKind;
    ibkv.params.value = aValue;
    if (ibkv.step()) {
      identity = this._identityFromRow(ibkv.row);
    }
    ibkv.reset();
    
    return identity && GlodaCollectionManager.cacheLoadUnifyOne(identity);
  },

  get _selectIdentityByIDStatement() {
    let statement = this._createStatement(
      "SELECT * FROM identities WHERE id = :id");
    this.__defineGetter__("_selectIdentityByIDStatement",
      function() statement);
    return this._selectIdentityByIDStatement;
  },

  getIdentityByID: function gloda_ds_getIdentityByID(aID) {
    let identity = GlodaCollectionManager.cacheLookupOne(
      GlodaIdentity.prototype.NOUN_ID, aID);
    
    if (identity === null) {
      let sibis = this._selectIdentityByIDStatement;
      sibis.params.id = aID;
      if (sibis.step()) {
        identity = this._identityFromRow(sibis.row);
        GlodaCollectionManager.itemLoaded(identity);
      }
      sibis.reset();
    }
    
    return identity;
  },

  get _selectIdentityByContactIDStatement() {
    let statement = this._createStatement(
      "SELECT * FROM identities WHERE contactID = :contactID");
    this.__defineGetter__("_selectIdentityByContactIDStatement",
      function() statement);
    return this._selectIdentityByContactIDStatement;
  },

  getIdentitiesByContactID: function gloda_ds_getIdentitiesByContactID(
      aContactID) {
    let sibcs = this._selectIdentityByContactIDStatement;
    
    sibcs.params.contactID = aContactID;
    
    let identities = [];
    while (sibcs.step()) {
      identities.push(this._identityFromRow(sibcs.row));
    }
    sibcs.reset();

    if (identities.length)
      GlodaCollectionManager.cacheLoadUnify(GlodaIdentity.prototype.NOUN_ID,
                                            identities);
    return identities;
  },
};
