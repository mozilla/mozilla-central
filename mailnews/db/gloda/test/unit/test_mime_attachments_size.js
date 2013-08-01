/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * General testing of the byte-counting libmime facility, to make sure that what
 * is streamed to us is actually labeled with the right size.
 */

/*
 * Do not include glodaTestHelper because we do not want gloda loaded and it
 *  adds a lot of runtime overhead which makes certain debugging strategies like
 *  using chronicle-recorder impractical.
 */
load("../../../../resources/logHelper.js");
load("../../../../resources/asyncTestUtils.js");

load("../../../../resources/messageGenerator.js");
load("../../../../resources/messageModifier.js");
load("../../../../resources/messageInjection.js");

Components.utils.import("resource://gre/modules/NetUtil.jsm");

// Create a message generator
const msgGen = gMessageGenerator = new MessageGenerator();
// Create a message scenario generator using that message generator
const scenarios = gMessageScenarioFactory = new MessageScenarioFactory(msgGen);

Components.utils.import("resource:///modules/gloda/mimemsg.js");

var htmlText = "<html><head></head><body>I am HTML! Woo! </body></html>";

var partHtml = new SyntheticPartLeaf(
  htmlText,
  {
    contentType: "text/html"
  }
);

// This text is 168 characters long, and occupies 173 bytes when encoded in
// UTF-8. (We make sure it occupies 173 bytes in run_test below). Note that
// you cannot use this text directly because it isn't pure ASCII. You must use
// one of the encoded forms below.
var originalText =
  "Longtemps, je me suis couché de bonne heure. Parfois, à "+
  "peine ma bougie éteinte, mes yeux se fermaient si vite que je n'avais pas le "+
  "temps de me dire : « Je m'endors. »";
var originalTextByteCount = 173;

var b64Text =
  "TG9uZ3RlbXBzLCBqZSBtZSBzdWlzIGNvdWNow6kgZGUgYm9ubmUgaGV1cmUuIFBhcmZvaXMs\n"+
  "IMOgIHBlaW5lIG1hIGJvdWdpZSDDqXRlaW50ZSwgbWVzIHlldXggc2UgZmVybWFpZW50IHNp\n"+
  "IHZpdGUgcXVlIGplIG4nYXZhaXMgcGFzIGxlIHRlbXBzIGRlIG1lIGRpcmUgOiDCqyBKZSBt\n"+
  "J2VuZG9ycy4gwrsK";

var qpText =
  "Longtemps,=20je=20me=20suis=20couch=C3=A9=20de=20bonne=20heure.=20Parfois,=\n"+
  "=20=C3=A0=20peine=20ma=20bougie=20=C3=A9teinte,=20mes=20yeux=20se=20fermaie=\n"+
  "nt=20si=20vite=20que=20je=20n'avais=20pas=20le=20temps=20de=20me=20dire=20:=\n"+
  "=20=C2=AB=20Je=20m'endors.=20=C2=BB";

var uuText =
  "begin 666 -\n"+
  "M3&]N9W1E;7!S+\"!J92!M92!S=6ES(&-O=6-HPZD@9&4@8F]N;F4@:&5U<F4N\n"+
  "M(%!A<F9O:7,L(,.@('!E:6YE(&UA(&)O=6=I92##J71E:6YT92P@;65S('EE\n"+
  "M=7@@<V4@9F5R;6%I96YT('-I('9I=&4@<75E(&IE(&XG879A:7,@<&%S(&QE\n"+
  "G('1E;7!S(&1E(&UE(&1I<F4@.B#\"JR!*92!M)V5N9&]R<RX@PKL*\n"+
  "\n"+
  "end";

var yencText =
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

// that completely exotic encoding is only detected if there is no content type
// on the message, which is usually the case in newsgroups. I hate you yencode!
var partYencText = new SyntheticPartLeaf("I am text! Woo!\n\n"+yencText,
  { contentType: '', charset: '', format: '' } );

var partUUText = new SyntheticPartLeaf(
  "I am text! With uuencode... noes...\n\n"+uuText,
  { contentType: '', charset: '', format: '' });

var tachText = {filename: 'bob.txt', body: qpText,
                charset: "utf-8", encoding: "quoted-printable"};

var tachInlineText = {filename: 'foo.txt', body: qpText,
                      format: null, charset: "utf-8",
                      encoding: "quoted-printable",
                      disposition: 'inline'};

// images have a different behavior than other attachments: they are displayed
// inline most of the time, so there are two different code paths that need to
// enable streaming and byte counting to the JS mime emitter

var tachImage = {filename: 'bob.png', contentType: 'image/png',
                 encoding: 'base64', charset: null, format: null,
                 body: b64Text};

