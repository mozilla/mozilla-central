/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
  * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests the Ubuntu One Bigfile backend.
 */

let Cu = Components.utils;
let Cc = Components.classes;
let Ci = Components.interfaces;

const MODULE_NAME = 'test-cloudfile-backend-ubuntuone';

const RELATIVE_ROOT = '../shared-modules';
const MODULE_REQUIRES = ['folder-display-helpers',
                         'compose-helpers',
                         'cloudfile-ubuntuone-helpers',
                         'observer-helpers',
                         'prompt-helpers',];

const kAttachmentsVolume = '/~/Thunderbird Attachments';

Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource:///modules/cloudFileAccounts.js');

var gServer, gObsManager;

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);

  let ch = collector.getModule('compose-helpers');
  ch.installInto(module);

  let cfh = collector.getModule('cloudfile-helpers');
  cfh.installInto(module);

  let cbh = collector.getModule('cloudfile-backend-helpers');
  cbh.installInto(module);

  let cdh = collector.getModule('cloudfile-ubuntuone-helpers');
  cdh.installInto(module);

  let oh = collector.getModule('observer-helpers');
  oh.installInto(module);

  let ph = collector.getModule('prompt-helpers');
  ph.installInto(module);

  gObsManager = new cbh.SimpleRequestObserverManager();

  // Enable logging for this test.
  Services.prefs.setCharPref("UbuntuOne.logging.dump", "All");
  Services.prefs.setCharPref("TBOAuth.logging.dump", "All");
};

function teardownModule() {
  Services.prefs.QueryInterface(Ci.nsIPrefBranch)
          .deleteBranch("mail.cloud_files.accounts");
  Services.prefs.clearUserPref("UbuntuOne.logging.dump");
  Services.prefs.clearUserPref("TBOAuth.logging.dump");
}

function setupTest() {
  gServer = new MockUbuntuOneServer();
  gServer.init();
  gServer.start();
}

function teardownTest() {
  gObsManager.check();
  gObsManager.reset();
  gServer.stop(mc);
}

function test_simple_case() {
  const kExpectedUrl = "http://www.example.com/expectedUrl";
  const kTopics = [kUploadFile, kGetFileURL];

  gServer.setupUser();
  gServer.planForCreateVolume(kAttachmentsVolume);
  gServer.planForUploadFile(kAttachmentsVolume + "/testFile1");
  gServer.planForMetadataUpdate(kAttachmentsVolume + "/testFile1",
                                kExpectedUrl);

  let obs = new ObservationRecorder();
  for each (let [, topic] in Iterator(kTopics)) {
    obs.planFor(topic);
    Services.obs.addObserver(obs, topic, false);
  }

  let requestObserver = gObsManager.create("test_simple_case - Upload 1");
  let file = getFile("./data/testFile1", __file__);
  let provider = gServer.getPreparedBackend("someAccountKey");
  provider.uploadFile(file, requestObserver);

  mc.waitFor(function () requestObserver.success);

  let urlForFile = provider.urlForFile(file);
  assert_equals(kExpectedUrl, urlForFile);
  assert_equals(1, obs.numSightings(kUploadFile));
  assert_equals(1, obs.numSightings(kGetFileURL));

  gServer.planForUploadFile(kAttachmentsVolume + "/testFile1");
  gServer.planForMetadataUpdate(kAttachmentsVolume + "/testFile1",
                                kExpectedUrl);
  requestObserver = gObsManager.create("test_simple_case - Upload 2");
  provider.uploadFile(file, requestObserver);
  mc.waitFor(function () requestObserver.success);
  urlForFile = provider.urlForFile(file);
  assert_equals(kExpectedUrl, urlForFile);

  assert_equals(2, obs.numSightings(kUploadFile));
  assert_equals(2, obs.numSightings(kGetFileURL));

  for each (let [, topic] in Iterator(kTopics)) {
    Services.obs.removeObserver(obs, topic);
  }
}

