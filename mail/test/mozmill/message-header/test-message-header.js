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
var msg1;

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);

  folder = create_folder("MessageWindowA");
  // create a message to display in the folder
  msg1 = create_thread(1);
  add_sets_to_folders([folder], [msg1]);
  baseFolder = create_folder("MailViewA");
  folder.msgDatabase.dBFolderInfo.viewFlags = Ci.nsMsgViewFlagsType.kThreadedDisplay;
}

/** The message window controller. */
var msgc;

function test_add_tag_with_really_long_label() {
  be_in_folder(folder);

  // select the first message
  let curMessage = select_click_row(0);

  // display it
  msgc = open_selected_message_in_new_window();
  assert_selected_and_displayed(msgc, curMessage);

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
  msgc.keypress(mc.eid("expandedHeadersNameColumn"), "1", {});

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

}
