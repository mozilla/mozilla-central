/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * This file provides the "explicit attribute" provider for messages.  It is
 *  concerned with attributes that are the result of user actions.  For example,
 *  whether a message is starred (flagged), message tags, whether it is
 *  read/unread, etc.
 */

const EXPORTED_SYMBOLS = ['GlodaExplicitAttr'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource:///modules/gloda/log4moz.js");
Cu.import("resource:///modules/StringBundle.js");

Cu.import("resource:///modules/gloda/utils.js");
Cu.import("resource:///modules/gloda/gloda.js");
Cu.import("resource:///modules/gloda/noun_tag.js");
Cu.import("resource:///modules/mailServices.js");


const nsMsgMessageFlags_Replied = Ci.nsMsgMessageFlags.Replied;
const nsMsgMessageFlags_Forwarded = Ci.nsMsgMessageFlags.Forwarded;

const EXT_BUILTIN = "built-in";

/**
 * @namespace Explicit attribute provider.  Indexes/defines attributes that are
 *  explicitly a result of user action.  This dubiously includes marking a
 *  message as read.
 */
var GlodaExplicitAttr = {
  providerName: "gloda.explattr",
  strings: new StringBundle("chrome://messenger/locale/gloda.properties"),
  _log: null,
  _msgTagService: null,

  init: function gloda_explattr_init() {
    this._log =  Log4Moz.repository.getLogger("gloda.explattr");

    this._msgTagService = MailServices.tags;

    try {
      this.defineAttributes();
    }
    catch (ex) {
      this._log.error("Error in init: " + ex);
      throw ex;
    }
  },

  /** Boost for starred messages. */
  NOTABILITY_STARRED: 16,
  /** Boost for tagged messages, first tag. */
  NOTABILITY_TAGGED_FIRST: 8,
  /** Boost for tagged messages, each additional tag. */
  NOTABILITY_TAGGED_ADDL: 1,

  defineAttributes: function() {
    // Tag
    this._attrTag = Gloda.defineAttribute({
                        provider: this,
                        extensionName: Gloda.BUILT_IN,
                        attributeType: Gloda.kAttrExplicit,
                        attributeName: "tag",
                        bindName: "tags",
                        singular: false,
                        emptySetIsSignificant: true,
                        facet: true,
                        subjectNouns: [Gloda.NOUN_MESSAGE],
                        objectNoun: Gloda.NOUN_TAG,
                        parameterNoun: null,
                        // Property change notifications that we care about:
                        propertyChanges: ["keywords"],
                        }); // not-tested

    // Star
    this._attrStar = Gloda.defineAttribute({
                        provider: this,
                        extensionName: Gloda.BUILT_IN,
                        attributeType: Gloda.kAttrExplicit,
                        attributeName: "star",
                        bindName: "starred",
                        singular: true,
                        facet: true,
                        subjectNouns: [Gloda.NOUN_MESSAGE],
                        objectNoun: Gloda.NOUN_BOOLEAN,
                        parameterNoun: null,
                        }); // tested-by: test_attributes_explicit
    // Read/Unread
    this._attrRead = Gloda.defineAttribute({
                        provider: this,
                        extensionName: Gloda.BUILT_IN,
                        attributeType: Gloda.kAttrExplicit,
                        attributeName: "read",
                        singular: true,
                        subjectNouns: [Gloda.NOUN_MESSAGE],
                        objectNoun: Gloda.NOUN_BOOLEAN,
                        parameterNoun: null,
                        }); // tested-by: test_attributes_explicit

    /**
     * Has this message been replied to by the user.
     */
    this._attrRepliedTo = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrExplicit,
      attributeName: "repliedTo",
      singular: true,
      subjectNouns: [Gloda.NOUN_MESSAGE],
      objectNoun: Gloda.NOUN_BOOLEAN,
      parameterNoun: null,
    }); // tested-by: test_attributes_explicit

    /**
     * Has this user forwarded this message to someone.
     */
    this._attrForwarded = Gloda.defineAttribute({
      provider: this,
      extensionName: Gloda.BUILT_IN,
      attributeType: Gloda.kAttrExplicit,
      attributeName: "forwarded",
      singular: true,
      subjectNouns: [Gloda.NOUN_MESSAGE],
      objectNoun: Gloda.NOUN_BOOLEAN,
      parameterNoun: null,
    }); // tested-by: test_attributes_explicit
  },

  process: function Gloda_explattr_process(aGlodaMessage, aRawReps, aIsNew,
                                           aCallbackHandle) {
    let aMsgHdr = aRawReps.header;

    aGlodaMessage.starred = aMsgHdr.isFlagged;
    if (aGlodaMessage.starred)
      aGlodaMessage.notability += this.NOTABILITY_STARRED;

    aGlodaMessage.read = aMsgHdr.isRead;

    let flags = aMsgHdr.flags;
    aGlodaMessage.repliedTo = Boolean(flags & nsMsgMessageFlags_Replied);
    aGlodaMessage.forwarded = Boolean(flags & nsMsgMessageFlags_Forwarded);

    let tags = aGlodaMessage.tags = [];

    // -- Tag
    // build a map of the keywords
    let keywords = aMsgHdr.getStringProperty("keywords");
    let keywordList = keywords.split(' ');
    let keywordMap = {};
    for (let iKeyword = 0; iKeyword < keywordList.length; iKeyword++) {
      let keyword = keywordList[iKeyword];
      keywordMap[keyword] = true;
    }

    let tagArray = TagNoun.getAllTags();
    for (let iTag = 0; iTag < tagArray.length; iTag++) {
      let tag = tagArray[iTag];
      if (tag.key in keywordMap)
        tags.push(tag);
    }

    if (tags.length)
      aGlodaMessage.notability += this.NOTABILITY_TAGGED_FIRST +
        (tags.length - 1) * this.NOTABILITY_TAGGED_ADDL;

    yield Gloda.kWorkDone;
  },

  /**
   * Duplicates the notability logic from process().  Arguably process should
   *  be factored to call us, grokNounItem should be factored to call us, or we
   *  should get sufficiently fancy that our code wildly diverges.
   */
  score: function Gloda_explattr_score(aMessage, aContext) {
    let score = 0;
    if (aMessage.starred)
      score += this.NOTABILITY_STARRED;
    if (aMessage.tags.length)
      score += this.NOTABILITY_TAGGED_FIRST +
        (aMessage.tags.length - 1) * this.NOTABILITY_TAGGED_ADDL;
    return score;
  },
};
