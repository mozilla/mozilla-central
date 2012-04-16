/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests Filelink URL insertion behaviours in compose windows.
 */

let MODULE_NAME = 'test-cloudfile-attachment-urls';

let RELATIVE_ROOT = '../shared-modules';
let MODULE_REQUIRES = ['folder-display-helpers',
                       'compose-helpers',
                       'cloudfile-helpers',
                       'attachment-helpers',
                       'dom-helpers',
                       'window-helpers'];

Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource:///modules/mailServices.js');

const kUploadedFile = "attachment-uploaded";
const kHtmlPrefKey = "mail.identity.default.compose_html";
const kReplyOnTopKey = "mail.identity.default.reply_on_top";
const kReplyOnTop = 1;
const kReplyOnBottom = 0;
const kTextNodeType = 3;
const kSigPrefKey = "mail.identity.id1.htmlSigText";
const kSigOnReplyKey = "mail.identity.default.sig_on_reply";
const kSigOnForwardKey = "mail.identity.default.sig_on_fwd";
const kDefaultSigKey = "mail.identity.id1.htmlSigText";
const kDefaultSig = "This is my signature.\n\nCheck out my website sometime!";
const kFiles = ['./data/testFile1', './data/testFile2'];
const kLines = ["This is a line of text", "and here's another!"];

var ah, cfh, gFolder, gOldHtmlPref, gOldSigPref;

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);

  // For replies and forwards, we'll work off a message in the Inbox folder
  // of the fake "tinderbox" account.
  let server = MailServices.accounts.FindServer("tinderbox", "tinderbox",
                                                "pop3");
  gFolder = server.rootFolder.getChildNamed("Inbox");
  fdh.add_message_to_folder(gFolder, create_message());

  collector.getModule('compose-helpers').installInto(module);

  ah = collector.getModule('attachment-helpers');
  ah.installInto(module);
  ah.gMockFilePickReg.register();

  cfh = collector.getModule('cloudfile-helpers');
  cfh.installInto(module);
  cfh.gMockCloudfileManager.register();

  collector.getModule('dom-helpers').installInto(module);
  collector.getModule('window-helpers').installInto(module);

  // These tests assume that we default to writing mail in HTML.  We'll
  // save the current preference, force defaulting to HTML, and restore the
  // pref in teardownModule.
  gOldHtmlPref = Services.prefs.getBoolPref(kHtmlPrefKey);
  Services.prefs.setBoolPref(kHtmlPrefKey, true);
  // Same goes for the default signature.
  gOldSigPref = Services.prefs.getCharPref(kDefaultSigKey);
}

function teardownModule(module) {
  cfh.gMockCloudfileManager.unregister();
  ah.gMockFilePickReg.unregister();
  Services.prefs.setCharPref(kDefaultSigKey, gOldSigPref);
  Services.prefs.setBoolPref(kHtmlPrefKey, gOldHtmlPref);
}

function setupTest() {
  // If our signature got accidentally wiped out, let's just put it back.
  Services.prefs.setCharPref(kDefaultSigKey, kDefaultSig);
}

/**
 * Given some compose window controller, wait for some Filelink URLs to be
 * inserted.
 *
 * @param aController the controller for a compose window.
 * @param aNumUrls the number of Filelink URLs that are expected.
 * @returns an array containing the root containment node, the list node, and
 *          an array of the link URL nodes.
 */
function wait_for_attachment_urls(aController, aNumUrls) {
  let mailBody = get_compose_body(aController);

  // Wait until we can find the root attachment URL node...
  let root = wait_for_element(mailBody.parentNode,
                              "body > #cloudAttachmentListRoot");

  let list = wait_for_element(mailBody,
                              "#cloudAttachmentListRoot > #cloudAttachmentList");

  let urls = null;
  aController.waitFor(function() {
    urls = mailBody.querySelectorAll("#cloudAttachmentList > .cloudAttachmentItem");
    return (urls != null && urls.length == aNumUrls);
  });

  return [root, list, urls];
}

