

EXPORTED_SYMBOLS = ['Gloda'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://app/modules/gloda/gloda.js");
Cu.import("resource://app/modules/gloda/everybody.js");
Cu.import("resource://app/modules/gloda/indexer.js");

// an initial sweep is required.  this will not actually trigger anything if
//  things are disabled, of course.
// delay the initial sweep until after thunderbird has had a chance to start-up
//  fully.
let timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
timer.initWithCallback(function() {
    GlodaIndexer.indexingSweepNeeded = true;
    timer = null;
  },
  5000,
  Ci.nsITimer.TYPE_ONE_SHOT);

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
