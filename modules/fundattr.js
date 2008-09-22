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

EXPORTED_SYMBOLS = ['GlodaFundAttr'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gloda/modules/log4moz.js");

Cu.import("resource://gloda/modules/utils.js");
Cu.import("resource://gloda/modules/gloda.js");
Cu.import("resource://gloda/modules/datastore.js");

/**
 * The Gloda Fundamental Attribute provider is a special-case attribute
 *  provider; it provides attributes that the rest of the providers should be
 *  able to assume exist.  Also, it may end up accessing things at a lower level
 *  than most extension providers should do.  In summary, don't mimic this code
 *  unless you won't complain when your code breaks.
 */
let GlodaFundAttr = {
  providerName: "gloda.fundattr",
  _log: null,
  _strBundle: null,

  init: function gloda_explattr_init(aStrBundle) {
    this._log =  Log4Moz.Service.getLogger("gloda.fundattr");
    this._strBundle = aStrBundle;
  
    try {
      this.defineAttributes();
    }
    catch (ex) {
      this._log.error("Error in init: " + ex);
      throw ex;
    }
  },

  POPULARITY_FROM_ME_TO: 10,
  POPULARITY_FROM_ME_CC: 4,
  POPULARITY_TO_ME: 5,
  POPULARITY_CC_ME: 1,

  _attrConvSubject: null,
  _attrFolder: null,
  _attrBody: null,
  _attrFrom: null,
  _attrFromMe: null,
  _attrTo: null,
  _attrToMe: null,
  _attrCc: null,
  _attrCcMe: null,
  _attrDate: null,
  
  defineAttributes: function() {
    /* ***** Conversations ***** */
    // conversation: subjectMatches
    this._attrConvSubject = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrDerived,
      attributeName: "subjectMatches",
      bind: false,
      singular: true,
      special: Gloda.kSpecialFulltext,
      specialColumnName: "subject",
      subjectNouns: [Gloda.NOUN_CONVERSATION],
      objectNoun: Gloda.NOUN_FULLTEXT,
      explanation: null, // this does not merit explanation
      });
    
    /* ***** Contacts ***** */
    this._attrContactName = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrFundamental,
      attributeName: "name",
      bind: false,
      singular: true,
      special: Gloda.kSpecialString,
      specialColumnName: "name",
      subjectNouns: [Gloda.NOUN_CONTACT],
      objectNoun: Gloda.NOUN_STRING,
      explanation: null, // name is internal, no explanation required
      }); // tested-by: test_attributes_fundamental
    this._attrContactPopularity = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrDerived,
      attributeName: "popularity",
      bind: false,
      singular: true,
      special: Gloda.kSpecialColumn,
      specialColumnName: "popularity",
      subjectNouns: [Gloda.NOUN_CONTACT],
      objectNoun: Gloda.NOUN_NUMBER,
      explanation: null, // popularity is internal, no explanation required
      }); // not-tested
    this._attrContactFrecency = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrDerived,
      attributeName: "frecency",
      bind: false,
      singular: true,
      special: Gloda.kSpecialColumn,
      specialColumnName: "frecency",
      subjectNouns: [Gloda.NOUN_CONTACT],
      objectNoun: Gloda.NOUN_NUMBER,
      explanation: null, // frecency is internal, no explanation required
      }); // not-tested

    /* ***** Identities ***** */
    this._attrIdentityContact = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrDerived,
      attributeName: "contact",
      bind: false,
      singular: true,
      special: Gloda.kSpecialColumn,
      specialColumnName: "contactID",
      subjectNouns: [Gloda.NOUN_IDENTITY],
      objectNoun: Gloda.NOUN_CONTACT,
      explanation: null, // popularity is internal, no explanation required
      }); // tested-by: test_attributes_fundamental
    this._attrIdentityKind = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrFundamental,
      attributeName: "kind",
      bind: false,
      singular: true,
      special: Gloda.kSpecialString,
      specialColumnName: "kind",
      subjectNouns: [Gloda.NOUN_IDENTITY],
      objectNoun: Gloda.NOUN_STRING,
      explanation: null, // kind is internal, no explanation required
      }); // tested-by: test_attributes_fundamental
    this._attrIdentityValue = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrFundamental,
      attributeName: "value",
      bind: false,
      singular: true,
      special: Gloda.kSpecialString,
      specialColumnName: "value",
      subjectNouns: [Gloda.NOUN_IDENTITY],
      objectNoun: Gloda.NOUN_STRING,
      explanation: null, // value is internal, no explanation required
      }); // tested-by: test_attributes_fundamental
  
    /* ***** Messages ***** */
    // folder
    this._attrFolder = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrFundamental,
      attributeName: "folderURI",
      bind: false,
      singular: true,
      special: Gloda.kSpecialColumn,
      specialColumnName: "folderID",
      subjectNouns: [Gloda.NOUN_MESSAGE],
      objectNoun: Gloda.NOUN_FOLDER,
      explanation: this._strBundle.GetStringFromName("attrFolderExplanation"),
      }); // tested-by: test_attributes_fundamental
    
    // bodyMatches. super-synthetic full-text matching...
    this._attrBody = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrDerived,
      attributeName: "bodyMatches",
      bind: false,
      singular: true,
      special: Gloda.kSpecialFulltext,
      specialColumnName: "body",
      subjectNouns: [Gloda.NOUN_MESSAGE],
      objectNoun: Gloda.NOUN_FULLTEXT,
      explanation: null, // this does not merit explanation
      }); // not-tested
  
    // --- Fundamental
    // From
    this._attrFrom = Gloda.defineAttribute({
                        provider: this,
                        extensionName: Gloda.BUILT_IN,
                        attributeType: Gloda.kAttrFundamental,
                        attributeName: "from",
                        bind: true,
                        singular: true,
                        subjectNouns: [Gloda.NOUN_MESSAGE],
                        objectNoun: Gloda.NOUN_IDENTITY,
                        explanation: this._strBundle.GetStringFromName(
                                       "attrFromExplanation"),
                        }); // tested-by: test_attributes_fundamental
    // To
    this._attrTo = Gloda.defineAttribute({
                        provider: this,
                        extensionName: Gloda.BUILT_IN,
                        attributeType: Gloda.kAttrFundamental,
                        attributeName: "to",
                        bind: true,
                        singular: false,
                        subjectNouns: [Gloda.NOUN_MESSAGE],
                        objectNoun: Gloda.NOUN_IDENTITY,
                        explanation: this._strBundle.GetStringFromName(
                                       "attrToExplanation"),
                        }); // tested-by: test_attributes_fundamental
    // Cc
    this._attrCc = Gloda.defineAttribute({
                        provider: this,
                        extensionName: Gloda.BUILT_IN,
                        attributeType: Gloda.kAttrFundamental,
                        attributeName: "cc",
                        bind: true,
                        singular: false,
                        subjectNouns: [Gloda.NOUN_MESSAGE],
                        objectNoun: Gloda.NOUN_IDENTITY,
                        explanation: this._strBundle.GetStringFromName(
                                       "attrCcExplanation"),
                        }); // not-tested

    Gloda.defineNounAction(Gloda.NOUN_IDENTITY, {actionType: "filter",
      actionTarget: Gloda.NOUN_MESSAGE,
      shortName: "from",
      makeConstraint: function(aAttrDef, aIdentity) {
        return [GlodaFundAttr._attrFrom, null, aIdentity.id];
      },
      });
    Gloda.defineNounAction(Gloda.NOUN_IDENTITY, {actionType: "filter",
      actionTarget: Gloda.NOUN_MESSAGE,
      shortName: "to",
      makeConstraint: function(aAttrDef, aIdentity) {
        return [GlodaFundAttr._attrTo, null, aIdentity.id];
      },
      });
    Gloda.defineNounAction(Gloda.NOUN_IDENTITY, {actionType: "filter",
      actionTarget: Gloda.NOUN_MESSAGE,
      shortName: "cc",
      makeConstraint: function(aAttrDef, aIdentity) {
        return [GlodaFundAttr._attrCc, null, aIdentity.id];
      },
      });

    // Date.  now lives on the row.
    this._attrDate = Gloda.defineAttribute({
                        provider: this,
                        extensionName: Gloda.BUILT_IN,
                        attributeType: Gloda.kAttrFundamental,
                        attributeName: "date",
                        bind: false,
                        singular: true,
                        special: Gloda.kSpecialColumn,
                        specialColumnName: "date",
                        subjectNouns: [Gloda.NOUN_MESSAGE],
                        objectNoun: Gloda.NOUN_DATE,
                        explanation: this._strBundle.GetStringFromName(
                                       "attrDateExplanation"),
                        }); // tested-by: test_attributes_fundamental

    // --- Optimization
    // Involves.  Means any of from/to/cc.  The queries get ugly enough without
    //   this that it seems to justify the cost, especially given the frequent
    //   use case.  (In fact, post-filtering for the specific from/to/cc is
    //   probably justifiable rather than losing this attribute...)
    this._attrInvolves = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrOptimization,
      attributeName: "involves",
      bind: true,
      singular: false,
      subjectNouns: [Gloda.NOUN_MESSAGE],
      objectNoun: Gloda.NOUN_IDENTITY,
      explanation: this._strBundle.GetStringFromName(
                     "attrInvolvesExplanation"),
      }); // not-tested

    // From Me To
    this._attrFromMeTo = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrOptimization,
      attributeName: "fromMeTo",
      bind: false,
      singular: false,
      subjectNouns: [Gloda.NOUN_MESSAGE],
      objectNoun: Gloda.NOUN_IDENTITY,
      explanation: this._strBundle.GetStringFromName("attrFromMeToExplanation")
      }); // not-tested
    // From Me Cc
    this._attrFromMeCc = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrOptimization,
      attributeName: "fromMeCc",
      bind: false,
      singular: false,
      subjectNouns: [Gloda.NOUN_MESSAGE],
      objectNoun: Gloda.NOUN_IDENTITY,
      explanation: this._strBundle.GetStringFromName("attrFromMeCcExplanation")
      }); // not-tested
    // To Me
    this._attrToMe = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrFundamental,
      attributeName: "toMe",
      bind: false,
      singular: false,
      subjectNouns: [Gloda.NOUN_MESSAGE],
      objectNoun: Gloda.NOUN_IDENTITY,
      explanation: this._strBundle.GetStringFromName("attrToMeExplanation")
      }); // not-tested
    // Cc Me
    this._attrCcMe = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrFundamental,
      attributeName: "ccMe",
      bind: false,
      singular: false,
      subjectNouns: [Gloda.NOUN_MESSAGE],
      objectNoun: Gloda.NOUN_IDENTITY,
      explanation: this._strBundle.GetStringFromName("attrCcMeExplanation") 
      }); // not-tested


    // -- Mailing List
    // Non-singular, but a hard call.  Namely, it is obvious that a message can
    //  be addressed to multiple mailing lists.  However, I don't see how you
    //  could receive a message with more than one set of List-* headers,
    //  since each list-serve would each send you a copy.  Based on our current
    //  decision to treat each physical message as separate, it almost seems
    //  right to limit the list attribute to the copy that originated at the
    //  list.  That may sound entirely wrong, but keep in mind that until we
    //  have seen a message from the list with the List headers, we can't
    //  definitely know it's a mailing list (although heuristics could take us
    //  pretty far).  As such, the quasi-singular thing is appealing.
    // Of course, the reality is that we really want to know if a message was
    //  sent to multiple mailing lists and be able to query on that.
    //  Additionally, our implicit-to logic needs to work on messages that
    //  weren't relayed by the list-serve, especially messages sent to the list
    //  by the user.
    this._attrList = Gloda.defineAttribute({
                        provider: this,
                        extensionName: Gloda.BUILT_IN,
                        attributeType: Gloda.kAttrFundamental,
                        attributeName: "mailing-list",
                        bind: true,
                        bindName: "mailingLists",
                        singular: false,
                        subjectNouns: [Gloda.NOUN_MESSAGE],
                        objectNoun: Gloda.NOUN_DATE,
                        explanation: this._strBundle.GetStringFromName(
                                       "attrListExplanation"),
                        }); // not-tested, not-implemented
  },
  
  /**
   *
   * Specializations:
   * - Mailing Lists.  Replies to a message on a mailing list frequently only
   *   have the list-serve as the 'to', so we try to generate a synthetic 'to'
   *   based on the author of the parent message when possible.  (The 'possible'
   *   part is that we may not have a copy of the parent message at the time of
   *   processing.)
   * - Newsgroups.  Same deal as mailing lists.
   */
  process: function gloda_fundattr_process(aGlodaMessage, aMsgHdr, aMimeMsg,
                                           aIsNew) {
    let attribs = [];
    let involvedIdentities = {};
    
    // -- From
    // Let's use replyTo if available.
    // er, since we are just dealing with mailing lists for now, forget the
    //  reply-to...
    // TODO: deal with default charset issues
    let author = null;
    /*
    try {
      author = aMsgHdr.getStringProperty("replyTo");
    }
    catch (ex) {
    }
    */
    if (author == null || author == "")
      author = aMsgHdr.author;

    let authorIdentity = Gloda.getIdentityForFullMailAddress(author);
    if (authorIdentity == null) {
      this._log.error("Message with subject '" + aMsgHdr.mime2DecodedSubject +
                      "' somehow lacks a valid author.  Bailing.");
      return attribs;
    }
    attribs.push([this._attrFrom.id, authorIdentity.id]);
    attribs.push([this._attrInvolves.id, authorIdentity.id]);
    involvedIdentities[authorIdentity.id] = true;
    
    let myIdentities = Gloda.myIdentities; // needless optimization?
    let isFromMe = authorIdentity.id in myIdentities;
    
    // -- To, Cc
    // TODO: handle mailing list semantics (use my visterity logic as a first
    //  pass.)
    let toIdentities = Gloda.getIdentitiesForFullMailAddresses(
                           aMsgHdr.recipients);
    for (let iTo = 0; iTo < toIdentities.length; iTo++) {
      let toIdentity = toIdentities[iTo];
      attribs.push([this._attrTo.id, toIdentity.id]);
      if (!(toIdentity.id in involvedIdentities)) {
        attribs.push([this._attrInvolves.id, toIdentity.id]);
        involvedIdentities[toIdentity.id] = true;
      }
      // optimization attribute to-me ('I' am the parameter)
      if (toIdentity.id in myIdentities) {
        attribs.push([this._attrCcMe.bindParameter(toIdentity.id),
                      authorIdentity.id]);
        if (aIsNew)
          authorIdentity.contact.popularity += this.POPULARITY_TO_ME;
      }
      // optimization attribute from-me-to ('I' am the parameter)
      if (isFromMe) {
        attribs.push([this._attrFromMeCc.bindParameter(authorIdentity.id),
                      toIdentity.id]);
        // also, popularity
        if (aIsNew)
          toIdentity.contact.popularity += this.POPULARITY_FROM_ME_TO;
      }
    }
    let ccIdentities = Gloda.getIdentitiesForFullMailAddresses(aMsgHdr.ccList);
    for (let iCc = 0; iCc < ccIdentities.length; iCc++) {
      let ccIdentity = ccIdentities[iCc];
      attribs.push([this._attrCc.id, ccIdentity.id]);
      if (!(ccIdentity.id in involvedIdentities)) {
        attribs.push([this._attrInvolves.id, ccIdentity.id]);
        involvedIdentities[ccIdentity.id] = true;
      }
      // optimization attribute cc-me ('I' am the parameter)
      if (ccIdentity.id in myIdentities) {
        attribs.push([this._attrCcMe.bindParameter(ccIdentity.id),
                      authorIdentity.id]);
        if (aIsNew)
          authorIdentity.contact.popularity += this.POPULARITY_CC_ME;
      }
      // optimization attribute from-me-to ('I' am the parameter)
      if (isFromMe) {
        attribs.push([this._attrFromMeCc.bindParameter(authorIdentity.id),
                      ccIdentity.id]);
        // also, popularity
        if (aIsNew)
          ccIdentity.contact.popularity += this.POPULARITY_FROM_ME_CC;
      }
    }
    
    // TODO: deal with mailing lists, including implicit-to.  this will require
    //  convincing the indexer to pass us in the previous message if it is
    //  available.  (which we'll simply pass to everyone... it can help body
    //  logic for quoting purposes, etc. too.)
    
    // -- Date
    attribs.push([this._attrDate.id, aMsgHdr.date]);
    
    return attribs;
  },
};
