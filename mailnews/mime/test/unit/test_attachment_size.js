/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This test creates some messages with attachments of different types and
 * checks that libmime reports the expected size for each of them.
 */
load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");

load("../../../resources/messageGenerator.js");
load("../../../resources/messageModifier.js");
load("../../../resources/messageInjection.js");

// Somehow we hit the blocklist service, and that needs appInfo defined
Components.utils.import("resource://testing-common/AppInfo.jsm");
updateAppInfo();

// Register the mime types provider we need for this test.
mailTestUtils.registerUMimTypProvider();

let gMessenger = Cc["@mozilla.org/messenger;1"]
                   .createInstance(Ci.nsIMessenger);

// Create a message generator
const msgGen = gMessageGenerator = new MessageGenerator();
// Create a message scenario generator using that message generator
const scenarios = gMessageScenarioFactory = new MessageScenarioFactory(msgGen);

/* Today's gory details (thanks to Jonathan Protzenko): libmime somehow
 * counts the trailing newline for an attachment MIME part. Most of the time,
 * assuming attachment has N bytes (no matter what's inside, newlines or
 * not), libmime will return N + 1 bytes. On Linux and Mac, this always
 * holds. However, on Windows, if the attachment is not encoded (that is, is
 * inline text), libmime will return N + 2 bytes.
 */
const epsilon = ('@mozilla.org/windows-registry-key;1' in Components.classes) ? 4 : 2;

const textAttachment =
  "Can't make the frug contest, Helen; stomach's upset. I'll fix you, " +
  "Ubik! Ubik drops you back in the thick of things fast. Taken as " +
  "directed, Ubik speeds relief to head and stomach. Remember: Ubik is " +
  "only seconds away. Avoid prolonged use.";

const binaryAttachment = textAttachment;

const imageAttachment =
  'iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAYAAABWdVznAAAABHNCSVQICAgIfAhkiAAAAAlwS' +
  'FlzAAAN1wAADdcBQiibeAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAA' +
  'A5SURBVCiRY/z//z8DKYCJJNXkaGBgYGD4D8NQ5zUgiTVAxeBqSLaBkVRPM0KtIhrQ3km0jwe' +
  'SNQAAlmAY+71EgFoAAAAASUVORK5CYII=';
const imageSize = 188;

const uuAttachment =
  'begin 644 /home/jvporter/Desktop/out.txt\n' +
  'M0V%N)W0@;6%K92!T:&4@9G)U9R!C;VYT97-T+"!(96QE;CL@<W1O;6%C:"=S\n' +
  'M(\'5P<V5T+B!))VQL(&9I>"!Y;W4L(%5B:6LA(%5B:6L@9\')O<\',@>6]U(&)A\n' +
  'M8VL@:6X@=&AE(\'1H:6-K(&]F(\'1H:6YG<R!F87-T+B!486ME;B!A<R!D:7)E\n' +
  'M8W1E9"P@56)I:R!S<&5E9\',@<F5L:65F(\'1O(&AE860@86YD(\'-T;VUA8V@N\n' +
  'M(%)E;65M8F5R.B!58FEK(&ES(&]N;\'D@<V5C;VYD<R!A=V%Y+B!!=F]I9"!P\n' +
  '.<F]L;VYG960@=7-E+@H`\n' +
  '`\n' +
  'end';

const yencText =
  "Hello there --\n"+
  "=ybegin line=128 size=174 name=jane.doe\n"+
  "\x76\x99\x98\x91\x9e\x8f\x97\x9a\x9d\x56\x4a\x94\x8f\x4a\x97\x8f"+
  "\x4a\x9d\x9f\x93\x9d\x4a\x8d\x99\x9f\x8d\x92\xed\xd3\x4a\x8e\x8f"+
  "\x4a\x8c\x99\x98\x98\x8f\x4a\x92\x8f\x9f\x9c\x8f\x58\x4a\x7a\x8b"+
  "\x9c\x90\x99\x93\x9d\x56\x4a\xed\xca\x4a\x9a\x8f\x93\x98\x8f\x4a"+
  "\x97\x8b\x4a\x8c\x99\x9f\x91\x93\x8f\x4a\xed\xd3\x9e\x8f\x93\x98"+
  "\x9e\x8f\x56\x4a\x97\x8f\x9d\x4a\xa3\x8f\x9f\xa2\x4a\x9d\x8f\x4a"+
  "\x90\x8f\x9c\x97\x8b\x93\x8f\x98\x9e\x4a\x9d\x93\x4a\xa0\x93\x9e"+
  "\x8f\x4a\x9b\x9f\x8f\x4a\x94\x8f\x4a\x98\x51\x8b\xa0\x8b\x93\x9d"+
  "\x0d\x0a\x4a\x9a\x8b\x9d\x4a\x96\x8f\x4a\x9e\x8f\x97\x9a\x9d\x4a"+
  "\x8e\x8f\x4a\x97\x8f\x4a\x8e\x93\x9c\x8f\x4a\x64\x4a\xec\xd5\x4a"+
  "\x74\x8f\x4a\x97\x51\x8f\x98\x8e\x99\x9c\x9d\x58\x4a\xec\xe5\x34"+
  "\x0d\x0a"+
  "=yend size=174 crc32=7efccd8e\n";
