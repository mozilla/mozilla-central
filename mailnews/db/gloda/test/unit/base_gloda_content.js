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
 *   David Ascher <dascher@mozillamessaging.com>
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
 * Tests the operation of the GlodaContent (in connotent.js) and its exposure
 * via Gloda.getMessageContent.  This may also be implicitly tested by indexing
 * and fulltext query tests (on messages), but the buck stops here for the
 * content stuff.
 *
 * Currently, we just test quoting removal and that the content turns out right.
 * We do not actually verify that the quoted blocks are correct (aka we might
 * screw up eating the greater-than signs).  (We have no known consumers who
 * care about the quoted blocks.)
 */

load("resources/glodaTestHelper.js");

Components.utils.import("resource://app/modules/gloda/mimemsg.js");

// we need to be able to get at GlodaFundAttr to check the number of whittler
//   invocations
Components.utils.import("resource://app/modules/gloda/fundattr.js");

/* ===== Data ===== */
var messageInfos = [
  {
    name: "no quoting",
    bode: [[true, "I like hats"],
           [true, "yes I do!"],
           [true, "I like hats!"],
           [true, "How bout you?"]]
  },
  {
    name: "no quoting, whitespace removal",
    bode: [[true, "robots are nice..."],
           [true, ""],
           [true, "except for the bloodlust"]]
  },
  {
    name: "bottom posting",
    bode: [[false, "John wrote:"],
           [false, "> I like hats"],
           [false, ">"], // this quoted blank line is significant! no lose!
           [false, "> yes I do!"],
           [false, ""],
           [true, "I do enjoy them as well."],
           [true, ""],
           [true, "Bob"]]
  },
  {
    name: "top posting",
    bode: [[true, "Hats are where it's at."],
           [false, ""],
           [false, "John wrote:"],
           [false, "> I like hats"],
           [false, "> yes I do!"]]
  },
  {
    name: "top posting with trailing whitespace, no intro",
    bode: [[true, "Hats are where it's at."],
           [false, ""],
           [false, "> I like hats"],
           [false, "> yes I do!"],
           [false, ""],
           [false, ""]]
  },
  {
    name: "interspersed quoting",
    bode: [[false, "John wrote:"],
           [false, "> I like hats"],
           [true, "I concur with this point."],
           [false, "> yes I do!"],
           [false, ""],
           [true, "this point also resonates with me."],
           [false, ""],
           [false, "> I like hats!"],
           [false, "> How bout you?"],
           [false, ""],
           [true, "Verily!"]]
  },
  {
    name: "german style",
    bode: [[false, "Mark Banner <bugzilla@standard8.plus.com> wrote:"],
           [false, "\xa0"],
           [false, "> We haven't nailed anything down in detail yet, depending on how we are "],
           [true, "That sounds great and would definitely be appreciated by localizers."],
           [false, ""]]
  },
  {
    name: "tortuous interference",
    bode: [[false, "> wrote"],
           [true, "running all the time"],
           [false, "> wrote"],
           [true, "cheese"],
           [false, ""]]
  }
];

/* ===== Tests ===== */

function setup_create_message(info) {
  info.body = {body: [tupe[1] for each
                      ([, tupe] in Iterator(info.bode))].join("\r\n")};
  info.expected = [tupe[1] for each
                   ([, tupe] in Iterator(info.bode)) if
                   (tupe[0])].join("\n");

  info._synMsg = msgGen.makeMessage(info);
}

/**
 * To save ourselves some lookup trouble, pretend to be a verification
 *  function so we get easy access to the gloda translations of the messages so
 *  we can cram this in various places.
 */
function glodaInfoStasher(aSynthMessage, aGlodaMessage) {
  // let's not assume an ordering
  for (let iMsg = 0; iMsg < messageInfos.length; iMsg++) {
    if (messageInfos[iMsg]._synMsg == aSynthMessage) {
      messageInfos[iMsg]._glodaMsg = aGlodaMessage;
    }
  }
}

/**
 * Actually inject all the messages we created above.
 */
function setup_inject_messages() {
  let msgSet = new SyntheticMessageSet(
                 [info._synMsg for each ([, info] in Iterator(messageInfos))]);
  let folder = make_empty_folder();
  yield add_sets_to_folders(folder, [msgSet]);
  yield wait_for_gloda_indexer(msgSet, {verifier: glodaInfoStasher});
}

function test_stream_message(info) {
  let msgHdr = info._glodaMsg.folderMessage;

  MsgHdrToMimeMessage(msgHdr, null, function(aMsgHdr, aMimeMsg) {
    verify_message_content(info, info._synMsg, info._glodaMsg, aMsgHdr,
                           aMimeMsg);
  });
}

// instrument GlodaFundAttr so we can check the count
var originalWhittler = GlodaFundAttr.contentWhittle;
var whittleCount = 0;
GlodaFundAttr.contentWhittle = function whittler_counter() {
  whittleCount++;
  return originalWhittler.apply(this, arguments);
};

function verify_message_content(aInfo, aSynMsg, aGlodaMsg, aMsgHdr, aMimeMsg) {
  if (aMimeMsg == null)
    do_throw("Message streaming should work; check test_mime_emitter.js first");

  whittleCount = 0;
  let content = Gloda.getMessageContent(aGlodaMsg, aMimeMsg);
  if (whittleCount != 1)
    do_throw("Whittle count is " + whittleCount + " but should be 1!");

  do_check_eq(content.getContentString(), aInfo.expected);
}

/* ===== Driver ===== */

var tests = [
  parameterizeTest(setup_create_message, messageInfos),
  setup_inject_messages,
  parameterizeTest(test_stream_message, messageInfos),
];
