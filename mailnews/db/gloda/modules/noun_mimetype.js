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
Cu.import("resource://app/modules/StringBundle.js");

const LOG = Log4Moz.repository.getLogger("gloda.noun.mimetype");

Cu.import("resource://app/modules/gloda/gloda.js");

let CategoryStringMap = {};

/**
 * Mime type abstraction that exists primarily so we can map mime types to
 *  integer id's.
 *
 * Instances of this class should only be retrieved via |MimeTypeNoun|; no one
 *  should ever create an instance directly.
 */
function MimeType(aID, aType, aSubType, aFullType, aCategory) {
  this._id = aID;
  this._type = aType;
  this._subType = aSubType;
  this._fullType = aFullType;
  this._category = aCategory;
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
      this._category =
        MimeTypeNoun._getCategoryForMimeType(aFullType, this._type);
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
  },

  /**
   * @return the category we believe this mime type belongs to.  This category
   *     name should never be shown directly to the user.  Instead, use
   *     |categoryLabel| to get the localized name for the category.  The
   *     category mapping comes from mimeTypesCategories.js.
   */
  get category() {
    return this._category;
  },
  /**
   * @return The localized label for the category from gloda.properties in the
   *     "gloda.mimetype.category.CATEGORY.label" definition using the value
   *     from |category|.
   */
  get categoryLabel() {
    return CategoryStringMap[this._category];
  }
};

