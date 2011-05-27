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
 *   The Mozilla Foundation
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 * David Bienvenu <bienvenu@mozilla.com>
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
 * Tests imap msg header download chunking
 */

load("../../../resources/logHelper.js");
load("../../../resources/mailTestUtils.js");
load("../../../resources/asyncTestUtils.js");
load("../../../resources/messageGenerator.js");

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/mailServices.js");
// javascript mime emitter functions

// IMAP pump
load("../../../resources/IMAPpump.js");

setupIMAPPump();

// Dummy message window so we can say the inbox is open in a window.
var dummyMsgWindow =
{
  openFolder : gIMAPInbox,
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIMsgWindow,
                                         Ci.nsISupportsWeakReference])
};

var mfnListener =
{
  _msgStreamed: false,
  msgAdded: function msgAdded(aMsg)
  {
    if (!this._msgStreamed) {
      // Try to fetch the message with UID 8. This will be the first header 
      // downloaded iff we fetch the newest hdrs first.
      let messenger = Cc["@mozilla.org/messenger;1"].createInstance(Ci.nsIMessenger);
      let msgURI = gIMAPInbox.getUriForMsg(aMsg);
      do_check_eq(aMsg.messageKey, 8);
      try {
        let msgServ = messenger.messageServiceFromURI(msgURI);
        msgServ.streamMessage(msgURI, gStreamListener, null, null, false, "", false);
        this._msgStreamed = true;
      }
      catch (ex) {do_throw(ex);}
    }
  }
};

gStreamListener = {
  QueryInterface : XPCOMUtils.generateQI([Ci.nsIStreamListener]),
  _stream : null,
  _gotStartRequest : false,
  onStartRequest : function (aRequest, aContext) {
    this._gotStartRequest = true;
  },
  onStopRequest : function (aRequest, aContext, aStatusCode) {
    async_driver();
  },
  onDataAvailable : function (aRequest, aContext, aInputStream, aOff, aCount) {
    if (this._stream == null) {
      this._stream = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);
      this._stream.init(aInputStream);
    }
    this._data += this._stream.read(aCount);
  },
};


var tests = [
  uploadImapMessages,
  testMessageFetched,
  testHdrsDownloaded,
  endTest
]

// upload messages to the imap fake server Inbox
function uploadImapMessages()
{
  // make 10 messges
  let messageGenerator = new MessageGenerator();
  let scenarioFactory = new MessageScenarioFactory(messageGenerator);

  // build up a list of messages
  let messages = [];
  messages = messages.concat(scenarioFactory.directReply(10));

  // Add 10 messages with uids 1-10.
  let imapInbox = gIMAPDaemon.getMailbox("INBOX")
  // Create the imapMessages and store them on the mailbox
  messages.forEach(function (message)
  {
    let dataUri = Services.io.newURI("data:text/plain;base64," +
                                      btoa(message.toMessageString()),
                                     null, null);
    imapInbox.addMessage(new imapMessage(dataUri.spec, imapInbox.uidnext++, []));
  });
  gIMAPInbox.updateFolderWithListener(null, asyncUrlListener);
  yield false;
}

function testMessageFetched() {
  // If we're really chunking, then the message fetch should have started before
  // we finished the updateFolder URL.
  do_check_true(gStreamListener._gotStartRequest);
  // Should have only downloaded first chunk of headers when message
  // has finished streaming.
  do_check_eq(gIMAPInbox.msgDatabase.dBFolderInfo.numMessages, 3);
  yield false;
}

function testHdrsDownloaded() {
  // Make sure we got all 10 headers.
  do_check_eq(gIMAPInbox.msgDatabase.dBFolderInfo.numMessages, 10);
  yield true;
}

// Cleanup
function endTest() {
  teardownIMAPPump();
}

function run_test()
{
  // XXX Disable on windows for now as it is failing there.
  if ("@mozilla.org/windows-registry-key;1" in Cc) {
    dump("Disabled on windows due to permanent failures\n");
    endTest();
    return;
  }

  // We need to register the dummyMsgWindow so that we'll think the
  // Inbox is open in a folder and fetch headers in chunks.
  MailServices.mailSession.AddMsgWindow(dummyMsgWindow);
  MailServices.mfn.addListener(mfnListener, MailServices.mfn.msgAdded);

  // Set chunk size to 3, so we'll have to chain 4 requests to get
  // 10 headers.
  Services.prefs.setIntPref("mail.imap.hdr_chunk_size", 3);
  // Turn off offline sync to avoid complications in verifying that we can
  // run a url after the first header chunk.
  Services.prefs.setBoolPref("mail.server.server1.autosync_offline_stores", false);

  async_run_tests(tests);
}

