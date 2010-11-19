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
 * the Mozilla Foundation.
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

/*
 * General testing of the JS Mime Emitter to make sure it doesn't choke on any
 *  scenarios.
 *
 * We do not test, but should consider testing:
 * - MimeEncryptedPKCS7, whatever that translates to.
 * - apple double
 * - sun attachment
 */

/*
 * Do not include glodaTestHelper because we do not want gloda loaded and it
 *  adds a lot of runtime overhead which makes certain debugging strategies like
 *  using chronicle-recorder impractical.
 */
load("../../../../resources/mailDirService.js");
load("../../../../resources/mailTestUtils.js");
load("../../../../resources/logHelper.js");
load("../../../../resources/asyncTestUtils.js");

load("../../../../resources/messageGenerator.js");
load("../../../../resources/messageModifier.js");
load("../../../../resources/messageInjection.js");

// Create a message generator
const msgGen = gMessageGenerator = new MessageGenerator();
// Create a message scenario generator using that message generator
const scenarios = gMessageScenarioFactory = new MessageScenarioFactory(msgGen);

Components.utils.import("resource:///modules/gloda/mimemsg.js");

var partText = new SyntheticPartLeaf("I am text! Woo!");
var partHtml = new SyntheticPartLeaf(
  "<html><head></head><body>I am HTML! Woo! </body></html>",
  {
    contentType: "text/html"
  }
);
var partAlternative = new SyntheticPartMultiAlternative([partText, partHtml]);
var partMailingListFooter = new SyntheticPartLeaf("I am an annoying footer!");

var tachText = {filename: 'bob.txt', body: 'I like cheese!'};
var partTachText = new SyntheticPartLeaf(tachText.body, tachText);
var tachInlineText = {filename: 'foo.txt', body: 'Rock the mic',
                      format: null, charset: null,
                      disposition: 'inline'};
var partTachInlineText = new SyntheticPartLeaf(tachInlineText.body,
                                               tachInlineText);

var tachImage = {filename: 'bob.png', contentType: 'image/png',
                 encoding: 'base64', charset: null, format: null,
                 body: 'YWJj\n'};
var partTachImage = new SyntheticPartLeaf(tachImage.body, tachImage);

var relImage = {contentType: 'image/png',
                encoding: 'base64', charset: null, format: null,
                contentId: 'part1.foo@bar.com',
                body: 'YWJj\n'};
var partRelImage = new SyntheticPartLeaf(relImage.body, relImage);

var tachVCard = {filename: 'bob.vcf', contentType: 'text/x-vcard',
                 encoding: '7bit', body: 'begin:vcard\nfn:Bob\nend:vcard\n'};
var partTachVCard = new SyntheticPartLeaf(tachVCard.body, tachVCard);

var tachApplication = {filename: 'funky.funk',
                       contentType: 'application/x-funky', body: 'funk!'};
var partTachApplication = new SyntheticPartLeaf(tachApplication.body,
                                                tachApplication);

var partTachMessages = [msgGen.makeMessage(), msgGen.makeMessage()];

var partEmpty = new SyntheticDegeneratePartEmpty();

