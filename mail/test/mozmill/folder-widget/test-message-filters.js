/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Test various properties of the message filters.
 */
var MODULE_NAME = "test-message-filters";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["folder-display-helpers", "window-helpers",
                       "nntp-helpers", "address-book-helpers",
                       "prompt-helpers"];

var elib = {};
Cu.import('resource://mozmill/modules/elementslib.js', elib);
var folderA;

function setupModule(module)
{
  for (let lib of MODULE_REQUIRES) {
    collector.getModule(lib).installInto(module);
  }

  setupNNTPDaemon();

  folderA = create_folder("FolderToolbarA");
  // we need one message to select and open
  make_new_sets_in_folder(folderA, [{count: 1}]);

  server = setupLocalServer(NNTP_PORT);

  // Note, the uri is for hostname "invalid" which is the original uri. See
  // setupProtocolTest parameters.
  var prefix = "news://invalid:"+NNTP_PORT+"/";

  // Test - group subscribe listing
  test = "news:*";

  if (mc.mozmillModule.isMac) {
    test_customize_toolbar_doesnt_double_get_mail_menu.__force_skip__ = true;
  }
}

/*
 * Test that the message filter list shows newsgroup servers.
 */
function test_message_filter_shows_newsgroup_server()
{
  be_in_folder(folderA);

  // Open the "Tools » Message Filters…" window,
  // a.k.a. "tasksMenu » filtersCmd".
  plan_for_new_window("mailnews:filterlist");
  mc.menus.Tools.filtersCmd.click();
  let filterc = wait_for_new_window("mailnews:filterlist");

  popup = filterc.eid("serverMenuPopup");
  filterc.assertNode(popup);
  filterc.click(popup);

  let nntp = new elib.Elem(popup.node.children.item(2));
  filterc.assertNode(nntp);
  // We need to get the newsgroups to pop up somehow.
  // These all fail.
  //filterc.click(nntp);
  //filterc.mouseover(nntp);
  //filterc.select(popup, popup.node.parentNode.getIndexOfItem(nntp.node));
  //filterc.select(nntp, popup.node.parentNode.getIndexOfItem(nntp.node));
  //filterc.select(popup, 2);
  //let nntpPopup = new elib.Elem(nntp.node.menupopup);
  //filterc.click(nntpPopup);
  //filterc.mouseover(nntpPopup);
  //filterc.select(nntpPopup, 2);

  // This one initializes the menuitems, but it's kinda hacky.
  nntp.node.menupopup._ensureInitialized();
  assert_equals(nntp.node.itemCount, 5,
                "Incorrect number of children for the NNTP server");
  close_window(filterc);
}

/*
 * Test that customizing the toolbar doesn't lead to doubled accounts in
 * the Get Mail menu.  (bug 520457)
 */
function test_customize_toolbar_doesnt_double_get_mail_menu()
{
  be_in_folder(folderA);

  /**
   * Get the getAllNewMessages menu and check the number of items.
   */
  function check_getAllNewMsgMenu() {
    mc.click(mc.eid("menu_File"), 5, 5);
    wait_for_popup_to_open(mc.e("menu_FilePopup"));

    let menu = mc.eid("menu_getAllNewMsg");
    mc.click(menu, 5, 5);
    wait_for_popup_to_open(mc.e("menu_getAllNewMsgPopup"));

    assert_equals(menu.node.itemCount, 5,
                  "Incorrect number of items for GetNewMessages before customization");

    close_popup(mc, mc.eid("menu_getAllNewMsgPopup"));
    close_popup(mc, mc.eid("menu_FilePopup"));
  }

  check_getAllNewMsgMenu();

  plan_for_new_window("mailnews:customizeToolbar");
  // Open the customization dialog.
  mc.rightClick(mc.eid("mail-bar3"));
  mc.click(mc.eid("CustomizeMailToolbar"));

  let customc = wait_for_new_window("mailnews:customizeToolbar");
  plan_for_window_close(customc);
  customc.click(customc.eid("donebutton"));
  wait_for_window_close();

  check_getAllNewMsgMenu();
}

/* A helper function that opens up the new filter dialog (assuming that the
 * main filters dialog is already open), creates a simple filter, and then
 * closes the dialog.
 */
function create_simple_filter() {
  // Open the "Tools » Message Filters…" window,
  // a.k.a. "tasksMenu » filtersCmd".
  mc.menus.Tools.filtersCmd.click();

  // We'll assume that the filters dialog is already open from
  // the previous tests.
  let filterc = wait_for_existing_window("mailnews:filterlist");

  function fill_in_filter_fields(fec) {
    let filterName = fec.e("filterName");
    filterName.value = "A Simple Filter";
    let searchAttr = fec.e("searchAttr0");
    let attrList = fec.window.document.getAnonymousNodes(searchAttr)[0];
    attrList.value = Components.interfaces.nsMsgSearchAttrib.To;
    let searchOp = fec.e("searchOp0");
    let opList = fec.window.document.getAnonymousNodes(searchOp)[0];
    opList.value = Components.interfaces.nsMsgSearchOp.Is;
    let searchValList = fec.e("searchVal0");
    let searchVal = fec.window.document.getAnonymousNodes(searchValList)[0];
    searchVal.setAttribute("value", "test@foo.invalid");

    let filterActions = fec.e("filterActionList");
    let firstAction = filterActions.getItemAtIndex(0);
    firstAction.setAttribute("value", "markasflagged");
    fec.e("FilterEditor").acceptDialog();
  }

  // Let's open the filter editor.
  plan_for_modal_dialog("mailnews:filtereditor", fill_in_filter_fields);
  filterc.click(filterc.eid("newButton"));
  wait_for_modal_dialog("mailnews:filtereditor");
}