/**
 * Helper function that sets up the mock file picker for a series of files,
 * spawns a reply window for the first message in the gFolder, optionally
 * types some strings into the compose window, and then attaches some
 * Filelinks.
 *
 * @param aText an array of strings to type into the compose window. Each
 *              string is followed by pressing the RETURN key, except for
 *              the final string.  Pass an empty array if you don't want
 *              anything typed.
 * @param aFiles an array of filename strings for files located beneath
 *               the test directory.
 */
function prepare_some_attachments_and_reply(aText, aFiles) {
  gMockFilePicker.returnFiles = collectFiles(aFiles, __file__);

  let provider = new MockCloudfileAccount();
  provider.init("someKey");

  be_in_folder(gFolder);
  let msg = select_click_row(0);
  assert_selected_and_displayed(mc, msg);

  let cw = open_compose_with_reply();

  // If we have any typing to do, let's do it.
  type_in_composer(cw, aText);
  cw.window.attachToCloud(provider);
  return cw;
}

/**
 * Helper function that sets up the mock file picker for a series of files,
 * spawns an inline forward compose window for the first message in the gFolder,
 * optionally types some strings into the compose window, and then attaches
 * some Filelinks.
 *
 * @param aText an array of strings to type into the compose window. Each
 *              string is followed by pressing the RETURN key, except for
 *              the final string.  Pass an empty array if you don't want
 *              anything typed.
 * @param aFiles an array of filename strings for files located beneath
 *               the test directory.
 */
function prepare_some_attachments_and_forward(aText, aFiles) {
  gMockFilePicker.returnFiles = collectFiles(aFiles, __file__);

  let provider = new MockCloudfileAccount();
  provider.init("someKey");

  be_in_folder(gFolder);
  let msg = select_click_row(0);
  assert_selected_and_displayed(mc, msg);

  let cw = open_compose_with_forward();

  // Put the selection at the beginning of the document...
  let editor = cw.window.GetCurrentEditor();
  editor.beginningOfDocument();

  // Do any necessary typing...
  type_in_composer(cw, aText);
  cw.window.attachToCloud(provider);
  return cw;
}

/**
 * Helper function that runs a test function with signature-in-reply and
 * signature-in-forward enabled, and then runs the test again with those
 * prefs disabled.
 *
 * @param aSpecialTest a test that takes two arguments - the first argument
 *                     is the aText array of any text that should be typed,
 *                     and the second is a boolean for whether or not the
 *                     special test should expect a signature or not.
 * @param aText any text to be typed into the compose window, passed to
 *              aSpecialTest.
 */
function try_with_and_without_signature_in_reply_or_fwd(aSpecialTest, aText) {
  // By default, we have a signature included in replies, so we'll start
  // with that.
  Services.prefs.setBoolPref(kSigOnReplyKey, true);
  Services.prefs.setBoolPref(kSigOnForwardKey, true);
  aSpecialTest(aText, true);

  Services.prefs.setBoolPref(kSigOnReplyKey, false);
  Services.prefs.setBoolPref(kSigOnForwardKey, false);
  aSpecialTest(aText, false);
}

/**
 * Helper function that runs a test function without a signature, once
 * in HTML mode, and again in plaintext mode.
 *
 * @param aTest a test that takes no arguments.
 */
function try_without_signature(aTest) {
  let oldSig = Services.prefs.getCharPref(kSigPrefKey);
  Services.prefs.setCharPref(kSigPrefKey, "");

  try_with_plaintext_and_html_mail(aTest);
  Services.prefs.setCharPref(kSigPrefKey, oldSig);
}

/**
 * Helper function that runs a test function for HTML mail composition, and
 * then again in plaintext mail composition.
 *
 * @param aTest a test that takes no arguments.
 */
function try_with_plaintext_and_html_mail(aTest) {
  aTest();
  Services.prefs.setBoolPref(kHtmlPrefKey, false);
  aTest();
  Services.prefs.setBoolPref(kHtmlPrefKey, true);
}

/**
 * Test that if we open up a composer and immediately attach a Filelink,
 * a linebreak is inserted before the containment node in order to allow
 * the user to write before the attachment URLs.  This assumes the user
 * does not have a signature already inserted into the message body.
 */
