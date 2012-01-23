/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Ensures that attachment events are fired properly
 */

const MODULE_NAME = 'test-attachment-events';

const RELATIVE_ROOT = '../shared-modules';
const MODULE_REQUIRES = ['folder-display-helpers', 'compose-helpers',
                         'window-helpers', 'attachment-helpers',
                         'prompt-helpers', 'observer-helpers'];

let elib = {};
Cu.import('resource://mozmill/modules/elementslib.js', elib);
let EventUtils = {};
Cu.import('resource://mozmill/stdlib/EventUtils.js', EventUtils);
let os = {};
Cu.import('resource://mozmill/stdlib/os.js', os);

Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource:///modules/iteratorUtils.jsm');

const kAttachmentsAdded = "mail:attachmentsAdded";
const kAttachmentsRemoved = "mail:attachmentsRemoved";
const kAttachmentRenamed = "mail:attachmentRenamed";

let gPath;

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);

  let wh = collector.getModule('window-helpers');
  wh.installInto(module);

  let composeHelper = collector.getModule('compose-helpers');
  composeHelper.installInto(module);

  let ah = collector.getModule('attachment-helpers');
  ah.installInto(module);

  let ph = collector.getModule('prompt-helpers');
  ph.installInto(module);

  let oh = collector.getModule('observer-helpers');
  oh.installInto(module);

  gPath = os.getFileForPath(__file__);
};

/**
 * A helper function that selects either one, or a continuous range
 * of items in the attachment list.
 *
 * @param aController a composer window controller
 * @param aIndexStart the index of the first item to select
 * @param aIndexEnd (optional) the index of the last item to select
 */
function select_attachments(aController, aIndexStart, aIndexEnd) {
  let bucket = aController.e("attachmentBucket");
  bucket.clearSelection();

  if (aIndexEnd !== undefined) {
    let startItem = bucket.getItemAtIndex(aIndexStart);
    let endItem = bucket.getItemAtIndex(aIndexEnd);
    bucket.selectItemRange(startItem, endItem);
  } else {
    bucket.selectedIndex = aIndexStart;
  }

  bucket.focus();
  return bucket.selectedItems;
}

/**
 * Test that the mail:attachmentsAdded event is fired when we add a single
 * attachment.
 */
function test_attachmentsAdded_on_single() {
  // Prepare to observe mail:attachmentsAdded
  let obs = new ObservationRecorder();
  obs.planFor(kAttachmentsAdded);
  Services.obs.addObserver(obs, kAttachmentsAdded,
                           false);

  // Open up the compose window
  let cw = open_compose_new_mail(mc);
  // Attach a single file
  add_attachment(cw, "http://www.example.com/1", 0);

  // Make sure we only saw the event once
  assert_equals(1, obs.numSightings(kAttachmentsAdded));

  // Make sure that we were passed the right subject
  let subjects = obs.subject[kAttachmentsAdded][0];
  assert_true(subjects instanceof Ci.nsIMutableArray);
  assert_equals("http://www.example.com/1",
                subjects.queryElementAt(0, Ci.nsIMsgAttachment).url);

  // Make sure that we can get that event again if we
  // attach more files.
  add_attachment(cw, "http://www.example.com/2", 0);
  assert_equals(2, obs.numSightings(kAttachmentsAdded));
  subjects = obs.subject[kAttachmentsAdded][1];
  assert_true(subjects instanceof Ci.nsIMutableArray);
  assert_equals("http://www.example.com/2",
                subjects.queryElementAt(0, Ci.nsIMsgAttachment).url);

  // And check that we don't receive the event if we try to attach a file
  // that's already attached.
  add_attachment(cw, "http://www.example.com/2");
  assert_equals(2, obs.numSightings(kAttachmentsAdded));

  Services.obs.removeObserver(obs, kAttachmentsAdded);
}

/**
 * Test that the mail:attachmentsAdded event is fired when we add a series
 * of files all at once.
 */
