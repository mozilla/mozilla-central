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

setupIMAPPump();

function stop_server() {
  IMAPPump.incomingServer.closeCachedConnections();
  IMAPPump.server.stop();
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
  let imapMsg = new imapMessage(dataUri.spec, IMAPPump.mailbox.uidnext++, []);
  IMAPPump.mailbox.addMessage(imapMsg);

  IMAPPump.inbox.updateFolderWithListener(null, asyncUrlListener);
  yield false;
}

function move_messages() {
  let messages = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
  let msg = IMAPPump.inbox.msgDatabase.GetMsgHdrForKey(IMAPPump.mailbox.uidnext - 1);
  messages.appendElement(msg, false);
  MailServices.copy.CopyMessages(IMAPPump.inbox, messages, localAccountUtils.inboxFolder,
                                 true, asyncCopyListener, null, false);
  yield false;
}

function check_messages() {
  do_check_eq(IMAPPump.inbox.getTotalMessages(false), 1);
  do_check_eq(localAccountUtils.inboxFolder.getTotalMessages(false), 0);
  yield true;
}

function run_test() {
  do_register_cleanup(function() {
    // IMAPPump.server.performTest() brings this test to a halt,
    // so we need teardownIMAPPump() without IMAPPump.server.performTest().
    IMAPPump.inbox = null;
    IMAPPump.server.resetTest();
    try {
      IMAPPump.incomingServer.closeCachedConnections();
      let serverSink = IMAPPump.incomingServer.QueryInterface(Ci.nsIImapServerSink);
      serverSink.abortQueuedUrls();
    } catch (ex) {dump(ex);}
    IMAPPump.server.stop();
    let thread = gThreadManager.currentThread;
    while (thread.hasPendingEvents())
      thread.processNextEvent(true);
  });
  async_run_tests(tests);
}
