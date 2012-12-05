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

// This function checks names against OS naming conventions and alters them
// accordingly so that they can be used as file/folder names.
function encodeName(aName)
{
  // Reserved device names by Windows (prefixing "%").
  var reservedNames = /^(CON|PRN|AUX|NUL|COM\d|LPT\d)$/i;
  if (reservedNames.test(aName))
    return "%" + aName;

  // "." and " " must not be at the end of a file or folder name (appending "_").
  if (/[\. _]/.test(aName.slice(-1)))
    aName += "_";

  // Reserved characters are replaced by %[hex value]. encodeURIComponent() is
  // not sufficient, nevertheless decodeURIComponent() can be used to decode.
  function encodeReservedChars(match) "%" + match.charCodeAt(0).toString(16);
  return aName.replace(/[<>:"\/\\|?*&%]/g, encodeReservedChars);
}

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
  file.append(encodeName(aAccount.normalizedName));
  createIfNotExists(file);
  return file;
}

function getNewLogFileName(aFormat, aDate)
{
  let date = aDate ? new Date(aDate / 1000) : new Date();
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
  file: null,
  format: "txt",
  _init: function cl_init() {
    let file = getLogFolderForAccount(this._conv.account, true);
    let name = this._conv.normalizedName;
    if (convIsRealMUC(this._conv))
      name += ".chat";
    file.append(encodeName(name));
    if (!file.exists())
      file.create(Ci.nsIFile.DIRECTORY_TYPE, 0777);
    if (Services.prefs.getCharPref("purple.logging.format") == "json")
      this.format = "json";
    file.append(getNewLogFileName(this.format, this._conv.startDate));
    this.file = file;
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
      return JSON.stringify({date: new Date(this._conv.startDate / 1000),
                             name: this._conv.name,
                             title: this._conv.title,
                             account: account.normalizedName,
                             protocol: account.protocol.normalizedName,
                             isChat: this._conv.isChat
                            }) + "\n";
    }
    return "Conversation with " + this._conv.name +
           " at " + (new Date(this._conv.startDate / 1000)).toLocaleString() +
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
        if (msg.startsWith("/me "))
          line += "***" + sender + " " + msg.substr(4);
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
      this.file = null;
    }
  }
};

const dummyConversationLog = {
  file: null,
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

function LogConversation(aLineInputStreams)
{
  // If aLineInputStreams isn't an Array, we'll assume that it's a lone
  // InputStream, and wrap it in an Array.
  if (!Array.isArray(aLineInputStreams))
    aLineInputStreams = [aLineInputStreams];

  this._messages = [];

  // We'll read the name, title, account, and protocol data from the first
  // stream, and skip the others.
  let firstFile = true;

  for each (let inputStream in aLineInputStreams) {
    let line = {value: ""};
    let more = inputStream.readLine(line);

    if (!line.value)
      throw "bad log file";

    if (firstFile) {
      let data = JSON.parse(line.value);
      this.startDate = new Date(data.date) * 1000;
      this.name = data.name;
      this.title = data.title;
      this._accountName = data.account;
      this._protocolName = data.protocol;
      this._isChat = data.isChat;
      firstFile = false;
    }

    while (more) {
      more = inputStream.readLine(line);
      if (!line.value)
        break;
      try {
        let data = JSON.parse(line.value);
        this._messages.push(new LogMessage(data, this));
      } catch (e) {
        // if a message line contains junk, just ignore the error and
        // continue reading the conversation.
      }
    }
  }
}
LogConversation.prototype = {
  __proto__: ClassInfo("imILogConversation", "Log conversation object"),
  get isChat() this._isChat,
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

  let [date, format] = getDateFromFilename(aFile.leafName);
  if (!date || !format) {
    this.format = "invalid";
    this.time = 0;
    return;
  }
  this.time = date.valueOf() / 1000;
  this.format = format;
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
    try {
      return new LogConversation(lis);
    } catch (e) {
      // If the file contains some junk (invalid JSON), the
      // LogConversation code will still read the messages it can parse.
      // If the first line of meta data is corrupt, there's really no
      // useful data we can extract from the file so the
      // LogConversation constructor will throw.
      return null;
    }
  }
};

