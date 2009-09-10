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

Cu.import("resource://app/modules/gloda/log4moz.js");
Cu.import("resource://app/modules/StringBundle.js");

Cu.import("resource://app/modules/gloda/utils.js");
Cu.import("resource://app/modules/gloda/gloda.js");
Cu.import("resource://app/modules/gloda/datastore.js");

Cu.import("resource://app/modules/gloda/noun_mimetype.js");
Cu.import("resource://app/modules/gloda/connotent.js");

/**
 * @namespace The Gloda Fundamental Attribute provider is a special attribute
 *  provider; it provides attributes that the rest of the providers should be
 *  able to assume exist.  Also, it may end up accessing things at a lower level
 *  than most extension providers should do.  In summary, don't mimic this code
 *  unless you won't complain when your code breaks.
 */
var GlodaFundAttr = {
  providerName: "gloda.fundattr",
  strings: new StringBundle("chrome://messenger/locale/gloda.properties"),
  _log: null,

  init: function gloda_explattr_init() {
    this._log =  Log4Moz.repository.getLogger("gloda.fundattr");

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
  POPULARITY_FROM_ME_BCC: 3,
  POPULARITY_TO_ME: 5,
  POPULARITY_CC_ME: 1,
  POPULARITY_BCC_ME: 1,

  /** Boost for messages 'I' sent */
  NOTABILITY_FROM_ME: 10,
  /** Boost for messages involving 'me'. */
  NOTABILITY_INVOLVING_ME: 1,
  /** Boost for message from someone in 'my' address book. */
  NOTABILITY_FROM_IN_ADDR_BOOK: 10,
  /** Boost for the first person involved in my address book. */
  NOTABILITY_INVOLVING_ADDR_BOOK_FIRST: 8,
  /** Boost for each additional person involved in my address book. */
  NOTABILITY_INVOLVING_ADDR_BOOK_ADDL: 2,

  defineAttributes: function gloda_fundattr_defineAttributes() {
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
      facet: true,
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

    // -- fulltext search helpers
    // fulltextMatches.  Match over message subject, body, and attachments
    // @testpoint gloda.noun.message.attr.fulltextMatches
    this._attrFulltext = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrDerived,
      attributeName: "fulltextMatches",
      singular: true,
      special: Gloda.kSpecialFulltext,
      specialColumnName: "messagesText",
      subjectNouns: [Gloda.NOUN_MESSAGE],
      objectNoun: Gloda.NOUN_FULLTEXT,
      });

    // subjectMatches.  Fulltext match on subject
    // @testpoint gloda.noun.message.attr.subjectMatches
    this._attrSubjectText = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrDerived,
      attributeName: "subjectMatches",
      singular: true,
      special: Gloda.kSpecialFulltext,
      specialColumnName: "subject",
      subjectNouns: [Gloda.NOUN_MESSAGE],
      objectNoun: Gloda.NOUN_FULLTEXT,
      });

    // bodyMatches. super-synthetic full-text matching...
    // @testpoint gloda.noun.message.attr.bodyMatches
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
      });

    // attachmentNamesMatch
    // @testpoint gloda.noun.message.attr.attachmentNamesMatch
    this._attrAttachmentNames = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrDerived,
      attributeName: "attachmentNamesMatch",
      singular: true,
      special: Gloda.kSpecialFulltext,
      specialColumnName: "attachmentNames",
      subjectNouns: [Gloda.NOUN_MESSAGE],
      objectNoun: Gloda.NOUN_FULLTEXT,
      });

    // @testpoint gloda.noun.message.attr.authorMatches
    this._attrAuthorFulltext = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrDerived,
      attributeName: "authorMatches",
      singular: true,
      special: Gloda.kSpecialFulltext,
      specialColumnName: "author",
      subjectNouns: [Gloda.NOUN_MESSAGE],
      objectNoun: Gloda.NOUN_FULLTEXT,
      });

    // @testpoint gloda.noun.message.attr.recipientsMatch
    this._attrRecipientsFulltext = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrDerived,
      attributeName: "recipientsMatch",
      singular: true,
      special: Gloda.kSpecialFulltext,
      specialColumnName: "recipients",
      subjectNouns: [Gloda.NOUN_MESSAGE],
      objectNoun: Gloda.NOUN_FULLTEXT,
      });

    // --- synthetic stuff for some reason
    // conversation
    // @testpoint gloda.noun.message.attr.conversation
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
    /**
     * Bcc'ed recipients; only makes sense for sent messages.
     */
    this._attrBcc = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrFundamental,
      attributeName: "bcc",
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
                        facet: {
                          type: "date",
                        },
                        special: Gloda.kSpecialColumn,
                        specialColumnName: "date",
                        subjectNouns: [Gloda.NOUN_MESSAGE],
                        objectNoun: Gloda.NOUN_DATE,
                        }); // tested-by: test_attributes_fundamental

    // Header message ID.
    this._attrHeaderMessageID = Gloda.defineAttribute({
                        provider: this,
                        extensionName: Gloda.BUILT_IN,
                        attributeType: Gloda.kAttrFundamental,
                        attributeName: "headerMessageID",
                        singular: true,
                        special: Gloda.kSpecialColumn,
                        specialColumnName: "headerMessageID",
                        subjectNouns: [Gloda.NOUN_MESSAGE],
                        objectNoun: Gloda.NOUN_STRING,
                        }); // tested-by: test_attributes_fundamental

    // Attachment MIME Types
    this._attrAttachmentTypes = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrFundamental,
      attributeName: "attachmentTypes",
      singular: false,
      facet: {
        type: "default",
        // This will group the MIME types by their category.
        groupIdAttr: "category",
        queryHelper: "Category",
      },
      subjectNouns: [Gloda.NOUN_MESSAGE],
      objectNoun: Gloda.NOUN_MIME_TYPE,
      });

    // --- Optimization
    /**
     * Involves means any of from/to/cc/bcc.  The queries get ugly enough
     *  without this that it seems to justify the cost, especially given the
     *  frequent use case.  (In fact, post-filtering for the specific from/to/cc
     *  is probably justifiable rather than losing this attribute...)
     */
    this._attrInvolves = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrOptimization,
      attributeName: "involves",
      singular: false,
      facet: {
        type: "default",
        /**
         * Filter out 'me', as we have other facets that deal with that, and the
         *  'me' identities are so likely that they distort things.
         *
         * @return true if the identity is not one of my identities, false if it
         *   is.
         */
        filter: function gloda_explattr_involves_filter(aItem) {
          return (!(aItem.id in Gloda.myIdentities));
        }
      },
      subjectNouns: [Gloda.NOUN_MESSAGE],
      objectNoun: Gloda.NOUN_IDENTITY,
      }); // not-tested

    /**
     * Any of to/cc/bcc.
     */
    this._attrRecipients = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrOptimization,
      attributeName: "recipients",
      singular: false,
      subjectNouns: [Gloda.NOUN_MESSAGE],
      objectNoun: Gloda.NOUN_IDENTITY,
      }); // not-tested

    // From Me (To/Cc/Bcc)
    this._attrFromMe = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrOptimization,
      attributeName: "fromMe",
      singular: false,
      // The interesting thing to a facet is whether the message is from me.
      facet: {
        type: "nonempty?"
      },
      subjectNouns: [Gloda.NOUN_MESSAGE],
      objectNoun: Gloda.NOUN_PARAM_IDENTITY,
      }); // not-tested
    // To/Cc/Bcc Me
    this._attrToMe = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrFundamental,
      attributeName: "toMe",
      // The interesting thing to a facet is whether the message is to me.
      facet: {
        type: "nonempty?"
      },
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
                        facet: true,
                        subjectNouns: [Gloda.NOUN_MESSAGE],
                        objectNoun: Gloda.NOUN_IDENTITY,
                        }); // not-tested, not-implemented
  },

  RE_LIST_POST: /<mailto:([^>]+)>/,

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
      author = aMsgHdr.mime2DecodedAuthor;

    let normalizedListPost = "";
    if (aMimeMsg && aMimeMsg.has("list-post")) {
      let match = this.RE_LIST_POST.exec(aMimeMsg.get("list-post"));
      if (match)
        normalizedListPost = "<" + match[1] + ">";
    }

    let [authorIdentities, toIdentities, ccIdentities, bccIdentities,
         listIdentities] =
      yield aCallbackHandle.pushAndGo(
        Gloda.getOrCreateMailIdentities(aCallbackHandle,
                                        author, aMsgHdr.mime2DecodedRecipients,
                                        aMsgHdr.ccList, aMsgHdr.bccList,
                                        normalizedListPost));

    if (authorIdentities.length == 0) {
      this._log.error("Message with subject '" + aMsgHdr.mime2DecodedSubject +
                      "' somehow lacks a valid author.  Bailing.");
      return; // being a generator, this generates an exception; we like.
    }
    let authorIdentity = authorIdentities[0];
    aGlodaMessage.from = authorIdentity;

    // -- To, Cc, Bcc
    aGlodaMessage.to = toIdentities;
    aGlodaMessage.cc = ccIdentities;
    aGlodaMessage.bcc = bccIdentities;

    // -- Mailing List
    if (listIdentities.length)
      aGlodaMessage.mailingLists = listIdentities;

    // -- Attachments
    if (aMimeMsg) {
      let attachmentTypes = [];
      for each (let [, attachment] in Iterator(aMimeMsg.allAttachments)) {
        // We don't care about would-be attachments that are not user-intended
        //  attachments but rather artifacts of the message content.
        // We also want to avoid dealing with obviously bogus mime types.
        //  (If you don't have a "/", you are probably bogus.)
        if (attachment.isRealAttachment &&
            (attachment.contentType.indexOf("/") != -1)) {
          attachmentTypes.push(MimeTypeNoun.getMimeType(attachment.contentType));
        }
      }
      if (attachmentTypes.length) {
        aGlodaMessage.attachmentTypes = attachmentTypes;
      }
    }

    // TODO: deal with mailing lists, including implicit-to.  this will require
    //  convincing the indexer to pass us in the previous message if it is
    //  available.  (which we'll simply pass to everyone... it can help body
    //  logic for quoting purposes, etc. too.)

    yield Gloda.kWorkDone;
  },

  optimize: function gloda_fundattr_optimize(aGlodaMessage, aRawReps,
      aIsNew, aCallbackHandle) {

    let aMsgHdr = aRawReps.header;

    // for simplicity this is used for both involves and recipients
    let involvesIdentities = {};
    let involves = aGlodaMessage.involves || [];
    let recipients = aGlodaMessage.recipients || [];

    // 'me' specialization optimizations
    let toMe = aGlodaMessage.toMe || [];
    let fromMe = aGlodaMessage.fromMe || [];

    let myIdentities = Gloda.myIdentities; // needless optimization?
    let authorIdentity = aGlodaMessage.from;
    let isFromMe = authorIdentity.id in myIdentities;

    // The fulltext search column for the author.  We want to have in here:
    // - The e-mail address and display name as enclosed on the message.
    // - The name per the address book card for this e-mail address, if we have
    //   one.
    aGlodaMessage._indexAuthor = aMsgHdr.mime2DecodedAuthor;
    // The fulltext search column for the recipients. (same deal)
    aGlodaMessage._indexRecipients = aMsgHdr.mime2DecodedRecipients;

    if (isFromMe)
      aGlodaMessage.notability += this.NOTABILITY_FROM_ME;
    else {
      let authorCard = authorIdentity.abCard;
      if (authorCard) {
        aGlodaMessage.notability += this.NOTABILITY_FROM_IN_ADDR_BOOK;
        // @testpoint gloda.noun.message.attr.authorMatches
        aGlodaMessage._indexAuthor += ' ' + authorCard.displayName;
      }
    }

    involves.push(authorIdentity);
    involvesIdentities[authorIdentity.id] = true;

    let involvedAddrBookCount = 0;

    for each (let [,toIdentity] in Iterator(aGlodaMessage.to)) {
      if (!(toIdentity.id in involvesIdentities)) {
        involves.push(toIdentity);
        recipients.push(toIdentity);
        involvesIdentities[toIdentity.id] = true;
        let toCard = toIdentity.abCard;
        if (toCard) {
          involvedAddrBookCount++;
          // @testpoint gloda.noun.message.attr.recipientsMatch
          aGlodaMessage._indexRecipients += ' ' + toCard.displayName;
        }
      }

      // optimization attribute to-me ('I' am the parameter)
      if (toIdentity.id in myIdentities) {
        toMe.push([toIdentity, authorIdentity]);
        if (aIsNew)
          authorIdentity.contact.popularity += this.POPULARITY_TO_ME;
      }
      // optimization attribute from-me-to ('I' am the parameter)
      if (isFromMe) {
        fromMe.push([authorIdentity, toIdentity]);
        // also, popularity
        if (aIsNew)
          toIdentity.contact.popularity += this.POPULARITY_FROM_ME_TO;
      }
    }
    for each (let [,ccIdentity] in Iterator(aGlodaMessage.cc)) {
      if (!(ccIdentity.id in involvesIdentities)) {
        involves.push(ccIdentity);
        recipients.push(ccIdentity);
        involvesIdentities[ccIdentity.id] = true;
        let ccCard = ccIdentity.abCard;
        if (ccCard) {
          involvedAddrBookCount++;
          // @testpoint gloda.noun.message.attr.recipientsMatch
          aGlodaMessage._indexRecipients += ' ' + ccCard.displayName;
        }
      }
      // optimization attribute cc-me ('I' am the parameter)
      if (ccIdentity.id in myIdentities) {
        toMe.push([ccIdentity, authorIdentity]);
        if (aIsNew)
          authorIdentity.contact.popularity += this.POPULARITY_CC_ME;
      }
      // optimization attribute from-me-to ('I' am the parameter)
      if (isFromMe) {
        fromMe.push([authorIdentity, ccIdentity]);
        // also, popularity
        if (aIsNew)
          ccIdentity.contact.popularity += this.POPULARITY_FROM_ME_CC;
      }
    }
    // just treat bcc like cc; the intent is the same although the exact
    //  semantics differ.
    for each (let [,bccIdentity] in Iterator(aGlodaMessage.bcc)) {
      if (!(bccIdentity.id in involvesIdentities)) {
        involves.push(bccIdentity);
        recipients.push(bccIdentity);
        involvesIdentities[bccIdentity.id] = true;
        let bccCard = bccIdentity.abCard;
        if (bccCard) {
          involvedAddrBookCount++;
          // @testpoint gloda.noun.message.attr.recipientsMatch
          aGlodaMessage._indexRecipients += ' ' + bccCard.displayName;
        }
      }
      // optimization attribute cc-me ('I' am the parameter)
      if (bccIdentity.id in myIdentities) {
        toMe.push([bccIdentity, authorIdentity]);
        if (aIsNew)
          authorIdentity.contact.popularity += this.POPULARITY_BCC_ME;
      }
      // optimization attribute from-me-to ('I' am the parameter)
      if (isFromMe) {
        fromMe.push([authorIdentity, bccIdentity]);
        // also, popularity
        if (aIsNew)
          bccIdentity.contact.popularity += this.POPULARITY_FROM_ME_BCC;
      }
    }

    if (involvedAddrBookCount)
      aGlodaMessage.notability += this.NOTABILITY_INVOLVING_ADDR_BOOK_FIRST +
        (involvedAddrBookCount - 1) * this.NOTABILITY_INVOLVING_ADDR_BOOK_ADDL;

    aGlodaMessage.involves = involves;
    aGlodaMessage.recipients = recipients;
    if (toMe.length) {
      aGlodaMessage.toMe = toMe;
      aGlodaMessage.notability += this.NOTABILITY_INVOLVING_ME;
    }
    if (fromMe.length)
      aGlodaMessage.fromMe = fromMe;

    // Content
    if (aRawReps.bodyLines) {
      aGlodaMessage._content = aRawReps.content = new GlodaContent();
      if (this.contentWhittle({}, aRawReps.bodyLines, aGlodaMessage._content)) {
        // we were going to do something here?
      }
    }
    else {
      aRawReps.content = null;
    }

    yield Gloda.kWorkDone;
  },

  /**
   * Duplicates the notability logic from optimize().  Arguably optimize should
   *  be factored to call us, grokNounItem should be factored to call us, or we
   *  should get sufficiently fancy that our code wildly diverges.
   */
  score: function gloda_fundattr_score(aMessage, aContext) {
    let score = 0;

    let authorIdentity = aMessage.from;
    if (authorIdentity.id in Gloda.myIdentities)
      score += this.NOTABILITY_FROM_ME;
    else if (authorIdentity.inAddressBook)
      score += this.NOTABILITY_FROM_IN_ADDR_BOOK;
    if (aMessage.toMe)
      score += this.NOTABILITY_INVOLVING_ME;

    let involvedAddrBookCount = 0;
    for (let [, identity] in Iterator(aMessage.to))
      if (identity.inAddressBook)
        involvedAddrBookCount++;
    for (let [, identity] in Iterator(aMessage.cc))
      if (identity.inAddressBook)
        involvedAddrBookCount++;
    if (involvedAddrBookCount)
      score += this.NOTABILITY_INVOLVING_ADDR_BOOK_FIRST +
        (involvedAddrBookCount - 1) * this.NOTABILITY_INVOLVING_ADDR_BOOK_ADDL;
    return score;
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
  contentWhittle: function gloda_fundattr_contentWhittle(aMeta,
      aBodyLines, aContent) {
    if (!aContent.volunteerContent(aContent.kPriorityBase))
      return false;

    // duplicate the list; we mutate somewhat...
    let bodyLines = aBodyLines.concat();

    // lastNonBlankLine originally was just for detecting quoting idioms where
    //  the "wrote" line was separated from the quoted block by a blank line.
    // Now we also use it for whitespace suppression at the boundaries of
    //  quoted and un-quoted text.  (We keep blank lines within the same
    //  'block' of quoted or non-quoted text.)
    // Because we now have two goals for it, and we still want to suppress blank
    //  lines when there is a 'wrote' line involved, we introduce...
    //  prevLastNonBlankLine!  This arguably suggests refactoring should be the
    //  next step, but things work for now.
    let rangeStart = 0, lastNonBlankLine = null, prevLastNonBlankLine = null;
    let inQuoteDepth = 0;
    for each (let [iLine, line] in Iterator(bodyLines)) {
      if (!line || (line == "\xa0")) /* unicode non breaking space */
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
              // we 'used up' lastNonBlankLine, let's promote the prev guy to
              //  be the new lastNonBlankLine for the next logic block
              lastNonBlankLine = prevLastNonBlankLine;
            }
            // eat the trailing whitespace...
            if (lastNonBlankLine != null)
              rangeEnd = Math.min(rangeEnd, lastNonBlankLine);
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

      prevLastNonBlankLine = lastNonBlankLine;
      lastNonBlankLine = iLine;
    }

    if (inQuoteDepth) {
      aContent.quoted(aBodyLines.slice(rangeStart), inQuoteDepth);
    }
    else {
      aContent.content(aBodyLines.slice(rangeStart, lastNonBlankLine+1));
    }

    return true;
  },
};
