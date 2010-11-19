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
 * the Mozilla Foundation.
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
var MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers',
                       'address-book-helpers'];

var elib = {};
Cu.import('resource://mozmill/modules/elementslib.js', elib);

var folder;

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);
  let abh = collector.getModule('address-book-helpers');
  abh.installInto(module);

  folder = create_folder("MessageWindowA");

  // create a message that has the interesting headers that commonly
  // show up in the message header pane for testing
  let msg = create_message({cc: msgGen.makeNamesAndAddresses(20), // YYY
                            subject: "This is a really, really, really, really, really, really, really, really, long subject.",
                            clobberHeaders: {
                              "Newsgroups": "alt.test",
                              "Reply-To": "J. Doe <j.doe@momo.invalid>",
                              "Content-Base": "http://example.com/",
                              "Bcc": "Richard Roe <richard.roe@momo.invalid>"
                            }});

  add_message_to_folder(folder, msg);

  // create a message that has boring headers to be able to switch to and
  // back from, to force the more button to collapse again.
  msg = create_message();
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

function test_more_button_with_many_recipients()
{
  // Start on the interesting message.
  let curMessage = select_click_row(0);

  // make sure it loads
  wait_for_message_display_completion(mc);
  assert_selected_and_displayed(mc, curMessage);

  // Check the mode of the header.
  let headerBox = mc.eid("expandedHeaderView");
  let previousHeaderMode = headerBox.node.getAttribute("show_header_mode");

  // Click the "more" button.
  let moreIndicator = mc.eid("expandedccBox");
  moreIndicator = mc.window.document.getAnonymousElementByAttribute(
                    moreIndicator.node, "anonid", "more");
  moreIndicator = new elementslib.Elem(moreIndicator);
  mc.click(moreIndicator);

  // Check the new mode of the header.
  if (headerBox.node.getAttribute("show_header_mode") != "all")
    throw new Error("Header Mode didn't change to 'all'!  " + "old=" +
                    previousHeaderMode + ", new=" +
                    headerBox.node.getAttribute("show_header_mode"));

  // Switch to the boring message, to force the more button to collapse.
  let curMessage = select_click_row(1);

  // make sure it loads
  wait_for_message_display_completion(mc);
  assert_selected_and_displayed(mc, curMessage);

  // Check the even newer mode of the header.
  if (headerBox.node.getAttribute("show_header_mode") != previousHeaderMode)
    throw new Error("Header Mode changed from " + previousHeaderMode +
                    " to " + headerBox.node.getAttribute("show_header_mode") +
                    " and didn't change back.");
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

/**
 * Test that clicking the adding an address node adds it to the address book.
 */
function test_add_contact_from_context_menu() {
  // Click the contact to show the emailAddressPopup popup menu.
  mc.click(mc.aid("expandedfromBox", {tagName: "mail-emailaddress"}));

  var addToAddressBookItem = mc.window.document.getElementById("addToAddressBookItem");
  if (addToAddressBookItem.hidden)
    throw new Error("addToAddressBookItem is hidden for unknown contact");
  var editContactItem = mc.window.document.getElementById("editContactItem");
  if (!editContactItem.getAttribute("hidden"))
    throw new Error("editContactItem is NOT hidden for unknown contact");

  // Click the Add to Address Book context menu entry.
  mc.click(mc.eid("addToAddressBookItem"));
  // (for reasons unknown, the pop-up does not close itself)
  close_popup();

  // Now click the contact again, the context menu should now show the
  // Edit Contact menu instead.
  mc.click(mc.aid("expandedfromBox", {tagName: "mail-emailaddress"}));
  // (for reasons unknown, the pop-up does not close itself)
  close_popup();

  addToAddressBookItem = mc.window.document.getElementById("addToAddressBookItem");
  if (!addToAddressBookItem.hidden)
    throw new Error("addToAddressBookItem is NOT hidden for known contact");
  editContactItem = mc.window.document.getElementById("editContactItem");
  if (editContactItem.hidden)
    throw new Error("editContactItem is hidden for known contact");
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
 * Test various aspects of the (n more) widgetry.
 */
function test_more_widget() {
  // generate message with 35 recips (effectively guarantees overflow for n=3)
  be_in_folder(folder);
  let msg = create_message({toCount: 35});

  // add the message to the end of the folder
  add_message_to_folder(folder, msg);

  // select and open the last message
  let curMessage = select_click_row(-1);

  // make sure it loads
  wait_for_message_display_completion(mc);
  assert_selected_and_displayed(mc, curMessage);

  // get the description element containing the addresses
  let toDescription = mc.a('expandedtoBox', {class: "headerValue"});

  subtest_more_widget_display(toDescription);
  subtest_more_widget_click(toDescription);
  subtest_more_widget_star_click(toDescription);
}

/**
 * Test that all addresses are shown in show all header mode
 */
function test_show_all_header_mode() {
  // generate message with 35 recips (effectively guarantees overflow for n=3)
  be_in_folder(folder);
  let msg = create_message({toCount: 35});

  // add the message to the end of the folder
  add_message_to_folder(folder, msg);

  // select and open the last message
  let curMessage = select_click_row(-1);

  // make sure it loads
  wait_for_message_display_completion(mc);
  assert_selected_and_displayed(mc, curMessage);

  // get the description element containing the addresses
  let toDescription = mc.a('expandedtoBox', {class: "headerValue"});

  change_to_header_normal_mode();
  subtest_more_widget_display(toDescription);
  subtest_change_to_all_header_mode(toDescription);
  change_to_header_normal_mode();
  subtest_more_widget_click(toDescription);
}

function change_to_header_normal_mode() {
  // XXX Clicking on check menu items doesn't work in 1.4.1b1 (bug 474486)...
  //  mc.click(new elib.Elem(mc.menus.View.viewheadersmenu.viewnormalheaders));
  // ... so call the function instead.
  mc.window.MsgViewNormalHeaders();
  mc.sleep(0);
}

function change_to_all_header_mode() {
  // XXX Clicking on check menu items doesn't work in 1.4.1b1 (bug 474486)...
  //  mc.click(new elib.Elem(mc.menus.View.viewheadersmenu.viewallheaders));
  // ... so call the function instead.
  mc.window.MsgViewAllHeaders();
  mc.sleep(0);
}

/**
 * Get the number of lines in one of the multi-address fields
 * @param node the description element containing the addresses
 * @return the number of lines
 */
function help_get_num_lines(node) {
  let style = mc.window.getComputedStyle(node, null);
  return style.height / style.lineHeight;
}

/**
 * Test that the "more" widget displays when it should.
 * @param toDescription the description node for the "to" field
 */
function subtest_more_widget_display(toDescription) {
  // test that the to element doesn't have more than max lines
  let numLines = help_get_num_lines(toDescription);

  // get maxline pref
  let prefBranch = Cc["@mozilla.org/preferences-service;1"]
    .getService(Ci.nsIPrefService).getBranch(null);
  let maxLines = prefBranch.getIntPref(
    "mailnews.headers.show_n_lines_before_more");

  // allow for a 15% tolerance for any padding that may be applied
  if (numLines < 0.85*maxLines || numLines > 1.15*maxLines) {
    throw new Error("expected == " + maxLines + "lines; found " + numLines);
  }

  // test that we've got a (more) node and that it's expanded
  let moreNode = mc.a('expandedtoBox', {class: 'moreIndicator'});
  if (!moreNode) {
    throw new Error("more node not found before activation");
  }
  if (moreNode.collapsed) {
    throw new Error("more node was collapsed when it should have been visible");
  }
}

/**
 * Test that clicking the "more" widget displays all the addresses.
 * @param toDescription the description node for the "to" field
 */
function subtest_more_widget_click(toDescription) {
  let oldNumLines = help_get_num_lines(toDescription);

  // activate (n more)
  let moreNode = mc.aid('expandedtoBox', {class: 'moreIndicator'});
  mc.click(moreNode);

  // test that (n more) is gone
  moreNode = mc.a('expandedtoBox', {class: 'moreIndicator'});
  if (!moreNode.collapsed) {
    throw new Error("more node should be collapsed after activation");
  }

  // test that we actually have more lines than we did before!
  let newNumLines = help_get_num_lines(toDescription);
  if (newNumLines <= oldNumLines) {
    throw new Error("number of address lines present after more clicked = " +
      newNumLines + "<= number of lines present beforehand = " + oldNumLines);
  }
}

/**
 * Test that changing to all header lines mode displays all the addresses.
 * @param toDescription the description node for the "to" field
 */
function subtest_change_to_all_header_mode(toDescription) {
  let oldNumLines = help_get_num_lines(toDescription);

  change_to_all_header_mode();
  // test that (n more) is gone
  let moreNode = mc.a('expandedtoBox', {class: 'moreIndicator'});
  if (!moreNode.collapsed) {
    throw new Error("more node should be collapsed in all header lines mode");
  }

  // test that we actually have more lines than we did before!
  let newNumLines = help_get_num_lines(toDescription);
  if (newNumLines <= oldNumLines) {
    throw new Error("number of address lines present in all header lines mode = " +
      newNumLines + "<= number of lines present beforehand = " + oldNumLines);
  }
}

/**
 * Test that clicking the star updates the UI properly (see bug 563612).
 * @param toDescription the description node for the "to" field
 */
function subtest_more_widget_star_click(toDescription) {
  let addrs = toDescription.getElementsByTagName('mail-emailaddress');
  let lastAddr = addrs[addrs.length-1];
  ensure_no_card_exists(lastAddr.getAttribute("emailAddress"));

  // scroll to the bottom first so the address is in view
  let view = mc.e('expandedHeaderView');
  view.scrollTop = view.scrollHeight - view.clientHeight;

  mc.click(mc.aid(lastAddr, {class: 'emailStar'}));
  if (lastAddr.getAttribute('hascard') == 'false') {
    throw new Error("address not updated after clicking star");
  }
}

/**
 * Make sure the (more) widget hidden pref actually works with a
 * non-default value.
 */
function test_more_widget_with_maxlines_of_3(){

  // set maxLines to 3
  let prefBranch = Cc["@mozilla.org/preferences-service;1"]
    .getService(Ci.nsIPrefService).getBranch(null);
  let maxLines = prefBranch.setIntPref(
    "mailnews.headers.show_n_lines_before_more", 3);

  // call test_more_widget again
  test_more_widget();
}

/**
 * Make sure the (more) widget hidden pref also works with an
 * "all" (0) non-default value.
 */
function test_more_widget_with_disabled_more(){

  // set maxLines to 0
  let prefBranch = Cc["@mozilla.org/preferences-service;1"]
    .getService(Ci.nsIPrefService).getBranch(null);
  let maxLines = prefBranch.setIntPref(
    "mailnews.headers.show_n_lines_before_more", 0);

  // generate message with 35 recips (effectively guarantees overflow for n=3)
  be_in_folder(folder);
  let msg = create_message({toCount: 35});

  // add the message to the end of the folder
  add_message_to_folder(folder, msg);

  // select and open the last message
  let curMessage = select_click_row(-1);

  // make sure it loads
  wait_for_message_display_completion(mc);
  assert_selected_and_displayed(mc, curMessage);

  // test that (n more) is gone
  let moreNode = mc.a('expandedtoBox', {class: 'moreIndicator'});
  if (!moreNode.collapsed) {
    throw new Error("more node should be collapsed in n=0 case");
  }

  // get the description element containing the addresses
  let toDescription = mc.a('expandedtoBox', {class: "headerValue"});

  // test that we actually have more lines than the 3 we know are filled
  let newNumLines = help_get_num_lines(toDescription);
  if (newNumLines <= 3) {
    throw new Error("number of address lines present in all addresses mode = " +
      newNumLines + "<= number of expected minimum of 3 lines filled");
  }
}

/**
 * When the window gets too narrow the toolbar should float above the From
 *  line.  Then they need to return back to the right when we get large
 *  enough again.
 */
function test_toolbar_collapse_and_expand() {
  be_in_folder(folder);
  // Select and open a message, in this case the last, for no particular reason.
  let curMessage = select_click_row(-1);

  try {
    let expandedHeadersTopBox = mc.e("expandedHeadersTopBox");
    let toolbar = mc.e("header-view-toolbar");
    let mode = toolbar.getAttribute("mode");

    // Get really big, so that we can figure out how big we actually want to be.
    mc.window.resizeTo(1200, 600);
    // spin the event loop once
    mc.sleep(0);

    let folderPaneWidth = mc.e("folderPaneBox").clientWidth;
    let fromWidth = mc.e("expandedfromRow").clientWidth;

    // This is the biggest we need to be.
    let bigWidth = folderPaneWidth + fromWidth + toolbar.clientWidth;

    // Now change to icons-only mode for a much smaller toolbar.
    toolbar.setAttribute("mode", "icons");
    let smallWidth = folderPaneWidth + fromWidth + toolbar.clientWidth;

    // Re-set the mode to its original value.
    toolbar.setAttribute("mode", mode);

    // And resize to half way between the big and small widths, so that we
    //  can toggle the mode to force the overflow.
    mc.window.resizeTo((bigWidth + smallWidth) / 2, 600);
    // spin the event loop once
    mc.sleep(0);

    // Make sure we are too small to contain the buttons and from line, so
    //  we will be tall.
    let tallHeight = expandedHeadersTopBox.clientHeight;

    // Change from icons and text to just icons to make our toolbar
    //  narrower, and by extension our header shorter.
    toolbar.setAttribute("mode", "icons");

    let shortHeight = expandedHeadersTopBox.clientHeight;
    if (shortHeight >= tallHeight)
      throw new Error("The header box should have been made smaller!");

    // Change back to icons and text to make our toolbar wider and our
    //   header taller again.
    toolbar.setAttribute("mode", mode);
    if (expandedHeadersTopBox.clientHeight != tallHeight)
      throw new Error("The header box should have returned to its original size!");

    // And make our window big to achieve the same effect as the just icons mode.
    mc.window.resizeTo(1200, 600);
    // spin the event loop once
    mc.sleep(0);
    if (expandedHeadersTopBox.clientHeight != shortHeight)
      throw new Error("The header box should have returned to its wide size!");
  }
  finally {
    // restore window to nominal dimensions; saving was not working out
    //  See also: quick-filter-bar/test-display-issues.js if we change the
    //            default window size.
    mc.window.resizeTo(1024, 768);
  }
}

/**
 *  Make sure that opening the header toolbar customization dialog
 *  does not break the get messages button in main toolbar
 */
function test_get_msg_button_customize_header_toolbar(){
  be_in_folder(folder);

  // select and open the first message
  let curMessage = select_click_row(0);

  // make sure it loads
  wait_for_message_display_completion(mc);
  assert_selected_and_displayed(mc, curMessage);

  // It is necessary to press the Get Message Button to get the popup menu populated
  mc.click(mc.aid("button-getmsg", {class: "toolbarbutton-menubutton-dropmarker"}));
  mc.ewait("button-getAllNewMsgSeparator");

  var getMailButtonPopup = mc.eid("button-getMsgPopup").node;
  var originalServerCount = getMailButtonPopup.childElementCount;

  // Open customization dialog, because it broke the Get Message Button popup menu
  // see https://bugzilla.mozilla.org/show_bug.cgi?id=565045
  mc.click(mc.eid("CustomizeHeaderToolbar"));
  let toolbox = mc.eid("header-view-toolbox").node;

  // Due to differences between OS X and Windows/Linux versions
  // the "done" button of the customization dialog cannot be
  // accessed directly
  toolbox.customizeDone();

  // Press the Get Message Button to populate popup menu again
  mc.click(mc.aid("button-getmsg", {class: "toolbarbutton-menubutton-dropmarker"}));
  mc.ewait("button-getAllNewMsgSeparator");

  getMailButtonPopup = mc.eid("button-getMsgPopup").node;
  var finalServerCount = getMailButtonPopup.childElementCount;

  if (originalServerCount != finalServerCount) {
    throw new Error("number of entries in Get Message Button popup menu after " +
                    "header toolbar customization " +
                    finalServerCount + " <> as before: " +
                    originalServerCount);
  }
}