var tachPdf = {filename: 'bob.pdf', contentType: 'application/pdf',
                 encoding: 'base64', charset: null, format: null,
                 body: b64Text};

var tachUU = {filename: 'john.doe', contentType: 'application/x-uuencode',
                 encoding: 'uuencode', charset: null, format: null,
                 body: uuText};

var tachApplication = {filename: 'funky.funk',
                       contentType: 'application/x-funky',
                       encoding: 'base64',
                       body: b64Text};

var relImage = {contentType: 'image/png',
                encoding: 'base64', charset: null, format: null,
                contentId: 'part1.foo@bar.invalid',
                body: b64Text};

var tachVCard = {filename: 'bob.vcf', contentType: 'text/x-vcard',
                 encoding: '7bit', body: 'begin:vcard\nfn:Bob\nend:vcard\n'};
var partTachVCard = new SyntheticPartLeaf(tachVCard.body, tachVCard);

var partRelImage = new SyntheticPartLeaf(relImage.body, relImage);

var messageInfos = [
  {
    name: 'uuencode inline',
    bodyPart: partUUText,
    subject: "duh",
    epsilon: 1,
    checkTotalSize: false,
  },
  // encoding type specific to newsgroups, not interested, gloda doesn't even
  // treat this as an attachment (probably because gloda requires an attachment
  // to have a content-type, which these yencoded parts don't have), but size IS
  // counted properly nonetheless
  /*{
    name: 'text/plain with yenc inline',
    bodyPart: partYencText,
    subject: "yEnc-Prefix: \"jane.doe\" 174 yEnc bytes - yEnc test (1)",
  },*/
  // inline image, not interested either, gloda doesn't keep that as an
  // attachment (probably a deliberate choice), size is NOT counted properly
  // (don't want to investigate, I doubt it's a useful information anyway)
  /*{
    name: 'multipart/related',
    bodyPart: new SyntheticPartMultiRelated([partHtml, partRelImage]),
  },*/
  // This doesn't really make sense because it returns the length of the
  // encoded blob without the envelope. Disabling as part of bug 711980.
  /*{
    name: '.eml attachment',
    bodyPart: new SyntheticPartMultiMixed([
      partHtml,
      msgGen.makeMessage({ body: { body: qpText,
                                   charset: "UTF-8",
                                   encoding: "quoted-printable" } }),
    ]),
    epsilon: 1,
  },*/
  // all of the other common cases work fine
  {
    name: 'all sorts of "real" attachments',
    bodyPart: partHtml,
    attachments: [tachImage, tachPdf, tachUU,
      tachApplication, tachText, tachInlineText,],
    epsilon: 2,
  },
];

function check_attachments(aMimeMsg, epsilon, checkTotalSize) {
  if (aMimeMsg == null)
    do_throw("We really should have gotten a result!");

  // dump(aMimeMsg.prettyString()+"\n");

  /* It is hard to get a byte count that's perfectly accurate. When composing
   * the message, the MIME structure goes like this (for an encoded attachment):
   *
   * XXXXXXXXXX 
   * XXXXXXXXXX    <-- encoded block
   * XXXXXXXXXX
   *               <-- newline
   * --chopchop    <-- MIME separator
   *
   * libmime counts bytes all the way up to the separator, which means it counts
   * the bytes for the extra line. Since newlines in emails are \n, most of the
   * time we get att.size = 174 instead of 173.
   *
   * The good news is, it's just a fixed extra cost. There no issues with the
   * inner contents of the attachment, you can add as many newlines as you want
   * in it, Unix or Windows, the count won't get past the bounds.
   */

  do_check_true(aMimeMsg.allUserAttachments.length > 0);

  let totalSize = htmlText.length;

  for each (let [i, att] in Iterator(aMimeMsg.allUserAttachments)) {
    dump("*** Attachment now is " + att.name + " " + att.size + "\n");
    do_check_true(Math.abs(att.size - originalTextByteCount) <= epsilon);
    totalSize += att.size;
  }

  // undefined means true
  if (checkTotalSize !== false) {
    dump("*** Total size comparison: " + totalSize + " vs " + aMimeMsg.size + "\n");
    do_check_true(Math.abs(aMimeMsg.size - totalSize) <= epsilon);
  }

  async_driver();
}

function test_message_attachments(info) {
  let synMsg = gMessageGenerator.makeMessage(info);
  let synSet = new SyntheticMessageSet([synMsg]);
  yield add_sets_to_folder(gInbox, [synSet]);

  let msgHdr = synSet.getMsgHdr(0);
  // dump(synMsg.toMboxString()+"\n");

  MsgHdrToMimeMessage(msgHdr, null, function(aMsgHdr, aMimeMsg) {
    try {
      check_attachments(aMimeMsg, info.epsilon, info.checkTotalSize);
    } catch (e) {
      do_throw(e);
    }
  });

  yield false;
}

