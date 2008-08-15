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

  _attrFolder: null,
  _attrFrom: null,
  _attrTo: null,
  _attrCc: null,
  _attrDate: null,
  
  defineAttributes: function() {
    this._attrFolder = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrFundamental,
      attributeName: "folderURI",
      bind: false,
      singular: true,
      special: true,
      specialColumnName: "folderID",
      subjectNouns: [Gloda.NOUN_MESSAGE],
      objectNoun: Gloda.NOUN_FOLDER,
      parameterNoun: null,
      explanation: this._strBundle.GetStringFromName("attrFolderExplanation"),
      });
  
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
                        parameterNoun: null,
                        explanation: this._strBundle.GetStringFromName(
                                       "attrFromExplanation"),
                        });
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
                        parameterNoun: null,
                        explanation: this._strBundle.GetStringFromName(
                                       "attrToExplanation"),
                        });
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
                        parameterNoun: null,
                        explanation: this._strBundle.GetStringFromName(
                                       "attrCcExplanation"),
                        });

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
                        special: true,
                        specialColumnName: "date",
                        subjectNouns: [Gloda.NOUN_MESSAGE],
                        objectNoun: Gloda.NOUN_DATE,
                        parameterNoun: null,
                        explanation: this._strBundle.GetStringFromName(
                                       "attrDateExplanation"),
                        });
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
                        parameterNoun: null,
                        explanation: this._strBundle.GetStringFromName(
                                       "attrListExplanation"),
                        });
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
  process: function gloda_fundattr_process(aGlodaMessage, aMsgHdr, aMimeMsg) {
    let attribs = [];
    
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
    
    // -- To, Cc
    // TODO: handle mailing list semantics (use my visterity logic as a first
    //  pass.)
    let toIdentities = Gloda.getIdentitiesForFullMailAddresses(
                           aMsgHdr.recipients);
    for (let iTo=0; iTo < toIdentities.length; iTo++) {
      attribs.push([this._attrTo.id, toIdentities[iTo].id]);
    }
    let ccIdentities = Gloda.getIdentitiesForFullMailAddresses(aMsgHdr.ccList);
    for (let iCc=0; iCc < ccIdentities.length; iCc++) {
      attribs.push([this._attrCc.id, ccIdentities[iCc].id]);
    }
    
    // -- Date
    attribs.push([this._attrDate.id, aMsgHdr.date]);
    
    this._log.debug("returning attribs: " + attribs);
    
    return attribs;
  },
};
