/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {classes: Cc, interfaces: Ci, utils: Cu, Constructor: CC} = Components;

Cu.import("resource:///modules/hiddenWindow.jsm");
Cu.import("resource:///modules/imServices.jsm");
Cu.import("resource:///modules/imXPCOMUtils.jsm");
Cu.import("resource:///modules/jsProtoHelper.jsm");

XPCOMUtils.defineLazyGetter(this, "logDir", function() {
  let file = Services.dirsvc.get("ProfD", Ci.nsIFile);
  file.append("logs");
  return file;
});

const FileInputStream = CC("@mozilla.org/network/file-input-stream;1",
                           "nsIFileInputStream",
                           "init");
const ConverterInputStream = CC("@mozilla.org/intl/converter-input-stream;1",
                                "nsIConverterInputStream",
                                "init");
const LocalFile = CC("@mozilla.org/file/local;1",
                     "nsILocalFile",
                     "initWithPath");

const kLineBreak = "@mozilla.org/windows-registry-key;1" in Cc ? "\r\n" : "\n";

function getLogFolderForAccount(aAccount, aCreate)
{
  let file = logDir.clone();
  function createIfNotExists(aFile) {
    if (aCreate && !aFile.exists())
      aFile.create(Ci.nsIFile.DIRECTORY_TYPE, 0777);
  }
  createIfNotExists(file);
  file.append(aAccount.protocol.normalizedName);
  createIfNotExists(file);
  file.append(aAccount.normalizedName);
  createIfNotExists(file);
  return file;
}

function getNewLogFileName(aFormat)
{
  let date = new Date();
  let dateTime = date.toLocaleFormat("%Y-%m-%d.%H%M%S");
  let offset = date.getTimezoneOffset();
  if (offset < 0) {
    dateTime += "+";
    offset *= -1;
  }
  else
    dateTime += "-";
  let minutes = offset % 60;
  offset = (offset - minutes) / 60;
  function twoDigits(aNumber)
    aNumber == 0 ? "00" : aNumber < 10 ? "0" + aNumber : aNumber;
  if (!aFormat)
    aFormat = "txt";
  return dateTime + twoDigits(offset) + twoDigits(minutes) + "." + aFormat;
}

