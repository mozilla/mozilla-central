EXPORTED_SYMBOLS = ["GlodaDatastore"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gloda/modules/datamodel.js");

let GlodaDatastore = {
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
          folderID: ['folderID'],
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
  
  _folderURIs: {},
  
  _mapFolderURI: function glodaDBMapFolderURI(aFolderURI) {
    if (aFolderURI in this._folderURIs) {
      return this._folderURIs[aFolderURI];
    }
    
    var result;
    this._selectFolderLocationByURIStatement.params.folderURI = aFolderURI;
    if (this._selectFolderLocationByURIStatement.step()) {
      result = this._selectFolderLocationByURIStatement.folderURI;
    }
    else {
      this._insertFolderLocationStatement.params.folderURI = aFolderURI;
      this._insertFolderLocationStatement.execute();
      result = this.dbConnection.lastInsertRowID;
    }
    this._selectFolderLocationByURIStatement.reset();

    this._folderURIs[aFolderURI] = result;
    return result;
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
    
    return new GlodaConversation(this.dbConnection.lastInsertRowID,
                                 aSubject, aOldestMessageDate,
                                 aNewestMessageDate);
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
    if (folderID != null)
      ims.params.folderID = folderID;
    if (aMessageKey != null)
      ims.params.messageKey = aMessageKey;
    ims.params.conversationID = aConversationID;
    if (aParentID != null)
      ims.params.parentID = aParentID;
    ims.params.headerMessageID = aHeaderMessageID;
    if (aBodySnippet != null)
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
    
    return new GlodaMessage(this.dbConnection.lastInsertRowID, folderID,
                            aMessageKey, aConversationID, aParentID,
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
    return new GlodaMessage(aRow["id"], aRow["folderID"], aRow["messageKey"],
                            aRow["conversationID"], aRow["parentID"],
                            aRow["headerMessageID"], aRow["bodySnippet"]);
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
  
};

GlodaDatastore._init();