EXPORTED_SYMBOLS = ["GlodaConversation", "GlodaMessage"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gloda/modules/log4moz.js");
const LOG = Log4Moz.Service.getLogger("gloda.datamodel");

function GlodaConversation (aID, aSubject, aOldestMessageDate,
                            aNewestMessageDate) {
  this._id = aID;
  this._subject = aSubject;
  this._oldestMessageDate = aOldestMessageDate;
  this._newestMessageDate = aNewestMessageDate; 
}

GlodaConversation.prototype = {
  get id() { return this._id; },
  get subject() { return this._subject; },
  get oldestMessageDate() { return this._oldestMessageDate; },
  get newestMessageDate() { return this._newestMessageDate; },
};


function GlodaMessage (aID, aFolderID, aMessageKey, aConversationID,
                       aConversation, aParentID, aHeaderMessageID,
                       aBodySnippet) {
  this._id = aID;
  this._folderID = aFolderID;
  this._messageKey = aMessageKey;
  this._conversationID = aConversationID;
  this._conversation = aConversation;
  this._parentID = aParentID;
  this._headerMessageID = aHeaderMessageID;
  this._bodySnippet = aBodySnippet;
}

GlodaMessage.prototype = {
  get id() { return this._id; },
  get folderID() { return this._folderID; },
  get messageKey() { return this._messageKey; },
  get conversationID() { return this._conversationID; },
  // conversation is special
  get parentID() { return this._parentID; },
  get headerMessageID() { return this._headerMessageID; },
  get bodySnippet() { return this._boddySnippet; },
  
  get conversation() {
  },
  
  /**
   * Return the underlying nsIMsgDBHdr from the folder storage for this, or
   *  null if the message does not exist for one reason or another.
   */
  get folderMessage() {
  },
};