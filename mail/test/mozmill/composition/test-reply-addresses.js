/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests that we get correct adressees for different type of replies:
 * reply to sender, reply to all, reply to list, mail-followup-tp,
 * mail-reply-to, and reply to self.
 */

// make SOLO_TEST=composition/test-reply-addresses.js mozmill-one

const MODULE_NAME = "test-reply-addresses";

const RELATIVE_ROOT = "../shared-modules";
const MODULE_REQUIRES = ["folder-display-helpers",
                         "window-helpers", "compose-helpers"];

var folder;
var i = 0;

const myEmail1 = "me@example.com";
const myEmail2 = "otherme@example.com";

Cu.import("resource:///modules/mailServices.js");

function setupModule(module) {
  collector.getModule("folder-display-helpers").installInto(module);
  collector.getModule("window-helpers").installInto(module);
  collector.getModule("compose-helpers").installInto(module);

  // Now set up an account with some identities.
  let acctMgr = MailServices.accounts;
  let account = acctMgr.createAccount();
  account.incomingServer = acctMgr.createIncomingServer(
    "nobody", "Reply Addresses Testing", "pop3");

  folder = account.incomingServer.rootFolder
                  .QueryInterface(Ci.nsIMsgLocalMailFolder)
                  .createLocalSubfolder("Msgs4Reply");

  let identity1 = acctMgr.createIdentity();
  identity1.email = myEmail1;
  account.addIdentity(identity1);

  let identity2 = acctMgr.createIdentity();
  identity2.email = myEmail2;
  account.addIdentity(identity2);

  // Let's add messages to the folder later as we go, it's hard to read
  // out of context what the expected results should be.
}

function checkToAddresses(replyWinController, expectedFields) {
  let addressingWidgetItems = replyWinController.window.document
    .querySelectorAll("#addressingWidget .addressingWidgetItem");

  let obtainedFields = [];
  for (let i = 0; i < addressingWidgetItems.length; i++) {
    let addrTypePopup = addressingWidgetItems[i].querySelector("menupopup");
    let addrTextbox = addressingWidgetItems[i].querySelector("textbox");

    let selectedIndex = addrTypePopup.parentNode.selectedIndex;
    let typeMenuitems = addrTypePopup.childNodes;
    let addrType = (selectedIndex != -1) ?
      typeMenuitems[selectedIndex].value : typeMenuitems[0].value;

    let addresses = obtainedFields[addrType];
    if (addresses)
      addresses.push(addrTextbox.value);
    else
      addresses = [addrTextbox.value];
    obtainedFields[addrType] = addresses;
  }

  // Check what we expect is there.
  for (let type in expectedFields) {
    let expected = expectedFields[type];
    let obtained = obtainedFields[type];

    for (let i = 0; i < expected.length; i++) {
      if (!obtained || obtained.indexOf(expected[i]) == -1) {
        throw new Error(expected[i] + " is not in " + type + " fields; " +
                        "obtained=" + obtained);
      }
    }
    assert_equals(obtained.length, expected.length,
                  "Unexpected number of fields obtained for type=" + type +
                  "; obtained=" + obtained + "; expected=" + expected);
  }

  // Check there's no "extra" fields either.
  for (let type in obtainedFields) {
    let expected = expectedFields[type];
    let obtained = obtainedFields[type];
    if (!expected) {
      throw new Error("Didn't expect a field for type=" + type +
                      "; obtained=" + obtained);
    }
  }
}

/**
 * Tests that addresses get set properly when doing a normal reply.
 */
function testToCcReply() {
  let msg0 = create_message({
    from: "Homer <homer@example.com>",
    to: "Mr Burns <mrburns@example.com>, workers@example.com, " +
        myEmail1,
    cc: "Lisa <lisa@example.com>",
    subject: "testToCcReply - normal mail with to and cc (me in To)"
  });
  add_message_to_folder(folder, msg0);

  be_in_folder(folder);
  let msg = select_click_row(i++);
  assert_selected_and_displayed(mc, msg);

  let rwc = open_compose_with_reply();

  // To: From
  checkToAddresses(rwc, {"addr_to": ["Homer <homer@example.com>"]});
  close_compose_window(rwc);
}

/**
 * Tests that addresses get set properly when doing a normal reply to all.
 */