const yencSize = 174;

const partHtml = new SyntheticPartLeaf(
  "<html><head></head><body>I am HTML! Woo! </body></html>",
  {
    contentType: "text/html"
  }
);

let attachedMessage1 = msgGen.makeMessage({ body: { body: textAttachment } });
let attachedMessage2 = msgGen.makeMessage({
  body: { body: textAttachment },
  attachments: [{ body: imageAttachment,
                  contentType: 'application/x-ubik',
                  filename: 'ubik',
                  encoding: 'base64',
                  format: '' }]
});

/**
 * Return the size of a synthetic message. Much like the above comment, libmime
 * counts bytes differently on Windows, where it counts newlines (\r\n) as 2
 * bytes. Mac and Linux treats them as 1 byte.
 *
 * @param message a synthetic message from makeMessage()
 * @return the message's size in bytes
 */
function get_message_size(message) {
  let messageString = message.toMessageString();
  if (epsilon == 4) // Windows
    return messageString.length;
  else // Mac/Linux
    return messageString.replace(/\r\n/g, "\n").length;
}

// create some messages that have various types of attachments
let messages = [
  // text attachment
  { attachments: [{ body: textAttachment,
                    filename: 'ubik.txt',
                    format: '' }],
    size: textAttachment.length },
  // (inline) image attachment
  { attachments: [{ body: imageAttachment,
                    contentType: 'image/png',
                    filename: 'lines.png',
                    encoding: 'base64',
                    format: '' }],
    size: imageSize },
  // binary attachment, no encoding
  { attachments: [{ body: binaryAttachment,
                    contentType: 'application/x-ubik',
                    filename: 'ubik',
                    format: '' }],
    size: binaryAttachment.length },
  // binary attachment, b64 encoding
  { attachments: [{ body: imageAttachment,
                    contentType: 'application/x-ubik',
                    filename: 'ubik',
                    encoding: 'base64',
                    format: '' }],
    size: imageSize },
  // uuencoded attachment
  { attachments: [{ body: uuAttachment,
                    contentType: 'application/x-uuencode',
                    filename: 'ubik',
                    format: '',
                    encoding: 'uuencode' }],
    size: textAttachment.length },
  // yencoded attachment
  { bodyPart: new SyntheticPartLeaf("I am text! Woo!\n\n"+yencText,
                                    { contentType: '' } ),
    subject: "yEnc-Prefix: \"jane.doe\" 174 yEnc bytes - yEnc test (1)",
    size: yencSize },
  // an attached eml that used to return a size that's -1
  {
    bodyPart: new SyntheticPartMultiMixed([
      partHtml,
      attachedMessage1,
    ]),
    size: get_message_size(attachedMessage1),
  },
  // this is an attached message that itself has an attachment
  {
    bodyPart: new SyntheticPartMultiMixed([
      partHtml,
      attachedMessage2,
    ]),
    size: get_message_size(attachedMessage2),
  },
  // an "attachment" that's really the body of the message
  { body: { body: textAttachment,
            contentType: 'application/x-ubik; name=attachment.ubik' },
    size: textAttachment.length,
  },
  // a message/rfc822 "attachment" that's really the body of the message
  { bodyPart: attachedMessage1,
    size: get_message_size(attachedMessage1),
  },
];


let gStreamListener = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIStreamListener]),

  // nsIRequestObserver part
  onStartRequest: function (aRequest, aContext) {
    // We reset the size here because we know that we only expect one attachment
    //  per test email. In the case of the attached .eml with nested
    //  attachments, this allows us to properly discard the nested attachment
    //  sizes.
    // msgHdrViewOverlay.js has a stack of attachment infos that properly
    //  handles this.
    gMessageHeaderSink.size = null;
  },
  onStopRequest: function (aRequest, aContext, aStatusCode) {
    dump("*** Size is "+gMessageHeaderSink.size+" (expecting "+this.expectedSize+")\n\n");
    do_check_true(Math.abs(gMessageHeaderSink.size - this.expectedSize) <= epsilon);
    this._stream = null;
    async_driver();
  },

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
  handleAttachment: function(aContentType, aUrl, aDisplayName, aUri,
                             aIsExternalAttachment) {
  },
  addAttachmentField: function(aName, aValue) {
    // Only record the information for the first attachment.
    if (aName == "X-Mozilla-PartSize" && (this.size == null))
      this.size = parseInt(aValue);
  },

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

  gStreamListener.expectedSize = info.size;
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
