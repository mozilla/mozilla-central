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
 *   Mark Banner <bugzilla@standard8.plus.com>
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

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

var Gloda = null;
var GlodaUtils = null;
var MultiSuffixTree = null;

function nsAutoCompleteGlodaResult(aCompleter, aString, aResults, aDone) {
  this.completer = aCompleter;
  this.searchString = aString;
  this._results = aResults;
  this._done = aDone || false;
  this._problem = false;
}
nsAutoCompleteGlodaResult.prototype = {
  _results: null,
  getObjectAt: function(aIndex) {
    return this._results[aIndex];
  },
  // ==== nsIAutoCompleteResult
  searchString: null,
  get searchResult() {
    if (this._problem)
      return Ci.nsIAutoCompleteResult.RESULT_FAILURE;
    if (this._results.length)
      return (this._done) ? Ci.nsIAutoCompleteResult.RESULT_SUCCESS
                          : Ci.nsIAutoCompleteResult.RESULT_SUCCESS_ONGOING;
    else
      return (this._done) ? Ci.nsIAutoCompleteResult.RESULT_NOMATCH
                          : Ci.nsIAutoCompleteResult.RESULT_NOMATCH_ONGOING;
  },
  defaultIndex: -1,
  errorDescription: null,
  get matchCount() {
    return (this._results === null) ? 0 : this._results.length;
  },
  // this is the lower text, (shows the url in firefox)
  // we try and show the contact's name here.
  getValueAt: function(aIndex) {
    let thing = this._results[aIndex];
    return thing.name || thing.value || thing.subject;
  },
  // rich uses this to be the "title".  it is the upper text
  // we try and show the identity here.
  getCommentAt: function(aIndex) {
    let thing = this._results[aIndex];
    if (thing.value) // identity
      return thing.contact.name;
    else
      return thing.name || thing.subject;
  },
  // rich uses this to be the "type"
  getStyleAt: function(aIndex) {
    let thing = this._results[aIndex];
    if (thing.subject)
      return "gloda-conversation";
    if (thing.value)
      return "gloda-identity";
    return "gloda-contact";
  },
  // rich uses this to be the icon
  getImageAt: function(aIndex) {
    let thing = this._results[aIndex];
    if (!thing.value)
      return null;
  
    let md5hash = GlodaUtils.md5HashString(thing.value);
    let gravURL = "http://www.gravatar.com/avatar/" + md5hash + 
                                "?d=identicon&s=32&r=g";
    return gravURL;
  },
  removeValueAt: function() {},
  
  _stop: function() {
  },
};

function nsAutoCompleteGloda() {
  this.wrappedJSObject = this;
  
  // set up our awesome globals!
  if (Gloda === null) {
    let loadNS = {};
    Cu.import("resource://gloda/modules/gloda.js", loadNS);
    Gloda = loadNS.Gloda;
    // force initialization
    Cu.import("resource://gloda/modules/everybody.js", loadNS);

    Cu.import("resource://gloda/modules/utils.js", loadNS);
    GlodaUtils = loadNS.GlodaUtils;
    Cu.import("resource://gloda/modules/suffixtree.js", loadNS);
    MultiSuffixTree = loadNS.MultiSuffixTree;
  }
  
  Gloda.lookupNoun("contact");
  
  // get all the contacts
  let contactQuery = Gloda.newQuery(Gloda.NOUN_CONTACT);
  this.contactCollection = contactQuery.popularityRange(10, null).getAllSync();
  
  // cheat and explicitly add our own contact...
  this.contactCollection._onItemsAdded([Gloda.myContact]);

  // assuming we found some contacts...
  if (this.contactCollection.items.length) {
    // get all the identities...
    let identityQuery = Gloda.newQuery(Gloda.NOUN_IDENTITY);
    // ...that belong to one of the above contacts.
    identityQuery.contact.apply(identityQuery, this.contactCollection.items);
    this.identityCollection = identityQuery.getAllSync();
  }
  else {
    // create an empty explicit collection
    this.identityCollection = Gloda.explicitCollection(Gloda.NOUN_IDENTITY, []);
  }
  
  let contactNames = [(c.name.replace(" ", "").toLowerCase() || "x") for each
                      (c in this.contactCollection.items)];
  let identityMails = [i.value.toLowerCase() for each
                       (i in this.identityCollection.items)];
  
  this.suffixTree = new MultiSuffixTree(contactNames.concat(identityMails),
    this.contactCollection.items.concat(this.identityCollection.items));
    
  this.outstandingSearches = {};
  this._magicTime = false;
}

