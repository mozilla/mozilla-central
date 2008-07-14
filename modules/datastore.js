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

let GlodaDatastore = {
  _log: null,

  /* ******************* SCHEMA ******************* */

  _schemaVersion: 4,
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
          // we used to have the parentID, but because of the very real
          //  possibility of multiple copies of a message with a given
          //  message-id, the parentID concept is unreliable.
          "headerMessageID TEXT",
          "bodySnippet TEXT",
        ],
        
        indices: {
          messageLocation: ['folderID', 'messageKey'],
          headerMessageID: ['headerMessageID'],
          conversationID: ['conversationID'],
        },
        
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
          "name TEXT"
        ]
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
        dbConnection = dbService.openDatabase(dbFile);
      
        if (dbConnection.schemaVersion != this._schemaVersion) {
          this._migrate(dbConnection,
                        dbConnection.schemaVersion, this._schemaVersion);
        }
      }
      // Handle corrupt databases, other oddities
      // ... in the future. for now, let us die
    }
    
    this.dbConnection = dbConnection;
    
    this._getAllFolderMappings();
  },
  
  _createDB: function gloda_ds_createDB(aDBService, aDBFile) {
    var dbConnection = aDBService.openDatabase(aDBFile);
    
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
  
  _createSchema: function gloda_ds_createSchema(aDBConnection) {
    // -- For each table...
    for (let tableName in this._schema.tables) {
      let table = this._schema.tables[tableName];
      
      // - Create the table
      aDBConnection.createTable(tableName, table.columns.join(", "));
      
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
  
  _migrate: function gloda_ds_migrate(aDBConnection, aCurVersion, aNewVersion) {
    let msg = "We currently aren't clever enough to migrate. Delete your DB."
    this._log.error(msg)
    throw new Error(msg);
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
      if (this._transactionGood)
        this.dbConnection.commitTransaction();
      else
        this.dbConnection.rollbackTransaction();
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
      this.dbConnection.rollbackTransaction();
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
  
  /** Authoritative map from folder URI to folder ID */
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
    
    let folderID;
    this._selectFolderLocationByURIStatement.params.folderURI = aFolderURI;
    if (this._selectFolderLocationByURIStatement.step()) {
      folderID = this._selectFolderLocationByURIStatement.row["id"];
    }
    else {
      this._insertFolderLocationStatement.params.folderURI = aFolderURI;
      this._insertFolderLocationStatement.execute();
      folderID = this.dbConnection.lastInsertRowID;
    }
    this._selectFolderLocationByURIStatement.reset();

    this._folderURIs[aFolderURI] = folderID;
    this._folderIDs[folderID] = aFolderURI;
    this._log.info("mapping URI " + aFolderURI + " to " + folderID);
    return folderID;
  },
  
  _mapFolderID: function gloda_ds_mapFolderID(aFolderID) {
    if (aFolderID == null)
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
  
  renameFolder: function gloda_ds_renameFolder(aOldURI, aNewURI) {
    let folderID = this._folderURIs[aOldURI];
    this._folderURIs[aNewURI] = folderID;
    this._folderIDs[folderID] = aNewURI;
    this._updateFolderLocationStatement.params.oldFolderURI = aOldURI;
    this._updateFolderLocationStatement.params.newFolderURI = aNewURI;
    this._updateFolderLocationStatement.execute();
    delete this._folderURIs[aOldURI];
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
  
  /** Create a conversation. */
  createConversation: function gloda_ds_createConversation(aSubject,
        aOldestMessageDate, aNewestMessageDate) {
    
    let ics = this._insertConversationStatement;
    ics.params.subject = aSubject;
    ics.params.oldestMessageDate = aOldestMessageDate;
    ics.params.newestMessageDate = aNewestMessageDate;
        
    ics.execute();
    
    return new GlodaConversation(this, this.dbConnection.lastInsertRowID,
                                 aSubject, aOldestMessageDate,
                                 aNewestMessageDate);
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
  },

  get _selectConversationByIDStatement() {
    let statement = this._createStatement(
      "SELECT * FROM conversations WHERE id = :conversationID");
    this.__defineGetter__("_selectConversationByIDStatement", function() statement);
    return this._selectConversationByIDStatement; 
  }, 

  getConversationByID: function gloda_ds_getConversationByID(aConversationID) {
    this._selectConversationByIDStatement.params.conversationID =
      aConversationID;
    
    let conversation = null;
    if (this._selectConversationByIDStatement.step()) {
      let row = this._selectConversationByIDStatement.row;
      conversation = new GlodaConversation(this, aConversationID,
        row["subject"], row["oldestMessageDate"], row["newestMessageDate"]);
    }
    this._selectConversationByIDStatement.reset();
    
    return conversation;
  },
  
  /* ********** Message ********** */
  get _insertMessageStatement() {
    let statement = this._createStatement(
      "INSERT INTO messages (folderID, messageKey, conversationID, \
                             headerMessageID, bodySnippet) \
              VALUES (:folderID, :messageKey, :conversationID, \
                      :headerMessageID, :bodySnippet)");
    this.__defineGetter__("_insertMessageStatement", function() statement);
    return this._insertMessageStatement; 
  }, 
  
  createMessage: function gloda_ds_createMessage(aFolderURI, aMessageKey,
                              aConversationID, aHeaderMessageID,
                              aBodySnippet) {
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
    ims.params.headerMessageID = aHeaderMessageID;
    ims.params.bodySnippet = aBodySnippet;

    try {
       ims.execute();
    }
    catch(ex) {
       throw("error executing statement... " +
             this.dbConnection.lastError + ": " +
             this.dbConnection.lastErrorString + " - " + ex);
    }
    //ims.execute();
    
    return new GlodaMessage(this, this.dbConnection.lastInsertRowID, folderID,
                            this._mapFolderID(folderID),
                            aMessageKey, aConversationID, null, aParentID,
                            aHeaderMessageID, aBodySnippet);
  },
  
  get _updateMessageStatement() {
    let statement = this._createStatement(
      "UPDATE messages SET folderID = :folderID, \
                           messageKey = :messageKey, \
                           conversationID = :conversationID, \
                           headerMessageID = :headerMessageID, \
                           bodySnippet = :bodySnippet \
              WHERE id = :id");
    this.__defineGetter__("_updateMessageStatement", function() statement);
    return this._updateMessageStatement; 
  }, 
  
  updateMessage: function gloda_ds_updateMessage(aMessage) {
    let ums = this._updateMessageStatement;
    ums.params.id = aMessage.id;
    ums.params.folderID = aMessage.folderID;
    ums.params.messageKey = aMessage.messageKey;
    ums.params.conversationID = aMessage.conversationID;
    ums.params.headerMessageID = aMessage.headerMessageID;
    ums.params.bodySnippet = aMessage.bodySnippet;
    
    ums.execute();
  },

  get _updateMessageStatement() {
    let statement = this._createStatement(
    this.__defineGetter__("_updateMessageStatement", function() statement);
    return this._updateMessageStatement; 
  }, 

  updateMessageFoldersByKeyPurging:
      function gloda_ds_updateMessageFoldersByKeyPurging(aSrcFolderURI,
        aMessageKeys, aDestFolderURI) {
    let srcFolderID = this._mapFolderURI(aSrcFolderURI);
    let destFolderID = this._mapFolderURI(aDestFolderURI);
    
    let sqlStr = "UPDATE messages SET folderID = :newFolderID, \
                                      messageKey = NULL, \
                   WHERE folderID = :id \
                     AND messageKey IN (" + messageKeys.join(", ") + ")");
    let statement = this._createStatement(sqlStr);
    statement.execute();
  }
  
  _messageFromRow: function gloda_ds_messageFromRow(aRow) {
    return new GlodaMessage(this, aRow["id"], aRow["folderID"],
                            this._mapFolderID(aRow["folderID"]),
                            aRow["messageKey"],
                            aRow["conversationID"], null,
                            aRow["headerMessageID"], aRow["bodySnippet"]);
  },

  get _selectMessageByIDStatement() {
    let statement = this._createStatement(
      "SELECT * FROM messages WHERE id = :id");
    this.__defineGetter__("_selectMessageByIDStatement",
      function() statement);
    return this._selectMessageByIDStatement;
  },

  getMessageByID: function gloda_ds_getMessageByID(aID) {
    let message = null;
  
    let smbis = this._selectMessageByIDStatement;
    
    smbis.params.id = aID;
    if (smbis.step())
      message = this._messageFromRow(smbis.row);
    smbis.reset();
    
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

  getMessageFromLocation: function gloda_ds_getMessageFromLocation(aFolderURI,
                                                                 aMessageKey) {
    this._selectMessageByLocationStatement.params.folderID =
      this._mapFolderURI(aFolderURI);
    this._selectMessageByLocationStatement.params.messageKey = aMessageKey;
    
    let message = null;
    if (this._selectMessageByLocationStatement.step())
      message = this._messageFromRow(this._selectMessageByLocationStatement.row);
    this._selectMessageByLocationStatement.reset();
    
    if (message == null)
      this._log.error("Error locating message with key=" + aMessageKey +
                      " and URI " + aFolderURI);
    
    return message;
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
      smidbfs.push(smidbfs.row["id"]);
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
    let quotedIDs = ["'" + msgID.replace("'", "\\'", "g") + "'" for each
                     (msgID in aMessageIDs)]
    let sqlString = "SELECT * FROM messages WHERE headerMessageID IN (" +
                    quotedIDs + ")";
    let statement = this._createStatement(sqlString);
    
    while (statement.step()) {
      results[msgIDToIndex[statement.row["headerMessageID"]]].push(
        this._messageFromRow(statement.row));
    }
    statement.reset();
    
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
      function gloda_ds_deleteMessagesByConversationID(aConversationID) {
    let dmbcids = this._deleteMessagesByConversationIDStatement;
    dmbcids.params.conversationID = aConversationID;
    dmbcids.execute();
  },
  
  // could probably do with an optimized version of this...
  getMessageByMessageID: function gloda_ds_getMessageByMessageID(aMessageID) {
    var ids = [aMessageID];
    var messages = this.getMessagesByMessageID(ids);
    return messages.pop();
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
  
  insertMessageAttributes: function gloda_ds_insertMessageAttributes(aMessage,
                                        aAttributes) {
    let imas = this._insertMessageAttributeStatement;
    this._beginTransaction();
    try {
      for (let iAttribute=0; iAttribute < aAttributes.length; iAttribute++) {
        let attribValueTuple = aAttributes[iAttribute];
        
        this._log.debug("Inserting attribute tuple: " + attribValueTuple +
                        " is null: " + (attribValueTuple[1] == null));
        
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
      if (APV[2] != null)
        select += " AND value = " + APV[2];
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
     
    return messages;
  },
  
  /* ********** Contact ********** */
  get _insertContactStatement() {
    let statement = this._createStatement(
      "INSERT INTO contacts (directoryUUID, contactUUID, name) \
              VALUES (:directoryUUID, :contactUUID, :name)");
    this.__defineGetter__("_insertContactStatement", function() statement);
    return this._insertContactStatement; 
  },
  
  createContact: function gloda_ds_createContact(aDirectoryUUID, aContactUUID,
                                                 aName) {
    let ics = this._insertContactStatement;
    ics.params.directoryUUID = aDirectoryUUID;
    ics.params.contactUUID = aContactUUID;
    ics.params.name = aName;
    
    ics.execute();
    
    return new GlodaContact(this, this.dbConnection.lastInsertRowID,
                            aDirectoryUUID, aContactUUID, aName);
  },
  
  _contactFromRow: function gloda_ds_contactFromRow(aRow) {
    return new GlodaContact(this, aRow["id"], aRow["directoryUUID"],
                            aRow["contactUUID"], aRow["name"]);
  },
  
  get _selectContactByIDStatement() {
    let statement = this._createStatement(
      "SELECT * FROM contacts WHERE id = :id");
    this.__defineGetter__("_selectContactByIDStatement",
      function() statement);
    return this._selectContactByIDStatement;
  },

  getContactByID: function gloda_ds_getContactByID(aContactID) {
    let contact = null;
  
    let scbi = this._selectContactByIDStatement;
    scbi.params.id = aContactID;
    if (scbi.step()) {
      contact = this._contactFromRow(scbi.row);
    }
    scbi.reset();
    
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
  
    return new GlodaIdentity(this, this.dbConnection.lastInsertRowID,
                             aContactID, aContact, aKind, aValue,
                             aDescription, aIsRelay);
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
    
    return identity;
  },

  get _selectIdentityByIDStatement() {
    let statement = this._createStatement(
      "SELECT * FROM identities WHERE id = :id");
    this.__defineGetter__("_selectIdentityByIDStatement",
      function() statement);
    return this._selectIdentityByIDStatement;
  },

  getIdentityByID: function gloda_ds_getIdentity(aID) {
    let identity = null;
    
    let sibis = this._selectIdentityByIDStatement;
    sibis.params.id = aID;
    if (sibis.step()) {
      identity = this._identityFromRow(sibis.row);
    }
    sibis.reset();
    
    return identity;
  },

};
