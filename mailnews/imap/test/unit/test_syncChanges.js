/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test to ensure that changes made from a different profile/machine
 * are synced correctly. In particular, we're checking that emptying out
 * an imap folder on the server makes us delete all the headers from our db.
 */

load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");
load("../../../resources/messageGenerator.js");

var gMessage;
var gSecondFolder;
var gSynthMessage;

var tests = [
  setup,
  function switchAwayFromInbox() {
    let rootFolder = IMAPPump.incomingServer.rootFolder;
    gSecondFolder =  rootFolder.getChildNamed("secondFolder")
                           .QueryInterface(Ci.nsIMsgImapMailFolder);

    // Selecting the second folder will close the cached connection
    // on the inbox because fake server only supports one connection at a time.
    //  Then, we can poke at the message on the imap server directly, which
    // simulates the user changing the message from a different machine,
    // and Thunderbird discovering the change when it does a flag sync 
    // upon reselecting the Inbox.
    gSecondFolder.updateFolderWithListener(null, asyncUrlListener);
    yield false;
  },
  function simulateMailboxEmptied() {
    gMessage.setFlag("\\Deleted");
    IMAPPump.inbox.expunge(asyncUrlListener, null);
    yield false;
    IMAPPump.inbox.updateFolderWithListener(null, asyncUrlListener);
    yield false;
  },
  function checkMailboxEmpty() {
    let msgHdr = IMAPPump.inbox.msgDatabase.getMsgHdrForMessageID(gSynthMessage.messageId);
    do_check_eq(IMAPPump.inbox.getTotalMessages(false), 0);
  },
  teardown
];

function setup() {
  /*
   * Set up an IMAP server.
   */
  setupIMAPPump();

  IMAPPump.daemon.createMailbox("secondFolder", {subscribed : true});

  let messages = [];
  let gMessageGenerator = new MessageGenerator();
  messages = messages.concat(gMessageGenerator.makeMessage());
  gSynthMessage = messages[0];

  let msgURI =
    Services.io.newURI("data:text/plain;base64," +
                       btoa(gSynthMessage.toMessageString()),
                       null, null);
  gMessage = new imapMessage(msgURI.spec, IMAPPump.mailbox.uidnext++, []);
  IMAPPump.mailbox.addMessage(gMessage);

  // update folder to download header.
  IMAPPump.inbox.updateFolderWithListener(null, asyncUrlListener);
  yield false;
}

asyncUrlListener.callback = function(aUrl, aExitCode) {
  do_check_eq(aExitCode, 0);
};

function teardown() {
  teardownIMAPPump();
}

function run_test() {
  async_run_tests(tests);
}
