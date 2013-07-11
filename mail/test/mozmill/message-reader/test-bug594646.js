/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/**
 * Tests that opening an .eml file the body of the message is correct,
 * that it hasn't been UTF-8 mojibake'd.
 */

const MODULE_NAME = "test-bug594646";

const RELATIVE_ROOT = "../shared-modules";
const MODULE_REQUIRES = ["folder-display-helpers", "window-helpers"];

var os = {};
Cu.import('resource://mozmill/stdlib/os.js', os);

let gReferenceTextContent;

function setupModule(module) {
  collector.getModule("folder-display-helpers").installInto(module);
  collector.getModule("window-helpers").installInto(module);
  gReferenceTextContent = extract_eml_body_textcontent("./bug594646_reference.eml");
}

function extract_eml_body_textcontent(eml) {
  let file = os.getFileForPath(os.abspath(eml, os.getFileForPath(__file__)));
  let msgc = open_message_from_file(file);

  // Be sure to view message body as Original HTML
  msgc.window.MsgBodyAllowHTML();

  let textContent = msgc.window
                        .msgWindow
                        .messageWindowDocShell
                        .contentViewer
                        .DOMDocument
                        .documentElement
                        .textContent;

  close_window(msgc);
  return textContent;
}

/**
 * Checks that the text content is equal for the .eml files.
 */
function check_eml_textcontent(eml) {
  let textContent = extract_eml_body_textcontent(eml);
  assert_equals(gReferenceTextContent, textContent);
}

/**
 * This test excercises the bug for reversed http-equiv, content order:
 *  <head>
 *    <meta content="text/html; charset=ISO-8859-2"; http-equiv="content-type">
 *  </head>
 */
function test_original_html_characters_head_meta_content_charset_httpEq() {
  check_eml_textcontent("./bug594646_reversed_order_8bit.eml");
  check_eml_textcontent("./bug594646_reversed_order_qp.eml");
  check_eml_textcontent("./bug594646_reversed_order_b64.eml");
}

/**
 * This test excercises the bug for newline delimited charset:
 *  <head>
 *    <meta http-equiv="content-type" content="text/html;
 *          charset=ISO-8859-2">
 *  </head>
 */
function test_original_html_characters_head_meta_httpEq_content_newline_charset() {
  check_eml_textcontent("./bug594646_newline_charset_8bit.eml");
  check_eml_textcontent("./bug594646_newline_charset_qp.eml");
  check_eml_textcontent("./bug594646_newline_charset_b64.eml");
}

/**
 * This test excercises the bug for newline delimited and reverse ordered http-equiv:
 *  <head>
 *    <meta content="text/html; charset=ISO-8859-2"
 *          http-equiv="content-type">
 *  </head>
 */
function test_original_html_characters_head_meta_content_charset_newline_httpEq() {
  check_eml_textcontent("./bug594646_newline_httpequiv_8bit.eml");
  check_eml_textcontent("./bug594646_newline_httpequiv_qp.eml");
  check_eml_textcontent("./bug594646_newline_httpequiv_b64.eml");
}