/*
 * Test that the address books can appear in the message filter dropdown
 */
function test_address_books_appear_in_message_filter_dropdown()
{
  // Create a remote address book - we don't want this to appear in the
  // dropdown.
  let ldapAb = create_ldap_address_book("Some LDAP Address Book");

  // Sanity check - this LDAP book should be remote.
  assert_true(ldapAb.isRemote);

  // Open the "Tools » Message Filters…" window,
  // a.k.a. "tasksMenu » filtersCmd".
  mc.menus.Tools.filtersCmd.click();

  // We'll assume that the filters dialog is already open from
  // the previous tests.
  let filterc = wait_for_existing_window("mailnews:filterlist");

  // Prepare a function to deal with the filter editor once it
  // has opened
  function filterEditorOpened(fec) {
    let searchAttr = fec.e("searchAttr0");
    let attrList = fec.window.document.getAnonymousNodes(searchAttr)[0];
    attrList.value = Components.interfaces.nsMsgSearchAttrib.To;
    let searchOp = fec.e("searchOp0");
    let opList = fec.window.document.getAnonymousNodes(searchOp)[0];
    opList.value = Components.interfaces.nsMsgSearchOp.IsInAB;
    let searchValue = fec.e("searchVal0");

    // The magic number "4" is because the address book list is the
    // 4th child node of the searchvalue widget.
    let abList = fec.window.document.getAnonymousNodes(searchValue)[4];

    // We should have 2 address books here - one for the Personal Address
    // Book, and one for Collected Addresses.  The LDAP address book should
    // not be shown, since it isn't a local address book.
    assert_equals(2, abList.itemCount, "Did not display the correct number "
                  + "of address books in the filter menu list.");
  }

  // Let's open the filter editor.
  plan_for_modal_dialog("mailnews:filtereditor", filterEditorOpened);
  filterc.click(filterc.eid("newButton"));
  wait_for_modal_dialog("mailnews:filtereditor");
}

/* Test that if the user has started running a filter, and the
 * "quit-application-requested" notification is fired, the user
 * is given a dialog asking whether or not to quit.
 *
 * This also tests whether or not cancelling quit works.
 */
function test_can_cancel_quit_on_filter_changes() {
  // Register the Mock Prompt Service
  gMockPromptService.register();

  create_simple_filter();

  let filterc = wait_for_existing_window("mailnews:filterlist");
  let runButton = filterc.e("runFiltersButton");
  runButton.setAttribute("label",
                         runButton.getAttribute("stoplabel"));

  let cancelQuit = Cc["@mozilla.org/supports-PRBool;1"]
                 .createInstance(Components.interfaces.nsISupportsPRBool);

  // Set the Mock Prompt Service to return false, so that we
  // cancel the quit.
  gMockPromptService.returnValue = false;
  // Trigger the quit-application-request notification
  Services.obs.notifyObservers(cancelQuit, "quit-application-requested",
                               null);
  let promptState = gMockPromptService.promptState;
  assert_not_equals(null, promptState, "Expected a confirmEx prompt");

  assert_equals("confirmEx", promptState.method);
  // Since we returned false on the confirmation dialog,
  // we should be cancelling the quit - so cancelQuit.data
  // should now be true
  assert_true(cancelQuit.data, "Didn't cancel the quit");

  // Unregister the Mock Prompt Service
  gMockPromptService.unregister();
}

/* Test that if the user has started running a filter, and the
 * "quit-application-requested" notification is fired, the user
 * is given a dialog asking whether or not to quit.
 *
 * This also tests whether or not allowing quit works.
 */
function test_can_quit_on_filter_changes() {
  // Register the Mock Prompt Service
  gMockPromptService.register();

  let filterc = wait_for_existing_window("mailnews:filterlist");

  // There should already be 1 filter defined from previous test.
  let filterCount = filterc.e("filterList").itemCount;
  assert_equals(filterCount, 1);

  let runButton = filterc.e("runFiltersButton");
  runButton.setAttribute("label",
                         runButton.getAttribute("stoplabel"));

  let cancelQuit = Cc["@mozilla.org/supports-PRBool;1"]
                     .createInstance(Components.interfaces.nsISupportsPRBool);

  // Set the Mock Prompt Service to return true, so that we
  // allow the quit.
  gMockPromptService.returnValue = true;
  // Trigger the quit-application-request notification
  Services.obs.notifyObservers(cancelQuit, "quit-application-requested",
                               null);
  let promptState = gMockPromptService.promptState;
  assert_not_equals(null, promptState, "Expected a confirmEx prompt");

  assert_equals("confirmEx", promptState.method);
  // Since we returned true on the confirmation dialog,
  // we should be allowing the quit - so cancelQuit.data
  // should now be false
  assert_false(cancelQuit.data, "Cancelled the quit");

  // Unregister the Mock Prompt Service
  gMockPromptService.unregister();
}
