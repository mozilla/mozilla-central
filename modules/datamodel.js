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

EXPORTED_SYMBOLS = ["GlodaAttributeDBDef",
                    "GlodaConversation", "GlodaFolder", "GlodaMessage",
                    "GlodaContact", "GlodaIdentity"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gloda/modules/log4moz.js");
const LOG = Log4Moz.Service.getLogger("gloda.datamodel");

Cu.import("resource://gloda/modules/utils.js");

/**
 * @class Represents a gloda attribute definition's DB form.  This class
 *  stores the information in the database relating to this attribute
 *  definition.  Access its attrDef attribute to get at the realy juicy data.
 *  This main interesting thing this class does is serve as the keeper of the
 *  mapping from parameters to attribute ids in the database if this is a 
 *  parameterized attribute.
 */
function GlodaAttributeDBDef(aDatastore, aID, aCompoundName, aAttrType,
                           aPluginName, aNounName, aAttrName) {
  this._datastore = aDatastore;
  this._id = aID;
  this._compoundName = aCompoundName;
  this._attrType = aAttrType;
  this._pluginName = aPluginName;
  this._nounName = aNounName;
  this._attrName = aAttrName;
  
  this.attrDef = null;

  /** Map parameter values to the underlying database id. */
  this._parameterBindings = {};
}

GlodaAttributeDBDef.prototype = {
  get id() { return this._id; },
  get attributeName() { return this._attrName; },

  get parameterBindings() { return this._parameterBindings; },
  
  /**
   * Bind a parameter value to the attribute definition, allowing use of the
   *  attribute-parameter as an attribute.
   *
   * @return
   */
  bindParameter: function gloda_attr_bindParameter(aValue) {
    // people probably shouldn't call us with null, but handle it
    if (aValue == null) {
      return this._id;
    }
    if (aValue in this._parameterBindings) {
      return this._parameterBindings[aValue];
    }
    // no database entry exists if we are here, so we must create it...
    let id = this._datastore._createAttributeDef(this._attrType,
                 this._pluginName, this._attrName, aValue);
    this._parameterBindings[aValue] = id;
    this._datastore.reportBinding(id, this, aValue);
    return id;
  },

  /**
   * Given a list of values (if non-singular) or a single value (if singular),
   *  return a list (regardless of plurality) of database-ready [attribute id,
   *  value] tuples.  This is intended to be used to directly convert the value
   *  of a property on an object that corresponds to a bound attribute.
   */
  convertValuesToDBAttributes:
      function gloda_attr_convertValuesToDBAttributes(aInstanceValues) {
    let nounDef = this.attrDef.objectNounDef;
    if (this._singular) {
      if (nounDef.usesParameter) {
        let [param, dbValue] = nounDef.toParamAndValue(aInstanceValues);
        return [[this.bindParameter(param), dbValue]];
      }
      else {
        return [[this._id, nounDef.toParamAndValue(aInstanceValues)[1]]];
      }
    }
    else {
      let dbAttributes = [];
      if (nounDef.usesParameter) {
        for each (let [, instanceValue] in Iterator(aInstanceValues)) {
          let [param, dbValue] = nounDef.toParamAndValue(instanceValue);
          dbAttributes.push([this.bindParameter(param), dbValue]);
        }
      }
      else {
        for each (let [, instanceValue] in Iterator(aInstanceValues)) {
          dbAttributes.push([this._id,
                             nounDef.toParamAndValue(instanceValue)[1]]);
        }
      }
      return dbAttributes;
    }
  },

  toString: function() {
    return this._compoundName;
  }
};

let GlodaHasAttributesMixIn = {
  enumerateAttributes: function gloda_attrix_enumerateAttributes() {
    let nounDef = this.NOUN_DEF;
    for each (let [key, value] in Iterator(this)) {
      let attrDef = nounDef.attribsByBoundName[key];
      // we expect to not have attributes for underscore prefixed values (those
      //  are managed by the instance's logic.  we also want to not explode
      //  should someone crap other values in there, we get both birds with this
      //  one stone.
      if (attrDef === undefined)
        continue;
      if (attrDef.singular) {
        // ignore attributes with null values
        if (value != null)
          yield [attrDef, [value]];
      }
      else {
        // ignore attributes with no values
        if (value.length)
          yield [attrDef, value];
      }
    }
  },
};

function MixIn(aConstructor, aMixIn) {
  let proto = aConstructor.prototype;
  for (let [name, func] in Iterator(aMixIn)) {
    if (name.substring(0, 4) == "get_")
      proto.__defineGetter__(name.substring(4), func);
    else
      proto[name] = func;
  }
}

/**
 * @class A gloda conversation (thread) exists so that messages can belong.
 */
function GlodaConversation(aDatastore, aID, aSubject, aOldestMessageDate,
                           aNewestMessageDate) {
  this._datastore = aDatastore;
  this._id = aID;
  this._subject = aSubject;
  this._oldestMessageDate = aOldestMessageDate;
  this._newestMessageDate = aNewestMessageDate;
}

GlodaConversation.prototype = {
  NOUN_ID: 101,
  get id() { return this._id; },
  get subject() { return this._subject; },
  get oldestMessageDate() { return this._oldestMessageDate; },
  get newestMessageDate() { return this._newestMessageDate; },
  
  getMessagesCollection: function gloda_conversation_getMessagesCollection(
    aListener, aData) {
    let query = new GlodaMessage.prototype.NOUN_DEF.queryClass();
    query.conversation(this._id).orderBy("date");
    return query.getCollection(aListener, aData);
  },

  toString: function gloda_conversation_toString() {
    return "Conversation:" + this._id;
  },
};

function GlodaFolder(aDatastore, aID, aURI, aDirtyStatus, aPrettyName) {
  this._datastore = aDatastore;
  this._id = aID;
  this._uri = aURI;
  this._dirtyStatus = aDirtyStatus;
  this._prettyName = aPrettyName;
}

GlodaFolder.prototype = {
  NOUN_ID: 100,
  /** The folder is believed to be up-to-date */
  kFolderClean: 0,
  /** The folder has some un-indexed or dirty messages */
  kFolderDirty: 1,
  /** The folder needs to be entirely re-indexed, regardless of the flags on
   * the messages in the folder. This state will be downgraded to dirty */
  kFolderFilthy: 2,
  get id() { return this._id; },
  get uri() { return this._uri; },
  get dirtyStatus() { return this._dirtyStatus; },
  set dirtyStatus(aNewStatus) {
    if (aNewStatus != this._dirtyStatus) {
      this._dirtyStatus = aNewStatus;
      this._datastore.updateFolderDirtyStatus(this);
    }
  },
  get name() { return this._prettyName; },
  toString: function gloda_folder_toString() {
    return "Folder:" + this._id;
  }
}

/**
 * @class A message representation.
 */
function GlodaMessage(aDatastore, aID, aFolderID, aMessageKey,
                      aConversationID, aConversation, aDate,
                      aHeaderMessageID, aDeleted, aJsonText) {
  this._datastore = aDatastore;
  this._id = aID;
  this._folderID = aFolderID;
  this._messageKey = aMessageKey;
  this._conversationID = aConversationID;
  this._conversation = aConversation;
  this._date = aDate;
  this._headerMessageID = aHeaderMessageID;
  if (aJsonText)
    this._jsonText = aJsonText;

  // only set _deleted if we're deleted, otherwise the undefined does our
  //  speaking for us.
  if (aDeleted)
    this._deleted = aDeleted;
}

GlodaMessage.prototype = {
  NOUN_ID: 102,
  get id() { return this._id; },
  get folderID() { return this._folderID; },
  get messageKey() { return this._messageKey; },
  get conversationID() { return this._conversationID; },
  // conversation is special
  get headerMessageID() { return this._headerMessageID; },
  
  get date() { return this._date; },
  set date(aNewDate) { this._date = aNewDate; },

  get folderURI() {
    if (this._folderID != null)
      return this._datastore._mapFolderID(this._folderID).uri;
    else
      return null;
  },
  get conversation() {
    return this._conversation;
  },

  toString: function gloda_message_toString() {
    // uh, this is a tough one...
    return "Message:" + this._id;
  },

  _clone: function gloda_message_clone() {
    return new GlodaMessage(this._datastore, this._id, this._folderID,
      this._messageKey, this._conversationID, this._conversation, this._date,
      this._headerMessageID, this._deleted);
  },

  _ghost: function gloda_message_ghost() {
    this._folderID = null;
    this._messageKey = null;
  },

  _nuke: function gloda_message_nuke() {
    this._id = null;
    this._folderID = null;
    this._messageKey = null;
    this._conversationID = null;
    this._conversation = null;
    this.date = null;
    this._headerMessageID = null;

    this._datastore = null;
  },

  /**
   * Return the underlying nsIMsgDBHdr from the folder storage for this, or
   *  null if the message does not exist for one reason or another.
   * This method no longer caches the result, so it's up to you.
   */
  get folderMessage() {
    if (this._folderID === null || this._messageKey === null)
      return null;
    let rdfService = Cc['@mozilla.org/rdf/rdf-service;1'].
                     getService(Ci.nsIRDFService);
    let folder = rdfService.GetResource(
                   this._datastore._mapFolderID(this._folderID).uri);
    if (folder instanceof Ci.nsIMsgFolder) {
      let folderMessage = folder.GetMessageHeader(this._messageKey);
      if (folderMessage !== null) {
        // verify the message-id header matches what we expect...
        if (folderMessage.messageId != this._headerMessageID) {
          LOG.info("Message with message key does not match expected " +
                   "header! (" + this._headerMessageID + " expected, got " +
                   folderMessage.messageId + ")");
          folderMessage = null;
        }
      }
      return folderMessage;
    }

    // this only gets logged if things have gone very wrong.  we used to throw
    //  here, but it's unlikely our caller can do anything more meaningful than
    //  treating this as a disappeared message.
    LOG.info("Unable to locate folder message for: " + this._folderID + ":" +
             this._messageKey);
    return null;
  },
  get folderMessageURI() {
    let folderMessage = this.folderMessage;
    if (folderMessage)
      return folderMessage.folder.getUriForMsg(folderMessage);
    else
      return null;
  }
};
MixIn(GlodaMessage, GlodaHasAttributesMixIn);

/**
 * @class Contacts correspond to people (one per person), and may own multiple
 *  identities (e-mail address, IM account, etc.)
 */
function GlodaContact(aDatastore, aID, aDirectoryUUID, aContactUUID, aName,
                      aPopularity, aFrecency, aJsonText) {
  this._datastore = aDatastore;
  this._id = aID;
  this._directoryUUID = aDirectoryUUID;
  this._contactUUID = aContactUUID;
  this._name = aName;
  this._popularity = aPopularity;
  this._frecency = aFrecency;
  if (aJsonText)
    this._jsonText = aJsonText;

  this._identities = null;
}

GlodaContact.prototype = {
  NOUN_ID: 103,

  get id() { return this._id; },
  get directoryUUID() { return this._directoryUUID; },
  get contactUUID() { return this._contactUUID; },
  get name() { return this._name; },
  set name(aName) { this._name = aName; },

  get popularity() { return this._popularity; },
  set popularity(aPopularity) {
    this._popularity = aPopularity;
    this.dirty = true;
  },

  get frecency() { return this._frecency; },
  set frecency(aFrecency) {
    this._frecency = aFrecency;
    this.dirty = true;
  },

  get identities() {
    return this._identities;
  },

  toString: function gloda_contact_toString() {
    return "Contact:" + this._id;
  },
  
  get accessibleLabel() {
    return "Contact: " + this._name;
  },

  _clone: function gloda_contact_clone() {
    return new GlodaContact(this._datastore, this._id, this._directoryUUID,
      this._contactUUID, this._name, this._popularity, this._frecency);
  },
};
MixIn(GlodaContact, GlodaHasAttributesMixIn);


/**
 * @class A specific means of communication for a contact.
 */
function GlodaIdentity(aDatastore, aID, aContactID, aContact, aKind, aValue,
                       aDescription, aIsRelay) {
  this._datastore = aDatastore;
  this._id = aID;
  this._contactID = aContactID;
  this._contact = aContact;
  this._kind = aKind;
  this._value = aValue;
  this._description = aDescription;
  this._isRelay = aIsRelay;
}

GlodaIdentity.prototype = {
  NOUN_ID: 104,
  get id() { return this._id; },
  get contactID() { return this._contactID; },
  get contact() { return this._contact; },
  get kind() { return this._kind; },
  get value() { return this._value; },
  get description() { return this._description; },
  get isRelay() { return this._isRelay; },

  get uniqueValue() {
    return this._kind + "@" + this._value;
  },

  toString: function gloda_identity_toString() {
    return "Identity:" + this._kind + ":" + this._value;
  },

  get abCard() {
    return GlodaUtils.getCardForEmail(this._value);
  },
  
  pictureURL: function(aSize) {
    let md5hash = GlodaUtils.md5HashString(this._value);
    let gravURL = "http://www.gravatar.com/avatar/" + md5hash +
                                "?d=identicon&s=" + aSize + "&r=g";
    return gravURL;
  }
};
