/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 *  Test for the most suitable identity in From address for reply-to-list
 */

var MODULE_NAME = "test-reply-to-list-from-address-selection";

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers',
                       'window-helpers', 'compose-helpers'];

var folderHelper = null;
var windowindowHelperelper = null;
var composeHelper = null;

var testFolder = null;
var msgHdr = null;
var replyToListWindow = null;

var identityString1 = "tinderbox_correct_identity@foo.invalid";

var setupModule = function (module) {

  folderHelper = collector.getModule('folder-display-helpers');
  folderHelper.installInto(module);
  windowHelper = collector.getModule('window-helpers');
  windowHelper.installInto(module);
  composeHelper = collector.getModule('compose-helpers');
  composeHelper.installInto(module);

  addIdentitiesAndFolder();
  addMessageToFolder(testFolder);
}

var addMessageToFolder = function (aFolder) {
  var msgId = Cc["@mozilla.org/uuid-generator;1"]
                .getService(Ci.nsIUUIDGenerator)
                .generateUUID() + "@mozillamessaging.invalid";

  var source = "From - Sat Nov  1 12:39:54 2008\n" +
                "X-Mozilla-Status: 0001\n" +
                "X-Mozilla-Status2: 00000000\n" +
                "Delivered-To: <tinderbox_identity333@foo.invalid>\n" +
                "Delivered-To: <" + identityString1 + ">\n" +
                "Delivered-To: <tinderbox_identity555@foo.invalid>\n" +
                "Message-ID: <" + msgId + ">\n" +
                "Date: Wed, 11 Jun 2008 20:32:02 -0400\n" +
                "From: Tester <tests@mozillamessaging.invalid>\n" +
                "User-Agent: Thunderbird 3.0a2pre (Macintosh/2008052122)\n" +
                "MIME-Version: 1.0\n" +
                "List-ID: <list.mozillamessaging.invalid>\n" +
                "List-Post: <list.mozillamessaging.invalid>, \n" +
                "    <mailto: list@mozillamessaging.invalid>\n" +
                "To: recipient@mozillamessaging.invalid\n" +
                "Subject: " + "a subject" + "\n" +
                "Content-Type: text/html; charset=ISO-8859-1\n" +
                "Content-Transfer-Encoding: 7bit\n" +
                 "\n" + "text body" + "\n";

  aFolder.QueryInterface(Ci.nsIMsgLocalMailFolder);
  aFolder.gettingNewMessages = true;
  aFolder.addMessage(source);
  aFolder.gettingNewMessages = false;

  return aFolder.msgDatabase.getMsgHdrForMessageID(msgId);
}

var addIdentitiesAndFolder = function() {
  let identity2 = MailServices.accounts.createIdentity();
  //identity.fullName = "Tinderbox_Identity1";
  identity2.email="tinderbox_identity1@foo.invalid";

  let identity = MailServices.accounts.createIdentity();
  //identity.fullName = "Tinderbox_Identity1";
  identity.email = identityString1;

  let server = MailServices.accounts.createIncomingServer("nobody",
                                                          "Test Local Folders", "pop3");
  let localRoot = server.rootFolder.QueryInterface(Ci.nsIMsgLocalMailFolder);
  testFolder = localRoot.createLocalSubfolder("Test Folder");

  let account = MailServices.accounts.createAccount();
  account.incomingServer = server;
  account.addIdentity(identity);
  account.addIdentity(identity2);
}

function test_Reply_To_List_From_Address() {
  be_in_folder(testFolder);

  let curMessage = select_click_row(0);
  assert_selected_and_displayed(mc, curMessage);

  replyToListWindow = composeHelper.open_compose_with_reply_to_list();

  var identityList = replyToListWindow.e("msgIdentity");

  // see if it's the correct identity selected
  if (!identityList.selectedItem.label.contains(identityString1))
    throw new Error("The From address is not correctly selected! Expected: "+
                    identityString1 + "; Actual: "  +
                    identityList.selectedItem.label);
}

