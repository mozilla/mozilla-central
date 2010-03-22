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

var elib = {};
Cu.import('resource://mozmill/modules/elementslib.js', elib);

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
                    topColumn.clientWidth + " == " + defaultWidth);
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
 * @param expectedRole the expected value for nsIAccessible.role
 */
let headersToTest = [
{
  headerName: "Subject",
  headerValueElement: "mc.a('expandedsubjectBox', {class: 'headerValue'})",
  expectedName: "mc.e('expandedsubjectLabel').value.slice(0,-1) + ': ' + " +
                "headerValueElement.textContent",
  expectedRole: Ci.nsIAccessibleRole.ROLE_ENTRY
},
{
  headerName: "Content-Base",
  headerValueElement: "mc.a('expandedcontent-baseBox', {class: 'headerValue text-link headerValueUrl'})",
  expectedName: "mc.e('expandedcontent-baseLabel').value.slice(0,-1) + ': ' + " +
                "headerValueElement.textContent",
  expectedRole: Ci.nsIAccessibleRole.ROLE_ENTRY
},
{
  headerName: "From",
  headerValueElement: "mc.window.document.getAnonymousElementByAttribute(" + 
                      "mc.a('expandedfromBox', {tagName: 'mail-emailaddress'})," +
                      "'class', 'emailDisplayButton')",
  expectedName: "mc.e('expandedfromLabel').value.slice(0,-1) + ': ' + " +
                "headerValueElement.parentNode.getAttribute('fullAddress')",
  expectedRole: Ci.nsIAccessibleRole.ROLE_ENTRY
},
{
  headerName: "To",
  headerValueElement: "mc.window.document.getAnonymousElementByAttribute(" +
                      "mc.a('expandedtoBox', {tagName: 'mail-emailaddress'})," +
                      "'class', 'emailDisplayButton')",
  expectedName: "mc.e('expandedtoLabel').value.slice(0,-1) + ': ' + " + 
                "headerValueElement.parentNode.getAttribute('fullAddress')",
  expectedRole: Ci.nsIAccessibleRole.ROLE_ENTRY
},
{
  headerName: "Cc",
  headerValueElement: "mc.window.document.getAnonymousElementByAttribute(" +
                      "mc.a('expandedccBox', {tagName: 'mail-emailaddress'})," +
                      "'class', 'emailDisplayButton')",
  expectedName: "mc.e('expandedccLabel').value.slice(0,-1) + ': ' + " +
                "headerValueElement.parentNode.getAttribute('fullAddress')",
  expectedRole: Ci.nsIAccessibleRole.ROLE_ENTRY
},
{
  headerName: "Bcc",
  headerValueElement: "mc.window.document.getAnonymousElementByAttribute(" +
                      "mc.a('expandedbccBox', {tagName: 'mail-emailaddress'})," +
                      "'class', 'emailDisplayButton')",
  expectedName: "mc.e('expandedbccLabel').value.slice(0,-1) + ': ' + " +
                "headerValueElement.parentNode.getAttribute('fullAddress')",
  expectedRole: Ci.nsIAccessibleRole.ROLE_ENTRY
},
{
  headerName: "Reply-To",
  headerValueElement: "mc.window.document.getAnonymousElementByAttribute(" +
                      "mc.a('expandedreply-toBox', {tagName: 'mail-emailaddress'})," +
                      "'class', 'emailDisplayButton')",
  expectedName: "mc.e('expandedreply-toLabel').value.slice(0,-1) + ': ' + " +
                "headerValueElement.parentNode.getAttribute('fullAddress')",
  expectedRole: Ci.nsIAccessibleRole.ROLE_ENTRY
},
{
  headerName: "Newsgroups",
  headerValueElement: "mc.window.document.getAnonymousElementByAttribute(" +
                      "mc.a('expandednewsgroupsBox', {tagName: 'mail-newsgroup'})," +
                      "'class', 'newsgrouplabel')",
  expectedName: "mc.e('expandednewsgroupsLabel').value.slice(0,-1) + ': ' + " +
                "headerValueElement.parentNode.parentNode.getAttribute('newsgroup')",
  expectedRole: Ci.nsIAccessibleRole.ROLE_ENTRY
},
{
  headerName: "Tags",
  headerValueElement: "mc.a('expandedtagsBox', {class: 'tagvalue blc-FF0000'})",
  expectedName: "mc.e('expandedtagsLabel').value.slice(0,-1) + ': ' + " +
                "headerValueElement.getAttribute('value')",
  expectedRole: Ci.nsIAccessibleRole.ROLE_LABEL
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
  if (headerAccessible.role != aHeaderInfo.expectedRole) {
    throw new Error("role for " + aHeaderInfo.headerName + " was " +
                    headerAccessible.role + "; should have been " +
                    aHeaderInfo.expectedRole);
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

function test_that_msg_without_date_clears_previous_headers() {
  be_in_folder(folder);

  // create a message
  let msg = create_message();

  // ensure that this message doesn't have a Date header
  delete msg.headers.Date;

  // this will add the message to the end of the folder
  add_message_to_folder(folder, msg);

  // select and open the first message
  let curMessage = select_click_row(0);

  // make sure it loads
  wait_for_message_display_completion(mc);
  assert_selected_and_displayed(mc, curMessage);

  // Since we didn't give create_message an argument that would create a
  // Newsgroups header, the newsgroups <row> element should be collapsed.
  // However, since the previously displayed message _did_ have such a header,
  // certain bugs in the display of this header could cause the collapse
  // never to have happened.
  if (mc.e("expandednewsgroupsRow").collapsed != true) {
    throw new Error("Expected <row> elemnent for Newsgroups header to be " +
                    "collapsed, but it wasn't\n!");
  }
}

/**
 * Test that we only display at most the max lines preference until we
 * display (n more), and, after the widget is clicked, we expand the header.
 */
function test_more_widget() {

  // get maxline pref
  let prefBranch = Cc["@mozilla.org/preferences-service;1"]
    .getService(Ci.nsIPrefService).getBranch(null);
  let maxLines = prefBranch.getIntPref(
    "mailnews.headers.show_n_lines_before_more");

  // generate message with 20 recips (effectively guarantees overflow)
  be_in_folder(folder);
  let msg = create_message({toCount: 20});

  // add the message to the end of the folder
  add_message_to_folder(folder, msg);

  // select and open the last message
  let curMessage = select_click_row(-1);

  // make sure it loads
  wait_for_message_display_completion(mc);
  assert_selected_and_displayed(mc, curMessage);

  // get the description element containing the addresses
  let toDescription = mc.a('expandedtoBox', {class: "headerValue"});

  // test that the to element doesn't have more than max lines
  let style = mc.window.getComputedStyle(toDescription, null);
  let numLines = style.height / style.lineHeight
  if (numLines > maxLines) {
    throw new Error("expected <= " + maxLines + "lines; found " + numLines);
  }

  // test that we've got a (more) node and that it's expanded
  let moreNode = mc.a('expandedtoBox', {class: 'moreIndicator'});
  if (!moreNode) {
    throw new Error("more node not found before activation");
  }
  if (moreNode.collapsed) {
    throw new Error("more node was collapsed when it should have been visible");
  }

  // activate (n more)
  mc.click(new elib.Elem(moreNode));

  // test that (n more) is gone
  moreNode = mc.a('expandedtoBox', {class: 'moreIndicator'});
  if (!moreNode.collapsed) {
    throw new Error("more node should be collapsed after activation");
  }

  // test that we actually have more lines than we did before!
  let style = mc.window.getComputedStyle(toDescription, null);
  let newNumLines = style.height / style.lineHeight;
  if (newNumLines <= numLines) {
    throw new Error("number of address lines present after more clicked = " +
      newNumLines + "<= number of lines present beforehand = " + numLines);
  }
}

/**
 * Make sure the (more) widget hidden pref actually works with a
 * non-default value.
  */
function test_more_widget_with_maxlines_of_3(){

  // set maxLines to 2
  let prefBranch = Cc["@mozilla.org/preferences-service;1"]
    .getService(Ci.nsIPrefService).getBranch(null);
  let maxLines = prefBranch.setIntPref(
    "mailnews.headers.show_n_lines_before_more", 3);

  // call test_more_widget again
  test_more_widget();
}
