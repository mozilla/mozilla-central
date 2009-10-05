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

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

const kStateUnknown = 0;
const kStateInHeaders = 1;
const kStateInBody = 2;
const kStateInAttachment = 3;

/**
 * Custom nsIMimeEmitter to build a sub-optimal javascript representation of a
 *  MIME message.  The intent is that a better mechanism than is evolved to
 *  provide a javascript-accessible representation of the message.
 *
 * Processing occurs in two passes.  During the first pass, libmime is parsing
 *  the stream it is receiving, and generating header and body events for all
 *  MimeMessage instances it encounters.  This provides us with the knowledge
 *  of each nested message in addition to the top level message, their headers
 *  and sort-of their bodies.  The sort-of is that we may get more than
 *  would normally be displayed in cases involving multipart/alternatives.
 * We have augmented libmime to have a notify_nested_options parameter which
 *  is enabled when we are the consumer.  This option causes MimeMultipart to
 *  always emit a content-type header (via addHeaderField), defaulting to
 *  text/plain when an explicit value is not present.  Additionally,
 *  addHeaderField is called with a custom "x-jsemitter-part-path" header with
 *  the value being the part path (ex: 1.2.2).  Having the part path greatly
 *  simplifies our life for building the part hierarchy.
 * During the second pass, the libmime object model is traversed, generating
 *  attachment notifications for all leaf nodes.  From our perspective, this
 *  means file attachments and embedded messages (message/rfc822).  We use this
 *  pass to create the attachment objects proper, which we then substitute into
 *  the part tree we have already built.
 */
function MimeMessageEmitter() {
  this._mimeMsg = {};
  Cu.import("resource://app/modules/gloda/mimemsg.js", this._mimeMsg);

  this._url = null;

  this._outputListener = null;

  this._curPart = null;
  this._partMap = {};

  this._state = kStateUnknown;
}

const deathToNewlines = /\n/g;

