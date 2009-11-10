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
 * The Original Code is Thunderbird Mail Client.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Blake Winton <bwinton@latte.ca>
 *   Dan Mosedale <dmose@mozillamessaging.com>
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
 * Test that we can add a tag to a message without messing up the header.
 */
var MODULE_NAME = 'test-message-header';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers'];

var folder;

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);

  folder = create_folder("MessageWindowA");

  // create a message that has the interesting headers that commonly
  // show up in the message header pane for testing
  let msg = create_message({cc: [["John Doe", "john.doe@momo.invalid"]],
                            clobberHeaders: {
                              "Newsgroups": "alt.test",
                              "Reply-To": "J. Doe <j.doe@momo.invalid>",
                              "Content-Base": "http://example.com/",
                              "Bcc": "Richard Roe <richard.roe@momo.invalid>"
                            }});

  add_message_to_folder(folder, msg);
}

function test_add_tag_with_really_long_label() {
  be_in_folder(folder);

  // select the first message, which will display it
  let curMessage = select_click_row(0);

  assert_selected_and_displayed(mc, curMessage);

  let topColumn = mc.eid("expandedHeadersNameColumn").node;
  let bottomColumn = mc.eid("expandedHeaders2NameColumn").node;

  if (topColumn.clientWidth != bottomColumn.clientWidth)
    throw new Error("Header columns have different widths!  " +
                    topColumn.clientWidth + " != " + bottomColumn.clientWidth);
  let defaultWidth = topColumn.clientWidth;

  // Make the tags label really long.
  let tagsLabel = mc.eid("expandedtagsLabel").node;
  let oldTagsValue = tagsLabel.value;
  tagsLabel.value = "taaaaaaaaaaaaaaaaaags";

  if (topColumn.clientWidth != bottomColumn.clientWidth) {
    tagsLabel.value = oldTagsValue;
    throw new Error("Header columns have different widths!  " +
                    topColumn.clientWidth + " != " + bottomColumn.clientWidth);
  }
  if (topColumn.clientWidth != defaultWidth) {
    tagsLabel.value = oldTagsValue;
    throw new Error("Header columns changed width!  " +
                    topColumn.clientWidth + " != " + defaultWidth);
  }

  // Add the first tag, and make sure that the label are the same length.
  mc.keypress(mc.eid("expandedHeadersNameColumn"), "1", {});

  if (topColumn.clientWidth != bottomColumn.clientWidth) {
    tagsLabel.value = oldTagsValue;
    throw new Error("Header columns have different widths!  " +
                    topColumn.clientWidth + " != " + bottomColumn.clientWidth);
  }
  if (topColumn.clientWidth == defaultWidth) {
    tagsLabel.value = oldTagsValue;
    throw new Error("Header columns didn't change width!  " +
                    topColumn.clientWidth + " != " + defaultWidth);
  }

  // Remove the tag and put it back so that the a11y label gets regenerated
  // with the normal value rather than "taaaaaaaags"
  tagsLabel.value = oldTagsValue;
  mc.keypress(mc.eid("expandedHeadersNameColumn"), "1", {});
  mc.keypress(mc.eid("expandedHeadersNameColumn"), "1", {});
}

/**
 * @param headerName used for pretty-printing in exceptions
 * @param headerValueElement code to be eval()ed returning the DOM element
 *        with the data.
 * @param expectedName code to be eval()ed returning the expected value of
 *                     nsIAccessible.name for the DOM element in question
 * @param expectedFinalRole the expected value for nsIAccessible.finalRole
 */