function test_attachmentsAdded_on_multiple() {
  // Prepare to observe mail:attachmentsAdded
  let obs = new ObservationRecorder();
  obs.planFor(kAttachmentsAdded);
  Services.obs.addObserver(obs, kAttachmentsAdded,
                           false);

  // Prepare the attachments - we store the names in attachmentNames to
  // make sure that we observed the right event subjects later on.
  let attachmentUrls = ["http://www.example.com/1",
                        "http://www.example.com/2"];

  // Open the compose window and add the attachments
  let cw = open_compose_new_mail(mc);
  add_attachments(cw, attachmentUrls);

  // Make sure we only saw a single mail:attachmentsAdded for this group
  // of files.
  assert_equals(1, obs.numSightings(kAttachmentsAdded));

  // Now make sure we got passed the right subjects for the event
  let subjects = obs.subject[kAttachmentsAdded][0];
  assert_true(subjects instanceof Ci.nsIMutableArray);
  assert_equals(2, subjects.length);

  for (let attachment in fixIterator(subjects, Ci.nsIMsgAttachment)) {
    assert_true(attachmentUrls.indexOf(attachment.url) != -1);
  }

  // Close the compose window - let's try again with 3 attachments.
  close_window(cw);

  attachmentUrls = ["http://www.example.com/1",
                    "http://www.example.com/2",
                    "http://www.example.com/3"];

  // Open the compose window and attach the files, and ensure that we saw
  // the mail:attachmentsAdded event
  cw = open_compose_new_mail(mc);
  add_attachments(cw, attachmentUrls);
  assert_equals(2, obs.numSightings(kAttachmentsAdded));

  // Make sure that we got the right subjects back
  subjects = obs.subject[kAttachmentsAdded][1];
  assert_true(subjects instanceof Ci.nsIMutableArray);
  assert_equals(3, subjects.length);

  for (let attachment in fixIterator(subjects, Ci.nsIMsgAttachment)) {
    assert_true(attachmentUrls.indexOf(attachment.url) != -1);
  }

  // Make sure we don't fire the event again if we try to attach the same
  // files.
  add_attachments(cw, attachmentUrls);
  assert_equals(2, obs.numSightings(kAttachmentsAdded));

  Services.obs.removeObserver(obs, kAttachmentsAdded);
}

/**
 * Test that the mail:attachmentsRemoved event is fired when removing a
 * single file.
 */
function test_attachmentsRemoved_on_single() {
  // Prepare our observer
  let obs = new ObservationRecorder();
  obs.planFor(kAttachmentsRemoved);
  Services.obs.addObserver(obs, kAttachmentsRemoved,
                           false);

  // Open up the compose window, attach a file...
  let cw = open_compose_new_mail(mc);
  add_attachment(cw, "http://www.example.com/1");

  // Now select that attachment and delete it
  let removedAttachmentItem = select_attachments(cw, 0);
  // We need to hold a reference to removedAttachment here because
  // the delete routine nulls it out from the attachmentitem.
  let removedAttachment = removedAttachmentItem[0].attachment;
  cw.window.goDoCommand("cmd_delete");
  // Make sure we saw the event
  assert_equals(1, obs.numSightings(kAttachmentsRemoved));
  // And make sure we were passed the right attachment item as the
  // subject.
  let subjects = obs.subject[kAttachmentsRemoved][0];
  assert_true(subjects instanceof Ci.nsIMutableArray);
  assert_equals(1, subjects.length);
  assert_equals(subjects.queryElementAt(0, Ci.nsIMsgAttachment).url,
                "http://www.example.com/1");

  // Ok, let's attach it again, and remove it again to ensure that
  // we still see the event.
  add_attachment(cw, "http://www.example.com/2");
  removedAttachmentItem = select_attachments(cw, 0);
  removedAttachment = removedAttachmentItem[0].attachment;
  cw.window.goDoCommand("cmd_delete");

  assert_equals(2, obs.numSightings(kAttachmentsRemoved));
  subjects = obs.subject[kAttachmentsRemoved][1];
  assert_true(subjects instanceof Ci.nsIMutableArray);
  assert_equals(1, subjects.length);
  assert_equals(subjects.queryElementAt(0, Ci.nsIMsgAttachment).url,
                "http://www.example.com/2");

  Services.obs.removeObserver(obs, kAttachmentsRemoved);
}