MimeMessageEmitter.prototype = {
  classDescription: "JS Mime Message Emitter",
  classID: Components.ID("{8cddbbbc-7ced-46b0-a936-8cddd1928c24}"),
  contractID: "@mozilla.org/gloda/jsmimeemitter;1",

  _partRE: new RegExp("^[^?]+\\?(?:[^&]+&)*part=([^&]+)(?:&[^&]+)*$"),

  _xpcom_categories: [{
    category: "mime-emitter",
    entry:
      "@mozilla.org/messenger/mimeemitter;1?type=application/x-js-mime-message",
  }],

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIMimeEmitter]),

  initialize: function mime_emitter_initialize(aUrl, aChannel, aFormat) {
    this._url = aUrl;
    this._curPart = new this._mimeMsg.MimeMessage();
    // the partName is intentionally ""!  not a place-holder!
    this._curPart.partName = "";
    this._partMap[""] = this._curPart;

    this._mimeMsg.MsgHdrToMimeMessage.RESULT_RENDEVOUZ[aUrl.spec] =
      this._curPart;
  },

  complete: function mime_emitter_complete() {
    this._url = null;

    this._outputListener = null;

    this._curPart = null;
    this._partMap = null;
  },

  setPipe: function mime_emitter_setPipe(aInputStream, aOutputStream) {
    // we do not care about these
  },
  set outputListener(aListener) {
    this._outputListener = aListener;
  },
  get outputListener() {
    return this._outputListener;
  },

  _stripParams: function mime_emitter__stripParams(aValue) {
    let indexSemi = aValue.indexOf(";");
    if (indexSemi >= 0)
        aValue = aValue.substring(0, indexSemi);
    return aValue;
  },

  _beginPayload: function mime_emitter__beginPayload(aContentType) {
    let contentTypeNoParams = this._stripParams(aContentType).toLowerCase();
    if (contentTypeNoParams == "text/plain" ||
        contentTypeNoParams == "text/html") {
      this._curPart = new this._mimeMsg.MimeBody(contentTypeNoParams);
    }
    else if (contentTypeNoParams == "message/rfc822") {
      // startHeader will take care of this
      this._curPart = new this._mimeMsg.MimeMessage();
      // do not fall through into the content-type setting case; this
      //  content-type needs to get clobbered by the actual content-type of
      //  the enclosed message.
      return;
    }
    // this is going to fall-down with TNEF encapsulation and such, we really
    //  need to just be consuming the object model.
    else if (contentTypeNoParams.indexOf("multipart/") == 0) {
      this._curPart = new this._mimeMsg.MimeContainer(contentTypeNoParams);
    }
    else {
      this._curPart = new this._mimeMsg.MimeUnknown(contentTypeNoParams);
    }
    // put the full content-type in the headers and normalize out any newlines
    this._curPart.headers["content-type"] =
      [aContentType.replace(deathToNewlines, "")];
  },

  // ----- Header Routines
  /**
   * StartHeader provides the base case for our processing.  It is the first
   *  notification we receive when processing begins on the outer rfc822
   *  message.  We do not receive an x-jsemitter-part-path notification for the
   *  message, but the aIsRootMailHeader tells us everything we need to know.
   *  (Or it would if we hadn't already set everything up in initialize.)
   *
   * When dealing with nested RFC822 messages, we will receive the
   *  addHeaderFields for the content-type and the x-jsemitter-part-path
   *  prior to the startHeader call.  This is because the MIME multipart
   *  container that holds the message is the one generating the notification.
   *  For that reason, we do not process them here, but instead in
   *  addHeaderField and _beginPayload.
   *
   * We do need to track our state for addHeaderField's benefit though.
   */
  startHeader: function mime_emitter_startHeader(aIsRootMailHeader,
      aIsHeaderOnly, aMsgID, aOutputCharset) {
    this._state = kStateInHeaders;
  },
  /**
   * Receives a header field name and value for the current MIME part, which
   *  can be an rfc822/message or one of its sub-parts.
   *
   * The emitter architecture treats rfc822/messages as special because it was
   *  architected around presentation.  In that case, the organizing concept
   *  is the single top-level rfc822/message.  (It did not 'look into' nested
   *  messages in most cases.)
   * As a result the interface is biased towards being 'in the headers' or
   *  'in the body', corresponding to calls to startHeader and startBody,
   *  respectively.
   * This information is interesting to us because the message itself is an
   *  odd pseudo-mime-part.  Because it has only one child, its headers are,
   *  in a way, its payload, but they also serve as the description of its
   *  MIME child part.  This introduces a complication in that we see the
   *  content-type for the message's "body" part before we actually see any
   *  of the headers.  To deal with this, we punt on the construction of the
   *  body part to the call to startBody() and predicate our logic on the
   *  _state field.
   */
  addHeaderField: function mime_emitter_addHeaderField(aField, aValue) {
    if (this._state == kStateInBody) {
      aField = aField.toLowerCase();
      if (aField == "content-type")
        this._beginPayload(aValue, true);
      else if (aField == "x-jsemitter-part-path") {
        // This is either naming the current part, or referring to an already
        //  existing part (in the case of multipart/related on its second pass).
        // As such, check if the name already exists in our part map.
        let partName = this._stripParams(aValue);
        // if it does, then make the already-existing part at that path current
        if (partName in this._partMap)
          this._curPart = this._partMap[partName];
        // otherwise, name the part we are holding onto and place it.
        else {
          this._curPart.partName = partName;
          this._placePart(this._curPart);
        }
      }
      // There is no other field to be emitted in the body case other than the
      //  ones we just handled.  (They were explicitly added for the js
      //  emitter.)
    }
    else if (this._state == kStateInHeaders) {
      let lowerField = aField.toLowerCase();
      if (lowerField in this._curPart.headers)
        this._curPart.headers[lowerField].push(aValue);
      else
        this._curPart.headers[lowerField] = [aValue];
    }
  },
  addAllHeaders: function mime_emitter_addAllHeaders(aAllHeaders, aHeaderSize) {
    // This is called by the parsing code after the calls to AddHeaderField (or
    //  AddAttachmentField if the part is an attachment), and seems to serve
    //  a specialized, quasi-redundant purpose.  (nsMimeBaseEmitter creates a
    //  nsIMimeHeaders instance and hands it to the nsIMsgMailNewsUrl.)
    // nop
  },
  writeHTMLHeaders: function mime_emitter_writeHTMLHeaders(aName) {
    // It does't look like this should even be part of the interface; I think
    //  only the nsMimeHtmlDisplayEmitter::EndHeader call calls this signature.
    // nop
  },
  endHeader: function mime_emitter_endHeader(aName) {
  },
  updateCharacterSet: function mime_emitter_updateCharacterSet(aCharset) {
    // we do not need to worry about this.  it turns out this notification is
    //  exclusively for the benefit of the UI.  libmime, believe it or not,
    //  is actually doing the right thing under the hood and handles all the
    //  encoding issues for us.
    // so, get ready for the only time you will ever hear this:
    //  three cheers for libmime!
  },

  /**
   * Place a part in its proper location; requires the parent to be present.
   * However, we no longer require in-order addition of children.  (This is
   *  currently a hedge against extension code doing wacky things.  Our
   *  motivating use-case is multipart/related which actually does generate
   *  everything in order on its first pass, but has a wacky second pass. It
   *  does not actually trigger the out-of-order code because we have
   *  augmented the libmime code to generate its x-jsemitter-part-path info
   *  a second time, in which case we reuse the part we already created.)
   *
   * @param aPart Part to place.
   */
  _placePart: function(aPart) {
    let partName = aPart.partName;
    this._partMap[partName] = aPart;
    let lastDotIndex = partName.lastIndexOf(".");
    let parentName = partName.substring(0, lastDotIndex);
    let parentPart = this._partMap[parentName];
    if (parentPart !== undefined) {
      let indexInParent = parseInt(partName.substring(lastDotIndex+1)) - 1;
      // handle out-of-order notification...
      if (indexInParent < parentPart.parts.length)
        parentPart.parts[indexInParent] = aPart;
      else {
        while (indexInParent > parentPart.parts.length)
          parentPart.parts.push(null);
        parentPart.parts.push(aPart);
      }
    }
  },

  /**
   * In the case of attachments, we need to replace an existing part with a
   *  more representative part...
   *
   * @param aPart Part to place.
   */
  _replacePart: function(aPart) {
    let partName = aPart.partName;
    this._partMap[partName] = aPart;

    let parentName = partName.substring(0, partName.lastIndexOf("."));
    let parentPart = this._partMap[parentName];

    let childNamePart = partName.substring(partName.lastIndexOf(".")+1);
    let childIndex = parseInt(childNamePart) - 1;

    let oldPart = parentPart.parts[childIndex];
    parentPart.parts[childIndex] = aPart;
    // copy over information from the original part
    aPart.parts = oldPart.parts;
    aPart.headers = oldPart.headers;
  },

  // ----- Attachment Routines
  // The attachment processing happens after the initial streaming phase (during
  //  which time we receive the messages, both bodies and headers).  Our caller
  //  traverses the libmime child object hierarchy, emitting an attachment for
  //  each leaf object or sub-message.
  startAttachment: function mime_emitter_startAttachment(aName, aContentType,
      aUrl, aIsExternalAttachment) {
    this._state = kStateInAttachment;

    if (aContentType == "message/rfc822") {
      // we already have all we need to know about the message, ignore it
    }
    else if (aIsExternalAttachment) {
      // external attachments do not pass their part path information.
      // both aUrl in this call and the call to addAttachmentField (with
      // X-Mozilla-PartURL) receive the same thing; the URL to the file on disk.
    }
    else {
      // we need to strip our magic flags from the URL
      aUrl = aUrl.replace("header=filter&emitter=js&", "");
      // the url should contain a part= piece that tells us the part name, which
      //  we then use to figure out where.
      let partMatch = this._partRE.exec(aUrl);
      if (partMatch) {
        let part = new this._mimeMsg.MimeMessageAttachment(partMatch[1],
            aName, aContentType, aUrl, aIsExternalAttachment);
        if (part.isRealAttachment) {
          // replace the existing part with the attachment...
          this._replacePart(part);
        }
      }
    }
  },
  addAttachmentField: function mime_emitter_addAttachmentField(aField, aValue) {
    // all that gets passed in here is X-Mozilla-PartURL with a value that
    //  is completely identical to aUrl from the call to startAttachment.
    //  (it's the same variable they use in each case).  As such, there is
    //  no reason to handle anything here.
  },
  endAttachment: function mime_emitter_endAttachment() {
    // don't need to do anything here, since we don't care about the headers.
  },
  endAllAttachments: function mime_emitter_endAllAttachments() {
    // nop
  },

  // ----- Body Routines
  /**
   * We don't get an x-jsemitter-part-path for the message body, and we ignored
   *  our body part's content-type in addHeaderField, so this serves as our
   *  notice to set up the part (giving it a name).
   */
  startBody: function mime_emitter_startBody(aIsBodyOnly, aMsgID, aOutCharset) {
    this._state = kStateInBody;

    let subPartName = (this._curPart.partName == "") ?
                        "1" :
                        this._curPart.partName + ".1";
    this._beginPayload(this._curPart.get("content-type", "text/plain"));
    this._curPart.partName = subPartName;
    this._placePart(this._curPart);
  },

  writeBody: function mime_emitter_writeBody(aBuf, aSize, aOutAmountWritten) {
    this._curPart.body += aBuf;
  },

  endBody: function mime_emitter_endBody() {
  },

  // ----- Generic Write (confusing)
  // (binary data writing...)
  write: function mime_emitter_write(aBuf, aSize, aOutAmountWritten) {
    // we don't actually ever get called because we don't have the attachment
    //  binary payloads pass through us, but we do the following just in case
    //  we did get called (otherwise the caller gets mad and throws exceptions).
    aOutAmountWritten.value = aSize;
  },

  // (string writing)
  utilityWrite: function mime_emitter_utilityWrite(aBuf) {
    this.write(aBuf, aBuf.length, {});
  },
};

var components = [MimeMessageEmitter];
function NSGetModule(compMgr, fileSpec) {
  return XPCOMUtils.generateModule(components);
}
