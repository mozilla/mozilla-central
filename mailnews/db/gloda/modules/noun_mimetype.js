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

Cu.import("resource://app/modules/gloda/log4moz.js");

const LOG = Log4Moz.repository.getLogger("gloda.noun.mimetype");

Cu.import("resource://app/modules/gloda/gloda.js");

/**
 * Mime type abstraction that exists primarily so we can map mime types to
 *  integer id's.
 *
 * Instances of this class should only be retrieved via |MimeTypeNoun|; no one
 *  should ever create an instance directly.
 */
function MimeType(aID, aType, aSubType, aFullType) {
  this._id = aID;
  this._type = aType;
  this._subType = aSubType;
  this._fullType = aFullType;
}

MimeType.prototype = {
  /**
   * The integer id we have associated with the mime type.  This is stable for
   *  the lifetime of the database, which means that anything in the Gloda
   *  database can use this without fear.  Things not persisted in the database
   *  should use the actual string mime type, retrieval via |fullType|.
   */
  get id() { return this._id; },
  /**
   * The first part of the MIME type; "text/plain" gets you "text".
   */
  get type() { return this._type; },
  set fullType(aFullType) {
    if (!this._fullType) {
      this._fullType = aFullType;
      [this._type, this._subType] = this._fullType.split("/");
    }
  },
  /**
   * If the |fullType| is "text/plain", subType is "plain".
   */
  get subType() { return this._subType; },
  /**
   * The full MIME type; "text/plain" returns "text/plain".
   */
  get fullType() { return this._fullType; },
  toString: function () {
    return this.fullType;
  }
};

/**
 * @namespace Mime type noun provider.
 *
 * The set of MIME Types is sufficiently limited that we can keep them all in
 *  memory.  In theory it is also sufficiently limited that we could use the
 *  parameter mechanism in the database.  However, it is more efficient, for
 *  both space and performance reasons, to store the specific mime type as a
 *  value.  For future-proofing reasons, we opt to use a database table to
 *  persist the mapping rather than a hard-coded list.  A preferences file or
 *  other text file would arguably suffice, but for consistency reasons, the
 *  database is not a bad thing.
 */
var MimeTypeNoun = {
  name: "mime-type",
  clazz: MimeType, // gloda supports clazz as well as class
  allowsArbitraryAttrs: false,

  // note! update test_noun_mimetype if you change our internals!
  _mimeTypes: {},
  _mimeTypesByID: {},
  TYPE_BLOCK_SIZE: 8096, // bet you were expecting a power of 2!
    // (we can fix this next time we bump the database schema version and have
    //  to resort to blowing the database away.)
  _mimeTypeHighID: {},
  _highID: 0,

  // we now use the exciting 'schema' mechanism of defineNoun to get our table
  //  created for us, plus some helper methods that we simply don't use.
  schema: {
    name: 'mimeTypes',
    columns: [['id', 'INTEGER PRIMARY KEY', '_id'],
              ['mimeType', 'TEXT', 'fullType']],
  },

  _init: function() {
    LOG.debug("loading MIME types");
    this._loadMimeTypes();
  },

  _loadMimeTypes: function() {
    // get all the existing mime types!
    let query = Gloda.newQuery(this.id);
    let nullFunc = function() {};
    query.getCollection({
      onItemsAdded: nullFunc, onItemsModified: nullFunc, onItemsRemoved: null,
      onQueryCompleted: function (aCollection) {
        MimeTypeNoun._processMimeTypes(aCollection.items);
      }
    }, null).becomeExplicit();
  },

  _processMimeTypes: function(aMimeTypes) {
    for each (let [, mimeType] in Iterator(aMimeTypes)) {
      if (mimeType.id > this._highID)
        this._highID = mimeType.id;
      this._mimeTypes[mimeType] = mimeType;
      this._mimeTypesByID[mimeType.id] = mimeType;

      let typeBlock = mimeType.id - (mimeType.id % this.TYPE_BLOCK_SIZE);
      let blockHighID = this._mimeTypeHighID[mimeType.type];
      if ((blockHighID === undefined) || mimeType.id > blockHighID)
        this._mimeTypeHighID[mimeType.type] = mimeType.id;
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

    // as great as the gloda extension mechanisms are, we don't think it makes
    //  a lot of sense to use them in this case.  So we directly trigger object
    //  insertion without any of the grokNounItem stuff.
    this.objInsert.call(this.datastore, mimeType);

    return mimeType;
  },

  /**
   * Map a mime type to a |MimeType| instance, creating it if necessary.
   *
   * @param aMimeTypeName The mime type.  It may optionally include parameters
   *     (which will be ignored).  A mime type is of the form "type/subtype".
   *     A type with parameters would look like 'type/subtype; param="value"'.
   */
  getMimeType: function(aMimeTypeName) {
    // first, lose any parameters
    let semiIndex = aMimeTypeName.indexOf(";");
    if (semiIndex >= 0)
      aMimeTypeName = aMimeTypeName.substring(0, semiIndex);
    aMimeTypeName = aMimeTypeName.trim().toLowerCase();

    if (aMimeTypeName in this._mimeTypes)
      return this._mimeTypes[aMimeTypeName];
    else
      return this._addNewMimeType(aMimeTypeName);
  },

  toParamAndValue: function gloda_noun_mimeType_toParamAndValue(aMimeType) {
    return [null, aMimeType.id];
  },
  toJSON: function gloda_noun_mimeType_toJSON(aMimeType) {
    return aMimeType.id;
  },
  fromJSON: function gloda_noun_mimeType_fromJSON(aMimeTypeID) {
    return this._mimeTypesByID[aMimeTypeID];
  },
};
Gloda.defineNoun(MimeTypeNoun, Gloda.NOUN_MIME_TYPE);
try {
MimeTypeNoun._init();
} catch (ex) {
  LOG.error("problem init-ing: " + ex.fileName + ":" + ex.lineNumber + ": " + ex);
}