function test_chained_uploads() {
  const kExpectedUrlRoot = "http://www.example.com/";
  const kTopics = [kUploadFile, kGetFileURL];
  const kFilenames = ["testFile1", "testFile2", "testFile3"];

  gServer.setupUser();

  gServer.planForCreateVolume(kAttachmentsVolume);
  for each (let [, filename] in Iterator(kFilenames)) {
    let path = kAttachmentsVolume + "/" + filename;
    let expectedUrl = kExpectedUrlRoot + filename;
    gServer.planForUploadFile(path);
    gServer.planForMetadataUpdate(path, expectedUrl);
  }

  let obs = new ObservationRecorder();
  for each (let [, topic] in Iterator(kTopics)) {
    obs.planFor(topic);
    Services.obs.addObserver(obs, topic, false);
  }

  let provider = gServer.getPreparedBackend("someAccountKey");

  let files = [];

  let observers = kFilenames.map(function(aFilename) {
    let requestObserver = gObsManager.create("test_chained_uploads for filename " + aFilename);
    let file = getFile("./data/" + aFilename, __file__);
    files.push(file);
    provider.uploadFile(file, requestObserver);
    return requestObserver;
  });

  mc.waitFor(function() {
    return observers.every(function(aListener) aListener.success);
  }, "Timed out waiting for chained uploads to complete.", 10000);

  assert_equals(kFilenames.length, obs.numSightings(kUploadFile));

  for (let [index, filename] in Iterator(kFilenames)) {
    let path = kAttachmentsVolume + "/" + filename;
    assert_equals(obs.data[kUploadFile][index], path);
    let file = getFile("./data/" + filename, __file__);
    let expectedUriForFile = kExpectedUrlRoot + filename;
    let uriForFile = provider.urlForFile(files[index]);
    assert_equals(expectedUriForFile, uriForFile);
  }

  assert_equals(kFilenames.length, obs.numSightings(kGetFileURL));

  for each (let [, topic] in Iterator(kTopics)) {
    Services.obs.removeObserver(obs, topic);
  }
}

function test_deleting_uploads() {
  const kFilename = "testFile1";
  let path = kAttachmentsVolume + "/" + kFilename;

  gServer.setupUser();
  let provider = gServer.getPreparedBackend("someAccountKey");
  // Upload a file

  gServer.planForCreateVolume(kAttachmentsVolume);
  gServer.planForUploadFile(path);
  gServer.planForMetadataUpdate(path, "http://www.example.com/someFile");
  let requestObserver = gObsManager.create("test_deleting_uploads - upload 1");
  let file = getFile("./data/" + kFilename, __file__);
  provider.uploadFile(file, requestObserver);
  mc.waitFor(function() requestObserver.success);

  // Try deleting a file
  let obs = new ObservationRecorder();
  obs.planFor(kDeleteFile);
  Services.obs.addObserver(obs, kDeleteFile, false);

  //gServer.planForDeleteFile(kFilename);
  let deleteObserver = gObsManager.create("test_deleting_uploads - delete 1");
  provider.deleteFile(file, deleteObserver);
  mc.waitFor(function() deleteObserver.success);

  // Check to make sure the file was deleted on the server
  assert_equals(1, obs.numSightings(kDeleteFile));
  assert_equals(obs.data[kDeleteFile][0], path);
  Services.obs.removeObserver(obs, kDeleteFile);
}

/**
 * Test that when we call createExistingAccount, onStopRequest is successfully
 * called, and we pass the correct parameters.
 */
function test_create_existing_account() {
  gMockAuthPromptReg.register();
  try {
    gMockAuthPrompt.password = "account_password";
    let accountKey = "someNewAccount";
    // Prepare the backend without preloading any token.
    let provider = gServer.getPreparedBackend(accountKey, true);
    let done = false;
    let myObs = {
      onStartRequest: function(aRequest, aContext) {
      },
      onStopRequest: function(aRequest, aContext, aStatusCode) {
        assert_true(aContext instanceof Ci.nsIMsgCloudFileProvider);
        assert_equals(aStatusCode, Components.results.NS_OK);
        done = true;
      },
    }

    provider.createExistingAccount(myObs);
    mc.waitFor(function() done);
    let newToken = cloudFileAccounts.getSecretValue(
      accountKey, cloudFileAccounts.kTokenRealm);
    assert_not_equals(newToken, "");
  }
  finally {
    gMockAuthPromptReg.unregister();
  }
}

/**
 * Test that cancelling an upload causes onStopRequest to be
 * called with nsIMsgCloudFileProvider.uploadCanceled.
 */
function test_can_cancel_upload() {
  const kFilename = "testFile1";
  let path = kAttachmentsVolume + "/" + kFilename;
  gServer.setupUser();
  let provider = gServer.getPreparedBackend("someNewAccount");
  let file = getFile("./data/" + kFilename, __file__);
  gServer.planForCreateVolume(kAttachmentsVolume);
  gServer.planForUploadFile(path, 2000);
  assert_can_cancel_uploads(mc, provider, [file]);
}

/**
 * Test that cancelling several uploads causes onStopRequest to be
 * called with nsIMsgCloudFileProvider.uploadCanceled.
 */
function test_can_cancel_uploads() {
  const kFiles = ["testFile1", "testFile2", "testFile3"];
  gServer.setupUser();
  let provider = gServer.getPreparedBackend("someNewAccount");
  let files = [];
  gServer.planForCreateVolume(kAttachmentsVolume);
  for each (let [, filename] in Iterator(kFiles)) {
    let path = kAttachmentsVolume + "/" + filename;
    gServer.planForUploadFile(path, 2000);
    files.push(getFile("./data/" + filename, __file__));
  }
  assert_can_cancel_uploads(mc, provider, files);
}