function test_inserts_linebreak_on_empty_compose() {
  try_without_signature(subtest_inserts_linebreak_on_empty_compose);
}

/**
 * Subtest for test_inserts_linebreak_on_empty_compose - can be executed
 * on both plaintext and HTML compose windows.
 */
function subtest_inserts_linebreak_on_empty_compose() {
  gMockFilePicker.returnFiles = collectFiles(kFiles, __file__);
  let provider = new MockCloudfileAccount();
  provider.init("someKey");
  let cw = open_compose_new_mail();
  cw.window.attachToCloud(provider);

  let [root, list, urls] = wait_for_attachment_urls(cw, kFiles.length);

  let br = root.previousSibling;
  assert_equals(br.localName, "br",
                "The attachment URL containment node should be preceded by " +
                "a linebreak");

  let mailBody = get_compose_body(cw);

  assert_equals(mailBody.firstChild, br,
                "The linebreak should be the first child of the compose body");

  close_window(cw);
}

/**
 * Test that if we open up a composer and immediately attach a Filelink,
 * a linebreak is inserted before the containment node. This test also
 * ensures that, with a signature already in the compose window, we don't
 * accidentally insert the attachment URL containment within the signature
 * node.
 */
function test_inserts_linebreak_on_empty_compose_with_signature() {
  gMockFilePicker.returnFiles = collectFiles(kFiles, __file__);
  let provider = new MockCloudfileAccount();
  provider.init("someKey");
  let cw = open_compose_new_mail();
  cw.window.attachToCloud(provider);
  // wait_for_attachment_urls ensures that the attachment URL containment
  // node is an immediate child of the body of the message, so if this
  // succeeds, then we were not in the signature node.
  let [root, list, urls] = wait_for_attachment_urls(cw, kFiles.length);

  let br = assert_previous_nodes("br", root, 1);

  let mailBody = get_compose_body(cw);
  assert_equals(mailBody.firstChild, br,
                "The linebreak should be the first child of the compose body");

  // Now ensure that the node after the attachments is a br, and following
  // that is the signature.
  br = assert_next_nodes("br", root, 1);

  let pre = br.nextSibling;
  assert_equals(pre.localName, "pre",
                "The linebreak should be followed by the signature pre");
  assert_true(pre.classList.contains("moz-signature"),
              "The pre should have the moz-signature class");

  close_window(cw);

  Services.prefs.setBoolPref(kHtmlPrefKey, false);

  // Now let's try with plaintext mail.
  let cw = open_compose_new_mail();
  cw.window.attachToCloud(provider);
  [root, list, urls] = wait_for_attachment_urls(cw, kFiles.length);

  br = assert_previous_nodes("br", root, 1);

  mailBody = get_compose_body(cw);
  assert_equals(mailBody.firstChild, br,
                "The linebreak should be the first child of the compose body");

  // Now ensure that the node after the attachments is a br, and following
  // that is the signature.
  br = assert_next_nodes("br", root, 1);

  let div = br.nextSibling;
  assert_equals(div.localName, "div",
                "The linebreak should be followed by the signature div");
  assert_true(div.classList.contains("moz-signature"),
              "The div should have the moz-signature class");

  close_window(cw);

  Services.prefs.setBoolPref(kHtmlPrefKey, true);
}

/**
 * Tests that removing all Filelinks causes the root node to be removed.
 */
function test_removing_filelinks_removes_root_node() {
  try_with_plaintext_and_html_mail(subtest_removing_filelinks_removes_root_node);
}

/**
 * Test for test_removing_filelinks_removes_root_node - can be executed
 * on both plaintext and HTML compose windows.
 */
function subtest_removing_filelinks_removes_root_node() {
  let cw = prepare_some_attachments_and_reply([], kFiles);
  let [root, list, urls] = wait_for_attachment_urls(cw, kFiles.length);

  // Now select the attachments in the attachment bucket, and remove them.
  select_attachments(cw, 0, 1);
  cw.window.goDoCommand("cmd_delete");

  // Wait for the root to be removed.
  let mailBody = get_compose_body(cw);
  cw.waitFor(function() {
    let result = mailBody.querySelector(root.id);
    return (result == null);
  }, "Timed out waiting for attachment container to be removed");
}