var bogusMessage = msgGen.makeMessage({ body: { body: originalText } });
bogusMessage._contentType = "woooooo"; // Breaking abstraction boundaries. Bad.

var bogusMessageInfos = [
  // In this case, the wooooo part is not an attachment, so its bytes won't be
  // counted (size will end up being 0 bytes). We don't check the size, but
  // check_bogus_parts makes sure we're able to come up with a resulting size
  // for the MimeMessage.
  //
  // In that very case, since message M is an attachment, libmime will count M's
  // bytes, and we could have MimeMessages prefer the size libmime tells them
  // (when they have it), rather than recursively computing their sizes. I'm not
  // sure changing jsmimeemitter.js is worth the trouble just for buggy
  // messages...
  {
    name: '.eml attachment with inner MimeUnknown',
    bodyPart: new SyntheticPartMultiMixed([
      partHtml,
      msgGen.makeMessage({ // <--- M
        bodyPart: 
        new SyntheticPartMultiMixed([
          new SyntheticPartMultiRelated([
            partHtml,
            new SyntheticPartLeaf(htmlText, { contentType: "woooooo" }),
          ]),
        ]),
      }),
    ]),
    epsilon: 6,
    checkSize: false,
  },
];

function check_bogus_parts(aMimeMsg, { epsilon, checkSize }) {
  if (aMimeMsg == null)
    do_throw("We really should have gotten a result!");

  // First make sure the size is computed properly
  let x = parseInt(aMimeMsg.size);
  do_check_false(isNaN(x));

  let sep = ("@mozilla.org/windows-registry-key;1" in Cc) ? "\r\n" : "\n";

  // dump(aMimeMsg.prettyString()+"\n");

  if (checkSize) {
    let partSize = 0;
    // The attachment, although a MimeUnknown part, is actually plain/text that
    // contains the whole attached message, including headers. Count them.
    for each (let [k, v] in Iterator(bogusMessage.headers))
      partSize += (k + ": " + v + sep).length;
    // That's the newline between the headers and the message body.
    partSize += sep.length;
    // That's the message body.
    partSize += originalTextByteCount;
    // That's the total length that's to be returned by the MimeMessage abstraction.
    let totalSize = htmlText.length + partSize;
    dump(totalSize+" vs "+aMimeMsg.size+"\n");
    do_check_true(Math.abs(aMimeMsg.size - totalSize) <= epsilon);
  }

  async_driver();
}

function test_bogus_messages(info) {
  let synMsg = gMessageGenerator.makeMessage(info);
  let synSet = new SyntheticMessageSet([synMsg]);
  yield add_sets_to_folder(gInbox, [synSet]);

  let msgHdr = synSet.getMsgHdr(0);
  // dump(synMsg.toMboxString());

  MsgHdrToMimeMessage(msgHdr, null, function(aMsgHdr, aMimeMsg) {
    try {
      check_bogus_parts(aMimeMsg, info);
    } catch (e) {
      do_throw(e);
    }
  });

  yield false;
}

// The goal here is to explicitly check that these messages have attachments.
var messageHaveAttachmentsInfos = [
  {
    name: 'multipart/related',
    bodyPart: new SyntheticPartMultiMixed([partHtml, partTachVCard]),
    number: 1,
  },
];

function test_have_attachments(info) {
  let synMsg = gMessageGenerator.makeMessage(info);
  let synSet = new SyntheticMessageSet([synMsg]);
  yield add_sets_to_folder(gInbox, [synSet]);

  let msgHdr = synSet.getMsgHdr(0);
  // dump(synMsg.toMboxString());

  MsgHdrToMimeMessage(msgHdr, null, function(aMsgHdr, aMimeMsg) {
    try {
      do_check_eq(aMimeMsg.allUserAttachments.length, info.number);
      async_driver();
    } catch (e) {
      do_throw(e);
    }
  });

  yield false;
}

/* ===== Driver ===== */

var tests = [
  parameterizeTest(test_message_attachments, messageInfos),
  parameterizeTest(test_bogus_messages, bogusMessageInfos),
  parameterizeTest(test_have_attachments, messageHaveAttachmentsInfos),
];

var gInbox;

function run_test() {
  // Sanity check: figure out how many bytes the original text occupies in UTF-8 encoding
  let converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
                    .createInstance(Ci.nsIScriptableUnicodeConverter);
  converter.charset = "UTF-8";
  do_check_eq(converter.ConvertFromUnicode(originalText).length, originalTextByteCount);

  // use mbox injection because the fake server chokes sometimes right now
  gInbox = configure_message_injection({mode: "local"});
  async_run_tests(tests);
}
