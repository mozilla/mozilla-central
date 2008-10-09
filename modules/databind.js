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

EXPORTED_SYMBOLS = ["GlodaDatabind"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gloda/modules/log4moz.js");

function GlodaDatabind(aTableDef, aDatastore) {
  this._tableDef = aTableDef;
  this._datastore = aDatastore;
  this._log = Log4Moz.Service.getLogger("gloda.databind." + aTableDef.name);
  
  let insertSql = "INSERT INTO " + this._tableDef._realName + " (" +
    [coldef[0] for each
     ([i, coldef] in Iterator(this._tableDef.columns))].join(", ") +
    ") VALUES (" +
    [(":" + coldef[0]) for each
     ([i, coldef] in Iterator(this._tableDef.columns))].join(", ") +
    ")";
  
  this._insertStmt = aDatastore._createStatement(insertSql);
  
  this._stmtCache = {};
}

GlodaDatabind.prototype = {
  
  getHighId: function(aLessThan) {
    let sql = "select MAX(id) AS m_id FROM " + this._tableDef._realName;
    if (aLessThan !== undefined)
      sql += " WHERE id < " + aLessThan;
  dump("SQL: " + sql);
    let stmt = this._datastore._createStatement(sql);
  dump("created\n");
    let highId = 0;
    if (stmt.step()) {
      dump("stepped, retrieving\n");
      highId = stmt.row["m_id"];
    }
    stmt.reset();
    
    return highId;
  },
  
  selectOne: function(aColName, aColValue) {
    let stmt;
    if (!(aColName in this._stmtCache)) {
      stmt = this._datastore._createStatement("SELECT * FROM " +
        this._tableDef._realName + " WHERE " + aColName + " = :value");
      this._stmtCache[aColName] = stmt;
    }
    else
      stmt = this._stmtCache[aColName];
    
    // so, we're tricky-like and lazy and actually return the row, so we don't
    //  want to reset until the user tries to use the statement again, as I
    //  fear we would otherwise lose our awesome row binding (and have to copy
    //  it, etc.)
    stmt.reset();
    
    stmt.params.value = aColValue;
    let row = null;
    if (stmt.step())
      row = stmt.row;
    
    return row;
  },
  
  insert: function(aValueDict) {
    let stmt = this._insertStmt;
    for each (let [iColDef, colDef] in Iterator(this._tableDef.columns)) {
      this._log.debug("insert arg: " + colDef[0] + "=" + aValueDict[colDef[0]]);
      stmt.params[colDef[0]] = aValueDict[colDef[0]];
    }
    stmt.execute();
  }
};
