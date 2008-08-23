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

EXPORTED_SYMBOLS = ["GlodaAttributeDef",
                    "GlodaConversation", "GlodaMessage",
                    "GlodaContact", "GlodaIdentity"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gloda/modules/log4moz.js");
const LOG = Log4Moz.Service.getLogger("gloda.datamodel");

function GlodaAttributeDef(aDatastore, aID, aCompoundName, aProvider, aAttrType,
                           aPluginName, aAttrName, aSubjectTypes,
                           aObjectType, aObjectNounMeta,
                           aExplanationFormat) {
  this._datastore = aDatastore;
  this._id = aID;
  this._compoundName = aCompoundName;
  this._provider = aProvider;
  this._attrType = aAttrType;
  this._pluginName = aPluginName;
  this._attrName = aAttrName;
  this._subjectTypes = aSubjectTypes;
  this._objectType = aObjectType;
  this._objectNounMeta = aObjectNounMeta;
  this._explanationFormat = aExplanationFormat;
  
  this._boundName = null;
  this._singular = null;
  
  this._special = 0; // not special
  this._specialColumnName = null;
  
  /** Map parameter values to the underlying database id. */
  this._parameterBindings = {};
}

GlodaAttributeDef.prototype = {
  get id() { return this._id; },
  get provider() { return this._provider; },
  get attributeName() { return this._attrName; },

  get objectNoun() { return this._objectType; },
  get objectNounMeta() { return this._objectNounMeta; },

  get isBound() { return this._boundName !== null; },
  get boundName() { return this._boundName; },
  get singular() { return this._singular; },
  
  get special() { return this._special; },
  get specialColumnName() { return this._specialColumnName; },

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
  
  explain: function gloda_attr_explain(aSubject, aValue) {
    let subjStr = (aSubject !== null) ? aSubject.toString() : "";
    let valStr = (aValue !== null) ? aValue.toString() : "";
    
    let explStr = this._explanationFormat ? this._explanationFormat
                                          : "Inexplicable";
    explStr = explStr.replace("%{subject}", subjStr);
    explStr = explStr.replace("%{object}", valStr);
    
    return explStr.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
  },
  
  /**
   * Given an instance of an object with this attribute, return the value
   *  of the attribute.  This handles bound and un-bound attributes.  For
   *  singular attributes, the value is null or the value; for non-singular
   *  attributes the value is a list.
   */
  getValueFromInstance: function gloda_attr_getValueFromInstance(aObj) {
    // if it's bound, we can just use the binding and trigger his caching
    // if it's special, the attribute actually exists, but just with explicit
    //  code backing it.
    if (this._boundName !== null || this._special) {
      return aObj[this._boundName];
    }
    let instances = aObj.getAttributeInstances(this);
    let nounMeta = this._objectNounMeta;
    if (this._singular) {
      if (instances.length > 0)
        return nounMeta.fromParamAndValue(instances[0][1], instances[0][2]);
      else
        return null;
    }
    else {
      let values;
      if (instances.length > 0) {
        values = [];
        for (let iInst=0; iInst < instances.length; iInst++) {
          values.push(nounMeta.fromParamAndValue(instances[iInst][1],
                                                 instances[iInst][2]));
        }
      }
      else {
        values = instances; // empty is empty
      }
      return values;
    }
  },
  
  toString: function() {
    return this._compoundName;
  },
};

function GlodaConversation(aDatastore, aID, aSubject, aOldestMessageDate,
                           aNewestMessageDate) {
  this._datastore = aDatastore;
  this._id = aID;
  this._subject = aSubject;
  this._oldestMessageDate = aOldestMessageDate;
  this._newestMessageDate = aNewestMessageDate;

  this._messages = null;
}

GlodaConversation.prototype = {
  NOUN_ID: 101,
  get id() { return this._id; },
  get subject() { return this._subject; },
  get oldestMessageDate() { return this._oldestMessageDate; },
  get newestMessageDate() { return this._newestMessageDate; },

  get messages() {
    if (this._messages == null) {
      this._messages = this._datastore.getMessagesByConversationID(this._id,
                                                                   false);
    }
    return this._messages;
  },
  
  toString: function gloda_conversation_toString() {
    return this._subject;
  },
};


function GlodaMessage(aDatastore, aID, aFolderID, aMessageKey,
                      aConversationID, aConversation, aDate,
                      aHeaderMessageID, aBodySnippet) {
  this._datastore = aDatastore;
  this._id = aID;
  this._folderID = aFolderID;
  this._messageKey = aMessageKey;
  this._conversationID = aConversationID;
  this._conversation = aConversation;
  this.date = aDate;
  this._headerMessageID = aHeaderMessageID;
  this._bodySnippet = aBodySnippet;

  // for now, let's always cache this; they should really be forgetting about us
  //  if they want to forget about the underlying storage anyways...
  this._folderMessage = undefined;
  // the list of attributes, un-processed
  this._attributes = null;
}

GlodaMessage.prototype = {
  NOUN_ID: 102,
  get id() { return this._id; },
  get folderID() { return this._folderID; },
  get messageKey() { return this._messageKey; },
  get conversationID() { return this._conversationID; },
  // conversation is special
  get headerMessageID() { return this._headerMessageID; },
  get bodySnippet() { return this._bodySnippet; },

  get folderURI() {
    if (this._folderID)
      return this._datastore._mapFolderID(this._folderID);
    else
      return null;
  },
  get conversation() {
    if (this._conversation == null) {
      this._conversation = this._datastore.getConversationByID(
        this._conversationID);
    }
    return this._conversation;
  },

  set messageKey(aMessageKey) { this._messageKey = aMessageKey; },
  set folderURI(aFolderURI) {
    this._folderID = this._datastore._mapFolderURI(aFolderURI);
  },
  
  toString: function gloda_message_toString() {
    // uh, this is a tough one...
    return "Message " + this._id; 
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
    this._headerMessageID = null;
    this._bodySnippet = null;
    
    this._datastore = null;
  },
  
  /**
   * Return the underlying nsIMsgDBHdr from the folder storage for this, or
   *  null if the message does not exist for one reason or another.
   */
  get folderMessage() {
    if (this._folderMessage !== undefined)
      return this._folderMessage;
    if (this._folderID === null || this._messageKey === null)
      return this._folderMessage = null;
    let rdfService = Cc['@mozilla.org/rdf/rdf-service;1'].
                     getService(Ci.nsIRDFService);
    let folder = rdfService.GetResource(
                   this._datastore._mapFolderID(this._folderID));
    if (folder instanceof Ci.nsIMsgFolder) {
      this._folderMessage = folder.GetMessageHeader(this._messageKey);
      if (this._folderMessage != null) {
        // verify the message-id header matches what we expect...
        if (this._folderMessage.messageId != this._headerMessageID) {
          LOG.info("Message with message key does not match expected " +
                   "header! (" + this._headerMessageID + " expected, got " +
                   this._folderMessage.messageId + ")");
          this._folderMessage = null;
        }
      }
      return this._folderMessage;
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
  },
  
  get rawAttributes() {
    if (this._attributes == null)
      this._attributes = this._datastore.getMessageAttributes(this); 
    return this._attributes;
  },
  
  /**
   * For consistency of caching with the bound attributes, we try and access the
   *  attributes through their bound names if they are bound.
   */
  get attributes() {
    let seenDefs = {};
    let attribs = [];
    for each (let attrParamVal in this.rawAttributes) {
      let attrDef = attrParamVal[0];
      if (!(attrDef in seenDefs)) {
        if (attrDef.isBound) {
          if (attrDef.singular) {
            attribs.push([attrDef, this[attrDef.boundName]]);
          }
          else {
            let values = this[attrDef.boundName];
            for (let iValue=0; iValue < values.length; iValue++)
              attribs.push([attrDef, values[iValue]]);
          }
          seenDefs[attrDef] = true;
        }
        else {
          // TODO: actually deal with unbound attributes
          LOG.info("unbound attribute ignored in traversal: " + attrDef +
                   " value: " + attrParamVal[2]);
        }
      }
    }
    
    return attribs;
  },
  
  getAttributeInstances: function gloda_message_getAttributeInstances(aAttr) {
    return [attrParamVal for each (attrParamVal in this.rawAttributes) if
            (attrParamVal[0] == aAttr)];
  },
  
  getSingleAttribute: function gloda_message_getSingleAttribute(aAttr) {
    let instances = this.getAttributeInstances(aAttr);
    if (instances.length > 0)
      return instances[0];
    else
      return null;
  },
};

function GlodaContact(aDatastore, aID, aDirectoryUUID, aContactUUID, aName,
                      aPopularity, aFrecency) {
  this._datastore = aDatastore;
  this._id = aID;
  this._directoryUUID = aDirectoryUUID;
  this._contactUUID = aContactUUID;
  this._name = aName;
  this._popularity = aPopularity;
  this._frecency = aFrecency;
  
  this._identities = null;
}

GlodaContact.prototype = {
  NOUN_ID: 103,

  get id() { return this._id; },
  get directoryUUID() { return this._directoryUUID; },
  get contactUUID() { return this._contactUUID; },
  get name() { return this._name },
  
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
    if (this._identities === null)
      this._identities = this._datastore.getIdentitiesByContactID(this._id);
    return this._identities;
  },
  
  toString: function gloda_contact_toString() {
    return this._name;
  }
};

function GlodaIdentity(aDatastore, aID, aContactID, aContact, aKind, aValue,
                       aIsRelay) {
  this._datastore = aDatastore;
  this._id = aID;
  this._contactID = aContactID;
  this._contact = aContact;
  this._kind = aKind;
  this._value = aValue;
  this._isRelay = aIsRelay;
}

GlodaIdentity.prototype = {
  NOUN_ID: 104,
  get id() { return this._id; },
  get contactID() { return this._contactID; }, 
  get kind() { return this._kind; },
  get value() { return this._value; },
  get isRelay() { return this._isRelay; },
  
  get contact() {
    if (this._contact === null)
      this._contact = this._datastore.getContactByID(this._contactID);
    return this._contact;
  },
  
  toString: function gloda_identity_toString() {
    return this._value;
  },
  
  get abCard() {
    // search through all of our local address books looking for a match.
    let enumerator = Components.classes["@mozilla.org/abmanager;1"]
                               .getService(Ci.nsIAbManager)
                               .directories;
    let cardForEmailAddress;
    let addrbook;
    while (!cardForEmailAddress && enumerator.hasMoreElements())
    {
      addrbook = enumerator.getNext().QueryInterface(Ci.nsIAbDirectory);
      cardForEmailAddress = addrbook.cardForEmailAddress(this._value);
      if (cardForEmailAddress)
        return cardForEmailAddress;
    }
  
    return null;
  },
};
