/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const EXPORTED_SYMBOLS = ["Gloda"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource:///modules/gloda/gloda.js");
Cu.import("resource:///modules/gloda/everybody.js");
Cu.import("resource:///modules/gloda/indexer.js");
// initialize the indexer! (who was actually imported as a nested dep by the
//  things everybody.js imported.)  We waited until now so it could know about
//  its indexers.
GlodaIndexer._init();
Cu.import("resource:///modules/gloda/index_msg.js");

/**
 * Expose some junk
 */
function proxy(aSourceObj, aSourceAttr, aDestObj, aDestAttr) {
  aDestObj[aDestAttr] = function() {
    return aSourceObj[aSourceAttr].apply(aSourceObj, arguments);
  };
}

proxy(GlodaIndexer, "addListener", Gloda, "addIndexerListener");
proxy(GlodaIndexer, "removeListener", Gloda, "removeIndexerListener");
proxy(GlodaMsgIndexer, "isMessageIndexed", Gloda, "isMessageIndexed");
proxy(GlodaMsgIndexer, "setFolderIndexingPriority", Gloda,
      "setFolderIndexingPriority");
proxy(GlodaMsgIndexer, "resetFolderIndexingPriority", Gloda,
      "resetFolderIndexingPriority");
