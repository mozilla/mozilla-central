/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

let Cu = Components.utils;
let Cc = Components.classes;
let Ci = Components.interfaces;

const MODULE_NAME = 'cloudfile-backend-helpers';

const RELATIVE_ROOT = '../shared-modules';
const MODULE_REQUIRES = ['folder-display-helpers',
                         'window-helpers'];

const kUserAuthRequested = "cloudfile:auth";
const kUserDataRequested = "cloudfile:user";
const kUploadFile = "cloudfile:uploadFile";
const kGetFileURL = "cloudfile:getFileURL";
const kDeleteFile = "cloudfile:deleteFile";
const kLogout = "cloudfile:logout";

var os = {};
Cu.import('resource://mozmill/stdlib/os.js', os);
Cu.import('resource://gre/modules/XPCOMUtils.jsm');

var fdh, wh;

function installInto(module) {
  setupModule(module);
  module.kUserAuthRequested = kUserAuthRequested;
  module.kUserDataRequested = kUserDataRequested;
  module.kUploadFile = kUploadFile;
  module.kGetFileURL = kGetFileURL;
  module.kDeleteFile = kDeleteFile;
  module.kLogout = kLogout;
  module.SimpleRequestObserverManager = SimpleRequestObserverManager;
  module.SimpleRequestObserver = SimpleRequestObserver;
  module.assert_can_cancel_uploads = assert_can_cancel_uploads;
}

function setupModule(module) {
  fdh = collector.getModule('folder-display-helpers');
  wh = collector.getModule('window-helpers');
}

function SimpleRequestObserverManager() {
  this._observers = [];
}

SimpleRequestObserverManager.prototype = {
  create: function(aName) {
    let obs = new SimpleRequestObserver(aName);
    this._observers.push(obs);
    return obs;
  },

  check: function() {
    for each (let [, observer] in Iterator(this._observers)) {
      if (!observer.success)
        throw new Error("An observer named " + observer.name + " was leftover, "
                        + "with its success attribute set to: "
                        + observer.success);
    }
  },

  reset: function() {
    this._observers = [];
  }
}

function SimpleRequestObserver(aName) {
  this.name = aName;
};

SimpleRequestObserver.prototype = {
  success: null,
  onStartRequest: function(aRequest, aContext) {},
  onStopRequest: function(aRequest, aContext, aStatusCode) {
    if (Components.isSuccessCode(aStatusCode)) {
      this.success = true;
    } else {
      this.success = false;
    }
  },
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIRequestObserver,
                                         Ci.nsISupportsWeakReference]),
}

/**
 * This function uploads one or more files, and then proceeds to cancel
 * them.  This function assumes that the mock server for the provider
 * is prepared for the uploaded files, and will give enough time for
 * the uploads to be cancelled before they complete.
 *
 * @param aController the controller to use for waitFors.
 * @param aProvider the provider to upload and cancel the files with.
 * @param aFiles the array of files to upload.
 */
function assert_can_cancel_uploads(aController, aProvider, aFiles) {
  let fileListenerMap = [];
  wh.plan_for_observable_event("cloudfile:uploadStarted");

  for each (let [, file] in Iterator(aFiles)) {
    let mapping = {};
    mapping.listener = {
      onStartRequest: function(aRequest, aContext) {
        mapping.started = true;
      },
      onStopRequest: function(aRequest, aContext, aStatusCode) {
        if (aStatusCode == Ci.nsIMsgCloudFileProvider.uploadCanceled)
          mapping.cancelled = true;
      },
    }

    aProvider.uploadFile(file, mapping.listener);
    fileListenerMap.push(mapping);
  }

  // Wait for the first file to start uploading...
  wh.wait_for_observable_event("cloudfile:uploadStarted");

  // Go backwards through the file list, ensuring that we can cancel the
  // last file, all the way to the first.
  for (let i = aFiles.length - 1; i >= 0; --i)
    aProvider.cancelFileUpload(aFiles[i]);

  aController.waitFor(function() {
    return fileListenerMap.length == aFiles.length &&
           fileListenerMap.every(function(aMapping) {
             return aMapping.cancelled
           })
  }, "Timed out waiting for cancellation to occur");
}
