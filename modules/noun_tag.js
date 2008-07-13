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

EXPORTED_SYMBOLS = [];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gloda/modules/gloda.js");

/**
 * We are the tag noun provider.  We deal in nsIMsgTag instances, at least
 *  until STEEL provides us with a better currency.
 * We are only intended to be used as an attribute parameter, not as an
 *  attribute value.  This is mainly because our unique value is a string,
 *  but the ramifications agree with us.  Namely, this allows the attribute
 *  value to be used to store the date the tag was applied, and we expect
 *  the number of user-defined tags to be reasonable enough to jive with
 *  limits on attribute parameterization.
 */
let TagNoun = {
  name: "tag",
  class: Ci.nsIMsgTag,
  firstClass: false,
  
  _msgTagService: null,
  _init: function () {
    this._msgTagService = Cc["@mozilla.org/messenger/tagservice;1"].
                          getService(Ci.nsIMsgTagService);
  },
  
  // we cannot be an attribute value
  
  toParameterValue: function gloda_noun_tag_toParameterValue(aMsgTag) {
    return aMsgTag.key;
  },
  
  fromParameterValue: function gloda_noun_tag_fromParameterValue(aTagKey) {
    // we have to walk the array to find our tag.  curse you, tag service!
    let tagArray = this._msgTagService.getAllTags({});
    for (let iTag=0; iTag < tagArray.length; iTag++) {
      let tag = tagArray[iTag];
      if (tag.key == aTagKey)
        return tag;
    }
    // the tag has gone a-way, null is probably the safest thing to do.
    return null;
  },
};

Gloda.defineNoun(TagNoun);