/**
 * Test that if we write some text in an empty message (no signature),
 * and the selection is at the end of a line of text, attaching some Filelinks
 * causes the attachment URL container to be separated from the text by
 * two br tags.
 */
function test_adding_filelinks_to_written_message() {
  try_without_signature(subtest_adding_filelinks_to_written_message);
}

/**
 * Subtest for test_adding_filelinks_to_written_message - generalized for both
 * HTML and plaintext mail.
 */
function subtest_adding_filelinks_to_written_message() {
  gMockFilePicker.returnFiles = collectFiles(kFiles, __file__);
  let provider = new MockCloudfileAccount();
  provider.init("someKey");
  let cw = open_compose_new_mail();

  type_in_composer(cw, kLines);
  cw.window.attachToCloud(provider);

  let [root, list, urls] = wait_for_attachment_urls(cw, kFiles.length);

  let br = root.previousSibling;
  assert_equals(br.localName, "br",
                "The attachment URL containment node should be preceded by " +
                "a linebreak");
  br = br.previousSibling;
  assert_equals(br.localName, "br",
                "The attachment URL containment node should be preceded by " +
                "two linebreaks");
  close_window(cw);
}

/**
 * Tests for inserting Filelinks into a reply, when we're configured to
 * reply above the quote.
 */
function test_adding_filelinks_to_empty_reply_above() {
  let oldReplyOnTop = Services.prefs.getIntPref(kReplyOnTopKey);
  Services.prefs.setIntPref(kReplyOnTopKey, kReplyOnTop);

  try_with_and_without_signature_in_reply_or_fwd(
    subtest_adding_filelinks_to_reply_above, []);
  // Now with HTML mail...
  Services.prefs.setBoolPref(kHtmlPrefKey, false);
  try_with_and_without_signature_in_reply_or_fwd(
    subtest_adding_filelinks_to_reply_above_plaintext, []);

  Services.prefs.setBoolPref(kHtmlPrefKey, true);
  Services.prefs.setIntPref(kReplyOnTopKey, oldReplyOnTop);
}

/**
 * Tests for inserting Filelinks into a reply, when we're configured to
 * reply above the quote, after entering some text.
 */
function test_adding_filelinks_to_nonempty_reply_above() {
  let oldReplyOnTop = Services.prefs.getIntPref(kReplyOnTopKey);
  Services.prefs.setIntPref(kReplyOnTopKey, kReplyOnTop);

  subtest_adding_filelinks_to_reply_above(kLines);

  Services.prefs.setBoolPref(kHtmlPrefKey, false);
  subtest_adding_filelinks_to_reply_above_plaintext(kLines);
  Services.prefs.setBoolPref(kHtmlPrefKey, true);

  Services.prefs.setIntPref(kReplyOnTopKey, oldReplyOnTop);
}

/**
 * Subtest for test_adding_filelinks_to_reply_above for the plaintext composer.
 * Does some special casing for the weird br insertions that happens in
 * various cases.
 */
function subtest_adding_filelinks_to_reply_above_plaintext(aText, aWithSig) {
  let cw = prepare_some_attachments_and_reply(aText, kFiles);
  let [root, list, urls] = wait_for_attachment_urls(cw, kFiles.length);

  let br;
  if (aText.length)
    br = assert_next_nodes("br", root, 2);
  else
    br = assert_next_nodes("br", root, 1);

  let div = br.nextSibling;
  assert_equals(div.localName, "div",
                "The linebreak should be followed by a div");

  assert_true(div.classList.contains("moz-cite-prefix"));

  if (aText.length)
    br = assert_previous_nodes("br", root, 2);
  else
    br = assert_previous_nodes("br", root, 1);

  if (aText.length == 0) {
    // If we didn't type anything, that br should be the first element of the
    // message body.
    let msgBody = get_compose_body(cw);
    assert_equals(msgBody.firstChild, br,
                  "The linebreak should have been the first element in the " +
                  "message body");
  } else {
    let targetText = aText[aText.length - 1];
    let textNode = br.previousSibling;
    assert_equals(textNode.nodeType, kTextNodeType);
    assert_equals(textNode.nodeValue, targetText);
  }

  close_window(cw);
}

