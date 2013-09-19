/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Test functionality in the message header, e.g. tagging, contact editing,
 * the more button ...
 */

// make SOLO_TEST=message-header/test-message-header.js mozmill-one

var MODULE_NAME = 'test-message-header';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers',
                       'address-book-helpers', 'dom-helpers'];

var elib = {};
Cu.import('resource://mozmill/modules/elementslib.js', elib);
Cu.import("resource:///modules/mailServices.js");
Cu.import("resource://gre/modules/Services.jsm");

var folder, folderMore;
var gInterestingMessage;

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);
  let abh = collector.getModule('address-book-helpers');
  abh.installInto(module);
  let dh = collector.getModule('dom-helpers');
  dh.installInto(module);

  folder = create_folder("MessageWindowA");
  folderMore = create_folder("MesageHeaderMoreButton");

  // create a message that has the interesting headers that commonly
  // show up in the message header pane for testing
  gInterestingMessage = create_message({cc: msgGen.makeNamesAndAddresses(20), // YYY
    subject: "This is a really, really, really, really, really, really, really, really, long subject.",
    clobberHeaders: {
      "Newsgroups": "alt.test",
      "Reply-To": "J. Doe <j.doe@momo.invalid>",
      "Content-Base": "http://example.com/",
      "Bcc": "Richard Roe <richard.roe@momo.invalid>"
    }});

  add_message_to_folder(folder, gInterestingMessage);

  // create a message that has more to and cc addresses than visible in the
  // tooltip text of the more button
  let msgMore1 = create_message({to: msgGen.makeNamesAndAddresses(40),
                                 cc: msgGen.makeNamesAndAddresses(40)});
  add_message_to_folder(folderMore, msgMore1);

  // create a message that has more to and cc addresses than visible in the
  // header
  let msgMore2 = create_message({to: msgGen.makeNamesAndAddresses(20),
                                 cc: msgGen.makeNamesAndAddresses(20)});
  add_message_to_folder(folderMore, msgMore2);

  // create a message that has boring headers to be able to switch to and
  // back from, to force the more button to collapse again.
  let msg = create_message();
  add_message_to_folder(folder, msg);
}

/**
 * Helper function that takes an array of mail-emailaddress elements and
 * returns the last one in the list that is not hidden. Returns null if no
 * such element exists.
 *
 * @param aAddrs an array of mail-emailaddress elements.
 */
