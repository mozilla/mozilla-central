/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This test creates some messages with attachments of different types and
 * checks that libmime emits (or doesn't emit) the attachments as appropriate.
 */
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
// Create a message scenario generator using that message generator
const scenarios = gMessageScenarioFactory = new MessageScenarioFactory(msgGen);

// create some messages that have various types of attachments
let messages = [
  {},

  /***** Attachments with Content-Disposition: attachment *****/

  // inline-able attachment with a name
  { attachments: [{ body: "attachment",
                    filename: "ubik.txt",
                    disposition: "attachment",
                    format: "",
                    shouldShow: true }],
  },
  // inline-able attachment with no name
  { attachments: [{ body: "attachment",
                    filename: "",
                    disposition: "attachment",
                    format: "",
                    shouldShow: true }],
  },
  // non-inline-able attachment with a name
  { attachments: [{ body: "attachment",
                    filename: "ubik.ubk",
                    disposition: "attachment",
                    contentType: "application/x-ubik",
                    format: "",
                    shouldShow: true }],
  },
  // non-inline-able attachment with no name
  { attachments: [{ body: "attachment",
                    filename: "",
                    disposition: "attachment",
                    contentType: "application/x-ubik",
                    format: "",
                    shouldShow: true }],
  },

  /***** Attachments with Content-Disposition: inline *****/

  // inline-able attachment with a name
  { attachments: [{ body: "attachment",
                    filename: "ubik.txt",
                    disposition: "inline",
                    format: "",
                    shouldShow: true }],
  },
  // inline-able attachment with no name
  { attachments: [{ body: "attachment",
                    filename: "",
                    disposition: "inline",
                    format: "",
                    shouldShow: false }],
  },
  // non-inline-able attachment with a name
  { attachments: [{ body: "attachment",
                    filename: "ubik.ubk",
                    disposition: "inline",
                    contentType: "application/x-ubik",
                    format: "",
                    shouldShow: true }],
  },
  // non-inline-able attachment with no name
  { attachments: [{ body: "attachment",
                    filename: "",
                    disposition: "inline",
                    contentType: "application/x-ubik",
                    format: "",
                    shouldShow: true }],
  },
];


let gStreamListener = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIStreamListener]),

  // nsIRequestObserver part
  onStartRequest: function (aRequest, aContext) {
  },
  onStopRequest: function (aRequest, aContext, aStatusCode) {
    let expectedAttachments = [i.filename for each (i in this.allAttachments)
                               if (i.shouldShow)];
    do_check_eq(expectedAttachments.length,
                gMessageHeaderSink.attachments.length);

    for (let i = 0; i < gMessageHeaderSink.attachments.length; i++) {
      // If the expected attachment's name is empty, we probably generated a
      // name like "Part 1.2", so don't bother checking that the names match
      // (they won't).
      if (expectedAttachments[i])
        do_check_eq(expectedAttachments[i], gMessageHeaderSink.attachments[i]);
    }

    async_driver();
  },

  /* okay, our onDataAvailable should actually never be called.  the stream
     converter is actually eating everything except the start and stop
     notification. */
  // nsIStreamListener part
  _stream : null,

  onDataAvailable: function (aRequest,aContext,aInputStream,aOffset,aCount) {
    if (this._stream === null) {
      this._stream = Cc["@mozilla.org/scriptableinputstream;1"].
                    createInstance(Ci.nsIScriptableInputStream);
      this._stream.init(aInputStream);
    }
    this._stream.read(aCount);
  },
};

let gMessageHeaderSink = {
  onEndMsgHeaders: function(aUrl) {
    this.attachments = [];
  },
  handleAttachment: function(aContentType, aUrl, aDisplayName, aUri,
                             aIsExternalAttachment) {
    this.attachments.push(aDisplayName);
  },

  // stub functions from nsIMsgHeaderSink
  onStartHeaders: function() {},
  onEndHeaders: function() {},
  processHeaders: function(aHeaderNames, aHeaderValues, dontCollectAddrs) {},
  addAttachmentField: function(aName, aValue) {},
  onEndAllAttachments: function() {},
  onEndMsgDownload: function() {},
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

  gStreamListener.allAttachments = info.attachments || [];
  let streamURI = msgService.streamMessage(
    msgURI,
    gStreamListener,
    msgWindow,
    null,
    true, // have them create the converter
    // additional uri payload, note that "header=" is prepended automatically
    "filter",
    false);

  yield false;
}

/* ===== Driver ===== */

let tests = [
  parameterizeTest(test_message_attachments, messages),
];

let gInbox;

function run_test() {
  // use mbox injection because the fake server chokes sometimes right now
  gInbox = configure_message_injection({mode: "local"});
  async_run_tests(tests);
}
