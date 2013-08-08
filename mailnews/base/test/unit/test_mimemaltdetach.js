/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Tests nsIMessenger's detachAttachmentsWOPrompts of Mime multi-part
 * alternative messages.
 */

load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");

// javascript mime emitter functions
var mimeMsg = {};
Components.utils.import("resource:///modules/gloda/mimemsg.js", mimeMsg);
Components.utils.import("resource:///modules/mailServices.js");

var tests = [
  startCopy,
  startMime,
  startDetach,
  testDetach,
]

function startCopy()
{
  // Get a message into the local filestore.
  let mailFile = do_get_file("../../../data/multipartmalt-detach");
  MailServices.copy.CopyFileMessage(mailFile, localAccountUtils.inboxFolder, null,
                                    false, 0, "", asyncCopyListener, null);
  yield false;
}

// process the message through mime
function startMime()
{
  let msgHdr = mailTestUtils.firstMsgHdr(localAccountUtils.inboxFolder);

  mimeMsg.MsgHdrToMimeMessage(msgHdr, gCallbackObject, gCallbackObject.callback,
                              true /* allowDownload */);
  yield false;
}

// detach any found attachments
function startDetach()
{
  let msgHdr = mailTestUtils.firstMsgHdr(localAccountUtils.inboxFolder);
  let msgURI = msgHdr.folder.generateMessageURI(msgHdr.messageKey);

  let messenger = Cc["@mozilla.org/messenger;1"].createInstance(Ci.nsIMessenger);
  let attachment = gCallbackObject.attachments[0];

  messenger.detachAttachmentsWOPrompts(do_get_profile(), 1,
                                       [attachment.contentType], [attachment.url],
                                       [attachment.name], [msgURI], asyncUrlListener);
  yield false;
}

// test that the detachment was successful
function testDetach()
{
  // This test seems to fail on Linux without the following delay.
  do_timeout(200, async_driver);
  yield false;
  // The message contained a file "head_update.txt" which should
  //  now exist in the profile directory.
  let checkFile = do_get_profile().clone();
  checkFile.append("head_update.txt");
  do_check_true(checkFile.exists());
  do_check_true(checkFile.fileSize > 0);

  // The message should now have a detached attachment. Read the message,
  //  and search for "AttachmentDetached" which is added on detachment.

  // Get the message header
  let msgHdr = mailTestUtils.firstMsgHdr(localAccountUtils.inboxFolder);

  let messageContent = getContentFromMessage(msgHdr);
  do_check_true(messageContent.contains("AttachmentDetached"));
  // Make sure the body survived the detach.
  do_check_true(messageContent.contains("body hello"));
}

function SaveAttachmentCallback() {
  this.attachments = null;
}

SaveAttachmentCallback.prototype = {
  callback: function saveAttachmentCallback_callback(aMsgHdr, aMimeMessage) {
    this.attachments = aMimeMessage.allAttachments;
    async_driver();
  }
}
let gCallbackObject = new SaveAttachmentCallback();

function run_test()
{
  if (!localAccountUtils.inboxFolder)
    localAccountUtils.loadLocalMailAccount();
  async_run_tests(tests);
}

/*
 * Get the full message content.
 *
 * aMsgHdr: nsIMsgDBHdr object whose text body will be read
 *          returns: string with full message contents
 */
function getContentFromMessage(aMsgHdr) {
  const MAX_MESSAGE_LENGTH = 65536;
  let msgFolder = aMsgHdr.folder;
  let msgUri = msgFolder.getUriForMsg(aMsgHdr);

  let messenger = Cc["@mozilla.org/messenger;1"]
                    .createInstance(Ci.nsIMessenger);
  let streamListener = Cc["@mozilla.org/network/sync-stream-listener;1"]
                         .createInstance(Ci.nsISyncStreamListener);
  messenger.messageServiceFromURI(msgUri).streamMessage(msgUri,
                                                        streamListener,
                                                        null,
                                                        null,
                                                        false,
                                                        "",
                                                        false);
  let sis = Cc["@mozilla.org/scriptableinputstream;1"]
              .createInstance(Ci.nsIScriptableInputStream);
  sis.init(streamListener.inputStream);
  return sis.read(MAX_MESSAGE_LENGTH);
}