function testToCcReplyAll() {
  let msg0 = create_message({
    from: "Homer <homer@example.com>",
    to: "Mr Burns <mrburns@example.com>, workers@example.com, " +
        myEmail1,
    cc: "Lisa <lisa@example.com>",
    subject: "testToCcReplyAll - normal mail with to and cc (me in To)"
  });
  add_message_to_folder(folder, msg0);

  be_in_folder(folder);
  let msg = select_click_row(i++);
  assert_selected_and_displayed(mc, msg);

  let rwc = open_compose_with_reply_to_all();

  checkToAddresses(rwc,
    // To: From + Tos without me.
    // Cc: original Ccs
    {
    "addr_to": ["Homer <homer@example.com>",
                "Mr Burns <mrburns@example.com>",
                "workers@example.com"],
    "addr_cc": ["Lisa <lisa@example.com>"]
    }
  );
  close_compose_window(rwc);
}

/**
 * Tests that that addresses get set properly when doing a normal reply to all
 * where when recipients aren't all ascii.
 */
function testToCcReplyAllInternational() {
  let msg0 = create_message({
    from: "Hideaki / =?iso-2022-jp?B?GyRCNUhGIzFRTEAbKEI=?= <hideaki@example.com>",
    to: "Mr Burns <mrburns@example.com>, =?UTF-8?B?w4VrZQ==?= <ake@example.com>, " +
        "=?KOI8-R?Q?=E9=D7=C1=CE?= <ivan@example.com>, " + myEmail1,
    cc: "=?Big5?B?pP2oca1e?= <xiuying@example.com>",
    subject: "testToCcReplyAllInternational - non-ascii people mail with to and cc (me in To)",
    clobberHeaders: { 'Content-Transfer-Encoding': 'quoted-printable' },
    // Content-Transfer-Encoding ^^^ should be set from the body encoding below,
    //but that doesn't seem to work. (No Content-Transfer-Encoding header is
    // generated).
    body: {charset: "windows-1251", encoding: "quoted-printable", body: "=CF=F0=E8=E2=E5=F2 =E8=E7 =CC=EE=F1=EA=E2=FB"}
  });
  add_message_to_folder(folder, msg0);

  be_in_folder(folder);
  let msg = select_click_row(i++);
  assert_selected_and_displayed(mc, msg);

  let rwc = open_compose_with_reply_to_all();

  checkToAddresses(rwc,
    // To: From + Tos without me.
    // Cc: original Ccs
    {
    "addr_to": ["Hideaki / 吉藤英明 <hideaki@example.com>",
                "Mr Burns <mrburns@example.com>",
                "Åke <ake@example.com>",
                "Иван <ivan@example.com>"],
    "addr_cc": ["王秀英 <xiuying@example.com>"]
    }
  );
  close_compose_window(rwc);
}

/**
 * Tests that that addresses get set properly when doing a reply to a mail with
 * reply-to set.
 */
function testToCcReplyWhenReplyToSet() {
  let msg0 = create_message({
    from: "Homer <homer@example.com>",
    to: "workers@example.com",
    cc: "Lisa <lisa@example.com>, " + myEmail1,
    subject: "testToCcReplyWhenReplyToSet - to/cc mail with reply-to set (me in Cc)",
    clobberHeaders: {
      "Reply-To": "marge@example.com"
    }
  });
  add_message_to_folder(folder, msg0);

  be_in_folder(folder);
  let msg = select_click_row(i++);
  assert_selected_and_displayed(mc, msg);

  let rwc = open_compose_with_reply();

  // To: reply-to
  checkToAddresses(rwc, {"addr_to": ["marge@example.com"]});
  close_compose_window(rwc);
}

/**
 * Tests that addresses get set properly when doing a reply to all for a mail
 * w/ Reply-To.
 */
function testToCcReplyAllWhenReplyToSet() {
  let msg0 = create_message({
    from: "Homer <homer@example.com>",
    to: "workers@example.com",
    cc: "Lisa <lisa@example.com>, " + myEmail1,
    subject: "testToCcReplyAllWhenReplyToSet - to/cc mail with reply-to set (me in Cc)",
    clobberHeaders: {
      "Reply-To": "marge@example.com"
    }
  });
  add_message_to_folder(folder, msg0);

  be_in_folder(folder);
  let msg = select_click_row(i++);
  assert_selected_and_displayed(mc, msg);

  let rwc = open_compose_with_reply_to_all();

  checkToAddresses(rwc,
    // To: Reply-To + Tos
    // Cc: original Ccs without me.
    {
    "addr_to": ["marge@example.com",
                "workers@example.com"],
    "addr_cc": ["Lisa <lisa@example.com>"]
    }
  );
  close_compose_window(rwc);
}

/**
 * Tests that addresses get set properly when doing a reply to list.
 */
