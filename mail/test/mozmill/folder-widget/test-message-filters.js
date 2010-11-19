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
 * Test various properties of the message filters.
 */
var MODULE_NAME = "test-message-filters";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["folder-display-helpers", "window-helpers",
                       "test-nntp-helpers"];

var elib = {};
Cu.import('resource://mozmill/modules/elementslib.js', elib);
var folderA;

function setupModule(module)
{
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);
  let wh = collector.getModule("window-helpers");
  wh.installInto(module);
  let nh = collector.getModule("test-nntp-helpers");
  nh.installInto(module);

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
}

function assert_equals(a, b, comment)
{
  if (!comment)
    comment = "a != b";
  if (a != b)
    throw new Error(comment + ": '"+ a + "' != '" + b + "'.");
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
}

/*
 * Test that customizing the toolbar doesn't lead to doubled accounts in
 * the Get Mail menu.  (bug 520457)
 */
function test_customize_toolbar_doesnt_double_get_mail_menu()
{
  be_in_folder(folderA);

  popup = mc.eid("menu_getAllNewMsgPopup");
  mc.assertNode(popup);
  let menu = new elib.Elem(popup.node.parentNode);
  // This one initializes the menuitems, but it's kinda hacky.
  popup.node._ensureInitialized();
  assert_equals(menu.node.itemCount, 5,
                "Incorrect number of items for GetNewMessages before customization");

  // Open the customization dialog.
  mc.rightClick(mc.eid("mail-bar3"));
  mc.click(mc.eid("CustomizeMailToolbar"));

  let toolbox = mc.eid("mail-toolbox");
  toolbox.node.customizeDone();
  assert_equals(menu.node.itemCount, 5,
                "Incorrect number of items for GetNewMessages after customization");
}