/**
 * Subtest for test_adding_filelinks_to_reply_above for the HTML composer.
 */
function subtest_adding_filelinks_to_reply_above(aText) {
  let cw = prepare_some_attachments_and_reply(aText, kFiles);
  let [root, list, urls] = wait_for_attachment_urls(cw, kFiles.length);

  // So, we should have the root, followed by a br
  let br = root.nextSibling;
  assert_equals(br.localName, "br",
                "The attachment URL containment node should be followed by " +
                " a br");

  // ... which is followed by a div with a class of "moz-cite-prefix".
  let div = br.nextSibling;
  assert_equals(div.localName, "div",
                "The linebreak should be followed by a div");

  assert_true(div.classList.contains("moz-cite-prefix"));

  close_window(cw);
}

/**
 * Tests for inserting Filelinks into a reply, when we're configured to
 * reply below the quote.
 */
function test_adding_filelinks_to_empty_reply_below() {
  let oldReplyOnTop = Services.prefs.getIntPref(kReplyOnTopKey);
  Services.prefs.setIntPref(kReplyOnTopKey, kReplyOnBottom);

  try_with_and_without_signature_in_reply_or_fwd(
    subtest_adding_filelinks_to_reply_below, []);
  Services.prefs.setBoolPref(kHtmlPrefKey, false);
  try_with_and_without_signature_in_reply_or_fwd(
    subtest_adding_filelinks_to_plaintext_reply_below, []);
  Services.prefs.setBoolPref(kHtmlPrefKey, true);

  Services.prefs.setIntPref(kReplyOnTopKey, oldReplyOnTop);
}

/**
 * Tests for inserting Filelinks into a reply, when we're configured to
 * reply below the quote, after entering some text.
 */
function test_adding_filelinks_to_nonempty_reply_below() {
  let oldReplyOnTop = Services.prefs.getIntPref(kReplyOnTopKey);
  Services.prefs.setIntPref(kReplyOnTopKey, kReplyOnBottom);

  try_with_and_without_signature_in_reply_or_fwd(
    subtest_adding_filelinks_to_reply_below, kLines);

  Services.prefs.setBoolPref(kHtmlPrefKey, false);
  try_with_and_without_signature_in_reply_or_fwd(
    subtest_adding_filelinks_to_plaintext_reply_below, kLines);
  Services.prefs.setBoolPref(kHtmlPrefKey, true);

  Services.prefs.setIntPref(kReplyOnTopKey, oldReplyOnTop);
}

/**
 * Subtest for test_adding_filelinks_to_reply_below for the HTML composer.
 */
function subtest_adding_filelinks_to_reply_below(aText, aWithSig) {
  let cw = prepare_some_attachments_and_reply(aText, kFiles);
  let [root, list, urls] = wait_for_attachment_urls(cw, kFiles.length);
  // So, we should have the root, followed by a br
  let br = root.nextSibling;
  assert_equals(br.localName, "br",
                "The attachment URL containment node should be followed by " +
                " a br");

  let blockquote;
  if (aText.length) {
    // If there was any text inserted, check for 2 previous br nodes, and then
    // the inserted text, and then the blockquote.
    br = assert_previous_nodes("br", root, 2);
    let textNode = assert_previous_text(br.previousSibling, aText);
    blockquote = textNode.previousSibling;
  }
  else {
    // If no text was inserted, check for 1 previous br node, and then the
    // blockquote.
    br = assert_previous_nodes("br", root, 1);
    blockquote = br.previousSibling;
  }

  assert_equals(blockquote.localName, "blockquote",
                "The linebreak should be preceded by a blockquote.");

  let prefix = blockquote.previousSibling;
  assert_equals(prefix.localName, "div",
                "The blockquote should be preceded by the prefix div");
  assert_true(prefix.classList.contains("moz-cite-prefix"),
              "The prefix should have the moz-cite-prefix class");

  close_window(cw);
}