/**
 * Mime type noun provider.
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

  _strings: new StringBundle("chrome://messenger/locale/gloda.properties"),

  // note! update test_noun_mimetype if you change our internals!
  _mimeTypes: {},
  _mimeTypesByID: {},
  TYPE_BLOCK_SIZE: 16384,
  _mimeTypeHighID: {},
  _mimeTypeRangeDummyObjects: {},
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
    this._loadCategoryMapping();
    this._loadMimeTypes();
  },

  /**
   * A map from MIME type to category name.
   */
  _mimeTypeToCategory: {},
  /**
   * Load the contents of mimeTypeCategories.js and populate
   */
  _loadCategoryMapping: function MimeTypeNoun__loadCategoryMapping() {
    let mimecatNS = {};
    Cu.import("resource://app/modules/gloda/mimeTypeCategories.js",
              mimecatNS);
    let mcm = mimecatNS.MimeCategoryMapping;

    let mimeTypeToCategory = this._mimeTypeToCategory;

    function procMapObj(aSubTree, aCategories) {
      for each (let [key, value] in Iterator(aSubTree)) {
        // Add this category to our nested categories list.  Use concat since
        //  the list will be long-lived and each list needs to be distinct.
        let categories = aCategories.concat();
        categories.push(key);

        if (categories.length == 1) {
          CategoryStringMap[key] =
            MimeTypeNoun._strings.get(
              "gloda.mimetype.category." + key + ".label");
        }

        // Is it an array?  (We do not have isArray in 1.9.1 and since it comes
        //  from another JS module, it has its own Array global, so instanceof
        //  fails us.)  If it is, just process this depth
        if ("length" in value) {
          for each (let [, mimeTypeStr] in Iterator(value)) {
            mimeTypeToCategory[mimeTypeStr] = categories;
          }
        }
        // it's yet another sub-tree branch
        else {
          procMapObj(value, categories);
        }
      }
    }

    procMapObj(mimecatNS.MimeCategoryMapping, []);
  },

  /**
   * Lookup the category associated with a MIME type given its full type and
   *  type.  (So, "foo/bar" and "foo" for "foo/bar".)
   */
  _getCategoryForMimeType:
      function MimeTypeNoun__getCategoryForMimeType(aFullType, aType) {
    if (aFullType in this._mimeTypeToCategory)
      return this._mimeTypeToCategory[aFullType][0];
    let wildType = aType + "/*";
    if (wildType in this._mimeTypeToCategory)
      return this._mimeTypeToCategory[wildType][0];
    return this._mimeTypeToCategory["*"][0];
  },

  /**
   * In order to allow the gloda query mechanism to avoid hitting the database,
   *  we need to either define the noun type as cachable and have a super-large
   *  cache or simply have a collection with every MIME type in it that stays
   *  alive forever.
   * This is that collection.  It is initialized by |_loadMimeTypes|.  As new
   *  MIME types are created, we add them to the collection.
   */
  _universalCollection: null,

  /**
   * Kick off a query of all the mime types in our database, leaving
   *  |_processMimeTypes| to actually do the legwork.
   */
  _loadMimeTypes: function MimeTypeNoun__loadMimeTypes() {
    // get all the existing mime types!
    let query = Gloda.newQuery(this.id);
    let nullFunc = function() {};
    this._universalCollection = query.getCollection({
      onItemsAdded: nullFunc, onItemsModified: nullFunc,
      onItemsRemoved: nullFunc,
      onQueryCompleted: function (aCollection) {
        MimeTypeNoun._processMimeTypes(aCollection.items);
      }
    }, null);
  },

  /**
   * For the benefit of our Category queryHelper, we need dummy ranged objects
   *  that cover the numerical address space allocated to the category.  We
   *  can't use a real object for the upper-bound because the upper-bound is
   *  constantly growing and there is the chance the query might get persisted,
   *  which means these values need to be long-lived.  Unfortunately, our
   *  solution to this problem (dummy objects) complicates the second case,
   *  should it ever occur.  (Because the dummy objects cannot be persisted
   *  on their own... but there are other issues that will come up that we will
   *  just have to deal with then.)
   */
  _createCategoryDummies: function (aId, aCategory) {
    let blockBottom = aId - (aId % this.TYPE_BLOCK_SIZE);
    let blockTop = blockBottom + this.TYPE_BLOCK_SIZE - 1;
    this._mimeTypeRangeDummyObjects[aCategory] = [
      new MimeType(blockBottom, "!category-dummy!", aCategory,
                   "!category-dummy!/" + aCategory, aCategory),
      new MimeType(blockTop, "!category-dummy!", aCategory,
                   "!category-dummy!/" + aCategory, aCategory)
    ];
  },

  _processMimeTypes: function MimeTypeNoun__processMimeTypes(aMimeTypes) {
    for each (let [, mimeType] in Iterator(aMimeTypes)) {
      if (mimeType.id > this._highID)
        this._highID = mimeType.id;
      this._mimeTypes[mimeType] = mimeType;
      this._mimeTypesByID[mimeType.id] = mimeType;

      let typeBlock = mimeType.id - (mimeType.id % this.TYPE_BLOCK_SIZE);
      let blockHighID = (mimeType.category in this._mimeTypeHighID) ?
                          this._mimeTypeHighID[mimeType.category] : undefined;
      // create the dummy range objects
      if (blockHighID === undefined)
        this._createCategoryDummies(mimeType.id, mimeType.category);
      if ((blockHighID === undefined) || mimeType.id > blockHighID)
        this._mimeTypeHighID[mimeType.category] = mimeType.id;
    }
  },

  _addNewMimeType: function MimeTypeNoun__addNewMimeType(aMimeTypeName) {
    let [typeName, subTypeName] = aMimeTypeName.split("/");
    let category = this._getCategoryForMimeType(aMimeTypeName, typeName);

    if (!(category in this._mimeTypeHighID)) {
      let nextID = this._highID - (this._highID % this.TYPE_BLOCK_SIZE) +
        this.TYPE_BLOCK_SIZE;
      this._mimeTypeHighID[category] = nextID;
      this._createCategoryDummies(nextID, category);
    }

    let nextID = ++this._mimeTypeHighID[category];

    let mimeType = new MimeType(nextID, typeName, subTypeName, aMimeTypeName,
                                category);
    if (mimeType.id > this._highID)
      this._highID = mimeType.id;

    this._mimeTypes[aMimeTypeName] = mimeType;
    this._mimeTypesByID[nextID] = mimeType;

    // As great as the gloda extension mechanisms are, we don't think it makes
    //  a lot of sense to use them in this case.  So we directly trigger object
    //  insertion without any of the grokNounItem stuff.
    this.objInsert.call(this.datastore, mimeType);
    // Since we bypass grokNounItem and its fun, we need to explicitly add the
    //  new MIME-type to _universalCollection ourselves.  Don't try this at
    //  home, kids.
    this._universalCollection._onItemsAdded([mimeType]);

    return mimeType;
  },

  /**
   * Map a mime type to a |MimeType| instance, creating it if necessary.
   *
   * @param aMimeTypeName The mime type.  It may optionally include parameters
   *     (which will be ignored).  A mime type is of the form "type/subtype".
   *     A type with parameters would look like 'type/subtype; param="value"'.
   */
  getMimeType: function MimeTypeNoun_getMimeType(aMimeTypeName) {
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

  /**
   * Query helpers contribute additional functions to the query object for the
   *  attributes that use the noun type.  For example, we define Category, so
   *  for the "attachmentTypes" attribute, "attachmentTypesCategory" would be
   *  exposed.
   */
  queryHelpers: {
    /**
     * Query for MIME type categories based on one or more MIME type objects
     *  passed in.  We want the range to span the entire block allocated to the
     *  category.
     *
     * @param aAttrDef The attribute that is using us.
     * @param aArguments The actual arguments object that
     */
    Category: function(aAttrDef, aArguments) {
      let rangePairs = [];
      // If there are no arguments then we want to fall back to the 'in'
      //  constraint which matches on any attachment.
      if (aArguments.length == 0)
        return this._inConstraintHelper(aAttrDef, []);

      for (let iArg = 0; iArg < aArguments.length; iArg++) {
        let arg = aArguments[iArg];
        rangePairs.push(MimeTypeNoun._mimeTypeRangeDummyObjects[arg.category]);
      }
      return this._rangedConstraintHelper(aAttrDef, rangePairs);
    }
  },

  comparator: function gloda_noun_mimeType_comparator(a, b) {
    if (a == null) {
      if (b == null)
        return 0;
      else
        return 1;
    }
    else if (b == null) {
      return -1;
    }
    return a.fullType.localeCompare(b.fullType);
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
