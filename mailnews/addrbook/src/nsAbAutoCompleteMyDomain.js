/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * The Original Code is Auto Complete My Domain.
 *
 * The Initial Developer of the Original Code is
 * Neil Rashbrook.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function nsAbAutoCompleteMyDomain() {}

nsAbAutoCompleteMyDomain.prototype = {
  classDescription: "AbAutoCompleteMyDomain",
  contractID: "@mozilla.org/autocomplete/search;1?name=mydomain",
  classID: Components.ID("{5b259db2-e451-4de9-8a6f-cfba91402973}"),
  QueryInterface: XPCOMUtils.generateQI([
      Components.interfaces.nsIAutoCompleteSearch]),

  cachedParam: "",
  cachedIdentity: null,

  startSearch: function(aString, aParam, aResult, aListener) {
    const ACR = Components.interfaces.nsIAutoCompleteResult;
    var address = null;
    if (aString && !/,/.test(aString)) {
      if (aParam != this.cachedParam) {
        this.cachedIdentity =
            Components.classes['@mozilla.org/messenger/account-manager;1']
                      .getService(Components.interfaces.nsIMsgAccountManager)
                      .getIdentity(aParam);
        this.cachedParam = aParam;
      }
      if (this.cachedIdentity.autocompleteToMyDomain)
        address = /@/.test(aString) ? aString :
                  this.cachedIdentity.email.replace(/[^@]*/, aString);
    }

    var result = {
      searchString: aString,
      searchResult: address ? ACR.RESULT_SUCCESS : ACR.RESULT_FAILURE,
      defaultIndex: -1,
      errorDescription: null,
      matchCount: address ? 1 : 0,
      getValueAt: function() { return address; },
      getCommentAt: function() { return null; },
      getStyleAt: function() { return "default-match"; },
      getImageAt: function() { return null; },
      removeValueAt: function() {}
    };
    aListener.onSearchResult(this, result);
  },

  stopSearch: function() {}
};

function NSGetModule(compMgr, fileSpec) {
  return XPCOMUtils.generateModule([nsAbAutoCompleteMyDomain]);
}