/**
 * Takes a properly formatted log file name and extracts the date information
 * and filetype, returning the results as an Array.
 *
 * Filenames are expected to be formatted as:
 *
 * YYYY-MM-DD.HHmmSS+ZZzz.format
 *
 * @param aFilename the name of the file
 * @returns an Array, where the first element is a Date object for the date
 *          that the log file represents, and the file type as a string.
 */
function getDateFromFilename(aFilename) {
  const kRegExp = /([\d]{4})-([\d]{2})-([\d]{2}).([\d]{2})([\d]{2})([\d]{2})([+-])([\d]{2})([\d]{2}).*\.([A-Za-z]+)$/;

  let r = aFilename.match(kRegExp);
  if (!r)
    return [];

  // We ignore the timezone offset for now (FIXME)
  return [new Date(r[1], r[2] - 1, r[3], r[4], r[5], r[6]), r[10]];
}

/**
 * Returns true if a Conversation is both a chat conversation, and not
 * a Twitter conversation.
 */
function convIsRealMUC(aConversation) {
  return (aConversation.isChat &&
          aConversation.account.protocol.id != "prpl-twitter");
}

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

function DailyLogEnumerator(aEntries) {
  this._entries = {};

  for each (let entry in aEntries) {
    while (entry.hasMoreElements()) {
      let file = entry.getNext();
      if (!(file instanceof Ci.nsIFile))
        continue;

      let [logDate] = getDateFromFilename(file.leafName);
      if (!logDate) {
        // We'll skip this one, since it's got a busted filename.
        continue;
      }

      // We want to cluster all of the logs that occur on the same day
      // into the same Arrays. We clone the date for the log, reset it to
      // the 0th hour/minute/second, and use that to construct an ID for the
      // Array we'll put the log in.
      let dateForID = new Date(logDate);
      dateForID.setHours(0);
      dateForID.setMinutes(0);
      dateForID.setSeconds(0);
      let dayID = dateForID.toISOString();

      if (!(dayID in this._entries))
        this._entries[dayID] = [];

      this._entries[dayID].push({
        file: file,
        time: logDate
      });
    }
  }

  this._days = Object.keys(this._entries).sort();
  this._index = 0;
}
DailyLogEnumerator.prototype = {
  _entries: {},
  _days: [],
  _index: 0,
  hasMoreElements: function() this._index < this._days.length,
  getNext: function() new LogCluster(this._entries[this._days[this._index++]]),
  QueryInterface: XPCOMUtils.generateQI([Ci.nsISimpleEnumerator])
};

/**
 * A LogCluster is a Log representing several log files all at once. The
 * constructor expects aEntries, which is an array of objects that each
 * have two properties: file and time. The file is the nsIFile for the
 * log file, and the time is the Date object extracted from the filename for
 * the log file.
 */
function LogCluster(aEntries) {
  if (!aEntries.length)
    throw new Error("LogCluster was passed an empty Array");

  // Sort our list of entries for this day in increasing order.
  aEntries.sort(function(aLeft, aRight) aLeft.time - aRight.time);

  this._entries = aEntries;
  // Calculate the timestamp for the first entry down to the day.
  let timestamp = new Date(aEntries[0].time);
  timestamp.setHours(0);
  timestamp.setMinutes(0);
  timestamp.setSeconds(0);
  this.time = timestamp.valueOf() / 1000;
  // Path is used to uniquely identify a Log, and sometimes used to
  // quickly determine which directory a log file is from.  We'll use
  // the first file's path.
  this.path = aEntries[0].file.path;
}
LogCluster.prototype = {
  __proto__: ClassInfo("imILog", "LogCluster object"),
  format: "json",

  getConversation: function() {
    const PR_RDONLY = 0x01;
    let streams = [];
    for each (let entry in this._entries) {
      let fis = new FileInputStream(entry.file, PR_RDONLY, 0444,
                                    Ci.nsIFileInputStream.CLOSE_ON_EOF);
      // Pass in 0x0 so that we throw exceptions on unknown bytes.
      let lis = new ConverterInputStream(fis, "UTF-8", 1024, 0x0);
      lis.QueryInterface(Ci.nsIUnicharLineInputStream);
      streams.push(lis);
    }

    try {
      return new LogConversation(streams);
    } catch (e) {
      // If the file contains some junk (invalid JSON), the
      // LogConversation code will still read the messages it can parse.
      // If the first line of meta data is corrupt, there's really no
      // useful data we can extract from the file so the
      // LogConversation constructor will throw.
      return null;
    }
  }
};

