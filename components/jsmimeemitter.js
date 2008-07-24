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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

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
 */
function MimeMessageEmitter() {
  this._mimeMsg = {};
  Components.utils.import("resource://gloda/modules/mimemsg.js",
                          this._mimeMsg);

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
}

MimeMessageEmitter.prototype = {
  classDescription: "JS Mime Message Emitter",
  classID: Components.ID("{80578315-7021-40f9-9717-413cacf2fa7d}"),
  contractID: "@mozilla.org/steeldestined/jsmimeemitter;1",
  
  _xpcom_categories: [{
    category: "mime-emitter",
    entry:
      "@mozilla.org/messenger/mimeemitter;1?type=application/x-js-mime-message",
  }],
  
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIMimeEmitter]),

  Initialize: function mime_emitter_Initialize(aUrl, aChannel, aFormat) {
    this._partRE = new RegExp("^[^?]+\?(?:[^&]+&)*part=([^&]+)(?:&[^&]+)*$");

    this._url = aUrl;
    this._curMsg = this._parentMsg = this._rootMsg = new this._mimeMsg.MimeMessage();
    
    this._mimeMsg.MsgHdrToMimeMessage.RESULT_RENDEVOUZ[aUrl.spec] =
      this._rootMsg;
    
    this._channel = aChannel;
  },
  
  Complete: function mime_emitter_Complete() {
  },
  
  SetPipe: function mime_emitter_SetPipe(aInputStream, aOutputStream) {
    this._inputStream = aInputStream;
    this._outputStream = aOutputStream;
  },
  // can we use getters/setters to replace explicit functions on the interface?
  SetOutputListener: function mime_emitter_SetOutputListener(aListener) {
    this._outputListener = aListener;
  },
  GetOutputListener: function mime_emitter_GetOutputListener() {
    return this._outputListener;
  }, 
  
  // ----- Header Routines
  StartHeader: function mime_emitter_StartHeader(aIsRootMailHeader,
      aIsHeaderOnly, aMsgID, aOutputCharset) {
    
    if (aIsRootMailHeader) {
      this.UpdateCharacterSet(aOutputCharset);
      // nothing to do curMsg-wise, already initialized.
    }
    else {
      this._curMsg = new this._mimeMsg.MimeMessage();
      this._parentMsg.messages.push(this._curMsg);
      this._allSubMessages.push(this._curMsg);
    }
  },
  AddHeaderField: function mime_emitter_AddHeaderField(aField, aValue) {
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
  WriteHTMLHeaders: function mime_emitter_WriteHTMLHeaders() {
    // It does't look like this should even be part of the interface; I think
    //  only the nsMimeHtmlDisplayEmitter::EndHeader call calls this signature.
    // nop
  },
  EndHeader: function mime_emitter_EndHeader() {
  },
  UpdateCharacterSet: function mime_emitter_UpdateCharacterSet(aCharset) {
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
   * Put a part at its proper location.  We rely on this method to be called
   *  in the the sequence generated by StartAttachment (an in-order traversal
   *  of the MIME structure).
   */
  _putPart: function(aPartPath, aPathSoFar, aPart, aParent) {
    let dotIndex = aPartPath.indexOf(".");
    let curPath, remPath;
    if (dotIndex >= 0) {
      curPath = aPartPath.substring(0, dotIndex);
      remPath = aPartPath.substring(dotIndex+1);
    }
    else {
      curPath = aPartPath;
      remPath = null;
    }
    let newPathSoFar = aPathSoFar + "." + curPath;
    let curIndex = parseInt(curPath) - 1;

    // add MimeUnknowns for parts that should already exist
    while (curIndex > aParent.parts.length) {
      aParent.parts.push(new this._mimeMsg.MimeUnknown(newPathSoFar));
    }
    
    // are we a leaf?
    if (remPath !== null) {
      // no, we are not a leaf
      if (curIndex == aParent.parts.length) {
        // and we need to add a container
        aParent.parts.push(new this._mimeMsg.MimeContainer(newPathSoFar));
      }
      this._putPart(remPath, newPathSoFar, aPart, aParent.parts[curIndex]);
    }
    else {
      // yes, we are a leaf, we just go here...
      aParent.parts.push(aPart);
    }
  },
  
  // ----- Attachment Routines
  // The attachment processing happens after the initial streaming phase (during
  //  which time we receive the messages, both bodies and headers).  Our caller
  //  traverses the libmime child object hierarchy, emitting an attachment for
  //  each leaf object or sub-message.
  StartAttachment: function mime_emitter_StartAttachment(aName, aContentType,
      aUrl, aNotDownloaded) {
    
    // we need to strip our magic flags from the URL
    aURl = aUrl.replace("header=filter&emitter=js&", "");
    
    // the url should contain a part= piece that tells us the part name, which
    //  we then use to figure out where.
    let partMatch = this._partRE.exec(aUrl);
    let partName = partMatch[1];

    let part;
    if (aContentType == "message/rfc822") {
      // since we are assuming an in-order traversal, it's safe to assume that
      //  we will see the messages in the same order we previously saw them.
      part = this._allSubMessages[this._messageIndex++];
      part.partName = partName;
    }
    else {
      // create the attachment
      part = new this._mimeMsg.MimeMessageAttachment(partName,
          aName, aContentType, aUrl, aNotDownloaded);
    }
    
    this._putPart(part.partName.substring(2), "1",
                  part, this._rootMsg);
  },
  AddAttachmentField: function mime_emitter_AddAttachmentField(aField, aValue) {
    // this only gives us X-Mozilla-PartURL, which is the same as aUrl we
    //  already got previously, so need to do anything with this.
  },
  EndAttachment: function mime_emitter_EndAttachment() {
    // don't need to do anything here, since we don't care about the headers.
  },
  EndAllAttachments: function mime_emitter_EndAllAttachments() {
    // nop
  },
  
  // ----- Body Routines
  StartBody: function mime_emitter_StartBody(aIsBodyOnly, aMsgID, aOutCharset) {
    this._messageStack.push(this._curMsg);
    this._parentMsg = this._curMsg;
  },
  
  WriteBody: function mime_emitter_WriteBody(aBuf, aSize, aOutAmountWritten) {
    this._curMsg.body += aBuf;
  },
  
  EndBody: function mime_emitter_EndBody() {
    this._messageStack.pop();
    this._parentMsg = this._messageStack[this._messageStack.length - 1];
  },
  
  // ----- Generic Write (confusing)
  // (binary data writing...)
  Write: function mime_emitter_Write(aBuf, aSize, aOutAmountWritten) {
    // we don't actually ever get called because we don't have the attachment
    //  binary payloads pass through us, but we do the following just in case
    //  we did get called (otherwise the caller gets mad and throws exceptions).
    aOutAmountWritten.value = aSize;
  },
  
  // (string writing)
  UtilityWrite: function mime_emitter_UtilityWrite(aBuf) {
    this.Write(aBuf, aBuf.length, {});
  },
};

var components = [MimeMessageEmitter];
function NSGetModule(compMgr, fileSpec) {
  return XPCOMUtils.generateModule(components);
}
