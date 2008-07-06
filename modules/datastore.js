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

  _schemaVersion: 2,
  _schema: {
    tables: {
      
      // ----- Messages
      folderLocations: {
        columns: [
          "id INTEGER PRIMARY KEY",
          "folderURI TEXT",
        ],
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
        }
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
          "parentID INTEGER REFERENCES messages(id)",
          "headerMessageID TEXT",
          "bodySnippet TEXT",
        ],
        
        indices: {
          messageLocation: ['folderID', 'messageKey'],
          headerMessageID: ['headerMessageID'],
          conversationID: ['conversationID'],
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
          "kind TEXT",
          "value TEXT",
          "description TEXT"
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
  _beginTransaction: function gloda_ds_beginTransaction() {
    if (this._transactionDepth == 0) {
      this.dbConnection.beginTransaction();
      this._transactionGood = true;
    }
    this._transactionDepth++;
  },
  _commitTransaction: function gloda_ds_commitTransaction() {
    this._transactionDepth--;
    if (this._transactionDepth == 0) {
      if (this._transactionGood)
        this.dbConnection.commitTransaction();
      else
        this.dbConnection.rollbackTransaction();
    }
  },
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
   * Look-up all the attribute definitions 
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
  
  get _selectFolderLocationByURIStatement() {
    let statement = this._createStatement(
      "SELECT id FROM folderLocations WHERE folderURI = :folderURI");
    this.__defineGetter__("_selectFolderLocationByURIStatement",
      function() statement);
    return this._selectFolderLocationByURIStatement;
  },

  // memoizing this is arguably overkill... fix along with _mapFolderID idiom.
  get _selectAllFolderLocations() {
    let statement = this._createStatement(
      "SELECT id, folderURI FROM folderLocations");
    this.__defineGetter__("_selectAllFolderLocations",
      function() statement);
    return this._selectAllFolderLocations;
  },
  
  _folderURIs: {},
  _folderIDs: {},
  
  _mapFolderURI: function gloda_ds_mapFolderURI(aFolderURI) {
    if (aFolderURI in this._folderURIs) {
      return this._folderURIs[aFolderURI];
    }
    
    var folderID;
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
  
  // perhaps a better approach is to just have the _folderIDs load everything
  //  from the database the first time it is accessed, and then rely on
  //  invariant maintenance to ensure that its state keeps up-to-date with the
  //  actual database.
  _mapFolderID: function gloda_ds_mapFolderID(aFolderID) {
    if (aFolderID == null)
      return null;
    if (aFolderID in this._folderIDs)
      return this._folderIDs[aFolderID];
    
    while (this._selectAllFolderLocations.step()) {
      let folderID = this._selectAllFolderLocations.row["id"];
      let folderURI = this._selectAllFolderLocations.row["folderURI"];
      this._log.info("defining mapping:" + folderURI + " to " + folderID);
      this._folderURIs[folderURI] = folderID;
      this._folderIDs[folderID] = folderURI;
    }
    this._selectAllFolderLocations.reset();
    
    if (aFolderID in this._folderIDs)
      return this._folderIDs[aFolderID];
    throw "Got impossible folder ID: " + aFolderID;
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
  
  // memoizing message statement creation
  get _insertMessageStatement() {
    let statement = this._createStatement(
      "INSERT INTO messages (folderID, messageKey, conversationID, parentID, \
                             headerMessageID, bodySnippet) \
              VALUES (:folderID, :messageKey, :conversationID, :parentID, \
                      :headerMessageID, :bodySnippet)");
    this.__defineGetter__("_insertMessageStatement", function() statement);
    return this._insertMessageStatement; 
  }, 
  
  createMessage: function gloda_ds_createMessage(aFolderURI, aMessageKey,
                              aConversationID, aParentID, aHeaderMessageID,
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
    ims.params.parentID = aParentID;
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
                           parentID = :parentID, \
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
    ums.params.parentID = aMessage.parentID;
    ums.params.headerMessageID = aMessage.headerMessageID;
    ums.params.bodySnippet = aMessage.bodySnippet;
    
    ums.execute();
  },
  
  _messageFromRow: function gloda_ds_messageFromRow(aRow) {
    return new GlodaMessage(this, aRow["id"], aRow["folderID"],
                            this._mapFolderID(aRow["folderID"]),
                            aRow["messageKey"],
                            aRow["conversationID"], null,
                            aRow["parentID"],
                            aRow["headerMessageID"], aRow["bodySnippet"]);
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
  
  getMessagesByMessageID: function gloda_ds_getMessagesByMessageID(aMessageIDs) {
    let msgIDToIndex = {};
    let results = [];
    for (let iID=0; iID < aMessageIDs.length; ++iID) {
      let msgID = aMessageIDs[iID];
      results.push(null);
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
      results[msgIDToIndex[statement.row["headerMessageID"]]] =
        this._messageFromRow(statement.row);
    }
    statement.reset();
    
    return results;
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
      this._log.debug("Loading attribute: " + attribAndParam[0].id + " param: "+
                      attribAndParam[1] + " val: " + val);
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
    
    return scbi;
  },
  
  /* ********** Identity ********** */
  get _insertIdentityStatement() {
    let statement = this._createStatement(
      "INSERT INTO identities (contactID, kind, value, description) \
              VALUES (:contactID, :kind, :value, :description)");
    this.__defineGetter__("_insertIdentityStatement", function() statement);
    return this._insertIdentityStatement; 
  },
  
  createIdentity: function gloda_ds_createIdentity(aContactID, aContact, aKind,
                                                   aValue, aDescription) {
    let iis = this._insertIdentityStatement;
    iis.params.contactID = aContactID;
    iis.params.kind = aKind;
    iis.params.value = aValue;
    iis.params.description = aDescription;
    iis.execute();
  
    return new GlodaIdentity(this, this.dbConnection.lastInsertRowID,
                             aContactID, aContact, aKind, aValue, aDescription);
  },
  
  _identityFromRow: function gloda_ds_identityFromRow(aRow) {
    return new GlodaIdentity(this, aRow["id"], aRow["contactID"], null,
                             aRow["kind"], aRow["value"]);
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
};
