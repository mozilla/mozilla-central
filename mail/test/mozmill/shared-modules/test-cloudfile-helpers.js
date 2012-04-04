/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
  * You can obtain one at http://mozilla.org/MPL/2.0/. */

let Cu = Components.utils;
let Cc = Components.classes;
let Ci = Components.interfaces;
let Cr = Components.results;

const MODULE_NAME = 'cloudfile-helpers';

const RELATIVE_ROOT = '../shared-modules';
const MODULE_REQUIRES = ['folder-display-helpers'];

const kMockContractID = "@mozilla.org/mail/mockCloudFile;1";
const kMockCID = "614fd1f7-a404-4505-92fd-8b0ceff2f66c";
const kMockID = "mock";

const kDefaults = {
  type: kMockID,
  displayName: "Mock Storage",
  iconClass: "chrome://messenger/skin/icons/dropbox.png",
  accountKey: null,
  settingsURL: "",
  managementURL: "",
};

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

var cfh, fdh, gMockCloudfileComponent;

function setupModule(module) {
  fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);

  let moh = collector.getModule("mock-object-helpers");

  gMockCloudfileComponent = new moh.MockObjectRegisterer(
      kMockContractID,
      kMockCID,
      MockCloudfileAccount);
}

function installInto(module) {
  setupModule(module);
  module.gMockCloudfileManager = gMockCloudfileManager;
  module.MockCloudfileAccount = MockCloudfileAccount;
  module.getFile = getFile;
  module.collectFiles = collectFiles;
}


function getFile(aFilename, aRoot) {
  let path = os.getFileForPath(aRoot);
  let file = os.getFileForPath(os.abspath(aFilename, path));
  fdh.assert_true(file.exists, "File " + aFilename + " does not exist.");
  return file;
}

/**
 * Helper function for getting the nsILocalFile's for some files located
 * in a subdirectory of the test directory.
 *
 * @param aFiles an array of filename strings for files underneath the test
 *               file directory.
 * @param aFileRoot the file who's parent directory we should start looking
 *                  for aFiles in.
 *
 * Example:
 * let files = collectFiles(['./data/testFile1', './data/testFile2'],
 *                          __file__);
 */
function collectFiles(aFiles, aFileRoot) {
  return [getFile(filename, aFileRoot)
          for each (filename in aFiles)]
}

function MockCloudfileAccount() {
  for(let someDefault in kDefaults)
    this[someDefault] = kDefaults[someDefault];
}

MockCloudfileAccount.prototype = {

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIMsgCloudFileProvider]),
  init: function MCA_init(aAccountKey) {
    this.accountKey = aAccountKey;
  },

  uploadFile: function MCA_uploadFile(aFile, aListener) {
    aListener.onStartRequest(null, null);
    aListener.onStopRequest(null, null, Cr.NS_OK);
  },

  urlForFile: function MCA_urlForFile(aFile) {
    return "http://www.example.com/download/someFile";
  },

  refreshUserInfo: function MCA_refreshUserInfo(aWithUI,
                                                aCallback) {
    aCallback.onStartRequest(null, null);
    aCallback.onStopRequest(null, null, Cr.NS_OK);
  },

  cancelFileUpload: function MCA_cancelFileUpload(aFile) {
    throw Cr.NS_ERROR_NOT_IMPLEMENTED;
  },
};


var gMockCloudfileManager = {
  _mock_map: {},

  register: function MCM_register() {
    gCategoryManager.addCategoryEntry("cloud-files", kMockID, kMockContractID,
                                      false, true);
    gMockCloudfileComponent.register();
  },

  unregister: function MCM_unregister() {
    gCategoryManager.deleteCategoryEntry("cloud-files", kMockID, false);
    gMockCloudfileComponent.unregister();
  },

}

XPCOMUtils.defineLazyServiceGetter(this, "gCategoryManager",
                                   "@mozilla.org/categorymanager;1",
                                   "nsICategoryManager");
