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
  this._channel = null;

  this._inputStream = null;
  this._outputStream = null;
  
  this._outputListener = null;
  
  this._rootMsg = null;
  this._messageStack = [];
  this._parentMsg = null;
  this._curMsg = null;
  
  this._messageIndex = 0;
  this._allSubMessages = [];
  
  this._partMap = {};
  this._curPart = null;
  this._curBodyPart = null;
  
  this._state = kStateUnknown;
}

MimeMessageEmitter.prototype = {
  classDescription: "JS Mime Message Emitter",
  classID: Components.ID("{8cddbbbc-7ced-46b0-a936-8cddd1928c24}"),
  contractID: "@mozilla.org/gloda/jsmimeemitter;1",
  
  _partRE: new RegExp("^[^?]+\?(?:[^&]+&)*part=([^&]+)(?:&[^&]+)*$"),
  
  _xpcom_categories: [{
    category: "mime-emitter",
    entry:
      "@mozilla.org/messenger/mimeemitter;1?type=application/x-js-mime-message",
  }],
  
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIMimeEmitter]),

  initialize: function mime_emitter_initialize(aUrl, aChannel, aFormat) {
    this._url = aUrl;
    this._curMsg = this._parentMsg = this._rootMsg = new this._mimeMsg.MimeMessage();
    this._curMsg.partName = "";
    this._partMap[""] = this._curMsg;
    
    this._mimeMsg.MsgHdrToMimeMessage.RESULT_RENDEVOUZ[aUrl.spec] =
      this._rootMsg;
    
    this._channel = aChannel;
  },
  
  complete: function mime_emitter_complete() {
    // dump("!!!!\n!!!!\n!!!!\n" + this._rootMsg.prettyString() + "\n");
    this._url = null;
    this._channel = null;
    
    this._inputStream = null;
    this._outputStream = null;
    
    this._outputListener = null;

    this._curMsg = this._parentMsg = this._messageStack = this._rootMsg = null;
    this._messageIndex = null;
    this._allSubMessages = null;
    
    this._partMap = null;
    this._curPart = null;
    this._curBodyPart = null;
  },
  
  setPipe: function mime_emitter_setPipe(aInputStream, aOutputStream) {
    this._inputStream = aInputStream;
    this._outputStream = aOutputStream;
  },
  set outputListener(aListener) {
    this._outputListener = aListener;
  },
  get outputListener() {
    return this._outputListener;
  }, 
  
  _beginPayload: function mime_emitter__beginPayload(aContentType, aIsPart) {
    aContentType = aContentType.toLowerCase();
    if (aContentType == "text/plain" || aContentType == "text/html") {
      this._curBodyPart = new this._mimeMsg.MimeBody(aContentType, aIsPart);
      this._parentMsg.bodyParts.push(this._curBodyPart);
      this._curPart = aIsPart ? this._curBodyPart : null;
    }
    else if (aContentType == "message/rfc822") {
      // startBody will take care of this
      this._curPart = this._curBodyPart = null;
    }
    // this is going to fall-down with TNEF encapsulation and such, we really
    //  need to just be consuming the object model.
    else if (aContentType.indexOf("multipart/") == 0) {
      this._curBodyPart = null;
      // alternatives are always parts for part numbering purposes
      this._curPart = aIsPart ? new this._mimeMsg.MimeContainer(aContentType)
                              : null;
    }
    else {
      this._curBodyPart = null;
      this._curPart = aIsPart ?
        new this._mimeMsg.MimeUnknown(aContentType, aIsPart) : null;
    }
  },
  
  // ----- Header Routines
  startHeader: function mime_emitter_startHeader(aIsRootMailHeader,
      aIsHeaderOnly, aMsgID, aOutputCharset) {
    this._state = kStateInHeaders;
    if (aIsRootMailHeader) {
      this.updateCharacterSet(aOutputCharset);
      // nothing to do curMsg-wise, already initialized.
    }
    else {
      this._curMsg = new this._mimeMsg.MimeMessage();
      
      this._curMsg.partName = this._savedPartPath;
      this._placePart(this._curMsg);
      delete this._savedPartPath;
      
      this._parentMsg.messages.push(this._curMsg);
      this._allSubMessages.push(this._curMsg);
    }
  },
  addHeaderField: function mime_emitter_addHeaderField(aField, aValue) {
    if (this._state == kStateInBody) {
      aField = aField.toLowerCase();
      let indexSemi = aValue.indexOf(";");
      if (indexSemi >= 0)
        aValue = aValue.substring(0, indexSemi);
      if (aField == "content-type")
        this._beginPayload(aValue, true);
      else if (aField == "x-jsemitter-part-path") {
        if (this._curPart) {
          this._curPart.partName = aValue;
          this._placePart(this._curPart);
        }
        else
          this._savedPartPath = aValue;
      }
      return;
    }
    if (this._state != kStateInHeaders)
      return;
    let lowerField = aField.toLowerCase();
    if (lowerField in this._curMsg.headers)
      this._curMsg.headers[lowerField].push(aValue);
    else
      this._curMsg.headers[lowerField] = [aValue];
  },
  addAllHeaders: function mime_emitter_addAllHeaders(aAllHeaders, aHeaderSize) {
    // This is called by the parsing code after the calls to AddHeaderField (or
    //  AddAttachmentField if the part is an attachment), and seems to serve
    //  a specialized, quasi-redundant purpose.  (nsMimeBaseEmitter creates a
    //  nsIMimeHeaders instance and hands it to the nsIMsgMailNewsUrl.)
    // nop
  },
  writeHTMLHeaders: function mime_emitter_writeHTMLHeaders() {
    // It does't look like this should even be part of the interface; I think
    //  only the nsMimeHtmlDisplayEmitter::EndHeader call calls this signature.
    // nop
  },
  endHeader: function mime_emitter_endHeader() {
  },
  updateCharacterSet: function mime_emitter_updateCharacterSet(aCharset) {
    // for non US-ASCII, ISO-8859-1, or UTF-8 charsets (case-insensitive),
    //  nsMimeBaseEmitter grabs the channel's content type, nukes the "charset="
    //  parameter if it exists, and tells the channel the updated content type
    //  and new character set.
    
    // Disabling for now; we get a NS_ERROR_NOT_IMPLEMENTED from the channel
    //  when we try and set the contentCharset... and I'm not totally up on the
    //  intent of why we were doing this in the first place.
    /*
    let upperCharset = aCharset.toUpperCase();
    
    if ((upperCharset != "US-ASCII") && (upperCharset != "ISO-8859-1") &&
        (upperCharset != "UTF-8")) {  
    
      let curContentType = this._channel.contentType;
      let charsetIndex = curContentType.toLowerCase().indexOf("charset=");
      if (charsetIndex >= 0) {
        // assume a space or semicolon delimits
        curContentType = curContentType.substring(0, charsetIndex-1);
      }
      
      this._channel.contentType = curContentType;
      this._channel.contentCharset = aCharset;
    }
    */
  },
  
  /**
   * Place a part in its proper location; requires the parent to be present.
   * 
   * @param aPart Part to place.
   */
  _placePart: function(aPart) {
    let partName = aPart.partName;
    this._partMap[partName] = aPart;
    let parentName = partName.substring(0, partName.lastIndexOf("."));
    let parentPart = this._partMap[parentName];
    if (parentPart)
      parentPart.parts.push(aPart);
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
    aPart.parts = oldPart.parts;

    // - remove it if it was a body part.  This can happen for text/plain
    //  attachments.  Like patches.
    // (climb the parents until we find a message/bodyparts holder...)
    while (parentPart.partName && !parentPart.bodyParts) {
      parentName = parentName.substring(0, parentName.lastIndexOf("."));
      parentPart = this._partMap[parentName];
    }
    if (parentPart.bodyParts && parentPart.bodyParts.indexOf(oldPart) >= 0)
      parentPart.bodyParts.splice(parentPart.bodyParts.indexOf(oldPart), 1);
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
  startBody: function mime_emitter_startBody(aIsBodyOnly, aMsgID, aOutCharset) {
    this._state = kStateInBody;
    
    this._messageStack.push(this._curMsg);
    this._parentMsg = this._curMsg;

    // begin payload processing
    let contentType = this._curMsg.get("content-type", "text/plain");
    let indexSemi = contentType.indexOf(";");
    if (indexSemi >= 0)
      contentType = contentType.substring(0, indexSemi);
    this._beginPayload(contentType, true);
    if (this._parentMsg.partName == "")
      this._curPart.partName = "1";
    else
      this._curPart.partName = this._curMsg.partName + ".1";
    this._placePart(this._curPart);
  },
  
  writeBody: function mime_emitter_writeBody(aBuf, aSize, aOutAmountWritten) {
    if (this._curBodyPart)
      this._curBodyPart.body += aBuf;
  },
  
  endBody: function mime_emitter_endBody() {
    this._messageStack.pop();
    this._parentMsg = this._messageStack[this._messageStack.length - 1];
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
