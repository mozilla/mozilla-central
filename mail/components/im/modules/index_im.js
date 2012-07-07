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
    //TODO start listening for incremental changes
  },
  disable: function() {
    //TODO stop listening for incremental changes
  },

  _knownFiles: {},
  _cacheSaveTimer: null,
  _scheduleCacheSave: function() {
    if (this._cacheSaveTimer)
      return;
    this._cacheSaveTimer = setTimeout(this._saveCacheNow, 5000);
  },
  _saveCacheNow: function() {
    let data = JSON.stringify(GlodaIMIndexer._knownFiles);
    let file = FileUtils.getFile("ProfD", ["logs", kCacheFileName]);
    let ostream = FileUtils.openSafeFileOutputStream(file);

    // Obtain a converter to convert our data to a UTF-8 encoded input stream.
    let converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Ci.nsIScriptableUnicodeConverter);
    converter.charset = "UTF-8";

    // Asynchronously copy the data to the file.
    let istream = converter.convertToInputStream(data);
    NetUtil.asyncCopy(istream, ostream, function(rc) {
      if (!Components.isSuccessCode(rc)) {
        dump("Failed to write cache file\n");
      }
    });
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
      this._knownFiles = JSON.parse(text);
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
    let cache = aJob.convObj;

    let sessions = folder.directoryEntries;
    while (sessions.hasMoreElements()) {
      let file = sessions.getNext().QueryInterface(Ci.nsIFile);
      let fileName = file.leafName;
      if (!file.isFile() || !file.isReadable() || !/\.json$/.test(fileName))
        continue;
      let lastModifiedTime = file.lastModifiedTime;
      if (Object.prototype.hasOwnProperty.call(cache, fileName) &&
          cache[fileName] == lastModifiedTime) {
        continue;
      }
      let log = Services.logs.getLogFromFile(file);
      let conv = log.getConversation();
      let content = conv.getMessages()
                        .map(function(m) (m.alias || m.who) + ": " + MailFolder.convertMsgSnippetToPlainText(m.message))
                        .join("\n\n");
      let path = [folder.parent.parent.leafName, folder.parent.leafName, folder.leafName, fileName].join("/");
      let glodaConv = new GlodaIMConversation(conv.title, log.time, path, content);
      yield aCallbackHandle.pushAndGo(
        Gloda.grokNounItem(glodaConv, {}, true, true, aCallbackHandle));
      aJob.convObj[fileName] = lastModifiedTime;
      this._scheduleCacheSave();
      yield Gloda.kWorkSync;
    }
    yield Gloda.kWorkDone;
  },

  get workers() {
    return [
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