var messageInfos = [
  // -- simple
  {
    name: 'text/plain',
    bodyPart: partText,
  },
  {
    name: 'text/html',
    bodyPart: partHtml,
  },
  // -- simple w/attachment
  {
    name: 'text/plain w/text attachment (=> multipart/mixed)',
    bodyPart: partText,
    attachments: [tachText],
  },
  {
    name: 'text/plain w/image attachment (=> multipart/mixed)',
    bodyPart: partText,
    attachments: [tachImage],
  },
  {
    name: 'text/plain w/vcard attachment (=> multipart/mixed)',
    bodyPart: partText,
    attachments: [tachVCard],
  },
  {
    name: 'text/plain w/app attachment (=> multipart/mixed)',
    bodyPart: partText,
    attachments: [tachApplication],
  },
  {
    name: 'text/html w/text attachment (=> multipart/mixed)',
    bodyPart: partHtml,
    attachments: [tachText],
  },
  {
    name: 'text/html w/image attachment (=> multipart/mixed)',
    bodyPart: partHtml,
    attachments: [tachImage],
  },
  {
    name: 'text/html w/vcard attachment (=> multipart/mixed)',
    bodyPart: partHtml,
    attachments: [tachVCard],
  },
  {
    name: 'text/html w/app attachment (=> multipart/mixed)',
    bodyPart: partHtml,
    attachments: [tachApplication],
  },
  // -- alternatives
  {
    name: 'multipart/alternative: text/plain, text/html',
    bodyPart: partAlternative,
  },
  {
    name: 'multipart/alternative plain/html w/text attachment',
    bodyPart: partAlternative,
    attachments: [tachText],
  },
  {
    name: 'multipart/alternative plain/html w/image attachment',
    bodyPart: partAlternative,
    attachments: [tachImage],
  },
  {
    name: 'multipart/alternative plain/html w/vcard attachment',
    bodyPart: partAlternative,
    attachments: [tachVCard],
  },
  {
    name: 'multipart/alternative plain/html w/app attachment',
    bodyPart: partAlternative,
    attachments: [tachApplication],
  },
  // -- S/MIME.
  {
    name: 'S/MIME alternative',
    bodyPart: new SyntheticPartMultiSignedSMIME(partAlternative),
  },
  {
    name: 'S/MIME alternative with text attachment inside',
    // we have to do the attachment packing ourselves on this one.
    bodyPart: new SyntheticPartMultiSignedSMIME(
      new SyntheticPartMultiMixed([partAlternative, partTachText])),
  },
  {
    name: 'S/MIME alternative with image attachment inside',
    // we have to do the attachment packing ourselves on this one.
    bodyPart: new SyntheticPartMultiSignedSMIME(
      new SyntheticPartMultiMixed([partAlternative, partTachImage])),
  },
  {
    name: 'S/MIME alternative with image attachment inside',
    // we have to do the attachment packing ourselves on this one.
    bodyPart: new SyntheticPartMultiSignedSMIME(
      new SyntheticPartMultiMixed([partAlternative, partTachVCard])),
  },
  {
    name: 'S/MIME alternative with app attachment inside',
    // we have to do the attachment packing ourselves on this one.
    bodyPart: new SyntheticPartMultiSignedSMIME(
      new SyntheticPartMultiMixed([partAlternative, partTachApplication])),
  },
  {
    name: 'S/MIME alternative wrapped in mailing list',
    bodyPart: new SyntheticPartMultiMixed(
      [new SyntheticPartMultiSignedSMIME(partAlternative),
       partMailingListFooter]),
  },
  // -- PGP signature
  // We mainly care that all the content-type parameters show up.
  {
    name: 'PGP signed alternative',
    bodyPart: new SyntheticPartMultiSignedPGP(partAlternative),
  },
  // -- attached RFC822
  {
    // not your average attachment, pack ourselves for now
    name: 'attached rfc822',
    bodyPart: new SyntheticPartMultiMixed([partAlternative,
                                           partTachMessages[0]]),
  },
  // -- multipart/related
  {
    name: 'multipart/related',
    bodyPart: new SyntheticPartMultiRelated([partHtml, partRelImage]),
  },
  {
    name: 'multipart/related inside multipart/alternative',
    bodyPart: new SyntheticPartMultiAlternative([partText,
      new SyntheticPartMultiRelated([partHtml, partRelImage])]),
  },
  // -- multipart/digest
  {
    name: 'multipart/digest',
    bodyPart: new SyntheticPartMultiDigest(partTachMessages.concat()),
  },
  // -- multipart/parallel (allegedly the same as mixed)
  {
    name: 'multipart/parallel',
    bodyPart: new SyntheticPartMultiParallel([partText, partTachImage]),
  },
  // -- empty sections
  // This was a crasher because the empty part made us try and close the
  //  child preceding the empty part a second time.  The nested multipart led
  //  to the crash providing evidence of the double-close bug but there was
  //  nothing inherently nested-multipart-requiring to trigger the double-close
  //  bug.
  {
    name: 'nested multipart with empty multipart section',
    bodyPart: new SyntheticPartMultiMixed([
        new SyntheticPartMultiRelated([partAlternative, partTachText]),
        partEmpty
      ])
  },
  {
    name: 'empty multipart section produces no child',
    bodyPart: new SyntheticPartMultiMixed([partText, partEmpty, partTachText])
  },
];