/**
 * Test that the mail:attachmentsRemoved event is fired when removing multiple
 * files all at once.
 */
function test_attachmentsRemoved_on_multiple() {
  // Prepare the event observer
  let obs = new ObservationRecorder();
  obs.planFor(kAttachmentsRemoved);
  Services.obs.addObserver(obs, kAttachmentsRemoved,
                           false);

  // Open up the compose window and attach some files...
  let cw = open_compose_new_mail(mc);
  add_attachments(cw, ["http://www.example.com/1",
                       "http://www.example.com/2",
                       "http://www.example.com/3"]);

  // Select all three attachments, and remove them.
  let removedAttachmentItems = select_attachments(cw, 0, 2);

  let removedAttachmentUrls = removedAttachmentItems.map(
    function(aAttachment) aAttachment.attachment.url
  );

  cw.window.goDoCommand("cmd_delete");

  // We should have seen the mail:attachmentsRemoved event exactly once.
  assert_equals(1, obs.numSightings(kAttachmentsRemoved));

  // Now let's make sure we got passed back the right attachment items
  // as the event subject
  let subjects = obs.subject[kAttachmentsRemoved][0];
  assert_true(subjects instanceof Ci.nsIMutableArray);
  assert_equals(3, subjects.length);

  for (let attachment in fixIterator(subjects, Ci.nsIMsgAttachment)) {
    assert_true(removedAttachmentUrls.indexOf(attachment.url) != -1);
  }

  // Ok, let's attach and remove some again to ensure that we still see the event.
  add_attachments(cw, ["http://www.example.com/1",
                       "http://www.example.com/2"]);

  select_attachments(cw, 0, 1);
  cw.window.goDoCommand("cmd_delete");
  assert_equals(2, obs.numSightings(kAttachmentsRemoved));

  Services.obs.removeObserver(obs, kAttachmentsRemoved);
}

/**
 * Test that we don't see the mail:attachmentsRemoved event if no attachments
 * are selected when hitting "Delete"
 */
function test_no_attachmentsRemoved_on_none() {
  // Prepare the observer.
  let obs = new ObservationRecorder();
  obs.planFor(kAttachmentsRemoved);
  Services.obs.addObserver(obs, kAttachmentsRemoved,
                           false);

  // Open the compose window and add some attachments.
  let cw = open_compose_new_mail(mc);
  add_attachments(cw, ["http://www.example.com/1",
                       "http://www.example.com/2",
                       "http://www.example.com/3"]);

  // Choose no attachments
  cw.e("attachmentBucket").clearSelection();
  // Run the delete command
  cw.window.goDoCommand("cmd_delete");
  // Make sure we didn't see the mail:attachmentsRemoved event.
  assert_false(obs.didSee(kAttachmentsRemoved));
  Services.obs.removeObserver(obs, kAttachmentsRemoved);
}

/**
 * Test that we see the mail:attachmentRenamed event when an attachments
 * name is changed.
 */
