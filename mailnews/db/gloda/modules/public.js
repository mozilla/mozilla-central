

EXPORTED_SYMBOLS = ['Gloda'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://app/modules/gloda/gloda.js");
Cu.import("resource://app/modules/gloda/everybody.js");
Cu.import("resource://app/modules/gloda/indexer.js");

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
