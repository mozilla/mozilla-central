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
 * The Original Code is Mozilla Thunderbird.
 *
 * The Initial Developer of the Original Code is
 *   Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010-2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   David Ascher <dascher@mozilla.com>
 *   Jim Porter <squibblyflabbetydoo@gmail.com>
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
