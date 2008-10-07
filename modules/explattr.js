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

/*
 * This file provides the "explicit attribute" provider for messages.  It is
 *  concerned with attributes that are the result of user actions.  For example,
 *  whether a message is starred (flagged), message tags, whether it is
 *  read/unread, etc.
 */

EXPORTED_SYMBOLS = ['GlodaExplicitAttr'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gloda/modules/log4moz.js");

Cu.import("resource://gloda/modules/utils.js");
Cu.import("resource://gloda/modules/gloda.js");
Cu.import("resource://gloda/modules/noun_tag.js");


const EXT_BUILTIN = "built-in";
const FA_TAG = "TAG";
const FA_STAR = "STAR";
const FA_READ = "READ";

/**
 * @namespace Explicit attribute provider.  Indexes/defines attributes that are
 *  explicitly a result of user action.  This dubiously includes marking a
 *  message as read. 
 */
var GlodaExplicitAttr = {
  providerName: "gloda.explattr",
  _log: null,
  _strBundle: null,
  _msgTagService: null,

  init: function gloda_explattr_init(aStrBundle) {
    this._log =  Log4Moz.Service.getLogger("gloda.explattr");
    this._strBundle = aStrBundle;

    this._msgTagService = Cc["@mozilla.org/messenger/tagservice;1"].
                          getService(Ci.nsIMsgTagService);
  
    try {
      this.defineAttributes();
    }
    catch (ex) {
      this._log.error("Error in init: " + ex);
      throw ex;
    }
  },

  _attrTag: null,
  _attrStar: null,
  _attrRead: null,
  
  defineAttributes: function() {
    // Tag
    this._attrTag = Gloda.defineAttribute({
                        provider: this,
                        extensionName: Gloda.BUILT_IN,
                        attributeType: Gloda.kAttrExplicit,
                        attributeName: "tag",
                        bind: true,
                        bindName: "tags",
                        singular: false,
                        subjectNouns: [Gloda.NOUN_MESSAGE],
                        objectNoun: Gloda.NOUN_TAG,
                        parameterNoun: null,
                        explanation: this._strBundle.GetStringFromName(
                                       "attrTagExplanation"),
                        // Property change notifications that we care about:
                        propertyChanges: ["keywords"],
                        }); // not-tested
    Gloda.defineNounAction(Gloda.NOUN_TAG, {
      actionType: "filter", actionTarget: Gloda.NOUN_TAG,
      shortName: "same tag",
      makeConstraint: function(aAttrDef, aTagged) {
        return [GlodaExplicitAttr._attrTag].concat(
          TagNoun.toParamAndValue(aTagged, true));
      },
      });

    // Star
    this._attrStar = Gloda.defineAttribute({
                        provider: this,
                        extensionName: Gloda.BUILT_IN,
                        attributeType: Gloda.kAttrExplicit,
                        attributeName: "star",
                        bind: true,
                        bindName: "starred",
                        singular: true,
                        subjectNouns: [Gloda.NOUN_MESSAGE],
                        objectNoun: Gloda.NOUN_BOOLEAN,
                        parameterNoun: null,
                        explanation: this._strBundle.GetStringFromName(
                                       "attrStarExplanation"),
                        }); // tested-by: test_attributes_explicit
    // Read/Unread
    this._attrRead = Gloda.defineAttribute({
                        provider: this,
                        extensionName: Gloda.BUILT_IN,
                        attributeType: Gloda.kAttrExplicit,
                        attributeName: "read",
                        bind: true,
                        singular: true,
                        subjectNouns: [Gloda.NOUN_MESSAGE],
                        objectNoun: Gloda.NOUN_BOOLEAN,
                        parameterNoun: null,
                        explanation: this._strBundle.GetStringFromName(
                                       "attrReadExplanation"),
                        }); // tested-by: test_attributes_explicit
    
  },
  
  process: function Gloda_explattr_process(aGlodaMessage, aMsgHdr, aMimeMsg) {
    let attribs = [];
    
    attribs.push([this._attrStar.id, aMsgHdr.isFlagged ? 1 : 0]);
    attribs.push([this._attrRead.id, aMsgHdr.isRead ? 1 : 0]);
    
    // -- Tag
    // build a map of the keywords
    let keywords = aMsgHdr.getStringProperty("keywords");
    let keywordList = keywords.split(' ');
    let keywordMap = {};
    for (let iKeyword = 0; iKeyword < keywordList.length; iKeyword++) {
      let keyword = keywordList[iKeyword];
      keywordMap[keyword] = true;
    }

    let nowPRTime = Date.now() * 1000;

    let tagArray = this._msgTagService.getAllTags({});
    for (let iTag = 0; iTag < tagArray.length; iTag++) {
      let tag = tagArray[iTag];
      if (tag.key in keywordMap)
        attribs.push([this._attrTag, tag.key, nowPRTime]);
    }
    
    return attribs;
  },
};
