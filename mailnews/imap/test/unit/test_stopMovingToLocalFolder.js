/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* Test that the message failed to move to a local folder remains on IMAP
 * server. */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/mailServices.js");

load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");
load("../../../resources/messageGenerator.js");

load("../../../resources/IMAPpump.js");
setupIMAPPump();

function stop_server() {
  gIMAPIncomingServer.closeCachedConnections();
  gIMAPServer.stop();
  let thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);
}

var asyncCopyListener = {
  OnStartCopy: function() {},
  SetMessageKey: function(aMsgKey) {},
  GetMessageId: function() {},
  OnProgress: function(aProgress, aProgressMax) {
    stop_server();
  },
  OnStopCopy: function(aStatus) {
    do_check_eq(aStatus, 0);
    async_driver();
  }
};

var tests = [
  setup_messages,
  move_messages,
  check_messages
];

function setup_messages() {
  Services.prefs.setBoolPref("mail.server.default.autosync_offline_stores", false);

  let messageGenerator = new MessageGenerator();
  let messageString = messageGenerator.makeMessage().toMessageString();
  let dataUri = Services.io.newURI("data:text/plain;base64," + btoa(messageString),
                                   null, null);
  let imapMsg = new imapMessage(dataUri.spec, gIMAPMailbox.uidnext++, []);
  gIMAPMailbox.addMessage(imapMsg);

  gIMAPInbox.updateFolderWithListener(null, asyncUrlListener);
  yield false;
}

function move_messages() {
  let messages = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
  let msg = gIMAPInbox.msgDatabase.GetMsgHdrForKey(gIMAPMailbox.uidnext - 1);
  messages.appendElement(msg, false);
  MailServices.copy.CopyMessages(gIMAPInbox, messages, localAccountUtils.inboxFolder,
                                 true, asyncCopyListener, null, false);
  yield false;
}

function check_messages() {
  do_check_eq(gIMAPInbox.getTotalMessages(false), 1);
  do_check_eq(localAccountUtils.inboxFolder.getTotalMessages(false), 0);
  yield true;
}

function run_test() {
  do_register_cleanup(function() {
    // gIMAPServer.performTest() brings this test to a halt,
    // so we need teardownIMAPPump() without gIMAPServer.performTest().
    gIMAPInbox = null;
    gIMAPServer.resetTest();
    try {
      gIMAPIncomingServer.closeCachedConnections();
      let serverSink = gIMAPIncomingServer.QueryInterface(Ci.nsIImapServerSink);
      serverSink.abortQueuedUrls();
    } catch (ex) {dump(ex);}
    gIMAPServer.stop();
    let thread = gThreadManager.currentThread;
    while (thread.hasPendingEvents())
      thread.processNextEvent(true);
  });
  async_run_tests(tests);
}
