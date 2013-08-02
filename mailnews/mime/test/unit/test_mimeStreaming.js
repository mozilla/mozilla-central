/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This test iterates over the test files in gTestFiles, and streams
 * each as a message and makes sure the streaming doesn't assert or crash.
 */
Components.utils.import("resource://testing-common/mailnews/localAccountUtils.js");
Components.utils.import("resource:///modules/IOUtils.js");

var gTestFiles =[ 
  "../../../data/bug505221",
  "../../../data/bug513543",
];

var gMsgEnumerator;

var gMessenger = Cc["@mozilla.org/messenger;1"].
                   createInstance(Ci.nsIMessenger);

let gUrlListener = {
  OnStartRunningUrl: function (aUrl) {
  },
  OnStopRunningUrl: function (aUrl, aExitCode) {
    do_test_finished();
  },
};


localAccountUtils.loadLocalMailAccount();

function run_test()
{
  do_test_pending();
  localAccountUtils.inboxFolder.QueryInterface(Ci.nsIMsgLocalMailFolder);
  for each(let fileName in gTestFiles) {
    localAccountUtils.inboxFolder.addMessage(IOUtils.loadFileToString(do_get_file(fileName)));
  };
  gMsgEnumerator = localAccountUtils.inboxFolder.msgDatabase.EnumerateMessages();
  doNextTest();
}

function streamMsg(msgHdr)
{
  let msgURI = localAccountUtils.inboxFolder.getUriForMsg(msgHdr);
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
    doNextTest();
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

function doNextTest() {
  if (gMsgEnumerator.hasMoreElements())
    streamMsg(gMsgEnumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr));
  else
    do_test_finished();
}
