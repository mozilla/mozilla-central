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

EXPORTED_SYMBOLS = ['MsgHdrToMimeMessage',
                    'MimeMessage', 'MimeContainer', 'MimeUnknown',
                    'MimeMessageAttachment'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const EMITTER_MIME_CODE = "application/x-js-mime-message";

/**
 * The URL listener is surplus because the CallbackStreamListener ends up
 *  getting the same set of events, effectively.
 */
let dumbUrlListener = {
  OnStartRunningUrl: function (aUrl) {
  },
  OnStopRunningUrl: function (aUrl, aExitCode) {
  },
};

let gCallbacks = {};

function CallbackStreamListener(aMsgHdr, aCallbackThis, aCallback) {
  this._msgHdr = aMsgHdr;
  this._stream = null;
  if (aCallback === undefined) {
    this._callbackThis = null;
    this._callback = aCallbackThis;
  }
  else {
    this._callbackThis = aCallbackThis;
    this._callback = aCallback;
  }
}

CallbackStreamListener.prototype = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIStreamListener]),

  // nsIRequestObserver part
  onStartRequest: function (aRequest, aContext) {
  },
  onStopRequest: function (aRequest, aContext, aStatusCode) {
    aContext.QueryInterface(Ci.nsIURI);
    let message = MsgHdrToMimeMessage.RESULT_RENDEVOUZ[aContext.spec];
    if (message === undefined)
      message = null;

    delete MsgHdrToMimeMessage.RESULT_RENDEVOUZ[aContext.spec];
    
    if (this._callbackThis)
      this._callback.call(this._callbackThis, this._msgHdr, message);
    else
      this._callback.call(null, this._msgHdr, message);
    
    // null everyone out, we are getting hosed by some secretive horrible cycles
    this._msgHdr = null;
    this._stream = null;
    this._callbackThis = null;
    this._callback = null;
  },

  /* okay, our onDataAvailable should actually never be called.  the stream
     converter is actually eating everything except the start and stop
     notification. */
  // nsIStreamListener part
  onDataAvailable: function (aRequest,aContext,aInputStream,aOffset,aCount) {
    dump("this should not be happening! arrgggggh!\n")
    if (this._stream === null) {
      this._stream = Cc["@mozilla.org/scriptableinputstream;1"].
                    createInstance(Ci.nsIScriptableInputStream);
      this._stream.init(aInputStream);
    }
    this._stream.read(aCount);
    
  },
};

let gMessenger = Cc["@mozilla.org/messenger;1"].
                   createInstance(Ci.nsIMessenger);

/**
 * Starts retrieval of a MimeMessage instance for the given message header.
 *  Your callback will be called with the message header you provide and the
 *  
 * @param aMsgHdr The message header to retrieve the body for and build a MIME
 *     representation of the message.
 * @param aCallbackThis The (optional) 'this' to use for your callback function.
 * @param aCallback The callback function to invoke on completion of message
 *     parsing or failure.  The first argument passed will be the nsIMsgDBHdr
 *     you passed to this function.  The second argument will be the MimeMessage
 *     instance resulting from the processing on success, and null on failure. 
 */
function MsgHdrToMimeMessage(aMsgHdr, aCallbackThis, aCallback) {
  let msgURI = aMsgHdr.folder.getUriForMsg(aMsgHdr);
  let msgService = gMessenger.messageServiceFromURI(msgURI);
  
  let streamListener = new CallbackStreamListener(aMsgHdr,
                                                  aCallbackThis, aCallback);
  
  let streamURI = msgService.streamMessage(msgURI,
                                           streamListener, // consumer
                                           null, // nsIMsgWindow
                                           dumbUrlListener, // nsIUrlListener
                                           true, // have them create the converter
      // additional uri payload, note that "header=" is prepended automatically 
                                           "filter&emitter=js"); 
}

/**
 * Let the jsmimeemitter provide us with results.  The poor emitter (if I am
 *  understanding things correctly) is evaluated outside of the C.u.import
 *  world, so if we were to import him, we would not see him, but rather a new
 *  copy of him.  This goes for his globals, etc.  (and is why we live in this
 *  file right here).  Also, it appears that the XPCOM JS wrappers aren't
 *  magically unified so that we can try and pass data as expando properties
 *  on things like the nsIUri instances either.  So we have the jsmimeemitter
 *  import us and poke things into RESULT_RENDEVOUZ.  We put it here on this
 *  function to try and be stealthy and avoid polluting the namespaces (or
 *  encouraging bad behaviour) of our importers.
 *
 * If you can come up with a prettier way to shuttle this data, please do.
 */
MsgHdrToMimeMessage.RESULT_RENDEVOUZ = {};

/**
 * @ivar partName The MIME part, ex "1.2.2.1".  The partName of a (top-level)
 *     message is "1", its first child is "1.1", its second child is "1.2",
 *     its first child's first child is "1.1.1", etc.
 * @ivar headers Maps lower-cased header field names to a list of the values
 *     seen for the given header.  Use get or getAll as convenience helpers.
 * @ivar body The body of the message.
 * @ivar messages A list of the sub-message children of this message.  Strict
 *     MIME part hierarchy is not maintained; a sub-message's parent is the
 *     closest sub-message above it.  Sub-messages can also be found in the
 *     parts list, if you want a more strict traversal.
 * @ivar parts The list of the MIME part children of this message.  Children
 *     will be either MimeMessage instances, MimeMessageAttachment instances,
 *     MimeContainer instances, or MimeUnknown instances.  The latter two are
 *     the result of limitations in the Javascript representation generation  
 *     at this time, combined with the need to most accurately represent the
 *     MIME structure.
 */
