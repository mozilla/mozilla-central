/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests Filelink attachment item behaviour.
 */

let MODULE_NAME = 'test-cloudfile-attachment-item';

let RELATIVE_ROOT = '../shared-modules';
let MODULE_REQUIRES = ['folder-display-helpers',
                       'compose-helpers',
                       'cloudfile-helpers',
                       'attachment-helpers']

let elib = {};
Cu.import('resource://mozmill/modules/elementslib.js', elib);

const kAttachmentItemContextID = "msgComposeAttachmentItemContext";

var ah, cfh;

function setupModule(module) {
  collector.getModule('folder-display-helpers').installInto(module);
  collector.getModule('compose-helpers').installInto(module);

  ah = collector.getModule('attachment-helpers');
  ah.installInto(module);
  ah.gMockFilePickReg.register();

  cfh = collector.getModule('cloudfile-helpers');
  cfh.installInto(module);
  cfh.gMockCloudfileManager.register();
}

function teardownModule(module) {
  cfh.gMockCloudfileManager.unregister();
  ah.gMockFilePickReg.unregister();
}

/**
 * Test that when an upload has been started, we can cancel and restart
 * the upload, and then cancel again.  For this test, we repeat this
 * 3 times.
 */
function test_upload_cancel_repeat() {
  const kFile = "./data/testFile1";

  // Prepare the mock file picker to return our test file.
  let file = cfh.getFile(kFile, __file__);
  gMockFilePicker.returnFiles = [file];

  let provider = new MockCloudfileAccount();
  provider.init("someKey");
  let cw = open_compose_new_mail();

  // We've got a compose window open, and our mock Filelink provider
  // ready.  Let's attach a file...
  cw.window.AttachFile();

  // Now we override the uploadFile function of the MockCloudfileAccount
  // so that we're perpetually uploading...
  let listener;
  let started;
  provider.uploadFile = function(aFile, aListener) {
    listener = aListener;
    listener.onStartRequest(null, null);
    started = true;
  };

  const kAttempts = 3;
  let cmd = cw.e("cmd_cancelUpload");
  let menu = cw.getMenu("#" + kAttachmentItemContextID);

  for (let i = 0; i < kAttempts; i++) {
    listener = null;
    started = false;

    // Select the attachment, and choose to convert it to a Filelink
    let attachmentitem = select_attachments(cw, 0)[0];
    cw.window.convertSelectedToCloudAttachment(provider);
    cw.waitFor(function() started);

    assert_can_cancel_upload(cw, provider, listener, file);
  }
}

/**
 * Test that we can cancel a whole series of files being uploaded at once.
 */
function test_upload_multiple_and_cancel() {
  const kFiles = ["./data/testFile1",
                  "./data/testFile2",
                  "./data/testFile3"];

  // Prepare the mock file picker to return our test file.
  let files = cfh.collectFiles(kFiles, __file__);
  gMockFilePicker.returnFiles = files;

  let provider = new MockCloudfileAccount();
  provider.init("someKey");
  let cw = open_compose_new_mail();

  let listener;
  provider.uploadFile = function(aFile, aListener) {
    listener = aListener;
    listener.onStartRequest(null, null);
  };

  cw.window.attachToCloud(provider);

  for (let i = files.length - 1; i >= 0; --i)
    assert_can_cancel_upload(cw, provider, listener, files[i]);
}

/**
 * Helper function that takes an upload in progress, and cancels it,
 * ensuring that the nsIMsgCloduFileProvider.uploadCanceled status message
 * is returned to the passed in listener.
 *
 * @param aController the compose window controller to use.
 * @param aProvider a MockCloudfileAccount for which the uploads have already
 *                  started.
 * @param aListener the nsIRequestObserver passed to aProvider's uploadFile
 *                  function.
 * @param aTargetFile the nsILocalFile to cancel the upload for.
 */
function assert_can_cancel_upload(aController, aProvider, aListener,
                                  aTargetFile) {
  let cancelled = false;

  // Override the provider's cancelFileUpload function.  We can do this because
  // it's assumed that the provider is a MockCloudfileAccount.
  aProvider.cancelFileUpload = function(aFileToCancel) {
    if (aTargetFile.equals(aFileToCancel)) {
      aListener.onStopRequest(null, null,
                              Ci.nsIMsgCloudFileProvider
                                .uploadCanceled);
      cancelled = true;
    }
  };

  // Retrieve the attachment bucket index for the target file...
  let index = get_attachmentitem_index_for_file(aController,
                                                aTargetFile);

  // Select that attachmentitem in the bucket
  let attachmentitem = select_attachments(aController, index)[0];

  // Bring up the context menu, and click cancel.
  let cmd = aController.e("cmd_cancelUpload");
  let menu = aController.getMenu("#" + kAttachmentItemContextID);
  aController.window.updateAttachmentItems();

  assert_false(cmd.hidden);
  assert_false(cmd.disabled);
  let cancelItem = aController.eid("composeAttachmentContext_cancelUploadItem");
  aController.click(cancelItem);

  // Close the popup, and wait for the cancellation to be complete.
  close_popup(aController, aController.eid(kAttachmentItemContextID));
  aController.waitFor(function() cancelled);
}

/**
 * A helper function to find the attachment bucket index for a particular
 * nsILocalFile. Returns null if no attachmentitem is found.
 *
 * @param aController the compose window controller to use.
 * @param aFile the nsILocalFile to search for.
 */
function get_attachmentitem_index_for_file(aController, aFile) {
  // Get the fileUrl from the file.
  let fileUrl = aController.window.FileToAttachment(aFile).url;

  // Get the bucket, and go through each item looking for the matching
  // attachmentitem.
  let bucket = aController.e("attachmentBucket");
  for (let i = 0; i < bucket.getRowCount(); ++i) {
    let attachmentitem = bucket.getItemAtIndex(i);
    if (attachmentitem.attachment.url == fileUrl)
      return i;
  }
  return null;
}
