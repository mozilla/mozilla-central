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

EXPORTED_SYMBOLS = ['TagNoun'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://app/modules/gloda/gloda.js");

/**
 * @namespace Tag noun provider.
 */
var TagNoun = {
  name: "tag",
  class: Ci.nsIMsgTag,
  usesParameter: true,
  allowsArbitraryAttrs: false,
  _msgTagService: null,
  _tagMap: null,
  
  _init: function () {
    this._msgTagService = Cc["@mozilla.org/messenger/tagservice;1"].
                          getService(Ci.nsIMsgTagService);
    this._updateTagMap();
  },
  
  getAllTags: function gloda_noun_tag_getAllTags() {
    return this._msgTagService.getAllTags({});
  },
  
  _updateTagMap: function gloda_noun_tag_updateTagMap() {
    this._tagMap = {};
    let tagArray = this._msgTagService.getAllTags({});
    for (let iTag = 0; iTag < tagArray.length; iTag++) {
      let tag = tagArray[iTag];
      this._tagMap[tag.key] = tag;
    }
  },
  
  // we cannot be an attribute value
  
  toParamAndValue: function gloda_noun_tag_toParamAndValue(aTag) {
    return [aTag.key, null];
  },
  toJSON: function gloda_noun_tag_toJSON(aTag) {
    return aTag.key;
  },
  fromJSON: function gloda_noun_tag_fromJSON(aTagKey, aIgnored) {
    let tag = this._tagMap[aTagKey];
    // you will note that if a tag is removed, we are unable to aggressively
    //  deal with this.  we are okay with this, but it would be nice to be able
    //  to listen to the message tag service to know when we should rebuild.
    if ((tag === undefined) && this._msgTagService.isValidKey(aTagKey)) {
      this._updateTagMap();
      tag = this._tagMap[aTagKey];
    }
    // we intentionally are returning undefined if the tag doesn't exist
    return tag;
  },
};

TagNoun._init();
Gloda.defineNoun(TagNoun, Gloda.NOUN_TAG);