function test_attachmentRenamed() {
  // Here's what we'll rename some files to.
  const kRenameTo1 = "Renamed-1";
  const kRenameTo2 = "Renamed-2";
  const kRenameTo3 = "Renamed-3";

  // Prepare our observer
  let obs = new ObservationRecorder();
  obs.planFor(kAttachmentRenamed);
  Services.obs.addObserver(obs, kAttachmentRenamed,
                           false);

  // Renaming a file brings up a Prompt, so we'll mock the Prompt Service
  gMockPromptService.reset();
  gMockPromptService.register();
  // The inoutValue is used to set the attachment name
  gMockPromptService.inoutValue = kRenameTo1;
  gMockPromptService.returnValue = true;

  // Open up the compose window, attach some files, choose the first
  // attachment, and choose to rename it.
  let cw = open_compose_new_mail(mc);
  add_attachments(cw, ["http://www.example.com/1",
                       "http://www.example.com/2",
                       "http://www.example.com/3"]);

  select_attachments(cw, 0);
  cw.window.goDoCommand("cmd_renameAttachment");

  // Ensure that we saw the mail:attachmentRenamed event
  assert_true(obs.didSee(kAttachmentRenamed));
  // Ensure that the event mentions the right attachment
  let renamedAttachment1 = obs.subject[kAttachmentRenamed][0];
  let originalName1 = obs.data[kAttachmentRenamed][0];
  assert_true(renamedAttachment1 instanceof Ci.nsIMsgAttachment);
  assert_equals(kRenameTo1, renamedAttachment1.name);
  assert_true(renamedAttachment1.url.indexOf("http://www.example.com/1") != -1);
  assert_equals("www.example.com/1", originalName1);

  // Ok, let's try renaming the same attachment.
  gMockPromptService.reset();
  gMockPromptService.inoutValue = kRenameTo2;
  gMockPromptService.returnValue = true;

  select_attachments(cw, 0);
  cw.window.goDoCommand("cmd_renameAttachment");

  assert_equals(2, obs.numSightings(kAttachmentRenamed));
  let renamedAttachment2 = obs.subject[kAttachmentRenamed][1];
  let originalName2 = obs.data[kAttachmentRenamed][1];
  assert_true(renamedAttachment2 instanceof Ci.nsIMsgAttachment);
  assert_equals(kRenameTo2, renamedAttachment2.name);
  assert_true(renamedAttachment2.url.indexOf("http://www.example.com/1") != -1);
  assert_equals(kRenameTo1, originalName2);

  // Ok, let's rename another attachment
  gMockPromptService.reset();
  gMockPromptService.inoutValue = kRenameTo3;
  gMockPromptService.returnValue = true;

  // We'll select the second attachment this time.
  select_attachments(cw, 1);
  cw.window.goDoCommand("cmd_renameAttachment");

  // Ensure we saw the mail:attachmentRenamed event
  assert_equals(3, obs.numSightings(kAttachmentRenamed));
  // Ensure that the event mentions the right attachment
  let renamedAttachment3 = obs.subject[kAttachmentRenamed][2];
  let originalName3 = obs.data[kAttachmentRenamed][2];
  assert_true(renamedAttachment3 instanceof Ci.nsIMsgAttachment);
  assert_equals(kRenameTo3, renamedAttachment3.name);
  assert_true(renamedAttachment3.url.indexOf("http://www.example.com/2") != -1);
  assert_equals("www.example.com/2", originalName3);

  // Unregister the Mock Prompt service, and remove our observer.
  gMockPromptService.unregister();
  Services.obs.removeObserver(obs, kAttachmentRenamed);
}

/**
 * Test that the mail:attachmentsRenamed event is not fired if we set the
 * filename to be blank.
 */
function test_no_attachmentsRenamed_on_blank() {
  // Set up our observer
  let obs = new ObservationRecorder();
  obs.planFor(kAttachmentRenamed);
  Services.obs.addObserver(obs, kAttachmentRenamed,
                           false);

  // Register the Mock Prompt Service to return the empty string when
  // prompted.
  gMockPromptService.reset();
  gMockPromptService.register();
  gMockPromptService.inoutValue = "";
  gMockPromptService.returnValue = true;

  // Open the compose window, attach some files, select one, and chooes to
  // rename it.
  let cw = open_compose_new_mail(mc);
  add_attachments(cw, ["http://www.example.com/1",
                       "http://www.example.com/2",
                       "http://www.example.com/3"]);

  select_attachments(cw, 0);
  cw.window.goDoCommand("cmd_renameAttachment");

  // Ensure that we didn't see the mail:attachmentRenamed event.
  assert_false(obs.didSee(kAttachmentRenamed));
  gMockPromptService.unregister();
  Services.obs.removeObserver(obs, kAttachmentRenamed);
}
