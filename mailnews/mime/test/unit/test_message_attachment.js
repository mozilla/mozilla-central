/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 *   Mozilla Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jim Porter <squibblyflabbetydoo@gmail.com>
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

/**
 * This test verifies that we don't display text attachments inline
 * when mail.inline_attachments is false.
 */
load("../../../resources/mailDirService.js");
load("../../../resources/mailTestUtils.js");
load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");

load("../../../resources/messageGenerator.js");
load("../../../resources/messageModifier.js");
load("../../../resources/messageInjection.js");

let gMessenger = Cc["@mozilla.org/messenger;1"]
                   .createInstance(Ci.nsIMessenger);

// Create a message generator
const msgGen = gMessageGenerator = new MessageGenerator();

const textAttachment =
  "inline text attachment";

// create a message with a text attachment
let messages = [
  // unnamed email attachment
  { attachments: [{ body: textAttachment,
                    filename: 'test.txt',
                    format: '' },
                  { body: '',
                    expectedFilename: 'ForwardedMessage.eml',
                    contentType: 'message/rfc822', },
                 ]},
  // named email attachment
  { attachments: [{ body: textAttachment,
                    filename: 'test.txt',
                    format: '' },
                  { body: '',
                    filename: 'Attached Message',
                    contentType: 'message/rfc822', },
                 ]},
  // no named email attachment with subject header
  { attachments: [{ expectedFilename: 'testSubject.eml' }],
    bodyPart: new SyntheticPartMultiMixed([
      new SyntheticPartLeaf('plain body text'),
      msgGen.makeMessage({
        subject: '=?UTF-8?B?dGVzdFN1YmplY3Q?=', // This string is 'testSubject'.
        charset: 'UTF-8',
      }),
    ])},
];


let gStreamListener = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIStreamListener]),

  index: 0, // The index of the message we're currently looking at.

  // nsIRequestObserver part
  onStartRequest: function (aRequest, aContext) {
    this.contents = "";
    this.stream = null;
  },
  onStopRequest: function (aRequest, aContext, aStatusCode) {
    // Check that the attachments' filenames are as expected. Just use a regex
    // here because it's simple.
    let regex = /<legend class="mimeAttachmentHeaderName">(.*?)<\/legend>/gi;

    for (let [,attachment] in Iterator(messages[this.index].attachments)) {
      let match = regex.exec(this.contents);
      do_check_neq(match, null);
      do_check_eq(match[1], attachment.expectedFilename || attachment.filename);
    }
    do_check_eq(regex.exec(this.contents), null);

    this.index++;
    async_driver();
  },

  // nsIStreamListener part
  onDataAvailable: function (aRequest,aContext,aInputStream,aOffset,aCount) {
    if (this.stream === null) {
      this.stream = Cc["@mozilla.org/scriptableinputstream;1"].
                    createInstance(Ci.nsIScriptableInputStream);
      this.stream.init(aInputStream);
    }
    this.contents += this.stream.read(aCount);
  },
};

let gMessageHeaderSink = {
  handleAttachment: function(aContentType, aUrl, aDisplayName, aUri,
                             aIsExternalAttachment) {},
  addAttachmentField: function(aName, aValue) {},

  // stub functions from nsIMsgHeaderSink
  onStartHeaders: function() {},
  onEndHeaders: function() {},
  processHeaders: function(aHeaderNames, aHeaderValues, dontCollectAddrs) {},
  onEndAllAttachments: function() {},
  onEndMsgDownload: function() {},
  onEndMsgHeaders: function(aUrl) {},
  onMsgHasRemoteContent: function(aMsgHdr) {},
  securityInfo: null,
  mDummyMsgHeader: null,
  properties: null,
  resetProperties: function () {}
};

let msgWindow = Cc["@mozilla.org/messenger/msgwindow;1"]
                  .createInstance(Ci.nsIMsgWindow);
msgWindow.msgHeaderSink = gMessageHeaderSink;

function test_message_attachments(info) {
  let synMsg = gMessageGenerator.makeMessage(info);
  let synSet = new SyntheticMessageSet([synMsg]);
  yield add_sets_to_folder(gInbox, [synSet]);

  let msgURI = synSet.getMsgURI(0);
  let msgService = gMessenger.messageServiceFromURI(msgURI);

  let streamURI = msgService.streamMessage(
    msgURI,
    gStreamListener,
    msgWindow,
    null,
    true, // have them create the converter
    "header=filter",
    false);

  yield false;
}

/* ===== Driver ===== */

let tests = [
  parameterizeTest(test_message_attachments, messages),
];

let gInbox;

function run_test() {
  gInbox = configure_message_injection({mode: "local"});
  async_run_tests(tests);
}
