/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging.
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

var Ci = Components.interfaces;
var Cc = Components.classes;
var Cu = Components.utils;

var MODULE_NAME = 'test-attachment';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'compose-helpers',
                       'window-helpers'];

var messenger;
var folder;
var epsilon;
var isWindows;

const rawAttachment =
  "Can't make the frug contest, Helen; stomach's upset. I'll fix you, " +
  "Ubik! Ubik drops you back in the thick of things fast. Taken as " +
  "directed, Ubik speeds relief to head and stomach. Remember: Ubik is " +
  "only seconds away. Avoid prolonged use.";

const b64Attachment =
  'iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAYAAABWdVznAAAABHNCSVQICAgIfAhkiAAAAAlwS' +
  'FlzAAAN1wAADdcBQiibeAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAA' +
  'A5SURBVCiRY/z//z8DKYCJJNXkaGBgYGD4D8NQ5zUgiTVAxeBqSLaBkVRPM0KtIhrQ3km0jwe' +
  'SNQAAlmAY+71EgFoAAAAASUVORK5CYII=';
const b64Size = 188;

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let ch = collector.getModule("compose-helpers");
  ch.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);

  folder = create_folder('ComposeAttachmentA');

  messenger = Components.classes['@mozilla.org/messenger;1']
                        .createInstance(Components.interfaces.nsIMessenger);

  isWindows = '@mozilla.org/windows-registry-key;1' in Components.classes;

  /* Today's gory details (thanks to Jonathan Protzenko): libmime somehow
   * counts the trailing newline for an attachment MIME part. Most of the time,
   * assuming attachment has N bytes (no matter what's inside, newlines or
   * not), libmime will return N + 1 bytes. On Linux and Mac, this always
   * holds. However, on Windows, if the attachment is not encoded (that is, is
   * inline text), libmime will return N + 2 bytes. Since we're dealing with
   * forwarded message data here, the bonus byte(s) appear twice.
   */
  epsilon = isWindows ? 4 : 2;

  // create some messages that have various types of attachments
  let messages = [
    // raw attachment
    { attachments: [{ body: rawAttachment,
                      filename: 'ubik.txt',
                      format: '' }]},
    // b64-encoded image attachment
    { attachments: [{ body: b64Attachment,
                      contentType: 'image/png',
                      filename: 'lines.png',
                      encoding: 'base64',
                      format: '' }]},
    ];

  for (let i=0; i<messages.length; i++) {
    add_message_to_folder(folder, create_message(messages[i]));
  }
}

/**
 * Make sure that the attachment's size is what we expect
 * @param controller the controller for the compose window
 * @param expectedSize the expected size of the attachment, in bytes
 */
function check_attachment_size(controller, expectedSize) {
  let node = controller.e('attachmentBucket', {tagName: 'listitem'});

  // First, let's check that the 'attachmentSize' attribute is correct
  let size = node.attachment.size;
  if (Math.abs(size - expectedSize) > epsilon)
    throw new Error('Reported attachment size ('+size+') not within epsilon ' +
                    'of actual attachment size ('+expectedSize+')');

  // Next, make sure that the formatted size in the label is correct
  let formattedSize = /\((.*?)\)$/.exec(node.getAttribute('label'))[1];
  let expectedFormattedSize = messenger.formatFileSize(size);
  if (formattedSize != expectedFormattedSize)
    throw new Error('Formatted attachment size ('+formattedSize+') does not ' +
                    'match expected value ('+expectedFormattedSize+')');
}

/**
 * Make sure that the attachment's size is not displayed
 * @param controller the controller for the compose window
 */
function check_no_attachment_size(controller) {
  let node = controller.e('attachmentBucket', {tagName: 'listitem'});

  if (node.attachment.size != -1)
    throw new Error('attachment.size attribute should be -1!');

  if (/\((.*?)\)$/.exec(node.getAttribute('label')))
    throw new Error('Attachment size should not be displayed!');
}

function test_file_attachment() {
  let cwc = open_compose_new_mail();
  let attachment = Cc["@mozilla.org/messengercompose/attachment;1"]
                     .createInstance(Ci.nsIMsgAttachment);

  if (isWindows)
    attachment.url = "file:///C:/some/file/here.txt";
  else
    attachment.url = "file:///some/file/here.txt";

  attachment.size = 1234;
  add_attachment(cwc, attachment);
  check_attachment_size(cwc, attachment.size);
}

function test_webpage_attachment() {
  let cwc = open_compose_new_mail();
  let attachment = Cc["@mozilla.org/messengercompose/attachment;1"]
                     .createInstance(Ci.nsIMsgAttachment);
  attachment.url = "http://www.mozillamessaging.com/";

  add_attachment(cwc, attachment);
  check_no_attachment_size(cwc, attachment);
}

function test_forward_raw_attachment() {
  be_in_folder(folder);
  let curMessage = select_click_row(0);

  let cwc = open_compose_with_forward();
  check_attachment_size(cwc, rawAttachment.length);
}

function test_forward_b64_attachment() {
  be_in_folder(folder);
  let curMessage = select_click_row(1);

  let cwc = open_compose_with_forward();
  check_attachment_size(cwc, b64Size);
}

// XXX: Test attached emails and files pulled from other emails (this probably
// requires better drag-and-drop support from Mozmill)
