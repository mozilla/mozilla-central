/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * David Bienvenu <bienvenu@mozillamessaging.com>.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

/**
 * This test currently just makes sure the test case in bug 505221 doesn't
   assert or crash. This test file could be extended to other particular 
   mime test cases.
 */
load("../../mailnews/resources/mailTestUtils.js");

const copyService = Cc["@mozilla.org/messenger/messagecopyservice;1"]
                      .getService(Ci.nsIMsgCopyService);
const bug505221 = do_get_file("../../mailnews/data/bug505221");
var gHdr; // header of test message in local folder

var gMessenger = Cc["@mozilla.org/messenger;1"].
                   createInstance(Ci.nsIMessenger);

let gUrlListener = {
  OnStartRunningUrl: function (aUrl) {
  },
  OnStopRunningUrl: function (aUrl, aExitCode) {
    do_test_finished()
  },
};


loadLocalMailAccount();

function run_test()
{
  do_test_pending();
  // step 1: copy a message into the local inbox
  copyService.CopyFileMessage(bug505221, gLocalInboxFolder, null, false, 0,
                              "", step2, null);
  return;
}

// step 2: wait for copy to finish and then stream the message
// nsIMsgCopyServiceListener implementation
var step2 = 
{
  OnStartCopy: function() {},
  OnProgress: function(aProgress, aProgressMax) {},
  SetMessageKey: function(aKey)
  {
    gHdr = gLocalInboxFolder.GetMessageHeader(aKey);
  },
  SetMessageId: function(aMessageId) {},
  OnStopCopy: function(aStatus)
  {
    streamMsg(gHdr);
  }
};

function streamMsg(msgHdr)
{
  let msgURI = gLocalInboxFolder.getUriForMsg(msgHdr);
  let msgService = gMessenger.messageServiceFromURI(msgURI);
  let streamURI = msgService.streamMessage(
    msgURI,
    gStreamListener,
    null,
    gUrlListener,
    true, // have them create the converter
    // additional uri payload, note that "header=" is prepended automatically
    "filter",
    true);
}

gStreamListener = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIStreamListener]),
  _stream : null,
  // nsIRequestObserver part
  onStartRequest: function (aRequest, aContext) {
  },
  onStopRequest: function (aRequest, aContext, aStatusCode) {
  },

  /* okay, our onDataAvailable should actually never be called.  the stream
     converter is actually eating everything except the start and stop
     notification. */
  // nsIStreamListener part
  onDataAvailable: function (aRequest,aContext,aInputStream,aOffset,aCount) {
    if (this._stream === null) {
      this._stream = Cc["@mozilla.org/scriptableinputstream;1"].
                    createInstance(Ci.nsIScriptableInputStream);
      this._stream.init(aInputStream);
    }
    this._stream.read(aCount);

  },
};

