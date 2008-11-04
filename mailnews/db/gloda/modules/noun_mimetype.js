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

EXPORTED_SYMBOLS = ['MimeType', 'MimeTypeNoun'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gloda/modules/log4moz.js");

const LOG = Log4Moz.Service.getLogger("gloda.noun.mimetype");

Cu.import("resource://gloda/modules/gloda.js");

function MimeType(aID, aType, aSubType, aFullType) {
  this._id = aID;
  this._type = aType;
  this._subType = aSubType;
  this._fullType = aFullType;
}

MimeType.prototype = {
  get id() { return this._id; },
  get type() { return this._type; },
  get subType() { return this._subType; },
  get fullType() { return this._fullType; },
  toString: function () {
    return this.fullType;
  }
};

/**
 * @namespace Mime type noun provider.  Uses datastore mechanisms to define its
 *  table.
 * 
 * The set of MIME Types is sufficiently limited that we can keep them all in
 *  memory.  In theory it is also sufficiently limited that we could use the
 *  parameter mechanism in the database.  However, it is more efficient, for
 *  both space and performance reasons, to store the specific mime type as a
 *  value.  For future-proofing reasons, we opt use a database table to
 *  persist the mapping rather than a hard-coded list.  A preferences file or
 *  other text file would arguably suffice, but for consistency reasons, the
 *  database is not a bad thing.
 */
var MimeTypeNoun = {
  name: "mime-type",
  class: MimeType,
  allowsArbitraryAttrs: false,
  
  _mimeTypes: {},
  _mimeTypesByID: {},
  TYPE_BLOCK_SIZE: 8096,
  _mimeTypeHighID: {},
  _highID: 0,
  
  _init: function() {
    LOG.debug("initializing table definition");
    this._tableMimeTypes = Gloda.defineTable({
      name: 'mimeTypes',
      columns: [['id', 'INTEGER PRIMARY KEY'],
                ['mimeType', 'TEXT']],
    });
    LOG.debug("loading MIME types");
    this._loadMimeTypes();
  },
  
  _loadMimeTypes: function() {
    this._tableMimeTypes.select(null, null, this, this._processMimeTypes);
  },
  
  _processMimeTypes: function(aRows, aDone) {
    for each (let [, row] in Iterator(aRows)) {
      if (row.id > this._highID)
        this._highID = row.id;
      let [typeName, subTypeName] = row.mimeType.split("/");
      let mimeType = new MimeType(row.id, typeName, subTypeName, row.mimeType);
      this._mimeTypes[mimeType] = mimeType;
      this._mimeTypesByID[mimeType.id] = mimeType;
      
      let typeBlock = mimeType.id - (mimeType.id % this.TYPE_BLOCK_SIZE);
      let blockHighID = this._mimeTypeHighID[typeName];
      if ((blockHighID === undefined) || mimeType.id > blockHighID)
        this._mimeTypeHighID[typeName] = mimeType.id;
    }
  },
  
  _addNewMimeType: function(aMimeTypeName) {
    let [typeName, subTypeName] = aMimeTypeName.split("/");
    
    if (!(typeName in this._mimeTypeHighID)) {
      let nextID = this._highID - (this._highID % this.TYPE_BLOCK_SIZE) +
        this.TYPE_BLOCK_SIZE;
      this._mimeTypeHighID[typeName] = nextID;
    }
    
    let nextID = ++this._mimeTypeHighID[typeName];
    
    let mimeType = new MimeType(nextID, typeName, subTypeName, aMimeTypeName);
    if (mimeType.id > this._highID)
      this._highID = mimeType.id;
    
    this._mimeTypes[aMimeTypeName] = mimeType;
    this._mimeTypesByID[nextID] = mimeType;
    
    this._tableMimeTypes.insert([{id: nextID, mimeType: aMimeTypeName}]);
    
    return mimeType;
  },
  
  getMimeType: function(aMimeTypeName) {
    // first, lose any parameters
    let semiIndex = aMimeTypeName.indexOf(";");
    if (semiIndex >= 0)
      aMimeTypeName = aMimeTypeName.substring(semiIndex);
    aMimeTypeName = aMimeTypeName.trim().toLowerCase();
    
    let mimeType = this._mimeTypes[aMimeTypeName];
    if (mimeType)
      return mimeType;
    else
      return this._addNewMimeType(aMimeTypeName);
  },

  toParamAndValue: function gloda_noun_freetag_toParamAndValue(aMimeType) {
    return [null, aMimeType.id];
  },
  toJSON: function gloda_noun_freetag_toJSON(aMimeType) {
    return aMimeType.id;
  },
  fromJSON: function gloda_noun_freetag_fromJSON(aMimeTypeID) {
    return this._mimeTypesByID[aMimeTypeID];
  },
};
try {
MimeTypeNoun._init();
} catch (ex) {
  LOG.error("problem init-ing: " + ex.fileName + ":" + ex.lineNumber + ": " + ex);
}
Gloda.defineNoun(MimeTypeNoun, Gloda.NOUN_MIME_TYPE);
