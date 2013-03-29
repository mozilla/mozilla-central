/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const EXPORTED_SYMBOLS = ['TagNoun'];

Components.utils.import("resource:///modules/mailServices.js");

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource:///modules/gloda/gloda.js");

/**
 * @namespace Tag noun provider.
 */
var TagNoun = {
  name: "tag",
  clazz: Ci.nsIMsgTag,
  usesParameter: true,
  allowsArbitraryAttrs: false,
  idAttr: "key",
  _msgTagService: null,
  _tagMap: null,
  _tagList: null,

  _init: function () {
    this._msgTagService = MailServices.tags;
    this._updateTagMap();
  },

  getAllTags: function gloda_noun_tag_getAllTags() {
    if (this._tagList == null)
      this._updateTagMap();
    return this._tagList;
  },

  _updateTagMap: function gloda_noun_tag_updateTagMap() {
    this._tagMap = {};
    let tagArray = this._tagList = this._msgTagService.getAllTags({});
    for (let iTag = 0; iTag < tagArray.length; iTag++) {
      let tag = tagArray[iTag];
      this._tagMap[tag.key] = tag;
    }
  },

  comparator: function gloda_noun_tag_comparator(a, b) {
    if (a == null) {
      if (b == null)
        return 0;
      else
        return 1;
    }
    else if (b == null) {
      return -1;
    }
    return a.tag.localeCompare(b.tag);
  },
  userVisibleString: function gloda_noun_tag_userVisibleString(aTag) {
    return aTag.tag;
  },

  // we cannot be an attribute value

  toParamAndValue: function gloda_noun_tag_toParamAndValue(aTag) {
    return [aTag.key, null];
  },
  toJSON: function gloda_noun_tag_toJSON(aTag) {
    return aTag.key;
  },
  fromJSON: function gloda_noun_tag_fromJSON(aTagKey, aIgnored) {
    let tag = this._tagMap.hasOwnProperty(aTagKey) ? this._tagMap[aTagKey]
                : undefined;
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
  /**
   * Convenience helper to turn a tag key into a tag name.
   */
  getTag: function gloda_noun_tag_getTag(aTagKey) {
    return this.fromJSON(aTagKey);
  }
};

TagNoun._init();
Gloda.defineNoun(TagNoun, Gloda.NOUN_TAG);
