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

const EXPORTED_SYMBOLS = ["GlodaDatabind"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://app/modules/gloda/log4moz.js");

let DBC_LOG = Log4Moz.repository.getLogger("gloda.ds.dbc");

function GlodaDatabind(aNounDef, aDatastore) {
  this._nounDef = aNounDef;
  this._tableName = aNounDef.tableName;
  this._tableDef = aNounDef.schema;
  this._datastore = aDatastore;
  this._log = Log4Moz.repository.getLogger("gloda.databind." + this._tableName);

  // process the column definitions and make sure they have an attribute mapping
  for each (let [iColDef, coldef] in Iterator(this._tableDef.columns)) {
    // default to the other dude's thing.
    if (coldef.length < 3)
      coldef[2] = coldef[0];
    if (coldef[0] == "id")
      this._idAttr = coldef[2];
    // colDef[3] is the index of us in our SQL bindings, storage-numbering
    coldef[3] = iColDef;
  }

  // XXX This is obviously synchronous and not perfectly async.  Since we are
  //  doing this, we don't actually need to move to ordinal binding below
  //  since we could just as well compel creation of the name map and thereby
  //  avoid ever acquiring the mutex after bootstrap.
  // However, this specific check can be cleverly avoided with future work.
  // Namely, at startup we can scan for extension-defined tables and get their
  //  maximum id so that we don't need to do it here.  The table will either
  //  be brand new and thus have a maximum id of 1 or we will already know it
  //  because of that scan.
  this._nextId = 1;
  let stmt = this._datastore._createSyncStatement(
    "SELECT MAX(id) FROM " + this._tableName, true);
  if (stmt.executeStep()) {  // no chance of this SQLITE_BUSY on this call
    this._nextId = stmt.getInt64(0) + 1;
  }
  stmt.finalize();

  let insertSql = "INSERT INTO " + this._tableName + " (" +
    [coldef[0] for each
     ([, coldef] in Iterator(this._tableDef.columns))].join(", ") +
    ") VALUES (" +
    [("?" + (iColDef + 1)) for each
     ([iColDef, coldef] in Iterator(this._tableDef.columns))].join(", ") +
    ")";

  // For the update, we want the 'id' to be a constraint and not a value
  //  that gets set...
  let updateSql = "UPDATE " + this._tableName + " SET " +
    [(coldef[0] + " = ?" + (iColDef + 1)) for each
     ([iColDef, coldef] in Iterator(this._tableDef.columns)) if
     (coldef[0] != "id")].join(", ") +
    " WHERE id = ?1";
  this._insertStmt = aDatastore._createAsyncStatement(insertSql);
  this._updateStmt = aDatastore._createAsyncStatement(updateSql);

  if (this._tableDef.fulltextColumns) {
    for each (let [iColDef, coldef] in
              Iterator(this._tableDef.fulltextColumns)) {
      if (coldef.length < 3)
        coldef[2] = coldef[0];
      // colDef[3] is the index of us in our SQL bindings, storage-numbering
      coldef[3] = iColDef + 1;
    }

    let insertFulltextSql = "INSERT INTO " + this._tableName + "Text (docid," +
      [coldef[0] for each
       ([, coldef] in Iterator(this._tableDef.fulltextColumns))].join(", ") +
      ") VALUES (?1," +
      // +2 instead of +1 because docid is implied
      [("?" + (i + 2)) for each
       ([i, coldef] in Iterator(this._tableDef.fulltextColumns))].join(", ") +
      ")";

    // For the update, we want the 'id' to be a constraint and not a value
    //  that gets set...
    let updateFulltextSql = "UPDATE " + this._tableName + "Text SET " +
      // +2 instead of +1 because docid is implied
      [(coldef[0] + "= ?" + (iColDef + 2)) for each
       ([iColDef, coldef] in Iterator(this._tableDef.fulltextColumns)) if
       (coldef[0] != "id")].join(", ") +
      " WHERE docid = ?1";

    this._insertFulltextStmt =
      aDatastore._createAsyncStatement(insertFulltextSql);
    this._updateFulltextStmt =
      aDatastore._createAsyncStatement(updateFulltextSql);
  }
}

GlodaDatabind.prototype = {
  /**
   * Perform appropriate binding coercion based on the schema provided to us.
   * Although we end up effectively coercing JS Date objects to numeric values,
   *  we should not be provided with JS Date objects!  There is no way for us
   *  to know to turn them back into JS Date objects on the way out.
   *  Additionally, there is the small matter of storage's bias towards
   *  PRTime representations which may not always be desirable.
   */
  bindByType: function(aStmt, aColDef, aValue) {
    if (aValue == null)
      aStmt.bindNullParameter(aColDef[3]);
    else if (aColDef[1] == "STRING" || aColDef[1] == "TEXT")
      aStmt.bindStringParameter(aColDef[3], aValue);
    else
      aStmt.bindInt64Parameter(aColDef[3], aValue);
  },

  objFromRow: function(aRow) {
    let getVariant = this._datastore._getVariant;
    let obj = new this._nounDef.class();
    for each (let [iCol, colDef] in Iterator(this._tableDef.columns)) {
      obj[colDef[2]] = getVariant(aRow, iCol);
    }
    return obj;
  },

  objInsert: function(aThing) {
    let bindByType = this.bindByType;
    if (!aThing[this._idAttr])
      aThing[this._idAttr] = this._nextId++;

    let stmt = this._insertStmt;
    for each (let [iColDef, colDef] in Iterator(this._tableDef.columns)) {
      bindByType(stmt, colDef, aThing[colDef[2]]);
    }

    stmt.executeAsync(this._datastore.trackAsync());

    if (this._insertFulltextStmt) {
      stmt = this._insertFulltextStmt;
      stmt.bindInt64Parameter(0, aThing[this._idAttr]);
      for each (let [iColDef, colDef] in
                Iterator(this._tableDef.fulltextColumns)) {
        bindByType(stmt, colDef, aThing[colDef[2]]);
      }
      stmt.executeAsync(this._datastore.trackAsync());
    }
  },

  objUpdate: function(aThing) {
    let bindByType = this.bindByType;
    let stmt = this._updateStmt;
    // note, we specially bound the location of 'id' for the insert, but since
    //  we're using named bindings, there is nothing special about setting it
    for each (let [iColDef, colDef] in Iterator(this._tableDef.columns)) {
      bindByType(stmt, colDef, aThing[colDef[2]]);
    }
    stmt.executeAsync(this._datastore.trackAsync());

    if (this._updateFulltextStmt) {
      stmt = this._updateFulltextStmt;
      // fulltextColumns does't include id/docid, need to explicitly set it
      stmt.bindInt64Parameter(0, aThing[this._idAttr]);
      for each (let [iColDef, colDef] in
                Iterator(this._tableDef.fulltextColumns)) {
        bindByType(stmt, colDef, aThing[colDef[2]]);
      }
      stmt.executeAsync(this._datastore.trackAsync());
    }
  },

  adjustAttributes: function() {
    // just proxy the call over to the datastore... we have to do this for
    //  'this' reasons.  we don't refactor things to avoid this because it does
    //  make some sense to have all the methods exposed from a single object,
    //  even if the implementation does live elsewhere.
    return this._datastore.adjustAttributes.apply(this._datastore, arguments);
  },

  // also proxied...
  queryFromQuery: function() {
    return this._datastore.queryFromQuery.apply(this._datastore, arguments);
  }
};
