/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Test to ensure that, in case of GMail server, fetching of a message,
 * which is already present in offline store of some folder, from a folder
 * doesn't make us add it to the offline store twice(in this case, in general it can
 * be any number of times).
 *
 * Bug 721316
 *
 * See https://bugzilla.mozilla.org/show_bug.cgi?id=721316
 * for more info.
 *
 * Original Author: Atul Jangra<atuljangra66@gmail.com>
 */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

load("../../../resources/logHelper.js");
load("../../../resources/mailTestUtils.js");
load("../../../resources/asyncTestUtils.js");

load("../../../resources/messageGenerator.js");
load("../../../resources/messageModifier.js");
load("../../../resources/messageInjection.js");
load("../../../resources/IMAPpump.js");

var gMessageGenerator = new MessageGenerator();
var gScenarioFactory = new MessageScenarioFactory(gMessageGenerator);

// Messages to load must have CRLF line endings, that is Windows style

const gMessage1 = "bugmail10"; // message file used as the test message for Inbox and fooFolder
const gXGmMsgid1 = "1278455344230334865";
const gXGmThrid1 = "1266894439832287888";
// We need to have different X-GM-LABELS for different folders. I am doing it here manually, but this issue will be tackled in Bug 781443.
const gXGmLabels11 = '( \"\\\\Sent\" foo bar)'; // for message in Inbox
const gXGmLabels12 = '(\"\\\\Inbox\" \"\\\\Sent\" bar)'; // for message in fooFolder
const gMsgId1 = "200806061706.m56H6RWT004933@mrapp54.mozilla.org";

const gMessage2 = "bugmail11" // message file used as the test message for fooFolder
const gMsgId2 = "200804111417.m3BEHTk4030129@mrapp51.mozilla.org";
const gXGmMsgid2 = "1278455345230334555";
const gXGmThrid2 = "1266894639832287111";
const gXGmLabels2 = '(\"\\\\Sent\")';

const nsMsgMessageFlags = Ci.nsMsgMessageFlags;

var fooBox;
var imapInbox;
var fooFolder;
var rootFolder;

var gImapInboxOfflineStoreSizeInitial;
var gImapInboxOfflineStoreSizeFinal;

var gFooOfflineStoreSizeInitial;
var gFooOfflineStoreSizeFinal;
// We use this as a display consumer
var streamListener =
{
  _data: "",

  QueryInterface:
    XPCOMUtils.generateQI([Ci.nsIStreamListener, Ci.nsIRequestObserver]),

  // nsIRequestObserver
  onStartRequest: function(aRequest, aContext) {
  },
  onStopRequest: function(aRequest, aContext, aStatusCode) {
    do_check_eq(aStatusCode, 0);
  },

  // nsIStreamListener
  onDataAvailable: function(aRequest, aContext, aInputStream, aOffset, aCount) {
    let scriptStream = Cc["@mozilla.org/scriptableinputstream;1"]
                         .createInstance(Ci.nsIScriptableInputStream);

    scriptStream.init(aInputStream);

    scriptStream.read(aCount);
  }
};

function setup()
{
  // We aren't interested in downloading messages automatically
  Services.prefs.setBoolPref("mail.server.server1.autosync_offline_stores", false);
  Services.prefs.setBoolPref("mail.server.server1.offline_download", true);
  Services.prefs.setBoolPref("mail.biff.alert.show_preview", false);

  setupIMAPPump("GMail");

  // these hacks are required because we've created the inbox before
  // running initial folder discovery, and adding the folder bails
  // out before we set it as verified online, so we bail out, and
  // then remove the INBOX folder since it's not verified.
  gIMAPInbox.hierarchyDelimiter = '/';
  gIMAPInbox.verifiedAsOnlineFolder = true;

  let imapInbox =  gIMAPDaemon.getMailbox("INBOX");

  // Creating the mailbox "foo"
  gIMAPDaemon.createMailbox("foo", {subscribed : true}, {"uidnext": 150});
  fooBox = gIMAPDaemon.getMailbox("foo");

  // Add message1 to inbox.
  message = new imapMessage(specForFileName(gMessage1),
                          imapInbox.uidnext++, []);
  message.messageId = gMsgId1;
  message.xGmMsgid = gXGmMsgid1;
  message.xGmThrid = gXGmThrid1;
  message.xGmLabels = gXGmLabels11; // With labels excluding "//INBOX"
  imapInbox.addMessage(message);
}

function addFoo()
{
  // Adding our test message
  message = new imapMessage(specForFileName(gMessage1),
                          fooBox.uidnext++, []);
  message.messageId = gMsgId1;
  message.xGmMsgid = gXGmMsgid1;
  message.xGmThrid = gXGmThrid1;
  message.xGmLabels = gXGmLabels12; // With labels excluding "foo"
  fooBox.addMessage(message);
  // Adding another message so that fooFolder behaves as LocalFolder while calculating it's size.
  message1 = new imapMessage(specForFileName(gMessage2),
                          fooBox.uidnext++, []);
  message1.messageId = gMsgId2;
  message1.xGmMsgid = gXGmMsgid2;
  message1.xGmThrid = gXGmThrid2;
  message1.xGmLabels = gXGmLabels2;
  fooBox.addMessage(message1);
}

var gIMAPService;