/**
 * Subtest for test_adding_filelinks_to_reply_below for the plaintext composer.
 */
function subtest_adding_filelinks_to_plaintext_reply_below(aText, aWithSig) {
  let cw = prepare_some_attachments_and_reply(aText, kFiles);
  let [root, list, urls] = wait_for_attachment_urls(cw, kFiles.length);

  // So, we should have the root, followed by a br
  let br = root.nextSibling;
  assert_equals(br.localName, "br",
                "The attachment URL containment node should be followed by " +
                " a br");

  // If a signature was inserted AND no text was entered, then there
  // should only be a single br preceding the root.
  if (aWithSig && !aText.length)
    br = assert_previous_nodes("br", root, 1);
  else {
    // Otherwise, there should be two br's preceding the root.
    br = assert_previous_nodes("br", root, 2);
  }

  let span;

  if (aText.length) {
    // If text was entered, make sure it matches what we expect...
    let textNode = assert_previous_text(br.previousSibling, aText);
    // And then grab the span, which should be before the final text node.
    span = textNode.previousSibling;
  }
  else {
    // If no text was entered, just grab the last br's previous sibling - that
    // will be the span.
    span = br.previousSibling;
  }

  assert_equals(span.localName, "span",
                "The linebreak should be preceded by a span.");

  let prefix = span.previousSibling;
  assert_equals(prefix.localName, "div",
                "The blockquote should be preceded by the prefix div");
  assert_true(prefix.classList.contains("moz-cite-prefix"),
              "The prefix should have the moz-cite-prefix class");

  close_window(cw);
}

/**
 * Tests Filelink insertion on an inline-forward compose window with nothing
 * typed into it.
 */
function test_adding_filelinks_to_empty_forward() {
  Services.prefs.setIntPref(kReplyOnTopKey, kReplyOnTop);
  try_with_and_without_signature_in_reply_or_fwd(
    subtest_adding_filelinks_to_forward, []);
  Services.prefs.setBoolPref(kHtmlPrefKey, false);
  try_with_and_without_signature_in_reply_or_fwd(
    subtest_adding_filelinks_to_forward, []);
  Services.prefs.setBoolPref(kHtmlPrefKey, true);
}

/**
 * Tests Filelink insertion on an inline-forward compose window with some
 * text typed into it.
 */
function test_adding_filelinks_to_forward() {
  try_with_and_without_signature_in_reply_or_fwd(
    subtest_adding_filelinks_to_forward, kLines);
  Services.prefs.setBoolPref(kHtmlPrefKey, false);
  try_with_and_without_signature_in_reply_or_fwd(
    subtest_adding_filelinks_to_forward, kLines);
  Services.prefs.setBoolPref(kHtmlPrefKey, true);
}

/**
 * Subtest for both test_adding_filelinks_to_empty_forward and
 * test_adding_filelinks_to_forward - ensures that the inserted Filelinks
 * are positioned correctly.
 */
function subtest_adding_filelinks_to_forward(aText, aWithSig) {
  let cw = prepare_some_attachments_and_forward(aText, kFiles);
  let [root, list, urls] = wait_for_attachment_urls(cw, kFiles.length);

  let br = assert_next_nodes("br", root, 1);
  let forwardDiv = br.nextSibling;
  assert_equals(forwardDiv.localName, "div");
  assert_true(forwardDiv.classList.contains("moz-forward-container"));

  if (aText.length) {
    // If there was text typed in, it should be separated from the root by two
    // br's
    let br = assert_previous_nodes("br", root, 2);
    let textNode = assert_previous_text(br.previousSibling, aText);
  } else {
    // Otherwise, there's only 1 br, and that br should be the first element
    // of the message body.
    let br = assert_previous_nodes("br", root, 1);
    let mailBody = get_compose_body(cw);
    assert_equals(br, mailBody.firstChild);
  }
}

