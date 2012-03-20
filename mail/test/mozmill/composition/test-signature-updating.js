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
 * Steffen Wilberg <steffen.wilberg@web.de>
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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
 * Tests that the signature updates properly when switching identities.
 */

// make SOLO_TEST=composition/test-signature-updating.js mozmill-one

// mail.identity.id1.htmlSigFormat = false
// mail.identity.id1.htmlSigText   = "Tinderbox is soo 90ies"

// mail.identity.id2.htmlSigFormat = true
// mail.identity.id2.htmlSigText   = "Tinderboxpushlog is the new <b>hotness!</b>"

const MODULE_NAME = "test-signature-updating";

const RELATIVE_ROOT = "../shared-modules";
const MODULE_REQUIRES = ["folder-display-helpers", "compose-helpers", "window-helpers"];
var jumlib = {};
Components.utils.import("resource://mozmill/modules/jum.js", jumlib);
var elib = {};
Components.utils.import("resource://mozmill/modules/elementslib.js", elib);

var composeHelper = null;
var cwc = null; // compose window controller
var prefBranch = Cc["@mozilla.org/preferences-service;1"]
                   .getService(Ci.nsIPrefService).getBranch(null);

var setupModule = function (module) {
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);
  composeHelper = collector.getModule("compose-helpers");
  composeHelper.installInto(module);
  let wh = collector.getModule("window-helpers");
  wh.installInto(module);

  // Ensure we're in the tinderbox account as that has the right identities set
  // up for this test.
  let acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                  .getService(Ci.nsIMsgAccountManager);
  let server = acctMgr.FindServer("tinderbox", "tinderbox", "pop3");
  let inbox = server.rootFolder.getChildNamed("Inbox");
  be_in_folder(inbox);
};

function setupComposeWin(toAddr, subj, body) {
  cwc.type(cwc.a("addressingWidget", {class: "addressingWidgetCell", crazyDeck: 1}), toAddr);
  cwc.type(cwc.eid("msgSubject"), subj);
  cwc.type(cwc.eid("content-frame"), body);
}

/**
 * Test that the plaintext compose window has a signature initially,
 * and has the correct signature after switching to another identity.
 */
function plaintextComposeWindowSwitchSignatures(suppressSigSep) {
  prefBranch.setBoolPref("mail.identity.id1.compose_html", false);
  cwc = composeHelper.open_compose_new_mail();
  prefBranch.setBoolPref("mail.identity.id1.suppress_signature_separator",
                         suppressSigSep);
  prefBranch.setBoolPref("mail.identity.id2.suppress_signature_separator",
                         suppressSigSep);

  setupComposeWin("", "Plaintext compose window", "Body, first line.");

  let contentFrame = cwc.e("content-frame");
  let node = contentFrame.contentDocument.body.lastChild;

  // In plaintext compose, the signature is followed by two <br> elements.
  assert_equals(node.localName, "br");
  node = node.previousSibling;
  assert_equals(node.localName, "br");
  node = node.previousSibling;

  // Now we should have the DIV node that contains the signature, with
  // the class moz-signature.
  assert_equals(node.localName, "div");

  const kSeperator = "-- ";
  const kSigClass = "moz-signature";
  assert_equals(node.className, kSigClass);

  let sigNode = node.firstChild;

  if (!suppressSigSep) {
    assert_equals(sigNode.textContent, kSeperator);
    let brNode = sigNode.nextSibling;
    assert_equals(brNode.localName, "br");
    sigNode = brNode.nextSibling;
  }

  let expectedText = "Tinderbox is soo 90ies";
  assert_equals(sigNode.textContent, expectedText);

  // Now switch identities!
  let menuID = cwc.e("msgIdentity");
  menuID.value = "id2";
  menuID.click();

  node = contentFrame.contentDocument.body.lastChild;

  // In plaintext compose, the signature is followed by two <br> elements.
  assert_equals(node.localName, "br");
  node = node.previousSibling;
  assert_equals(node.localName, "br");
  node = node.previousSibling;

  assert_equals(node.localName, "div");
  assert_equals(node.className, kSigClass);

  sigNode = node.firstChild;

  if (!suppressSigSep) {
    expectedText = "-- ";
    assert_equals(sigNode.textContent, kSeperator);
    let brNode = sigNode.nextSibling;
    assert_equals(brNode.localName, "br");
    sigNode = brNode.nextSibling;
  }

  expectedText = "Tinderboxpushlog is the new *hotness!*";
  assert_equals(sigNode.textContent, expectedText);

  // Now check that the original signature has been removed by ensuring
  // that there's only one node with class moz-signature.
  let sigs = contentFrame.contentDocument.querySelectorAll("." + kSigClass);
  assert_equals(sigs.length, 1);

  // And ensure that the text we wrote wasn't altered
  let bodyFirstChild =  contentFrame.contentDocument.body.firstChild;

  while (node != bodyFirstChild)
    node = node.previousSibling;

  assert_equals(node.nodeValue, "Body, first line.");

  composeHelper.close_compose_window(cwc);
}

