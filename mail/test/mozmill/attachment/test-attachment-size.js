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
 *   Jim Porter <squibblyflabbetydoo@gmail.com>
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

var MODULE_NAME = 'test-attachment-size';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers',
                       'attachment-helpers'];

var folder;
var messenger;
var epsilon;

var os = {};
Components.utils.import('resource://mozmill/stdlib/os.js', os);

const textAttachment =
  "Can't make the frug contest, Helen; stomach's upset. I'll fix you, " +
  "Ubik! Ubik drops you back in the thick of things fast. Taken as " +
  "directed, Ubik speeds relief to head and stomach. Remember: Ubik is " +
  "only seconds away. Avoid prolonged use.";

const binaryAttachment = textAttachment;

const imageAttachment =
  'iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAYAAABWdVznAAAABHNCSVQICAgIfAhkiAAAAAlwS' +
  'FlzAAAN1wAADdcBQiibeAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAA' +
  'A5SURBVCiRY/z//z8DKYCJJNXkaGBgYGD4D8NQ5zUgiTVAxeBqSLaBkVRPM0KtIhrQ3km0jwe' +
  'SNQAAlmAY+71EgFoAAAAASUVORK5CYII=';
const imageSize = 188;

const detachedName = './attachment.txt';
const missingName = './nonexistent.txt';
const deletedName = 'deleted.txt';

// create some messages that have various types of attachments
var messages = [
  { name: 'text_attachment',
    attachments: [{ body: textAttachment,
                    filename: 'ubik.txt',
                    format: '' }],
    attachmentSizes: [textAttachment.length],
    attachmentTotalSize: { size: textAttachment.length, exact: true },
  },
  { name: 'binary_attachment',
    attachments: [{ body: binaryAttachment,
                    contentType: 'application/x-ubik',
                    filename: 'ubik',
                    format: '' }],
    attachmentSizes: [binaryAttachment.length],
    attachmentTotalSize: { size: binaryAttachment.length, exact: true },
  },
  { name: 'image_attachment',
    attachments: [{ body: imageAttachment,
                    contentType: 'image/png',
                    filename: 'lines.png',
                    encoding: 'base64',
                    format: '' }],
    attachmentSizes: [imageSize],
    attachmentTotalSize: { size: imageSize, exact: true },
  },
  { name: 'detached_attachment',
    bodyPart: null,
    attachmentSizes: [null],
    attachmentTotalSize: { size: 0, exact: true },
  },
  { name: 'detached_attachment_with_missing_file',
    bodyPart: null,
    attachmentSizes: [null],
    attachmentTotalSize: { size: 0, exact: false },
  },
  { name: 'deleted_attachment',
    bodyPart: null,
    attachmentSizes: [null],
    attachmentTotalSize: { size: 0, exact: true },
  },
  { name: 'multiple_attachments',
    attachments: [{ body: textAttachment,
                    filename: 'ubik.txt',
                    format: '' },
                  { body: binaryAttachment,
                    contentType: 'application/x-ubik',
                    filename: 'ubik',
                    format: '' }],
    attachmentSizes: [textAttachment.length, binaryAttachment.length],
    attachmentTotalSize: { size: textAttachment.length +
                                 binaryAttachment.length,
                           exact: true },
  },
  { name: 'multiple_attachments_one_detached',
    bodyPart: null,
    attachments: [{ body: textAttachment,
                    filename: 'ubik.txt',
                    format: '' }],
    attachmentSizes: [null, textAttachment.length],
    attachmentTotalSize: { size: textAttachment.length, exact: true },
  },
  { name: 'multiple_attachments_one_detached_with_missing_file',
    bodyPart: null,
    attachments: [{ body: textAttachment,
                    filename: 'ubik.txt',
                    format: '' }],
    attachmentSizes: [null, textAttachment.length],
    attachmentTotalSize: { size: textAttachment.length, exact: false },
  },
  { name: 'multiple_attachments_one_deleted',
    bodyPart: null,
    attachments: [{ body: textAttachment,
                    filename: 'ubik.txt',
                    format: '' }],
    attachmentSizes: [null, textAttachment.length],
    attachmentTotalSize: { size: textAttachment.length, exact: true },
  },
];

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);
  let ah = collector.getModule('attachment-helpers');
  ah.installInto(module);

  messenger = Components.classes['@mozilla.org/messenger;1']
                        .createInstance(Components.interfaces.nsIMessenger);

  /* Today's gory details (thanks to Jonathan Protzenko): libmime somehow
   * counts the trailing newline for an attachment MIME part. Most of the time,
   * assuming attachment has N bytes (no matter what's inside, newlines or
   * not), libmime will return N + 1 bytes. On Linux and Mac, this always
   * holds. However, on Windows, if the attachment is not encoded (that is, is
   * inline text), libmime will return N + 2 bytes.
   */
  epsilon = ('@mozilla.org/windows-registry-key;1' in Components.classes) ? 2 : 1;

  // set up our detached/deleted attachments
  var thisFilePath = os.getFileForPath(__file__);

  var detachedFile = os.getFileForPath(os.abspath(detachedName, thisFilePath));
  var detached = create_body_part(
    'Here is a file',
    [create_detached_attachment(detachedFile, 'text/plain')]
  );

  var missingFile = os.getFileForPath(os.abspath(missingName, thisFilePath));
  var missing = create_body_part(
    'Here is a file (but you deleted the external file, you silly oaf!)',
    [create_detached_attachment(missingFile, 'text/plain')]
  );

  var deleted = create_body_part(
    'Here is a file that you deleted',
    [create_deleted_attachment(deletedName, 'text/plain')]
  );

  folder = create_folder('AttachmentSizeA');
  for (let i = 0; i < messages.length; i++) {
    // First, add any missing info to the message object.
    switch(messages[i].name) {
      case 'detached_attachment':
      case 'multiple_attachments_one_detached':
        messages[i].bodyPart = detached;
        messages[i].attachmentSizes[0] = detachedFile.fileSize;
        messages[i].attachmentTotalSize.size += detachedFile.fileSize;
        break;
      case 'detached_attachment_with_missing_file':
      case 'multiple_attachments_one_detached_with_missing_file':
        messages[i].bodyPart = missing;
        break;
      case 'deleted_attachment':
      case 'multiple_attachments_one_deleted':
        messages[i].bodyPart = deleted;
        break;
    }

    add_message_to_folder(folder, create_message(messages[i]));
  }
}

