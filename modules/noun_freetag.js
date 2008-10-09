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

EXPORTED_SYMBOLS = ['FreeTag', 'FreeTagNoun'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gloda/modules/gloda.js");

function FreeTag(aTagName) {
  this.name = aTagName;
}

FreeTag.prototype = {
  toString: function () {
    return this.name;
  }
};

/**
 * @namespace Tag noun provider.  Since the tag unique value is stored as a
 *  parameter, we are an odd case and semantically confused.
 */
var FreeTagNoun = {
  name: "freetag",
  class: FreeTag,
  firstClass: false,
  
  _listeners: [],
  addListener: function(aListener) {
    this._listeners.push(aListener);
  },
  removeListener: function(aListener) {
    let index = this._listeners.indexOf(aListener);
    if (index >=0)
      this._listeners.splice(index, 1);
  },
  
  knownFreeTags: {},
  getFreeTag: function(aTagName) {
    let tag = this.knownFreeTags[aTagName];
    if (!tag) {
      tag = this.knownFreeTags[aTagName] = new FreeTag(aTagName);
      for each (let [iListener, listener] in Iterator(this._listeners))
        listener.onFreeTagAdded(tag);
    }
    return tag;
  },

  toParamAndValue: function gloda_noun_tag_toParamAndValue(aTag) {
    return [aTag.name, null];
  },
  
  fromParamAndValue: function gloda_noun_tag_fromParameterValue(aTagName,
                                                                aIgnored) {
    return this.getFreeTag(aTagName);
  },
};

Gloda.defineNoun(FreeTagNoun);
