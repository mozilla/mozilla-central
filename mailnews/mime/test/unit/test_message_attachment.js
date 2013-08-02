/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This test verifies that we don't display text attachments inline
 * when mail.inline_attachments is false.
 */
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
  { attachments: [{ body: '', expectedFilename: 'testSubject.eml' }],
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