function test_stream_message(info) {
  let synMsg = gMessageGenerator.makeMessage(info);
  let synSet = new SyntheticMessageSet([synMsg]);
  yield add_sets_to_folder(gInbox, [synSet]);

  let msgHdr = synSet.getMsgHdr(0);

  MsgHdrToMimeMessage(msgHdr, null, function(aMsgHdr, aMimeMsg) {
    verify_stream_message(info, synMsg, aMsgHdr, aMimeMsg);
  });

  yield false;
}

var deathToNewlineTypeThings = /[\r\n]+/g;

function verify_body_part_equivalence(aSynBodyPart, aMimePart) {
  // the content-type devoid of parameters should match
  do_check_eq(aSynBodyPart._contentType, aMimePart.contentType);

  // the header representation of the content-type should also match unless
  //  this is an rfc822 part, in which case it should only match for the
  //  actual contents.
  if (aMimePart.contentType != "message/rfc822")
    do_check_eq(aSynBodyPart.contentTypeHeaderValue.replace(
                  deathToNewlineTypeThings, ""),
                aMimePart.get("content-type").replace(
                  deathToNewlineTypeThings, ""));

  // XXX body part checking will get brittle if we ever actually encode things!
  if (aSynBodyPart.body && !aSynBodyPart._filename &&
      aSynBodyPart._contentType.indexOf("text/") == 0)
    do_check_eq(aSynBodyPart.body.trim(), aMimePart.body.trim());
  if (aSynBodyPart.parts) {
    let iPart;
    let realPartOffsetCompensator = 0;
    for (iPart = 0; iPart < aSynBodyPart.parts.length; iPart++) {
      let subSyn = aSynBodyPart.parts[iPart];
      // If this is a degenerate empty, it should not produce output, so
      //  compensate for the offset drift and get on with our lives.
      if (subSyn instanceof SyntheticDegeneratePartEmpty) {
        realPartOffsetCompensator--;
        continue;
      }
      let subMime = aMimePart.parts[iPart + realPartOffsetCompensator];
      // our special case is the signature, which libmime does not expose to us.
      // ignore! (also, have our too-many-part checker below not trip on this)
      if (subSyn._contentType != PKCS_SIGNATURE_MIME_TYPE) {
        if (subMime == null)
          do_throw("No MIME part matching " +
                   subSyn.contentTypeHeaderValue + "\n");
        verify_body_part_equivalence(subSyn, subMime);
      }
    }
    // only check if there are still more mime parts; don't check for a count
    //  mismatch (the PKCS case from above needs to be handled)
    if (iPart < aMimePart.parts.length)
      do_throw("MIME part has more sub-parts than syn part?");
  }
}

/**
 * Verify the streamed results are what we wanted.  For now, this just means
 *  receiving a representation; we don't check it for correctness.
 */
function verify_stream_message(aInfo, aSynMsg, aMsgHdr, aMimeMsg) {
  if (aMimeMsg == null)
    do_throw("We really should have gotten a result!");
  try {
    // aMimeMsg is normalized; it only ever actually gets one child...
    verify_body_part_equivalence(aSynMsg.bodyPart, aMimeMsg.parts[0]);
  }
  catch (ex) {
    dump("Something was wrong with the MIME rep!\n!!!!!!!!\n");
    dump("Synthetic looks like:\n  " + aSynMsg.prettyString() +
         "\n\n");
    dump("MIME looks like:  \n" + aMimeMsg.prettyString(true, "  ") + "\n\n");
    do_throw(ex);
  }

  dump("Everything is just fine.\n");
  dump("Synthetic looks like:\n  " + aSynMsg.prettyString() +
       "\n\n");
  dump("MIME looks like:\n  " + aMimeMsg.prettyString(true, "  ") + "\n\n");

  async_driver();
}

/**
 * Stream
 */
