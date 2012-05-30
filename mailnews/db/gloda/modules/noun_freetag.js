/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const EXPORTED_SYMBOLS = ['FreeTag', 'FreeTagNoun'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource:///modules/gloda/log4moz.js");

Cu.import("resource:///modules/gloda/gloda.js");

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
  _log: Log4Moz.repository.getLogger("gloda.noun.freetag"),

  name: "freetag",
  clazz: FreeTag,
  allowsArbitraryAttrs: false,
  usesParameter: true,

  _listeners: [],
  addListener: function(aListener) {
    this._listeners.push(aListener);
  },
  removeListener: function(aListener) {
    let index = this._listeners.indexOf(aListener);
    if (index >=0)
      this._listeners.splice(index, 1);
  },

  populateKnownFreeTags: function() {
    for each (let [,attr] in Iterator(this.objectNounOfAttributes)) {
      let attrDB = attr.dbDef;
      for (let param in attrDB.parameterBindings) {
        this.getFreeTag(param);
      }
    }
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

  comparator: function gloda_noun_freetag_comparator(a, b) {
    if (a == null) {
      if (b == null)
        return 0;
      else
        return 1;
    }
    else if (b == null) {
      return -1;
    }
    return a.name.localeCompare(b.name);
  },

  toParamAndValue: function gloda_noun_freetag_toParamAndValue(aTag) {
    return [aTag.name, null];
  },

  toJSON: function gloda_noun_freetag_toJSON(aTag) {
    return aTag.name;
  },
  fromJSON: function gloda_noun_freetag_fromJSON(aTagName) {
    return this.getFreeTag(aTagName);
  },
};

Gloda.defineNoun(FreeTagNoun);