var tests = [
  setup,
  function updateFolder()
  {
    gIMAPInbox.updateFolderWithListener(null, asyncUrlListener);
    yield false;
  },
  function selectInboxMsg()
  {
    // Select mesasage1 from inbox which makes message1 available in offline store.
    gIMAPService = Cc["@mozilla.org/messenger/messageservice;1?type=imap"]
                       .getService(Ci.nsIMsgMessageService);
    let db = gIMAPInbox.msgDatabase;
    let msg1 = db.getMsgHdrForMessageID(gMsgId1);
    let url = new Object;
    gIMAPService.DisplayMessage(gIMAPInbox.getUriForMsg(msg1),
                                            streamListener,
                                            null,
                                            asyncUrlListener,
                                            null,
                                            url);
    yield false;
  },
  function StreamMessageInbox()
  {
    // Stream message1 from inbox
    let newMsgHdr = gIMAPInbox.msgDatabase.getMsgHdrForMessageID(gMsgId1);
    let msgURI = newMsgHdr.folder.getUriForMsg(newMsgHdr);
    let messenger = Cc["@mozilla.org/messenger;1"].createInstance(Ci.nsIMessenger);
    let msgServ = messenger.messageServiceFromURI(msgURI);
    msgServ.streamMessage(msgURI, gStreamListener, null, null, false, "", false);
    gImapInboxOfflineStoreSizeInitial = gIMAPInbox.filePath.fileSize; // Initial Size of Inbox
    yield false;
  },
  function createAndUpdate()
  {
    rootFolder = gIMAPIncomingServer.rootFolder;
    fooFolder =  rootFolder.getChildNamed("foo").QueryInterface(Ci.nsIMsgImapMailFolder); // We have created the mailbox earlier.
    fooFolder.updateFolderWithListener(null, asyncUrlListener);
    yield false;
  },
  addFoo,
  function updateFoo() {
    fooFolder.updateFolderWithListener(null, asyncUrlListener);
    yield false;
  },
  function selectFooMsg()
  {
    // Select message2 from fooFolder, which makes fooFolder a local folder.
    gIMAPService = Cc["@mozilla.org/messenger/messageservice;1?type=imap"]
                       .getService(Ci.nsIMsgMessageService);
    let msg1 = fooFolder.msgDatabase.getMsgHdrForMessageID(gMsgId2);
    let url = new Object;
    gIMAPService.DisplayMessage(fooFolder.getUriForMsg(msg1),
                                            streamListener,
                                            null,
                                            asyncUrlListener,
                                            null,
                                            url);
    yield false;
  },
  function StreamMessageFoo()
  {
    // Stream message2 from fooFolder
    let newMsgHdr = fooFolder.msgDatabase.getMsgHdrForMessageID(gMsgId2);
    let msgURI = newMsgHdr.folder.getUriForMsg(newMsgHdr);
    let messenger = Cc["@mozilla.org/messenger;1"].createInstance(Ci.nsIMessenger);
    let msgServ = messenger.messageServiceFromURI(msgURI);
    msgServ.streamMessage(msgURI, gStreamListener, null, null, false, "", false);
    gFooOfflineStoreSizeInitial = fooFolder.filePath.fileSize;
    yield false;
  },
  function crossStreaming()
  {
    /**
     * Streaming message1 from fooFolder. message1 is present in
     * offline store of inbox. We now test that streaming the message1
     * from fooFolder does not make us add message1 to offline store of
     * fooFolder. We check this by comparing the sizes of inbox and fooFolder
     * before and after streaming.
     */
    let msg2 = fooFolder.msgDatabase.getMsgHdrForMessageID(gMsgId1);
    do_check_neq(msg2, null);
    let msgURI = fooFolder.getUriForMsg(msg2);
    let messenger = Cc["@mozilla.org/messenger;1"].createInstance(Ci.nsIMessenger);
    let msgServ = messenger.messageServiceFromURI(msgURI);
    // pass true for aLocalOnly since message should be in offline store of Inbox.
    msgServ.streamMessage(msgURI, gStreamListener, null, null, false, "", true);
    gFooOfflineStoreSizeFinal = fooFolder.filePath.fileSize;
    gImapInboxOfflineStoreSizeFinal = gIMAPInbox.filePath.fileSize;
    do_check_eq(gFooOfflineStoreSizeFinal, gFooOfflineStoreSizeInitial);
    do_check_eq(gImapInboxOfflineStoreSizeFinal,gImapInboxOfflineStoreSizeInitial);
    yield false;
  },
  teardown
]

asyncUrlListener.callback = function(aUrl, aExitCode) {
  do_check_eq(aExitCode, 0);
};

function teardown() {
  teardownIMAPPump();
}

function run_test() {
  async_run_tests(tests);
}

/*
 * helper functions
 */
gStreamListener = {
  QueryInterface : XPCOMUtils.generateQI([Ci.nsIStreamListener]),
  _stream : null,
  _data : null,
  onStartRequest : function (aRequest, aContext) {
    this._data = "";
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

// given a test file, return the file uri spec
function specForFileName(aFileName)
{
  let file = do_get_file("../../../data/" + aFileName);
  let msgfileuri = Cc["@mozilla.org/network/io-service;1"]
                     .getService(Ci.nsIIOService)
                     .newFileURI(file)
                     .QueryInterface(Ci.nsIFileURL);
  return msgfileuri.spec;
}

