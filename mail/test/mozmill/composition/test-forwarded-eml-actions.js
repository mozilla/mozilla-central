/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests that actions such as replying and forwarding works correctly from 
 * an .eml message that's attached to another mail.
 */

// make SOLO_TEST=composition/test-forwarded-eml-actions.js mozmill-one

const MODULE_NAME = "test-forwarded-eml-actions";

const RELATIVE_ROOT = "../shared-modules";
const MODULE_REQUIRES = ["folder-display-helpers", "window-helpers",
                         "compose-helpers"];

Cu.import("resource:///modules/mailServices.js");
var elib = {};
Cu.import("resource://mozmill/modules/elementslib.js", elib);

var folder;

var msgsubject = "mail client suggestions";
var msgbodyA = "know of a good email client?";
var msgbodyB = "hi, i think you may know of an email client to recommend?";

var setupModule = function(module) {
  collector.getModule("folder-display-helpers").installInto(module);
  collector.getModule("window-helpers").installInto(module);
  collector.getModule("compose-helpers").installInto(module);

  folder = create_folder("FwdedEmlTest");

  let source = 
    "From - Mon Apr  16 22:55:33 2012\n" +
    "Date: Mon, 16 Apr 2012 22:55:33 +0300\n" +
    "From: Mr Example <example@invalid>\n" +
    "User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:14.0) Gecko/20120331 Thunderbird/14.0a1\n" +
    "MIME-Version: 1.0\n" +
    "To: example@invalid\n" +
    "Subject: Fwd: " + msgsubject + "\n" +
    "References: <4F8C78F5.4000704@invalid>\n" +
    "In-Reply-To: <4F8C78F5.4000704@invalid>\n" +
    "X-Forwarded-Message-Id: <4F8C78F5.4000704@invalid>\n" +
    "Content-Type: multipart/mixed;\n" +
    " boundary=\"------------080806020206040800000503\"\n" +
    "\n" +
    "This is a multi-part message in MIME format.\n" +
    "--------------080806020206040800000503\n" +
    "Content-Type: text/plain; charset=ISO-8859-1; format=flowed\n" +
    "Content-Transfer-Encoding: 7bit\n" +
    "\n" +
    msgbodyB + "\n" +
    "\n" +
    "--------------080806020206040800000503\n" +
    "Content-Type: message/rfc822;\n" +
    " name=\"mail client suggestions.eml\"\n" +
    "Content-Transfer-Encoding: 7bit\n" +
    "Content-Disposition: attachment;\n" +
    " filename=\"mail client suggestions.eml\"\n" +
    "\n" +
    "Return-Path: <example@invalid>\n" +
    "Received: from xxx (smtpu [10.0.0.51])\n" +
    "	 by storage (Cyrus v2.3.7-Invoca-RPM-2.3.7-1.1) with LMTPA;\n" +
    "	 Mon, 16 Apr 2012 22:54:36 +0300\n" +
    "Message-ID: <4F8C78F5.4000704@invalid>\n" +
    "Date: Mon, 16 Apr 2012 22:54:29 +0300\n" +
    "From: Mr Example <example@invalid>\n" +
    "User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:14.0) Gecko/20120331 Thunderbird/14.0a1\n" +
    "MIME-Version: 1.0\n" +
    "To: example@invalid\n" +
    "Subject: mail client suggestions\n" +
    "Content-Type: text/plain; charset=ISO-8859-1; format=flowed\n" +
    "Content-Transfer-Encoding: 7bit\n" +
    "\n" +
    msgbodyA + "\n" +
    "\n" +
    "--------------080806020206040800000503--\n";

  folder.QueryInterface(Ci.nsIMsgLocalMailFolder);
  folder.addMessage(source);
}

/**
 * Helper to opend an attached .eml file, invoke the hotkey and check some
 * properties of the composition content we get.
 */
function setupWindowAndTest(hotkeyToHit, hotkeyModifiers) {
  be_in_folder(folder);

  let msg = select_click_row(0);
  assert_selected_and_displayed(mc, msg);

  plan_for_new_window("mail:messageWindow");
  mc.click(mc.eid("attachmentName"));
  let msgWin = wait_for_new_window("mail:messageWindow");
  wait_for_message_display_completion(msgWin, false);

  plan_for_new_window("msgcompose");
  msgWin.keypress(null, hotkeyToHit, hotkeyModifiers);
  let compWin = wait_for_compose_window(msgWin);

  let bodyText= compWin.e("content-frame").contentDocument
                       .querySelector("body").textContent;
  if (bodyText.contains("html"))
    throw new Error("body text contains raw html; bodyText=" + bodyText);

  if (!bodyText.contains(msgbodyA))
    throw new Error("body text didn't contain the body text; msgbodyA=" +
                    msgbodyB + ", bodyText=" + bodyText);

  let subjectText = compWin.e("msgSubject").value;
  if (!subjectText.contains(msgsubject))
    throw new Error("subject text didn't contain the original subject; " +
                    "msgsubject=" +  msgsubject + ", subjectText=" + subjectText);

  close_compose_window(compWin, false);
  close_window(msgWin);
}

/**
 * Test that replying to an attached .eml contains the expected texts.
 */
function test_reply_to_attached_eml() {
  setupWindowAndTest("R", {shiftKey: false, accelKey: true});
}

/**
 * Test that forwarding an attached .eml contains the expected texts.
 */
function test_forward_attached_eml() {
  setupWindowAndTest("L", {shiftKey: false, accelKey: true});
}

