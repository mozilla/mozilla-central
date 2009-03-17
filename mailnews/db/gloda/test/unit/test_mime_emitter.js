/*
 * General testing of the JS Mime Emitter to make sure it doesn't choke on any
 *  scenarios.
 *
 * We do not test, but should consider testing:
 * - MimeEncryptedPKCS7, whatever that translates to.
 * - apple double
 * - sun attachment
 */

do_import_script("../mailnews/db/gloda/test/resources/messageGenerator.js");
do_import_script("../mailnews/db/gloda/test/resources/glodaTestHelper.js");

Components.utils.import("resource://app/modules/gloda/mimemsg.js");

// Create a message generator
var msgGen = new MessageGenerator();

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
    bodyPart: new SyntheticPartMultiSigned(partAlternative),
  },
  {
    name: 'S/MIME alternative with text attachment inside',
    // we have to do the attachment packing ourselves on this one.
    bodyPart: new SyntheticPartMultiSigned(
      new SyntheticPartMultiMixed([partAlternative, partTachText])),
  },
  {
    name: 'S/MIME alternative with image attachment inside',
    // we have to do the attachment packing ourselves on this one.
    bodyPart: new SyntheticPartMultiSigned(
      new SyntheticPartMultiMixed([partAlternative, partTachImage])),
  },
  {
    name: 'S/MIME alternative with image attachment inside',
    // we have to do the attachment packing ourselves on this one.
    bodyPart: new SyntheticPartMultiSigned(
      new SyntheticPartMultiMixed([partAlternative, partTachVCard])),
  },
  {
    name: 'S/MIME alternative with app attachment inside',
    // we have to do the attachment packing ourselves on this one.
    bodyPart: new SyntheticPartMultiSigned(
      new SyntheticPartMultiMixed([partAlternative, partTachApplication])),
  },
  {
    name: 'S/MIME alternative wrapped in mailing list',
    bodyPart: new SyntheticPartMultiMixed(
      [new SyntheticPartMultiSigned(partAlternative), partMailingListFooter]),
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
  }
];

function setup_create_message(info) {
  info._synMsg = msgGen.makeMessage(info);
  next_test();
}

var emittyFolder;

/**
 * Actually inject all the messages we created above.
 */
function setup_inject_messages() {
  let synMessages = [info._synMsg for each
                      ([, info] in Iterator(messageInfos))];
  writeMessagesToMbox(synMessages, gProfileDir,
                      "Mail", "Local Folders", "emitty");
  emittyFolder = gLocalIncomingServer.rootMsgFolder.addSubfolder("emitty");
  updateFolderAndNotify(emittyFolder, next_test);
}

function test_stream_message(info) {
  let msgHdr =
    emittyFolder.msgDatabase.getMsgHdrForMessageID(info._synMsg.messageId);

  MsgHdrToMimeMessage(msgHdr, null, function(aMsgHdr, aMimeMsg) {
    verify_stream_message(info, info._synMsg, aMsgHdr, aMimeMsg);
  });
}

function verify_body_part_equivalence(aSynBodyPart, aMimePart) {
  do_check_eq(aSynBodyPart._contentType, aMimePart.contentType);
  // XXX body part checking will get brittle if we ever actually encode things!
  if (aSynBodyPart.body && !aSynBodyPart._filename &&
      aSynBodyPart._contentType.indexOf("text/") == 0)
    do_check_eq(aSynBodyPart.body.trim(), aMimePart.body.trim());
  if (aSynBodyPart.parts) {
    let iPart;
    for (iPart = 0; iPart < aSynBodyPart.parts.length; iPart++) {
      let subSyn = aSynBodyPart.parts[iPart];
      let subMime = aMimePart.parts[iPart];
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
    dump("MIME looks like:\n  " + aMimeMsg.prettyString() + "\n\n");
    do_throw(ex);
  }

  dump("Everything is just fine.\n");
  dump("Synthetic looks like:\n  " + aSynMsg.prettyString() +
       "\n\n");
  dump("MIME looks like:\n  " + aMimeMsg.prettyString() + "\n\n");

  next_test();
}

/* ===== Driver ===== */

var tests = [
  parameterizeTest(setup_create_message, messageInfos),
  setup_inject_messages,
  parameterizeTest(test_stream_message, messageInfos),
];

function run_test() {
  // use mbox injection because the fake server chokes sometimes right now
  injectMessagesUsing(INJECT_MBOX);
  glodaHelperRunTests(tests);
}