function testReplyToList() {
  let msg0 = create_message({
    from: "Homer <homer@example.com>",
    to: "workers-list@example.com",
    cc: "Lisa <lisa@example.com>, " + myEmail1,
    subject: "testReplyToList - mailing list message (me in Cc)",
    clobberHeaders: {
      "List-Post": "<mailto:workers-list@example.com>"
    }
  });
  add_message_to_folder(folder, msg0);

  be_in_folder(folder);
  let msg = select_click_row(i++);
  assert_selected_and_displayed(mc, msg);

  let rwc = open_compose_with_reply_to_list();

  checkToAddresses(rwc, {"addr_to": ["workers-list@example.com"]});
  close_compose_window(rwc);
}

/**
 * Tests that addresses get set properly when doing a reply to sender for a
 * list post.
 */
function testReplySenderForListPost() {
  let msg0 = create_message({
    from: "Homer <homer@example.com>",
    to: "workers-list@example.com",
    cc: "Lisa <lisa@example.com>, " + myEmail1,
    subject: "testReplySenderForListPost - mailing list message (me in Cc)",
    clobberHeaders: {
      "List-Post": "<mailto:workers-list@example.com>"
    }
  });
  add_message_to_folder(folder, msg0);

  be_in_folder(folder);
  let msg = select_click_row(i++);
  assert_selected_and_displayed(mc, msg);

  let rwc = open_compose_with_reply();

  // To: From
  checkToAddresses(rwc, {"addr_to": ["Homer <homer@example.com>"]});
  close_compose_window(rwc);
}

/**
 * Tests that addresses get set properly when doing a reply all to a list post.
 */
function testReplyToAllForListPost() {
  let msg0 = create_message({
    from: "Homer <homer@example.com>",
    to: "workers-list@example.com",
    cc: "Lisa <lisa@example.com>, " + myEmail1,
    subject: "testReplyToAllForListPost - mailing list message (me in Cc)",
    clobberHeaders: {
      "List-Post": "<mailto:workers-list@example.com>"
    }
  });
  add_message_to_folder(folder, msg0);

  be_in_folder(folder);
  let msg = select_click_row(i++);
  assert_selected_and_displayed(mc, msg);

  let rwc = open_compose_with_reply_to_all();

  // To: From + original To
  // Cc: original CC without me
  checkToAddresses(rwc,
    {
    "addr_to": ["Homer <homer@example.com>", "workers-list@example.com"],
    "addr_cc": ["Lisa <lisa@example.com>"]
    }
  );
  close_compose_window(rwc);
}

/**
 * Tests that addresses get set properly when doing a reply to all for a list
 * post when also reply-to is set.
 */
function testReplyToListWhenReplyToSet() {
  let msg0 = create_message({
    from: "Homer <homer@example.com>",
    to: "workers-list@example.com, " + myEmail1,
    cc: "Lisa <lisa@example.com>",
    subject: "testReplyToListWhenReplyToSet - mailing list message w/ cc, reply-to (me in To)",
    clobberHeaders: {
      "Reply-To": "marge@example.com",
      "List-Post": "<mailto:workers-list@example.com>"
    }
  });
  add_message_to_folder(folder, msg0);

  be_in_folder(folder);
  let msg = select_click_row(i++);
  assert_selected_and_displayed(mc, msg);

  let rwc = open_compose_with_reply_to_all();

  // To: Reply-To, oringinal Tos
  // Cc: original Cc
  checkToAddresses(rwc,
    {
    "addr_to": ["marge@example.com", "workers-list@example.com"],
    "addr_cc": ["Lisa <lisa@example.com>"]
    }
  );
  close_compose_window(rwc);
}

/**
 * Test that addresses get set properly for Mail-Reply-To. Mail-Reply-To should
 * be used for reply to author, if present.
 * @see http://cr.yp.to/proto/replyto.html
 */
function testMailReplyTo() {
  let msg0 = create_message({
    from: "Homer <homer@example.com>",
    to: "workers-list@example.com",
    cc: "Lisa <lisa@example.com>",
    subject: "testMailReplyTo - mail with Mail-Reply-To header",
    clobberHeaders: {
      "Reply-To": "workers-list@example.com", // reply-to munging
      "Mail-Reply-To": "Homer S. <homer@example.com>"
    }
  });
  add_message_to_folder(folder, msg0);

  be_in_folder(folder);
  let msg = select_click_row(i++);
  assert_selected_and_displayed(mc, msg);

  let rwc = open_compose_with_reply();

  // To: Mail-Reply-To
  checkToAddresses(rwc, {"addr_to": ["Homer S. <homer@example.com>"]});
  close_compose_window(rwc);
}

/**
 * Test that addresses get set properly Mail-Followup-To. Mail-Followup-To
 * should be the default recipent list for reply-all, if present.
 * @see http://cr.yp.to/proto/replyto.html
 */
