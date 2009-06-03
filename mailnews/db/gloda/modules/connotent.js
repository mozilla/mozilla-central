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
 *   David Ascerh <dascher@mozillamessaging.com>
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

EXPORTED_SYMBOLS = ['GlodaContent', 'whittlerRegistry',
                    'mimeMsgToContentAndMeta', 'mimeMsgToContentSnippetAndMeta'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://app/modules/gloda/log4moz.js");

const LOG = Log4Moz.repository.getLogger("gloda.connotent");



/**
 * Given a MimeMsg and the corresponding folder, return the GlodaContent object.
 *
 * @param aMimeMsg: the MimeMessage instance
 * @param folder: the nsIMsgDBFolder
 * @return an array containing the GlodaContent instance, and the meta dictionary
 * that the Gloda content providers may have filled with useful data.
 */

function mimeMsgToContentAndMeta(aMimeMsg, folder) {
  let content = new GlodaContent();
  let meta = {subject: aMimeMsg.get("subject")};
  let bodyLines = aMimeMsg.coerceBodyToPlaintext(folder).split(/\r?\n/);

  for each (let [, whittler] in Iterator(whittlerRegistry.getWhittlers()))
    whittler.contentWhittle(meta, bodyLines, content);

  return [content, meta];
}


/**
 * Given a MimeMsg, return the whittled content string, suitable for summarizing
 * a message.
 *
 * @param aMimeMsg: the MimeMessage instance
 * @param folder: the nsIMsgDBFolder
 * @param length: optional number of characters to trim the whittled content.
 * If the actual length of the message is greater than |length|, then the return
 * value is the first (length-1) characters with an ellipsis appended.
 * @return an array containing the text of the snippet, and the meta dictionary
 * that the Gloda content providers may have filled with useful data.
 */

function mimeMsgToContentSnippetAndMeta(aMimeMsg, folder, length) {
  let [content, meta] = mimeMsgToContentAndMeta(aMimeMsg, folder);
  
  let text = content.getContentSnippet(length);
  if (length && text.length > length)
    text = text.substring(0, length-1) + "\u2026"; // ellipsis

  return [text, meta];
}


/**
 * A registry of gloda providers that have contentWhittle() functions.
 * used by mimeMsgToContentSnippet, but populated by the Gloda object as it's
 * processing providers.
 */
function WhittlerRegistry() {
  this._whittlers = [];
}

WhittlerRegistry.prototype = {
  /**
   * Add a provider as a content whittler.
   */
  registerWhittler: function whittler_registry_registerWhittler(provider) {
    this._whittlers.push(provider);
  },
  /**
   * get the list of content whittlers, sorted from the most specific to
   * the most generic
   */
  getWhittlers: function whittler_registry_getWhittlers() {
    // Use the concat() trick to avoid mutating the internal object and
    // leaking an internal representation.
    return this._whittlers.concat().reverse();
  }
}

whittlerRegistry = new WhittlerRegistry();

function GlodaContent() {
  this._contentPriority = null;
  this._producing = false;
  this._hunks = [];
}

GlodaContent.prototype = {
  kPriorityBase: 0,
  kPriorityPerfect: 100,
  
  kHunkMeta: 1,
  kHunkQuoted: 2,
  kHunkContent: 3,
  
  _resetContent: function gloda_content__resetContent() {
    this._keysAndValues = [];
    this._keysAndDeltaValues = [];
    this._hunks = [];
    this._curHunk = null;
  },
  
  /* ===== Consumer API ===== */
  hasContent: function gloda_content_hasContent() {
    return (this._contentPriority != null);
  },
  
  /**
   * Return content suitable for snippet display.  This means that no quoting
   *  or meta-data should be returned.
   * 
   * @param aMaxLength The maximum snippet length desired.
   */
  getContentSnippet: function gloda_content_getContentSnippet(aMaxLength) {
    let content = this.getContentString();
    if (aMaxLength)
      content = content.substring(0, aMaxLength);
    return content;
  },
  
  getContentString: function gloda_content_getContent(aIndexingPurposes) {
    let data = "";
    for each (let [, hunk] in Iterator(this._hunks)) {
      if (hunk.hunkType == this.kHunkContent) {
        if (data)
          data += "\n" + hunk.data;
        else
          data = hunk.data;
      }
    }
    
    if (aIndexingPurposes) {
      // append the values for indexing.  we assume the keywords are cruft.
      // this may be crazy, but things that aren't a science aren't an exact
      // science.
      for each (let [, kv] in Iterator(this._keysAndValues)) {
        data += "\n" + kv[1];
      }
      for each (let [, kon] in Iterator(this._keysAndValues)) {
        data += "\n" + kon[1] + "\n" + kon[2];
      }
    }
    
    return data;
  },
  
  /* ===== Producer API ===== */
  /**
   * Called by a producer with the priority they believe their interpretation
   *  of the content comes in at.
   * 
   * @returns true if we believe the producer's interpretation will be
   *     interesting and they should go ahead and generate events.  We return
   *     false if we don't think they are interesting, in which case they should
   *     probably not issue calls to us, although we don't care.  (We will
   *     ignore their calls if we return false, this allows the simplification
   *     of code that needs to run anyways.)
   */
  volunteerContent: function gloda_content_volunteerContent(aPriority) {
    if (this._contentPriority === null || this._contentPriority < aPriority) {
      this._contentPriority = aPriority;
      this._resetContent();
      this._producing = true;
      return true;
    }
    this._producing = false;
    return false;
  },
  
  keyValue: function gloda_content_keyValue(aKey, aValue) {
    if (!this._producing)
      return;

    this._keysAndValues.push([aKey, aValue]);
  },
  keyValueDelta: function gloda_content_keyValueDelta (aKey, aOldValue,
      aNewValue) {
    if (!this._producing)
      return;

    this._keysAndDeltaValues.push([aKey, aOldValue, aNewValue]);
  },
  
  /**
   * Meta lines are lines that have to do with the content but are not the
   *  content and can generally be related to an attribute that has been derived
   *  and stored on the item.
   * For example, a bugzilla bug may note that an attachment was created; this
   *  is not content and wouldn't be desired in a snippet, but is still
   *  potentially interesting meta-data.
   * 
   * @param aLineOrLines The line or list of lines that are meta-data.
   * @param aAttr The attribute this meta-data is associated with.
   * @param aIndex If the attribute is non-singular, indicate the specific
   *     index of the item in the attribute's bound list that the meta-data
   *     is associated with.
   */
  meta: function gloda_content_meta(aLineOrLines, aAttr, aIndex) {
    if (!this._producing)
      return;
    
    let data;
    if (typeof(aLineOrLines) == "string")
      data = aLineOrLines;
    else
      data = aLineOrLines.join("\n");
    
    this._curHunk = {hunkType: this.kHunkMeta, attr: aAttr, index: aIndex,
                     data: data};
    this._hunks.push(this._curHunk);
  },
  /**
   * Quoted lines reference previous messages or what not.
   * 
   * @param aLineOrLiens The line or list of lines that are quoted.
   * @param aDepth The depth of the quoting.
   * @param aOrigin The item that originated the original content, if known.
   *     For example, perhaps a GlodaMessage?
   * @param aTarget A reference to the location in the original content, if
   *     known.  For example, the index of a line in a message or something?  
   */
  quoted: function gloda_content_quoted(aLineOrLines, aDepth, aOrigin,
      aTarget) {
    if (!this._producing)
      return;
    
    let data;
    if (typeof(aLineOrLines) == "string")
      data = aLineOrLines;
    else
      data = aLineOrLines.join("\n");

    if (!this._curHunk ||
        this._curHunk.hunkType != this.kHunkQuoted ||
        this._curHunk.depth != aDepth ||
        this._curHunk.origin != aOrigin || this._curHunk.target != aTarget) {
      this._curHunk = {hunkType: this.kHunkQuoted, data: data,
                       depth: aDepth, origin: aOrigin, target: aTarget};
      this._hunks.push(this._curHunk);
    }
    else
      this._curHunk.data += "\n" + data; 
  },
  
  content: function gloda_content_content(aLineOrLines) {
    if (!this._producing)
      return;

    let data;
    if (typeof(aLineOrLines) == "string")
      data = aLineOrLines;
    else
      data = aLineOrLines.join("\n");
    
    if (!this._curHunk || this._curHunk.hunkType != this.kHunkContent) {
      this._curHunk = {hunkType: this.kHunkContent, data: data};
      this._hunks.push(this._curHunk);
    }
    else
      this._curHunk.data += "\n" + data;
  },
}
