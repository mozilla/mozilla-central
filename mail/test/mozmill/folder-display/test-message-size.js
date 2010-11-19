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
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jim Porter <jvporter@wisc.edu>
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
 * Test that the size column of in the message list is formatted properly (e.g.
   0.1 KB, 1.2 KB, 12.3 KB, 123 KB, and likewise for MB and GB).
 */
var MODULE_NAME = 'test-message-size';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers'];

var folder;

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);

  folder = create_folder("MessageSizeA");

  // Create messages with sizes in the byte, KB, and MB ranges.
  bytemsg = create_message({body: {body: " "}});

  kbstring = new Array(1024/2+1).join("x ");
  kbmsg = create_message({body: {body: kbstring}});

  mbstring = new Array(1024+1).join(kbstring);
  mbmsg = create_message({body: {body: mbstring}});

  add_message_to_folder(folder, bytemsg);
  add_message_to_folder(folder, kbmsg);
  add_message_to_folder(folder, mbmsg);
}

function _help_test_message_size(index, unit) {
  be_in_folder(folder);

  // Select the nth message
  let curMessage = select_click_row(index);
  // Look at the size column's data
  let tree = mc.folderDisplay.tree;
  let sizeCol = tree.columns[11];
  let sizeStr = tree.view.getCellText(index, sizeCol);

  // Note: this assumes that the numeric part of the size string is first
  let realSize = curMessage.messageSize;
  let abbrSize = parseFloat(sizeStr);

  if (isNaN(abbrSize))
    throw new Error("formatted size is not numeric: '"+sizeStr+"'");
  if (Math.abs(realSize/Math.pow(1024, unit) - abbrSize) > 0.5)
    throw new Error("size mismatch: '"+realSize+"' and '"+sizeStr+"'");
}

function test_byte_message_size() {
  _help_test_message_size(0, 1);
}

function test_kb_message_size() {
  _help_test_message_size(1, 1);
}

function test_mb_message_size() {
  _help_test_message_size(2, 2);
}
