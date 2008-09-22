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

EXPORTED_SYMBOLS = ['Tagged', 'TagNoun'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gloda/modules/gloda.js");

function Tagged(aTag, aDate) {
  this.tag = aTag;
  this.date = aDate;
}

Tagged.prototype = {
  toString: function () {
    return this.tag.tag;
  }
};

/**
 * We are the tag noun provider.  Since the tag unique value is stored as a
 *  parameter, we are an odd case and semantically confused.
 */
let TagNoun = {
  name: "tag",
  class: Tagged,
  firstClass: false,
  _msgTagService: null,
  
  _init: function () {
    this._msgTagService = Cc["@mozilla.org/messenger/tagservice;1"].
                          getService(Ci.nsIMsgTagService);
  },
  
  // we cannot be an attribute value
  
  toParamAndValue: function gloda_noun_tag_toParamAndValue(aTagged, aGeneric) {
    if (aGeneric)
      return [aTagged.tag.key, null];
    else
      return [aTagged.tag.key, aTagged.date.valueOf() * 1000];
  },
  
  fromParamAndValue: function gloda_noun_tag_fromParameterValue(aTagKey,
                                                                aPRTime) {
    // we have to walk the array to find our tag.  curse you, tag service!
    let tagService = Cc["@mozilla.org/messenger/tagservice;1"].
                          getService(Ci.nsIMsgTagService);
    let tagArray = tagService.getAllTags({});
    for (let iTag = 0; iTag < tagArray.length; iTag++) {
      let tag = tagArray[iTag];
      if (tag.key == aTagKey)
        return new Tagged(tag, new Date(aPRTime/1000));
    }
    // the tag has gone a-way, null is probably the safest thing to do.
    return null;
  },
};

TagNoun._init();
Gloda.defineNoun(TagNoun, Gloda.NOUN_TAG);
