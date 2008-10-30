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

Cu.import("resource://gloda/modules/noun_mimetype.js");


/**
 * @namespace The Gloda Fundamental Attribute provider is a special attribute
 *  provider; it provides attributes that the rest of the providers should be
 *  able to assume exist.  Also, it may end up accessing things at a lower level
 *  than most extension providers should do.  In summary, don't mimic this code
 *  unless you won't complain when your code breaks.
 */
var GlodaFundAttr = {
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
      singular: true,
      special: Gloda.kSpecialFulltext,
      specialColumnName: "subject",
      subjectNouns: [Gloda.NOUN_CONVERSATION],
      objectNoun: Gloda.NOUN_FULLTEXT,
      });
  
    /* ***** Messages ***** */
    // folder
    this._attrFolder = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrFundamental,
      attributeName: "folder",
      singular: true,
      special: Gloda.kSpecialColumn,
      specialColumnName: "folderID",
      subjectNouns: [Gloda.NOUN_MESSAGE],
      objectNoun: Gloda.NOUN_FOLDER,
      }); // tested-by: test_attributes_fundamental
    this._attrFolder = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrFundamental,
      attributeName: "messageKey",
      singular: true,
      special: Gloda.kSpecialColumn,
      specialColumnName: "messageKey",
      subjectNouns: [Gloda.NOUN_MESSAGE],
      objectNoun: Gloda.NOUN_NUMBER,
      }); // tested-by: test_attributes_fundamental
    
    // bodyMatches. super-synthetic full-text matching...
    this._attrBody = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrDerived,
      attributeName: "bodyMatches",
      singular: true,
      special: Gloda.kSpecialFulltext,
      specialColumnName: "body",
      subjectNouns: [Gloda.NOUN_MESSAGE],
      objectNoun: Gloda.NOUN_FULLTEXT,
      }); // not-tested
    
    // conversation
    this._attrConversation = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrFundamental,
      attributeName: "conversation",
      singular: true,
      special: Gloda.kSpecialColumnParent,
      specialColumnName: "conversationID",
      idStorageAttributeName: "_conversationID",
      valueStorageAttributeName: "_conversation", 
      subjectNouns: [Gloda.NOUN_MESSAGE],
      objectNoun: Gloda.NOUN_CONVERSATION,
      });
  
    // --- Fundamental
    // From
    this._attrFrom = Gloda.defineAttribute({
                        provider: this,
                        extensionName: Gloda.BUILT_IN,
                        attributeType: Gloda.kAttrFundamental,
                        attributeName: "from",
                        singular: true,
                        subjectNouns: [Gloda.NOUN_MESSAGE],
                        objectNoun: Gloda.NOUN_IDENTITY,
                        }); // tested-by: test_attributes_fundamental
    // To
    this._attrTo = Gloda.defineAttribute({
                        provider: this,
                        extensionName: Gloda.BUILT_IN,
                        attributeType: Gloda.kAttrFundamental,
                        attributeName: "to",
                        singular: false,
                        subjectNouns: [Gloda.NOUN_MESSAGE],
                        objectNoun: Gloda.NOUN_IDENTITY,
                        }); // tested-by: test_attributes_fundamental
    // Cc
    this._attrCc = Gloda.defineAttribute({
                        provider: this,
                        extensionName: Gloda.BUILT_IN,
                        attributeType: Gloda.kAttrFundamental,
                        attributeName: "cc",
                        singular: false,
                        subjectNouns: [Gloda.NOUN_MESSAGE],
                        objectNoun: Gloda.NOUN_IDENTITY,
                        }); // not-tested

    // Date.  now lives on the row.
    this._attrDate = Gloda.defineAttribute({
                        provider: this,
                        extensionName: Gloda.BUILT_IN,
                        attributeType: Gloda.kAttrFundamental,
                        attributeName: "date",
                        singular: true,
                        special: Gloda.kSpecialColumn,
                        specialColumnName: "date",
                        subjectNouns: [Gloda.NOUN_MESSAGE],
                        objectNoun: Gloda.NOUN_DATE,
                        }); // tested-by: test_attributes_fundamental
    
    // Attachment MIME Types
    this._attrAttachmentTypes = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrFundamental,
      attributeName: "attachmentTypes",
      singular: false,
      subjectNouns: [Gloda.NOUN_MESSAGE],
      objectNoun: Gloda.NOUN_MIME_TYPE,
      });

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
      singular: false,
      subjectNouns: [Gloda.NOUN_MESSAGE],
      objectNoun: Gloda.NOUN_IDENTITY,
      }); // not-tested

    // From Me To
    this._attrFromMeTo = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrOptimization,
      attributeName: "fromMeTo",
      singular: false,
      subjectNouns: [Gloda.NOUN_MESSAGE],
      objectNoun: Gloda.NOUN_PARAM_IDENTITY,
      }); // not-tested
    // From Me Cc
    this._attrFromMeCc = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrOptimization,
      attributeName: "fromMeCc",
      singular: false,
      subjectNouns: [Gloda.NOUN_MESSAGE],
      objectNoun: Gloda.NOUN_PARAM_IDENTITY,
      }); // not-tested
    // To Me
    this._attrToMe = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrFundamental,
      attributeName: "toMe",
      singular: false,
      subjectNouns: [Gloda.NOUN_MESSAGE],
      objectNoun: Gloda.NOUN_PARAM_IDENTITY,
      }); // not-tested
    // Cc Me
    this._attrCcMe = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrFundamental,
      attributeName: "ccMe",
      singular: false,
      subjectNouns: [Gloda.NOUN_MESSAGE],
      objectNoun: Gloda.NOUN_PARAM_IDENTITY,
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
                        bindName: "mailingLists",
                        singular: false,
                        subjectNouns: [Gloda.NOUN_MESSAGE],
                        objectNoun: Gloda.NOUN_IDENTITY,
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
  process: function gloda_fundattr_process(aGlodaMessage, aRawReps,
                                           aIsNew, aCallbackHandle) {
    let aMsgHdr = aRawReps.header;
    let aMimeMsg = aRawReps.mime;
    
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
    
    let [authorIdentities, toIdentities, ccIdentities] =
      yield aCallbackHandle.pushAndGo(
        Gloda.getOrCreateMailIdentities(aCallbackHandle,
                                        author, aMsgHdr.recipients,
                                        aMsgHdr.ccList));

    if (authorIdentities.length == 0) {
      this._log.error("Message with subject '" + aMsgHdr.mime2DecodedSubject +
                      "' somehow lacks a valid author.  Bailing.");
      return; // being a generator, this generates an exception; we like.
    }
    let authorIdentity = authorIdentities[0];
    aGlodaMessage.from = authorIdentity;

    // -- To, Cc
    aGlodaMessage.to = toIdentities;
    aGlodaMessage.cc = ccIdentities;
    
    // -- Attachments
    let attachmentTypes = [];
    for each (let attachment in aMimeMsg.allAttachments) {
      if (attachment.isRealAttachment) {
        attachmentTypes.push(MimeTypeNoun.getMimeType(attachment.contentType));
      }
    }
    if (attachmentTypes.length) {
      aGlodaMessage.attachmentTypes = attachmentTypes;
    }
    
    // TODO: deal with mailing lists, including implicit-to.  this will require
    //  convincing the indexer to pass us in the previous message if it is
    //  available.  (which we'll simply pass to everyone... it can help body
    //  logic for quoting purposes, etc. too.)
    
    yield Gloda.kWorkDone;
  },
  
  optimize: function gloda_fundattr_process(aGlodaMessage, aRawReps,
      aIsNew, aCallbackHandle) {

    let involvesIdentities = {};
    let involves = aGlodaMessage.involves || [];
    
    // me specialization optimizations
    let toMe = aGlodaMessage.toMe || [];
    let fromMeTo = aGlodaMessage.fromMeTo || [];
    let ccMe = aGlodaMessage.ccMe || [];
    let fromMeCc = aGlodaMessage.fromMeCc || [];

    let myIdentities = Gloda.myIdentities; // needless optimization?
    let authorIdentity = aGlodaMessage.from;
    let isFromMe = authorIdentity.id in myIdentities;

    involves.push(authorIdentity);
    involvesIdentities[authorIdentity.id] = true;
    
    for each (let [,toIdentity] in Iterator(aGlodaMessage.to)) {
      if (!(toIdentity.id in involvesIdentities)) {
        involves.push(toIdentity);
        involvesIdentities[toIdentity.id] = true;
      }
      
      // optimization attribute to-me ('I' am the parameter)
      if (toIdentity.id in myIdentities) {
        toMe.push([toIdentity, authorIdentity]);
        if (aIsNew)
          authorIdentity.contact.popularity += this.POPULARITY_TO_ME;
      }
      // optimization attribute from-me-to ('I' am the parameter)
      if (isFromMe) {
        fromMeTo.push([authorIdentity, toIdentity]);
        // also, popularity
        if (aIsNew)
          toIdentity.contact.popularity += this.POPULARITY_FROM_ME_TO;
      }
    }
    for each (let [,ccIdentity] in Iterator(aGlodaMessage.cc)) {
      if (!(ccIdentity.id in involvesIdentities)) {
        involves.push(ccIdentity);
        involvesIdentities[ccIdentity.id] = true;
      }
      // optimization attribute cc-me ('I' am the parameter)
      if (ccIdentity.id in myIdentities) {
        ccMe.push([ccIdentity, authorIdentity]);
        if (aIsNew)
          authorIdentity.contact.popularity += this.POPULARITY_CC_ME;
      }
      // optimization attribute from-me-to ('I' am the parameter)
      if (isFromMe) {
        fromMeCc.push([authorIdentity, ccIdentity]);
        // also, popularity
        if (aIsNew)
          ccIdentity.contact.popularity += this.POPULARITY_FROM_ME_CC;
      }
    }
    
    aGlodaMessage.involves = involves;
    if (toMe.length)
      aGlodaMessage.toMe = toMe;
    if (fromMeTo.length)
      aGlodaMessage.fromMeTo = fromMeTo;
    if (ccMe.length)
      aGlodaMessage.ccMe = ccMe;
    if (fromMeCc.length)
      aGlodaMessage.fromMeCc = fromMeCc;
    
    if (aRawReps.bodyLines &&
        this.contentWhittle(aGlodaMessage, {}, aRawReps.bodyLines,
                            aRawReps.content)) {
      // we were going to do something here?
    }

    yield Gloda.kWorkDone;
  },
  
  _countQuoteDepthAndNormalize:
    function gloda_fundattr__countQuoteDepthAndNormalize(aLine) {
    let count = 0;
    let lastStartOffset = 0;
    
    for (let i = 0; i < aLine.length; i++) {
      let c = aLine[i];
      if (c == ">") {
        count++;
        lastStartOffset = i+1;
      }
      else if (c == " ") {
      }
      else {
        return [count,
                lastStartOffset ? aLine.substring(lastStartOffset) : aLine];
      }
    }
    
    return [count, lastStartOffset ? aLine.substring(lastStartOffset) : aLine];
  },
  
  /**
   * Attempt to understand simple quoting constructs that use ">" with
   * obvious phrases to enter the quoting block.  No support for other types
   * of quoting at this time.  Also no support for piercing the wrapper of
   * forwarded messages to actually be the content of the forwarded message.
   */
  contentWhittle: function gloda_fundattr_contentWhittle(aGlodaMessage,
      aMeta, aBodyLines, aContent) {
    if (!aContent.volunteerContent(aContent.kPriorityBase))
      return false;
    
    // duplicate the list; we mutate somewhat...
    let bodyLines = aBodyLines.concat();
    
    let rangeStart = 0, lastNonBlankLine = null;
    let inQuoteDepth = 0;
    for each (let [iLine, line] in Iterator(bodyLines)) {
      if (!line)
        continue;
      
      if (line[0] == ">") {
        if (!inQuoteDepth) {
          let rangeEnd = iLine - 1;
          let quoteRangeStart = iLine;
          // see if the last non-blank-line was a lead-in...
          if (lastNonBlankLine != null) {
            if (aBodyLines[lastNonBlankLine].indexOf("wrote") >= 0) {
              quoteRangeStart = lastNonBlankLine;
              rangeEnd = lastNonBlankLine - 1;
            }
          }
          if (rangeEnd >= rangeStart)
            aContent.content(aBodyLines.slice(rangeStart, rangeEnd+1));
          
          [inQuoteDepth, line] = this._countQuoteDepthAndNormalize(line);
          bodyLines[iLine] = line;
          rangeStart = quoteRangeStart;
        }
        else {
          let curQuoteDepth;
          [curQuoteDepth, line] = this._countQuoteDepthAndNormalize(line);
          bodyLines[iLine] = line;
          
          if (curQuoteDepth != inQuoteDepth) {
            // we could do some "wrote" compensation here, but it's not really
            //  as important.  let's wait for a more clever algorithm.
            aContent.quoted(aBodyLines.slice(rangeStart, iLine), inQuoteDepth);
            inQuoteDepth = curQuoteDepth;
            rangeStart = iLine;
          }
        }
      }
      else {
        if (inQuoteDepth) {
          aContent.quoted(aBodyLines.slice(rangeStart, iLine), inQuoteDepth);
          inQuoteDepth = 0;
          rangeStart = iLine;
        }
      }
      
      lastNonBlankLine = iLine;
    }
    
    if (inQuoteDepth) {
      aContent.quoted(aBodyLines.slice(rangeStart), inQuoteDepth);
    }
    else {
      aContent.content(aBodyLines.slice(rangeStart));
    }
    
    return true;
  },
};
