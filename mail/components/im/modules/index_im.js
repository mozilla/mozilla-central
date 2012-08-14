/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const EXPORTED_SYMBOLS = [];

const {classes: Cc, interfaces: Ci, utils: Cu, Constructor: CC} = Components;

Cu.import("resource:///modules/imXPCOMUtils.jsm");
Cu.import("resource:///modules/iteratorUtils.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource:///modules/gloda/public.js");
Cu.import("resource:///modules/gloda/datamodel.js");
Cu.import("resource:///modules/gloda/indexer.js");
Cu.import("resource:///modules/imServices.jsm");

const kCacheFileName = "indexedFiles.json";

const FileInputStream = CC("@mozilla.org/network/file-input-stream;1",
                           "nsIFileInputStream",
                           "init");
const ScriptableInputStream = CC("@mozilla.org/scriptableinputstream;1",
                                 "nsIScriptableInputStream",
                                 "init");

// kIndexingDelay is how long we wait from the point of scheduling an indexing
// job to actually carrying it out.
const kIndexingDelay = 5000; // in milliseconds

XPCOMUtils.defineLazyGetter(this, "MailFolder", function()
  Cc["@mozilla.org/rdf/resource-factory;1?name=mailbox"].createInstance(Ci.nsIMsgFolder)
);

var gIMAccounts = {};

function GlodaIMConversation(aTitle, aTime, aPath, aContent)
{
  // grokNounItem from gloda.js puts automatically the values of all
  // JS properties in the jsonAttributes magic attribute, except if
  // they start with _, so we put the values in _-prefixed properties,
  // and have getters in the prototype.
  this._title = aTitle;
  this._time = aTime;
  this._path = aPath;
  this._content = aContent;
}
GlodaIMConversation.prototype = {
  get title() this._title,
  get time() this._time,
  get path() this._path,
  get content() this._content,

  // for glodaFacetBindings.xml compatibility (pretend we are a message object)
  get account() {
    let [protocol, username] = this._path.split("/", 2);

    let cacheName = protocol + "/" + username;
    if (cacheName in gIMAccounts)
      return gIMAccounts[cacheName];

    // Find the nsIIncomingServer for the current imIAccount.
    let mgr = Components.classes["@mozilla.org/messenger/account-manager;1"]
                        .getService(Ci.nsIMsgAccountManager);
    for each (let account in fixIterator(mgr.accounts, Ci.nsIMsgAccount)) {
      let incomingServer = account.incomingServer;
      if (!incomingServer || incomingServer.type != "im")
        continue;
      let imAccount = incomingServer.wrappedJSObject.imAccount;
      if (imAccount.protocol.normalizedName == protocol &&
          imAccount.normalizedName == username)
        return (gIMAccounts[cacheName] = new GlodaAccount(incomingServer));
    }
    // The IM conversation is probably for an account that no longer exists.
    return null;
  },
  get subject() this._title,
  get date() new Date(this._time * 1000),
  get involves() Gloda.IGNORE_FACET,
  _recipients: null,
  get recipients() {
    if (!this._recipients)
      this._recipients = [{contact: {name: this._path.split("/", 2)[1]}}];
    return this._recipients;
  },
  _from: null,
  get from() {
    if (!this._from) {
      let from = "";
      let account = this.account;
      if (account)
        from = account.incomingServer.wrappedJSObject.imAccount.protocol.name;
      this._from = {value: "", contact: {name: from}};
    }
    return this._from;
  },
  get tags() [],
  get starred() false,
  get attachmentNames() null,
  get indexedBodyText() this._content,
  get read() true,
  get folder() Gloda.IGNORE_FACET,

  // for glodaFacetView.js _removeDupes
  get headerMessageID() this.id
};

// FIXME
var WidgetProvider = {
  providerName: "widget",
  process: function () {
    //XXX What is this supposed to do?
    yield Gloda.kWorkDone;
  }
};

