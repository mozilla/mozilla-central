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

var MODULE_NAME = 'test-attachment-size';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers'];

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
var detachedSize;

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);

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

  folder = create_folder('AttachmentSizeA');

  // set up our detached/deleted attachments
  let thisFilePath = os.getFileForPath(__file__);

  let detachedFile = os.getFileForPath(os.abspath(detachedName, thisFilePath));
  let detached = {
    body: 'Here is a file',
    attachments: [ createDeletedAttachment(detachedFile, 'text/plain', true)] };
  detachedSize = detachedFile.fileSize;

  let missingFile = os.getFileForPath(os.abspath(missingName, thisFilePath));
  let missing = {
    body: 'Here is a file (but you deleted the external file, you silly oaf!)',
    attachments: [ createDeletedAttachment(missingFile, 'text/plain', true)] };

  let deleted = {
    body: 'Here is a file that you deleted',
    attachments: [ createDeletedAttachment(deletedName, 'text/plain')] };

  // create some messages that have various types of attachments
  let messages = [
    // text attachment
    { attachments: [{ body: textAttachment,
                      filename: 'ubik.txt',
                      format: '' }]},
    // binary attachment
    { attachments: [{ body: binaryAttachment,
                      contentType: 'application/x-ubik',
                      filename: 'ubik',
                      format: '' }]},
    // (inline) image attachment
    { attachments: [{ body: imageAttachment,
                      contentType: 'image/png',
                      filename: 'lines.png',
                      encoding: 'base64',
                      format: '' }]},
    // detached attachment
    { bodyPart: createBodyPart(detached.body,
                               detached.attachments) },
    // detached attachment with missing file
    { bodyPart: createBodyPart(missing.body,
                               missing.attachments) },
    // deleted attachment
    { bodyPart: createBodyPart(deleted.body,
                               deleted.attachments) },
    ];

  for (let i=0; i<messages.length; i++) {
    add_message_to_folder(folder, create_message(messages[i]));
  }
}

/**
 * Create a body part with attachments for the message generator
 * @param body the text of the main body of the message
 * @param attachments an array of attachment objects (as strings)
 * @param boundary an optional string defining the boundary of the parts
 * @return an object suitable for passing as the |bodyPart| for create_message
 */
function createBodyPart(body, attachments, boundary)
{
  if (!boundary)
    boundary = '------------CHOPCHOP';

  return {
    contentTypeHeaderValue: 
      'multipart/mixed;\r\n boundary="' + boundary + '"',
    toMessageString: function() {
      let str = 'This is a multi-part message in MIME format.\r\n' +
                '--' + boundary + '\r\n' +
                'Content-Type: text/plain; charset=ISO-8859-1; format=flowed\r\n' +
                'Content-Transfer-Encoding: 7bit\r\n\r\n' + body + '\r\n\r\n';
      for (let i = 0; i < attachments.length; i++) {
        str += '--' + boundary + '\r\n' +
               attachments[i] + '\r\n';
      }
      str += '--' + boundary + '--';
      return str;
    }
  };
}

/**
 * Create the raw data for a deleted/detached attachment
 * @param file the filename (for deleted attachments) or an nsIFile (for
 *        detached attachments)
 * @param type the content type
 * @return a string representing the attachment
 */
function createDeletedAttachment(file, type) {
  let str = '';

  if (typeof file == 'string') {
    str += 'Content-Type: text/x-moz-deleted; name="Deleted: ' + file + '"\r\n' +
           'Content-Transfer-Encoding: 8bit\r\n' +
           'Content-Disposition: inline; filename="Deleted: ' + file + '"\r\n' +
           'X-Mozilla-Altered: AttachmentDeleted; date="Wed Oct 06 17:28:24 2010"\r\n\r\n';
  }
  else {
    let fileHandler = Components.classes["@mozilla.org/network/io-service;1"]
                                .getService(Components.interfaces.nsIIOService)
                                .getProtocolHandler("file")
                                .QueryInterface(Components.interfaces.nsIFileProtocolHandler);
    let url = fileHandler.getURLSpecFromFile(file);
    let filename = file.leafName;

    str += 'Content-Type: text/plain;\r\n name="' + filename + '"\r\n' +
           'Content-Disposition: attachment; filename="' + filename + '"\r\n' +
           'X-Mozilla-External-Attachment-URL: ' + url + '\r\n' +
           'X-Mozilla-Altered: AttachmentDetached; date="Wed Oct 06 17:28:24 2010"\r\n\r\n';
  }

  str += 'You deleted an attachment from this message. The original MIME headers for the attachment were:\r\n' +
         'Content-Type: ' + type + ';\r\n' +
         ' name="' + file + '"\r\n' +
         'Content-Transfer-Encoding: 7bit\r\n' +
         'Content-Disposition: attachment;\r\n' +
         ' filename="' + file + '"\r\n\r\n';

  return str;
}

/**
 * Make sure that the attachment's size is what we expect
 * @param expectedSize the expected size of the attachment, in bytes
 */
function check_attachment_size(expectedSize) {
  let node = mc.e('attachmentList', {tagName: 'descriptionitem'});

  // First, let's check that the 'attachmentSize' attribute is correct
  let size = parseInt(node.getAttribute('attachmentSize'));
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
 */
function check_no_attachment_size() {
  let node = mc.e('attachmentList', {tagName: 'descriptionitem'});

  if (node.getAttribute('attachmentSize') != '')
    throw new Error('attachmentSize attribute of deleted attachment should ' +
                    'be null!');

  if (/\((.*?)\)$/.exec(node.getAttribute('label')))
    throw new Error('Attachment size should not be displayed!');
}

function test_text_attachment() {
  be_in_folder(folder);
  let curMessage = select_click_row(0);

  check_attachment_size(textAttachment.length);
}

function test_binary_attachment() {
  be_in_folder(folder);
  let curMessage = select_click_row(1);

  check_attachment_size(binaryAttachment.length);
}

function test_image_attachment() {
  be_in_folder(folder);
  let curMessage = select_click_row(2);

  check_attachment_size(imageSize);
}

function test_detached_attachment() {
  be_in_folder(folder);
  let curMessage = select_click_row(3);

  check_attachment_size(detachedSize);
}

function test_detached_attachment_with_no_external_file() {
  be_in_folder(folder);
  let curMessage = select_click_row(4);

  check_no_attachment_size();
}

function test_deleted_attachment() {
  be_in_folder(folder);
  let curMessage = select_click_row(5);

  check_no_attachment_size();
}