nsAutoCompleteGloda.prototype = {
  classDescription: "AutoCompleteGloda",
  contractID: "@mozilla.org/autocomplete/search;1?name=gloda",
  classID: Components.ID("{3bbe4d77-3f70-4252-9500-bc00c26f476c}"),
  QueryInterface: XPCOMUtils.generateQI([
      Components.interfaces.nsIAutoCompleteSearch]),

  startSearch: function(aString, aParam, aResult, aListener) {
    // only match if they type at least 3 letters...
    let matches = [];
    if (aString.length >= 3) {
      matches = this.suffixTree.findMatches(aString.toLowerCase());
    }

    // let's filter out duplicates due to identity/contact double-hits by
    //  establishing a map based on the contact id for these guys.
    // let's also favor identities as we do it, because that gets us the
    //  most accurate gravat, potentially
    let contactToThing = {};
    for (let iMatch=0; iMatch < matches.length; iMatch++) {
      let thing = matches[iMatch];
      if (thing.NOUN_ID == Gloda.NOUN_CONTACT && !(thing.id in contactToThing))
        contactToThing[thing.id] = thing;
      else if (thing.NOUN_ID == Gloda.NOUN_IDENTITY)
        contactToThing[thing.contactID] = thing;
    }
    // and since we can now map from contacts down to identities, map contacts
    //  to the first identity for them that we find...
    matches = [val.NOUN_ID == Gloda.NOUN_IDENTITY ? val : val.identities[0]
               for each (val in contactToThing)];
    
    // - match subjects
    /*
    if (aString.length >= 4) {
      let subjectQuery = Gloda.newQuery(Gloda.NOUN_CONVERSATION);
      subjectQuery.subjectMatches(aString + "*");
      let convSubjectCollection = subjectQuery.getAllSync();
      matches = matches.concat(convSubjectCollection.items);
    }
    */

    // - match against database contacts / identities
    // XXX this should be deferred
    // XXX this should also be async (when we have async support)
    if (aString.length >= 3) {
      let contactQuery = Gloda.newQuery(Gloda.NOUN_CONTACT);
      let contactColl = contactQuery.nameLike("%" + aString + "%").getAllSync();

      let identityQuery = Gloda.newQuery(Gloda.NOUN_IDENTITY);
      identityQuery.kind("email").valueLike("%" + aString + "%");
      let identityColl = identityQuery.getAllSync();
      
      let possibleDudes = [];
      // check identities first because they are better than contacts in terms
      //  of display
      for (let iIdentity=0; iIdentity < identityColl.items.length; iIdentity++){
        let identity = identityColl.items[iIdentity];
        if (!(identity.contactID in contactToThing)) {
          contactToThing[identity.contactID] = identity;
          possibleDudes.push(identity);
          // augment the identity with its contact's popularity
          identity.popularity = identity.contact.popularity;
        }
      }
      for (let iContact=0; iContact < contactColl.items.length; iContact++) {
        let contact = contactColl.items[iContact];
        if (!(contact.id in contactToThing)) {
          contactToThing[contact.id] = contact;
          possibleDudes.push(contact.identities[0]);
        } 
      }
      // sort in order of descending popularity
      possibleDudes.sort(function(a, b){ return b.popularity - a.popularity; });
      matches = matches.concat(possibleDudes);
    }
    
    // XXX what they hey, just nuke them.  making this all very sketchy
    this.outstandingSearches = {};

    var result = new nsAutoCompleteGlodaResult(this, aString, matches, true);
    this.outstandingSearches[aListener] = result;
    aListener.onSearchResult(this, result);
  },

  stopSearch: function() {
    for each (let [controller, search] in Iterator(this.outstandingSearches)) {
      search._stop();
    }
    this.outstandingSearches = {};
  },
  
  getObjectForController: function(aController, aIndex) {
    aController.QueryInterface(Ci.nsIAutoCompleteObserver);
    for each (let [controller, search] in Iterator(this.outstandingSearches)) {
      if (controller.native == aController.native) {
        return [search.getObjectAt(aIndex), 0];
      }
    }
    return [null, 0];
  },
};

function NSGetModule(compMgr, fileSpec) {
  return XPCOMUtils.generateModule([nsAutoCompleteGloda]);
}