var IMConversationNoun = {
  name: "im-conversation",
  clazz: GlodaIMConversation,
  allowsArbitraryAttrs: true,
  tableName: "imConversations",
  schema: {
    columns: [['id', 'INTEGER PRIMARY KEY'],
              ['title', 'STRING'],
              ['time', 'NUMBER'],
              ['path', 'STRING']
             ],
    fulltextColumns: [['content', 'STRING']]
  }
};
Gloda.defineNoun(IMConversationNoun);

// Needs to be set after calling defineNoun, otherwise it's replaced
// by databind.js' implementation.
IMConversationNoun.objFromRow = function(aRow) {
  // Row columns are:
  // 0 id
  // 1 title
  // 2 time
  // 3 path
  // 4 jsonAttributes
  // 5 content
  // 6 offsets
  let conv = new GlodaIMConversation(aRow.getString(1), aRow.getInt64(2),
                                     aRow.getString(3), aRow.getString(5));
  conv.id = aRow.getInt64(0); // handleResult will keep only our first result
                              // if the id property isn't set.
  return conv;
};

const EXT_NAME = "im";

// --- special (on-row) attributes
Gloda.defineAttribute({
  provider: WidgetProvider, extensionName: EXT_NAME,
  attributeType: Gloda.kAttrFundamental,
  attributeName: "time",
  singular: true,
  special: Gloda.kSpecialColumn,
  specialColumnName: "time",
  subjectNouns: [IMConversationNoun.id],
  objectNoun: Gloda.NOUN_NUMBER,
  canQuery: true
});
Gloda.defineAttribute({
  provider: WidgetProvider, extensionName: EXT_NAME,
  attributeType: Gloda.kAttrFundamental,
  attributeName: "title",
  singular: true,
  special: Gloda.kSpecialString,
  specialColumnName: "title",
  subjectNouns: [IMConversationNoun.id],
  objectNoun: Gloda.NOUN_STRING,
  canQuery: true
});
Gloda.defineAttribute({
  provider: WidgetProvider, extensionName: EXT_NAME,
  attributeType: Gloda.kAttrFundamental,
  attributeName: "path",
  singular: true,
  special: Gloda.kSpecialString,
  specialColumnName: "path",
  subjectNouns: [IMConversationNoun.id],
  objectNoun: Gloda.NOUN_STRING,
  canQuery: true
});

// --- fulltext attributes
Gloda.defineAttribute({
  provider: WidgetProvider, extensionName: EXT_NAME,
  attributeType: Gloda.kAttrFundamental,
  attributeName: "content",
  singular: true,
  special: Gloda.kSpecialFulltext,
  specialColumnName: "content",
  subjectNouns: [IMConversationNoun.id],
  objectNoun: Gloda.NOUN_FULLTEXT,
  canQuery: true
});

// -- fulltext search helper
// fulltextMatches.  Match over message subject, body, and attachments
// @testpoint gloda.noun.message.attr.fulltextMatches
this._attrFulltext = Gloda.defineAttribute({
  provider: WidgetProvider,
  extensionName: EXT_NAME,
  attributeType: Gloda.kAttrDerived,
  attributeName: "fulltextMatches",
  singular: true,
  special: Gloda.kSpecialFulltext,
  specialColumnName: "imConversationsText",
  subjectNouns: [IMConversationNoun.id],
  objectNoun: Gloda.NOUN_FULLTEXT
});
// For facet.js DateFaceter
Gloda.defineAttribute({
  provider: WidgetProvider, extensionName: EXT_NAME,
  attributeType: Gloda.kAttrDerived,
  attributeName: "date",
  singular: true,
  special: Gloda.kSpecialColumn,
  subjectNouns: [IMConversationNoun.id],
  objectNoun: Gloda.NOUN_NUMBER,
  facet: {
    type: "date"
  },
  canQuery: true
});

