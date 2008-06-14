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

EXPORTED_SYMBOLS = ["GlodaConversation", "GlodaMessage"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gloda/modules/log4moz.js");
const LOG = Log4Moz.Service.getLogger("gloda.datamodel");

function GlodaConversation (aDatastore, aID, aSubject, aOldestMessageDate,
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


function GlodaMessage (aDatastore, aID, aFolderID, aFolderURI, aMessageKey,
                       aConversationID, aConversation, aParentID,
                       aHeaderMessageID, aBodySnippet) {
  this._datastore = aDatastore;
  this._id = aID;
  this._folderID = aFolderID;
  this._folderURI = aFolderURI;
  this._messageKey = aMessageKey;
  this._conversationID = aConversationID;
  this._conversation = aConversation;
  this._parentID = aParentID;
  this._headerMessageID = aHeaderMessageID;
  this._bodySnippet = aBodySnippet;
  
  // for now, let's always cache this; they should really be forgetting about us
  //  if they want to forget about the underlying storage anyways...
  this._folderMessage = null;
}

GlodaMessage.prototype = {
  get id() { return this._id; },
  get folderID() { return this._folderID; },
  get messageKey() { return this._messageKey; },
  get conversationID() { return this._conversationID; },
  // conversation is special
  get parentID() { return this._parentID; },
  get headerMessageID() { return this._headerMessageID; },
  get bodySnippet() { return this._bodySnippet; },
  
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
  
  /**
   * Return the underlying nsIMsgDBHdr from the folder storage for this, or
   *  null if the message does not exist for one reason or another.
   */
  get folderMessage() {
    if (this._folderMessage != null)
      return this._folderMessage;
    if (this._folderURI == null || this._messageKey == null)
      return null;
  
    let rdfService = Cc['@mozilla.org/rdf/rdf-service;1'].
                     getService(Ci.nsIRDFService);
    let folder = rdfService.GetResource(this._folderURI);
    if (folder instanceof Ci.nsIMsgFolder) {
      this._folderMessage = folder.GetMessageHeader(this._messageKey);
      return this._folderMessage;
    }
    
    throw "Unable to locate folder message for: " + this._folderURI + ":" +
          this._messageKey;
  },
};