/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function nsAbAutoCompleteMyDomain() {}

nsAbAutoCompleteMyDomain.prototype = {
  classID: Components.ID("{5b259db2-e451-4de9-8a6f-cfba91402973}"),
  QueryInterface: XPCOMUtils.generateQI([
      Components.interfaces.nsIAutoCompleteSearch]),

  cachedParam: "",
  cachedIdentity: null,

  startSearch: function(aString, aParam, aResult, aListener) {
    const ACR = Components.interfaces.nsIAutoCompleteResult;
    var address = null;
    if (aString && !aString.contains(",")) {
      if (aParam != this.cachedParam) {
        this.cachedIdentity = MailServices.accounts.getIdentity(aParam);
        this.cachedParam = aParam;
      }
      if (this.cachedIdentity.autocompleteToMyDomain)
        address = aString.contains("@") ? aString :
                  this.cachedIdentity.email.replace(/[^@]*/, aString);
    }

    var result = {
      searchString: aString,
      searchResult: address ? ACR.RESULT_SUCCESS : ACR.RESULT_FAILURE,
      defaultIndex: -1,
      errorDescription: null,
      matchCount: address ? 1 : 0,
      getValueAt: function() { return address; },
      getLabelAt: function() { return this.getValueAt(); },
      getCommentAt: function() { return null; },
      getStyleAt: function() { return "default-match"; },
      getImageAt: function() { return null; },
      removeValueAt: function() {}
    };
    aListener.onSearchResult(this, result);
  },

  stopSearch: function() {}
};

var components = [nsAbAutoCompleteMyDomain];
const NSGetFactory = XPCOMUtils.generateNSGetFactory(components);