/**
 * Make sure that the attachment's size is what we expect
 * @param index the attachment's index, starting at 0
 * @param expectedSize the expected size of the attachment, in bytes
 */
function check_attachment_size(index, expectedSize) {
  let list = mc.e('attachmentList');
  let node = list.getElementsByTagName('attachmentitem')[index];

  // First, let's check that the attachment size is correct
  let size = node.attachment.size;
  if (Math.abs(size - expectedSize) > epsilon)
    throw new Error('Reported attachment size ('+size+') not within epsilon ' +
                    'of actual attachment size ('+expectedSize+')');

  // Next, make sure that the formatted size in the label is correct
  let formattedSize = node.getAttribute('size');
  let expectedFormattedSize = messenger.formatFileSize(size);
  if (formattedSize != expectedFormattedSize)
    throw new Error('Formatted attachment size ('+formattedSize+') does not ' +
                    'match expected value ('+expectedFormattedSize+')');
}

/**
 * Make sure that the attachment's size is not displayed
 * @param index the attachment's index, starting at 0
 */
function check_no_attachment_size(index) {
  let list = mc.e('attachmentList');
  let node = list.getElementsByTagName('attachmentitem')[index];

  if (node.attachment.size != null)
    throw new Error('attachmentSize attribute of deleted attachment should ' +
                    'be null!');

  if (node.getAttribute('size') != '')
    throw new Error('Attachment size should not be displayed!');
}

/**
 * Make sure that the total size of all attachments is what we expect.
 * @param count the expected number of attachments
 * @param expectedSize the expected size in bytes of all the attachments
 * @param exact true if the size of all attachments is known, false otherwise
 */
function check_total_attachment_size(count, expectedSize, exact) {
  let list = mc.e('attachmentList');
  let nodes = list.getElementsByTagName('attachmentitem');
  let sizeNode = mc.e('attachmentSize');

  if (nodes.length != count)
    throw new Error('Saw '+nodes.length+' attachments, but expected '+count);

  let size = 0;
  for (let i = 0; i < nodes.length; i++) {
    let currSize = nodes[i].attachment.size;
    if (!isNaN(currSize))
      size += currSize;
  }

  if (Math.abs(size - expectedSize) > epsilon*count)
    throw new Error('Reported attachment size ('+size+') not within epsilon ' +
                    'of actual attachment size ('+expectedSize+')');

  // Next, make sure that the formatted size in the label is correct
  let formattedSize = sizeNode.getAttribute('value');
  let expectedFormattedSize = messenger.formatFileSize(size);
  let messengerBundle = mc.window.document.getElementById('bundle_messenger');

  if (!exact) {
    if (size == 0)
      expectedFormattedSize = messengerBundle.getString(
        'attachmentSizeUnknown');
    else
      expectedFormattedSize = messengerBundle.getFormattedString(
        'attachmentSizeAtLeast', [expectedFormattedSize]);
  }
  if (formattedSize != expectedFormattedSize)
    throw new Error('Formatted attachment size ('+formattedSize+') does not ' +
                    'match expected value ('+expectedFormattedSize+')');
}

/**
 * Make sure that the individual and total attachment sizes for this message
 * are as expected
 * @param index the index of the message to check in the thread pane
 */
function help_test_attachment_size(index) {
  be_in_folder(folder);
  let curMessage = select_click_row(index);

  let expectedSizes = messages[index].attachmentSizes;
  for (let i = 0; i < expectedSizes.length; i++) {
    if(expectedSizes[i] == null) {
      unknownSize = true;
      check_no_attachment_size(i);
    }
    else
      check_attachment_size(i, expectedSizes[i]);
  }

  let totalSize = messages[index].attachmentTotalSize;
  check_total_attachment_size(expectedSizes.length, totalSize.size,
                              totalSize.exact);
}

// Generate a test for each message in |messages|.
for each (let [i, message] in Iterator(messages)) {
  let index = i; // make a copy to avoid passing a reference to i
  this["test_" + message.name] = function() {
    help_test_attachment_size(index);
  };
}