function test_sane_bodies() {
  // 60 bytes long... (becomes 59 on the other side when \r is dropped)
  let hugeString =
    "don't know what you want but I can't  stream it anymore...\r\n";
  const powahsOfTwo = 10;
  for (let i = 0; i < powahsOfTwo; i++) {
    hugeString = hugeString + hugeString;
  }
  // this will come out to be 60k, of course.
  do_check_eq(hugeString.length, 60 * Math.pow(2, powahsOfTwo));

  let synMsg = gMessageGenerator.makeMessage(
    {body: {body: hugeString, contentType: "text/plain"}});
  let synSet = new SyntheticMessageSet([synMsg]);
  yield add_sets_to_folder(gInbox, [synSet]);

  let msgHdr = synSet.getMsgHdr(0);

  MsgHdrToMimeMessage(msgHdr, null, function(aMsgHdr, aMimeMsg) {
    let bodyPart = aMimeMsg.parts[0];
    // (the \r gets gone, so it's only 59 per line)
    if (bodyPart.body.length > (20 * 1024 + 59))
      do_throw("Mime body length is " + bodyPart.body.length + " bytes long but should not be!");
    async_driver();
  }, false, {saneBodySize: true});

  yield false;
}

// additional testing for the correctness of allAttachments and
// allUserAttachments representation

var partTachNestedMessages = [
  msgGen.makeMessage(),
  msgGen.makeMessage({
      attachments: [tachImage]
    }),
  msgGen.makeMessage({
      attachments: [tachImage, tachApplication]
    })
];

var attMessagesParams = [
  {
    name: 'attached rfc822',
    bodyPart: new SyntheticPartMultiMixed([partAlternative,
                                           partTachNestedMessages[0]]),
  },
  {
    name: 'attached rfc822 w. image inside',
    bodyPart: new SyntheticPartMultiMixed([partAlternative,
                                           partTachNestedMessages[1]]),
  },
  {
    name: 'attached x/funky + attached rfc822 w. (image + x/funky) inside',
    bodyPart: new SyntheticPartMultiMixed([partAlternative,
                                           partTachApplication,
                                           partTachNestedMessages[2]]),
  }
];

var expectedAttachmentsInfo = [
  {
    allAttachmentsContentTypes: [],
    allUserAttachmentsContentTypes: ["message/rfc822"]
  },
  {
    allAttachmentsContentTypes: ["image/png"],
    allUserAttachmentsContentTypes: ["message/rfc822"]
  },
  {
    allAttachmentsContentTypes: ["application/x-funky", "image/png", "application/x-funky"],
    allUserAttachmentsContentTypes: ["application/x-funky", "message/rfc822"]
  },
];

function test_attachments_correctness () {
  for each (let [i, params] in Iterator(attMessagesParams)) {
    let synMsg = gMessageGenerator.makeMessage(params);
    let synSet = new SyntheticMessageSet([synMsg]);
    yield add_sets_to_folder(gInbox, [synSet]);

    let msgHdr = synSet.getMsgHdr(0);

    MsgHdrToMimeMessage(msgHdr, null, function(aMsgHdr, aMimeMsg) {
      try {
        let expected = expectedAttachmentsInfo[i];

        do_check_eq(aMimeMsg.allAttachments.length, expected.allAttachmentsContentTypes.length);
        for each (let [j, att] in Iterator(aMimeMsg.allAttachments))
          do_check_eq(att.contentType, expected.allAttachmentsContentTypes[j]);

        do_check_eq(aMimeMsg.allUserAttachments.length, expected.allUserAttachmentsContentTypes.length);
        for each (let [j, att] in Iterator(aMimeMsg.allUserAttachments))
          do_check_eq(att.contentType, expected.allUserAttachmentsContentTypes[j]);
      } catch (e) {
        dump(aMimeMsg.prettyString()+"\n");
        do_throw(e);
      }

      async_driver();
    }, false);

    yield false;
  }
}

/* ===== Driver ===== */

var tests = [
  parameterizeTest(test_stream_message, messageInfos),
  test_sane_bodies,
  test_attachments_correctness,
];

var gInbox;

function run_test() {
  // use mbox injection because the fake server chokes sometimes right now
  gInbox = configure_message_injection({mode: "local"});
  async_run_tests(tests);
}