/* Conversation logs stuff */
function ConversationLog(aConversation)
{
  this._conv = aConversation;
}
ConversationLog.prototype = {
  _log: null,
  format: "txt",
  _init: function cl_init() {
    let file = getLogFolderForAccount(this._conv.account, true);
    let name = this._conv.normalizedName;
    if (this._conv.isChat && this._conv.account.protocol.id != "prpl-twitter")
      name += ".chat";
    file.append(name);
    if (!file.exists())
      file.create(Ci.nsIFile.DIRECTORY_TYPE, 0777);
    if (Services.prefs.getCharPref("purple.logging.format") == "json")
      this.format = "json";
    file.append(getNewLogFileName(this.format));
    let os = Cc["@mozilla.org/network/file-output-stream;1"].
             createInstance(Ci.nsIFileOutputStream);
    const PR_WRITE_ONLY   = 0x02;
    const PR_CREATE_FILE  = 0x08;
    const PR_APPEND       = 0x10;
    os.init(file, PR_WRITE_ONLY | PR_CREATE_FILE | PR_APPEND, 0666, 0);
    // just to be really sure everything is in UTF8
    let converter = Cc["@mozilla.org/intl/converter-output-stream;1"].
                    createInstance(Ci.nsIConverterOutputStream);
    converter.init(os, "UTF-8", 0, 0);
    this._log = converter;
    this._log.writeString(this._getHeader());
  },
  _getHeader: function cl_getHeader()
  {
    let account = this._conv.account;
    if (this.format == "json") {
      return JSON.stringify({date: new Date(),
                             name: this._conv.name,
                             title: this._conv.title,
                             account: account.normalizedName,
                             protocol: account.protocol.normalizedName
                            }) + "\n";
    }
    return "Conversation with " + this._conv.name +
           " at " + (new Date).toLocaleString() +
           " on " + account.name +
           " (" + account.protocol.normalizedName + ")" + kLineBreak;
  },
  _serialize: function cl_serialize(aString) {
    // TODO cleanup once bug 102699 is fixed
    let doc = getHiddenHTMLWindow().document;
    let div = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
    div.innerHTML = aString.replace(/\r?\n/g, "<br/>").replace(/<br>/gi, "<br/>");
    const type = "text/plain";
    let encoder =
      Components.classes["@mozilla.org/layout/documentEncoder;1?type=" + type]
                .createInstance(Components.interfaces.nsIDocumentEncoder);
    encoder.init(doc, type, 0);
    encoder.setContainerNode(div);
    encoder.setNodeFixup({fixupNode: function(aNode, aSerializeKids) {
      if (aNode.localName == "a" && aNode.hasAttribute("href")) {
        let url = aNode.getAttribute("href");
        let content = aNode.textContent;
        if (url != content)
          aNode.textContent = content + " (" + url + ")";
      }
      return null;
    }});
    return encoder.encodeToString();
  },
  logMessage: function cl_logMessage(aMessage) {
    if (!this._log)
      this._init();

    if (this.format == "json") {
      let msg = {
        date: new Date(aMessage.time * 1000),
        who: aMessage.who,
        text: aMessage.originalMessage,
        flags: ["outgoing", "incoming", "system", "autoResponse",
                "containsNick", "error", "delayed",
                "noFormat", "containsImages", "notification",
                "noLinkification"].filter(function(f) aMessage[f])
      };
      let alias = aMessage.alias;
      if (alias && alias != msg.who)
        msg.alias = alias;
      this._log.writeString(JSON.stringify(msg) + "\n");
      return;
    }

    let date = new Date(aMessage.time * 1000);
    let line = "(" + date.toLocaleTimeString() + ") ";
    let msg = this._serialize(aMessage.originalMessage);
    if (aMessage.system)
      line += msg;
    else {
      let sender = aMessage.alias || aMessage.who;
      if (aMessage.autoResponse)
        line += sender + " <AUTO-REPLY>: " + msg;
      else {
        if (/^\/me /.test(msg))
          line += "***" + sender + " " + msg.replace(/^\/me /, "");
        else
          line += sender + ": " + msg;
      }
    }
    this._log.writeString(line + kLineBreak);
  },

  close: function cl_close() {
    if (this._log) {
      this._log.close();
      this._log = null;
    }
  }
};

const dummyConversationLog = {
  logMessage: function() {},
  close: function() {}
};

var gConversationLogs = { };
function getLogForConversation(aConversation)
{
  let id = aConversation.id;
  if (!(id in gConversationLogs)) {
    let prefName =
      "purple.logging.log_" + (aConversation.isChat ? "chats" : "ims");
    if (Services.prefs.getBoolPref(prefName))
      gConversationLogs[id] = new ConversationLog(aConversation);
    else
      gConversationLogs[id] = dummyConversationLog;
  }
  return gConversationLogs[id];
}

function closeLogForConversation(aConversation)
{
  let id = aConversation.id;
  if (!(id in gConversationLogs))
    return;
  gConversationLogs[id].close();
  delete gConversationLogs[id];
}

/* System logs stuff */
function SystemLog(aAccount)
{
  this._init(aAccount);
  this._log.writeString("System log for account " + aAccount.name +
                        " (" + aAccount.protocol.normalizedName +
                        ") connected at " +
                        (new Date()).toLocaleFormat("%c") + kLineBreak);
}
SystemLog.prototype = {
  _log: null,
  _init: function sl_init(aAccount) {
    let file = getLogFolderForAccount(aAccount, true);
    file.append(".system");
    if (!file.exists())
      file.create(Ci.nsIFile.DIRECTORY_TYPE, 0777);
    file.append(getNewLogFileName());
    let os = Cc["@mozilla.org/network/file-output-stream;1"].
             createInstance(Ci.nsIFileOutputStream);
    const PR_WRITE_ONLY   = 0x02;
    const PR_CREATE_FILE  = 0x08;
    const PR_APPEND       = 0x10;
    os.init(file, PR_WRITE_ONLY | PR_CREATE_FILE | PR_APPEND, 0666, 0);
    // just to be really sure everything is in UTF8
    let converter = Cc["@mozilla.org/intl/converter-output-stream;1"].
                    createInstance(Ci.nsIConverterOutputStream);
    converter.init(os, "UTF-8", 0, 0);
    this._log = converter;
  },
  logEvent: function sl_logEvent(aString) {
    if (!this._log)
      this._init();

    let date = (new Date()).toLocaleFormat("%x %X");
    this._log.writeString("---- " + aString + " @ " + date + " ----" + kLineBreak);
  },

  close: function sl_close() {
    if (this._log) {
      this._log.close();
      this._log = null;
    }
  }
};