var GlodaIMIndexer = {
  name: "index_im",
  enable: function() {
    Services.obs.addObserver(this, "new-text", false);
    Services.obs.addObserver(this, "conversation-closed", false);
    Services.obs.addObserver(this, "new-ui-conversation", false);
    Services.obs.addObserver(this, "ui-conversation-closed", false);
  },
  disable: function() {
    Services.obs.removeObserver(this, "new-text");
    Services.obs.removeObserver(this, "conversation-closed");
    Services.obs.removeObserver(this, "new-ui-conversation");
    Services.obs.removeObserver(this, "ui-conversation-closed");
  },

  _knownFiles: {},
  _cacheSaveTimer: null,
  _scheduleCacheSave: function() {
    if (this._cacheSaveTimer)
      return;
    this._cacheSaveTimer = setTimeout(this._saveCacheNow, 5000);
  },
  _saveCacheNow: function() {
    let data = {
      knownFiles: GlodaIMIndexer._knownFiles,
      datastoreID: Gloda.datastoreID,
    };

    let file = FileUtils.getFile("ProfD", ["logs", kCacheFileName]);
    let ostream = FileUtils.openSafeFileOutputStream(file);

    // Obtain a converter to convert our data to a UTF-8 encoded input stream.
    let converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Ci.nsIScriptableUnicodeConverter);
    converter.charset = "UTF-8";

    // Asynchronously copy the data to the file.
    let istream = converter.convertToInputStream(JSON.stringify(data));
    NetUtil.asyncCopy(istream, ostream, function(rc) {
      if (!Components.isSuccessCode(rc)) {
        Cu.reportError("Failed to write cache file");
      }
    });
  },

  _knownConversations: {},

  _scheduleIndexingJob: function(aConversation) {
    let convId = aConversation.id;

    // If we've already scheduled this conversation to be indexed, let's
    // not repeat.
    if (!(convId in this._knownConversations)) {
      this._knownConversations[convId] = {
        scheduledIndex: null,
        logFile: null,
        convObj: {}
      };
    }

    if (this._knownConversations[convId].scheduledIndex == null) {
      // Ok, let's schedule the job.
      this._knownConversations[convId].scheduledIndex = setTimeout(
        this._beginIndexingJob.bind(this, aConversation),
        kIndexingDelay);
    }
  },

  _beginIndexingJob: function(aConversation) {
    let convId = aConversation.id;

    // In the event that we're triggering this indexing job manually, without
    // bothering to schedule it (for example, when a conversation is closed),
    // we give the conversation an entry in _knownConversations, which would
    // normally have been done in _scheduleIndexingJob.
    if (!(convId in this._knownConversations))
      this._knownConversations[convId] = {};

    if (!this._knownConversations[convId].logFile) {
      let logFile = Services.logs.getLogFileForOngoingConversation(aConversation);
      let folder = logFile.parent;
      let convName = folder.leafName;
      folder = folder.parent;
      let accountName = folder.leafName;
      folder = folder.parent;
      let protoName = folder.leafName;
      if (!Object.prototype.hasOwnProperty.call(this._knownFiles, protoName))
        this._knownFiles[protoName] = {};
      let protoObj = this._knownFiles[protoName];
      if (!Object.prototype.hasOwnProperty.call(protoObj, accountName))
        protoObj[accountName] = {};
      let accountObj = protoObj[accountName];
      if (!Object.prototype.hasOwnProperty.call(accountObj, convName))
        accountObj[convName] = {};

      this._knownConversations[convId].logFile = logFile;
      this._knownConversations[convId].convObj = accountObj[convName];
    }

    let job = new IndexingJob("indexIMConversation", null);
    job.conversation = this._knownConversations[convId];
    GlodaIndexer.indexJob(job);
    // Now clear the job, so we can index in the future.
    this._knownConversations[convId].scheduledIndex = null;
  },

  observe: function logger_observe(aSubject, aTopic, aData) {
    if (aTopic == "new-ui-conversation") {
      // Add ourselves to the ui-conversation's list of observers for the
      // unread-message-count-changed notification.
      // For this notification, aSubject is the ui-conversation that is opened.
      aSubject.addObserver(this);
      return;
    }

    if (aTopic == "ui-conversation-closed") {
      aSubject.removeObserver(this);
    }

    if (aTopic == "unread-message-count-changed") {
      // We get this notification by attaching observers to conversations
      // directly (see the new-ui-conversation handler for when we attach).
      if (aSubject.unreadIncomingMessageCount == 0) {
        // The unread message count changed to 0, meaning that a conversation
        // that had been in the background and receiving messages was suddenly
        // moved to the foreground and displayed to the user. We schedule an
        // indexing job on this conversation now, since we want to index messages
        // that the user has seen.
        this._scheduleIndexingJob(aSubject.target);
      }
      return;
    }

    if (aTopic == "conversation-closed") {
      let convId = aSubject.id;
      // If there's a scheduled indexing job, cancel it, because we're going
      // to index now.
      if (convId in this._knownConversations &&
          this._knownConversations[convId].scheduledIndex != null) {
        clearTimeout(this._knownConversations[convId].scheduledIndex);
      }

      this._beginIndexingJob(aSubject);
      delete this._knownConversations[convId];
      return;
    }

    if (aTopic == "new-text" && !aSubject.noLog) {
      // Ok, some new text is about to be put into a conversation. For this
      // notification, aSubject is a prplIMessage.
      let conv = aSubject.conversation;
      let uiConv = Services.conversations.getUIConversation(conv);

      // We only want to schedule an indexing job if this message is
      // immediately visible to the user. We figure this out by finding
      // the unread message count on the associated UIConversation for this
      // message. If the unread count is 0, we know that the message has been
      // displayed to the user.
      if (uiConv.unreadIncomingMessageCount == 0)
        this._scheduleIndexingJob(conv);

      return;
    }
  },

  /* aGlodaConv is an optional inout param that lets the caller save and reuse
   * the GlodaIMConversation instance created when the conversation is indexed
   * the first time. After a conversation is indexed for the first time,
   * the GlodaIMConversation instance has its id property set to the row id of
   * the conversation in the database. This id is required to later update the
   * conversation in the database, so the caller dealing with ongoing
   * conversation has to provide the aGlodaConv parameter, while the caller
   * dealing with old conversations doesn't care. */
  indexIMConversation: function(aCallbackHandle, aFile, aCache, aGlodaConv) {
    let fileName = aFile.leafName;
    let lastModifiedTime = aFile.lastModifiedTime;
    let isNew = true;
    if (Object.prototype.hasOwnProperty.call(aCache, fileName)) {
      if (aCache[fileName] == lastModifiedTime)
        return Gloda.kWorkSync;
      else
        isNew = false;
    }

    let log = Services.logs.getLogFromFile(aFile);
    let conv = log.getConversation();
    // Ignore corrupted log files.
    if (!conv)
      return Gloda.kWorkDone;

    let content = conv.getMessages()
                      .map(function(m) (m.alias || m.who) + ": " + MailFolder.convertMsgSnippetToPlainText(m.message))
                      .join("\n\n");
    let folder = aFile.parent;
    let path = [folder.parent.parent.leafName, folder.parent.leafName, folder.leafName, fileName].join("/");
    let glodaConv;
    if (aGlodaConv && aGlodaConv.value) {
      glodaConv = aGlodaConv.value;
      glodaConv._content = content;
    }
    else {
      glodaConv = new GlodaIMConversation(conv.title, log.time, path, content);
      if (aGlodaConv)
        aGlodaConv.value = glodaConv;
    }
    let rv = aCallbackHandle.pushAndGo(
      Gloda.grokNounItem(glodaConv, {}, true, isNew, aCallbackHandle));
    aCache[fileName] = lastModifiedTime;
    this._scheduleCacheSave();
    return rv;
  },

  _worker_indexIMConversation: function(aJob, aCallbackHandle) {
    let glodaConv = {};
    if (aJob.conversation.glodaConv)
      glodaConv.value = aJob.conversation.glodaConv;
    // indexIMConversation may initiate an async grokNounItem sub-job.
    yield this.indexIMConversation(aCallbackHandle, aJob.conversation.logFile,
                                   aJob.conversation.convObj, glodaConv);
    aJob.conversation.indexPending = false;
    aJob.conversation.glodaConv = glodaConv.value;

    yield Gloda.kWorkDone;
  },

  _worker_logsFolderSweep: function(aJob) {
    let dir = FileUtils.getFile("ProfD", ["logs"]);
    if (!dir.exists() || !dir.isDirectory())
      return;

    let cacheFile = dir.clone();
    cacheFile.append(kCacheFileName);
    if (cacheFile.exists()) {
      const PR_RDONLY = 0x01;
      let fis = new FileInputStream(cacheFile, PR_RDONLY, parseInt("0444", 8),
                                    Ci.nsIFileInputStream.CLOSE_ON_EOF);
      let sis = new ScriptableInputStream(fis);
      let text = sis.read(sis.available());
      sis.close();

      let data = JSON.parse(text);

      // Check to see if the Gloda datastore ID matches the one that we saved
      // in the cache. If so, we can trust it. If not, that means that the
      // cache is likely invalid now, so we ignore it (and eventually
      // overwrite it).
      if ("datastoreID" in data &&
          Gloda.datastoreID &&
          data.datastoreID === Gloda.datastoreID) {
        // Ok, the cache's datastoreID matches the one we expected, so it's
        // still valid.
        this._knownFiles = data.knownFiles;
      }
    }

    let children = dir.directoryEntries;
    while (children.hasMoreElements()) {
      let proto = children.getNext().QueryInterface(Ci.nsIFile);
      if (!proto.isDirectory())
        continue;
      let protoName = proto.leafName;
      if (!Object.prototype.hasOwnProperty.call(this._knownFiles, protoName))
        this._knownFiles[protoName] = {};
      let protoObj = this._knownFiles[protoName];
      let accounts = proto.directoryEntries;
      while (accounts.hasMoreElements()) {
        let account = accounts.getNext().QueryInterface(Ci.nsIFile);
        if (!account.isDirectory())
          continue;
        let accountName = account.leafName;
        if (!Object.prototype.hasOwnProperty.call(protoObj, accountName))
          protoObj[accountName] = {};
        let accountObj = protoObj[accountName];
        let convs = account.directoryEntries;
        while (convs.hasMoreElements()) {
          let conv = convs.getNext().QueryInterface(Ci.nsIFile);
          let convName = conv.leafName;
          if (!conv.isDirectory() || convName == ".system")
            continue;
          if (!Object.prototype.hasOwnProperty.call(accountObj, convName))
            accountObj[convName] = {};
          let job = new IndexingJob("convFolderSweep", null);
          job.folder = conv;
          job.convObj = accountObj[convName];
          GlodaIndexer.indexJob(job);
        }
      }
    }
  },

  _worker_convFolderSweep: function(aJob, aCallbackHandle) {
    let folder = aJob.folder;

    let sessions = folder.directoryEntries;
    while (sessions.hasMoreElements()) {
      let file = sessions.getNext().QueryInterface(Ci.nsIFile);
      let fileName = file.leafName;
      if (!file.isFile() || !file.isReadable() || !/\.json$/.test(fileName))
        continue;
      // indexIMConversation may initiate an async grokNounItem sub-job.
      yield this.indexIMConversation(aCallbackHandle, file, aJob.convObj);
    }
    yield Gloda.kWorkDone;
  },

  get workers() {
    return [
      ["indexIMConversation", {
         worker: this._worker_indexIMConversation
       }],
      ["logsFolderSweep", {
         worker: this._worker_logsFolderSweep
       }],
      ["convFolderSweep", {
         worker: this._worker_convFolderSweep
       }]
    ];
  },

  initialSweep: function() {
    let job = new IndexingJob("logsFolderSweep", null);
    GlodaIndexer.indexJob(job);
  }
};

GlodaIndexer.registerIndexer(GlodaIMIndexer);
