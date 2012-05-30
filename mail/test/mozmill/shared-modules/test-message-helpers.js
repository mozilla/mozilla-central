/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Helpers to deal with message (nsIMsgDBHdr) parsing.
 */
var MODULE_NAME = 'message-helpers';

var Ci = Components.interfaces;
var Cc = Components.classes;
var Cu = Components.utils;

var frame = {};
Cu.import('resource://mozmill/modules/frame.js', frame);
var utils = {};
Cu.import('resource://mozmill/modules/utils.js', utils);

Cu.import("resource://app/modules/gloda/mimemsg.js");

// we need this for the main controller
const MODULE_REQUIRES = ['folder-display-helpers'];

function setupModule() {
  // do nothing
}

function installInto(module) {
  setupModule();

  module.to_mime_message = to_mime_message;
}

/**
 * Given a message header, converts it to a MimeMessage. If aCallback throws,
 * the test will be marked failed. See the documentation for MsgHdrToMimeMessage
 * for more details.
 */
function to_mime_message(aMsgHdr, aCallbackThis, aCallback, aAllowDownload, aOptions) {
  let runner = new frame.Runner(collector);
  let called = false;
  let currentTest = frame.events.currentTest;
  MsgHdrToMimeMessage(aMsgHdr, aCallbackThis,
    function (aRecdMsgHdr, aMimeMsg) {
      try {
        aCallback(aRecdMsgHdr, aMimeMsg);
      }
      catch (ex) {
        Cu.reportError(ex);
        frame.events.fail({exception: ex, test: currentTest});
      }
      finally {
        called = true;
      }
    }, aAllowDownload, aOptions);
  utils.waitFor(function () called, "Timeout waiting for message to be parsed");
}