function get_last_visible_address(aAddrs) {
  for (let i = aAddrs.length - 1; i >= 0; --i)
    if (!aAddrs[i].hidden)
      return aAddrs[i];
  return null;
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
  curMessage = select_click_row(1);

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
 * Test that we can open up the inline contact editor when we
 * click on the star.
 */
function test_clicking_star_opens_inline_contact_editor()
{
  // Make sure we're in the right folder
  be_in_folder(folder);
  // Add a new message
  let msg = create_message();
  add_message_to_folder(folder, msg);
  // Open the latest message
  let curMessage = select_click_row(-1);
  wait_for_message_display_completion(mc);
  // Make sure the star is clicked, and we add the
  // new contact to our address book
  let toDescription = mc.a('expandedtoBox', {class: "headerValue"});

  // Ensure that the inline contact editing panel is not open
  let contactPanel = mc.eid('editContactPanel').getNode();
  assert_not_equals(contactPanel.state, "open");
  subtest_more_widget_star_click(toDescription);

  // Ok, if we're here, then the star has been clicked, and
  // the contact has been added to our AB.
  let addrs = toDescription.getElementsByTagName('mail-emailaddress');
  let lastAddr = get_last_visible_address(addrs);

  // Click on the star, and ensure that the inline contact
  // editing panel opens
  mc.click(mc.aid(lastAddr, {class: 'emailStar'}));
  mc.waitFor(function() contactPanel.state == "open",
             "Timeout waiting for contactPanel to open; state=" +
             contactPanel.state);
  contactPanel.hidePopup();
}

/**
 * Ensure that the specified element is visible/hidden
 *
 * @param id the id of the element to check
 * @param visible true if the element should be visible, false otherwise
 */
function assert_shown(id, visible) {
   if (mc.e(id).hidden == visible)
    throw new Error('"' + id + '" should be ' +
                    (visible ? "visible" : "hidden"));
}

/**
 * Test that clicking references context menu works properly.
 */
function test_msg_id_context_menu() {
  Services.prefs.setBoolPref("mailnews.headers.showReferences", true);

  // Add a new message
  let msg = create_message({
    clobberHeaders: {
      "References": "<4880C986@example.com> <4880CAB2@example.com> <4880CC76@example.com>"
    }});
  add_message_to_folder(folder, msg);
  be_in_folder(folder);

  // Open the latest message.
  let curMessage = select_click_row(-1);

  // Right click to show the context menu.
  mc.rightClick(mc.aid("expandedreferencesBox", {tagName: "mail-messageid"}));
  wait_for_popup_to_open(mc.e("messageIdContext"));

  // Ensure Open Message For ID is shown... and that Open Browser With Message-ID
  // isn't shown.
  assert_shown("messageIdContext-openMessageForMsgId", true);
  assert_shown("messageIdContext-openBrowserWithMsgId", false);

  close_popup(mc, mc.eid("messageIdContext"));

  Services.prefs.setBoolPref("mailnews.headers.showReferences", false);
}

/**
 * Test that if a contact belongs to a mailing list within their
 * address book, then the inline contact editor will not allow
 * the user to change what address book the contact belongs to.
 * The editor should also show a message to explain why the
 * contact cannot be moved.
 */
function test_address_book_switch_disabled_on_contact_in_mailing_list()
{
  const MAILING_LIST_DIRNAME = "Some Mailing List";
  const ADDRESS_BOOK_NAME = "Some Address Book";
  // Add a new message
  let msg = create_message();
  add_message_to_folder(folder, msg);

  // Make sure we're in the right folder
  be_in_folder(folder);

  // Open the latest message
  let curMessage = select_click_row(-1);

  // Make sure the star is clicked, and we add the
  // new contact to our address book
  let toDescription = mc.a('expandedtoBox', {class: "headerValue"});

  // Ensure that the inline contact editing panel is not open
  let contactPanel = mc.eid('editContactPanel').getNode();
  assert_not_equals(contactPanel.state, "open");

  subtest_more_widget_star_click(toDescription);

  // Ok, if we're here, then the star has been clicked, and
  // the contact has been added to our AB.
  let addrs = toDescription.getElementsByTagName('mail-emailaddress');
  let lastAddr = get_last_visible_address(addrs);

  // Click on the star, and ensure that the inline contact
  // editing panel opens
  mc.click(mc.aid(lastAddr, {class: 'emailStar'}));
  assert_equals(contactPanel.state, "open");

  let abDrop = mc.eid('editContactAddressBookList').getNode();
  let warningMsg = mc.eid('contactMoveDisabledText').getNode();

  // Ensure that the address book dropdown is not disabled
  assert_true(!abDrop.disabled);
  // We should not be displaying any warning
  assert_true(warningMsg.collapsed);

  // Now close the popup
  contactPanel.hidePopup();

  // For the contact that was added, create a mailing list in the
  // address book it resides in, and then add that contact to the
  // mailing list
  addrs = toDescription.getElementsByTagName('mail-emailaddress');
  let targetAddr = get_last_visible_address(addrs).getAttribute("emailAddress");

  let cards = get_cards_in_all_address_books_for_email(targetAddr);

  // There should be only one copy of this email address
  // in the address books.
  assert_equals(cards.length, 1);
  let card = cards[0];

  // Remove the card from any of the address books
  ensure_no_card_exists(targetAddr);

  // Add the card to a new address book, and insert it
  // into a mailing list under that address book
  let ab = create_mork_address_book(ADDRESS_BOOK_NAME);
  ab.dropCard(card, false);
  let ml = create_mailing_list(MAILING_LIST_DIRNAME);
  ab.addMailList(ml);

  // Now we have to retrieve the mailing list from
  // the address book, in order for us to add and
  // delete cards from it.
  ml = get_mailing_list_from_address_book(ab, MAILING_LIST_DIRNAME);

  ml.addressLists.appendElement(card, false);

  // Re-open the inline contact editing panel
  mc.click(mc.aid(lastAddr, {class: 'emailStar'}));
  assert_equals(contactPanel.state, "open");

  // The dropdown should be disabled now
  assert_true(abDrop.disabled);
  // We should be displaying a warning
  assert_true(!warningMsg.collapsed);

  contactPanel.hidePopup();

  // And if we remove the contact from the mailing list, the
  // warning should be gone and the address book switching
  // menu re-enabled.

  let cardArray = Cc["@mozilla.org/array;1"]
                  .createInstance(Ci.nsIMutableArray);
  cardArray.appendElement(card, false);
  ml.deleteCards(cardArray);

  // Re-open the inline contact editing panel
  mc.click(mc.aid(lastAddr, {class: 'emailStar'}));
  assert_equals(contactPanel.state, "open");

  // Ensure that the address book dropdown is not disabled
  assert_true(!abDrop.disabled);
  // We should not be displaying any warning
  assert_true(warningMsg.collapsed);

  contactPanel.hidePopup();
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
  close_popup(mc, mc.eid("emailAddressPopup"));

  // Now click the contact again, the context menu should now show the
  // Edit Contact menu instead.
  mc.click(mc.aid("expandedfromBox", {tagName: "mail-emailaddress"}));
  // (for reasons unknown, the pop-up does not close itself)
  close_popup(mc, mc.eid("emailAddressPopup"));

  addToAddressBookItem = mc.window.document.getElementById("addToAddressBookItem");
  if (!addToAddressBookItem.hidden)
    throw new Error("addToAddressBookItem is NOT hidden for known contact");
  editContactItem = mc.window.document.getElementById("editContactItem");
  if (editContactItem.hidden)
    throw new Error("editContactItem is hidden for known contact");
}

function test_that_msg_without_date_clears_previous_headers() {
  be_in_folder(folder);

  // create a message: with descritive subject
  let msg = create_message({subject: "this is without date" });

  // ensure that this message doesn't have a Date header
  delete msg.headers.Date;

  // this will add the message to the end of the folder
  add_message_to_folder(folder, msg);

  // Not the first anymore. The timestamp is that of "NOW".
  // select and open the LAST message
  let curMessage = select_click_row(-1);

  // make sure it loads
  wait_for_message_display_completion(mc);
  assert_selected_and_displayed(mc, curMessage);

  // Since we didn't give create_message an argument that would create a
  // Newsgroups header, the newsgroups <row> element should be collapsed.
  // However, since the previously displayed message _did_ have such a header,
  // certain bugs in the display of this header could cause the collapse
  // never to have happened.
  if (mc.e("expandednewsgroupsRow").collapsed != true) {
    throw new Error("Expected <row> element for Newsgroups header to be " +
                    "collapsed, but it wasn't\n!");
  }
}

/**
 * Test various aspects of the (n more) widgetry.
 */
function test_more_widget() {
  // generate message with 35 recips (effectively guarantees overflow for n=3)
  be_in_folder(folder);
  let msg = create_message({toCount: 35,
                            subject: "Many To addresses to test_more_widget" });

  // add the message to the end of the folder
  add_message_to_folder(folder, msg);

 // select and open the injected message;
 // It is at the second last message in the display list.
 let curMessage = select_click_row(-2);

  // make sure it loads
  wait_for_message_display_completion(mc);
  assert_selected_and_displayed(mc, curMessage);

  // get the description element containing the addresses
  let toDescription = mc.a('expandedtoBox', {class: "headerValue"});

  subtest_more_widget_display(toDescription);
  subtest_more_widget_click(toDescription);
  subtest_more_widget_star_click(toDescription);

  let showNLinesPref = Services.prefs.getIntPref("mailnews.headers.show_n_lines_before_more");
  Services.prefs.clearUserPref("mailnews.headers.show_n_lines_before_more");
  change_to_header_normal_mode();
  be_in_folder(folderMore);

  // first test a message with so many addresses that they don't fit in the
  // more widget's tooltip text
  let msg = select_click_row(0);
  wait_for_message_display_completion(mc);
  assert_selected_and_displayed(mc, msg);
  subtest_more_button_tooltip(msg);

  // then test a message with so many addresses that they do fit in the
  // more widget's tooltip text
  msg = select_click_row(1);
  wait_for_message_display_completion(mc);
  assert_selected_and_displayed(mc, msg);
  subtest_more_button_tooltip(msg);
  Services.prefs.setIntPref("mailnews.headers.show_n_lines_before_more", showNLinesPref);
}

/**
 * Test that all addresses are shown in show all header mode
 */
function test_show_all_header_mode() {
  // generate message with 35 recips (effectively guarantees overflow for n=3)
  be_in_folder(folder);
  let msg = create_message({toCount: 35,
			    subject: "many To addresses for test_show_all_header_mode" });

  // add the message to the end of the folder
  add_message_to_folder(folder, msg);

  // select and open the added message.
  // It is at the second last position in the display list.
  let curMessage = select_click_row(-2);

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
  let maxLines = Services.prefs.getIntPref(
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
  let lastAddr = get_last_visible_address(addrs);
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
  let maxLines = Services.prefs.setIntPref(
    "mailnews.headers.show_n_lines_before_more", 3);

  // call test_more_widget again
  // We need to look at the second last article in the display list.
  test_more_widget();
}

/**
 * Make sure the (more) widget hidden pref also works with an
 * "all" (0) non-default value.
 */
function test_more_widget_with_disabled_more(){

  // set maxLines to 0
  let maxLines = Services.prefs.setIntPref(
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
    mc.waitFor(function() expandedHeadersTopBox.clientHeight == shortHeight,
               "The header box should have returned to its wide size!")
  }
  finally {
    // restore window to nominal dimensions; saving was not working out
    //  See also: quick-filter-bar/test-display-issues.js if we change the
    //            default window size.
    mc.window.resizeTo(1024, 768);
  }
}

/**
 * Test if the tooltip text of the more widget contains the correct addresses
 * not shown in the header and the number of addresses also hidden in the
 * tooltip text.
 * @param aMsg the message for which the subtest should be performed
 */
function subtest_more_button_tooltip(aMsg) {
  // check for more indicator number of the more widget
  let addresses = {};
  let fullNames = {};
  let names = {};
  let numAddrsCC = MailServices.headerParser.parseHeadersWithArray(
    aMsg.ccList, addresses, names, fullNames);
  let numAddrsTo = MailServices.headerParser.parseHeadersWithArray(
    aMsg.recipients, addresses, names, fullNames);

  let shownToAddrNum = get_number_of_addresses_in_header("expandedtoBox");
  let shownCCAddrNum = get_number_of_addresses_in_header("expandedccBox");

  // first check the number of addresses in the more widget
  let hiddenCCAddrsNum = numAddrsCC - shownCCAddrNum;
  let hiddenToAddrsNum = numAddrsTo - shownToAddrNum;

  let moreNumberTo = get_number_of_more_button("expandedtoBox");
  assert_not_equals(NaN, moreNumberTo);
  assert_equals(hiddenToAddrsNum, moreNumberTo);

  let moreNumberCC = get_number_of_more_button("expandedccBox");
  assert_not_equals(NaN, moreNumberCC);
  assert_equals(hiddenCCAddrsNum, moreNumberCC);

  subtest_addresses_in_tooltip_text(aMsg.recipients, "expandedtoBox",
                                    shownToAddrNum, hiddenToAddrsNum);
  subtest_addresses_in_tooltip_text(aMsg.ccList, "expandedccBox",
                                    shownCCAddrNum, hiddenCCAddrsNum);
}

/**
 * Return the number of addresses visible in headerBox.
 * @param aHeaderBox the id of the header box element for which to look for
 *                   visible addresses
 * @return           the number of visible addresses in the header box
 */
function get_number_of_addresses_in_header(aHeaderBox) {
  let headerBoxElement = mc.a(aHeaderBox, {class: "headerValue"});
  let addrs = headerBoxElement.getElementsByTagName('mail-emailaddress');
  let addrNum = 0;
  for (let i = 0; i < addrs.length; i++) {
    // check that the address is really visible and not just a cached
    // element
    if (element_visible_recursive(addrs[i]))
      addrNum += 1;
  }
  return addrNum;
}

/**
 * Return the number shown in the more widget.
 * @param aHeaderBox the id of the header box element for which to look for
 *                   the number in the more widget
 * @return           the number shown in the more widget
 */
function get_number_of_more_button(aHeaderBox) {
  let moreNumber = 0;
  let headerBoxElement = mc.e(aHeaderBox);
  let moreIndicator = headerBoxElement.more;
  if (element_visible_recursive(moreIndicator)) {
    let moreText = moreIndicator.getAttribute("value");
    let moreSplit = moreText.split(" ");
    moreNumber = parseInt(moreSplit[0])
  }
  return moreNumber;
}

/**
 * Check if hidden addresses are part of more tooltip text.
 * @param aRecipients     an array containing the addresses to look for in the
 *                        header or the tooltip text
 * @param aHeaderBox      the id of the header box element for which to look
 *                        for hidden addresses
 * @param aShownAddrsNum  the number of addresses shown in the header
 * @param aHiddenAddrsNum the number of addresses not shown in the header
 */
function subtest_addresses_in_tooltip_text(aRecipients, aHeaderBox,
                                           aShownAddrsNum, aHiddenAddrsNum) {
  // check for more indicator number of the more widget
  let addresses = {};
  let fullNames = {};
  let names = {};
  let numAddresses = MailServices.headerParser.parseHeadersWithArray(
      aRecipients, addresses, names, fullNames);

  let headerBoxElement = mc.e(aHeaderBox);
  let moreIndicator = headerBoxElement.more;
  let tooltipText = moreIndicator.getAttribute("tooltiptext");
  let maxTooltipAddrsNum = headerBoxElement.maxAddressesInMoreTooltipValue;
  let addrsNumInTooltip = 0;

  for (let i = aShownAddrsNum; (i < numAddresses) &&
                               (i < maxTooltipAddrsNum + aShownAddrsNum); i++) {
    assert_true(tooltipText.contains(fullNames.value[i]), fullNames.value[i]);
    addrsNumInTooltip += 1;
  }

  if (aHiddenAddrsNum < maxTooltipAddrsNum) {
    assert_equals(aHiddenAddrsNum, addrsNumInTooltip);
  }
  else {
    assert_equals(maxTooltipAddrsNum, addrsNumInTooltip);
    // check if ", and X more" shows the correct number
    let moreTooltipSplit = tooltipText.split(", ");
    let words = mc.window.document
                         .getElementById("bundle_messenger")
                         .getString("headerMoreAddrsTooltip");
    let remainingAddresses = numAddresses - aShownAddrsNum - maxTooltipAddrsNum;
    let moreForm = mc.window.PluralForm.get(remainingAddresses, words)
                            .replace("#1", remainingAddresses);
    assert_equals(moreForm, ", " + moreTooltipSplit[moreTooltipSplit.length - 1]);
  }
}

// Some platforms (notably Mac) don't have a11y, so disable these tests there.
if ("nsIAccessibleRole" in Ci) {
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
    // XXX Don't use eval here.
    let headerValueElement = eval(aHeaderInfo.headerValueElement);

    let headerAccessible = gAccRetrieval.getAccessibleFor(headerValueElement)
    if (headerAccessible.role != aHeaderInfo.expectedRole) {
      throw new Error("role for " + aHeaderInfo.headerName + " was " +
                      headerAccessible.role + "; should have been " +
                      aHeaderInfo.expectedRole);
    }

    // XXX Don't use eval here.
    let expectedName = eval(aHeaderInfo.expectedName);
    if (headerAccessible.name != expectedName) {
      throw new Error("headerAccessible.name for " + aHeaderInfo.headerName +
                      " was '" + headerAccessible.name + "'; expected '" +
                      expectedName + "'");
    }
  }

  /**
   * Test the accessibility attributes of the various message headers.
   *
   * XXX This test used to be after test_more_button_with_many_recipients,
   * however, there were some accessibility changes that it didn't seem to play
   * nicely with, and the toggling of the "more" button on the cc field was
   * causing this test to fail on the cc element. Tests with accessibilty
   * hardware/software showed that the code was working fine. Therefore the test
   * may be suspect.
   */
  function test_a11y_attrs() {
    be_in_folder(folder);

    // select and open the interesting message

    let curMessage = select_click_row(mc.dbView.findIndexOfMsgHdr(
                                        gInterestingMessage, false));

    // make sure it loads
    assert_selected_and_displayed(mc, curMessage);

    headersToTest.forEach(verify_header_a11y);
  }
} // if ("nsIAccessibleRole" in Ci)
