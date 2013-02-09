/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests attachment handling functionality of the message compose window.
 */

var Ci = Components.interfaces;
var Cc = Components.classes;
var Cu = Components.utils;

var elib = {};
Cu.import('resource://mozmill/modules/elementslib.js', elib);

var MODULE_NAME = 'test-attachment';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'compose-helpers',
                       'window-helpers'];

var messenger;
var folder;
var epsilon;
var isWindows;
var filePrefix;

var os = {};
Components.utils.import('resource://mozmill/stdlib/os.js', os);

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
  filePrefix = isWindows ? 'file:///C:/' : 'file:///';

  // create some messages that have various types of attachments
  let messages = [
    // no attachment
    {},
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
 * @param index the attachment to examine, as an index into the listbox
 * @param expectedSize the expected size of the attachment, in bytes
 */
function check_attachment_size(controller, index, expectedSize) {
  let bucket = controller.e('attachmentBucket');
  let node = bucket.getElementsByTagName('attachmentitem')[index];

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
 * @param controller the controller for the compose window
 * @param index the attachment to examine, as an index into the listbox
 */
function check_no_attachment_size(controller, index) {
  let bucket = controller.e('attachmentBucket');
  let node = bucket.getElementsByTagName('attachmentitem')[index];

  if (node.attachment.size != -1)
    throw new Error('attachment.size attribute should be -1!');

  // If there's no size, the size attribute is the zero-width space.
  if (node.getAttribute('size') != '\u200b')
    throw new Error('Attachment size should not be displayed!');
}

/**
 * Make sure that the total size of all attachments is what we expect.
 * @param controller the controller for the compose window
 * @param count the expected number of attachments
 */
function check_total_attachment_size(controller, count) {
  let bucket = controller.e("attachmentBucket");
  let nodes = bucket.getElementsByTagName("attachmentitem");
  let sizeNode = controller.e("attachmentBucketSize");

  if (nodes.length != count)
    throw new Error("Saw "+nodes.length+" attachments, but expected "+count);

  let size = 0;
  for (let i = 0; i < nodes.length; i++) {
    let currSize = nodes[i].attachment.size;
    if (currSize != -1)
      size += currSize;
  }

  // Next, make sure that the formatted size in the label is correct
  let formattedSize = sizeNode.getAttribute("value");
  let expectedFormattedSize = messenger.formatFileSize(size);
  if (formattedSize != expectedFormattedSize)
    throw new Error("Formatted attachment size ("+formattedSize+") does not " +
                    "match expected value ("+expectedFormattedSize+")");
}

function test_file_attachment() {
  let cwc = open_compose_new_mail();

  let url = filePrefix + "some/file/here.txt";
  let size = 1234;

  add_attachment(cwc, url, size);
  check_attachment_size(cwc, 0, size);
  check_total_attachment_size(cwc, 1);

  close_compose_window(cwc);
}

function test_webpage_attachment() {
  let cwc = open_compose_new_mail();

  add_attachment(cwc, "http://www.mozilla.org/");
  check_no_attachment_size(cwc, 0);
  check_total_attachment_size(cwc, 1);

  close_compose_window(cwc);
}

function test_multiple_attachments() {
  let cwc = open_compose_new_mail();

  let files = [{name: "foo.txt", size: 1234},
               {name: "bar.txt", size: 5678},
               {name: "baz.txt", size: 9012}];
  for (let i = 0; i < files.length; i++) {
    add_attachment(cwc, filePrefix+files[i].name, files[i].size);
    check_attachment_size(cwc, i, files[i].size);
  }

  check_total_attachment_size(cwc, files.length);
  close_compose_window(cwc);
}

function test_delete_attachments() {
  let cwc = open_compose_new_mail();

  let files = [{name: "foo.txt", size: 1234},
               {name: "bar.txt", size: 5678},
               {name: "baz.txt", size: 9012}];
  for (let i = 0; i < files.length; i++) {
    add_attachment(cwc, filePrefix+files[i].name, files[i].size);
    check_attachment_size(cwc, i, files[i].size);
  }

  delete_attachment(cwc, 0);
  check_total_attachment_size(cwc, files.length-1);

  close_compose_window(cwc);
}

function subtest_rename_attachment(cwc) {
  cwc.e("loginTextbox").value = "renamed.txt";
  cwc.window.document.documentElement.getButton('accept').doCommand();
}

function test_rename_attachment() {
  let cwc = open_compose_new_mail();

  let url = filePrefix + "some/file/here.txt";
  let size = 1234;

  add_attachment(cwc, url, size);

  // Now, rename the attachment.
  let bucket = cwc.e("attachmentBucket");
  let node = bucket.querySelector("attachmentitem");
  cwc.click(new elib.Elem(node));
  plan_for_modal_dialog("commonDialog", subtest_rename_attachment);
  cwc.window.RenameSelectedAttachment();
  wait_for_modal_dialog("commonDialog");

  assert_equals(node.getAttribute("name"), "renamed.txt");

  check_attachment_size(cwc, 0, size);
  check_total_attachment_size(cwc, 1);

  close_compose_window(cwc);
}

function subtest_open_attachment(cwc) {
  cwc.window.document.documentElement.getButton("cancel").doCommand();
}

function test_open_attachment() {
  let cwc = open_compose_new_mail();

  // set up our external file for attaching
  let thisFilePath = os.getFileForPath(__file__);
  let file = os.getFileForPath(os.abspath("./attachment.txt", thisFilePath));
  let fileHandler = Services.io.getProtocolHandler("file")
                            .QueryInterface(Ci.nsIFileProtocolHandler);
  let url = fileHandler.getURLSpecFromFile(file);
  let size = file.fileSize;

  add_attachment(cwc, url, size);

  // Now, open the attachment.
  let bucket = cwc.e("attachmentBucket");
  let node = bucket.querySelector("attachmentitem");
  plan_for_modal_dialog("unknownContentType", subtest_open_attachment);
  cwc.doubleClick(new elib.Elem(node));
  wait_for_modal_dialog("unknownContentType");

  close_compose_window(cwc);
}

function test_forward_raw_attachment() {
  be_in_folder(folder);
  let curMessage = select_click_row(1);

  let cwc = open_compose_with_forward();
  check_attachment_size(cwc, 0, rawAttachment.length);
  check_total_attachment_size(cwc, 1);

  close_compose_window(cwc);
}

function test_forward_b64_attachment() {
  be_in_folder(folder);
  let curMessage = select_click_row(2);

  let cwc = open_compose_with_forward();
  check_attachment_size(cwc, 0, b64Size);
  check_total_attachment_size(cwc, 1);

  close_compose_window(cwc);
}

function test_forward_message_as_attachment() {
  be_in_folder(folder);
  let curMessage = select_click_row(0);

  let cwc = open_compose_with_forward_as_attachments();
  check_attachment_size(cwc, 0, curMessage.messageSize);
  check_total_attachment_size(cwc, 1);

  close_compose_window(cwc);
}

function test_forward_message_with_attachments_as_attachment() {
  be_in_folder(folder);
  let curMessage = select_click_row(1);

  let cwc = open_compose_with_forward_as_attachments();
  check_attachment_size(cwc, 0, curMessage.messageSize);
  check_total_attachment_size(cwc, 1);

  close_compose_window(cwc);
}

// XXX: Test attached emails dragged onto composer and files pulled from other
// emails (this probably requires better drag-and-drop support from Mozmill)