function testMailFollowupTo() {
  let msg0 = create_message({
    from: "Homer <homer@example.com>",
    to: "workers-list@example.com, " + myEmail1,
    cc: "Lisa <lisa@example.com>",
    subject: "testMailFollowupTo - mail with Mail-Followup-To header",
    clobberHeaders: {
      // Homer is on the list, and don't want extra copies, so he has
      // set the Mail-Followup-To header so followups go to the list.
      "Mail-Followup-To": "workers-list@example.com"
    }
  });
  add_message_to_folder(folder, msg0);

  be_in_folder(folder);
  let msg = select_click_row(i++);
  assert_selected_and_displayed(mc, msg);

  let rwc = open_compose_with_reply_to_all();

  // To: Mail-Followup-To
  checkToAddresses(rwc, {"addr_to": ["workers-list@example.com"]});
  close_compose_window(rwc);
}

/**
 * Tests that addresses get set properly for reply to self.
 */
function testReplyToSelfReply() {
  let msg0 = create_message({
    from: myEmail1,
    to: "Bart <bart@example.com>, Maggie <maggie@example.com>",
    cc: "Lisa <lisa@example.com>",
    subject: "testReplyToSelfReply - reply to self",
    clobberHeaders: {
      "Bcc": "Moe <moe@example.com>"
    }
  });
  add_message_to_folder(folder, msg0);

  be_in_folder(folder);
  let msg = select_click_row(i++);
  assert_selected_and_displayed(mc, msg);

  let rwc = open_compose_with_reply();

  // To: original To
  checkToAddresses(rwc, {"addr_to": ["Bart <bart@example.com>",
                                     "Maggie <maggie@example.com>"]});
  close_compose_window(rwc);
}

/**
 * Tests that addresses get set properly for a reply all to self - this should
 * be treated as a followup.
 */
function testReplyToSelfReplyAll() {
  let msg0 = create_message({
    from: myEmail1,
    to: "Bart <bart@example.com>, Maggie <maggie@example.com>",
    cc: "Lisa <lisa@example.com>",
    subject: "testReplyToSelfReplyAll - reply to self",
    clobberHeaders: {
      "Bcc": "Moe <moe@example.com>"
    }
  });
  add_message_to_folder(folder, msg0);

  be_in_folder(folder);
  let msg = select_click_row(i++);
  assert_selected_and_displayed(mc, msg);

  let rwc = open_compose_with_reply_to_all();

  checkToAddresses(rwc,
    // To: original To
    // Cc: original Cc
    // Bcc: original Bcc
    {
    "addr_to": ["Bart <bart@example.com>",
                "Maggie <maggie@example.com>"],
    "addr_cc": ["Lisa <lisa@example.com>"],
    "addr_bcc": ["Moe <moe@example.com>"]
    }
  );
  close_compose_window(rwc);
}

/**
 * Tests that addresses get set properly for a nntp reply-all.
 */
function testNewsgroupsReplyAll() {
  let msg0 = create_message({
    from: "Homer <homer@example.com>",
    to: "test1-list@example.org",
    subject: "testNewsgroupsReplyAll - sent to two newsgroups and a list",
    clobberHeaders: {
      "Newsgroups": "example.test1, example.test2"
    }
  });
  add_message_to_folder(folder, msg0);

  be_in_folder(folder);
  let msg = select_click_row(i++);
  assert_selected_and_displayed(mc, msg);

  let rwc = open_compose_with_reply_to_all();

  checkToAddresses(rwc,
    // To: From, original To
    // Newsgroups: original Ccs
    {
    "addr_to": ["Homer <homer@example.com>", "test1-list@example.org"],
    "addr_newsgroups": ["example.test1", "example.test2"]
    }
  );
  close_compose_window(rwc);
}

/**
 * Tests that addresses get set properly for an nntp followup, when Followup-To
 * is set.
 */
function testNewsgroupsReplyAllFollowupTo() {
  let msg0 = create_message({
    from: "Homer <homer@example.com>",
    to: "test1-list@example.org",
    subject: "testNewsgroupsReplyAllFollowupTo - Followup-To set",
    clobberHeaders: {
      "Newsgroups": "example.test1, example.test2",
      "Followup-To": "example.test2"
    }
  });
  add_message_to_folder(folder, msg0);

  be_in_folder(folder);
  let msg = select_click_row(i++);
  assert_selected_and_displayed(mc, msg);

  let rwc = open_compose_with_reply_to_all();

  checkToAddresses(rwc,
    // Newsgroups: <Followup-To>
    {
    "addr_to": ["Homer <homer@example.com>", "test1-list@example.org"],
    "addr_newsgroups": ["example.test2"]
    }
  );
  close_compose_window(rwc);
}