/**
 * Test that if we convert a Filelink from one provider to another, that the
 * old Filelink is removed, and a new Filelink is added for the new provider.
 * We test this on both HTML and plaintext mail.
 */
function test_converting_filelink_updates_urls() {
  try_with_plaintext_and_html_mail(subtest_converting_filelink_updates_urls);
}

/**
 * Subtest for test_converting_filelink_updates_urls that creates two
 * storage provider accounts, uploads files to one, converts them to the
 * other, and ensures that the attachment links in the message body get
 * get updated.
 */
function subtest_converting_filelink_updates_urls() {
  gMockFilePicker.returnFiles = collectFiles(kFiles, __file__);
  let providerA = new MockCloudfileAccount();
  let providerB = new MockCloudfileAccount();
  providerA.init("providerA");
  providerB.init("providerB");

  let cw = open_compose_new_mail();
  cw.window.attachToCloud(providerA);

  let [root, list, urls] = wait_for_attachment_urls(cw, kFiles.length);

  // Convert each Filelink to providerB, ensuring that the URLs are replaced.
  for (let i = 0; i < kFiles.length; ++i) {
    let url = urls[i];
    select_attachments(cw, i);
    cw.window.convertSelectedToCloudAttachment(providerB);
    [root, list, urls] = wait_for_attachment_urls(cw, kFiles.length);

    let newUrl = urls[i];

    assert_not_equals(url, newUrl,
                      "The original URL should have been replaced");
  }
}

/**
 * Test that if we convert a Filelink to a normal attachment that the
 * Filelink is removed from the message body.
 */
function test_converting_filelink_to_normal_removes_url() {
  try_with_plaintext_and_html_mail(
    subtest_converting_filelink_to_normal_removes_url);
}

/**
 * Subtest for test_converting_filelink_to_normal_removes_url that adds
 * some Filelinks to an email, and then converts those Filelinks back into
 * normal attachments, checking to ensure that the links are removed from
 * the body of the email.
 */
function subtest_converting_filelink_to_normal_removes_url() {
  gMockFilePicker.returnFiles = collectFiles(kFiles, __file__);
  let provider = new MockCloudfileAccount();
  provider.init("someKey");

  let cw = open_compose_new_mail();
  cw.window.attachToCloud(provider);

  let [root, list, urls] = wait_for_attachment_urls(cw, kFiles.length);

  for (let i = 0; i < kFiles.length; ++i) {
    select_attachments(cw, i);
    cw.window.convertSelectedToRegularAttachment();

    let urls = list.querySelectorAll(".cloudAttachmentItem");
    assert_equals(urls.length, kFiles.length - (i + 1));
  }

  // At this point, the root should also have been removed.
  let mailBody = get_compose_body(cw);
  root = mailBody.querySelector("#cloudAttachmentListRoot");
  if (root)
    throw new Error("Should not have found the cloudAttachmentListRoot");
}

/**
 * Tests that if the user manually removes the Filelinks from the message body
 * that it doesn't break future Filelink insertions.
 */
function test_filelinks_work_after_manual_removal() {
  try_with_plaintext_and_html_mail(subtest_filelinks_work_after_manual_removal);
}

/**
 * Subtest that first adds some Filelinks to the message body, removes them,
 * and then adds another Filelink ensuring that the new URL is successfully
 * inserted.
 */
function subtest_filelinks_work_after_manual_removal() {
  // Insert some Filelinks...
  gMockFilePicker.returnFiles = collectFiles(kFiles, __file__);
  let provider = new MockCloudfileAccount();
  provider.init("someKey");
  let cw = open_compose_new_mail();
  cw.window.attachToCloud(provider);

  let [root, list, urls] = wait_for_attachment_urls(cw, kFiles.length);

  // Now remove the root node from the document body
  let mailBody = get_compose_body(cw);
  mailBody.removeChild(root);

  gMockFilePicker.returnFiles = collectFiles(["./data/testFile3"], __file__);
  cw.window.attachToCloud(provider);
  [root, list, urls] = wait_for_attachment_urls(cw, 1);
}


