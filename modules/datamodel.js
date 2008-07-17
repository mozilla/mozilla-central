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

EXPORTED_SYMBOLS = ["GlodaAttributeDef", "GlodaConversation", "GlodaMessage",
                    "GlodaContact", "GlodaIdentity"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gloda/modules/log4moz.js");
const LOG = Log4Moz.Service.getLogger("gloda.datamodel");

function GlodaAttributeDef(aDatastore, aID, aCompoundName, aProvider, aAttrType,
                           aPluginName, aAttrName, aSubjectTypes, aObjectType,
                           aParameterType, aExplanationFormat) {
  this._datastore = aDatastore;
  this._id = aID;
  this._compoundName = aCompoundName;
  this._provider = aProvider;
  this._attrType = aAttrType;
  this._pluginName = aPluginName;
  this._attrName = aAttrName;
  this._subjectTypes = aSubjectTypes;
  this._objectType = aObjectType;
  this._parameterType = aParameterType;
  this._explanationFormat = aExplanationFormat;
  
  /** Map parameter values to the underlying database id. */
  this._parameterBindings = {};
}

GlodaAttributeDef.prototype = {
  get id() { return this._id; },
  get provider() { return this._provider; },

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
  }
};


function GlodaMessage(aDatastore, aID, aFolderID, aMessageKey,
                      aConversationID, aConversation,
                      aHeaderMessageID, aBodySnippet) {
  this._datastore = aDatastore;
  this._id = aID;
  this._folderID = aFolderID;
  this._messageKey = aMessageKey;
  this._conversationID = aConversationID;
  this._conversation = aConversation;
  this._headerMessageID = aHeaderMessageID;
  this._bodySnippet = aBodySnippet;

  // for now, let's always cache this; they should really be forgetting about us
  //  if they want to forget about the underlying storage anyways...
  this._folderMessage = null;
  this._attributes = null;
}

GlodaMessage.prototype = {
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
    if (this._folderMessage !== null)
      return this._folderMessage;
    if (this._folderID === null || this._messageKey === null)
      return null;

    let rdfService = Cc['@mozilla.org/rdf/rdf-service;1'].
                     getService(Ci.nsIRDFService);
    let folder = rdfService.GetResource(
                   this._datastore._mapFolderID(this._folderID));
    if (folder instanceof Ci.nsIMsgFolder) {
      this._folderMessage = folder.GetMessageHeader(this._messageKey);
      if (this._folderMessage !== null) {
        // verify the message-id header matches what we expect...
        if (this._folderMessage.messageId !== this._headerMessageID) {
          LOG.warn("Message with message key does not match expected " +
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
    LOG.error("Unable to locate folder message for: " + this._folderID + ":" +
              this._messageKey);
    return null;
  },
  
  get attributes() {
    if (this._attributes == null) {
      this._attributes = this._datastore.getMessageAttributes(this); 
    }
    
    return this._attributes;
  },
  
  getAttributeInstances: function gloda_message_getAttributeInstances(aAttr) {
    return [attrParamVal for each (attrParamVal in this.attributes) if
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

function GlodaContact(aDatastore, aID, aDirectoryUUID, aContactUUID, aName) {
  this._datastore = aDatastore;
  this._id = aID;
  this._directoryUUID = aDirectoryUUID;
  this._contactUUID = aContactUUID;
  this._name = aName;
}

GlodaContact.prototype = {
  get id() { return this._id; },
  get directoryUUID() { return this._directoryUUID; },
  get contactUUID() { return this._contactUUID; },
  get name() { return this._name },
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
  get id() { return this._id; },
  get contactID() { return this._contactID; }, 
  get kind() { return this._kind; },
  get value() { return this._value; },
  get isRelay() { return this._isRelay; },
  
  get contact() {
    if (this._contact == null) {
      this._contact = this._datastore.getContactByID(this._contactID);
    }
    return this._contact;
  },
};