function testPlaintextComposeWindowSwitchSignatures() {
  plaintextComposeWindowSwitchSignatures(false);
}

// XXX Disabled due to not correctly switching signatures with no separator
// See bug TBD
//function testPlaintextComposeWindowSwitchSignaturesWithSuppressedSeparator() {
//  plaintextComposeWindowSwitchSignatures(true);
//}

/**
 * Same test, but with an HTML compose window
 */
function HTMLComposeWindowSwitchSignatures(suppressSigSep) {
  prefBranch.setBoolPref("mail.identity.id1.compose_html", true);
  prefBranch.setBoolPref("mail.identity.id1.suppress_signature_separator",
                         suppressSigSep);
  prefBranch.setBoolPref("mail.identity.id2.suppress_signature_separator",
                         suppressSigSep);
  cwc = composeHelper.open_compose_new_mail();

  setupComposeWin("", "HTML compose window", "Body, first line.");

  let contentFrame = cwc.e("content-frame");
  let node = contentFrame.contentDocument.body.lastChild;

  // In html compose, the signature is inside the last node, which has a
  // class="moz-signature".
  assert_equals(node.className, "moz-signature");
  node = node.firstChild; // text node containing the signature divider
  if (suppressSigSep)
    assert_equals(node.nodeValue, "Tinderbox is soo 90ies");
  else
    assert_equals(node.nodeValue, "-- \nTinderbox is soo 90ies");

  // Now switch identities!
  let menuID = cwc.e("msgIdentity");
  menuID.value = "id2";
  menuID.click();

  node = contentFrame.contentDocument.body.lastChild;

  // In html compose, the signature is inside the last node
  // with class="moz-signature".
  assert_equals(node.className, "moz-signature");
  node = node.firstChild; // text node containing the signature divider
  if (!suppressSigSep) {
    assert_equals(node.nodeValue, "-- ");
    node = node.nextSibling;
    assert_equals(node.localName, "br");
    node = node.nextSibling;
  }
  assert_equals(node.nodeValue, "Tinderboxpushlog is the new ");
  node = node.nextSibling;
  assert_equals(node.localName, "b");
  node = node.firstChild;
  assert_equals(node.nodeValue, "hotness!");

  // Now check that the original signature has been removed,
  // and no blank lines got added!
  node = contentFrame.contentDocument.body.firstChild;
  assert_equals(node.nodeValue, "Body, first line.");
  node = node.nextSibling;
  assert_equals(node.localName, "br");
  node = node.nextSibling;
  // check that the signature is immediately after the message text.
  assert_equals(node.className, "moz-signature");
  // check that that the signature is the last node.
  assert_equals(node, contentFrame.contentDocument.body.lastChild);

  composeHelper.close_compose_window(cwc);
}

function testHTMLComposeWindowSwitchSignatures() {
  HTMLComposeWindowSwitchSignatures(false);
}

function testHTMLComposeWindowSwitchSignaturesWithSuppressedSeparator() {
  HTMLComposeWindowSwitchSignatures(true);
}