let headersToTest = [
{
  headerName: "Subject",
  headerValueElement: "mc.a('expandedsubjectBox', {class: 'headerValue'})",
  expectedName: "mc.e('expandedsubjectLabel').value.slice(0,-1) + ': ' + " +
                "headerValueElement.textContent",
  expectedFinalRole: Ci.nsIAccessibleRole.ROLE_ENTRY
},
{
  headerName: "Content-Base",
  headerValueElement: "mc.a('expandedcontent-baseBox', {class: 'headerValue text-link headerValueUrl'})",
  expectedName: "mc.e('expandedcontent-baseLabel').value.slice(0,-1) + ': ' + " +
                "headerValueElement.textContent",
  expectedFinalRole: Ci.nsIAccessibleRole.ROLE_ENTRY
},
{
  headerName: "From",
  headerValueElement: "mc.window.document.getAnonymousElementByAttribute(" + 
                      "mc.a('expandedfromBox', {tagName: 'mail-emailaddress'})," +
                      "'class', 'emailDisplayButton')",
  expectedName: "mc.e('expandedfromLabel').value.slice(0,-1) + ': ' + " +
                "headerValueElement.parentNode.getAttribute('fullAddress')",
  expectedFinalRole: Ci.nsIAccessibleRole.ROLE_ENTRY
},
{
  headerName: "To",
  headerValueElement: "mc.window.document.getAnonymousElementByAttribute(" +
                      "mc.a('expandedtoBox', {tagName: 'mail-emailaddress'})," +
                      "'class', 'emailDisplayButton')",
  expectedName: "mc.e('expandedtoLabel').value.slice(0,-1) + ': ' + " + 
                "headerValueElement.parentNode.getAttribute('fullAddress')",
  expectedFinalRole: Ci.nsIAccessibleRole.ROLE_ENTRY
},
{
  headerName: "Cc",
  headerValueElement: "mc.window.document.getAnonymousElementByAttribute(" +
                      "mc.a('expandedccBox', {tagName: 'mail-emailaddress'})," +
                      "'class', 'emailDisplayButton')",
  expectedName: "mc.e('expandedccLabel').value.slice(0,-1) + ': ' + " +
                "headerValueElement.parentNode.getAttribute('fullAddress')",
  expectedFinalRole: Ci.nsIAccessibleRole.ROLE_ENTRY
},
{
  headerName: "Bcc",
  headerValueElement: "mc.window.document.getAnonymousElementByAttribute(" +
                      "mc.a('expandedbccBox', {tagName: 'mail-emailaddress'})," +
                      "'class', 'emailDisplayButton')",
  expectedName: "mc.e('expandedbccLabel').value.slice(0,-1) + ': ' + " +
                "headerValueElement.parentNode.getAttribute('fullAddress')",
  expectedFinalRole: Ci.nsIAccessibleRole.ROLE_ENTRY
},
{
  headerName: "Reply-To",
  headerValueElement: "mc.window.document.getAnonymousElementByAttribute(" +
                      "mc.a('expandedreply-toBox', {tagName: 'mail-emailaddress'})," +
                      "'class', 'emailDisplayButton')",
  expectedName: "mc.e('expandedreply-toLabel').value.slice(0,-1) + ': ' + " +
                "headerValueElement.parentNode.getAttribute('fullAddress')",
  expectedFinalRole: Ci.nsIAccessibleRole.ROLE_ENTRY
},
{
  headerName: "Newsgroups",
  headerValueElement: "mc.window.document.getAnonymousElementByAttribute(" +
                      "mc.a('expandednewsgroupsBox', {tagName: 'mail-newsgroup'})," +
                      "'class', 'newsgrouplabel')",
  expectedName: "mc.e('expandednewsgroupsLabel').value.slice(0,-1) + ': ' + " +
                "headerValueElement.parentNode.parentNode.getAttribute('newsgroup')",
  expectedFinalRole: Ci.nsIAccessibleRole.ROLE_ENTRY
},
{
  headerName: "Tags",
  headerValueElement: "mc.a('expandedtagsBox', {class: 'tagvalue blc-FF0000'})",
  expectedName: "mc.e('expandedtagsLabel').value.slice(0,-1) + ': ' + " +
                "headerValueElement.getAttribute('value')",
  expectedFinalRole: Ci.nsIAccessibleRole.ROLE_LABEL
}
];

// used to get the accessible object for a DOM node
let gAccRetrieval = Cc["@mozilla.org/accessibleRetrieval;1"].
                    getService(Ci.nsIAccessibleRetrieval);

/**
 * Use the information from aHeaderInfo to verify that screenreaders will
 * do the right thing with the given message header.
 *
 * @param {Object} aHeaderInfo  Information about how to do the verification;
 *                              See the comments above the headersToTest array
 *                              for details.
 */
function verify_header_a11y(aHeaderInfo) {

  let headerValueElement = eval(aHeaderInfo.headerValueElement);

  let headerAccessible = gAccRetrieval.getAccessibleFor(headerValueElement);
  if (headerAccessible.finalRole != aHeaderInfo.expectedFinalRole) {
    throw new Error("finalRole for " + aHeaderInfo.headerName + " was " +
                    headerAccessible.finalRole + "; should have been " +
                    aHeaderInfo.expectedFinalRole);
  }

  let expectedName = eval(aHeaderInfo.expectedName);
  if (headerAccessible.name != expectedName) {
    throw new Error("headerAccessible.name for " + aHeaderInfo.headerName +
                    " was '" + headerAccessible.name + "'; expected '" +
                    expectedName + "'");
  }
}

/**
 * Test the accessibility attributes of the various message headers.
 */
function test_a11y_attrs() {
  // skip this test on platforms that don't support accessibility
  if (!("nsIAccessibleRole" in Components.interfaces))
    return;

  be_in_folder(folder);

  // select and open the first message
  let curMessage = select_click_row(0);

  // make sure it loads
  wait_for_message_display_completion(mc);
  assert_selected_and_displayed(mc, curMessage);

  headersToTest.forEach(verify_header_a11y);
}
