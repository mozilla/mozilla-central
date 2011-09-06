/* ***** BEGIN LICENSE BLOCK *****
 *   Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Thunderbird Mail Client.
 *
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Siddharth Agarwal <sagarwal@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

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
