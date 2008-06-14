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
 
 EXPORTED_SYMBOLS = ["GlodaDatastore"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gloda/modules/log4moz.js");

Cu.import("resource://gloda/modules/datamodel.js");

let GlodaDatastore = {
  _log: null,

  _schemaVersion: 1,
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
          "attributeType TEXT",
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
    },
  },
  
  _init: function glodaDBInit() {
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
      try {
        dbConnection = dbService.openDatabase(dbFile);
      
        if (dbConnection.schemaVersion != this._schemaVersion) {
          this._migrate(dbConnection,
                        dbConnection.schemaVersion, this._schemaVersion);
        }
      }
      // Handle corrupt databases, other oddities
      catch (ex) {
        // TODO: handle them in the future.  let's die for now.
        throw ex;
      }
    }
    
    this.dbConnection = dbConnection;
  },
  
  _createDB: function glodaDBCreateDB(aDBService, aDBFile) {
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
  
  _createSchema: function glodaDBCreateSchema(aDBConnection) {
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
  
  _migrate: function glodaDBMigrate(aDBConnection, aCurVersion, aNewVersion) {
  },
  
  // cribbed from snowl
  _createStatement: function glodaDBCreateStatement(aSQLString) {
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
  
  _mapFolderURI: function glodaDBMapFolderURI(aFolderURI) {
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
  _mapFolderID: function glodaDBMapFolderID(aFolderID) {
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
  
  // memoizing message statement creation
  get _insertConversationStatement() {
    let statement = this._createStatement(
      "INSERT INTO conversations (subject, oldestMessageDate, \
                                  newestMessageDate) \
              VALUES (:subject, :oldestMessageDate, :newestMessageDate)");
    this.__defineGetter__("_insertConversationStatement", function() statement);
    return this._insertConversationStatement; 
  }, 
  
  createConversation: function glodaDBCreateConversation(aSubject,
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

  getConversationByID: function glodaDBGetConversationByID(aConversationID) {
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
  
  createMessage: function glodaDBCreateMessage(aFolderURI, aMessageKey,
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
                           bodySnippet = :boddySnippet \
              WHERE id = :id");
    this.__defineGetter__("_updateMessageStatement", function() statement);
    return this._insertMessageStatement; 
  }, 
  
  updateMessage: function glodaDBUpdateMessage(aMessage) {
    let folderID = this._mapFolderURI(aFolderURI);
    
    let ums = this._updateMessageStatement;
    ums.params.id = aMessage.id
    ums.params.folderID = aMessage.folderID
    ums.params.messageKey = aMessage.messageKey;
    ums.params.conversationID = aMessage.conversationID;
    ums.params.parentID = aMessage.parentID;
    ums.params.headerMessageID = aMessage.headerMessageID;
    ums.params.bodySnippet = aMessage.bodySnippet;
    
    ums.execute();
  },
  
  _messageFromRow: function glodaDBMessageFromRow(aRow) {
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

  getMessageFromLocation: function glodaDBGetMessageFromLocation(aFolderURI,
                                                                 aMessageKey) {
    this._selectMessageByLocationStatement.params.folderID =
      this._mapFolderURI(aFolderURI);
    this._selectMessageByLocationStatement.params.messageKey = aMessageKey;
    
    let message = null;
    if (this._selectMessageByLocationStatement.step())
      message = this._messageFromRow(this._selectMessageByLocationStatement.row);
    this._selectMessageByLocationStatement.reset();
    
    return message;
  },
  
  getMessagesByMessageID: function glodaDBGetMessagesByMessageID(aMessageIDs) {
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

  get _selectMessagesByConversationIDStatement() {
    let statement = this._createStatement(
      "SELECT * FROM messages WHERE conversationID = :conversationID");
    this.__defineGetter__("_selectMessagesByConversationIDStatement",
      function() statement);
    return this._selectMessagesByConversationIDStatement;
  },

  getMessagesByConversationID: function glodaDBGetMessagesByConversationID(
        aConversationID) {
    let statement = this._selectMessagesByConversationIDStatement;
    statement.params.conversationID = aConversationID; 
    
    let messages = [];
    while (statement.step()) {
      messages.push(this._messageFromRow(statement.row));
    }
    statement.reset();
    
    return messages;
  },
};
