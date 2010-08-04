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
 * The Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Kefu (Fisher) Zhao <kza3@sfu.ca>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in windowHelperich case the provisions of the GPL or the LGPL are applicable instead
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

var identityString1 = "tinderbox_correct_identity@invalid.com";

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
                "Delivered-To: <tinderbox_identity333@invalid.com>\n" +
                "Delivered-To: <" + identityString1 + ">\n" +
                "Delivered-To: <tinderbox_identity555@invalid.com>\n" +
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
  var acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                .getService(Ci.nsIMsgAccountManager);

  var identity2 = acctMgr.createIdentity();
  //identity.fullName = "Tinderbox_Identity1";
  identity2.email="tinderbox_identity1@invalid.com";

  var identity = acctMgr.createIdentity();
  //identity.fullName = "Tinderbox_Identity1";
  identity.email = identityString1;

  var server = acctMgr.createIncomingServer("nobody",
                                            "Test Local Folders", "pop3");
  testFolder = server.rootFolder.addSubfolder("Test Folder");

  var account = acctMgr.createAccount();
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
  if (identityList.selectedItem.label.indexOf(identityString1) == -1)
    throw new Error("The From address is not correctly selected! Expected: "+
                    identityString1 + "; Actual: "  +
                    identityList.selectedItem.label);
}