const dummySystemLog = {
  logEvent: function(aString) {},
  close: function() {}
};

var gSystemLogs = { };
function getLogForAccount(aAccount, aCreate)
{
  let id = aAccount.id;
  if (aCreate) {
    if (id in gSystemLogs)
      gSystemLogs[id].close();
    if (!Services.prefs.getBoolPref("purple.logging.log_system"))
      return dummySystemLog;
    return (gSystemLogs[id] = new SystemLog(aAccount));
  }

  return (id in gSystemLogs) && gSystemLogs[id] || dummySystemLog;
}

function closeLogForAccount(aAccount)
{
  let id = aAccount.id;
  if (!(id in gSystemLogs))
    return;
  gSystemLogs[id].close();
  delete gSystemLogs[id];
}

function LogMessage(aData, aConversation)
{
  this._init(aData.who, aData.text);
  this._conversation = aConversation;
  this.time = Math.round(new Date(aData.date) / 1000);
  if ("alias" in aData)
    this._alias = aData.alias;
  for each (let flag in aData.flags)
    this[flag] = true;
}
LogMessage.prototype = GenericMessagePrototype;

function LogConversation(aLineInputStream)
{
  let line = {value: ""};
  let more = aLineInputStream.readLine(line);

  if (!line.value)
    throw "bad log file";

  let data = JSON.parse(line.value);
  this.name = data.name;
  this.title = data.title;
  this._accountName = data.account;
  this._protocolName = data.protocol;

  this._messages = [];
  while (more) {
    more = aLineInputStream.readLine(line);
    if (!line.value)
      break;
    let data = JSON.parse(line.value);
    this._messages.push(new LogMessage(data, this));
  }
}
LogConversation.prototype = {
  __proto__: ClassInfo("imILogConversation", "Log conversation object"),
  get isChat() false,
  get buddy() null,
  get account() ({
    alias: "",
    name: this._accountName,
    normalizedName: this._accountName,
    protocol: {name: this._protocolName},
    statusInfo: Services.core.globalUserStatus
  }),
  getMessages: function(aMessageCount) {
    if (aMessageCount)
      aMessageCount.value = this._messages.length;
    return this._messages;
  }
};

/* Generic log enumeration stuff */
function Log(aFile)
{
  this.file = aFile;
  this.path = aFile.path;
  const regexp = /([0-9]{4})-([0-9]{2})-([0-9]{2}).([0-9]{2})([0-9]{2})([0-9]{2})([+-])([0-9]{2})([0-9]{2}).*\.([a-z]+)$/;
  let r = aFile.leafName.match(regexp);
  let date = new Date(r[1], r[2] - 1, r[3], r[4], r[5], r[6]);
  let offset = r[7] * 60 + r[8];
  if (r[6] == -1)
    offset *= -1;
  this.time = date.valueOf() / 1000; // ignore the timezone offset for now (FIXME)
  this.format = r[10];
}
Log.prototype = {
  __proto__: ClassInfo("imILog", "Log object"),
  getConversation: function() {
    if (this.format != "json")
      return null;

    const PR_RDONLY = 0x01;
    let fis = new FileInputStream(this.file, PR_RDONLY, 0444,
                                  Ci.nsIFileInputStream.CLOSE_ON_EOF);
    let lis = new ConverterInputStream(fis, "UTF-8", 1024, 0x0);
    lis.QueryInterface(Ci.nsIUnicharLineInputStream);
    return new LogConversation(lis);
  }
};

function LogEnumerator(aEntries)
{
  this._entries = aEntries;
}
LogEnumerator.prototype = {
  _entries: [],
  hasMoreElements: function() {
    while (this._entries.length > 0 && !this._entries[0].hasMoreElements())
      this._entries.shift();
    return this._entries.length > 0;
  },
  getNext: function()
    new Log(this._entries[0].getNext().QueryInterface(Ci.nsIFile)),
  QueryInterface: XPCOMUtils.generateQI([Ci.nsISimpleEnumerator])
};