function MimeMessage() {
  this.partName = null;
  this.headers = {};
  this.body = "";

  this.messages = [];
  this.attachments = [];

  this.parts = [];
}

MimeMessage.prototype = {
  /**
   * Look-up a header that should be present at most once.
   *
   * @param aHeaderName The header name to retrieve, case does not matter.
   * @param aDefaultValue The value to return if the header was not found, null
   *     if left unspecified.
   * @return the value of the header if present, and the default value if not
   *  (defaults to null).  If the header was present multiple times, the first
   *  instance of the header is returned.  Use getAll if you want all of the
   *  values for the multiply-defined header.
   */
  get: function MimeMessage_get(aHeaderName, aDefaultValue) {
    if (aDefaultValue === undefined) {
      aDefaultValue = null;
    }
    let lowerHeader = aHeaderName.toLowerCase();
    if (lowerHeader in this.headers)
      // we require that the list cannot be empty if present
      return this.headers[lowerHeader][0];
    else
      return aDefaultValue;
  },
  /**
   * Look-up a header that can be present multiple times.  Use get for headers
   *  that you only expect to be present at most once.
   *
   * @param aHeaderName The header name to retrieve, case does not matter.
   * @return An array containing the values observed, which may mean a zero
   *     length array.
   */
  getAll: function MimeMessage_getAll(aHeaderName) {
    let lowerHeader = aHeaderName.toLowerCase();
    if (lowerHeader in this.headers)
      return this.headers[lowerHeader];
    else
      return [];
  },
  /**
   * @param aHeaderName Header name to test for its presence.
   * @return true if the message has (at least one value for) the given header
   *     name.
   */
  has: function MimeMessage_has(aHeaderName) {
    let lowerHeader = aHeaderName.toLowerCase();
    return lowerHeader in this.headers;
  },
  /**
   * @return a list of all attachments contained in this message and all its
   *     sub-messages.  Only MimeMessageAttachment instances will be present in
   *     the list (no sub-messages).
   */
  get allAttachments() {
    let results = []; // messages are not attachments, don't include self
    for (let iChild=0; iChild < this.parts.length; iChild++) {
      let child = this.parts[iChild];
      results = results.concat(child.allAttachments);
    }
    return results;
  },
  /**
   * Convert the message and its hierarchy into a "pretty string".  The message
   *  and each MIME part get their own line.  The string never ends with a
   *  newline.  For a non-multi-part message, only a single line will be
   *  returned.
   * Messages have their subject displayed, attachments have their filename and
   *  content-type (ex: image/jpeg) displayed.  "Filler" classes simply have
   *  their class displayed.
   */
  prettyString: function MimeMessage_prettyString(aIndent) {
    if (aIndent === undefined)
      aIndent = ""; 
    let nextIndent = aIndent + "  ";
  
    let s = "Message: " + this.headers.subject;
    
    for (let iPart=0; iPart < this.parts.length; iPart++) {
      let part = this.parts[iPart];
      s += "\n" + nextIndent + (iPart+1) + " " + part.prettyString(nextIndent);
    }
    
    return s;
  },
};

function MimeContainer(aPartName) {
  this.partName = aPartName;
  this.parts = [];
}

MimeContainer.prototype = {
  get allAttachments() {
    let results = [];
    for (let iChild=0; iChild < this.parts.length; iChild++) {
      let child = this.parts[iChild];
      results = results.concat(child.allAttachments);
    }
    return results;
  },
  prettyString: function MimeContainer_prettyString(aIndent) {
    let nextIndent = aIndent + "  ";
  
    let s = "Container";
    
    for (let iPart=0; iPart < this.parts.length; iPart++) {
      let part = this.parts[iPart];
      s += "\n" + nextIndent + (iPart+1) + " " + part.prettyString(nextIndent);
    }
    
    return s;
  },
}

function MimeUnknown(aPartName) {
  this.partName = aPartName;
}

MimeUnknown.prototype = {
  get allAttachments() {
    return []; // we are a leaf
  },
  prettyString: function MimeUnknown_prettyString(aIndent) {
    return "Unknown";
  },
}

function MimeMessageAttachment(aPartName, aName, aContentType, aUrl,
                               aIsExternal) {
  this.partName = aPartName;
  this.name = aName;
  this.contentType = aContentType;
  this.url = aUrl;
  this.isExternal = aIsExternal;
  
  this.fields = {};
}

MimeMessageAttachment.prototype = {
  /**
   * Is this an actual attachment, as far as we can tell?  An example of
   *  something that's not a real attachment is a mailing list footer that
   *  gets its own MIME part because the original message had both HTML and text
   *  as alternatives.
   * Our super-advanced heuristic is to check whether the attachment name is
   *  the same as the part name.
   */
  get isRealAttachment() {
    return this.name != "Part " + this.partName;
  },
  get allAttachments() {
    return [this]; // we are a leaf, so just us.
  },
  prettyString: function MimeMessageAttachment_prettyString(aIndent) {
    return "Attachment: " + this.name + ", " + this.contentType;
  },
};
