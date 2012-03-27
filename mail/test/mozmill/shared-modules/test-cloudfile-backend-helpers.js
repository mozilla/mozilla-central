/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

let Cu = Components.utils;
let Cc = Components.classes;
let Ci = Components.interfaces;

const MODULE_NAME = 'cloudfile-backend-helpers';

const RELATIVE_ROOT = '../shared-modules';
const MODULE_REQUIRES = ['folder-display-helpers'];

const kUserAuthRequested = "cloudfile:auth";
const kUserDataRequested = "cloudfile:user";
const kUploadFile = "cloudfile:uploadFile";
const kGetFileURL = "cloudfile:getFileURL";
const kDeleteFile = "cloudfile:deleteFile";
const kLogout = "cloudfile:logout";

Cu.import('resource://mozmill/stdlib/os.js', os);
Cu.import('resource://gre/modules/XPCOMUtils.jsm');

var fdh;

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
}

function setupModule(module) {
  fdh = collector.getModule('folder-display-helpers');
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