function Logger() { }
Logger.prototype = {
  _enumerateLogs: function logger__enumerateLogs(aAccount, aNormalizedName,
                                                 aGroupByDay) {
    let file = getLogFolderForAccount(aAccount);
    file.append(encodeName(aNormalizedName));
    if (!file.exists())
      return EmptyEnumerator;

    let enumerator = aGroupByDay ? DailyLogEnumerator : LogEnumerator;

    return new enumerator([file.directoryEntries]);
  },
  getLogFromFile: function logger_getLogFromFile(aFile, aGroupByDay) {
    if (aGroupByDay)
      return this._getDailyLogFromFile(aFile);

    return new Log(aFile);
  },
  _getDailyLogFromFile: function logger_getDailyLogsForFile(aFile) {
    let [targetDate] = getDateFromFilename(aFile.leafName);
    if (!targetDate)
      return null;

    let targetDay = Math.floor(targetDate / (86400 * 1000));

    // Get the path for the log file - we'll assume that the files relevant
    // to our interests are in the same folder.
    let path = aFile.path;
    let folder = aFile.parent.directoryEntries;
    let relevantEntries = [];
    // Pick out the files that start within our date range.
    while (folder.hasMoreElements()) {
      let file = folder.getNext();
      if (!(file instanceof Ci.nsIFile))
        continue;

      let [logTime] = getDateFromFilename(file.leafName);

      let day = Math.floor(logTime / (86400 * 1000));
      if (targetDay == day) {
        relevantEntries.push({
          file: file,
          time: logTime
        });
      }
    }

    return new LogCluster(relevantEntries);
  },
  getLogFileForOngoingConversation: function logger_getLogFileForOngoingConversation(aConversation)
    getLogForConversation(aConversation).file,
  getLogsForContact: function logger_getLogsForContact(aContact) {
    let entries = [];
    aContact.getBuddies().forEach(function (aBuddy) {
      aBuddy.getAccountBuddies().forEach(function (aAccountBuddy) {
        let file = getLogFolderForAccount(aAccountBuddy.account);
        file.append(encodeName(aAccountBuddy.normalizedName));
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
      file.append(encodeName(aAccountBuddy.normalizedName));
      if (file.exists())
        entries.push(file.directoryEntries);
    });
    return new LogEnumerator(entries);
  },
  getLogsForAccountBuddy: function logger_getLogsForAccountBuddy(aAccountBuddy)
    this._enumerateLogs(aAccountBuddy.account, aAccountBuddy.normalizedName),
  getLogsForConversation: function logger_getLogsForConversation(aConversation,
                                                                 aGroupByDay) {
    let name = aConversation.normalizedName;
    if (convIsRealMUC(aConversation))
      name += ".chat";

    return this._enumerateLogs(aConversation.account, name, aGroupByDay);
  },
  getSystemLogsForAccount: function logger_getSystemLogsForAccount(aAccount)
    this._enumerateLogs(aAccount, ".system"),
  getSimilarLogs: function(aLog, aGroupByDay) {
    let enumerator = aGroupByDay ? DailyLogEnumerator : LogEnumerator;
    return new enumerator([new LocalFile(aLog.path).parent.directoryEntries]);
  },

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