function Logger() { }
Logger.prototype = {
  _enumerateLogs: function logger__enumerateLogs(aAccount, aNormalizedName) {
    let file = getLogFolderForAccount(aAccount);
    file.append(aNormalizedName);
    if (!file.exists())
      return EmptyEnumerator;

    return new LogEnumerator([file.directoryEntries]);
  },
  getLogFromFile: function logger_getLogFromFile(aFile) new Log(aFile),
  getLogsForContact: function logger_getLogsForContact(aContact) {
    let entries = [];
    aContact.getBuddies().forEach(function (aBuddy) {
      aBuddy.getAccountBuddies().forEach(function (aAccountBuddy) {
        let file = getLogFolderForAccount(aAccountBuddy.account);
        file.append(aAccountBuddy.normalizedName);
        if (file.exists())
          entries.push(file.directoryEntries);
      });
    });
    return new LogEnumerator(entries);
  },
  getLogsForBuddy: function logger_getLogsForBuddy(aBuddy) {
    let entries = [];
    aBuddy.getAccountBuddies().forEach(function (aAccountBuddy) {
      let file = getLogFolderForAccount(aAccountBuddy.account);
      file.append(aAccountBuddy.normalizedName);
      if (file.exists())
        entries.push(file.directoryEntries);
    });
    return new LogEnumerator(entries);
  },
  getLogsForAccountBuddy: function logger_getLogsForAccountBuddy(aAccountBuddy)
    this._enumerateLogs(aAccountBuddy.account, aAccountBuddy.normalizedName),
  getLogsForConversation: function logger_getLogsForConversation(aConversation) {
    let name = aConversation.normalizedName;
    if (aConversation.isChat &&
        aConversation.account.protocol.id != "prpl-twitter")
      name += ".chat";
    return this._enumerateLogs(aConversation.account, name);
  },
  getSystemLogsForAccount: function logger_getSystemLogsForAccount(aAccount)
    this._enumerateLogs(aAccount, ".system"),
  getSimilarLogs: function(aLog)
    new LogEnumerator([new LocalFile(aLog.path).parent.directoryEntries]),

  observe: function logger_observe(aSubject, aTopic, aData) {
    switch (aTopic) {
    case "profile-after-change":
      Services.obs.addObserver(this, "final-ui-startup", false);
      break;
    case "final-ui-startup":
      Services.obs.removeObserver(this, "final-ui-startup");
      ["new-text", "conversation-closed", "conversation-left-chat",
       "account-connected", "account-disconnected",
       "account-buddy-status-changed"].forEach(function(aEvent) {
        Services.obs.addObserver(this, aEvent, false);
      }, this);
      break;
    case "new-text":
      if (!aSubject.noLog) {
        let log = getLogForConversation(aSubject.conversation);
        log.logMessage(aSubject);
      }
      break;
    case "conversation-closed":
    case "conversation-left-chat":
      closeLogForConversation(aSubject);
      break;
    case "account-connected":
      getLogForAccount(aSubject, true).logEvent("+++ " + aSubject.name +
                                                " signed on");
      break;
    case "account-disconnected":
      getLogForAccount(aSubject).logEvent("+++ " + aSubject.name +
                                          " signed off");
      closeLogForAccount(aSubject);
      break;
    case "account-buddy-status-changed":
      let status;
      if (!aSubject.online)
        status = "Offline";
      else if (aSubject.mobile)
        status = "Mobile";
      else if (aSubject.idle)
        status = "Idle";
      else if (aSubject.available)
        status = "Available";
      else
        status = "Unavailable";

      let statusText = aSubject.statusText;
      if (statusText)
        status += " (\"" + statusText + "\")";

      let nameText = aSubject.displayName + " (" + aSubject.userName + ")";
      getLogForAccount(aSubject.account).logEvent(nameText + " is now " + status);
      break;
    default:
      throw "Unexpected notification " + aTopic;
    }
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.imILogger]),
  classDescription: "Logger",
  classID: Components.ID("{fb0dc220-2c7a-4216-9f19-6b8f3480eae9}"),
  contractID: "@mozilla.org/chat/logger;1"
};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([Logger]);
