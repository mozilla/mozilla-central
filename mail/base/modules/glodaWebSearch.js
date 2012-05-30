/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const EXPORTED_SYMBOLS = ["GlodaWebSearch"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

function ResultRowSingle(term) {
  this.term = term;
  this.typeForStyle = "websearch";
  this.nounDef = null;
}

ResultRowSingle.prototype = {
  multi: false,
  fullText: false,
};

function GlodaWebSearchCompleter() { }

GlodaWebSearchCompleter.prototype = {
  complete: function GlodaWebSearchCompleter_complete(aResult, aString) {
    aResult.addRows([new ResultRowSingle(aString)]);
    // We have nothing pending.
    return false;
  },
  onItemsAdded: function(aItems, aCollection) {
  },
  onItemsModified: function(aItems, aCollection) {
  },
  onItemsRemoved: function(aItems, aCollection) {
  },
  onQueryCompleted: function(aCollection) {
  }
};

var GlodaWebSearch = {
  bundle: Services.strings.createBundle(
    "chrome://messenger/locale/glodaComplete.properties"),

  _initialized: false,

  onLoad: function() {
    if (this._initialized)
      return;
    this._initialized = true;

    Services.obs.addObserver(this, "autocomplete-did-enter-text", false);
    this.glodaCompleter = Cc["@mozilla.org/autocomplete/search;1?name=gloda"]
                            .getService().wrappedJSObject;

    // Add us as the second completer.
    this.glodaCompleter.completers.splice(1, 0, new GlodaWebSearchCompleter());
  },

  observe: function(aSubject, aTopic, aData) {
    if (aTopic == "autocomplete-did-enter-text") {
      let curResult = this.glodaCompleter.curResult;
      if (!curResult)
        return; // autocomplete didn't even finish.

      let row = curResult.getObjectAt(aSubject.popup.selectedIndex);
      if (!row || (row.typeForStyle != "websearch"))
        return; // It's not our row.

      let ownerWindow = aSubject.ownerDocument.defaultView;
      ownerWindow.openSearchTab(aSubject.state.string);
    }
  },
};
