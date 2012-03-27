/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
  * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests the Dropbox Bigfile backend.
 */

let Cu = Components.utils;
let Cc = Components.classes;
let Ci = Components.interfaces;

const MODULE_NAME = 'test-cloudfile-backend-dropbox';

const RELATIVE_ROOT = '../shared-modules';
const MODULE_REQUIRES = ['folder-display-helpers',
                         'compose-helpers',
                         'cloudfile-dropbox-helpers',
                         'observer-helpers',];

Cu.import('resource://gre/modules/Services.jsm');

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

  let cdh = collector.getModule('cloudfile-dropbox-helpers');
  cdh.installInto(module);

  let oh = collector.getModule('observer-helpers');
  oh.installInto(module);

  gObsManager = new cbh.SimpleRequestObserverManager();

  // Enable logging for this test.
  Services.prefs.setCharPref("Dropbox.logging.dump", "All");
  Services.prefs.setCharPref("TBOAuth.logging.dump", "All");
};

function teardownModule() {
  Services.prefs.QueryInterface(Ci.nsIPrefBranch)
          .deleteBranch("mail.cloud_files.accounts");
  Services.prefs.clearUserPref("Dropbox.logging.dump");
  Services.prefs.clearUserPref("TBOAuth.logging.dump");
}

function setupTest() {
  gServer = new MockDropboxServer();
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
  gServer.planForUploadFile("testFile1");
  gServer.planForGetFileURL("testFile1", {url: kExpectedUrl});

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

  gServer.planForUploadFile("testFile1");
  gServer.planForGetFileURL("testFile1", {url: kExpectedUrl});
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

  for each (let [, filename] in Iterator(kFilenames)) {
    let expectedUrl = kExpectedUrlRoot + filename;
    gServer.planForUploadFile(filename);
    gServer.planForGetFileURL(filename, {url: expectedUrl});
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
  }, "Timed out waiting for chained uploads to complete.");

  assert_equals(kFilenames.length, obs.numSightings(kUploadFile));

  for (let [index, filename] in Iterator(kFilenames)) {
    assert_equals(obs.data[kUploadFile][index], filename);
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
  gServer.setupUser();
  let provider = gServer.getPreparedBackend("someAccountKey");
  // Upload a file

  let file = getFile("./data/" + kFilename, __file__);
  gServer.planForUploadFile(kFilename);
  gServer.planForGetFileURL(kFilename,
                                {url: "http://www.example.com/someFile"});
  let requestObserver = gObsManager.create("test_deleting_uploads - upload 1");
  provider.uploadFile(file, requestObserver);
  mc.waitFor(function() requestObserver.success);

  // Try deleting a file
  let obs = new ObservationRecorder();
  obs.planFor(kDeleteFile);
  Services.obs.addObserver(obs, kDeleteFile, false);

  gServer.planForDeleteFile(kFilename);
  let deleteObserver = gObsManager.create("test_deleting_uploads - delete 1");
  provider.deleteFile(file, deleteObserver);
  mc.waitFor(function() deleteObserver.success);

  // Check to make sure the file was deleted on the server
  assert_equals(1, obs.numSightings(kDeleteFile));
  assert_equals(obs.data[kDeleteFile][0], kFilename);
  Services.obs.removeObserver(obs, kDeleteFile);
}

/**
 * Test that when we call createExistingAccount, onStopRequest is successfully
 * called, and we pass the correct parameters.
 */
function test_create_existing_account() {
  let provider = gServer.getPreparedBackend("someNewAccount");
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
}

/**
 * Test that completing the OAuth procedure results in an attempt to logout.
 */
function test_oauth_complete_causes_logout() {
  let provider = gServer.getPreparedBackend("someNewAccount");
  let dummyObs = gObsManager.create("test_oauth_complete_causes_logout");
  let obs = new ObservationRecorder();
  obs.planFor(kLogout);
  Services.obs.addObserver(obs, kLogout, false);
  provider.createExistingAccount(dummyObs);
  mc.waitFor(function() dummyObs.success);
  mc.waitFor(function() 1 == obs.numSightings(kLogout));
  Services.obs.removeObserver(obs, kLogout);
}
